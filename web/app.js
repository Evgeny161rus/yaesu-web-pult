'use strict';
/* FTX-1 Пульт — клиент. Один и тот же код для ПК и Android (как PWA). */

// ------------------------------------------------------------------ утилиты
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem('ftx1.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ftx1.' + k, JSON.stringify(v)); } catch { } },
};
const tr = (k, fb) => (window.I18N ? I18N.t(k, fb) : (fb != null ? fb : k));
let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
function resolveServerMsg(m, fallback) {
  if (!m) return fallback || '';
  const key = m.msg_key || m.key;
  if (key) {
    let s = tr(key, m.msg || fallback || key);
    const params = m.msg_params || m.params || {};
    for (const [k, v] of Object.entries(params)) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), v == null ? '' : String(v));
    return s;
  }
  return m.msg != null ? String(m.msg) : (fallback || '');
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function interp(table, x) {               // кусочно-линейная калибровка шкал
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

// ------------------------------------------------------------------ справочники
const MODES = ['LSB', 'USB', 'CW-U', 'CW-L', 'AM', 'AM-N', 'FM', 'FM-N', 'DATA-U', 'DATA-L', 'DATA-FM', 'RTTY-L', 'RTTY-U', 'PSK'];
const BANDS = [
  ['160', 1810e3, 2000e3, 1850e3, 'LSB'], ['80', 3500e3, 3800e3, 3650e3, 'LSB'], ['60', 5250e3, 5450e3, 5357e3, 'USB'],
  ['40', 7000e3, 7300e3, 7100e3, 'LSB'], ['30', 10100e3, 10150e3, 10120e3, 'CW-U'], ['20', 14000e3, 14350e3, 14200e3, 'USB'],
  ['17', 18068e3, 18168e3, 18130e3, 'USB'], ['15', 21000e3, 21450e3, 21200e3, 'USB'], ['12', 24890e3, 24990e3, 24950e3, 'USB'],
  ['10', 28000e3, 29700e3, 28500e3, 'USB'], ['6', 50000e3, 54000e3, 50150e3, 'USB'], ['4', 69900e3, 70500e3, 70200e3, 'USB'],
  ['AIR', 108e6, 137e6, 118.1e6, 'AM'], ['2', 144e6, 148e6, 145.5e6, 'FM'], ['70', 430e6, 450e6, 433.5e6, 'FM'],
];
// Полосы фильтра по коду WIDTH (по таблицам Yaesu; для FTX-1 — ориентировочно)
const W_SSB = [2400, 300, 400, 600, 850, 1100, 1200, 1500, 1650, 1800, 1950, 2100, 2250, 2400, 2450, 2500, 2600, 2700, 2800, 2900, 3000, 3200, 3500, 4000];
const W_CW = [500, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 800, 1200, 1400, 1700, 2000, 2400, 3000, 3200, 3500, 4000, 4000, 4000];
const S_CAL = [[0, 0], [12, 1], [27, 2], [40, 3], [55, 4], [65, 5], [80, 6], [95, 7], [112, 8], [130, 9], [150, 10], [172, 11], [190, 12], [220, 13], [240, 14], [255, 15]];
const PO_CAL = [[0, 0], [10, .8], [50, 8], [100, 26], [150, 54], [200, 92], [250, 140]];
const SWR_CAL = [[0, 1], [12, 1], [39, 1.35], [65, 1.5], [89, 2], [242, 5], [255, 6]];
const MENU_GROUPS_FALLBACK = { '01': 'Виды работы', '02': 'CW', '03': 'Работа', '04': 'Дисплей', '05': 'Дата/время', '06': 'APRS', '07': 'APRS маяк', '08': 'APRS фильтр', '09': 'Пресеты', '11': 'Bluetooth' };
const menuGroupName = c => tr('menu.grp.' + c, MENU_GROUPS_FALLBACK[c] || '');

const isCW = m => /^CW/.test(m || '');
const isLower = m => /^(LSB|CW-L|DATA-L|RTTY-L)$/.test(m || '');
const isAMFM = m => /^(AM|FM|DATA-FM|C4FM)/.test(m || '');
const pitchHz = () => 300 + (S.key_pitch ?? 30) * 10;
const delayMs = c => c < 6 ? [30, 50, 100, 150, 200, 250][c] : (c - 6) * 100 + 300;
const bandOf = f => BANDS.find(b => f >= b[1] && f <= b[2]);
function widthHz(code, mode) {
  if (/^(AM|FM|DATA-FM|C4FM)/.test(mode || '')) return /AM/.test(mode) ? (mode === 'AM-N' ? 6000 : 9000) : 12000;
  const t = /^(LSB|USB)$/.test(mode) ? W_SSB : W_CW;
  return t[clamp(code | 0, 0, t.length - 1)];
}

// ------------------------------------------------------------------ состояние
const S = {};                       // состояние трансивера (зеркало сервера) — «как на экране»
// Если на трансивере выбран SUB (VS1), большая частота пульта — частота SUB, а маленькая — MAIN,
// как на экране FTX-1. R — сырое состояние, S — вид: freq_a/mode всегда «рабочий» приёмник.
const R = {};
const PAIR = { freq_a: 'freq_b', freq_b: 'freq_a', mode: 'mode_b', mode_b: 'mode' };
const rawKey = k => (R.vfo && PAIR[k]) ? PAIR[k] : k;     // ключ вида -> ключ трансивера (и обратно)
const C = {                         // состояние клиента
  ws: null, authed: false, local: false, info: {},
  rate: store.get('rate', 0), pw: store.get('pw', ''),          // 0 = выбрать по месту (ПК — 48 кГц, сеть — 16 кГц)
  audioOn: false, ac: null, player: null, gain: store.get('vol', 100) / 100,
  mic: null, micNode: null, micGainNode: null, micStream: null,
  pttPressed: false, txOwner: false, pttBusy: false, txStart: 0, keepalive: null,
  lockUntil: {},                    // ключ -> время, до которого не принимаем значение с сервера
  wfMax: store.get('wfMax', 0),          // выбранный обзор водопада, 0 = авто
  wfSrc: 'audio',                        // источник водопада: audio | rf
  wfScope: false,                        // сервер умеет широкий USB-scope
  span: 4000, bw: 0,                      // действующий обзор и измеренная полоса звука трансивера
};
const opts = Object.assign({ echo: false, ns: false, agc: false, muteTx: true, pttMode: 'hold', space: true, palette: 'classic', micGain: 100, micId: '',
  sqMode: 'radio', sqThr: -60, tail: 500, scale: 'auto', hotkeys: true, rfWf: true,
  meterMode: 'bars', meterSize: 'compact', meterReadouts: true, meterTx: 'po' }, store.get('opts', {}));
// Аналоговая шкала раньше была основной. Теперь по умолчанию — полосы; если
// пользователь явно выбрал прибор в настройках, его выбор сохраняется.
if (!opts.meterChoice) opts.meterMode = 'bars';
if ((opts.v | 0) < 2) {           // 1.8: обработка браузера для эфира по умолчанию выключена (портила голос)
  opts.echo = false; opts.ns = false; opts.agc = false; opts.v = 2; store.set('opts', opts);
}

// ------------------------------------------------------------------ связь
function send(o) {
  if ((S.backend === 'hamlib' || C.info.backend === 'hamlib') &&
      (/^(cw_|mem_|ft_|vk_|rt_|fax_|nx_|psk_|sstv_)/.test(o.t) || ['act','raw','console','menu_list','menu_get','menu_set'].includes(o.t))) return;
  if (C.ws && C.ws.readyState === 1) C.ws.send(JSON.stringify(o));
}
function setParam(k, v) {
  if (S.backend === 'hamlib' && !(S.radio_caps?.keys || []).includes(k)) return note(tr('app.hamlib.ctrl','Регулятор недоступен для этого драйвера'));
  const rk = rawKey(k);
  C.lockUntil[k] = performance.now() + 1200;
  if (k === 'vfo') { const was = !!R.vfo; R.vfo = v; if (!!v !== was) remapVfo(); }
  else { S[k] = v; R[rk] = v; }
  send({ t: 'set', k: rk, v });
}
function remapVfo() {                     // MAIN/SUB переключили — частоты и виды меняются местами
  for (const k of Object.keys(PAIR)) { S[k] = R[rawKey(k)]; delete C.lockUntil[k]; }
  S.vfo = R.vfo;
  if (typeof renderFreq === 'function') { renderFreq(); renderBadges(); }
  if (typeof updateSpan === 'function') setTimeout(() => { updateSpan(); drawOverlay(); }, 0);
}
function act(a, arg) { if (S.backend === 'hamlib') return note(tr('app.hamlib.func','Функция недоступна через Hamlib')); send({ t: 'act', a, arg }); }

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.binaryType = 'arraybuffer';
  C.ws = ws;
  ws.onopen = () => send({ t: 'hello', pw: C.pw, rate: C.rate || 16000 });
  ws.onclose = () => {
    C.authed = false; renderMeters(); window.dxDesk?.offline(); setLink(false, tr('conn.lost','Нет связи с сервером'), 'conn.lost');
    if (C.txOwner) { C.txOwner = false; updatePtt(); }
    setTimeout(connect, 2000);
  };
  ws.onmessage = (e) => {
    if (typeof e.data !== 'string') return onBinary(new Uint8Array(e.data));
    const m = JSON.parse(e.data);
    switch (m.t) {
      case 'hello_ok':
        C.authed = true; C.local = m.local; C.info = m;
        C.wfScope = !!m.wf_scope;
        if (!m.local && C.pw) store.set('pw', C.pw);
        if (!C.rate) {                                   // первый вход: на этом ПК — максимальное качество
          C.rate = m.local ? 48000 : 16000; $('#optRate').value = C.rate;
          C.player && C.player.port.postMessage({ rate: C.rate });
        }
        send({ t: 'audio', on: C.audioOn, rate: C.rate });
        $('#login').classList.add('hidden');
        $('#btnPanel').classList.toggle('hidden', !m.local);
        fillSelect($('.ctl[data-k=ctcss] select'), m.ctcss.map((v, i) => [i, v.toFixed(1)]));
        $('#srvInfo').textContent = `${tr('app.srv.info','Сервер')} v${m.version}. ${tr('app.srv.ptt','PTT')}: ${m.ptt_method}. ${tr('app.srv.maxtx','Ограничение передачи')}: ${m.max_tx} s.` + (m.audio_err ? ` ${tr('app.srv.audio','ЗВУК')}: ${m.audio_err}` : '');
        setWfMsg(m.audio_err);
        updateSpan(true);
        renderWfMode();
        syncWfSource(true);
        send({ t: 'dx_hello' });
        send({ t: 'cw_hello' }); cwDesk.resend(); digiDesk.resend(); digi2.resend(); ft8Desk.resend(); voiceCq.hello(); qsoRec.hello();
        if (C.audioOn) send({ t: 'audio', on: true, rate: C.rate });
        break;
      case 'auth_fail':
        if (C.pw) { store.set('pw', ''); }          // неверный сохранённый пароль больше не подставляем
        C.pw = '';
        $('#login').classList.remove('hidden');
        $('#loginMsg').textContent = m.first ? tr('auth.msg', 'Введите пароль сервера') : m.msg;
        $('#loginPw').value = ''; setTimeout(() => $('#loginPw').focus(), 50);
        break;
      case 'state': applyState(m.s, m.full); if (Object.keys(m.s).some(k => /^fw\d$|^radio_id$/.test(k))) renderFw(); break;
      case 'lv': break;
      case 'bw': C.bw = m.hz; onBw(m.hz); break;
      case 'ptt_owner':
        C.txOwner = m.you; C.pttBusy = m.busy && !m.you;
        if (C.txOwner && !C.txStart) C.txStart = performance.now();
        if (!C.txOwner) C.txStart = 0;
        updatePtt(); pushGate(); break;
      case 'note': toast(resolveServerMsg(m), 4000); break;
      case 'wf_src':
        C.wfSrc = m.mode === 'rf' ? 'rf' : 'audio';
        if (C.wfSrc !== 'rf') wf.rf = null;
        if (C.wfSrc === 'rf' && m.span) wf.rfSpan = m.span;
        if (m.reason) C.wfScope = false;      // сервер сам переключил на звук
        renderWfMode(); drawOverlay();
        break;
      case 'wf_scope':
        C.wfScope = m.state === 'live';
        if (C.wfScope) { renderWfMode(); syncWfSource(true); }
        else if (m.reason) note(tr('wf.scope_err','Широкий водопад: ') + m.reason, 4000);
        renderWfMode();
        break;
      case 'audio_status': setWfMsg(m.err_key ? tr(m.err_key, m.err) : m.err); break;
      case 'raw': catLine(m.line); break;
      case 'menu_list': buildMenu(m.items); break;
      case 'menu_val': setMenuVal(m.ex, m.v); break;
      default:
        if (m.t?.startsWith('dx_')) { window.dxDesk?.on(m); break; }
        if (m.t && m.t.startsWith('cw_')) cwDesk.on(m);
        else if (m.t && (m.t.startsWith('rt_') || m.t.startsWith('fax_'))) digiDesk.on(m);
        else if (m.t && /^(nx_|psk_|sstv_)/.test(m.t)) digi2.on(m);
        else if (m.t && m.t.startsWith('vk_')) voiceCq.on(m);
        else if (m.t && m.t.startsWith('ft_')) ft8Desk.on(m);
        else if (m.t && m.t.startsWith('mem_') && typeof memEd !== 'undefined') memEd.on(m);
        else if (m.t === 'rec_state') qsoRec.on(m);
    }
  };
}

function onBinary(b) {
  const type = b[0];
  if (type === 1 && C.player) {
    const n = (b.length - 1) >> 1;
    const dv = new DataView(b.buffer, 1, n * 2);
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = dv.getInt16(i * 2, true) / 32768;
    C.player.port.postMessage({ pcm: f }, [f.buffer]);
  } else if (type === 2) {
    const dv = new DataView(b.buffer);
    const n = dv.getUint16(1, true), binHz = dv.getFloat32(3, true);
    wfRow(b.subarray(7, 7 + n), binHz);
  } else if (type === 4) {
    const dv = new DataView(b.buffer);
    const center = Number(dv.getBigUint64(1, true));
    const span = dv.getUint32(9, true), n = dv.getUint16(13, true);
    rfRow(b.subarray(15, 15 + n), center, span);
  } else if (type === 5 || type === 6) {
    digiDesk.onBin(b);
  } else if (type === 7 || type === 8) {
    digi2.onBin(b);
  }
}

function setWfMsg(err) {
  const el = $('#wfMsg');
  el.classList.toggle('hidden', !err);
  if (err) el.innerHTML = `<div><b>${tr('audio.no_rig','Нет звука с трансивера')}</b>${err.replace(/[&<]/g, c => c === '&' ? '&amp;' : '&lt;')}` +
    (C.local ? '<br><br>' + tr('audio.select_panel','Выберите устройства в панели управления сервером (кнопка ⚙ вверху).') : '') + '</div>';
}
function setLink(ok, text, key) {
  $('#linkDot').className = 'dot ' + (ok ? 'ok' : 'bad');
  C.linkState = { ok: !!ok, text: text || '', key: key || null };
  const t = key ? tr(key, text) : text;
  if (t != null) $('#rigInfo').textContent = t;
}
function refreshLink() {
  const st = C.linkState; if (!st) return;
  if (!st.ok && st.key) $('#rigInfo').textContent = tr(st.key, st.text);
  else if (st.text != null) $('#rigInfo').textContent = st.text;
}

// ------------------------------------------------------------------ отрисовка состояния
function applyState(d, full) {
  const now = performance.now();
  if (full) {
    for (const k of Object.keys(R)) delete R[k];
    for (const k of Object.keys(S)) delete S[k];
    C.lockUntil = {};
  }
  if ('backend' in d) C.info.backend = d.backend;
  const swapWas = !!R.vfo;
  for (const [k, v] of Object.entries(d)) R[k] = v;
  if (!!R.vfo !== swapWas) remapVfo();
  for (const [k, v] of Object.entries(d)) {
    const vk = rawKey(k);                          // для freq/mode ключ вида
    if (!full && C.lockUntil[vk] > now) continue;  // пользователь только что крутил — не дёргаем
    S[vk] = v;
  }
  if ('connected' in d || 'radio_id' in d || 'fw0' in d || 'pwr_head' in d) {
    const head = S.pwr_head === 2 ? 'Optima/SPA-1' : (S.pwr_head === 1 ? 'Field' : '');
    setLink(S.connected, S.connected ? `${S.radio_id === '0840' ? 'FTX-1' : 'ID ' + (S.radio_id || '?')} ${head} ${S.fw0 ? 'FW ' + S.fw0 : ''}` : tr('conn.not_responding', 'трансивер не отвечает'), S.connected ? null : 'conn.not_responding');
  }
  renderFreq();
  renderMeters();
  renderBadges();
  renderControls(d);
  drawOverlay();
  if ('tuning' in d) $('#tuneState').textContent = S.tuning ? tr('status.tuning','Идёт настройка…') : '';
  if ('tx' in d) document.body.classList.toggle('txon', !!S.tx);
  if ('mode' in d) { C.autoLock = null; C.bwHist = []; updateSpan(true); renderSq(); pushGate(); renderCenterBtn(); }
  if ('busy' in d || 'tx' in d) pushGate();
  if ('sql' in d) renderSq();
  if (window.renderBackend) window.renderBackend();
}

function renderBadges() {
  $('#bMode').textContent = S.mode || '—';
  $('#bModeB').textContent = S.mode_b || '—';
  $('#bVfo').textContent = S.vfo ? 'SUB' : 'MAIN';
  $('#bVm').textContent = S.vm ? `MEM ${S.mem_ch != null ? String(S.mem_ch).padStart(3, '0') : ''}`.trim() : 'VFO';
  $('#bVm').classList.toggle('off', !S.vm);
  $('#bSplit').classList.toggle('off', !S.split);
  $('#bClar').classList.toggle('off', !(S.clar_rx || S.clar_tx));
  $('#bClar').textContent = (S.clar_rx || S.clar_tx) ? `CLAR ${S.clar > 0 ? '+' : ''}${S.clar}` : 'CLAR';
  $('#bLock').classList.toggle('off', !S.lock);
  $('#bTx').classList.toggle('off', !S.tx);
  $('#bBusy').classList.toggle('off', !S.busy);
  $('#freqB').textContent = S.freq_b ? fmtFreq(S.freq_b) : '—';
  $('#lblB').textContent = R.vfo ? 'A:' : 'B:';
  $('#bTxB').classList.toggle('hidden', !S.split);
  $('#btnSplit').classList.toggle('on', !!S.split);
  $('#btnLock').classList.toggle('on', !!S.lock);
  $$('#modes .btn').forEach(b => b.classList.toggle('on', b.dataset.m === S.mode));
  const bd = bandOf(S.freq_a || 0);
  $$('#bands .btn').forEach(b => b.classList.toggle('on', !!bd && b.dataset.b === bd[0]));
  const bandBadge = $('#bBand');
  if (bandBadge) bandBadge.textContent = bd
    ? (/^\d+$/.test(bd[0]) ? (bd[0] === '70' ? tr('app.band.70cm', '70см') : bd[0] + tr('app.band.m', 'м')) : bd[0])
    : '—';
  if (S.power != null) $('#pwrInfo').textContent = `${S.power}` + tr('status.power_w',' Вт');
}

const fmtFreq = f => { const s = String(Math.round(f)).padStart(7, '0'); return `${s.slice(0, -6)}.${s.slice(-6, -3)}.${s.slice(-3)}`; };

function renderFreq() {
  const el = $('#freqA'), f = Math.round(S.freq_a || 0);
  const s = String(f).padStart(7, '0');
  if (el.dataset.f === s) return;
  el.dataset.f = s;
  let html = '';
  for (let i = 0; i < s.length; i++) {
    const p = s.length - 1 - i, mult = 10 ** p;
    const cls = p < 3 ? 'd hz' : 'd';
    html += `<span class="${cls}" data-m="${mult}">${s[i]}</span>`;
    if (p === 6 || p === 3) html += `<span class="sep${p === 3 ? ' hz' : ''}">.</span>`;
  }
  el.innerHTML = html;
}

function setBar(id, frac, text) {
  const m = $(id); m.querySelector('i').style.width = (clamp(frac, 0, 1) * 100).toFixed(1) + '%';
  m.querySelector('.val').textContent = text;
}

// ------------------------------------------------------------------ аналоговый S-метр
const meterGauge = (() => {
  const cv = $('#meterGauge');
  if (!cv) return { update() {}, resize() {} };
  const ctx = cv.getContext('2d');
  const st = { pos: 0, target: 0, mode: 's', maxW: 100, available: false };
  let raf = 0, lastTime = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const swrFrac = v => v === Infinity ? 1 : Math.max(0, (v - 1) / (v + 1));
  const angle = f => (-123 + 66 * f) * Math.PI / 180;
  const point = (r, f) => [300 + Math.cos(angle(f)) * r, 505 + Math.sin(angle(f)) * r];
  function arc(r, from, to, color, width) {
    ctx.beginPath(); ctx.arc(300, 505, r, angle(from), angle(to));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function tick(r, f, major, color) {
    const a = point(r, f), b = point(r + (major ? 15 : 8), f);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b);
    ctx.strokeStyle = color; ctx.lineWidth = major ? 2.8 : 1.5; ctx.stroke();
  }
  function label(r, f, text, color, size = 22) {
    ctx.fillStyle = color; ctx.font = `600 ${size}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, ...point(r, f));
  }
  function draw() {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    // CSS-zoom (body zoom) не меняет devicePixelRatio, поэтому учитываем
    // фактический размер на экране — иначе на 27–34″ шкала мылится.
    const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
    const screenScale = Math.max(1, rect && rect.width ? rect.width / w : 1);
    const dpr = Math.min(3, (window.devicePixelRatio || 1) * screenScale);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    // Fixed proportions: a wide instrument window, pivot below the glass.
    const scale = Math.min(w / 600, h / 268);
    ctx.translate((w - 600 * scale) / 2, (h - 268 * scale) / 2); ctx.scale(scale, scale);
    const narrow = w < 210;
    const ink = mode => st.mode === mode ? '#ffe477' : '#b99b4c';
    const hot = st.mode === 's' ? '#ff974b' : '#b76e3c';
    ctx.lineCap = 'butt';
    ctx.save(); ctx.shadowColor = '#ffc447'; ctx.shadowBlur = st.available ? 2 : 0;
    arc(460, 0, .6, ink('s'), 3); arc(460, .6, 1, hot, 3);
    arc(452, 0, .6, ink('s'), 1); arc(452, .6, 1, hot, 1);
    arc(466, .6, 1, hot, 5);
    for (let i = 0; i <= 30; i++) tick(460, i / 30, i % 2 === 0, i > 18 ? hot : ink('s'));
    for (const v of (narrow ? [1, 5, 9, 11, 15] : [1, 3, 5, 7, 9, 11, 13, 15])) {
      label(491, v / 15, v <= 9 ? String(v) : '+' + ((v - 9) * 10), v > 9 ? hot : ink('s'), narrow ? 29 : 23);
    }
    arc(404, 0, 1, ink('po'), 2.5);
    for (let i = 0; i <= 24; i++) tick(404, i / 24, i % 4 === 0, ink('po'));
    for (const v of (narrow ? [0, 40, 80, 120] : [0, 20, 40, 60, 80, 100, 120])) {
      label(429, v / 120, String(v * st.maxW / 100), ink('po'), narrow ? 26 : 20);
    }
    arc(348, 0, 1, ink('swr'), 2.5);
    arc(342, swrFrac(3), 1, st.mode === 'swr' ? '#ed8644' : '#875a31', 4);
    for (const v of [1, 1.2, 1.5, 1.7, 2, 2.5, 3, 4, 5, 7, 10, Infinity]) {
      tick(348, swrFrac(v), [1, 1.5, 2, 3, 5, Infinity].includes(v), ink('swr'));
    }
    for (const v of (narrow ? [1, 2, 3, Infinity] : [1, 1.5, 2, 3, 5, Infinity])) {
      label(373, swrFrac(v), v === Infinity ? '∞' : String(v), ink('swr'), narrow ? 26 : 20);
    }
    ctx.textAlign = 'right'; ctx.font = '700 24px "Segoe UI", Arial, sans-serif';
    for (const [name, mode, x, y] of [['S', 's', 35, 125], ['PO', 'po', 67, 173], ['SWR', 'swr', 98, 222]]) {
      ctx.fillStyle = ink(mode); ctx.fillText(name, x, y);
    }
    ctx.textAlign = 'right'; ctx.font = '600 18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = hot; ctx.fillText('dB', 586, 115);
    ctx.fillStyle = ink('po'); ctx.fillText('W', 556, 164);
    ctx.restore();
    // Tapered ivory needle with a small shadow, no artificial random movement.
    const a = angle(st.pos), tip = point(482, st.pos), base = point(245, st.pos);
    ctx.save(); ctx.shadowColor = '#000'; ctx.shadowBlur = 5; ctx.shadowOffsetX = 3;
    ctx.fillStyle = st.available ? '#fff3c6' : '#b6a77b';
    ctx.beginPath(); ctx.moveTo(...tip);
    ctx.lineTo(base[0] - Math.sin(a) * 2.2, base[1] + Math.cos(a) * 2.2);
    ctx.lineTo(base[0] + Math.sin(a) * 2.2, base[1] - Math.cos(a) * 2.2);
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.font = '500 15px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'right';
    ctx.fillStyle = '#8f805c'; ctx.fillText('S  /  POWER  /  SWR', 555, 251);
  }
  function frame(time) {
    raf = 0;
    const dt = lastTime ? Math.min(64, time - lastTime) : 16; lastTime = time;
    const d = st.target - st.pos;
    st.pos += d * (1 - Math.exp(-dt / (d > 0 ? 90 : 240)));
    if (Math.abs(d) < .0005 || reduced.matches) st.pos = st.target;
    draw();
    if (st.pos !== st.target) raf = requestAnimationFrame(frame);
    else lastTime = 0;
  }
  function update(v) {
    if (opts.meterMode !== 'analog') {
      if (raf) cancelAnimationFrame(raf); raf = 0; lastTime = 0; return;
    }
    st.mode = v.mode; st.maxW = v.maxW; st.available = v.available;
    const target = v.mode === 'swr' ? swrFrac(v.swr) : v.mode === 'po' ? v.po / (v.maxW * 1.2) : v.s / 15;
    st.target = v.available && Number.isFinite(target) ? clamp(target, 0, 1) : 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  window.addEventListener('resize', draw);
  if (window.ResizeObserver) new ResizeObserver(draw).observe(cv);
  return { update, resize: draw };
})();


function renderMeters() {
  const s = interp(S_CAL, S.smeter || 0);
  const sTxt = s <= 9 ? 'S' + Math.round(s) : `S9+${Math.round((s - 9) * 10)}`;
  setBar('#mS', s / 15, sTxt);
  const maxW = S.pwr_head === 2 ? 100 : 10;
  let poW = 0, swr = 1, alcPct = 0;
  if (S.tx) {
    poW = interp(PO_CAL, S.po || 0);
    if (S.pwr_head !== 2) poW = poW / 10;
    setBar('#mPo', poW / (maxW * 1.2), `≈${poW.toFixed(poW < 10 ? 1 : 0)} Вт`);
    swr = interp(SWR_CAL, S.swr || 0);
    setBar('#mSwr', (swr - 1) / 4, swr.toFixed(1));
    alcPct = Math.round((S.alc || 0) / 2.55);
    setBar('#mAlc', (S.alc || 0) / 255, alcPct + '%');
  }
  const tx = !!S.tx;
  const mode = tx ? (opts.meterTx === 'swr' ? 'swr' : 'po') : 's';
  const raw = mode === 's' ? S.smeter : mode === 'po' ? S.po : S.swr;
  const available = !!S.connected && C.authed && Number.isFinite(raw);
  meterGauge.update({ mode, s, swr, po: poW, maxW, available });
  const value = $('#meterValue');
  const text = !available ? '—' : mode === 's' ? sTxt : mode === 'swr' ? swr.toFixed(1) : `≈${poW.toFixed(poW < 10 ? 1 : 0)} W`;
  if (value) value.textContent = text;
  $('#meterActive').textContent = tx ? 'TX · ' + mode.toUpperCase() : 'RX · S';
  $('#meterAnalog').dataset.active = mode;
  $('#meterGauge').setAttribute('aria-label', `${tx ? 'TX' : 'RX'} ${mode.toUpperCase()}: ${text}`);
  for (const button of $$('[data-meter-tx]')) {
    button.setAttribute('aria-pressed', String(button.dataset.meterTx === (opts.meterTx === 'swr' ? 'swr' : 'po')));
  }
}


for (const button of $$('[data-meter-tx]')) {
  button.addEventListener('click', () => {
    opts.meterTx = button.dataset.meterTx;
    store.set('opts', opts); renderMeters();
  });
}

function applyMeterMode() {
  const meters = $('#meters');
  if (!meters) return;
  const mode = ['analog', 'bars', 'off'].includes(opts.meterMode) ? opts.meterMode : 'bars';
  meters.dataset.mode = mode;
  document.body.classList.toggle('analog-meter', mode === 'analog');
  const analog = $('#meterAnalog');
  if (analog) analog.dataset.size = ['compact', 'normal', 'large'].includes(opts.meterSize) ? opts.meterSize : 'compact';
  const readout = $('#meterReadout');
  if (readout) readout.hidden = opts.meterReadouts === false;
  // Размер и цифровое значение нужны только аналоговой шкале.
  const sizeLabel = $('#optMeterSize') && $('#optMeterSize').closest('label');
  const readLabel = $('#optMeterReadouts') && $('#optMeterReadouts').closest('label');
  if (sizeLabel) sizeLabel.classList.toggle('hidden', mode !== 'analog');
  if (readLabel) readLabel.classList.toggle('hidden', mode !== 'analog');
  renderMeters();
  setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
}

// ------------------------------------------------------------------ частота: цифры, ручка, ввод
let freqSendT = 0, freqPending = null;
function setFreq(f) {
  if (S.backend === 'hamlib' && !(S.radio_caps?.keys || []).includes('freq_a')) return;
  f = clamp(Math.round(f), S.backend === 'hamlib' ? 1 : 30000, S.backend === 'hamlib' ? 100000000000 : 470000000);
  S.freq_a = f; R[rawKey('freq_a')] = f; renderFreq(); drawOverlay();
  C.lockUntil.freq_a = performance.now() + 900;
  freqPending = f;
  const now = performance.now();
  if (now - freqSendT > 60) flushFreq();
  else setTimeout(flushFreq, 60);
}
function flushFreq() {
  if (freqPending == null) return;
  freqSendT = performance.now();
  send({ t: 'set', k: rawKey('freq_a'), v: freqPending });
  freqPending = null;
  rememberBand();
}
const stepHz = () => +$('#step').value;
function nudge(n) { setFreq(Math.round(((S.freq_a || 0) + n * stepHz()) / stepHz()) * stepHz()); }

$('#freqA').addEventListener('wheel', e => {
  const d = e.target.closest('.d'); e.preventDefault();
  const m = d ? +d.dataset.m : stepHz();
  setFreq((S.freq_a || 0) + (e.deltaY < 0 ? m : -m));
}, { passive: false });
$('#freqA').addEventListener('click', e => {
  const d = e.target.closest('.d'); if (!d) return;
  const r = d.getBoundingClientRect(), up = e.clientY < r.top + r.height / 2;
  setFreq((S.freq_a || 0) + (up ? 1 : -1) * +d.dataset.m);
});
$$('[data-step]').forEach(b => b.addEventListener('click', () => nudge(+b.dataset.step)));
$('#step').value = store.get('step', 10);
$('#step').addEventListener('change', () => store.set('step', stepHz()));
$('#freqInput').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.target.value = ''; e.target.blur(); return; }
  if (e.key !== 'Enter') return;
  let v = parseFloat(e.target.value.replace(',', '.'));
  if (!isFinite(v)) return;
  if (v < 1000) v *= 1e6; else if (v < 1e6) v *= 1e3;   // МГц / кГц / Гц
  setFreq(v); e.target.value = ''; e.target.blur();
});
// Основная ручка настройки — как валкодер трансивера.
// Вращение по кругу: 100 делений на оборот, одно деление = выбранный шаг.
// Бросок с разгона — ручка докручивается по инерции и плавно останавливается.
const dial = (() => {
  const cv = $('#dial'), ctx = cv.getContext('2d');
  const STEPS = 100, STEP_A = 2 * Math.PI / STEPS;
  let angle = 0, acc = 0, last = null, hist = [], vel = 0, spinning = false, size = 0;
  function resize() {
    const css = cv.clientWidth; if (!css) return;
    const px = Math.round(css * (window.devicePixelRatio || 1) * (C.zoom || 1));
    if (px !== size) { size = px; cv.width = cv.height = px; }
    draw();
  }
  function draw() {
    if (!size) return;
    const R = size / 2, c = R;
    ctx.clearRect(0, 0, size, size);
    // посадочное кольцо с меткой
    ctx.beginPath(); ctx.arc(c, c, R * 0.99, 0, 2 * Math.PI); ctx.fillStyle = '#0a0f14'; ctx.fill();
    ctx.strokeStyle = '#36c5f0'; ctx.lineWidth = R * 0.04; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(c, R * 0.02); ctx.lineTo(c, R * 0.09); ctx.stroke();
    // тело ручки
    const body = R * 0.88;
    let g = ctx.createRadialGradient(c - body * 0.35, c - body * 0.4, body * 0.1, c, c, body);
    g.addColorStop(0, '#5a6672'); g.addColorStop(0.55, '#2b333c'); g.addColorStop(1, '#14191f');
    ctx.beginPath(); ctx.arc(c, c, body, 0, 2 * Math.PI); ctx.fillStyle = g; ctx.fill();
    // накатка по краю (вращается)
    ctx.save(); ctx.translate(c, c); ctx.rotate(angle);
    ctx.lineWidth = Math.max(1, R * 0.018);
    for (let i = 0; i < 90; i++) {
      const a = i * 2 * Math.PI / 90;
      ctx.strokeStyle = i % 2 ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.10)';
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * body * 0.86, Math.sin(a) * body * 0.86);
      ctx.lineTo(Math.cos(a) * body * 0.995, Math.sin(a) * body * 0.995); ctx.stroke();
    }
    // центральный диск со «шлифовкой»
    const cap = body * 0.8;
    g = ctx.createRadialGradient(-cap * 0.3, -cap * 0.35, cap * 0.05, 0, 0, cap);
    g.addColorStop(0, '#4b5561'); g.addColorStop(1, '#1d242c');
    ctx.beginPath(); ctx.arc(0, 0, cap, 0, 2 * Math.PI); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(0.5, R * 0.006);
    for (let r = cap * 0.15; r < cap; r += cap * 0.06) {
      ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 2 * Math.PI); ctx.stroke();
    }
    // лунка под палец
    const dx = 0, dy = -cap * 0.58, dr = cap * 0.2;
    g = ctx.createRadialGradient(dx + dr * 0.3, dy + dr * 0.35, dr * 0.1, dx, dy, dr);
    g.addColorStop(0, '#2c343d'); g.addColorStop(1, '#0d1116');
    ctx.beginPath(); ctx.arc(dx, dy, dr, 0, 2 * Math.PI); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = Math.max(1, R * 0.01);
    ctx.beginPath(); ctx.arc(dx, dy, dr, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.restore();
    // блик сверху
    g = ctx.createLinearGradient(0, c - body, 0, c + body);
    g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(c, c, body, 0, 2 * Math.PI); ctx.fillStyle = g; ctx.fill();
  }
  function turn(da) {                      // da — поворот в радианах (по часовой — вверх по частоте)
    angle += da; acc += da / STEP_A;
    const n = Math.trunc(acc);
    if (n) { acc -= n; nudge(n); }
    draw();
  }
  const angAt = e => { const r = cv.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  const nearCenter = e => { const r = cv.getBoundingClientRect(); return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < r.width * 0.08; };
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    spinning = false; vel = 0; last = angAt(e); hist = [[performance.now(), 0]];
  });
  cv.addEventListener('pointermove', e => {
    if (last == null || nearCenter(e)) return;
    const a = angAt(e); let d = a - last;
    if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
    last = a; turn(d);
    const now = performance.now(); hist.push([now, d]);
    while (hist.length && now - hist[0][0] > 90) hist.shift();
  });
  const release = () => {
    if (last == null) return;
    last = null;
    if (hist.length > 1) {
      const dt = (hist[hist.length - 1][0] - hist[0][0]) / 1000;
      const sum = hist.slice(1).reduce((s, h) => s + h[1], 0);
      vel = dt > 0.01 ? sum / dt : 0;              // рад/с
    }
    if (Math.abs(vel) > 4) { spinning = true; let t0 = performance.now();
      const step = now => {
        if (!spinning) return;
        const dt = (now - t0) / 1000; t0 = now;
        turn(vel * dt); vel *= Math.exp(-dt * 2.5);
        if (Math.abs(vel) > 0.6) requestAnimationFrame(step); else spinning = false;
      };
      requestAnimationFrame(step);
    }
  };
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
  cv.addEventListener('wheel', e => { e.preventDefault(); spinning = false; turn((e.deltaY < 0 ? 1 : -1) * STEP_A); }, { passive: false });
  return { resize, draw };
})();

// ------------------------------------------------------------------ диапазоны и виды работы
const bandMem = store.get('bandMem', {});
function rememberBand() {
  const b = bandOf(S.freq_a || 0);
  if (b) { bandMem[b[0]] = [S.freq_a, S.mode]; store.set('bandMem', bandMem); }
}
for (const b of BANDS) {
  const el = document.createElement('button');
  el.className = 'btn'; el.dataset.b = b[0];
  el.textContent = /^\d+$/.test(b[0]) ? (b[0] === '70' ? tr('app.band.70cm','70см') : b[0] + tr('app.band.m','м')) : b[0];
  // кнопка диапазона = кнопка BAND на трансивере: он сам восстанавливает свою частоту, вид работы,
  // полосу и прочее для этого диапазона (код BS совпадает с порядком в BANDS)
  const code = BANDS.indexOf(b);
  el.onclick = () => act('band', code);
  $('#bands').appendChild(el);
}
for (const m of MODES) {
  const el = document.createElement('button');
  el.className = 'btn'; el.dataset.m = m; el.textContent = m;
  el.onclick = () => { setParam('mode', m); renderBadges(); setTimeout(rememberBand, 300); };
  $('#modes').appendChild(el);
}

// ------------------------------------------------------------------ регуляторы
function fillSelect(sel, pairs) {
  if (!sel) return;
  sel.innerHTML = pairs.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
}
function fmtVal(el, v) {
  const f = el.dataset.fmt;
  if (v == null) return '—';
  if (f === 'width') return (v == 0 ? 'по умолч. ' : '') + widthHz(v, S.mode) + ' Гц';
  if (f === 'apf') return ((v - 25) * 10) + ' Гц';
  if (f === 'delay') return delayMs(v) + ' мс';
  if (f === 'pitch') return (300 + v * 10) + ' Гц';
  return String(v);
}
function ctlValue(k) {
  if (k === 'preamp') return S['preamp' + bandType()];
  return S[k];
}
const bandType = () => (S.freq_a >= 420e6 ? 2 : S.freq_a >= 144e6 ? 1 : 0);

function initControls() {
  for (const el of $$('.ctl')) {
    const k = el.dataset.k, label = (el.dataset.labelKey && window.I18N) ? I18N.t(el.dataset.labelKey, el.dataset.label) : el.dataset.label;
    if (el.classList.contains('tog')) {
      el.innerHTML = `<span>${label}</span><span class="sw"></span>`;
      el.onclick = () => { const v = ctlValue(k) ? 0 : 1; setParam(k, v); renderControls({ [k]: v }); };
    } else if (el.classList.contains('sel')) {
      el.innerHTML = `<div class="hd"><span>${label}</span></div><select></select>`;
      const sel = $('select', el);
      const o = el.dataset.opts;
      if (o === 'modes') fillSelect(sel, MODES.map(m => [m, m]));
      else if (o !== 'ctcss') fillSelect(sel, o.split(',').map(p => p.split(':')));
      sel.onchange = () => setParam(k, isNaN(sel.value) ? sel.value : +sel.value);
    } else {
      el.innerHTML = `<div class="hd"><span>${label}</span><b>—</b></div><input type="range" min="${el.dataset.min}" max="${el.dataset.max}" step="${el.dataset.step || 1}">`;
      const r = $('input', el), b = $('b', el);
      let t = 0;
      r.oninput = () => {
        const v = +r.value; b.textContent = fmtVal(el, v);
        C.lockUntil[k] = performance.now() + 1200;
        const now = performance.now();
        if (now - t > 90) { t = now; setParam(k, v); }
        clearTimeout(r._t); r._t = setTimeout(() => setParam(k, +r.value), 120);
      };
      if (el.dataset.reset != null) b.ondblclick = () => { r.value = el.dataset.reset; r.oninput(); };
      if (el.dataset.reset != null) b.title = tr('app.reset_dbl','Двойной клик — сброс');
    }
  }
}


function rebuildControlsForLang() {
  if (typeof initControls === 'function') initControls();
  if (typeof renderControls === 'function') renderControls({});
}
window.addEventListener('langchange', rebuildControlsForLang);

function renderControls(d) {
  for (const el of $$('.ctl')) {
    const k = el.dataset.k;
    if (d && !(k in d) && !(k === 'preamp' && Object.keys(d).some(x => x.startsWith('preamp') || x === 'freq_a')) &&
        !(k === 'width' && 'mode' in d) && !(k === 'power' && 'pwr_head' in d)) continue;
    const v = ctlValue(k);
    el.classList.toggle('stale', v == null);
    if (el.classList.contains('tog')) { el.classList.toggle('on', !!v); continue; }
    if (el.classList.contains('sel')) {
      const sel = $('select', el);
      if (k === 'preamp') {
        const want = bandType() ? 'vhf' : 'hf';
        if (sel.dataset.kind !== want) { sel.dataset.kind = want; fillSelect(sel, want === 'hf' ? [[0, 'IPO'], [1, 'AMP1'], [2, 'AMP2']] : [[0, 'Выкл'], [1, 'Вкл']]); }
      }
      if (v != null && document.activeElement !== sel) sel.value = v;
      continue;
    }
    const r = $('input', el), b = $('b', el);
    if (k === 'power') {
      const spa = S.pwr_head === 2;
      r.min = spa ? 5 : 0.5; r.max = spa ? 100 : 10; r.step = spa ? 1 : 0.5;
    }
    if (v != null && !(C.lockUntil[k] > performance.now())) r.value = v;
    b.textContent = fmtVal(el, v);
  }
}
$$('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
$$('[data-set]').forEach(b => b.addEventListener('click', () => { const [k, v] = b.dataset.set.split(':'); setParam(k, +v); }));
// SPLIT как на FTX-1: частота SUB переносится в основной приёмник, частоты меняются местами (команда SV)
$('#btnSplit').onclick = () => { act('swap'); toast(tr('toast.split', 'SPLIT: A ⇄ B'), 1300); };
// кнопки-индикаторы в верхней строке
$('#bSplit').onclick = () => { act('swap'); toast(tr('toast.split', 'SPLIT: A ⇄ B'), 1300); };
$('#bLock').onclick = () => setParam('lock', S.lock ? 0 : 1);
$('#bClar').onclick = () => setParam('clar_rx', S.clar_rx ? 0 : 1);
$('#bVfo').onclick = () => setParam('vfo', S.vfo ? 0 : 1);
$('#bVm').onclick = () => { act(S.vm ? 'vfo_mode' : 'mem_mode'); S.vm = S.vm ? 0 : 1; renderBadges(); };
$('#btnLock').onclick = () => setParam('lock', S.lock ? 0 : 1);
$('#btnMemCh').onclick = () => act('mem_ch', +$('#memCh').value);

// ------------------------------------------------------------------ водопад
const wf = { canvas: $('#wf'), spec: $('#spec'), ov: $('#overlay'), lut: null, avg: null, binHz: 11.71875, n: 0, rows: 0 };
const PALETTES = {
  classic: [[0, 0, 0, 0], [0.15, 0, 0, 90], [0.35, 0, 110, 200], [0.55, 0, 220, 200], [0.72, 240, 230, 0], [0.88, 255, 80, 0], [1, 255, 255, 255]],
  yaesu: [[0, 0, 4, 20], [0.3, 0, 40, 120], [0.6, 30, 140, 255], [0.85, 160, 230, 255], [1, 255, 255, 255]],
  gray: [[0, 0, 0, 0], [1, 255, 255, 255]],
  fire: [[0, 0, 0, 0], [0.3, 90, 0, 0], [0.6, 230, 80, 0], [0.85, 255, 210, 40], [1, 255, 255, 230]],
};
function buildLut() {
  const floor = -130 + +$('#wfFloor').value * 0.5, range = +$('#wfRange').value;
  const pal = PALETTES[opts.palette] || PALETTES.classic;
  wf.lut = new Uint32Array(256);
  for (let v = 0; v < 256; v++) {
    const db = v / 2 - 130, x = clamp((db - floor) / range, 0, 1);
    let i = 1; while (i < pal.length - 1 && pal[i][0] < x) i++;
    const [x0, r0, g0, b0] = pal[i - 1], [x1, r1, g1, b1] = pal[i];
    const t = (x - x0) / ((x1 - x0) || 1);
    const r = r0 + (r1 - r0) * t, g = g0 + (g1 - g0) * t, b = b0 + (b1 - b0) * t;
    wf.lut[v] = (255 << 24) | (b << 16) | (g << 8) | r;   // little-endian RGBA
  }
  store.set('wfFloor', +$('#wfFloor').value); store.set('wfRange', +$('#wfRange').value);
}
$('#wfFloor').value = store.get('wfFloor', 70); $('#wfRange').value = store.get('wfRange', 80);
$('#wfFloor').oninput = buildLut; $('#wfRange').oninput = buildLut;

function sizeCanvases() {
  if (typeof dial !== 'undefined') dial.resize();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const c of [wf.spec, wf.ov]) { c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr); }
  wf.rows = Math.max(50, Math.round(wf.canvas.clientHeight));
  drawOverlay();
}
// AM/FM: на водопад приходит уже продетектированный звук, несущей в нём нет. Чтобы картинка
// была привычной (сигнал по центру), показываем звук зеркально: 0 Гц в середине, ±частоты по краям.
const mirrored = () => C.tab !== 'ft8' && opts.fmCenter === true && isAMFM(S.mode);
const rfView = () => !!(wf.rf && C.wfSrc === 'rf');
const viewSpan = () => (rfView() ? wf.rf.span : C.span);
function wfRow(row, binHz) {
  if (C.wfSrc === 'rf') return;        // кадры прежнего источника после переключения
  // FT8: водопад медленнее — видно 3–4 периода (как в JTDX/MSHV); соседние строки объединяются по максимуму
  const tNow = performance.now();
  if (C.wfT) C.wfRate = (C.wfRate || 30) * 0.95 + 0.05 * (1000 / Math.max(1, tNow - C.wfT));
  C.wfT = tNow;
  if (C.tab === 'ft8' && !mirrored()) {
    const secs = C.ftSecs ?? 20;     // сколько секунд помещается на водопаде
    // Считаем по фактической высоте холста. Фиксированная опора (450 строк) на
    // низком окне давала N=1: видно 3–5 с вместо выбранных 20, и подписи позывных
    // (они стоят на строке начала периода, 15 с назад) не попадали в кадр.
    const rows = Math.max(60, Math.round(wf.canvas.clientHeight || wf.rows || 450));
    // ceil, а не round: окно должно быть не короче выбранного, иначе на высокой
    // шкале подпись начала периода (15 с) снова уедет за кадр.
    const N = secs ? Math.max(1, Math.ceil((C.wfRate || 30) * secs / rows)) : 1;
    if (!C.ftAcc || C.ftAcc.length !== row.length) { C.ftAcc = Uint8Array.from(row); C.ftAccN = 0; }
    else for (let i = 0; i < row.length; i++) if (row[i] > C.ftAcc[i]) C.ftAcc[i] = row[i];
    if (++C.ftAccN < N) return;
    row = C.ftAcc; C.ftAcc = null;
  }
  if (mirrored()) {
    const n0 = row.length, r2 = new Uint8Array(n0 * 2 - 1);
    for (let i = 0; i < n0; i++) { r2[n0 - 1 - i] = row[i]; r2[n0 - 1 + i] = row[i]; }
    row = r2;
  }
  wf.binHz = binHz;
  paintWfRow(row);
  window.ft8Desk && ft8Desk.onRow();
}
// Широкий водопад трансивера (FT-710/FTDX10/FTDX101, USB-scope).
// Уровни относительные: та же палитра, но шкала частот абсолютная.
function rfRow(row, center, span) {
  if (C.wfSrc !== 'rf' || !row.length) return;
  const prev = wf.rf;
  wf.rf = { center, span };
  wf.rfSpan = span;
  wf.binHz = span / Math.max(1, row.length - 1);
  if (prev && (Math.abs(prev.center - center) > Math.max(100, span * 0.005) || Math.abs(prev.span - span) > 100)) {
    // center/span changed - old rows are misaligned
    wf.avg = null;
    if (wf.canvas.width) wf.canvas.getContext('2d').clearRect(0, 0, wf.canvas.width, wf.canvas.height);
  }
  paintWfRow(row);
  renderWfMode();
}
function paintWfRow(row) {
  if (!wf.lut) buildLut();
  const n = row.length;
  const cv = wf.canvas, ctx = cv.getContext('2d');
  if (cv.width !== n || cv.height !== wf.rows) {
    // при смене размера сохраняем накопленную картинку
    const keep = cv.width && cv.height ? Object.assign(document.createElement('canvas'), { width: cv.width, height: cv.height }) : null;
    if (keep) keep.getContext('2d').drawImage(cv, 0, 0);
    cv.width = n; cv.height = wf.rows; wf.avg = null; wf.img = ctx.createImageData(n, 1);
    if (keep) ctx.drawImage(keep, 0, 0, keep.width, keep.height, 0, 0, n, keep.height);
  }
  ctx.drawImage(cv, 0, 0, n, cv.height - 1, 0, 1, n, cv.height - 1);
  const px = new Uint32Array(wf.img.data.buffer);
  for (let i = 0; i < n; i++) px[i] = wf.lut[row[i]];
  ctx.putImageData(wf.img, 0, 0);
  // спектр — со сглаживанием
  if (!wf.avg || wf.avg.length !== n) wf.avg = Float32Array.from(row);
  for (let i = 0; i < n; i++) wf.avg[i] = wf.avg[i] * 0.6 + row[i] * 0.4;
  drawSpectrum();
}
function drawSpectrum() {
  const c = wf.spec, ctx = c.getContext('2d'), W = c.width, H = c.height, a = wf.avg;
  ctx.clearRect(0, 0, W, H);
  if (!a) return;
  const floor = -130 + +$('#wfFloor').value * 0.5, range = +$('#wfRange').value;
  const span = viewSpan();
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    const i = (mirrored() && !rfView()) ? Math.min(a.length - 1, Math.round(x / W * (a.length - 1)))
      : Math.min(a.length - 1, Math.round(x / W * span / wf.binHz));
    const y = H - clamp((a[i] / 2 - 130 - floor) / range, 0, 1) * (H - 4);
    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = 'rgba(54,197,240,.18)'; ctx.fill();
  ctx.strokeStyle = '#7fe3ff'; ctx.lineWidth = Math.max(1, W / 900); ctx.stroke();
}
// Наложение: шкала, полоса фильтра, режектор, тон CW
function passband() {
  const m = S.mode || '', bw = widthHz(S.width || 0, m), sh = S.ifshift_on ? (S.ifshift || 0) : 0;
  if (isCW(m)) return [pitchHz() - bw / 2 + sh, pitchHz() + bw / 2 + sh];
  if (isAMFM(m)) return [0, bw / 2];
  const center = bw <= 2400 ? 1500 : 300 + bw / 2;
  return [Math.max(0, center - bw / 2 + sh), center + bw / 2 + sh];
}
function drawOverlay() {
  window.dxDesk?.markers();
  const c = wf.ov; if (!c.width) return;
  const mir = mirrored();
  const ctx = c.getContext('2d'), W = c.width, H = c.height, span = viewSpan(),
    X = hz => mir ? (0.5 + hz / (2 * span)) * W : hz / span * W;
  const dpr = W / c.clientWidth;
  ctx.clearRect(0, 0, W, H);
  if (rfView()) { drawOverlayRf(ctx, W, H, dpr); return; }
  let [lo, hi] = passband();
  if (mir) lo = -hi;
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(X(lo), 0, X(hi) - X(lo), H);
  ctx.strokeStyle = 'rgba(255,211,77,.7)'; ctx.lineWidth = dpr;
  ctx.beginPath(); ctx.moveTo(X(lo), 0); ctx.lineTo(X(lo), H); ctx.moveTo(X(hi), 0); ctx.lineTo(X(hi), H); ctx.stroke();
  if (isCW(S.mode)) { ctx.strokeStyle = '#ff5a4d'; ctx.beginPath(); ctx.moveTo(X(pitchHz()), 0); ctx.lineTo(X(pitchHz()), H); ctx.stroke(); }
  if (C.cwMark) {                                   // частота, которую слушает декодер CW
    ctx.strokeStyle = '#3ddc84'; ctx.setLineDash([2 * dpr, 3 * dpr]); ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.moveTo(X(C.cwMark), 0); ctx.lineTo(X(C.cwMark), H); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = dpr;
  }
  for (const [hz, col, bw] of C.ftMarks || []) {    // FT8: RX (зелёная) и TX (красная) — скобки шириной сигнала, как в JTDX
    const x0 = X(hz), x1 = X(hz + bw), yT = H * 0.28;
    ctx.fillStyle = col; ctx.globalAlpha = 0.18; ctx.fillRect(x0, yT, x1 - x0, H - yT); ctx.globalAlpha = 1;
    ctx.fillRect(x0, yT - 5 * dpr, x1 - x0, 3 * dpr);
    ctx.fillRect(x0, yT - 5 * dpr, 1.5 * dpr, 10 * dpr); ctx.fillRect(x1 - 1.5 * dpr, yT - 5 * dpr, 1.5 * dpr, 10 * dpr);
  }
  for (const [hz, col] of (C.dgMarks || []).concat(C.dgMarks2 || [])) {    // RTTY mark/space, факс чёрный/белый
    ctx.strokeStyle = col; ctx.setLineDash([3 * dpr, 3 * dpr]); ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.moveTo(X(hz), 0); ctx.lineTo(X(hz), H); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = dpr;
  }
  if (S.notch) { ctx.strokeStyle = '#ff7ad9'; ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.beginPath(); ctx.moveTo(X(S.notch_freq), 0); ctx.lineTo(X(S.notch_freq), H); ctx.stroke(); ctx.setLineDash([]); }
  // шкала: Гц звука + частота в эфире
  const stepK = span <= 4000 ? 500 : span <= 6000 ? 1000 : span <= 12000 ? 2000 : 4000;
  ctx.font = `${11 * dpr}px Consolas, monospace`; ctx.fillStyle = 'rgba(220,235,245,.75)';
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  for (let hz = stepK; hz < span; hz += stepK) {
    for (const sg of mir ? [-1, 1] : [1]) {
      const x = X(sg * hz);
      ctx.beginPath(); ctx.moveTo(x, H * 0.28 - 6 * dpr); ctx.lineTo(x, H * 0.28); ctx.stroke();
      ctx.fillText((sg < 0 ? '−' : mir ? '+' : '') + (hz / 1000).toFixed(stepK < 1000 ? 1 : 0) + 'k', x + 3 * dpr, H * 0.28 - 4 * dpr);
    }
  }
  if (mir) {                                         // центр = частота настройки
    ctx.strokeStyle = 'rgba(255,211,77,.9)'; ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,211,77,.95)'; ctx.fillText(fmtFreq(S.freq_a || 0), W / 2 + 4 * dpr, 14 * dpr);
  }
}
function niceStep(span) {
  const raw = span / 7, pow = 10 ** Math.floor(Math.log10(Math.max(1, raw))), m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * pow;
}
function drawOverlayRf(ctx, W, H, dpr) {
  const { center, span } = wf.rf;
  const X = hz => W / 2 + (hz - center) / span * W;
  ctx.font = `${11 * dpr}px Consolas, monospace`;
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.fillStyle = 'rgba(220,235,245,.75)';
  const step = niceStep(span), lo = center - span / 2, hi = center + span / 2;
  const digits = step >= 100000 ? 2 : step >= 10000 ? 3 : 4;
  for (let hz = Math.ceil(lo / step) * step; hz <= hi; hz += step) {
    const x = X(hz);
    if (x < 2 * dpr || x > W - 2 * dpr) continue;
    ctx.beginPath(); ctx.moveTo(x, H * 0.28 - 6 * dpr); ctx.lineTo(x, H * 0.28); ctx.stroke();
    ctx.fillText((hz / 1e6).toFixed(digits), x + 3 * dpr, H * 0.28 - 4 * dpr);
  }
  // VFO-A marker (actual rig frequency)
  const vfo = S.freq_a || 0;
  if (vfo >= lo && vfo <= hi) {
    const vx = X(vfo);
    ctx.strokeStyle = 'rgba(255,211,77,.95)'; ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, H); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,211,77,.95)'; ctx.fillText(fmtFreq(vfo), vx + 4 * dpr, 14 * dpr);
  }
  // SDR center (faint) only if different from VFO
  if (Math.abs(center - vfo) > 1000) {
    const cx = W / 2;
    ctx.strokeStyle = 'rgba(120,180,255,.35)'; ctx.setLineDash([2 * dpr, 4 * dpr]);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke(); ctx.setLineDash([]);
  }
}
function audioToRf(a) {
  const f = S.freq_a || 0, m = S.mode;
  if (isCW(m)) return isLower(m) ? f - (a - pitchHz()) : f + (a - pitchHz());
  if (isAMFM(m)) return f;
  return isLower(m) ? f - a : f + a;
}
function tuneToAudio(a) {
  const m = S.mode, f = S.freq_a || 0;
  if (isAMFM(m)) { toast(tr('toast.nofinetune_amfm', 'В AM/FM подстройка по водопаду недоступна')); return; }
  const target = isCW(m) ? pitchHz() : 1500;
  setFreq(Math.round((isLower(m) ? f - (a - target) : f + (a - target)) / 10) * 10);
}
(() => {
  const w = $('#wfWrap'), cur = $('#wfCursor');
  const wfPoint = e => {
    const r = w.getBoundingClientRect(), f = clamp((e.clientX - r.left) / r.width, 0, 1);
    const scaleX = r.width / (w.clientWidth || r.width || 1); // учёт CSS transform/scale
    const x = (e.clientX - r.left) / scaleX;
    if (rfView()) return { rf: true, hz: wf.rf.center + (f - 0.5) * wf.rf.span, x };
    return { rf: false, hz: mirrored() ? Math.abs(f * 2 - 1) * C.span : f * C.span, x };
  };
  w.addEventListener('pointermove', e => {
    const p = wfPoint(e);
    cur.style.display = 'block'; cur.style.left = p.x + 'px';
    cur.dataset.f = p.rf ? fmtFreq(Math.round(p.hz / 10) * 10) : `${Math.round(p.hz)} Гц · ${fmtFreq(audioToRf(p.hz))}`;
  });
  w.addEventListener('pointerleave', () => { cur.style.display = 'none'; });
  w.addEventListener('dblclick', e => {
    const p = wfPoint(e);
    if (p.rf) { setFreq(Math.round(p.hz / 10) * 10); return; }
    if (C.tab === 'ft8') ft8Desk.pickWf(p.hz, 'both'); else tuneToAudio(p.hz);
  });
  w.addEventListener('click', e => {
    const p = wfPoint(e);
    if (C.tab === 'ft8') { ft8Desk.pickWf(p.hz, e.shiftKey ? 'tx' : 'rx'); return; }
    if (p.rf) { setFreq(Math.round(p.hz / 10) * 10); }
  });
  w.addEventListener('contextmenu', e => {            // правый клик — декодер CW слушает эту частоту
    e.preventDefault();
    if (rfView()) return;                            // в режиме радио частота абсолютная
    const a = wfPoint(e).hz;
    if (C.tab === 'digi') digiDesk.setFreq(Math.round(a));
    else if (C.tab === 'ft8') ft8Desk.pickWf(a, 'tx');
    else cwDesk.setFreq(Math.round(a));
  });
  let lastTap = 0;
  w.addEventListener('pointerup', e => {           // двойной тап на телефоне
    if (e.pointerType !== 'touch') return;
    const now = performance.now(), p = wfPoint(e);
    if (now - lastTap < 350) {
      if (p.rf) setFreq(Math.round(p.hz / 10) * 10);
      else if (C.tab === 'ft8') ft8Desk.pickWf(p.hz, 'both');
      else tuneToAudio(p.hz);
    }
    lastTap = now;
  });
  w.addEventListener('wheel', e => { e.preventDefault(); nudge(e.deltaY < 0 ? 1 : -1); }, { passive: false });
})();
// Обзор водопада. «Авто» — по измеренной полосе звука трансивера (в FM она шире, чем в SSB),
// пока не измерена — по виду работы.
// Авто-обзор: по измеренной полосе звука, но без дёрганья — только стандартные шаги,
// решение после 3 одинаковых замеров подряд, дальше обзор только расширяется, а сбрасывается
// при смене вида работы.
const SPAN_STEPS = [3000, 4000, 6000, 8000, 12000, 24000];
function autoSpan() {
  const m = S.mode || '';
  if (C.tab === 'ft8' && /^DATA/.test(m)) return 3000;     // FT8: весь участок 0–3000 Гц, как в JTDX
  if (C.autoLock && C.autoLock.mode === m) return C.autoLock.span;
  return /FM|C4FM/.test(m) ? 4000 : /^AM/.test(m) ? 4000 : isCW(m) ? 3000 : 4000;
}
function onBw(hz) {
  const m = S.mode || '';
  const cand = SPAN_STEPS.find(v => v >= hz * 1.05) || 24000;
  const L = C.autoLock && C.autoLock.mode === m ? C.autoLock : null;
  C.bwHist = (C.bwHist || []).concat(cand).slice(-5);
  const same = n => C.bwHist.length >= n && C.bwHist.slice(-n).every(v => v === C.bwHist[C.bwHist.length - 1]);
  if (!L && same(3)) C.autoLock = { mode: m, span: cand };
  else if (L && cand > L.span && same(5)) L.span = cand;
  updateSpan();
}
function updateSpan(force) {
  const span = C.wfMax || autoSpan();
  $$('#spanSeg button').forEach(x => x.classList.toggle('on', +x.dataset.v === C.wfMax));
  const ab = $('#spanSeg button[data-v="0"]');
  ab.textContent = C.wfMax ? tr('app.auto','Авто') : `${tr('app.auto','Авто')} ${(span / 1000).toFixed(span % 1000 ? 1 : 0)}k`;
  if (span === C.span && !force) return;
  C.span = span; wf.canvas.width = 0;
  send({ t: 'wf', on: true, max: span, src: C.wfSrc === 'rf' ? 'rf' : 'audio' });
  drawOverlay();
}
// Широкий водопад USB-scope доступен только на «обзорных» вкладках: на digi/FT8/CW
// нужны звуковые частоты (метки декодеров, полоса), поэтому там остаётся звук.
const RF_TABS = ['rx', 'tx', 'vfo'];
const wantRf = () => !!(C.wfScope && opts.rfWf !== false && RF_TABS.includes(C.tab));
// Переключение источника на сервере. Сервер подтверждает ответом wf_src (или отказом).
function syncWfSource(force) {
  const want = wantRf() ? 'rf' : 'audio';
  if (!force && C.wfSrc === want) { renderWfMode(); return; }
  C.wfSrc = want;
  if (want !== 'rf') wf.rf = null;
  send({ t: 'wf', on: true, max: C.span || 4000, src: want });
  renderWfMode(); drawOverlay();
}
let wfModeKey = '';
function renderWfMode() {
  const btn = $('#wfSrc'); if (!btn) return;
  const rf = rfView(), scoped = !!C.wfScope;
  const key = `${scoped}|${rf}|${C.wfSrc}|${wf.rfSpan || 0}|${C.tab}|${S.mode}`;
  if (key === wfModeKey) return;
  wfModeKey = key;
  btn.classList.toggle('hidden', !scoped);
  btn.classList.toggle('on', rf);
  const khz = (wf.rfSpan || 0) / 1000;
  btn.textContent = rf ? `RF ${khz >= 1000 ? (khz / 1000).toFixed(1) + 'M' : Math.round(khz) + 'k'}` : tr('wf.src.audio','Звук');
  btn.title = rf ? tr('app.wf.src.scope','Широкий водопад USB-scope трансивера. Нажмите, чтобы вернуться к звуковому')
    : tr('app.wf.src.audio','Звуковой водопад. Нажмите, чтобы включить широкий USB-scope (вкладки RX/TX/VFO)');
  $('#spanSeg').classList.toggle('hidden', rf);
  renderCenterBtn();
  const hint = $('#wfHint');
  if (hint) hint.textContent = rf
    ? tr('app.wf.hint.rf','Широкий водопад: шкала — абсолютная частота. Двойной клик — настроиться')
    : (C.tab === 'ft8' ? tr('app.wf.hint.ft8','Клик — RX, правый клик / Shift — TX, двойной — оба') : tr('app.wf.hint.audio','Двойной клик — настроиться на сигнал'));
}
(() => {
  const b = $('#wfSrc'); if (!b) return;
  b.onclick = () => {
    if (!C.wfScope) return;
    opts.rfWf = !opts.rfWf;
    saveOpts();
    wfModeKey = '';
    toast(opts.rfWf ? tr('app.wf.on','Широкий водопад включён (вкладки RX/TX/VFO)') : tr('app.wf.off','Водопад: звук с трансивера'));
    syncWfSource(true);
  };
})();
$$('#spanSeg button').forEach(b => {
  b.onclick = () => { C.wfMax = +b.dataset.v; store.set('wfMax', C.wfMax); updateSpan(true); };
});
function renderCenterBtn() {
  const b = $('#wfCenter'); if (!b) return;
  b.classList.toggle('hidden', rfView() || !isAMFM(S.mode));
  b.classList.toggle('on', opts.fmCenter === true);
}
$('#wfCenter').onclick = () => { opts.fmCenter = opts.fmCenter !== true; saveOpts(); renderCenterBtn(); updateSpan(true); };
renderCenterBtn();
window.addEventListener('resize', sizeCanvases);

// ------------------------------------------------------------------ шумодав
const isFMmode = m => /FM/.test(m || '');            // FM, FM-N, DATA-FM, C4FM…
function pushGate() {
  if (!C.player) return;
  C.player.port.postMessage({ gate: {
    // на SSB/CW/AM/DATA шумодав не нужен — только в FM
    mode: S.backend !== 'hamlib' && isFMmode(S.mode) ? opts.sqMode : 'off',
    busy: S.busy === undefined ? true : !!S.busy, thr: opts.sqThr,
    tx: !!S.tx || (C.pttPressed && C.txOwner), tailMs: opts.tail,
  } });
}
function renderSq() {
  $('#sqRow').classList.toggle('hidden', !isFMmode(S.mode));
  $$('#sqMode button').forEach(b => b.classList.toggle('on', b.dataset.v === opts.sqMode));
  $('#sqRadioCtl').classList.toggle('hidden', opts.sqMode === 'level');
  $('#sqLevelCtl').classList.toggle('hidden', opts.sqMode !== 'level');
  if (S.sql != null && !(C.lockUntil.sql > performance.now())) $('#sqRadio').value = S.sql;
  $('#sqRadioV').textContent = S.sql ?? '—';
  $('#sqThr').value = opts.sqThr; $('#sqThrV').textContent = opts.sqThr + ' дБ';
}
$$('#sqMode button').forEach(b => b.onclick = () => { opts.sqMode = b.dataset.v; saveOpts(); renderSq(); pushGate(); });
$('#sqThr').oninput = e => { opts.sqThr = +e.target.value; saveOpts(); renderSq(); pushGate(); };
$('#sqRadio').oninput = e => {
  $('#sqRadioV').textContent = e.target.value;
  clearTimeout(e.target._t); e.target._t = setTimeout(() => setParam('sql', +e.target.value), 80);
  C.lockUntil.sql = performance.now() + 1200;
};

// ------------------------------------------------------------------ звук приёма
async function ensureAudioContext() {
  if (C.ac) { if (C.ac.state === 'suspended') await C.ac.resume(); return C.ac; }
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac;
  try { ac = new AC({ latencyHint: 'interactive', sampleRate: 48000 }); }   // 48 кГц — как у трансивера
  catch { ac = new AC({ latencyHint: 'interactive' }); }
  await ac.audioWorklet.addModule('worklets.js');
  C.ac = ac;
  C.player = new AudioWorkletNode(ac, 'rx-player', { outputChannelCount: [2] });
  C.player.connect(ac.destination);
  C.player.port.postMessage({ rate: C.rate || 16000 });
  C.player.port.onmessage = e => {
    if (e.data.sq) {
      const q = e.data.sq;
      $('#sqLamp').className = 'sq-lamp ' + (C.audioOn ? (q.open ? 'open' : 'closed') : '');
      $('#sqLvl').textContent = C.audioOn ? `${Math.round(q.lvl)} дБ` : '';
      return;
    }
    const s = e.data.stat; if (!s) return;
    $('#audioStat').textContent = `${tr('app.rx','Приём')}: ${C.rate / 1000} kHz, ${ac.sampleRate / 1000} kHz, ${s.ms} ms, underruns ${s.under}, ${((s.adj - 1) * 100).toFixed(2)} %`;
  };
  C.player.port.postMessage({ gain: C.gain });
  pushGate();
  return ac;
}
$('#btnAudio').onclick = async () => {
  try {
    await ensureAudioContext();
  } catch (e) { toast(tr('toast.audio_unavail', 'Звук недоступен: ') + e.message); return; }
  C.audioOn = !C.audioOn;
  C.player.port.postMessage({ reset: true });
  send({ t: 'audio', on: C.audioOn, rate: C.rate });
  $('#btnAudio').textContent = C.audioOn ? ('🔊 ' + tr('top.audio_label','Звук').replace(/^🔊\s*/,'').replace(/^🔇\s*/,'')) : ('🔇 ' + tr('top.audio_label','Звук').replace(/^🔊\s*/,'').replace(/^🔇\s*/,''));
  $('#btnAudio').classList.toggle('on', !!C.audioOn);
  store.set('audioOn', C.audioOn);
};
$('#volume').value = C.gain * 100;
$('#volume').oninput = e => { C.gain = e.target.value / 100; store.set('vol', +e.target.value); C.player && C.player.port.postMessage({ gain: C.gain }); };

// ------------------------------------------------------------------ прошивки трансивера
function renderFw() {
  const names = ['MAIN', 'DISPLAY', 'SDR', 'DSP', 'SPA-1', 'FC-80'];
  const parts = names.map((n, i) => S['fw' + i] && S['fw' + i] !== '?' ? `${n} ${S['fw' + i]}` : '').filter(Boolean);
  $('#fwInfo').textContent = parts.length ? tr('app.fw','Прошивки трансивера: ') + parts.join(' · ') : '';
}

// ------------------------------------------------------------------ микрофон и PTT
function micErrorText(e) {
  const n = e && e.name, m = (e && e.message) || '';
  if (n === 'NotAllowedError' && /system/i.test(m))
    return tr('app.mic.win','Windows запрещает программам доступ к микрофону. Параметры Windows → Конфиденциальность и защита → Микрофон: включите «Доступ к микрофону» и «Разрешить классическим приложениям доступ к микрофону», затем перезапустите браузер.');
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return tr('app.mic.browser','браузер запретил микрофон для этого сайта. Нажмите значок слева от адреса → «Микрофон» → разрешить и обновите страницу.');
  if (n === 'NotFoundError' || n === 'OverconstrainedError')
    return tr('app.mic.notfound','микрофон не найден. Подключите микрофон/гарнитуру или выберите другой в списке «Микрофон этого устройства» (и проверьте, что он не отключён в Параметры → Система → Звук → Ввод).');
  if (n === 'NotReadableError' || n === 'AbortError')
    return tr('app.mic.busy','микрофон занят или не запускается: закройте программы, которые держат его монопольно (Discord, Zoom, OBS), или снимите галочку «Разрешить приложениям монопольный режим» в свойствах микрофона.');
  return (n ? n + ': ' : '') + m;
}
async function startMic() {
  if (C.micStream) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast(tr('toast.mic_https', 'Микрофон недоступен: откройте пульт по https:// (или http://localhost на самом ПК)'), 6000);
    return false;
  }
  const ac = await ensureAudioContext();
  try {
    C.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: opts.micId ? { exact: opts.micId } : undefined, channelCount: 1,
        echoCancellation: opts.echo, noiseSuppression: opts.ns, autoGainControl: opts.agc,
      },
    });
  } catch (e) {
    const why = micErrorText(e);
    toast(tr('toast.mic_denied', 'Нет доступа к микрофону: ') + why, 9000);
    const r = $('#micTestRes'); if (r) r.textContent = '✗ ' + why;
    return false;
  }
  const src = ac.createMediaStreamSource(C.micStream);
  const hp = new BiquadFilterNode(ac, { type: 'highpass', frequency: 120 });
  const lp = new BiquadFilterNode(ac, { type: 'lowpass', frequency: C.rate === 8000 ? 3200 : 3800, Q: 0.7 });
  C.micGainNode = new GainNode(ac, { gain: opts.micGain / 100 });
  C.micNode = new AudioWorkletNode(ac, 'mic-capture');
  C.micRate = C.rate; C.micNode.port.postMessage({ rate: C.rate });
  const sink = new GainNode(ac, { gain: 0 });
  src.connect(hp).connect(lp).connect(C.micGainNode).connect(C.micNode).connect(sink).connect(ac.destination);
  C.micNode.port.onmessage = e => {
    const { pcm, rms } = e.data;
    $('#micLevel').style.width = clamp((20 * Math.log10(rms + 1e-6) + 50) / 50, 0, 1) * 100 + '%';   // -50..0 дБ
    if (!C.txOwner || !C.pttPressed) return;
    // [3][частота/8000][PCM int16]: частота едет с каждым кадром — сервер не может её перепутать
    const b = new Uint8Array(2 + pcm.length * 2), dv = new DataView(b.buffer);
    b[0] = 3; b[1] = C.micRate / 8000;
    for (let i = 0; i < pcm.length; i++) dv.setInt16(2 + i * 2, clamp(pcm[i], -1, 1) * 32767, true);
    if (C.ws && C.ws.readyState === 1 && C.ws.bufferedAmount < 64000) C.ws.send(b);
  };
  updatePtt();
  listMics();
  return true;
}
async function pttDown() {
  if (C.pttPressed) return;
  if (C.pttBusy) { toast(tr('toast.tx_busy', 'Передача занята другим подключением')); return; }
  C.pttPressed = true; updatePtt();
  if (!(await startMic())) { C.pttPressed = false; updatePtt(); return; }
  if (!C.pttPressed) return;                // отпустили, пока включался микрофон
  send({ t: 'ptt', on: true });
  if (opts.muteTx && C.player) C.player.port.postMessage({ mute: true });
  pushGate();
  clearInterval(C.keepalive);
  C.keepalive = setInterval(() => send({ t: 'ptt_alive' }), 400);
}
function pttUp() {
  if (!C.pttPressed) return;
  C.pttPressed = false;
  clearInterval(C.keepalive);
  send({ t: 'ptt', on: false });
  if (C.player) C.player.port.postMessage({ mute: false });
  pushGate();
  updatePtt();
}
function updatePtt() {
  const b = $('#ptt');
  b.classList.toggle('ready', !!C.micStream);
  b.classList.toggle('active', !!(C.pttPressed && C.txOwner));
  b.classList.toggle('busy', !!C.pttBusy);
  $('#pttState').textContent = C.pttBusy ? tr('app.ptt.other','Передаёт другой клиент')
    : C.pttPressed ? (C.txOwner ? tr('app.ptt.tx','ПЕРЕДАЧА') : tr('app.ptt.starting','Включаю…'))
      : C.micStream ? tr('app.ptt.ready','Микрофон готов') : tr('app.ptt.wait','Микрофон — по PTT');
}
setInterval(() => {
  $('#txTimer').textContent = (C.txOwner && C.txStart) ? `TX ${Math.floor((performance.now() - C.txStart) / 1000)} с` : '';
}, 250);
(() => {
  const b = $('#ptt');
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); b.setPointerCapture(e.pointerId);
    if (opts.pttMode === 'toggle') { C.pttPressed ? pttUp() : pttDown(); } else pttDown();
  });
  const up = () => { if (opts.pttMode === 'hold') pttUp(); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => { if (opts.pttMode === 'hold') pttUp(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pttUp(); });
})();

// ------------------------------------------------------------------ вкладки
function activateTab(name, save = true) {
  if (!name) name = 'rx';
  $$('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === name));
  $$('.tabs-panel > .tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + name));
  if (name === 'menu' && !menu.items) send({ t: 'menu_list' });
  C.tab = name;
  document.body.classList.toggle('tab-ft8', name === 'ft8');
  window.ft8Desk && ft8Desk.marks();
  if (typeof syncWfSource === 'function') syncWfSource();
  if (typeof updateSpan === 'function') updateSpan();
  if (typeof renderWfMode === 'function') renderWfMode();
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  if (save) store.set('tab', name);
}
$$('#tabs button').forEach(b => b.onclick = () => activateTab(b.dataset.tab));

// ------------------------------------------------------------------ рабочие экраны FT8 / DIGI
// FT8 и цифровые виды — не окна поверх пульта, а отдельные рабочие экраны.
// Радио-панель сжимается в строку (частота, режим, S-метр), остальное место
// отдаётся водопаду, спискам и управлению передачей. Ничего не перекрывается.
function opScreen() { return document.body.dataset.op || ''; }
let lastRadioTab = 'rx';
function updateOpButtons() {
  const op = opScreen();
  $$('.mode-switch button').forEach(b => {
    const on = (b.dataset.op || '') === op;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
function enterOp(name) {
  if (opScreen() === name) { exitOp(); return; }
  if (!opScreen() && ['dx', 'rx', 'tx', 'vfo', 'menu', 'cat'].includes(C.tab)) lastRadioTab = C.tab;
  document.body.dataset.op = name;
  document.body.classList.add('mode-screen');
  activateTab(name, false);
  updateOpButtons();
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}
function exitOp() {
  if (!opScreen()) return;
  delete document.body.dataset.op;
  document.body.classList.remove('mode-screen');
  activateTab(lastRadioTab || 'rx');
  updateOpButtons();
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}
$('#btnFt8').onclick = () => enterOp('ft8');
$('#btnDigi').onclick = () => enterOp('digi');
$('#btnCw').onclick = () => enterOp('cw');
$('#btnRadio').onclick = () => exitOp();

// ------------------------------------------------------------------ настройки в отдельном окне
(function setupSettings() {
  const tab = $('#tab-opts'), body = $('#settingsBody'), modal = $('#settingsModal');
  if (!tab || !body || !modal) return;
  tab.classList.add('on');
  body.append(tab);
  const open = () => { modal.classList.remove('hidden'); };
  const close = () => { modal.classList.add('hidden'); };
  $('#btnSettings').onclick = open;
  $('#settingsClose').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  window.openSettings = open;
})();

// ------------------------------------------------------------------ компоновка панелей
const layoutStore = {
  get mirror() { return !!store.get('layoutMirror', false); },
  set mirror(v) { store.set('layoutMirror', !!v); },
  get swap() { return !!store.get('layoutSwap', false); },
  set swap(v) { store.set('layoutSwap', !!v); },
  apply() {
    document.body.classList.toggle('layout-mirror', this.mirror);
    document.body.classList.toggle('layout-swap', this.swap);
    window.dispatchEvent(new Event('resize'));
  }
};
(function setupLayout() {
  const defs = [
    { name: 'radio', el: () => $('#colLeft'), label: tr('layout.panel.radio', 'Радио') },
    { name: 'wf', el: () => $('.wfpanel'), label: tr('layout.panel.wf', 'Водопад') },
    { name: 'work', el: () => $('.tabs-panel'), label: tr('layout.panel.work', 'Функции') }
  ];
  const grips = {};
  function ensureGrips() {
    for (const d of defs) {
      const el = d.el();
      if (!el || grips[d.name]) continue;
      const g = document.createElement('div');
      g.className = 'panel-grip';
      g.textContent = d.label;
      g.dataset.panel = d.name;
      el.prepend(g);
      grips[d.name] = g;
      g.addEventListener('pointerdown', e => startDrag(e, d.name));
    }
  }
  let ghost = null;
  function startDrag(e, name) {
    if (document.documentElement.dataset.workspace !== 'classic') return;
    e.preventDefault();
    if (!ghost) { ghost = document.createElement('div'); ghost.id = 'layoutGhost'; document.body.append(ghost); }
    const layout = $('.layout').getBoundingClientRect();
    document.body.classList.add('layout-dragging');
    const move = ev => {
      let text;
      if (name === 'radio') text = ev.clientX < layout.left + layout.width / 2
        ? tr('layout.drop.radio.left', 'Радио → слева') : tr('layout.drop.radio.right', 'Радио → справа');
      else if (name === 'wf') text = ev.clientY < layout.top + layout.height / 2
        ? tr('layout.drop.wf.top', 'Водопад → сверху') : tr('layout.drop.wf.bottom', 'Водопад → снизу');
      else text = ev.clientY < layout.top + layout.height / 2
        ? tr('layout.drop.work.top', 'Функции → сверху') : tr('layout.drop.work.bottom', 'Функции → снизу');
      ghost.textContent = text;
      ghost.style.left = (ev.clientX + 14) + 'px';
      ghost.style.top = (ev.clientY + 14) + 'px';
    };
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('layout-dragging');
      if (name === 'radio') {
        const want = ev.clientX >= layout.left + layout.width / 2;
        if (want !== layoutStore.mirror) { layoutStore.mirror = want; store.set('layoutMirror', want); }
      } else {
        const top = ev.clientY < layout.top + layout.height / 2;
        const wantSwap = name === 'wf' ? !top : top;
        if (wantSwap !== layoutStore.swap) { layoutStore.swap = wantSwap; store.set('layoutSwap', wantSwap); }
      }
      layoutStore.apply();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  function enter(force) {
    const on = force != null ? force : !document.body.classList.contains('layout-edit');
    if (on && document.documentElement.dataset.workspace !== 'classic') {
      toast(tr('layout.edit.classic', 'Компоновка доступна в классическом workspace'));
      return;
    }
    document.body.classList.toggle('layout-edit', on);
    $('#layoutBar').classList.toggle('hidden', !on);
    $('#btnLayout').classList.toggle('on', on);
    if (on) ensureGrips();
  }
  $('#btnLayout').onclick = () => enter();
  $('#layoutDone').onclick = () => enter(false);
  $('#layoutReset').onclick = () => { store.set('layoutMirror', false); store.set('layoutSwap', false); layoutStore.apply(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('layout-edit')) enter(false); });
  layoutStore.apply();
})();


// ------------------------------------------------------------------ меню EX
const menu = { items: null, vals: {} };
function buildMenu(items) {
  menu.items = items;
  const groups = [...new Set(items.map(i => i.ex.slice(0, 4)))];
  const secName = {}; items.forEach(i => secName[i.ex.slice(0, 4)] = i.section);
  fillSelect($('#menuGroup'), [['', tr('menu.all_sections', 'Все разделы')], ...groups.map(g => [g, `${g} ${menuGroupName(g.slice(0, 2))}: ${secName[g]}`])]);
  renderMenu();
}
function menuFiltered() {
  const q = $('#menuSearch').value.trim().toUpperCase(), g = $('#menuGroup').value;
  let re = null; try { re = q ? new RegExp(q.replace(/\s+/g, '.*')) : null; } catch { }
  return menu.items.filter(i => (!g || i.ex.startsWith(g)) && (!re || re.test(i.name) || i.ex.includes(q) || re.test((i.hint || '').toUpperCase())));
}
function renderMenu() {
  if (!menu.items) return;
  const list = menuFiltered(), box = $('#menuList');
  let html = '', sec = '';
  for (const i of list.slice(0, 450)) {
    const s = i.ex.slice(0, 4);
    if (s !== sec) { sec = s; html += `<div class="menu-sec">EX${s} · ${menuGroupName(s.slice(0, 2))} · ${i.section}</div>`; }
    const range = i.string ? tr('app.menu.text','текст') : `${i.min}…${i.max}`;
    const v = menu.vals[i.ex] ?? '';
    html += `<div class="mi" data-ex="${i.ex}"><span class="ex">EX${i.ex}</span><span class="nm">${i.name}${i.spa1 ? ' <small>' + tr('app.menu.spa1','только с SPA-1') + '</small>' : ''}<small>${range}${i.hint ? ' · ' + i.hint : ''}</small></span><input value="${v}" placeholder="?"><button class="btn small">✓</button></div>`;
  }
  if (list.length > 450) html += `<p class="muted small">${tr('app.menu.more','Показаны первые 450 из ')}${list.length}${tr('app.menu.more2','. Уточните поиск.')}</p>`;
  box.innerHTML = html || `<p class="muted">${tr('app.menu.none','Ничего не найдено')}</p>`;
}
function setMenuVal(ex, v) {
  menu.vals[ex] = v;
  const row = $(`.mi[data-ex="${ex}"]`);
  if (row && document.activeElement !== $('input', row)) { $('input', row).value = v ?? '—'; row.classList.remove('dirty'); }
}
function readMenu(exList) {
  for (let i = 0; i < exList.length; i += 50) send({ t: 'menu_get', ex: exList.slice(i, i + 50) });
}
$('#menuSearch').oninput = () => { clearTimeout(menu.t); menu.t = setTimeout(renderMenu, 200); };
$('#menuGroup').onchange = renderMenu;
$('#menuReadAll').onclick = () => {
  if (!menu.items) return;
  const l = menuFiltered();
  if (l.length > 120 && !confirm(tr('app.menu.read_confirm','Прочитать {n} пунктов? Это займёт около {s} с.').replace('{n}', l.length).replace('{s}', Math.ceil(l.length / 8)))) return;
  readMenu(l.map(i => i.ex));
};
$('#menuUsbShow').onclick = () => {
  $('#menuGroup').value = ''; $('#menuSearch').value = 'MOD_SOURCE|USB_MOD|USB_OUT|RPTT';
  renderMenu(); readMenu(menuFiltered().map(i => i.ex));
};
$('#menuList').addEventListener('input', e => { const r = e.target.closest('.mi'); r && r.classList.add('dirty'); });
function menuCommit(row) {
  const ex = row.dataset.ex, item = menu.items.find(i => i.ex === ex), v = $('input', row).value.trim();
  if (!item.string) {
    const n = parseInt(v, 10);
    if (!isFinite(n) || n < item.min || n > item.max) { toast(tr('app.menu.range','Допустимо {min}…{max}').replace('{min}', item.min).replace('{max}', item.max)); return; }
    send({ t: 'menu_set', ex, v: n });
  } else send({ t: 'menu_set', ex, v });
}
$('#menuList').addEventListener('click', e => { if (e.target.matches('button')) menuCommit(e.target.closest('.mi')); });
$('#menuList').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) menuCommit(e.target.closest('.mi')); });

// ------------------------------------------------------------------ консоль CAT
const POLL_RE = /^[<>](SM\d|RM\d|FA|FB|MD0|TX)/;
function catLine(l) {
  if (POLL_RE.test(l) && performance.now() > (catLine.showAll || 0)) return;   // опрос не засоряет журнал
  const o = $('#catOut');
  o.textContent += l + '\n';
  if (o.textContent.length > 40000) o.textContent = o.textContent.slice(-30000);
  o.scrollTop = o.scrollHeight;
}
$('#catSend').onclick = () => {
  const c = $('#catCmd').value.trim(); if (!c) return;
  if (!$('#catLog').checked) { $('#catLog').checked = true; send({ t: 'console', on: true }); }
  catLine.showAll = performance.now() + 1500;
  send({ t: 'raw', c }); $('#catCmd').select();
};
$('#catCmd').addEventListener('keydown', e => { if (e.key === 'Enter') $('#catSend').click(); });
$('#catLog').onchange = e => send({ t: 'console', on: e.target.checked });
$('#catClear').onclick = () => { $('#catOut').textContent = ''; };

// ------------------------------------------------------------------ CW-память
(() => {
  const texts = store.get('cwMem', ['CQ CQ DE R6AAF R6AAF K', 'TU 5NN', 'R6AAF', '73 TU', 'QRZ?']);
  const box = $('#cwMems');
  for (let i = 1; i <= 5; i++) {
    const row = document.createElement('div'); row.className = 'cw-mem';
    row.innerHTML = `<b>${i}</b><input class="text mono" maxlength="50"><button class="btn small">${tr('app.cw.write','Записать')}</button><button class="btn small">${tr('app.cw.play','▶ Передать')}</button>`;
    const inp = $('input', row); inp.value = texts[i - 1] || '';
    const [wr, play] = $$('button', row);
    inp.onchange = () => { texts[i - 1] = inp.value.toUpperCase(); inp.value = texts[i - 1]; store.set('cwMem', texts); };
    wr.onclick = () => { act('cw_store', [i, inp.value]); toast(tr('app.cw.stored','Ячейка {i} записана в трансивер').replace('{i}', i)); };
    play.onclick = () => act('cw_play', i);
    box.appendChild(row);
  }
})();

// ------------------------------------------------------------------ избранные частоты
function renderFavs() {
  const favs = store.get('favs', []), box = $('#favList');
  box.innerHTML = '';
  favs.forEach((f, i) => {
    const el = document.createElement('span'); el.className = 'fav';
    el.innerHTML = `<button class="btn">${f.name ? f.name + ' · ' : ''}${fmtFreq(f.f)} ${f.m || ''}</button><button class="btn small" title="${tr('app.fav.del','Удалить')}">×</button>`;
    const [go, del] = $$('button', el);
    go.onclick = () => { setFreq(f.f); if (f.m) setTimeout(() => setParam('mode', f.m), 120); };
    del.onclick = () => { favs.splice(i, 1); store.set('favs', favs); renderFavs(); };
    box.appendChild(el);
  });
}
$('#favAdd').onclick = () => {
  const favs = store.get('favs', []);
  favs.push({ name: $('#favName').value.trim(), f: S.freq_a, m: S.mode });
  store.set('favs', favs); $('#favName').value = ''; renderFavs();
};

// ------------------------------------------------------------------ настройки клиента
async function listMics() {
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
    const sel = $('#optMic'), cur = opts.micId;
    fillSelect(sel, [['', tr('app.mic.default','По умолчанию')], ...devs.map((d, i) => [d.deviceId, d.label || (tr('app.mic.n','Микрофон ') + (i + 1))])]);
    sel.value = cur;
  } catch { }
}
function saveOpts() { store.set('opts', opts); }
function resetMic() {
  if (C.micStream) { C.micStream.getTracks().forEach(t => t.stop()); C.micStream = null; }
  updatePtt();
}
function initOpts() {
  $('#optTail').value = opts.tail; $('#optTailV').textContent = opts.tail;
  $('#optTail').oninput = e => { opts.tail = +e.target.value; $('#optTailV').textContent = opts.tail; saveOpts(); pushGate(); };
  $('#optScale').value = String(opts.scale);
  $('#optScale').onchange = e => { opts.scale = e.target.value; saveOpts(); applyScale(); };
  $('#optRate').value = C.rate;
  $('#optRate').onchange = e => {
    C.rate = +e.target.value; store.set('rate', C.rate);
    C.player && C.player.port.postMessage({ rate: C.rate });
    if (C.micNode) { C.micRate = C.rate; C.micNode.port.postMessage({ rate: C.rate }); }
    send({ t: 'audio', on: C.audioOn, rate: C.rate });
  };
  $('#optMic').onchange = e => { opts.micId = e.target.value; saveOpts(); resetMic(); };
  $('#micTest').onclick = async () => {
    $('#micTestRes').textContent = tr('app.mic.enabling','Включаю микрофон…');
    if (await startMic()) {
      const lab = C.micStream.getAudioTracks()[0]?.label || tr('app.mic.n','Микрофон ').trim();
      $('#micTestRes').textContent = /USB Audio (Device|CODEC)/i.test(lab)
        ? tr('app.mic.is_rig','⚠ Сейчас выбран «{lab}» — это звуковая карта трансивера, а не ваш микрофон. Выберите свой в списке выше.').replace('{lab}', lab)
        : tr('app.mic.ok','✓ Работает: {lab}. Скажите что-нибудь — полоска слева от PTT должна двигаться.').replace('{lab}', lab);
    }
  };
  $('#optMicGain').value = opts.micGain; $('#optMicGainV').textContent = opts.micGain;
  $('#optMicGain').oninput = e => { opts.micGain = +e.target.value; $('#optMicGainV').textContent = opts.micGain; saveOpts(); if (C.micGainNode) C.micGainNode.gain.value = opts.micGain / 100; };
  for (const [id, k] of [['optEcho', 'echo'], ['optNs', 'ns'], ['optAgc', 'agc']]) {
    $('#' + id).checked = opts[k];
    $('#' + id).onchange = e => { opts[k] = e.target.checked; saveOpts(); resetMic(); };
  }
  for (const [id, k] of [['optMuteTx', 'muteTx']]) {
    $('#' + id).checked = opts[k];
    $('#' + id).onchange = e => { opts[k] = e.target.checked; saveOpts(); };
  }
  $('#optPttMode').value = opts.pttMode;
  $('#optPttMode').onchange = e => { opts.pttMode = e.target.value; saveOpts(); pttUp(); };
  $('#optPalette').value = opts.palette;
  $('#optPalette').onchange = e => { opts.palette = e.target.value; saveOpts(); buildLut(); };
  const mm = $('#optMeterMode');
  if (mm) {
    if (!['analog', 'bars', 'off'].includes(opts.meterMode)) opts.meterMode = 'bars';
    if (!['compact', 'normal', 'large'].includes(opts.meterSize)) opts.meterSize = 'compact';
    mm.value = opts.meterMode;
    mm.onchange = e => { opts.meterMode = e.target.value; opts.meterChoice = true; saveOpts(); applyMeterMode(); };
    const ms = $('#optMeterSize');
    ms.value = opts.meterSize;
    ms.onchange = e => { opts.meterSize = e.target.value; saveOpts(); applyMeterMode(); };
    const mr = $('#optMeterReadouts');
    mr.checked = opts.meterReadouts !== false;
    mr.onchange = e => { opts.meterReadouts = e.target.checked; saveOpts(); applyMeterMode(); };
    applyMeterMode();
  }
  const ol = $('#optLang');
  if (ol && window.I18N) {
    ol.value = I18N.getLang();
    ol.onchange = e => I18N.setLang(e.target.value);
  }
}

// ------------------------------------------------------------------ вход, полноэкранный режим, PWA
$('#loginBtn').onclick = () => {
  C.pw = $('#loginPw').value;              // запоминаем, только когда сервер пароль принял (hello_ok)
  $('#loginMsg').textContent = tr('app.login.checking','Проверяю…');
  if (C.ws && C.ws.readyState === 1) send({ t: 'hello', pw: C.pw, rate: C.rate || 16000 });
  else { try { C.ws && C.ws.close(); } catch { } connect(); }
};
$('#loginPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); });
$('#btnPanel').onclick = () => window.open('panel.html', 'ftx1panel', 'width=1080,height=860');
$('#btnFull').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => { });
};
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => { });

// ------------------------------------------------------------------ CW · Морзе: декодер, ИИ, передача
const cwDesk = (() => {
  const st = { dec: false, cyr: store.get('cwCyr', false), freq: 0, sq: store.get('cwSq', 15), auto: false,
    lastCall: '', lastRst: '599', analysis: null, op: {}, propTimer: null, txText: '', aiOk: null };
  const scr = $('#cwScreen');
  let cur = null;                                  // строка текущей передачи корреспондента
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const atBottom = () => scr.scrollTop + scr.clientHeight >= scr.scrollHeight - 30;
  function line(cls, text) {
    $('#cwHint')?.remove();
    const d = document.createElement('span'); d.className = cls; d.textContent = text;
    if (cur && cur.parentNode) scr.insertBefore(d, cur); else scr.appendChild(d);
    while (scr.children.length > 120) scr.removeChild(scr.firstChild);
    return d;
  }
  function curLine() {
    if (!cur || !cur.parentNode) { $('#cwHint')?.remove(); cur = document.createElement('span'); cur.className = 'rx-over cur'; scr.appendChild(cur); }
    return cur;
  }
  function addRx(ch) { const end = atBottom(); curLine().textContent += ch; if (end) scr.scrollTop = scr.scrollHeight; }
  function closeOver(item) {
    if (cur) { cur.classList.remove('cur'); cur.textContent = item.text; cur = null; }
    else line('rx-over', item.text);
    scr.scrollTop = scr.scrollHeight;
  }
  // ---- декодер
  function sendDec() { send({ t: 'cw_dec', on: st.dec, cyr: st.cyr, freq: st.freq, sq: st.sq }); }
  function renderDec() {
    $('#cwDecBtn').classList.toggle('on', st.dec);
    $('#cwDecBtn').textContent = st.dec ? tr('app.cw.dec_on','● Декодер вкл') : tr('app.cw.dec_off','○ Декодер выкл');
    $$('#cwAlpha button').forEach(b => b.classList.toggle('on', (b.dataset.v === 'cyr') === st.cyr));
    $('#cwSq').value = st.sq;
    const sel = $('#cwFreq');
    if (st.freq && ![...sel.options].some(o => +o.value === st.freq)) sel.add(new Option(st.freq + ' Гц', st.freq));
    sel.value = st.freq;
    if (!st.dec) { $('#cwInfo').textContent = '—'; C.cwMark = 0; drawOverlay(); }
  }
  function toggle(on = !st.dec) { st.dec = on; store.set('cwDec', on); sendDec(); renderDec(); if (on) note(tr('app.cw.dec_enabled','Декодер Морзе включён')); }
  function setFreq(hz) {
    if (!st.dec) toggle(true);
    st.freq = clamp(hz, 200, 3000); sendDec(); renderDec(); note(tr('app.cw.listening','Декодер слушает {hz} Гц').replace('{hz}', st.freq));
  }
  const note = m => toast(m, 1600);
  for (let f = 400; f <= 1000; f += 50) $('#cwFreq').add(new Option(f + ' Гц', f));
  $('#cwDecBtn').onclick = () => toggle();
  $$('#cwAlpha button').forEach(b => b.onclick = () => { st.cyr = b.dataset.v === 'cyr'; store.set('cwCyr', st.cyr); sendDec(); renderDec(); });
  $('#cwFreq').onchange = e => { st.freq = +e.target.value; sendDec(); };
  $('#cwSq').oninput = e => { st.sq = +e.target.value; store.set('cwSq', st.sq); clearTimeout(e.target._t); e.target._t = setTimeout(sendDec, 150); };
  $('#cwClear').onclick = () => { scr.innerHTML = ''; cur = null; send({ t: 'cw_clear' }); };
  $('#cwNew').onclick = () => send({ t: 'cw_new' });

  // ---- ИИ
  function renderAnalysis(a) {
    st.analysis = a;
    if (!a) { $('#cwAiBody').innerHTML = `<span class="muted small">${tr('app.cw.no_analysis','Разбора пока нет.')}</span>`; return; }
    if (a.call) st.lastCall = a.call;
    const me = a.calls_me && a.calls_me_strict;
    const chip = (k, v) => v ? `<span class="chip">${k} <b>${esc(v)}</b></span>` : '';
    const kind = { cq: tr('cw.kind.cq','общий вызов CQ'), answer: tr('cw.kind.answer','ответ на вызов'), report: tr('cw.kind.report','рапорт'), final: tr('cw.kind.final','завершение связи') }[a.kind] || '';
    $('#cwAiBody').innerHTML = `<div class="clean">${esc(a.clean || a.raw)}</div><div class="ru">${esc(a.ru)}</div>
      <div class="cw-chips">${me ? `<span class="chip me">${tr('cw.chip.calls_you','Зовёт вас')}</span>` : ''}${chip(tr('cw.chip.call','Позывной'), a.call)}${chip(tr('cw.chip.to','Кому'), a.to)}
      ${chip(tr('cw.chip.rst','RST вам'), a.rst)}${chip(tr('cw.chip.name','Имя'), a.name)}${chip(tr('cw.chip.qth','QTH'), a.qth)}${kind ? `<span class="chip">${kind}</span>` : ''}
      ${a.confidence ? `<span class="chip">${tr('cw.chip.conf','уверенность')} <b>${Math.round(a.confidence * 100)}%</b></span>` : ''}</div>`;
  }
  $('#cwAnalyze').onclick = () => send({ t: 'cw_ai_analyze' });
  $('#cwReply').onclick = () => send({ t: 'cw_ai_reply' });

  // ---- предложение ответа (по шаблону / автоответ)
  function showProposal(p) {
    clearInterval(st.propTimer);
    $('#cwProposal').classList.toggle('hidden', !p);
    if (!p) return;
    const tpl = p.model === 'template' || p.model === 'шаблон';
    $('#cwPropTitle').textContent = (p.auto ? tr('app.cw.auto','Автоответ') : tr('app.cw.reply','Ответ')) + (tpl ? tr('app.cw.reply_tpl',' (шаблон)') : '');
    $('#cwPropText').textContent = p.text; $('#cwPropRu').textContent = p.ru || '';
    const end = performance.now() + p.left * 1000;
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - performance.now()) / 1000));
      $('#cwPropCount').textContent = p.auto ? tr('app.cw.tx_in','передача через {s} с').replace('{s}', s) : '';
    };
    tick(); if (p.auto) st.propTimer = setInterval(tick, 200);
    st.prop = p;
  }
  $('#cwPropSend').onclick = () => { if (st.prop) send({ t: 'cw_send', text: st.prop.text }); send({ t: 'cw_proposal_cancel' }); };
  $('#cwPropEdit').onclick = () => { if (st.prop) $('#cwText').value = st.prop.text; send({ t: 'cw_proposal_cancel' }); $('#cwText').focus(); };
  $('#cwPropCancel').onclick = () => send({ t: 'cw_proposal_cancel' });

  // ---- передача
  function fill(t) {
    const o = st.op;
    return t.replace(/\{CALL\}/g, st.lastCall || '?').replace(/\{MY\}/g, o.my_call || '?').replace(/\{NAME\}/g, o.my_name || '')
      .replace(/\{QTH\}/g, o.my_qth || '').replace(/\{RST\}/g, st.lastRst || '599').replace(/\s+/g, ' ').trim();
  }
  const MACROS = [
    [tr('cw.macro.cq','CQ'), 'CQ CQ CQ DE {MY} {MY} {MY} K'],
    [tr('cw.macro.ans','Ответ'), '{CALL} DE {MY} {MY} K'],
    [tr('cw.macro.rst','Рапорт'), '{CALL} DE {MY} GM TNX FER CALL UR RST {RST} {RST} NAME {NAME} {NAME} QTH {QTH} {QTH} HW? {CALL} DE {MY} KN'],
    [tr('cw.macro.73','73'), '{CALL} DE {MY} TNX FER QSO 73 GL <SK>'],
    [tr('cw.macro.agn','AGN?'), 'AGN? AGN?'],
    [tr('cw.macro.qrz','QRZ?'), 'QRZ? DE {MY} K'],
    [tr('cw.macro.my','Позывной'), '{MY}'],
  ];
  $('#cwMacros').innerHTML = MACROS.map(([n, t], i) => `<button class="btn" data-i="${i}" title="${esc(t)}">${n}</button>`).join('');
  $('#cwMacros').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const tpl = MACROS[+b.dataset.i][1], t = fill(tpl);
    const missing = (tpl.includes('{CALL}') && !st.lastCall) || (tpl.includes('{MY}') && !st.op.my_call);
    if (e.shiftKey || missing) {                                          // Shift — только вставить в поле
      $('#cwText').value = t; $('#cwText').focus();
      if (missing) toast(!st.op.my_call ? tr('toast.need_mycall_op','Укажите свой позывной в разделе «Оператор»') : tr('app.cw.missing_call','Позывной корреспондента ещё неизвестен — впишите его вместо «?»'), 3500);
    } else send({ t: 'cw_send', text: t });
  };
  function sendText() {
    const t = fill($('#cwText').value);
    if (!t) return;
    send({ t: 'cw_send', text: t });
  }
  $('#cwSend').onclick = sendText;
  $('#cwStop').onclick = () => stop();
  $('#cwText').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendText(); }
  });
  function stop() { send({ t: 'cw_stop' }); }
  function txStart(item) {
    line('tx-line', item.text);
    st.txText = item.text;
    $('#cwTxLine').classList.remove('hidden');
    txProgress(0);
    $('#cwText').value = '';
  }
  function txProgress(pos) {
    const t = st.txText;
    $('#cwTxLine').innerHTML = `<span class="done">${esc(t.slice(0, pos))}</span>${esc(t.slice(pos))}`;
  }
  // ---- автоответ и оператор
  $('#cwAuto').onchange = e => {
    if (e.target.checked && !(st.op.my_call)) { e.target.checked = false; toast(tr('toast.need_mycall_op', 'Сначала укажите свой позывной в разделе «Оператор»'), 3000); return; }
    send({ t: 'cw_auto', on: e.target.checked });
    if (e.target.checked && !st.dec) toggle(true);
  };
  const opIds = { opCall: 'my_call', opName: 'my_name', opQth: 'my_qth', opExtra: 'my_extra' };
  for (const [id, k] of Object.entries(opIds)) {
    $('#' + id).addEventListener('change', e => send({ t: 'cw_op', [k]: e.target.value }));
  }
  $('#cwAutoDelay').onchange = e => send({ t: 'cw_op', cw_auto_delay: +e.target.value });
  $('#cwAutoMax').onchange = e => send({ t: 'cw_op', cw_auto_max: +e.target.value });
  function renderOp(op, delay, max) {
    st.op = op || st.op;
    for (const [id, k] of Object.entries(opIds)) if (document.activeElement !== $('#' + id)) $('#' + id).value = st.op[k] || '';
    if (delay) $('#cwAutoDelay').value = delay;
    if (max) $('#cwAutoMax').value = max;
  }

  // ---- сообщения сервера
  function on(m) {
    switch (m.t) {
      case 'cw_state':
        st.freq = m.dec.freq || 0;
        renderOp(m.op, m.auto_delay, m.auto_max);
        scr.innerHTML = ''; cur = null;
        for (const h of m.history) line(h.dir === 'tx' ? 'tx-line' : 'rx-over', h.clean && h.dir === 'rx' ? h.text : h.text);
        if (m.over) curLine().textContent = m.over;
        if (!m.history.length && !m.over) scr.innerHTML = `<span class="muted" id="cwHint">${tr('app.cw.hint','Включите декодер и настройтесь на телеграфную станцию: двойной клик по сигналу на водопаде (в режиме CW). Правый клик по сигналу — декодер будет слушать именно его.')}</span>`;
        renderAnalysis(m.analysis); showProposal(m.proposal);
        if (m.busy_tx && m.tx_text) { st.txText = m.tx_text; $('#cwTxLine').classList.remove('hidden'); txProgress(0); }
        $('#cwAuto').checked = false;
        renderDec();
        break;
      case 'cw_rx': addRx(m.text); break;
      case 'cw_info': {
        $('#cwInfo').innerHTML = `<span class="sig ${m.sig ? 'on' : ''}"></span>${m.wpm ? m.wpm + ' ' + tr('app.cw.wpm','WPM') + ' · ' : ''}${m.freq} Hz${m.auto ? tr('app.cw.auto_suffix',' (авто)') : ''} · ${m.snr} dB`;
        if (C.cwMark !== m.freq) { C.cwMark = m.freq; drawOverlay(); }
        break;
      }
      case 'cw_over': closeOver(m.item); break;
      case 'cw_clear': if (cur) { cur.remove(); cur = null; } break;
      case 'cw_new': scr.innerHTML = ''; cur = null; renderAnalysis(null); st.lastCall = ''; toast(tr('toast.new_qso', 'Новая связь')); break;
      case 'cw_dec': break;
      case 'cw_ai': renderAnalysis(m.a); break;
      case 'cw_proposal': showProposal(m.p); break;
      case 'cw_tx_start': txStart(m.item); break;
      case 'cw_tx_progress': txProgress(m.pos); break;
      case 'cw_tx_done':
        txProgress(st.txText.length);
        setTimeout(() => $('#cwTxLine').classList.add('hidden'), 1200);
        if (m.msg || m.msg_key) toast(resolveServerMsg(m), 5000); else if (!m.ok) toast(tr('toast.cw_stopped', 'Передача CW остановлена'));
        break;
      case 'cw_auto': if (!m.on) $('#cwAuto').checked = false; break;
      case 'cw_op': renderOp(m.op, m.auto_delay, m.auto_max); break;
      case 'cw_note': toast(resolveServerMsg(m), 4500); break;
    }
  }
  function resend() { if (store.get('cwDec', false)) { st.dec = true; sendDec(); } renderDec(); }
  return { on, toggle, setFreq, stop, resend };
})();

// ------------------------------------------------------------------ RTTY и метеофакс
const digiDesk = (() => {
  const st = { sub: store.get('dgSub', 'rtty'), rt: false, fx: false, fc: 2210, shift: 170, baud: 45.45,
    rows: [], W: 1809, fxState: 'idle', txText: '', slant: 0, fxC: 1900, fxD: 400 };
  const scr = $('#rtScreen'), cv = $('#fxCanvas'), wrap = $('#fxWrap');
  const RT_PRESETS = [
    ['', '— выбрать —'],
    ['ham', 'Любители 45,45 Бод / 170 Гц', { baud: 45.45, shift: 170 }],
    ['dwd1', 'DWD метео 4583 кГц (50/450)', { baud: 50, shift: 450, f: 4583000 }],
    ['dwd2', 'DWD метео 7646 кГц (50/450)', { baud: 50, shift: 450, f: 7646000 }],
    ['dwd3', 'DWD метео 10100,8 кГц (50/450)', { baud: 50, shift: 450, f: 10100800 }],
    ['dwd4', 'DWD метео 11039 кГц (50/450)', { baud: 50, shift: 450, f: 11039000 }],
    ['dwd5', 'DWD метео 14467,3 кГц (50/450)', { baud: 50, shift: 450, f: 14467300 }],
    ['dwdlf', 'DWD метео 147,3 кГц ДВ (50/85)', { baud: 50, shift: 85, f: 147300 }],
    ['h80', 'Любители 80 м — 3590 кГц', { baud: 45.45, shift: 170, f: 3590000, lsb: true }],
    ['h40', 'Любители 40 м — 7043 кГц', { baud: 45.45, shift: 170, f: 7043000, lsb: true }],
    ['h20', 'Любители 20 м — 14085 кГц', { baud: 45.45, shift: 170, f: 14085000, lsb: true }],
    ['h15', 'Любители 15 м — 21085 кГц', { baud: 45.45, shift: 170, f: 21085000, lsb: true }],
  ];
  const FX_PRESETS = [
    ['', '— выбрать —'],
    ['d1', 'DWD Пиннеберг 3855 кГц', 3855000], ['d2', 'DWD Пиннеберг 7880 кГц', 7880000],
    ['d3', 'DWD Пиннеберг 13882,5 кГц', 13882500],
    ['g1', 'Northwood GYA (Англия) 2618,5 кГц — ночью', 2618500], ['g2', 'Northwood GYA 4610 кГц', 4610000],
    ['g3', 'Northwood GYA 8040 кГц', 8040000], ['g4', 'Northwood GYA 11086,5 кГц — днём', 11086500],
    ['a1', 'Афины SVJ4 4481 кГц (утро)', 4481000], ['a2', 'Афины SVJ4 8105 кГц (утро)', 8105000],
    ['m1', 'Мурманск RKS-72 6328,5 кГц', 6328500], ['m2', 'Мурманск RGS-47 8444 кГц', 8444000],
    ['p1', 'С.-Петербург UGC 4212 кГц', 4212000],
  ];
  const fill = (sel, list) => { sel.innerHTML = list.map(p => `<option value="${p[0]}">${p[1]}</option>`).join(''); };
  fill($('#rtPreset'), RT_PRESETS); fill($('#fxPreset'), FX_PRESETS);

  // ---- переключатель RTTY / факс
  const PANES = { rtty: 'dgRtty', fax: 'dgFax', nx: 'dgNx', sstv: 'dgSstv', psk: 'dgPsk' };
  if (!PANES[st.sub]) st.sub = 'rtty';
  function renderSub() {
    $$('#dgSw button').forEach(b => b.classList.toggle('on', b.dataset.v === st.sub));
    for (const [k, id] of Object.entries(PANES)) $('#' + id).classList.toggle('hidden', st.sub !== k);
  }
  $$('#dgSw button').forEach(b => b.onclick = () => {
    st.sub = b.dataset.v; store.set('dgSub', st.sub); renderSub(); marks(); window.digi2 && digi2.marks();
  });
  renderSub();

  // ---- метки на водопаде
  function marks() {
    const m = [];
    const rt = st.rt && (st.sub === 'rtty' || !st.fx), fx = st.fx && (st.sub === 'fax' || !st.rt);
    if (rt) { m.push([st.fc - st.shift / 2, '#ffb547'], [st.fc + st.shift / 2, '#4fc3ff']); }
    if (fx) { m.push([st.fxC - st.fxD, '#bbbbbb'], [st.fxC + st.fxD, '#ffffff']); }
    C.dgMarks = m; drawOverlay();
  }

  // ================= RTTY
  function sendRt(extra = {}) {
    send({ t: 'rt_dec', on: st.rt, baud: +$('#rtBaud').value, shift: +$('#rtShift').value, fc: +$('#rtFc').value,
      pol: +$('#rtPol').value, usos: $('#rtUsos').checked, ...extra });
  }
  function renderRt() {
    $('#rtDecBtn').classList.toggle('on', st.rt);
    $('#rtDecBtn').textContent = st.rt ? tr('rt.dec_on','● Декодер вкл') : tr('rt.dec_off_btn','○ Декодер выкл');
  }
  $('#rtDecBtn').onclick = () => { st.rt = !st.rt; store.set('rtOn', st.rt); renderRt(); sendRt(); marks(); };
  ['#rtBaud', '#rtShift', '#rtFc', '#rtPol', '#rtUsos'].forEach(id => $(id).onchange = () => {
    store.set('rtCfg', { baud: $('#rtBaud').value, shift: $('#rtShift').value, fc: $('#rtFc').value, pol: $('#rtPol').value });
    st.fc = +$('#rtFc').value; st.shift = +$('#rtShift').value; sendRt(); marks();
  });
  const saved = store.get('rtCfg', null);
  if (saved) { $('#rtBaud').value = saved.baud; $('#rtShift').value = saved.shift; $('#rtFc').value = saved.fc; $('#rtPol').value = saved.pol; }
  st.fc = +$('#rtFc').value; st.shift = +$('#rtShift').value;
  $('#rtTune').onclick = () => { if (!st.rt) { st.rt = true; renderRt(); sendRt(); setTimeout(() => send({ t: 'rt_autotune' }), 2500); toast(tr('toast.listen_2s', 'Слушаю 2 с…')); } else send({ t: 'rt_autotune' }); };
  $('#rtClear').onclick = () => { scr.textContent = ''; };
  $('#rtPreset').onchange = e => {
    const p = RT_PRESETS.find(x => x[0] === e.target.value); if (!p || !p[2]) return;
    $('#rtBaud').value = String(p[2].baud); $('#rtShift').value = String(p[2].shift);
    st.shift = p[2].shift; st.fc = +$('#rtFc').value;
    if (p[2].f && p[2].lsb) {                       // любительский RTTY — по традиции в LSB, «частота» = mark
      setParam('mode', 'LSB'); setFreq(p[2].f + 2125);
      toast(tr('toast.rt_preset_lsb','LSB {freq} кГц: mark 2125, space 2295 Гц. Правый клик по сигналу — подстроить.').replace('{freq}', ((p[2].f + 2125) / 1000).toFixed(3)), 6000);
      $('#rtFc').value = 2210; st.fc = 2210;
    } else if (p[2].f) {                            // частота станции — середина между тонами; ставим её на центр декодера
      setParam('mode', 'USB'); setFreq(Math.round((p[2].f - st.fc) / 10) * 10);
      toast(tr('toast.rt_preset_usb','USB, {freq} кГц на центре {fc} Гц. Расписание станций меняется — сверяйтесь со свежим.').replace('{freq}', (p[2].f / 1000).toFixed(1)).replace('{fc}', st.fc), 6000);
    }
    if (!st.rt) { st.rt = true; renderRt(); }
    sendRt(); marks(); e.target.value = '';
  };
  function addText(t) {
    $('#rtHintS')?.remove();
    const end = scr.scrollTop + scr.clientHeight >= scr.scrollHeight - 30;
    scr.append(t.replace(/\r/g, ''));
    if (scr.textContent.length > 30000) scr.textContent = scr.textContent.slice(-20000);
    if (end) scr.scrollTop = scr.scrollHeight;
  }
  // передача
  const myCall = () => ($('#opCall').value || '').toUpperCase();
  const RT_MACROS = [['CQ', 'RYRYRY CQ CQ CQ DE {MY} {MY} {MY} PSE K'], ['RYRY', 'RYRYRYRYRYRYRYRYRY'],
    ['DE', 'DE {MY} {MY} K'], ['73', 'TNX FER QSO 73 GL DE {MY} SK']];
  $('#rtMacros').innerHTML = RT_MACROS.map((m, i) => `<button class="btn" data-i="${i}">${m[0]}</button>`).join('');
  $$('#rtMacros button').forEach(b => b.onclick = () => {
    const t = RT_MACROS[+b.dataset.i][1];
    if (t.includes('{MY}') && !myCall()) { toast(tr('toast.need_mycall_cw', 'Укажите свой позывной на вкладке CW · Морзе')); return; }
    rtSend(t);
  });
  function rtSend(t) {
    t = (t || '').replace(/\{MY\}/g, myCall()).toUpperCase().trim();
    if (!t) return;
    send({ t: 'rt_send', text: '\n' + t + '\n', reverse: $('#rtRev').checked });
  }
  $('#rtSend').onclick = () => rtSend($('#rtText').value);
  $('#rtStop').onclick = () => send({ t: 'rt_stop' });
  $('#rtText').addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); rtSend($('#rtText').value); } });
  function txProgress(p) {
    const el = $('#rtTxLine'), t = st.txText;
    el.innerHTML = `<span class="done">${esc(t.slice(0, p))}</span>${esc(t.slice(p))}`;
  }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ================= факс
  const ctx = cv.getContext('2d');
  let rowImg = null;
  function setW(W) {
    if (W === st.W && cv.width === W) return;
    st.W = W; cv.width = W; redraw();
  }
  function redraw() {
    const n = st.rows.length;
    cv.width = st.W; cv.height = Math.max(1, n);
    if (!n) { $('#fxEmpty').classList.remove('hidden'); return; }
    $('#fxEmpty').classList.add('hidden');
    const img = ctx.createImageData(st.W, n), d = img.data;
    for (let y = 0; y < n; y++) {
      const r = st.rows[y], o = y * st.W * 4;
      for (let x = 0; x < st.W; x++) { const v = r[x], k = o + x * 4; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
  }
  function addRow(i, r) {
    const n = st.rows.length;
    if (i < n) st.rows.length = i;                 // сервер начал заново
    st.rows.push(r);
    if (st.rows.length === 1 || cv.width !== r.length) { st.W = r.length; redraw(); return; }
    // растим холст порциями, чтобы не перерисовывать каждую строку
    if (cv.height < st.rows.length) {
      const keep = ctx.getImageData(0, 0, cv.width, cv.height);
      cv.height = st.rows.length + 60; ctx.fillStyle = '#0b1117'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.putImageData(keep, 0, 0);
    }
    if (!rowImg || rowImg.width !== r.length) rowImg = ctx.createImageData(r.length, 1);
    const d = rowImg.data;
    for (let x = 0; x < r.length; x++) { const k = x * 4; d[k] = d[k + 1] = d[k + 2] = r[x]; d[k + 3] = 255; }
    ctx.putImageData(rowImg, 0, st.rows.length - 1);
    $('#fxEmpty').classList.add('hidden');
    const end = wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 40;
    if (end) wrap.scrollTop = wrap.scrollHeight;
  }
  function sendFx(center) {
    send({ t: 'fax_dec', on: st.fx, lpm: +$('#fxLpm').value, ioc: +$('#fxIoc').value, auto: $('#fxAuto').checked,
      afc: $('#fxAfc').checked, ...(center ? { center } : {}) });
  }
  function renderFx() {
    $('#fxDecBtn').classList.toggle('on', st.fx);
    $('#fxDecBtn').textContent = st.fx ? tr('fx.dec_on','● Приём вкл') : tr('fx.dec_off_btn','○ Приём выкл');
  }
  $('#fxDecBtn').onclick = () => { st.fx = !st.fx; store.set('fxOn', st.fx); renderFx(); sendFx(); marks(); };
  ['#fxLpm', '#fxIoc', '#fxAuto', '#fxAfc'].forEach(id => $(id).onchange = () => sendFx());
  $('#fxCenter').onchange = () => sendFx(+$('#fxCenter').value);
  $('#fxStart').onclick = () => { if (!st.fx) { st.fx = true; renderFx(); sendFx(); marks(); } st.rows = []; redraw(); send({ t: 'fax_start' }); };
  $('#fxStop').onclick = () => send({ t: 'fax_stop' });
  const slant = (e, s) => send({ t: 'fax_slant', d: s * (e.shiftKey ? 10 : 50) });
  $('#fxSlM').onclick = e => slant(e, -1); $('#fxSlP').onclick = e => slant(e, 1);
  $('#fxPreset').onchange = e => {
    const p = FX_PRESETS.find(x => x[0] === e.target.value); if (!p || !p[2]) return;
    setParam('mode', 'USB'); setFreq(p[2] - 1900);
    $('#fxLpm').value = '120'; $('#fxIoc').value = '576';
    if (!st.fx) { st.fx = true; renderFx(); }
    sendFx(); marks();
    toast(tr('toast.fx_preset','USB {usb} кГц (на 1,9 кГц ниже {freq}). Ждём тон старта — карты идут по расписанию DWD.').replace('{usb}', ((p[2] - 1900) / 1000).toFixed(1)).replace('{freq}', (p[2] / 1000).toFixed(1)), 6000);
    e.target.value = '';
  };
  cv.addEventListener('click', e => {               // клик — здесь левый край карты
    const r = cv.getBoundingClientRect(), px = Math.round((e.clientX - r.left) / r.width * st.W);
    if (!st.rows.length) return;
    send({ t: 'fax_shift', px });
    st.rows = st.rows.map(row => { const o = new Uint8Array(row.length); o.set(row.subarray(px)); o.set(row.subarray(0, px), row.length - px); return o; });
    redraw(); toast(tr('toast.map_edge', 'Край карты сдвинут'));
  });
  $('#fxPng').onclick = () => {
    if (!st.rows.length) return toast(tr('toast.no_image', 'Картинки пока нет'));
    const a = document.createElement('a');
    const d = new Date(), z = n => String(n).padStart(2, '0');
    a.download = `fax_${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}.png`;
    const c2 = document.createElement('canvas'); c2.width = st.W; c2.height = st.rows.length;
    c2.getContext('2d').drawImage(cv, 0, 0);
    a.href = c2.toDataURL('image/png'); a.click();
  };
  $('#fxBig').onclick = () => { wrap.classList.toggle('big'); };
  $('#fxClose').onclick = () => wrap.classList.remove('big');
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && wrap.classList.contains('big')) wrap.classList.remove('big'); });
  const FX_ST = { idle: 'ждёт тон старта', phasing: 'фазирование…', image: 'приём карты' };

  // ================= сообщения
  function on(m) {
    switch (m.t) {
      case 'rt_state':
        st.fc = m.fc; st.shift = m.shift; st.baud = m.baud;
        $('#rtFc').value = m.fc; $('#rtShift').value = String(m.shift); $('#rtBaud').value = String(m.baud);
        marks(); break;
      case 'rt_rx': addText(m.text); break;
      case 'rt_info':
        $('#rtInfo').textContent = tr('rt.info','{fc} Гц · {shift}/{baud} · {pol} · ошибок {err}%').replace('{fc}', m.fc).replace('{shift}', m.shift).replace('{baud}', m.baud).replace('{pol}', m.pol).replace('{err}', m.err);
        if (m.fc !== st.fc) { st.fc = m.fc; marks(); }
        break;
      case 'rt_note': toast(resolveServerMsg(m), 5000); break;
      case 'rt_tx_start':
        st.txText = m.text.trim(); $('#rtTxLine').classList.remove('hidden'); txProgress(0);
        addText('\n» ' + st.txText + '\n'); break;
      case 'rt_tx_progress': txProgress(m.pos); break;
      case 'rt_tx_done':
        txProgress(st.txText.length); setTimeout(() => $('#rtTxLine').classList.add('hidden'), 1200);
        if (m.msg || m.msg_key) toast(resolveServerMsg(m), 6000); break;
      case 'fax_state':
        if (m.state === 'phasing' || (m.state === 'image' && !m.rows && st.fxState !== 'image')) { st.rows = []; redraw(); }
        st.fxState = m.state; if (m.W) st.W = m.W;
        if (m.slant !== undefined) $('#fxSlant').textContent = m.slant;
        if (m.lpm) $('#fxLpm').value = String(m.lpm);
        if (m.center) { st.fxC = m.center; st.fxD = m.dev || 400; $('#fxCenter').value = m.center; $('#fxAfc').checked = m.afc !== false; marks(); }
        if (m.ioc) $('#fxIoc').value = String(m.ioc);
        if (m.saved && m.saved.length) $('#fxSaved').textContent = tr('fx.saved_server','Сохранено на сервере (папка fax): ') + m.saved.slice(-4).join(', ');
        $('#fxInfo').textContent = (FX_ST[m.state] || m.state) + (m.rows ? tr('rt.rows',' · {n} строк').replace('{n}', m.rows) : '');
        break;
      case 'fax_info': {
        const sig = m.q === undefined ? '' : m.q >= 0.9 ? tr('fx.sig_ok',' · сигнал ✓ {lo}–{hi} Гц').replace('{lo}', m.lo).replace('{hi}', m.hi) : tr('fx.sig_no',' · сигнала факса нет (шум)');
        $('#fxInfo').textContent = (FX_ST[m.state] || m.state) + (m.rows ? tr('rt.rows',' · {n} строк').replace('{n}', m.rows) : '') + sig;
        $('#fxSlant').textContent = m.slant;
        if (m.center && (m.center !== st.fxC || m.dev !== st.fxD)) {
          st.fxC = m.center; st.fxD = m.dev || 400;
          if (document.activeElement !== $('#fxCenter')) $('#fxCenter').value = m.center;
          marks();
        }
        break;
      }
      case 'fax_note': toast(m.msg_key ? resolveServerMsg(m) : (tr('toast.fax', 'Факс: ') + (m.msg || '')), 4500); break;
      case 'fax_saved': toast(tr('toast.fax_saved', 'Факс сохранён: ') + m.path, 6000); break;
    }
  }
  function onBin(b) {
    const dv = new DataView(b.buffer, b.byteOffset);
    const a = dv.getUint16(1, true), W = dv.getUint16(3, true);
    if (b[0] === 5) addRow(a, new Uint8Array(b.slice(5, 5 + W)));
    else if (b[0] === 6) {
      st.rows = []; for (let y = 0; y < a; y++) st.rows.push(new Uint8Array(b.slice(5 + y * W, 5 + (y + 1) * W)));
      st.W = W; redraw(); wrap.scrollTop = wrap.scrollHeight;
    }
  }
  function pickAudio(hz) {                       // правый клик по водопаду на этой вкладке
    if (st.sub === 'nx' || st.sub === 'psk' || st.sub === 'sstv') return digi2.pick(st.sub, hz);
    if (st.sub === 'rtty') { $('#rtFc').value = Math.round(hz); st.fc = Math.round(hz); if (!st.rt) { st.rt = true; renderRt(); } sendRt(); marks(); toast(tr('toast.rt_pick','RTTY: центр {fc} Гц').replace('{fc}', st.fc)); }
    else { $('#fxCenter').value = Math.round(hz); st.fxC = Math.round(hz); st.fxD = 400; sendFx(st.fxC); marks(); toast(tr('toast.fx_pick','Факс: центр {c} Гц (чёрный {b}, белый {w})').replace('{c}', st.fxC).replace('{b}', st.fxC - 400).replace('{w}', st.fxC + 400)); }
  }
  function resend() {
    st.rt = store.get('rtOn', false); st.fx = store.get('fxOn', false);
    renderRt(); renderFx();
    send({ t: 'rt_hello' });
    if (st.rt) sendRt();
    if (st.fx) sendFx(); else send({ t: 'fax_hello' });
    marks();
  }
  function stop() { send({ t: 'rt_stop' }); if (wrap.classList.contains('big')) wrap.classList.remove('big'); }
  return { on, onBin, setFreq: pickAudio, resend, stop, sub: () => st.sub };
})();

// ------------------------------------------------------------------ горячие клавиши
// Клавиши привязаны к физическим кнопкам (event.code), поэтому работают в любой раскладке.
// Любое действие можно переназначить во вкладке «Настройки». Справка — «?» или F1.
const HOTKEYS = (() => {
  const MODE_CYCLE = ['LSB', 'USB', 'CW-U', 'CW-L', 'AM', 'FM', 'DATA-U', 'DATA-L'];
  const SPANS = [0, 3000, 4000, 6000, 8000, 12000, 24000];
  const note = m => toast(m, 1300);
  const onOff = v => v ? tr('app.on','вкл') : tr('app.off','выкл');
  const toggle = (k, name) => { const v = S[k] ? 0 : 1; setParam(k, v); renderControls({ [k]: v }); renderBadges(); note(`${name}: ${onOff(v)}`); };
  const setMode = m => { setParam('mode', m); renderBadges(); note(tr('app.mode','Вид работы: ') + m); setTimeout(rememberBand, 300); };
  const bandIdx = () => { const f = S.freq_a || 0; const i = BANDS.findIndex(b => f >= b[1] && f <= b[2]); return i; };
  const goBand = d => {
    let i = bandIdx();
    if (i < 0) { const f = S.freq_a || 0; i = d > 0 ? BANDS.findIndex(b => b[1] > f) : BANDS.map(b => b[2] < f).lastIndexOf(true); if (i < 0) return; }
    else i = (i + d + BANDS.length) % BANDS.length;
    $$('#bands .btn')[i].click(); note(tr('app.band','Диапазон ') + $$('#bands .btn')[i].textContent);
  };
  const lvlToggle = (k, name) => {
    const cur = S[k] | 0;
    if (cur) { opts[k + 'Last'] = cur; saveOpts(); setParam(k, 0); note(name + ': ' + tr('app.off','выкл')); }
    else { const v = opts[k + 'Last'] || 5; setParam(k, v); note(`${name}: ${v}`); }
    renderControls({ [k]: S[k] });
  };
  const A = [
    // id, группа, название, клавиши по умолчанию, действие, [отпускание], [повтор при удержании]
    ['ptt', tr('hk.group.tx','Передача'), tr('hk.ptt','PTT — передача (держать)'), ['Space'],
      () => { opts.pttMode === 'toggle' ? (C.pttPressed ? pttUp() : pttDown()) : pttDown(); },
      () => { if (opts.pttMode === 'hold') pttUp(); }],
    ['stop', tr('hk.group.tx','Передача'), tr('hk.stop','Стоп: снять передачу, остановить тюнер и передачу CW, отменить автоответ'), ['Escape'],
      () => { pttUp(); if (S.tuning) act('tune_stop'); cwDesk.stop(); digiDesk.stop(); digi2.stop(); voiceCq.stop(); }],
    ['tuner', tr('hk.group.tx','Передача'), tr('hk.tuner','Тюнер: настроить'), ['KeyT'], () => { act('tune'); note(tr('app.tuner_tuning','Тюнер: настройка')); }],
    ['proc', tr('hk.group.tx','Передача'), tr('hk.proc','Компрессор PROC'), [], () => toggle('proc', 'PROC')],
    ['vox', tr('hk.group.tx','Передача'), tr('hk.vox','VOX'), [], () => toggle('vox', 'VOX')],
    ['up', tr('hk.group.freq','Частота'), tr('hk.up','Вверх на шаг'), ['ArrowUp', 'ArrowRight'], () => nudge(1), null, true],
    ['down', tr('hk.group.freq','Частота'), tr('hk.down','Вниз на шаг'), ['ArrowDown', 'ArrowLeft'], () => nudge(-1), null, true],
    ['up10', tr('hk.group.freq','Частота'), tr('hk.up10','Вверх на 10 шагов'), ['PageUp', 'Shift+ArrowUp', 'Shift+ArrowRight'], () => nudge(10), null, true],
    ['down10', tr('hk.group.freq','Частота'), tr('hk.down10','Вниз на 10 шагов'), ['PageDown', 'Shift+ArrowDown', 'Shift+ArrowLeft'], () => nudge(-10), null, true],
    ['step+', tr('hk.group.freq','Частота'), tr('hk.step_up','Шаг крупнее'), ['KeyS'], () => stepMove(1)],
    ['step-', tr('hk.group.freq','Частота'), tr('hk.step_down','Шаг мельче'), ['Shift+KeyS'], () => stepMove(-1)],
    ['entry', tr('hk.group.freq','Частота'), tr('hk.entry','Ввод частоты с клавиатуры'), ['Enter', 'NumpadEnter'], () => { const i = $('#freqInput'); i.focus(); i.select(); }],
    ['band+', tr('hk.group.freq','Частота'), tr('hk.band_next','Следующий диапазон'), ['BracketRight'], () => goBand(1)],
    ['band-', tr('hk.group.freq','Частота'), tr('hk.band_prev','Предыдущий диапазон'), ['BracketLeft'], () => goBand(-1)],
    ['lock', tr('hk.group.freq','Частота'), tr('hk.lock','Блокировка LOCK'), ['KeyK'], () => toggle('lock', 'LOCK')],
    ['mode+', tr('hk.group.mode','Вид работы'), tr('hk.mode_next','Следующий вид работы'), ['KeyM'], () => { const i = MODE_CYCLE.indexOf(S.mode); setMode(MODE_CYCLE[(i + 1) % MODE_CYCLE.length]); }],
    ['mode-', tr('hk.group.mode','Вид работы'), tr('hk.mode_prev','Предыдущий вид работы'), ['Shift+KeyM'], () => { const i = MODE_CYCLE.indexOf(S.mode); setMode(MODE_CYCLE[(i - 1 + MODE_CYCLE.length) % MODE_CYCLE.length]); }],
    ['usb', tr('hk.group.mode','Вид работы'), tr('hk.usb','USB'), ['KeyU'], () => setMode('USB')],
    ['lsb', tr('hk.group.mode','Вид работы'), tr('hk.lsb','LSB'), ['KeyL'], () => setMode('LSB')],
    ['cw', tr('hk.group.mode','Вид работы'), tr('hk.cw','CW (повторно — CW-U ⇄ CW-L)'), ['KeyC'], () => setMode(S.mode === 'CW-U' ? 'CW-L' : 'CW-U')],
    ['am', tr('hk.group.mode','Вид работы'), tr('hk.am','AM'), ['KeyA'], () => setMode('AM')],
    ['fm', tr('hk.group.mode','Вид работы'), tr('hk.fm','FM (повторно — FM ⇄ FM-N)'), ['KeyF'], () => setMode(S.mode === 'FM' ? 'FM-N' : 'FM')],
    ['data', tr('hk.group.mode','Вид работы'), tr('hk.data','DATA (повторно — DATA-U ⇄ DATA-L)'), ['KeyD'], () => setMode(S.mode === 'DATA-U' ? 'DATA-L' : 'DATA-U')],
    ['swap', tr('hk.group.vfo','VFO'), tr('hk.swap','A ⇄ B'), ['KeyV'], () => { act('swap'); note(tr('note.swap','A ⇄ B')); }],
    ['a2b', tr('hk.group.vfo','VFO'), tr('hk.a2b','A → B'), ['KeyB'], () => { act('a_to_b'); note(tr('note.a2b','A → B')); }],
    ['split', tr('hk.group.vfo','VFO'), tr('hk.split','SPLIT'), ['KeyX'], () => toggle('split', 'SPLIT')],
    ['nb', tr('hk.group.rx','Приёмник'), tr('hk.nb','Подавитель импульсных помех NB'), ['KeyN'], () => lvlToggle('nb', 'NB')],
    ['nr', tr('hk.group.rx','Приёмник'), tr('hk.nr','Шумоподавление DNR'), ['KeyR'], () => lvlToggle('nr', 'DNR')],
    ['dnf', tr('hk.group.rx','Приёмник'), tr('hk.dnf','Авто-режектор DNF'), ['KeyJ'], () => toggle('dnf', 'DNF')],
    ['att', tr('hk.group.rx','Приёмник'), tr('hk.att','Аттенюатор ATT'), ['KeyO'], () => toggle('att', 'ATT')],
    ['preamp', tr('hk.group.rx','Приёмник'), tr('hk.preamp','Предусилитель IPO → AMP1 → AMP2'), ['KeyP'], () => {
      const max = bandType() ? 1 : 2, v = ((ctlValue('preamp') | 0) + 1) % (max + 1);
      setParam('preamp', v); S['preamp' + bandType()] = v; renderControls({ preamp: v });
      note(tr('app.preamp','Предусилитель: ') + (bandType() ? onOff(v) : ['IPO', 'AMP1', 'AMP2'][v]));
    }],
    ['rec', tr('hk.group.rx','Приёмник'), tr('hk.rec','Запись связи на ПК — старт/стоп'), ['KeyH'], () => qsoRec.toggle()],
    ['agc', tr('hk.group.rx','Приёмник'), tr('hk.agc','АРУ: FAST → MID → SLOW → AUTO'), ['KeyG'], () => {
      const v = (Math.min(S.agc | 0, 4) % 4) + 1; setParam('agc', v); renderControls({ agc: v }); note(tr('app.agc_label','АРУ: ') + ['OFF', 'FAST', 'MID', 'SLOW', 'AUTO'][v]);
    }],
    ['narrow', tr('hk.group.rx','Приёмник'), tr('hk.narrow','Узкий фильтр NAR'), [], () => toggle('narrow', 'NAR')],
    ['sq', tr('hk.group.rx','Приёмник'), tr('hk.sq','Шумодав пульта (FM): выкл → по ТРХ → по уровню'), ['KeyQ'], () => {
      const L = ['off', 'radio', 'level']; opts.sqMode = L[(L.indexOf(opts.sqMode) + 1) % 3]; saveOpts(); renderSq(); pushGate();
      note(tr('app.squelch','Шумодав: ') + { off: tr('app.off','выкл'), radio: tr('app.squelch.radio','по трансиверу'), level: tr('app.squelch.level','по уровню') }[opts.sqMode] + (isFMmode(S.mode) ? '' : tr('app.squelch.fm_only',' (работает только в FM)')));
    }],
    ['audio', tr('hk.group.av','Звук и экран'), tr('hk.audio','Звук приёма вкл/выкл'), ['KeyZ'], () => $('#btnAudio').click()],
    ['vol+', tr('hk.group.av','Звук и экран'), tr('hk.vol_up','Громкость +'), ['Equal', 'NumpadAdd'], () => volStep(10), null, true],
    ['vol-', tr('hk.group.av','Звук и экран'), tr('hk.vol_down','Громкость −'), ['Minus', 'NumpadSubtract'], () => volStep(-10), null, true],
    ['span', tr('hk.group.av','Звук и экран'), tr('hk.span','Обзор водопада: Авто → 3k → … → 24k'), ['KeyW'], () => {
      const i = SPANS.indexOf(C.wfMax); C.wfMax = SPANS[(i + 1) % SPANS.length]; store.set('wfMax', C.wfMax); updateSpan(true);
      note(tr('app.span','Обзор: ') + (C.wfMax ? C.wfMax / 1000 + ' kHz' : tr('app.span.auto','авто')));
    }],
    ['full', tr('hk.group.av','Звук и экран'), tr('hk.full','Во весь экран'), [], () => $('#btnFull').click()],
    ['help', tr('hk.group.av','Звук и экран'), tr('hk.help','Справка по клавишам'), ['Shift+Slash', 'F1'], () => showHelp()],
    ['cwdec', tr('hk.group.cw','CW'), tr('hk.cwdec','Декодер Морзе вкл/выкл'), ['KeyE'], () => cwDesk.toggle()],
    ['cwai', tr('hk.group.cw','CW'), tr('hk.cwai','Разобрать принятое'), ['KeyI'], () => send({ t: 'cw_ai_analyze' })],
    ['cwreply', tr('hk.group.cw','CW'), tr('hk.cwreply','Составить ответ по шаблону'), ['KeyY'], () => send({ t: 'cw_ai_reply' })],
    ['cwtext', tr('hk.group.cw','CW'), tr('hk.cwtext','Перейти к тексту для передачи'), ['Backquote'], () => { $('#tabs button[data-tab="cw"]').click(); $('#cwText').focus(); }],
  ];
  for (let n = 1; n <= 5; n++) A.push(['cw' + n, tr('hk.group.cw','CW'), tr('hk.cw_mem','Передать CW-память {n}').replace('{n}', n), ['Shift+Digit' + n], () => { act('cw_play', n); note(tr('note.cw_mem','CW-память ') + n); }]);
  const actions = A.map(([id, group, name, def, down, up, repeat]) => ({ id, group, name, def, down, up, repeat }));

  function stepMove(d) {
    const sel = $('#step'), i = clamp(sel.selectedIndex + d, 0, sel.options.length - 1);
    sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); note(tr('app.step','Шаг: ') + sel.options[i].text);
  }
  function volStep(d) {
    const v = $('#volume'); v.value = clamp(+v.value + d, 0, 200); v.dispatchEvent(new Event('input')); note(tr('app.vol','Громкость: ') + v.value + tr('app.vol_pct',' %'));
  }

  // --- раскладка клавиш: по умолчанию + переназначения пользователя
  let custom = store.get('keys', {});
  const keysOf = a => custom[a.id] ?? a.def;
  let map = new Map();
  function rebuild() { map = new Map(); for (const a of actions) for (const k of keysOf(a)) map.set(k, a); }
  rebuild();
  const comboOf = e => (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + e.code;
  const NAMES = { Space: tr('hk.key.space','Пробел'), Enter: 'Enter', NumpadEnter: 'Num Enter', Escape: tr('hk.key.esc','Esc'), ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    PageUp: 'PgUp', PageDown: 'PgDn', BracketLeft: '[', BracketRight: ']', Equal: '=', Minus: '−', NumpadAdd: 'Num +', NumpadSubtract: 'Num −',
    Slash: '/', Backslash: '\\', Backquote: '`', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Tab: 'Tab', Home: 'Home', End: 'End', Insert: 'Ins', Delete: 'Del' };
  function label(k) {
    if (k === 'Shift+Slash') return '?';
    const parts = k.split('+'), code = parts.pop();
    let n = NAMES[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
    return [...parts, n].join(' + ');
  }

  // --- обработка
  let capture = null;                         // переназначение: ждём нажатия
  let held = new Set();
  document.addEventListener('keydown', e => {
    if (capture) { e.preventDefault(); e.stopPropagation(); capture(e); return; }
    const t = e.target;
    const typing = t.matches('input[type=text], input[type=password], input[type=number], input:not([type]), select, textarea');
    if (typing) { if (e.key === 'Escape') t.blur(); return; }
    if (!$('#help').classList.contains('hidden') && (e.code === 'Escape' || e.code === 'F1' || comboOf(e) === 'Shift+Slash')) { e.preventDefault(); hideHelp(); return; }
    if (!opts.hotkeys) return;
    if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(e.code)) return;
    if (e.metaKey) return;
    // цифры — сразу начинают ввод частоты
    if (!e.ctrlKey && !e.altKey && !e.shiftKey && /^(Digit\d|Numpad\d|NumpadDecimal|Period)$/.test(e.code)) {
      const i = $('#freqInput'); i.focus(); i.value = e.code.includes('Decimal') || e.code === 'Period' ? '.' : e.code.slice(-1);
      e.preventDefault(); return;
    }
    const a = map.get(comboOf(e));
    if (!a) return;
    e.preventDefault();
    if (t.matches('input[type=range]')) t.blur();       // стрелки не должны двигать ползунок
    if (e.repeat && !a.repeat) return;
    held.add(e.code); a.down();
  }, true);
  document.addEventListener('keyup', e => {
    if (!held.has(e.code)) return;
    held.delete(e.code); e.preventDefault();             // чтобы пробел не «нажал» кнопку в фокусе
    for (const a of actions) if (a.up && keysOf(a).some(k => k.split('+').pop() === e.code)) a.up();
  }, true);

  // --- справка
  function helpHtml() {
    const groups = [...new Set(actions.map(a => a.group))];
    return groups.map(g => `<div class="hk-group"><h4>${g}</h4>` + actions.filter(a => a.group === g && keysOf(a).length).map(a =>
      `<div class="hk-row"><span>${a.name}</span><span>${keysOf(a).map(k => `<kbd>${label(k)}</kbd>`).join(' ')}</span></div>`).join('') + '</div>').join('') +
      `<div class="hk-group"><h4>${tr('hk.help.more','Ещё')}</h4><div class="hk-row"><span>${tr('hk.help.freq','Набрать частоту: цифры, затем Enter (7.074 — МГц, 14200 — кГц)')}</span><span><kbd>0</kbd>…<kbd>9</kbd></span></div>
       <div class="hk-row"><span>${tr('hk.help.wheel','Колесо мыши над частотой — менять разряд под курсором')}</span><span><kbd>🖱</kbd></span></div></div>`;
  }
  function showHelp() { $('#helpBody').innerHTML = helpHtml(); $('#help').classList.remove('hidden'); }
  function hideHelp() { $('#help').classList.add('hidden'); }
  $('#help').addEventListener('click', e => { if (e.target.id === 'help' || e.target.closest('[data-close]')) hideHelp(); });
  $('#helpEdit').onclick = () => { hideHelp(); window.openSettings?.(); setTimeout(() => $('#hkList')?.scrollIntoView({ block: 'start' }), 60); };
  $('#btnKeys').onclick = showHelp;

  // --- переназначение в настройках
  function renderEditor() {
    const groups = [...new Set(actions.map(a => a.group))];
    $('#hkList').innerHTML = groups.map(g => `<h4>${g}</h4>` + actions.filter(a => a.group === g).map(a =>
      `<div class="hk-edit" data-id="${a.id}"><span>${a.name}</span><span class="hk-keys">${keysOf(a).map(k => `<kbd>${label(k)}</kbd>`).join(' ') || `<span class="muted">${tr('hk.unassigned','—')}</span>`}</span>
       <button class="btn small" data-act="set">${tr('hk.assign','Назначить')}</button><button class="btn small" data-act="clear" title="${tr('hk.clear','Убрать клавиши')}">×</button></div>`).join('')).join('');
    $('#btnKeys').title = tr('hk.keys.title','Горячие клавиши (?)');
    const pk = keysOf(actions[0]); $('#ptt').title = pk.length ? tr('hk.ptt_title','PTT — клавиша ') + pk.map(label).join(' / ') : 'PTT';
  }
  $('#hkList').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const row = b.closest('.hk-edit'), a = actions.find(x => x.id === row.dataset.id);
    if (b.dataset.act === 'clear') { custom[a.id] = []; save(); return; }
    $('.hk-keys', row).innerHTML = `<span class="hk-wait">${tr('hk.wait','Нажмите клавишу… (Esc — отмена)')}</span>`;
    capture = ev => {
      if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(ev.code)) return;
      capture = null;
      if (ev.code === 'Escape' && !ev.shiftKey) { renderEditor(); return; }
      const k = comboOf(ev);
      const other = actions.find(x => x !== a && keysOf(x).includes(k));
      if (other) { custom[other.id] = keysOf(other).filter(x => x !== k); toast(tr('toast.key_removed','«{key}» снята с действия «{name}»').replace('{key}', label(k)).replace('{name}', other.name), 3000); }
      custom[a.id] = [k];
      save();
    };
  });
  function save() { store.set('keys', custom); rebuild(); renderEditor(); }
  $('#hkReset').onclick = () => { custom = {}; save(); toast(tr('toast.keys_default', 'Клавиши по умолчанию')); };
  $('#optHotkeys').checked = opts.hotkeys;
  $('#optHotkeys').onchange = e => { opts.hotkeys = e.target.checked; saveOpts(); };
  renderEditor();
  return { showHelp };
})();

// ------------------------------------------------------------------ раскладка и масштаб
// На мониторе (окно шире 900 и выше 480 точек) всё помещается в окно без прокрутки страницы:
// слева дисплей и ручка, справа водопад на всю свободную площадь, вкладки — со своей прокруткой.
// «Авто»-масштаб подбирается так, чтобы левая колонка целиком влезала по высоте.
// На телефоне — обычная прокручиваемая колонка.
function setZoom(z) {
  const w = window.innerWidth, h = window.innerHeight;
  const fit = w >= 900 && h >= 480;
  document.documentElement.style.zoom = z;
  C.zoom = z;
  const root = document.documentElement.style;
  root.setProperty('--app-h', (h / z) + 'px');
  document.body.classList.toggle('fit', fit);
  document.body.classList.toggle('wide', fit && w / z >= 1560);
  const effH = h / z;
  const compact = document.documentElement.dataset.workspace !== 'dx';
  document.body.classList.toggle('short-ui', compact && effH < 1000);
  document.body.classList.remove('tiny-ui');
  const col = $('#colLeft');
  if (compact && fit && col && col.scrollHeight > col.clientHeight + 4) document.body.classList.add('tiny-ui');
  return fit;
}
function applyScale() {
  const w = window.innerWidth, h = window.innerHeight;
  let z = parseFloat(opts.scale);
  const auto = !(z > 0);
  if (auto) z = document.documentElement.dataset.workspace === 'dx' ? 1 : (w < 760 ? 1 : clamp(Math.min(w / 1440, h / 860), 0.9, 2.4));
  // FT8 uses extra pixels for messages, never magnifies the whole workstation.
  if (auto && document.body.dataset.op === 'ft8') z = 1;
  const fit = setZoom(z);
  if (fit && auto && document.documentElement.dataset.workspace !== 'dx') {
    // Не мельчить интерфейс на 14″: левая колонка при нехватке высоты прокручивается.
    z = Math.max(0.9, Math.min(z, w / 840));
    setZoom(z);
  }
  sizeCanvases();
}
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(applyScale, 60); });

// ------------------------------------------------------------------ высота водопада и сообщений
(() => {
  const sp = $('#wfSplitter'), layout = document.querySelector('.layout');
  if (!sp || !layout) return;
  let drag = false, raf = 0;
  const setFtHeight = px => {
    // Широкий диапазон: от узкой полоски до почти всего экрана. Сверху оставляем
    // панель частоты, отступы и минимум под списки/управление (340 px).
    const max = Math.max(180, Math.min(900, window.innerHeight - 340));
    const height = clamp(px, 100, max);
    document.documentElement.style.setProperty('--ft-wf-height', height + 'px');
    store.set('ftWfHeight', height);
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; window.dispatchEvent(new Event('resize')); });
  };
  const ftSaved = +store.get('ftWfHeight', 0);
  if (ftSaved) setFtHeight(ftSaved);
  sp.tabIndex = 0;
  sp.addEventListener('keydown', e => {
    if (document.body.dataset.op !== 'ft8') return;
    if (!['ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Home') { document.documentElement.style.removeProperty('--ft-wf-height'); store.set('ftWfHeight', 0); }
    else setFtHeight($('.wfpanel').getBoundingClientRect().height + (e.key === 'ArrowDown' ? 24 : -24));
    window.dispatchEvent(new Event('resize'));
  });
  const setTabs = pct => {
    pct = clamp(pct, 22, 72);
    document.documentElement.style.setProperty('--tabs-h', pct.toFixed(1) + '%');
    store.set('tabsH', pct);
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; window.dispatchEvent(new Event('resize')); });
  };
  const saved = +store.get('tabsH', 0);
  if (saved) document.documentElement.style.setProperty('--tabs-h', clamp(saved, 22, 72).toFixed(1) + '%');
  sp.addEventListener('pointerdown', e => {
    drag = true; document.body.classList.add('resizing');
    try { sp.setPointerCapture(e.pointerId); } catch (_) { /* без capture */ }
    e.preventDefault();
  });
  sp.addEventListener('pointermove', e => {
    if (!drag) return;
    const r = layout.getBoundingClientRect();
    if (document.body.dataset.op === 'ft8') setFtHeight(e.clientY - $('.wfpanel').getBoundingClientRect().top);
    else setTabs((r.bottom - e.clientY) / r.height * 100);
    e.preventDefault();
  });
  const stop = () => { drag = false; document.body.classList.remove('resizing'); };
  sp.addEventListener('pointerup', stop);
  sp.addEventListener('pointercancel', stop);
  sp.addEventListener('dblclick', () => {
    if (document.body.dataset.op === 'ft8') {
      document.documentElement.style.removeProperty('--ft-wf-height'); store.set('ftWfHeight', 0);
      window.dispatchEvent(new Event('resize')); return;
    }
    document.documentElement.style.removeProperty('--tabs-h');
    store.set('tabsH', 0);
    window.dispatchEvent(new Event('resize'));
  });
})();

// ------------------------------------------------------------------ старт
initControls();
initOpts();
applyScale();
renderSq();
renderFavs();
buildLut();
sizeCanvases();
{
  const allowed = ['dx', 'rx', 'tx', 'vfo', 'cw', 'menu', 'cat'];
  let t = store.get('tab', 'rx');
  if (t === 'cw' || t === 'ft8' || t === 'digi') t = 'rx';
  if (!allowed.includes(t)) t = 'rx';
  activateTab(t, false);
}
connect();

// UTC в рабочем экране: время нужно для лога в CW/RTTY/FT8.
setInterval(() => {
  const el = $('#opUtc');
  if (el) el.textContent = new Date().toISOString().slice(11, 19) + ' UTC';
}, 1000);

// ------------------------------------------------------------------ голосовой автовызов
const voiceCq = (() => {
  const st = { slots: [], run: null, rec: null, recSlot: 0, fileSlot: 0, audio: null };
  const box = $('#vkSlots');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  ['vkPause', 'vkRep', 'vkSig'].forEach(id => {
    const v = store.get(id, null); if (v != null) $('#' + id).value = v;
    $('#' + id).onchange = e => store.set(id, e.target.value);
  });
  function render() {
    box.innerHTML = st.slots.map(s => {
      const live = st.run && st.run.slot === s.slot, rec = st.recSlot === s.slot;
      return `<div class="vk-slot${live ? ' live' : ''}${rec ? ' rec' : ''}" data-s="${s.slot}">
        <b class="mono">${s.slot}</b>
        <input class="nm" value="${esc(s.name)}" placeholder="${s.dur ? '' : 'пусто — запишите или загрузите'}" maxlength="40">
        <span class="dur mono muted">${s.dur ? s.dur.toFixed(1) + ' с' : ''}</span>
        <button class="btn small" data-a="rec">${rec ? '■ Стоп записи' : '● Запись'}</button>
        <button class="btn small" data-a="file" title="Загрузить звуковой файл (wav, mp3, ogg…)">📁</button>
        <button class="btn small" data-a="play" ${s.dur ? '' : 'disabled'} title="Прослушать у себя">▶</button>
        <button class="btn small primary" data-a="go" ${s.dur ? '' : 'disabled'}>📢 В эфир</button>
        <button class="btn small" data-a="del" ${s.dur ? '' : 'disabled'} title="Удалить">✕</button>
      </div>`;
    }).join('');
    $$('.vk-slot', box).forEach(row => {
      const slot = +row.dataset.s;
      $$('button', row).forEach(b => b.onclick = () => action(b.dataset.a, slot, row));
      $('.nm', row).onchange = e => { const s = st.slots.find(x => x.slot === slot); if (s && s.dur) rename(slot, e.target.value); };
    });
    const r = st.run;
    $('#vkStatus').textContent = r ? `${r.name}: ${r.n}/${r.repeats} · ${r.phase === 'tx' ? tr('vk.status.tx','передача') : tr('vk.status.rx','слушаю, ещё ') + r.left + tr('vk.status.sec',' с')}` : tr('vk.status.idle','—');
  }
  const nameOf = (slot, row) => ($('.nm', row)?.value || '').trim() || 'CQ ' + slot;
  async function action(a, slot, row) {
    if (a === 'rec') return st.recSlot === slot ? stopRec() : startRec(slot, row);
    if (a === 'file') { st.fileSlot = slot; st.fileName = nameOf(slot, row); $('#vkFile').value = ''; $('#vkFile').click(); return; }
    if (a === 'play') return send({ t: 'vk_get', slot });
    if (a === 'del') { if (confirm(tr('vk.del_confirm','Удалить сообщение {slot}?').replace('{slot}', slot))) send({ t: 'vk_delete', slot }); return; }
    if (a === 'go') {
      const sv = +$('#vkSig').value;
      const raw = sv ? (S_CAL.find(p => p[1] >= sv) || [130])[0] : 0;
      send({ t: 'vk_start', slot, pause: +$('#vkPause').value, repeats: +$('#vkRep').value, sig: raw });
    }
  }
  // ---- запись с микрофона этого устройства
  async function startRec(slot, row) {
    if (st.rec) return;
    if (!navigator.mediaDevices?.getUserMedia) return toast(tr('toast.rec_unavail', 'Запись недоступна: откройте пульт по https:// или localhost'));
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: opts.micId ? { exact: opts.micId } : undefined,
        channelCount: 1, echoCancellation: opts.echo, noiseSuppression: opts.ns, autoGainControl: opts.agc } });
    } catch (e) { return toast(tr('toast.mic_denied', 'Нет доступа к микрофону: ') + micErrorText(e), 8000); }
    const chunks = [], mr = new MediaRecorder(stream);
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      st.rec = null; st.recSlot = 0; render();
      await upload(slot, st.recName, await new Blob(chunks).arrayBuffer());
    };
    st.rec = mr; st.recSlot = slot; st.recName = nameOf(slot, row);
    mr.start(); render(); toast(tr('toast.vk_speak', 'Говорите… «■ Стоп записи», когда закончите'));
    st.recTimer = setTimeout(() => st.rec && stopRec(), 120000);
  }
  function stopRec() { clearTimeout(st.recTimer); if (st.rec && st.rec.state !== 'inactive') st.rec.stop(); }
  $('#vkFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 30e6) return toast(tr('toast.file_too_big', 'Файл слишком большой'));
    await upload(st.fileSlot, st.fileName || f.name.replace(/\.[^.]+$/, ''), await f.arrayBuffer());
  };
  // ---- перекодирование в 48 кГц моно, обрезка тишины, нормализация -> сервер
  async function upload(slot, name, buf) {
    let dec;
    try { dec = await new AudioContext().decodeAudioData(buf); }
    catch (e) { return toast(tr('toast.audio_read_err', 'Не удалось прочитать звук: ') + e.message); }
    const len = Math.ceil(dec.duration * 48000);
    if (dec.duration > 120) return toast(tr('toast.msg_too_long', 'Сообщение длиннее 2 минут'));
    const oc = new OfflineAudioContext(1, Math.max(len, 1), 48000);
    const src = oc.createBufferSource(); src.buffer = dec;
    const hp = new BiquadFilterNode(oc, { type: 'highpass', frequency: 120 });
    const lp = new BiquadFilterNode(oc, { type: 'lowpass', frequency: 3000 });
    src.connect(hp).connect(lp).connect(oc.destination); src.start();
    let x = (await oc.startRendering()).getChannelData(0);
    // обрезаем тишину по краям (порог −40 дБ от пика)
    let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
    if (peak < 1e-3) return toast(tr('toast.rec_silent', 'В записи тишина — проверьте микрофон'));
    const thr = peak * 0.01; let a = 0, b = x.length - 1;
    while (a < b && Math.abs(x[a]) < thr) a++;
    while (b > a && Math.abs(x[b]) < thr) b--;
    x = x.subarray(Math.max(0, a - 2400), Math.min(x.length, b + 4800));
    const k = 0.8 / peak, pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-1, Math.min(1, x[i] * k)) * 32767;
    let bin = ''; const u8 = new Uint8Array(pcm.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    send({ t: 'vk_save', slot, name, pcm: btoa(bin) });
  }
  function rename(slot, name) { send({ t: 'vk_rename', slot, name }); }
  function playLocal(m) {
    const bin = atob(m.pcm), pcm = new Int16Array(bin.length / 2), dv = new DataView(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
    for (let i = 0; i < pcm.length; i++) pcm[i] = dv.getInt16(i * 2, true);
    const ac = new AudioContext({ sampleRate: 48000 }), ab = ac.createBuffer(1, pcm.length, 48000), ch = ab.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const s = ac.createBufferSource(); s.buffer = ab; s.connect(ac.destination); s.start();
    s.onended = () => ac.close();
  }
  $('#vkStop').onclick = () => send({ t: 'vk_stop' });
  function on(m) {
    if (m.t === 'vk_state') { st.slots = m.slots; st.run = m.run; render(); }
    else if (m.t === 'vk_note') toast(resolveServerMsg(m), 5000);
    else if (m.t === 'vk_audio') playLocal(m);
  }
  return { on, hello: () => send({ t: 'vk_hello' }), stop: () => { if (st.run) send({ t: 'vk_stop' }); stopRec(); }, running: () => !!st.run };
})();

// ------------------------------------------------------------------ запись связи на ПК
const qsoRec = (() => {
  const st = { on: false, t0: 0, k: '', timer: 0 };
  const btn = $('#btnRec');
  const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.round(n / 1024) + ' КБ';
  function tick() { btn.textContent = st.on ? '⏺ ' + mmss(Math.floor((Date.now() - st.t0) / 1000)) : tr('rec.btn','⏺ Запись'); }
  btn.onclick = () => send({ t: st.on ? 'rec_stop' : 'rec_start' });
  function on(m) {
    const was = st.on;
    st.on = m.on; st.k = m.k;
    if (m.on) st.t0 = Date.now() - m.elapsed * 1000;
    btn.classList.toggle('on', m.on);
    clearInterval(st.timer); if (m.on) st.timer = setInterval(tick, 500); tick();
    btn.title = m.on ? tr('rec.title_on','Идёт запись: {name} — нажмите, чтобы остановить').replace('{name}', m.name) : tr('rec.title_idle','Записать связь (приём и передачу) в файл на ПК с сервером');
    $('#recList').innerHTML = (m.files || []).map(f =>
      `<div class="row"><a href="rec/${encodeURIComponent(f.name)}?k=${encodeURIComponent(m.k)}" download="${f.name}">💾 ${f.name}</a>
       <span class="muted">${mmss(f.dur)} · ${kb(f.size)}</span></div>`).join('') || '<span class="muted">Записей пока нет</span>';
    if (was && !m.on && m.name) toast(tr('toast.rec_saved', 'Запись сохранена: ') + m.name + ' (records)', 6000);
  }
  return { on, hello: () => send({ t: 'rec_hello' }), toggle: () => btn.click() };
})();

// ------------------------------------------------------------------ NAVTEX, SSTV, PSK31
const digi2 = (() => {
  const st = { nx: false, sv: false, pk: false, nxFc: 1700, pkFc: 1000, txText: '', svW: 320, svH: 256, svRows: 0 };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fill = (sel, list) => { sel.innerHTML = list.map(p => `<option value="${p[0]}">${p[1]}</option>`).join(''); };
  const myCall = () => ($('#opCall').value || '').toUpperCase();
  function addText(el, hint, t) {
    $(hint)?.remove();
    const end = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    el.append(t);
    if (el.textContent.length > 40000) el.textContent = el.textContent.slice(-30000);
    if (end) el.scrollTop = el.scrollHeight;
  }
  // ---- метки на водопаде (только для открытого раздела)
  function marks() {
    const sub = digiDesk.sub(), m = [];
    if (sub === 'nx' && st.nx) m.push([st.nxFc - 85, '#ffb547'], [st.nxFc + 85, '#4fc3ff']);
    if (sub === 'psk' && st.pk) m.push([st.pkFc, '#3ddc84']);
    if (sub === 'sstv' && st.sv) m.push([1200, '#ff5a4d'], [1500, '#bbbbbb'], [2300, '#ffffff']);
    C.dgMarks2 = m; drawOverlay();
  }
  function pick(sub, hz) {
    hz = Math.round(hz);
    if (sub === 'nx') { st.nxFc = hz; $('#nxFc').value = hz; if (!st.nx) { st.nx = true; renderBtns(); } sendNx(); toast(tr('toast.nx_pick','NAVTEX: центр {hz} Гц').replace('{hz}', hz)); }
    else if (sub === 'psk') { st.pkFc = hz; $('#pkFc').value = hz; if (!st.pk) { st.pk = true; renderBtns(); } sendPk(); toast(tr('toast.psk_pick','PSK31: {hz} Гц').replace('{hz}', hz)); }
    else toast(tr('toast.sstv_tune', 'SSTV: отдельная подстройка не нужна — сигнал занимает 1200–2300 Гц'));
    marks();
  }
  function renderBtns() {
    for (const [id, on] of [['#nxDecBtn', st.nx], ['#svDecBtn', st.sv], ['#pkDecBtn', st.pk]]) {
      $(id).classList.toggle('on', on); $(id).textContent = on ? tr('dg.rx_on','● Приём вкл') : tr('dg.rx_off','○ Приём выкл');
    }
  }

  // ================= NAVTEX
  const NX = [['', '— выбрать —'],
    ['A', 'A · Новороссийск 518 кГц — 03,07,11,15,19,23 UTC', 518000], ['B', 'B · Керчь 518 кГц — 01,05,09…', 518000],
    ['C', 'C · Одесса 518 кГц — 02:30, 06:30…', 518000], ['D', 'D · Стамбул 518 кГц — 00:30, 04:30…', 518000],
    ['E', 'E · Самсун 518 кГц — 00:40, 04:40…', 518000], ['J', 'J · Варна 518 кГц — 01:30, 05:30…', 518000],
    ['I', 'I · Измир 518 кГц — 01:20, 05:20…', 518000], ['L', 'L · Лимнос 518 кГц — 01:50, 05:50…', 518000],
    ['n490', '490 кГц — турецкие станции (на турецком)', 490000],
    ['n4209', '4209,5 кГц — Стамбул (M), Ираклион (S)', 4209500]];
  fill($('#nxPreset'), NX);
  function sendNx() { send({ t: 'nx_dec', on: st.nx, fc: st.nxFc }); marks(); }
  $('#nxDecBtn').onclick = () => { st.nx = !st.nx; store.set('nxOn', st.nx); renderBtns(); sendNx(); };
  $('#nxFc').onchange = e => { st.nxFc = +e.target.value; sendNx(); };
  $('#nxPreset').onchange = e => {
    const p = NX.find(x => x[0] === e.target.value); if (!p || !p[2]) return;
    setParam('mode', 'USB'); setFreq(p[2] - 1700);
    st.nxFc = 1700; $('#nxFc').value = 1700; if (!st.nx) { st.nx = true; renderBtns(); }
    sendNx(); toast(tr('toast.nx_preset','USB {freq} кГц. Сообщения идут по расписанию — время в списке (UTC).').replace('{freq}', ((p[2] - 1700) / 1000).toFixed(1)), 6000);
    e.target.value = '';
  };
  $('#nxClear').onclick = () => { $('#nxScreen').textContent = ''; $('#nxMsgs').innerHTML = ''; };

  // ================= SSTV
  const SV = [['', '— выбрать —'], ['s20', '14,230 МГц USB — главная', 14230000, 'USB'], ['s20b', '14,233 МГц USB', 14233000, 'USB'],
    ['s15', '21,340 МГц USB', 21340000, 'USB'], ['s10', '28,680 МГц USB', 28680000, 'USB'],
    ['s40', '7,165 МГц LSB', 7165000, 'LSB'], ['s80', '3,730 МГц LSB', 3730000, 'LSB'],
    ['iss', '145,800 МГц FM — МКС (по объявлениям)', 145800000, 'FM']];
  fill($('#svPreset'), SV);
  const cv = $('#svCanvas'), ctx = cv.getContext('2d');
  function sendSv() { send({ t: 'sstv_dec', on: st.sv, auto: $('#svAuto').checked, mode: $('#svMode').value }); marks(); }
  $('#svDecBtn').onclick = () => { st.sv = !st.sv; store.set('svOn', st.sv); renderBtns(); sendSv(); };
  $('#svAuto').onchange = sendSv; $('#svMode').onchange = sendSv;
  $('#svStop').onclick = () => send({ t: 'sstv_stop' });
  $('#svPreset').onchange = e => {
    const p = SV.find(x => x[0] === e.target.value); if (!p || !p[2]) return;
    setParam('mode', p[3]); setFreq(p[2]); if (!st.sv) { st.sv = true; renderBtns(); } sendSv();
    toast(tr('toast.sstv_preset','{mode} {mhz} МГц — ждём картинку').replace('{mode}', p[3]).replace('{mhz}', (p[2] / 1e6).toFixed(3))); e.target.value = '';
  };
  function svSize(w, h) {
    st.svW = w; st.svH = h; st.svRows = 0;
    cv.width = w; cv.height = h; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  }
  function svRow(i, rgb) {
    const w = rgb.length / 3, img = ctx.createImageData(w, 1);
    for (let x = 0; x < w; x++) { img.data[x * 4] = rgb[x * 3]; img.data[x * 4 + 1] = rgb[x * 3 + 1]; img.data[x * 4 + 2] = rgb[x * 3 + 2]; img.data[x * 4 + 3] = 255; }
    if (w !== cv.width) svSize(w, st.svH);
    ctx.putImageData(img, 0, i); st.svRows = i + 1;
  }
  $('#svPng').onclick = () => {
    if (!st.svRows) return toast(tr('toast.no_image', 'Картинки пока нет'));
    const a = document.createElement('a'); a.download = 'sstv_' + Date.now() + '.png'; a.href = cv.toDataURL('image/png'); a.click();
  };

  // ================= PSK31
  const PK = [['', '— выбрать —'], ['80', '80 м — 3580 кГц', 3580000], ['40', '40 м — 7040 кГц', 7040000],
    ['30', '30 м — 10142 кГц', 10142000], ['20', '20 м — 14070 кГц', 14070000], ['17', '17 м — 18100 кГц', 18100000],
    ['15', '15 м — 21070 кГц', 21070000], ['12', '12 м — 24920 кГц', 24920000], ['10', '10 м — 28120 кГц', 28120000]];
  fill($('#pkPreset'), PK);
  function sendPk() { send({ t: 'psk_dec', on: st.pk, fc: st.pkFc, afc: $('#pkAfc').checked }); marks(); }
  $('#pkDecBtn').onclick = () => { st.pk = !st.pk; store.set('pkOn', st.pk); renderBtns(); sendPk(); };
  $('#pkFc').onchange = e => { st.pkFc = +e.target.value; sendPk(); };
  $('#pkAfc').onchange = sendPk;
  $('#pkPreset').onchange = e => {
    const p = PK.find(x => x[0] === e.target.value); if (!p || !p[2]) return;
    setParam('mode', 'DATA-U'); setFreq(p[2]); if (!st.pk) { st.pk = true; renderBtns(); } sendPk();
    toast(tr('toast.psk_preset','DATA-U {khz} кГц. Правый клик по «ниточке» сигнала на водопаде — настроиться.').replace('{khz}', (p[2] / 1000)), 6000); e.target.value = '';
  };
  $('#pkClear').onclick = () => { $('#pkScreen').textContent = ''; };
  const PKM = [['CQ', 'CQ CQ CQ de {MY} {MY} {MY} pse k\n'], ['DE', 'de {MY} k\n'], ['73', 'tnx fer QSO, 73 de {MY} sk\n']];
  $('#pkMacros').innerHTML = PKM.map((m, i) => `<button class="btn" data-i="${i}">${m[0]}</button>`).join('');
  $$('#pkMacros button').forEach(b => b.onclick = () => {
    const t = PKM[+b.dataset.i][1]; if (!myCall()) return toast(tr('toast.need_mycall_cw', 'Укажите свой позывной на вкладке CW · Морзе'));
    pkSend(t);
  });
  function pkSend(t) { t = (t || '').replace(/\{MY\}/g, myCall()); if (t.trim()) send({ t: 'psk_send', text: '\n' + t }); }
  $('#pkSend').onclick = () => pkSend($('#pkText').value);
  $('#pkStop').onclick = () => send({ t: 'psk_stop' });
  $('#pkText').addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); pkSend($('#pkText').value); } });
  const txProg = p => { $('#pkTxLine').innerHTML = `<span class="done">${esc(st.txText.slice(0, p))}</span>${esc(st.txText.slice(p))}`; };

  // ================= сообщения
  function on(m) {
    switch (m.t) {
      case 'nx_state': if (m.fc) { st.nxFc = m.fc; $('#nxFc').value = m.fc; } break;
      case 'nx_rx': addText($('#nxScreen'), '#nxHint', m.text); break;
      case 'nx_info': $('#nxInfo').textContent = m.sync ? tr('nx.info_sync','синхронизация ✓ · {fc} Гц').replace('{fc}', m.fc) : tr('nx.info_search','поиск сигнала · {fc} Гц').replace('{fc}', m.fc); break;
      case 'nx_msg':
        $('#nxMsgs').insertAdjacentHTML('afterbegin', `<span class="m">${m.time} <b>${esc(m.b1)}${esc(m.b2)}${esc(m.num)}</b> ${esc(m.station || 'станция ' + m.b1)} — ${esc(m.subject || m.b2)}</span>`);
        addText($('#nxScreen'), '#nxHint', `\n──── ${m.station || m.b1}: ${m.subject || m.b2} (${m.time}) ────\n`); break;
      case 'nx_end': addText($('#nxScreen'), '#nxHint', '\n──── конец сообщения ────\n'); break;
      case 'sstv_state':
        if (m.modes && $('#svMode').options.length < 2) $('#svMode').insertAdjacentHTML('beforeend', m.modes.map(x => `<option>${x}</option>`).join(''));
        if (m.state === 'image' && m.w) svSize(m.w, m.h);
        $('#svInfo').textContent = m.state === 'image' ? tr('sv.rx','приём: ') + m.mode : tr('sv.wait','ждёт картинку');
        $('#svSaved').innerHTML = (m.saved || []).length ? `<b>${tr('sv.saved_head','Сохранены на ПК (папка sstv):')}</b>` + m.saved.slice().reverse().map(n => `<div class="muted">${esc(n)}</div>`).join('') : '';
        break;
      case 'sstv_start':
        svSize(m.w, m.h); $('#svInfo').textContent = tr('sv.info_rx','приём: {mode} ({how}{shift})').replace('{mode}', m.mode).replace('{how}', m.how).replace('{shift}', m.shift ? tr('sv.shift',', расстройка {s} Гц').replace('{s}', m.shift) : '');
        toast(tr('toast.sstv_start', 'SSTV: началась картинка ') + m.mode); break;
      case 'sstv_done': {
        let why = m.why || '';
        if (m.why_key) {
          why = tr(m.why_key, why || m.why_key);
          const wp = m.why_params || {};
          for (const [k, v] of Object.entries(wp)) why = why.replace(new RegExp('\\{' + k + '\\}', 'g'), v == null ? '' : String(v));
        }
        $('#svInfo').textContent = tr('sv.done','{mode}: {why}, {rows} строк').replace('{mode}', m.mode).replace('{why}', why).replace('{rows}', m.rows) + (m.slant ? tr('sv.slant',', наклон {s} ppm').replace('{s}', m.slant) : '');
        if (m.name) { toast(tr('toast.sstv_saved', 'SSTV сохранена: ') + m.name, 5000); $('#svSaved').insertAdjacentHTML('afterbegin', `<div class="muted">${esc(m.name)}</div>`); }
        break;
      }
      case 'psk_state': if (m.fc) { st.pkFc = Math.round(m.fc); $('#pkFc').value = st.pkFc; } break;
      case 'psk_rx': addText($('#pkScreen'), '#pkHint', m.text); break;
      case 'psk_info':
        $('#pkInfo').textContent = tr('pk.info','{fc} Гц · качество {q}%').replace('{fc}', m.fc).replace('{q}', Math.round(m.q * 100));
        if (Math.abs(m.fc - st.pkFc) >= 1) { st.pkFc = Math.round(m.fc); marks(); }
        break;
      case 'psk_tx_start': st.txText = m.text.trim(); $('#pkTxLine').classList.remove('hidden'); txProg(0); addText($('#pkScreen'), '#pkHint', '\n» ' + st.txText + '\n'); break;
      case 'psk_tx_progress': txProg(m.pos); break;
      case 'psk_tx_done': txProg(st.txText.length); setTimeout(() => $('#pkTxLine').classList.add('hidden'), 1200); if (m.msg || m.msg_key) toast(resolveServerMsg(m), 6000); break;
    }
  }
  function onBin(b) {
    const dv = new DataView(b.buffer, b.byteOffset), a = dv.getUint16(1, true), W = dv.getUint16(3, true);
    if (b[0] === 7) svRow(a, b.subarray(5, 5 + W * 3));
    else if (b[0] === 8) { svSize(W, Math.max(st.svH, a)); for (let y = 0; y < a; y++) svRow(y, b.subarray(5 + y * W * 3, 5 + (y + 1) * W * 3)); }
  }
  function resend() {
    st.nx = store.get('nxOn', false); st.sv = store.get('svOn', false); st.pk = store.get('pkOn', false);
    renderBtns();
    if (st.nx) sendNx();
    send({ t: 'sstv_dec', on: st.sv, auto: $('#svAuto').checked, mode: $('#svMode').value });
    if (st.pk) sendPk();
    marks();
  }
  return { on, onBin, resend, pick, marks, stop: () => send({ t: 'psk_stop' }) };
})();
window.digi2 = digi2;

// ======================================================================= FT8 / FT4 (в духе JTDX / MSHV)
const ft8Desk = (() => {
  const st = { on: store.get('ftOn', false), mode: 'FT8', txHz: 1500, rxHz: store.get('ftRx', 1500), txEnable: false, tx: false,
    par: 0, clockOff: 0, rows: 0, rxRows: 0, qsoKey: '', txMsg: '', myCall: '', myGrid: '',
    rowCount: 0, slotRow: {}, lastK: null, labSpan: 0, labOn: store.get('ftWfLab', true), seq: 0 };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const list = $('#ftList'), rxList = $('#ftRxList'), lab = $('#ftLab');
  const SLOT = () => st.mode === 'FT4' ? 7.5 : 15;
  const BW = () => st.mode === 'FT4' ? 83 : 50;
  const now = () => Date.now() / 1000 + st.clockOff;
  const fmtUtc = slot => slot.slice(0, 2) + slot.slice(2, 4) + slot.slice(4, 6);
  const rpt = v => { v = clamp(Math.round(+v || 0), -30, 49); return (v < 0 ? '-' : '+') + String(Math.abs(v)).padStart(2, '0'); };
  const active = () => C.tab === 'ft8';

  // ---------------------------------------------------------------- кнопки
  function renderOn() {
    $('#ftOnBtn').classList.toggle('on', st.on);
    $('#ftOnBtn').textContent = st.on ? tr('ft.rx_on','● Приём вкл') : tr('ft.rx_off','○ Приём выкл');
  }
  const turnOn = () => { if (!st.on) { st.on = true; store.set('ftOn', true); renderOn(); send({ t: 'ft_hello', on: true }); } };
  $('#ftOnBtn').onclick = () => { st.on = !st.on; store.set('ftOn', st.on); renderOn(); send({ t: 'ft_hello', on: st.on }); };
  $$('#ftModeSw button').forEach(b => b.onclick = () => send({ t: 'ft_mode', mode: b.dataset.v }));
  $('#ftBand').onchange = e => {
    const kHz = +e.target.value; if (!kHz) return;
    if (S.mode !== 'DATA-U') setParam('mode', 'DATA-U');
    setFreq(Math.round(kHz * 1000)); turnOn();
    toast(tr('toast.ft_tune','{mode}: DATA-U {khz} кГц').replace('{mode}', st.mode).replace('{khz}', kHz)); e.target.value = '';
  };
  $('#ftCq').onclick = () => { turnOn(); send({ t: 'ft_cq' }); };
  $('#ftEnable').onclick = () => send({ t: 'ft_enable', on: !st.txEnable });
  $('#ftHalt').onclick = () => send({ t: 'ft_halt' });
  $('#ftTune').onclick = () => send({ t: 'ft_tune', on: !st.tune });
  $('#ftAutoSeq').onchange = e => send({ t: 'ft_auto_seq', on: e.target.checked });
  $('#ftAutoCq').onchange = e => send({ t: 'ft_auto_cq', on: e.target.checked });
  $('#ftPar').onchange = e => send({ t: 'ft_par', par: +e.target.value });
  $('#ftTxHz').onchange = e => setTx(+e.target.value);
  $('#ftRxHz').onchange = e => setRx(+e.target.value);
  $('#ftTx2Rx').onclick = () => setRx(st.txHz);
  $('#ftRx2Tx').onclick = () => setTx(st.rxHz);
  let countryPref = store.get('ftCountry', '');
  $('#ftClear').onclick = () => {
    list.querySelectorAll('.ft-row, .ft-sep, .ft-hint').forEach(e => e.remove());
    st.rows = 0;
    countryPref = ''; store.set('ftCountry', '');
    applyFilter();
  };
  
  $('#ftClear2').onclick = () => {
    rxList.querySelectorAll('.ft-row, .ft-sep').forEach(e => e.remove());
    st.rxRows = 0;
  };
  $('#ftFilter').value = store.get('ftFilter', 'all');
  $('#ftSearch').value = store.get('ftSearch', '');
  $('#ftAge').value = store.get('ftAge', '0');
  $('#ftSort').value = store.get('ftSort', 'time-asc');
  $('#ftFilter').onchange = e => { store.set('ftFilter', e.target.value); applyFilter(); list.scrollTop = 0; };
  $('#ftSearch').oninput = e => { store.set('ftSearch', e.target.value); applyFilter(); list.scrollTop = 0; };
  $('#ftCountry').onchange = e => { countryPref = e.target.value; store.set('ftCountry', countryPref); applyFilter(); list.scrollTop = 0; };
  $('#ftAge').onchange = e => { store.set('ftAge', e.target.value); applyFilter(); list.scrollTop = 0; };
  $('#ftSort').onchange = e => {
    store.set('ftSort', e.target.value); applyFilter();
    if (e.target.value === 'time-desc') list.scrollTop = 0;
    else if (e.target.value === 'time-asc') list.scrollTop = list.scrollHeight;
  };
  applyFilter();
  $('#ftAlertSnd').checked = store.get('ftAlertSnd', false);
  $('#ftAlertSnd').onchange = e => store.set('ftAlertSnd', e.target.checked);
  $('#ftHeardBtn').onclick = () => send({ t: 'ft_heard' });
  $('#ftAdifClear').onclick = () => send({ t: 'ft_import_clear' });
  $('#ftAdifFile').onchange = async e => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    let recs = [];
    for (const f of files) recs = recs.concat(parseAdif(await f.text()));
    if (!recs.length) return toast(tr('toast.ft_no_adif', 'В файле не нашлось связей ADIF'));
    toast(tr('toast.ft_adif','Загружаю {n} связей…').replace('{n}', recs.length));
    const N = 5000;
    for (let i = 0; i < recs.length || i === 0; i += N)
      send({ t: 'ft_import', recs: recs.slice(i, i + N), first: i === 0, last: i + N >= recs.length,
        replace: $('#ftAdifReplace').checked });
  };
  function parseAdif(text) {               // ADIF -> [[позывной, диапазон, вид, локатор]]
    const body = text.split(/<eoh>/i).pop(), out = [];
    for (const rec of body.split(/<eor>/i)) {
      const f = {}; const re = /<(\w+):(\d+)(?::\w)?>/g; let m;
      while ((m = re.exec(rec))) { const n = +m[2]; f[m[1].toLowerCase()] = rec.substr(re.lastIndex, n); re.lastIndex += n; }
      if (!f.call) continue;
      let band = (f.band || '').toLowerCase();
      if (!band && f.freq) band = bandOf(+f.freq * 1e6);
      out.push([f.call.trim().toUpperCase(), band, (f.submode || f.mode || '').toUpperCase(), (f.gridsquare || '').slice(0, 4).toUpperCase()]);
    }
    return out;
  }
  function bandOf(hz) {
    const B = [[1.8, 2, '160m'], [3.5, 4, '80m'], [5.3, 5.5, '60m'], [7, 7.3, '40m'], [10.1, 10.15, '30m'], [14, 14.35, '20m'],
      [18.068, 18.168, '17m'], [21, 21.45, '15m'], [24.89, 24.99, '12m'], [28, 29.7, '10m'], [50, 54, '6m'], [70, 71, '4m'], [144, 148, '2m'], [430, 440, '70cm']];
    const mhz = hz / 1e6; const b = B.find(x => mhz >= x[0] && mhz <= x[1]); return b ? b[2] : '';
  }
  function beep() {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
      o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(a.destination);
      o.start(); o.frequency.setValueAtTime(1320, a.currentTime + 0.12); o.stop(a.currentTime + 0.3);
      setTimeout(() => a.close(), 600);
    } catch (e) { /* без звука */ }
  }
  C.ftSecs = +store.get('ftWfSpeed', 20) || 0;
  $('#ftWfSpeed').value = String(C.ftSecs);
  $('#ftWfSpeed').onchange = e => { C.ftSecs = +e.target.value; store.set('ftWfSpeed', C.ftSecs); };
  $('#ftWfLab').checked = st.labOn;
  $('#ftWfLab').onchange = e => { st.labOn = e.target.checked; store.set('ftWfLab', st.labOn); marks(); };
  const CFG = { ftCall: 'my_call', ftGrid: 'my_grid', ftPwr: 'ft_pwr', ftTries: 'ft_tries', ftLevel: 'ft_tx_level',
    ftUdpOn: 'ft_udp_on', ftUdpHost: 'ft_udp_host', ftUdpPort: 'ft_udp_port', ftWide: 'ft_wide',
    ftPskOn: 'psk_on', ftPskAnt: 'psk_antenna', ftAlertDx: 'ft_alert_dxcc' };
  for (const [id, k] of Object.entries(CFG)) {
    $('#' + id).addEventListener('change', e => {
      const el = e.target;
      const v = el.type === 'checkbox' ? el.checked : (el.type === 'number' || el.type === 'range') ? +el.value
        : (id === 'ftUdpHost' || id === 'ftPskAnt') ? el.value.trim() : el.value.trim().toUpperCase();
      send({ t: 'ft_cfg', [k]: v });
    });
  }

  function setTx(hz) {
    hz = clamp(Math.round(hz), 200, 3000); st.txHz = hz; $('#ftTxHz').value = hz;
    send({ t: 'ft_freq', tx: hz }); marks();
  }
  function setRx(hz) {
    hz = clamp(Math.round(hz), 200, 3000); st.rxHz = hz; $('#ftRxHz').value = hz; store.set('ftRx', hz);
    $('#ftRxLbl').textContent = tr('ft.hz','{hz} Гц').replace('{hz}', hz);
    send({ t: 'ft_freq', rx: hz }); marks();
  }
  function pickWf(hz, how) {          // водопад: клик — RX, правый/Shift — TX, двойной — оба
    if (how !== 'tx') setRx(hz);
    if (how !== 'rx') setTx(hz);
  }
  function marks() {
    C.ftMarks = active() ? [[st.rxHz, '#3ddc84', BW()], [st.txHz, '#ff5a4d', BW()]] : [];
    lab.style.display = active() && st.labOn ? '' : 'none';
    drawOverlay(); drawLab();
  }

  // ---------------------------------------------------------------- стандартные сообщения Tx1…Tx6
  const MSG_N = 6;
  $('#ftMsgs').innerHTML = Array.from({ length: MSG_N }, (_, i) =>
    `<div class="ft-msg" data-i="${i}"><button class="btn small" title="Передавать это сообщение">Tx${i + 1}</button><input class="text" maxlength="37"></div>`).join('') +
    `<div class="ft-msg"><button class="btn small" id="ftFreeBtn" title="Передать свой текст">Свой</button><input class="text" id="ftText" maxlength="37" placeholder="свободный текст, Enter — передать"></div>`;
  const msgInputs = $$('#ftMsgs .ft-msg[data-i] input');
  function genMsgs(push = true) {
    const call = $('#ftDxCall').value.trim().toUpperCase(), grid = $('#ftDxGrid').value.trim().toUpperCase();
    const my = st.myCall || 'MYCALL', g = st.myGrid || '', r = rpt($('#ftRpt').value);
    const m = call ? [`${call} ${my} ${g}`.trim(), `${call} ${my} ${r}`, `${call} ${my} R${r}`, `${call} ${my} RR73`, `${call} ${my} 73`]
      : ['', '', '', '', ''];
    m.push(`CQ ${my} ${g}`.trim());
    msgInputs.forEach((el, i) => { el.value = m[i]; });
    if (push && call) send({ t: 'ft_dx', call, grid, rst: r });
    renderCur();
  }
  $('#ftGen').onclick = () => { if (!$('#ftDxCall').value.trim()) send({ t: 'ft_dx', call: '' }); genMsgs(); };
  ['#ftDxCall', '#ftDxGrid', '#ftRpt'].forEach(id => $(id).addEventListener('change', () => genMsgs()));
  $$('#ftMsgs .ft-msg[data-i] .btn').forEach(b => b.onclick = () => {
    const i = +b.parentElement.dataset.i, text = msgInputs[i].value.trim();
    if (!text) return toast(tr('toast.need_dx', 'Сначала укажите DX позывной и нажмите «Сформировать»'));
    turnOn();
    if (i === 5) { send({ t: 'ft_cq' }); return; }
    const call = $('#ftDxCall').value.trim().toUpperCase();
    if (call) send({ t: 'ft_dx', call, grid: $('#ftDxGrid').value.trim().toUpperCase(), rst: rpt($('#ftRpt').value) });
    send({ t: 'ft_text', text });
  });
  const sendText = () => { const el = $('#ftText'); if (!el) return; const t = el.value.trim(); if (t) { turnOn(); send({ t: 'ft_text', text: t }); } };
  if ($('#ftFreeBtn')) $('#ftFreeBtn').onclick = sendText;
  if ($('#ftText')) $('#ftText').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendText(); } });
  function renderCur() {
    $$('#ftMsgs .ft-msg').forEach(r => { const inp = $('input', r); r.classList.toggle('cur', !!st.txMsg && inp.value.trim() === st.txMsg); });
  }

  // ---------------------------------------------------------------- часы и полоска периода
  setInterval(() => {
    const t = now();
    $('#ftClock').textContent = new Date(t * 1000).toISOString().slice(11, 19) + ' UTC';
    const s = SLOT(), k = Math.floor(t / s);
    $('#ftSlotBar').style.width = ((t - k * s) / s * 100).toFixed(1) + '%';
    $('#ftSlotBar').parentElement.classList.toggle('tx', st.tx);
  }, 200);

  // ---------------------------------------------------------------- водопад: время периодов и позывные
  // Метки хранятся с номером строки водопада и перерисовываются целиком на каждой новой строке.
  const labs = [];                         // {row, hz|null, text, col}
  function clearLab() { labs.length = 0; st.slotRow = {}; drawLab(); }
  function drawLab() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!lab.clientWidth) return;
    const W = Math.round(lab.clientWidth * dpr), H = Math.round(lab.clientHeight * dpr);
    if (lab.width !== W || lab.height !== H) { lab.width = W; lab.height = H; }
    const ctx = lab.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    if (!active() || !st.labOn || mirrored()) return;
    const sh = H / (wf.rows || lab.clientHeight);
    ctx.font = `${11 * dpr}px Consolas, monospace`;
    while (labs.length && (st.rowCount - labs[0].row) * sh > H + 20 * dpr) labs.shift();
    for (const l of labs) {
      const y = (st.rowCount - l.row) * sh;
      if (l.hz == null) {                  // начало периода: линия и время
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(0, y, W, Math.max(1, dpr));
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(l.text, 4 * dpr, y + 12 * dpr);
      } else {
        const x = l.hz / C.span * W + 2 * dpr, yy = y - l.dy * dpr;
        if (yy < 10 * dpr) continue;
        ctx.font = `bold ${11 * dpr}px Consolas, monospace`;
        ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(l.text, x, yy);
        ctx.fillStyle = l.col; ctx.fillText(l.text, x, yy);
        ctx.font = `${11 * dpr}px Consolas, monospace`;
      }
    }
  }
  function onRow() {                       // вызывается на каждую новую строку водопада
    st.rowCount++;
    const s = SLOT(), k = Math.floor(now() / s);
    if (k !== st.lastK) {
      st.lastK = k; st.slotRow[k] = st.rowCount;
      labs.push({ row: st.rowCount, hz: null, text: new Date(k * s * 1000).toISOString().slice(11, 19) });
      for (const kk in st.slotRow) if (kk < k - 40) delete st.slotRow[kk];
    }
    if (active() && st.labOn) drawLab();
  }
  function labelDecodes(m) {
    if (m.t0 == null) return;
    const r0 = st.slotRow[Math.round(m.t0 / SLOT())];
    if (r0 == null) return;
    const used = [];
    for (const it of m.items) {
      if (!it.call) continue;
      let dy = 4;                          // подпись чуть выше линии начала периода, без наложений
      while (used.some(u => Math.abs(u[0] - it.f) < 160 && u[1] === dy)) dy += 12;
      used.push([it.f, dy]);
      const col = it.tags.includes('me') ? '#ff6b6b' : it.tags.includes('newdxcc') ? '#ff7bff' : it.tags.includes('newband') ? '#ffb347'
        : it.tags.includes('cq') ? '#7dffa8' : '#ffffff';
      labs.push({ row: r0, hz: it.f, text: it.call, col, dy });
    }
    labs.sort((a, b) => a.row - b.row);
    drawLab();
  }

  // ---------------------------------------------------------------- списки расшифровок
  const nearRx = it => Math.abs(it.f - st.rxHz) <= BW() + 10;
  function updateCountries(rows) {
    const names = [...new Set(rows.map(r => r.dataset.country).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const sel = $('#ftCountry'), current = [...sel.options].map(o => o.value);
    if (current.length !== names.length + 1 || names.some((n, i) => current[i + 1] !== n)) {
      let all = sel.options[0];
      if (!all) { all = document.createElement('option'); all.value = ''; all.textContent = tr('ft8.filters.country.all', 'Все страны'); }
      sel.replaceChildren(all);
      for (const n of names) { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.append(o); }
    }
    const value = countryPref && names.includes(countryPref) ? countryPref : '';
    if (countryPref && !value && names.length) countryPref = '';
    sel.value = value;
    return names;
  }
  function applyFilter() {
    const rows = $$('#ftList .ft-row');
    const f = $('#ftFilter').value, has = (r, ...c) => c.some(x => r.classList.contains(x));
    const search = $('#ftSearch').value.trim().toUpperCase();
    const age = +$('#ftAge').value || 0, sort = $('#ftSort').value;
    const cutoff = age ? now() - age * 60 : 0;
    updateCountries(rows);
    let visible = 0;
    for (const r of rows) {
      const ts = +r.dataset.ts || 0;
      let show = f === 'cq' ? has(r, 'cq', 'me') : f === 'new' ? has(r, 'me', 'newdxcc', 'newband', 'newcall') : true;
      if (show && search) show = ((r.dataset.call || '') + ' ' + (r.dataset.country || '')).toUpperCase().includes(search);
      if (show && countryPref) show = (r.dataset.country || '') === countryPref;
      if (show && cutoff) show = ts >= cutoff;
      r.classList.toggle('hidden', !show);
      if (show) visible++;
    }
    if (sort === 'time-desc' || sort === 'time-asc') {
      const desc = sort === 'time-desc';
      [...list.children].filter(el => el.classList.contains('ft-row') || el.classList.contains('ft-sep'))
        .sort((a, b) => {
          const ta = +a.dataset.ts || 0, tb = +b.dataset.ts || 0;
          if (ta !== tb) return desc ? tb - ta : ta - tb;
          const sa = a.classList.contains('ft-sep') ? 0 : (+a.dataset.seq || 0);
          const sb = b.classList.contains('ft-sep') ? 0 : (+b.dataset.seq || 0);
          return sa - sb;                 // разделитель периода — перед своими строками
        })
        .forEach((el, i) => { el.style.order = String(i); });
    } else if (sort === 'country') {
      [...rows].sort((a, b) => {
        const ca = a.dataset.country || '', cb = b.dataset.country || '';
        if (!ca && cb) return 1;
        if (ca && !cb) return -1;
        return ca.localeCompare(cb) || (+a.dataset.ts - +b.dataset.ts) || (+a.dataset.seq - +b.dataset.seq);
      }).forEach((r, i) => { r.style.order = String(i); });
      $$('#ftList .ft-sep').forEach(s => { s.style.order = ''; });
    } else {
      [...list.children].forEach(el => { el.style.order = ''; });
    }
    const filtering = !!search || !!countryPref || age > 0 || f !== 'all';
    $$('#ftList .ft-sep').forEach(s => {
      s.classList.toggle('hidden', sort !== 'time-asc' || filtering);
    });
    $('#ftEmpty').hidden = !(rows.length && !visible);
  }
  function row(it, utc, extra = '', ts = 0) {
    const r = document.createElement('div');
    r.className = 'ft-row ' + it.tags.join(' ') + extra;
    r.dataset.call = it.call || '';
    r.dataset.country = it.country || '';
    r.dataset.ts = String(ts || 0);
    r.dataset.seq = String(++st.seq);
    const badge = it.tags.includes('newdxcc') ? '<b class="bd bd-dx" title="Новая страна">страна</b>'
      : it.tags.includes('newband') ? '<b class="bd bd-band" title="Страна не сработана на этом диапазоне">диап.</b>' : it.tags.includes('newcall') ? '<b class="bd bd-call" title="С этим позывным связи не было">нов.</b>' : '';
    r.innerHTML = `<span class="ft-utc">${utc}</span><span class="n">${it.snr}</span><span class="n">${it.dt.toFixed(1)}</span><span class="n">${it.f}</span>` +
      `<span class="tx"><span class="msg">${esc(it.text)}</span>${badge}</span><span class="cty" title="${esc(it.country || '')}">${esc(it.country || '')}</span>`;
    r.title = (it.call ? tr('ft.tooltip_call','Нажмите — позвать {call}').replace('{call}', it.call) : '') + (it.country ? tr('ft.tooltip_country','\n{country}{cont}').replace('{country}', it.country).replace('{cont}', it.cont ? ' (' + it.cont + ')' : '') : '') +
      (it.km != null ? `, ${it.km} км` : '') + (it.tags.includes('worked') ? '\nУже работали на этом диапазоне' : '') +
      (it.tags.includes('newgrid') ? '\nНовый квадрат' : '');
    r.onclick = () => {
      if (!st.myCall) { toast(tr('toast.ft_need_mycall', 'Укажите свой позывной в настройках FT8')); $('.ft-cfg').open = true; return; }
      turnOn(); setRx(it.f); send({ t: 'ft_call', item: it });
    };
    return r;
  }
  function trim(el, key) {
    while (st[key] > 500) {
      const first = [...el.children].find(x => x.classList.contains('ft-row') || x.classList.contains('ft-sep'));
      if (!first) break;
      if (first.classList.contains('ft-row')) st[key]--;
      first.remove();
    }
  }
  function sep(text, ts = 0) { const d = document.createElement('div'); d.className = 'ft-sep'; d.textContent = text; d.dataset.ts = String(ts || 0); return d; }
  const seen = new Set();
  // списки прокручиваются к новым строкам, пока пользователь сам не отмотал вверх
  const follow = new Map([[list, true], [rxList, true]]);
  for (const el of [list, rxList]) el.addEventListener('scroll', () => follow.set(el, el.scrollTop + el.clientHeight >= el.scrollHeight - 30));
  const toEnd = el => {
    if (!follow.get(el)) return;
    if (el === list) {
      const sort = $('#ftSort').value;
      if (sort === 'time-asc') el.scrollTop = el.scrollHeight;
      else if (sort === 'time-desc') el.scrollTop = 0;
      return;                          // при сортировке по стране позицию не трогаем
    }
    el.scrollTop = el.scrollHeight;
  };
  function addSlot(m) {
    const key = m.mode + m.slot;
    if (seen.has(key)) return;                // повтор при переподключении
    seen.add(key);
    $('#ftHint')?.remove();
    const utc = fmtUtc(m.slot), hh = `${m.slot.slice(0, 2)}:${m.slot.slice(2, 4)}:${m.slot.slice(4, 6)}`;
    const ts = +m.t0 || (() => {
      if (!/^\d{6}$/.test(m.slot || '')) return now();
      const d = new Date(now() * 1000);
      const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
        +m.slot.slice(0, 2), +m.slot.slice(2, 4), +m.slot.slice(4, 6)) / 1000;
      return t > now() + 60 ? t - 86400 : t;
    })();
    list.append(sep(`────── ${hh} ${m.mode} ${m.items.length ? '' : '· тишина '}──────`, ts));
    for (const it of m.items) { list.append(row(it, utc, '', ts)); st.rows++; }
    trim(list, 'rows'); applyFilter();
    toEnd(list);
    const mine = m.items.filter(it => nearRx(it) || it.tags.includes('me'));
    if (mine.length) {
      for (const it of mine) { rxList.append(row(it, utc)); st.rxRows++; }
      trim(rxList, 'rxRows');
      toEnd(rxList);
    }
  }
  function addMine(text, slot) {
    const r = document.createElement('div');
    r.className = 'ft-row mine';
    r.innerHTML = `<span>${slot ? fmtUtc(slot) : ''}</span><span class="n">TX</span><span class="n"></span><span class="n">${st.txHz}</span><span class="tx">${esc(text)}</span>`;
    rxList.append(r); st.rxRows++;
    follow.set(rxList, true); toEnd(rxList);
  }
  function addLog(q) {
    const L = $('#ftLog'); L.querySelector('.muted')?.remove();
    const d = document.createElement('div');
    d.textContent = `${q.time}  ${q.call.padEnd(10)} ${(q.grid || '').padEnd(4)}  ${q.sent}/${q.rcvd}  ${q.band} ${q.mode}`;
    L.prepend(d);
    $('#ftLogInfo').textContent = '· ' + L.children.length;
  }

  // ---------------------------------------------------------------- состояние сервера
  function render(m) {
    st.mode = m.mode; st.txEnable = m.tx_enable; st.par = m.tx_par; st.tune = m.tune; st.txMsg = m.tx_msg || '';
    st.myCall = m.my_call || ''; st.myGrid = m.my_grid || '';
    if (document.activeElement !== $('#ftTxHz')) { st.txHz = m.tx_hz; $('#ftTxHz').value = m.tx_hz; }
    if (m.now) st.clockOff = m.now - Date.now() / 1000;
    $$('#ftModeSw button').forEach(b => b.classList.toggle('on', b.dataset.v === m.mode));
    const bandsHtml = '<option value="">— выбрать —</option>' + m.bands.map(b => `<option value="${b[1]}">${b[0]} — ${b[1]} кГц</option>`).join('');
    if ($('#ftBand').dataset.mode !== m.mode) { $('#ftBand').innerHTML = bandsHtml; $('#ftBand').dataset.mode = m.mode; }
    $('#ftEnable').textContent = m.tx_enable ? tr('ft.tx_on','TX включён') : tr('ft.tx_off','Включить TX');
    $('#ftEnable').classList.toggle('tx-on', m.tx_enable);
    $('#ftTune').classList.toggle('tune-on', !!m.tune);
    $('#ftTune').textContent = m.tune ? tr('ft.tuning','Настройка…') : tr('ft.tune','Настройка');
    $('#ftAutoCq').checked = m.auto_cq; $('#ftAutoSeq').checked = m.auto_seq !== false;
    $('#ftPar').value = String(m.tx_par);
    $('#ftTxMsg').textContent = m.tx_msg || '—';
    const q = m.qso;
    const STEP = { call: tr('ft.step.call','зовём'), report: tr('ft.step.report','дали рапорт'), roger: tr('ft.step.roger','подтвердили (R)'), rr73: tr('ft.step.rr73','RR73 — связь в логе'), '73': tr('ft.step.73','73 — связь в логе') };
    $('#ftQso').textContent = q ? tr('ft.qso_active','Связь с {call} {grid} · {step} · рапорт {sent} / {rcvd}').replace('{call}', q.call).replace('{grid}', q.grid || '').replace('{step}', STEP[q.step] || q.step).replace('{sent}', q.rst_sent || '—').replace('{rcvd}', q.rst_rcvd || '—') :
      (st.txMsg.startsWith('CQ') && m.tx_enable ? tr('ft.calling_cq','Зовём CQ…') : tr('ft.no_qso','Связи нет'));
    // DX позывной / локатор / рапорт — как в JTDX: подставляются из текущей связи
    const key = q ? `${q.call}|${q.grid}|${q.rst_sent}` : '';
    if (key && key !== st.qsoKey && ![$('#ftDxCall'), $('#ftDxGrid'), $('#ftRpt')].includes(document.activeElement)) {
      $('#ftDxCall').value = q.call; $('#ftDxGrid').value = q.grid || '';
      if (q.rst_sent) $('#ftRpt').value = parseInt(q.rst_sent, 10);
      genMsgs(false);
    }
    st.qsoKey = key;
    if (!msgInputs[5].value) genMsgs(false);
    const set = (id, v) => { const el = $('#' + id); if (document.activeElement === el) return; if (el.type === 'checkbox') el.checked = v !== false && !!v; else el.value = v ?? ''; };
    set('ftCall', m.my_call); set('ftGrid', m.my_grid); set('ftPwr', m.pwr); set('ftUdpOn', m.udp_on);
    set('ftUdpHost', m.udp_host); set('ftUdpPort', m.udp_port); set('ftWide', m.wide);
    if (!m.lib) $('#ftQso').textContent = tr('ft.lib_missing','Модуль FT8 не загружен: ') + m.lib_err;
    set('ftPskOn', m.psk_on); set('ftPskAnt', m.psk_antenna); set('ftAlertDx', m.alert_dxcc);
    const w = m.worked || {};
    $('#ftWorkedInfo').textContent = tr('ft.worked','{dxcc} стран, {calls} позывных, {qso} связей').replace('{dxcc}', w.dxcc ?? 0).replace('{calls}', w.calls ?? 0).replace('{qso}', w.qso ?? 0) +
      (w.imported ? tr('ft.worked_imported',' (из загруженного лога {n})').replace('{n}', w.imported) : tr('ft.worked_hint',' — загрузите свой журнал, иначе «новыми» считаются все'));
    $('#ftCtyInfo').textContent = m.cty && m.cty.n ? tr('ft.cty','Справочник стран cty.dat: {n} стран, версия {date}').replace('{n}', m.cty.n).replace('{date}', m.cty.date)
      : tr('ft.cty_off_long','Справочник стран cty.dat не найден — страны не определяются (программа скачает его сама при доступе в интернет)');
    if (st.myCall) $('#ftHeardMap').href = `https://pskreporter.info/pskmap.html?preset&callsign=${encodeURIComponent(st.myCall)}&timerange=1800&txrx=tx`;
    $('#ftHeardInfo').textContent = m.psk_on ? tr('ft.psk_on','PSK Reporter, 30 мин · отправлено {n}').replace('{n}', m.psk_sent) : tr('ft.psk_off','PSK Reporter выключен');
    renderCur(); marks();
  }

  function on(m) {
    switch (m.t) {
      case 'ft_state': render(m); break;
      case 'ft_dec':
        if (m.now) st.clockOff = m.now - Date.now() / 1000;
        addSlot(m);
        if (!m.old) labelDecodes(m);
        if (m.clock != null) {
          const el = $('#ftDt'); el.textContent = tr('ft.dt','dt {sign}{v} с').replace('{sign}', m.clock >= 0 ? '+' : '').replace('{v}', m.clock.toFixed(2));
          el.style.color = Math.abs(m.clock) > 0.7 ? 'var(--tx)' : Math.abs(m.clock) > 0.4 ? 'var(--warn)' : '';
        }
        break;
      case 'ft_tx':
        st.tx = m.on;
        $('#ftTxMsg').classList.toggle('on', m.on);
        if (m.on) addMine(m.msg, m.slot);
        break;
      case 'ft_qso': addLog(m.q); toast(tr('toast.ft_logged','В лог: {call} {sent}/{rcvd}').replace('{call}', m.q.call).replace('{sent}', m.q.sent).replace('{rcvd}', m.q.rcvd), 4000); break;
      case 'ft_log': $('#ftLog').innerHTML = m.items.length ? '' : `<span class="muted">${tr('ft.log_empty','Пока нет')}</span>`; m.items.forEach(addLog); break;
      case 'ft_note': toast(resolveServerMsg(m), 6000); break;
      case 'ft_alert':
        toast(tr('toast.ft_new_dxcc','★ Новая страна: {country} — {call} ({f} Гц)').replace('{country}', m.country).replace('{call}', m.call).replace('{f}', m.f), 8000);
        if ($('#ftAlertSnd').checked) beep();
        break;
      case 'ft_heard': {
        const H = $('#ftHeard');
        if (m.err && !m.items.length) { H.innerHTML = `<span class="muted">${tr('ft.heard_err','PSK Reporter не ответил: {err}').replace('{err}', esc(m.err))}</span>`; break; }
        if (!m.items.length) { H.innerHTML = `<span class="muted">${tr('ft.heard_none','За 30 минут вас никто не отметил')}</span>`; break; }
        const ago = t => { const s = Math.max(0, Date.now() / 1000 - t); return s < 3600 ? Math.round(s / 60) + ' мин' : Math.round(s / 3600) + ' ч'; };
        H.innerHTML = `<div class="muted">${tr('ft.heard_head','{n} станций, дальше всех — {call} {km} км').replace('{n}', m.n).replace('{call}', esc(m.items[0].call)).replace('{km}', m.items[0].km ?? '?')}</div>` +
          m.items.map(r => `<div title="${esc(r.country || '')}">${esc(r.call.padEnd(10))} ${esc((r.grid || '').slice(0, 4).padEnd(4))} ` +
            `${String(r.km ?? '').padStart(5)} км ${r.snr != null ? String(r.snr).padStart(3) + ' дБ' : '      '} ${esc(r.band)} · ${ago(r.t)} назад</div>`).join('');
        break;
      }
    }
  }
  function resend() { renderOn(); send({ t: 'ft_hello', on: st.on }); send({ t: 'ft_freq', rx: st.rxHz }); }
  renderOn(); setRxLabel();
  function setRxLabel() { $('#ftRxHz').value = st.rxHz; $('#ftRxLbl').textContent = tr('ft.hz','{hz} Гц').replace('{hz}', st.rxHz); }
  return { on, resend, setTx, pickWf, marks, onRow };
})();
window.ft8Desk = ft8Desk;
