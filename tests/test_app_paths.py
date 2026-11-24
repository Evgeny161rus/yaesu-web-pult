from pathlib import Path
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from app_paths import data_directory  # noqa: E402


class DataDirectoryTests(unittest.TestCase):
    def test_portable_and_linux_leave_data_beside_program(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            app = root / 'app'
            app.mkdir()
            self.assertEqual(data_directory(app), str(app))
            self.assertEqual(list(root.iterdir()), [app])

    def test_install_migrates_only_data_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            app, local = root / 'app', root / 'local'
            app.mkdir()
            data = local / 'Yaesu Web Pult'
            data.mkdir(parents=True)
            (app / 'config.json').write_text('old config')
            (data / 'config.json').write_text('new config')
            (app / 'records').mkdir()
            (app / 'records/qso.wav').write_bytes(b'qso')
            (app / 'cert.pem').write_text('certificate')
            (app / 'Yaesu-Web-Pult.exe').write_bytes(b'code')
            (app / 'tools').mkdir()
            self.assertEqual(data_directory(app, installed=True, local_app_data=local), str(data))
            self.assertEqual((data / 'config.json').read_text(), 'new config')
            self.assertEqual((data / 'records/qso.wav').read_bytes(), b'qso')
            self.assertEqual((data / 'cert.pem').read_text(), 'certificate')
            self.assertFalse((data / 'Yaesu-Web-Pult.exe').exists())
            self.assertFalse((data / 'tools').exists())
            self.assertTrue((app / 'records/qso.wav').exists())
            # Deleting a migrated file must not bring it back on every launch.
            (data / 'cert.pem').unlink()
            data_directory(app, installed=True, local_app_data=local)
            self.assertFalse((data / 'cert.pem').exists())

    def test_missing_user_directory_fails_instead_of_writing_program_files(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaises(RuntimeError):
            data_directory('app', installed=True)

    def test_installed_sdr_search_uses_program_directory(self):
        import main
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            tools = root / 'app/tools/rtlsdr'
            tools.mkdir(parents=True)
            exe = tools / ('rtl_sdr.exe' if os.name == 'nt' else 'rtl_sdr')
            exe.touch()
            with patch.object(main, 'APP_DIR', str(root / 'app')), \
                    patch.object(main, 'BASE', str(root / 'data')), \
                    patch('shutil.which', return_value=None):
                self.assertEqual(main.sdr_executable('rtl_sdr'), str(exe))
