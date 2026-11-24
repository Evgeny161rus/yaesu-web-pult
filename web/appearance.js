/* Appearance, workspace and control size are independent local preferences. */
(() => {
  'use strict';
  const root = document.documentElement;
  const themes = ['original', 'studio', 'daylight', 'heritage', 'field', 'radio-night', 'radio-silver'];
  const layouts = ['classic', 'right', 'console', 'dx'];
  function read(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  const theme = read('ftx1-appearance', 'original');
  root.dataset.appearance = themes.includes(theme) ? theme : 'original';
  const migrated = theme.startsWith('radio-') ? 'console' : theme === 'daylight' ? 'right' : 'classic';
  const layout = read('ftx1-workspace', migrated);
  root.dataset.workspace = layouts.includes(layout) ? layout : 'classic';
  root.dataset.density = read('ftx1-density', theme === 'field' ? 'touch' : 'normal') === 'touch' ? 'touch' : 'normal';
  function apply() {
    const content = document.getElementById('dxContent');
    let dock = document.getElementById('dxDock');
    const layout = document.querySelector('.layout');
    if (content && !dock && layout) {
      dock = document.createElement('section'); dock.id = 'dxDock'; dock.className = 'panel';
      layout.append(dock);
    }
    const target = content && (root.dataset.workspace === 'dx' ? dock : document.getElementById('tab-dx'));
    if (target) target.append(content);
    window.applyConsoleLayout?.();
    window.dispatchEvent(new Event('resize'));
  }
  document.addEventListener('DOMContentLoaded', () => {
    for (const [id, field, key, allowed] of [
      ['optAppearance', 'appearance', 'ftx1-appearance', themes],
      ['optWorkspace', 'workspace', 'ftx1-workspace', layouts],
      ['optDensity', 'density', 'ftx1-density', ['normal','touch']]]) {
      const input = document.getElementById(id);
      if (!input) continue;
      input.value = root.dataset[field];
      input.addEventListener('change', () => {
        root.dataset[field] = allowed.includes(input.value) ? input.value : allowed[0];
        save(key, root.dataset[field]); apply();
      });
    }
    apply();
  });
})();
