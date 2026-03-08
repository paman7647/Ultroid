#!/usr/bin/env python3
"""
Simple database initialization script for Flask Secure Chat.
This script creates the database with schema only.
"""

import os
import sys
import sqlite3

def init_database(db_path, schema_path):
    """Initialize the database with the schema."""
    print(f"🔧 Initializing database at: {db_path}")
    
    # Ensure the directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    # Create database connection
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    try:
        # Read and execute schema
        with open(schema_path, 'r') as f:
            schema = f.read()
        
        conn.executescript(schema)
        print("✅ Database schema created successfully")
        
        conn.commit()
        print("✅ Database initialization completed successfully!")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()
    
    return True

def main():
    """Main function to run database initialization."""
    # Get the base directory
    basedir = os.path.dirname(os.path.abspath(__file__))
    
    # Database and schema paths
    db_path = os.path.join(basedir, 'instance', 'chat.sqlite')
    schema_path = os.path.join(basedir, 'schema.sql')
    
    # Check if schema file exists
    if not os.path.exists(schema_path):
        print(f"❌ Schema file not found: {schema_path}")
        sys.exit(1)
    
    # Check if database already exists
    if os.path.exists(db_path):
        response = input(f"⚠️  Database already exists at {db_path}. Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("Initialization cancelled.")
            sys.exit(0)
        
        # Backup existing database
        import shutil
        backup_path = db_path + '.backup'
        shutil.copy2(db_path, backup_path)
        print(f"📁 Backup created: {backup_path}")
    
    # Initialize the database
    if init_database(db_path, schema_path):
        print(f"\n🚀 Database created successfully!")
        print(f"💡 You'll need to register users through the web interface.")
        print(f"\n🌐 Start the application with:")
        print(f"   python3 flask-secure-chat.py")
        print(f"\n🌐 Then visit: http://127.0.0.1:5000")
    else:
        print("❌ Database initialization failed!")
        sys.exit(1)

if __name__ == '__main__':
    main()
