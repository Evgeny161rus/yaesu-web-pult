"""
Тесты для модуля network_utils.
"""
import unittest
import os
import tempfile
from server.network_utils import (
    local_ips, is_local_address, launch_command
)


class TestNetworkUtils(unittest.TestCase):
    """Тесты сетевых утилит."""
    
    def test_local_ips_returns_list(self):
        """local_ips должен возвращать список."""
        ips = local_ips()
        self.assertIsInstance(ips, list)
    
    def test_local_ips_no_loopback(self):
        """local_ips не должен возвращать loopback адреса."""
        ips = local_ips()
        for ip in ips:
            self.assertFalse(ip.startswith('127.'))
            self.assertFalse(ip.startswith('169.254.'))
    
    def test_local_ips_valid_format(self):
        """local_ips должен возвращать валидные IP адреса."""
        ips = local_ips()
        for ip in ips:
            parts = ip.split('.')
            self.assertEqual(len(parts), 4)
            for part in parts:
                num = int(part)
                self.assertGreaterEqual(num, 0)
                self.assertLessEqual(num, 255)
    
    def test_is_local_address_loopback(self):
        """Проверка распознавания loopback адресов."""
        self.assertTrue(is_local_address('127.0.0.1'))
        self.assertTrue(is_local_address('::1'))
        self.assertTrue(is_local_address('::ffff:127.0.0.1'))
    
    def test_is_local_address_non_loopback(self):
        """Проверка распознавания не-loopback адресов."""
        self.assertFalse(is_local_address('192.168.1.1'))
        self.assertFalse(is_local_address('10.0.0.1'))
        self.assertFalse(is_local_address('8.8.8.8'))
    
    def test_launch_command_returns_string(self):
        """launch_command должен возвращать строку."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cmd = launch_command(tmpdir, background=True)
            self.assertIsInstance(cmd, str)
            self.assertGreater(len(cmd), 0)
    
    def test_launch_command_background_flag(self):
        """Проверка флага --background."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cmd_bg = launch_command(tmpdir, background=True)
            cmd_fg = launch_command(tmpdir, background=False)
            
            self.assertIn('--background', cmd_bg)
            self.assertNotIn('--background', cmd_fg)


class TestCertificateGeneration(unittest.TestCase):
    """Тесты генерации сертификатов."""
    
    def test_ensure_cert_creates_files(self):
        """ensure_cert должен создавать файлы сертификатов."""
        try:
            from server.network_utils import ensure_cert
        except ImportError:
            self.skipTest("cryptography не установлен")
        
        with tempfile.TemporaryDirectory() as tmpdir:
            crt, key = ensure_cert(tmpdir)
            
            if crt is None and key is None:
                self.skipTest("cryptography не доступен")
            
            self.assertIsNotNone(crt)
            self.assertIsNotNone(key)
            self.assertTrue(os.path.exists(crt))
            self.assertTrue(os.path.exists(key))
    
    def test_ensure_cert_reuses_existing(self):
        """ensure_cert должен использовать существующие сертификаты."""
        try:
            from server.network_utils import ensure_cert
        except ImportError:
            self.skipTest("cryptography не установлен")
        
        with tempfile.TemporaryDirectory() as tmpdir:
            # Первый вызов
            crt1, key1 = ensure_cert(tmpdir)
            if crt1 is None:
                self.skipTest("cryptography не доступен")
            
            mtime1 = os.path.getmtime(crt1)
            
            # Второй вызов
            crt2, key2 = ensure_cert(tmpdir)
            mtime2 = os.path.getmtime(crt2)
            
            # Должны быть те же файлы
            self.assertEqual(crt1, crt2)
            self.assertEqual(key1, key2)
            self.assertEqual(mtime1, mtime2)


if __name__ == '__main__':
    unittest.main()
