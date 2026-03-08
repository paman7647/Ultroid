# app/db.py

import sqlite3
import click
from flask import current_app, g

def get_db():
    """
    Connects to the application's configured database. The connection
    is unique for each request and will be reused if this is called
    again during the same request.
    """
    # 'g' is a special object in Flask that is unique for each request.
    # We use it to store the database connection so we don't have to
    # reconnect every time we need the database during a single request.
    if 'db' not in g:
        # The 'current_app' object points to the Flask application handling the request.
        # We get the database path from its configuration.
        g.db = sqlite3.connect(
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        # This line ensures that when we fetch data, it's returned in a
        # dictionary-like format (e.g., rows['column_name']), which is much
        # more convenient to work with than tuples.
        g.db.row_factory = sqlite3.Row

    return g.db


def close_db(e=None):
    """
    Closes the current database connection. This function is designed
    to be called automatically after each request finishes.
    """
    db = g.pop('db', None)

    if db is not None:
        db.close()


def init_db():
    """
    Initializes the database by running the SQL commands from the schema.sql file.
    This will clear existing data and create new tables.
    """
    db = get_db()

    # 'open_resource' opens a file from the application's root path.
    # This is more reliable than using a hardcoded file path.
    with current_app.open_resource('schema.sql') as f:
        # We read the schema.sql file and execute its contents as a script.
        db.executescript(f.read().decode('utf8'))


@click.command('init-db')
def init_db_command():
    """
    Defines a command-line command 'flask init-db' that runs the
    init_db function and shows a success message.
    """
    # First, ensure the 'instance' folder exists where the DB will be created.
    try:
        os.makedirs(current_app.instance_path)
    except OSError:
        pass # The directory probably already exists.

    init_db()
    click.echo('Initialized the database.')


def init_app(app):
    """
    This function is called from our application factory. It registers the
    database functions with the Flask app instance so they are properly managed.
    """
    # 'app.teardown_appcontext' registers a function to be called when the
    # application context ends (i.e., after a request has been handled).
    # We use it to automatically close our database connections.
    app.teardown_appcontext(close_db)

    # We add our custom 'init-db' command to the app's command-line interface.
    # This makes it available to be run with the 'flask' command.
    app.cli.add_command(init_db_command)