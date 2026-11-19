@echo off
cls
echo ========================================
echo   Yaesu Web Pult - Quick Test
echo ========================================
echo.

echo [1/3] Testing Python modules...
python -c "import server.constants as c; print(f'OK: {c.APP_NAME} v{c.VERSION}')" || goto :error

echo.
echo [2/3] Checking files...
if not exist "web\index.html" echo ERROR: web\index.html not found && goto :error
if not exist "server\main.py" echo ERROR: server\main.py not found && goto :error
echo OK: All files present

echo.
echo [3/3] Running unit tests...
python -m pytest tests/ -q --tb=no || goto :error

echo.
echo ========================================
echo   All checks PASSED!
echo ========================================
echo.
echo Ready to build EXE:
echo   build-exe.bat
echo.
pause
exit /b 0

:error
echo.
echo ========================================
echo   ERROR: Tests FAILED
echo ========================================
pause
exit /b 1
