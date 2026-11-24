RTL-SDR: Zadig 2.9 (WinUSB driver installer)

Файл: zadig-2.9.exe
SHA256: 4ECAA95DF3DA3621486A043AEF8B3050B8BAFE7C901402871E816229EF82039B
Источник: https://github.com/pbatard/libwdi/releases/tag/v1.5.1

Если rtl_test.exe / rtl_sdr.exe пишет "No supported devices found":
1. Подключите RTL-SDR донгл.
2. Запустите zadig-2.9.exe от имени администратора.
3. Options -> List All Devices.
4. Выберите RTL2832U (Interface 0).
5. Driver: WinUSB, нажмите Install Driver / Replace Driver.
6. Перезапустите Yaesu Web Pult.

Это заменит DVB-T драйвер на WinUSB. Для приёма SDR это нормально;
для просмотра DVB-T донгл после этого не подойдёт.
