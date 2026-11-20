"""Rule-based CW analysis and reply templates (no external AI/LLM)."""
import re


def calls_me_strict(raw, my_call):
    """Independent check: is my callsign present in received text (with one error tolerance)."""
    my = (my_call or '').upper()
    if len(my) < 3:
        return False
    for w in re.findall(r'[A-Z0-9/]+', (raw or '').upper()):
        w = w.split('/')[0] if len(w.split('/')[0]) >= 3 else w
        if w == my:
            return True
        if len(w) == len(my) and sum(a != b for a, b in zip(w, my)) <= 1 and len(my) >= 5:
            return True
    return False


CALL_RE = r'(?:[A-Z]{1,2}|[A-Z][0-9]|[0-9][A-Z])[0-9]{1,2}[A-Z]{1,4}(?:/[A-Z0-9]{1,4})?'
_NOT_NAME = {'HR', 'IS', 'ES', 'DE', 'UR', 'RST', 'QTH', 'K', 'KN', 'BK', 'TNX', 'FER', 'HW', 'PSE', 'CALL'}
_STOP = r'(?=\s+(?:NAME|OP|RST|UR|HW|BK|KN|K|AR|ES|TNX|FB|RIG|ANT|WX|PWR|=|\+|<|\()|\s*$)'
GLOSSARY = {
    'CQ': 'общий вызов', 'DE': 'от', 'TNX': 'спасибо', 'TU': 'спасибо', 'FER': 'за', 'UR': 'ваш',
    'RST': 'рапорт', 'HW?': 'как слышите?', 'HW': 'как слышите', 'PSE': 'пожалуйста', 'AGN': 'повторите',
    'QRZ?': 'кто меня зовёт?', 'QSL': 'подтверждаю', 'QRM': 'помехи', 'QSB': 'замирания', 'QRN': 'атм. помехи',
    'FB': 'отлично', 'GM': 'доброе утро', 'GA': 'добрый день', 'GE': 'добрый вечер', 'GL': 'удачи',
    '73': 'наилучшие пожелания', 'OP': 'оператор', 'RIG': 'трансивер', 'ANT': 'антенна', 'WX': 'погода',
    'PWR': 'мощность', 'ES': 'и', 'HR': 'здесь', 'SRI': 'извините', 'BK': 'перехожу на приём',
    'K': 'приём', 'KN': 'приём, только вам', 'SK': 'конец связи', 'R': 'принял полностью', 'CUAGN': 'до встречи',
}


def _norm(raw):
    t = (raw or '').upper().replace('*', ' ')
    t = re.sub(r'\b5NN\b', '599', t)
    t = re.sub(r'\b([345])N([N9])\b', lambda m: m.group(1) + '9' + m.group(2).replace('N', '9'), t)
    return re.sub(r'\s+', ' ', t).strip()


def analyze_rules(raw, history, op):
    my = (op.get('my_call') or '').upper()
    t = _norm(raw)
    words = t.split()
    calls = [w for w in re.findall(r'\b' + CALL_RE + r'\b', t) if not re.fullmatch(r'[0-9]+', w)]
    call = to = ''
    m = list(re.finditer(r'(?:\b(' + CALL_RE + r'|CQ|QRZ\??)\s+)?DE\s+(' + CALL_RE + r')\b', t))
    if m:
        to, call = (m[-1].group(1) or ''), m[-1].group(2)
    elif calls:
        call = calls[-1]
    if not to and 'CQ' in words:
        to = 'CQ'
    if not call:                                  # «… DE» потерян — берём позывной из прошлых разборов
        for h in reversed(history or []):
            if h.get('dir') == 'rx' and h.get('call'):
                call = h['call']
                break
    rst = ''
    r = re.search(r'\b(?:RST|UR)\s+(?:IS\s+)?([1-5][1-9]{2})\b', t) or re.search(r'\b([345][1-9]9)\b', t)
    if r:
        rst = r.group(1)
    name = ''
    n = re.search(r'\b(?:NAME|OP)\s+(?:IS\s+|HR\s+)*([A-Z]{2,12})\b', t)
    if n and n.group(1) not in _NOT_NAME:
        name = n.group(1)
    qth = ''
    q = re.search(r'\bQTH\s+(?:IS\s+|HR\s+)*([A-Z][A-Z0-9\-]*(?:\s+[A-Z][A-Z0-9\-]*)?)' + _STOP, t)
    if q:
        qw = q.group(1).split(' ')
        qth = qw[0] if len(qw) > 1 and (qw[1] in _NOT_NAME or qw[1] == qw[0]) else q.group(1)
    me = bool(my) and (calls_me_strict(t, my) or my in t.replace(' ', ''))
    over = bool(re.search(r'(\bK|\bKN|\bBK|\(|\+|<SK>|<AR>|\bSK|\bAR|\bTU)\s*$', t))
    if to == 'CQ' and not me:
        kind = 'cq'
    elif re.search(r'\b73\b|<SK>|\bSK\b', t):
        kind = 'final'
    elif rst:
        kind = 'report'
    elif call and (to or me):
        kind = 'answer'
    else:
        kind = 'other'
    # смысл по-русски
    parts = []
    if kind == 'cq':
        parts.append('%s даёт общий вызов (CQ).' % (call or 'Станция'))
    elif to and call:
        parts.append('%s вызывает %s.' % (call, 'вас' if me else to))
    elif call:
        parts.append('Передаёт %s.' % call)
    if rst:
        parts.append('Ваш рапорт %s.' % rst if me or to == my else 'Рапорт %s.' % rst)
    if name:
        parts.append('Оператор %s.' % name)
    if qth:
        parts.append('QTH %s.' % qth)
    if kind == 'final':
        parts.append('Благодарит за связь, 73 — конец связи.')
    gl = []
    for w in dict.fromkeys(words):
        if w in GLOSSARY and w not in ('DE', 'CQ') and len(gl) < 8:
            gl.append('%s — %s' % (w, GLOSSARY[w]))
    if gl:
        parts.append('(' + '; '.join(gl) + ')')
    if over and kind != 'final':
        parts.append('Ждёт ответа.')
    good = sum(1 for x in (call, rst, name, qth) if x)
    return {'clean': t, 'ru': ' '.join(parts) or 'Не удалось понять — слишком много ошибок приёма.',
            'call': call, 'to': to, 'rst': rst, 'name': name, 'qth': qth, 'kind': kind,
            'calls_me': me, 'over': over, 'confidence': round(min(0.9, 0.3 + 0.15 * good), 2),
            'model': 'rules'}


def reply_rules(history, analysis, op):
    """Template reply for a standard QSO. -> {'text', 'ru', 'model'}; text empty if no reply needed."""
    my = (op.get('my_call') or '').upper()
    a = analysis or {}
    call = a.get('call') or ''
    if not call:
        for h in reversed(history or []):
            if h.get('call'):
                call = h['call']
                break
    mine = [h for h in (history or []) if h.get('dir') == 'tx']
    sent_report = any(re.search(r'\bRST\b|\b5NN\b|\b599\b|\bUR [1-5]', h.get('text', '')) for h in mine)
    sent_73 = any(re.search(r'\b73\b|<SK>', h.get('text', '')) for h in mine)
    if not my:
        return {'text': '', 'ru': 'Укажите свой позывной', 'model': 'template'}
    if not call:
        return {'text': 'QRZ? DE %s K' % my, 'ru': 'Кто меня зовёт? Позывной не разобран.', 'model': 'template'}
    kind = a.get('kind')
    if kind == 'cq' and not mine:
        return {'text': '%s DE %s %s K' % (call, my, my), 'ru': 'Отвечаю на CQ станции %s.' % call, 'model': 'template'}
    if sent_73:
        return {'text': '', 'ru': 'Связь уже завершена (73 переданы).', 'model': 'template'}
    if not sent_report:
        seg = ['%s DE %s' % (call, my), 'TNX FER CALL', 'UR RST 599 599']
        if op.get('my_name'):
            seg.append('NAME %s %s' % ((op['my_name'].upper(),) * 2))
        if op.get('my_qth'):
            seg.append('QTH %s %s' % ((op['my_qth'].upper(),) * 2))
        seg.append('HW? %s DE %s KN' % (call, my))
        return {'text': ' = '.join(seg[:1]) + ' ' + ' = '.join(seg[1:]),
                'ru': 'Даю %s рапорт 599%s%s и спрашиваю, как слышно.' % (
                    call, ', имя' if op.get('my_name') else '', ', QTH' if op.get('my_qth') else ''),
                'model': 'template'}
    name = a.get('name') or next((h['name'] for h in reversed(history or []) if h.get('name')), '')
    nm = (' ' + name) if name else ''
    return {'text': 'R %s DE %s TNX FER QSO%s = 73 GL <SK> %s DE %s TU' % (call, my, nm, call, my),
            'ru': 'Благодарю %s за связь и завершаю (73, SK).' % call, 'model': 'template'}
