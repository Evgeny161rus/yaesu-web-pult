import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from dxcluster import DxCluster, TelnetText, parse_spot, validate_config  # noqa: E402


def line(call='JA1ABC', freq='14025.0', comment='CW CQ', utc=None):
    utc = utc or datetime.now(timezone.utc).strftime('%H%M')
    return f'DX de R6ABC: {freq} {call} {comment} {utc}Z'


class ParserTests(unittest.TestCase):
    def test_spot_frequency_mode_and_midnight(self):
        now = datetime(2026, 11, 24, 0, 1, tzinfo=timezone.utc).timestamp()
        s = parse_spot(line(utc='2359', comment='CW UP 5'), now)
        self.assertEqual(s['freq'], 14025000)
        self.assertEqual(s['band'], '20m')
        self.assertEqual(s['mode'], 'CW')
        self.assertEqual(now - s['time'], 120)
        self.assertEqual(s['comment'], 'CW UP 5')

    def test_mode_is_not_guessed_from_frequency(self):
        self.assertEqual(parse_spot(line(comment='CQ DX'))['mode'], '')
        self.assertIsNone(parse_spot(line(utc='2561')))
        self.assertIsNone(parse_spot(line(freq='99999999999999')))
        self.assertIsNone(parse_spot('Welcome to DXSpider'))

    def test_config_cannot_inject_cluster_commands(self):
        good = {'host': 'dxc.example.org', 'port': 7300, 'call': 'r6abc/p'}
        self.assertEqual(validate_config(good)['call'], 'R6ABC/P')
        for key, value in [('call', 'R6ABC\nDX 14025 JA1ABC'), ('host', 'http://example.org'),
                           ('port', 0), ('port', 'oops'), ('call', '1234')]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                validate_config(dict(good, **{key: value}))

    def test_fragmented_telnet_options_and_subnegotiation(self):
        decoder = TelnetText()
        text, replies = bytearray(), bytearray()
        for b in b'lo\xff\xfb\x01gin:\xff\xfa\x18hidden\xff\xf0':
            a, r = decoder.feed(bytes([b]))
            text.extend(a)
            replies.extend(r)
        self.assertEqual(text, b'login:')
        self.assertEqual(replies, b'\xff\xfe\x01')


class ClusterTests(unittest.IsolatedAsyncioTestCase):
    def make_cluster(self):
        wk = SimpleNamespace(n=1, status=lambda call, band: (['worked'], {'name': 'Japan'}))
        self.station = SimpleNamespace(cfg={}, ft=SimpleNamespace(wk=wk), broadcast=Mock(),
                                       save_cfg=Mock(), rig=None, ptt_owner=None)
        self.cluster = DxCluster(self.station)
        return self.cluster

    async def asyncTearDown(self):
        if hasattr(self, 'cluster'):
            await self.cluster.stop()

    async def test_deduplicate_expire_and_bound_cache(self):
        dx = self.make_cluster()
        dx.ingest(line())
        dx.ingest(line(comment='CW UP 5'))
        s = dx.snapshot()['spots']
        self.assertEqual(len(s), 1)
        self.assertEqual(s[0]['count'], 2)
        self.assertEqual(s[0]['country'], 'Japan')
        self.assertEqual(s[0]['tags'], ['worked'])
        for i in range(510):
            dx.ingest(line(call=f'JA{i}ABC'))
        self.assertEqual(len(dx.snapshot()['spots']), 500)
        with patch('dxcluster.time.time', return_value=time.time() + 3700):
            self.assertEqual(dx.snapshot()['spots'], [])

    async def test_real_socket_login_fragments_and_cleanup(self):
        dx = self.make_cluster()
        received = []
        finished = asyncio.Event()

        async def peer(reader, writer):
            try:
                writer.write(b'lo')
                await writer.drain()
                await asyncio.sleep(.01)
                writer.write(b'gin: ')
                await writer.drain()
                received.append(await reader.readline())
                raw = (line() + '\r\n').encode()
                writer.write(raw[:19])
                await writer.drain()
                await asyncio.sleep(.01)
                writer.write(raw[19:])
                await writer.drain()
                received.append(await reader.read())
            finally:
                writer.close()
                await writer.wait_closed()
                finished.set()

        server = await asyncio.start_server(peer, '127.0.0.1', 0)
        try:
            await dx.start({'host': '127.0.0.1', 'port': server.sockets[0].getsockname()[1], 'call': 'R6ABC'})
            for _ in range(100):
                if dx.state == 'live':
                    break
                await asyncio.sleep(.01)
            self.assertEqual(dx.state, 'live')
            self.assertEqual(len(dx.snapshot()['spots']), 1)
            await dx.stop()
            await asyncio.wait_for(finished.wait(), 2)
            self.assertEqual(received, [b'R6ABC\r\n', b''])
            self.assertIsNone(dx.task)
            self.assertIsNone(dx.writer)
        finally:
            await dx.stop()
            server.close()
            await server.wait_closed()

    async def test_tuning_only_rx_and_reject_tx_stale_or_unknown(self):
        dx = self.make_cluster()
        dx.ingest(line(comment='CW UP 5'))
        spot = dx.snapshot()['spots'][0]
        rig = SimpleNamespace(state={'connected': True, 'vfo': 1}, set_param=Mock())
        self.station.rig = rig
        messages = []
        client = SimpleNamespace(ws=SimpleNamespace(send_json=messages.append))
        await dx.on_msg(client, {'t': 'dx_tune', 'id': spot['id']})
        rig.set_param.assert_called_once_with('freq_b', 14025000)
        rig.set_param.reset_mock()
        rig.state['tx'] = True
        await dx.on_msg(client, {'t': 'dx_tune', 'id': spot['id']})
        rig.state['tx'] = False
        await dx.on_msg(client, {'t': 'dx_tune', 'id': 'fake'})
        with patch('dxcluster.time.time', return_value=time.time() + 3700):
            await dx.on_msg(client, {'t': 'dx_tune', 'id': spot['id']})
        rig.set_param.assert_not_called()
        self.assertEqual(len(messages), 3)

    async def test_unauthenticated_messages_do_not_reach_cluster(self):
        import main
        with tempfile.TemporaryDirectory() as directory, patch.object(main, 'BASE', directory):
            station = main.Station(dict(main.DEFAULT_CFG))
            client = SimpleNamespace(authed=False, ws=SimpleNamespace(send_json=Mock()))
            for action in ('dx_hello', 'dx_connect', 'dx_tune', 'dx_disconnect'):
                await station._on_msg(client, {'t': action})
            client.ws.send_json.assert_not_called()
            self.assertIsNone(station.dx.task)
