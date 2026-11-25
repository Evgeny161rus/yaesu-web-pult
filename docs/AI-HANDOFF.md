# AI handoff — Yaesu Web Pult

Обновлено: **25.11.2026**. Это рабочий контекст для следующего AI-агента/себя,
чтобы не восстанавливать историю заново. Секреты здесь не хранятся.

## Проект

- Локальная папка: `C:\Users\bayan\Documents\yaesu-web-pult-release`
- GitHub: <https://github.com/Evgeny161rus/yaesu-web-pult>
- Ветка: `main`, изменения — только через PR (main защищён).
- На момент написания файла `main` был `e28388e`; после коммита этого файла
  он стал новее — всегда проверяй `git log --oneline -1`.
- Релизы: `windows-latest`, `pi-latest`; старый тег `latest` — только legacy.
- Версия в коде: `3.2-preview`.

Веб-пульт для Yaesu: FTX-1 — native backend, другие трансиверы — Hamlib/CAT.
Есть звук RX/TX, водопад (audio / FT4222 / RTL-SDR / SoapySDR), FT8/FT4,
CW/RTTY/PSK31/SSTV/NAVTEX/WEFAX, DX-споты, темы/компоновки, Windows Setup и
headless Raspberry Pi. Поддерживаются только эти два способа установки;
альтернативные упаковки не добавлять без реального теста USB и звука.

## Актуальные релизы и проверка

Проверять так:

```powershell
gh release view windows-latest
gh release view pi-latest
git log --oneline -1
```

На момент обновления файла (хеши после следующей сборки будут другими —
бери актуальные из `SHA256.txt`/`SHA256-pi.txt`):

- Windows Setup: `Yaesu-Web-Pult-Setup.exe`
- Pi tar: `yaesu-web-pult-pi.tar.gz`
- Теги обоих релизов указывали на `e28388e`.
- CI build (`Build Windows + Raspberry Pi releases`) — success.
- Локально: `pytest` — **99 passed, 4 skipped** (Linux-only/Hamlib/hardware тесты
  могут пропускаться).

Setup/EXE/архивы в `windows-latest` **перезаписываются каждой сборкой**;
download_count сбрасывается. Для честной статистики нужны версионные релизы.

## Где что лежит

### Сервер

- `server/main.py` — `Station`, панель, сервер, WebSocket, запуск/остановка,
  автоподключение, SDR, selftest.
- `server/app_paths.py` — выбор каталога данных:
  - Windows installed (маркер `installed-mode.txt`) → `%LOCALAPPDATA%\Yaesu Web Pult`;
  - portable/исходники → рядом с EXE/корень проекта;
  - миграция старых данных из папки установки без перезаписи.
- `server/cat.py` — native FTX-1 CAT, очередь команд, RTS/DTR PTT.
- `server/hamlib_backend.py` — `rigctld`, любые модели; ищет bundled
  `tools/hamlib/hamlib-w64-4.7.2/bin/rigctld.exe` через `sys.executable`.
- `server/audio.py` — PortAudio, отдельные RX/TX устройства, водопад.
- `server/rtlsdr_scope.py`, `ft710_scope.py`, `ft4222_transport.py` — SDR/scope.
- `server/ft8.py` + `server/ftx/` + `_ftx` — FT8/FT4; `_ftx` собирается
  per-platform (`python server/setup_ftx.py build_ext --inplace`).
- `server/dxcluster.py` — DX-споты: telnet DXSpider/AR-Cluster и публичный
  SpotRadio JSON (`spots.php?limit=200`, опрос раз в 20 с), только приём,
  дедупликация, дельты, защита от переполнения частоты, перестройка только RX VFO.
- `web/` — пульт; `web/dx.js`, `web/dx.css` — DX; `web/appearance.js` —
  темы/компоновки; `web/sw.js` — PWA-кэш.
- `docs/` — актуальные инструкции; `docs/CONTEXT.md` и `docs/ROADMAP.md` —
  исторические заметки (в них есть пометки). `docs/archive/` — архив.

### Windows

- `deploy/windows/Yaesu-Web-Pult.iss` — Inno Setup.
- `deploy/windows/build-installer.ps1` — сборка Setup из onedir.
- `deploy/windows/test-installer.ps1` — smoke-тест в GitHub Actions:
  Program Files, ACL, миграция данных, selftest, uninstall.
- `drivers/` — FTDI (CDM 2.12.36.20), CP210x (11.0.0.509), Zadig.
- Setup ставит в `C:\Program Files\Yaesu Web Pult`, данные — в LocalAppData;
  `Users:Modify` в Program Files больше не выдаётся; приложение запускается
  без администратора (`runasoriginaluser`).
- При обновлении старые данные копируются один раз; оригиналы сохраняются.
- `[UninstallDelete]` удаляет `drivers/install.log` и пустые папки.

### Raspberry Pi

- `deploy/rpi/install-rpi.sh` — установка/обновление, зависимости, venv,
  сборка `_ftx`, меню `whiptail`, systemd, USB-группы `dialout,audio,plugdev`.
- `deploy/rpi/configure.py` — консольный настройщик; `server/config_cli.py` —
  CLI для whiptail (get/set/setraw, ports/audio/hamlib).
- Сервис: `yaesu-web-pult`; данные: `/opt/yaesu-web-pult`; пульт `:8443`,
  локальная панель `127.0.0.1:8080`; конфиг `/opt/yaesu-web-pult/config.json`.
- `cty.dat` включён в релизный tar; `server/cty.dat` не должен исключаться
  установщиком.
- RTL-SDR требует группу `plugdev`; blacklist DVB ставится установщиком.
- Автоподключение: при отсутствии `/dev/ttyUSB0` повторяет попытки 2→4→8→16→30 с;
  кнопка «Запустить»/сохранение настроек будят цикл, «Стоп» отменяет.

## CI/CD

`.github/workflows/build.yml`:

- Windows: onefile EXE, onedir ZIP, Hamlib/RTL download, Inno Setup,
  установщик, `test-installer.ps1`, selftest, релиз `windows-latest`.
- Pi: tar.gz из `git archive` + `cty.dat`, релиз `pi-latest`.
- Теги `windows-latest`/`pi-latest` принудительно переводятся на коммит сборки;
  concurrency `releases-${{ github.ref }}` сериализует публикации.
- `tests.yml` / `lint.yml` — PR-проверки; flake8 с `--exit-zero`, критичные
  ошибки E9/F63/F7/F82.
- CI собирает только Windows и Raspberry Pi; других упаковок нет.

## Проверенное состояние (на момент файла)

- Windows Setup реально установлен/удалён на этом ПК; данные ушли в
  `%LOCALAPPDATA%`, Program Files только для чтения; selftest OK; драйверы
  FTDI/CP210x ставятся, лог удаляется при uninstall.
- На Pi (192.168.8.167, пользователь `user`) сервис был active; конфиг и
  DX-настройки сохранены (пароль панели — у пользователя, в репозитории его нет);
  после переноса трансивера на ПК устройства на Pi исчезали, автоподключение
  ждало порт. Пароли в репозиторий не писать.
- TX на реальной антенне не проверялся; антенны нет. Не включать передачу
  «просто проверить».
- SpotRadio проверен живым запросом к `spots.php?limit=200`: публичный JSON,
  ~135 актуальных спотов за час, опрос раз в 20 с; повторный опрос не раздувает
  счётчики (дедупликация по spotter+call+frequency+time).

## Грабли

- После копирования Python-файлов на Pi удалять `server/__pycache__`, иначе
  старый `.pyc` может маскировать новый код.
- `config.json` может быть UTF-8 с BOM: загрузчик использует `utf-8-sig`.
- Windows установщик нельзя проверять локально `test-installer.ps1` (он
  ограничен `GITHUB_ACTIONS=true`); обычная сборка — `build-installer.ps1`.
- Не возвращать `Users:Modify` на Program Files: данные должны жить в
  LocalAppData; иначе приложение снова потребует прав.
- Не перезаписывать релизы без необходимости, если нужна статистика скачиваний.
- Windows: дочерние консольные утилиты (`rtl_sdr`, `rx_sdr`, `hackrf_transfer`,
  `rigctld` и т.п.) запускать только с `CREATE_NO_WINDOW`. GUI-сборка
  (`--windowed`) без этого флага открывает мигающее DOS-окно на каждый
  запуск/переподключение. RTL-SDR-путь исправлен в
  `server/rtlsdr_scope.py` (`_popen_window_flags`).
- **Альтернативные упаковки удалены**; не добавлять их без полноценного
  теста USB-COM/USB-audio, `_ftx`, `cty.dat` и SDR.

## Следующие шаги

1. Проверить `main`/CI/релизы (`gh run list`, `gh release view`).
2. Windows: установить свежий Setup, включить водопад RTL-SDR и убедиться,
   что DOS-окно `RTL_SDR` больше не мигает при старте, перестройке и
   переподключениях (несколько минут).
3. Если менялся код приложения — обновить Pi из `pi-latest` и проверить:
   CAT, звук, SDR, DX, FT8, автоподключение. Конфиг сохранять.
4. Подключить трансивер/SDR к Pi (сейчас на последней проверке их нет) и
   проверить только RX.
5. При появлении VPS — `docs/REMOTE-VPS.md`: WireGuard + Nginx + TLS.
6. Для точной статистики скачиваний — версионные релизы, а не перезапись
   `windows-latest`/`pi-latest`.
