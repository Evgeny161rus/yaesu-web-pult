import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import config_cli  # noqa: E402


class ConfigCliTests(unittest.TestCase):
    def run_set(self, command, value):
        saved = {}
        with patch.object(config_cli, 'load', return_value={}), \
                patch.object(config_cli, 'save', side_effect=lambda cfg: saved.update(cfg)), \
                patch.object(sys, 'stdin', io.StringIO(value)):
            code = config_cli.main(['config_cli.py'] + command)
        self.assertEqual(code, 0)
        return saved

    def test_setraw_keeps_quotes_and_backslashes(self):
        saved = self.run_set(['setraw', 'password'], 'a"b\\c\n')
        self.assertEqual(saved['password'], 'a"b\\c')

    def test_setraw_empty_password(self):
        saved = self.run_set(['setraw', 'password'], '')
        self.assertEqual(saved['password'], '')

    def test_set_parses_json_types(self):
        saved = self.run_set(['set', 'cat_baud', '38400'], '')
        self.assertEqual(saved['cat_baud'], 38400)
        saved = self.run_set(['set', 'cat_port', '"/dev/ttyUSB0"'], '')
        self.assertEqual(saved['cat_port'], '/dev/ttyUSB0')


if __name__ == '__main__':
    unittest.main()
