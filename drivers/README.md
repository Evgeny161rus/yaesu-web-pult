# Драйверы для Windows

Эти файлы нужны для USB-интерфейсов трансиверов и внешних SDR. Установщик
`Yaesu-Web-Pult-Setup.exe` добавляет их в хранилище драйверов Windows
через `pnputil` (нужны права администратора).

## FTDI (`ftdi/`)

- `ftdibus.inf` / `ftdiport.inf` — драйверы FTDI CDM 2.12.36.20 (28.10.2024),
  включая FT4222 (USB-scope FT-710 / FTDX10 / FTDX101) и обычные FTDI
  последовательные порты.
- `amd64/` — файлы для 64-битной Windows, `i386/` — для 32-битной.
- Источник: пакет FTDI CDM, установленный в Windows DriverStore.
- Пользовательские DLL `ftd2xx.dll`, `FTD2XX64.dll`, `LibFT4222-64.dll`
  уже лежат в папке приложения `ftdi/` и не требуют установки драйвера.

## Silicon Labs CP210x (`cp210x/`)

- `silabser.inf` / `silabser.cat` — Silicon Labs CP210x Universal Windows
  Driver 11.0.0.509 (29.10.2021). Нужен для CAT-порта Yaesu FTX-1
  (CP2105 Dual UART) и других USB-UART переходников.
- `x64/`, `x86/`, `arm/`, `arm64/` — файлы драйвера для соответствующих
  архитектур.

## RTL-SDR

`rtl_sdr.exe`, `rtl_test.exe` и библиотеки ставятся вместе с приложением в
`tools/rtlsdr`. Для самого донгла RTL2832U на Windows нужен драйвер
**WinUSB**: если `rtl_test.exe` пишет «No supported devices found»,
запустите `rtlsdr\zadig-2.9.exe` от администратора (ярлык «RTL-SDR (Zadig)»
в меню «Пуск»), выберите RTL2832U (Interface 0) и нажмите *Install Driver*.
Это заменит DVB-T драйвер на WinUSB; для приёма SDR это и нужно.

## Установка вручную

```powershell
# из папки drivers, от администратора
powershell -ExecutionPolicy Bypass -File .\install-drivers.ps1
```

Скрипт пишет журнал в `install.log` рядом с собой.
