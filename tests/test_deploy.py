"""Exercise installer fragments without installing packages or touching the host."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
INSTALLER = (ROOT / 'deploy/rpi/install-rpi.sh').read_text(encoding='utf-8')
BASH = shutil.which('bash')
if not BASH and os.name == 'nt':
    candidate = Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'Git/usr/bin/bash.exe'
    if candidate.exists():
        BASH = str(candidate)


@unittest.skipUnless(BASH, 'Bash is required for installer checks')
class PiInstallerTests(unittest.TestCase):
    def run_bash(self, script, directory):
        result = subprocess.run([BASH, '-c', 'set -euo pipefail\nexport PATH="/usr/bin:/bin:$PATH"\n' + script],
                                cwd=directory, capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def check_update(self, use_rsync):
        fragment = INSTALLER.split('echo "==> Копирование файлов"', 1)[1].split('# Stale .pyc', 1)[0]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for tree in ('source', 'dest'):
                (root / tree).mkdir()
                for name in ('records', 'voice', 'sstv', 'fax', 'memory'):
                    (root / tree / name).mkdir()
                    (root / tree / name / 'saved.dat').write_text(tree)
                for name in ('config.json', 'cert.pem', 'key.pem', 'ft8_log.adi',
                             'cty.dat', 'worked_import.json', 'ftx1-pult.log.1'):
                    (root / tree / name).write_text(tree)
                (root / tree / 'app.py').write_text(tree)
            # Bundled country file inside server/ must not be treated as runtime
            # data: a bare "cty.dat" exclude would drop it on a fresh install.
            (root / 'source/server').mkdir()
            (root / 'source/server/cty.dat').write_text('source')
            (root / 'dest/server').mkdir()
            (root / 'dest/server/cty.dat').write_text('dest')
            (root / 'dest/obsolete.py').write_text('old')
            prelude = 'SRC_DIR="$PWD/source"\nDEST="$PWD/dest"\n'
            if use_rsync:
                check = subprocess.run([BASH, '-c', 'export PATH="/usr/bin:/bin:$PATH"; command -v rsync'], capture_output=True)
                if check.returncode:
                    self.skipTest('rsync is not installed')
            else:
                prelude += 'command() { if [[ "$*" == "-v rsync" ]]; then return 1; fi; builtin command "$@"; }\n'
            self.run_bash(prelude + fragment, directory)
            for path in (root / 'dest').rglob('*'):
                if path.is_file() and path.name not in ('app.py', 'obsolete.py') and path != root / 'dest/server/cty.dat':
                    self.assertEqual(path.read_text(), 'dest', str(path))
            # Also assert that --delete did not remove whole runtime directories.
            for name in ('records', 'voice', 'sstv', 'fax', 'memory'):
                self.assertEqual((root / 'dest' / name / 'saved.dat').read_text(), 'dest')
            for name in ('config.json', 'cert.pem', 'key.pem', 'ft8_log.adi',
                         'cty.dat', 'worked_import.json', 'ftx1-pult.log.1'):
                self.assertEqual((root / 'dest' / name).read_text(), 'dest')
            self.assertEqual((root / 'dest/app.py').read_text(), 'source')
            self.assertEqual((root / 'dest/server/cty.dat').read_text(), 'source')
            if use_rsync:
                self.assertFalse((root / 'dest/obsolete.py').exists())

    def test_tar_update_preserves_station_data(self):
        self.check_update(False)

    def test_rsync_update_preserves_station_data(self):
        self.check_update(True)

    def test_runtime_ownership_is_restored(self):
        paths = INSTALLER.split('RUNTIME_PATHS=(', 1)[1].split('RUNTIME_EXCLUDES=', 1)[0]
        permissions = INSTALLER.split('echo "==> Права доступа"', 1)[1].split('echo "==> systemd unit"', 1)[0]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('records', 'voice', 'sstv', 'fax', 'memory'):
                (root / name).mkdir()
            for name in ('cert.pem', 'key.pem', 'ft8_log.adi', 'cty.dat',
                         'worked_import.json', 'ftx1-pult.log.1'):
                (root / name).touch()
            script = '''DEST="$PWD"
USER_NAME=yaesu
chown() { printf '%s\\n' "$*" >> owners; }
''' + 'RUNTIME_PATHS=(' + paths + permissions
            self.run_bash(script, directory)
            owners = (root / 'owners').read_text().splitlines()
            for name in ('config.json', 'cert.pem', 'key.pem', 'records', 'voice',
                         'sstv', 'fax', 'memory', 'ft8_log.adi', 'cty.dat',
                         'worked_import.json', 'ftx1-pult.log.1'):
                self.assertTrue(any(line.startswith('-R yaesu:yaesu ') and
                                    line.endswith('/' + name) for line in owners), name)

    def test_menu_switches_driver_in_both_directions(self):
        definitions = 'tui_config() {' + INSTALLER.split('tui_config() {', 1)[1].split('  while true; do', 1)[0] + '\n}\ntui_config\n'
        for source, expected in (('sdr', 'rx_sdr'), ('rtlsdr', 'rtlsdr')):
            with self.subTest(source=source), tempfile.TemporaryDirectory() as directory:
                script = 'DEST="$PWD"\n' + definitions + '''
cfg_get() { echo auto; }
cfg_set() { printf '%s\t%s\n' "$1" "$2" >> changes; }
whiptail() { printf '%s\n' "$CHOICE" >&2; }
''' + f'CHOICE={source}\ntui_wf\n'
                self.run_bash(script, directory)
                changes = dict(line.split('\t', 1) for line in
                               (Path(directory) / 'changes').read_text().splitlines())
                self.assertEqual(json.loads(changes['waterfall_source']), source)
                self.assertEqual(json.loads(changes['sdr_driver']), expected)


@unittest.skipUnless(os.name == 'nt', 'Windows cmd is required')
class WindowsBuildTests(unittest.TestCase):
    def test_optional_country_file_arguments(self):
        for name in ('build-exe.bat', 'deploy/windows/build-exe.bat'):
            text = (ROOT / name).read_text(encoding='utf-8')
            fragment = text.split('set CTYDATA=', 1)[1].split('set FTDIDATA=', 1)[0]
            for files, expected in (((), ''), (('cty.dat',), '--add-data "cty.dat;."'),
                                    (('cty.dat', 'server/cty.dat'), '--add-data "server\\cty.dat;."')):
                with self.subTest(script=name, files=files), tempfile.TemporaryDirectory() as directory:
                    root = Path(directory)
                    for file in files:
                        path = root / file
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_text('data')
                    (root / 'check.bat').write_text('@echo off\nset CTYDATA=' + fragment +
                                                  '\necho RESULT:%CTYDATA%\n')
                    result = subprocess.run(['cmd', '/d', '/c', 'check.bat'], cwd=directory,
                                            capture_output=True, text=True, check=True)
                    self.assertEqual(result.stdout.strip(), 'RESULT:' + expected)
