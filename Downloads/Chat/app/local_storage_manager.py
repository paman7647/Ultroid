# app/local_storage_manager.py
"""
Secure Local Chat History Storage System
Implements end-to-end encrypted local storage with user consent and device-level security
"""

import os
import json
import sqlite3
import hashlib
import secrets
import gzip
import base64
from datetime import datetime, timedelta
from pathlib import Path
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization
from flask import current_app, request
import logging
from typing import Dict, List, Optional, Tuple
import threading

class DeviceStorageManager:
    """Manages secure local storage on user devices"""
    
    def __init__(self):
        self.storage_dir = None
        self.device_key = None
        self.user_storage = {}
        self.consent_records = {}
        self.storage_lock = threading.RLock()
        self.logger = logging.getLogger(__name__)
        
    def initialize_device_storage(self, user_id: str, device_fingerprint: str) -> Dict:
        """Initialize secure storage for a user device"""
        try:
            # Create user-specific storage directory
            storage_root = Path.home() / '.securechat'
            user_storage_dir = storage_root / f"user_{hashlib.sha256(user_id.encode()).hexdigest()[:16]}"
            user_storage_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate device-specific encryption key
            device_key_path = user_storage_dir / 'device.key'
            if not device_key_path.exists():
                device_key = Fernet.generate_key()
                with open(device_key_path, 'wb') as f:
                    f.write(device_key)
                os.chmod(device_key_path, 0o600)  # Owner read/write only
            else:
                with open(device_key_path, 'rb') as f:
                    device_key = f.read()
                    
            # Initialize user storage record
            with self.storage_lock:
                self.user_storage[user_id] = {
                    'storage_dir': user_storage_dir,
                    'device_key': device_key,
                    'device_fingerprint': device_fingerprint,
                    'initialized': datetime.now().isoformat(),
                    'last_access': datetime.now().isoformat()
                }
                
            self.logger.info(f"Device storage initialized for user {user_id}")
            
            return {
                'success': True,
                'storage_path': str(user_storage_dir),
                'storage_size': self._get_storage_size(user_storage_dir)
            }
            
        except Exception as e:
            self.logger.error(f"Failed to initialize device storage: {e}")
            return {'success': False, 'error': str(e)}
            
    def request_storage_consent(self, user_id: str, chat_partner_id: str, chat_room_id: str) -> str:
        """Request consent for storing chat history locally"""
        consent_id = secrets.token_urlsafe(16)
        
        consent_record = {
            'consent_id': consent_id,
            'user_id': user_id,
            'chat_partner_id': chat_partner_id,
            'chat_room_id': chat_room_id,
            'requested_at': datetime.now().isoformat(),
            'status': 'pending',
            'expires_at': (datetime.now() + timedelta(hours=24)).isoformat()
        }
        
        with self.storage_lock:
            self.consent_records[consent_id] = consent_record
            
        self.logger.info(f"Storage consent requested: {consent_id}")
        return consent_id
        
    def grant_storage_consent(self, consent_id: str, user_id: str) -> bool:
        """Grant consent for local storage"""
        with self.storage_lock:
            if consent_id not in self.consent_records:
                return False
                
            consent = self.consent_records[consent_id]
            
            # Verify consent belongs to user
            if consent['user_id'] != user_id and consent['chat_partner_id'] != user_id:
                return False
                
            # Check expiration
            if datetime.now() > datetime.fromisoformat(consent['expires_at']):
                return False
                
            # Grant consent
            consent['status'] = 'granted'
            consent['granted_at'] = datetime.now().isoformat()
            consent['granted_by'] = user_id
            
        self.logger.info(f"Storage consent granted: {consent_id} by user {user_id}")
        return True
        
    def check_storage_consent(self, user_id: str, chat_partner_id: str, chat_room_id: str) -> bool:
        """Check if both parties have consented to local storage"""
        with self.storage_lock:
            # Find relevant consent records
            user_consents = []
            partner_consents = []
            
            for consent in self.consent_records.values():
                if (consent['chat_room_id'] == chat_room_id and 
                    consent['status'] == 'granted'):
                    
                    if consent['user_id'] == user_id:
                        user_consents.append(consent)
                    elif consent['user_id'] == chat_partner_id:
                        partner_consents.append(consent)
                        
            # Both parties must have granted consent
            return len(user_consents) > 0 and len(partner_consents) > 0
            
    def save_chat_message(self, user_id: str, chat_room_id: str, message: Dict) -> bool:
        """Save encrypted chat message to local storage"""
        try:
            if user_id not in self.user_storage:
                self.logger.warning(f"No storage initialized for user {user_id}")
                return False
                
            storage_info = self.user_storage[user_id]
            storage_dir = storage_info['storage_dir']
            device_key = storage_info['device_key']
            
            # Create chat-specific database
            chat_db_path = storage_dir / f"chat_{hashlib.sha256(chat_room_id.encode()).hexdigest()[:16]}.db"
            
            # Initialize database if needed
            if not chat_db_path.exists():
                self._initialize_chat_database(chat_db_path)
                
            # Encrypt message content
            fernet = Fernet(device_key)
            encrypted_content = fernet.encrypt(json.dumps(message).encode())
            
            # Store in database
            with sqlite3.connect(str(chat_db_path)) as conn:
                conn.execute('''
                    INSERT INTO messages (
                        message_id, sender_id, content_encrypted, timestamp,
                        message_type, file_path, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    message.get('id'),
                    message.get('sender_id'),
                    base64.b64encode(encrypted_content).decode(),
                    message.get('timestamp'),
                    message.get('type', 'text'),
                    message.get('file_path'),
                    datetime.now().isoformat()
                ))
                conn.commit()
                
            # Update last access
            storage_info['last_access'] = datetime.now().isoformat()
            
            self.logger.debug(f"Message saved to local storage for user {user_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to save message to local storage: {e}")
            return False
            
    def retrieve_chat_history(self, user_id: str, chat_room_id: str, limit: int = 100) -> List[Dict]:
        """Retrieve and decrypt chat history from local storage"""
        try:
            if user_id not in self.user_storage:
                return []
                
            storage_info = self.user_storage[user_id]
            storage_dir = storage_info['storage_dir']
            device_key = storage_info['device_key']
            
            chat_db_path = storage_dir / f"chat_{hashlib.sha256(chat_room_id.encode()).hexdigest()[:16]}.db"
            
            if not chat_db_path.exists():
                return []
                
            # Retrieve messages from database
            with sqlite3.connect(str(chat_db_path)) as conn:
                cursor = conn.execute('''
                    SELECT message_id, sender_id, content_encrypted, timestamp,
                           message_type, file_path, created_at
                    FROM messages
                    ORDER BY created_at DESC
                    LIMIT ?
                ''', (limit,))
                
                messages = []
                fernet = Fernet(device_key)
                
                for row in cursor.fetchall():
                    try:
                        # Decrypt message content
                        encrypted_content = base64.b64decode(row[2].encode())
                        decrypted_content = fernet.decrypt(encrypted_content)
                        message_data = json.loads(decrypted_content.decode())
                        
                        # Add database metadata
                        message_data.update({
                            'local_storage': True,
                            'stored_at': row[6]
                        })
                        
                        messages.append(message_data)
                        
                    except Exception as e:
                        self.logger.warning(f"Failed to decrypt message: {e}")
                        continue
                        
                return list(reversed(messages))  # Return in chronological order
                
        except Exception as e:
            self.logger.error(f"Failed to retrieve chat history: {e}")
            return []
            
    def _initialize_chat_database(self, db_path: Path):
        """Initialize SQLite database for chat storage"""
        with sqlite3.connect(str(db_path)) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id TEXT NOT NULL,
                    sender_id TEXT NOT NULL,
                    content_encrypted TEXT NOT NULL,
                    timestamp REAL,
                    message_type TEXT DEFAULT 'text',
                    file_path TEXT,
                    created_at TEXT NOT NULL,
                    INDEX(message_id),
                    INDEX(sender_id),
                    INDEX(created_at)
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            ''')
            
            # Store metadata
            conn.execute('''
                INSERT OR REPLACE INTO metadata (key, value)
                VALUES ('created_at', ?)
            ''', (datetime.now().isoformat(),))
            
            conn.commit()
            
        # Set secure permissions
        os.chmod(db_path, 0o600)
        
    def _get_storage_size(self, storage_dir: Path) -> int:
        """Calculate total storage size used"""
        total_size = 0
        try:
            for file_path in storage_dir.rglob('*'):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
        except Exception:
            pass
        return total_size
        
    def cleanup_expired_consent(self):
        """Clean up expired consent records"""
        current_time = datetime.now()
        expired_consents = []
        
        with self.storage_lock:
            for consent_id, consent in self.consent_records.items():
                if current_time > datetime.fromisoformat(consent['expires_at']):
                    expired_consents.append(consent_id)
                    
            for consent_id in expired_consents:
                del self.consent_records[consent_id]
                
        if expired_consents:
            self.logger.info(f"Cleaned up {len(expired_consents)} expired consent records")
            
    def export_chat_history(self, user_id: str, chat_room_id: str, format: str = 'json') -> Optional[str]:
        """Export chat history in various formats"""
        try:
            messages = self.retrieve_chat_history(user_id, chat_room_id)
            if not messages:
                return None
                
            storage_info = self.user_storage[user_id]
            storage_dir = storage_info['storage_dir']
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            
            if format == 'json':
                export_data = {
                    'export_info': {
                        'user_id': user_id,
                        'chat_room_id': chat_room_id,
                        'exported_at': datetime.now().isoformat(),
                        'message_count': len(messages)
                    },
                    'messages': messages
                }
                
                export_path = storage_dir / f"export_{timestamp}.json"
                with open(export_path, 'w') as f:
                    json.dump(export_data, f, indent=2)
                    
            elif format == 'text':
                export_path = storage_dir / f"export_{timestamp}.txt"
                with open(export_path, 'w') as f:
                    f.write(f"Chat History Export\n")
                    f.write(f"User: {user_id}\n")
                    f.write(f"Room: {chat_room_id}\n")
                    f.write(f"Exported: {datetime.now().isoformat()}\n")
                    f.write("=" * 50 + "\n\n")
                    
                    for message in messages:
                        timestamp = datetime.fromtimestamp(message.get('timestamp', 0))
                        f.write(f"[{timestamp}] {message.get('sender_id', 'Unknown')}: ")
                        f.write(f"{message.get('content', '')}\n")
                        
            # Set secure permissions
            os.chmod(export_path, 0o600)
            
            return str(export_path)
            
        except Exception as e:
            self.logger.error(f"Failed to export chat history: {e}")
            return None
            
    def delete_chat_history(self, user_id: str, chat_room_id: str) -> bool:
        """Securely delete chat history"""
        try:
            if user_id not in self.user_storage:
                return False
                
            storage_info = self.user_storage[user_id]
            storage_dir = storage_info['storage_dir']
            
            chat_db_path = storage_dir / f"chat_{hashlib.sha256(chat_room_id.encode()).hexdigest()[:16]}.db"
            
            if chat_db_path.exists():
                # Secure deletion: overwrite file multiple times
                file_size = chat_db_path.stat().st_size
                
                with open(chat_db_path, 'r+b') as f:
                    for _ in range(3):  # Three-pass overwrite
                        f.seek(0)
                        f.write(secrets.token_bytes(file_size))
                        f.flush()
                        os.fsync(f.fileno())
                        
                chat_db_path.unlink()
                
            self.logger.info(f"Chat history securely deleted for user {user_id}, room {chat_room_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to delete chat history: {e}")
            return False
            
    def get_storage_stats(self, user_id: str) -> Dict:
        """Get storage statistics for a user"""
        if user_id not in self.user_storage:
            return {'error': 'Storage not initialized'}
            
        storage_info = self.user_storage[user_id]
        storage_dir = storage_info['storage_dir']
        
        stats = {
            'storage_path': str(storage_dir),
            'total_size': self._get_storage_size(storage_dir),
            'initialized_at': storage_info['initialized'],
            'last_access': storage_info['last_access'],
            'chat_databases': 0,
            'total_messages': 0
        }
        
        # Count chat databases and messages
        for db_file in storage_dir.glob('chat_*.db'):
            stats['chat_databases'] += 1
            try:
                with sqlite3.connect(str(db_file)) as conn:
                    cursor = conn.execute('SELECT COUNT(*) FROM messages')
                    count = cursor.fetchone()[0]
                    stats['total_messages'] += count
            except Exception:
                pass
                
        return stats

class WebStorageInterface:
    """Interface for web-based storage management"""
    
    def __init__(self, device_storage_manager: DeviceStorageManager):
        self.device_manager = device_storage_manager
        self.logger = logging.getLogger(__name__)
        
    def generate_storage_token(self, user_id: str) -> str:
        """Generate secure token for web storage access"""
        token_data = {
            'user_id': user_id,
            'created_at': datetime.now().isoformat(),
            'expires_at': (datetime.now() + timedelta(hours=1)).isoformat()
        }
        
        # In production, this would use JWT or similar
        token = base64.b64encode(json.dumps(token_data).encode()).decode()
        return token
        
    def validate_storage_token(self, token: str) -> Optional[str]:
        """Validate storage token and return user ID"""
        try:
            token_data = json.loads(base64.b64decode(token.encode()).decode())
            
            # Check expiration
            if datetime.now() > datetime.fromisoformat(token_data['expires_at']):
                return None
                
            return token_data['user_id']
            
        except Exception:
            return None
            
    def create_download_package(self, user_id: str, chat_room_id: str) -> Optional[str]:
        """Create downloadable package of chat history"""
        try:
            # Export as JSON
            export_path = self.device_manager.export_chat_history(
                user_id, chat_room_id, 'json'
            )
            
            if not export_path:
                return None
                
            # Create compressed package
            package_path = export_path.replace('.json', '.gz')
            
            with open(export_path, 'rb') as f_in:
                with gzip.open(package_path, 'wb') as f_out:
                    f_out.write(f_in.read())
                    
            # Clean up original file
            os.remove(export_path)
            
            return package_path
            
        except Exception as e:
            self.logger.error(f"Failed to create download package: {e}")
            return None

# Global instances
device_storage_manager = DeviceStorageManager()
web_storage_interface = WebStorageInterface(device_storage_manager)
