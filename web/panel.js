'use strict';
/* Панель управления сервером FTX-1 Пульт (открывается только на ПК с трансивером). */
const $ = s => document.querySelector(s);
let ws, cfg = {}, ports = [], audio = [], quitting = false, saveT, lastStatus = {};

function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms);
}
const send = o => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
  ws.onopen = () => send({ t: 'admin_hello' });
  ws.onclose = () => {
    if (quitting) { $('#gone').classList.remove('hidden'); setTimeout(() => window.close(), 800); return; }
    setLamp('bad', (window.tr?tr('panel.status.noconn','Нет связи с сервером'):'Нет связи с сервером'), (window.tr?tr('panel.status.closed','Программа закрыта? Запустите FTX-1 Пульт снова.'):'Программа закрыта? Запустите FTX-1 Пульт снова.'));
    setTimeout(connect, 2000);
  };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    switch (m.t) {
      case 'probe_result':
        $('#probeModel').disabled = false;
        if (m.error) { $('#probeHint').textContent = m.error; break; }
        $('#probeHint').textContent = (window.tr?tr('panel.probe.found','Найден '):'Найден ') + m.found.name + ', ID ' + m.found.cat_id;
        $('#radio_backend').value = m.found.id === 1051 ? 'native' : 'hamlib';
        if (![...$('#hamlib_model').options].some(x => +x.value === m.found.id))
          $('#hamlib_model').add(new Option(m.found.name, String(m.found.id)));
        $('#hamlib_model').value = String(m.found.id); backendVisibility(); save();
        break;
      case 'hamlib_models': {
        const sel = $('#hamlib_model'), cur = sel.value || String(cfg.hamlib_model || 1049);
        sel.replaceChildren(...m.models.map(x => new Option(`${x.name} · ${x.status}`, String(x.id))));
        if (![...sel.options].some(x => x.value === cur)) sel.add(new Option((window.tr?tr('panel.model.notfound','Модель '):'Модель ') + cur + (window.tr?tr('panel.model.notfound2',' (не найдена)'):' (не найдена)'), cur));
        sel.value = cur;
        $('#hamlibHint').textContent = m.error || ((window.tr?tr('panel.hamlib.models','Моделей: '):'Моделей: ') + m.models.length + '. ' + (window.tr?tr('panel.hamlib.dummy','Dummy — проверка без аппаратуры. PTT через CAT; EX-меню и цифровые модули FTX-1 отключены.'):'Dummy — проверка без аппаратуры. PTT через CAT; EX-меню и цифровые модули FTX-1 отключены.'));
        break;
      }
      case 'admin_denied':
        if (m.need_pw) {
          const pw = prompt((window.tr?tr('panel.pw_prompt','Пароль для доступа к панели'):'Пароль для доступа к панели'), '');
          if (pw != null) { send({ t: 'admin_hello', pw }); break; }
        }
        setLamp('bad', (window.tr?tr('panel.denied','Панель доступна только на ПК с трансивером или по паролю'):'Панель доступна только на ПК с трансивером или по паролю'), ''); break;
      case 'admin_init': init(m); break;
      case 'admin_devices': ports = m.ports; audio = m.audio; fillDevices(); renderUrls(m.urls); applyDetectIfEmpty(m.detect); break;
      case 'admin_status': renderStatus(m.s); break;
      case 'admin_log': addLog(m.line); break;
      case 'admin_saved':
        cfg = m.cfg; flashSaved();
        if (m.port_change) toast((window.tr?tr('panel.toast.port_change','Новые порты заработают после перезапуска программы'):'Новые порты заработают после перезапуска программы'), 5000);
        break;
      case 'admin_autostart': $('#autostart').checked = !!m.on; break;
      case 'admin_scope_download':
        $('#scopeDownload').disabled = m.ok === null;
        $('#scopeDlMsg').textContent = m.msg || '';
        if (m.ok === true) toast((window.tr?tr('panel.toast.ftdi_ok','Библиотеки FTDI загружены'):'Библиотеки FTDI загружены'), 4000);
        else if (m.ok === false) toast(m.msg || (window.tr?tr('panel.toast.ftdi_fail','Не удалось скачать библиотеки'):'Не удалось скачать библиотеки'), 6000);
        break;
    }
  };
}

// ------------------------------------------------------------ инициализация
function init(m) {
  cfg = m.cfg; ports = m.ports; audio = m.audio;
  $('#radio_backend').value = cfg.radio_backend || 'native';
  $('#hamlib_path').value = cfg.hamlib_path || 'rigctld';
  $('#hamlib_model').replaceChildren(new Option((window.tr?tr('panel.model.notfound','Модель '):'Модель ').replace(/ $/,': ') + (cfg.hamlib_model || 1049), String(cfg.hamlib_model || 1049)));
  backendVisibility();
  if (cfg.radio_backend === 'hamlib') send({t:'admin_hamlib_models'});
  $('#ver').textContent = (window.tr?tr('panel.version','версия '):'версия ') + m.version;
  fillDevices();
  for (const k of ['cat_baud', 'ptt_method', 'max_tx_seconds', 'http_port', 'https_port', 'waterfall_source']) $('#' + k).value = cfg[k] ?? '';
  for (const k of ['scope_libft4222', 'scope_d2xx', 'scope_serial']) $('#' + k).value = cfg[k] || '';
  $('#rtlsdr_sample_rate').value = cfg.rtlsdr_sample_rate ?? 1024000;
  $('#rtlsdr_gain').value = cfg.rtlsdr_gain ?? 40;
  for (const k of ['simulate', 'auto_connect', 'open_panel', 'open_pult', 'scope_auto_download']) $('#' + k).checked = !!cfg[k];
  $('#cw_method').value = cfg.cw_method || 'cat';
  $('#cw_port').value = cfg.cw_port || '';
  $('#password').value = cfg.password || '';
  if (m.win) $('#autostart').checked = !!m.autostart; else $('#autostartRow').classList.add('hidden');
  if (m.headless) $('#btnQuit').classList.add('hidden');
  renderUrls(m.urls);
  $('#log').innerHTML = ''; m.log.forEach(addLog);
  pttPortVisibility(); pwHint();
  if (m.first_run) {
    $('#wizard').classList.remove('hidden');
    applyDetect(m.detect, true);
  }
}
function applyDetect(d, quiet) {
  if (!d || !Object.keys(d).length) { if (!quiet) toast((window.tr?tr('panel.toast.not_found','FTX-1 не найден: проверьте кабель, питание и драйвер CP210x'):'FTX-1 не найден: проверьте кабель, питание и драйвер CP210x'), 5000); return; }
  if (d.cat_port) $('#cat_port').value = d.cat_port;
  if (d.ptt_port) $('#ptt_port').value = d.ptt_port;
  if (d.audio_in_name) {
    cfg.audio_in_name = d.audio_in_name; cfg.audio_out_name = d.audio_out_name; cfg.audio_api = d.audio_api;
    fillAudio();
  }
  save();
  if (!quiet) toast((window.tr?tr('panel.toast.found','Найдено: '):'Найдено: ') + [d.cat_port && 'CAT ' + d.cat_port, d.audio_in_name && ((window.tr?tr('panel.toast.audio','звук '):'звук ') + d.audio_in_name)].filter(Boolean).join(', '));
}
function applyDetectIfEmpty(d) {
  if (d && ((!cfg.cat_port && d.cat_port) || (!cfg.audio_in_name && d.audio_in_name))) applyDetect(d, true);
}

function opt(v, t, sel) { return `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(t)}</option>`; }
function fillDevices() {
  const portOpts = (cur, prefer) => {
    let h = '';
    if (!ports.length) h += opt('', (window.tr?tr('panel.port.none','— COM-порты не найдены —'):'— COM-порты не найдены —'), !cur);
    else if (!cur) h += opt('', (window.tr?tr('panel.port.select','— выберите —'):'— выберите —'), true);
    for (const p of ports) {
      const star = p.kind === prefer ? '★ ' : '';
      h += opt(p.device, `${star}${p.device} — ${p.desc}`, p.device === cur);
    }
    if (cur && !ports.some(p => p.device === cur)) h += opt(cur, cur + (window.tr?tr('panel.port.disconnected',' (сейчас не подключён)'):' (сейчас не подключён)'), true);
    return h;
  };
  $('#cat_port').innerHTML = portOpts(cfg.cat_port, 'enhanced');
  $('#ptt_port').innerHTML = portOpts(cfg.ptt_port, 'standard');
  $('#cw_port').innerHTML = portOpts(cfg.cw_port, 'standard');
  fillAudio();
}
// Звук: одна звуковая карта трансивера (вход + выход), драйвер — отдельно (по умолчанию авто).
const isCodec = n => /usb audio (codec|device)/i.test(n);
const coreName = n => { const m = /\(([^()]*)\)?\s*$/.exec(n); return ((m && m[1]) || n).replace(/^\s*\d+\s*-\s*/, '').trim(); };
const MAPPER = /переназначение|mapper|основной драйвер|primary sound/i;
function fillAudio() {
  // одно физическое устройство = одна строка, сколько бы драйверов Windows его ни показывали
  const cores = new Map();
  for (const d of audio) {
    if (MAPPER.test(d.name)) continue;
    const c = coreName(d.name), k = c.toLowerCase();
    const e = cores.get(k) || { name: c, in: false, out: false };
    e.in = e.in || d.in > 0; e.out = e.out || d.out > 0;
    cores.set(k, e);
  }
  const both = [...cores.values()].filter(e => e.in && e.out);
  both.sort((a, b) => isCodec(b.name) - isCodec(a.name));
  const cur = cfg.audio_in_name ? coreName(cfg.audio_in_name) : '';
  let h = opt('', (window.tr?tr('panel.audio.auto','Автоматически (USB Audio CODEC/Device)'):'Автоматически (USB Audio CODEC/Device)'), !cur), found = !cur;
  for (const e of both) {
    const sel = !!cur && e.name.toLowerCase() === cur.toLowerCase();
    if (sel) found = true;
    h += opt(e.name, (isCodec(e.name) ? '★ ' : '') + e.name + (isCodec(e.name) ? (window.tr?tr('panel.audio.transceiver',' — трансивер'):' — трансивер') : ''), sel);
  }
  if (!found) h += opt(cur, cur + (window.tr?tr('panel.audio.notfound',' (не найдено)'):' (не найдено)'), true);
  $('#audio_dev').innerHTML = h;
  $('#audio_api').value = cfg.audio_api || '';
  if ($('#audio_api').value !== (cfg.audio_api || '')) $('#audio_api').value = '';
  audioHint();
}
function audioHint(st) {
  const d = $('#audio_dev').value;
  let t = '';
  if (d && !isCodec(d)) t = (window.tr?tr('panel.audio.hint.notusb','⚠ Выбрано не USB-устройство трансивера.'):'⚠ Выбрано не USB-устройство трансивера.');
  else if (!audio.some(x => isCodec(x.name))) t = (window.tr?tr('panel.audio.hint.nousb','⚠ USB-звук трансивера не виден: проверьте кабель и нажмите ↻.'):'⚠ USB-звук трансивера не виден: проверьте кабель и нажмите ↻.');
  else if (st && st.audio_api_used) t = (window.tr?tr('panel.audio.hint.used','Сейчас звук идёт через '):'Сейчас звук идёт через ') + st.audio_api_used.replace('Windows ', '') + '.';
  $('#audioHint').textContent = t;
}
$('#audio_dev').addEventListener('change', () => audioHint());

// ------------------------------------------------------------ сохранение
function collect() {
  const dev = $('#audio_dev').value;
  return {
    radio_backend: $('#radio_backend').value, hamlib_path: $('#hamlib_path').value.trim() || 'rigctld',
    hamlib_model: Number($('#hamlib_model').value || 1049),
    cat_port: $('#cat_port').value, cat_baud: +$('#cat_baud').value,
    audio_in_name: dev, audio_out_name: dev, audio_api: $('#audio_api').value, audio_in_index: null, audio_out_index: null,
    ptt_method: $('#ptt_method').value, ptt_port: $('#ptt_port').value,
    simulate: $('#simulate').checked, password: $('#password').value,
    auto_connect: $('#auto_connect').checked, open_panel: $('#open_panel').checked, open_pult: $('#open_pult').checked,
    max_tx_seconds: Math.max(10, Math.min(1800, +$('#max_tx_seconds').value || 180)),
    http_port: +$('#http_port').value || 8080, https_port: +$('#https_port').value || 8443,
    cw_method: $('#cw_method').value, cw_port: $('#cw_port').value,
    waterfall_source: $('#waterfall_source').value || 'auto',
    scope_libft4222: $('#scope_libft4222').value.trim(),
    scope_d2xx: $('#scope_d2xx').value.trim(),
    scope_serial: $('#scope_serial').value.trim(),
    scope_auto_download: $('#scope_auto_download').checked,
    rtlsdr_sample_rate: Math.max(250000, Math.min(3200000, +$('#rtlsdr_sample_rate').value || 1024000)),
    rtlsdr_gain: Math.max(0, Math.min(50, +$('#rtlsdr_gain').value || 40)),
  };
}
function save() { clearTimeout(saveT); saveT = setTimeout(() => send({ t: 'admin_save', cfg: collect() }), 350); }
function flashSaved() { const s = $('#saved'); s.classList.add('show'); clearTimeout(s.t); s.t = setTimeout(() => s.classList.remove('show'), 1500); }
document.querySelectorAll('select, input').forEach(el => {
  if (el.id === 'autostart') return;
  el.addEventListener(el.matches('input[type=text], input[type=password], input[type=number]') ? 'input' : 'change', () => {
    pttPortVisibility(); pwHint(); save();
  });
});
function pttPortVisibility() {
  backendVisibility();
  $('#pttPortField').classList.toggle('hidden', !/RTS|DTR/.test($('#ptt_method').value));
  $('#cwPortField').classList.toggle('hidden', $('#cw_method').value === 'cat');
}
function backendVisibility() {
  const ham = $('#radio_backend').value === 'hamlib';
  $('#hamlibFields').classList.toggle('hidden', !ham);
  $('#ptt_method').disabled = ham;
  $('#ptt_port').disabled = ham;
  $('#simulate').disabled = ham;
}
$('#hamlibReload').onclick = () => {
  clearTimeout(saveT);
  send({t:'admin_save',cfg:collect()});
  send({t:'admin_hamlib_models'});
};
$('#probeModel').onclick = () => {
  clearTimeout(saveT);
  if (lastStatus.running) { toast((window.tr?tr('panel.toast.stop_first','Сначала остановите соединение'):'Сначала остановите соединение')); return; }
  $('#probeModel').disabled = true;
  $('#probeHint').textContent = (window.tr?tr('panel.probe.checking','Запрашиваю ID…'):'Запрашиваю ID…');
  send({t:'admin_save',cfg:collect()}); send({t:'admin_probe'});
};
function pwHint() {
  const pw = $('#password').value;
  $('#pwHint').textContent = !pw ? (window.tr?tr('panel.pw.empty','⚠ Пароль не задан — с телефона войти нельзя (это безопасно, но неудобно).'):'⚠ Пароль не задан — с телефона войти нельзя (это безопасно, но неудобно).')
    : pw.length < 6 ? (window.tr?tr('panel.pw.short','⚠ Короткий пароль — лучше 6+ символов.'):'⚠ Короткий пароль — лучше 6+ символов.') : '';
}
$('#pwShow').onclick = () => { const p = $('#password'); p.type = p.type === 'password' ? 'text' : 'password'; };
$('#pwGen').onclick = () => {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(8));
  $('#password').value = [...r].map(x => a[x % a.length]).join('');
  $('#password').type = 'text'; pwHint(); save();
};
$('#autostart').onchange = e => send({ t: 'admin_autostart', on: e.target.checked });
$('#btnRefresh').onclick = () => { send({ t: 'admin_refresh' }); toast((window.tr?tr('panel.toast.refresh','Обновляю список устройств…'):'Обновляю список устройств…'), 1200); };
$('#btnDetect').onclick = () => {
  send({ t: 'admin_refresh' });
  const h = e => { const m = JSON.parse(e.data); if (m.t === 'admin_devices') { ws.removeEventListener('message', h); applyDetect(m.detect, false); } };
  ws.addEventListener('message', h);
};
$('#scopeDownload').onclick = () => {
  $('#scopeDlMsg').textContent = (window.tr?tr('panel.scope.dl.loading','Загрузка…'):'Загрузка…');
  $('#scopeDownload').disabled = true;
  send({ t: 'admin_scope_download' });
};
$('#btnRun').onclick = () => {
  if (lastStatus.running) send({ t: 'admin_stop' });
  else { clearTimeout(saveT); send({ t: 'admin_save', cfg: collect() }); send({ t: 'admin_start' }); $('#wizard').classList.add('hidden'); }
};
$('#btnPult').onclick = () => window.open(location.origin + '/', '_blank');
$('#btnFolder').onclick = () => send({ t: 'admin_open_folder' });
$('#btnQuit').onclick = () => {
  if (!confirm((window.tr?tr('panel.confirm.quit','Выйти из программы? Связь с трансивером будет остановлена, пульты отключатся.'):'Выйти из программы? Связь с трансивером будет остановлена, пульты отключатся.'))) return;
  quitting = true; send({ t: 'admin_quit' });
};

// ------------------------------------------------------------ состояние
function setLamp(cls, title, sub) {
  $('#lamp').className = 'lamp ' + cls; $('#stTitle').textContent = title; $('#stSub').textContent = sub || '';
}
const fmtF = f => { const s = String(Math.round(f)).padStart(7, '0'); return `${s.slice(0, -6)}.${s.slice(-6, -3)}.${s.slice(-3)}`; };
function renderStatus(s) {
  lastStatus = s;
  const b = $('#btnRun');
  b.disabled = s.busy;
  b.className = 'btn ' + (s.running ? 'stop' : 'go');
  b.textContent = s.busy ? (window.tr?tr('panel.busy','… Подождите'):'… Подождите') : s.running ? (window.tr?tr('panel.stop','■ Остановить'):'■ Остановить') : (window.tr?tr('panel.run','▶ Запустить'):'▶ Запустить');
  if (s.busy) setLamp('warn', (window.tr?tr('panel.status.connecting','Подключаюсь…'):'Подключаюсь…'), '');
  else if (!s.running) setLamp(s.error ? 'bad' : '', s.error ? (window.tr?tr('panel.status.err','Связь не установлена'):'Связь не установлена') : (window.tr?tr('panel.status.stopped','Связь с трансивером остановлена'):'Связь с трансивером остановлена'),
    s.error ? '' : (window.tr?tr('panel.status.press_start','Нажмите «Запустить»'):'Нажмите «Запустить»'));
  else if (s.tx) setLamp('tx', (window.tr?tr('panel.status.tx','ПЕРЕДАЧА'):'ПЕРЕДАЧА'), s.ptt_owner ? (window.tr?tr('panel.status.by','с '):'с ') + s.ptt_owner : '');
  else if (s.connected) setLamp('ok', s.sim ? (window.tr?tr('panel.status.sim','Работает (симулятор)'):'Работает (симулятор)') : (window.tr?tr('panel.status.conn','Трансивер на связи'):'Трансивер на связи'),
    [s.radio_name || (s.radio_id === '0840' ? 'FTX-1' : ''), s.backend === 'hamlib' ? 'Hamlib' : '', s.head === 2 ? 'Optima/SPA-1' : s.head === 1 ? 'Field' : '', s.fw ? (window.tr?tr('panel.status.fw','прошивка '):'прошивка ') + s.fw : ''].filter(Boolean).join(' · '));
  else setLamp('warn', (window.tr?tr('panel.status.noresp','Трансивер не отвечает'):'Трансивер не отвечает'), (window.tr?tr('panel.status.noresp.hint','Включён? Тот ли COM-порт и скорость CAT?'):'Включён? Тот ли COM-порт и скорость CAT?'));
  $('#stFreq').textContent = s.running && s.connected && s.freq ? `${fmtF(s.freq)}  ${s.mode || ''}` : '';
  const err = $('#stErr');
  err.textContent = s.error || (s.running && s.audio_err ? ((window.tr?tr('panel.audio','Звук'):'Звук') + ': ' + s.audio_err) : '');
  err.classList.toggle('hidden', !err.textContent);
  $('#cCat').className = s.running ? (s.connected ? 'ok' : 'warn') : '';
  $('#cAudio').className = s.running ? (s.audio_ok ? 'ok' : 'bad') : '';
  if (s.audio_api_used !== undefined && document.activeElement !== $('#audio_dev')) audioHint(s);
  $('#cTx').className = s.tx ? 'bad' : (s.running ? 'ok' : '');
  $('#cTxT').textContent = s.tx ? (window.tr?tr('panel.tx.on','Передача'):'Передача') : (window.tr?tr('panel.tx.off','Приём'):'Приём');
  $('#cCl').className = s.clients.length ? 'ok' : '';
  $('#cClT').textContent = (window.tr?tr('panel.clients.n','Пультов: '):'Пультов: ') + s.clients.length;
  $('#clCount').textContent = s.clients.length ? `(${s.clients.length})` : '';
  $('#clients').innerHTML = s.clients.length ? s.clients.map(c =>
    `<div class="cl">${c.tx ? '🔴' : c.local ? '🖥' : '📱'} <span>${esc(c.name.split(':')[0])}</span>
     <span class="muted small">${c.local ? (window.tr?tr('panel.clients.thispc','этот ПК'):'этот ПК') : (window.tr?tr('panel.clients.net','по сети'):'по сети')}${c.audio ? (window.tr?tr('panel.clients.audio',' · звук'):' · звук') : ''}${c.tx ? (window.tr?tr('panel.clients.tx',' · ПЕРЕДАЁТ'):' · ПЕРЕДАЁТ') : ''}</span></div>`).join('')
    : '<span class="muted small" data-i18n="panel.clients.empty">' + (window.tr?tr('panel.clients.empty','Никого'):'Никого') + '</span>';
  document.title = (s.tx ? '🔴 ' : '') + (window.tr?tr('panel.title.app','FTX-1 Пульт — сервер'):'FTX-1 Пульт — сервер');
}
function renderUrls(urls) {
  $('#urls').innerHTML = urls.map(u => `<div class="url"><span title="${u.kind === 'local' ? (window.tr?tr('panel.url.thispc','на этом ПК'):'на этом ПК') : (window.tr?tr('panel.url.others','для телефона и других ПК'):'для телефона и других ПК')}">${u.kind === 'local' ? '🖥' : '📱'}</span>
    <code>${esc(u.url)}</code><button class="btn small" data-copy="${esc(u.url)}">${(window.tr?tr('panel.copy','Копировать'):'Копировать')}</button></div>`).join('');
  document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
    navigator.clipboard.writeText(b.dataset.copy).then(() => toast((window.tr?tr('panel.copied','Скопировано'):'Скопировано')), () => toast(b.dataset.copy));
  });
  const lan = urls.find(u => u.kind === 'lan');
  $('#qrbox').classList.toggle('hidden', !lan || typeof qrcode !== 'function');
  if (lan && typeof qrcode === 'function') {
    const q = qrcode(0, 'M'); q.addData(lan.url); q.make();
    $('#qr').innerHTML = q.createSvgTag(4, 0);
  }
}
function addLog(l) {
  const el = $('#log'), atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
  const d = document.createElement('div'); d.className = l.lvl; d.textContent = l.t;
  el.appendChild(d);
  while (el.childNodes.length > 400) el.removeChild(el.firstChild);
  if (atEnd) el.scrollTop = el.scrollHeight;
}
// Масштаб окна: «авто» — под размер экрана (макет рассчитан на ~1080×860)
const scaleOpt = (() => { try { return localStorage.getItem('ftx1.panelScale') || 'auto'; } catch { return 'auto'; } })();
$('#scale').value = scaleOpt;
function applyScale() {
  let z = parseFloat($('#scale').value);
  const auto = !(z > 0), w = innerWidth, h = innerHeight;
  if (auto) z = w < 700 ? 1 : Math.max(0.6, Math.min(2.2, Math.min(w / 1080, h / 860)));
  document.documentElement.style.zoom = z;
  if (auto && w >= 700) {
    // наибольший масштаб, при котором панель целиком влезает в окно (число колонок
    // зависит от масштаба, поэтому подбираем делением пополам)
    const fits = zz => { document.documentElement.style.zoom = zz; return $('.wrap').getBoundingClientRect().height <= h - 3; };
    if (!fits(z)) {
      let lo = 0.45, hi = z;
      for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
      fits(lo);
    }
  }
}
$('#scale').onchange = () => { try { localStorage.setItem('ftx1.panelScale', $('#scale').value); } catch { } applyScale(); };
addEventListener('resize', () => { if ($('#scale').value === 'auto') applyScale(); });
// содержимое панели меняется (данные, QR-код, список клиентов) — пересчитать масштаб
let lastH = 0, roT;
new ResizeObserver(() => {
  const hh = $('.wrap').offsetHeight;
  if (Math.abs(hh - lastH) < 3) return;
  lastH = hh; clearTimeout(roT); roT = setTimeout(applyScale, 80);
}).observe($('.wrap'));
applyScale();
const langSel = $('#langSel');
if (langSel && window.I18N) {
  langSel.value = I18N.getLang();
  langSel.onchange = e => I18N.setLang(e.target.value);
  window.addEventListener('langchange', () => { langSel.value = I18N.getLang(); });
}
connect();
