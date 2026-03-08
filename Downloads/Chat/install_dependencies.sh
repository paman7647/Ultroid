#!/bin/bash
# Enhanced Security Chat Application - Dependency Installation Script

echo "🔒 Installing Enhanced Security Chat Dependencies..."
echo "=================================================="

# Install Python packages
echo "📦 Installing Python packages..."

# Core packages
pip install psutil redis requests qrcode[pil]

# Optional packages for cloud deployment
echo "🌐 Installing cloud deployment tools (optional)..."

# Try to install ngrok via package manager
if command -v brew &> /dev/null; then
    echo "🍺 Installing ngrok via Homebrew..."
    brew install ngrok
elif command -v apt-get &> /dev/null; then
    echo "📦 Installing ngrok via APT..."
    curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo apt-key add -
    echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
    sudo apt update && sudo apt install ngrok
else
    echo "⚠️  Please install ngrok manually from https://ngrok.com/download"
fi

# Try to install cloudflared
if command -v brew &> /dev/null; then
    echo "☁️  Installing cloudflared via Homebrew..."
    brew install cloudflare/cloudflare/cloudflared
elif command -v apt-get &> /dev/null; then
    echo "☁️  Installing cloudflared via APT..."
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared-linux-amd64.deb
    rm cloudflared-linux-amd64.deb
else
    echo "⚠️  Please install cloudflared manually from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
fi

# Install localtunnel via npm if available
if command -v npm &> /dev/null; then
    echo "🌍 Installing localtunnel via npm..."
    npm install -g localtunnel
else
    echo "⚠️  npm not found. Please install Node.js to use localtunnel"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "🚀 Enhanced features available:"
echo "   • Advanced rate limiting and API management"
echo "   • Secure local chat history storage"
echo "   • Global accessibility via tunneling"
echo "   • Automatic backup and disaster recovery"
echo "   • Real-time performance monitoring"
echo "   • Auto-scaling capabilities"
echo "   • Enhanced file security scanning"
echo ""
echo "🌐 Global access methods:"
echo "   • ngrok: Professional tunneling service"
echo "   • cloudflared: Cloudflare tunnel (free)"
echo "   • localtunnel: Simple HTTP tunneling"
echo "   • serveo: SSH-based tunneling"
echo ""
echo "📱 To access from anywhere:"
echo "   1. Run the application normally"
echo "   2. Check /api/v1/access/urls for all access URLs"
echo "   3. Use the global URL to access from any device"
echo ""
echo "💾 Local storage features:"
echo "   • End-to-end encrypted chat history"
echo "   • User consent required for storage"
echo "   • Device-level security"
echo "   • Export capabilities"
echo ""
