# app/main/events.py - Enhanced WebSocket event handlers

from flask import g, request, current_app
from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from app.db import get_db
from datetime import datetime
import json

def get_socketio():
    """Get socketio instance from current app"""
    return current_app.socketio

@current_app.socketio.on('connect')
def connect():
    """Handles new WebSocket connections from clients."""
    if not current_user.is_authenticated:
        emit('error', {'msg': 'Authentication required'})
        return False  # Reject the connection if the user isn't logged in.

    print(f'User {current_user.username} connected with session ID: {request.sid}')
    
    db = get_db()
    # Fetch all groups (private and group chats) the user is a member of.
    try:
        groups = db.execute(
            'SELECT g.id FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?',
            (current_user.id,)
        ).fetchall()
    except:
        # If groups table doesn't exist yet, create mock data
        groups = []

    # The user joins a Socket.IO room for each group they are in.
    for group in groups:
        join_room(f'chat_{group["id"]}')
    
    # The user also joins a room named after their own user ID.
    join_room(f'user_{current_user.id}')
    
    emit('status', {'msg': f'Welcome {current_user.display_name}! Connected successfully.'})
    emit('connection_established', {
        'user_id': current_user.id,
        'display_name': current_user.display_name,
        'groups': [g['id'] for g in groups]
    })

@socketio.on('disconnect')
def disconnect():
    """Handles client disconnections."""
    if current_user.is_authenticated:
        print(f'User {current_user.username} disconnected')
        # Update last seen timestamp
        db = get_db()
        try:
            db.execute(
                'UPDATE users SET last_seen = ? WHERE id = ?',
                (datetime.now().isoformat(), current_user.id)
            )
            db.commit()
        except:
            pass  # Ignore errors for now
    else:
        print('Anonymous user disconnected')

@socketio.on('join_chat')
def handle_join_chat(data):
    """Handle user joining a specific chat room"""
    if not current_user.is_authenticated:
        emit('error', {'msg': 'Authentication required'})
        return
    
    group_id = data.get('group_id')
    if group_id:
        join_room(f'chat_{group_id}')
        emit('status', {'msg': f'Joined chat {group_id}'})
        print(f'User {current_user.username} joined chat {group_id}')

@socketio.on('leave_chat')
def handle_leave_chat(data):
    """Handle user leaving a specific chat room"""
    if not current_user.is_authenticated:
        return
    
    group_id = data.get('group_id')
    if group_id:
        leave_room(f'chat_{group_id}')
        emit('status', {'msg': f'Left chat {group_id}'})
        print(f'User {current_user.username} left chat {group_id}')

@socketio.on('send_message')
def handle_send_message(data):
    """
    Handles receiving a new message from a client.
    The 'data' dictionary contains the message content and group ID.
    """
    if not current_user.is_authenticated:
        emit('error', {'msg': 'Authentication required'})
        return

    group_id = data.get('group_id')
    content = data.get('content')
    timestamp = data.get('timestamp', datetime.now().isoformat())

    if not group_id or not content:
        emit('error', {'msg': 'Missing required fields: group_id and content'})
        return

    print(f'Received message from {current_user.username} for group {group_id}: {content}')

    db = get_db()
    try:
        # Save the message to the database
        message_id = db.execute(
            '''INSERT INTO messages (sender_id, recipient_group_id, content, timestamp)
               VALUES (?, ?, ?, ?)''',
            (current_user.id, group_id, content, timestamp)
        ).lastrowid
        db.commit()
        
        # Prepare message data for broadcast
        message_data = {
            'id': message_id,
            'content': content,
            'sender_id': current_user.id,
            'sender_display_name': current_user.display_name,
            'group_id': group_id,
            'timestamp': timestamp
        }
        
        # Broadcast the message to all members of the group
        emit('receive_message', message_data, room=f'chat_{group_id}', include_self=False)
        
        # Send confirmation back to sender
        emit('message_sent', {
            'id': message_id,
            'group_id': group_id,
            'timestamp': timestamp
        })
        
        print(f'Message {message_id} broadcasted to chat_{group_id}')
        
    except Exception as e:
        print(f'Error saving/broadcasting message: {e}')
        emit('error', {'msg': 'Failed to send message'})

@socketio.on('get_chat_history')
def handle_get_chat_history(data):
    """Retrieve chat history for a specific group"""
    if not current_user.is_authenticated:
        emit('error', {'msg': 'Authentication required'})
        return
    
    group_id = data.get('group_id')
    limit = data.get('limit', 50)
    
    if not group_id:
        emit('error', {'msg': 'Group ID required'})
        return
    
    db = get_db()
    try:
        messages = db.execute(
            '''SELECT m.id, m.content, m.timestamp, m.sender_id, u.display_name
               FROM messages m
               JOIN users u ON m.sender_id = u.id
               WHERE m.recipient_group_id = ?
               ORDER BY m.timestamp DESC
               LIMIT ?''',
            (group_id, limit)
        ).fetchall()
        
        message_list = []
        for msg in messages:
            message_list.append({
                'id': msg['id'],
                'content': msg['content'],
                'timestamp': msg['timestamp'],
                'sender_id': msg['sender_id'],
                'sender_display_name': msg['display_name'],
                'sent': msg['sender_id'] == current_user.id
            })
        
        # Reverse to show oldest first
        message_list.reverse()
        
        emit('chat_history', {
            'group_id': group_id,
            'messages': message_list
        })
        
    except Exception as e:
        print(f'Error retrieving chat history: {e}')
        emit('error', {'msg': 'Failed to retrieve chat history'})

@socketio.on('user_typing')
def handle_user_typing(data):
    """Handle typing indicators"""
    if not current_user.is_authenticated:
        return
    
    group_id = data.get('group_id')
    is_typing = data.get('is_typing', False)
    
    if group_id:
        emit('user_typing', {
            'user_id': current_user.id,
            'user_name': current_user.display_name,
            'is_typing': is_typing
        }, room=f'chat_{group_id}', include_self=False)

@socketio.on('get_user_list')
def handle_get_user_list():
    """Get list of all users for contact discovery"""
    if not current_user.is_authenticated:
        emit('error', {'msg': 'Authentication required'})
        return
    
    db = get_db()
    try:
        users = db.execute(
            'SELECT id, username, display_name, last_seen FROM users WHERE id != ?',
            (current_user.id,)
        ).fetchall()
        
        user_list = []
        for user in users:
            user_list.append({
                'id': user['id'],
                'username': user['username'],
                'display_name': user['display_name'],
                'last_seen': user['last_seen']
            })
        
        emit('user_list', {'users': user_list})
        
    except Exception as e:
        print(f'Error retrieving user list: {e}')
        emit('error', {'msg': 'Failed to retrieve user list'})