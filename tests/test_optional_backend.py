"""Exercise native startup in a fresh process where Hamlib cannot be imported."""
import os
from pathlib import Path
import subprocess
import sys
import unittest


class OptionalBackendTests(unittest.TestCase):
    def test_native_without_hamlib(self):
        server = Path(__file__).resolve().parents[1] / 'server'
        code = r'''
import asyncio, importlib.abc, sys, tempfile
class NoHamlib(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == 'hamlib_backend':
            raise ModuleNotFoundError('intentionally absent', name=fullname)
sys.meta_path.insert(0, NoHamlib())
import main
from radio_backends import list_hamlib_models
async def check():
    with tempfile.TemporaryDirectory() as directory:
        main.BASE = directory
        station = main.Station(dict(main.DEFAULT_CFG, simulate=True, ai_enabled=False))
        await station.init()
        try:
            for _ in range(2):
                await station.start_radio()
                assert station.running, station.last_error
                assert station.rig.state['backend'] == 'native'
                assert 'hamlib_backend' not in sys.modules
                await station.stop_radio()
            try:
                list_hamlib_models('rigctld')
            except RuntimeError as exc:
                assert 'Hamlib' in str(exc)
            else:
                raise AssertionError('missing backend was accepted')
            await station.start_radio()
            assert station.running, station.last_error
        finally:
            await station.stop_radio()
asyncio.run(check())
'''
        env = dict(os.environ, PYTHONPATH=str(server))
        result = subprocess.run([sys.executable, '-c', code], env=env,
                                capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors='replace'))
