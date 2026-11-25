import io
import struct
import subprocess
import sys
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from rtlsdr_scope import RtlSdrScope  # noqa: E402


class FakeStdout(io.BytesIO):
    def __init__(self, chunks):
        super().__init__()
        self._chunks = list(chunks)
        self._cv = threading.Condition()
        self._i = 0
        self._closed = False

    def read(self, n=-1):
        with self._cv:
            while self._i >= len(self._chunks) and not self._closed:
                self._cv.wait(timeout=0.1)
            if self._i >= len(self._chunks):
                return b''
            chunk = self._chunks[self._i]
            self._i += 1
            return chunk

    def close(self):
        with self._cv:
            self._closed = True
            self._cv.notify_all()
        try:
            super().close()
        except Exception:
            pass


class FakeProc:
    def __init__(self, chunks):
        self.stdout = FakeStdout(chunks)
        self.stderr = io.BytesIO(b'')
        self._poll = None
        self.pid = 12345

    def poll(self):
        return self._poll

    def terminate(self):
        self._poll = -15
        self.stdout.close()

    def wait(self, timeout=None):
        self._poll = -15
        return -15

    def kill(self):
        self._poll = -9
        self.stdout.close()


def make_cu8_frames(n_frames=3, fft_n=1024):
    # constant IQ -> strong DC after FFT shift; enough for pipeline test
    frame = bytes([128, 128]) * fft_n  # zero signal
    # add a tone in one frame to ensure non-flat output
    import math
    tone = bytearray()
    for i in range(fft_n):
        s = math.sin(2 * math.pi * 50 * i / fft_n)
        c = math.cos(2 * math.pi * 50 * i / fft_n)
        tone += bytes([int(127.5 + 60 * c), int(127.5 + 60 * s)])
    chunks = [bytes(tone)] * n_frames + [frame] * n_frames
    return chunks


class RtlSdrScopeTests(unittest.TestCase):
    def test_emits_rf_frame_with_expected_header(self):
        chunks = make_cu8_frames(n_frames=6, fft_n=1024)
        proc = FakeProc(chunks)
        frames = []
        statuses = []
        got = threading.Event()

        def on_frame(center, span, levels):
            frames.append((center, span, levels))
            got.set()

        def on_status(state, reason, span):
            statuses.append((state, reason, span))

        with mock.patch('rtlsdr_scope.subprocess.Popen', return_value=proc):
            s = RtlSdrScope(on_frame=on_frame, on_status=on_status)
            s.start(center_hz=145_250_000, sample_rate=1_024_000, gain=40, fft=1024)
            try:
                self.assertTrue(got.wait(timeout=5), f"no frames, statuses={statuses}")
            finally:
                s.stop()

        self.assertTrue(frames)
        center, span, levels = frames[0]
        self.assertEqual(center, 145_250_000)
        self.assertEqual(span, 1_024_000)
        self.assertEqual(len(levels), 1024)
        self.assertTrue(all(0 <= b <= 255 for b in levels))
        # header format used by web client: <QIH
        pkt = b'\x04' + struct.pack('<QIH', center, span, len(levels)) + levels
        c2, s2, n2 = struct.unpack('<QIH', pkt[1:15])
        self.assertEqual((c2, s2, n2), (145_250_000, 1_024_000, 1024))
        self.assertTrue(any(st[0] in ('starting', 'live') for st in statuses))

    def test_stop_is_idempotent(self):
        s = RtlSdrScope(on_frame=lambda *a: None)
        s.stop()
        s.stop()
        self.assertFalse(s.running)

    def test_custom_executable_is_used(self):
        exe = r'C:\tools\rtlsdr\rtl_sdr.exe'
        s = RtlSdrScope(on_frame=lambda *a: None, executable=exe)
        self.assertEqual(s._build_cmd(14_100_000, 1_024_000, 40)[0], exe)


class HiddenConsoleTests(unittest.TestCase):
    """Windows GUI-сборка не должна показывать DOS-окно SDR-утилиты."""

    def test_windows_uses_create_no_window(self):
        import rtlsdr_scope
        self.assertEqual(rtlsdr_scope._popen_window_flags('win32'), 0x08000000)

    def test_other_platforms_use_no_flags(self):
        import rtlsdr_scope
        for plat in ('linux', 'darwin', 'freebsd13'):
            self.assertEqual(rtlsdr_scope._popen_window_flags(plat), 0)

    def test_sdr_process_starts_with_hidden_console(self):
        import rtlsdr_scope
        chunks = make_cu8_frames(n_frames=3, fft_n=1024)
        proc = FakeProc(chunks)
        got = threading.Event()
        with mock.patch('rtlsdr_scope.subprocess.Popen', return_value=proc) as popen, \
                mock.patch('rtlsdr_scope._popen_window_flags', return_value=0x08000000):
            s = rtlsdr_scope.RtlSdrScope(on_frame=lambda *a: got.set())
            s.start(center_hz=145_000_000, sample_rate=1_024_000, gain=40, fft=1024)
            try:
                self.assertTrue(got.wait(timeout=5))
            finally:
                s.stop()
        kwargs = popen.call_args.kwargs
        self.assertEqual(kwargs.get('creationflags'), 0x08000000)
        self.assertFalse(kwargs.get('shell', False))


class SdrExecutableTests(unittest.TestCase):
    def test_local_tool_is_found(self):
        import os
        import tempfile
        import main
        name = 'rtl_sdr.exe' if os.name == 'nt' else 'rtl_sdr'
        with tempfile.TemporaryDirectory() as d:
            folder = os.path.join(d, 'tools', 'rtlsdr')
            os.makedirs(folder)
            exe = os.path.join(folder, name)
            open(exe, 'w').close()
            with mock.patch.object(main, 'BASE', d), \
                    mock.patch('shutil.which', return_value=None):
                self.assertEqual(main.sdr_executable('rtl_sdr'), exe)

    def test_path_tool_is_preferred(self):
        import main
        with mock.patch('shutil.which', return_value='/usr/bin/rtl_sdr'):
            self.assertEqual(main.sdr_executable('rtl_sdr'), '/usr/bin/rtl_sdr')

    def test_missing_tool_returns_empty(self):
        import main
        with mock.patch('shutil.which', return_value=None), \
                mock.patch.object(main, 'BASE', '/nonexistent-yaesu-root'):
            self.assertEqual(main.sdr_executable('rtl_sdr'), '')


class RtlSdrConfigTests(unittest.TestCase):
    def test_configure_has_rtlsdr_source(self):
        import configure
        keys = [k for k, _ in configure.WF_SOURCES]
        self.assertIn('rtlsdr', keys)
        self.assertIn('auto', keys)


if __name__ == '__main__':
    unittest.main()
