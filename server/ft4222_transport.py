"""Explicit, synchronous FT-710 SPI transport. No import-time DLL/device access.

Use from one dedicated worker, never directly from the asyncio event loop.
Native library timeouts are requested, not a guarantee against a hung driver.
"""
import ctypes as C
import os
from pathlib import Path
import sys

_DLL_DIRS = []          # add_dll_directory handles must outlive the CDLL load


class Ft4222Error(RuntimeError):
    pass


def bind_api(spi, d2xx):
    # Vendor WinTypes.h uses unsigned int on Linux, not unsigned long (LP64).
    u32, u16, u8, handle = C.c_uint32, C.c_uint16, C.c_uint8, C.c_void_p
    signatures = [
        (d2xx, 'FT_OpenEx', u32, [C.c_void_p, u32, C.POINTER(handle)]),
        (d2xx, 'FT_Close', u32, [handle]),
        (d2xx, 'FT_SetTimeouts', u32, [handle, u32, u32]),
        (d2xx, 'FT_SetLatencyTimer', u32, [handle, u8]),
        (spi, 'FT4222_UnInitialize', C.c_int, [handle]),
        (spi, 'FT4222_SetClock', C.c_int, [handle, C.c_int]),
        (spi, 'FT4222_SPIMaster_Init', C.c_int,
         [handle, C.c_int, C.c_int, C.c_int, C.c_int, u8]),
        (spi, 'FT4222_SPIMaster_SingleRead', C.c_int,
         [handle, C.POINTER(u8), u16, C.POINTER(u16), u32]),
    ]
    for library, name, result, args in signatures:
        fn = getattr(library, name)
        fn.restype, fn.argtypes = result, args


def load_api(spi_path, d2xx_path=None):
    """Load only explicitly named absolute library files; no CWD/PATH probing."""
    def checked(path):
        p = Path(path)
        if not p.is_absolute() or not p.is_file():
            raise Ft4222Error('Specify an existing absolute FTDI library path')
        return str(p.resolve())
    try:
        # LibFT4222 may depend on ftd2xx in the same vendor folder; Windows
        # does not search that folder automatically for absolute loads.
        if sys.platform == 'win32' and hasattr(os, 'add_dll_directory'):
            for folder in {Path(checked(spi_path)).parent,
                           (Path(checked(d2xx_path)).parent if d2xx_path else None)}:
                if folder is not None:
                    _DLL_DIRS.append(os.add_dll_directory(str(folder)))
        # LibFT4222 API is cdecl; D2XX is WINAPI on Windows.
        spi = C.CDLL(checked(spi_path))
        if d2xx_path:
            loader = C.WinDLL if sys.platform == 'win32' else C.CDLL
            d2xx = loader(checked(d2xx_path))
        elif sys.platform != 'win32' and hasattr(spi, 'FT_OpenEx'):
            d2xx = spi
        else:
            raise Ft4222Error('Specify the D2XX library path')
        bind_api(spi, d2xx)
        return spi, d2xx
    except (OSError, AttributeError) as exc:
        raise Ft4222Error(f'Cannot load FTDI API: {exc}') from exc


class Ft4222Transport:
    def __init__(self, spi, d2xx, serial_number, timeout_ms=100):
        if not isinstance(serial_number, str) or not serial_number or '\0' in serial_number:
            raise ValueError('Explicit interface serial number required')
        target = serial_number.encode('ascii')
        if len(target) > 16:
            raise ValueError('FTDI serial number is too long')
        self._init(spi, d2xx, target, 1, timeout_ms)
        self.serial = target

    @classmethod
    def by_description(cls, spi, d2xx, description='FT4222 A', timeout_ms=100):
        """Open the named FTDI interface instead of requiring its serial.

        ``FT_OpenEx(..., FT_OPEN_BY_DESCRIPTION)`` matches wfview's behaviour
        and keeps setup simple when only one radio is attached. A serial number
        is still preferable when several FT4222 devices are present.
        """
        if not isinstance(description, str) or not description or '\0' in description:
            raise ValueError('Explicit FTDI description required')
        target = description.encode('ascii')
        if len(target) > 64:
            raise ValueError('FTDI description is too long')
        self = cls.__new__(cls)
        self._init(spi, d2xx, target, 2, timeout_ms)
        self.serial = b''
        return self

    def _init(self, spi, d2xx, target, flag, timeout_ms):
        if type(timeout_ms) is not int or not 1 <= timeout_ms <= 1000:
            raise ValueError('Timeout must be 1..1000 ms')
        self.spi, self.d2xx = spi, d2xx
        self.timeout_ms = timeout_ms
        self._target, self._flag = target, flag
        self.handle = None

    @staticmethod
    def _check(operation, status):
        if status != 0:
            raise Ft4222Error(f'{operation} failed (FTDI status {status})')

    def open(self):
        if self.handle is not None:
            raise Ft4222Error('Device is already open')
        h = C.c_void_p()
        target = C.create_string_buffer(self._target)
        self._check('FT_OpenEx', self.d2xx.FT_OpenEx(target, self._flag, C.byref(h)))
        if not h.value:
            raise Ft4222Error('FT_OpenEx returned a null handle')
        self.handle = h
        try:
            self._check('FT_SetTimeouts', self.d2xx.FT_SetTimeouts(h, self.timeout_ms, self.timeout_ms))
            self._check('FT_SetLatencyTimer', self.d2xx.FT_SetLatencyTimer(h, 2))
            self._check('FT4222_SPIMaster_Init', self.spi.FT4222_SPIMaster_Init(h, 1, 6, 1, 0, 1))
            self._check('FT4222_SetClock', self.spi.FT4222_SetClock(h, 1))
        except BaseException:
            self._close_after_error()
            raise
        return self

    def read(self, size=4096):
        """One bounded request; short/zero reads are returned, never padded."""
        if self.handle is None:
            raise Ft4222Error('Device is not open')
        if type(size) is not int or not 1 <= size <= 4096:
            raise ValueError('Read size must be 1..4096')
        buf = (C.c_uint8 * size)()
        count = C.c_uint16()
        try:
            self._check('FT4222_SPIMaster_SingleRead',
                        self.spi.FT4222_SPIMaster_SingleRead(self.handle, buf, size, C.byref(count), 0))
            if count.value > size:
                raise Ft4222Error('FTDI returned an invalid byte count')
            return bytes(buf[:count.value])
        except BaseException:
            self._close_after_error()
            raise

    def _close_after_error(self):
        try:
            self.close()
        except Exception:
            pass  # Preserve the original operation failure.

    def close(self):
        h, self.handle = self.handle, None
        if h is None:
            return
        try:
            self._check('FT4222_UnInitialize', self.spi.FT4222_UnInitialize(h))
        finally:
            self._check('FT_Close', self.d2xx.FT_Close(h))

    def __enter__(self):
        return self.open()

    def __exit__(self, kind, value, traceback):
        if kind is None:
            self.close()
        else:
            self._close_after_error()
