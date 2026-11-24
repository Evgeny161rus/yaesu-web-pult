# Yaesu Web Pult — быстрый старт

Веб-пульт для трансиверов Yaesu: управление из браузера с ПК, ноутбука,
планшета или телефона. **FTX-1** — нативная поддержка, другие модели —
через **Hamlib/CAT**.

Основное:

- CAT, приём и передача звука, S-метр и регуляторы трансивера;
- водопад: звук, USB-scope FT4222 или внешний RTL-SDR;
- FT8/FT4, CW-декодер, RTTY, PSK31, SSTV, NAVTEX, WEFAX;
- DX-споты с фильтрами и перестройкой приёмника по споту (без TX);
- темы, отдельные компоновки, установка на Android как приложение;
- Raspberry Pi headless и удалённый доступ через VPS/WireGuard.

## Windows 10/11 (x64)

1. Скачайте **`Yaesu-Web-Pult-Setup.exe`**:
   https://github.com/Evgeny161rus/yaesu-web-pult/releases/tag/windows-latest
2. Запустите установщик и подтвердите UAC. SmartScreen может предупредить —
   «Подробнее» → «Выполнить» (сборка без коммерческой подписи).
3. Установщик ставит программу в `C:\Program Files\Yaesu Web Pult`, добавляет
   Hamlib, RTL-SDR, драйверы FTDI/CP210x и ярлыки. Настройки, сертификаты и
   записи хранятся в `%LOCALAPPDATA%\Yaesu Web Pult`; программа запускается
   без прав администратора.
4. Подключите трансивер USB-кабелем и запустите ярлык. В панели выберите
   трансивер (FTX-1 — `native`, другой — `hamlib`), COM-порт, скорость CAT
   и звуковые устройства. Нажмите «Запустить», затем «Открыть пульт».

Портативные варианты из того же релиза:

- `Yaesu-Web-Pult-folder.zip` — папка, Hamlib и RTL-SDR уже внутри;
- `Yaesu-Web-Pult.exe` — один файл; Hamlib/RTL-SDR ставятся скриптами
  `install-hamlib.ps1` / `install-rtlsdr.ps1` (есть в релизе).

У портативной версии данные лежат рядом с EXE.

## Raspberry Pi (headless)

Готовый архив:
https://github.com/Evgeny161rus/yaesu-web-pult/releases/tag/pi-latest

```bash
tar -xzf yaesu-web-pult-pi.tar.gz
cd yaesu-web-pult
sudo bash deploy/install-rpi.sh
```

Установщик поставит зависимости, соберёт FT8-модуль, настроит USB-права и
откроет интерактивное меню (whiptail): трансивер/CAT, Hamlib, звук приёма и
передачи, PTT, водопад/SDR и пароль панели. Затем включит
`yaesu-web-pult.service`.

Пульт: `https://<IP-Pi>:8443/`. Настройки — в
`/opt/yaesu-web-pult/config.json`.

## Другие трансиверы

В установщике Windows Hamlib уже есть. В панели выберите
«Любой трансивер — Hamlib/CAT», производителя и модель, CAT-порт и скорость.
Если драйвер не умеет PTT, выберите линию RTS/DTR отдельного порта — CAT при
этом продолжит работать. Для Icom обычно нужен `-C civaddr=0x94` в
«Дополнительных параметрах Hamlib».

На Raspberry Pi Hamlib ставится пакетом `libhamlib-utils`.

## Документация и релизы

- [README.md](README.md) — полное описание возможностей и настройки
- [README_EN.md](README_EN.md) — English overview
- [docs/RADIO-SUPPORT.md](docs/RADIO-SUPPORT.md) — трансиверы, CAT/PTT/звук
- [docs/REMOTE-VPS.md](docs/REMOTE-VPS.md) — удалённый доступ через VPS
- [CHANGELOG.md](CHANGELOG.md) — изменения

Релизы: [windows-latest](https://github.com/Evgeny161rus/yaesu-web-pult/releases/tag/windows-latest)
и [pi-latest](https://github.com/Evgeny161rus/yaesu-web-pult/releases/tag/pi-latest).
Старый тег `latest` оставлен только для совместимости со старыми ссылками.

Проект открытый; условия — [LICENSE](LICENSE).
