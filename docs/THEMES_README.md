# Темы — краткая инструкция

Куда смотреть и что менять, чтобы добавить или поправить тему пульта.

## Файлы

| Файл | Назначение |
|---|---|
| `web/app.css` | базовая тема `original` (переменные в `:root`) |
| `web/appearance.css` | темы `studio`, `daylight`, `heritage`, `field` |
| `web/console-layout.css` | компоновка «передняя панель» (workspace `console`) |
| `web/dx.css` | компоновки `right`/`dx`, размер кнопок `touch`, стили DX-спотов |
| `web/appearance.js` | темы `themes`, компоновки `layouts`, размер, запись в `localStorage` |
| `web/console-layout.js` | перенос метров/панели для workspace `console` |
| `web/index.html` | `<select id="optAppearance">`, `#optWorkspace`, `#optDensity` |
| `web/lang/ru.json`, `en.json` | переводы `opts.appearance.*`, `layout.*` |

## Как это работает

1. `appearance.js` при загрузке читает `localStorage['ftx1-appearance']`,
   проверяет, что ID есть в `themes`, и ставит `document.documentElement.dataset.appearance`.
2. Там же независимо читаются `ftx1-workspace` (компоновка) и `ftx1-density` (размер кнопок)
   и ставятся `data-workspace` / `data-density`.
3. CSS применяет переменные по `:root[data-appearance="..."]`, компоновку — по
   `html[data-workspace="..."]`, крупные элементы — по `html[data-density="touch"]`.
4. `console-layout.js` включает консольную разметку только для `data-workspace="console"`.
   Старые темы `radio-night`/`radio-silver` и `daylight`/`field` переносятся автоматически.

## Добавить тему (по шагам)

1. CSS-блок с переменными (см. `THEMES.md`).
2. Добавить ID в `themes` в `appearance.js`.
3. Добавить `<option>` в `#optAppearance` в `index.html`.
4. Переводы в `web/lang/*.json`.

Компоновка (`layouts`) и размер кнопок добавляются отдельно и от темы не зависят.

## Правила

- Темы — **только представление**: не отправляют CAT/PTT, не читают сеть.
- Переменные: `--bg`, `--panel`, `--panel-2`, `--line`, `--text`, `--muted`,
  `--accent`, `--accent-2`, `--lcd`, `--radius`; смысловые `--ok`, `--warn`, `--tx`.
- `--lcd` — цвет дисплея/частоты; `--accent` — активные элементы и фокус.
- Не дублируйте всю тему в `app.css`; базовые стили — там, переопределения — в `appearance.css`.
