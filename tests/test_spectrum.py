import asyncio
from dataclasses import replace
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from spectrum import SpectrumFrame, LatestSpectrum


def frame(**kwargs):
    return replace(SpectrumFrame('test', 'rf', 14000000, 100, bytes([0, 255]),
                                 'relative', 0, 1), **kwargs)


class SpectrumTests(unittest.TestCase):
    def test_validation(self):
        for fields in ({'bin_hz': 0}, {'first_hz': float('nan')},
                       {'levels': b''}, {'levels': bytearray([1, 2])},
                       {'levels': bytes(8193)}, {'unit': 'unknown'},
                       {'domain': 'unknown'}, {'level_step': -1}):
            with self.subTest(fields=str(fields)[:80]), self.assertRaises(ValueError):
                frame(**fields)

    def test_latest_only_stale_clear_and_scale(self):
        now = [10.0]
        store = LatestSpectrum(clock=lambda: now[0])
        self.assertEqual(store.snapshot()['status'], 'unavailable')
        for n in range(10000):
            store.publish(frame(first_hz=14000000 + n))
        snapshot = store.snapshot()
        self.assertEqual(snapshot['sequence'], 10000)
        self.assertEqual(snapshot['frame']['first_hz'], 14009999)
        snapshot['frame']['levels'][0] = 123
        self.assertEqual(store.snapshot()['frame']['levels'][0], 0)
        now[0] += 1
        self.assertEqual(store.snapshot()['status'], 'stale')
        self.assertIsNone(store.snapshot()['frame'])
        store.clear()
        self.assertEqual(store.snapshot()['status'], 'unavailable')
        store.publish(frame(source='new'))
        self.assertEqual(store.snapshot()['sequence'], 10001)


class SpectrumIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_audio_scale_auth_and_restart(self):
        import main
        import numpy as np
        with tempfile.TemporaryDirectory() as directory, patch.object(main, 'BASE', directory):
            station = main.Station(dict(main.DEFAULT_CFG, simulate=True, ai_enabled=False))
            tasks_before = set(asyncio.all_tasks())
            await station.init()
            messages = []
            client = SimpleNamespace(authed=False, local=False,
                                     ws=SimpleNamespace(send_json=messages.append))
            try:
                await station.start_radio()
                self.assertTrue(station.running, station.last_error)
                # Bin-centred sine tests the real FFT adapter's frequency and level units.
                station.wf = main.Waterfall()
                n = np.arange(station.wf.N)
                station._on_rx_audio((.5 * np.sin(2*np.pi*80*n/station.wf.N)).astype(np.float32))
                await station._on_msg(client, {'t': 'spectrum_get'})
                self.assertEqual(messages, [])
                client.authed = True
                await station._on_msg(client, {'t': 'spectrum_get'})
                f = messages[-1]['frame']
                self.assertEqual(f['domain'], 'audio')
                self.assertTrue(f['demo'])
                self.assertEqual(f['unit'], 'dBFS')
                self.assertEqual(int(np.argmax(f['levels'])), 80)
                self.assertAlmostEqual(f['levels'][80]*f['level_step']+f['level_offset'], -6, delta=1)
                await station.stop_radio()
                self.assertEqual(station.spectrum.snapshot()['status'], 'unavailable')
                await station.start_radio()
                self.assertEqual(station.spectrum.snapshot()['status'], 'unavailable')
            finally:
                await station.stop_radio()
                tasks = set(asyncio.all_tasks()) - tasks_before
                for task in tasks: task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
