import ctypes as C
from pathlib import Path
import sys
import unittest
import tempfile
import json
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from ft4222_transport import Ft4222Transport, Ft4222Error, bind_api, load_api
from capture_ft710 import capture


class FakeApi:
    def __init__(self, fail='', data=b'abc', count=None):
        self.calls = []
        self.fail, self.data, self.count = fail, data, count

    def __getattr__(self, name):
        def call(*args):
            self.calls.append((name, args))
            if name == self.fail:
                return 4
            if name == 'FT_OpenEx':
                C.cast(args[2], C.POINTER(C.c_void_p))[0] = 123
            elif name == 'FT4222_SPIMaster_SingleRead':
                payload = self.data[:args[2]]
                for i, byte in enumerate(payload): args[1][i] = byte
                C.cast(args[3], C.POINTER(C.c_uint16))[0] = len(payload) if self.count is None else self.count
            return 0
        return call

    @property
    def names(self):
        return [name for name, args in self.calls]


class TransportTests(unittest.TestCase):
    def test_capture_preserves_reads_and_never_overwrites(self):
        api = FakeApi(data=b'abc')
        transport = Ft4222Transport(api, api, 'RADIO-A')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'capture.jsonl'
            capture(transport, path, 2)
            records = [json.loads(line) for line in path.read_text().splitlines()]
            self.assertEqual(records[0]['format'], 'ft710-spi-capture')
            self.assertEqual([r['hex'] for r in records[1:]], ['616263', '616263'])
            with self.assertRaises(FileExistsError): capture(transport, path, 2)
            self.assertEqual(api.names.count('FT_OpenEx'), 1)

    def test_selected_serial_settings_short_read_and_close(self):
        api = FakeApi()
        transport = Ft4222Transport(api, api, 'RADIO-A')
        with transport:
            self.assertEqual(transport.read(), b'abc')
            self.assertEqual(api.calls[0][1][0].value, b'RADIO-A')
            self.assertEqual(api.calls[0][1][1], 1)  # serial, never first device
            self.assertEqual(api.calls[1][1][1:], (100, 100))
            self.assertEqual(api.calls[3][1][1:], (1, 6, 1, 0, 1))
            self.assertEqual(api.calls[-1][1][-1], 0)
        transport.close()
        self.assertEqual(api.names.count('FT_Close'), 1)
        self.assertNotIn('FT_Write', api.names)
        self.assertNotIn('FT4222_SPIMaster_SingleWrite', api.names)

    def test_cleanup_at_each_failure(self):
        for step in ('FT_OpenEx', 'FT_SetTimeouts', 'FT_SetLatencyTimer',
                     'FT4222_SPIMaster_Init', 'FT4222_SetClock',
                     'FT4222_SPIMaster_SingleRead'):
            with self.subTest(step=step):
                api = FakeApi(fail=step)
                transport = Ft4222Transport(api, api, 'RADIO-A')
                with self.assertRaisesRegex(Ft4222Error, step):
                    with transport:
                        transport.read()
                self.assertIsNone(transport.handle)
                self.assertEqual(api.names.count('FT_Close'), int(step != 'FT_OpenEx'))

    def test_uninitialize_failure_still_closes(self):
        api = FakeApi(fail='FT4222_UnInitialize')
        transport = Ft4222Transport(api, api, 'RADIO-A').open()
        with self.assertRaises(Ft4222Error): transport.close()
        self.assertEqual(api.names[-1], 'FT_Close')
        transport.close()
        self.assertEqual(api.names.count('FT_Close'), 1)

    def test_empty_invalid_count_and_reopen(self):
        api = FakeApi(data=b'')
        transport = Ft4222Transport(api, api, 'RADIO-A')
        with transport:
            self.assertEqual(transport.read(), b'')
        api.count = 4097
        with self.assertRaises(Ft4222Error):
            with transport: transport.read()
        self.assertIsNone(transport.handle)
        api.count = None
        with transport: self.assertEqual(transport.read(), b'')

    def test_open_by_description(self):
        api = FakeApi()
        with Ft4222Transport.by_description(api, api) as transport:
            self.assertEqual(transport.read(), b'abc')
        self.assertEqual(api.calls[0][1][0].value, b'FT4222 A')
        self.assertEqual(api.calls[0][1][1], 2)  # FT_OPEN_BY_DESCRIPTION
        for description in ('', 'a\0b', 'x' * 65):
            with self.assertRaises(ValueError):
                Ft4222Transport.by_description(api, api, description)

    def test_validation_and_no_implicit_library_search(self):
        api = FakeApi()
        for serial in ('', 'a\0b', 'x'*17):
            with self.assertRaises(ValueError): Ft4222Transport(api, api, serial)
        with self.assertRaises(Ft4222Error): load_api('LibFT4222.dll')
        with Ft4222Transport(api, api, 'RADIO-A') as transport:
            for size in (0, 4097, True, 1.5):
                with self.assertRaises(ValueError): transport.read(size)
        self.assertNotIn('FT4222_SPIMaster_SingleRead', api.names)

    def test_abi_widths(self):
        names = ('FT_OpenEx', 'FT_Close', 'FT_SetTimeouts', 'FT_SetLatencyTimer',
                 'FT4222_UnInitialize', 'FT4222_SetClock',
                 'FT4222_SPIMaster_Init', 'FT4222_SPIMaster_SingleRead')
        api = SimpleNamespace(**{name: (lambda: None) for name in names})
        bind_api(api, api)
        self.assertEqual(C.sizeof(api.FT_OpenEx.restype), 4)
        self.assertEqual(C.sizeof(api.FT_SetTimeouts.argtypes[1]), 4)
        self.assertEqual(C.sizeof(api.FT4222_SPIMaster_SingleRead.argtypes[-1]), 4)
        self.assertEqual(C.sizeof(api.FT4222_SPIMaster_SingleRead.argtypes[2]), 2)
