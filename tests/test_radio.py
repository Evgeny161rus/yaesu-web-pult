import asyncio
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from hamlib_backend import HamlibRig, RigError, list_models, parse_caps, parse_models
from yaesu_detect import parse_id
from yaesu_detect import probe
from webserver import valid_origin


class ParsingTests(unittest.TestCase):
    def test_modern_ids(self):
        self.assertEqual(parse_id(b'FA014200000;ID0800;')['id'], 1049)
        self.assertEqual(parse_id(b'ID0761;')['id'], 1042)
        self.assertEqual(parse_id(b'ID0670;')['name'], 'FT-991A')
        self.assertIsNone(parse_id(b'ID08'))
        with self.assertRaises(ValueError): parse_id(b'ID9999;')

    def test_caps_crlf_and_unsupported(self):
        caps = parse_caps('Model name:\tExample\r\nMode list: USB CW PKTUSB\r\n'
                          'Can get Frequency:\tY\r\nCan set Frequency:\tY\r\n'
                          'Can set PTT:\tN\r\nSet level: AF(0..1/0)\r\nGet level: AF(0..1/0)\r\n')
        self.assertTrue(caps['get_freq'])
        self.assertEqual(caps['keys'], ['af', 'freq_a'])
        self.assertIn('DATA-U', caps['modes'])
        self.assertFalse(caps['ptt'])

    def test_models_all_manufacturers(self):
        text = (
            ' Rig #  Mfg                    Model                   Version         Status      Macro\n'
            '     1  Hamlib                 Dummy                   20240709.0      Stable      RIG_MODEL_DUMMY\n'
            '     4  FLRig                                          20250107.0      Stable      RIG_MODEL_FLRIG\n'
            '  1001  Yaesu                  FT-847                  20230512.0      Stable      RIG_MODEL_FT847\n'
            '  1049  Yaesu                  FT-710                  20250107.0      Stable      RIG_MODEL_FT710\n'
            '  3070  Icom                   IC-7300                 20241015.0      Stable      RIG_MODEL_IC7300\n'
        )
        models = parse_models(text)
        by_id = {m['id']: m for m in models}
        self.assertEqual(by_id[1001]['mfg'], 'Yaesu')
        self.assertEqual(by_id[1001]['name'], 'FT-847')
        self.assertEqual(by_id[3070]['mfg'], 'Icom')
        self.assertEqual(by_id[3070]['status'], 'Stable')
        # FLRig has an empty model column and must not shift the status column.
        self.assertEqual(by_id[4]['name'], 'FLRig')
        self.assertEqual(by_id[4]['status'], 'Stable')

    def test_rig_error_keeps_code(self):
        self.assertEqual(RigError('boom', code=-11).code, -11)

    def test_origin(self):
        self.assertTrue(valid_origin('http://localhost:8080', 'localhost:8080', False))
        self.assertTrue(valid_origin('https://192.168.1.5:8443', '192.168.1.5:8443', True))
        # Reverse proxy must preserve Host (see docs/REMOTE-VPS.md).
        self.assertTrue(valid_origin('https://pult.example.com', 'pult.example.com', True))
        self.assertFalse(valid_origin('https://pult.example.com', '10.8.0.2:8443', True))
        for origin in ['', 'null', 'https://evil.example', 'http://localhost:8080/path', 'https://localhost:8080']:
            self.assertFalse(valid_origin(origin, 'localhost:8080', False))

    def test_probe_only_sends_id_with_lines_off(self):
        events = []
        class Serial:
            def __init__(self, **kwargs): self.rts = self.dtr = True
            def open(self):
                self_test.assertFalse(self.rts); self_test.assertFalse(self.dtr)
                events.append('open')
            def reset_input_buffer(self): pass
            def write(self, data): events.append(data)
            def read(self, n): return b'ID0800;'
            def close(self): events.append('close')
        self_test = self
        with patch.dict(sys.modules, {'serial': SimpleNamespace(Serial=Serial)}):
            self.assertEqual(probe('TEST',38400)['name'],'FT-710')
        self.assertEqual(events,['open',b'ID;','close'])


class ProtocolTests(unittest.IsolatedAsyncioTestCase):
    async def test_fragmented_response_and_error(self):
        async def peer(reader, writer):
            await reader.readline()
            for data in [b'get_freq:\nFre', b'quency: 14200000\nRP', b'RT 0\n']:
                writer.write(data); await writer.drain(); await asyncio.sleep(.01)
            await reader.readline()
            writer.write(b'set_mode: BAD 0\nRPRT -1\n'); await writer.drain()
            writer.close()
        server = await asyncio.start_server(peer, '127.0.0.1', 0)
        rig = HamlibRig({}, lambda d: None)
        try:
            rig.reader, rig.writer = await asyncio.open_connection('127.0.0.1', server.sockets[0].getsockname()[1])
            self.assertEqual((await rig.request('get_freq'))['Frequency'], '14200000')
            with self.assertRaises(RigError): await rig.request('set_mode BAD 0')
            with self.assertRaises(ValueError): await rig.request('get_freq\nset_ptt 1')
        finally:
            await rig.aclose(); server.close(); await server.wait_closed()

    async def test_drop_closes_state_and_drops_pending(self):
        rig = HamlibRig({}, lambda d: None)
        rig.state['connected'] = True
        async def broken(*args): raise ConnectionError('lost')
        rig.request = broken
        rig._pending['freq_a'] = 'set_freq 14200000'
        await rig._worker()
        self.assertFalse(rig.state['connected'])
        self.assertFalse(rig._pending)
        with self.assertRaises(ValueError): rig.ptt(True)


@unittest.skipUnless(os.environ.get('HAMLIB_TEST_EXE'), 'Set HAMLIB_TEST_EXE to test real rigctld Dummy')
class DummyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.rig = HamlibRig({'hamlib_path': os.environ['HAMLIB_TEST_EXE'], 'hamlib_model': 1}, lambda d: None)
        await self.rig.start()

    async def asyncTearDown(self):
        await self.rig.aclose()
        self.assertIsNotNone(self.rig.process.returncode)

    async def until(self, predicate):
        for _ in range(60):
            if predicate(): return
            await asyncio.sleep(.05)
        self.fail(str(self.rig.state))

    async def test_models_and_controls(self):
        models = await asyncio.to_thread(list_models, os.environ['HAMLIB_TEST_EXE'])
        self.assertTrue({1049, 1042, 1040, 1044, 1051, 1020, 1022} <= {m['id'] for m in models})
        self.rig.set_param('freq_a', 14200000)
        self.rig.set_param('mode', 'USB')
        self.rig.set_param('af', 128)
        await self.until(lambda: self.rig.state.get('freq_a') == 14200000 and self.rig.state.get('mode') == 'USB' and abs(self.rig.state.get('af', 0) - 128) < .01)
        for key, value in [('power', 100), ('mode', 'UNKNOWN'), ('freq_a', float('nan')), ('af', 999)]:
            with self.assertRaises(ValueError): self.rig.set_param(key, value)
        self.rig.ptt(True)
        await self.until(lambda: self.rig.state['tx'])
        self.rig.ptt(False)
        await self.until(lambda: not self.rig.state['tx'])

    async def test_last_frequency_wins_and_release_cancels_queued_tx(self):
        for freq in range(14000000, 14000100): self.rig.set_param('freq_a', freq)
        self.assertEqual(len(self.rig._pending), 1)
        self.rig.ptt(True); self.rig.ptt(False)
        await self.until(lambda: self.rig.state.get('freq_a') == 14000099)
        self.assertFalse(self.rig.state['tx'])


@unittest.skipUnless(os.environ.get('HAMLIB_TEST_EXE'), 'Requires Hamlib Dummy')
class StationTests(unittest.IsolatedAsyncioTestCase):
    async def test_restart_watchdog_and_server_guards(self):
        import main
        with tempfile.TemporaryDirectory() as directory, patch.object(main,'BASE',directory):
            cfg=dict(main.DEFAULT_CFG,radio_backend='hamlib',hamlib_model=1,
                     hamlib_path=os.environ['HAMLIB_TEST_EXE'],ai_enabled=False,ai_auto_analyze=False)
            station=main.Station(cfg)
            before=set(asyncio.all_tasks())
            await station.init()
            messages=[]
            client=SimpleNamespace(name='test',authed=True,local=False,ws=SimpleNamespace(send_json=messages.append))
            try:
                await station.start_radio()
                self.assertTrue(station.running,station.last_error)
                station.set_ptt(client,True)
                await asyncio.sleep(.5)
                self.assertTrue(station.rig.state['tx'])
                await asyncio.sleep(1.6)
                self.assertIsNone(station.ptt_owner)
                self.assertFalse(station.rig.state['tx'])
                await station._on_msg(client,{'t':'raw','c':'TX1;'})
                self.assertTrue(any('FTX-1' in m.get('msg','') for m in messages))
                old=station.rig
                await station.stop_radio()
                self.assertIsNotNone(old.process.returncode)
                await station.start_radio()
                self.assertTrue(station.running)
                self.assertFalse(station.rig.state['tx'])
                await station.stop_radio()
                # Direct CAT TX is rejected even for native clients.
                sent=[]
                station.rig=SimpleNamespace(send=sent.append)
                await station._on_msg(client,{'t':'raw','c':'FA; TX1;'})
                self.assertEqual(sent,[])
                await station._on_msg(client,{'t':'raw','c':'FA;'})
                self.assertEqual(sent,['FA;'])
            finally:
                await station.stop_radio()
                tasks=set(asyncio.all_tasks())-before
                for task in tasks: task.cancel()
                await asyncio.gather(*tasks,return_exceptions=True)


if __name__ == '__main__': unittest.main()
