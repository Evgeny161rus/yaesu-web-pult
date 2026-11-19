/* Presentation preferences only: never sends CAT or PTT commands. */
(() => {
  'use strict';
  const allowed = ['original', 'studio', 'daylight', 'heritage', 'field', 'radio-night', 'radio-silver'];
  let selected = 'original';
  try { selected = localStorage.getItem('ftx1-appearance') || selected; } catch (_) {}
  if (!allowed.includes(selected)) selected = 'original';
  document.documentElement.dataset.appearance = selected;
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('optAppearance');
    if (!select) return;
    select.value = selected;
    select.addEventListener('change', () => {
      selected = allowed.includes(select.value) ? select.value : 'original';
      document.documentElement.dataset.appearance = selected;
      if (window.applyConsoleLayout) window.applyConsoleLayout();
      try { localStorage.setItem('ftx1-appearance', selected); } catch (_) {}
      window.dispatchEvent(new Event('resize'));
    });
  });
})();
