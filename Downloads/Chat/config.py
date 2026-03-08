# config.py
# Advanced Security Configuration for Flask Secure Chat Application
import os
import datetime
import secrets

# Get the absolute path for the project's root directory.
basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    
    # SECURITY: Generate a cryptographically secure secret key
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_urlsafe(32)
    
    # SECURITY: Additional security keys for different purposes
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY') or secrets.token_urlsafe(32)
    CSRF_SECRET_KEY = os.environ.get('CSRF_SECRET_KEY') or secrets.token_urlsafe(32)
    
    # Database configuration with security
    DATABASE = os.path.join(basedir, 'secure_chat.db')
    DATABASE_BACKUP_DIR = os.path.join(basedir, 'backups')
    
    # SECURITY: Secure file upload configuration
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    TEMP_FOLDER = os.path.join(basedir, 'temp')
    QUARANTINE_FOLDER = os.path.join(basedir, 'quarantine')
    
    # SECURITY: Restricted file extensions and MIME types
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'}
    ALLOWED_MIME_TYPES = {
        'text/plain', 'application/pdf', 'image/png', 
        'image/jpeg', 'image/gif'
    }
    BLOCKED_EXTENSIONS = {
        'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
        'php', 'asp', 'aspx', 'jsp', 'py', 'pl', 'sh', 'ps1'
    }
    
    # SECURITY: File size limits (8MB max)
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024
    MAX_MESSAGE_LENGTH = 5000
    MAX_USERNAME_LENGTH = 30
    MAX_DISPLAY_NAME_LENGTH = 50
    
    # SECURITY: Session and cookie configuration
    PERMANENT_SESSION_LIFETIME = datetime.timedelta(hours=2)
    SESSION_COOKIE_SECURE = os.environ.get('HTTPS_TUNNEL', 'false').lower() == 'true'  # Auto-detect HTTPS tunnels
    SESSION_COOKIE_HTTPONLY = True  # No JavaScript access
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_NAME = 'secure_chat_session'
    
    # SECURITY: Remember me cookie configuration  
    REMEMBER_COOKIE_DURATION = datetime.timedelta(days=7)  # Reduced from 30 days
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SECURE = os.environ.get('HTTPS_TUNNEL', 'false').lower() == 'true'  # Auto-detect HTTPS tunnels
    REMEMBER_COOKIE_SAMESITE = 'Lax'
    
    # SECURITY: Rate limiting configuration (relaxed for development)
    RATE_LIMIT_LOGIN_ATTEMPTS = 20  # Increased for development
    RATE_LIMIT_LOGIN_WINDOW = 900  # 15 minutes
    RATE_LIMIT_MESSAGE_SENDS = 100  # Increased for development
    RATE_LIMIT_MESSAGE_WINDOW = 60  # 1 minute
    RATE_LIMIT_REGISTRATION = 10  # Increased for development
    RATE_LIMIT_REGISTRATION_WINDOW = 3600  # 1 hour
    
    # SECURITY: Password policy (relaxed for development)
    MIN_PASSWORD_LENGTH = 6  # Reduced for development ease
    REQUIRE_PASSWORD_UPPERCASE = False  # Relaxed for development
    REQUIRE_PASSWORD_LOWERCASE = False  # Relaxed for development
    REQUIRE_PASSWORD_NUMBERS = False    # Relaxed for development
    REQUIRE_PASSWORD_SPECIAL = False    # Relaxed for development
    PASSWORD_HISTORY_COUNT = 3  # Reduced for development
    
    # SECURITY: Account lockout configuration (relaxed for development)
    MAX_FAILED_LOGIN_ATTEMPTS = 10  # Increased for development
    ACCOUNT_LOCKOUT_DURATION = 300   # 5 minutes (reduced for development)
    
    # SECURITY: Message security
    MESSAGE_ENCRYPTION_ENABLED = True
    MESSAGE_AUTO_DELETE_AFTER = 86400  # 24 hours
    MESSAGE_MAX_RECIPIENTS = 50
    DISAPPEARING_MESSAGE_DEFAULT = True
    
    # SECURITY: File security scanning
    ENABLE_FILE_SCANNING = True
    VIRUS_SCAN_ENABLED = True
    FILE_QUARANTINE_ENABLED = True
    
    # SECURITY: Logging and monitoring
    SECURITY_LOG_FILE = os.path.join(basedir, 'logs', 'security.log')
    LOG_FAILED_LOGINS = True
    LOG_SUCCESSFUL_LOGINS = True
    LOG_ADMIN_ACTIONS = True
    LOG_FILE_UPLOADS = True
    
    # SECURITY: IP and network security
    TRUSTED_PROXIES = []  # Add trusted proxy IPs
    BLOCKED_IPS = set()
    ALLOWED_IPS = set()  # If set, only these IPs allowed
    
    # SECURITY: Headers and CORS
    ENABLE_SECURITY_HEADERS = True
    ENABLE_CSRF_PROTECTION = True
    CORS_ORIGINS = ['http://localhost:5000', 'https://localhost:5000']
    
    # SECURITY: Encryption settings
    ENCRYPTION_ALGORITHM = 'AES-256-GCM'
    KEY_DERIVATION_ITERATIONS = 100000
    SALT_LENGTH = 32
    
    # SECURITY: WebSocket security
    SOCKETIO_REQUIRE_AUTH = True
    SOCKETIO_CORS_ALLOWED_ORIGINS = CORS_ORIGINS
    
    # Application limits
    USER_SEARCH_RESULTS_LIMIT = 10
    GROUP_SEARCH_RESULTS_LIMIT = 10
    HISTORY_MESSAGES_LIMIT = 50
    MAX_CONCURRENT_SESSIONS = 3  # Max sessions per user
    
    # SECURITY: Backup and recovery
    AUTO_BACKUP_ENABLED = True
    BACKUP_RETENTION_DAYS = 30
    BACKUP_ENCRYPTION_ENABLED = True
    
    # SECURITY: Development vs Production
    DEVELOPMENT = os.environ.get('FLASK_ENV', 'development') == 'development'
    
    @classmethod
    def init_app(cls, app):
        """Initialize security settings for the application"""
        # Create necessary directories
        for directory in [cls.UPLOAD_FOLDER, cls.TEMP_FOLDER, cls.QUARANTINE_FOLDER, 
                         cls.DATABASE_BACKUP_DIR]:
            os.makedirs(directory, exist_ok=True)
            os.chmod(directory, 0o700)  # Restrict permissions
        
        # Set secure defaults for production or HTTPS tunnels
        is_https_tunnel = os.environ.get('HTTPS_TUNNEL', 'false').lower() == 'true'
        if not cls.DEVELOPMENT or is_https_tunnel:
            app.config['SESSION_COOKIE_SECURE'] = is_https_tunnel
            app.config['REMEMBER_COOKIE_SECURE'] = is_https_tunnel
            if is_https_tunnel:
                app.config['PREFERRED_URL_SCHEME'] = 'https'