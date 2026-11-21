@echo off
echo ================================================
echo Yaesu Web Pult - Windows EXE Builder
echo ================================================
echo.

REM Установить PyInstaller если нужно
python -m pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo [1/3] Установка PyInstaller...
    python -m pip install pyinstaller
) else (
    echo [1/3] PyInstaller уже установлен
)

echo.
echo [2/3] Очистка старых сборок...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

echo.
echo [3/3] Сборка EXE файла...
set FTDIDATA=
if exist ftdi set FTDIDATA=--add-data "ftdi;ftdi"
python -m PyInstaller --noconfirm --clean --onefile --windowed --noupx --name Yaesu-Web-Pult ^
    --icon web\icon.ico ^
    --add-data "web;web" ^
    --add-data "server\menu_ftx1.json;." ^
    --add-data "cty.dat;." ^
    %FTDIDATA% ^
    --hidden-import pystray._win32 ^
    --hidden-import _ftx ^
    --hidden-import hamlib_backend ^
    --collect-all numpy ^
    --collect-all sounddevice ^
    --version-file version_info.txt ^
    --paths server server\main.py

echo.
if exist "dist\Yaesu-Web-Pult.exe" (
    echo ================================================
    echo SUCCESS! EXE файл создан:
    echo dist\Yaesu-Web-Pult.exe
    echo ================================================
    echo.
    echo Размер файла:
    dir "dist\Yaesu-Web-Pult.exe" | findstr "Yaesu-Web-Pult.exe"
) else (
    echo ================================================
    echo ОШИБКА: Не удалось создать EXE файл
    echo ================================================
)

echo.
pause
