#!/bin/bash
# SecureChat - Automated Runner Script for macOS/Linux/Termux
# This script automatically starts the SecureChat application

echo "🔒 SecureChat - Starting Application"
echo "===================================="

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
    elif [[ -f /etc/termux-version ]]; then
        OS="Termux"
    elif [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
    else
        OS="Linux"
    fi
}

# Get system information
get_system_info() {
    detect_os
    
    print_info "🖥️  System Information:"
    echo "   OS: $OS"
    
    if command_exists python; then
        PYTHON_VERSION=$(python --version 2>/dev/null)
        echo "   Python: $PYTHON_VERSION"
        PYTHON_CMD="python"
    elif command_exists python3; then
        PYTHON_VERSION=$(python3 --version 2>/dev/null)
        echo "   Python: $PYTHON_VERSION"
        PYTHON_CMD="python3"
    else
        print_error "Python not found! Please run install.sh first."
        echo
        print_warning "💡 To install dependencies, run:"
        echo "   ./install.sh"
        echo
        exit 1
    fi
    
    if command_exists node; then
        NODE_VERSION=$(node --version 2>/dev/null)
        echo "   Node.js: $NODE_VERSION"
    fi
    
    echo
}

# Check if main application file exists
check_app_file() {
    if [ ! -f "flask-secure-chat.py" ]; then
        print_error "flask-secure-chat.py not found!"
        print_warning "Make sure you're in the correct directory."
        echo
        exit 1
    fi
}

# Check Python dependencies
check_dependencies() {
    print_step "🔍 Checking Python dependencies..."
    
    # List of required dependencies
    dependencies=("flask" "flask_socketio" "flask_login" "flask_wtf" "wtforms" "werkzeug" "cryptography" "bcrypt" "qrcode" "psutil" "requests")
    missing_deps=()
    
    for dep in "${dependencies[@]}"; do
        if $PYTHON_CMD -c "import $dep" 2>/dev/null; then
            echo "   ✅ $dep"
        else
            echo "   ❌ $dep (missing)"
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo
        print_warning "Missing dependencies detected. Installing..."
        
        # Determine pip command
        PIP_CMD="pip"
        if ! command_exists pip && command_exists pip3; then
            PIP_CMD="pip3"
        fi
        
        # Install missing dependencies
        if $PIP_CMD install "${missing_deps[@]}"; then
            print_status "Dependencies installed successfully!"
        else
            print_error "Failed to install dependencies. Please run:"
            echo "   $PIP_CMD install ${missing_deps[*]}"
            echo
            exit 1
        fi
    fi
    
    echo
}

# Get network information
get_network_info() {
    # Try to get local IP address
    if command_exists ifconfig; then
        LOCAL_IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
    elif command_exists ip; then
        LOCAL_IP=$(ip route get 1 | awk '{print $7}' | head -1)
    elif command_exists hostname; then
        LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null)
    else
        LOCAL_IP="[your-ip]"
    fi
    
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP="[your-ip]"
    fi
}

# Display startup information
show_startup_info() {
    get_network_info
    
    print_info "📋 Application Details:"
    echo "   • Environment: Development"
    echo "   • Debug Mode: Enabled"
    echo "   • Auto-reload: Enabled"
    echo "   • Port: 5001"
    echo
    
    print_info "🌐 Access URLs (will be available after startup):"
    echo "   • Local: http://localhost:5001"
    echo "   • Network: http://$LOCAL_IP:5001"
    echo "   • Public SSL URLs: Generated automatically"
    echo
    
    print_info "🔧 Control Commands:"
    echo "   • Stop server: Ctrl + C"
    echo "   • View logs: Check terminal output"
    echo
}

# Cleanup function
cleanup() {
    echo
    print_warning "🔄 SecureChat application has stopped."
    echo
    print_info "💡 To restart, run: ./run.sh"
    echo
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    get_system_info
    check_app_file
    check_dependencies
    show_startup_info
    
    # Set environment variables for development
    export FLASK_ENV=development
    export FLASK_DEBUG=1
    
    print_step "🎯 Starting application in 3 seconds..."
    sleep 3
    
    print_step "▶️  Launching SecureChat..."
    echo "================================"
    echo
    
    # Start the application
    $PYTHON_CMD flask-secure-chat.py
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
