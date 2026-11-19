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
python -m PyInstaller --clean ^
    --name "Yaesu-Web-Pult" ^
    --noconsole ^
    --onefile ^
    --icon web\icon.ico ^
    --add-data "web;web" ^
    --add-data "server;server" ^
    --hidden-import numpy ^
    --hidden-import numpy.core ^
    --hidden-import numpy.core.multiarray ^
    --collect-all sounddevice ^
    --version-file version_info.txt ^
    Yaesu-Web-Pult.pyw

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
