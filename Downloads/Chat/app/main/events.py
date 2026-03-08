# app/main/events.py - Enhanced WebSocket event handlers (Fixed for circular imports)

from flask import g, request, current_app
from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from app.db import get_db
from datetime import datetime
import json

def register_socketio_events(socketio):
    """Register all SocketIO event handlers"""
    
    @socketio.on('connect')
    def connect():
        """Handles new WebSocket connections from clients."""
        if not current_user.is_authenticated:
            emit('error', {'msg': 'Authentication required'})
            return False  # Reject the connection if the user isn't logged in.
        
        # Update user status to online with database lock protection
        try:
            db = get_db()
            db.execute(
                'UPDATE users SET is_online = 1, last_seen = ? WHERE id = ?',
                (datetime.utcnow().isoformat(), current_user.id)
            )
            db.commit()
        except Exception as e:
            current_app.logger.error(f"Error updating user status: {e}")
        
        # Join a general room for this user
        join_room(f'user_{current_user.id}')
        
        # Notify others that this user is online
        emit('user_status', {
            'user_id': current_user.id,
            'username': current_user.username,
            'status': 'online'
        }, broadcast=True)
        
        current_app.logger.info(f"User {current_user.username} connected")
    
    @socketio.on('disconnect')
    def disconnect():
        """Handles client disconnections."""
        if current_user.is_authenticated:
            # Update user status to offline with database lock protection
            try:
                db = get_db()
                db.execute(
                    'UPDATE users SET is_online = 0, last_seen = ? WHERE id = ?',
                    (datetime.utcnow().isoformat(), current_user.id)
                )
                db.commit()
            except Exception as e:
                current_app.logger.error(f"Error updating user status: {e}")
            
            # Leave the user room
            leave_room(f'user_{current_user.id}')
            
            # Notify others that this user is offline
            emit('user_status', {
                'user_id': current_user.id,
                'username': current_user.username,
                'status': 'offline'
            }, broadcast=True)
            
            current_app.logger.info(f"User {current_user.username} disconnected")
    
    @socketio.on('join_chat')
    def join_chat(data):
        """Handle user joining a chat room."""
        room = data.get('room')
        if room and current_user.is_authenticated:
            join_room(room)
            emit('status', {'msg': f'{current_user.username} has joined the chat.'}, room=room)
            current_app.logger.info(f"User {current_user.username} joined room {room}")
    
    @socketio.on('leave_chat')
    def leave_chat(data):
        """Handle user leaving a chat room."""
        room = data.get('room')
        if room and current_user.is_authenticated:
            leave_room(room)
            emit('status', {'msg': f'{current_user.username} has left the chat.'}, room=room)
            current_app.logger.info(f"User {current_user.username} left room {room}")
    
    @socketio.on('send_message')
    def handle_message(data):
        """Handles incoming messages from clients with enhanced security."""
        if not current_user.is_authenticated:
            emit('error', {'msg': 'Authentication required'})
            return
        
        message = data.get('message', '').strip()
        room = data.get('room', 'general')
        
        if not message:
            emit('error', {'msg': 'Message cannot be empty'})
            return
        
        if len(message) > 1000:  # Message length limit
            emit('error', {'msg': 'Message too long'})
            return
        
        try:
            # Import security manager
            from app.security import security_manager
            
            # Encrypt the message if encryption is enabled
            if current_app.config.get('MESSAGE_ENCRYPTION_ENABLED', False):
                try:
                    encrypted_message = security_manager.encrypt_message(message)
                    stored_message = encrypted_message
                except Exception as e:
                    current_app.logger.error(f"Encryption error: {e}")
                    stored_message = message  # Fallback to plaintext
            else:
                stored_message = message
            
            # Store message in database with lock protection
            db = get_db()
            db.execute(
                '''INSERT INTO messages (user_id, username, message, room, timestamp, encrypted)
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (current_user.id, current_user.username, stored_message, room, 
                 datetime.utcnow().isoformat(), current_app.config.get('MESSAGE_ENCRYPTION_ENABLED', False))
            )
            db.commit()
            
            # Prepare response data
            response_data = {
                'message': message,  # Always send decrypted message to client
                'username': current_user.username,
                'user_id': current_user.id,
                'timestamp': datetime.utcnow().isoformat(),
                'room': room
            }
            
            # Broadcast the message to all clients in the room
            emit('message', response_data, room=room)
            
            current_app.logger.info(f"Message sent by {current_user.username} in room {room}")
            
        except Exception as e:
            current_app.logger.error(f"Error handling message: {e}")
            emit('error', {'msg': 'Failed to send message'})
    
    @socketio.on('get_chat_history')
    def get_chat_history(data):
        """Send chat history to the requesting client with decryption."""
        if not current_user.is_authenticated:
            emit('error', {'msg': 'Authentication required'})
            return
        
        room = data.get('room', 'general')
        limit = min(data.get('limit', 50), 100)  # Limit to prevent overload
        
        try:
            db = get_db()
            messages = db.execute(
                '''SELECT user_id, username, message, room, timestamp, encrypted
                   FROM messages 
                   WHERE room = ? 
                   ORDER BY timestamp DESC 
                   LIMIT ?''',
                (room, limit)
            ).fetchall()
            
            # Import security manager for decryption
            from app.security import security_manager
            
            # Process and decrypt messages
            chat_history = []
            for msg in reversed(messages):  # Reverse to get chronological order
                try:
                    # Decrypt message if it was encrypted
                    if msg['encrypted'] and current_app.config.get('MESSAGE_ENCRYPTION_ENABLED', False):
                        try:
                            decrypted_message = security_manager.decrypt_message(msg['message'])
                        except Exception as e:
                            current_app.logger.warning(f"Decryption failed for message: {e}")
                            decrypted_message = "[Encrypted message - decryption failed]"
                    else:
                        decrypted_message = msg['message']
                    
                    chat_history.append({
                        'user_id': msg['user_id'],
                        'username': msg['username'],
                        'message': decrypted_message,
                        'room': msg['room'],
                        'timestamp': msg['timestamp']
                    })
                except Exception as e:
                    current_app.logger.error(f"Error processing message: {e}")
                    continue
            
            emit('chat_history', {'room': room, 'messages': chat_history})
            current_app.logger.info(f"Chat history sent to {current_user.username} for room {room}")
            
        except Exception as e:
            current_app.logger.error(f"Error retrieving chat history: {e}")
            emit('error', {'msg': 'Failed to load chat history'})
    
    @socketio.on('user_typing')
    def handle_typing(data):
        """Handle typing indicators."""
        if not current_user.is_authenticated:
            return
        
        room = data.get('room', 'general')
        is_typing = data.get('typing', False)
        
        emit('user_typing', {
            'username': current_user.username,
            'user_id': current_user.id,
            'typing': is_typing,
            'room': room
        }, room=room, include_self=False)  # Don't send back to sender
    
    @socketio.on('get_user_list')
    def get_user_list():
        """Send list of online users to the requesting client."""
        if not current_user.is_authenticated:
            emit('error', {'msg': 'Authentication required'})
            return
        
        try:
            db = get_db()
            online_users = db.execute(
                '''SELECT id, username, last_seen, is_online
                   FROM users 
                   WHERE is_online = 1
                   ORDER BY username'''
            ).fetchall()
            
            user_list = []
            for user in online_users:
                user_list.append({
                    'id': user['id'],
                    'username': user['username'],
                    'last_seen': user['last_seen'],
                    'is_online': bool(user['is_online'])
                })
            
            emit('user_list', {'users': user_list})
            current_app.logger.info(f"User list sent to {current_user.username}")
            
        except Exception as e:
            current_app.logger.error(f"Error retrieving user list: {e}")
            emit('error', {'msg': 'Failed to load user list'})
