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

```bash
# Установить PyInstaller
pip install pyinstaller

# Собрать
pyinstaller --clean ^
    --name "Yaesu-Web-Pult" ^
    --noconsole ^
    --onefile ^
    --icon web\icon.ico ^
    --add-data "web;web" ^
    --add-data "server;server" ^
    --hidden-import numpy ^
    --hidden-import numpy.core ^
    --collect-all sounddevice ^
    --version-file version_info.txt ^
    Yaesu-Web-Pult.pyw
```

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

## Шаг 3: Подготовка к GitHub

### Создать README.md (уже готов)

Проверьте `README.md` и обновите:
- [ ] Ваш GitHub username в ссылках
- [ ] Email для контактов
- [ ] Скриншоты (если есть)

### Подготовить Release

```bash
cd C:\Users\bayan\Documents\yaesu-web-pult-release

# Создать папку релиза
mkdir release

# Скопировать EXE
copy dist\Yaesu-Web-Pult.exe release\

# Создать архив с исходниками (опционально)
# Можно использовать 7-Zip или WinRAR
```

### Создать CHANGELOG для релиза

```bash
# release/RELEASE_NOTES.md
```

```markdown
# Yaesu Web Pult v3.2.0

## Новое в этой версии

### 🎨 Дизайн
- 7 профессиональных тем оформления
- Современная адаптивная панель управления
- Улучшенный мобильный интерфейс

### 🚀 Функциональность
- Поддержка множества моделей Yaesu через Hamlib
- Оптимизация для Raspberry Pi
- Упрощённая настройка

### 📚 Документация
- Полная документация на русском
- Руководство по темам оформления
- Инструкции по развёртыванию

## Установка

### Windows
1. Скачать `Yaesu-Web-Pult.exe`
2. Запустить двойным кликом
3. Готово!

### Системные требования
- Windows 10/11 (64-bit)
- 2 GB RAM
- USB порт для трансивера

## Что нужно
- Трансивер Yaesu (FTX-1, FT-710, FTDX10, и др.)
- USB кабель
- Драйвер Virtual COM Port от Yaesu
```

---

## Шаг 4: Публикация на GitHub

### Вариант A: GitHub Desktop (рекомендуется для новичков)

1. Открыть GitHub Desktop
2. File → Add Local Repository
3. Выбрать: `C:\Users\bayan\Documents\yaesu-web-pult-release`
4. Commit all changes: "Initial release v3.2.0"
5. Publish repository
6. Create Release → v3.2.0
7. Прикрепить `Yaesu-Web-Pult.exe`

### Вариант B: Командная строка GitHub CLI

```bash
cd C:\Users\bayan\Documents\yaesu-web-pult-release

# Создать репозиторий на GitHub
gh repo create yaesu-web-pult --public --source=. --remote=origin

# Первый коммит
git add .
git commit -m "Initial release v3.2.0 - Modern design with 7 themes"

# Push
git push -u origin main

# Создать релиз
gh release create v3.2.0 ^
    --title "Yaesu Web Pult v3.2.0" ^
    --notes-file release/RELEASE_NOTES.md ^
    dist/Yaesu-Web-Pult.exe
```

### Вариант C: Через веб-интерфейс GitHub

1. Зайти на github.com
2. New repository → `yaesu-web-pult`
3. Public, без README (уже есть)
4. Скопировать команды push:

```bash
cd C:\Users\bayan\Documents\yaesu-web-pult-release

git add .
git commit -m "Initial release v3.2.0"
git remote add origin https://github.com/YOUR_USERNAME/yaesu-web-pult.git
git branch -M main
git push -u origin main
```

5. На GitHub: Releases → Create a new release
6. Tag: `v3.2.0`
7. Title: `Yaesu Web Pult v3.2.0`
8. Upload: `Yaesu-Web-Pult.exe`
9. Publish release

---

## Шаг 5: После публикации

### Обновить README.md

Заменить в ссылках `YOUR_USERNAME` на реальный:

```bash
# Найти и заменить
YOUR_USERNAME → ваш_github_username
```

### Добавить badges

В начало README.md:

```markdown
[![Downloads](https://img.shields.io/github/downloads/YOUR_USERNAME/yaesu-web-pult/total.svg)](https://github.com/YOUR_USERNAME/yaesu-web-pult/releases)
[![Version](https://img.shields.io/github/v/release/YOUR_USERNAME/yaesu-web-pult.svg)](https://github.com/YOUR_USERNAME/yaesu-web-pult/releases)
```

### Создать скриншоты

```bash
mkdir docs\screenshots

# Сделать скриншоты:
# 1. Главный пульт с частотой
# 2. Панель управления
# 3. Селектор тем
# 4. Мобильная версия
```

### Добавить в QRZ.com

1. Зайти на qrz.com/db/R6AAF
2. Edit → Software
3. Добавить ссылку на GitHub

---

## Проверка релиза

### Чеклист перед публикацией

- [ ] Все тесты проходят (`pytest`)
- [ ] EXE собран и запускается
- [ ] README.md актуален
- [ ] LICENSE файл присутствует
- [ ] CHANGELOG.md обновлён
- [ ] Версия в `constants.py` = 3.2.0
- [ ] Версия в `version_info.txt` = 3.2.0
- [ ] .gitignore настроен
- [ ] Нет config.json в репозитории
- [ ] Нет logs/ в репозитории

### Проверка после публикации

- [ ] Репозиторий доступен публично
- [ ] README.md корректно отображается
- [ ] Release v3.2.0 создан
- [ ] EXE доступен для скачивания
- [ ] Ссылки в README работают
- [ ] Badges отображаются

---

## Автоматизация (CI/CD)

После публикации GitHub Actions автоматически:
- ✅ Запустит линтеры (flake8, pylint, mypy)
- ✅ Запустит тесты на Python 3.11-3.13
- ✅ Проверит на Windows и Linux

Проверить статус: вкладка Actions на GitHub

---

## Дополнительно

### Создать Release для других платформ

```bash
# Linux (на Linux машине)
pyinstaller Yaesu-Web-Pult.spec
tar -czf yaesu-web-pult-linux-x64.tar.gz dist/

# Raspberry Pi (на RPi)
pyinstaller Yaesu-Web-Pult.spec
tar -czf yaesu-web-pult-rpi-arm64.tar.gz dist/
```

### Docker Image на Docker Hub

```bash
# Собрать образ
docker build -t YOUR_USERNAME/yaesu-web-pult:3.2.0 .
docker build -t YOUR_USERNAME/yaesu-web-pult:latest .

# Push на Docker Hub
docker login
docker push YOUR_USERNAME/yaesu-web-pult:3.2.0
docker push YOUR_USERNAME/yaesu-web-pult:latest
```

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
Запустить `build-exe.bat` для компиляции
