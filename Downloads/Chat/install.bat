@echo off
:: SecureChat - Windows Batch Installation Script
:: Alternative to PowerShell for users who prefer batch files

echo.
echo 🔒 SecureChat - Windows Batch Installer
echo =========================================
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  This script works better with Administrator privileges.
    echo    Consider running as Administrator for optimal results.
    echo.
    timeout /t 3 >nul
)

:: Check for PowerShell and prefer it if available
where powershell >nul 2>&1
if %errorlevel% equ 0 (
    echo 💡 PowerShell detected. Using PowerShell installer for better experience...
    echo.
    timeout /t 2 >nul
    powershell -ExecutionPolicy Bypass -File install.ps1
    if exist run.ps1 (
        echo.
        echo 🚀 To start SecureChat, run: run.ps1
        echo    Or double-click run.bat
        echo.
    )
    pause
    exit /b
)

:: Fallback to batch installation
echo 📦 Using batch installer (PowerShell not available)...
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found!
    echo.
    echo 💡 Please install Python manually:
    echo    1. Go to https://www.python.org/downloads/
    echo    2. Download Python 3.11 or later
    echo    3. Run installer and check "Add to PATH"
    echo    4. Restart this script
    echo.
    pause
    exit /b 1
)

echo ✅ Python found
python --version

:: Check if pip is available
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ pip not found!
    echo 💡 Installing pip...
    python -m ensurepip --upgrade
)

:: Install Python dependencies
echo.
echo 📦 Installing Python dependencies...
pip install flask flask-socketio flask-login flask-wtf wtforms werkzeug cryptography bcrypt qrcode pillow psutil requests

if %errorlevel% neq 0 (
    echo ❌ Failed to install some dependencies
    echo 💡 Try running: pip install --user [package-names]
    echo.
    pause
    exit /b 1
)

echo ✅ Python dependencies installed!

:: Check for Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Node.js not found. Tunneling features may be limited.
    echo 💡 To install Node.js: https://nodejs.org/
) else (
    echo ✅ Node.js found
    node --version
    
    :: Install LocalTunnel
    echo 📦 Installing LocalTunnel...
    npm install -g localtunnel
    if %errorlevel% equ 0 (
        echo ✅ LocalTunnel installed!
    )
)

:: Initialize database if schema exists
if exist schema.sql (
    echo.
    echo 🗄️  Initializing database...
    python -c "import sqlite3; conn = sqlite3.connect('secure_chat.db'); conn.executescript(open('schema.sql').read()); conn.close(); print('Database initialized!')"
    if %errorlevel% equ 0 (
        echo ✅ Database initialized!
    )
)

:: Create run.bat file
echo.
echo 📝 Creating run.bat launcher...
(
echo @echo off
echo echo 🔒 SecureChat - Starting Application
echo echo ====================================
echo echo.
echo if not exist flask-secure-chat.py ^(
echo     echo ❌ flask-secure-chat.py not found!
echo     echo    Make sure you're in the correct directory.
echo     pause
echo     exit /b 1
echo ^)
echo echo 🚀 Starting SecureChat...
echo echo.
echo set FLASK_ENV=development
echo set FLASK_DEBUG=1
echo python flask-secure-chat.py
echo echo.
echo echo 🔄 SecureChat has stopped.
echo pause
) > run.bat

echo ✅ Created run.bat launcher!

echo.
echo 🎉 Installation completed!
echo =========================================
echo.
echo 🚀 To start SecureChat:
echo    • Double-click run.bat
echo    • Or run: python flask-secure-chat.py
echo.
echo 🌐 Access URLs will be:
echo    • Local: http://localhost:5001
echo    • Network: http://[your-ip]:5001
echo    • Public: Auto-generated HTTPS URLs
echo.
pause
