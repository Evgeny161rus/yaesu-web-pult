"""
Тесты для модуля констант.
"""
import unittest
from server.constants import *


class TestConstants(unittest.TestCase):
    """Проверка корректности констант."""
    
    def test_audio_rates_consistency(self):
        """Проверка соответствия AUDIO_RATES и DECIMATION_FACTORS."""
        self.assertEqual(set(AUDIO_RATES.values()), set(DECIMATION_FACTORS.keys()))
    
    def test_sample_rate_high_matches(self):
        """HIGH частота должна соответствовать SAMPLE_RATE."""
        self.assertEqual(AUDIO_RATES['HIGH'], SAMPLE_RATE)
    
    def test_decimation_factors_valid(self):
        """Факторы децимации должны быть положительными целыми."""
        for factor in DECIMATION_FACTORS.values():
            self.assertIsInstance(factor, int)
            self.assertGreater(factor, 0)
    
    def test_pcm_constants(self):
        """Проверка PCM констант."""
        self.assertEqual(PCM_INT16_MAX, 32767)
        self.assertEqual(PCM_FLOAT_RANGE, 32768.0)
    
    def test_network_ports(self):
        """Порты должны быть в допустимом диапазоне."""
        self.assertGreater(DEFAULT_HTTP_PORT, 1024)
        self.assertLess(DEFAULT_HTTP_PORT, 65536)
        self.assertGreater(DEFAULT_HTTPS_PORT, 1024)
        self.assertLess(DEFAULT_HTTPS_PORT, 65536)
    
    def test_loopback_addresses(self):
        """Проверка loopback адресов."""
        self.assertIn('127.0.0.1', LOOPBACK_ADDRESSES)
        self.assertIn('::1', LOOPBACK_ADDRESSES)
    
    def test_websocket_markers(self):
        """WebSocket маркеры должны быть байтами."""
        self.assertIsInstance(WS_BINARY_AUDIO_RX, bytes)
        self.assertIsInstance(WS_BINARY_WATERFALL, bytes)
        self.assertIsInstance(WS_BINARY_AUDIO_TX, bytes)
        self.assertEqual(len(WS_BINARY_AUDIO_RX), 1)
        self.assertEqual(len(WS_BINARY_WATERFALL), 1)
        self.assertEqual(len(WS_BINARY_AUDIO_TX), 1)
    
    def test_timeout_values(self):
        """Таймауты должны быть положительными."""
        self.assertGreater(PTT_ALIVE_TIMEOUT, 0)
        self.assertGreater(PTT_WATCHDOG_INTERVAL, 0)
        self.assertGreater(SPECTRUM_STALE_TIMEOUT, 0)
    
    def test_memory_channels_range(self):
        """Диапазон каналов памяти."""
        self.assertEqual(MEMORY_CHANNEL_MIN, 1)
        self.assertEqual(MEMORY_CHANNEL_MAX, 999)
        self.assertGreater(MEMORY_CHANNEL_MAX, MEMORY_CHANNEL_MIN)
    
    def test_cw_parameters(self):
        """Параметры CW."""
        self.assertGreater(CW_WPM_MAX, CW_WPM_MIN)
        self.assertGreater(CW_MEMORY_SLOTS, 0)
        self.assertGreater(CW_MEMORY_MAX_LENGTH, 0)
    
    def test_ft8_timing(self):
        """Параметры времени FT8/FT4."""
        self.assertAlmostEqual(FT8_SLOT_DURATION, 15.0)
        self.assertAlmostEqual(FT4_SLOT_DURATION, 7.5)
        self.assertGreater(FT8_TIME_TOLERANCE, 0)
        self.assertLess(FT8_TIME_TOLERANCE, 1.0)


if __name__ == '__main__':
    unittest.main()
