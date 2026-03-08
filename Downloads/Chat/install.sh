#!/bin/bash
# SecureChat - Automated Installation Script for macOS/Linux/Termux
# Compatible with macOS, Ubuntu, Debian, CentOS, Fedora, Arch Linux, Termux

echo "🔒 SecureChat - Automated Installation"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        DISTRO="macOS"
    elif [[ -f /etc/termux-version ]]; then
        OS="termux"
        DISTRO="Termux"
    elif [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS="linux"
        DISTRO=$NAME
    else
        OS="unknown"
        DISTRO="Unknown"
    fi
    
    print_info "Detected OS: $DISTRO"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install packages based on OS
install_package() {
    local package=$1
    local package_manager=""
    
    case $OS in
        "macos")
            if command_exists brew; then
                print_step "Installing $package via Homebrew..."
                brew install $package
            else
                print_warning "Homebrew not found. Installing Homebrew first..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                print_step "Installing $package via Homebrew..."
                brew install $package
            fi
            ;;
        "termux")
            print_step "Installing $package via pkg..."
            pkg install -y $package
            ;;
        "linux")
            if command_exists apt-get; then
                print_step "Installing $package via apt..."
                sudo apt-get update && sudo apt-get install -y $package
            elif command_exists yum; then
                print_step "Installing $package via yum..."
                sudo yum install -y $package
            elif command_exists dnf; then
                print_step "Installing $package via dnf..."
                sudo dnf install -y $package
            elif command_exists pacman; then
                print_step "Installing $package via pacman..."
                sudo pacman -S --noconfirm $package
            elif command_exists zypper; then
                print_step "Installing $package via zypper..."
                sudo zypper install -y $package
            else
                print_error "No supported package manager found"
                return 1
            fi
            ;;
    esac
}

# Function to install Python
install_python() {
    print_step "Installing Python..."
    
    case $OS in
        "macos")
            if ! command_exists python3; then
                install_package python3
            fi
            # Create python symlink if needed
            if ! command_exists python && command_exists python3; then
                echo "Creating python symlink..."
                sudo ln -sf $(which python3) /usr/local/bin/python || true
            fi
            ;;
        "termux")
            install_package python
            ;;
        "linux")
            if command_exists apt-get; then
                install_package python3
                install_package python3-pip
                install_package python3-venv
                # Create python symlink if needed
                if ! command_exists python && command_exists python3; then
                    sudo ln -sf $(which python3) /usr/bin/python || true
                fi
            elif command_exists yum || command_exists dnf; then
                install_package python3
                install_package python3-pip
            elif command_exists pacman; then
                install_package python
                install_package python-pip
            else
                install_package python3
            fi
            ;;
    esac
}

# Function to install Node.js
install_nodejs() {
    print_step "Installing Node.js..."
    
    case $OS in
        "macos")
            install_package node
            ;;
        "termux")
            install_package nodejs
            ;;
        "linux")
            if command_exists apt-get; then
                # Install Node.js via NodeSource repository for latest version
                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null || true
                install_package nodejs
            elif command_exists yum; then
                # Install Node.js via NodeSource repository
                curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - 2>/dev/null || true
                install_package nodejs
            elif command_exists dnf; then
                install_package nodejs
                install_package npm
            elif command_exists pacman; then
                install_package nodejs
                install_package npm
            else
                install_package nodejs
            fi
            ;;
    esac
}

# Function to install Git
install_git() {
    print_step "Installing Git..."
    install_package git
}

# Function to install system dependencies
install_system_deps() {
    print_step "Installing system dependencies..."
    
    case $OS in
        "macos")
            # Install build tools if needed
            if ! command_exists gcc; then
                print_step "Installing Xcode command line tools..."
                xcode-select --install 2>/dev/null || true
            fi
            ;;
        "termux")
            pkg install -y build-essential libffi-dev openssl-dev
            ;;
        "linux")
            if command_exists apt-get; then
                sudo apt-get install -y build-essential libffi-dev libssl-dev libjpeg-dev zlib1g-dev
            elif command_exists yum; then
                sudo yum groupinstall -y "Development Tools"
                sudo yum install -y libffi-devel openssl-devel libjpeg-devel zlib-devel
            elif command_exists dnf; then
                sudo dnf groupinstall -y "Development Tools"
                sudo dnf install -y libffi-devel openssl-devel libjpeg-devel zlib-devel
            elif command_exists pacman; then
                sudo pacman -S --noconfirm base-devel libffi openssl libjpeg-turbo zlib
            fi
            ;;
    esac
}

# Function to install cloudflared
install_cloudflared() {
    print_step "Installing Cloudflare tunnel (cloudflared)..."
    
    case $OS in
        "macos")
            if command_exists brew; then
                brew install cloudflared
            else
                # Download directly
                curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz -o /tmp/cloudflared.tgz
                tar -xzf /tmp/cloudflared.tgz -C /tmp/
                sudo mv /tmp/cloudflared /usr/local/bin/
                sudo chmod +x /usr/local/bin/cloudflared
            fi
            ;;
        "termux")
            # Download appropriate binary for Android
            curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o $PREFIX/bin/cloudflared
            chmod +x $PREFIX/bin/cloudflared
            ;;
        "linux")
            # Detect architecture
            ARCH=$(uname -m)
            case $ARCH in
                "x86_64") ARCH="amd64" ;;
                "aarch64"|"arm64") ARCH="arm64" ;;
                "armv7l") ARCH="arm" ;;
            esac
            
            curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH -o /tmp/cloudflared
            sudo mv /tmp/cloudflared /usr/local/bin/
            sudo chmod +x /usr/local/bin/cloudflared
            ;;
    esac
}

# Main installation process
main() {
    detect_os
    
    print_info "Starting installation for $DISTRO..."
    echo
    
    # Install system dependencies first
    print_step "Installing system dependencies..."
    install_system_deps
    
    # Check and install Python
    if ! command_exists python && ! command_exists python3; then
        install_python
    else
        PYTHON_VERSION=$(python --version 2>/dev/null || python3 --version 2>/dev/null)
        print_status "Python already installed: $PYTHON_VERSION"
    fi
    
    # Ensure pip is available
    if ! command_exists pip && ! command_exists pip3; then
        print_step "Installing pip..."
        if command_exists python3; then
            python3 -m ensurepip --upgrade 2>/dev/null || true
        elif command_exists python; then
            python -m ensurepip --upgrade 2>/dev/null || true
        fi
    fi
    
    # Check and install Node.js
    if ! command_exists node; then
        install_nodejs
    else
        NODE_VERSION=$(node --version)
        print_status "Node.js already installed: $NODE_VERSION"
    fi
    
    # Check and install Git
    if ! command_exists git; then
        install_git
    else
        GIT_VERSION=$(git --version)
        print_status "Git already installed: $GIT_VERSION"
    fi
    
    # Install Python dependencies
    print_step "Installing Python dependencies..."
    PYTHON_CMD="python"
    PIP_CMD="pip"
    
    # Use python3/pip3 if python/pip not available
    if ! command_exists python && command_exists python3; then
        PYTHON_CMD="python3"
    fi
    if ! command_exists pip && command_exists pip3; then
        PIP_CMD="pip3"
    fi
    
    $PIP_CMD install --upgrade pip
    $PIP_CMD install flask flask-socketio flask-login flask-wtf wtforms werkzeug cryptography bcrypt qrcode pillow psutil requests
    
    if [ $? -eq 0 ]; then
        print_status "Python dependencies installed!"
    else
        print_error "Failed to install Python dependencies"
        print_warning "Try running manually: $PIP_CMD install flask flask-socketio flask-login flask-wtf wtforms werkzeug cryptography bcrypt qrcode pillow psutil requests"
    fi
    
    # Install Node.js global packages
    print_step "Installing tunneling tools..."
    if command_exists npm; then
        npm install -g localtunnel 2>/dev/null && print_status "LocalTunnel installed!" || print_warning "Failed to install LocalTunnel"
    fi
    
    # Install cloudflared
    install_cloudflared
    if command_exists cloudflared; then
        print_status "Cloudflared installed!"
    else
        print_warning "Failed to install cloudflared"
    fi
    
    # Initialize database
    print_step "Initializing database..."
    if [ -f "schema.sql" ]; then
        $PYTHON_CMD -c "
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
    
    # Make run script executable
    if [ -f "run.sh" ]; then
        chmod +x run.sh
        print_status "Made run.sh executable"
    fi
    
    echo
    print_status "Installation completed!"
    echo "======================================"
    echo
    print_info "🚀 To start SecureChat, run:"
    echo "   ./run.sh"
    echo
    print_info "📖 Or manually run:"
    echo "   $PYTHON_CMD flask-secure-chat.py"
    echo
    print_info "🌐 The application will be available at:"
    echo "   • Local: http://localhost:5001"
    echo "   • Network: http://[your-ip]:5001"
    echo "   • Public URLs will be generated automatically"
    echo
}

# Run main function
main "$@"
