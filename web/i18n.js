/* i18n loader for Yaesu Web Pult.
 * Loads translations from web/lang/<code>.json and applies via data-i18n* attributes.
 * API: I18N.t(key,fallback), I18N.apply(root), I18N.setLang(code), I18N.getLang(),
 *      I18N.add(code,map), I18N.load(code), I18N.ready (Promise), I18N.dict (cache)
 */
(function () {
  const storeKey = 'ftx1.lang';
  const available = ['ru', 'en'];
  const dict = { ru: {}, en: {} };
  const loaded = {};
  let lang = detectLang();
  let readyResolve;
  const ready = new Promise(r => { readyResolve = r; });

  function detectLang() {
    try {
      const saved = localStorage.getItem(storeKey);
      if (saved && available.indexOf(saved) !== -1) return saved;
    } catch (e) {}
    try {
      const nav = (navigator.language || navigator.userLanguage || 'ru').toLowerCase();
      if (nav.indexOf('en') === 0) return 'en';
    } catch (e) {}
    return 'ru';
  }

  function currentMap() {
    return dict[lang] || dict.ru || {};
  }

  function t(key, fallback) {
    const map = currentMap();
    if (map && Object.prototype.hasOwnProperty.call(map, key)) return map[key];
    // try other loaded langs as secondary fallback before explicit fallback
    for (let i = 0; i < available.length; i++) {
      const c = available[i];
      if (c === lang) continue;
      const m = dict[c];
      if (m && Object.prototype.hasOwnProperty.call(m, key)) return m[key];
    }
    return (fallback != null ? fallback : key);
  }

  function apply(root) {
    const scope = root || document;
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      if (el.hasAttribute('data-i18n-dynamic')) return; // текст управляется приложением/состоянием
      const k = el.getAttribute('data-i18n');
      if (!k) return;
      const v = t(k);
      if (el.getAttribute('data-i18n-html') === '1') el.innerHTML = v;
      else el.textContent = v;
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      const k = el.getAttribute('data-i18n-title');
      if (k) el.setAttribute('title', t(k));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (k) el.setAttribute('placeholder', t(k));
    });
    scope.querySelectorAll('[data-i18n-value]').forEach(el => {
      const k = el.getAttribute('data-i18n-value');
      if (k) el.value = t(k);
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const k = el.getAttribute('data-i18n-aria-label');
      if (k) el.setAttribute('aria-label', t(k));
    });
    // elements with data-label-key are handled by app logic, but update data-label if possible
    scope.querySelectorAll('[data-label-key]').forEach(el => {
      const k = el.getAttribute('data-label-key');
      if (k) el.dataset.label = t(k, el.dataset.label);
    });
    try { document.documentElement.lang = lang; } catch (e) {}
  }

  async function loadLang(code) {
    if (!code) code = lang;
    if (!available.includes(code)) return dict[code] || {};
    if (loaded[code]) return dict[code];
    try {
      const resp = await fetch('lang/' + encodeURIComponent(code) + '.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      dict[code] = (data && typeof data === 'object') ? data : {};
      loaded[code] = true;
      return dict[code];
    } catch (e) {
      dict[code] = dict[code] || {};
      loaded[code] = true; // avoid retry storm; fallback will be used
      try { console.warn('i18n load failed:', code, e); } catch (_) {}
      return dict[code];
    }
  }

  async function setLang(next, opts) {
    opts = opts || {};
    if (!next || !available.includes(next)) next = 'ru';
    lang = next;
    try { localStorage.setItem(storeKey, lang); } catch (e) {}
    await loadLang(lang);
    if (!opts.noApply) apply(document);
    try { window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } })); } catch (e) {}
    return lang;
  }

  function getLang() { return lang; }

  function add(code, map) {
    if (!code || !map) return;
    dict[code] = Object.assign(dict[code] || {}, map);
  }

  async function init() {
    try {
      await loadLang(lang);
      // also preload fallback lang in background if different
      if (lang !== 'ru') loadLang('ru');
    } catch (e) {}
    apply(document);
    try { readyResolve(lang); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('langchange', { detail: { lang, initial: true } })); } catch (e) {}
  }

  window.I18N = { t, apply, setLang, getLang, add, load: loadLang, ready, dict, available };
  window.tr = window.tr || function (k, fb) { return t(k, fb); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); });
  } else {
    init();
  }
})();
