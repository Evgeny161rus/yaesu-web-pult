import asyncio
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import main  # noqa: E402


class AutoConnectTests(unittest.IsolatedAsyncioTestCase):
    async def test_retries_until_radio_port_appears(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(main, 'BASE', directory):
            station = main.Station(dict(main.DEFAULT_CFG, auto_connect=True))
            station.quit_event = asyncio.Event()
            station.connect_retry_delay = 0.01
            attempts = []

            async def fake_start():
                attempts.append(1)
                if len(attempts) >= 3:
                    station.running = True
                else:
                    station.last_error = 'порт не найден'

            station.start_radio = fake_start
            station.request_connect()
            for _ in range(100):
                if station.running:
                    break
                await asyncio.sleep(0.02)
            self.assertTrue(station.running)
            self.assertEqual(len(attempts), 3)

    async def test_stop_cancels_pending_reconnect(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(main, 'BASE', directory):
            station = main.Station(dict(main.DEFAULT_CFG, auto_connect=True))
            station.quit_event = asyncio.Event()
            station.connect_retry_delay = 10
            attempts = []

            async def fake_start():
                attempts.append(1)

            station.start_radio = fake_start
            station.request_connect()
            await asyncio.sleep(0.05)
            await station.stop_radio()
            self.assertFalse(station.connect_wanted)
            self.assertIsNone(station._connect_task)
            self.assertEqual(len(attempts), 1)


if __name__ == '__main__':
    unittest.main()
