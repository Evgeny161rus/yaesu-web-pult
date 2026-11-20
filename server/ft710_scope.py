"""Yaesu USB spectrum packet decoder for FT-710 / FTDX10 / FTDX101.

Spectrum data does not travel over the CAT serial port: the radio exposes an
FTDI FT4222 SPI interface (``FT4222 A``) that streams fixed 4096-byte blocks.
See ``ft4222_transport.py`` for the USB side and ``FT710-SCOPE.md`` for the
protocol references.

Layout reference: wfview, ``include/packettypes.h`` (``yaesu_scope_data``) and
``src/radio/yaesucommander.cpp`` (``haveScopeData``):

    0..849      wf1, 850 inverted 8-bit levels (main receiver)
    850..1699   wf2, second receiver (only for dual-receiver models)
    1700..2899  audio FFT / scope trace blocks (not used here)
    2900..3049  data[]: +32 span code, +52 geometry, +64 and +89 packed-BCD VFO
                frequencies, +144 fixed-scope start frequency (big endian, Hz)
    4092..4095  sync marker FF 01 EE 01

Each 4096-byte block ends with the sync marker. The transport may return short
reads, so ``PacketFramer`` re-aligns arbitrary chunks before decoding.

No device access happens in this module. Decoding is pure and fail-safe: a
malformed block raises ``ScopeDecodeError`` and the caller falls back to the
audio waterfall.
"""
from dataclasses import dataclass

from spectrum import SpectrumFrame

PACKET_SIZE = 4096
SYNC = b'\xff\x01\xee\x01'
DATA_OFFSET = 2900
WF_BINS = 850
SPANS = (1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000)

SPAN_OFFSET = 32          # inside data[]
GEOMETRY_OFFSET = 52      # 0=center, 1=cursor, 2=fixed
MODE_OFFSET = 60
VFO_A_OFFSET = 64
VFO_B_OFFSET = 89
FIXED_START_OFFSET = 144  # 4 bytes, big endian, Hz (fixed geometry)


class ScopeDecodeError(ValueError):
    pass


def _bcd_frequency(data):
    value = 0
    for byte in data:
        high, low = byte >> 4, byte & 15
        if high > 9 or low > 9:
            raise ScopeDecodeError('Invalid BCD frequency')
        value = value * 100 + high * 10 + low
    return value


class PacketFramer:
    """Turn arbitrary FT4222 reads into aligned 4096-byte packets.

    The sync marker at the end of every block is the alignment anchor. Garbage
    between three consecutive good blocks can therefore be skipped without
    losing the following block. Unconsumed tail data is kept for the next
    ``feed`` call; the buffer is bounded so a broken driver cannot grow it
    forever.
    """

    def __init__(self, max_buffer=4 * PACKET_SIZE):
        self.max_buffer = max_buffer
        self.buf = b''
        self.dropped = 0

    def feed(self, data):
        if not data:
            return []
        self.buf += bytes(data)
        out = []
        while len(self.buf) >= PACKET_SIZE:
            if self.buf[PACKET_SIZE - 4:PACKET_SIZE] == SYNC:
                out.append(self.buf[:PACKET_SIZE])
                self.buf = self.buf[PACKET_SIZE:]
                continue
            pos = self.buf.find(SYNC)
            if pos < 0:
                keep = PACKET_SIZE - 1
                self.dropped += len(self.buf) - keep
                self.buf = self.buf[-keep:]
                break
            end = pos + len(SYNC)              # end of some packet
            start = end - PACKET_SIZE
            if start > 0:
                self.dropped += start
                self.buf = self.buf[start:]
            else:
                self.dropped += end
                self.buf = self.buf[end:]
        if len(self.buf) > self.max_buffer:
            self.dropped += len(self.buf) - self.max_buffer
            self.buf = self.buf[-self.max_buffer:]
        return out


@dataclass(frozen=True)
class Ft710ScopePacket:
    levels: bytes
    vfo_a_hz: int
    vfo_b_hz: int
    span_hz: int
    geometry: int          # observed byte: 0=center, 1=cursor, 2=fixed
    fixed_hz: int = 0      # fixed geometry start frequency, 0 when unknown
    mode: int = -1         # raw scope mode byte (documentation only)

    def center_frame(self):
        """Return a SpectrumFrame with an absolute RF frequency scale.

        Centre geometry is the normal mode: the block is centred on VFO A.
        Fixed geometry uses the start frequency reported by the radio when it
        looks plausible; cursor geometry has no reliable start frequency in the
        documented layout, so it is treated as centre. Endpoint convention:
        first and last bin span the displayed width (provisional until checked
        against a real capture).
        """
        if self.geometry == 2 and self.fixed_hz:
            first = float(self.fixed_hz)
        else:
            first = self.vfo_a_hz - self.span_hz / 2
        if first < 0:
            raise ScopeDecodeError('Scope crosses zero; clipping geometry is unknown')
        return SpectrumFrame('yaesu-ft4222', 'rf', first,
                             self.span_hz / (len(self.levels) - 1), self.levels,
                             'relative', 0, 1)


def decode_packet(packet):
    if not isinstance(packet, bytes) or len(packet) != PACKET_SIZE:
        raise ScopeDecodeError('Expected one aligned 4096-byte packet')
    if packet[-4:] != SYNC:
        raise ScopeDecodeError('Missing USB scope sync marker')
    data = packet[DATA_OFFSET:DATA_OFFSET + 150]
    span = data[SPAN_OFFSET]
    if span >= len(SPANS):
        raise ScopeDecodeError('Unknown scope span')
    geometry = data[GEOMETRY_OFFSET]
    if geometry not in (0, 1, 2):
        raise ScopeDecodeError('Unknown scope geometry')
    fa = _bcd_frequency(data[VFO_A_OFFSET:VFO_A_OFFSET + 5])
    fb = _bcd_frequency(data[VFO_B_OFFSET:VFO_B_OFFSET + 5])
    if not 30000 <= fa <= 75000000 or not 30000 <= fb <= 75000000:
        raise ScopeDecodeError('Frequency outside FT-710 receive range')
    fixed = int.from_bytes(data[FIXED_START_OFFSET:FIXED_START_OFFSET + 4], 'big')
    if not 30000 <= fixed <= 470000000:
        fixed = 0
    return Ft710ScopePacket(bytes(255 - x for x in packet[:WF_BINS]),
                            fa, fb, SPANS[span], geometry, fixed,
                            data[MODE_OFFSET])
