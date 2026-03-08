#!/bin/bash

# Quick Start Script for SSL-Secured Public Access
# Run this to instantly get your secure chat available worldwide with HTTPS

echo "🔒 SECURE CHAT - SSL-SECURED PUBLIC ACCESS"
echo "=========================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "secure_chat.db" ]; then
    echo "📥 Installing dependencies..."
    pip install -r requirements.txt > /dev/null 2>&1
    
    echo "🛠️  Installing enhanced features..."
    ./install_dependencies.sh > /dev/null 2>&1
    
    echo "🗄️  Initializing database..."
    python -c "
import sqlite3
with open('schema.sql', 'r') as f:
    schema = f.read()
conn = sqlite3.connect('secure_chat.db')
conn.executescript(schema)
conn.close()
print('✅ Database initialized!')
"
fi

echo ""
echo "🚀 Starting Secure Chat with SSL-secured public access..."
echo ""
echo "🔗 Your chat will be available:"
echo "   🏠 Locally: http://localhost:5001"
echo "   🌍 Globally: SSL-secured URLs will be displayed below"
echo ""
echo "📱 QR codes will be generated for easy mobile sharing"
echo "📊 Web dashboard: http://localhost:5001/api/v1/access/dashboard"
echo ""
echo "⏳ Setting up tunnels (this may take 10-30 seconds)..."
echo "=================================================="

# Set environment variable to enable public access
export ENABLE_PUBLIC_ACCESS=true

# Run the application
python flask-secure-chat.py
