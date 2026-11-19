"""Experimental FT-710 USB packet decoder; no device access or CAT writes.

Layout reference: wfview a14d5e8c7688c5554d3cf6df00e2ee69caa6d900,
include/packettypes.h and src/radio/yaesucommander.cpp. See FT710-SCOPE.md.
Input must be an aligned 4096-byte SPI packet, not arbitrary USB transfers.
"""
from dataclasses import dataclass

from spectrum import SpectrumFrame

PACKET_SIZE = 4096
SYNC = b'\xff\x01\xee\x01'
DATA_OFFSET = 2900
SPANS = (1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000)


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


@dataclass(frozen=True)
class Ft710ScopePacket:
    levels: bytes
    vfo_a_hz: int
    vfo_b_hz: int
    span_hz: int
    geometry: int  # observed byte: 0=center, 1=cursor, 2=fixed

    def center_frame(self):
        if self.geometry != 0:
            raise ScopeDecodeError('Cursor/Fixed frequency geometry is not yet supported')
        # Experimental endpoint convention: first and last bin span the display.
        first = self.vfo_a_hz - self.span_hz / 2
        if first < 0:
            raise ScopeDecodeError('Scope crosses zero; clipping geometry is unknown')
        return SpectrumFrame('ft710-usb', 'rf', first,
                             self.span_hz / (len(self.levels) - 1), self.levels,
                             'relative', 0, 1)


def decode_packet(packet):
    if not isinstance(packet, bytes) or len(packet) != PACKET_SIZE:
        raise ScopeDecodeError('Expected one aligned 4096-byte packet')
    if packet[-4:] != SYNC:
        raise ScopeDecodeError('Missing USB scope sync marker')
    data = packet[DATA_OFFSET:DATA_OFFSET + 150]
    span = data[32]
    if span >= len(SPANS):
        raise ScopeDecodeError('Unknown scope span')
    if data[52] not in (0, 1, 2):
        raise ScopeDecodeError('Unknown scope geometry')
    fa = _bcd_frequency(data[64:69])
    fb = _bcd_frequency(data[89:94])
    if not 30000 <= fa <= 75000000 or not 30000 <= fb <= 75000000:
        raise ScopeDecodeError('Frequency outside FT-710 receive range')
    return Ft710ScopePacket(bytes(255 - x for x in packet[:850]),
                            fa, fb, SPANS[span], data[52])
