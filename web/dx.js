/* Read-only cluster feed. Tuning is validated again on the server. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const t = (key, fallback) => window.I18N ? I18N.t(key, fallback) : fallback;
  let state = {state:'off', spots:[], total:0, log_qso:0}, selected = '', initialized = false;
  let shown = [], markerKey = '';
  const bandName = b => b ? (b[0] === '70' ? '70cm' : b[0] + 'm') : '?';
  const bandmap = document.createElement('div'); bandmap.id = 'dxBandmap';
  document.querySelector('.wfpanel').insertBefore(bandmap, el('wfWrap'));
  for (const band of BANDS.filter(b => b[0] !== 'AIR')) {
    const option = document.createElement('option'); option.value = bandName(band); option.textContent = bandName(band); el('dxBand').append(option);
  }
  function sendDx(message) { if (C.authed) send(message); }
  const filters = ['dxBand','dxMode','dxAge','dxSearch','dxNew'];
  const saved = store.get('dxFilters', {});
  for (const id of filters) {
    const input = el(id);
    if (saved[id] != null) { if (input.type === 'checkbox') input.checked = !!saved[id]; else input.value = saved[id]; }
    input.addEventListener('input', () => {
      store.set('dxFilters', Object.fromEntries(filters.map(k => [k, el(k).type === 'checkbox' ? el(k).checked : el(k).value]))); render();
    });
  }
  function filtered() {
    const age = Number(el('dxAge').value) || 30, search = el('dxSearch').value.trim().toUpperCase();
    const band = el('dxBand').value === 'current' ? bandName(bandOf(S.freq_a)) : el('dxBand').value;
    const mode = el('dxMode').value;
    return state.spots.filter(s => Date.now()/1000 - s.time <= age*60 && (!band || s.band === band) &&
      (!mode || (mode === 'unknown' ? !s.mode : mode === 'SSB' ? ['SSB','USB','LSB'].includes(s.mode) : s.mode === mode)) &&
      (!search || (s.call + ' ' + s.country).toUpperCase().includes(search)) &&
      (!el('dxNew').checked || s.tags.some(x => ['newdxcc','newband'].includes(x))));
  }
  function select(id) {
    selected = id;
    for (const row of el('dxRows').children) row.setAttribute('aria-selected', String(row.dataset.id === id));
    const spot = shown.find(s => s.id === id);
    el('dxSelected').textContent = spot ? `${spot.call} · ${(spot.freq/1000).toFixed(1)} kHz` : t('dx.select','Выберите спот');
    el('dxTune').disabled = !spot || !C.authed || !S.connected || !!S.tx || C.pttBusy || C.txOwner;
  }
  function tune(id) { if (C.authed) sendDx({t:'dx_tune', id}); }
  function node(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; n.textContent = text; return n; }
  function render() {
    const status = state.state;
    const labels = {off:['dx.off','Отключён'],connecting:['dx.connecting','Подключение…'],login:['dx.login','Вход…'],waiting:['dx.waiting','Ожидание спотов'],live:['dx.live','Поток спотов'],retry:['dx.retry','Переподключение…'],offline:['dx.offline','Нет связи с пультом']};
    el('dxStatus').textContent = t(...(labels[status] || labels.off)); el('dxStatus').dataset.state = status;
    el('dxReason').textContent = state.reason || '';
    el('dxConnect').disabled = !C.authed;
    el('dxDisconnect').disabled = !C.authed || status === 'off';
    shown = filtered();
    el('dxCount').textContent = `${shown.length} / ${state.total ?? state.spots.length} ` + t('dx.spots','спотов');
    el('dxLog').textContent = state.log_qso ? `${state.log_qso} QSO ` + t('dx.inlog','в журнале') : t('dx.nolog','Журнал пуст — отметки предварительные');
    const fragment = document.createDocumentFragment();
    for (const s of shown) {
      const row = document.createElement('tr'); row.tabIndex = 0; row.dataset.id = s.id; row.setAttribute('aria-selected', String(selected === s.id));
      row.setAttribute('aria-label', `${s.call}, ${(s.freq/1000).toFixed(1)} kHz`);
      const station = document.createElement('td'); station.append(node('b','dx-call',s.call), node('span','dx-country',s.country || '—'));
      const tags = {newdxcc:['dx.newdxcc','Новая страна'],newband:['dx.newband','Новый диапазон'],worked:['dx.worked','Уже работали']};
      for (const tag of s.tags) if (tags[tag]) station.append(node('span','dx-tag '+tag,t(...tags[tag])));
      const details = node('td','dx-comment',s.comment || '—'); details.append(node('span','dx-country',`${s.reporter}${s.count > 1 ? ' ×'+s.count : ''}`));
      const time = new Date(s.time*1000); const when = node('td','dx-freq',time.toISOString().slice(11,16));
      when.title = `${Math.max(0,Math.floor((Date.now()/1000-s.time)/60))} min`;
      row.append(station,node('td','dx-freq',(s.freq/1000).toFixed(1)),details,when);
      row.onclick = () => select(s.id); row.ondblclick = () => tune(s.id);
      row.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); select(s.id); tune(s.id); } else if (e.key === ' ') { e.preventDefault(); select(s.id); } };
      fragment.append(row);
    }
    // Keep keyboard focus on the same spot after live updates.
    const focus = el('dxRows').contains(document.activeElement) ? document.activeElement.dataset.id : null;
    const scroll = el('dxRows').parentElement.parentElement.scrollTop;
    el('dxRows').replaceChildren(fragment);
    if (focus) [...el('dxRows').children].find(r => r.dataset.id === focus)?.focus({preventScroll:true});
    el('dxRows').parentElement.parentElement.scrollTop = scroll;
    el('dxEmpty').hidden = shown.length > 0;
    el('dxEmpty').textContent = state.spots.length ? t('dx.filtered','Нет спотов по выбранным фильтрам.') : status === 'off' ? t('dx.start','Укажите ваш позывной и подключитесь к кластеру. Здесь появятся реальные DX-споты.') : status === 'offline' ? t('dx.offline','Нет связи с пультом') : t('dx.wait','Ожидаем сообщения кластера. Новые споты появятся автоматически.');
    select(selected); markers();
  }
  function markers() {
    if (typeof rfView !== 'function' || !rfView() || !C.authed) { markerKey = ''; bandmap.replaceChildren(); return; }
    const {center,span} = wf.rf, width = bandmap.clientWidth;
    const spots = filtered();
    const key = JSON.stringify([center,span,width,spots.map(s => [s.id,s.comment])]);
    if (key === markerKey) return;
    markerKey = key;
    const slots = [[],[]], fragment = document.createDocumentFragment();
    for (const spot of spots) {
      const ratio = (spot.freq-center)/span + .5;
      if (ratio < 0 || ratio > 1) continue;
      const x = Math.max(45,Math.min(width-45,ratio*width));
      const lane = slots.findIndex(xs => xs.every(v => Math.abs(v-x) > 92));
      if (lane < 0) continue;
      slots[lane].push(x);
      const b = node('button','',spot.call); b.style.left = x+'px'; b.style.top = (4+lane*24)+'px';
      b.title = `${spot.call} · ${(spot.freq/1000).toFixed(1)} kHz · ${spot.comment}`;
      b.onclick = () => select(spot.id); b.ondblclick = () => tune(spot.id);
      b.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); tune(spot.id); } };
      fragment.append(b);
    }
    bandmap.replaceChildren(fragment);
  }
  el('dxConnectForm').onsubmit = e => {
    e.preventDefault(); sendDx({t:'dx_connect',config:{host:el('dxHost').value,port:Number(el('dxPort').value),call:el('dxCall').value}});
  };
  el('dxDisconnect').onclick = () => sendDx({t:'dx_disconnect'});
  function mergeSpots(message) {
    const map = new Map(state.spots.map(s => [s.id, s]));
    for (const spot of message.spots || []) map.set(spot.id, spot);
    for (const id of message.removed || []) map.delete(id);
    const cutoff = Date.now() / 1000 - 3600;             // same MAX_AGE as the server
    state.spots = [...map.values()].filter(s => s.time >= cutoff).sort((a, b) => b.time - a.time);
    state.state = message.state;
    state.reason = message.reason || '';
    state.total = message.total ?? state.spots.length;
    if (message.log_qso != null) state.log_qso = message.log_qso;
  }
  el('dxTune').onclick = () => tune(selected);
  window.dxDesk = {
    on(message) {
      if (message.t === 'dx_error') { el('dxReason').textContent = message.msg; toast(message.msg,4000); return; }
      if (message.t === 'dx_state') {
        // Full snapshot on connect/reconnect; later updates are deltas.
        state = Object.assign({state:'off', spots:[], total:0, log_qso:0}, message);
        state.spots = message.spots || [];
        state.total = message.total ?? state.spots.length;
        if (!initialized && message.config?.host) {
          el('dxHost').value = message.config.host; el('dxPort').value = message.config.port; el('dxCall').value = message.config.call;
        }
        initialized = true;
      } else if (message.t === 'dx_spots') {
        mergeSpots(message);
      } else if (message.t === 'dx_status') {
        state.state = message.state;
        state.reason = message.reason || '';
      } else return;
      if (state.state === 'live') el('dxSettings').open = false;
      render();
    },
    offline() { state.state = 'offline'; render(); }, markers
  };
  setInterval(() => { if (!el('dxRows').contains(document.activeElement)) render(); else { select(selected); markers(); } },5000);
  window.addEventListener('resize',markers);
  window.addEventListener('langchange',render);
  render();
})();
