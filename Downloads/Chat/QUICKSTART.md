# SecureChat - Quick Start Guide
# Automated installation and running scripts for all platforms

## Windows (PowerShell)

### Installation
```powershell
# Run PowerShell as Administrator (recommended)
# Navigate to the SecureChat directory
cd path\to\flask-secure-chat

# Run the installation script
.\install.ps1
```

### Running
```powershell
# Start the application
.\run.ps1
```

## macOS/Linux/Termux (Bash)

### Installation
```bash
# Navigate to the SecureChat directory
cd /path/to/flask-secure-chat

# Make scripts executable
chmod +x install.sh run.sh

# Run the installation script
./install.sh
```

### Running
```bash
# Start the application
./run.sh
```

## What the scripts do:

### Installation Scripts (`install.ps1` / `install.sh`)
1. **Detect Operating System**: Automatically detects Windows, macOS, Linux distributions, or Termux
2. **Install Python**: Downloads and installs Python 3.11+ if not present
3. **Install Node.js**: Installs Node.js for tunneling tools
4. **Install Git**: Installs Git for version control
5. **Install System Dependencies**: Installs build tools and libraries needed for Python packages
6. **Install Python Packages**: Installs all required Python dependencies:
   - flask, flask-socketio, flask-login, flask-wtf
   - wtforms, werkzeug, cryptography, bcrypt
   - qrcode, pillow, psutil, requests
7. **Install Tunneling Tools**: 
   - LocalTunnel (npm package)
   - Cloudflared (Cloudflare tunnel)
8. **Initialize Database**: Creates the SQLite database from schema.sql

### Running Scripts (`run.ps1` / `run.sh`)
1. **System Checks**: Verifies Python installation and application files
2. **Dependency Verification**: Checks all Python packages are installed
3. **Auto-repair**: Installs missing dependencies automatically
4. **Network Detection**: Finds local IP address for network access
5. **Environment Setup**: Sets Flask development environment variables
6. **Application Launch**: Starts the SecureChat application
7. **URL Display**: Shows all access URLs (local, network, public SSL)

## Platform-Specific Features:

### Windows PowerShell
- Uses Chocolatey package manager when available
- Falls back to direct downloads for Python, Node.js, Git
- Administrator privilege detection
- Automatic PATH refresh

### macOS
- Uses Homebrew package manager
- Automatic Xcode command line tools installation
- Native package installations

### Linux (Ubuntu/Debian/CentOS/Fedora/Arch)
- Auto-detects package manager (apt, yum, dnf, pacman, zypper)
- Installs appropriate development packages
- Creates python symlinks for compatibility

### Termux (Android)
- Uses pkg package manager
- ARM64/ARM architecture support
- Optimized for Android environment

## Manual Installation (if scripts fail):

### Python Dependencies
```bash
pip install flask flask-socketio flask-login flask-wtf wtforms werkzeug cryptography bcrypt qrcode pillow psutil requests
```

### Node.js Dependencies
```bash
npm install -g localtunnel
```

### Cloudflared
- Windows: Download from https://github.com/cloudflare/cloudflared/releases
- macOS: `brew install cloudflared`
- Linux: Download appropriate binary for your architecture
- Termux: Use the Linux ARM64 binary

## Troubleshooting:

### Common Issues
1. **Permission Denied**: Run PowerShell as Administrator on Windows
2. **Python Not Found**: Ensure Python is in your PATH
3. **Pip Install Fails**: Try `python -m pip install` instead of `pip install`
4. **Network Issues**: Check firewall settings for port 5001
5. **Tunneling Fails**: Some corporate networks block tunneling services

### Manual Start
If the run scripts fail, you can always start manually:
```bash
python flask-secure-chat.py
```

## Features After Installation:
- 🔒 End-to-End Encryption (RSA-2048 + AES-256-GCM)
- 🌐 Automatic SSL-secured public access via Cloudflare/LocalTunnel
- 🎨 6 beautiful UI themes (dark, light, neon, ocean, forest, sunset)
- 🛡️ Advanced security features (rate limiting, audit logging, file scanning)
- 📱 QR codes for easy mobile access
- 🔄 Auto-message deletion and backup management
- 💬 Real-time chat with typing indicators
- 👥 User management and authentication

Access your chat at:
- Local: http://localhost:5001
- Network: http://[your-ip]:5001
- Public: Automatically generated HTTPS URLs
