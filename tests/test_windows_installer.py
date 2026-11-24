from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
ISS = (ROOT / 'deploy/windows/Yaesu-Web-Pult.iss').read_text(encoding='utf-8')


class WindowsInstallerTests(unittest.TestCase):
    def test_program_files_install_and_drivers(self):
        self.assertIn(r'DefaultDirName={autopf}\{#MyAppName}', ISS)
        self.assertIn('#define MyAppName "Yaesu Web Pult"', ISS)
        self.assertIn(r'Source: "drivers\*"', ISS)
        self.assertIn(r'install-drivers.ps1', ISS)
        self.assertIn(r'icacls.exe', ISS)
        self.assertIn('/remove:g *S-1-5-32-545', ISS)
        self.assertNotIn('/grant ', ISS)
        self.assertIn('runasoriginaluser', ISS)
        self.assertNotIn('runascurrentuser', ISS)
        self.assertIn('installed-mode.txt', ISS)
        self.assertIn('[UninstallDelete]', ISS)
        self.assertIn(r'{app}\drivers\install.log', ISS)

    def test_driver_packages_are_present(self):
        for name in ('ftdi/ftdibus.inf', 'ftdi/ftdiport.inf', 'ftdi/ftdibus.cat',
                     'cp210x/silabser.inf', 'cp210x/silabser.cat',
                     'rtlsdr/zadig-2.9.exe'):
            with self.subTest(name=name):
                self.assertTrue((ROOT / 'drivers' / name).is_file(), name)

    def test_build_helper_and_ci_publish_setup(self):
        helper = ROOT / 'deploy/windows/build-installer.ps1'
        self.assertTrue(helper.is_file())
        self.assertIn('Yaesu-Web-Pult-Setup.exe', helper.read_text(encoding='utf-8'))
        ci = (ROOT / '.github/workflows/build.yml').read_text(encoding='utf-8')
        self.assertIn('build-installer.ps1', ci)
        self.assertIn('Yaesu-Web-Pult-Setup.exe', ci)


if __name__ == '__main__':
    unittest.main()
