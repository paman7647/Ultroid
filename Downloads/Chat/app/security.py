# app/security.py
"""
Advanced Security Module for Secure Chat Application
Implements multiple layers of security including encryption, authentication, and protection mechanisms.
"""

import os
import hashlib
import hmac
import base64
import secrets
import time
import json
from datetime import datetime, timedelta
from functools import wraps
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from flask import request, jsonify, current_app, session
from flask_login import current_user
import re

class SecurityManager:
    """Advanced security manager with multiple protection layers"""
    
    def __init__(self):
        self.failed_attempts = {}
        self.blocked_ips = {}
        self.encryption_key = self._generate_or_load_key()
        self.fernet = Fernet(self.encryption_key)
        self.session_tokens = {}
        
    def _generate_or_load_key(self):
        """Generate or load encryption key securely"""
        key_file = os.path.join(current_app.instance_path, 'security.key')
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            os.makedirs(os.path.dirname(key_file), exist_ok=True)
            with open(key_file, 'wb') as f:
                f.write(key)
            os.chmod(key_file, 0o600)  # Restrict file permissions
            return key
    
    def generate_secure_token(self, length=32):
        """Generate cryptographically secure random token"""
        return secrets.token_urlsafe(length)
    
    def hash_password_advanced(self, password, salt=None):
        """Advanced password hashing with PBKDF2"""
        if salt is None:
            salt = secrets.token_bytes(32)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=64,
            salt=salt,
            iterations=100000,
        )
        key = kdf.derive(password.encode())
        return base64.b64encode(salt + key).decode()
    
    def verify_password_advanced(self, password, hashed):
        """Verify password against advanced hash"""
        try:
            decoded = base64.b64decode(hashed.encode())
            salt = decoded[:32]
            stored_key = decoded[32:]
            
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=64,
                salt=salt,
                iterations=100000,
            )
            
            try:
                kdf.verify(password.encode(), stored_key)
                return True
            except:
                return False
        except:
            return False
    
    def encrypt_message(self, message):
        """Encrypt message with timestamp and integrity check"""
        timestamp = str(int(time.time()))
        data = json.dumps({
            'message': message,
            'timestamp': timestamp,
            'checksum': hashlib.sha256(message.encode()).hexdigest()
        })
        return self.fernet.encrypt(data.encode()).decode()
    
    def decrypt_message(self, encrypted_message, max_age=3600):
        """Decrypt message with integrity and freshness verification"""
        try:
            decrypted_data = self.fernet.decrypt(encrypted_message.encode())
            data = json.loads(decrypted_data.decode())
            
            # Check message freshness
            message_time = int(data['timestamp'])
            if time.time() - message_time > max_age:
                raise ValueError("Message expired")
            
            # Verify integrity
            message = data['message']
            expected_checksum = hashlib.sha256(message.encode()).hexdigest()
            if data['checksum'] != expected_checksum:
                raise ValueError("Message integrity check failed")
            
            return message
        except Exception as e:
            current_app.logger.error(f"Message decryption failed: {e}")
            return None
    
    def generate_key_pair(self):
        """Generate RSA key pair for end-to-end encryption"""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        public_key = private_key.public_key()
        
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        return private_pem.decode(), public_pem.decode()
    
    def encrypt_with_public_key(self, message, public_key_pem):
        """Encrypt message with recipient's public key"""
        try:
            public_key = serialization.load_pem_public_key(public_key_pem.encode())
            encrypted = public_key.encrypt(
                message.encode(),
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            return base64.b64encode(encrypted).decode()
        except Exception as e:
            current_app.logger.error(f"Public key encryption failed: {e}")
            return None
    
    def decrypt_with_private_key(self, encrypted_message, private_key_pem):
        """Decrypt message with private key"""
        try:
            private_key = serialization.load_pem_private_key(
                private_key_pem.encode(),
                password=None
            )
            encrypted_bytes = base64.b64decode(encrypted_message.encode())
            decrypted = private_key.decrypt(
                encrypted_bytes,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            return decrypted.decode()
        except Exception as e:
            current_app.logger.error(f"Private key decryption failed: {e}")
            return None

class SecurityValidator:
    """Input validation and sanitization"""
    
    @staticmethod
    def validate_username(username):
        """Validate username format and security"""
        if not username or len(username) < 3 or len(username) > 30:
            return False, "Username must be 3-30 characters"
        
        if not re.match(r'^[a-zA-Z0-9_-]+$', username):
            return False, "Username can only contain letters, numbers, hyphens, and underscores"
        
        # Check for common attack patterns
        dangerous_patterns = ['admin', 'root', 'system', 'test', 'guest']
        if username.lower() in dangerous_patterns:
            return False, "Username not allowed"
        
        return True, "Valid"
    
    @staticmethod
    def validate_password(password):
        """Development-friendly password validation"""
        from flask import current_app
        
        # Get configuration with development-friendly defaults
        min_length = current_app.config.get('MIN_PASSWORD_LENGTH', 6)
        require_uppercase = current_app.config.get('REQUIRE_PASSWORD_UPPERCASE', False)
        require_lowercase = current_app.config.get('REQUIRE_PASSWORD_LOWERCASE', False)
        require_numbers = current_app.config.get('REQUIRE_PASSWORD_NUMBERS', False)
        require_special = current_app.config.get('REQUIRE_PASSWORD_SPECIAL', False)
        
        if not password or len(password) < min_length:
            return False, f"Password must be at least {min_length} characters"
        
        # Only apply strict checks if configured (for production)
        failed_checks = []
        
        if require_uppercase and not re.search(r'[A-Z]', password):
            failed_checks.append('uppercase letter')
        
        if require_lowercase and not re.search(r'[a-z]', password):
            failed_checks.append('lowercase letter')
            
        if require_numbers and not re.search(r'\d', password):
            failed_checks.append('number')
            
        if require_special and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            failed_checks.append('special character')
        
        if failed_checks:
            return False, f"Password must contain: {', '.join(failed_checks)}"
        
        # Only check for weak passwords in production
        if not current_app.config.get('DEVELOPMENT', True):
            weak_patterns = ['password', '123456', 'qwerty', 'admin']
            if any(pattern in password.lower() for pattern in weak_patterns):
                return False, "Password contains common weak patterns"
        
        return True, "Valid password"
    
    @staticmethod
    def sanitize_message(message):
        """Sanitize message content"""
        if not message:
            return ""
        
        # Remove potential XSS vectors
        message = re.sub(r'<script[^>]*>.*?</script>', '', message, flags=re.IGNORECASE | re.DOTALL)
        message = re.sub(r'javascript:', '', message, flags=re.IGNORECASE)
        message = re.sub(r'on\w+\s*=', '', message, flags=re.IGNORECASE)
        
        # Limit message length
        if len(message) > 5000:
            message = message[:5000]
        
        return message.strip()

class RateLimiter:
    """Advanced rate limiting with multiple strategies"""
    
    def __init__(self):
        self.requests = {}
        self.blocked_ips = {}
    
    def is_rate_limited(self, identifier, limit=10, window=60):
        """Check if identifier is rate limited"""
        # For development, be more lenient
        development_mode = os.environ.get('FLASK_ENV') == 'development'
        if development_mode:
            limit = limit * 5  # 5x more generous in development
            
        current_time = time.time()
        
        # Clean old entries
        self.requests = {
            k: [req for req in v if current_time - req < window]
            for k, v in self.requests.items()
        }
        
        if identifier not in self.requests:
            self.requests[identifier] = []
        
        self.requests[identifier].append(current_time)
        
        if len(self.requests[identifier]) > limit:
            # In development, don't block IPs as aggressively
            if development_mode:
                # Only track but don't block in development
                return False
            else:
                # Block for progressively longer periods in production
                block_duration = min(3600, 60 * (len(self.requests[identifier]) - limit))
                self.blocked_ips[identifier] = current_time + block_duration
                return True
        
        return False
    
    def is_blocked(self, identifier):
        """Check if identifier is currently blocked"""
        if identifier in self.blocked_ips:
            if time.time() < self.blocked_ips[identifier]:
                return True
            else:
                del self.blocked_ips[identifier]
        return False
        
    def clear_blocks(self):
        """Clear all blocked IPs (for development)"""
        self.blocked_ips.clear()
        self.requests.clear()
        
    def unblock_ip(self, identifier):
        """Unblock a specific IP address"""
        if identifier in self.blocked_ips:
            del self.blocked_ips[identifier]
        if identifier in self.requests:
            del self.requests[identifier]

class SecurityHeaders:
    """Security headers for HTTP responses"""
    
    @staticmethod
    def add_security_headers(response):
        """Add comprehensive security headers"""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' ws: wss:; "
            "font-src 'self'; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = (
            "geolocation=(), microphone=(), camera=(), "
            "payment=(), usb=(), magnetometer=(), gyroscope=()"
        )
        return response

# Global instances - initialized later to avoid circular imports
security_manager = None
security_validator = None
rate_limiter = None
security_headers = None

def init_security_components():
    """Initialize security components after app context is available"""
    global security_manager, security_validator, rate_limiter, security_headers
    if security_manager is None:
        security_manager = SecurityManager()
        security_validator = SecurityValidator()
        rate_limiter = RateLimiter()
        security_headers = SecurityHeaders()

# Decorators for security
def require_auth(f):
    """Decorator for requiring authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def rate_limit(limit=10, window=60):
    """Decorator for rate limiting"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            identifier = request.remote_addr
            if rate_limiter.is_blocked(identifier):
                return jsonify({'error': 'IP blocked due to abuse'}), 429
            
            if rate_limiter.is_rate_limited(identifier, limit, window):
                return jsonify({'error': 'Rate limit exceeded'}), 429
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def validate_input(validators):
    """Decorator for input validation"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            for field, validator in validators.items():
                value = request.form.get(field) or request.json.get(field) if request.json else None
                if value:
                    is_valid, message = validator(value)
                    if not is_valid:
                        return jsonify({'error': f'{field}: {message}'}), 400
            return f(*args, **kwargs)
        return decorated_function
    return decorator
