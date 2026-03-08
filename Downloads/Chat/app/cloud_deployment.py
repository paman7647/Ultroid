# app/cloud_deployment.py
"""
Global Accessibility and Cloud Deployment System
Enables access from anywhere in the world with automatic cloud deployment
"""

import os
import json
import requests
import subprocess
import threading
import time
import socket
from datetime import datetime
from flask import current_app
import logging
from urllib.parse import urlparse

class CloudDeploymentManager:
    """Manages cloud deployment and global accessibility"""
    
    def __init__(self):
        self.deployment_status = 'local'
        self.public_url = None
        self.tunnel_process = None
        self.health_check_thread = None
        self.is_monitoring = False
        self.logger = logging.getLogger(__name__)
        
    def setup_global_access(self, method='ngrok'):
        """Setup global access using various methods"""
        try:
            if method == 'ngrok':
                return self._setup_ngrok_tunnel()
            elif method == 'localtunnel':
                return self._setup_localtunnel()
            elif method == 'cloudflare':
                return self._setup_cloudflare_tunnel()
            elif method == 'serveo':
                return self._setup_serveo_tunnel()
            else:
                raise ValueError(f"Unsupported tunnel method: {method}")
        except Exception as e:
            self.logger.error(f"Failed to setup global access: {e}")
            return None
            
    def _setup_ngrok_tunnel(self):
        """Setup ngrok tunnel for global access"""
        try:
            # Check if ngrok is installed (try multiple paths)
            ngrok_paths = [
                '/opt/homebrew/bin/ngrok',  # Homebrew ARM64
                '/usr/local/bin/ngrok',      # Homebrew x86_64
                'ngrok'                      # System PATH
            ]
            
            ngrok_cmd = None
            for path in ngrok_paths:
                try:
                    subprocess.run([path, 'version'], check=True, capture_output=True)
                    ngrok_cmd = path
                    break
                except (subprocess.CalledProcessError, FileNotFoundError):
                    continue
                    
            if not ngrok_cmd:
                raise FileNotFoundError("ngrok not found in any expected location")
            
            # Get the port from config
            port = current_app.config.get('PORT', 5001)
            
            # Start ngrok tunnel
            cmd = [ngrok_cmd, 'http', str(port), '--log=stdout']
            self.tunnel_process = subprocess.Popen(
                cmd, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            # Wait for tunnel to establish
            time.sleep(3)
            
            # Get public URL from ngrok API
            try:
                response = requests.get('http://127.0.0.1:4040/api/tunnels')
                tunnels = response.json()['tunnels']
                if tunnels:
                    self.public_url = tunnels[0]['public_url']
                    self.deployment_status = 'ngrok'
                    
                    # Set environment variable for HTTPS tunnel
                    if self.public_url.startswith('https://'):
                        os.environ['HTTPS_TUNNEL'] = 'true'
                    
                    self._start_health_monitoring()
                    
                    self.logger.info(f"Ngrok tunnel established: {self.public_url}")
                    return self.public_url
            except:
                pass
                
        except subprocess.CalledProcessError:
            self.logger.warning("Ngrok not found, trying alternative method")
            
        except Exception as e:
            self.logger.error(f"Ngrok setup failed: {e}")
            
        return None
        
    def _setup_localtunnel(self):
        """Setup localtunnel for global access"""
        try:
            # Check if localtunnel is installed
            subprocess.run(['lt', '--version'], check=True, capture_output=True)
            
            port = current_app.config.get('PORT', 5001)
            
            # Start localtunnel
            cmd = ['lt', '--port', str(port)]
            self.tunnel_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            # Parse output for URL
            for line in iter(self.tunnel_process.stdout.readline, ''):
                if 'https://' in line:
                    self.public_url = line.strip().split()[-1]
                    self.deployment_status = 'localtunnel'
                    
                    # Set environment variable for HTTPS tunnel
                    if self.public_url.startswith('https://'):
                        os.environ['HTTPS_TUNNEL'] = 'true'
                    
                    self._start_health_monitoring()
                    
                    self.logger.info(f"LocalTunnel established: {self.public_url}")
                    return self.public_url
                    
        except subprocess.CalledProcessError:
            self.logger.warning("LocalTunnel not found")
        except Exception as e:
            self.logger.error(f"LocalTunnel setup failed: {e}")
            
        return None
        
    def _setup_cloudflare_tunnel(self):
        """Setup Cloudflare tunnel for global access"""
        try:
            # Check if cloudflared is installed (try both homebrew and system paths)
            cloudflared_paths = [
                '/opt/homebrew/bin/cloudflared',  # Homebrew ARM64
                '/usr/local/bin/cloudflared',      # Homebrew x86_64
                'cloudflared'                      # System PATH
            ]
            
            cloudflared_cmd = None
            for path in cloudflared_paths:
                try:
                    subprocess.run([path, 'version'], check=True, capture_output=True)
                    cloudflared_cmd = path
                    break
                except (subprocess.CalledProcessError, FileNotFoundError):
                    continue
                    
            if not cloudflared_cmd:
                raise FileNotFoundError("cloudflared not found in any expected location")
            
            port = current_app.config.get('PORT', 5001)
            
            # Start cloudflare tunnel
            cmd = [cloudflared_cmd, 'tunnel', '--url', f'localhost:{port}']
            self.tunnel_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            # Parse output for URL
            for line in iter(self.tunnel_process.stderr.readline, ''):
                if 'https://' in line and 'trycloudflare.com' in line:
                    # Extract URL from log line
                    parts = line.split()
                    for part in parts:
                        if 'https://' in part and 'trycloudflare.com' in part:
                            self.public_url = part
                            self.deployment_status = 'cloudflare'
                            
                            # Set environment variable for HTTPS tunnel
                            os.environ['HTTPS_TUNNEL'] = 'true'
                            
                            self._start_health_monitoring()
                            
                            self.logger.info(f"Cloudflare tunnel established: {self.public_url}")
                            return self.public_url
                            
        except subprocess.CalledProcessError:
            self.logger.warning("Cloudflared not found")
        except Exception as e:
            self.logger.error(f"Cloudflare tunnel setup failed: {e}")
            
        return None
        
    def _setup_serveo_tunnel(self):
        """Setup serveo.net tunnel for global access"""
        try:
            port = current_app.config.get('PORT', 5001)
            
            # Generate subdomain
            subdomain = f"securechat-{int(time.time())}"
            
            # Start serveo tunnel
            cmd = ['ssh', '-R', f'{subdomain}:80:localhost:{port}', 'serveo.net']
            self.tunnel_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            # Parse output for URL
            for line in iter(self.tunnel_process.stderr.readline, ''):
                if 'Forwarding HTTP traffic from' in line:
                    # Extract URL
                    self.public_url = f"https://{subdomain}.serveo.net"
                    self.deployment_status = 'serveo'
                    
                    # Set environment variable for HTTPS tunnel
                    os.environ['HTTPS_TUNNEL'] = 'true'
                    
                    self._start_health_monitoring()
                    
                    self.logger.info(f"Serveo tunnel established: {self.public_url}")
                    return self.public_url
                    
        except Exception as e:
            self.logger.error(f"Serveo tunnel setup failed: {e}")
            
        return None
        
    def _start_health_monitoring(self):
        """Start health monitoring for the tunnel"""
        if self.is_monitoring:
            return
            
        self.is_monitoring = True
        self.health_check_thread = threading.Thread(
            target=self._health_monitor_loop,
            daemon=True
        )
        self.health_check_thread.start()
        
    def _health_monitor_loop(self):
        """Monitor tunnel health and restart if needed"""
        while self.is_monitoring:
            try:
                if self.public_url:
                    # Check if tunnel is still active
                    response = requests.get(f"{self.public_url}/health", timeout=10)
                    if response.status_code != 200:
                        self.logger.warning("Tunnel health check failed, attempting restart")
                        self._restart_tunnel()
                        
            except Exception as e:
                self.logger.warning(f"Tunnel health check error: {e}")
                self._restart_tunnel()
                
            time.sleep(60)  # Check every minute
            
    def _restart_tunnel(self):
        """Restart the tunnel connection"""
        try:
            self.stop_tunnel()
            time.sleep(5)
            
            # Try to re-establish tunnel
            method = self.deployment_status
            if method in ['ngrok', 'localtunnel', 'cloudflare', 'serveo']:
                self.setup_global_access(method)
                
        except Exception as e:
            self.logger.error(f"Tunnel restart failed: {e}")
            
    def stop_tunnel(self):
        """Stop the tunnel connection"""
        self.is_monitoring = False
        
        if self.tunnel_process:
            try:
                self.tunnel_process.terminate()
                self.tunnel_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.tunnel_process.kill()
            except Exception as e:
                self.logger.error(f"Error stopping tunnel: {e}")
                
        self.tunnel_process = None
        self.public_url = None
        self.deployment_status = 'local'
        
        self.logger.info("Tunnel stopped")
        
    def get_deployment_info(self):
        """Get current deployment information"""
        local_ip = self._get_local_ip()
        local_port = current_app.config.get('PORT', 5001)
        
        return {
            'status': self.deployment_status,
            'public_url': self.public_url,
            'local_url': f"http://localhost:{local_port}",
            'local_network_url': f"http://{local_ip}:{local_port}" if local_ip else None,
            'is_accessible_globally': self.public_url is not None,
            'tunnel_active': self.tunnel_process is not None and self.tunnel_process.poll() is None
        }
        
    def _get_local_ip(self):
        """Get local network IP address"""
        try:
            # Connect to a remote address to determine local IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(('8.8.8.8', 80))
                return s.getsockname()[0]
        except Exception:
            return None

class LoadBalancer:
    """Simple load balancer for multiple instances"""
    
    def __init__(self):
        self.instances = []
        self.current_instance = 0
        self.logger = logging.getLogger(__name__)
        
    def add_instance(self, url):
        """Add a new instance to the load balancer"""
        self.instances.append({
            'url': url,
            'healthy': True,
            'last_check': datetime.now()
        })
        self.logger.info(f"Added instance to load balancer: {url}")
        
    def get_next_instance(self):
        """Get next healthy instance using round-robin"""
        if not self.instances:
            return None
            
        # Filter healthy instances
        healthy_instances = [i for i in self.instances if i['healthy']]
        if not healthy_instances:
            return None
            
        # Round-robin selection
        instance = healthy_instances[self.current_instance % len(healthy_instances)]
        self.current_instance += 1
        
        return instance['url']
        
    def health_check_instances(self):
        """Check health of all instances"""
        for instance in self.instances:
            try:
                response = requests.get(f"{instance['url']}/health", timeout=5)
                instance['healthy'] = response.status_code == 200
                instance['last_check'] = datetime.now()
            except Exception:
                instance['healthy'] = False
                instance['last_check'] = datetime.now()

class CDNManager:
    """Content Delivery Network management"""
    
    def __init__(self):
        self.cdn_endpoints = []
        self.logger = logging.getLogger(__name__)
        
    def setup_cdn_caching(self):
        """Setup CDN caching for static assets"""
        # This would integrate with CDN providers like CloudFlare, AWS CloudFront, etc.
        pass
        
    def invalidate_cache(self, paths=None):
        """Invalidate CDN cache for specific paths"""
        # Implementation for cache invalidation
        pass

class GlobalAccessManager:
    """Main manager for global accessibility"""
    
    def __init__(self):
        self.cloud_deployment = CloudDeploymentManager()
        self.load_balancer = LoadBalancer()
        self.cdn_manager = CDNManager()
        self.logger = logging.getLogger(__name__)
        
    def initialize_global_access(self):
        """Initialize global access with fallback methods"""
        methods = ['ngrok', 'cloudflare', 'localtunnel', 'serveo']
        
        for method in methods:
            try:
                public_url = self.cloud_deployment.setup_global_access(method)
                if public_url:
                    self.load_balancer.add_instance(public_url)
                    self.logger.info(f"Global access established via {method}: {public_url}")
                    return public_url
            except Exception as e:
                self.logger.warning(f"Method {method} failed: {e}")
                continue
                
        self.logger.error("All global access methods failed")
        return None
        
    def get_access_urls(self):
        """Get all available access URLs"""
        deployment_info = self.cloud_deployment.get_deployment_info()
        
        urls = {
            'local': deployment_info['local_url'],
            'network': deployment_info['local_network_url'],
            'global': deployment_info['public_url']
        }
        
        # Add QR codes for easy mobile access
        if deployment_info['public_url']:
            urls['qr_code'] = self._generate_qr_code_url(deployment_info['public_url'])
            
        return urls
        
    def _generate_qr_code_url(self, url):
        """Generate QR code URL for easy mobile access"""
        # Using Google Charts API for QR code generation
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={url}"
        return qr_url
        
    def get_global_status(self):
        """Get comprehensive global accessibility status"""
        deployment_info = self.cloud_deployment.get_deployment_info()
        
        return {
            'timestamp': datetime.now().isoformat(),
            'deployment': deployment_info,
            'load_balancer': {
                'instances': len(self.load_balancer.instances),
                'healthy_instances': len([i for i in self.load_balancer.instances if i['healthy']])
            },
            'access_methods': {
                'local': True,
                'network': deployment_info['local_network_url'] is not None,
                'global': deployment_info['public_url'] is not None
            }
        }

# Global instance
global_access_manager = GlobalAccessManager()
