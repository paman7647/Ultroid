# app/file_security.py
"""
Advanced File Security Scanner and Protection System
Implements comprehensive file security including virus scanning, content analysis, and quarantine.
"""

import os
import hashlib
import magic
import mimetypes
import tempfile
import shutil
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from flask import current_app
import re
import zipfile
import tarfile

class FileSecurityScanner:
    """Advanced file security scanner with multiple detection layers"""
    
    def __init__(self):
        self.dangerous_extensions = {
            'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
            'php', 'asp', 'aspx', 'jsp', 'py', 'pl', 'sh', 'ps1', 'msi',
            'app', 'deb', 'rpm', 'dmg', 'pkg', 'run', 'bin', 'out'
        }
        
        self.suspicious_patterns = [
            b'eval\(',
            b'exec\(',
            b'system\(',
            b'shell_exec',
            b'passthru',
            b'base64_decode',
            b'<script',
            b'javascript:',
            b'vbscript:',
            b'onload=',
            b'onerror=',
            b'CreateObject',
            b'WScript.Shell',
            b'cmd.exe',
            b'powershell',
            b'/bin/sh',
            b'/bin/bash'
        ]
        
        self.malware_signatures = [
            # Common malware patterns
            b'\x4d\x5a\x90\x00',  # PE header
            b'This program cannot be run in DOS mode',
            b'UPX!',  # UPX packer
            b'MPRESS',  # MPRESS packer
        ]
    
    def calculate_file_hash(self, file_path):
        """Calculate MD5 and SHA256 hashes of file"""
        md5_hash = hashlib.md5()
        sha256_hash = hashlib.sha256()
        
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5_hash.update(chunk)
                sha256_hash.update(chunk)
        
        return md5_hash.hexdigest(), sha256_hash.hexdigest()
    
    def detect_mime_type(self, file_path):
        """Detect MIME type using multiple methods"""
        try:
            # Use python-magic for accurate detection
            detected_mime = magic.from_file(file_path, mime=True)
        except:
            # Fallback to mimetypes
            detected_mime, _ = mimetypes.guess_type(file_path)
        
        return detected_mime
    
    def scan_file_content(self, file_path):
        """Scan file content for suspicious patterns"""
        threats = []
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read(1024 * 1024)  # Read first 1MB
                
                # Check for suspicious patterns
                for i, pattern in enumerate(self.suspicious_patterns):
                    if pattern in content:
                        threats.append(f"Suspicious pattern {i+1} detected")
                
                # Check for malware signatures
                for i, signature in enumerate(self.malware_signatures):
                    if signature in content:
                        threats.append(f"Malware signature {i+1} detected")
                
                # Check for embedded executables
                if b'\x4d\x5a' in content:  # PE header
                    threats.append("Embedded executable detected")
                
                # Check for suspicious scripts
                script_patterns = [
                    b'<script', b'<?php', b'<%', b'#!/bin/'
                ]
                for pattern in script_patterns:
                    if pattern in content.lower():
                        threats.append(f"Script content detected: {pattern.decode('ascii', errors='ignore')}")
        
        except Exception as e:
            threats.append(f"Content scan error: {str(e)}")
        
        return threats
    
    def analyze_archive(self, file_path):
        """Analyze archive files for suspicious content"""
        threats = []
        
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext in ['.zip', '.jar']:
                with zipfile.ZipFile(file_path, 'r') as archive:
                    for filename in archive.namelist():
                        # Check for suspicious filenames
                        if any(ext in filename.lower() for ext in self.dangerous_extensions):
                            threats.append(f"Dangerous file in archive: {filename}")
                        
                        # Check for directory traversal
                        if '../' in filename or '..\\' in filename:
                            threats.append(f"Directory traversal in archive: {filename}")
            
            elif file_ext in ['.tar', '.tgz', '.tar.gz', '.tar.bz2']:
                with tarfile.open(file_path, 'r') as archive:
                    for member in archive.getmembers():
                        filename = member.name
                        if any(ext in filename.lower() for ext in self.dangerous_extensions):
                            threats.append(f"Dangerous file in archive: {filename}")
                        
                        if '../' in filename or '..\\' in filename:
                            threats.append(f"Directory traversal in archive: {filename}")
        
        except Exception as e:
            threats.append(f"Archive analysis error: {str(e)}")
        
        return threats
    
    def check_file_size_limits(self, file_path, max_size=8388608):  # 8MB default
        """Check if file exceeds size limits"""
        file_size = os.path.getsize(file_path)
        
        if file_size > max_size:
            return [f"File size {file_size} exceeds limit {max_size}"]
        
        return []
    
    def comprehensive_scan(self, file_path, original_filename=None):
        """Perform comprehensive security scan of file"""
        scan_results = {
            'file_path': file_path,
            'original_filename': original_filename or os.path.basename(file_path),
            'scan_timestamp': datetime.utcnow().isoformat(),
            'threats': [],
            'file_info': {},
            'risk_level': 'low',
            'quarantine_recommended': False
        }
        
        try:
            # Basic file info
            file_stats = os.stat(file_path)
            scan_results['file_info'] = {
                'size': file_stats.st_size,
                'created': datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                'modified': datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
            }
            
            # Calculate hashes
            md5_hash, sha256_hash = self.calculate_file_hash(file_path)
            scan_results['file_info']['md5'] = md5_hash
            scan_results['file_info']['sha256'] = sha256_hash
            
            # Detect MIME type
            detected_mime = self.detect_mime_type(file_path)
            scan_results['file_info']['mime_type'] = detected_mime
            
            # Check file extension
            file_ext = Path(original_filename or file_path).suffix.lower().lstrip('.')
            scan_results['file_info']['extension'] = file_ext
            
            # Extension-based checks
            if file_ext in self.dangerous_extensions:
                scan_results['threats'].append(f"Dangerous file extension: .{file_ext}")
                scan_results['risk_level'] = 'high'
                scan_results['quarantine_recommended'] = True
            
            # MIME type validation
            allowed_mimes = current_app.config.get('ALLOWED_MIME_TYPES', set())
            if allowed_mimes and detected_mime not in allowed_mimes:
                scan_results['threats'].append(f"Disallowed MIME type: {detected_mime}")
                scan_results['risk_level'] = 'medium'
            
            # Size checks
            size_threats = self.check_file_size_limits(file_path)
            scan_results['threats'].extend(size_threats)
            
            # Content scanning
            content_threats = self.scan_file_content(file_path)
            scan_results['threats'].extend(content_threats)
            
            if content_threats:
                scan_results['risk_level'] = 'high'
                scan_results['quarantine_recommended'] = True
            
            # Archive analysis
            if file_ext in ['zip', 'jar', 'tar', 'tgz', 'gz', 'bz2']:
                archive_threats = self.analyze_archive(file_path)
                scan_results['threats'].extend(archive_threats)
                
                if archive_threats:
                    scan_results['risk_level'] = 'high'
                    scan_results['quarantine_recommended'] = True
            
            # Overall risk assessment
            if len(scan_results['threats']) > 3:
                scan_results['risk_level'] = 'critical'
                scan_results['quarantine_recommended'] = True
            elif len(scan_results['threats']) > 1:
                scan_results['risk_level'] = 'high'
                scan_results['quarantine_recommended'] = True
            elif scan_results['threats']:
                scan_results['risk_level'] = 'medium'
        
        except Exception as e:
            scan_results['threats'].append(f"Scan error: {str(e)}")
            scan_results['risk_level'] = 'unknown'
            current_app.logger.error(f"File scan error for {file_path}: {e}")
        
        return scan_results

class FileQuarantineManager:
    """Manages quarantined files and security policies"""
    
    def __init__(self):
        self.quarantine_dir = current_app.config.get('QUARANTINE_FOLDER')
        os.makedirs(self.quarantine_dir, exist_ok=True)
        os.chmod(self.quarantine_dir, 0o700)  # Restrict access
    
    def quarantine_file(self, file_path, scan_results):
        """Move file to quarantine with metadata"""
        try:
            # Generate quarantine filename
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            original_name = scan_results.get('original_filename', os.path.basename(file_path))
            quarantine_filename = f"{timestamp}_{hashlib.md5(original_name.encode()).hexdigest()}"
            quarantine_path = os.path.join(self.quarantine_dir, quarantine_filename)
            
            # Move file to quarantine
            shutil.move(file_path, quarantine_path)
            os.chmod(quarantine_path, 0o600)  # Read-only for owner
            
            # Save metadata
            metadata = {
                'original_path': file_path,
                'original_filename': original_name,
                'quarantine_time': datetime.utcnow().isoformat(),
                'scan_results': scan_results,
                'quarantine_reason': 'Security scan detected threats'
            }
            
            metadata_path = f"{quarantine_path}.json"
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            os.chmod(metadata_path, 0o600)
            
            current_app.logger.warning(f"File quarantined: {original_name} -> {quarantine_filename}")
            
            return {
                'quarantined': True,
                'quarantine_id': quarantine_filename,
                'quarantine_path': quarantine_path
            }
        
        except Exception as e:
            current_app.logger.error(f"Failed to quarantine file {file_path}: {e}")
            return {
                'quarantined': False,
                'error': str(e)
            }
    
    def list_quarantined_files(self):
        """List all quarantined files with metadata"""
        quarantined_files = []
        
        try:
            for filename in os.listdir(self.quarantine_dir):
                if filename.endswith('.json'):
                    metadata_path = os.path.join(self.quarantine_dir, filename)
                    try:
                        with open(metadata_path, 'r') as f:
                            metadata = json.load(f)
                        quarantined_files.append(metadata)
                    except Exception as e:
                        current_app.logger.error(f"Failed to read quarantine metadata {filename}: {e}")
        
        except Exception as e:
            current_app.logger.error(f"Failed to list quarantined files: {e}")
        
        return quarantined_files
    
    def cleanup_old_quarantine(self, days=30):
        """Clean up quarantined files older than specified days"""
        cutoff_time = datetime.utcnow() - timedelta(days=days)
        cleaned_count = 0
        
        try:
            for filename in os.listdir(self.quarantine_dir):
                file_path = os.path.join(self.quarantine_dir, filename)
                file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                
                if file_mtime < cutoff_time:
                    try:
                        os.remove(file_path)
                        cleaned_count += 1
                    except Exception as e:
                        current_app.logger.error(f"Failed to clean quarantine file {filename}: {e}")
        
        except Exception as e:
            current_app.logger.error(f"Failed to cleanup quarantine: {e}")
        
        current_app.logger.info(f"Cleaned {cleaned_count} old quarantined files")
        return cleaned_count

def secure_file_upload(file, upload_dir, user_id=None):
    """Securely handle file upload with comprehensive scanning"""
    if not file or not file.filename:
        return {'success': False, 'error': 'No file provided'}
    
    scanner = FileSecurityScanner()
    quarantine_manager = FileQuarantineManager()
    
    # Generate secure filename
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    file_hash = hashlib.md5(f"{file.filename}{timestamp}{user_id}".encode()).hexdigest()[:8]
    safe_filename = f"{timestamp}_{file_hash}_{file.filename}"
    
    # Create temporary file for scanning
    temp_dir = current_app.config.get('TEMP_FOLDER')
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, safe_filename)
    
    try:
        # Save file temporarily
        file.save(temp_path)
        
        # Perform security scan
        scan_results = scanner.comprehensive_scan(temp_path, file.filename)
        
        # Check scan results
        if scan_results['quarantine_recommended']:
            # Quarantine the file
            quarantine_result = quarantine_manager.quarantine_file(temp_path, scan_results)
            
            return {
                'success': False,
                'error': 'File rejected due to security concerns',
                'scan_results': scan_results,
                'quarantined': quarantine_result.get('quarantined', False)
            }
        
        # File is safe, move to upload directory
        os.makedirs(upload_dir, exist_ok=True)
        final_path = os.path.join(upload_dir, safe_filename)
        shutil.move(temp_path, final_path)
        os.chmod(final_path, 0o644)
        
        return {
            'success': True,
            'filename': safe_filename,
            'original_filename': file.filename,
            'file_path': final_path,
            'scan_results': scan_results,
            'file_info': scan_results['file_info']
        }
    
    except Exception as e:
        # Clean up on error
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        
        current_app.logger.error(f"File upload error: {e}")
        return {'success': False, 'error': f'Upload failed: {str(e)}'}

# Global instances
file_scanner = FileSecurityScanner()
quarantine_manager = FileQuarantineManager()
