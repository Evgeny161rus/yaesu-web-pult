#!/usr/bin/env python3
"""config.json CLI для whiptail-меню установщика (install-rpi.sh).

Команды:
  config_cli.py get KEY            — вывести значение (пусто, если нет)
  config_cli.py set KEY JSON       — установить значение (JSON-типизированно) и сохранить
  config_cli.py ports              — список COM/tty-портов:  device<TAB>desc
  config_cli.py audio              — список аудиоустройств: name<TAB>in/out
  config_cli.py hamlib             — список моделей Hamlib: id<TAB>mfg name
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def load():
    try:
        import main
        return main.load_cfg()
    except Exception:
        pass
    try:
        with open(cfg_path(), 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def save(cfg):
    try:
        import main
        main.save_cfg(cfg)
        return
    except Exception:
        pass
    with open(cfg_path(), 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
        f.write('\n')


def cfg_path():
    try:
        import main
        return main.cfg_path()
    except Exception:
        here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(here, 'config.json')


def ports():
    try:
        import main
        return main.list_ports()
    except Exception:
        return []


def audio():
    try:
        import main
        return main.list_audio(True)
    except Exception:
        return []


def hamlib():
    try:
        from hamlib_backend import list_models
        return list_models('rigctld')
    except Exception:
        return []


def main(argv):
    if len(argv) < 2:
        print('usage: config_cli.py get KEY | set KEY JSON | setraw KEY | ports | audio | hamlib')
        return 2
    cmd = argv[1]
    if cmd == 'get':
        cfg = load()
        v = cfg.get(argv[2]) if len(argv) > 2 else None
        if v is None:
            print('')
        elif isinstance(v, (dict, list)):
            print(json.dumps(v, ensure_ascii=False))
        else:
            print(str(v))
    elif cmd == 'set':
        key = argv[2]
        try:
            val = json.loads(argv[3])
        except Exception:
            val = argv[3]
        cfg = load()
        cfg[key] = val
        save(cfg)
        print('ok')
    elif cmd == 'setraw':
        # Точное значение из stdin: пароли с кавычками/обратными слэшами
        # не должны проходить через JSON-разбор аргумента командной строки.
        key = argv[2]
        val = sys.stdin.read()
        if val.endswith('\r\n'):
            val = val[:-2]
        elif val.endswith('\n'):
            val = val[:-1]
        cfg = load()
        cfg[key] = val
        save(cfg)
        print('ok')
    elif cmd == 'ports':
        for p in ports():
            print('%s\t%s' % (p.get('device', ''), p.get('desc', '')))
    elif cmd == 'audio':
        seen = {}
        for d in audio():
            n = d.get('name', '')
            if not n:
                continue
            # "USB Audio Device: - (hw:3,0)" -> "USB Audio Device"
            friendly = n[:n.rfind('(')] if '(' in n else n
            friendly = friendly.strip().rstrip(':- ').strip() or n.strip()
            key = friendly.lower()
            e = seen.setdefault(key, {'name': friendly, 'in': False, 'out': False})
            e['in'] = e['in'] or d.get('in', 0) > 0
            e['out'] = e['out'] or d.get('out', 0) > 0
        for e in sorted(seen.values(), key=lambda x: x['name'].lower()):
            flags = ('in' if e['in'] else '') + ('out' if e['out'] else '')
            print('%s\t%s' % (e['name'], flags))
    elif cmd == 'hamlib':
        for m in hamlib():
            print('%s\t%s %s' % (m.get('id'), m.get('mfg', ''), m.get('name', '')))
    else:
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
