"""
Класс Station - центральная логика управления трансивером и клиентами.
Выделено из main.py для улучшения модульности.
"""
import asyncio
import json
import logging
import os
import struct
import time
from typing import Set, Optional

import numpy as np

from constants import (
    AUDIO_RATES, DECIMATION_FACTORS, PCM_INT16_MAX,
    PTT_ALIVE_TIMEOUT, PTT_WATCHDOG_INTERVAL,
    WS_BINARY_AUDIO_RX, WS_BINARY_WATERFALL, WS_BINARY_AUDIO_TX,
    LOOPBACK_ADDRESSES, MENU_FILENAME
)
from audio import SR, Decimator, Interpolator, Waterfall
from spectrum import SpectrumFrame, LatestSpectrum
from cat import Rig, SerialTransport, SerialPtt, CTCSS
from radio_backends import create_hamlib, is_hamlib

log = logging.getLogger("station")


class Client:
    """Клиент, подключенный к пульту через WebSocket."""
    
    def __init__(self, ws, local: bool):
        self.ws = ws
        self.local = local
        self.authed = False
        self.admin = False
        self.audio = False
        self.rate = 16000
        self.wf = False
        self.wf_max = 4000
        self.console = None
        self.name = f"{ws.peer[0]}:{ws.peer[1]}" if ws.peer else '?'
        self.cw_dec = False
        self.cw_auto = False
        self.interp: Optional[Interpolator] = None
        self.fails = 0


class Station:
    """Управление трансивером, аудио, клиентами и цифровыми режимами."""
    
    def __init__(self, cfg: dict, base_dir: str, res_dir: str, force_sim: bool = False):
        self.cfg = cfg
        self.base_dir = base_dir
        self.res_dir = res_dir
        self.force_sim = force_sim
        
        self.clients: Set[Client] = set()
        self.rig: Optional[Rig] = None
        self.audio = None
        self.running = False
        self.busy = False
        self.last_error = ''
        self.audio_err: Optional[str] = None
        
        # Аудио обработка
        self.decims = {rate: Decimator(factor) for rate, factor in DECIMATION_FACTORS.items()}
        self.wf = Waterfall()
        self.spectrum = LatestSpectrum()
        
        # PTT управление
        self.ptt_owner: Optional[Client] = None
        self.ptt_since = 0.0
        self.ptt_alive = 0.0
        
        # Асинхронность
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.quit_event: Optional[asyncio.Event] = None
        
        # Сеть
        self.https_ok = False
        self.ports_cache = []
        self.audio_cache = []
        
        # Меню трансивера
        menu_path = os.path.join(res_dir, MENU_FILENAME)
        with open(menu_path, encoding='utf-8') as f:
            self.menu = json.load(f)
        
        # Цифровые режимы и модули (инициализируются позже для избежания циклических импортов)
        self.cw = None
        self.digi = None
        self.vk = None
        self.rec = None
        self.ft = None
        self.mem = None
        self._log_listener = None
    
    def init_modules(self, version: str):
        """Инициализация модулей цифровых режимов."""
        from cwdesk import CwDesk
        from digidesk import DigiDesk
        from voicecq import VoiceCq
        from recorder import QsoRecorder
        from ft8 import Ft8Desk
        from memory import MemoryDesk
        
        self.cw = CwDesk(self)
        self.digi = DigiDesk(self, self.base_dir)
        self.vk = VoiceCq(self, self.base_dir)
        self.rec = QsoRecorder(self.base_dir)
        self.ft = Ft8Desk(self, self.base_dir, version, self.res_dir)
        self.mem = MemoryDesk(self, self.base_dir)
    
    def register_log_listener(self, callback):
        """Регистрация слушателя лога."""
        self._log_listener = callback
    
    def save_cfg(self, save_func):
        """Сохранение конфигурации."""
        try:
            save_func(self.cfg)
        except OSError as e:
            log.error("Не удалось сохранить настройки: %s", e)
    
    @property
    def sim(self) -> bool:
        """Режим симулятора активен?"""
        return self.force_sim or (
            self.cfg.get('radio_backend') != 'hamlib' and 
            bool(self.cfg.get('simulate'))
        )
    
    async def init(self):
        """Асинхронная инициализация."""
        self.loop = asyncio.get_running_loop()
        self.quit_event = asyncio.Event()
        asyncio.create_task(self._watchdog())
        asyncio.create_task(self._admin_loop())
    
    async def start_radio(self):
        """Запуск связи с трансивером."""
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
                    audio = SoundDeviceAudio(
                        cfg.get('audio_in_name', ''),
                        cfg.get('audio_out_name', ''),
                        cfg.get('audio_api', ''),
                        cfg.get('audio_in_index'),
                        cfg.get('audio_out_index')
                    )
                transport = None
                
            else:
                if not cfg.get('cat_port'):
                    raise RuntimeError("Не выбран COM-порт трансивера")
                
                from audio import SoundDeviceAudio
                transport = SerialTransport(cfg['cat_port'], int(cfg['cat_baud']))
                audio = SoundDeviceAudio(
                    cfg.get('audio_in_name', ''),
                    cfg.get('audio_out_name', ''),
                    cfg.get('audio_api', ''),
                    cfg.get('audio_in_index'),
                    cfg.get('audio_out_index')
                )
                
                if cfg['ptt_method'] in ('RTS', 'DTR') and cfg.get('ptt_port'):
                    serial_ptt = SerialPtt(cfg['ptt_port'], cfg['ptt_method'])
                
                log.info("Подключаюсь к трансиверу: %s, %s бод", cfg['cat_port'], cfg['cat_baud'])
            
            # Создание объекта Rig
            rig = (
                create_hamlib(cfg, self._on_rig_change) if transport is None else
                Rig(
                    transport,
                    self._on_rig_change,
                    'RTS' if cfg['ptt_method'] in ('RTS', 'DTR') else cfg['ptt_method'],
                    serial_ptt
                )
            )
            
            try:
                await rig.start()
            except Exception as e:
                if is_hamlib(rig):
                    raise RuntimeError(f'Hamlib: {e}') from e
                raise RuntimeError(
                    f"Порт {cfg['cat_port']} не открывается: {e}. "
                    "Возможно, он занят другой программой (WSJT-X, N1MM, Log4OM…) "
                    "или выбран не тот порт."
                )
            
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
        """Остановка связи с трансивером."""
        self.spectrum.clear()
        if not self.running:
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
        """Обработка аудио из потока."""
        try:
            self.loop.call_soon_threadsafe(self._on_rx_audio, x)
        except RuntimeError:
            pass
    
    def _on_rx_audio(self, x):
        """Обработка принятого аудио."""
        self.rec.feed_rx(x)
        
        # Раздача аудио клиентам
        need = {c.rate for c in self.clients if c.audio and c.authed}
        for rate in need:
            y = self.decims[rate].process(x)
            pkt = WS_BINARY_AUDIO_RX + (np.clip(y, -1, 1) * PCM_INT16_MAX).astype('<i2').tobytes()
            for c in self.clients:
                if c.audio and c.authed and c.rate == rate:
                    c.ws.send_bin(pkt)
        
        # Водопад
        rows = self.wf.process(x)
        if rows and self.running:
            self.spectrum.publish(SpectrumFrame(
                source='audio',
                domain='audio',
                first_hz=0,
                bin_hz=self.wf.bin_hz,
                levels=rows[-1].tobytes(),
                unit='dBFS',
                level_offset=-130,
                level_step=0.5,
                demo=bool(self.rig and self.rig.state.get('demo'))
            ))
        
        bw = self.wf.bandwidth
        if bw and abs(bw - getattr(self, '_bw_sent', 0)) > 300:
            self._bw_sent = bw
            self.broadcast({'t': 'bw', 'hz': bw})
        
        if rows and any(c.wf for c in self.clients):
            for row in rows:
                for c in self.clients:
                    if c.wf and c.authed:
                        n = min(len(row), int(c.wf_max / self.wf.bin_hz) + 1)
                        c.ws.send_bin(
                            WS_BINARY_WATERFALL + 
                            struct.pack('<Hf', n, self.wf.bin_hz) + 
                            row[:n].tobytes()
                        )
        
        # Цифровые режимы
        self.cw.feed(x)
        self.digi.feed(x)
        self.ft.feed(x)
    
    def _on_rig_change(self, diff):
        """Изменения состояния трансивера."""
        self.broadcast({'t': 'state', 's': diff})
        if 'connected' in diff or 'tx' in diff:
            self.push_status()
    
    def _broadcast_hello_state(self):
        """Отправка полного состояния при подключении."""
        if self.rig:
            self.broadcast({'t': 'state', 's': self.rig.state, 'full': True})
        self.broadcast({'t': 'audio_status', 'err': self.audio_err})
    
    def broadcast(self, obj: dict):
        """Рассылка сообщения всем авторизованным клиентам."""
        for c in self.clients:
            if c.authed:
                c.ws.send_json(obj)
    
    def _ptt_info(self):
        """Информация о владельце PTT."""
        for c in self.clients:
            if c.authed:
                c.ws.send_json({
                    't': 'ptt_owner',
                    'you': self.ptt_owner is c,
                    'busy': self.ptt_owner is not None,
                    'who': self.ptt_owner.name if self.ptt_owner else ''
                })
    
    def set_ptt(self, client: Optional[Client], on: bool):
        """Управление PTT."""
        if not self.rig:
            if on and client:
                client.ws.send_json({'t': 'note', 'msg': 'Сервер не подключён к трансиверу', 'msg_key': 'note.no_radio'})
            return
        
        if on:
            if is_hamlib(self.rig) and (not self.rig.state.get('connected') or not self.rig.caps.get('ptt')):
                client.ws.send_json({'t': 'note', 'msg': 'PTT недоступен: проверьте соединение и возможности модели', 'msg_key': 'note.ptt_unavail'})
                return
            
            if self.vk.task:
                self.vk.stop('нажата PTT', key='vk.note.stopped_ptt')
                self.vk.busy = False
            
            if self.digi.tx_busy or self.cw.sender.busy or self.ft.busy:
                client.ws.send_json({'t': 'note', 'msg': 'Идёт передача RTTY/CW/FT8 — дождитесь окончания', 'msg_key': 'note.tx_busy_digital'})
                return
            
            if self.ptt_owner not in (None, client):
                client.ws.send_json({'t': 'note', 'msg': f'Передача занята другим клиентом ({self.ptt_owner.name})', 'msg_key': 'note.tx_busy_other', 'msg_params': {'who': self.ptt_owner.name}})
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
        """Защита от залипшей передачи."""
        while True:
            await asyncio.sleep(PTT_WATCHDOG_INTERVAL)
            try:
                if self.ptt_owner:
                    now = time.monotonic()
                    if now - self.ptt_alive > PTT_ALIVE_TIMEOUT:
                        log.warning("PTT снят: нет подтверждений от клиента %s", self.ptt_owner.name)
                        self.ptt_owner.ws.send_json({'t': 'note', 'msg': 'Передача снята: потеря связи', 'msg_key': 'note.ptt_lost'})
                        self.set_ptt(None, False)
                    elif now - self.ptt_since > self.cfg['max_tx_seconds']:
                        log.warning("PTT снят: превышено время передачи")
                        self.ptt_owner.ws.send_json({
                            't': 'note',
                            'msg': f"Передача снята: превышено время ({self.cfg['max_tx_seconds']} с)",
                            'msg_key': 'note.ptt_timeout', 'msg_params': {'sec': int(self.cfg['max_tx_seconds'])}
                        })
                        self.set_ptt(None, False)
                
                await self.cw.tick()
                
                if self.audio:
                    lv = {
                        't': 'lv',
                        'rx': round(getattr(self.audio, 'rx_level', 0), 4),
                        'tx': round(self.audio.tx.level, 4)
                    }
                    self.broadcast(lv)
            except Exception as e:
                log.debug("watchdog: %s", e)
    
    def _send_admin(self, obj: dict):
        """Отправка админам."""
        for c in self.clients:
            if c.admin:
                c.ws.send_json(obj)
    
    def urls(self) -> list:
        """Доступные URL адреса."""
        from network_utils import local_ips
        u = [{'kind': 'local', 'url': f"http://localhost:{self.cfg['http_port']}"}]
        if self.https_ok:
            for ip in local_ips():
                u.append({'kind': 'lan', 'url': f"https://{ip}:{self.cfg['https_port']}"})
        return u
    
    def status(self) -> dict:
        """Текущий статус станции."""
        st = self.rig.state if self.rig else {}
        return {
            'running': self.running,
            'busy': self.busy,
            'sim': self.sim,
            'connected': bool(st.get('connected')),
            'tx': bool(st.get('tx')),
            'freq': st.get('freq_a'),
            'mode': st.get('mode'),
            'radio_id': st.get('radio_id'),
            'radio_name': st.get('radio_name'),
            'backend': st.get('backend'),
            'fw': st.get('fw0'),
            'head': st.get('pwr_head'),
            'audio_ok': self.running and not self.audio_err,
            'audio_err': self.audio_err,
            'audio_names': list(getattr(self.audio, 'names', ('', ''))) if self.audio else ['', ''],
            'audio_api_used': getattr(self.audio, 'api_used', '') if self.audio else '',
            'error': self.last_error or st.get('backend_error', ''),
            'clients': [
                {'name': c.name, 'local': c.local, 'audio': c.audio, 'tx': c is self.ptt_owner}
                for c in self.clients if c.authed and not c.admin
            ],
            'ptt_owner': self.ptt_owner.name if self.ptt_owner else '',
        }
    
    def rec_state(self) -> dict:
        """Состояние записи."""
        return {
            't': 'rec_state',
            'on': self.rec.on,
            'name': self.rec.name,
            'elapsed': self.rec.elapsed(),
            'files': self.rec.files(),
            'k': self.rec.token
        }
    
    def push_status(self):
        """Отправка статуса админам."""
        self._send_admin({'t': 'admin_status', 's': self.status()})
    
    async def _admin_loop(self):
        """Периодическая отправка статуса админам."""
        while True:
            await asyncio.sleep(1)
            if any(c.admin for c in self.clients):
                self.push_status()
    
    def _on_tx_audio(self, c: Client, pcm: bytes, rate: int):
        """Обработка аудио передачи от клиента."""
        if self.ptt_owner is not c or not self.audio:
            return
        
        x = np.frombuffer(pcm, '<i2').astype(np.float32) / (PCM_INT16_MAX + 1)
        if c.interp is None or c.interp.f != SR // rate:
            c.interp = Interpolator(SR // rate)
        self.audio.tx.push(c.interp.process(x))
    
    def is_local_connection(self, ws) -> bool:
        """Проверка локального подключения."""
        ip = ws.peer[0] if ws.peer else ''
        return (
            ip in LOOPBACK_ADDRESSES and 
            getattr(ws, 'local_ui', False) and 
            not os.environ.get('FTX_TEST_REMOTE')
        )
