#!/usr/bin/env python3
"""
Database initialization script for Flask Secure Chat.
This script creates the database and optionally adds sample data.
"""

import os
import sys
import sqlite3

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

try:
    from werkzeug.security import generate_password_hash
except ImportError:
    print("❌ Error: Werkzeug not found. Please install dependencies:")
    print("   pip3 install -r requirements.txt")
    sys.exit(1)

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
        
        # Add sample users with proper password hashes
        sample_users = [
            ('admin', 'Admin User', 'admin@securechat.com', 'admin123'),
            ('alice', 'Alice Johnson', 'alice@example.com', 'password123'),
            ('bob', 'Bob Smith', 'bob@example.com', 'password123'),
            ('charlie', 'Charlie Brown', 'charlie@example.com', 'password123')
        ]
        
        print("🔐 Creating sample users...")
        for username, display_name, email, password in sample_users:
            password_hash = generate_password_hash(password)
            
            try:
                conn.execute('''
                    INSERT INTO users (username, display_name, password_hash)
                    VALUES (?, ?, ?)
                ''', (username, display_name, password_hash))
                print(f"   ✅ Created user: {username}")
            except sqlite3.IntegrityError:
                print(f"   ⚠️  User {username} already exists")
        
        # Create a sample group chat
        print("💬 Creating sample group...")
        try:
            cursor = conn.execute('''
                INSERT INTO groups (name, description, created_by_user_id, is_private_chat)
                VALUES (?, ?, ?, ?)
            ''', ('General Chat', 'A general discussion room', 1, 0))
            
            group_id = cursor.lastrowid
            
            # Add all users to the general chat
            for i in range(1, 5):  # User IDs 1-4
                conn.execute('''
                    INSERT OR IGNORE INTO group_members (user_id, group_id)
                    VALUES (?, ?)
                ''', (i, group_id))
            
            print(f"   ✅ Created group: General Chat (ID: {group_id})")
            
        except sqlite3.IntegrityError:
            print("   ⚠️  Sample group already exists")
        
        # Create a direct chat between Alice and Bob
        try:
            cursor = conn.execute('''
                INSERT INTO groups (name, created_by_user_id, is_private_chat)
                VALUES (?, ?, ?)
            ''', ('Alice & Bob', 2, 1))
            
            direct_chat_id = cursor.lastrowid
            
            # Add Alice and Bob to the direct chat
            conn.execute('''
                INSERT INTO group_members (user_id, group_id) VALUES (?, ?), (?, ?)
            ''', (2, direct_chat_id, 3, direct_chat_id))
            
            print(f"   ✅ Created direct chat: Alice & Bob (ID: {direct_chat_id})")
            
        except sqlite3.IntegrityError:
            print("   ⚠️  Direct chat already exists")
        
        # Add a welcome message
        try:
            conn.execute('''
                INSERT INTO messages (sender_id, recipient_group_id, content, message_type)
                VALUES (?, ?, ?, ?)
            ''', (1, 1, 'Welcome to Secure Chat! 🎉', 'text'))
            
            print("   ✅ Added welcome message")
            
        except sqlite3.IntegrityError:
            print("   ⚠️  Welcome message already exists")
        
        conn.commit()
        print("✅ Database initialization completed successfully!")
        
        # Display login credentials
        print("\n" + "="*50)
        print("🔑 SAMPLE LOGIN CREDENTIALS:")
        print("="*50)
        for username, display_name, email, password in sample_users:
            print(f"Username: {username:10} | Password: {password}")
        print("="*50)
        
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
        print(f"\n🚀 You can now start the application with:")
        print(f"   python flask-secure-chat.py")
        print(f"\n🌐 Then visit: http://127.0.0.1:5000")
    else:
        print("❌ Database initialization failed!")
        sys.exit(1)

if __name__ == '__main__':
    main()
