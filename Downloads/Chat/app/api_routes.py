# app/api_routes.py
"""
Enhanced API Routes with Advanced Rate Limiting and Features
"""

from flask import Blueprint, request, jsonify, g, current_app
from flask_login import login_required, current_user
import time
import json
from datetime import datetime

from .advanced_rate_limiter import advanced_rate_limit, api_key_required, fast_message_queue
from .local_storage_manager import device_storage_manager, web_storage_interface
from .server_manager import server_manager
from .cloud_deployment import global_access_manager
from .backup_manager import backup_manager
from .security import security_manager

# Create API blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api/v1')

# Rate-limited messaging endpoints
@api_bp.route('/messages', methods=['POST'])
@advanced_rate_limit('api/messages')
@login_required
def send_message():
    """Send message with advanced rate limiting and fast delivery"""
    start_time = time.time()
    
    try:
        data = request.get_json()
        if not data or 'content' not in data or 'room_id' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
            
        # Encrypt message content
        encrypted_content = security_manager.encrypt_message(data['content'])
        
        # Prepare message for queue
        message = {
            'sender_id': str(current_user.id),
            'room_id': data['room_id'],
            'content': encrypted_content,
            'type': data.get('type', 'text'),
            'timestamp': time.time()
        }
        
        # Add to fast message queue
        message_id = fast_message_queue.add_message(data['room_id'], message)
        
        # Check if local storage is enabled and consented
        if device_storage_manager.check_storage_consent(
            str(current_user.id), 
            data.get('partner_id'), 
            data['room_id']
        ):
            device_storage_manager.save_chat_message(
                str(current_user.id), 
                data['room_id'], 
                message
            )
            
        # Record response time
        response_time = (time.time() - start_time) * 1000
        server_manager.performance_monitor.record_response_time(response_time)
        
        return jsonify({
            'success': True,
            'message_id': message_id,
            'encrypted': True,
            'local_stored': True,
            'response_time_ms': response_time
        })
        
    except Exception as e:
        current_app.logger.error(f"Send message error: {e}")
        return jsonify({'error': 'Failed to send message'}), 500

@api_bp.route('/messages/<room_id>', methods=['GET'])
@advanced_rate_limit('api/messages')
@login_required
def get_messages(room_id):
    """Get message history with local storage integration"""
    try:
        limit = request.args.get('limit', 50, type=int)
        
        # Try to get from local storage first
        local_messages = device_storage_manager.retrieve_chat_history(
            str(current_user.id), 
            room_id, 
            limit
        )
        
        # Get from fast message queue
        queue_messages = fast_message_queue.get_message_history(room_id, limit)
        
        # Combine and deduplicate messages
        all_messages = local_messages + queue_messages
        seen_ids = set()
        unique_messages = []
        
        for msg in all_messages:
            msg_id = msg.get('id')
            if msg_id and msg_id not in seen_ids:
                seen_ids.add(msg_id)
                
                # Decrypt content if needed
                if 'content' in msg and isinstance(msg['content'], str):
                    try:
                        msg['content'] = security_manager.decrypt_message(msg['content'])
                    except:
                        pass  # Content might already be decrypted
                        
                unique_messages.append(msg)
                
        # Sort by timestamp
        unique_messages.sort(key=lambda x: x.get('timestamp', 0))
        
        return jsonify({
            'messages': unique_messages[-limit:],
            'total_count': len(unique_messages),
            'from_local_storage': len(local_messages) > 0
        })
        
    except Exception as e:
        current_app.logger.error(f"Get messages error: {e}")
        return jsonify({'error': 'Failed to retrieve messages'}), 500

# Local storage management endpoints
@api_bp.route('/storage/consent', methods=['POST'])
@advanced_rate_limit('api/storage')
@login_required
def request_storage_consent():
    """Request consent for local storage"""
    try:
        data = request.get_json()
        if not data or 'partner_id' not in data or 'room_id' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
            
        consent_id = device_storage_manager.request_storage_consent(
            str(current_user.id),
            data['partner_id'],
            data['room_id']
        )
        
        return jsonify({
            'success': True,
            'consent_id': consent_id,
            'expires_in_hours': 24
        })
        
    except Exception as e:
        current_app.logger.error(f"Storage consent request error: {e}")
        return jsonify({'error': 'Failed to request consent'}), 500

@api_bp.route('/storage/consent/<consent_id>/grant', methods=['POST'])
@advanced_rate_limit('api/storage')
@login_required
def grant_storage_consent(consent_id):
    """Grant consent for local storage"""
    try:
        success = device_storage_manager.grant_storage_consent(
            consent_id, 
            str(current_user.id)
        )
        
        return jsonify({
            'success': success,
            'consent_granted': success
        })
        
    except Exception as e:
        current_app.logger.error(f"Grant consent error: {e}")
        return jsonify({'error': 'Failed to grant consent'}), 500

@api_bp.route('/storage/initialize', methods=['POST'])
@advanced_rate_limit('api/storage')
@login_required
def initialize_storage():
    """Initialize device storage for user"""
    try:
        device_fingerprint = request.headers.get('X-Device-Fingerprint', 'unknown')
        
        result = device_storage_manager.initialize_device_storage(
            str(current_user.id),
            device_fingerprint
        )
        
        return jsonify(result)
        
    except Exception as e:
        current_app.logger.error(f"Initialize storage error: {e}")
        return jsonify({'error': 'Failed to initialize storage'}), 500

@api_bp.route('/storage/export/<room_id>', methods=['POST'])
@advanced_rate_limit('api/storage')
@login_required
def export_chat_history(room_id):
    """Export chat history"""
    try:
        export_format = request.json.get('format', 'json')
        
        export_path = device_storage_manager.export_chat_history(
            str(current_user.id),
            room_id,
            export_format
        )
        
        if export_path:
            # Create download token
            download_token = web_storage_interface.generate_storage_token(str(current_user.id))
            
            return jsonify({
                'success': True,
                'download_token': download_token,
                'export_path': export_path
            })
        else:
            return jsonify({'error': 'No chat history found'}), 404
            
    except Exception as e:
        current_app.logger.error(f"Export chat history error: {e}")
        return jsonify({'error': 'Failed to export chat history'}), 500

# System management endpoints
@api_bp.route('/system/status', methods=['GET'])
@api_key_required
@advanced_rate_limit('api/system')
def get_system_status():
    """Get comprehensive system status"""
    try:
        status = server_manager.get_system_status()
        
        # Add global access information
        global_status = global_access_manager.get_global_status()
        status['global_access'] = global_status
        
        # Add backup information
        backup_stats = {
            'backup_available': True,
            'last_backup': 'N/A',
            'backup_count': len(backup_manager.list_backups())
        }
        status['backup_system'] = backup_stats
        
        return jsonify(status)
        
    except Exception as e:
        current_app.logger.error(f"System status error: {e}")
        return jsonify({'error': 'Failed to get system status'}), 500

@api_bp.route('/system/metrics', methods=['GET'])
@api_key_required
@advanced_rate_limit('api/system')
def get_system_metrics():
    """Get detailed system metrics"""
    try:
        metrics = server_manager.performance_monitor.get_current_metrics()
        
        # Add rate limiting stats
        from .advanced_rate_limiter import intelligent_rate_limiter
        rate_stats = intelligent_rate_limiter.get_stats()
        metrics['rate_limiting'] = rate_stats
        
        return jsonify(metrics)
        
    except Exception as e:
        current_app.logger.error(f"System metrics error: {e}")
        return jsonify({'error': 'Failed to get system metrics'}), 500

@api_bp.route('/system/backup', methods=['POST'])
@api_key_required
@advanced_rate_limit('api/system')
def create_backup():
    """Create manual backup"""
    try:
        backup_name = backup_manager.create_full_backup()
        
        return jsonify({
            'success': True,
            'backup_name': backup_name,
            'created_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        current_app.logger.error(f"Create backup error: {e}")
        return jsonify({'error': 'Failed to create backup'}), 500

@api_bp.route('/system/backups', methods=['GET'])
@api_key_required
@advanced_rate_limit('api/system')
def list_backups():
    """List available backups"""
    try:
        backups = backup_manager.list_backups()
        
        return jsonify({
            'backups': backups,
            'total_count': len(backups)
        })
        
    except Exception as e:
        current_app.logger.error(f"List backups error: {e}")
        return jsonify({'error': 'Failed to list backups'}), 500

# Global access endpoints
@api_bp.route('/access/urls', methods=['GET'])
@advanced_rate_limit('api/access')
@login_required
def get_access_urls():
    """Get all access URLs for the application"""
    try:
        urls = global_access_manager.get_access_urls()
        
        return jsonify({
            'urls': urls,
            'instructions': {
                'local': 'Use this URL when on the same device',
                'network': 'Use this URL when on the same network',
                'global': 'Use this URL from anywhere in the world',
                'qr_code': 'Scan this QR code with your mobile device'
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Get access URLs error: {e}")
        return jsonify({'error': 'Failed to get access URLs'}), 500

@api_bp.route('/access/setup/<method>', methods=['POST'])
@api_key_required
@advanced_rate_limit('api/access')
def setup_global_access(method):
    """Setup global access using specific method"""
    try:
        if method not in ['ngrok', 'cloudflare', 'localtunnel', 'serveo']:
            return jsonify({'error': 'Invalid access method'}), 400
            
        public_url = global_access_manager.cloud_deployment.setup_global_access(method)
        
        if public_url:
            return jsonify({
                'success': True,
                'public_url': public_url,
                'method': method
            })
        else:
            return jsonify({
                'success': False,
                'error': f'Failed to setup {method} tunnel'
            }), 500
            
    except Exception as e:
        current_app.logger.error(f"Setup global access error: {e}")
        return jsonify({'error': 'Failed to setup global access'}), 500

# Health check endpoint
@api_bp.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '2.0.0'
    })

# Enhanced file upload with scanning
@api_bp.route('/upload', methods=['POST'])
@advanced_rate_limit('api/upload')
@login_required
def upload_file():
    """Upload file with advanced security scanning"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
            
        upload_dir = current_app.config['UPLOAD_FOLDER']
        
        # Use secure file upload from file_security module
        from .file_security import secure_file_upload
        
        result = secure_file_upload(file, upload_dir, str(current_user.id))
        
        return jsonify(result)
        
    except Exception as e:
        current_app.logger.error(f"File upload error: {e}")
        return jsonify({'error': 'Failed to upload file'}), 500

# WebSocket room management
@api_bp.route('/rooms/<room_id>/subscribe', methods=['POST'])
@advanced_rate_limit('api/rooms')
@login_required
def subscribe_to_room(room_id):
    """Subscribe to room for real-time updates"""
    try:
        client_id = request.json.get('client_id')
        if not client_id:
            return jsonify({'error': 'Client ID required'}), 400
            
        fast_message_queue.subscribe_to_room(room_id, client_id)
        
        return jsonify({
            'success': True,
            'subscribed_to': room_id,
            'client_id': client_id
        })
        
    except Exception as e:
        current_app.logger.error(f"Room subscription error: {e}")
        return jsonify({'error': 'Failed to subscribe to room'}), 500

# Error handlers
@api_bp.errorhandler(429)
def rate_limit_exceeded(error):
    """Custom rate limit exceeded handler"""
    return jsonify({
        'error': 'Rate limit exceeded',
        'message': 'Too many requests. Please slow down.',
        'retry_after': getattr(error, 'retry_after', 60)
    }), 429

@api_bp.errorhandler(500)
def internal_server_error(error):
    """Custom internal server error handler"""
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred. Please try again later.'
    }), 500
