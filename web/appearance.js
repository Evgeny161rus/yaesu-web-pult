/* Appearance and density are local preferences. Layout is a single stable
 * workspace (Classic) plus the DX-spots preset; a colour theme never moves
 * controls around. */
(() => {
  'use strict';
  const root = document.documentElement;
  const themes = ['original', 'heritage', 'daylight'];
  const layouts = ['classic', 'dx'];
  const themeMap = {
    original: 'original', heritage: 'heritage', daylight: 'daylight',
    studio: 'original', field: 'original',
    'radio-night': 'heritage', 'radio-silver': 'daylight'
  };
  function read(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  const storedTheme = read('ftx1-appearance', 'original');
  root.dataset.appearance = themeMap[storedTheme] || 'original';
  const storedLayout = read('ftx1-workspace', 'classic');
  // Старые «справа»/«передняя панель» больше не существуют.
  root.dataset.workspace = layouts.includes(storedLayout) ? storedLayout : 'classic';
  root.dataset.density = read('ftx1-density', 'normal') === 'touch' ? 'touch' : 'normal';

  function apply() {
    const content = document.getElementById('dxContent');
    let dock = document.getElementById('dxDock');
    const layout = document.querySelector('.layout');
    if (content && !dock && layout) {
      dock = document.createElement('section');
      dock.id = 'dxDock';
      dock.className = 'panel';
      dock.dataset.panel = 'dx';
      layout.append(dock);
    }
    const target = content && (root.dataset.workspace === 'dx' ? dock : document.getElementById('tab-dx'));
    if (target) target.append(content);
    window.dispatchEvent(new Event('resize'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    for (const [id, field, key, allowed] of [
      ['optAppearance', 'appearance', 'ftx1-appearance', themes],
      ['optWorkspace', 'workspace', 'ftx1-workspace', layouts],
      ['optDensity', 'density', 'ftx1-density', ['normal', 'touch']]]) {
      const input = document.getElementById(id);
      if (!input) continue;
      input.value = root.dataset[field];
      input.addEventListener('change', () => {
        root.dataset[field] = allowed.includes(input.value) ? input.value : allowed[0];
        save(key, root.dataset[field]);
        apply();
      });
    }
    apply();
  });
})();
