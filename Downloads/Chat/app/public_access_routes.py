"""
Public Access API Routes for Flask Secure Chat
Provides API endpoints for managing SSL-secured public access
"""

from flask import Blueprint, jsonify, request, render_template_string
from flask_login import login_required
import os
import json
from datetime import datetime

try:
    from public_access_manager import SSLTunnelManager
    PUBLIC_ACCESS_AVAILABLE = True
except ImportError:
    PUBLIC_ACCESS_AVAILABLE = False

# Create blueprint
public_access_bp = Blueprint('public_access', __name__, url_prefix='/api/v1/access')

# Global tunnel manager instance
tunnel_manager = None

def init_tunnel_manager(port=5001):
    """Initialize tunnel manager"""
    global tunnel_manager
    if PUBLIC_ACCESS_AVAILABLE and not tunnel_manager:
        tunnel_manager = SSLTunnelManager(local_port=port)
    return tunnel_manager

@public_access_bp.route('/status', methods=['GET'])
def get_access_status():
    """Get current public access status"""
    if not PUBLIC_ACCESS_AVAILABLE:
        return jsonify({
            'status': 'unavailable',
            'message': 'Public access features not available. Install: pip install qrcode requests',
            'available_methods': []
        }), 503
    
    manager = init_tunnel_manager()
    if not manager:
        return jsonify({
            'status': 'error',
            'message': 'Failed to initialize tunnel manager'
        }), 500
    
    # Load current status
    status = manager.load_tunnel_status()
    if not status:
        status = {
            'local_ip': manager.get_local_ip(),
            'local_port': manager.local_port,
            'local_urls': [
                f"http://localhost:{manager.local_port}",
                f"http://{manager.get_local_ip()}:{manager.local_port}"
            ],
            'active_tunnels': {},
            'last_updated': datetime.now().isoformat()
        }
    
    return jsonify({
        'status': 'available',
        'local_access': status.get('local_urls', []),
        'public_access': manager.get_all_urls(),
        'primary_url': manager.get_primary_url(),
        'last_updated': status.get('last_updated'),
        'ssl_secured': True
    })

@public_access_bp.route('/urls', methods=['GET'])
def get_all_urls():
    """Get all available access URLs"""
    if not PUBLIC_ACCESS_AVAILABLE:
        return jsonify({
            'error': 'Public access not available',
            'install_command': 'pip install qrcode requests'
        }), 503
    
    manager = init_tunnel_manager()
    if not manager:
        return jsonify({'error': 'Tunnel manager not available'}), 500
    
    urls = manager.get_all_urls()
    primary_url = manager.get_primary_url()
    
    return jsonify({
        'local_urls': [
            f"http://localhost:{manager.local_port}",
            f"http://{manager.get_local_ip()}:{manager.local_port}"
        ],
        'public_urls': urls,
        'primary_url': primary_url,
        'ssl_secured': True,
        'qr_codes_available': True
    })

@public_access_bp.route('/setup', methods=['POST'])
@login_required
def setup_public_access():
    """Setup all public access tunnels"""
    if not PUBLIC_ACCESS_AVAILABLE:
        return jsonify({
            'error': 'Public access not available',
            'install_command': 'pip install qrcode requests'
        }), 503
    
    manager = init_tunnel_manager()
    if not manager:
        return jsonify({'error': 'Tunnel manager not available'}), 500
    
    try:
        tunnels = manager.setup_all_tunnels()
        return jsonify({
            'status': 'success',
            'message': f'Successfully setup {len(tunnels)} tunnel(s)',
            'tunnels': tunnels,
            'primary_url': manager.get_primary_url()
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Failed to setup tunnels: {str(e)}'
        }), 500

@public_access_bp.route('/setup/<method>', methods=['POST'])
@login_required
def setup_specific_tunnel(method):
    """Setup a specific tunnel method"""
    if not PUBLIC_ACCESS_AVAILABLE:
        return jsonify({
            'error': 'Public access not available',
            'install_command': 'pip install qrcode requests'
        }), 503
    
    manager = init_tunnel_manager()
    if not manager:
        return jsonify({'error': 'Tunnel manager not available'}), 500
    
    method_map = {
        'ngrok': manager.setup_ngrok_tunnel,
        'cloudflare': manager.setup_cloudflare_tunnel,
        'localtunnel': manager.setup_localtunnel,
        'serveo': manager.setup_serveo_tunnel
    }
    
    if method not in method_map:
        return jsonify({
            'error': f'Unknown tunnel method: {method}',
            'available_methods': list(method_map.keys())
        }), 400
    
    try:
        tunnel_url = method_map[method]()
        if tunnel_url:
            return jsonify({
                'status': 'success',
                'method': method,
                'url': tunnel_url,
                'ssl_secured': True
            })
        else:
            return jsonify({
                'status': 'failed',
                'method': method,
                'message': f'Failed to setup {method} tunnel'
            }), 500
    except Exception as e:
        return jsonify({
            'status': 'error',
            'method': method,
            'message': str(e)
        }), 500

@public_access_bp.route('/cleanup', methods=['POST'])
@login_required
def cleanup_tunnels():
    """Cleanup all tunnel processes"""
    if not PUBLIC_ACCESS_AVAILABLE:
        return jsonify({
            'error': 'Public access not available'
        }), 503
    
    manager = init_tunnel_manager()
    if not manager:
        return jsonify({'error': 'Tunnel manager not available'}), 500
    
    try:
        manager.cleanup_tunnels()
        return jsonify({
            'status': 'success',
            'message': 'All tunnels cleaned up successfully'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Cleanup failed: {str(e)}'
        }), 500

@public_access_bp.route('/qr/<method>', methods=['GET'])
def get_qr_code(method):
    """Get QR code for a specific tunnel method"""
    if not PUBLIC_ACCESS_AVAILABLE:
        return jsonify({
            'error': 'Public access not available'
        }), 503
    
    manager = init_tunnel_manager()
    if not manager:
        return jsonify({'error': 'Tunnel manager not available'}), 500
    
    qr_path = os.path.join(manager.qr_codes_dir, f"{method}_qr.png")
    
    if os.path.exists(qr_path):
        from flask import send_file
        return send_file(qr_path, mimetype='image/png')
    else:
        return jsonify({
            'error': f'QR code not found for {method}',
            'message': 'Setup the tunnel first to generate QR code'
        }), 404

@public_access_bp.route('/dashboard', methods=['GET'])
def access_dashboard():
    """Web dashboard for managing public access"""
    if not PUBLIC_ACCESS_AVAILABLE:
        return render_template_string("""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Public Access - Not Available</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .error { color: #e74c3c; background: #fdf2f2; padding: 15px; border-radius: 5px; border-left: 4px solid #e74c3c; }
                .install-cmd { background: #2c3e50; color: #ecf0f1; padding: 10px; border-radius: 5px; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔒 Public Access Dashboard</h1>
                <div class="error">
                    <h3>⚠️ Public Access Not Available</h3>
                    <p>Required dependencies are not installed.</p>
                    <p><strong>To enable public access, run:</strong></p>
                    <div class="install-cmd">pip install qrcode requests</div>
                    <p>Or use the installation script:</p>
                    <div class="install-cmd">./install_dependencies.sh</div>
                </div>
            </div>
        </body>
        </html>
        """)
    
    manager = init_tunnel_manager()
    status = manager.load_tunnel_status() if manager else {}
    
    return render_template_string("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Public Access Dashboard</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
            .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
            .status-active { color: #27ae60; }
            .status-inactive { color: #e74c3c; }
            .url-box { background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #3498db; margin: 10px 0; }
            .btn { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            .btn:hover { background: #2980b9; }
            .btn-success { background: #27ae60; }
            .btn-danger { background: #e74c3c; }
            .ssl-icon { color: #27ae60; }
            .qr-code { max-width: 150px; border: 2px solid #ddd; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔒 SSL-Secured Public Access Dashboard</h1>
                <p>Manage global access to your secure chat application</p>
            </div>
            
            <div class="grid">
                <div class="card">
                    <h3>📍 Local Access</h3>
                    <div class="url-box">
                        <strong>Localhost:</strong><br>
                        <a href="http://localhost:{{ port }}" target="_blank">http://localhost:{{ port }}</a>
                    </div>
                    <div class="url-box">
                        <strong>Network:</strong><br>
                        <a href="http://{{ local_ip }}:{{ port }}" target="_blank">http://{{ local_ip }}:{{ port }}</a>
                    </div>
                </div>
                
                <div class="card">
                    <h3>🌍 Public Access</h3>
                    <div id="public-urls">
                        <p>Loading public URLs...</p>
                    </div>
                    <button class="btn" onclick="setupTunnels()">🚀 Setup All Tunnels</button>
                    <button class="btn btn-danger" onclick="cleanupTunnels()">🧹 Cleanup Tunnels</button>
                </div>
                
                <div class="card">
                    <h3>📱 QR Codes</h3>
                    <div id="qr-codes">
                        <p>QR codes will appear after tunnel setup</p>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h3>🛠️ Tunnel Controls</h3>
                <button class="btn" onclick="setupSpecificTunnel('ngrok')">Setup ngrok</button>
                <button class="btn" onclick="setupSpecificTunnel('cloudflare')">Setup Cloudflare</button>
                <button class="btn" onclick="setupSpecificTunnel('localtunnel')">Setup LocalTunnel</button>
                <button class="btn" onclick="setupSpecificTunnel('serveo')">Setup Serveo</button>
            </div>
        </div>
        
        <script>
            function loadStatus() {
                fetch('/api/v1/access/status')
                    .then(response => response.json())
                    .then(data => {
                        updatePublicUrls(data.public_access || []);
                        updateQRCodes(data.public_access || []);
                    })
                    .catch(error => console.error('Error:', error));
            }
            
            function updatePublicUrls(urls) {
                const container = document.getElementById('public-urls');
                if (urls.length === 0) {
                    container.innerHTML = '<p class="status-inactive">No public tunnels active</p>';
                    return;
                }
                
                let html = '';
                urls.forEach(url => {
                    html += `
                        <div class="url-box">
                            <span class="ssl-icon">🔒</span> <strong>${url.method}:</strong><br>
                            <a href="${url.url}" target="_blank">${url.url}</a>
                            <span class="status-active">✓ SSL Secured</span>
                        </div>
                    `;
                });
                container.innerHTML = html;
            }
            
            function updateQRCodes(urls) {
                const container = document.getElementById('qr-codes');
                if (urls.length === 0) {
                    container.innerHTML = '<p>No QR codes available</p>';
                    return;
                }
                
                let html = '';
                urls.forEach(url => {
                    html += `
                        <div style="margin: 10px; display: inline-block; text-align: center;">
                            <img src="/api/v1/access/qr/${url.method}" class="qr-code" alt="${url.method} QR" onerror="this.style.display='none'">
                            <p><small>${url.method}</small></p>
                        </div>
                    `;
                });
                container.innerHTML = html;
            }
            
            function setupTunnels() {
                fetch('/api/v1/access/setup', { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            alert('Tunnels setup successfully!');
                            loadStatus();
                        } else {
                            alert('Setup failed: ' + data.message);
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Setup failed: ' + error.message);
                    });
            }
            
            function setupSpecificTunnel(method) {
                fetch(`/api/v1/access/setup/${method}`, { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            alert(`${method} tunnel setup successfully!`);
                            loadStatus();
                        } else {
                            alert(`${method} setup failed: ` + data.message);
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert(`${method} setup failed: ` + error.message);
                    });
            }
            
            function cleanupTunnels() {
                if (confirm('Are you sure you want to cleanup all tunnels?')) {
                    fetch('/api/v1/access/cleanup', { method: 'POST' })
                        .then(response => response.json())
                        .then(data => {
                            if (data.status === 'success') {
                                alert('Tunnels cleaned up successfully!');
                                loadStatus();
                            } else {
                                alert('Cleanup failed: ' + data.message);
                            }
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            alert('Cleanup failed: ' + error.message);
                        });
                }
            }
            
            // Load status on page load
            document.addEventListener('DOMContentLoaded', loadStatus);
            
            // Auto-refresh every 30 seconds
            setInterval(loadStatus, 30000);
        </script>
    </body>
    </html>
    """, port=manager.local_port if manager else 5001, local_ip=manager.get_local_ip() if manager else '127.0.0.1')

# Helper function to register the blueprint
def register_public_access_routes(app):
    """Register public access routes with the Flask app"""
    app.register_blueprint(public_access_bp)
    
    # Initialize tunnel manager with app port
    port = int(os.environ.get('PORT', 5001))
    init_tunnel_manager(port)
