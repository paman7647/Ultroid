# app/models.py

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class User(UserMixin):
    """A class to represent a user, compatible with Flask-Login."""
    def __init__(self, id, username, display_name, password_hash=None, public_key=None, last_seen=None):
        self.id = id
        self.username = username
        self.display_name = display_name
        self.password_hash = password_hash
        self.public_key = public_key
        self.last_seen = last_seen

    def set_password(self, password):
        """Creates a secure hash for a given password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Checks if a given password matches the hash."""
        return check_password_hash(self.password_hash, password)
    
    @staticmethod
    def get_by_id(user_id):
        """Get a user by their ID."""
        from .db import get_db
        db = get_db()
        user_row = db.execute(
            'SELECT * FROM users WHERE id = ? AND active = 1', 
            (user_id,)
        ).fetchone()
        if not user_row:
            return None
        return row_to_user(user_row)

class Group:
    """A class to represent a chat group or a private chat."""
    def __init__(self, id, name, created_by_user_id, is_private_chat, disappearing_duration_seconds, description=None):
        self.id = id
        self.name = name
        self.description = description
        self.created_by_user_id = created_by_user_id
        self.is_private_chat = is_private_chat
        self.disappearing_duration_seconds = disappearing_duration_seconds

class Message:
    """A class to represent a single chat message."""
    def __init__(self, id, sender_id, recipient_group_id, content, message_type, timestamp, expires_at=None):
        self.id = id
        self.sender_id = sender_id
        self.recipient_group_id = recipient_group_id
        self.content = content
        self.message_type = message_type
        self.timestamp = timestamp
        self.expires_at = expires_at

def row_to_user(row):
    """Converts a database row (sqlite3.Row) into a User object."""
    if not row:
        return None
    
    return User(
        id=row['id'],
        username=row['username'],
        display_name=row['display_name'],
        password_hash=row['password_hash'],
        public_key=row['public_key'] if 'public_key' in row.keys() else None,
        last_seen=row['last_seen'] if 'last_seen' in row.keys() else None
    )