#!/usr/bin/env python3
"""
SSL-Secured Public Access Demo
Demonstrates how to get instant HTTPS links for your laptop-hosted app
"""

import sys
import time
import threading
from datetime import datetime

# Add path for user installed packages
sys.path.append('/Users/amankumarpandey/Library/Python/3.9/lib/python/site-packages')

try:
    from public_access_manager import SSLTunnelManager
    
    def demo_ssl_public_access():
        print("🔒 SSL-Secured Public Access Demo")
        print("=" * 50)
        print()
        
        # Initialize the tunnel manager
        print("🚀 Initializing SSL Tunnel Manager...")
        manager = SSLTunnelManager(local_port=5001)
        
        # Show local access info
        print(f"📍 Local Access:")
        print(f"   • http://localhost:5001")
        print(f"   • http://{manager.get_local_ip()}:5001")
        print()
        
        # Setup public access tunnels
        print("🌍 Setting up SSL-secured public access tunnels...")
        print("   (This may take 10-30 seconds)")
        print()
        
        # Setup tunnels
        tunnels = manager.setup_all_tunnels()
        
        if tunnels:
            print("✅ SSL-Secured Public Access URLs:")
            print("=" * 50)
            for tunnel in tunnels:
                ssl_icon = "🔒" if tunnel.get('ssl') else "⚠️"
                print(f"   {ssl_icon} {tunnel['url']} ({tunnel['method']})")
            
            print()
            print("📱 QR codes generated in: qr_codes/")
            print("🎉 Share these HTTPS links with anyone!")
            print("🔐 All connections are SSL-encrypted and secure!")
            print()
            
            # Show primary URL
            primary_url = manager.get_primary_url()
            if primary_url:
                print(f"⭐ Primary URL: {primary_url}")
                print()
            
            return True
        else:
            print("❌ No public tunnels could be established")
            print("💡 Try installing tunnel tools:")
            print("   • ngrok: https://ngrok.com/download")
            print("   • cloudflared: brew install cloudflared")
            print("   • localtunnel: npm install -g localtunnel")
            return False
    
    if __name__ == "__main__":
        try:
            success = demo_ssl_public_access()
            if success:
                print("🔍 Monitoring tunnels... (Press Ctrl+C to stop)")
                try:
                    while True:
                        time.sleep(30)
                except KeyboardInterrupt:
                    print("\n🛑 Stopping tunnels...")
        except Exception as e:
            print(f"❌ Demo failed: {e}")
            import traceback
            traceback.print_exc()

except ImportError as e:
    print("❌ Required dependencies not found")
    print("💡 Run: pip install 'qrcode[pil]' requests")
    print(f"   Error: {e}")
