"""Receive-only DX spot feeds.

Telnet DXSpider/AR-Cluster and the public SpotRadio JSON feed. No spot posting
or arbitrary cluster commands.
"""
import asyncio
import collections
import contextlib
import gzip
import json
import logging
import math
import re
import time
import urllib.request
from datetime import datetime, timezone, timedelta

from dxcc import band_of

log = logging.getLogger(__name__)

SPOT = re.compile(r'^DX de ([A-Z0-9/\-#]+):\s+(\d+(?:\.\d+)?)\s+([A-Z0-9/]+)\s+(.*?)\s+(\d{4})Z(?:\s+.*)?$', re.I)
ANSI = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')

SPOTRADIO_URL = 'https://spotradio.ru/cluster/spots.php?limit=200'
SPOTRADIO_POLL = 20.0        # seconds between polls; the feed is public
SPOTRADIO_TIMEOUT = 15
SPOTRADIO_MAX_BYTES = 4_000_000
SPOTRADIO_MAX_ITEMS = 1000   # safety cap for a malformed/hostile response
KNOWN_MODES = {'CW', 'SSB', 'USB', 'LSB', 'FT8', 'FT4', 'RTTY', 'FM', 'AM', 'PSK31'}


def parse_spot(line, now=None):
    line = ANSI.sub('', line)
    match = SPOT.match(line.strip())
    if not match:
        return None
    reporter, khz, call, comment, utc = match.groups()
    # Validate before rounding: a long but syntactically valid number can
    # convert to infinity and must not terminate the receive task.
    hz = float(khz) * 1000
    if not math.isfinite(hz) or not 10000 <= hz <= 100_000_000_000:
        return None
    freq = round(hz)
    if not 10000 <= freq <= 100_000_000_000 or not any(c.isdigit() for c in call):
        return None
    now = time.time() if now is None else now
    try:
        stamp = datetime.fromtimestamp(now, timezone.utc).replace(
            hour=int(utc[:2]), minute=int(utc[2:]), second=0, microsecond=0)
    except ValueError:
        return None
    if stamp.timestamp() > now + 300:
        stamp -= timedelta(days=1)
    comment = ''.join(c for c in comment if c.isprintable())[:160]
    mode = re.search(r'\b(FT8|FT4|CW|RTTY|SSB|USB|LSB|FM|AM|PSK31)\b', comment, re.I)
    return {'call': call.upper()[:24], 'freq': freq, 'reporter': reporter.upper()[:24],
            'comment': comment, 'time': stamp.timestamp(), 'received': now,
            'band': band_of(freq), 'mode': mode.group(1).upper() if mode else '',
            'id': f'{call.upper()}:{freq}'}


def parse_spotradio_spot(item, now=None):
    """Convert one SpotRadio JSON record into the internal spot format."""
    if not isinstance(item, dict):
        return None
    now = time.time() if now is None else now
    call = str(item.get('spotted') or '').strip().upper()
    reporter = str(item.get('spotter') or '').strip().upper()
    if (not re.fullmatch(r'[A-Z0-9/\-]{3,24}', call) or not any(c.isdigit() for c in call)
            or not re.fullmatch(r'[A-Z0-9/\-]{3,24}', reporter)):
        return None
    raw_freq = item.get('frequency')
    if raw_freq in (None, ''):
        raw_freq = item.get('freq_khz')
        try:
            raw_freq = float(raw_freq) * 1000
        except (TypeError, ValueError):
            return None
    try:
        hz = float(raw_freq)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(hz) or not 10000 <= hz <= 100_000_000_000:
        return None
    freq = round(hz)
    if not 10000 <= freq <= 100_000_000_000:
        return None
    try:
        stamp = float(item.get('ts'))
    except (TypeError, ValueError):
        stamp = 0.0
    if not math.isfinite(stamp) or stamp <= 0 or stamp > now + 300:
        when = str(item.get('when') or '').strip()
        try:
            stamp = datetime.strptime(when, '%Y-%m-%d %H:%M:%S').replace(
                tzinfo=timezone.utc).timestamp()
        except ValueError:
            return None
    comment = re.sub(r'<[^>]{1,12}>', ' ', str(item.get('message') or ''))
    comment = ' '.join(''.join(c for c in comment if c.isprintable()).split())[:160]
    mode = str(item.get('mode') or '').strip().upper()
    if mode not in KNOWN_MODES:
        found = re.search(r'\b(FT8|FT4|CW|RTTY|SSB|USB|LSB|FM|AM|PSK31)\b', comment, re.I)
        mode = found.group(1).upper() if found else ''
    return {'call': call, 'freq': freq, 'reporter': reporter,
            'comment': comment, 'time': stamp, 'received': now,
            'band': band_of(freq), 'mode': mode, 'id': f'{call}:{freq}'}


def validate_config(data):
    if not isinstance(data, dict):
        raise ValueError('Неверные настройки кластера')
    provider = str(data.get('provider') or 'telnet').strip().lower()
    if provider == 'spotradio':
        return {'provider': 'spotradio'}
    if provider != 'telnet':
        raise ValueError('Неизвестный источник DX-спотов')
    host = str(data.get('host', '')).strip()
    call = str(data.get('call', '')).strip().upper()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.\-]{0,252}', host):
        raise ValueError('Укажите имя сервера без http:// и пути')
    if (not re.fullmatch(r'[A-Z0-9/]{3,20}(?:-\d{1,2})?', call)
            or not any(c.isdigit() for c in call) or not any(c.isalpha() for c in call)):
        raise ValueError('Укажите ваш позывной для входа в кластер')
    try:
        port = int(data.get('port', 7300))
    except (ValueError, TypeError):
        raise ValueError('Порт должен быть числом от 1 до 65535') from None
    if not 1 <= port <= 65535:
        raise ValueError('Порт должен быть числом от 1 до 65535')
    return {'provider': 'telnet', 'host': host, 'port': port, 'call': call}


def _http_json(url):
    """Fetch a public JSON feed with a size limit and an honest User-Agent."""
    request = urllib.request.Request(url, headers={
        'User-Agent': 'Yaesu-Web-Pult/3.2 (+https://github.com/Evgeny161rus/yaesu-web-pult)',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
    })
    with urllib.request.urlopen(request, timeout=SPOTRADIO_TIMEOUT) as response:
        raw = response.read(SPOTRADIO_MAX_BYTES)
        if response.headers.get('Content-Encoding', '').lower() == 'gzip':
            raw = gzip.decompress(raw)
    return json.loads(raw.decode('utf-8', errors='replace'))


class TelnetText:
    """Incremental Telnet decoder; refuse options, discard subnegotiation."""
    def __init__(self):
        self.state = 'text'
        self.command = 0

    def feed(self, data):
        text, replies = bytearray(), bytearray()
        for value in data:
            if self.state == 'text':
                if value == 255:
                    self.state = 'iac'
                else:
                    text.append(value)
            elif self.state == 'iac':
                if value in (251, 252, 253, 254):
                    self.command, self.state = value, 'option'
                elif value == 250:
                    self.state = 'sub'
                else:
                    if value == 255:
                        text.append(value)
                    self.state = 'text'
            elif self.state == 'option':
                if self.command in (251, 253):
                    replies.extend((255, 254 if self.command == 251 else 252, value))
                self.state = 'text'
            elif self.state == 'sub':
                if value == 255:
                    self.state = 'sub_iac'
            elif self.state == 'sub_iac':
                self.state = 'text' if value == 240 else 'sub'
        return bytes(text), bytes(replies)


class DxCluster:
    MAX_SPOTS = 500
    MAX_AGE = 3600
    PUBLISH_DELAY = 0.5

    def __init__(self, station):
        self.station = station
        self.spots = collections.OrderedDict()
        self.dirty = set()
        self.removed = set()
        self.status_dirty = False
        self.task = None
        self.writer = None
        self.timer = None
        self.control_lock = asyncio.Lock()
        self.state, self.reason = 'off', ''
        self.config = dict(station.cfg.get('dx_cluster') or {})
        self._seen = {}   # SpotRadio dedupe: spot key -> spot timestamp

    def _prune(self):
        cutoff = time.time() - self.MAX_AGE
        for key, spot in list(self.spots.items()):
            if spot['time'] < cutoff:
                del self.spots[key]
                self.removed.add(key)

    def _decorate(self, spot):
        tags, entity = self.station.ft.wk.status(spot['call'], spot['band'])
        return dict(spot, country=entity['name'] if entity else '', tags=tags)

    def snapshot(self):
        self._prune()
        spots = [self._decorate(s) for s in reversed(self.spots.values())]
        return {'t': 'dx_state', 'state': self.state, 'reason': self.reason,
                'config': self.config, 'spots': spots, 'total': len(spots),
                'log_qso': self.station.ft.wk.n}

    def publish(self, full=False):
        if self.timer:
            self.timer.cancel()
        self.timer = None
        self._prune()
        if full:
            message = self.snapshot()
            self.dirty.clear()
            self.removed.clear()
            self.status_dirty = False
            self.station.broadcast(message)
            return
        spots = [self._decorate(self.spots[key]) for key in list(self.dirty) if key in self.spots]
        removed = [key for key in self.removed if key not in self.spots]
        self.dirty.clear()
        self.removed.clear()
        if not spots and not removed and not self.status_dirty:
            return
        self.status_dirty = False
        # Только изменения: полный список (до 500 спотов) присылается при
        # подключении, дальше — новые/обновлённые и удалённые записи. Это
        # важно для удалённого доступа через VPS: полный список каждые 0.5 с
        # давал бы сотни килобайт трафика.
        self.station.broadcast({'t': 'dx_spots', 'state': self.state, 'reason': self.reason,
                                'spots': spots, 'removed': removed,
                                'total': len(self.spots), 'log_qso': self.station.ft.wk.n})

    def status(self, state, reason='', full=False):
        self.state, self.reason = state, reason
        self.status_dirty = True
        self.publish(full=full)

    def ingest(self, line):
        spot = parse_spot(line)
        return bool(spot) and self._store(spot)

    def ingest_json(self, payload, now=None):
        """Ingest a SpotRadio snapshot without counting polled repeats again."""
        if not isinstance(payload, list):
            return 0
        now = time.time() if now is None else now
        cutoff = now - self.MAX_AGE
        for key, stamp in list(self._seen.items()):
            if stamp < cutoff:
                del self._seen[key]
        fresh = []
        for item in payload[:SPOTRADIO_MAX_ITEMS]:
            spot = parse_spotradio_spot(item, now)
            if spot is None:
                continue
            key = (spot['reporter'], spot['call'], spot['freq'], spot['time'])
            if key in self._seen:
                continue
            self._seen[key] = spot['time']
            fresh.append(spot)
        fresh.sort(key=lambda s: s['time'])
        stored = 0
        for spot in fresh:
            if self._store(spot):
                stored += 1
        return stored

    def _store(self, spot):
        if spot['time'] < time.time() - self.MAX_AGE:
            return False
        previous = self.spots.pop(spot['id'], None)
        spot['count'] = (previous['count'] if previous else 0) + 1
        self.spots[spot['id']] = spot
        self.dirty.add(spot['id'])
        self.removed.discard(spot['id'])
        while len(self.spots) > self.MAX_SPOTS:
            key, _ = self.spots.popitem(last=False)
            self.dirty.discard(key)
            self.removed.add(key)
        if self.timer is None:
            self.timer = asyncio.get_running_loop().call_later(self.PUBLISH_DELAY, self.publish)
        return True

    async def stop(self):
        task, self.task = self.task, None
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        if self.timer:
            self.timer.cancel()
            self.timer = None
        self.status('off')

    async def start(self, data):
        config = validate_config(data)
        await self.stop()
        self.config = config
        self.spots.clear()
        self.dirty.clear()
        self.removed.clear()
        self._seen.clear()
        self.station.cfg['dx_cluster'] = config
        self.station.save_cfg()
        self.status('connecting', full=True)
        self.task = asyncio.create_task(self.run())

    async def run(self):
        if self.config.get('provider') == 'spotradio':
            await self._run_spotradio()
            return
        delay = 5
        while True:
            try:
                self.status('connecting')
                reader, self.writer = await asyncio.wait_for(
                    asyncio.open_connection(self.config['host'], self.config['port']), 15)
                self.status('login')
                await self.receive(reader, self.writer)
            except (OSError, asyncio.TimeoutError, ValueError) as exc:
                self.status('retry', str(exc)[:180] or 'Соединение закрыто; повторное подключение')
            finally:
                writer, self.writer = self.writer, None
                if writer:
                    writer.close()
                    with contextlib.suppress(OSError, asyncio.TimeoutError):
                        await asyncio.wait_for(writer.wait_closed(), 2)
            await asyncio.sleep(delay)
            delay = min(60, delay * 2)

    async def _run_spotradio(self):
        """Poll the public SpotRadio JSON feed; no telnet login is involved."""
        delay, live = 5.0, False
        while True:
            try:
                payload = await asyncio.to_thread(_http_json, SPOTRADIO_URL)
                stored = self.ingest_json(payload)
                self.publish()
                if not live:
                    live = True
                    log.info('SpotRadio: подключено, спотов в ответе %s, новых %s',
                             len(payload) if isinstance(payload, list) else 0, stored)
                if self.state != 'live':
                    self.status('live')
                delay = 5.0
                await asyncio.sleep(SPOTRADIO_POLL)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                live = False
                reason = str(exc).splitlines()[0][:160] or 'нет соединения'
                self.status('retry', f'SpotRadio: {reason}')
                await asyncio.sleep(delay)
                delay = min(60.0, delay * 2)

    async def receive(self, reader, writer):
        decoder, buffer, logged_in = TelnetText(), '', False
        deadline = asyncio.get_running_loop().time() + 30
        while True:
            timeout = 180 if logged_in else max(.01, deadline - asyncio.get_running_loop().time())
            data = await asyncio.wait_for(reader.read(4096), timeout)
            if not data:
                raise OSError('Кластер закрыл соединение')
            clean, reply = decoder.feed(data)
            if reply:
                writer.write(reply)
                await writer.drain()
            buffer += clean.decode('utf-8', errors='replace').replace('\r', '')
            prompt = re.search(r'(?:login|call(?:sign)?|call sign)\s*[:>]', buffer, re.I)
            if not logged_in and prompt:
                writer.write((self.config['call'] + '\r\n').encode('ascii'))
                await writer.drain()
                logged_in = True
                buffer = buffer[prompt.end():].lstrip()
                self.status('waiting')
            if len(buffer) > 16384:
                raise ValueError('Слишком длинная строка от кластера')
            while '\n' in buffer:
                line, buffer = buffer.split('\n', 1)
                if self.ingest(line):
                    if self.state != 'live':
                        self.status('live')

    async def on_msg(self, client, message):
        action = message['t']
        if action == 'dx_hello':
            client.ws.send_json(self.snapshot())
        elif action == 'dx_connect':
            try:
                async with self.control_lock:
                    await self.start(message.get('config') or {})
            except ValueError as exc:
                client.ws.send_json({'t': 'dx_error', 'msg': str(exc)})
        elif action == 'dx_disconnect':
            async with self.control_lock:
                await self.stop()
        elif action == 'dx_tune':
            spot = next((s for s in self.snapshot()['spots'] if s['id'] == message.get('id')), None)
            rig = self.station.rig
            state = getattr(rig, 'state', {})
            if not spot or not state.get('connected'):
                client.ws.send_json({'t': 'dx_error', 'msg': 'Спот устарел или трансивер не подключён'})
                return
            if state.get('tx') or self.station.ptt_owner:
                client.ws.send_json({'t': 'dx_error', 'msg': 'Перестройка по споту недоступна во время передачи'})
                return
            if state.get('backend') != 'hamlib' and not 30000 <= spot['freq'] <= 470000000:
                client.ws.send_json({'t': 'dx_error', 'msg': 'Частота спота вне диапазона штатного драйвера'})
                return
            # Only the active RX VFO. Never infer mode, split, or key PTT.
            key = 'freq_b' if state.get('vfo') else 'freq_a'
            try:
                rig.set_param(key, spot['freq'])
            except (ValueError, OSError) as exc:
                client.ws.send_json({'t': 'dx_error', 'msg': str(exc)})
