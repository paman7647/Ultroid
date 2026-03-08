# app/main/routes.py

from flask import render_template, redirect, url_for
from flask_login import current_user, login_required
from app.main import bp

@bp.route('/')
@bp.route('/index')
def index():
    """
    Main landing page - redirects to chat if logged in, otherwise shows login.
    """
    if current_user.is_authenticated:
        return redirect(url_for('main.chat'))
    return redirect(url_for('auth.login'))

@bp.route('/chat')
@login_required
def chat():
    """
    Main chat interface - only accessible to authenticated users.
    """
    return render_template('chat.html', title='Secure Chat')
