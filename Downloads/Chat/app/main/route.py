# app/main/routes.py

from flask import render_template, redirect, url_for
from flask_login import current_user, login_required
from app.main import bp

@bp.route('/')
@bp.route('/index')
@login_required
def index():
    """
    This is the main view for the chat application.
    The @login_required decorator ensures that only authenticated users
    can access this page. If an anonymous user tries to visit, they will be
    automatically redirected to the login page (as configured in app/__init__.py).
    """
    # The view simply renders the main chat room template, passing in the
    # title for the page. The template will have access to the 'current_user'
    # object automatically, allowing it to display the user's name, etc.
    return render_template('index.html', title='Chat Room')

@bp.route('/enhanced-chat')
@login_required
def enhanced_chat():
    """Enhanced chat interface with advanced UI/UX features"""
    return render_template('enhanced_chat.html', title='SecureChat Pro')