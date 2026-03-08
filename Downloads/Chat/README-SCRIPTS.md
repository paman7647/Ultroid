# 🔒 SecureChat - Automated Installation & Running Scripts

Complete automation scripts for installing and running SecureChat on **Windows**, **macOS**, **Linux**, and **Termux (Android)**.

## 📋 Quick Start

### Windows (PowerShell)
```powershell
# Open PowerShell as Administrator (recommended)
cd path\to\flask-secure-chat
.\install.ps1    # Install everything
.\run.ps1        # Start SecureChat
```

### macOS/Linux
```bash
cd /path/to/flask-secure-chat
chmod +x *.sh   # Make scripts executable
./install.sh    # Install everything  
./run.sh        # Start SecureChat
```

### Termux (Android)
```bash
cd /path/to/flask-secure-chat
chmod +x *.sh   # Make scripts executable
./install-termux.sh  # Install for Termux
./run-termux.sh      # Start with Android optimizations
```

## 📁 Script Files Overview

| File | Platform | Purpose |
|------|----------|---------|
| `install.ps1` | Windows | PowerShell installation script |
| `run.ps1` | Windows | PowerShell runner script |
| `install.sh` | macOS/Linux | Universal installation script |
| `run.sh` | macOS/Linux | Universal runner script |
| `install-termux.sh` | Android | Termux-specific installation |
| `run-termux.sh` | Android | Created by install-termux.sh |
| `QUICKSTART.md` | All | Detailed usage guide |

## 🔧 What Gets Installed

### Core Dependencies
- **Python 3.11+** - Main application runtime
- **Node.js 20+** - For tunneling tools
- **Git** - Version control
- **Build tools** - For compiling Python packages

### Python Packages
- `flask`, `flask-socketio`, `flask-login`, `flask-wtf`
- `wtforms`, `werkzeug`, `cryptography`, `bcrypt`
- `qrcode`, `pillow`, `psutil`, `requests`

### Tunneling Tools
- **LocalTunnel** - npm package for public access
- **Cloudflared** - Cloudflare tunnel for SSL-secured access

### Platform-Specific Tools
- **Windows**: Chocolatey package manager (optional)
- **macOS**: Homebrew, Xcode command line tools
- **Linux**: Distribution-specific packages
- **Termux**: Android-optimized binaries, wake locks

## 🚀 Features After Installation

### Security Features
- 🔒 **End-to-End Encryption** (RSA-2048 + AES-256-GCM)
- 🛡️ **Advanced Rate Limiting** and DDoS protection
- 📊 **Security Audit Logging**
- 🔍 **File Security Scanning**
- 🔐 **Two-Factor Authentication** support

### Connectivity Features
- 🌐 **Automatic SSL-secured public access**
- 📱 **QR codes** for easy mobile access
- 🔄 **Multiple tunnel providers** (Cloudflare, LocalTunnel, Serveo)
- 🌍 **Cross-platform compatibility**

### UI/UX Features
- 🎨 **6 Beautiful Themes** (dark, light, neon, ocean, forest, sunset)
- 💬 **Real-time Chat** with typing indicators
- 🔔 **Message Notifications**
- 📱 **Mobile-responsive design**

### Management Features
- 🔄 **Auto-message deletion**
- 💾 **Backup management**
- 👥 **User management**
- 📈 **Usage statistics**

## 🌐 Access URLs After Starting

Once started, SecureChat provides multiple access methods:

### Local Access
- **Local**: http://localhost:5001
- **Network**: http://[your-ip]:5001

### Public SSL Access (Auto-generated)
- **Cloudflare**: https://[random-subdomain].trycloudflare.com
- **LocalTunnel**: https://[random-subdomain].loca.lt
- **Serveo**: https://[random-subdomain].serveo.net

### QR Codes
- Generated automatically in `qr_codes/` directory
- Scan with mobile device for instant access

## 🛠️ Manual Installation (if scripts fail)

### Install Python Dependencies
```bash
pip install flask flask-socketio flask-login flask-wtf wtforms werkzeug cryptography bcrypt qrcode pillow psutil requests
```

### Install Tunneling Tools
```bash
npm install -g localtunnel
```

### Download Cloudflared
- **Windows**: https://github.com/cloudflare/cloudflared/releases
- **macOS**: `brew install cloudflared`
- **Linux**: Download binary for your architecture
- **Termux**: Use ARM64 Linux binary

### Start Manually
```bash
python flask-secure-chat.py
```

## 🔧 Troubleshooting

### Common Issues

#### Permission Errors
- **Windows**: Run PowerShell as Administrator
- **macOS/Linux**: Use `sudo` for system-wide installations
- **Termux**: No special permissions needed

#### Python Not Found
```bash
# Check Python installation
python --version
python3 --version

# Add to PATH (varies by OS)
export PATH="/usr/local/bin:$PATH"
```

#### Network Access Issues
- Check firewall settings for port 5001
- Ensure your IP is accessible on the network
- Some corporate networks block tunneling

#### Package Installation Failures
```bash
# Try with user flag
pip install --user [package-name]

# Or upgrade pip first
python -m pip install --upgrade pip
```

### Platform-Specific Issues

#### Windows
- **Execution Policy**: `Set-ExecutionPolicy RemoteSigned`
- **Long Path Support**: Enable in Windows settings
- **Antivirus**: May block downloads/installations

#### macOS
- **Xcode Tools**: `xcode-select --install`
- **Homebrew**: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- **Gatekeeper**: May need to allow unsigned binaries

#### Linux
- **Package Manager**: Scripts auto-detect (apt, yum, dnf, pacman)
- **Dependencies**: Build-essential packages
- **Permissions**: May need sudo for system packages

#### Termux (Android)
- **Storage Access**: Run `termux-setup-storage`
- **Battery Optimization**: Disable for Termux in Android settings
- **Architecture**: ARM64/ARM binaries used
- **Wake Lock**: Prevents device sleep during operation

## 📱 Mobile Usage (Termux)

### Setup
1. Install Termux from F-Droid (recommended) or Google Play
2. Run `pkg update && pkg upgrade`
3. Clone or copy SecureChat files
4. Run `./install-termux.sh`

### Running
```bash
./run-termux.sh  # Starts with Android optimizations
```

### Android-Specific Features
- **Wake Lock**: Prevents device sleep
- **Storage Access**: Access to device storage
- **Network Sharing**: Use phone's hotspot for network access
- **Background Operation**: Keeps running when Termux is backgrounded

### Tips for Android
- Keep Termux app open or pinned
- Disable battery optimization for Termux
- Use a phone stand for extended operation
- Consider external power for long sessions

## 🔄 Updates and Maintenance

### Updating Dependencies
```bash
# Python packages
pip install --upgrade flask flask-socketio [other-packages]

# Node.js packages
npm update -g localtunnel

# System packages (varies by platform)
```

### Database Management
- Database auto-created on first run
- Backup created automatically
- Located at `secure_chat.db`

### Log Files
- Application logs in terminal output
- Security audit logs in application
- Error logs for debugging

## 📞 Support

### Getting Help
1. Check the terminal output for specific error messages
2. Review the troubleshooting section above
3. Ensure all dependencies are properly installed
4. Try manual installation if scripts fail

### Common Commands
```bash
# Check installations
python --version
node --version
git --version
pip list

# Test connectivity
curl -I http://localhost:5001

# View running processes
ps aux | grep python
```

## 🎯 Summary

These automated scripts provide a **one-click solution** for installing and running SecureChat across all major platforms. They handle:

- ✅ **Dependency detection and installation**
- ✅ **Platform-specific optimizations**
- ✅ **Automatic error handling and recovery**
- ✅ **Network configuration**
- ✅ **Security setup**
- ✅ **Public access configuration**

Simply run the appropriate install script for your platform, then use the run script to start your secure chat server with SSL-encrypted public access!
