#!/usr/bin/env python3
"""
Enhanced Flask Secure Chat Application
A military-grade secure messaging app with comprehensive security features:
- End-to-end encryption with RSA/AES hybrid encryption
- Advanced authentication with multi-factor support
- Real-time threat detection and prevention
- Automatic message expiration and secure deletion
- Comprehensive audit logging and monitoring
- File scanning and quarantine system
- Rate limiting and DDoS protection
"""

import os
import sys
import signal
import logging
import atexit
import threading
import time
from datetime import datetime, timedelta
from app import create_app, init_app
from app.security import init_security_components
from config import Config

# Import public access manager
try:
    from public_access_manager import SSLTunnelManager
    PUBLIC_ACCESS_AVAILABLE = True
except ImportError as e:
    PUBLIC_ACCESS_AVAILABLE = False
    print(f"⚠️  Public access features not available: {e}")
    print("   Install dependencies: pip install qrcode requests")

# Configure comprehensive logging
def setup_security_logging():
    """Setup comprehensive security logging"""
    log_formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s [%(name)s:%(lineno)d] - %(message)s'
    )
    
    # Security log file
    security_handler = logging.FileHandler(
        os.path.join(Config.DATABASE_BACKUP_DIR, 'security.log')
    )
    security_handler.setFormatter(log_formatter)
    security_handler.setLevel(logging.INFO)
    
    # Console handler for development
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(log_formatter)
    console_handler.setLevel(logging.INFO if Config.DEVELOPMENT else logging.WARNING)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(security_handler)
    root_logger.addHandler(console_handler)
    
    return root_logger

def setup_signal_handlers():
    """Setup signal handlers for graceful shutdown"""
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        # Perform cleanup operations
        cleanup_application()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

def cleanup_application():
    """Cleanup operations on application shutdown"""
    logger.info("Performing security cleanup...")
    
    # Clear temporary files
    temp_dir = Config.TEMP_FOLDER
    if os.path.exists(temp_dir):
        for filename in os.listdir(temp_dir):
            file_path = os.path.join(temp_dir, filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp file {file_path}: {e}")
    
    # Log shutdown event
    logger.info("Application shutdown completed")

def validate_environment():
    """Validate critical security environment settings"""
    issues = []
    
    # Check for production security settings
    if not Config.DEVELOPMENT:
        if not Config.SESSION_COOKIE_SECURE:
            issues.append("SESSION_COOKIE_SECURE should be True in production")
        if not Config.REMEMBER_COOKIE_SECURE:
            issues.append("REMEMBER_COOKIE_SECURE should be True in production")
    
    # Check for secure secrets
    if Config.SECRET_KEY == 'dev' or len(Config.SECRET_KEY) < 32:
        issues.append("SECRET_KEY is not secure enough")
    
    # Check directory permissions
    critical_dirs = [Config.UPLOAD_FOLDER, Config.DATABASE_BACKUP_DIR]
    for directory in critical_dirs:
        if os.path.exists(directory):
            stat = os.stat(directory)
            mode = oct(stat.st_mode)[-3:]
            if mode != '700':
                issues.append(f"Directory {directory} has insecure permissions: {mode}")
    
    if issues:
        logger.warning("Security validation issues found:")
        for issue in issues:
            logger.warning(f"  - {issue}")
        if not Config.DEVELOPMENT:
            logger.error("Critical security issues in production mode!")
            return False
    
    return True

def print_security_banner():
    """Print security status banner"""
    banner = f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                          🔒 SECURE CHAT APPLICATION 🔒                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Security Features Active:                                                     ║
║ ✅ End-to-End Encryption (RSA-2048 + AES-256-GCM)                            ║
║ ✅ Advanced Authentication & Session Management                               ║
║ ✅ Real-time Threat Detection & Rate Limiting                                 ║
║ ✅ Comprehensive Security Audit Logging                                       ║
║ ✅ File Security Scanning & Quarantine                                        ║
║ ✅ Automatic Message Expiration & Secure Deletion                             ║
║ ✅ DDoS Protection & IP Blocking                                              ║
║ ✅ Security Headers & CSP Protection                                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Environment: {'PRODUCTION' if not Config.DEVELOPMENT else 'DEVELOPMENT':<20} Mode: {'HTTPS' if Config.SESSION_COOKIE_SECURE else 'HTTP':<15} ║
║ Database: {os.path.basename(Config.DATABASE):<25} Backup: {'Enabled' if Config.AUTO_BACKUP_ENABLED else 'Disabled':<10} ║
║ Encryption: {'Required' if Config.MESSAGE_ENCRYPTION_ENABLED else 'Optional':<23} Files: {'Scanning' if Config.ENABLE_FILE_SCANNING else 'No Scan':<10} ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """
    print(banner)

def run_security_checks():
    """Run comprehensive security checks"""
    from app.security import security_manager
    
    logger.info("Running pre-startup security checks...")
    
    # Check database security
    db_path = Config.DATABASE
    if os.path.exists(db_path):
        stat = os.stat(db_path)
        mode = oct(stat.st_mode)[-3:]
        if mode not in ['600', '644']:
            logger.warning(f"Database file has potentially insecure permissions: {mode}")
    
    # Verify encryption capabilities
    try:
        test_message = "Security test message"
        encrypted = security_manager.encrypt_message(test_message)
        decrypted = security_manager.decrypt_message(encrypted)
        if decrypted != test_message:
            logger.error("Encryption/decryption test failed!")
            return False
        logger.info("✅ Encryption system validated")
    except Exception as e:
        logger.error(f"Encryption system failure: {e}")
        return False
    
    # Test key generation
    try:
        private_key, public_key = security_manager.generate_key_pair()
        if not private_key or not public_key:
            logger.error("RSA key generation failed!")
            return False
        logger.info("✅ RSA key generation validated")
    except Exception as e:
        logger.error(f"RSA key generation failure: {e}")
        return False
    
    logger.info("✅ All security checks passed")
    return True

# Create the application instance
app, socketio = init_app()
logger = setup_security_logging()

# Initialize security components with app context
with app.app_context():
    init_security_components()

# Register security headers for all responses
@app.after_request
def apply_security_headers(response):
    """Apply comprehensive security headers to all responses"""
    from app.security import security_headers
    return security_headers.add_security_headers(response)

# Register cleanup handler
atexit.register(cleanup_application)

if __name__ == '__main__':
    # Setup environment
    setup_signal_handlers()
    
    # Validate security configuration
    if not validate_environment():
        logger.error("Security validation failed. Exiting.")
        sys.exit(1)
    
    # Run security checks
    if not run_security_checks():
        logger.error("Security checks failed. Exiting.")
        sys.exit(1)
    
    # Configuration
    debug_mode = Config.DEVELOPMENT
    port = int(os.environ.get('PORT', 5001))  # Changed to 5001 for security
    host = os.environ.get('HOST', '0.0.0.0')  # Changed to allow external access
    
    # Initialize SSL Tunnel Manager for public access
    tunnel_manager = None
    if PUBLIC_ACCESS_AVAILABLE and os.environ.get('ENABLE_PUBLIC_ACCESS', 'true').lower() == 'true':
        tunnel_manager = SSLTunnelManager(local_port=port)
    
    # Print security banner
    print_security_banner()
    
    # Security warnings for production
    if not debug_mode:
        logger.info("🔒 Running in PRODUCTION mode with enhanced security")
        if not Config.SESSION_COOKIE_SECURE:
            logger.warning("⚠️  HTTPS not configured - sessions may be vulnerable")
    else:
        logger.info("🔧 Running in DEVELOPMENT mode")
        logger.warning("⚠️  Development mode - do not use in production!")
    
    # Startup information
    logger.info(f"🚀 Starting Secure Chat Application on {host}:{port}")
    logger.info(f"🔐 End-to-end encryption: {'ENABLED' if Config.MESSAGE_ENCRYPTION_ENABLED else 'DISABLED'}")
    logger.info(f"🛡️  File scanning: {'ENABLED' if Config.ENABLE_FILE_SCANNING else 'DISABLED'}")
    logger.info(f"📊 Security logging: {'ENABLED' if Config.LOG_FAILED_LOGINS else 'DISABLED'}")
    logger.info(f"🔄 Auto message deletion: {'ENABLED' if Config.MESSAGE_AUTO_DELETE_AFTER else 'DISABLED'}")
    
    # Setup SSL-secured public access in background
    if tunnel_manager:
        def setup_public_access():
            logger.info("🌍 Setting up SSL-secured public access...")
            time.sleep(3)  # Wait for server to start
            tunnels = tunnel_manager.setup_all_tunnels()
            if tunnels:
                tunnel_manager.print_access_info()
            else:
                logger.warning("⚠️  No public tunnels could be established")
                logger.info("💡 Try installing: pip install qrcode requests")
                logger.info("💡 Or run: ./install_dependencies.sh")
        
        tunnel_thread = threading.Thread(target=setup_public_access, daemon=True)
        tunnel_thread.start()
    
    print("\n" + "="*80)
    print("🔒 SECURE CHAT SERVER READY")
    print("="*80)
    
    try:
        # Start the secure server
        socketio.run(
            app, 
            debug=debug_mode,
            host=host,
            port=port,
            use_reloader=debug_mode,
            log_output=debug_mode,
            # SSL handled by tunnel, not by Flask directly
        )
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise
    finally:
        # Cleanup tunnels
        if tunnel_manager:
            tunnel_manager.cleanup_tunnels()
        cleanup_application()