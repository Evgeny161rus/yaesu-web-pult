"""Exercise the browser meter against CAT fixtures without radio hardware."""
from pathlib import Path
import shutil
import subprocess
import unittest


class MeterTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node.js required for meter UI test')
    def test_meter_cat_readings_and_tx_selection(self):
        root = Path(__file__).resolve().parents[1]
        subprocess.run([shutil.which('node'), 'tests/meter-ui.cjs'], cwd=root,
                       check=True, capture_output=True, text=True, timeout=20)
