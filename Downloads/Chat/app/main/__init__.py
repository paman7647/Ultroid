# app/main/__init__.py

from flask import Blueprint

# We define the blueprint, specifying its name and the location of its templates.
# Unlike the auth blueprint, this one does not have a URL prefix, so its routes
# will be at the root of the site (e.g., /index).
bp = Blueprint('main', __name__, template_folder='templates')

# By importing the 'routes' module here, we ensure that their
# contents (the view functions) are connected
# to the main application when this blueprint is registered.
# Events are registered separately to avoid circular imports.
from app.main import routes