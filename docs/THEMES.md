# Темы оформления пульта

Пульт (`index.html`) имеет 7 тем («внешний вид»). Переключаются в настройках пульта:
**Настройки → Внешний вид** (или `<select id="optAppearance">`). Выбор хранится в
`localStorage` под ключом `ftx1-appearance`.

Темы задаются CSS-переменными через атрибут `data-appearance` на `<html>`.
Файлы: `web/app.css` (базовая), `web/appearance.css` (студийные темы),
`web/console-layout.css` (radio-night / radio-silver).

| ID | Название | Стиль |
|---|---|---|
| `original` | Оригинальная | базовая тёмная, циановый акцент |
| `studio` | Studio | тёмная студийная, стальной/синий, скругления 14px |
| `daylight` | Daylight | светлая, бирюзовый акцент, тени |
| `heritage` | Heritage | «ламповая», янтарный LCD, углы 3px |
| `field` | Field | «полевая», зелёный LCD, крупные кнопки |
| `radio-night` | Radio Night | консоль радио, тёмный экран, оранжевый акцент |
| `radio-silver` | Radio Silver | светлый металл, тёмный экран, зелёный LCD |

## Цвета

| ID | Фон | Панель | Текст | Акцент | LCD |
|---|---|---|---|---|---|
| `original` | `#0b0f14` | `#121820` | `#dbe5ef` | `#36c5f0` | `#9ff2ff` |
| `studio` | `#10151e` | `#19212e` | `#edf2fa` | `#8ab4ff` | `#c0d8ff` |
| `daylight` | `#e9eef1` | `#ffffff` | `#192d36` | `#006879` | `#005364` |
| `heritage` | `#141310` | `#211f19` | `#efe5d2` | `#efb65d` | `#ffcc78` |
| `field` | `#101914` | `#1b2920` | `#eff7e9` | `#bcdf82` | `#ddf4b8` |
| `radio-night` | `#141618` | `#212427` | `#eff3f6` | `#f0b04f` | `#a6ddf2` |
| `radio-silver` | `#b8bfc5` | `#d5dadd` | `#172932` | `#006e62` | `#005649` |

Дополнительные смысловые цвета (у всех тем): `--ok` (зелёный), `--warn` (жёлтый),
`--tx` (красный, передача).

## Описание

- **original** — базовая тёмная тема из `app.css`, циановый LCD. Ничего не переопределяет.
- **studio** — спокойная тёмная с синим акцентом, увеличенные скругления (14px), панель с верхней линией акцента.
- **daylight** — светлая для работы днём; `color-scheme: light`, мягкие тени, контрастные таблицы памяти.
- **heritage** — «ретро» с янтарным LCD и почти прямыми углами (3px), двойная рамка дисплея.
- **field** — для выездов: крупные PTT (68px) и кнопки (мин. 44px), зелёный LCD.
- **radio-night** — стиль аппаратной консоли: тёмный «экран» дисплея (`--screen`), оранжевый акцент.
- **radio-silver** — светлый металлический корпус, тёмный экран с зелёным LCD.

## Как добавить тему

1. В `web/appearance.css` (или `console-layout.css`) добавьте блок:

   ```css
   :root[data-appearance="mytheme"] {
     --bg:#...; --panel:#...; --panel-2:#...; --line:#...;
     --text:#...; --muted:#...; --accent:#...; --accent-2:#...;
     --lcd:#...; --radius:12px;
   }
   ```

2. Добавьте ID в список `allowed` в `web/appearance.js`.
3. Добавьте `<option value="mytheme">` в `<select id="optAppearance">` в `web/index.html`.
4. (Только для консольных тем) добавьте ID в `consoleThemes` в `web/console-layout.js`.
5. Обновите перевод названия в `web/lang/ru.json` / `en.json` (`opts.appearance.*`).
