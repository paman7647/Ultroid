# app/backup_manager.py
"""
Advanced Backup and Disaster Recovery System
Implements comprehensive backup strategies, automatic recovery, and data protection
"""

import os
import sqlite3
import shutil
import json
import gzip
import time
import threading
import signal
import logging
from datetime import datetime, timedelta
from pathlib import Path
from cryptography.fernet import Fernet
from flask import current_app
import hashlib
import pickle

class BackupManager:
    """Comprehensive backup and disaster recovery manager"""
    
    def __init__(self):
        self.backup_dir = None
        self.is_running = False
        self.backup_thread = None
        self.encryption_key = None
        self.logger = logging.getLogger(__name__)
        self.app = None  # Store app reference for context
        
    def initialize(self, backup_dir, encryption_key, app=None):
        """Initialize backup manager with configuration"""
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.encryption_key = encryption_key
        self.app = app  # Store app reference
        
        # Create backup subdirectories
        (self.backup_dir / 'database').mkdir(exist_ok=True)
        (self.backup_dir / 'files').mkdir(exist_ok=True)
        (self.backup_dir / 'logs').mkdir(exist_ok=True)
        (self.backup_dir / 'config').mkdir(exist_ok=True)
        (self.backup_dir / 'emergency').mkdir(exist_ok=True)
        
        self.logger.info("Backup manager initialized")
        
    def start_automatic_backup(self, interval_minutes=30):
        """Start automatic backup process"""
        if self.is_running:
            return
            
        self.is_running = True
        self.backup_thread = threading.Thread(
            target=self._backup_loop,
            args=(interval_minutes,),
            daemon=True
        )
        self.backup_thread.start()
        self.logger.info(f"Automatic backup started (interval: {interval_minutes} minutes)")
        
    def stop_automatic_backup(self):
        """Stop automatic backup process"""
        self.is_running = False
        if self.backup_thread:
            self.backup_thread.join(timeout=5)
        self.logger.info("Automatic backup stopped")
        
    def _backup_loop(self, interval_minutes):
        """Main backup loop running in background"""
        while self.is_running:
            try:
                if self.app:
                    with self.app.app_context():
                        self.create_full_backup()
                else:
                    self.logger.warning("No app context available for backup")
                time.sleep(interval_minutes * 60)
            except Exception as e:
                self.logger.error(f"Backup loop error: {e}")
                time.sleep(60)  # Wait 1 minute before retry
                
    def create_full_backup(self):
        """Create comprehensive backup of all system data"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = f"backup_{timestamp}"
        backup_path = self.backup_dir / backup_name
        backup_path.mkdir(exist_ok=True)
        
        try:
            # Backup database
            self._backup_database(backup_path)
            
            # Backup uploaded files
            self._backup_files(backup_path)
            
            # Backup configuration
            self._backup_configuration(backup_path)
            
            # Backup logs
            self._backup_logs(backup_path)
            
            # Create backup manifest
            self._create_backup_manifest(backup_path, timestamp)
            
            # Compress and encrypt backup
            self._compress_and_encrypt_backup(backup_path)
            
            # Cleanup old backups
            self._cleanup_old_backups()
            
            self.logger.info(f"Full backup completed: {backup_name}")
            return backup_name
            
        except Exception as e:
            self.logger.error(f"Backup failed: {e}")
            # Cleanup failed backup
            if backup_path.exists():
                shutil.rmtree(backup_path)
            raise
            
    def _backup_database(self, backup_path):
        """Backup database with consistency checks"""
        if not self.app:
            self.logger.warning("No app reference available for database backup")
            return
            
        db_path = self.app.config.get('DATABASE')
        if not db_path or not os.path.exists(db_path):
            return
            
        backup_db_path = backup_path / 'database.db'
        
        # Create database backup with transaction consistency
        with sqlite3.connect(db_path) as source:
            source.execute('BEGIN IMMEDIATE;')
            try:
                with sqlite3.connect(str(backup_db_path)) as backup:
                    source.backup(backup)
                source.execute('COMMIT;')
            except:
                source.execute('ROLLBACK;')
                raise
                
        # Verify backup integrity
        self._verify_database_backup(backup_db_path)
        
    def _verify_database_backup(self, backup_path):
        """Verify database backup integrity"""
        try:
            with sqlite3.connect(str(backup_path)) as conn:
                # Check database integrity
                result = conn.execute('PRAGMA integrity_check;').fetchone()
                if result[0] != 'ok':
                    raise Exception(f"Database integrity check failed: {result[0]}")
                    
                # Verify table structures
                tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
                if not tables:
                    raise Exception("No tables found in backup database")
                    
        except Exception as e:
            raise Exception(f"Database backup verification failed: {e}")
            
    def _backup_files(self, backup_path):
        """Backup uploaded files and attachments"""
        if not self.app:
            self.logger.warning("No app reference available for files backup")
            return
            
        upload_dir = self.app.config.get('UPLOAD_FOLDER')
        if not upload_dir or not os.path.exists(upload_dir):
            return
            
        files_backup_path = backup_path / 'files'
        shutil.copytree(upload_dir, files_backup_path, dirs_exist_ok=True)
        
    def _backup_configuration(self, backup_path):
        """Backup application configuration"""
        if not self.app:
            self.logger.warning("No app reference available for configuration backup")
            return
            
        config_backup_path = backup_path / 'config.json'
        
        # Extract safe configuration (no secrets)
        safe_config = {}
        for key, value in self.app.config.items():
            if not any(secret in key.lower() for secret in ['secret', 'key', 'password', 'token']):
                if isinstance(value, (str, int, float, bool, list, dict)):
                    safe_config[key] = value
                    
        with open(config_backup_path, 'w') as f:
            json.dump(safe_config, f, indent=2, default=str)
            
    def _backup_logs(self, backup_path):
        """Backup application logs"""
        if not self.app:
            self.logger.warning("No app reference available for logs backup")
            return
            
        logs_dir = self.app.config.get('LOG_DIR', 'logs')
        if os.path.exists(logs_dir):
            logs_backup_path = backup_path / 'logs'
            shutil.copytree(logs_dir, logs_backup_path, dirs_exist_ok=True)
            
    def _create_backup_manifest(self, backup_path, timestamp):
        """Create backup manifest with metadata"""
        manifest = {
            'timestamp': timestamp,
            'version': '1.0',
            'type': 'full_backup',
            'files': [],
            'checksums': {}
        }
        
        # Calculate checksums for all files
        for file_path in backup_path.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(backup_path)
                manifest['files'].append(str(relative_path))
                
                # Calculate file checksum
                with open(file_path, 'rb') as f:
                    content = f.read()
                    checksum = hashlib.sha256(content).hexdigest()
                    manifest['checksums'][str(relative_path)] = checksum
                    
        # Save manifest
        manifest_path = backup_path / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
            
    def _compress_and_encrypt_backup(self, backup_path):
        """Compress and encrypt backup for security"""
        if not self.encryption_key:
            return
            
        # Create compressed archive
        archive_path = f"{backup_path}.tar.gz"
        shutil.make_archive(backup_path, 'gztar', backup_path)
        
        # Encrypt archive
        fernet = Fernet(self.encryption_key)
        encrypted_path = f"{backup_path}.encrypted"
        
        with open(archive_path, 'rb') as f:
            data = f.read()
            encrypted_data = fernet.encrypt(data)
            
        with open(encrypted_path, 'wb') as f:
            f.write(encrypted_data)
            
        # Remove unencrypted files
        os.remove(archive_path)
        shutil.rmtree(backup_path)
        
    def _cleanup_old_backups(self, keep_days=30):
        """Remove old backups to save space"""
        cutoff_date = datetime.now() - timedelta(days=keep_days)
        
        for backup_file in self.backup_dir.glob('backup_*'):
            if backup_file.stat().st_mtime < cutoff_date.timestamp():
                try:
                    if backup_file.is_file():
                        backup_file.unlink()
                    else:
                        shutil.rmtree(backup_file)
                    self.logger.info(f"Removed old backup: {backup_file.name}")
                except Exception as e:
                    self.logger.error(f"Failed to remove old backup {backup_file.name}: {e}")
                    
    def emergency_backup(self):
        """Create emergency backup during system shutdown"""
        try:
            emergency_path = self.backup_dir / 'emergency'
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            emergency_backup = emergency_path / f"emergency_{timestamp}"
            emergency_backup.mkdir(exist_ok=True)
            
            # Quick database backup
            if not self.app:
                self.logger.warning("No app reference available for emergency backup")
                return None
                
            db_path = self.app.config.get('DATABASE')
            if db_path and os.path.exists(db_path):
                shutil.copy2(db_path, emergency_backup / 'database.db')
                
            # Quick config backup
            config_data = {
                'timestamp': timestamp,
                'emergency': True,
                'database_exists': os.path.exists(db_path) if db_path else False
            }
            
            with open(emergency_backup / 'emergency_info.json', 'w') as f:
                json.dump(config_data, f, indent=2)
                
            self.logger.critical(f"Emergency backup created: {emergency_backup}")
            return str(emergency_backup)
            
        except Exception as e:
            self.logger.critical(f"Emergency backup failed: {e}")
            return None
            
    def restore_from_backup(self, backup_name):
        """Restore system from backup"""
        backup_path = self.backup_dir / f"{backup_name}.encrypted"
        
        if not backup_path.exists():
            raise Exception(f"Backup not found: {backup_name}")
            
        try:
            # Decrypt backup
            fernet = Fernet(self.encryption_key)
            with open(backup_path, 'rb') as f:
                encrypted_data = f.read()
                decrypted_data = fernet.decrypt(encrypted_data)
                
            # Extract archive
            temp_archive = backup_path.with_suffix('.tar.gz')
            with open(temp_archive, 'wb') as f:
                f.write(decrypted_data)
                
            extract_path = backup_path.with_suffix('')
            shutil.unpack_archive(temp_archive, extract_path)
            
            # Verify backup manifest
            manifest_path = extract_path / 'manifest.json'
            if manifest_path.exists():
                self._verify_backup_manifest(extract_path, manifest_path)
                
            # Restore database
            self._restore_database(extract_path)
            
            # Restore files
            self._restore_files(extract_path)
            
            self.logger.info(f"Restore completed from backup: {backup_name}")
            
            # Cleanup
            os.remove(temp_archive)
            shutil.rmtree(extract_path)
            
        except Exception as e:
            self.logger.error(f"Restore failed: {e}")
            raise
            
    def _verify_backup_manifest(self, backup_path, manifest_path):
        """Verify backup integrity using manifest"""
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
            
        for file_path, expected_checksum in manifest['checksums'].items():
            full_path = backup_path / file_path
            if full_path.exists():
                with open(full_path, 'rb') as f:
                    content = f.read()
                    actual_checksum = hashlib.sha256(content).hexdigest()
                    
                if actual_checksum != expected_checksum:
                    raise Exception(f"Backup corruption detected in {file_path}")
                    
    def _restore_database(self, backup_path):
        """Restore database from backup"""
        if not self.app:
            self.logger.error("No app reference available for database restore")
            return False
            
        backup_db = backup_path / 'database.db'
        current_db = self.app.config.get('DATABASE')
        
        if backup_db.exists() and current_db:
            # Create backup of current database
            if os.path.exists(current_db):
                backup_current = f"{current_db}.restore_backup"
                shutil.copy2(current_db, backup_current)
                
            # Restore from backup
            shutil.copy2(backup_db, current_db)
            self.logger.info("Database restored from backup")
            
    def _restore_files(self, backup_path):
        """Restore files from backup"""
        if not self.app:
            self.logger.error("No app reference available for files restore")
            return False
            
        backup_files = backup_path / 'files'
        upload_dir = self.app.config.get('UPLOAD_FOLDER')
        
        if backup_files.exists() and upload_dir:
            if os.path.exists(upload_dir):
                backup_current = f"{upload_dir}_restore_backup"
                shutil.move(upload_dir, backup_current)
                
            shutil.copytree(backup_files, upload_dir)
            self.logger.info("Files restored from backup")
            
    def list_backups(self):
        """List available backups"""
        backups = []
        for backup_file in self.backup_dir.glob('backup_*.encrypted'):
            name = backup_file.stem
            stats = backup_file.stat()
            backups.append({
                'name': name,
                'size': stats.st_size,
                'created': datetime.fromtimestamp(stats.st_mtime).isoformat(),
                'path': str(backup_file)
            })
        return sorted(backups, key=lambda x: x['created'], reverse=True)

class DisasterRecoveryManager:
    """Handles system failures and automatic recovery"""
    
    def __init__(self, backup_manager):
        self.backup_manager = backup_manager
        self.logger = logging.getLogger(__name__)
        self.recovery_attempts = 0
        self.max_recovery_attempts = 3
        
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGHUP, self._handle_reload)
        
    def _handle_shutdown(self, signum, frame):
        """Handle shutdown signals"""
        self.logger.critical(f"Received shutdown signal {signum}")
        
        # Create emergency backup
        emergency_backup = self.backup_manager.emergency_backup()
        
        # Stop backup processes
        self.backup_manager.stop_automatic_backup()
        
        # Log shutdown
        self.logger.critical("System shutdown initiated")
        
        # Exit gracefully
        import sys
        sys.exit(0)
        
    def _handle_reload(self, signum, frame):
        """Handle reload signals"""
        self.logger.info("Received reload signal - creating backup before reload")
        self.backup_manager.create_full_backup()
        
    def check_system_health(self):
        """Perform system health checks"""
        health_issues = []
        
        # Check database connectivity
        try:
            if not self.app:
                health_issues.append("No app reference available")
                return health_issues
                
            db_path = self.app.config.get('DATABASE')
            if db_path and os.path.exists(db_path):
                with sqlite3.connect(db_path) as conn:
                    conn.execute('SELECT 1').fetchone()
            else:
                health_issues.append("Database file not found")
        except Exception as e:
            health_issues.append(f"Database connectivity issue: {e}")
            
        # Check disk space
        try:
            backup_dir = self.backup_manager.backup_dir
            stat = shutil.disk_usage(backup_dir)
            free_gb = stat.free / (1024**3)
            if free_gb < 1:  # Less than 1GB free
                health_issues.append(f"Low disk space: {free_gb:.2f}GB remaining")
        except Exception as e:
            health_issues.append(f"Disk space check failed: {e}")
            
        # Check backup status
        try:
            backups = self.backup_manager.list_backups()
            if not backups:
                health_issues.append("No backups available")
            else:
                latest_backup = datetime.fromisoformat(backups[0]['created'])
                if datetime.now() - latest_backup > timedelta(hours=24):
                    health_issues.append("Latest backup is over 24 hours old")
        except Exception as e:
            health_issues.append(f"Backup check failed: {e}")
            
        return {
            'healthy': len(health_issues) == 0,
            'issues': health_issues,
            'timestamp': datetime.now().isoformat()
        }
        
    def attempt_auto_recovery(self):
        """Attempt automatic system recovery"""
        if self.recovery_attempts >= self.max_recovery_attempts:
            self.logger.critical("Maximum recovery attempts reached")
            return False
            
        self.recovery_attempts += 1
        self.logger.info(f"Attempting auto-recovery (attempt {self.recovery_attempts})")
        
        try:
            # Check if we have recent backups
            backups = self.backup_manager.list_backups()
            if not backups:
                self.logger.error("No backups available for recovery")
                return False
                
            # Get the most recent backup
            latest_backup = backups[0]
            backup_age = datetime.now() - datetime.fromisoformat(latest_backup['created'])
            
            if backup_age > timedelta(hours=24):
                self.logger.warning(f"Latest backup is {backup_age} old")
                
            # Attempt restoration
            self.backup_manager.restore_from_backup(latest_backup['name'])
            
            self.logger.info("Auto-recovery completed successfully")
            self.recovery_attempts = 0  # Reset counter on success
            return True
            
        except Exception as e:
            self.logger.error(f"Auto-recovery failed: {e}")
            return False

# Global instances
backup_manager = BackupManager()
disaster_recovery = DisasterRecoveryManager(backup_manager)
