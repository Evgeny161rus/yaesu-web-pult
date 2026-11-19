'use strict';
window.renderBackend = function () {
  const ham = S.backend === 'hamlib', caps = S.radio_caps || {};
  const changed = document.body.classList.contains('hamlib') !== ham;
  document.body.classList.toggle('hamlib', ham);
  const source = document.querySelector('.scope-source');
  if (source) source.textContent = S.demo ? 'АУДИОСПЕКТР · ДЕМОНСТРАЦИЯ' : 'АУДИОСПЕКТР · ЗВУКОВОЙ ВХОД';
  const host = document.getElementById('hamlibControls');
  if (!host) return;
  document.querySelector('.brand b').textContent = ham ? (S.radio_name || 'Yaesu') : 'FTX-1';
  if (ham) {
    document.getElementById('rigInfo').textContent = `${S.connected ? 'На связи' : 'Нет связи'} · Hamlib · текущий VFO`;
    const sig = JSON.stringify(caps);
    if (host.dataset.signature !== sig) {
      host.dataset.signature = sig;
      host.replaceChildren();
      const title = document.createElement('h3'); title.textContent = 'Управление через Hamlib'; host.append(title);
      const help = document.createElement('p'); help.className = 'muted small';
      help.textContent = 'Частота и режим относятся к текущему VFO. Мощность задаётся в процентах. Расширенные функции FTX-1 здесь недоступны.';
      host.append(help);
      const modeLabel = document.createElement('label'); modeLabel.textContent = 'Вид работы ';
      const mode = document.createElement('select'); mode.id = 'hamMode';
      mode.replaceChildren(...(caps.modes || []).map(m => new Option(m, m)));
      mode.disabled = !(caps.keys || []).includes('mode');
      mode.onchange = () => { setParam('mode', mode.value); renderBadges(); }; modeLabel.append(mode); host.append(modeLabel);
      const labels = {af:'AF трансивера',rf:'RF усиление',sql:'Шумоподавитель',mic:'Микрофон',power_pct:'Мощность, %'};
      for (const key of caps.keys || []) {
        if (!labels[key]) continue;
        const label = document.createElement('label'); label.className = 'ctl';
        const text = document.createElement('span'); text.textContent = labels[key] + ' ';
        const value = document.createElement('output'); value.id = 'hamVal-' + key; value.textContent = '—';
        const input = document.createElement('input'); input.type = 'range'; input.min = '0';
        input.max = ['af','rf','sql'].includes(key) ? '255' : '100'; input.id = 'ham-' + key;
        input.setAttribute('aria-label', labels[key]);
        input.onchange = () => setParam(key, Number(input.value));
        input.oninput = () => { value.textContent = input.value; };
        label.append(text,value,input); host.append(label);
      }
      const error = document.createElement('p'); error.id = 'hamError'; error.setAttribute('role','status'); host.append(error);
    }
    const mode = document.getElementById('hamMode');
    if (mode && document.activeElement !== mode) mode.value = S.mode || '';
    for (const key of caps.keys || []) {
      const el = document.getElementById('ham-' + key);
      if (el && document.activeElement !== el && S[key] != null) {
        el.value = S[key]; document.getElementById('hamVal-' + key).textContent = String(Math.round(S[key]));
      }
    }
    document.getElementById('hamError').textContent = S.backend_error || '';
    document.getElementById('ptt').disabled = !caps.ptt || !S.connected;
    const current = document.querySelector('#tabs button.on');
    if (changed || (current && !['rx','opts'].includes(current.dataset.tab)))
      document.querySelector('#tabs [data-tab="rx"]').click();
  } else document.getElementById('ptt').disabled = false;
  if (changed) window.dispatchEvent(new Event('resize'));
};
