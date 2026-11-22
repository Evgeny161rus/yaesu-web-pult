# Темы — краткая инструкция

Куда смотреть и что менять, чтобы добавить или поправить тему пульта.

## Файлы

| Файл | Назначение |
|---|---|
| `web/app.css` | базовая тема `original` (переменные в `:root`) |
| `web/appearance.css` | темы `studio`, `daylight`, `heritage`, `field` |
| `web/console-layout.css` | темы `radio-night`, `radio-silver` + консольный layout |
| `web/appearance.js` | список `allowed`, запись в `localStorage`, обработка `<select>` |
| `web/console-layout.js` | `consoleThemes` (какие темы используют консольный layout) |
| `web/index.html` | `<select id="optAppearance">` с названиями |
| `web/lang/ru.json`, `en.json` | переводы `opts.appearance.*` |

## Как это работает

1. `appearance.js` при загрузке читает `localStorage['ftx1-appearance']`,
   проверяет, что ID есть в `allowed`, и ставит `document.documentElement.dataset.appearance`.
2. CSS применяет переменные по селектору `:root[data-appearance="..."]`.
3. `console-layout.js` включает консольную разметку только для `radio-night`/`radio-silver`.

## Добавить тему (по шагам)

1. CSS-блок с переменными (см. `THEMES.md`).
2. Добавить ID в `allowed` в `appearance.js`.
3. Добавить `<option>` в `#optAppearance` в `index.html`.
4. Переводы в `web/lang/*.json`.
5. Для консольной темы — добавить ID в `consoleThemes` в `console-layout.js`.

## Правила

- Темы — **только представление**: не отправляют CAT/PTT, не читают сеть.
- Переменные: `--bg`, `--panel`, `--panel-2`, `--line`, `--text`, `--muted`,
  `--accent`, `--accent-2`, `--lcd`, `--radius`; смысловые `--ok`, `--warn`, `--tx`.
- `--lcd` — цвет дисплея/частоты; `--accent` — активные элементы и фокус.
- Не дублируйте всю тему в `app.css`; базовые стили — там, переопределения — в `appearance.css`.
