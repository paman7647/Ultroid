#!/data/data/com.termux/files/usr/bin/bash
# SecureChat - Termux (Android) Specific Installation Script
# Optimized for Termux environment with Android-specific considerations

echo "🔒 SecureChat - Termux (Android) Installation"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_step() {
    echo -e "${CYAN}🔧 $1${NC}"
}

# Check if running in Termux
if [ ! -f /etc/termux-version ]; then
    print_error "This script is designed for Termux (Android) only!"
    print_info "For other platforms, use install.sh"
    exit 1
fi

print_info "Detected Termux environment"
print_info "Termux version: $(cat /etc/termux-version)"
echo

# Update package repositories
print_step "Updating package repositories..."
pkg update -y && pkg upgrade -y

# Install essential packages
print_step "Installing essential packages..."
pkg install -y python nodejs git build-essential libffi openssl libjpeg-turbo zlib

# Verify installations
print_step "Verifying installations..."
if command -v python >/dev/null 2>&1; then
    PYTHON_VERSION=$(python --version)
    print_status "Python installed: $PYTHON_VERSION"
else
    print_error "Python installation failed"
    exit 1
fi

if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    print_status "Node.js installed: $NODE_VERSION"
else
    print_warning "Node.js not available"
fi

if command -v git >/dev/null 2>&1; then
    GIT_VERSION=$(git --version)
    print_status "Git installed: $GIT_VERSION"
else
    print_warning "Git not available"
fi

# Install Python dependencies
print_step "Installing Python dependencies..."
pip install --upgrade pip
pip install flask flask-socketio flask-login flask-wtf wtforms werkzeug cryptography bcrypt qrcode pillow psutil requests

if [ $? -eq 0 ]; then
    print_status "Python dependencies installed!"
else
    print_error "Failed to install some Python dependencies"
    print_warning "This might be due to architecture compatibility issues on Android"
fi

# Install Node.js packages (if Node.js is available)
if command -v npm >/dev/null 2>&1; then
    print_step "Installing Node.js packages..."
    npm install -g localtunnel
    if [ $? -eq 0 ]; then
        print_status "LocalTunnel installed!"
    else
        print_warning "Failed to install LocalTunnel"
    fi
fi

# Install cloudflared for Android
print_step "Installing Cloudflare tunnel (cloudflared)..."
ARCH=$(uname -m)
case $ARCH in
    "aarch64"|"arm64")
        CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
        ;;
    "armv7l"|"arm")
        CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
        ;;
    *)
        print_warning "Unsupported architecture: $ARCH. Trying ARM64..."
        CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
        ;;
esac

curl -L $CLOUDFLARED_URL -o $PREFIX/bin/cloudflared
chmod +x $PREFIX/bin/cloudflared

if command -v cloudflared >/dev/null 2>&1; then
    print_status "Cloudflared installed!"
else
    print_warning "Cloudflared installation may have failed"
fi

# Create storage directory (Termux specific)
print_step "Setting up Termux storage access..."
if [ ! -d ~/storage ]; then
    termux-setup-storage
    print_info "Storage access configured. You may need to grant permissions."
else
    print_status "Storage access already configured"
fi

# Initialize database
print_step "Initializing database..."
if [ -f "schema.sql" ]; then
    python -c "
import sqlite3
with open('schema.sql', 'r') as f:
    schema = f.read()
conn = sqlite3.connect('secure_chat.db')
conn.executescript(schema)
conn.close()
print('Database initialized successfully!')
" 2>/dev/null && print_status "Database initialized!" || print_warning "Database initialization skipped"
else
    print_warning "schema.sql not found, database will be created on first run"
fi

# Make run scripts executable
chmod +x run.sh 2>/dev/null
chmod +x run-termux.sh 2>/dev/null

# Termux-specific optimizations
print_step "Applying Termux optimizations..."

# Create a Termux-optimized run script
cat > run-termux.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# SecureChat - Termux Runner with Android optimizations

echo "🔒 SecureChat - Starting on Termux (Android)"
echo "============================================="

# Prevent Termux from sleeping
termux-wake-lock

# Set environment variables
export FLASK_ENV=development
export FLASK_DEBUG=1

# Check for dependencies
if ! python -c "import flask" 2>/dev/null; then
    echo "❌ Flask not found. Please run install-termux.sh first."
    exit 1
fi

# Get local IP
LOCAL_IP=$(ifconfig 2>/dev/null | grep -Eo 'inet ([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)

echo "📱 Termux-Optimized SecureChat"
echo "• Access via: http://localhost:5001"
if [ ! -z "$LOCAL_IP" ]; then
    echo "• Network: http://$LOCAL_IP:5001"
fi
echo "• Public URLs will be generated automatically"
echo ""
echo "💡 To stop: Ctrl+C or close Termux"
echo "🔋 Wake lock enabled to prevent sleeping"
echo ""

# Start the application
python flask-secure-chat.py

# Release wake lock on exit
termux-wake-unlock
EOF

chmod +x run-termux.sh

print_status "Termux optimizations applied!"

echo
print_status "🎉 Termux installation completed!"
echo "============================================="
echo

print_info "📱 Termux-Specific Features:"
echo "   • Wake lock prevents device sleep during operation"
echo "   • Storage access configured for file operations"
echo "   • ARM-optimized binary installations"
echo

print_info "🚀 To start SecureChat on Termux:"
echo "   ./run-termux.sh    (Termux-optimized)"
echo "   ./run.sh           (Standard)"
echo

print_info "🌐 Access URLs:"
echo "   • Local: http://localhost:5001"
echo "   • Network: Connect other devices to your phone's hotspot"
echo "   • Public: SSL URLs generated automatically"
echo

print_info "💡 Termux Tips:"
echo "   • Keep Termux open to maintain server"
echo "   • Use 'termux-wake-lock' to prevent sleep"
echo "   • Share your phone's hotspot for network access"
echo "   • Install Termux:Widget for home screen shortcuts"
echo

print_warning "🔋 Battery Optimization:"
echo "   • Disable battery optimization for Termux in Android settings"
echo "   • Enable 'Allow background activity' for Termux"
echo "   • Consider keeping device plugged in for extended use"
echo
