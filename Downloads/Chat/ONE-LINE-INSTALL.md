# 🚀 SecureChat - One-Line Installation Commands

## Windows (PowerShell)
```powershell
# One-line install and run
irm https://raw.githubusercontent.com/yourusername/securechat/main/install.ps1 | iex; .\run.ps1

# Or step by step:
# Download and run installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/yourusername/securechat/main/install.ps1" -OutFile "install.ps1"; .\install.ps1

# Start SecureChat
.\run.ps1
```

## macOS/Linux
```bash
# One-line install and run
curl -fsSL https://raw.githubusercontent.com/yourusername/securechat/main/install.sh | bash && ./run.sh

# Or step by step:
# Download and run installer
curl -O https://raw.githubusercontent.com/yourusername/securechat/main/install.sh
chmod +x install.sh
./install.sh

# Start SecureChat
./run.sh
```

## Termux (Android)
```bash
# One-line install and run
curl -fsSL https://raw.githubusercontent.com/yourusername/securechat/main/install-termux.sh | bash && ./run-termux.sh

# Or step by step:
# Download and run installer
curl -O https://raw.githubusercontent.com/yourusername/securechat/main/install-termux.sh
chmod +x install-termux.sh
./install-termux.sh

# Start SecureChat
./run-termux.sh
```

## Local Installation (if you have the files)

### Windows
```powershell
.\install.ps1 && .\run.ps1
```

### macOS/Linux/Termux
```bash
chmod +x *.sh && ./install.sh && ./run.sh
```

## What happens after running:
1. ✅ All dependencies installed automatically
2. ✅ Database initialized
3. ✅ SecureChat starts with SSL tunnels
4. ✅ Public HTTPS URLs generated
5. ✅ QR codes created for mobile access
6. ✅ Ready to chat securely!

## Access your chat at:
- **Local**: http://localhost:5001
- **Network**: http://[your-ip]:5001  
- **Public**: https://[auto-generated].trycloudflare.com
- **Mobile**: Scan QR code from `qr_codes/` folder
