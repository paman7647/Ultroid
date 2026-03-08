# SecureChat - Automated Runner Script for Windows PowerShell
# This script automatically starts the SecureChat application

Write-Host "🔒 SecureChat - Starting Application" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Function to check if command exists
function Test-CommandExists {
    param($command)
    $null = Get-Command $command -ErrorAction SilentlyContinue
    return $?
}

# Check if Python is installed
if (-not (Test-CommandExists python)) {
    Write-Host "❌ Python not found! Please run install.ps1 first." -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 To install dependencies, run:" -ForegroundColor Yellow
    Write-Host "   .\install.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if main application file exists
if (-not (Test-Path "flask-secure-chat.py")) {
    Write-Host "❌ flask-secure-chat.py not found!" -ForegroundColor Red
    Write-Host "   Make sure you're in the correct directory." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Display system information
Write-Host "🖥️  System Information:" -ForegroundColor Blue
Write-Host "   OS: Windows $(([Environment]::OSVersion.Version).Major).$(([Environment]::OSVersion.Version).Minor)" -ForegroundColor White
$pythonVersion = python --version 2>&1
Write-Host "   Python: $pythonVersion" -ForegroundColor White
if (Test-CommandExists node) {
    $nodeVersion = node --version 2>&1
    Write-Host "   Node.js: $nodeVersion" -ForegroundColor White
}
Write-Host ""

# Check dependencies
Write-Host "🔍 Checking Python dependencies..." -ForegroundColor Blue
$dependencies = @("flask", "flask_socketio", "flask_login", "flask_wtf", "wtforms", "werkzeug", "cryptography", "bcrypt", "qrcode", "psutil", "requests")
$missingDeps = @()

foreach ($dep in $dependencies) {
    try {
        python -c "import $dep" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $dep" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $dep (missing)" -ForegroundColor Red
            $missingDeps += $dep
        }
    }
    catch {
        Write-Host "   ❌ $dep (missing)" -ForegroundColor Red
        $missingDeps += $dep
    }
}

if ($missingDeps.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Missing dependencies detected. Installing..." -ForegroundColor Yellow
    try {
        python -m pip install $($missingDeps -join " ")
        Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to install dependencies. Please run:" -ForegroundColor Red
        Write-Host "   python -m pip install $($missingDeps -join ' ')" -ForegroundColor White
        Write-Host ""
        Write-Host "Press any key to exit..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

Write-Host ""
Write-Host "🚀 Starting SecureChat..." -ForegroundColor Green
Write-Host ""

# Set environment variables for development
$env:FLASK_ENV = "development"
$env:FLASK_DEBUG = "1"

# Display startup information
Write-Host "📋 Application Details:" -ForegroundColor Blue
Write-Host "   • Environment: Development" -ForegroundColor White
Write-Host "   • Debug Mode: Enabled" -ForegroundColor White
Write-Host "   • Auto-reload: Enabled" -ForegroundColor White
Write-Host "   • Port: 5001" -ForegroundColor White
Write-Host ""

Write-Host "🌐 Access URLs (will be available after startup):" -ForegroundColor Blue
Write-Host "   • Local: http://localhost:5001" -ForegroundColor White
Write-Host "   • Network: http://$(([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object {$_.AddressFamily -eq 'InterNetwork'})[0]):5001" -ForegroundColor White
Write-Host "   • Public SSL URLs: Generated automatically" -ForegroundColor White
Write-Host ""

Write-Host "🔧 Control Commands:" -ForegroundColor Blue
Write-Host "   • Stop server: Ctrl + C" -ForegroundColor White
Write-Host "   • View logs: Check terminal output" -ForegroundColor White
Write-Host ""

Write-Host "🎯 Starting application in 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Start the application
try {
    Write-Host "▶️  Launching SecureChat..." -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Run the Flask application
    python flask-secure-chat.py
}
catch {
    Write-Host ""
    Write-Host "❌ Application stopped or encountered an error." -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Yellow
}
finally {
    Write-Host ""
    Write-Host "🔄 SecureChat application has stopped." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 To restart, run: .\run.ps1" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
