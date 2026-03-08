# app/auth/forms.py

from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField
from wtforms.validators import DataRequired, Email, EqualTo, ValidationError, Length

# We need access to our database helpers to check if a username already exists.
from app.db import get_db

class LoginForm(FlaskForm):
    """Form for users to login."""
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Remember Me')
    submit = SubmitField('Sign In')

class RegistrationForm(FlaskForm):
    """Form for users to create a new account."""
    username = StringField('Username', validators=[
        DataRequired(),
        Length(min=3, max=50, message='Username must be between 3 and 50 characters.')
    ])
    display_name = StringField('Display Name', validators=[
        DataRequired(),
        Length(min=2, max=100, message='Display Name must be between 2 and 100 characters.')
    ])
    password = PasswordField('Password', validators=[
        DataRequired(),
        Length(min=6, message='Password must be at least 6 characters.')
    ])
    password2 = PasswordField(
        'Repeat Password', validators=[DataRequired(), EqualTo('password', message='Passwords must match.')]
    )
    submit = SubmitField('Register')

    def validate_username(self, username):
        """Custom validator to ensure the username is not already taken."""
        db = get_db()
        # Check case-insensitive to prevent duplicate usernames
        user = db.execute(
            'SELECT id FROM users WHERE LOWER(username) = LOWER(?)', (username.data,)
        ).fetchone()
        if user is not None:
            raise ValidationError('This username is already taken. Please choose a different one.')