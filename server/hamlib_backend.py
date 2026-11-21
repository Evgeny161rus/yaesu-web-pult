"""Managed, loopback-only rigctld backend. No shell and no shared serial owner.

Capabilities come from the installed rigctld, not a guessed Yaesu profile.
Only current-VFO controls are exposed; FTX-1 EX/memory/DSP commands are forbidden.
"""
import asyncio
import logging
import math
import os
import re
import socket
import subprocess
import sys
from pathlib import Path

log = logging.getLogger('hamlib')
MODE_TO_UI = {'CW': 'CW-U', 'CWR': 'CW-L', 'RTTY': 'RTTY-L', 'RTTYR': 'RTTY-U',
              'PKTUSB': 'DATA-U', 'PKTLSB': 'DATA-L', 'PKTFM': 'DATA-FM',
              'FM-D': 'DATA-FM', 'FMN': 'FM-N', 'AMN': 'AM-N', 'PKTFMN': 'DATA-FM-N'}
LEVELS = {'af': ('AF', 255), 'rf': ('RF', 255), 'sql': ('SQL', 255),
          'mic': ('MICGAIN', 100), 'power_pct': ('RFPOWER', 100)}


def executable_path(executable):
    if executable != 'rigctld': return executable
    root = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).resolve().parents[1]
    local = root / 'tools/hamlib/hamlib-w64-4.7.2/bin/rigctld.exe'
    return str(local) if local.is_file() else executable


def run_info(executable, *args):
    executable = executable_path(executable)
    try:
        result = subprocess.run([executable, *args], capture_output=True, timeout=12,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    except FileNotFoundError:
        hint = 'Установите Hamlib: sudo apt-get install -y libhamlib-utils' if os.name != 'nt' else 'Установите Hamlib или укажите путь к rigctld.exe'
        raise RuntimeError(f'rigctld не найден ({executable}). {hint}')
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-1200:])
    return result.stdout.decode(errors='replace')


def list_models(executable):
    models = []
    for line in run_info(executable, '-l').splitlines():
        cols = re.split(r'\s{2,}', line.strip())
        if len(cols) >= 5 and cols[0].isdigit() and (cols[1] == 'Yaesu' or cols[0] == '1'):
            models.append({'id': int(cols[0]), 'name': cols[2], 'status': cols[4]})
    if not models:
        raise RuntimeError('Hamlib не вернул список моделей')
    return models


def parse_caps(text):
    fields = {k.strip(): v.strip() for k, v in re.findall(r'^([^:\r\n]+):[^\S\r\n]*([^\r\n]*)', text, re.M)}
    modes = fields.get('Mode list', '').split()
    levels = set(re.findall(r'([A-Z_]+)\(', fields.get('Set level', '')))
    get_levels = set(re.findall(r'([A-Z_]+)\(', fields.get('Get level', '')))
    keys = [k for k, (level, _) in LEVELS.items() if level in levels and level in get_levels]
    if fields.get('Can set Frequency') == 'Y': keys.append('freq_a')
    if fields.get('Can set Mode') == 'Y': keys.append('mode')
    return {'keys': keys, 'modes': list(dict.fromkeys(MODE_TO_UI.get(m, m) for m in modes)),
            'mode_map': {MODE_TO_UI.get(m, m): m for m in modes},
            'ptt': fields.get('Can set PTT') == 'Y',
            'get_ptt': fields.get('Can get PTT') == 'Y',
            'get_mode': fields.get('Can get Mode') == 'Y',
            'get_freq': fields.get('Can get Frequency') == 'Y',
            'name': fields.get('Model name', 'Hamlib')}


class RigError(RuntimeError):
    def __init__(self, msg, code=None):
        super().__init__(msg)
        self.code = code


class HamlibRig:
    def __init__(self, cfg, on_change):
        self.cfg, self.on_change = dict(cfg), on_change
        self.state = {'connected': False, 'backend': 'hamlib', 'tx': False,
                      'freq_b': None, 'mode_b': None, 'vfo': 0}
        self.reader = self.writer = self.process = None
        self._task = self._stderr_task = None
        self._lock = asyncio.Lock()
        self._pending = {}
        self._wake = asyncio.Event()
        self._ptt_pending = None
        self._closed = False
        self.caps = {}
        self.errors = []
        self._level_index = 0

    def _set(self, values):
        self.state.update(values)
        self.on_change(values)

    async def request(self, command):
        if '\n' in command or '\r' in command:
            raise ValueError('Invalid rigctld command')
        async with self._lock:
            async with asyncio.timeout(2):
                self.writer.write(('+\\' + command + '\n').encode('ascii'))
                await self.writer.drain()
                values = {}
                for _ in range(128):
                    raw = await self.reader.readline()
                    if not raw:
                        raise ConnectionError('rigctld закрыл соединение')
                    line = raw.decode('ascii', 'replace').strip()
                    if line.startswith('RPRT '):
                        code = int(line.split()[1])
                        if code:
                            raise RigError(f'{command.split()[0]}: Hamlib error {code}', code=code)
                        return values
                    if ': ' in line:
                        key, val = line.split(': ', 1)
                        values[key] = val
                    elif line:
                        values['_value'] = line
                raise ConnectionError('Слишком длинный ответ rigctld')

    async def _drain_errors(self):
        while line := await self.process.stderr.readline():
            self.errors.append(line.decode(errors='replace').strip())
            self.errors = self.errors[-15:]

    async def start(self):
        executable = executable_path(self.cfg.get('hamlib_path') or 'rigctld')
        model = int(self.cfg.get('hamlib_model', 1))
        models = await asyncio.to_thread(list_models, executable)
        if model not in {m['id'] for m in models}:
            raise ValueError('Выбранной модели нет в установленном Hamlib')
        self.caps = parse_caps(await asyncio.to_thread(run_info, executable, '-m', str(model), '-u'))
        if not self.caps['get_freq']:
            raise ValueError('Драйвер не поддерживает чтение частоты')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        args = [executable, '-m', str(model), '-T', '127.0.0.1', '-t', str(port)]
        if model != 1:
            if not self.cfg.get('cat_port'): raise ValueError('Выберите CAT-порт')
            args += ['-r', self.cfg['cat_port'], '-s', str(int(self.cfg['cat_baud']))]
        if self.caps['ptt']: args += ['-P', 'RIG']
        try:
            try:
                self.process = await asyncio.create_subprocess_exec(
                    *args, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            except FileNotFoundError:
                hint = 'Установите Hamlib: sudo apt-get install -y libhamlib-utils' if os.name != 'nt' else 'Установите Hamlib или укажите путь к rigctld.exe'
                raise RuntimeError(f'rigctld не найден ({executable}). {hint}')
            self._stderr_task = asyncio.create_task(self._drain_errors())
            for _ in range(60):
                if self.process.returncode is not None:
                    raise RuntimeError('rigctld: ' + '\n'.join(self.errors[-5:]))
                try:
                    self.reader, self.writer = await asyncio.open_connection('127.0.0.1', port)
                    break
                except OSError:
                    await asyncio.sleep(.1)
            else: raise TimeoutError('rigctld не запустился за 6 секунд')
            if self.caps['ptt']:
                try:
                    await self.request('set_ptt 0')
                except RigError as e:
                    if e.code in (-11, -4, -9):
                        log.warning("PTT недоступен при старте Hamlib: %s", e)
                        self.caps['ptt'] = False
                        self.caps['get_ptt'] = False
                    else:
                        raise
            await self._poll()
            self._set({'connected': True, 'radio_name': self.caps['name'], 'radio_caps': self.caps,
                       'backend': 'hamlib', 'backend_error': ''})
            self._task = asyncio.create_task(self._worker())
        except BaseException:
            await self.aclose()
            raise

    async def _poll(self):
        values = await self.request('get_freq')
        self._set({'freq_a': int(float(values['Frequency']))})
        if self.caps.get('get_mode'):
            values = await self.request('get_mode')
            self._set({'mode': MODE_TO_UI.get(values['Mode'], values['Mode']),
                       'bandwidth_hz': int(values['Passband'])})
        if self.caps.get('get_ptt'):
            try:
                values = await self.request('get_ptt')
                self._set({'tx': int(values['PTT']) != 0})
            except RigError as e:
                log.warning("get_ptt недоступен: %s", e)
                self.caps['get_ptt'] = False
                self._set({'radio_caps': dict(self.caps)})
        levels = [k for k in self.caps.get('keys', []) if k in LEVELS]
        if levels:
            key = levels[self._level_index % len(levels)]
            self._level_index += 1
            level, scale = LEVELS[key]
            try:
                values = await self.request('get_level ' + level)
                self._set({key: float(values.get(level, values.get('_value'))) * scale})
            except RigError:
                # A compiled capability can still be unsupported by a firmware.
                self.caps['keys'].remove(key)
                self._set({'radio_caps': dict(self.caps)})

    def set_param(self, key, value):
        if key not in self.caps.get('keys', []):
            raise ValueError('Этот регулятор недоступен через Hamlib')
        if key == 'mode':
            mode = self.caps['mode_map'].get(value)
            if not mode: raise ValueError('Вид работы не поддерживается')
            command = f'set_mode {mode} 0'
        else:
            value = float(value)
            if not math.isfinite(value): raise ValueError('Некорректное число')
            if key == 'freq_a':
                if not 0 < value <= 100_000_000_000: raise ValueError('Некорректная частота')
                command = f'set_freq {round(value)}'
            else:
                level, scale = LEVELS[key]
                if not 0 <= value <= scale: raise ValueError('Значение вне диапазона')
                command = f'set_level {level} {value / scale:.6f}'
        if not self.state.get('connected'): raise ValueError('Нет связи с трансивером')
        self._pending[key] = command  # coalesce fast dial/slider changes
        self._wake.set()

    def ptt(self, on):
        if on and not self.state.get('connected'): raise ValueError('Нет связи с трансивером')
        if not self.caps.get('ptt'):
            if on: raise ValueError('PTT недоступен в этом драйвере')
            return
        self._ptt_pending = bool(on)
        self._wake.set()

    def refresh(self, delay=0):
        self._wake.set()

    async def _worker(self):
        try:
            while not self._closed:
                self._wake.clear()
                if self._ptt_pending is not None:
                    on, self._ptt_pending = self._ptt_pending, None
                    try:
                        await self.request('set_ptt ' + str(int(on)))
                        self._set({'tx': on, 'backend_error': ''})
                    except RigError as e:
                        if e.code in (-11, -4, -9):
                            self.caps['ptt'] = False
                            self.caps['get_ptt'] = False
                            self._set({'radio_caps': dict(self.caps), 'tx': False,
                                       'backend_error': f'PTT недоступен через Hamlib ({e})'})
                        else:
                            self._set({'tx': False, 'backend_error': str(e)})
                if self._pending:
                    key = next(iter(self._pending))
                    command = self._pending.pop(key)
                    try:
                        await self.request(command)
                        self._set({'backend_error': ''})
                        if key in LEVELS:
                            level, scale = LEVELS[key]
                            val = await self.request('get_level ' + level)
                            self._set({key: float(val.get(level, val.get('_value'))) * scale})
                    except RigError as e:
                        self._set({'backend_error': str(e)})
                if not self._pending and self._ptt_pending is None:
                    await self._poll()
                    try: await asyncio.wait_for(self._wake.wait(), .3)
                    except TimeoutError: pass
        except asyncio.CancelledError:
            raise
        except Exception as e:
            self._pending.clear()
            self._ptt_pending = None
            self._set({'connected': False, 'backend_error': str(e) + ' — остановите и запустите соединение заново'})
            # On a desynchronised socket never reuse pending replies or replay
            # queued TX on reconnect. A physical cable loss cannot guarantee TX-off.
            await self._emergency_off()

    async def _emergency_off(self):
        if self.writer and self.caps.get('ptt'):
            try:
                self.writer.write(b'\\set_ptt 0\n')
                await asyncio.wait_for(self.writer.drain(), .5)
            except Exception: pass

    async def aclose(self):
        self._closed = True
        if self._task:
            self._pending.clear()
            self._ptt_pending = None
            self._wake.set()
            try:
                await asyncio.wait_for(asyncio.shield(self._task), 3)
            except (TimeoutError, asyncio.CancelledError):
                self._task.cancel()
                await asyncio.gather(self._task, return_exceptions=True)
        if self.writer:
            try:
                if self.caps.get('ptt'): await self.request('set_ptt 0')
            except Exception: await self._emergency_off()
            self.writer.close()
            try: await self.writer.wait_closed()
            except Exception: pass
        if self.process and self.process.returncode is None:
            self.process.terminate()
            try: await asyncio.wait_for(self.process.wait(), 3)
            except TimeoutError:
                self.process.kill()
                await self.process.wait()
        if self._stderr_task: await asyncio.gather(self._stderr_task, return_exceptions=True)
        self._set({'connected': False})
