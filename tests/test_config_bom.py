import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import main  # noqa: E402


class ConfigBomTests(unittest.TestCase):
    def write_config(self, directory, encoding):
        data = {'cat_port': 'COM14', 'cat_baud': 38400, 'password': 'secret'}
        with open(os.path.join(directory, 'config.json'), 'w', encoding=encoding) as f:
            json.dump(data, f, ensure_ascii=False)

    def test_utf8_bom_config_is_read(self):
        # Windows Notepad/PowerShell may save UTF-8 with BOM. The app must not
        # silently fall back to defaults and lose the COM port/password.
        with tempfile.TemporaryDirectory() as directory, patch.object(main, 'BASE', directory):
            self.write_config(directory, 'utf-8-sig')
            cfg = main.load_cfg()
            self.assertEqual(cfg['cat_port'], 'COM14')
            self.assertEqual(cfg['cat_baud'], 38400)
            self.assertEqual(cfg['password'], 'secret')

    def test_plain_utf8_config_still_works(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(main, 'BASE', directory):
            self.write_config(directory, 'utf-8')
            cfg = main.load_cfg()
            self.assertEqual(cfg['cat_port'], 'COM14')


if __name__ == '__main__':
    unittest.main()
