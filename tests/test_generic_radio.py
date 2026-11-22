"""Tests for generic-radio support: serial PTT and independent RX/TX audio."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))

from hamlib_backend import HamlibRig  # noqa: E402
from ptt_serial import SerialPtt  # noqa: E402


class FakeSerial:
    instances = []

    def __init__(self, port, baud, timeout=0):
        self.port, self.baud, self.timeout = port, baud, timeout
        self.rts = self.dtr = False
        self.closed = False
        FakeSerial.instances.append(self)

    def close(self):
        self.closed = True


class SerialPttTests(unittest.TestCase):
    def setUp(self):
        FakeSerial.instances = []

    def test_rts_line(self):
        with patch.dict(sys.modules, {'serial': SimpleNamespace(Serial=FakeSerial)}):
            ptt = SerialPtt('COM9', 'RTS')
            self.assertFalse(ptt.ser.rts)
            ptt.set(True)
            self.assertTrue(ptt.ser.rts)
            self.assertFalse(ptt.ser.dtr)
            ptt.set(False)
            self.assertFalse(ptt.ser.rts)
            ptt.close()
            self.assertTrue(FakeSerial.instances[0].closed)
            self.assertIsNone(ptt.ser)

    def test_dtr_line(self):
        with patch.dict(sys.modules, {'serial': SimpleNamespace(Serial=FakeSerial)}):
            ptt = SerialPtt('COM9', 'dtr')
            self.assertEqual(ptt.line, 'DTR')
            ptt.set(True)
            self.assertTrue(ptt.ser.dtr)
            self.assertFalse(ptt.ser.rts)

    def test_requires_port(self):
        with self.assertRaises(ValueError):
            SerialPtt('', 'RTS')


class FakeSerialPtt:
    def __init__(self):
        self.states, self.closed = [], False

    def set(self, on):
        self.states.append(bool(on))

    def close(self):
        self.closed = True


class HamlibSerialPttTests(unittest.IsolatedAsyncioTestCase):
    def make_rig(self):
        rig = HamlibRig({'ptt_method': 'RTS', 'ptt_port': 'COM9'}, lambda values: None)
        rig.state['connected'] = True
        rig.caps = {'ptt': True, 'get_ptt': False, 'ptt_source': 'serial'}
        rig._serial_ptt = FakeSerialPtt()
        return rig

    def test_ptt_uses_serial_line_and_updates_state(self):
        rig = self.make_rig()
        rig.ptt(True)
        self.assertEqual(rig._serial_ptt.states, [True])
        self.assertTrue(rig.state['tx'])
        self.assertIsNone(rig._ptt_pending)       # CAT PTT must stay untouched
        rig.ptt(False)
        self.assertEqual(rig._serial_ptt.states, [True, False])
        self.assertFalse(rig.state['tx'])

    def test_ptt_line_failure_is_reported_on_key_down(self):
        rig = self.make_rig()

        def boom(_on):
            raise OSError('port busy')

        rig._serial_ptt.set = boom
        with self.assertRaises(ValueError):
            rig.ptt(True)
        # Releasing a failed PTT must not raise.
        rig.ptt(False)


class FakeSoundDevice:
    def __init__(self):
        self.devices = [
            {'name': 'Microphone (USB Audio Device)', 'max_input_channels': 1,
             'max_output_channels': 0, 'hostapi': 0},
            {'name': 'Speakers (USB Audio Device)', 'max_input_channels': 0,
             'max_output_channels': 1, 'hostapi': 0},
        ]

    def query_devices(self, index=None):
        return self.devices if index is None else self.devices[index]

    def query_hostapis(self, index=None):
        return {'name': 'Windows WASAPI'} if index is not None else [{'name': 'Windows WASAPI'}]


class AudioRoutingTests(unittest.TestCase):
    def test_separate_rx_and_tx_devices_resolve_independently(self):
        import audio
        devices = [
            {'index': 0, 'name': 'Microphone (USB Audio Device)', 'in': 1, 'out': 0,
             'api': 'Windows WASAPI'},
            {'index': 1, 'name': 'Speakers (USB Audio Device)', 'in': 0, 'out': 1,
             'api': 'Windows WASAPI'},
        ]
        sound = audio.SoundDeviceAudio('Microphone (USB Audio Device)',
                                       'Speakers (USB Audio Device)', '')
        opened = []
        with patch.object(audio, 'list_devices', return_value=devices), \
                patch.object(audio.SoundDeviceAudio, '_open',
                             lambda self, ind, outd: opened.append((ind, outd))), \
                patch.dict(sys.modules, {'sounddevice': FakeSoundDevice()}):
            sound.start(lambda chunk: None)
        self.assertEqual(opened, [(0, 1)])


if __name__ == '__main__':
    unittest.main()
