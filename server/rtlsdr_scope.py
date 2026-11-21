"""RTL-SDR RF waterfall source for Yaesu Web Pult.

Produces the same binary \x04 frames as the FT4222 scope:
  b'\x04' + <QIH little-endian center_hz, span_hz, n> + levels[n]

Levels are unsigned 8-bit dB-scaled power (0..255), like other RF spectrum frames.
Runs rtl_sdr as a subprocess and computes FFT with numpy. No pyrtlsdr dependency.
"""
from __future__ import annotations
import logging, math, struct, subprocess, threading, time
import numpy as np

log = logging.getLogger(__name__)


class RtlSdrScope:
    def __init__(self, on_frame, on_status=None):
        self.on_frame = on_frame      # on_frame(center_hz:int, span_hz:int, levels:bytes)
        self.on_status = on_status    # on_status(state:str, reason:str, span:int)
        self._stop = threading.Event()
        self._thread = None
        self._proc = None
        self._lock = threading.Lock()
        self._center = 14_100_000
        self._sr = 1_024_000
        self._gain = 40
        self._fft = 1024
        self._running = False

    @property
    def running(self):
        return self._running and self._thread is not None and self._thread.is_alive()

    def start(self, center_hz: int, sample_rate: int = 1_024_000, gain: int = 40, fft: int = 1024):
        self.stop()
        self._stop.clear()
        self._center = int(center_hz)
        self._sr = int(sample_rate)
        self._gain = int(gain)
        self._fft = max(256, min(4096, int(fft)))
        self._running = True
        self._thread = threading.Thread(target=self._run, name='rtlsdr-scope', daemon=True)
        self._thread.start()

    def retune(self, center_hz: int):
        center_hz = int(center_hz)
        with self._lock:
            if abs(center_hz - self._center) < 500:
                return False
            self._center = center_hz
        # restart process to retune
        self._kill_proc()
        return True

    def stop(self):
        self._running = False
        self._stop.set()
        self._kill_proc()
        t = self._thread
        if t and t.is_alive() and t is not threading.current_thread():
            t.join(2.0)
        self._thread = None

    def _kill_proc(self):
        p = self._proc
        self._proc = None
        if not p:
            return
        try:
            p.terminate()
        except Exception:
            pass
        try:
            p.wait(timeout=2)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass

    def _status(self, state, reason='', span=0):
        cb = self.on_status
        if cb:
            try:
                cb(state, reason, span)
            except Exception:
                log.exception("rtlsdr on_status failed")

    def _run(self):
        consec_err = 0
        quick_fails = 0
        while not self._stop.is_set() and self._running:
            with self._lock:
                center = self._center
            sr = self._sr
            gain = self._gain
            fft_n = self._fft
            cmd = ['rtl_sdr', '-f', str(center), '-s', str(sr), '-g', str(gain), '-']
            started = time.monotonic()
            reported_live = False
            try:
                self._status('starting', '', sr)
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                        bufsize=fft_n * 8)
                self._proc = proc
            except Exception as e:
                consec_err += 1
                self._status('unavailable', str(e).split('\n')[0], sr)
                if consec_err > 5:
                    break
                self._stop.wait(3.0)
                continue

            consec_err = 0
            err_tail = ''
            try:
                reported_live = self._read_loop(proc, center, sr, fft_n)
            except Exception as e:
                err_tail = str(e).split('\n')[0]
            finally:
                try:
                    if proc.poll() is None:
                        proc.terminate()
                        proc.wait(timeout=2)
                except Exception:
                    try:
                        proc.kill()
                    except Exception:
                        pass
                try:
                    stderr = proc.stderr.read().decode('utf-8', errors='replace') if proc.stderr else ''
                    # keep last meaningful line
                    for ln in reversed(stderr.splitlines()):
                        ln = ln.strip()
                        if ln and 'Reading samples' not in ln and 'Allocating' not in ln:
                            err_tail = err_tail or ln
                            break
                except Exception:
                    pass
                if self._proc is proc:
                    self._proc = None

            if self._stop.is_set() or not self._running:
                break
            # quick exit without going live -> likely device missing/unplugged
            if not reported_live and (time.monotonic() - started) < 5.0:
                quick_fails += 1
            else:
                quick_fails = 0
            if quick_fails >= 3:
                self._status('unavailable', err_tail or 'RTL-SDR устройство недоступно', sr)
                self._stop.wait(5.0)  # hotswap: keep trying, slower
                continue
            self._status('starting', err_tail or 'перезапуск RTL-SDR', sr)
            self._stop.wait(1.5)

        self._running = False
        self._status('off', '', 0)

    def _read_loop(self, proc, center, sr, fft_n):
        # cu8: I,Q,I,Q... unsigned bytes, convert to complex float
        bytes_per_frame = fft_n * 2
        need = bytes_per_frame * 4  # accumulate 4 FFTs per emitted frame
        buf = bytearray()
        avg = None
        avg_n = 0
        emit_every = 0.08  # ~12.5 fps
        last_emit = 0.0
        window = np.hanning(fft_n).astype(np.float32)
        # floor/scale for dB -> 0..255
        db_floor = -100.0
        db_ceil = -20.0
        span = sr
        reported_live = False

        while not self._stop.is_set() and self._running:
            # if center changed, break to restart
            with self._lock:
                if abs(self._center - center) >= 500:
                    return reported_live
            chunk = proc.stdout.read(16384)
            if not chunk:
                if proc.poll() is not None:
                    return reported_live
                time.sleep(0.01)
                continue
            buf.extend(chunk)
            while len(buf) >= bytes_per_frame:
                frame_bytes = bytes(buf[:bytes_per_frame])
                del buf[:bytes_per_frame]
                iq = np.frombuffer(frame_bytes, dtype=np.uint8).astype(np.float32)
                iq = (iq - 127.5) / 127.5
                c = iq[0::2] + 1j * iq[1::2]
                if len(c) < fft_n:
                    break
                c = c[:fft_n] * window
                spec = np.fft.fftshift(np.fft.fft(c))
                pwr = (np.abs(spec) ** 2) / (fft_n * fft_n + 1e-12)
                db = 10.0 * np.log10(pwr + 1e-20)
                if avg is None:
                    avg = db
                else:
                    avg = avg * 0.6 + db * 0.4
                avg_n += 1
                now = time.monotonic()
                if avg_n >= 2 and (now - last_emit) >= emit_every:
                    last_emit = now
                    # suppress DC spike (center bin + neighbors)
                    frame_db = avg.copy()
                    cbin = len(frame_db) // 2
                    lo = max(0, cbin - 3)
                    hi = min(len(frame_db), cbin + 4)
                    nlo = max(0, lo - 3)
                    nhi = min(len(frame_db), hi + 3)
                    ref = []
                    if nlo < lo:
                        ref.extend(frame_db[nlo:lo])
                    if hi < nhi:
                        ref.extend(frame_db[hi:nhi])
                    if ref:
                        fill = float(np.median(ref))
                        frame_db[lo:hi] = fill
                    # map db to 0..255
                    vals = np.clip((frame_db - db_floor) * (255.0 / (db_ceil - db_floor)), 0, 255).astype(np.uint8)
                    levels = vals.tobytes()
                    if not reported_live:
                        reported_live = True
                        log.info("RTL-SDR: первый кадр, center=%s span=%s bins=%s", center, span, len(levels))
                        self._status('live', '', span)
                    try:
                        self.on_frame(int(center), int(span), levels)
                    except Exception:
                        log.exception("rtlsdr on_frame failed")
                    avg_n = 0
        return reported_live
