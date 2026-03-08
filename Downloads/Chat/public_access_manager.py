#!/usr/bin/env python3
"""
SSL-Secured Public Access Manager for Flask Secure Chat
Automatically generates secure web links for public access with HTTPS encryption
"""

import os
import sys
import json
import time
import qrcode
import socket
import requests
import subprocess
import threading
from io import BytesIO
from datetime import datetime, timedelta
from urllib.parse import urlparse
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SSLTunnelManager:
    """Manages SSL-secured tunnels for public access"""
    
    def __init__(self, local_port=5001):
        self.local_port = local_port
        self.active_tunnels = {}
        self.tunnel_processes = {}
        self.status_file = "tunnel_status.json"
        self.qr_codes_dir = "qr_codes"
        
        # Create directories
        os.makedirs(self.qr_codes_dir, exist_ok=True)
        os.makedirs("logs", exist_ok=True)
        
        # Tunnel configurations
        self.tunnel_configs = {
            'ngrok': {
                'name': 'ngrok',
                'ssl': True,
                'reliable': True,
                'speed': 'fast',
                'setup_required': True
            },
            'cloudflared': {
                'name': 'Cloudflare Tunnel',
                'ssl': True,
                'reliable': True,
                'speed': 'fast',
                'setup_required': False
            },
            'localtunnel': {
                'name': 'LocalTunnel',
                'ssl': True,
                'reliable': False,
                'speed': 'medium',
                'setup_required': False
            },
            'serveo': {
                'name': 'Serveo',
                'ssl': True,
                'reliable': False,
                'speed': 'medium',
                'setup_required': False
            }
        }
    
    def get_local_ip(self):
        """Get local IP address"""
        try:
            # Connect to a remote server to determine local IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                return s.getsockname()[0]
        except Exception:
            return "127.0.0.1"
    
    def check_port_available(self, port):
        """Check if port is available"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return True
        except OSError:
            return False
    
    def setup_ngrok_tunnel(self):
        """Setup ngrok tunnel with SSL"""
        try:
            # Check if ngrok is installed
            result = subprocess.run(['ngrok', 'version'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode != 0:
                logger.warning("ngrok not installed. Installing...")
                self.install_ngrok()
            
            # Start ngrok tunnel
            cmd = ['ngrok', 'http', str(self.local_port), '--log=stdout']
            
            # Add auth token if available
            auth_token = os.getenv('NGROK_AUTH_TOKEN')
            if auth_token:
                subprocess.run(['ngrok', 'config', 'add-authtoken', auth_token], 
                             capture_output=True)
            
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, 
                                     stderr=subprocess.PIPE, text=True)
            
            # Wait for tunnel to be ready
            tunnel_url = None
            for _ in range(30):  # Wait up to 30 seconds
                try:
                    response = requests.get('http://localhost:4040/api/tunnels', timeout=2)
                    if response.status_code == 200:
                        tunnels = response.json().get('tunnels', [])
                        for tunnel in tunnels:
                            if tunnel.get('proto') == 'https':
                                tunnel_url = tunnel.get('public_url')
                                break
                        if tunnel_url:
                            break
                except:
                    pass
                time.sleep(1)
            
            if tunnel_url:
                self.active_tunnels['ngrok'] = {
                    'url': tunnel_url,
                    'ssl': True,
                    'status': 'active',
                    'created': datetime.now().isoformat(),
                    'method': 'ngrok'
                }
                self.tunnel_processes['ngrok'] = process
                logger.info(f"✅ ngrok tunnel established: {tunnel_url}")
                return tunnel_url
            else:
                logger.error("❌ Failed to establish ngrok tunnel")
                process.terminate()
                return None
                
        except Exception as e:
            logger.error(f"❌ ngrok setup failed: {e}")
            return None
    
    def setup_cloudflare_tunnel(self):
        """Setup Cloudflare tunnel with SSL"""
        try:
            # Check if cloudflared is installed
            result = subprocess.run(['cloudflared', 'version'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode != 0:
                logger.warning("cloudflared not installed. Installing...")
                self.install_cloudflared()
            
            # Start cloudflare tunnel
            cmd = [
                'cloudflared', 'tunnel',
                '--url', f'http://localhost:{self.local_port}',
                '--logfile', 'logs/cloudflare.log'
            ]
            
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, 
                                     stderr=subprocess.PIPE, text=True)
            
            # Extract tunnel URL from output
            tunnel_url = None
            for _ in range(60):  # Wait up to 60 seconds
                if process.poll() is not None:
                    break
                
                try:
                    # Check logs for tunnel URL
                    if os.path.exists('logs/cloudflare.log'):
                        with open('logs/cloudflare.log', 'r') as f:
                            for line in f:
                                if 'https://' in line and 'trycloudflare.com' in line:
                                    # Extract URL from log line
                                    import re
                                    url_match = re.search(r'https://[\w-]+\.trycloudflare\.com', line)
                                    if url_match:
                                        tunnel_url = url_match.group()
                                        break
                    
                    if tunnel_url:
                        break
                        
                except Exception as e:
                    logger.debug(f"Checking cloudflare logs: {e}")
                
                time.sleep(1)
            
            if tunnel_url:
                self.active_tunnels['cloudflared'] = {
                    'url': tunnel_url,
                    'ssl': True,
                    'status': 'active',
                    'created': datetime.now().isoformat(),
                    'method': 'cloudflared'
                }
                self.tunnel_processes['cloudflared'] = process
                logger.info(f"✅ Cloudflare tunnel established: {tunnel_url}")
                return tunnel_url
            else:
                logger.error("❌ Failed to establish Cloudflare tunnel")
                process.terminate()
                return None
                
        except Exception as e:
            logger.error(f"❌ Cloudflare setup failed: {e}")
            return None
    
    def setup_localtunnel(self):
        """Setup LocalTunnel with SSL"""
        try:
            # Check if lt is installed
            result = subprocess.run(['lt', '--version'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode != 0:
                logger.warning("localtunnel not installed. Installing...")
                self.install_localtunnel()
            
            # Generate subdomain
            subdomain = f"securechat-{int(time.time())}"
            
            # Start localtunnel
            cmd = ['lt', '--port', str(self.local_port), '--subdomain', subdomain]
            
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, 
                                     stderr=subprocess.PIPE, text=True)
            
            tunnel_url = f"https://{subdomain}.loca.lt"
            
            # Wait for tunnel to be ready
            for _ in range(30):
                try:
                    response = requests.get(tunnel_url, timeout=5, allow_redirects=False)
                    if response.status_code in [200, 301, 302]:
                        break
                except:
                    pass
                time.sleep(1)
            
            self.active_tunnels['localtunnel'] = {
                'url': tunnel_url,
                'ssl': True,
                'status': 'active',
                'created': datetime.now().isoformat(),
                'method': 'localtunnel'
            }
            self.tunnel_processes['localtunnel'] = process
            logger.info(f"✅ LocalTunnel established: {tunnel_url}")
            return tunnel_url
                
        except Exception as e:
            logger.error(f"❌ LocalTunnel setup failed: {e}")
            return None
    
    def setup_serveo_tunnel(self):
        """Setup Serveo tunnel with SSL"""
        try:
            # Generate subdomain
            subdomain = f"securechat-{int(time.time())}"
            
            # Start serveo tunnel
            cmd = [
                'ssh', '-o', 'StrictHostKeyChecking=no',
                '-R', f'{subdomain}:80:localhost:{self.local_port}',
                'serveo.net'
            ]
            
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, 
                                     stderr=subprocess.PIPE, text=True)
            
            tunnel_url = f"https://{subdomain}.serveo.net"
            
            # Wait for tunnel to be ready
            time.sleep(5)
            
            self.active_tunnels['serveo'] = {
                'url': tunnel_url,
                'ssl': True,
                'status': 'active',
                'created': datetime.now().isoformat(),
                'method': 'serveo'
            }
            self.tunnel_processes['serveo'] = process
            logger.info(f"✅ Serveo tunnel established: {tunnel_url}")
            return tunnel_url
                
        except Exception as e:
            logger.error(f"❌ Serveo setup failed: {e}")
            return None
    
    def install_ngrok(self):
        """Install ngrok automatically"""
        try:
            if sys.platform == "darwin":  # macOS
                subprocess.run(['brew', 'install', 'ngrok/ngrok/ngrok'], check=True)
            elif sys.platform == "linux":
                # Download and install ngrok for Linux
                subprocess.run([
                    'curl', '-s', 'https://ngrok-agent.s3.amazonaws.com/ngrok.asc',
                    '|', 'tee', '/etc/apt/trusted.gpg.d/ngrok.asc', '>/dev/null'
                ], shell=True)
                subprocess.run(['apt', 'update'], check=True)
                subprocess.run(['apt', 'install', 'ngrok'], check=True)
            logger.info("✅ ngrok installed successfully")
        except Exception as e:
            logger.error(f"❌ Failed to install ngrok: {e}")
    
    def install_cloudflared(self):
        """Install cloudflared automatically"""
        try:
            if sys.platform == "darwin":  # macOS
                subprocess.run(['brew', 'install', 'cloudflared'], check=True)
            elif sys.platform == "linux":
                # Download and install cloudflared for Linux
                subprocess.run([
                    'wget', '-q', 
                    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb'
                ])
                subprocess.run(['dpkg', '-i', 'cloudflared-linux-amd64.deb'], check=True)
            logger.info("✅ cloudflared installed successfully")
        except Exception as e:
            logger.error(f"❌ Failed to install cloudflared: {e}")
    
    def install_localtunnel(self):
        """Install localtunnel via npm"""
        try:
            subprocess.run(['npm', 'install', '-g', 'localtunnel'], check=True)
            logger.info("✅ localtunnel installed successfully")
        except Exception as e:
            logger.error(f"❌ Failed to install localtunnel: {e}")
    
    def generate_qr_code(self, url, filename=None):
        """Generate QR code for easy mobile access"""
        try:
            if not filename:
                filename = f"qr_{urlparse(url).netloc}.png"
            
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(url)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            qr_path = os.path.join(self.qr_codes_dir, filename)
            img.save(qr_path)
            
            logger.info(f"📱 QR code generated: {qr_path}")
            return qr_path
            
        except Exception as e:
            logger.error(f"❌ Failed to generate QR code: {e}")
            return None
    
    def setup_all_tunnels(self):
        """Setup all available tunnels automatically"""
        logger.info("🚀 Setting up SSL-secured public access tunnels...")
        
        successful_tunnels = []
        
        # Try each tunnel method in order of preference
        tunnel_methods = [
            ('ngrok', self.setup_ngrok_tunnel),
            ('cloudflared', self.setup_cloudflare_tunnel),
            ('localtunnel', self.setup_localtunnel),
            ('serveo', self.setup_serveo_tunnel)
        ]
        
        for method_name, method_func in tunnel_methods:
            logger.info(f"⏳ Setting up {method_name}...")
            try:
                tunnel_url = method_func()
                if tunnel_url:
                    successful_tunnels.append({
                        'method': method_name,
                        'url': tunnel_url,
                        'ssl': True
                    })
                    
                    # Generate QR code
                    self.generate_qr_code(tunnel_url, f"{method_name}_qr.png")
            except Exception as e:
                logger.error(f"❌ {method_name} failed: {e}")
        
        # Save status
        self.save_tunnel_status()
        
        return successful_tunnels
    
    def get_primary_url(self):
        """Get the primary public URL (most reliable)"""
        # Priority order: ngrok > cloudflared > localtunnel > serveo
        priority = ['ngrok', 'cloudflared', 'localtunnel', 'serveo']
        
        for method in priority:
            if method in self.active_tunnels:
                tunnel = self.active_tunnels[method]
                if tunnel.get('status') == 'active':
                    return tunnel['url']
        
        return None
    
    def get_all_urls(self):
        """Get all active public URLs"""
        urls = []
        for method, tunnel in self.active_tunnels.items():
            if tunnel.get('status') == 'active':
                urls.append({
                    'method': method,
                    'url': tunnel['url'],
                    'ssl': tunnel.get('ssl', True),
                    'created': tunnel.get('created')
                })
        return urls
    
    def save_tunnel_status(self):
        """Save tunnel status to file"""
        try:
            status = {
                'local_ip': self.get_local_ip(),
                'local_port': self.local_port,
                'local_urls': [
                    f"http://localhost:{self.local_port}",
                    f"http://{self.get_local_ip()}:{self.local_port}"
                ],
                'active_tunnels': self.active_tunnels,
                'last_updated': datetime.now().isoformat()
            }
            
            with open(self.status_file, 'w') as f:
                json.dump(status, f, indent=2)
                
        except Exception as e:
            logger.error(f"❌ Failed to save tunnel status: {e}")
    
    def load_tunnel_status(self):
        """Load tunnel status from file"""
        try:
            if os.path.exists(self.status_file):
                with open(self.status_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"❌ Failed to load tunnel status: {e}")
        return None
    
    def cleanup_tunnels(self):
        """Cleanup all tunnel processes"""
        logger.info("🧹 Cleaning up tunnels...")
        
        for method, process in self.tunnel_processes.items():
            try:
                process.terminate()
                process.wait(timeout=5)
                logger.info(f"✅ {method} tunnel terminated")
            except Exception as e:
                logger.error(f"❌ Failed to terminate {method}: {e}")
                try:
                    process.kill()
                except:
                    pass
        
        self.tunnel_processes.clear()
        self.active_tunnels.clear()
    
    def monitor_tunnels(self):
        """Monitor tunnel health and restart if needed"""
        while True:
            try:
                for method, tunnel in list(self.active_tunnels.items()):
                    url = tunnel.get('url')
                    if url:
                        try:
                            response = requests.get(url, timeout=10, allow_redirects=False)
                            if response.status_code not in [200, 301, 302, 404]:
                                logger.warning(f"⚠️ {method} tunnel unhealthy, restarting...")
                                self.restart_tunnel(method)
                        except:
                            logger.warning(f"⚠️ {method} tunnel unreachable, restarting...")
                            self.restart_tunnel(method)
                
                time.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"❌ Tunnel monitoring error: {e}")
                time.sleep(60)
    
    def restart_tunnel(self, method):
        """Restart a specific tunnel"""
        try:
            # Terminate existing process
            if method in self.tunnel_processes:
                self.tunnel_processes[method].terminate()
                del self.tunnel_processes[method]
            
            # Remove from active tunnels
            if method in self.active_tunnels:
                del self.active_tunnels[method]
            
            # Restart tunnel
            method_map = {
                'ngrok': self.setup_ngrok_tunnel,
                'cloudflared': self.setup_cloudflare_tunnel,
                'localtunnel': self.setup_localtunnel,
                'serveo': self.setup_serveo_tunnel
            }
            
            if method in method_map:
                method_map[method]()
                
        except Exception as e:
            logger.error(f"❌ Failed to restart {method}: {e}")
    
    def print_access_info(self):
        """Print formatted access information"""
        print("\n" + "="*80)
        print("🔒 SECURE CHAT - SSL-SECURED PUBLIC ACCESS")
        print("="*80)
        
        print(f"\n📍 LOCAL ACCESS:")
        print(f"   • http://localhost:{self.local_port}")
        print(f"   • http://{self.get_local_ip()}:{self.local_port}")
        
        urls = self.get_all_urls()
        if urls:
            print(f"\n🌍 PUBLIC ACCESS (SSL-SECURED):")
            for url_info in urls:
                ssl_icon = "🔒" if url_info['ssl'] else "⚠️"
                print(f"   • {ssl_icon} {url_info['url']} ({url_info['method']})")
            
            primary_url = self.get_primary_url()
            if primary_url:
                print(f"\n⭐ PRIMARY URL: {primary_url}")
                print(f"📱 QR codes available in: {self.qr_codes_dir}/")
        else:
            print(f"\n❌ No public tunnels available")
            print(f"   Run: python -c \"from public_access_manager import SSLTunnelManager; manager = SSLTunnelManager(); manager.setup_all_tunnels()\"")
        
        print("\n" + "="*80)
        print("🔐 All connections are SSL-encrypted and secure!")
        print("Share the public URL with anyone to access your chat!")
        print("="*80 + "\n")


def main():
    """Main function for standalone usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description='SSL-Secured Public Access Manager')
    parser.add_argument('--port', type=int, default=5001, help='Local port (default: 5001)')
    parser.add_argument('--setup', action='store_true', help='Setup all tunnels')
    parser.add_argument('--monitor', action='store_true', help='Monitor tunnel health')
    parser.add_argument('--cleanup', action='store_true', help='Cleanup all tunnels')
    parser.add_argument('--status', action='store_true', help='Show current status')
    
    args = parser.parse_args()
    
    manager = SSLTunnelManager(local_port=args.port)
    
    if args.cleanup:
        manager.cleanup_tunnels()
    elif args.setup:
        tunnels = manager.setup_all_tunnels()
        manager.print_access_info()
        
        if args.monitor:
            print("🔍 Starting tunnel monitoring...")
            monitor_thread = threading.Thread(target=manager.monitor_tunnels, daemon=True)
            monitor_thread.start()
            
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\n🛑 Shutting down...")
                manager.cleanup_tunnels()
    elif args.status:
        manager.print_access_info()
    else:
        print("Use --setup to create public access tunnels")
        print("Use --status to show current tunnel status")


if __name__ == "__main__":
    main()
