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
