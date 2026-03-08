# app/advanced_rate_limiter.py
"""
Advanced Rate Limiting and Server Management System
Implements intelligent rate limiting, API management, and performance optimization
"""

import time
import json
import threading
import collections
import hashlib
import redis
from datetime import datetime, timedelta
from flask import request, jsonify, current_app, g
from functools import wraps
import logging
from typing import Dict, List, Tuple, Optional
import weakref

class IntelligentRateLimiter:
    """Advanced rate limiter with AI-powered adaptive limits"""
    
    def __init__(self):
        self.user_patterns = {}
        self.ip_patterns = {}
        self.global_stats = {
            'total_requests': 0,
            'blocked_requests': 0,
            'start_time': time.time()
        }
        self.adaptive_limits = {}
        self.whitelist = set()
        self.blacklist = set()
        self.suspicious_patterns = {}
        self.logger = logging.getLogger(__name__)
        
        # Redis connection for distributed rate limiting
        try:
            self.redis_client = redis.Redis(
                host=current_app.config.get('REDIS_HOST', 'localhost'),
                port=current_app.config.get('REDIS_PORT', 6379),
                db=current_app.config.get('REDIS_DB', 0),
                decode_responses=True
            )
            self.redis_available = True
        except:
            self.redis_available = False
            self.logger.warning("Redis not available, using local rate limiting")
            
    def create_rate_limit_key(self, identifier: str, endpoint: str) -> str:
        """Create a unique rate limit key"""
        return f"rate_limit:{identifier}:{endpoint}:{int(time.time() // 60)}"
        
    def get_user_tier(self, user_id: str) -> str:
        """Determine user tier for dynamic rate limiting"""
        # Check user history and behavior
        if user_id in self.user_patterns:
            pattern = self.user_patterns[user_id]
            if pattern.get('verified', False):
                return 'premium'
            elif pattern.get('requests_24h', 0) > 1000:
                return 'high_usage'
            elif pattern.get('violations', 0) > 0:
                return 'restricted'
        return 'standard'
        
    def get_dynamic_limits(self, endpoint: str, user_tier: str) -> Dict[str, int]:
        """Get dynamic rate limits based on endpoint and user tier"""
        base_limits = {
            'auth/login': {'standard': 5, 'premium': 10, 'high_usage': 8, 'restricted': 2},
            'auth/register': {'standard': 3, 'premium': 5, 'high_usage': 4, 'restricted': 1},
            'api/messages': {'standard': 60, 'premium': 120, 'high_usage': 100, 'restricted': 30},
            'api/upload': {'standard': 10, 'premium': 25, 'high_usage': 20, 'restricted': 5},
            'api/search': {'standard': 30, 'premium': 60, 'high_usage': 50, 'restricted': 15},
            'default': {'standard': 100, 'premium': 200, 'high_usage': 150, 'restricted': 50}
        }
        
        endpoint_limits = base_limits.get(endpoint, base_limits['default'])
        return {
            'requests_per_minute': endpoint_limits.get(user_tier, endpoint_limits['standard']),
            'burst_limit': endpoint_limits.get(user_tier, endpoint_limits['standard']) * 2
        }
        
    def check_rate_limit(self, identifier: str, endpoint: str, user_id: str = None) -> Tuple[bool, Dict]:
        """Advanced rate limit checking with multiple algorithms"""
        try:
            # Determine user tier
            user_tier = self.get_user_tier(user_id) if user_id else 'standard'
            limits = self.get_dynamic_limits(endpoint, user_tier)
            
            # Check whitelist/blacklist
            if identifier in self.whitelist:
                return True, {'allowed': True, 'reason': 'whitelisted'}
                
            if identifier in self.blacklist:
                return False, {'allowed': False, 'reason': 'blacklisted'}
                
            # Use Redis for distributed rate limiting if available
            if self.redis_available:
                return self._check_redis_rate_limit(identifier, endpoint, limits)
            else:
                return self._check_local_rate_limit(identifier, endpoint, limits)
                
        except Exception as e:
            self.logger.error(f"Rate limit check error: {e}")
            # Fail open for availability
            return True, {'allowed': True, 'reason': 'rate_limiter_error'}
            
    def _check_redis_rate_limit(self, identifier: str, endpoint: str, limits: Dict) -> Tuple[bool, Dict]:
        """Redis-based distributed rate limiting"""
        key = self.create_rate_limit_key(identifier, endpoint)
        pipe = self.redis_client.pipeline()
        
        try:
            pipe.incr(key)
            pipe.expire(key, 60)  # 1 minute window
            results = pipe.execute()
            
            current_requests = results[0]
            
            if current_requests > limits['requests_per_minute']:
                # Check burst limit
                burst_key = f"{key}:burst"
                burst_count = self.redis_client.get(burst_key) or 0
                
                if int(burst_count) > limits['burst_limit']:
                    self._record_violation(identifier, endpoint)
                    return False, {
                        'allowed': False,
                        'current_requests': current_requests,
                        'limit': limits['requests_per_minute'],
                        'reset_time': int(time.time()) + 60
                    }
                else:
                    # Allow burst but record it
                    self.redis_client.incr(burst_key)
                    self.redis_client.expire(burst_key, 300)  # 5 minute burst window
                    
            return True, {
                'allowed': True,
                'current_requests': current_requests,
                'limit': limits['requests_per_minute'],
                'remaining': max(0, limits['requests_per_minute'] - current_requests)
            }
            
        except Exception as e:
            self.logger.error(f"Redis rate limit error: {e}")
            return True, {'allowed': True, 'reason': 'redis_error'}
            
    def _check_local_rate_limit(self, identifier: str, endpoint: str, limits: Dict) -> Tuple[bool, Dict]:
        """Local in-memory rate limiting"""
        current_time = time.time()
        minute_window = int(current_time // 60)
        
        # Initialize tracking for this identifier
        if identifier not in self.user_patterns:
            self.user_patterns[identifier] = {
                'requests': collections.defaultdict(int),
                'last_request': current_time,
                'violations': 0
            }
            
        pattern = self.user_patterns[identifier]
        
        # Clean old entries
        old_windows = [w for w in pattern['requests'].keys() if w < minute_window - 5]
        for old_window in old_windows:
            del pattern['requests'][old_window]
            
        # Check current window
        current_requests = pattern['requests'][minute_window]
        
        if current_requests >= limits['requests_per_minute']:
            self._record_violation(identifier, endpoint)
            return False, {
                'allowed': False,
                'current_requests': current_requests,
                'limit': limits['requests_per_minute'],
                'reset_time': (minute_window + 1) * 60
            }
            
        # Allow request
        pattern['requests'][minute_window] += 1
        pattern['last_request'] = current_time
        
        return True, {
            'allowed': True,
            'current_requests': current_requests + 1,
            'limit': limits['requests_per_minute'],
            'remaining': limits['requests_per_minute'] - current_requests - 1
        }
        
    def _record_violation(self, identifier: str, endpoint: str):
        """Record rate limit violations for pattern analysis"""
        violation_data = {
            'timestamp': time.time(),
            'endpoint': endpoint,
            'identifier': identifier
        }
        
        if identifier not in self.suspicious_patterns:
            self.suspicious_patterns[identifier] = []
            
        self.suspicious_patterns[identifier].append(violation_data)
        
        # Auto-blacklist after multiple violations
        if len(self.suspicious_patterns[identifier]) > 10:
            self.blacklist.add(identifier)
            self.logger.warning(f"Auto-blacklisted {identifier} for repeated violations")
            
    def analyze_patterns(self):
        """Analyze request patterns for anomaly detection"""
        current_time = time.time()
        anomalies = []
        
        for identifier, pattern in self.user_patterns.items():
            # Check for burst patterns
            recent_requests = sum(
                count for window, count in pattern['requests'].items()
                if (window * 60) > (current_time - 300)  # Last 5 minutes
            )
            
            if recent_requests > 500:  # Suspiciously high
                anomalies.append({
                    'type': 'burst_pattern',
                    'identifier': identifier,
                    'requests': recent_requests,
                    'severity': 'high'
                })
                
        return anomalies
        
    def get_stats(self) -> Dict:
        """Get comprehensive rate limiting statistics"""
        current_time = time.time()
        uptime = current_time - self.global_stats['start_time']
        
        return {
            'total_requests': self.global_stats['total_requests'],
            'blocked_requests': self.global_stats['blocked_requests'],
            'block_rate': self.global_stats['blocked_requests'] / max(1, self.global_stats['total_requests']),
            'uptime_seconds': uptime,
            'active_users': len(self.user_patterns),
            'blacklisted_ips': len(self.blacklist),
            'whitelisted_ips': len(self.whitelist),
            'redis_available': self.redis_available
        }

class APIManagementSystem:
    """Advanced API management with versioning and monitoring"""
    
    def __init__(self):
        self.api_versions = {'v1': '1.0.0', 'v2': '2.0.0'}
        self.endpoint_stats = collections.defaultdict(lambda: {
            'total_requests': 0,
            'error_count': 0,
            'avg_response_time': 0,
            'last_access': None
        })
        self.api_keys = {}
        self.quotas = {}
        self.logger = logging.getLogger(__name__)
        
    def validate_api_key(self, api_key: str) -> Optional[Dict]:
        """Validate API key and return associated metadata"""
        if api_key in self.api_keys:
            key_data = self.api_keys[api_key]
            if key_data.get('active', True):
                # Check expiration
                if key_data.get('expires'):
                    if datetime.now() > datetime.fromisoformat(key_data['expires']):
                        return None
                return key_data
        return None
        
    def check_quota(self, api_key: str, endpoint: str) -> Tuple[bool, Dict]:
        """Check API quota limits"""
        if api_key not in self.quotas:
            return True, {'allowed': True}
            
        quota_data = self.quotas[api_key]
        current_usage = quota_data.get('usage', {})
        limits = quota_data.get('limits', {})
        
        # Reset daily quotas if needed
        today = datetime.now().strftime('%Y-%m-%d')
        if quota_data.get('last_reset') != today:
            current_usage = {}
            quota_data['last_reset'] = today
            quota_data['usage'] = current_usage
            
        endpoint_usage = current_usage.get(endpoint, 0)
        endpoint_limit = limits.get(endpoint, limits.get('default', 10000))
        
        if endpoint_usage >= endpoint_limit:
            return False, {
                'allowed': False,
                'current_usage': endpoint_usage,
                'limit': endpoint_limit,
                'reset_time': today
            }
            
        return True, {
            'allowed': True,
            'current_usage': endpoint_usage,
            'limit': endpoint_limit,
            'remaining': endpoint_limit - endpoint_usage
        }
        
    def record_api_usage(self, api_key: str, endpoint: str, response_time: float, status_code: int):
        """Record API usage statistics"""
        # Update endpoint stats
        stats = self.endpoint_stats[endpoint]
        stats['total_requests'] += 1
        stats['last_access'] = datetime.now().isoformat()
        
        if status_code >= 400:
            stats['error_count'] += 1
            
        # Update average response time
        stats['avg_response_time'] = (
            (stats['avg_response_time'] * (stats['total_requests'] - 1) + response_time) /
            stats['total_requests']
        )
        
        # Update quota usage
        if api_key in self.quotas:
            usage = self.quotas[api_key].setdefault('usage', {})
            usage[endpoint] = usage.get(endpoint, 0) + 1

class FastMessageQueue:
    """High-performance message queue for real-time messaging"""
    
    def __init__(self):
        self.message_queues = collections.defaultdict(collections.deque)
        self.subscribers = collections.defaultdict(set)
        self.message_cache = {}
        self.queue_lock = threading.RLock()
        self.delivery_stats = {
            'messages_sent': 0,
            'messages_delivered': 0,
            'avg_delivery_time': 0
        }
        self.logger = logging.getLogger(__name__)
        
    def add_message(self, room_id: str, message: Dict) -> str:
        """Add message to queue with high-performance delivery"""
        message_id = hashlib.sha256(
            f"{room_id}:{message.get('content', '')}:{time.time()}".encode()
        ).hexdigest()[:16]
        
        # Add timestamp and ID
        message.update({
            'id': message_id,
            'timestamp': time.time(),
            'delivered': False
        })
        
        with self.queue_lock:
            self.message_queues[room_id].append(message)
            self.message_cache[message_id] = message
            
            # Limit queue size
            if len(self.message_queues[room_id]) > 1000:
                old_message = self.message_queues[room_id].popleft()
                if old_message['id'] in self.message_cache:
                    del self.message_cache[old_message['id']]
                    
        self.delivery_stats['messages_sent'] += 1
        
        # Trigger immediate delivery
        self._deliver_to_subscribers(room_id, message)
        
        return message_id
        
    def subscribe_to_room(self, room_id: str, client_id: str):
        """Subscribe client to room for real-time updates"""
        with self.queue_lock:
            self.subscribers[room_id].add(client_id)
            
    def unsubscribe_from_room(self, room_id: str, client_id: str):
        """Unsubscribe client from room"""
        with self.queue_lock:
            self.subscribers[room_id].discard(client_id)
            
    def _deliver_to_subscribers(self, room_id: str, message: Dict):
        """Deliver message to all room subscribers"""
        start_time = time.time()
        
        with self.queue_lock:
            subscribers = self.subscribers.get(room_id, set()).copy()
            
        delivered_count = 0
        for client_id in subscribers:
            try:
                # This would integrate with WebSocket or SSE
                self._send_to_client(client_id, message)
                delivered_count += 1
            except Exception as e:
                self.logger.warning(f"Failed to deliver message to {client_id}: {e}")
                
        # Update delivery stats
        delivery_time = time.time() - start_time
        self.delivery_stats['messages_delivered'] += delivered_count
        
        if self.delivery_stats['messages_delivered'] > 0:
            self.delivery_stats['avg_delivery_time'] = (
                (self.delivery_stats['avg_delivery_time'] * 
                 (self.delivery_stats['messages_delivered'] - delivered_count) + 
                 delivery_time * delivered_count) /
                self.delivery_stats['messages_delivered']
            )
            
    def _send_to_client(self, client_id: str, message: Dict):
        """Send message to specific client (WebSocket implementation)"""
        # This would be implemented with actual WebSocket/SSE delivery
        pass
        
    def get_message_history(self, room_id: str, limit: int = 50) -> List[Dict]:
        """Get recent message history for a room"""
        with self.queue_lock:
            messages = list(self.message_queues.get(room_id, []))
            return messages[-limit:] if messages else []
            
    def mark_message_delivered(self, message_id: str):
        """Mark message as delivered"""
        if message_id in self.message_cache:
            self.message_cache[message_id]['delivered'] = True

# Decorators for rate limiting and API management
def advanced_rate_limit(endpoint: str = None):
    """Decorator for advanced rate limiting"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get rate limiter instance
            rate_limiter = getattr(g, 'rate_limiter', None)
            if not rate_limiter:
                rate_limiter = IntelligentRateLimiter()
                g.rate_limiter = rate_limiter
                
            # Determine identifier and endpoint
            identifier = request.remote_addr
            endpoint_name = endpoint or request.endpoint or f.__name__
            user_id = getattr(g, 'current_user_id', None)
            
            # Check rate limit
            allowed, info = rate_limiter.check_rate_limit(identifier, endpoint_name, user_id)
            
            if not allowed:
                response = jsonify({
                    'error': 'Rate limit exceeded',
                    'details': info
                })
                response.status_code = 429
                response.headers['Retry-After'] = str(info.get('reset_time', 60))
                return response
                
            # Add rate limit headers
            response = f(*args, **kwargs)
            if hasattr(response, 'headers'):
                response.headers['X-RateLimit-Limit'] = str(info.get('limit', 'unknown'))
                response.headers['X-RateLimit-Remaining'] = str(info.get('remaining', 'unknown'))
                response.headers['X-RateLimit-Reset'] = str(info.get('reset_time', 'unknown'))
                
            return response
        return decorated_function
    return decorator

def api_key_required(f):
    """Decorator requiring valid API key"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        
        if not api_key:
            return jsonify({'error': 'API key required'}), 401
            
        # Validate API key
        api_manager = getattr(g, 'api_manager', None)
        if not api_manager:
            api_manager = APIManagementSystem()
            g.api_manager = api_manager
            
        key_data = api_manager.validate_api_key(api_key)
        if not key_data:
            return jsonify({'error': 'Invalid API key'}), 401
            
        # Check quota
        allowed, quota_info = api_manager.check_quota(api_key, request.endpoint)
        if not allowed:
            return jsonify({
                'error': 'Quota exceeded',
                'details': quota_info
            }), 429
            
        g.api_key_data = key_data
        return f(*args, **kwargs)
    return decorated_function

# Global instances
intelligent_rate_limiter = IntelligentRateLimiter()
api_management_system = APIManagementSystem()
fast_message_queue = FastMessageQueue()
