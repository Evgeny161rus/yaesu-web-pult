"""
Тесты для модуля device_utils.
"""
import unittest
from server.device_utils import (
    list_ports, list_audio, detect_ftx1,
    format_port_info, format_audio_info
)


class TestDeviceUtils(unittest.TestCase):
    """Тесты утилит для устройств."""
    
    def test_list_ports_returns_list(self):
        """list_ports должен возвращать список."""
        ports = list_ports()
        self.assertIsInstance(ports, list)
    
    def test_list_ports_structure(self):
        """Проверка структуры данных портов."""
        ports = list_ports()
        for port in ports:
            self.assertIn('device', port)
            self.assertIn('desc', port)
            self.assertIn('kind', port)
            self.assertIn('cp210x', port)
            self.assertIsInstance(port['device'], str)
            self.assertIsInstance(port['desc'], str)
            self.assertIsInstance(port['kind'], str)
            self.assertIsInstance(port['cp210x'], bool)
    
    def test_list_audio_returns_list(self):
        """list_audio должен возвращать список."""
        audio = list_audio()
        self.assertIsInstance(audio, list)
    
    def test_detect_ftx1_returns_dict(self):
        """detect_ftx1 должен возвращать словарь."""
        result = detect_ftx1([], [])
        self.assertIsInstance(result, dict)
    
    def test_detect_ftx1_with_enhanced_port(self):
        """Определение Enhanced порта для CAT."""
        ports = [
            {'device': 'COM3', 'desc': 'Enhanced COM Port', 'kind': 'enhanced', 'cp210x': False},
            {'device': 'COM4', 'desc': 'Standard COM Port', 'kind': 'standard', 'cp210x': False}
        ]
        result = detect_ftx1(ports, [])
        
        self.assertEqual(result.get('cat_port'), 'COM3')
        self.assertEqual(result.get('ptt_port'), 'COM4')
    
    def test_detect_ftx1_with_cp210x(self):
        """Определение CP210x порта для CAT."""
        ports = [
            {'device': 'COM5', 'desc': 'Silicon Labs CP210x', 'kind': '', 'cp210x': True}
        ]
        result = detect_ftx1(ports, [])
        
        self.assertEqual(result.get('cat_port'), 'COM5')
    
    def test_format_port_info(self):
        """Форматирование информации о порте."""
        port = {
            'device': 'COM3',
            'desc': 'Test Port Description'
        }
        info = format_port_info(port)
        
        self.assertIsInstance(info, str)
        self.assertIn('COM3', info)
        self.assertIn('Test Port Description', info)
    
    def test_format_audio_info(self):
        """Форматирование информации об аудио устройстве."""
        device = {
            'index': 0,
            'name': 'USB Audio CODEC',
            'api': 'MME',
            'in': 2,
            'out': 2
        }
        info = format_audio_info(device)
        
        self.assertIsInstance(info, str)
        self.assertIn('USB Audio CODEC', info)
        self.assertIn('MME', info)
        self.assertIn('in=2', info)
        self.assertIn('out=2', info)


if __name__ == '__main__':
    unittest.main()
