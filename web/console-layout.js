/* Radio-face workspace inspired by MM5AGM's YWC Radio Panel.
 * Original implementation; moves existing live controls, never duplicates CAT logic.
 */
(() => {
  let anchor, meters, shelf;
  function apply() {
    if (!document.querySelector('.layout')) return;
    if (!shelf) {
      meters = document.querySelector('.display .meters');
      anchor = document.createComment('original meter position'); meters.before(anchor);
      shelf = document.createElement('aside'); shelf.id = 'consoleShelf'; shelf.className = 'panel';
      const label = document.createElement('h2'); label.textContent = 'Измерители'; shelf.append(label);
      const noMeters = document.createElement('p'); noMeters.className = 'console-unavailable muted small';
      noMeters.textContent = 'Измерители этой модели пока не подключены'; shelf.append(noMeters);
      const actions = document.createElement('div'); actions.className = 'console-actions';
      for (const [label,tab] of [['Приём','rx'],['Передача','tx'],['VFO / память','vfo'],['CW','cw'],['Цифра','digi'],['Настройки','opts']]) {
        const button = document.createElement('button'); button.className = 'btn'; button.textContent = label;
        if (!['rx','opts'].includes(tab)) button.classList.add('console-native');
        button.onclick = () => document.querySelector(`#tabs [data-tab="${tab}"]`).click(); actions.append(button);
      }
      shelf.append(actions); document.querySelector('.layout').prepend(shelf);
      const legend = document.createElement('span'); legend.className = 'scope-source muted small';
      legend.textContent = 'АУДИОСПЕКТР · USB AUDIO'; document.querySelector('.wf-tools').prepend(legend);
    }
    const active = document.documentElement.dataset.workspace === 'console';
    document.body.classList.toggle('radio-console', active);
    if (active) shelf.insertBefore(meters,shelf.children[1]); else anchor.after(meters);
    window.dispatchEvent(new Event('resize'));
  }
  window.applyConsoleLayout = apply;
  document.addEventListener('DOMContentLoaded',apply);
})();
