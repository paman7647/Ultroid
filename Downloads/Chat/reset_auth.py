#!/usr/bin/env python3
"""
Reset Authentication System - Development Helper
Clear all failed login attempts, account lockouts, and reset security system
"""

import sqlite3
import os
import sys

def reset_auth_system():
    """Reset authentication system for development"""
    
    # Path to database
    db_path = '/Users/amankumarpandey/securechat/flask-secure-chat/secure_chat.db'
    
    if not os.path.exists(db_path):
        print("❌ Database not found!")
        return False
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔧 Resetting authentication system...")
        
        # Reset failed login attempts for all users
        cursor.execute("""
            UPDATE users SET 
                failed_login_attempts = 0,
                account_locked_until = NULL,
                last_failed_login = NULL
            WHERE 1=1
        """)
        
        # Get all users to show what we have
        cursor.execute("SELECT id, username, display_name, active FROM users")
        users = cursor.fetchall()
        
        print(f"✅ Reset {len(users)} user accounts:")
        for user in users:
            print(f"   • ID: {user[0]}, Username: {user[1]}, Display: {user[2]}, Active: {user[3]}")
        
        # Commit changes
        conn.commit()
        conn.close()
        
        print("\n🎉 Authentication system reset successfully!")
        print("📋 All account lockouts cleared")
        print("📋 Failed login attempts reset to 0")
        print("📋 Users can now login normally")
        
        return True
        
    except Exception as e:
        print(f"❌ Error resetting auth system: {e}")
        return False

if __name__ == "__main__":
    success = reset_auth_system()
    sys.exit(0 if success else 1)
