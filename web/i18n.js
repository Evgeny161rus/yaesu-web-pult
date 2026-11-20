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


// extra UI translations
(function(){
  if(!window.I18N||!I18N.dict) return;
  const R = I18N.dict.ru || (I18N.dict.ru={});
  const E = I18N.dict.en || (I18N.dict.en={});
  Object.assign(R, {
    'vfo.work_main':'Работать на MAIN','vfo.work_sub':'Работать на SUB','vfo.a_to_b':'A → B','vfo.b_to_a':'B → A','vfo.swap':'A ⇄ B',
    'vfo.split':'SPLIT (A ⇄ B)','vfo.split.title':'Режим SPLIT: частоты A и B работают на приём и передачу раздельно',
    'vfo.band_down':'Диапазон ◀','vfo.band_up':'Диапазон ▶','vfo.scan_down':'Скан ◀','vfo.scan_stop':'■ Скан','vfo.scan_up':'Скан ▶','vfo.zero_in':'ZERO-IN',
    'vfo.mode_vfo':'Режим VFO','vfo.mode_mem':'Режим памяти','vfo.mem_go':'Вызвать канал','vfo.mem_ed':'Редактор каналов…',
    'vfo.mem_ed.title':'Создать, читать и записывать память каналов — как в ADMS / RT Systems','vfo.qmb_sto':'QMB запомнить','vfo.qmb_rcl':'QMB вызвать',
    'vfo.lock':'LOCK','vfo.my_freqs':'Мои частоты','vfo.my_freqs.hint':'(хранятся на этом устройстве)','vfo.fav_name':'Название','vfo.fav_add':'＋ Добавить текущую',
    'tx.tune':'⚡ Тюнер (встр.)','tx.tune_ext':'⚡ Тюнер внешн.','tx.tune_stop':'■ Стоп','tx.atas':'ATAS авто','tx.atas_up':'ATAS ▲','tx.atas_down':'ATAS ▼',
    'tx.vk.title':'📢 Автовызов голосом','tx.vk.desc':'Запишите CQ — пульт будет передавать его по кругу, слушая эфир в паузах. PTT, Esc или «Стоп» — прекратить.',
    'tx.vk.pause':'Пауза, с','tx.vk.rep':'Повторов','tx.vk.stop_sig':'Стоп при сигнале','tx.vk.stop':'■ Стоп автовызова','tx.vk.nofollow':'не следить',
    'cw.dec':'● Декодер','cw.clear':'Очистить','cw.new':'Новая связь','cw.hint':'Включите декодер и настройтесь на телеграфную станцию: двойной клик по сигналу на водопаде (в режиме CW). Правый клик по сигналу — тон будет взят с места клика.',
    'cw.analyze':'Разобрать','cw.reply':'📝 Ответ','cw.ai.title':'Разбор принятого','cw.ai.sub':'По правилам CW-связи',
    'cw.ai.body':'Принятое после паузы разбирается автоматически: позывные, RST, имя, QTH, этап обмена и смысл принятых Q-кодов и сокращений CW.',
    'cw.prop.title':'Предложенный ответ','cw.prop.send':'▶ Передать','cw.prop.edit':'Изменить','cw.prop.cancel':'Отменить',
    'cw.send':'▶ Передать','cw.stop':'■ Стоп','cw.auto':'Автоответ по шаблону',
    'cw.auto.hint':'Пульт распознает шаг связи и сам выберет ответ по шаблону, передаст его через','cw.auto.maycancel':'с (можно отменить). Не более','cw.auto.qso':'QSO подряд.',
    'cw.op':'Оператор','cw.op.call':'Позывной','cw.op.name':'Имя','cw.op.qth':'QTH','cw.op.extra':'Ещё в конце (для шаблонов)','cw.rig':'Ключ трансивера',
    'cw.mems':'Память ключа','cw.mems.hint':'Текст передаётся самим трансивером из его памяти ключа (до 50 символов на ячейку) — без задержек пути. BREAK-IN включается автоматически. Длинный текст разбивайте кнопками 1–5.',
    'digi.hint':'Двойной клик по сигналу — настроиться и взять тон',
    'cat.placeholder':'Команда CAT, например FA; или MD02;','cat.send':'Отправить','cat.log':'Журнал обмена','cat.clear':'Очистить',
    'menu.usb.title':'Для голоса через браузер в меню трансивера для текущего режима работы (SSB / AM / FM / DATA) настройте',
    'menu.usb.btn':'Показать эти пункты',
  });
  Object.assign(E, {
    'vfo.work_main':'Work on MAIN','vfo.work_sub':'Work on SUB','vfo.a_to_b':'A → B','vfo.b_to_a':'B → A','vfo.swap':'A ⇄ B',
    'vfo.split':'SPLIT (A ⇄ B)','vfo.split.title':'SPLIT mode: A and B frequencies are used for RX and TX separately',
    'vfo.band_down':'Band ◀','vfo.band_up':'Band ▶','vfo.scan_down':'Scan ◀','vfo.scan_stop':'■ Scan','vfo.scan_up':'Scan ▶','vfo.zero_in':'ZERO-IN',
    'vfo.mode_vfo':'VFO mode','vfo.mode_mem':'Memory mode','vfo.mem_go':'Recall channel','vfo.mem_ed':'Channel editor…',
    'vfo.mem_ed.title':'Create, read and write memory channels — similar to ADMS / RT Systems','vfo.qmb_sto':'QMB store','vfo.qmb_rcl':'QMB recall',
    'vfo.lock':'LOCK','vfo.my_freqs':'My frequencies','vfo.my_freqs.hint':'(stored on this device)','vfo.fav_name':'Name','vfo.fav_add':'＋ Add current',
    'tx.tune':'⚡ Tuner (int.)','tx.tune_ext':'⚡ External tuner','tx.tune_stop':'■ Stop','tx.atas':'ATAS tune','tx.atas_up':'ATAS ▲','tx.atas_down':'ATAS ▼',
    'tx.vk.title':'📢 Voice auto-CQ','tx.vk.desc':'Record a CQ — the app will transmit it in a loop while listening between calls. PTT, Esc or “Stop” to cancel.',
    'tx.vk.pause':'Pause, s','tx.vk.rep':'Repeats','tx.vk.stop_sig':'Stop on signal','tx.vk.stop':'■ Stop auto-CQ','tx.vk.nofollow':'ignore',
    'cw.dec':'● Decoder','cw.clear':'Clear','cw.new':'New QSO','cw.hint':'Enable the decoder and tune to a CW station: double-click a signal on the waterfall (in CW mode). Right-click a signal to pick tone at that point.',
    'cw.analyze':'Analyze','cw.reply':'📝 Reply','cw.ai.title':'Received text analysis','cw.ai.sub':'CW QSO rules',
    'cw.ai.body':'After a pause, received text is analyzed automatically: callsigns, RST, name, QTH, exchange stage, and meaning of Q-codes/abbreviations.',
    'cw.prop.title':'Suggested reply','cw.prop.send':'▶ Send','cw.prop.edit':'Edit','cw.prop.cancel':'Cancel',
    'cw.send':'▶ Send','cw.stop':'■ Stop','cw.auto':'Template auto-reply',
    'cw.auto.hint':'The app detects the QSO stage and selects a reply from templates, sending it after','cw.auto.maycancel':'s (can be cancelled). No more than','cw.auto.qso':'QSOs in a row.',
    'cw.op':'Operator','cw.op.call':'Callsign','cw.op.name':'Name','cw.op.qth':'QTH','cw.op.extra':'Extra at end (for templates)','cw.rig':'Radio keyer',
    'cw.mems':'Keyer memories','cw.mems.hint':'Text is sent by the transceiver from its keyer memory (up to 50 chars per slot) — no path delay. BREAK-IN is enabled automatically. Split long text across buttons 1–5.',
    'digi.hint':'Double-click a signal to tune and set tone',
    'cat.placeholder':'CAT command, e.g. FA; or MD02;','cat.send':'Send','cat.log':'Exchange log','cat.clear':'Clear',
    'menu.usb.title':'For voice via browser, set in the transceiver menu for the current mode (SSB/AM/FM/DATA):',
    'menu.usb.btn':'Show these items',
  });
})();

// toast strings
(function(){
  if(!window.I18N||!I18N.dict) return;
  const R=I18N.dict.ru||(I18N.dict.ru={}); const E=I18N.dict.en||(I18N.dict.en={});
  R['toast.split']='SPLIT: A ⇄ B'; E['toast.split']='SPLIT: A ⇄ B';
  R['toast.sstv_saved']='SSTV сохранена: '; E['toast.sstv_saved']='SSTV saved: ';
  R['toast.sstv_start']='SSTV: началась картинка '; E['toast.sstv_start']='SSTV: image started ';
  R['toast.sstv_tune']='SSTV: отдельная подстройка не нужна — сигнал занимает 1200–2300 Гц'; E['toast.sstv_tune']='SSTV: separate tuning not needed — signal occupies 1200–2300 Hz';
  R['toast.nofinetune_amfm']='В AM/FM подстройка по водопаду недоступна'; E['toast.nofinetune_amfm']='Waterfall fine-tuning is not available in AM/FM';
  R['toast.rec_silent']='В записи тишина — проверьте микрофон'; E['toast.rec_silent']='Recording is silent — check the microphone';
  R['toast.no_adif']='В файле не нашлось связей ADIF'; E['toast.no_adif']='No ADIF QSOs found in file';
  R['toast.vk_speak']='Говорите… «■ Стоп записи», когда закончите'; E['toast.vk_speak']='Speak… press “■ Stop recording” when done';
  R['toast.rec_unavail']='Запись недоступна: откройте пульт по https:// или localhost'; E['toast.rec_unavail']='Recording unavailable: open the app via https:// or localhost';
  R['toast.rec_saved']='Запись сохранена: '; E['toast.rec_saved']='Recording saved: ';
  R['toast.audio_unavail']='Звук недоступен: '; E['toast.audio_unavail']='Audio unavailable: ';
  R['toast.no_image']='Картинки пока нет'; E['toast.no_image']='No image yet';
  R['toast.keys_default']='Клавиши по умолчанию'; E['toast.keys_default']='Default shortcuts restored';
  R['toast.map_edge']='Край карты сдвинут'; E['toast.map_edge']='Map edge shifted';
  R['toast.mic_https']='Микрофон недоступен: откройте пульт по https:// (или http://localhost на самом ПК)'; E['toast.mic_https']='Microphone unavailable: open via https:// (or http://localhost on the same PC)';
  R['toast.audio_read_err']='Не удалось прочитать звук: '; E['toast.audio_read_err']='Failed to read audio: ';
  R['toast.mic_denied']='Нет доступа к микрофону: '; E['toast.mic_denied']='Microphone access denied: ';
  R['toast.new_qso']='Новая связь'; E['toast.new_qso']='New QSO';
  R['toast.cw_stopped']='Передача CW остановлена'; E['toast.cw_stopped']='CW transmission stopped';
  R['toast.tx_busy']='Передача занята другим подключением'; E['toast.tx_busy']='Transmit is busy (another client)';
  R['toast.nothing_decode']='Пока нечего переводить'; E['toast.nothing_decode']='Nothing to decode yet';
  R['toast.listen_2s']='Слушаю 2 с…'; E['toast.listen_2s']='Listening 2 s…';
  R['toast.need_dx']='Сначала укажите DX позывной и нажмите «Сформировать»'; E['toast.need_dx']='Enter DX callsign first and click “Generate”';
  R['toast.need_mycall_op']='Сначала укажите свой позывной в разделе «Оператор»'; E['toast.need_mycall_op']='Enter your callsign in the “Operator” section first';
  R['toast.msg_too_long']='Сообщение длиннее 2 минут'; E['toast.msg_too_long']='Message is longer than 2 minutes';
  R['toast.need_mycall_ft8']='Укажите свой позывной в настройках FT8'; E['toast.need_mycall_ft8']='Set your callsign in FT8 settings';
  R['toast.need_mycall_cw']='Укажите свой позывной на вкладке CW · Морзе'; E['toast.need_mycall_cw']='Set your callsign on the CW tab';
  R['toast.file_too_big']='Файл слишком большой'; E['toast.file_too_big']='File is too large';
  R['toast.fax_saved']='Факс сохранён: '; E['toast.fax_saved']='Fax saved: ';
  R['toast.fax']='Факс: '; E['toast.fax']='Fax: ';
})();


// extra2
(function(){
  if(!window.I18N||!I18N.dict) return;
  const R=I18N.dict.ru||(I18N.dict.ru={});
  const E=I18N.dict.en||(I18N.dict.en={});
  Object.assign(R,{
    'ft8.rx':'Приём','ft8.rx_off':'● Приём выкл','ft8.band':'Диапазон','ft8.dt':'dt —','ft8.wf':'Водопад','ft8.wf.0':'как в других режимах','ft8.wf.10':'быстро (~10 с)','ft8.wf.20':'средне (~20 с)','ft8.wf.35':'медленно (~35 с)','ft8.wf.60':'очень медленно (~60 с)',
    'ft8.act':'Активность','ft8.rxpane':'Частота RX','ft8.clear':'Очистить','ft8.txmsg':'—','ft8.qso':'Связи нет','ft8.enable':'Включить TX','ft8.halt':'Стоп TX','ft8.tune':'Настроить','ft8.cq':'CQ','ft8.autoseq':'Авто-посл.','ft8.autocq':'Авто-CQ',
    'ft8.parity':'Период','ft8.parity.0':'1-й (чётн.)','ft8.parity.1':'2-й (нечётн.)','ft8.rxhz':'RX, Гц','ft8.txhz':'TX, Гц','ft8.rx2tx':'RX из TX','ft8.tx2rx':'TX из RX','ft8.dxcall':'DX позывной','ft8.dxgrid':'DX локатор','ft8.rpt':'Рапорт','ft8.gen':'Сформировать',
    'ft8.log':'Журнал','ft8.heard':'Меня слышат','ft8.heard.info':'PSK Reporter, 30 мин','ft8.heard.map':'Карта','ft8.heard.upd':'Обновить','ft8.cfg':'Настройки FT8 и лог','ft8.call':'Позывной','ft8.grid':'Локатор','ft8.pwr':'Мощность, Вт','ft8.tries':'Повторов',
    'ft8.level':'Уровень TX','ft8.wide':'Расширять полосу DATA-U до 3000 Гц','ft8.wflab':'Позывные на метках на водопаде','ft8.udp':'Отправлять в лог (UDP, как WSJT-X)','ft8.host':'Хост','ft8.port':'Порт','ft8.psk':'Отправлять принятые станции в PSK Reporter','ft8.ant':'Антенна (для PSK Reporter)','ft8.alertdx':'Уведомлять о новой стране','ft8.alertsnd':'Со звуком',
    'ft8.worked':'Отработанное','ft8.import':'Загрузить ADIF…','ft8.replace':'Заменить список отработанного','ft8.delworked':'Удалить отработанное',
    'digi.rtty':'RTTY','digi.fax':'Вэфакс','digi.nx':'NAVTEX','digi.sstv':'SSTV','digi.psk':'PSK31',
    'digi.dec_on':'● Приём выкл','digi.dec_off':'■ Приём вкл','digi.baud':'Скорость','digi.shift':'Сдвиг','digi.center':'Центр','digi.autotune':'Автонастройка','digi.polarity':'Полярность','digi.pol.auto':'Авто','digi.pol.norm':'Норм.','digi.pol.inv':'Инв.','digi.station':'Станция','digi.clear':'Очистить',
    'digi.lpm':'Стр/мин','digi.ioc':'IOC','digi.auto':'Авто старт/стоп','digi.afc':'АЧП','digi.start':'Начать приём','digi.stop':'Стоп и сохранить','digi.slant':'Наклон','digi.png':'↓ PNG','digi.big':'⛶',
    'digi.nx.dec':'● Приём выкл','digi.sv.dec':'● Приём выкл','digi.sv.mode':'Режим','digi.sv.auto':'Авто по VIS','digi.sv.stop':'Стоп и сохранить','digi.sv.freq':'Частота',
    'digi.pk.dec':'● Приём выкл','digi.pk.freq':'Частота','digi.pk.afc':'АЧП','digi.pk.band':'Диапазон',
    'menu.search':'Поиск по меню (например MOD_SOURCE, AGC, USB)','menu.group':'Все разделы','menu.read':'Прочитать всё','menu.usb.title':'Для голоса через браузер в меню трансивера для текущего режима работы (SSB / AM / FM / DATA) настройте','menu.usb.btn':'Показать эти пункты',
    'cat.log':'Журнал обмена',
    'ft8.hint':'Включите приём и выберите диапазон — трансивер станет в DATA-U на частоте FT8, полоса 3000 Гц. Двойной клик по строке — начать связь (автопоследовательность ответит сама). Передавайте на своей частоте.',
  });
  Object.assign(E,{
    'ft8.rx':'Receive','ft8.rx_off':'● RX off','ft8.band':'Band','ft8.dt':'dt —','ft8.wf':'Waterfall','ft8.wf.0':'as in other modes','ft8.wf.10':'fast (~10 s)','ft8.wf.20':'medium (~20 s)','ft8.wf.35':'slow (~35 s)','ft8.wf.60':'very slow (~60 s)',
    'ft8.act':'Activity','ft8.rxpane':'RX frequency','ft8.clear':'Clear','ft8.txmsg':'—','ft8.qso':'No QSO','ft8.enable':'Enable TX','ft8.halt':'Halt TX','ft8.tune':'Tune','ft8.cq':'CQ','ft8.autoseq':'Auto-seq.','ft8.autocq':'Auto-CQ',
    'ft8.parity':'Period','ft8.parity.0':'1st (even)','ft8.parity.1':'2nd (odd)','ft8.rxhz':'RX, Hz','ft8.txhz':'TX, Hz','ft8.rx2tx':'RX ← TX','ft8.tx2rx':'TX ← RX','ft8.dxcall':'DX callsign','ft8.dxgrid':'DX grid','ft8.rpt':'Report','ft8.gen':'Generate',
    'ft8.log':'Log','ft8.heard':'Heard me','ft8.heard.info':'PSK Reporter, 30 min','ft8.heard.map':'Map','ft8.heard.upd':'Refresh','ft8.cfg':'FT8 & log settings','ft8.call':'Callsign','ft8.grid':'Grid','ft8.pwr':'Power, W','ft8.tries':'Retries',
    'ft8.level':'TX level','ft8.wide':'Widen DATA-U to 3000 Hz','ft8.wflab':'Callsign labels on waterfall','ft8.udp':'Send to log (UDP, WSJT-X style)','ft8.host':'Host','ft8.port':'Port','ft8.psk':'Report received stations to PSK Reporter','ft8.ant':'Antenna (for PSK Reporter)','ft8.alertdx':'Notify on new DXCC','ft8.alertsnd':'Sound alert',
    'ft8.worked':'Worked','ft8.import':'Import ADIF…','ft8.replace':'Replace worked list','ft8.delworked':'Clear worked list',
    'digi.rtty':'RTTY','digi.fax':'WEFAX','digi.nx':'NAVTEX','digi.sstv':'SSTV','digi.psk':'PSK31',
    'digi.dec_on':'● RX off','digi.dec_off':'■ RX on','digi.baud':'Baud','digi.shift':'Shift','digi.center':'Center','digi.autotune':'Auto-tune','digi.polarity':'Polarity','digi.pol.auto':'Auto','digi.pol.norm':'Normal','digi.pol.inv':'Invert','digi.station':'Station','digi.clear':'Clear',
    'digi.lpm':'LPM','digi.ioc':'IOC','digi.auto':'Auto start/stop','digi.afc':'AFC','digi.start':'Start RX','digi.stop':'Stop & save','digi.slant':'Slant','digi.png':'↓ PNG','digi.big':'⛶',
    'digi.nx.dec':'● RX off','digi.sv.dec':'● RX off','digi.sv.mode':'Mode','digi.sv.auto':'Auto (VIS)','digi.sv.stop':'Stop & save','digi.sv.freq':'Frequency',
    'digi.pk.dec':'● RX off','digi.pk.freq':'Frequency','digi.pk.afc':'AFC','digi.pk.band':'Band',
    'menu.search':'Search menu (e.g. MOD_SOURCE, AGC, USB)','menu.group':'All sections','menu.read':'Read all','menu.usb.title':'For voice via browser, set in the transceiver menu for the current mode (SSB/AM/FM/DATA):','menu.usb.btn':'Show these items',
    'cat.log':'Exchange log',
    'ft8.hint':'Turn on receive and choose a band — the radio will switch to DATA-U on the FT8 frequency, 3000 Hz bandwidth. Double-click a message to start a QSO (auto-sequence will reply). Transmit on your own frequency.',
  });
})();


// extra3
(function(){
  if(!window.I18N||!I18N.dict) return;
  const R=I18N.dict.ru||(I18N.dict.ru={});
  const E=I18N.dict.en||(I18N.dict.en={});
  Object.assign(R,{
    'ft8.filter':'Фильтр','ft8.filter.all':'Все','ft8.filter.cq':'CQ и мои','ft8.filter.new':'Новые по DXCC','ft8.filter.newb':'Новый позывной; голубой цвет — ещё нет связи',
    'ft8.utc':'UTC','ft8.db':'dB','ft8.dtcol':'DT','ft8.freq':'Част.','ft8.msg':'Сообщение',
    'rt.dec':'● Приём выкл','rt.baud':'Скорость','rt.shift':'Сдвиг','rt.fc':'Центр','rt.tune':'Автонастройка','rt.pol':'Полярность','rt.station':'Станция','rt.clear':'Очистить','rt.send':'▶ Передать','rt.stop':'■ Стоп',
    'fx.dec':'● Приём выкл','fx.lpm':'Стр/мин','fx.ioc':'IOC','fx.auto':'Авто старт/стоп','fx.fc':'Центр','fx.afc':'АЧП','fx.start':'Начать приём','fx.stop':'Стоп и сохранить','fx.slant':'Наклон','fx.station':'Станция','fx.png':'↓ PNG','fx.big':'⛶',
    'nx.dec':'● Приём выкл','nx.fc':'Центр','nx.station':'Станция','nx.clear':'Очистить',
    'sv.dec':'● Приём выкл','sv.mode':'Режим','sv.auto':'Авто по VIS','sv.stop':'Стоп и сохранить','sv.freq':'Частота','sv.png':'↓ PNG',
    'pk.dec':'● Приём выкл','pk.freq':'Частота','pk.afc':'АЧП','pk.band':'Диапазон','pk.clear':'Очистить','pk.send':'▶ Передать','pk.stop':'■ Стоп',
    'menu.usb.title':'Для голоса через браузер в меню трансивера для текущего режима работы (SSB / AM / FM / DATA) настройте',
  });
  Object.assign(E,{
    'ft8.filter':'Filter','ft8.filter.all':'All','ft8.filter.cq':'CQ & mine','ft8.filter.new':'New DXCC','ft8.filter.newb':'New callsign; blue — not worked yet',
    'ft8.utc':'UTC','ft8.db':'dB','ft8.dtcol':'DT','ft8.freq':'Freq','ft8.msg':'Message',
    'rt.dec':'● RX off','rt.baud':'Baud','rt.shift':'Shift','rt.fc':'Center','rt.tune':'Auto-tune','rt.pol':'Polarity','rt.station':'Station','rt.clear':'Clear','rt.send':'▶ Send','rt.stop':'■ Stop',
    'fx.dec':'● RX off','fx.lpm':'LPM','fx.ioc':'IOC','fx.auto':'Auto start/stop','fx.fc':'Center','fx.afc':'AFC','fx.start':'Start RX','fx.stop':'Stop & save','fx.slant':'Slant','fx.station':'Station','fx.png':'↓ PNG','fx.big':'⛶',
    'nx.dec':'● RX off','nx.fc':'Center','nx.station':'Station','nx.clear':'Clear',
    'sv.dec':'● RX off','sv.mode':'Mode','sv.auto':'Auto (VIS)','sv.stop':'Stop & save','sv.freq':'Frequency','sv.png':'↓ PNG',
    'pk.dec':'● RX off','pk.freq':'Frequency','pk.afc':'AFC','pk.band':'Band','pk.clear':'Clear','pk.send':'▶ Send','pk.stop':'■ Stop',
    'menu.usb.title':'For voice via browser, configure in the transceiver menu for the current mode (SSB/AM/FM/DATA):',
  });
})();


// extra4
(function(){
  if(!window.I18N||!I18N.dict) return;
  const R=I18N.dict.ru||(I18N.dict.ru={});
  const E=I18N.dict.en||(I18N.dict.en={});
  Object.assign(R,{
    'me.title':'Память каналов трансивера','me.nofile':'Не сохранено','me.read':'↓ Прочитать','me.write':'↑ Записать изменённые','me.write_sel':'↑ Выбранные','me.stop':'■ Стоп','me.save':'Сохранить','me.save_as':'Сохранить как…','me.import':'Импорт CSV','me.export':'Экспорт CSV','me.sd_in':'← Открыть с SD','me.sd_out':'→ Сохранить на SD','me.from':'С','me.to':'По','me.tones':'Тоны','me.groups':'Группы','me.only_dirty':'Только изменённые','me.search':'Поиск: имя, частота',
    'ft8.tries':'Повторов','ft8.level':'Уровень TX','ft8.wide':'Расширять полосу DATA-U до 3000 Гц','ft8.wflab':'Позывные на метках на водопаде','ft8.udp':'Отправлять в лог (UDP, как WSJT-X)','ft8.host':'Хост','ft8.port':'Порт','ft8.psk':'Отправлять принятые станции в PSK Reporter','ft8.ant':'Антенна (для PSK Reporter)','ft8.alertdx':'Уведомлять о новой стране','ft8.alertsnd':'Со звуком',
    'ft8.import':'Загрузить ADIF…','ft8.replace':'Заменить список отработанного','ft8.delworked':'Удалить отработанное',
    'cw.hint':'Включите декодер и настройтесь на телеграфную станцию: двойной клик по сигналу на водопаде (в режиме CW).',
  });
  Object.assign(E,{
    'me.title':'Transceiver memory channels','me.nofile':'Not saved','me.read':'↓ Read','me.write':'↑ Write changed','me.write_sel':'↑ Selected','me.stop':'■ Stop','me.save':'Save','me.save_as':'Save as…','me.import':'Import CSV','me.export':'Export CSV','me.sd_in':'← Open from SD','me.sd_out':'→ Save to SD','me.from':'From','me.to':'To','me.tones':'Tones','me.groups':'Groups','me.only_dirty':'Changed only','me.search':'Search: name, frequency',
    'ft8.tries':'Retries','ft8.level':'TX level','ft8.wide':'Widen DATA-U to 3000 Hz','ft8.wflab':'Callsign labels on waterfall','ft8.udp':'Send to log (UDP, WSJT-X style)','ft8.host':'Host','ft8.port':'Port','ft8.psk':'Report received stations to PSK Reporter','ft8.ant':'Antenna (for PSK Reporter)','ft8.alertdx':'Notify on new DXCC','ft8.alertsnd':'Sound alert',
    'ft8.import':'Import ADIF…','ft8.replace':'Replace worked list','ft8.delworked':'Clear worked list',
    'cw.hint':'Enable the decoder and tune to a CW station: double-click a signal on the waterfall (in CW mode).',
  });
})();


// extra5 panel/mem/sd/app
(function(){
  if(!window.I18N||!I18N.dict) return;
  const R=I18N.dict.ru||(I18N.dict.ru={}); const E=I18N.dict.en||(I18N.dict.en={});
  Object.assign(R,{
    'panel.title':'Yaesu Web Pult — панель управления','panel.saved':'✓ Сохранено','panel.scale.auto':'Масштаб: авто',
    'panel.wizard.title':'👋 Первый запуск','panel.wizard.li1':'Подключите трансивер Yaesu к этому же компьютеру USB и включите его (нужен драйвер Virtual COM Port от Yaesu).',
    'panel.wizard.li2':'Проверьте порт в карточке «Трансивер» — программа определила их сама. Если порт не виден, нажмите ↻.',
    'panel.wizard.li3':'Нажмите «Запустить», затем «Открыть пульт».',
    'panel.status.init':'Подключение к серверу…','panel.run':'▶ Запустить','panel.stop':'■ Остановить','panel.busy':'В процессе…',
    'panel.open':'Открыть пульт','panel.cat':'CAT','panel.audio':'Звук','panel.tx':'Передача','panel.clients':'Клиентов: 0',
    'panel.radio':'📻 Трансивер','panel.probe':'Определить современный Yaesu по ID','panel.probe.hint':'На выбранном порту и скорости, при остановленном соединении. Для старых моделей — ручной выбор.',
    'panel.backend':'Драйвер','panel.backend.native':'FTX-1 — нативное управление','panel.backend.hamlib':'Yaesu / Hamlib — базовое управление',
    'panel.hamlib.path':'Путь к rigctld (Hamlib)','panel.hamlib.model':'Модель для управления Hamlib','panel.hamlib.reload':'Обновить модели',
    'panel.cat_port':'COM-порт CAT (Enhanced COM Port)','panel.cat_baud':'Скорость CAT (как в меню трансивера CAT RATE)',
    'panel.audio_dev':'Звуковая карта трансивера (USB Audio)','panel.audio_api':'Драйвер звука','panel.audio_api.auto':'Авто (предпочтительно: WDM-KS напрямую, иначе WASAPI…)',
    'panel.audio_api.ks':'WDM-KS — напрямую, мимо микшера Windows','panel.audio_api.wasapi':'WASAPI','panel.audio_api.ds':'DirectSound','panel.audio_api.mme':'MME',
    'panel.ptt':'Как включать передачу (PTT)','panel.ptt.tx1':'Командой CAT TX1 (рекомендуется)','panel.ptt.tx2':'Командой CAT TX2','panel.ptt.rts':'Линией RTS второго порта','panel.ptt.dtr':'Линией DTR второго порта',
    'panel.ptt_port':'Порт для PTT (Standard COM Port, отдельный)',
    'panel.sim':'Режим симулятора — проверка без трансивера',
    'panel.scope.title':'Водопад USB-scope (FT-710 / FTDX10 / FTDX101, экспериментально)','panel.scope.source':'Источник водопада',
    'panel.scope.src.auto':'Авто — USB-scope, если доступен, иначе аудио','panel.scope.src.scope':'Только USB-scope (иначе ошибка в журнале)','panel.scope.src.audio':'Только аудио (USB-scope не использовать)',
    'panel.scope.lib4222':'LibFT4222 (путь к .dll / .so, можно папку или путь-имя в папке ftdi)','panel.scope.d2xx':'D2XX (ftd2xx.dll / libftd2xx, если требуется отдельно)','panel.scope.serial':'Серийный номер SPI-интерфейса (необязательно)',
    'panel.scope.auto_dl':'Автоматически скачивать библиотеки FTDI при обнаружении совместимого трансивера (нужен интернет; при проблемах выключите)',
    'panel.scope.dl':'Скачать библиотеки FTDI сейчас','panel.scope.dl.loading':'Загрузка…',
    'panel.web.title':'📱 Доступ из браузера','panel.web.pw':'Пароль для входа из браузера',
    'panel.web.show':'Показать','panel.web.gen':'Сгенерировать пароль',
    'panel.web.qr':'Сканируйте камерой телефона (Wi-Fi тот же, что у ПК).',
    'panel.web.qr2':'Браузер попросит подтвердить: нажмите «Продолжить» от «Не защищено». В старом Chrome: «Дополнительно» → «Перейти… (небезопасно)».',
    'panel.cw.title':'⚡ CW и голосовой вызов','panel.cw.method':'Метод CW (манипуляция)','panel.cw.cat':'Командой CAT','panel.cw.dtr':'Линией DTR','panel.cw.rts':'Линией RTS',
    'panel.cw.port':'Порт манипуляции (Standard COM Port); в меню радиостанции: CW_PC_KEYING = DTR/RTS','panel.cw.delay':'Задержка автоответа CW, с','panel.cw.max':'Макс. автоответов подряд',
    'panel.start.title':'⚙ Запуск','panel.autostart':'Запускать вместе с Windows (в трее, без окна)','panel.auto_connect':'Сразу подключаться к трансиверу','panel.open_panel':'Открывать эту панель при старте','panel.open_pult':'Открывать пульт при старте',
    'panel.tx_limit':'Максимальная длительность передачи, секунд','panel.ports.adv':'Сетевые порты','panel.http':'Порт пульта в сети (http)','panel.https':'Порт для телефона по сети (https)',
    'panel.ports.hint':'Изменение портов вступает в силу после перезапуска программы.','panel.clients.title':'👥 Клиенты','panel.log.title':'📋 Журнал',
    'panel.folder':'Папка программы','panel.foot':'Пока окно открыто — сервер работает в фоне. Можно закрыть: программа останется в трее. Полностью закрыть: правая кнопка в трее или кнопка ниже.',
    'panel.quit':'⏻ Выйти из программы','panel.gone.title':'Сервер остановлен','panel.gone.msg':'Это окно можно закрыть.','panel.refresh':'Обновить список','panel.detect':'Найти',
    'mem.ch':'№','mem.group':'Группа','mem.name':'Имя','mem.freq':'Частота','mem.mode':'Режим','mem.shift':'Сдвиг','mem.offset':'Разнос','mem.tx':'TX','mem.tone':'Тон','mem.ctcss':'CTCSS','mem.dcs':'DCS','mem.clar':'CLAR','mem.rxclar':'RX','mem.txclar':'TX','mem.comment':'Коммент.','mem.go':'→',
    'mem.empty':'Пусто','mem.tx_from_radio':'от радио','mem.tx_separate':'Отд. TX','mem.none':'Выкл','mem.enc':'ENC','mem.tsq':'TSQ','mem.dcs':'DCS',
    'mem.all':'Все каналы','mem.no_group':'Без группы','mem.set_group':'Группа для отмеченных…','mem.set_none':'— Без группы —','mem.show_empty':'Показывать пустые',
  });
  Object.assign(E,{
    'panel.title':'Yaesu Web Pult — Control Panel','panel.saved':'✓ Saved','panel.scale.auto':'Scale: auto',
    'panel.wizard.title':'👋 First run','panel.wizard.li1':'Connect your Yaesu transceiver to this computer via USB and turn it on (Yaesu Virtual COM Port driver required).',
    'panel.wizard.li2':'Check the port in the “Transceiver” card — the app detected them automatically. If a port is missing, press ↻.',
    'panel.wizard.li3':'Press “Start”, then “Open pult”.',
    'panel.status.init':'Connecting to server…','panel.run':'▶ Start','panel.stop':'■ Stop','panel.busy':'Working…',
    'panel.open':'Open pult','panel.cat':'CAT','panel.audio':'Audio','panel.tx':'Transmit','panel.clients':'Clients: 0',
    'panel.radio':'📻 Transceiver','panel.probe':'Detect modern Yaesu by ID','panel.probe.hint':'On the selected port and speed, while disconnected. For older models choose manually.',
    'panel.backend':'Driver','panel.backend.native':'FTX-1 — native control','panel.backend.hamlib':'Yaesu / Hamlib — basic control',
    'panel.hamlib.path':'Path to rigctld (Hamlib)','panel.hamlib.model':'Hamlib model','panel.hamlib.reload':'Reload models',
    'panel.cat_port':'CAT COM port (Enhanced COM Port)','panel.cat_baud':'CAT speed (matches CAT RATE in radio menu)',
    'panel.audio_dev':'Transceiver sound card (USB Audio)','panel.audio_api':'Audio driver','panel.audio_api.auto':'Auto (prefer: WDM-KS direct, else WASAPI…)',
    'panel.audio_api.ks':'WDM-KS — direct, bypass Windows mixer','panel.audio_api.wasapi':'WASAPI','panel.audio_api.ds':'DirectSound','panel.audio_api.mme':'MME',
    'panel.ptt':'PTT method','panel.ptt.tx1':'CAT TX1 command (recommended)','panel.ptt.tx2':'CAT TX2 command','panel.ptt.rts':'RTS line of second port','panel.ptt.dtr':'DTR line of second port',
    'panel.ptt_port':'PTT port (Standard COM Port, separate)',
    'panel.sim':'Simulator mode — test without a transceiver',
    'panel.scope.title':'USB-scope waterfall (FT-710 / FTDX10 / FTDX101, experimental)','panel.scope.source':'Waterfall source',
    'panel.scope.src.auto':'Auto — USB-scope if available, else audio','panel.scope.src.scope':'USB-scope only (log error if unavailable)','panel.scope.src.audio':'Audio only (do not use USB-scope)',
    'panel.scope.lib4222':'LibFT4222 (path to .dll/.so, folder or file in ftdi)','panel.scope.d2xx':'D2XX (ftd2xx.dll/libftd2xx, if separate)','panel.scope.serial':'SPI interface serial number (optional)',
    'panel.scope.auto_dl':'Automatically download FTDI libraries when a compatible radio is detected (requires internet; disable if issues)',
    'panel.scope.dl':'Download FTDI libraries now','panel.scope.dl.loading':'Loading…',
    'panel.web.title':'📱 Browser access','panel.web.pw':'Password for browser access',
    'panel.web.show':'Show','panel.web.gen':'Generate password',
    'panel.web.qr':'Scan with your phone camera (same Wi-Fi as PC).',
    'panel.web.qr2':'The browser will ask to proceed: click “Continue to site” from “Not secure”. In older Chrome: “Advanced” → “Proceed… (unsafe)”.',
    'panel.cw.title':'⚡ CW and voice call','panel.cw.method':'CW keying method','panel.cw.cat':'CAT command','panel.cw.dtr':'DTR line','panel.cw.rts':'RTS line',
    'panel.cw.port':'Keying port (Standard COM Port); in radio menu: CW_PC_KEYING = DTR/RTS','panel.cw.delay':'CW auto-reply delay, s','panel.cw.max':'Max auto-replies in a row',
    'panel.start.title':'⚙ Startup','panel.autostart':'Start with Windows (in tray, no window)','panel.auto_connect':'Connect to transceiver on start','panel.open_panel':'Open this panel on start','panel.open_pult':'Open pult on start',
    'panel.tx_limit':'Maximum transmit duration, seconds','panel.ports.adv':'Network ports','panel.http':'Pult port (http)','panel.https':'Phone access port (https)',
    'panel.ports.hint':'Port changes take effect after restarting the app.','panel.clients.title':'👥 Clients','panel.log.title':'📋 Log',
    'panel.folder':'App folder','panel.foot':'While this window is open the server runs in background. You can close it: the app stays in tray. To quit fully: tray menu or the button below.',
    'panel.quit':'⏻ Quit','panel.gone.title':'Server stopped','panel.gone.msg':'You can close this window now.','panel.refresh':'Refresh list','panel.detect':'Detect',
    'mem.ch':'#','mem.group':'Group','mem.name':'Name','mem.freq':'Frequency','mem.mode':'Mode','mem.shift':'Shift','mem.offset':'Offset','mem.tx':'TX','mem.tone':'Tone','mem.ctcss':'CTCSS','mem.dcs':'DCS','mem.clar':'CLAR','mem.rxclar':'RX','mem.txclar':'TX','mem.comment':'Comment','mem.go':'→',
    'mem.empty':'Empty','mem.tx_from_radio':'from radio','mem.tx_separate':'Split TX','mem.none':'Off','mem.enc':'ENC','mem.tsq':'TSQ','mem.dcs':'DCS',
    'mem.all':'All channels','mem.no_group':'No group','mem.set_group':'Group for selected…','mem.set_none':'— No group —','mem.show_empty':'Show empty',
  });
  if(window.I18N&&I18N.apply) try{I18N.apply(document);}catch(e){}
})();


// extra5 panel js keys
(function(){ if(!window.I18N||!I18N.dict) return; const R=I18N.dict.ru||(I18N.dict.ru={}); const E=I18N.dict.en||(I18N.dict.en={});
Object.assign(R,{'panel.err.noconn':'Нет связи с панелью…','panel.err.restart':'Перезапустите FTX-1 Пульт снова.','panel.toast.port_change':'Порт будет применён после перезапуска программы','panel.toast.ftdi_ok':'Библиотеки FTDI загружены','panel.toast.ftdi_fail':'Не удалось скачать библиотеки','panel.toast.refresh':'Обновляю список устройств…','panel.probe.checking':'Проверяю ID…','panel.toast.stop_first':'Сначала остановите соединение','panel.toast.not_found':'FTX-1 не найден: проверьте кабель, питание и драйвер CP210x','panel.toast.found':'Найдено: ','panel.toast.audio':'звук ','panel.version':'Версия','panel.confirm.quit':'Выйти из программы? Сервер и связь с трансивером будут остановлены, пульты отключатся.','panel.status.connecting':'Подключение…','panel.status.err':'Сервер не запущен','panel.status.stopped':'Сервер с трансивером остановлен','panel.status.press_start':'Нажмите «Запустить»','panel.status.tx':'⎘ ПЕРЕДАЧА','panel.status.at':'У ','panel.status.ok':'Подключено, работает','panel.status.wait':'Ожидание ответа от трансивера…'});
Object.assign(E,{'panel.err.noconn':'No connection to panel…','panel.err.restart':'Restart Yaesu Web Pult.','panel.toast.port_change':'Port will be applied after app restart','panel.toast.ftdi_ok':'FTDI libraries downloaded','panel.toast.ftdi_fail':'Failed to download libraries','panel.toast.refresh':'Refreshing device list…','panel.probe.checking':'Checking ID…','panel.toast.stop_first':'Stop the connection first','panel.toast.not_found':'FTX-1 not found: check cable, power and CP210x driver','panel.toast.found':'Found: ','panel.toast.audio':'audio ','panel.version':'Version','panel.confirm.quit':'Quit the app? Server and radio connection will stop, clients will disconnect.','panel.status.connecting':'Connecting…','panel.status.err':'Server not running','panel.status.stopped':'Server stopped','panel.status.press_start':'Press “Start”','panel.status.tx':'⎘ TRANSMIT','panel.status.at':'By ','panel.status.ok':'Connected, running','panel.status.wait':'Waiting for radio response…'});})();


// extra6
(function(){ if(!window.I18N||!I18N.dict) return; const R=I18N.dict.ru||(I18N.dict.ru={}); const E=I18N.dict.en||(I18N.dict.en={});
Object.assign(R,{
  'panel.status.sim':'Работает (симулятор)','panel.status.conn':'Трансивер на связи','panel.status.noresp':'Трансивер не отвечает','panel.status.noresp.hint':'Включён? Тот ли COM-порт и скорость CAT?',
  'panel.tx.on':'Передача','panel.tx.off':'Приём','panel.clients.n':'Пультов: ','panel.clients.local':'этот ПК','panel.clients.remote':'из сети','panel.clients.audio':'• звук','panel.clients.tx':'• передаёт',
  'panel.url.local':'На этом ПК','panel.url.lan':'Для телефона по Wi-Fi','panel.copy':'Копировать','panel.copied':'Скопировано',
  'panel.audio.hint.notusb':'Вы выбрано не USB-устройство трансивера.','panel.audio.hint.nousb':'USB-аудио трансивера не видно: подключите кабель и нажмите ↻.','panel.audio.hint.used':'Звук идёт через ',
  'panel.pw.empty':'Без пароля — в браузере войти сможет любой (это безопасно, но неудобно).','panel.pw.short':'Слишком короткий пароль — лучше 6+ символов.',
  'sd.err.small':'Файл слишком мал — это не бэкап FTX-1','sd.err.header':'Нет заголовка FTX-1 (ожидался «MemList … CRC»)',
  'mem.status.read':'Чтение','mem.status.tones':'Чтение тонов (трансивер переключает по каналам)…','mem.status.write':'Запись: ','mem.status.of':' из ',
  'mem.toast.freq':'Ошибка: введите 145.500','mem.toast.range':'Частота вне диапазона FTX-1 (0,03–470 МГц)','mem.toast.txrange':'Частота передачи вне диапазона','mem.toast.split_fm':'FTX-1 хранит в канале только несимметричный сдвиг, а разнос — общий на весь диапазон. Записан как отдельный TX','mem.toast.enter_freq':'Сначала укажите частоту',
  'mem.confirm.discard':'В таблице есть несохранённые изменения. Прочитать из трансивера и заменить их в таблице (для отмены нажмите Отмена)?',
  'mem.toast.nothing':'Нечего записывать','mem.toast.empty_cat':'Пустые каналы по CAT нельзя — только в трансивере','mem.toast.nofreq':' нет частоты','mem.confirm.write':'Записать в трансивер каналов: ',
  'mem.toast.write_vfob':'\nVFO-B на время записи будет занят, потом восстановится.','mem.toast.write_empty':'\n\nКаналы ','mem.toast.write_empty2':' очищены только в таблице — в трансивере их очистить по CAT нельзя.',
  'mem.toast.select':'Отметьте каналы','mem.prompt.move':'Переместить ','mem.prompt.move2':' отмеченных каналов начиная с номера:','mem.confirm.overwrite':'Каналы ','mem.confirm.overwrite2':' заняты — перезаписать?',
  'mem.toast.sorted':'Отсортировано по частоте','mem.msg.saved':'Сохранено: ','mem.msg.ready':'Готово','mem.msg.err_suffix':' — см. последний столбец',
  'mem.confirm.open':'Открыть «','mem.confirm.open2':'»? Несохранённые правки в файле (но не в трансивере) пропадут.',
  'mem.prompt.group':'Новое имя группы:','mem.toast.group_exists':'Такая группа уже есть',
  'mem.prompt.add':'Добавить в группу «','mem.prompt.add2':'» отмеченные каналы (','mem.prompt.add3':')?',
  'mem.prompt.ch':'Номер нового канала (1–999):','mem.confirm.replace_ch':'Канал ','mem.confirm.replace_ch2':' занят — переписать частоту из VFO?','mem.toast.recall':'Трансивер: канал ',
  'mem.prompt.save':'Название набора каналов:','mem.prompt.saveas':'Сохранить как:','mem.toast.pick_file':'Выберите файл в списке','mem.confirm.del_file':'Удалить файл «','mem.confirm.csv_in':'Каналы из CSV заменят каналы с тем же номером в таблице. Продолжить?',
  'mem.csv.name':'Имя файла каналов'
});
Object.assign(E,{
  'panel.status.sim':'Running (simulator)','panel.status.conn':'Transceiver connected','panel.status.noresp':'No response from transceiver','panel.status.noresp.hint':'Is it on? Correct COM port and CAT speed?',
  'panel.tx.on':'Transmit','panel.tx.off':'Receive','panel.clients.n':'Clients: ','panel.clients.local':'this PC','panel.clients.remote':'remote','panel.clients.audio':'• audio','panel.clients.tx':'• transmitting',
  'panel.url.local':'On this PC','panel.url.lan':'For phone over Wi-Fi','panel.copy':'Copy','panel.copied':'Copied',
  'panel.audio.hint.notusb':'Selected device is not the transceiver USB audio.','panel.audio.hint.nousb':'Transceiver USB audio not visible: connect cable and press ↻.','panel.audio.hint.used':'Audio via ',
  'panel.pw.empty':'No password — anyone can log in from browser (safe but inconvenient).','panel.pw.short':'Password too short — better 6+ characters.',
  'sd.err.small':'File too small — not an FTX-1 backup','sd.err.header':'No FTX-1 header (expected “MemList … CRC”)',
  'mem.status.read':'Reading','mem.status.tones':'Reading tones (radio switches channels)…','mem.status.write':'Writing: ','mem.status.of':' of ',
  'mem.toast.freq':'Error: enter 145.500','mem.toast.range':'Frequency out of FTX-1 range (0.03–470 MHz)','mem.toast.txrange':'TX frequency out of range','mem.toast.split_fm':'FTX-1 stores only asymmetric shift in channel; offset is band-wide. Saved as separate TX','mem.toast.enter_freq':'Enter frequency first',
  'mem.confirm.discard':'There are unsaved changes. Read from transceiver and replace them in the table (Cancel to keep)?',
  'mem.toast.nothing':'Nothing to write','mem.toast.empty_cat':'Empty channels cannot be cleared via CAT — only in radio','mem.toast.nofreq':' no frequency','mem.confirm.write':'Write channels to transceiver: ',
  'mem.toast.write_vfob':'\nVFO-B will be used during write, then restored.','mem.toast.write_empty':'\n\nChannels ','mem.toast.write_empty2':' cleared only in table — CAT cannot clear them in radio.',
  'mem.toast.select':'Select channels','mem.prompt.move':'Move ','mem.prompt.move2':' selected channels starting at:','mem.confirm.overwrite':'Channels ','mem.confirm.overwrite2':' are occupied — overwrite?',
  'mem.toast.sorted':'Sorted by frequency','mem.msg.saved':'Saved: ','mem.msg.ready':'Done','mem.msg.err_suffix':' — see last column',
  'mem.confirm.open':'Open “','mem.confirm.open2':'”? Unsaved file edits (not in radio) will be lost.',
  'mem.prompt.group':'New group name:','mem.toast.group_exists':'Group already exists',
  'mem.prompt.add':'Add selected channels (','mem.prompt.add2':') to group “','mem.prompt.add3':'”?',
  'mem.prompt.ch':'New channel number (1–999):','mem.confirm.replace_ch':'Channel ','mem.confirm.replace_ch2':' is occupied — overwrite with VFO frequency?','mem.toast.recall':'Transceiver: channel ',
  'mem.prompt.save':'Memory set name:','mem.prompt.saveas':'Save as:','mem.toast.pick_file':'Select a file from the list','mem.confirm.del_file':'Delete file “','mem.confirm.csv_in':'Channels from CSV will replace channels with the same number in the table. Continue?',
  'mem.csv.name':'Channel file name'
});})();
