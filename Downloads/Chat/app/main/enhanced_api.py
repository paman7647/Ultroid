# app/main/enhanced_api.py

from flask import jsonify, request, session
from flask_login import current_user, login_required
from datetime import datetime, timedelta
from app.main import bp
from app.db import get_db
import json

@bp.route('/api/contacts')
@login_required
def get_contacts():
    """Get all contacts with their online status"""
    db = get_db()
    
    # Get all users except current user
    contacts = db.execute('''
        SELECT id, username, display_name, last_seen 
        FROM users 
        WHERE id != ?
        ORDER BY display_name
    ''', (current_user.id,)).fetchall()
    
    contact_list = []
    for contact in contacts:
        # Determine online status based on last_seen
        status = 'offline'
        last_seen_text = 'Unknown'
        
        if contact['last_seen']:
            last_seen = datetime.fromisoformat(contact['last_seen'])
            now = datetime.now()
            diff = now - last_seen
            
            if diff.total_seconds() < 300:  # 5 minutes
                status = 'online'
                last_seen_text = 'Online'
            elif diff.total_seconds() < 3600:  # 1 hour
                status = 'away'
                minutes = int(diff.total_seconds() / 60)
                last_seen_text = f'{minutes} minutes ago'
            elif diff.total_seconds() < 86400:  # 24 hours
                status = 'busy'
                hours = int(diff.total_seconds() / 3600)
                last_seen_text = f'{hours} hours ago'
            else:
                days = int(diff.total_seconds() / 86400)
                last_seen_text = f'{days} days ago'
        
        # Get unread message count (placeholder - you'd implement this based on your message system)
        unread_count = 0
        
        # Get last message (placeholder)
        last_message = "No messages yet"
        
        contact_list.append({
            'id': contact['id'],
            'name': contact['display_name'] or contact['username'],
            'username': contact['username'],
            'status': status,
            'lastSeen': last_seen_text,
            'unreadCount': unread_count,
            'lastMessage': last_message,
            'avatar': f"/api/avatar/{contact['id']}"
        })
    
    return jsonify(contact_list)

@bp.route('/api/messages/<int:contact_id>')
@login_required
def get_messages(contact_id):
    """Get messages with a specific contact"""
    db = get_db()
    
    # This is a placeholder - you'd implement message retrieval based on your schema
    # For now, return mock data
    messages = [
        {
            'id': 1,
            'type': 'received',
            'content': 'Hello! How are you?',
            'timestamp': (datetime.now() - timedelta(hours=1)).isoformat(),
            'status': 'delivered'
        },
        {
            'id': 2,
            'type': 'sent',
            'content': 'I\'m doing great, thanks!',
            'timestamp': (datetime.now() - timedelta(minutes=30)).isoformat(),
            'status': 'read'
        }
    ]
    
    return jsonify(messages)

@bp.route('/api/send-message', methods=['POST'])
@login_required
def send_message():
    """Send a message to a contact"""
    data = request.get_json()
    
    if not data or 'content' not in data or 'recipient_id' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    content = data['content']
    recipient_id = data['recipient_id']
    
    # Here you would save the message to the database
    # For now, just return success
    message = {
        'id': datetime.now().timestamp(),
        'type': 'sent',
        'content': content,
        'timestamp': datetime.now().isoformat(),
        'status': 'sent'
    }
    
    return jsonify(message)

@bp.route('/api/update-last-seen', methods=['POST'])
@login_required
def update_last_seen():
    """Update user's last seen timestamp"""
    db = get_db()
    
    try:
        db.execute('''
            UPDATE users 
            SET last_seen = ? 
            WHERE id = ?
        ''', (datetime.now().isoformat(), current_user.id))
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/user-preferences')
@login_required
def get_user_preferences():
    """Get user's chat preferences"""
    # This would typically be stored in the database
    # For now, return default preferences
    preferences = {
        'theme': 'dark',
        'messageStyle': 'rounded',
        'privacy': {
            'showOnlineStatus': True,
            'showLastSeen': True,
            'readReceipts': True,
            'typingIndicators': True,
            'autoDelete': False,
            'soundNotifications': True,
            'desktopNotifications': True,
            'vibration': True
        }
    }
    
    return jsonify(preferences)

@bp.route('/api/user-preferences', methods=['POST'])
@login_required
def update_user_preferences():
    """Update user's chat preferences"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Here you would save preferences to the database
    # For now, just return success
    return jsonify({'success': True})

@bp.route('/api/typing-status', methods=['POST'])
@login_required
def update_typing_status():
    """Update typing status for a conversation"""
    data = request.get_json()
    
    if not data or 'contact_id' not in data or 'typing' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    contact_id = data['contact_id']
    typing = data['typing']
    
    # Here you would broadcast typing status to the recipient
    # For now, just return success
    return jsonify({'success': True})

@bp.route('/api/avatar/<int:user_id>')
def get_avatar(user_id):
    """Generate or retrieve user avatar"""
    db = get_db()
    
    user = db.execute('''
        SELECT username, display_name 
        FROM users 
        WHERE id = ?
    ''', (user_id,)).fetchone()
    
    if not user:
        return '', 404
    
    # Generate initials
    name = user['display_name'] or user['username']
    initials = ''.join([word[0].upper() for word in name.split()[:2]])
    if len(initials) == 1:
        initials = name[:2].upper()
    
    # Generate color based on user ID
    colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    color = colors[user_id % len(colors)]
    
    # Return SVG avatar
    svg = f'''<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
        <circle cx='50' cy='50' r='45' fill='{color}'/>
        <text x='50' y='60' font-size='32' text-anchor='middle' fill='white' font-family='Arial'>{initials}</text>
    </svg>'''
    
    from flask import Response
    return Response(svg, mimetype='image/svg+xml')

@bp.route('/api/online-users')
@login_required
def get_online_users():
    """Get list of currently online users"""
    db = get_db()
    
    # Consider users online if they were active in the last 5 minutes
    cutoff_time = (datetime.now() - timedelta(minutes=5)).isoformat()
    
    online_users = db.execute('''
        SELECT id, username, display_name 
        FROM users 
        WHERE last_seen > ? AND id != ?
    ''', (cutoff_time, current_user.id)).fetchall()
    
    user_list = []
    for user in online_users:
        user_list.append({
            'id': user['id'],
            'name': user['display_name'] or user['username'],
            'username': user['username']
        })
    
    return jsonify(user_list)

@bp.route('/api/mark-messages-read', methods=['POST'])
@login_required
def mark_messages_read():
    """Mark messages as read"""
    data = request.get_json()
    
    if not data or 'contact_id' not in data:
        return jsonify({'error': 'Missing contact_id'}), 400
    
    contact_id = data['contact_id']
    
    # Here you would update message read status in the database
    # For now, just return success
    return jsonify({'success': True})

@bp.route('/api/search-messages')
@login_required
def search_messages():
    """Search messages by content"""
    query = request.args.get('q', '')
    
    if not query:
        return jsonify([])
    
    # Here you would search messages in the database
    # For now, return empty results
    return jsonify([])

@bp.route('/api/delete-message', methods=['DELETE'])
@login_required
def delete_message():
    """Delete a message"""
    data = request.get_json()
    
    if not data or 'message_id' not in data:
        return jsonify({'error': 'Missing message_id'}), 400
    
    message_id = data['message_id']
    
    # Here you would delete the message from the database
    # For now, just return success
    return jsonify({'success': True})

@bp.route('/api/upload-file', methods=['POST'])
@login_required
def upload_file():
    """Handle file upload"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Here you would save the file and return file info
    # For now, just return mock file info
    file_info = {
        'id': datetime.now().timestamp(),
        'name': file.filename,
        'size': 0,  # You would get actual size
        'url': f'/uploads/{file.filename}',
        'type': file.content_type
    }
    
    return jsonify(file_info)
