"""Separate installed Windows program files from per-user mutable data.

The installer adds installed-mode.txt. Portable builds and Linux keep their
existing layout. Legacy data is copied once; originals are never deleted.
"""
import os
from pathlib import Path
import shutil

RUNTIME_FILES = ('config.json', 'cert.pem', 'key.pem', 'ft8_log.adi',
                 'cty.dat', 'worked_import.json')
RUNTIME_DIRS = ('records', 'voice', 'sstv', 'fax', 'memory')


def _copy_missing(source, destination):
    # Never follow links/junctions out of the legacy data tree.
    if source.is_symlink() or (source.exists() and getattr(source.lstat(), 'st_file_attributes', 0) & 0x400):
        return
    if source.is_dir():
        if destination.exists() and not destination.is_dir():
            return
        destination.mkdir(parents=True, exist_ok=True)
        for child in source.iterdir():
            _copy_missing(child, destination / child.name)
    elif source.is_file() and not destination.exists():
        shutil.copy2(source, destination)


def data_directory(app_dir, *, installed=False, local_app_data=None):
    app = Path(app_dir)
    if not installed:
        return str(app)
    local = local_app_data or os.environ.get('LOCALAPPDATA')
    if not local:
        raise RuntimeError('LOCALAPPDATA is required for an installed Windows application')
    data = Path(local) / 'Yaesu Web Pult'
    data.mkdir(parents=True, exist_ok=True)
    marker = data / '.legacy-data-migrated'
    if not marker.exists():
        for name in (*RUNTIME_FILES, *RUNTIME_DIRS):
            _copy_missing(app / name, data / name)
        marker.write_text('Legacy data copied; originals retained.\n', encoding='utf-8')
    return str(data)
