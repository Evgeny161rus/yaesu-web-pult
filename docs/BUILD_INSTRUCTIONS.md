# 🚀 Инструкция по сборке и публикации

## Текущий статус

✅ Проект скопирован в: `C:\Users\bayan\Documents\yaesu-web-pult-release`  
✅ Git репозиторий инициализирован  
✅ Все зависимости установлены  
✅ Тесты готовы к запуску  

---

## Шаг 1: Тестирование

### Запустить все тесты

```bash
cd C:\Users\bayan\Documents\yaesu-web-pult-release
python -m pytest tests/ -v
```

### Проверить основные модули

```bash
# Константы
python -c "import server.constants as c; print(c.APP_NAME, c.VERSION)"

# Список устройств
python server/main.py --list

# Симулятор (5 секунд)
timeout /t 5 /nobreak & python server/main.py --sim --console
```

---

## Шаг 2: Компиляция Windows EXE

### Автоматическая сборка

```bash
cd C:\Users\bayan\Documents\yaesu-web-pult-release
build-exe.bat
```

Результат: `dist\Yaesu-Web-Pult.exe`

Справочник `cty.dat` необязателен: сборка включит `server\cty.dat`
(или `cty.dat` в корне, если файла в `server` нет). Если оба файла отсутствуют,
приложение скачает справочник при запуске с доступом к интернету.

### Ручная сборка (если нужно)

Используйте актуальную команду PyInstaller из `.github/workflows/build.yml`
(job `windows`): она включает `_ftx`, `dxcluster`, `app_paths`,
`hamlib_backend`, `rtlsdr_scope`, `ft4222_transport`, `radio_backends`,
`ptt_serial`, а также данные `web`, `menu_ftx1.json`, `cty.dat` и `ftdi`.
`build-exe.bat` собирает onefile тем же набором.

Старые команды без этих `hidden-import`/`--add-data` дадут EXE, который
запускается, но не находит FT8, Hamlib, SDR или справочник стран.

### Проверка EXE

```bash
# Запустить собранный EXE
dist\Yaesu-Web-Pult.exe

# Должна открыться панель управления
```

## Шаг 3: Установщик Windows (Program Files + драйверы)

Нужен [Inno Setup 6](https://jrsoftware.org/isinfo.php):

```powershell
winget install JRSoftware.InnoSetup
```

Соберите **onedir**-версию (её использует установщик) в `distdir\Yaesu-Web-Pult`
тем же PyInstaller, но с `--onedir --distpath distdir` и теми же
`--add-data`/`--hidden-import`, что и в CI (см. `.github/workflows/build.yml`),
затем:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\build-installer.ps1 `
    -AppDir distdir\Yaesu-Web-Pult -OutDir dist
```

Скрипт:

- при необходимости скачает Hamlib 4.7.2 и RTL-SDR в `tools/` рядом с EXE;
- соберёт `dist\Yaesu-Web-Pult-Setup.exe` по `deploy\windows\Yaesu-Web-Pult.iss`.

Установщик ставит программу в `C:\Program Files\Yaesu Web Pult`, добавляет
драйверы из `drivers/` (FTDI, CP210x) через `pnputil`, ярлыки и Zadig.
Портативные `dist\Yaesu-Web-Pult.exe` и `dist\Yaesu-Web-Pult-folder.zip`
собираются как раньше.

---

## Шаг 4: Публикация релизов

Релизы собираются автоматически в GitHub Actions при push в `main`:

- **windows-latest** — `Yaesu-Web-Pult-Setup.exe`, портативные EXE/ZIP и `SHA256.txt`;
- **pi-latest** — `yaesu-web-pult-pi.tar.gz` и `SHA256-pi.txt`.

Теги `windows-latest` и `pi-latest` автоматически указывают на коммит
опубликованной сборки. Публикации сериализованы, чтобы параллельные запуски
не перезаписывали ассеты. Вручную создавать релиз `v3.2.0` и загружать только
`Yaesu-Web-Pult.exe` не нужно — это оставлено в истории для старых ссылок
(тег `latest`).

Проверить сборку: вкладка **Actions** → `Build Windows + Raspberry Pi releases`.
Локальная сборка установщика описана в разделе «Установщик Windows» выше.

## Шаг 5: Проверка релиза

### Чеклист перед публикацией

- [ ] Все тесты проходят (`pytest`)
- [ ] `VERSION` в `server/main.py` и `version_info.txt` соответствуют сборке
- [ ] README.md и START-HERE-RU.md актуальны
- [ ] LICENSE файл присутствует
- [ ] CHANGELOG.md обновлён
- [ ] .gitignore настроен
- [ ] Нет `config.json`/`cert.pem`/`records` в репозитории
- [ ] Setup, портативные EXE/ZIP и Pi tar собираются

### Проверка после публикации

- [ ] GitHub Actions завершились успешно
- [ ] Теги `windows-latest` и `pi-latest` указывают на коммит сборки
- [ ] В релизах есть `Yaesu-Web-Pult-Setup.exe`, портативные файлы и Pi tar
- [ ] Ссылки в README/START-HERE открываются
- [ ] `SHA256` в релизах соответствуют ассетам

---

## Автоматизация (CI/CD)

После публикации GitHub Actions автоматически:
- ✅ Проверит стиль (flake8) и запустит тесты на Python 3.11–3.13
- ✅ Соберёт Windows EXE/ZIP/Setup и архив Raspberry Pi
- ✅ Обновит релизы `windows-latest` / `pi-latest` и их теги

Проверить статус: вкладка Actions на GitHub

---

## Дополнительно

### Сборка для Linux / Raspberry Pi

Для Raspberry Pi CI собирает **исходники + `deploy/install-rpi.sh`** (tar.gz),
а не PyInstaller-EXE. Локально можно повторить:

```bash
git archive --format=tar.gz --prefix=yaesu-web-pult/ -o yaesu-web-pult-pi.tar.gz HEAD
```

и передать архив на Pi; установка — `sudo bash deploy/install-rpi.sh`.

---

## Поддержка

После публикации пользователи смогут:
- 🐛 Создавать Issues
- 💡 Предлагать улучшения
- 🔧 Отправлять Pull Requests
- ⭐ Ставить звёзды

**Готово к публикации!** 🚀

---

**Местоположение проекта:**  
`C:\Users\bayan\Documents\yaesu-web-pult-release`

**Следующий шаг:**  
Запустить `deploy\windows\build-installer.ps1` для установщика (см. «Шаг 3»).

### Данные установленной Windows-версии

Установщик добавляет `installed-mode.txt`: настройки и записи сохраняются в
`%LOCALAPPDATA%\Yaesu Web Pult`, отдельно от защищённых EXE и DLL в Program Files.
При обновлении старые данные копируются один раз без перезаписи и удаления оригиналов.
Portable-сборки без этого маркера хранят данные рядом с EXE.
CI проверяет установку, снятие старых прав Users:Modify, миграцию и selftest.
