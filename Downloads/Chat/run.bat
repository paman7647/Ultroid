@echo off
:: SecureChat - Windows Batch Runner Script
:: Simple double-click launcher for Windows users

title SecureChat - Secure Chat Application

echo.
echo 🔒 SecureChat - Starting Application
echo ====================================
echo.

:: Check if application file exists
if not exist flask-secure-chat.py (
    echo ❌ flask-secure-chat.py not found!
    echo    Make sure you're in the correct directory.
    echo.
    pause
    exit /b 1
)

:: Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found!
    echo    Please install Python or run install.bat first.
    echo.
    pause
    exit /b 1
)

:: Display system information
echo 🖥️  System Information:
echo    OS: Windows %OS%
python --version 2>&1 | findstr /C:"Python"

:: Check for Node.js
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f %%i in ('node --version') do echo    Node.js: %%i
)

echo.

:: Set environment variables
set FLASK_ENV=development
set FLASK_DEBUG=1

:: Display access information
echo 📋 Application Details:
echo    • Environment: Development
echo    • Debug Mode: Enabled
echo    • Port: 5001
echo.

echo 🌐 Access URLs (available after startup):
echo    • Local: http://localhost:5001
echo    • Network: http://[your-ip]:5001
echo    • Public: Auto-generated HTTPS URLs
echo.

echo 🔧 Control Commands:
echo    • Stop server: Ctrl + C
echo    • Close window to stop
echo.

echo 🎯 Starting application in 3 seconds...
timeout /t 3 >nul

echo ▶️  Launching SecureChat...
echo ================================
echo.

:: Start the application
python flask-secure-chat.py

:: Show completion message
echo.
echo 🔄 SecureChat application has stopped.
echo.
echo 💡 To restart:
echo    • Double-click run.bat again
echo    • Or run: python flask-secure-chat.py
echo.
pause
