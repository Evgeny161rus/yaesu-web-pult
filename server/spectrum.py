"""Platform-neutral spectrum contract. Producers run on the server event loop.

Only the latest frame is retained. Consumers request a snapshot after receiving
the previous one; a slow consumer skips frames instead of building a backlog.
Bin i is at first_hz + i * bin_hz (bin centres, not outer edges).
"""
from dataclasses import dataclass
import math
import time


@dataclass(frozen=True)
class SpectrumFrame:
    source: str
    domain: str                 # audio or rf; audio must never tune the radio
    first_hz: float
    bin_hz: float
    levels: bytes               # immutable unsigned 8-bit levels
    unit: str                  # dBFS, dBm, relative (never imply calibration)
    level_offset: float
    level_step: float
    demo: bool = False

    def __post_init__(self):
        if not isinstance(self.source, str) or not 1 <= len(self.source) <= 64:
            raise ValueError('Invalid spectrum source')
        if self.domain not in ('audio', 'rf') or self.unit not in ('dBFS', 'dBm', 'relative'):
            raise ValueError('Invalid spectrum domain/unit')
        if not isinstance(self.levels, bytes) or not 2 <= len(self.levels) <= 8192:
            raise ValueError('Spectrum requires 2..8192 immutable bins')
        if not all(math.isfinite(x) for x in
                   (self.first_hz, self.bin_hz, self.level_offset, self.level_step)):
            raise ValueError('Non-finite spectrum metadata')
        if self.first_hz < 0 or self.bin_hz <= 0 or self.level_step <= 0:
            raise ValueError('Invalid spectrum scale')
        if not math.isfinite(self.first_hz + (len(self.levels) - 1) * self.bin_hz):
            raise ValueError('Spectrum frequency overflow')


class LatestSpectrum:
    def __init__(self, clock=time.monotonic, stale_after=1.0):
        if not math.isfinite(stale_after) or stale_after <= 0:
            raise ValueError('Invalid stale timeout')
        self.clock = clock
        self.stale_after = stale_after
        self.sequence = 0
        self.clear()

    def clear(self):
        self.frame = None
        self.received = None

    def publish(self, frame):
        if not isinstance(frame, SpectrumFrame):
            raise TypeError('Expected SpectrumFrame')
        self.frame = frame
        self.received = self.clock()
        self.sequence += 1

    def snapshot(self):
        result = {'t': 'spectrum', 'version': 1, 'sequence': self.sequence,
                  'status': 'unavailable', 'frame': None}
        if self.frame is None:
            return result
        age = max(0, self.clock() - self.received)
        result['age_ms'] = round(age * 1000)
        if age >= self.stale_after:
            result['status'] = 'stale'
            return result
        f = self.frame
        result.update(status='live', frame={
            'source': f.source, 'domain': f.domain, 'first_hz': f.first_hz,
            'bin_hz': f.bin_hz, 'levels': list(f.levels), 'unit': f.unit,
            'level_offset': f.level_offset, 'level_step': f.level_step,
            'demo': f.demo})
        return result
