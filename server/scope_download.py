"""Best-effort opt-in downloader for FTDI LibFT4222/D2XX libraries.

FTDI libraries are proprietary and distributed separately by FTDI. This helper
tries to download them from official FTDI URLs into the local ``ftdi/`` folder
so the user does not have to locate and copy files manually. URLs are versioned
and may change; on failure the caller should direct the user to the official
download pages.

No automatic download happens unless explicitly enabled by configuration.
"""
import os
import platform
import shutil
import tarfile
import tempfile
import urllib.request
import zipfile

LIBFT4222_URLS = [
    'https://ftdichip.com/wp-content/uploads/2024/07/LibFT4222-v1.4.4.44.zip',
    'https://ftdichip.com/wp-content/uploads/2024/06/LibFT4222-v1.4.4.44.zip',
    'https://ftdichip.com/wp-content/uploads/2025/03/LibFT4222-v1.4.4.44.zip',
]
# D2XX Linux shared libraries (per-arch tarballs). Windows D2XX is usually
# installed as a driver; extracting ftd2xx.dll from FTDI installer packages is
# not handled here.
D2XX_LINUX_URLS = {
    'x86_64': ['https://ftdichip.com/wp-content/uploads/2022/07/libftd2xx-x86_64-1.4.27.tgz'],
    'aarch64': ['https://ftdichip.com/wp-content/uploads/2022/07/libftd2xx-arm-v8-1.4.27.tgz',
                'https://ftdichip.com/wp-content/uploads/2022/07/libftd2xx-aarch64-1.4.27.tgz'],
    'armv8': ['https://ftdichip.com/wp-content/uploads/2022/07/libftd2xx-arm-v8-1.4.27.tgz'],
}
UA = 'Yaesu-Web-Pult/1.0 (+https://github.com/Evgeny161rus/yaesu-web-pult)'


def _download(url, dst):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r, open(dst, 'wb') as f:
        shutil.copyfileobj(r, f)


def _ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def _pick_member(names, wanted):
    low = {n.replace('\\', '/').lower(): n for n in names}
    for w in wanted:
        wl = w.lower()
        # prefer exact basename match
        for k, orig in low.items():
            if k.rsplit('/', 1)[-1] == wl:
                return orig
        for k, orig in low.items():
            if k.endswith('/' + wl) or k == wl:
                return orig
    return None


def _extract_libft4222(archive, out_dir, system, machine):
    placed = []
    if system == 'windows':
        wanted = ['LibFT4222-64.dll', 'ftd2xx64.dll'] if machine.endswith('64') else ['LibFT4222.dll', 'ftd2xx.dll']
        # also try to place the 64-bit name on 64-bit systems
        if machine.endswith('64'):
            wanted = ['LibFT4222-64.dll', 'LibFT4222.dll', 'ftd2xx64.dll', 'ftd2xx.dll']
        with zipfile.ZipFile(archive) as zf:
            names = zf.namelist()
            for name in ('LibFT4222-64.dll', 'LibFT4222.dll', 'ftd2xx64.dll', 'ftd2xx.dll'):
                m = _pick_member(names, [name])
                if not m:
                    continue
                target = os.path.join(out_dir, name)
                with zf.open(m) as src, open(target, 'wb') as dst:
                    shutil.copyfileobj(src, dst)
                placed.append(target)
    else:
        # Linux: pick arch build of libft4222.so*
        arch_dir = 'build-arm-v8' if machine in ('aarch64', 'arm64') else 'build-x86_64' if machine == 'x86_64' else None
        with zipfile.ZipFile(archive) as zf:
            names = zf.namelist()
            candidates = []
            for n in names:
                nl = n.lower().replace('\\', '/')
                if not nl.endswith('.so') and '.so.' not in nl.rsplit('/', 1)[-1]:
                    continue
                base = nl.rsplit('/', 1)[-1]
                if not base.startswith('libft4222'):
                    continue
                if arch_dir and arch_dir in nl:
                    candidates.insert(0, n)
                else:
                    candidates.append(n)
            if candidates:
                m = candidates[0]
                # save as libft4222.so
                target = os.path.join(out_dir, 'libft4222.so')
                with zf.open(m) as src, open(target, 'wb') as dst:
                    shutil.copyfileobj(src, dst)
                try:
                    os.chmod(target, 0o755)
                except Exception:
                    pass
                placed.append(target)
    return placed


def _extract_d2xx_linux(archive, out_dir):
    placed = []
    with tarfile.open(archive, 'r:*') as tf:
        for m in tf.getmembers():
            base = os.path.basename(m.name)
            if base.startswith('libftd2xx') and ('.so' in base):
                f = tf.extractfile(m)
                if not f:
                    continue
                target = os.path.join(out_dir, 'libftd2xx.so')
                with f, open(target, 'wb') as dst:
                    shutil.copyfileobj(f, dst)
                try:
                    os.chmod(target, 0o755)
                except Exception:
                    pass
                placed.append(target)
                break
    return placed


def download_scope_libs(base_dir, log=print):
    """Download FTDI libraries into <base_dir>/ftdi. Returns (ok, message, files)."""
    system = 'windows' if os.name == 'nt' else 'linux'
    machine = platform.machine().lower()
    out_dir = os.path.join(base_dir, 'ftdi')
    _ensure_dir(out_dir)
    files = []
    errors = []

    # LibFT4222
    ok_lib = False
    with tempfile.TemporaryDirectory(prefix='ft4222-') as td:
        for url in LIBFT4222_URLS:
            arc = os.path.join(td, 'libft4222.zip')
            try:
                log('Скачиваю LibFT4222: %s' % url)
                _download(url, arc)
                placed = _extract_libft4222(arc, out_dir, system, machine)
                if placed:
                    files += placed
                    ok_lib = True
                    log('LibFT4222: установлено %s' % ', '.join(os.path.basename(p) for p in placed))
                    break
                errors.append('в архиве не найдены подходящие файлы (%s %s)' % (system, machine))
            except Exception as e:
                errors.append('%s: %s' % (url.rsplit('/', 1)[-1], e))
    if not ok_lib:
        errors.append('LibFT4222 не удалось скачать автоматически')

    # D2XX (Linux only - Windows usually has driver; extraction from CDM installer not implemented)
    if system == 'linux':
        arch_key = 'aarch64' if machine in ('aarch64', 'arm64') else 'x86_64' if machine == 'x86_64' else machine
        urls = D2XX_LINUX_URLS.get(arch_key, [])
        ok_d2xx = False
        with tempfile.TemporaryDirectory(prefix='d2xx-') as td:
            for url in urls:
                arc = os.path.join(td, 'd2xx.tgz')
                try:
                    log('Скачиваю D2XX: %s' % url)
                    _download(url, arc)
                    placed = _extract_d2xx_linux(arc, out_dir)
                    if placed:
                        files += placed
                        ok_d2xx = True
                        log('D2XX: установлено %s' % ', '.join(os.path.basename(p) for p in placed))
                        break
                except Exception as e:
                    errors.append('%s: %s' % (url.rsplit('/', 1)[-1], e))
        if urls and not ok_d2xx:
            errors.append('D2XX (Linux) не удалось скачать автоматически')
    else:
        # On Windows, try to notice existing system ftd2xx
        pass

    # Determine overall success: need at least LibFT4222 for the current platform
    lib_name = 'LibFT4222-64.dll' if system == 'windows' else 'libft4222.so'
    have_lib = any(os.path.basename(p).lower().startswith('libft4222') or os.path.basename(p).lower().startswith('libft4222') for p in files) \
        or os.path.isfile(os.path.join(out_dir, lib_name)) or os.path.isfile(os.path.join(out_dir, 'LibFT4222.dll'))
    if have_lib:
        msg = 'Файлы загружены в %s' % out_dir
        if errors:
            msg += ' (замечания: %s)' % '; '.join(errors[-2:])
        return True, msg, files
    msg = 'Не удалось автоматически скачать библиотеки FTDI. ' + '; '.join(errors[-4:])
    msg += '. Скачайте вручную: https://ftdichip.com/software-examples/ft4222h-software-examples/ и https://ftdichip.com/drivers/d2xx-drivers/ и положите файлы в папку ftdi.'
    return False, msg, files
