from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from ft710_scope import (PacketFramer, PACKET_SIZE, SYNC, SPANS,
                         decode_packet, ScopeDecodeError)


def fixture(span=5, geometry=0, fixed_hz=0):
    # Synthetic fixture constructed from documented offsets, not a radio capture.
    data = bytearray(4096)
    data[:850] = bytes([255]) * 850
    data[425] = 55
    data[2932] = span
    data[2952] = geometry
    data[2964:2969] = bytes.fromhex('0014200000')
    data[2989:2994] = bytes.fromhex('0007100000')
    data[3044:3048] = fixed_hz.to_bytes(4, 'big')   # data[] + 144
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

    def test_all_spans_and_geometry(self):
        for code, hz in enumerate(SPANS):
            self.assertEqual(decode_packet(fixture(span=code)).span_hz, hz)
        # Cursor has no documented start frequency: centre is the safe default.
        self.assertEqual(decode_packet(fixture(geometry=1)).center_frame().first_hz, 14175000)
        # Fixed geometry with a plausible start frequency uses it.
        fixed = decode_packet(fixture(geometry=2, fixed_hz=14100000))
        self.assertEqual(fixed.fixed_hz, 14100000)
        self.assertEqual(fixed.center_frame().first_hz, 14100000)
        # Implausible fixed start falls back to centre instead of guessing.
        fallback = decode_packet(fixture(geometry=2, fixed_hz=1))
        self.assertEqual(fallback.fixed_hz, 0)
        self.assertEqual(fallback.center_frame().first_hz, 14175000)

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


class PacketFramerTests(unittest.TestCase):
    def test_aligned_and_split_reads(self):
        packets = [fixture(), fixture(span=1), fixture(span=9)]
        stream = b''.join(packets)
        framer = PacketFramer()
        self.assertEqual(framer.feed(stream), packets)

        framer = PacketFramer()
        out = []
        for i in range(0, len(stream), 1000):
            out += framer.feed(stream[i:i + 1000])
        self.assertEqual(out, packets)

    def test_recovers_after_garbage_and_short_prefix(self):
        good = [fixture(), fixture(span=2)]
        garbage = bytes([0] * 37)
        framer = PacketFramer()
        self.assertEqual(framer.feed(garbage + b''.join(good)), good)
        self.assertGreater(framer.dropped, 0)

        framer = PacketFramer()
        # A truncated first block is discarded; the complete block that follows wins.
        self.assertEqual(framer.feed(good[0][100:] + good[1]), [good[1]])

    def test_tail_is_kept_and_empty_feeds_are_ignored(self):
        packet = fixture()
        framer = PacketFramer()
        self.assertEqual(framer.feed(packet[:PACKET_SIZE - 4]), [])
        self.assertEqual(framer.feed(b''), [])
        self.assertEqual(framer.feed(packet[-4:]), [packet])

    def test_garbage_cannot_grow_the_buffer(self):
        framer = PacketFramer(max_buffer=8192)
        for _ in range(10):
            self.assertEqual(framer.feed(b'\x00' * 4096), [])
        self.assertLessEqual(len(framer.buf), 8192)

    def test_sync_constant_is_end_marker(self):
        self.assertEqual(SYNC, b'\xff\x01\xee\x01')
        self.assertEqual(fixture()[-4:], SYNC)


if __name__ == '__main__':
    unittest.main()
