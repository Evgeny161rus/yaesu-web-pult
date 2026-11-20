# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_all

# Сервер собираем как код (а не как данные): иначе PyInstaller не видит
# импорты внутри server/*.py и в сборку не попадают модули стандартной
# библиотеки (wave, logging.handlers) — exe падал сразу после запуска.
datas = [('web', 'web'), ('server/menu_ftx1.json', '.'), ('cty.dat', '.')]
if os.path.isdir('ftdi'):
    datas.append(('ftdi', 'ftdi'))
binaries = []
hiddenimports = ['numpy', 'numpy.core', 'numpy.core.multiarray', 'pystray._win32']
tmp_ret = collect_all('sounddevice')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['server/main.py'],
    pathex=['server'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Yaesu-Web-Pult',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version='version_info.txt',
    icon=['web/icon.ico'],
)
