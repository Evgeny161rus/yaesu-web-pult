#!/usr/bin/env python3
"""Interactive terminal configuration for Yaesu Web Pult (headless/SSH friendly).

Run on the machine connected to the transceiver, for example over SSH:
    python3 server/configure.py
or from an installed location:
    /opt/yaesu-web-pult/.venv/bin/python /opt/yaesu-web-pult/server/configure.py

It edits config.json used by server/main.py, can auto-detect ports/audio,
and can probe the transceiver (CAT ID) to identify model/capabilities.
No GUI required.
"""
import json
import os
import sys

# Paths: same layout logic as server/main.py
if getattr(sys, 'frozen', False):
    BASE = os.path.dirname(os.path.abspath(sys.argv[0]))
    RES = getattr(sys, '_MEIPASS', BASE)
else:
    RES = os.path.dirname(os.path.abspath(__file__))
    BASE = os.path.dirname(RES)
sys.path.insert(0, RES)

# Minimal defaults needed if main can't be imported in some environments
FALLBACK_DEFAULTS = {
    "radio_backend": "native", "hamlib_path": "rigctld", "hamlib_model": 1049,
    "cat_port": "", "cat_baud": 38400, "ptt_method": "TX1", "ptt_port": "",
    "ptt_line": "RTS", "audio_in_name": "", "audio_out_name": "", "audio_api": "",
    "audio_in_index": None, "audio_out_index": None, "https_port": 8443,
    "http_port": 8080, "http_lan": False, "password": "", "max_tx_seconds": 180,
    "auto_connect": True, "open_panel": True, "open_pult": False,
    "waterfall_source": "auto", "scope_libft4222": "", "scope_d2xx": "",
    "scope_serial": "", "scope_auto_download": True, "simulate": False,
    "cw_method": "cat", "cw_port": "", "cw_auto_delay": 6, "cw_auto_max": 4,
}

SCOPE_IDS = {'0800', '0761', '0681', '0682'}  # FT-710, FTDX10, FTDX101D/MP
BAUDS = [4800, 9600, 19200, 38400, 115200]
PTT_METHODS = [
    ("TX1", "CAT TX1 (рекомендуется)"),
    ("TX2", "CAT TX2"),
    ("RTS", "Линия RTS отдельного порта"),
    ("DTR", "Линия DTR отдельного порта"),
]
CW_METHODS = [("cat", "Команда CAT"), ("dtr", "Линия DTR"), ("rts", "Линия RTS")]
WF_SOURCES = [
    ("auto", "Авто: USB-scope/RTL-SDR если доступен, иначе звук"),
    ("audio", "Только звук"),
    ("scope", "Только USB-scope (ошибка в лог, если недоступен)"),
    ("rtlsdr", "RTL-SDR (внешний USB SDR приёмник)"),
]


def cfg_path():
    return os.path.join(BASE, 'config.json')


def load_cfg():
    try:
        from main import load_cfg as _load, DEFAULT_CFG
        return _load(), DEFAULT_CFG
    except Exception:
        cfg = dict(FALLBACK_DEFAULTS)
        defaults = dict(FALLBACK_DEFAULTS)
        p = cfg_path()
        if os.path.exists(p):
            try:
                with open(p, encoding='utf-8-sig') as f:
                    cfg.update(json.load(f))
            except Exception as e:
                print(f"Предупреждение: не удалось прочитать {p}: {e}")
        return cfg, defaults


def save_cfg(cfg):
    try:
        from main import save_cfg as _save
        _save(cfg)
        return
    except Exception:
        pass
    p = cfg_path()
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    os.replace(tmp, p)


def list_ports():
    try:
        from main import list_ports as _lp
        return _lp()
    except Exception:
        try:
            from serial.tools import list_ports as lp
            return [{'device': p.device, 'desc': p.description or '', 'kind': ''} for p in lp.comports()]
        except Exception as e:
            print(f"Не удалось получить список портов: {e}")
            return []


def list_audio():
    try:
        from main import list_audio as _la
        return _la(True)
    except Exception as e:
        print(f"Не удалось получить список аудиоустройств: {e}")
        return []


def detect(ports, audio):
    try:
        from main import detect as _d
        return _d(ports, audio)
    except Exception:
        return {}


def probe_radio(port, baud):
    try:
        from yaesu_detect import probe
        return probe(port, baud), None
    except Exception as e:
        return None, str(e)


def clear():
    os.system('cls' if os.name == 'nt' else 'clear')


def pause(msg="\nEnter — продолжить…"):
    try:
        input(msg)
    except EOFError:
        pass


def prompt(text, default=None, allow_empty=False):
    sfx = f" [{default}]" if default not in (None, '') else ""
    try:
        v = input(f"{text}{sfx}: ").strip()
    except EOFError:
        return default if default is not None else ''
    if v == '' and default is not None:
        return default
    if v == '' and not allow_empty and default is None:
        return ''
    return v


def choose(title, options, current=None):
    """options: list of (value, label). Returns value or None if cancelled."""
    print(f"\n{title}")
    for i, (val, label) in enumerate(options, 1):
        mark = " *" if current is not None and str(val) == str(current) else ""
        print(f"  {i}. {label}{mark}")
    print("  0. Назад/без изменений")
    try:
        s = input("Выбор: ").strip()
    except EOFError:
        return None
    if not s or s == '0':
        return None
    try:
        i = int(s)
        if 1 <= i <= len(options):
            return options[i - 1][0]
    except ValueError:
        pass
    print("Неверный выбор.")
    return None


def choose_port(ports, title, current):
    opts = [("", "(не выбран)")]
    for p in ports:
        desc = p.get('desc') or ''
        kind = p.get('kind') or ''
        star = '★ ' if kind == 'enhanced' else '• ' if kind == 'standard' else '  '
        label = f"{star}{p['device']}" + (f" — {desc}" if desc else "")
        opts.append((p['device'], label))
    return choose(title, opts, current)


def choose_audio(audio, title, current):
    # Show unique "core" names that have input or output (prefer both)
    seen = {}
    for d in audio:
        name = d.get('name', '')
        if not name:
            continue
        core = name
        # try to extract core name in parentheses
        if '(' in name and name.endswith(')'):
            core = name[name.rfind('(') + 1:-1].strip() or name
        key = core.lower()
        e = seen.setdefault(key, {'name': core, 'full': name, 'in': False, 'out': False})
        e['in'] = e['in'] or (d.get('in', 0) > 0)
        e['out'] = e['out'] or (d.get('out', 0) > 0)
    devs = [v for v in seen.values() if v['in'] or v['out']]
    # prefer devices with both in/out
    devs.sort(key=lambda x: (not (x['in'] and x['out']), x['name'].lower()))
    opts = [("", "(автоопределение USB Audio CODEC)")]
    for d in devs:
        io = []
        if d['in']:
            io.append('вход')
        if d['out']:
            io.append('выход')
        label = f"{d['name']} ({', '.join(io)})"
        opts.append((d['name'], label))
    return choose(title, opts, current)


def show_status(cfg):
    print("\nТекущие настройки (config.json):")
    print(f"  CAT порт:        {cfg.get('cat_port') or '(не выбран)'}")
    print(f"  CAT скорость:    {cfg.get('cat_baud')}")
    print(f"  PTT метод:       {cfg.get('ptt_method')}" + (f"  порт: {cfg.get('ptt_port')}" if cfg.get('ptt_method') in ('RTS','DTR') else ""))
    print(f"  CW метод:        {cfg.get('cw_method')}" + (f"  порт: {cfg.get('cw_port')}" if cfg.get('cw_method') in ('rts','dtr','RTS','DTR') else ""))
    print(f"  Аудио:           {cfg.get('audio_in_name') or '(авто)'}")
    print(f"  Автоподключение: {'да' if cfg.get('auto_connect') else 'нет'}")
    print(f"  Симулятор:       {'да' if cfg.get('simulate') else 'нет'}")
    print(f"  Пароль (LAN):    {'задан' if cfg.get('password') else '(нет — вход по сети невозможен)'}")
    print(f"  HTTP/HTTPS:      {cfg.get('http_port')} / {cfg.get('https_port')}")
    print(f"  Водопад:         {cfg.get('waterfall_source')}  scope_lib={cfg.get('scope_libft4222') or '(авто/нет)'}  auto_dl={'да' if cfg.get('scope_auto_download') else 'нет'}")


def auto_detect_menu(cfg):
    ports = list_ports()
    audio = list_audio()
    d = detect(ports, audio)
    print("\nАвтоопределение:")
    if not ports:
        print("  COM/tty порты не найдены.")
    else:
        for p in ports:
            print(f"  Порт: {p['device']} — {p.get('desc','')}{' ['+p['kind']+']' if p.get('kind') else ''}")
    if d.get('cat_port'):
        print(f"  → Предложен CAT: {d['cat_port']}")
    if d.get('ptt_port'):
        print(f"  → Предложен PTT: {d['ptt_port']}")
    if d.get('audio_in_name'):
        print(f"  → Предложено аудио: {d['audio_in_name']}")
    if not d:
        print("  Ничего подходящего не определено автоматически.")
    ans = prompt("Применить предложенные значения? (y/n)", "y")
    if str(ans).lower().startswith('y'):
        if d.get('cat_port'):
            cfg['cat_port'] = d['cat_port']
        if d.get('ptt_port'):
            cfg['ptt_port'] = d['ptt_port']
        if d.get('audio_in_name'):
            cfg['audio_in_name'] = d['audio_in_name']
            cfg['audio_out_name'] = d.get('audio_out_name') or d['audio_in_name']
        print("Применено (не забудьте сохранить).")


def probe_menu(cfg):
    port = cfg.get('cat_port') or ''
    baud = int(cfg.get('cat_baud') or 38400)
    if not port:
        print("\nCAT-порт не задан. Выберите порт в настройках или автоопределении.")
        return
    print(f"\nОпрос трансивера (ID;) на {port} @ {baud}…")
    info, err = probe_radio(port, baud)
    if err:
        print(f"Не удалось определить: {err}")
        print("Подсказка: проверьте, что трансивер включён, выбран верный порт/скорость (CAT RATE в меню), кабель подключён, порт не занят.")
        return
    cid = info.get('cat_id') or ''
    name = info.get('name') or '?'
    hid = info.get('id')
    print(f"Определён: {name}  (CAT ID: {cid}, Hamlib ID: {hid})")
    if cid in SCOPE_IDS:
        print("Возможности: поддерживается аппаратный USB-scope (широкий водопад).")
        print("  Модели: FT-710 / FTDX10 / FTDX101 (экспериментально). Нужен интерфейс FT4222 и библиотеки FTDI.")
        print("  Текущая настройка водопада: " + str(cfg.get('waterfall_source')))
        print("  Автозагрузка библиотек FTDI: " + ("вкл" if cfg.get('scope_auto_download') else "выкл"))
    else:
        print("Возможности: аппаратный USB-scope (FT4222) для этой модели не предусмотрен — используется звуковой водопад.")
    print("Пульт: CAT/звук/PTT настраиваются через порт и аудиоустройство выше.")


def settings_menu(cfg):
    while True:
        print("\n--- Настройки ---")
        print("  1. CAT порт")
        print("  2. CAT скорость (baud)")
        print("  3. Метод PTT")
        print("  4. Порт PTT (для RTS/DTR)")
        print("  5. Аудиоустройство трансивера (USB Audio)")
        print("  6. Метод CW / порт CW")
        print("  7. Пароль для доступа по сети")
        print("  8. Порты HTTP/HTTPS и HTTP в LAN")
        print("  9. Автоподключение / симулятор")
        print(" 10. Водопад / USB-scope (FT-710/FTDX10/FTDX101)")
        print("  0. Назад")
        ch = prompt("Выбор", "0")
        if ch == '0':
            return
        if ch == '1':
            ports = list_ports()
            v = choose_port(ports, "CAT порт:", cfg.get('cat_port'))
            if v is not None:
                cfg['cat_port'] = v
        elif ch == '2':
            opts = [(b, str(b)) for b in BAUDS]
            v = choose("Скорость CAT (должна совпадать с CAT RATE в меню трансивера):", opts, cfg.get('cat_baud'))
            if v is not None:
                cfg['cat_baud'] = int(v)
        elif ch == '3':
            v = choose("Метод PTT:", PTT_METHODS, cfg.get('ptt_method'))
            if v is not None:
                cfg['ptt_method'] = v
        elif ch == '4':
            ports = list_ports()
            v = choose_port(ports, "Порт PTT (Standard COM Port, для RTS/DTR):", cfg.get('ptt_port'))
            if v is not None:
                cfg['ptt_port'] = v
        elif ch == '5':
            audio = list_audio()
            v = choose_audio(audio, "Аудиоустройство (USB Audio CODEC):", cfg.get('audio_in_name'))
            if v is not None:
                cfg['audio_in_name'] = v
                cfg['audio_out_name'] = v
                cfg['audio_api'] = ''
                cfg['audio_in_index'] = None
                cfg['audio_out_index'] = None
        elif ch == '6':
            v = choose("Метод CW:", CW_METHODS, cfg.get('cw_method'))
            if v is not None:
                cfg['cw_method'] = v
            ports = list_ports()
            v = choose_port(ports, "Порт CW (для DTR/RTS, иначе не используется):", cfg.get('cw_port'))
            if v is not None:
                cfg['cw_port'] = v
        elif ch == '7':
            print("Пароль нужен для входа с телефона/других ПК по сети (HTTPS). Пусто — вход по сети запрещён.")
            v = prompt("Новый пароль (пусто — убрать пароль)", cfg.get('password') or '', allow_empty=True)
            if v is not None:
                cfg['password'] = v
        elif ch == '8':
            try:
                cfg['http_port'] = int(prompt("HTTP порт (локальный/панель)", cfg.get('http_port', 8080)))
                cfg['https_port'] = int(prompt("HTTPS порт (доступ по сети)", cfg.get('https_port', 8443)))
            except Exception:
                print("Некорректный номер порта.")
            lan = prompt("Открыть HTTP в LAN тоже? (y/n)", 'y' if cfg.get('http_lan') else 'n')
            cfg['http_lan'] = str(lan).lower().startswith('y')
        elif ch == '9':
            ac = prompt("Автоподключение к трансиверу при старте? (y/n)", 'y' if cfg.get('auto_connect', True) else 'n')
            cfg['auto_connect'] = str(ac).lower().startswith('y')
            sim = prompt("Режим симулятора (без трансивера)? (y/n)", 'y' if cfg.get('simulate') else 'n')
            cfg['simulate'] = str(sim).lower().startswith('y')
        elif ch == '10':
            v = choose("Источник водопада:", WF_SOURCES, cfg.get('waterfall_source'))
            if v is not None:
                cfg['waterfall_source'] = v
            ad = prompt("Автозагрузка библиотек FTDI при обнаружении FT-710/FTDX10/FTDX101? (y/n)", 'y' if cfg.get('scope_auto_download', True) else 'n')
            cfg['scope_auto_download'] = str(ad).lower().startswith('y')
            print("Пути к LibFT4222/D2XX (пусто = авто-поиск в папке ftdi рядом с программой):")
            v = prompt("scope_libft4222", cfg.get('scope_libft4222') or '', allow_empty=True)
            if v is not None:
                cfg['scope_libft4222'] = v.strip()
            v = prompt("scope_d2xx", cfg.get('scope_d2xx') or '', allow_empty=True)
            if v is not None:
                cfg['scope_d2xx'] = v.strip()
            v = prompt("scope_serial (SPI-интерфейс, не CAT; пусто = 'FT4222 A')", cfg.get('scope_serial') or '', allow_empty=True)
            if v is not None:
                cfg['scope_serial'] = v.strip()


def restart_hint():
    # Try to restart systemd service if present
    svc = 'yaesu-web-pult.service'
    if os.name != 'nt' and os.path.exists('/etc/systemd/system/' + svc):
        ans = prompt("Перезапустить сервис yaesu-web-pult сейчас? (y/n)", "y")
        if str(ans).lower().startswith('y'):
            rc = os.system('sudo systemctl restart yaesu-web-pult')
            if rc == 0:
                print("Сервис перезапущен. Статус: sudo systemctl status yaesu-web-pult")
            else:
                print("Не удалось перезапустить автоматически. Выполните: sudo systemctl restart yaesu-web-pult")


def main():
    cfg, _defaults = load_cfg()
    dirty = False
    while True:
        print("\n=== Yaesu Web Pult — настройка (SSH/консоль) ===")
        print(f"Файл: {cfg_path()}")
        show_status(cfg)
        print("\nМеню:")
        print("  1. Автоопределение портов и аудио")
        print("  2. Опросить трансивер (ID) — определить модель и возможности")
        print("  3. Изменить настройки")
        print("  4. Сохранить")
        print("  5. Сохранить и выйти")
        print("  0. Выйти без сохранения")
        ch = prompt("Выбор", "1")
        if ch == '1':
            auto_detect_menu(cfg); dirty = True
        elif ch == '2':
            probe_menu(cfg); pause()
        elif ch == '3':
            settings_menu(cfg); dirty = True
        elif ch == '4':
            save_cfg(cfg); dirty = False; print(f"Сохранено: {cfg_path()}")
        elif ch == '5':
            save_cfg(cfg); print(f"Сохранено: {cfg_path()}"); restart_hint(); return 0
        elif ch == '0':
            if dirty:
                ans = prompt("Есть несохранённые изменения. Выйти без сохранения? (y/n)", "n")
                if not str(ans).lower().startswith('y'):
                    continue
            return 0
        else:
            print("Неверный выбор.")


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nОтменено.")
        raise SystemExit(1)
