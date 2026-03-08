# app/auth/routes.py
"""
Enhanced Authentication Routes with Advanced Security Features
"""

import time
import hashlib
import secrets
from datetime import datetime, timedelta
from flask import render_template, request, redirect, url_for, flash, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from urllib.parse import urlparse
from app.auth import bp
from app.db import get_db
from app.models import row_to_user, User
from app.auth.forms import LoginForm, RegistrationForm
from app.security import (
    security_manager, security_validator, rate_limiter, 
    require_auth, rate_limit, validate_input, SecurityValidator
)

# Track failed login attempts
failed_attempts = {}
blocked_accounts = {}

def log_security_event(event_type, user_id=None, ip_address=None, details=None):
    """Log security events for monitoring"""
    timestamp = datetime.utcnow().isoformat()
    log_entry = {
        'timestamp': timestamp,
        'event_type': event_type,
        'user_id': user_id,
        'ip_address': ip_address or request.remote_addr,
        'user_agent': request.headers.get('User-Agent'),
        'details': details
    }
    current_app.logger.info(f"SECURITY: {log_entry}")

def is_account_locked(username):
    """Check if account is temporarily locked"""
    if username in blocked_accounts:
        lock_time, attempts = blocked_accounts[username]
        # Only lock if attempts exceed the configured maximum
        if attempts >= current_app.config.get('MAX_FAILED_LOGIN_ATTEMPTS', 10):
            if time.time() - lock_time < current_app.config.get('ACCOUNT_LOCKOUT_DURATION', 300):
                return True, attempts
            else:
                # Lockout period expired, reset attempts
                del blocked_accounts[username]
    return False, 0

def record_failed_attempt(username):
    """Record failed login attempt with proper counting"""
    client_ip = request.remote_addr
    current_time = time.time()
    
    # Track by IP
    if client_ip not in failed_attempts:
        failed_attempts[client_ip] = []
    
    failed_attempts[client_ip].append(current_time)
    
    # Clean old attempts (older than 1 hour)
    failed_attempts[client_ip] = [
        attempt for attempt in failed_attempts[client_ip] 
        if current_time - attempt < 3600
    ]
    
    # Track by username - increment attempts properly
    if username not in blocked_accounts:
        blocked_accounts[username] = [current_time, 1]
    else:
        blocked_accounts[username][1] += 1
        blocked_accounts[username][0] = current_time
    
    attempt_count = blocked_accounts[username][1]
    
    # Log the failed attempt
    log_security_event('FAILED_LOGIN', user_id=username, details={
        'attempt_count': attempt_count,
        'ip_attempts': len(failed_attempts[client_ip])
    })
    
    # Only log account locked if we actually exceed the limit
    max_attempts = current_app.config.get('MAX_FAILED_LOGIN_ATTEMPTS', 10)
    if attempt_count >= max_attempts:
        log_security_event('ACCOUNT_LOCKED', user_id=username, details={
            'attempt_count': attempt_count
        })

def validate_login_security(username, password, form):
    """Comprehensive login security validation"""
    client_ip = request.remote_addr
    
    # Check if IP is rate limited
    if rate_limiter.is_blocked(client_ip):
        log_security_event('IP_BLOCKED', details={'reason': 'Rate limit exceeded'})
        return False, "Access temporarily blocked. Please try again later."
    
    # Check for suspicious patterns
    if len(password) > 1000:  # Potential buffer overflow attempt
        log_security_event('SUSPICIOUS_ACTIVITY', details={'reason': 'Oversized password'})
        return False, "Invalid request."
    
    # Check account lockout
    is_locked, attempt_count = is_account_locked(username)
    if is_locked:
        lockout_minutes = current_app.config.get('ACCOUNT_LOCKOUT_DURATION', 300) // 60
        return False, f"Account temporarily locked due to {attempt_count} failed attempts. Try again in {lockout_minutes} minutes."
    
    # Validate input format (with fallback if security_validator is None)
    if security_validator is None:
        temp_validator = SecurityValidator()
        is_valid_user, user_msg = temp_validator.validate_username(username)
    else:
        is_valid_user, user_msg = security_validator.validate_username(username)
    if not is_valid_user:
        return False, "Invalid username format."
    
    return True, "OK"

@bp.route('/login', methods=['GET', 'POST'])
@rate_limit(limit=100, window=300)  # 100 attempts per 5 minutes (very generous for development)
def login():
    # If the user is already logged in, redirect them to the main page.
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    form = LoginForm()
    if form.validate_on_submit():
        username = form.username.data.strip().lower()
        password = form.password.data
        
        # Security validation
        is_secure, security_msg = validate_login_security(username, password, form)
        if not is_secure:
            flash(security_msg, 'error')
            return render_template('login.html', title='Sign In', form=form)
        
        db = get_db()
        # Find the user by their username with additional security checks
        user_row = db.execute(
            'SELECT * FROM users WHERE LOWER(username) = ? AND active = 1', 
            (username,)
        ).fetchone()

        user = row_to_user(user_row)

        # Enhanced password verification
        if user is None:
            record_failed_attempt(username)
            log_security_event('LOGIN_FAILED', user_id=username, details={'reason': 'User not found'})
            # Constant time delay to prevent username enumeration
            time.sleep(0.5)
            flash('Invalid username or password')
            return render_template('login.html', title='Sign In', form=form)
        
        # Check if user account is active and not suspended
        if hasattr(user, 'suspended') and user.suspended:
            log_security_event('LOGIN_FAILED', user_id=username, details={'reason': 'Account suspended'})
            flash('Account is suspended. Contact administrator.')
            return render_template('login.html', title='Sign In', form=form)
        
        # Verify password with timing attack protection
        password_start = time.time()
        password_valid = user.check_password(password)
        password_duration = time.time() - password_start
        
        # Ensure minimum verification time to prevent timing attacks
        if password_duration < 0.1:
            time.sleep(0.1 - password_duration)
        
        if not password_valid:
            record_failed_attempt(username)
            log_security_event('LOGIN_FAILED', user_id=user.id, details={'reason': 'Invalid password'})
            flash('Invalid username or password')
            return render_template('login.html', title='Sign In', form=form)

        # Successful login - clear failed attempts
        client_ip = request.remote_addr
        if client_ip in failed_attempts:
            del failed_attempts[client_ip]
        if username in blocked_accounts:
            del blocked_accounts[username]
        
        # Generate secure session token
        session_token = security_manager.generate_secure_token()
        
        # Update last login information
        db.execute(
            'UPDATE users SET last_login = ?, last_ip = ?, session_token = ? WHERE id = ?',
            (datetime.utcnow(), client_ip, session_token, user.id)
        )
        db.commit()
        
        # Log successful login
        log_security_event('LOGIN_SUCCESS', user_id=user.id, details={
            'session_token': session_token[:8] + '...',  # Log partial token only
            'remember_me': form.remember_me.data
        })

        # Log the user in with security enhancements
        login_user(user, remember=form.remember_me.data, duration=timedelta(hours=2))

        # Secure redirect handling
        next_page = request.args.get('next')
        if not next_page or urlparse(next_page).netloc != '':
            next_page = url_for('main.index')
        
        # Additional security headers
        response = redirect(next_page)
        response.headers['X-Session-Token'] = session_token
        return response

    return render_template('login.html', title='Sign In', form=form)

@bp.route('/logout')
@login_required
def logout():
    """Enhanced logout with session cleanup"""
    if current_user.is_authenticated:
        # Clear session token from database
        db = get_db()
        db.execute(
            'UPDATE users SET session_token = NULL, last_logout = ? WHERE id = ?',
            (datetime.utcnow(), current_user.id)
        )
        db.commit()
        
        log_security_event('LOGOUT', user_id=current_user.id)
    
    logout_user()
    response = redirect(url_for('main.index'))
    
    # Clear any custom headers/cookies
    response.headers['Clear-Site-Data'] = '"cache", "cookies", "storage"'
    return response

@bp.route('/register', methods=['GET', 'POST'])
@rate_limit(limit=100, window=3600)  # 100 registrations per hour per IP (very generous for development)
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    form = RegistrationForm()
    if form.validate_on_submit():
        username = form.username.data.strip().lower()
        display_name = form.display_name.data.strip()
        password = form.password.data
        
        # Enhanced validation (with fallback if security_validator is None)
        if security_validator is None:
            temp_validator = SecurityValidator()
            is_valid_user, user_msg = temp_validator.validate_username(username)
        else:
            is_valid_user, user_msg = security_validator.validate_username(username)
        if not is_valid_user:
            flash(user_msg, 'error')
            return render_template('register.html', title='Register', form=form)
        
        if security_validator is None:
            temp_validator = SecurityValidator()
            is_valid_pass, pass_msg = temp_validator.validate_password(password)
        else:
            is_valid_pass, pass_msg = security_validator.validate_password(password)
        if not is_valid_pass:
            flash(pass_msg, 'error')
            return render_template('register.html', title='Register', form=form)
        
        db = get_db()
        
        # Check for existing username (case-insensitive)
        existing_user = db.execute(
            'SELECT id FROM users WHERE LOWER(username) = ?', (username,)
        ).fetchone()
        
        if existing_user:
            log_security_event('REGISTRATION_FAILED', details={
                'reason': 'Username already exists',
                'attempted_username': username
            })
            flash('Username already exists. Please choose a different one.', 'error')
            return render_template('register.html', title='Register', form=form)
        
        # Generate RSA key pair for end-to-end encryption
        private_key, public_key = security_manager.generate_key_pair()
        
        # Create new user with enhanced security
        new_user = User(
            id=None, 
            username=username, 
            display_name=display_name
        )
        
        # Use advanced password hashing
        password_hash = security_manager.hash_password_advanced(password)
        
        # Generate verification token
        verification_token = security_manager.generate_secure_token()
        
        # Insert the new user into the database with security fields
        try:
            cursor = db.execute(
                '''INSERT INTO users 
                   (username, display_name, password_hash, public_key, private_key_encrypted, 
                    verification_token, created_at, active, failed_login_attempts) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (username, display_name, password_hash, public_key, 
                 security_manager.encrypt_message(private_key), verification_token, 
                 datetime.utcnow(), 1, 0)
            )
            db.commit()
            
            user_id = cursor.lastrowid
            
            log_security_event('REGISTRATION_SUCCESS', user_id=user_id, details={
                'username': username,
                'display_name': display_name
            })
            
            flash('Registration successful! You can now log in.', 'success')
            return redirect(url_for('auth.login'))
            
        except Exception as e:
            db.rollback()
            log_security_event('REGISTRATION_ERROR', details={
                'error': str(e),
                'username': username
            })
            flash('Registration failed. Please try again.', 'error')

    return render_template('register.html', title='Register', form=form)

@bp.route('/security-info')
@login_required
def security_info():
    """Display user security information"""
    db = get_db()
    user_security = db.execute(
        '''SELECT last_login, last_ip, failed_login_attempts, 
           created_at, last_password_change 
           FROM users WHERE id = ?''',
        (current_user.id,)
    ).fetchone()
    
    return render_template('security_info.html', security_info=user_security)

@bp.route('/change-password', methods=['GET', 'POST'])
@login_required
@rate_limit(limit=5, window=3600)  # 5 password changes per hour
def change_password():
    """Secure password change functionality"""
    if request.method == 'POST':
        current_password = request.form.get('current_password')
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')
        
        # Validate current password
        if not current_user.check_password(current_password):
            log_security_event('PASSWORD_CHANGE_FAILED', user_id=current_user.id, 
                             details={'reason': 'Invalid current password'})
            flash('Current password is incorrect.', 'error')
            return render_template('change_password.html')
        
        # Validate new password
        if new_password != confirm_password:
            flash('New passwords do not match.', 'error')
            return render_template('change_password.html')
        
        # Validate new password (with fallback if security_validator is None)
        if security_validator is None:
            temp_validator = SecurityValidator()
            is_valid_pass, pass_msg = temp_validator.validate_password(new_password)
        else:
            is_valid_pass, pass_msg = security_validator.validate_password(new_password)
        if not is_valid_pass:
            flash(pass_msg, 'error')
            return render_template('change_password.html')
        
        # Update password
        db = get_db()
        new_hash = security_manager.hash_password_advanced(new_password)
        
        db.execute(
            'UPDATE users SET password_hash = ?, last_password_change = ? WHERE id = ?',
            (new_hash, datetime.utcnow(), current_user.id)
        )
        db.commit()
        
        log_security_event('PASSWORD_CHANGED', user_id=current_user.id)
        flash('Password changed successfully!', 'success')
        return redirect(url_for('main.index'))
    
    return render_template('change_password.html')

@bp.route('/debug/clear-lockouts')
def clear_lockouts():
    """Development helper to clear account lockouts"""
    if not current_app.config.get('DEVELOPMENT', False):
        return "Not available in production", 403
    
    global failed_attempts, blocked_accounts
    failed_attempts.clear()
    blocked_accounts.clear()
    
    return jsonify({
        'status': 'success',
        'message': 'All account lockouts and failed attempts cleared',
        'timestamp': datetime.utcnow().isoformat()
    })