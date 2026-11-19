from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from ft710_scope import decode_packet, ScopeDecodeError, SPANS


def fixture(span=5, geometry=0):
    # Synthetic fixture constructed from documented offsets, not a radio capture.
    data = bytearray(4096)
    data[:850] = bytes([255]) * 850
    data[425] = 55
    data[2932] = span
    data[2952] = geometry
    data[2964:2969] = bytes.fromhex('0014200000')
    data[2989:2994] = bytes.fromhex('0007100000')
    data[-4:] = bytes.fromhex('ff01ee01')
    return bytes(data)


class Ft710ScopeTests(unittest.TestCase):
    def test_decode_and_center_scale(self):
        p = decode_packet(fixture())
        self.assertEqual((p.vfo_a_hz, p.vfo_b_hz), (14200000, 7100000))
        self.assertEqual(len(p.levels), 850)
        self.assertEqual(p.levels[425], 200)
        self.assertEqual(p.levels[0], 0)
        f = p.center_frame()
        self.assertEqual(f.unit, 'relative')
        self.assertEqual(f.first_hz, 14175000)
        self.assertAlmostEqual(f.first_hz + 849*f.bin_hz, 14225000)
        self.assertFalse(f.demo)

    def test_all_spans_and_unsupported_geometry(self):
        for code, hz in enumerate(SPANS):
            self.assertEqual(decode_packet(fixture(span=code)).span_hz, hz)
        for mode in (1, 2):
            with self.assertRaises(ScopeDecodeError):
                decode_packet(fixture(geometry=mode)).center_frame()

    def test_reject_truncated_misaligned_or_invalid_metadata(self):
        good = fixture()
        malformed = [good[:-1], good+b'0', b'0'+good[:-1], bytes(4096),
                     fixture(span=10), fixture(geometry=3)]
        for offset, value in ((2964, 0xfa), (2964, 0x99)):
            bad = bytearray(good)
            bad[offset] = value
            malformed.append(bytes(bad))
        for packet in malformed:
            with self.subTest(length=len(packet)), self.assertRaises(ScopeDecodeError):
                decode_packet(packet)
