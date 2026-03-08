# SecureChat - Automated Installation Script for Windows PowerShell
# Compatible with Windows 10/11, PowerShell 5.1+

Write-Host "🔒 SecureChat - Automated Installation for Windows" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "⚠️  This script requires Administrator privileges for some installations." -ForegroundColor Yellow
    Write-Host "   Consider running PowerShell as Administrator for best results." -ForegroundColor Yellow
    Write-Host ""
}

# Function to check if command exists
function Test-CommandExists {
    param($command)
    $null = Get-Command $command -ErrorAction SilentlyContinue
    return $?
}

# Function to install Chocolatey
function Install-Chocolatey {
    Write-Host "📦 Installing Chocolatey package manager..." -ForegroundColor Green
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        Write-Host "✅ Chocolatey installed successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Failed to install Chocolatey: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to install Python
function Install-Python {
    Write-Host "🐍 Installing Python..." -ForegroundColor Green
    
    # Try Chocolatey first
    if (Test-CommandExists choco) {
        try {
            choco install python -y
            Write-Host "✅ Python installed via Chocolatey!" -ForegroundColor Green
            return $true
        }
        catch {
            Write-Host "⚠️  Chocolatey installation failed, trying direct download..." -ForegroundColor Yellow
        }
    }
    
    # Fallback to direct download
    try {
        Write-Host "📥 Downloading Python installer..." -ForegroundColor Blue
        $pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
        $pythonInstaller = "$env:TEMP\python_installer.exe"
        Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller
        
        Write-Host "🔧 Running Python installer..." -ForegroundColor Blue
        Start-Process -FilePath $pythonInstaller -ArgumentList "/quiet", "InstallAllUsers=1", "PrependPath=1", "Include_test=0" -Wait
        Remove-Item $pythonInstaller -Force
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Host "✅ Python installed successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Failed to install Python: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to install Node.js
function Install-NodeJS {
    Write-Host "📦 Installing Node.js..." -ForegroundColor Green
    
    # Try Chocolatey first
    if (Test-CommandExists choco) {
        try {
            choco install nodejs -y
            Write-Host "✅ Node.js installed via Chocolatey!" -ForegroundColor Green
            return $true
        }
        catch {
            Write-Host "⚠️  Chocolatey installation failed, trying direct download..." -ForegroundColor Yellow
        }
    }
    
    # Fallback to direct download
    try {
        Write-Host "📥 Downloading Node.js installer..." -ForegroundColor Blue
        $nodeUrl = "https://nodejs.org/dist/v20.15.1/node-v20.15.1-x64.msi"
        $nodeInstaller = "$env:TEMP\node_installer.msi"
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
        
        Write-Host "🔧 Running Node.js installer..." -ForegroundColor Blue
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $nodeInstaller, "/quiet" -Wait
        Remove-Item $nodeInstaller -Force
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Host "✅ Node.js installed successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Failed to install Node.js: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to install Git
function Install-Git {
    Write-Host "🔧 Installing Git..." -ForegroundColor Green
    
    # Try Chocolatey first
    if (Test-CommandExists choco) {
        try {
            choco install git -y
            Write-Host "✅ Git installed via Chocolatey!" -ForegroundColor Green
            return $true
        }
        catch {
            Write-Host "⚠️  Chocolatey installation failed, trying direct download..." -ForegroundColor Yellow
        }
    }
    
    # Fallback to direct download
    try {
        Write-Host "📥 Downloading Git installer..." -ForegroundColor Blue
        $gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.41.0.windows.3/Git-2.41.0.3-64-bit.exe"
        $gitInstaller = "$env:TEMP\git_installer.exe"
        Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller
        
        Write-Host "🔧 Running Git installer..." -ForegroundColor Blue
        Start-Process -FilePath $gitInstaller -ArgumentList "/VERYSILENT", "/NORESTART" -Wait
        Remove-Item $gitInstaller -Force
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Host "✅ Git installed successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Failed to install Git: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main installation process
Write-Host "🔍 Checking system requirements..." -ForegroundColor Blue

# Check and install Chocolatey if needed
if (-not (Test-CommandExists choco)) {
    if ($isAdmin) {
        Install-Chocolatey
    } else {
        Write-Host "⚠️  Chocolatey not found. Installing without package manager..." -ForegroundColor Yellow
    }
}

# Check and install Python
if (-not (Test-CommandExists python)) {
    Install-Python
} else {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python already installed: $pythonVersion" -ForegroundColor Green
}

# Check and install Node.js (for tunnel tools)
if (-not (Test-CommandExists node)) {
    Install-NodeJS
} else {
    $nodeVersion = node --version 2>&1
    Write-Host "✅ Node.js already installed: $nodeVersion" -ForegroundColor Green
}

# Check and install Git
if (-not (Test-CommandExists git)) {
    Install-Git
} else {
    $gitVersion = git --version 2>&1
    Write-Host "✅ Git already installed: $gitVersion" -ForegroundColor Green
}

# Install Python dependencies
Write-Host "📦 Installing Python dependencies..." -ForegroundColor Green
try {
    python -m pip install --upgrade pip
    python -m pip install flask flask-socketio flask-login flask-wtf wtforms werkzeug cryptography bcrypt qrcode pillow psutil requests
    Write-Host "✅ Python dependencies installed!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to install Python dependencies: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Try running: python -m pip install flask flask-socketio flask-login flask-wtf wtforms werkzeug cryptography bcrypt qrcode pillow psutil requests" -ForegroundColor Yellow
}

# Install Node.js global packages for tunneling
Write-Host "🌐 Installing tunneling tools..." -ForegroundColor Green
try {
    npm install -g localtunnel
    Write-Host "✅ LocalTunnel installed!" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  Failed to install LocalTunnel via npm" -ForegroundColor Yellow
}

# Install Cloudflare tunnel (cloudflared)
Write-Host "☁️  Installing Cloudflare tunnel..." -ForegroundColor Green
try {
    if (Test-CommandExists choco) {
        choco install cloudflared -y
        Write-Host "✅ Cloudflared installed!" -ForegroundColor Green
    } else {
        Write-Host "📥 Downloading cloudflared..." -ForegroundColor Blue
        $cloudflaredUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        $cloudflaredPath = "$env:USERPROFILE\AppData\Local\Microsoft\WindowsApps\cloudflared.exe"
        Invoke-WebRequest -Uri $cloudflaredUrl -OutFile $cloudflaredPath
        Write-Host "✅ Cloudflared downloaded to: $cloudflaredPath" -ForegroundColor Green
    }
}
catch {
    Write-Host "⚠️  Failed to install cloudflared" -ForegroundColor Yellow
}

# Create database
Write-Host "🗄️  Initializing database..." -ForegroundColor Green
try {
    if (Test-Path "schema.sql") {
        python -c "
import sqlite3
with open('schema.sql', 'r') as f:
    schema = f.read()
conn = sqlite3.connect('secure_chat.db')
conn.executescript(schema)
conn.close()
print('Database initialized successfully!')
"
        Write-Host "✅ Database initialized!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  schema.sql not found, database will be created on first run" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️  Database initialization skipped" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Installation completed!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 To start SecureChat, run:" -ForegroundColor Blue
Write-Host "   .\run.ps1" -ForegroundColor White
Write-Host ""
Write-Host "📖 Or manually run:" -ForegroundColor Blue
Write-Host "   python flask-secure-chat.py" -ForegroundColor White
Write-Host ""
Write-Host "🌐 The application will be available at:" -ForegroundColor Blue
Write-Host "   • Local: http://localhost:5001" -ForegroundColor White
Write-Host "   • Network: http://[your-ip]:5001" -ForegroundColor White
Write-Host "   • Public URLs will be generated automatically" -ForegroundColor White
Write-Host ""

# Pause to show results
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
