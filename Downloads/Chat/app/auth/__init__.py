# app/auth/__init__.py

from flask import Blueprint

# A Blueprint is a way to organize a group of related views and other code.
# The first argument, 'auth', is the name of the blueprint.
# The second argument, __name__, tells the blueprint where it is defined.
# The 'template_folder' argument specifies that this blueprint will look for
# its HTML templates in a subdirectory named 'templates'.
bp = Blueprint('auth', __name__, template_folder='templates')

# We import the 'routes' module at the bottom to avoid circular dependencies.
# The routes module will contain all the view functions for this blueprint.
from app.auth import routes