-- Enhanced Security Database Schema for Secure Chat Application
-- SQLite compatible schema with comprehensive security features

-- Drop existing tables if they exist
DROP TABLE IF EXISTS message_reads;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS security_logs;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS password_history;
DROP TABLE IF EXISTS file_uploads;
DROP TABLE IF EXISTS users;

-- Enhanced Users table with comprehensive security features
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    
    -- Encryption keys for end-to-end encryption
    public_key TEXT,
    private_key_encrypted TEXT,
    
    -- Security and authentication
    active INTEGER DEFAULT 1,
    suspended INTEGER DEFAULT 0,
    email_verified INTEGER DEFAULT 0,
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_secret TEXT,
    verification_token TEXT,
    password_reset_token TEXT,
    password_reset_expires TEXT,
    
    -- Login security
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login TEXT,
    account_locked_until TEXT,
    session_token TEXT,
    last_login TEXT,
    last_logout TEXT,
    last_ip TEXT,
    last_user_agent TEXT,
    
    -- Password policy
    last_password_change TEXT,
    password_expires_at TEXT,
    must_change_password INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    
    -- Privacy settings
    profile_visibility TEXT DEFAULT 'contacts',
    last_seen_visibility TEXT DEFAULT 'contacts',
    online_status_visibility TEXT DEFAULT 'contacts',
    
    -- Security preferences
    allow_file_uploads INTEGER DEFAULT 1,
    require_encryption INTEGER DEFAULT 1,
    auto_delete_messages INTEGER DEFAULT 1
);

-- Password history to prevent reuse
CREATE TABLE password_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User sessions for multi-session management
CREATE TABLE user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_activity TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Enhanced Groups table with security features
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_by_user_id INTEGER NOT NULL,
    
    -- Group type and privacy
    is_private_chat INTEGER DEFAULT 0,
    is_encrypted INTEGER DEFAULT 1,
    require_admin_approval INTEGER DEFAULT 0,
    
    -- Message settings
    disappearing_duration_seconds INTEGER DEFAULT 86400,
    max_members INTEGER DEFAULT 100,
    allow_file_sharing INTEGER DEFAULT 1,
    
    -- Security settings
    group_key_encrypted TEXT,
    admin_only_messages INTEGER DEFAULT 0,
    read_receipts_enabled INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT,
    
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- Enhanced Group members with roles and security
CREATE TABLE group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    
    -- Member role and permissions
    role TEXT DEFAULT 'member',
    can_send_messages INTEGER DEFAULT 1,
    can_add_members INTEGER DEFAULT 0,
    can_remove_members INTEGER DEFAULT 0,
    can_edit_group INTEGER DEFAULT 0,
    
    -- Security and encryption
    member_key_encrypted TEXT,
    
    -- Status
    joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
    left_at TEXT,
    is_active INTEGER DEFAULT 1,
    invited_by_user_id INTEGER,
    
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id),
    UNIQUE(group_id, user_id)
);

-- Enhanced Messages table with comprehensive security
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_group_id INTEGER NOT NULL,
    
    -- Message content (encrypted)
    content_encrypted TEXT NOT NULL,
    content_hash TEXT,
    message_type TEXT DEFAULT 'text',
    
    -- File attachments
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_hash TEXT,
    
    -- Encryption and security
    encryption_algorithm TEXT DEFAULT 'AES-256-GCM',
    encryption_key_encrypted TEXT,
    digital_signature TEXT,
    
    -- Message lifecycle
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    auto_delete_at TEXT,
    deleted_at TEXT,
    edited_at TEXT,
    
    -- Delivery and read status
    delivered_at TEXT,
    delivery_attempts INTEGER DEFAULT 0,
    failed_delivery INTEGER DEFAULT 0,
    
    -- Security flags
    is_forward INTEGER DEFAULT 0,
    forwarded_from_message_id INTEGER,
    requires_receipt INTEGER DEFAULT 0,
    is_system_message INTEGER DEFAULT 0,
    
    -- Moderation
    is_flagged INTEGER DEFAULT 0,
    flagged_reason TEXT,
    moderated_by_user_id INTEGER,
    
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (forwarded_from_message_id) REFERENCES messages(id),
    FOREIGN KEY (moderated_by_user_id) REFERENCES users(id)
);

-- Message read receipts with enhanced tracking
CREATE TABLE message_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    
    -- Read status and timing
    read_at TEXT DEFAULT CURRENT_TIMESTAMP,
    delivered_at TEXT,
    
    -- Security
    read_from_ip TEXT,
    read_from_device TEXT,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id)
);

-- Comprehensive security audit log
CREATE TABLE security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Event details
    event_type TEXT NOT NULL,
    event_description TEXT,
    severity TEXT DEFAULT 'info',
    
    -- User and session
    user_id INTEGER,
    session_id INTEGER,
    affected_user_id INTEGER,
    
    -- Network and device info
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    
    -- Additional context
    resource_type TEXT,
    resource_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    
    -- Timing and correlation
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    correlation_id TEXT,
    
    -- Detection and response
    is_suspicious INTEGER DEFAULT 0,
    threat_level INTEGER DEFAULT 0,
    automated_response TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (affected_user_id) REFERENCES users(id)
);

-- File uploads security table
CREATE TABLE file_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message_id INTEGER,
    
    -- File details
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT,
    
    -- Security scanning
    virus_scan_status TEXT DEFAULT 'pending',
    scan_results TEXT,
    file_hash_md5 TEXT,
    file_hash_sha256 TEXT,
    
    -- Access control
    access_level TEXT DEFAULT 'private',
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER,
    expires_at TEXT,
    
    -- Timestamps
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_accessed TEXT,
    quarantined_at TEXT,
    deleted_at TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Create indexes for performance and security
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_session_token ON users(session_token);
CREATE INDEX idx_users_last_login ON users(last_login);
CREATE INDEX idx_users_active ON users(active);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_group ON messages(recipient_group_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_expires ON messages(expires_at);
CREATE INDEX idx_messages_auto_delete ON messages(auto_delete_at);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_active ON group_members(is_active);

CREATE INDEX idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX idx_security_logs_timestamp ON security_logs(timestamp);
CREATE INDEX idx_security_logs_ip ON security_logs(ip_address);
CREATE INDEX idx_security_logs_suspicious ON security_logs(is_suspicious);

CREATE INDEX idx_file_uploads_user ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_scan_status ON file_uploads(virus_scan_status);
CREATE INDEX idx_file_uploads_expires ON file_uploads(expires_at);

-- Insert initial security log entry
INSERT INTO security_logs (
    event_type, event_description, severity, timestamp
) VALUES (
    'SYSTEM_INITIALIZED', 
    'Database schema created with enhanced security features', 
    'medium', 
    CURRENT_TIMESTAMP
);