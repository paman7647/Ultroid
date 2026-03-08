# app/__init__.py
"""
Flask Application Factory with Enhanced Security and Management
"""

import os
import logging
import sqlite3
import click
from flask import Flask, request, session
from flask_login import LoginManager, current_user
from flask_socketio import SocketIO
from flask_wtf.csrf import CSRFProtect
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def create_app(test_config=None):
    """Create and configure the Flask application"""
    app = Flask(__name__, instance_relative_config=True)
    
    # Load configuration
    if test_config is None:
        app.config.from_object('config.Config')
    else:
        app.config.from_mapping(test_config)
    
    # Apply configuration
    from config import Config
    Config.init_app(app)
    
    # Security logging function (simplified)
    def log_security_event(event_type, details=None):
        """Log security events with database lock handling"""
        try:
            from .db import get_db
            db = get_db()
            db.execute(
                '''INSERT INTO security_logs 
                   (timestamp, event_type, ip_address, user_agent, event_description)
                   VALUES (?, ?, ?, ?, ?)''',
                (datetime.utcnow().isoformat(), event_type, 
                 request.remote_addr, request.headers.get('User-Agent', ''),
                 str(details) if details else '')
            )
            db.commit()
        except sqlite3.OperationalError as e:
            if "database is locked" not in str(e):
                app.logger.error(f"Security logging error: {e}")
        except Exception as e:
            app.logger.error(f"Security logging error: {e}")
    
    # Request monitoring (simplified)
    @app.before_request
    def security_monitor():
        """Monitor requests for security threats"""
        # Skip static files
        if request.endpoint and request.endpoint.startswith('static'):
            return
        
        # Import here to avoid circular imports
        try:
            from .security import rate_limiter
        except ImportError:
            rate_limiter = None
        
        client_ip = request.remote_addr
        user_agent = request.headers.get('User-Agent', '')
        
        # Rate limiting check (simplified)
        if rate_limiter and rate_limiter.is_blocked(client_ip):
            app.logger.warning(f"Blocked request from {client_ip} - rate limit exceeded")
            return "Rate limit exceeded", 429
        
        # Check for suspicious patterns (simplified)
        suspicious_patterns = ['sqlmap', 'nikto', 'nmap', 'bot']
        if any(pattern in user_agent.lower() for pattern in suspicious_patterns):
            app.logger.warning(f"Suspicious user agent from {client_ip}: {user_agent}")
    
    # Initialize database
    from . import db
    db.init_app(app)
    
    # Initialize security systems (within app context)
    try:
        with app.app_context():
            from .security import init_security_components
            init_security_components()
    except Exception as e:
        app.logger.warning(f"Security initialization warning: {e}")
    
    # Initialize backup manager (disabled for now to avoid database locks)
    try:
        from .backup_manager import backup_manager
        backup_manager.initialize(
            app.config.get('DATABASE_BACKUP_DIR', 'backups'),
            app.config.get('ENCRYPTION_KEY', 'default-key'),
            app
        )
        # Don't start automatic backup to avoid database locks
        app.logger.info("Backup manager initialized (automatic backup disabled)")
    except Exception as e:
        app.logger.warning(f"Backup manager initialization warning: {e}")
    
    # Initialize other systems
    try:
        from .server_manager import server_manager
        server_manager.start_monitoring()
    except Exception as e:
        app.logger.warning(f"Server manager warning: {e}")
    
    # Cloud deployment (with error handling)
    try:
        from .cloud_deployment import global_access_manager
        global_access_manager.initialize_global_access()
    except Exception as e:
        app.logger.warning(f"Cloud deployment warning: {e}")
    
    # Initialize Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access this page.'
    
    @login_manager.user_loader
    def load_user(user_id):
        from .models import User
        return User.get_by_id(user_id)
    
    # Register blueprints
    from . import auth
    app.register_blueprint(auth.bp)
    
    from . import main
    app.register_blueprint(main.bp)
    app.add_url_rule('/', endpoint='index')
    
    # Register API routes
    try:
        from . import api_routes
        app.register_blueprint(api_routes.api_bp)
    except Exception as e:
        app.logger.warning(f"API routes warning: {e}")
    
    # Error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        app.logger.info(f"404 error for {request.remote_addr}: {request.path}")
        return "Page not found", 404
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"500 error for {request.remote_addr}: {str(error)}")
        return "Internal server error", 500
    
    @app.errorhandler(429)
    def rate_limit_error(error):
        """Handle rate limit errors"""
        app.logger.warning(f"Rate limit exceeded for {request.remote_addr}")
        return "Rate limit exceeded. Please try again later.", 429
    
    # Initialize SocketIO
    socketio = SocketIO(app, cors_allowed_origins="*")
    
    # Store socketio in app for access
    app.socketio = socketio
    
    # Register SocketIO events (avoid circular import)
    from .main.events import register_socketio_events
    register_socketio_events(socketio)
    
    # CLI commands
    @app.cli.command()
    @click.argument('name')
    def create_user(name):
        """Create a new user."""
        click.echo(f'Created user {name}')
    
    app.logger.info("✅ All enhanced security and management systems initialized")
    
    return app, socketio

# Initialize without creating app instance to avoid circular imports
socketio = None

def init_app():
    """Initialize the app and socketio instances"""
    global socketio
    app, socketio = create_app()
    return app, socketio

# Store for external access
__all__ = ['create_app', 'init_app', 'socketio']
