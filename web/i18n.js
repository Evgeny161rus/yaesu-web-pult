/* Lightweight i18n for Yaesu Web Pult (RU/EN). */
(function () {
  const storeKey = 'ftx1.lang';
  const dict = {
    ru: {
      'lang.ru': 'Русский',
      'lang.en': 'English',
      'settings.language': 'Язык интерфейса',
      'login.title': 'Yaesu Web Pult',
      'login.msg': 'Введите пароль сервера',
      'login.placeholder': 'Пароль',
      'login.btn': 'Войти',
      'top.audio': '🔇 Звук',
      'top.audio.title': 'Звук приёма/передачи с этого устройства',
      'top.rec': '⏺ Запись',
      'top.rec.title': 'Записывать эфир (приём и передачу) в файл на ПК с сервером',
      'top.keys': '⌨',
      'top.keys.title': 'Горячие клавиши (?)',
      'top.panel': '⚙',
      'top.panel.title': 'Панель управления на сервере',
      'top.full': '⛶',
      'top.full.title': 'На весь экран',
      'top.vol.title': 'Громкость на этом устройстве',
      'top.nolink': 'нет связи',
      'conn.lost': 'Нет связи с сервером',
      'conn.not_responding': 'Трансивер не отвечает',
      'auth.msg': 'Введите пароль сервера',
      'auth.wrong': 'Неверный пароль',
      'tab.rx': 'Приём',
      'tab.tx': 'Передача',
      'tab.vfo': 'VFO/Память',
      'tab.cw': 'CW · Морзе',
      'tab.digi': 'Цифра',
      'tab.ft8': 'FT8',
      'tab.menu': 'Меню',
      'tab.cat': 'CAT',
      'tab.opts': 'Настройки',
      'common.on': 'Вкл',
      'common.off': 'Выкл',
      'common.auto': 'Авто',
      'common.clear': 'Очистить',
      'common.stop': 'Стоп',
      'common.send': 'Отправить',
      'common.save': 'Сохранить',
      'common.close': 'Закрыть',
      'common.back': 'Назад',
      'opts.appearance': 'Оформление пульта',
      'opts.language': 'Язык интерфейса',
      'opts.audio_rate': 'Качество звука по сети',
      'opts.audio_mic': 'Источник звука микрофона',
      'opts.scale': 'Масштаб интерфейса',
      'opts.ptt_mode': 'Режим PTT',
      'opts.palette': 'Палитра водопада',
      'opts.hotkeys': 'Горячие клавиши',
      'opts.hotkeys_enable': 'Включены (справка — клавиша ? или F1)',
      'opts.hotkeys_reset': 'Сбросить клавиши по умолчанию',
      'opts.recordings': 'Записи эфира',
      'opts.recordings_hint': 'Кнопка «⏺ Запись» пишет приём и передачу в файл WAV в папку records рядом с программой.',
      'opts.ptt.hold': 'Удерживать',
      'opts.ptt.toggle': 'Нажал — передача, нажал снова — приём',
      'opts.rate.48': '48 кГц — без потерь (лучше звук, больше трафик)',
      'opts.rate.16': '16 кГц (Wi-Fi, голос чище)',
      'opts.rate.8': '8 кГц (слабый интернет)',
      'opts.scale.auto': 'Авто — под размер экрана',
      'opts.mic.default': 'По умолчанию',
      'opts.mic.test': '🎙 Проверить микрофон',
      'opts.mic.test_hint': 'Проверка пойдёт без передачи на трансивер',
      'opts.mic.gain': 'Усиление микрофона, %',
      'opts.appearance.original': 'Оригинал',
      'opts.appearance.studio': 'Studio — тёмная, строгая панель',
      'opts.appearance.daylight': 'Daylight — светлая, контроль в дневном свете',
      'opts.appearance.heritage': 'Heritage — классика, тёплая палитра',
      'opts.appearance.field': 'Field — плотная, полевой режим',
      'opts.appearance.radio_night': 'Radio Night — приборная панель, тёмная',
      'opts.appearance.radio_silver': 'Radio Silver — приборная панель, серебристая',
      'opts.palette.classic': 'Классическая',
      'opts.palette.yaesu': 'Жёлтая',
      'opts.palette.gray': 'Серая',
      'opts.palette.fire': 'Огненная',
      'wf.audio': '🔊 Звук',
      'wf.audio.title': 'Источник водопада',
      'wf.center': '◇ Центр',
      'wf.center.title': 'AM/FM: показывать приём относительно центра в обе стороны — сигнал по центру, как на дисплее трансивера',
      'wf.floor': 'Пол',
      'wf.contrast': 'Конт',
      'wf.hint': 'Двойной клик — настроиться на сигнал',
      'ptt.btn': 'PTT',
      'ptt.info': 'Микрофон — по PTT',
      'help.title': 'Горячие клавиши',
      'help.close': 'Закрыть (Esc)',
      'help.edit': 'Изменить клавиши…',
      'help.note': 'Клавиши работают в любом разделе (кроме полей ввода).',
      'panel.title': 'Yaesu Web Pult — Панель управления',
      'panel.wizard.title': '👋 Первый запуск',
      'panel.run': '▶ Запустить',
      'panel.open': 'Открыть пульт',
      'panel.radio': '📻 Трансивер',
      'panel.scale': 'Масштаб интерфейса',
      'panel.scale.auto': 'Масштаб: авто',
      'panel.saved': '✓ сохранено',
      'conn.connecting': 'подключение…',
      'conn.nolink': 'нет связи',
    },
    en: {
      'lang.ru': 'Русский',
      'lang.en': 'English',
      'settings.language': 'Interface language',
      'login.title': 'Yaesu Web Pult',
      'login.msg': 'Enter server password',
      'login.placeholder': 'Password',
      'login.btn': 'Sign in',
      'top.audio': '🔇 Audio',
      'top.audio.title': 'Receive/transmit audio on this device',
      'top.rec': '⏺ Record',
      'top.rec.title': 'Record audio (RX/TX) to a file on the server PC',
      'top.keys': '⌨',
      'top.keys.title': 'Keyboard shortcuts (?)',
      'top.panel': '⚙',
      'top.panel.title': 'Server control panel',
      'top.full': '⛶',
      'top.full.title': 'Fullscreen',
      'top.vol.title': 'Volume on this device',
      'top.nolink': 'no connection',
      'conn.lost': 'No connection to server',
      'conn.not_responding': 'Transceiver not responding',
      'auth.msg': 'Enter server password',
      'auth.wrong': 'Wrong password',
      'tab.rx': 'Receive',
      'tab.tx': 'Transmit',
      'tab.vfo': 'VFO/Memory',
      'tab.cw': 'CW · Morse',
      'tab.digi': 'Digital',
      'tab.ft8': 'FT8',
      'tab.menu': 'Menu',
      'tab.cat': 'CAT',
      'tab.opts': 'Settings',
      'common.on': 'On',
      'common.off': 'Off',
      'common.auto': 'Auto',
      'common.clear': 'Clear',
      'common.stop': 'Stop',
      'common.send': 'Send',
      'common.save': 'Save',
      'common.close': 'Close',
      'common.back': 'Back',
      'opts.appearance': 'Interface theme',
      'opts.language': 'Interface language',
      'opts.audio_rate': 'Network audio quality',
      'opts.audio_mic': 'Microphone input device',
      'opts.scale': 'Interface scale',
      'opts.ptt_mode': 'PTT mode',
      'opts.palette': 'Waterfall palette',
      'opts.hotkeys': 'Keyboard shortcuts',
      'opts.hotkeys_enable': 'Enabled (help — ? or F1)',
      'top.audio.on': '🔊 Audio',
      'top.audio.off': '🔇 Audio',
      'top.rec.on': '⏺ Recording',
      'top.rec.off': '⏺ Record',
      'opts.hotkeys_reset': 'Reset shortcuts to defaults',
      'opts.recordings': 'Recordings',
      'opts.recordings_hint': 'The “⏺ Record” button saves RX/TX audio as WAV files in the records folder next to the program.',
      'opts.ptt.hold': 'Push to talk (hold)',
      'opts.ptt.toggle': 'Toggle (press to TX, press again to RX)',
      'opts.rate.48': '48 kHz — lossless (best quality, more traffic)',
      'opts.rate.16': '16 kHz (Wi-Fi, clearer voice)',
      'opts.rate.8': '8 kHz (slow connection)',
      'opts.scale.auto': 'Auto — fit screen',
      'opts.mic.default': 'Default',
      'opts.mic.test': '🎙 Test microphone',
      'opts.mic.test_hint': 'Test runs locally without transmitting to the radio',
      'opts.mic.gain': 'Microphone gain, %',
      'opts.appearance.original': 'Original',
      'opts.appearance.studio': 'Studio — dark, clean panel',
      'opts.appearance.daylight': 'Daylight — light, for daytime use',
      'opts.appearance.heritage': 'Heritage — classic, warm palette',
      'opts.appearance.field': 'Field — dense, field mode',
      'opts.appearance.radio_night': 'Radio Night — instrument panel, dark',
      'opts.appearance.radio_silver': 'Radio Silver — instrument panel, silver',
      'opts.palette.classic': 'Classic',
      'opts.palette.yaesu': 'Yaesu (yellow)',
      'opts.palette.gray': 'Gray',
      'opts.palette.fire': 'Fire',
      'wf.audio': '🔊 Audio',
      'wf.audio.title': 'Waterfall source',
      'wf.center': '◇ Center',
      'wf.center.title': 'AM/FM: show receive audio mirrored around center (signal in the middle), like the radio display',
      'wf.floor': 'Floor',
      'wf.contrast': 'Contrast',
      'wf.hint': 'Double-click to tune to a signal',
      'ptt.btn': 'PTT',
      'ptt.info': 'Microphone — on PTT',
      'help.title': 'Keyboard shortcuts',
      'help.close': 'Close (Esc)',
      'help.edit': 'Edit shortcuts…',
      'help.note': 'Shortcuts work in any tab (except text inputs).',
      'panel.title': 'Yaesu Web Pult — Control panel',
      'panel.wizard.title': '👋 First run',
      'panel.run': '▶ Start',
      'panel.open': 'Open remote control',
      'panel.radio': '📻 Transceiver',
      'panel.scale': 'Interface scale',
      'panel.scale.auto': 'Scale: auto',
      'panel.saved': '✓ saved',
      'conn.connecting': 'connecting…',
      'conn.nolink': 'no connection',
    }
  };

  let lang = 'ru';
  try {
    const saved = localStorage.getItem(storeKey);
    if (saved && dict[saved]) lang = saved;
    else if ((navigator.language || '').toLowerCase().startsWith('en')) lang = 'en';
  } catch {}

  function t(key, fallback) {
    const d = dict[lang] || dict.ru;
    if (d && Object.prototype.hasOwnProperty.call(d, key)) return d[key];
    const dr = dict.ru || {};
    if (Object.prototype.hasOwnProperty.call(dr, key)) return dr[key];
    return fallback != null ? fallback : key;
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (!k) return;
      const v = t(k);
      if (el.getAttribute('data-i18n-html') === '1') el.innerHTML = v;
      else el.textContent = v;
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      const k = el.getAttribute('data-i18n-title'); if (k) el.title = t(k);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const k = el.getAttribute('data-i18n-placeholder'); if (k) el.placeholder = t(k);
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const k = el.getAttribute('data-i18n-aria'); if (k) el.setAttribute('aria-label', t(k));
    });
    scope.querySelectorAll('[data-i18n-value]').forEach(el => {
      const k = el.getAttribute('data-i18n-value'); if (k) el.value = t(k);
    });
    try { document.documentElement.lang = lang; } catch {}
  }

  function setLang(next) {
    if (!dict[next]) return;
    lang = next;
    try { localStorage.setItem(storeKey, lang); } catch {}
    apply(document);
    try { window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } })); } catch {}
  }

  function getLang() { return lang; }
  function add(langCode, map) {
    if (!langCode || !map) return;
    dict[langCode] = Object.assign(dict[langCode] || {}, map);
  }

  window.I18N = { t, apply, setLang, getLang, add, dict };
  // Apply as early as possible when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply(document));
  } else {
    // may run before body parsed if included in head; also reapply on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => apply(document));
  }
})();


// appended keys
(function(){
  const add = (lang, obj) => { if (window.I18N && I18N.dict) Object.assign(I18N.dict[lang] || (I18N.dict[lang]={}), obj); };
  add('ru', {
    'ctl.af':'AF Громкость','ctl.rf':'RF Усиление','ctl.sql':'Шумодав (SQL)','ctl.agc':'AGC','ctl.preamp':'Предусилитель',
    'ctl.att':'Аттенюатор','ctl.nb':'NB (0 = выкл)','ctl.nr':'DNR (0 = выкл)','ctl.dnf':'DNF авто-режектор','ctl.width':'Полоса (WIDTH)',
    'ctl.ifshift':'IF SHIFT, Гц','ctl.narrow':'NAR (узкий)','ctl.notch':'Ручной режектор','ctl.notch_freq':'Режектор, Гц',
    'ctl.contour':'CONTOUR','ctl.contour_freq':'CONTOUR, Гц','ctl.apf':'APF (CW)','ctl.apf_freq':'APF сдвиг',
    'ctl.clar_rx':'CLAR RX (RIT)','ctl.clar_tx':'CLAR TX (XIT)','ctl.clar':'CLAR, Гц','ctl.dual':'Двойной приём',
    'ctl.power':'Мощность, Вт','ctl.mic':'MIC GAIN','ctl.proc':'Процессор (PROC)','ctl.proc_level':'Уровень PROC',
    'ctl.amc':'AMC','ctl.vox':'VOX','ctl.vox_gain':'VOX усиление','ctl.vox_delay':'VOX задержка',
    'ctl.mon':'Монитор','ctl.mon_level':'Уровень монитора','ctl.tone_mode':'Тон','ctl.ctcss':'CTCSS, Гц',
    'ctl.rpt_shift':'Сдвиг репитера','ctl.txw':'TXW (расширить TX)','ctl.mode_b':'Режим работы VFO-B','ctl.dimmer':'Яркость дисплея',
  });
  add('en', {
    'ctl.af':'AF Gain','ctl.rf':'RF Gain','ctl.sql':'Squelch (SQL)','ctl.agc':'AGC','ctl.preamp':'Preamp',
    'ctl.att':'Attenuator','ctl.nb':'NB (0 = off)','ctl.nr':'DNR (0 = off)','ctl.dnf':'DNF auto-notch','ctl.width':'Width (WIDTH)',
    'ctl.ifshift':'IF SHIFT, Hz','ctl.narrow':'NAR (narrow)','ctl.notch':'Manual notch','ctl.notch_freq':'Notch, Hz',
    'ctl.contour':'CONTOUR','ctl.contour_freq':'CONTOUR, Hz','ctl.apf':'APF (CW)','ctl.apf_freq':'APF shift',
    'ctl.clar_rx':'CLAR RX (RIT)','ctl.clar_tx':'CLAR TX (XIT)','ctl.clar':'CLAR, Hz','ctl.dual':'Dual receive',
    'ctl.power':'Power, W','ctl.mic':'MIC GAIN','ctl.proc':'Processor (PROC)','ctl.proc_level':'PROC level',
    'ctl.amc':'AMC','ctl.vox':'VOX','ctl.vox_gain':'VOX gain','ctl.vox_delay':'VOX delay',
    'ctl.mon':'Monitor','ctl.mon_level':'Monitor level','ctl.tone_mode':'Tone','ctl.ctcss':'CTCSS, Hz',
    'ctl.rpt_shift':'Repeater shift','ctl.txw':'TXW (widen TX)','ctl.mode_b':'VFO-B mode','ctl.dimmer':'Display dimmer',
  });
})();


// control labels actual
(function(){
  if(!window.I18N||!I18N.dict) return;
  const ru = I18N.dict.ru || (I18N.dict.ru={});
  const en = I18N.dict.en || (I18N.dict.en={});
  ru['ctl.af'] = 'AF трансивера';
  en['ctl.af'] = 'AF Gain';
  ru['ctl.agc'] = 'АРУ (AGC)';
  en['ctl.agc'] = 'AGC';
  ru['ctl.amc'] = 'AMC';
  en['ctl.amc'] = 'AMC';
  ru['ctl.apf'] = 'APF (CW)';
  en['ctl.apf'] = 'APF (CW)';
  ru['ctl.apf_freq'] = 'APF сдвиг';
  en['ctl.apf_freq'] = 'APF shift';
  ru['ctl.att'] = 'Аттенюатор';
  en['ctl.att'] = 'Attenuator';
  ru['ctl.bk'] = 'BREAK-IN';
  en['ctl.bk'] = 'BREAK-IN';
  ru['ctl.bk_delay'] = 'Задержка BK';
  en['ctl.bk_delay'] = 'BK delay';
  ru['ctl.clar'] = 'CLAR, Гц';
  en['ctl.clar'] = 'CLAR, Hz';
  ru['ctl.clar_rx'] = 'CLAR RX (RIT)';
  en['ctl.clar_rx'] = 'CLAR RX (RIT)';
  ru['ctl.clar_tx'] = 'CLAR TX (XIT)';
  en['ctl.clar_tx'] = 'CLAR TX (XIT)';
  ru['ctl.contour'] = 'CONTOUR';
  en['ctl.contour'] = 'CONTOUR';
  ru['ctl.contour_freq'] = 'CONTOUR, Гц';
  en['ctl.contour_freq'] = 'CONTOUR, Hz';
  ru['ctl.ctcss'] = 'CTCSS, Гц';
  en['ctl.ctcss'] = 'CTCSS, Hz';
  ru['ctl.dimmer'] = 'Яркость дисплея';
  en['ctl.dimmer'] = 'Display dimmer';
  ru['ctl.dnf'] = 'DNF авто-режектор';
  en['ctl.dnf'] = 'DNF auto-notch';
  ru['ctl.dual'] = 'Двойной приём';
  en['ctl.dual'] = 'Dual receive';
  ru['ctl.ifshift'] = 'IF SHIFT, Гц';
  en['ctl.ifshift'] = 'IF SHIFT, Hz';
  ru['ctl.key_pitch'] = 'Тон CW';
  en['ctl.key_pitch'] = 'CW pitch';
  ru['ctl.key_speed'] = 'Скорость, WPM';
  en['ctl.key_speed'] = 'Key speed, WPM';
  ru['ctl.keyer'] = 'Электронный ключ';
  en['ctl.keyer'] = 'Electronic keyer';
  ru['ctl.mic'] = 'MIC GAIN';
  en['ctl.mic'] = 'MIC GAIN';
  ru['ctl.mode_b'] = 'Вид работы VFO-B';
  en['ctl.mode_b'] = 'VFO-B mode';
  ru['ctl.mon'] = 'Монитор';
  en['ctl.mon'] = 'Monitor';
  ru['ctl.mon_level'] = 'Уровень монитора';
  en['ctl.mon_level'] = 'Monitor level';
  ru['ctl.narrow'] = 'NAR (узкий)';
  en['ctl.narrow'] = 'NAR (narrow)';
  ru['ctl.nb'] = 'NB (0 = выкл)';
  en['ctl.nb'] = 'NB (0 = off)';
  ru['ctl.notch'] = 'Ручной режектор';
  en['ctl.notch'] = 'Manual notch';
  ru['ctl.notch_freq'] = 'Режектор, Гц';
  en['ctl.notch_freq'] = 'Notch, Hz';
  ru['ctl.nr'] = 'DNR (0 = выкл)';
  en['ctl.nr'] = 'DNR (0 = off)';
  ru['ctl.power'] = 'Мощность, Вт';
  en['ctl.power'] = 'Power, W';
  ru['ctl.preamp'] = 'Предусилитель';
  en['ctl.preamp'] = 'Preamp';
  ru['ctl.proc'] = 'Компрессор (PROC)';
  en['ctl.proc'] = 'Processor (PROC)';
  ru['ctl.proc_level'] = 'Уровень PROC';
  en['ctl.proc_level'] = 'PROC level';
  ru['ctl.rf'] = 'RF усиление';
  en['ctl.rf'] = 'RF Gain';
  ru['ctl.rpt_shift'] = 'Сдвиг репитера';
  en['ctl.rpt_shift'] = 'Repeater shift';
  ru['ctl.sql'] = 'Шумодав (SQL)';
  en['ctl.sql'] = 'Squelch (SQL)';
  ru['ctl.tone_mode'] = 'Тон';
  en['ctl.tone_mode'] = 'Tone';
  ru['ctl.txw'] = 'TXW (слушать TX)';
  en['ctl.txw'] = 'TXW (widen TX)';
  ru['ctl.vox'] = 'VOX';
  en['ctl.vox'] = 'VOX';
  ru['ctl.vox_delay'] = 'VOX задержка';
  en['ctl.vox_delay'] = 'VOX delay';
  ru['ctl.vox_gain'] = 'VOX усиление';
  en['ctl.vox_gain'] = 'VOX gain';
  ru['ctl.width'] = 'Полоса (WIDTH)';
  en['ctl.width'] = 'Width (WIDTH)';
})();
