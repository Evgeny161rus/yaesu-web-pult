"""
Yaesu Web Pult — сервер удалённого управления трансиверами Yaesu.

Обычный запуск — двойной клик по Yaesu-Web-Pult.exe (или Yaesu-Web-Pult.pyw):
открывается окно «Панель управления», значок в трее, браузер не нужен.

Ключи (для отладки):
    --sim          симулятор трансивера, без железа
    --background   запуск без окна (автозапуск вместе с Windows)
    --list         показать COM-порты и звуковые устройства и выйти
    --console      журнал в консоль
"""
import argparse
import asyncio
import collections
import ipaddress
import json
import logging
import logging.handlers
import os
import re
import socket
import ssl
import struct
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

import numpy as np

if getattr(sys, 'frozen', False):                  # собрано в exe (PyInstaller)
    BASE = os.path.dirname(os.path.abspath(sys.argv[0]))     # config.json рядом с exe
    RES = getattr(sys, '_MEIPASS', BASE)
else:
    RES = os.path.dirname(os.path.abspath(__file__))         # папка server
    BASE = os.path.dirname(RES)                              # config.json в корне проекта
sys.path.insert(0, RES)

from cat import Rig, SerialTransport, SerialPtt, CTCSS  # noqa: E402
from radio_backends import create_hamlib, list_hamlib_models, is_hamlib  # noqa: E402
from yaesu_detect import probe, MODERN_MODELS  # noqa: E402
from audio import SR, Decimator, Interpolator, Waterfall  # noqa: E402
from spectrum import SpectrumFrame, LatestSpectrum  # noqa: E402
from ft710_scope import PacketFramer, ScopeDecodeError, decode_packet  # noqa: E402
from webserver import WebServer  # noqa: E402
from cwdesk import CwDesk  # noqa: E402
from digidesk import DigiDesk  # noqa: E402
from voicecq import VoiceCq  # noqa: E402
from recorder import QsoRecorder  # noqa: E402
from ft8 import Ft8Desk  # noqa: E402
from memory import MemoryDesk  # noqa: E402

VERSION = "3.2-preview"
APP_NAME = "FTX-1 Пульт"
log = logging.getLogger("main")
IS_WIN = sys.platform == 'win32'

DEFAULT_CFG = {
    "radio_backend": "native",
    "hamlib_path": "rigctld",
    "hamlib_model": 1049,
    "hamlib_extra": "",
    "cat_port": "",
    "cat_baud": 38400,
    "ptt_method": "TX1",
    "ptt_port": "",
    "ptt_line": "RTS",
    "audio_in_name": "",
    "audio_out_name": "",
    "audio_api": "",
    "audio_in_index": None,
    "audio_out_index": None,
    "https_port": 8443,
    "http_port": 8080,
    "http_lan": False,
    "password": "",
    "max_tx_seconds": 180,
    "auto_connect": True,
    "open_panel": True,
    "open_pult": False,
    "waterfall_source": "auto",
    "scope_libft4222": "",
    "scope_d2xx": "",
    "scope_serial": "",
    "scope_auto_download": True,
    "sdr_driver": "rtlsdr",
    "sdr_device": "",
    "sdr_format": "",
    "sdr_sample_rate": 1024000,
    "sdr_gain": 40,
    "simulate": False,
    "my_call": "",
    "my_name": "",
    "my_qth": "",
    "my_extra": "",
    "cw_method": "cat",
    "cw_port": "",
    "cw_auto_delay": 6,
    "cw_auto_max": 4,
}


def cfg_path():
    return os.path.join(BASE, 'config.json')


def load_cfg():
    cfg = dict(DEFAULT_CFG)
    try:
        with open(cfg_path(), encoding='utf-8') as f:
            cfg.update(json.load(f))
        # настройки версии 1.1: одно поле на вход и выход
        old = cfg.pop('audio_device', None)
        if old and not cfg.get('audio_in_name') and old != 'USB Audio CODEC':
            cfg['audio_in_name'] = old
        # 1051 = FTX-1 in Hamlib 4.7+, but Q900 in 4.6.x - never use as Hamlib model.
        if int(cfg.get('hamlib_model', 0)) == 1051:
            cfg['hamlib_model'] = 1049
            log.warning("config: hamlib_model 1051 заменён на 1049 (FTX-1 использует native backend)")
    except FileNotFoundError:
        pass
    except Exception as e:
        log.error("config.json повреждён (%s) — использую настройки по умолчанию", e)
    return cfg


def save_cfg(cfg):
    tmp = cfg_path() + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    os.replace(tmp, cfg_path())


def local_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except Exception:
        pass
    return sorted(i for i in ips if not i.startswith(('127.', '169.254.')))


def ensure_cert():
    """Самоподписанный сертификат для HTTPS (браузер даёт микрофон только по HTTPS)."""
    crt, key = os.path.join(BASE, 'cert.pem'), os.path.join(BASE, 'key.pem')
    if os.path.exists(crt) and os.path.exists(key):
        return crt, key
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime
    except ImportError:
        log.warning("Нет пакета cryptography — HTTPS выключен (микрофон с телефона работать не будет)")
        return None, None
    k = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'FTX-1 Remote')])
    alt = [x509.DNSName('localhost'), x509.DNSName(socket.gethostname())]
    for ip in local_ips() + ['127.0.0.1']:
        alt.append(x509.IPAddress(ipaddress.ip_address(ip)))
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
            .public_key(k.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(days=1))
            .not_valid_after(now + datetime.timedelta(days=3650))
            .add_extension(x509.SubjectAlternativeName(alt), critical=False)
            .sign(k, hashes.SHA256()))
    with open(crt, 'wb') as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    with open(key, 'wb') as f:
        f.write(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
                                serialization.NoEncryption()))
    return crt, key


# ------------------------------------------------------------- журнал в окно
class LogBuffer(logging.Handler):
    def __init__(self):
        super().__init__()
        self.lines = collections.deque(maxlen=500)
        self.listeners = []
        self.setFormatter(logging.Formatter('%(asctime)s  %(message)s', '%H:%M:%S'))

    def emit(self, record):
        try:
            line = {'t': self.format(record), 'lvl': record.levelname}
            self.lines.append(line)
            for cb in list(self.listeners):
                cb(line)
        except Exception:
            pass


LOGBUF = LogBuffer()


# ------------------------------------------------------------ автозапуск
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"


def launch_command(background=True):
    if getattr(sys, 'frozen', False):
        cmd = '"%s"' % sys.executable
    else:
        exe = sys.executable
        if IS_WIN and exe.lower().endswith('python.exe'):
            exe = exe[:-10] + 'pythonw.exe'
        cmd = '"%s" "%s"' % (exe, os.path.join(BASE, 'Yaesu-Web-Pult.pyw'))
    return cmd + (' --background' if background else '')


def autostart_get():
    if not IS_WIN:
        return None
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
            winreg.QueryValueEx(k, 'YaesuWebPult')
            return True
    except OSError:
        return False


def autostart_set(on):
    if not IS_WIN:
        return None
    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
        if on:
            winreg.SetValueEx(k, 'YaesuWebPult', 0, winreg.REG_SZ, launch_command(True))
        else:
            try:
                winreg.DeleteValue(k, 'YaesuWebPult')
            except OSError:
                pass
    return autostart_get()


# ------------------------------------------------------------ устройства
def list_ports():
    try:
        from serial.tools import list_ports as lp
    except ImportError:
        return []
    res = []
    for p in sorted(lp.comports(), key=lambda p: p.device):
        d = p.description or ''
        res.append({'device': p.device, 'desc': d,
                    'kind': 'enhanced' if 'enhanced' in d.lower() else 'standard' if 'standard' in d.lower() else '',
                    'cp210x': 'cp210' in d.lower() or 'silicon labs' in d.lower() or (p.vid == 0x10C4)})
    return res


def list_audio(refresh=False):
    try:
        from audio import list_devices
        return list_devices(refresh)
    except Exception as e:
        log.warning("Звуковые устройства недоступны: %s", e)
        return []


def detect(ports, audio):
    """Подбор настроек для FTX-1: Enhanced-порт для CAT, Standard для PTT, USB Audio CODEC."""
    out = {}
    enh = [p for p in ports if p['kind'] == 'enhanced']
    std = [p for p in ports if p['kind'] == 'standard']
    if enh:
        out['cat_port'] = enh[0]['device']
    elif any(p['cp210x'] for p in ports):
        out['cat_port'] = [p for p in ports if p['cp210x']][0]['device']
    if std:
        out['ptt_port'] = std[0]['device']
    from audio import guess_codec
    di, do = guess_codec(audio)
    if di and do:
        out['audio_in_name'], out['audio_out_name'], out['audio_api'] = di['name'], do['name'], ''
    return out


def sdr_executable(name):
    """Find an SDR tool in PATH or in the bundled tools/ folder (Windows).

    Returns an absolute path when a local copy exists, otherwise the bare
    command name so the OS/PATH is used.
    """
    import shutil
    name = str(name or '').strip()
    if not name:
        return ''
    exe = name if os.name != 'nt' or name.lower().endswith('.exe') else name + '.exe'
    found = shutil.which(name)
    if not found and os.name == 'nt':
        found = shutil.which(exe)
    if found:
        return found
    for parts in (('tools', 'rtlsdr'), ('tools', 'rtlsdr', 'bin'),
                  ('tools', 'sdr'), ('tools', 'sdr', 'bin'), ('tools',)):
        path = os.path.join(BASE, *parts, exe)
        if os.path.isfile(path):
            return path
    return ''


# ------------------------------------------------------------------- станция
class Client:
    def __init__(self, ws, local):
        self.ws, self.local = ws, local
        self.authed = False
        self.admin = False
        self.audio = False
        self.rate = 16000
        self.wf = False
        self.wf_source = 'audio'          # audio | rf (wide USB scope)
        self.wf_max = 4000
        self.console = None
        self.name = '%s:%s' % ws.peer[:2] if ws.peer else '?'
        self.cw_dec = False
        self.cw_auto = False
        self.interp = None


class Station:
    def __init__(self, cfg, force_sim=False):
        self.cfg = cfg
        self.force_sim = force_sim
        self.clients = set()
        self.rig = None
        self.audio = None
        self.running = False
        self.busy = False
        self.last_error = ''
        self.audio_err = None
        self.decims = {48000: Decimator(1), 16000: Decimator(3), 8000: Decimator(6)}
        self.wf = Waterfall()
        self.spectrum = LatestSpectrum()
        self.scope = None                 # Ft4222Transport, only when configured
        self.scope_thread = None
        self.scope_stop = None
        self.scope_framer = PacketFramer()
        self.scope_state = 'off'          # off | starting | live | unavailable
        self.scope_reason = ''
        self.scope_frame = None
        self.scope_span = 0
        self.scope_last_good = 0.0
        self.scope_last_sent = 0.0
        self.scope_bad = 0
        self.scope_good = 0
        self.scope_dl = None              # background download thread (ftdi libs)
        self.scope_dl_msg = ''
        self.rf_scope_kind = ''            # '', 'ft4222', 'rtlsdr'
        self.rtlsdr = None
        self._rtlsdr_center = 0
        self._rtlsdr_retune_task = None
        self._rtlsdr_hotswap_task = None
        self._rtlsdr_was_live = False
        self.ptt_owner = None
        self.ptt_since = 0.0
        self.ptt_alive = 0.0
        self.loop = None
        self.quit_event = None
        self.https_ok = False
        self.ports_cache, self.audio_cache = [], []
        with open(os.path.join(RES, 'menu_ftx1.json'), encoding='utf-8') as f:
            self.menu = json.load(f)
        self.cw = CwDesk(self)
        self.digi = DigiDesk(self, BASE)
        self.vk = VoiceCq(self, BASE)
        self.rec = QsoRecorder(BASE)
        self.ft = Ft8Desk(self, BASE, VERSION, RES)
        self.mem = MemoryDesk(self, BASE)
        LOGBUF.listeners.append(self._on_log)

    def save_cfg(self):
        try:
            save_cfg(self.cfg)
        except OSError as e:
            log.error("Не удалось сохранить настройки: %s", e)

    @property
    def sim(self):
        return self.force_sim or (self.cfg.get('radio_backend') != 'hamlib' and bool(self.cfg.get('simulate')))

    async def init(self):
        self.loop = asyncio.get_running_loop()
        self.quit_event = asyncio.Event()
        asyncio.create_task(self._watchdog())
        asyncio.create_task(self._admin_loop())
        self._rtlsdr_hotswap_task = asyncio.create_task(self._rtlsdr_hotswap_loop())

    # ----- запуск/остановка связи с трансивером
    async def start_radio(self):
        if self.running or self.busy:
            return
        self.busy = True
        self.last_error = ''
        self.audio_err = None
        cfg = self.cfg
        self.spectrum.clear()
        self.wf = Waterfall()
        try:
            serial_ptt = None
            if self.sim:
                from sim import SimRadio, SimTransport, SimAudio
                radio = SimRadio()
                transport, audio = SimTransport(radio), SimAudio(radio)
                log.info("Запуск в режиме СИМУЛЯТОРА (трансивер не нужен)")
            elif cfg.get('radio_backend') == 'hamlib':
                from audio import SoundDeviceAudio
                if int(cfg.get('hamlib_model', 0)) == 1:
                    from sim import SimRadio, SimAudio
                    audio = SimAudio(SimRadio())
                else:
                    audio = SoundDeviceAudio(cfg.get('audio_in_name', ''), cfg.get('audio_out_name', ''),
                                             cfg.get('audio_api', ''), cfg.get('audio_in_index'), cfg.get('audio_out_index'))
                transport = None
            else:
                if not cfg.get('cat_port'):
                    raise RuntimeError("Не выбран COM-порт трансивера")
                from audio import SoundDeviceAudio
                transport = SerialTransport(cfg['cat_port'], int(cfg['cat_baud']))
                audio = SoundDeviceAudio(cfg.get('audio_in_name', ''), cfg.get('audio_out_name', ''),
                                         cfg.get('audio_api', ''), cfg.get('audio_in_index'), cfg.get('audio_out_index'))
                if cfg['ptt_method'] in ('RTS', 'DTR') and cfg.get('ptt_port'):
                    serial_ptt = SerialPtt(cfg['ptt_port'], cfg['ptt_method'])
                log.info("Подключаюсь к трансиверу: %s, %s бод", cfg['cat_port'], cfg['cat_baud'])
            rig = (create_hamlib(cfg, self._on_rig_change) if transport is None else
                   Rig(transport, self._on_rig_change,
                       'RTS' if cfg['ptt_method'] in ('RTS', 'DTR') else cfg['ptt_method'], serial_ptt))
            try:
                await rig.start()
            except Exception as e:
                if is_hamlib(rig):
                    raise RuntimeError('Hamlib: ' + str(e)) from e
                raise RuntimeError("Порт %s не открывается: %s. Возможно, он занят другой программой "
                                   "(WSJT-X, N1MM, Log4OM…) или выбран не тот порт." % (cfg['cat_port'], e))
            self.rig = rig
            rig.state['demo'] = self.sim or (is_hamlib(rig) and int(cfg.get('hamlib_model', 0)) == 1)
            self.audio = audio
            audio.tx.tap = self.rec.tap_tx
            try:
                audio.start(self._rx_from_thread)
                log.info("Звук трансивера подключён")
            except Exception as e:
                self.audio_err = str(e).split('\n')[0]
                log.error("Звук не запущен: %s", self.audio_err)
            self._start_scope()
            self.running = True
            log.info("Связь с трансивером запущена")
            self._broadcast_hello_state()
        except Exception as e:
            self.last_error = str(e)
            log.error("%s", e)
        finally:
            self.busy = False
            self.push_status()

    async def stop_radio(self):
        self.spectrum.clear()
        self._stop_scope('', notify=False)
        self.last_error = ''
        if not self.running:
            self.push_status()
            return
        self.cw.stop()
        self.digi.stop()
        self.vk.stop()
        self.ft.stop()
        if self.rec.on:
            self.rec.stop()
            self.broadcast(self.rec_state())
        if self.ptt_owner:
            self.set_ptt(None, False)
            await asyncio.sleep(0.15)
        try:
            if is_hamlib(self.rig):
                await self.rig.aclose()
            else:
                self.rig.close()
        except Exception:
            pass
        try:
            self.audio.stop()
        except Exception:
            pass
        self.rig = self.audio = None
        for client in self.clients:
            client.console = None
        self.running = False
        log.info("Связь с трансивером остановлена")
        self.spectrum.clear()
        self.broadcast({'t': 'state', 's': {'connected': False}})
        self.broadcast({'t': 'audio_status', 'err': 'Связь с трансивером остановлена', 'err_key': 'note.radio_stopped'})
        self.push_status()

    def _rx_from_thread(self, x):
        try:
            self.loop.call_soon_threadsafe(self._on_rx_audio, x)
        except RuntimeError:
            pass

    # ----- широкий водопад: USB-scope FT-710/FTDX10/FTDX101 через FT4222
    def scope_info(self):
        age = None
        if self.scope_last_good:
            age = int(max(0.0, time.monotonic() - self.scope_last_good) * 1000)
        dl = bool(self.scope_dl and self.scope_dl.is_alive())
        return {'state': self.scope_state, 'reason': self.scope_reason,
                'span': self.scope_span, 'age_ms': age,
                'good': self.scope_good, 'bad': self.scope_bad,
                'downloading': dl, 'dl_msg': self.scope_dl_msg}

    def scope_live(self):
        if self.scope_state == 'live' and self.scope is not None:
            return True
        return self.scope_state == 'live' and self.rf_scope_kind == 'rtlsdr' and self.rtlsdr is not None

    _SCOPE_RADIO_IDS = {'0800', '0761', '0681', '0682'}  # FT-710, FTDX10, FTDX101D/MP

    def _scope_capable_radio(self):
        rid = ''
        if self.rig and getattr(self.rig, 'state', None):
            rid = str(self.rig.state.get('radio_id') or '').zfill(4)
        return rid in self._SCOPE_RADIO_IDS

    def _maybe_scope_autodownload(self, force=False):
        """Best-effort background download of FTDI libs (opt-in, non-blocking)."""
        if not self.cfg.get('scope_auto_download'):
            return
        mode = str(self.cfg.get('waterfall_source') or 'auto').lower()
        if mode not in ('auto', 'scope'):
            return
        if self.sim or (self.rig is not None and is_hamlib(self.rig)):
            return
        if self.scope_dl and self.scope_dl.is_alive():
            return
        lib, _ = self._resolve_scope_libs()
        if lib:
            return
        # Trigger always when libs missing: user may need scope for FT-710/101/10
        # regardless of currently detected radio. Download is best-effort; bundled
        # libs in ftdi/ are found by _resolve_scope_libs before we get here.
        if not force and mode == 'audio':
            return

        def run():
            try:
                from scope_download import download_scope_libs
                ok, msg, _ = download_scope_libs(BASE, log=log.info)
                self.scope_dl_msg = msg
                if ok:
                    log.info("FTDI библиотеки: %s", msg)
                    try:
                        self.loop.call_soon_threadsafe(self._start_scope)
                    except RuntimeError:
                        pass
                else:
                    log.warning("Автозагрузка FTDI библиотек: %s", msg)
            except Exception as e:
                msg = str(e).split('\n')[0]
                self.scope_dl_msg = msg
                log.warning("Автозагрузка FTDI библиотек не удалась: %s", msg)
        self.scope_dl = threading.Thread(target=run, name='ftdi-dl', daemon=True)
        self.scope_dl.start()
        log.info("Запущена автозагрузка библиотек FTDI для USB-scope (opt-in)")

    def _resolve_scope_libs(self):
        """Configured paths, or auto-detect from <BASE>/ftdi and <BASE>."""
        cfg = self.cfg
        lib = str(cfg.get('scope_libft4222') or '').strip()
        d2xx = str(cfg.get('scope_d2xx') or '').strip()
        roots = [os.path.join(BASE, 'ftdi'), BASE, os.path.join(RES, 'ftdi'), RES]
        if not lib:
            if IS_WIN:
                names = ['LibFT4222-64.dll', 'LibFT4222.dll', 'libft4222.dll']
            else:
                names = ['libft4222.so', 'libft4222.so.1', 'libft4222.so.1.4.4.44']
            cands = []
            for r in roots:
                for n in names:
                    cands += [os.path.join(r, n), os.path.join(r, 'build', n),
                              os.path.join(r, 'build-x86_64', n), os.path.join(r, 'build-arm-v8', n)]
            lib = next((os.path.abspath(p) for p in cands if os.path.isfile(p)), '')
        elif not os.path.isabs(lib):
            alt = os.path.join(BASE, lib)
            if os.path.isfile(alt):
                lib = os.path.abspath(alt)
        if not d2xx and lib:
            if IS_WIN:
                names = ['ftd2xx64.dll', 'ftd2xx.dll']
            else:
                names = ['libftd2xx.so', 'libftd2xx.so.1', 'libftd2xx.so.1.4.27']
            folder = os.path.dirname(lib)
            cands = [os.path.join(folder, n) for n in names]
            for r in roots:
                for n in names:
                    cands.append(os.path.join(r, n))
            d2xx = next((os.path.abspath(p) for p in cands if os.path.isfile(p)), '')
        elif d2xx and not os.path.isabs(d2xx):
            alt = os.path.join(BASE, d2xx)
            if os.path.isfile(alt):
                d2xx = os.path.abspath(alt)
        # Windows: load_api requires an explicit D2XX path; try system locations.
        if IS_WIN and lib and not d2xx:
            windir = os.environ.get('WINDIR', r'C:\Windows')
            for p in (os.path.join(windir, 'System32', 'ftd2xx64.dll'),
                      os.path.join(windir, 'System32', 'ftd2xx.dll'),
                      os.path.join(windir, 'SysWOW64', 'ftd2xx.dll')):
                if os.path.isfile(p):
                    d2xx = p
                    break
        return lib, d2xx

    def _ft4222_available(self):
        lib, _ = self._resolve_scope_libs()
        return bool(lib)

    def _sdr_driver(self):
        drv = str(self.cfg.get('sdr_driver') or '').lower().strip()
        src = str(self.cfg.get('waterfall_source') or 'auto').lower()
        if drv in ('rtlsdr', 'rx_sdr', 'soapysdr', 'hackrf', 'airspy', 'sdrplay', 'custom', 'sdr'):
            if drv == 'soapysdr':
                return 'rx_sdr'
            return drv
        if src in ('rtlsdr', 'sdr'):
            return 'rtlsdr'
        return 'rtlsdr'

    def _rtlsdr_available(self):
        return self._sdr_available()

    def _sdr_available(self):
        drv = self._sdr_driver()
        if drv == 'rtlsdr':
            if sdr_executable('rtl_sdr') or sdr_executable('rtl_power'):
                return True
            for p in ('/dev/swradio0', '/dev/rtlsdr0'):
                if os.path.exists(p):
                    return True
            try:
                r = subprocess.run(['lsusb'], capture_output=True, text=True, timeout=3)
                if re.search(r'0bda:(2838|2832|2834)|RTL2838|RTL2832|RTL-SDR|Blog V4', r.stdout, re.I):
                    return True
            except Exception:
                pass
            return False
        if drv in ('rx_sdr', 'hackrf', 'airspy', 'sdrplay', 'sdr'):
            if sdr_executable('rx_sdr' if drv != 'hackrf' else 'hackrf_transfer'):
                return True
            # SoapySDR devices may be present even if we only check later
            if sdr_executable('SoapySDRUtil'):
                return True
            return False
        return bool(sdr_executable(drv))

    def _start_rtlsdr(self):
        return self._start_sdr()

    def _start_sdr(self):
        drv = self._sdr_driver()
        exe_name = 'rtl_sdr' if drv == 'rtlsdr' else ('hackrf_transfer' if drv == 'hackrf' else 'rx_sdr')
        exe = sdr_executable(exe_name)
        if not exe:
            if drv == 'rtlsdr':
                hint = ('запустите install-rtlsdr.ps1 из папки программы' if os.name == 'nt'
                        else 'sudo apt-get install -y rtl-sdr librtlsdr-dev')
            else:
                hint = f'установите {exe_name} (SoapySDR tools / драйвер устройства)'
            self.scope_state, self.scope_reason = 'unavailable', f'{drv}: {exe_name} не найден. {hint}'
            log.warning("SDR: %s", self.scope_reason)
            return False
        try:
            from rtlsdr_scope import RtlSdrScope
        except Exception as e:
            self.scope_state, self.scope_reason = 'unavailable', f'SDR: {str(e).splitlines()[0]}'
            log.warning("SDR недоступен: %s", self.scope_reason)
            return False
        center = self._rtlsdr_center_hz()
        sr = int(self.cfg.get('sdr_sample_rate', self.cfg.get('rtlsdr_sample_rate', 1024000)) or 1024000)
        gain = int(self.cfg.get('sdr_gain', self.cfg.get('rtlsdr_gain', 40)) or 40)
        device = str(self.cfg.get('sdr_device', '') or '')
        fmt = str(self.cfg.get('sdr_format', '') or ('cu8' if drv == 'rtlsdr' else 'cf32'))

        label = drv.upper()

        def on_frame(center_hz, span_hz, levels):
            try:
                self.loop.call_soon_threadsafe(self._on_rtlsdr_frame, center_hz, span_hz, levels)
            except Exception as e:
                log.error("%s call_soon_threadsafe failed: %s", label, e)

        def on_status(state, reason, span):
            try:
                self.loop.call_soon_threadsafe(self._on_rtlsdr_status, state, reason, span)
            except RuntimeError:
                pass

        try:
            sdr = RtlSdrScope(on_frame=on_frame, on_status=on_status, driver=drv,
                              device=device, fmt=fmt, executable=exe)
            sdr.start(center_hz=center, sample_rate=sr, gain=gain, fft=1024)
        except Exception as e:
            self.scope_state, self.scope_reason = 'unavailable', str(e).split('\n')[0]
            log.warning("%s не запустился: %s", label, self.scope_reason)
            return False
        self.rtlsdr = sdr
        self.rf_scope_kind = 'rtlsdr'
        self._rtlsdr_center = int(center)
        if self._rtlsdr_retune_task and not self._rtlsdr_retune_task.done():
            self._rtlsdr_retune_task.cancel()
        self._rtlsdr_retune_task = None
        self.scope_state, self.scope_reason = 'starting', ''
        self.scope_span = sr
        log.info("%s: запускаю на %.0f Гц, span %.0f Гц (device=%s)", label, center, sr, device or 'auto')
        return True

    def _rtlsdr_center_hz(self):
        # Follow current VFO-A frequency when available
        try:
            f = 0
            if self.rig and getattr(self.rig, 'state', None):
                f = int(self.rig.state.get('freq_a') or self.rig.state.get('freq') or 0)
            if f > 0:
                return f
        except Exception:
            pass
        return int(self.cfg.get('rtlsdr_center_hz', 14100000) or 14100000)

    def _rtlsdr_maybe_retune(self, freq_hz: int):
        """Retune RTL-SDR only when rig drifts near edge of span; debounce restarts."""
        if self.rf_scope_kind != 'rtlsdr' or self.rtlsdr is None:
            return
        try:
            freq_hz = int(freq_hz)
        except Exception:
            return
        if freq_hz <= 0:
            return
        span = int(self.scope_span or self.cfg.get('rtlsdr_sample_rate', 1024000) or 1024000)
        center = int(self._rtlsdr_center or 0)
        if center <= 0:
            center = freq_hz
        # Keep SDR center stable while rig is within central 70% of span.
        margin = max(5000, int(span * 0.15))
        delta = abs(freq_hz - center)
        if delta <= (span // 2 - margin):
            return
        # Outside visible span -> retune quickly; near edge -> debounce.
        delay = 0.15 if delta >= span // 2 else 0.6
        if self._rtlsdr_retune_task and not self._rtlsdr_retune_task.done():
            self._rtlsdr_retune_task.cancel()

        async def _do():
            try:
                await asyncio.sleep(delay)
                if self.rf_scope_kind != 'rtlsdr' or self.rtlsdr is None:
                    return
                f = self._rtlsdr_center_hz()
                span2 = int(self.scope_span or self.cfg.get('rtlsdr_sample_rate', 1024000) or 1024000)
                c2 = int(self._rtlsdr_center or 0)
                margin2 = max(5000, int(span2 * 0.15))
                if c2 > 0 and abs(f - c2) <= (span2 // 2 - margin2):
                    return
                self._rtlsdr_center = int(f)
                self.rtlsdr.retune(int(f))
                log.info("RTL-SDR: ретюн на %.0f Гц", f)
            except asyncio.CancelledError:
                return
            except Exception as e:
                log.warning("RTL-SDR retune: %s", e)

        try:
            self._rtlsdr_retune_task = self.loop.create_task(_do())
        except Exception:
            # fallback immediate
            self._rtlsdr_center = freq_hz
            try:
                self.rtlsdr.retune(freq_hz)
            except Exception:
                pass

    def _on_rtlsdr_frame(self, center_hz, span_hz, levels):
        if self.rf_scope_kind != 'rtlsdr' or self.rtlsdr is None:
            log.warning("RTL-SDR frame dropped: kind=%s rtlsdr=%s", self.rf_scope_kind, bool(self.rtlsdr))
            return
        self.scope_span = int(span_hz)
        self.scope_last_good = time.monotonic()
        if self.scope_state != 'live':
            self.scope_state, self.scope_reason = 'live', ''
            log.info("RTL-SDR водопад работает: %d точек, обзор %.0f Гц", len(levels), span_hz)
            self.broadcast({'t': 'wf_scope', 'state': 'live', 'reason': '', 'span': self.scope_span})
        now = time.monotonic()
        if now - self.scope_last_sent >= 0.05:
            self.scope_last_sent = now
            n = len(levels)
            pkt = b'\x04' + struct.pack('<QIH', int(center_hz), int(span_hz), n) + levels
            for c in self.clients:
                if c.authed and c.wf and c.wf_source == 'rf':
                    c.ws.send_bin(pkt)

    def _on_rtlsdr_status(self, state, reason, span):
        if self.rf_scope_kind != 'rtlsdr':
            return
        if state == 'live':
            was = self.scope_state
            self.scope_state, self.scope_reason = 'live', ''
            self._rtlsdr_was_live = True
            if span:
                self.scope_span = int(span)
            if was != 'live':
                log.info("RTL-SDR водопад работает: span %.0f Гц", self.scope_span)
                # clients may have fallen back to audio during unplug; let frontend re-sync
                self.broadcast({'t': 'wf_scope', 'state': 'live', 'reason': '', 'span': self.scope_span})
            else:
                self.broadcast({'t': 'wf_scope', 'state': 'live', 'reason': '', 'span': self.scope_span})
        elif state in ('starting', 'unavailable', 'off'):
            if state == 'unavailable':
                log.warning("RTL-SDR: %s", reason)
            prev = self.scope_state
            self.scope_state = state
            self.scope_reason = reason or ''
            # hot-unplug fallback: if we had a live RF waterfall, move clients to audio
            # but keep rtlsdr worker alive so it can reconnect on reinsert.
            if state == 'unavailable' and prev == 'live':
                self._rtlsdr_was_live = False
                for c in self.clients:
                    if c.wf_source == 'rf':
                        c.wf_source = 'audio'
                    if c.authed and c.wf:
                        c.ws.send_json({'t': 'wf_src', 'mode': 'audio', 'reason': reason or 'RTL-SDR недоступен'})
                self.broadcast({'t': 'wf_scope', 'state': 'unavailable', 'reason': reason or 'RTL-SDR недоступен'})

    async def _rtlsdr_hotswap_loop(self):
        """Watch for external SDR unplug/replug while service is running."""
        while not self.quit_event.is_set():
            try:
                await asyncio.wait_for(self.quit_event.wait(), timeout=5.0)
                return
            except asyncio.TimeoutError:
                pass
            except Exception:
                return
            try:
                mode = str(self.cfg.get('waterfall_source') or 'auto').lower()
                if mode == 'sdr':
                    mode = 'rtlsdr'
                if mode not in ('rtlsdr', 'auto'):
                    continue
                if self.sim or self.busy:
                    continue
                if self.rf_scope_kind == 'ft4222':
                    continue
                present = self._rtlsdr_available()
                if self.rf_scope_kind == 'rtlsdr' and self.rtlsdr is not None:
                    if self.rtlsdr.running:
                        if not present and self.scope_state == 'unavailable':
                            for c in self.clients:
                                if c.wf_source == 'rf':
                                    c.wf_source = 'audio'
                        continue
                    # worker died - clear and allow restart below
                    log.info("SDR: worker остановлен, пробую переподключить")
                    try:
                        self.rtlsdr.stop()
                    except Exception:
                        pass
                    self.rtlsdr = None
                    self.rf_scope_kind = ''
                    self.scope_state, self.scope_reason = 'unavailable', 'SDR отключён'
                # not running - try to start when device appears and mode wants it
                if present and self.running:
                    if mode == 'rtlsdr' or (mode == 'auto' and not self._ft4222_available()):
                        log.info("SDR: обнаружено устройство, пробую запустить (hotswap)")
                        self._start_rtlsdr()
            except Exception as e:
                log.debug("RTL-SDR hotswap watch: %s", e)

    def _start_scope(self):
        """Open optional RF waterfall source: FT4222 scope or RTL-SDR.

        ``waterfall_source``: auto|scope|rtlsdr|audio.
        Any failure leaves the audio waterfall untouched.
        """
        self._stop_scope('', notify=False)
        mode = str(self.cfg.get('waterfall_source') or 'auto').lower()
        if mode not in ('auto', 'scope', 'rtlsdr', 'sdr', 'audio'):
            mode = 'auto'
        if mode == 'sdr':
            mode = 'rtlsdr'
        if mode == 'audio':
            self.scope_state, self.scope_reason = 'off', ''
            return
        # RTL-SDR is an external receiver and can work even in simulator mode.
        # FT4222 scope needs real Yaesu USB hardware, so keep it off in sim.
        if self.sim and mode in ('auto', 'scope'):
            self.scope_state, self.scope_reason = 'off', 'в симуляторе доступен только внешний SDR-водопад (RTL-SDR/SoapySDR)'
            return

        # RTL-SDR path (external SDR)
        if mode == 'rtlsdr' or (mode == 'auto' and self._rtlsdr_available() and not self._ft4222_available()):
            if self._start_rtlsdr():
                return
            if mode == 'rtlsdr':
                return
            # auto fell through -> try ft4222 below only if available

        # FT4222 path (Yaesu USB scope)
        if self.rig is not None and is_hamlib(self.rig):
            if mode in ('scope',):
                self.scope_state, self.scope_reason = 'unavailable', 'USB-scope недоступен в режиме Hamlib'
            else:
                self.scope_state, self.scope_reason = 'off', ''
            return
        explicit = bool(str(self.cfg.get('scope_libft4222') or '').strip())
        lib, d2xx = self._resolve_scope_libs()
        serial = str(self.cfg.get('scope_serial') or '').strip()
        if not lib:
            # auto: if no ft4222 libs but rtlsdr exists, try it
            if mode == 'auto' and self._rtlsdr_available():
                if self._start_rtlsdr():
                    return
            self.scope_state = 'unavailable'
            self.scope_reason = ('библиотека LibFT4222 не найдена '
                                 '(положите в папку ftdi рядом с программой или укажите путь в настройках)')
            self._maybe_scope_autodownload()
            if self.scope_dl and self.scope_dl.is_alive():
                self.scope_reason = 'скачиваю библиотеки FTDI для USB-scope…'
            elif mode == 'scope' or explicit:
                log.warning("Широкий водопад недоступен: %s", self.scope_reason)
            return
        try:
            from ft4222_transport import Ft4222Transport, load_api
            spi, d2 = load_api(lib, d2xx or None)
            transport = Ft4222Transport(spi, d2, serial) if serial else Ft4222Transport.by_description(spi, d2)
            transport.open()
        except Exception as e:
            self.scope_state, self.scope_reason = 'unavailable', str(e).split('\n')[0]
            if mode == 'scope':
                log.warning("Широкий водопад недоступен: %s", self.scope_reason)
            else:
                log.info("USB-scope не используется: %s", self.scope_reason)
            if mode == 'auto' and self._rtlsdr_available():
                self._start_rtlsdr()
            return
        self.scope = transport
        self.scope_stop = threading.Event()
        self.scope_framer = PacketFramer()
        self.scope_state, self.scope_reason = 'starting', ''
        self.scope_good = self.scope_bad = 0
        self.scope_last_good = time.monotonic()
        self.scope_thread = threading.Thread(target=self._scope_reader, args=(transport,),
                                             name='ft4222-scope', daemon=True)
        self.scope_thread.start()
        log.info("Широкий водопад: читаю USB-scope %s", serial or 'FT4222 A')

    def _scope_reader(self, transport):
        stop = self.scope_stop
        try:
            while stop is not None and not stop.is_set():
                try:
                    data = transport.read(4096)
                except Exception as e:
                    if stop is not None and not stop.is_set():
                        try:
                            self.loop.call_soon_threadsafe(self._scope_failed, str(e).split('\n')[0])
                        except RuntimeError:
                            pass
                    return
                if data:
                    try:
                        self.loop.call_soon_threadsafe(self._on_scope_bytes, data)
                    except RuntimeError:
                        return
                else:
                    time.sleep(0.02)
        finally:
            try:
                transport.close()
            except Exception:
                pass

    def _scope_failed(self, reason):
        if self.scope_state in ('live', 'starting'):
            log.warning("USB-scope остановлен: %s", reason)
            self._stop_scope(reason or 'ошибка USB-scope')

    def _on_scope_bytes(self, data):
        if self.scope is None:
            return
        for packet in self.scope_framer.feed(data):
            try:
                frame = decode_packet(packet).center_frame()
            except ScopeDecodeError:
                self.scope_bad += 1
                if self.scope_good == 0 and self.scope_bad >= 40:
                    self._stop_scope('пакеты USB-scope не распознаны')
                    return
                continue
            self.scope_good += 1
            self.scope_bad = 0
            self.scope_frame = frame
            self.scope_span = int(round(frame.bin_hz * (len(frame.levels) - 1)))
            self.scope_last_good = time.monotonic()
            if self.scope_state != 'live':
                self.scope_state, self.scope_reason = 'live', ''
                log.info("Широкий водопад работает: %d точек, обзор %.0f Гц",
                         len(frame.levels), self.scope_span)
                self.broadcast({'t': 'wf_scope', 'state': 'live', 'reason': '', 'span': self.scope_span})
            now = time.monotonic()
            if now - self.scope_last_sent >= 0.04:      # <=25 кадров/с на клиента
                self.scope_last_sent = now
                n = len(frame.levels)
                center = int(round(frame.first_hz + (n - 1) * frame.bin_hz / 2))
                span = int(round((n - 1) * frame.bin_hz))
                pkt = b'\x04' + struct.pack('<QIH', center, span, n) + frame.levels
                for c in self.clients:
                    if c.authed and c.wf and c.wf_source == 'rf':
                        c.ws.send_bin(pkt)

    def _stop_scope(self, reason='', notify=True):
        # RTL-SDR
        rt = self._rtlsdr_retune_task
        self._rtlsdr_retune_task = None
        if rt and not rt.done():
            rt.cancel()
        self._rtlsdr_center = 0
        rtlsdr, self.rtlsdr = self.rtlsdr, None
        if rtlsdr is not None:
            try:
                rtlsdr.stop()
            except Exception:
                pass
        # FT4222
        transport, self.scope = self.scope, None
        stop, self.scope_stop = self.scope_stop, None
        thread, self.scope_thread = self.scope_thread, None
        if stop is not None:
            stop.set()
        if thread is not None and thread is not threading.current_thread():
            thread.join(0.5)            # read timeout is 100 ms; close happens in the worker
        elif transport is not None:
            try:
                transport.close()
            except Exception:
                pass
        self.rf_scope_kind = ''
        self.scope_frame = None
        self.scope_span = 0
        was = self.scope_state
        self.scope_state = 'unavailable' if reason else 'off'
        self.scope_reason = reason
        if notify and was in ('live', 'starting'):
            for c in self.clients:
                if c.wf_source == 'rf':
                    c.wf_source = 'audio'
                if c.authed and c.wf:
                    c.ws.send_json({'t': 'wf_src', 'mode': 'audio', 'reason': reason})
            self.broadcast({'t': 'wf_scope', 'state': self.scope_state, 'reason': reason})

    # ----- приём звука: раздаём клиентам и строим водопад
    def _on_rx_audio(self, x):
        self.rec.feed_rx(x)
        need = {c.rate for c in self.clients if c.audio and c.authed}
        for rate in need:
            y = self.decims[rate].process(x)
            pkt = b'\x01' + (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
            for c in self.clients:
                if c.audio and c.authed and c.rate == rate:
                    c.ws.send_bin(pkt)
        rows = self.wf.process(x)
        if rows and self.running:
            self.spectrum.publish(SpectrumFrame(
                source='audio', domain='audio', first_hz=0,
                bin_hz=self.wf.bin_hz, levels=rows[-1].tobytes(),
                unit='dBFS', level_offset=-130, level_step=0.5,
                demo=bool(self.rig and self.rig.state.get('demo'))))
        bw = self.wf.bandwidth
        if bw and abs(bw - getattr(self, '_bw_sent', 0)) > 300:
            self._bw_sent = bw
            self.broadcast({'t': 'bw', 'hz': bw})
        if rows and any(c.wf for c in self.clients):
            for row in rows:
                for c in self.clients:
                    if c.wf and c.authed and c.wf_source != 'rf':
                        n = min(len(row), int(c.wf_max / self.wf.bin_hz) + 1)
                        c.ws.send_bin(b'\x02' + struct.pack('<Hf', n, self.wf.bin_hz) + row[:n].tobytes())
        self.cw.feed(x)
        self.digi.feed(x)
        self.ft.feed(x)

    def _on_rig_change(self, diff):
        self.broadcast({'t': 'state', 's': diff})
        if 'connected' in diff or 'tx' in diff:
            self.push_status()
        if self.rf_scope_kind == 'rtlsdr' and self.rtlsdr is not None:
            for k in ('freq_a', 'freq'):
                if k in diff:
                    try:
                        self.loop.call_soon_threadsafe(self._rtlsdr_maybe_retune, diff[k])
                    except Exception:
                        pass
                    break

    def _broadcast_hello_state(self):
        if self.rig:
            self.broadcast({'t': 'state', 's': self.rig.state, 'full': True})
        self.broadcast({'t': 'audio_status', 'err': self.audio_err})

    def broadcast(self, obj):
        for c in self.clients:
            if c.authed:
                c.ws.send_json(obj)

    def _ptt_info(self):
        for c in self.clients:
            if c.authed:
                c.ws.send_json({'t': 'ptt_owner', 'you': self.ptt_owner is c,
                                'busy': self.ptt_owner is not None, 'who': self.ptt_owner.name if self.ptt_owner else ''})

    def set_ptt(self, client, on):
        if not self.rig:
            if on and client:
                client.ws.send_json({'t': 'note', 'msg': 'Сервер не подключён к трансиверу', 'msg_key': 'note.no_radio'})
            return
        if on:
            if is_hamlib(self.rig) and (not self.rig.state.get('connected') or not self.rig.caps.get('ptt')):
                client.ws.send_json({'t': 'note',
                                     'msg': 'PTT недоступен: проверьте соединение и возможности модели',
                                     'msg_key': 'note.ptt_unavail'})
                return
            if self.vk.task:                             # PTT вручную — автовызов прекращаем, работаем сами
                self.vk.stop('нажата PTT', key='vk.note.stopped_ptt')
                self.vk.busy = False
            if self.digi.tx_busy or self.cw.sender.busy or self.ft.busy:
                client.ws.send_json({'t': 'note',
                                     'msg': 'Идёт передача RTTY/CW/FT8 — дождитесь окончания',
                                     'msg_key': 'note.tx_busy_digital'})
                return
            if self.ptt_owner not in (None, client):
                client.ws.send_json({'t': 'note',
                                     'msg': 'Передача занята другим клиентом (%s)' % self.ptt_owner.name,
                                     'msg_key': 'note.tx_busy_other',
                                     'msg_params': {'who': self.ptt_owner.name}})
                return
            if self.ptt_owner is None:
                self.audio.tx.clear()
                self.ptt_since = time.monotonic()
                log.info("Передача: %s", client.name)
            self.ptt_owner = client
            self.ptt_alive = time.monotonic()
            self.rig.ptt(True)
        else:
            if self.ptt_owner is client or client is None:
                self.ptt_owner = None
                self.rig.ptt(False)
                self.audio.tx.clear()
        self._ptt_info()
        self.push_status()

    async def _watchdog(self):
        """Защита от «залипшей» передачи: пропала связь или превышено время."""
        while True:
            await asyncio.sleep(0.25)
            try:
                if self.ptt_owner:
                    now = time.monotonic()
                    if now - self.ptt_alive > 1.5:
                        log.warning("PTT снят: нет подтверждений от клиента %s", self.ptt_owner.name)
                        self.ptt_owner.ws.send_json({'t': 'note',
                                                     'msg': 'Передача снята: потеря связи',
                                                     'msg_key': 'note.ptt_lost'})
                        self.set_ptt(None, False)
                    elif now - self.ptt_since > self.cfg['max_tx_seconds']:
                        log.warning("PTT снят: превышено время передачи")
                        self.ptt_owner.ws.send_json({'t': 'note',
                                                     'msg': ('Передача снята: превышено время '
                                                             '(%d с)') % self.cfg['max_tx_seconds'],
                                                     'msg_key': 'note.ptt_timeout',
                                                     'msg_params': {'sec': int(self.cfg['max_tx_seconds'])}})
                        self.set_ptt(None, False)
                await self.cw.tick()
                if self.scope_state == 'live' and time.monotonic() - self.scope_last_good > 6:
                    log.warning("USB-scope не присылает данные — перехожу на звуковой водопад")
                    self._stop_scope('нет данных USB-scope')
                if self.audio:
                    lv = {'t': 'lv', 'rx': round(getattr(self.audio, 'rx_level', 0), 4), 'tx': round(self.audio.tx.level, 4)}
                    self.broadcast(lv)
            except Exception as e:
                log.debug("watchdog: %s", e)

    # ----- панель управления (только с этого ПК)
    def _on_log(self, line):
        if not self.loop:
            return
        try:
            self.loop.call_soon_threadsafe(self._send_admin, {'t': 'admin_log', 'line': line})
        except RuntimeError:
            pass

    def _send_admin(self, obj):
        for c in self.clients:
            if c.admin:
                c.ws.send_json(obj)

    def urls(self):
        u = [{'kind': 'local', 'url': 'http://localhost:%d' % self.cfg['http_port']}]
        if self.https_ok:
            for ip in local_ips():
                u.append({'kind': 'lan', 'url': 'https://%s:%d' % (ip, self.cfg['https_port'])})
        return u

    def status(self):
        # Ensure FTDI libs are present regardless of transceiver.
        try:
            if self.running and self.cfg.get('scope_auto_download') and not self.scope_live():
                lib, _ = self._resolve_scope_libs()
                if not lib:
                    self._maybe_scope_autodownload()
        except Exception:
            pass
        st = (getattr(self.rig, 'state', None) or {})
        return {
            'running': self.running, 'busy': self.busy, 'sim': self.sim,
            'connected': bool(st.get('connected')), 'tx': bool(st.get('tx')),
            'freq': st.get('freq_a'), 'mode': st.get('mode'), 'radio_id': st.get('radio_id'),
            'radio_name': st.get('radio_name'), 'backend': st.get('backend'),
            'fw': st.get('fw0'), 'head': st.get('pwr_head'),
            'audio_ok': self.running and not self.audio_err, 'audio_err': self.audio_err,
            'audio_names': list(getattr(self.audio, 'names', ('', ''))) if self.audio else ['', ''],
            'audio_api_used': getattr(self.audio, 'api_used', '') if self.audio else '',
            'error': self.last_error or st.get('backend_error', ''),
            'clients': [{'name': c.name, 'local': c.local, 'audio': c.audio, 'tx': c is self.ptt_owner}
                        for c in self.clients if c.authed and not c.admin],
            'ptt_owner': self.ptt_owner.name if self.ptt_owner else '',
            'scope': self.scope_info(),
        }

    def rec_download(self, rest, query):
        from urllib.parse import parse_qs, unquote
        data = self.rec.read(unquote(rest), (parse_qs(query).get('k') or [''])[0])
        return ('audio/wav', data) if data is not None else None

    def rec_state(self):
        return {'t': 'rec_state', 'on': self.rec.on, 'name': self.rec.name, 'elapsed': self.rec.elapsed(),
                'files': self.rec.files(), 'k': self.rec.token}

    def push_status(self):
        self._send_admin({'t': 'admin_status', 's': self.status()})

    async def _admin_loop(self):
        while True:
            await asyncio.sleep(1)
            if any(c.admin for c in self.clients):
                self.push_status()

    async def _admin_msg(self, c, m):
        t = m['t']
        if t == 'admin_probe':
            probing = False
            try:
                if self.running or self.busy: raise ValueError('Сначала остановите соединение')
                if self.cfg.get('radio_backend') == 'hamlib' and int(self.cfg['hamlib_model']) not in MODERN_MODELS:
                    raise ValueError('Автоопределение по CAT ID поддерживается только для современных Yaesu. '
                                     'Выберите модель Hamlib вручную — для Icom, Kenwood и других это основной способ.')
                self.busy = True
                probing = True
                found = await asyncio.to_thread(probe, self.cfg.get('cat_port'), self.cfg['cat_baud'])
                c.ws.send_json({'t': 'probe_result', 'found': found})
            except Exception as e:
                c.ws.send_json({'t': 'probe_result', 'error': str(e)})
            finally:
                if probing: self.busy = False
        elif t == 'admin_hamlib_models':
            try:
                models = await asyncio.to_thread(list_hamlib_models, self.cfg.get('hamlib_path') or 'rigctld')
                c.ws.send_json({'t': 'hamlib_models', 'models': models})
            except Exception as e:
                c.ws.send_json({'t': 'hamlib_models', 'models': [], 'error': str(e)})
        elif t == 'admin_hello':
            c.admin = True
            c.authed = True
            self.ports_cache = await asyncio.to_thread(list_ports)
            self.audio_cache = await asyncio.to_thread(list_audio, not self.running)
            c.ws.send_json({'t': 'admin_init', 'cfg': self.cfg, 'ports': self.ports_cache, 'audio': self.audio_cache,
                            'urls': self.urls(), 'autostart': autostart_get(), 'version': VERSION,
                            'log': list(LOGBUF.lines), 'first_run': not os.path.exists(cfg_path()),
                            'detect': detect(self.ports_cache, self.audio_cache), 'win': IS_WIN,
                            'headless': bool(getattr(self, 'headless', False))})
            c.ws.send_json({'t': 'admin_status', 's': self.status()})
        elif t == 'admin_refresh':
            self.ports_cache = await asyncio.to_thread(list_ports)
            self.audio_cache = await asyncio.to_thread(list_audio, not self.running)
            c.ws.send_json({'t': 'admin_devices', 'ports': self.ports_cache, 'audio': self.audio_cache,
                            'detect': detect(self.ports_cache, self.audio_cache), 'urls': self.urls()})
        elif t == 'admin_save':
            new = {k: v for k, v in (m.get('cfg') or {}).items() if k in DEFAULT_CFG}
            radio_keys = ('radio_backend', 'hamlib_path', 'hamlib_model', 'hamlib_extra',
                          'cat_port', 'cat_baud', 'ptt_method', 'ptt_port',
                          'audio_in_name', 'audio_out_name', 'audio_api',
                          'audio_in_index', 'audio_out_index', 'simulate',
                          'waterfall_source', 'scope_libft4222', 'scope_d2xx', 'scope_serial', 'scope_auto_download',
                          'sdr_driver', 'sdr_device', 'sdr_format', 'sdr_sample_rate', 'sdr_gain')
            need_restart = self.running and any(new.get(k, self.cfg.get(k)) != self.cfg.get(k) for k in radio_keys)
            port_change = any(new.get(k, self.cfg.get(k)) != self.cfg.get(k) for k in ('http_port', 'https_port'))
            self.cfg.update(new)
            save_cfg(self.cfg)
            self.last_error = ''
            log.info("Настройки сохранены")
            c.ws.send_json({'t': 'admin_saved', 'cfg': self.cfg, 'port_change': port_change})
            if need_restart:
                log.info("Перезапуск связи с новыми настройками")
                await self.stop_radio()
                await self.start_radio()
            else:
                self.push_status()
        elif t == 'admin_start':
            if not os.path.exists(cfg_path()):
                save_cfg(self.cfg)
            await self.start_radio()
        elif t == 'admin_stop':
            await self.stop_radio()
        elif t == 'admin_autostart':
            try:
                v = autostart_set(bool(m.get('on')))
                log.info("Автозапуск вместе с Windows: %s", 'включён' if v else 'выключен')
            except Exception as e:
                v = autostart_get()
                log.error("Не удалось изменить автозапуск: %s", e)
            c.ws.send_json({'t': 'admin_autostart', 'on': v})
        elif t == 'admin_open_pult':
            webbrowser.open('http://localhost:%d/' % self.cfg['http_port'])
        elif t == 'admin_scope_download':
            if self.scope_dl and self.scope_dl.is_alive():
                c.ws.send_json({'t': 'admin_scope_download', 'ok': False, 'msg': 'Загрузка уже выполняется…'})
                return

            def run():
                try:
                    from scope_download import download_scope_libs
                    ok, msg, _ = download_scope_libs(BASE, log=log.info)
                    self.scope_dl_msg = msg

                    def done():
                        c.ws.send_json({'t': 'admin_scope_download', 'ok': ok, 'msg': msg})
                        if ok and self.running:
                            self._start_scope()
                    self.loop.call_soon_threadsafe(done)
                except Exception as e:
                    msg = str(e).split('\n')[0]
                    self.scope_dl_msg = msg
                    try:
                        self.loop.call_soon_threadsafe(
                            lambda: c.ws.send_json({'t': 'admin_scope_download', 'ok': False, 'msg': msg}))
                    except RuntimeError:
                        pass
            self.scope_dl = threading.Thread(target=run, name='ftdi-dl', daemon=True)
            self.scope_dl.start()
            c.ws.send_json({'t': 'admin_scope_download', 'ok': None, 'msg': 'Загрузка библиотек FTDI начата…'})
        elif t == 'admin_open_folder':
            if IS_WIN:
                os.startfile(BASE)
        elif t == 'admin_quit':
            log.info("Выход из программы")
            await self.stop_radio()
            self.quit_event.set()

    # ----- клиент пульта
    async def handle_ws(self, ws):
        ip = ws.peer[0] if ws.peer else ''
        local = (ip in ('127.0.0.1', '::1', '::ffff:127.0.0.1')
                 and getattr(ws, 'local_ui', False)
                 and not os.environ.get('FTX_TEST_REMOTE'))
        c = Client(ws, local)
        self.clients.add(c)
        try:
            while True:
                kind, data = await ws.recv()
                if kind is None:
                    break
                if kind == 'text':
                    try:
                        m = json.loads(data)
                    except ValueError:
                        continue
                    try:
                        await self._on_msg(c, m)
                    except ValueError as e:
                        c.ws.send_json({'t': 'note', 'msg': str(e)})
                    except Exception as e:
                        log.exception("Ошибка обработки %s: %s", m.get('t'), e)
                elif kind == 'bin' and c.authed and data[:1] == b'\x03':
                    if len(data) > 2 and data[1] in (1, 2, 6) and len(data) % 2 == 0:
                        self._on_tx_audio(c, data[2:], data[1] * 8000)
                    else:                                   # старый пульт без частоты в кадре
                        self._on_tx_audio(c, data[1:], c.rate)
        finally:
            self.clients.discard(c)
            if self.ptt_owner is c:
                self.set_ptt(None, False)
            if c.console and self.rig:
                self.rig.remove_raw_listener(c.console)
            self.cw.client_gone(c)
            self.digi.client_gone(c)
            self.ft.client_gone(c)
            if c.authed and not c.admin:
                log.info("Отключился %s", c.name)
                self.push_status()

    def _on_tx_audio(self, c, pcm, rate):
        if self.ptt_owner is not c or not self.audio:
            return
        x = np.frombuffer(pcm, '<i2').astype(np.float32) / 32768.0
        if c.interp is None or c.interp.f != SR // rate:
            c.interp = Interpolator(SR // rate)
        self.audio.tx.push(c.interp.process(x))

    async def _on_msg(self, c, m):
        t = m.get('t', '')
        if t.startswith('admin_'):
            pw = self.cfg.get('password') or ''
            if c.local:
                await self._admin_msg(c, m)
            elif pw and c.authed:
                await self._admin_msg(c, m)
            elif t == 'admin_hello' and pw and m.get('pw') == pw:
                c.authed = True
                await self._admin_msg(c, m)
            else:
                c.ws.send_json({'t': 'admin_denied', 'need_pw': bool(pw) and not c.local})
            return
        if t == 'hello':
            pw = self.cfg.get('password') or ''
            if c.local or (pw and m.get('pw') == pw):
                c.authed = True
                c.rate = m.get('rate') if m.get('rate') in (8000, 16000, 48000) else 16000
                c.ws.send_json({'t': 'hello_ok', 'local': c.local, 'version': VERSION,
                                'backend': self.rig.state.get('backend') if self.rig else 'native',
                                'audio_err': self.audio_err, 'ctcss': CTCSS, 'running': self.running,
                                'max_tx': self.cfg['max_tx_seconds'], 'ptt_method': self.cfg['ptt_method'],
                                'wf_scope': self.scope_live(), 'wf_scope_reason': self.scope_reason})
                c.ws.send_json({'t': 'state', 's': (getattr(self.rig, 'state', None) or {'connected': False}), 'full': True})
                if self.rig:
                    self.rig.refresh()                     # свежие значения из трансивера, а не из памяти
                c.ws.send_json({'t': 'audio_status',
                                'err': self.audio_err if self.running else 'Связь с трансивером остановлена'})
                if self.wf.bandwidth:
                    c.ws.send_json({'t': 'bw', 'hz': self.wf.bandwidth})
                if not self.running:
                    c.ws.send_json({'t': 'note',
                                    'msg': ('Сервер запущен, но связь с трансивером остановлена — '
                                            'нажмите «Запустить» в панели управления')})
                self._ptt_info()
                log.info("Подключился пульт %s", c.name)
                self.push_status()
            else:
                msg = ('Удалённый доступ выключен: задайте пароль в панели управления на ПК с трансивером'
                       if not pw else 'Неверный пароль')
                first = not m.get('pw')
                if not first:
                    log.warning("Отказ в доступе %s: %s", c.name, 'нет пароля на сервере' if not pw else 'неверный пароль')
                    c.fails = getattr(c, 'fails', 0) + 1
                    await asyncio.sleep(min(5, 0.7 * c.fails))     # от перебора паролей; соединение не рвём
                c.ws.send_json({'t': 'auth_fail', 'msg': msg, 'first': first and bool(pw)})
            return
        if not c.authed:
            return
        if t == 'spectrum_get':
            c.ws.send_json(self.spectrum.snapshot())
            return
        # Model-specific modules must never send FTX-1 commands through Hamlib.
        if is_hamlib(self.rig) and (
                t in ('act', 'raw', 'console', 'menu_get', 'menu_set', 'menu_list') or
                t.startswith(('cw_', 'mem_', 'ft_', 'vk_', 'rt_', 'fax_', 'nx_', 'psk_', 'sstv_'))):
            if not t.endswith('hello') and t not in ('menu_list', 'console'):
                c.ws.send_json({'t': 'note', 'msg': 'Эта функция пока доступна только в драйвере FTX-1'})
            return
        if t.startswith('cw_'):
            await self.cw.on_msg(c, m)
            return
        if t in ('rec_start', 'rec_stop', 'rec_hello'):
            if t == 'rec_start' and self.running and self.audio and not self.audio_err:
                st = (getattr(self.rig, 'state', None) or {})
                name = self.rec.start(st.get('freq_a') or 0, st.get('mode') or '')
                log.info("Запись связи: %s", name)
            elif t == 'rec_start':
                c.ws.send_json({'t': 'note', 'msg': 'Запись невозможна: звук трансивера не подключён'})
            elif t == 'rec_stop' and self.rec.on:
                log.info("Запись связи остановлена: %s (%d с)", self.rec.name, self.rec.elapsed())
                self.rec.stop()
            if t == 'rec_hello':
                c.ws.send_json(self.rec_state())
            else:
                self.broadcast(self.rec_state())
            return
        if t.startswith('mem_'):
            await self.mem.on_msg(c, m)
            return
        if t.startswith('ft_'):
            await self.ft.on_msg(c, m)
            return
        if t.startswith('vk_'):
            await self.vk.on_msg(c, m)
            return
        if t.startswith(('rt_', 'fax_', 'nx_', 'psk_', 'sstv_')):
            await self.digi.on_msg(c, m)
            return
        if t == 'audio':
            c.audio = bool(m.get('on'))
            if m.get('rate') in (8000, 16000, 48000):
                c.rate = m['rate']
            return
        if t == 'wf':
            c.wf = bool(m.get('on'))
            c.wf_max = max(500, min(24000, int(m.get('max', 4000))))
            src = m.get('src')
            if src in ('rf', 'audio'):
                c.wf_source = src
            if c.wf and c.wf_source == 'rf':
                if self.scope_live():
                    c.ws.send_json({'t': 'wf_src', 'mode': 'rf', 'span': self.scope_span})
                else:
                    c.wf_source = 'audio'
                    c.ws.send_json({'t': 'wf_src', 'mode': 'audio',
                                    'reason': self.scope_reason or 'USB-scope недоступен'})
            return
        if t == 'ping':
            c.ws.send_json({'t': 'pong', 'ts': m.get('ts')})
            return
        if t == 'menu_list':
            c.ws.send_json({'t': 'menu_list', 'items': self.menu})
            return
        if t == 'ptt':
            self.set_ptt(c, bool(m.get('on')))
            return
        if t == 'ptt_alive':
            if self.ptt_owner is c:
                self.ptt_alive = time.monotonic()
            return
        rig = self.rig
        if not rig:
            if t in ('set', 'act', 'raw', 'menu_get', 'menu_set'):
                c.ws.send_json({'t': 'note', 'msg': 'Связь с трансивером остановлена'})
            return
        if t == 'set':
            rig.set_param(m.get('k'), m.get('v'))
        elif t == 'act':
            rig.action(m.get('a'), m.get('arg'))
        elif t == 'raw':
            cmd = str(m.get('c', '')).strip().upper()
            if cmd and len(cmd) < 64:
                parts = [p.strip() for p in cmd.split(';') if p.strip()]
                if any(p.startswith('TX') and p != 'TX' for p in parts):
                    c.ws.send_json({'t': 'note', 'msg': 'Команды TX из консоли запрещены. Используйте кнопку PTT.'})
                    return
                for part in parts:
                    rig.send(part + ';')
        elif t == 'console':
            if m.get('on') and not c.console:
                c.console = lambda line, cl=c: cl.ws.send_json({'t': 'raw', 'line': line})
                rig.add_raw_listener(c.console)
            elif not m.get('on') and c.console:
                rig.remove_raw_listener(c.console)
                c.console = None
        elif t == 'menu_get':
            for ex in m.get('ex', [])[:60]:
                v = await rig.menu_get(ex)
                c.ws.send_json({'t': 'menu_val', 'ex': ex, 'v': v})
        elif t == 'menu_set':
            item = next((i for i in self.menu if i['ex'] == m.get('ex')), None)
            if item:
                v = await rig.menu_set(item['ex'], m.get('v'), item['signed'], item['digits'])
                c.ws.send_json({'t': 'menu_val', 'ex': item['ex'], 'v': v})


# ------------------------------------------------------------- окно и трей
def find_app_browser():
    """Edge/Chrome для окна в режиме приложения (без адресной строки)."""
    cands = []
    if IS_WIN:
        for env in ('PROGRAMFILES(X86)', 'PROGRAMFILES', 'LOCALAPPDATA'):
            root = os.environ.get(env)
            if root:
                cands += [os.path.join(root, r'Microsoft\Edge\Application\msedge.exe'),
                          os.path.join(root, r'Google\Chrome\Application\chrome.exe')]
    else:
        import shutil
        for n in ('microsoft-edge', 'google-chrome', 'chromium', 'chromium-browser'):
            p = shutil.which(n)
            if p:
                cands.append(p)
    return next((p for p in cands if os.path.exists(p)), None)


def open_window(url, size=(1080, 860)):
    exe = find_app_browser()
    if exe:
        try:
            flags = 0x08000000 if IS_WIN else 0          # CREATE_NO_WINDOW
            subprocess.Popen([exe, '--app=' + url, '--window-size=%d,%d' % size],
                             creationflags=flags, close_fds=True)
            return
        except Exception as e:
            log.debug("app-окно не открылось: %s", e)
    webbrowser.open(url)


def start_tray(station, panel_url, pult_url):
    """Значок в области уведомлений (если установлены pystray и Pillow)."""
    try:
        import pystray
        from PIL import Image
    except Exception:
        return None
    try:
        img = Image.open(os.path.join(web_dir(), 'icon-192.png'))
        loop = station.loop

        def quit_app(icon, item):
            loop.call_soon_threadsafe(lambda: asyncio.ensure_future(station._admin_msg_quit()))

        menu = pystray.Menu(
            pystray.MenuItem('Панель управления', lambda i, it: open_window(panel_url), default=True),
            pystray.MenuItem('Открыть пульт', lambda i, it: open_window(pult_url, (1400, 900))),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem('Выход', quit_app),
        )
        icon = pystray.Icon('YaesuWebPult', img, APP_NAME, menu)
        icon.run_detached()
        return icon
    except Exception as e:
        log.debug("Трей недоступен: %s", e)
        return None


async def _quit(station):
    await station.stop_radio()
    station.quit_event.set()
Station._admin_msg_quit = lambda self: _quit(self)


def web_dir():
    candidates = [
        os.path.join(RES, 'web'),
        os.path.join(RES, '..', 'web'),
        os.path.join(BASE, 'web'),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web'),
    ]
    for d in candidates:
        d = os.path.abspath(d)
        if os.path.isdir(d) and os.path.isfile(os.path.join(d, 'index.html')):
            return d
    return os.path.abspath(os.path.join(RES, '..', 'web'))


def already_running(port):
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/api/ping' % port, timeout=1.5) as r:
            return r.read().startswith(b'YAESU')
    except Exception:
        return False


def message_box(text, title=APP_NAME):
    if IS_WIN:
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, text, title, 0x40)
            return
        except Exception:
            pass
    print(text)


# ------------------------------------------------------------------ запуск
def list_all():
    print("COM-порты:")
    for p in list_ports():
        print("  %-8s %s" % (p['device'], p['desc']))
    print("\nЗвуковые устройства:")
    for d in list_audio():
        print("  [%2d] %-45s %-20s in=%d out=%d" % (d['index'], d['name'], d['api'], d['in'], d['out']))


async def amain(args):
    cfg = load_cfg()
    st = Station(cfg, force_sim=args.sim)
    st.headless = bool(getattr(args, 'headless', False))
    await st.init()
    # Ensure FTDI scope libs are present regardless of transceiver (bundled in ftdi/).
    lib, d2xx = st._resolve_scope_libs()
    if lib:
        log.info("FTDI scope библиотеки: %s%s", lib, f" + {d2xx}" if d2xx else "")
    else:
        log.warning("FTDI scope библиотеки не найдены — пытаюсь установить/скачать автоматически")
        st._maybe_scope_autodownload(force=True)

    app = WebServer(web_dir(), st.handle_ws, {'/api/ping': lambda: ('text/plain', b'YAESU-WEB-PULT ' + VERSION.encode())},
                    {'/rec/': st.rec_download})
    servers = []
    http_host = '0.0.0.0' if cfg.get('http_lan') else '127.0.0.1'
    try:
        servers.append(await asyncio.start_server(app.handle, http_host, cfg['http_port']))
    except OSError as e:
        message_box("Не удалось занять порт %d: %s\n\nЕго использует другая программа. Смените http_port в config.json."
                    % (cfg['http_port'], e))
        return
    crt, key = ensure_cert()
    if crt:
        try:
            ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
            ctx.load_cert_chain(crt, key)
            servers.append(await asyncio.start_server(app.handle, '0.0.0.0', cfg['https_port'], ssl=ctx))
            st.https_ok = True
        except OSError as e:
            log.error("HTTPS-порт %d занят (%s) — вход с телефона недоступен", cfg['https_port'], e)

    panel_url = 'http://localhost:%d/panel.html' % cfg['http_port']
    pult_url = 'http://localhost:%d/' % cfg['http_port']
    log.info("%s %s запущен. Панель: %s", APP_NAME, VERSION, panel_url)

    first_run = not os.path.exists(cfg_path())
    if (cfg.get('auto_connect') and not first_run) or args.sim:
        asyncio.create_task(st.start_radio())
    if not (args.background or args.headless):
        if cfg.get('open_panel', True) or first_run:
            open_window(panel_url, (1280, 820))
        if cfg.get('open_pult') and not first_run:
            open_window(pult_url, (1400, 900))
    icon = None if args.headless else start_tray(st, panel_url, pult_url)
    if icon is None and not args.background and not args.headless and not find_app_browser():
        log.info("Совет: установите pystray и Pillow, чтобы получить значок в трее")

    tasks = [asyncio.create_task(s.serve_forever()) for s in servers]
    await st.quit_event.wait()
    await st.stop_radio()
    for client in list(st.clients):
        await client.ws.close()
    for s in servers:
        s.close()
    for t in tasks:
        t.cancel()
    if icon:
        try:
            icon.stop()
        except Exception:
            pass


def selftest(path):
    """Проверка собранного exe: все библиотеки и файлы пульта на месте."""
    rep, ok = [], True
    for mod in ('numpy', 'serial', 'serial.tools.list_ports', 'sounddevice', 'cryptography', 'pystray', 'PIL',
                'radio_backends', 'hamlib_backend', 'ptt_serial', 'rtlsdr_scope',
                'ft710_scope', 'ft4222_transport', 'scope_download'):
        try:
            __import__(mod)
            rep.append('OK   import ' + mod)
        except Exception as e:
            ok = False
            rep.append('FAIL import %s: %s' % (mod, e))
    try:
        rep.append('OK   audio devices: %d' % len(list_audio()))
    except Exception as e:
        ok = False
        rep.append('FAIL audio: %s' % e)
    for f in ('index.html', 'app.js', 'mem.js', 'sdfile.js', 'app.css', 'worklets.js', 'panel.html', 'panel.js', 'qrcode.js',
              'manifest.webmanifest', 'sw.js', 'icon-192.png'):
        p = os.path.join(web_dir(), f)
        good = os.path.isfile(p)
        ok &= good
        rep.append(('OK   ' if good else 'FAIL ') + 'web/' + f)
    try:                                     # цифровые виды: RTTY «сам на себя»
        import digi
        got = []
        d = digi.RttyDecoder(lambda e: got.append(e.get('text', '')) if e['t'] == 'rt_rx' else None)
        d.configure(enabled=True, baud=45.45, shift=170, fc=2210)
        x = digi.rtty_afsk('RYRY CQ TEST DE R6AAF K', fc=2210)
        for i in range(0, len(x), 960):
            d.process(x[i:i + 960])
        good = 'R6AAF' in ''.join(got)
        ok &= good
        rep.append(('OK   ' if good else 'FAIL ') + 'rtty loopback: ' + ''.join(got).strip()[:40])
    except Exception as e:
        ok = False
        rep.append('FAIL rtty: %s' % e)
    try:                                     # NAVTEX и PSK31 «сам на себя»
        import navtex
        import psk31
        got = []
        d = navtex.NavtexDecoder(lambda e: got.append(e.get('text', '')) if e['t'] == 'nx_rx' else None)
        d.configure(enabled=True)
        x = navtex.navtex_synth('ZCZC AE01\nTEST R6AAF\nNNNN\n')
        for i in range(0, len(x), 960):
            d.process(x[i:i + 960])
        good = 'R6AAF' in ''.join(got)
        got2 = []
        p = psk31.Psk31Decoder(lambda e: got2.append(e.get('text', '')) if e['t'] == 'psk_rx' else None)
        p.configure(enabled=True, fc=1000)
        x = psk31.psk31_tx('cq de R6AAF k', fc=1000, pre=48)
        for i in range(0, len(x), 960):
            p.process(x[i:i + 960])
        good &= 'R6AAF' in ''.join(got2)
        ok &= good
        rep.append(('OK   ' if good else 'FAIL ') + 'navtex+psk31 loopback')
    except Exception as e:
        ok = False
        rep.append('FAIL navtex/psk31: %s' % e)
    try:                                     # FT8 / FT4: синтез -> расшифровка
        import _ftx
        import ft8
        good = True
        for mode in ('FT8', 'FT4'):
            m = ft8.MODES[mode]
            x = np.zeros(int(SR * m['slot']), np.float32)
            y = ft8.gfsk(list(_ftx.encode('CQ R6AAF KN94', m['ft4'])), 1500, mode, amp=0.3)
            x[SR // 2:SR // 2 + len(y)] = y
            z = Decimator(4).process(x + np.random.randn(len(x)).astype(np.float32) * 0.05)
            res = _ftx.decode(z.astype(np.float32).tobytes(), m['ft4'])
            good &= any(r[3] == 'CQ R6AAF KN94' for r in res)
        ok &= good
        rep.append(('OK   ' if good else 'FAIL ') + 'ft8+ft4 loopback')
    except Exception as e:
        ok = False
        rep.append('FAIL ft8: %s' % e)
    try:                                     # справочник стран (если вшит при сборке)
        import dxcc
        cp = os.path.join(RES, 'cty.dat')
        if os.path.isfile(cp) and os.path.getsize(cp) > 3000:
            c = dxcc.Cty()
            c.load(cp)
            e = c.lookup('R6AAF')
            good = bool(e) and 'Russia' in e['name'] and c.count > 300
            rep.append(('OK   ' if good else 'FAIL ') + 'cty.dat: %d стран, %s' % (c.count, c.date))
            ok &= good
        else:
            rep.append('--   cty.dat не вшит (скачается при запуске)')
    except Exception as e:
        ok = False
        rep.append('FAIL cty.dat: %s' % e)
    good = os.path.isfile(os.path.join(RES, 'menu_ftx1.json'))
    ok &= good
    rep.append(('OK   ' if good else 'FAIL ') + 'menu_ftx1.json')
    rep.append('RESULT ' + ('OK' if ok else 'FAIL'))
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(rep) + '\n')
    sys.exit(0 if ok else 1)


def main():
    ap = argparse.ArgumentParser(description="Yaesu Web Pult — удалённое управление трансиверами Yaesu")
    ap.add_argument('--sim', action='store_true', help='симулятор трансивера')
    ap.add_argument('--list', action='store_true', help='показать COM-порты и звуковые устройства')
    ap.add_argument('--background', action='store_true', help='без окна (автозапуск)')
    ap.add_argument('--headless', action='store_true', help='без окна и значка (systemd, Raspberry Pi)')
    ap.add_argument('--console', action='store_true', help='журнал в консоль')
    ap.add_argument('-v', '--verbose', action='store_true')
    ap.add_argument('--selftest', metavar='FILE', help='проверить состав сборки и записать отчёт в FILE')
    args = ap.parse_args()
    if args.selftest:
        selftest(args.selftest)
        return

    root = logging.getLogger()
    root.setLevel(logging.DEBUG if args.verbose else logging.INFO)
    LOGBUF.setLevel(logging.INFO)
    root.addHandler(LOGBUF)
    try:
        fh = logging.handlers.RotatingFileHandler(os.path.join(BASE, 'ftx1-pult.log'), maxBytes=1_000_000,
                                                  backupCount=1, encoding='utf-8')
        fh.setFormatter(logging.Formatter('%(asctime)s %(name)s %(levelname)s: %(message)s'))
        root.addHandler(fh)
    except OSError:
        pass
    if sys.stdout is not None and (args.console or not IS_WIN or sys.stdout.isatty()):
        sh = logging.StreamHandler(sys.stdout)
        sh.setFormatter(logging.Formatter('%(asctime)s %(name)s: %(message)s', '%H:%M:%S'))
        root.addHandler(sh)

    if args.list:
        list_all()
        return
    cfg = load_cfg()
    if already_running(cfg['http_port']):
        # программа уже работает — просто показываем её окно
        if not args.background:
            open_window('http://localhost:%d/panel.html' % cfg['http_port'])
        return
    try:
        asyncio.run(amain(args))
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
