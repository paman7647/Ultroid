# app/server_manager.py
"""
Advanced Server Management and Performance Optimization System
Implements intelligent load balancing, auto-scaling, and performance monitoring
"""

import os
import psutil
import threading
import time
import json
import logging
from datetime import datetime, timedelta
from collections import deque, defaultdict
from typing import Dict, List, Optional, Tuple
import asyncio
import multiprocessing
from flask import current_app
import gc
import weakref

class PerformanceMonitor:
    """Real-time performance monitoring and optimization"""
    
    def __init__(self):
        self.metrics = {
            'cpu_usage': deque(maxlen=100),
            'memory_usage': deque(maxlen=100),
            'network_io': deque(maxlen=100),
            'disk_io': deque(maxlen=100),
            'response_times': deque(maxlen=1000),
            'active_connections': deque(maxlen=100),
            'error_rates': deque(maxlen=100)
        }
        
        self.thresholds = {
            'cpu_warning': 70,
            'cpu_critical': 90,
            'memory_warning': 80,
            'memory_critical': 95,
            'response_time_warning': 1000,  # ms
            'response_time_critical': 5000,  # ms
            'error_rate_warning': 5,  # percent
            'error_rate_critical': 15  # percent
        }
        
        self.monitoring_active = False
        self.monitor_thread = None
        self.alert_callbacks = []
        self.optimization_enabled = True
        self.logger = logging.getLogger(__name__)
        
    def start_monitoring(self, interval: float = 5.0):
        """Start performance monitoring"""
        if self.monitoring_active:
            return
            
        self.monitoring_active = True
        self.monitor_thread = threading.Thread(
            target=self._monitoring_loop,
            args=(interval,),
            daemon=True
        )
        self.monitor_thread.start()
        self.logger.info("Performance monitoring started")
        
    def stop_monitoring(self):
        """Stop performance monitoring"""
        self.monitoring_active = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        self.logger.info("Performance monitoring stopped")
        
    def _monitoring_loop(self, interval: float):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                # Collect system metrics
                self._collect_system_metrics()
                
                # Check thresholds and trigger alerts
                self._check_thresholds()
                
                # Perform auto-optimization if enabled
                if self.optimization_enabled:
                    self._auto_optimize()
                    
                time.sleep(interval)
                
            except Exception as e:
                self.logger.error(f"Monitoring loop error: {e}")
                time.sleep(interval)
                
    def _collect_system_metrics(self):
        """Collect comprehensive system metrics"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            self.metrics['cpu_usage'].append({
                'timestamp': time.time(),
                'value': cpu_percent
            })
            
            # Memory usage
            memory = psutil.virtual_memory()
            self.metrics['memory_usage'].append({
                'timestamp': time.time(),
                'value': memory.percent,
                'available_mb': memory.available / (1024 * 1024),
                'used_mb': memory.used / (1024 * 1024)
            })
            
            # Network I/O
            network = psutil.net_io_counters()
            self.metrics['network_io'].append({
                'timestamp': time.time(),
                'bytes_sent': network.bytes_sent,
                'bytes_recv': network.bytes_recv,
                'packets_sent': network.packets_sent,
                'packets_recv': network.packets_recv
            })
            
            # Disk I/O
            disk = psutil.disk_io_counters()
            if disk:
                self.metrics['disk_io'].append({
                    'timestamp': time.time(),
                    'read_bytes': disk.read_bytes,
                    'write_bytes': disk.write_bytes,
                    'read_count': disk.read_count,
                    'write_count': disk.write_count
                })
            
            # Process-specific metrics
            process = psutil.Process()
            
            # File descriptors / handles
            try:
                if hasattr(process, 'num_fds'):
                    fd_count = process.num_fds()
                else:
                    fd_count = process.num_handles()
                    
                self.metrics['active_connections'].append({
                    'timestamp': time.time(),
                    'file_descriptors': fd_count,
                    'threads': process.num_threads(),
                    'memory_percent': process.memory_percent()
                })
            except:
                pass
                
        except Exception as e:
            self.logger.warning(f"Failed to collect some metrics: {e}")
            
    def _check_thresholds(self):
        """Check metrics against thresholds and trigger alerts"""
        current_time = time.time()
        alerts = []
        
        # Check CPU usage
        if self.metrics['cpu_usage']:
            latest_cpu = self.metrics['cpu_usage'][-1]['value']
            if latest_cpu > self.thresholds['cpu_critical']:
                alerts.append({
                    'type': 'cpu_critical',
                    'message': f"Critical CPU usage: {latest_cpu:.1f}%",
                    'value': latest_cpu,
                    'threshold': self.thresholds['cpu_critical']
                })
            elif latest_cpu > self.thresholds['cpu_warning']:
                alerts.append({
                    'type': 'cpu_warning',
                    'message': f"High CPU usage: {latest_cpu:.1f}%",
                    'value': latest_cpu,
                    'threshold': self.thresholds['cpu_warning']
                })
                
        # Check memory usage
        if self.metrics['memory_usage']:
            latest_memory = self.metrics['memory_usage'][-1]['value']
            if latest_memory > self.thresholds['memory_critical']:
                alerts.append({
                    'type': 'memory_critical',
                    'message': f"Critical memory usage: {latest_memory:.1f}%",
                    'value': latest_memory,
                    'threshold': self.thresholds['memory_critical']
                })
            elif latest_memory > self.thresholds['memory_warning']:
                alerts.append({
                    'type': 'memory_warning',
                    'message': f"High memory usage: {latest_memory:.1f}%",
                    'value': latest_memory,
                    'threshold': self.thresholds['memory_warning']
                })
                
        # Check response times
        if self.metrics['response_times']:
            recent_responses = [
                r for r in self.metrics['response_times']
                if r['timestamp'] > current_time - 300  # Last 5 minutes
            ]
            
            if recent_responses:
                avg_response_time = sum(r['value'] for r in recent_responses) / len(recent_responses)
                
                if avg_response_time > self.thresholds['response_time_critical']:
                    alerts.append({
                        'type': 'response_time_critical',
                        'message': f"Critical response time: {avg_response_time:.0f}ms",
                        'value': avg_response_time,
                        'threshold': self.thresholds['response_time_critical']
                    })
                elif avg_response_time > self.thresholds['response_time_warning']:
                    alerts.append({
                        'type': 'response_time_warning',
                        'message': f"High response time: {avg_response_time:.0f}ms",
                        'value': avg_response_time,
                        'threshold': self.thresholds['response_time_warning']
                    })
                    
        # Trigger alert callbacks
        for alert in alerts:
            self._trigger_alert(alert)
            
    def _trigger_alert(self, alert: Dict):
        """Trigger alert callbacks"""
        alert['timestamp'] = datetime.now().isoformat()
        
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                self.logger.error(f"Alert callback error: {e}")
                
        self.logger.warning(f"Performance alert: {alert['message']}")
        
    def _auto_optimize(self):
        """Perform automatic optimizations based on current metrics"""
        try:
            # Memory optimization
            if self.metrics['memory_usage']:
                latest_memory = self.metrics['memory_usage'][-1]['value']
                if latest_memory > self.thresholds['memory_warning']:
                    self._optimize_memory()
                    
            # CPU optimization
            if self.metrics['cpu_usage']:
                latest_cpu = self.metrics['cpu_usage'][-1]['value']
                if latest_cpu > self.thresholds['cpu_warning']:
                    self._optimize_cpu()
                    
        except Exception as e:
            self.logger.error(f"Auto-optimization error: {e}")
            
    def _optimize_memory(self):
        """Optimize memory usage"""
        try:
            # Force garbage collection
            collected = gc.collect()
            self.logger.info(f"Garbage collection freed {collected} objects")
            
            # Clear internal caches if they exist
            if hasattr(current_app, 'cache') and hasattr(current_app.cache, 'clear'):
                current_app.cache.clear()
                self.logger.info("Application cache cleared")
                
        except Exception as e:
            self.logger.error(f"Memory optimization error: {e}")
            
    def _optimize_cpu(self):
        """Optimize CPU usage"""
        try:
            # Reduce thread pool size temporarily
            # This would integrate with your thread pool implementation
            pass
            
        except Exception as e:
            self.logger.error(f"CPU optimization error: {e}")
            
    def record_response_time(self, response_time_ms: float):
        """Record a response time measurement"""
        self.metrics['response_times'].append({
            'timestamp': time.time(),
            'value': response_time_ms
        })
        
    def record_error_rate(self, error_count: int, total_requests: int):
        """Record error rate"""
        error_rate = (error_count / max(1, total_requests)) * 100
        self.metrics['error_rates'].append({
            'timestamp': time.time(),
            'value': error_rate,
            'error_count': error_count,
            'total_requests': total_requests
        })
        
    def get_current_metrics(self) -> Dict:
        """Get current performance metrics summary"""
        current_time = time.time()
        
        # Calculate recent averages
        def get_recent_average(metric_name: str, window_seconds: int = 60):
            recent_data = [
                m for m in self.metrics[metric_name]
                if m['timestamp'] > current_time - window_seconds
            ]
            if recent_data:
                return sum(m['value'] for m in recent_data) / len(recent_data)
            return 0
            
        return {
            'timestamp': datetime.now().isoformat(),
            'cpu_usage_avg': get_recent_average('cpu_usage'),
            'memory_usage_avg': get_recent_average('memory_usage'),
            'response_time_avg': get_recent_average('response_times'),
            'error_rate_avg': get_recent_average('error_rates'),
            'monitoring_active': self.monitoring_active,
            'optimization_enabled': self.optimization_enabled,
            'total_data_points': sum(len(metrics) for metrics in self.metrics.values())
        }

class LoadBalancer:
    """Intelligent load balancing for multiple server instances"""
    
    def __init__(self):
        self.servers = []
        self.current_index = 0
        self.health_check_interval = 30
        self.health_thread = None
        self.balancing_algorithm = 'round_robin'
        self.logger = logging.getLogger(__name__)
        
    def add_server(self, server_info: Dict):
        """Add server to load balancer"""
        server = {
            'id': server_info['id'],
            'host': server_info['host'],
            'port': server_info['port'],
            'weight': server_info.get('weight', 1),
            'healthy': True,
            'response_time': 0,
            'active_connections': 0,
            'cpu_usage': 0,
            'memory_usage': 0,
            'last_health_check': time.time()
        }
        
        self.servers.append(server)
        self.logger.info(f"Added server to load balancer: {server['id']}")
        
    def remove_server(self, server_id: str):
        """Remove server from load balancer"""
        self.servers = [s for s in self.servers if s['id'] != server_id]
        self.logger.info(f"Removed server from load balancer: {server_id}")
        
    def get_next_server(self) -> Optional[Dict]:
        """Get next server using configured algorithm"""
        healthy_servers = [s for s in self.servers if s['healthy']]
        
        if not healthy_servers:
            return None
            
        if self.balancing_algorithm == 'round_robin':
            return self._round_robin_selection(healthy_servers)
        elif self.balancing_algorithm == 'least_connections':
            return self._least_connections_selection(healthy_servers)
        elif self.balancing_algorithm == 'weighted_response_time':
            return self._weighted_response_time_selection(healthy_servers)
        else:
            return healthy_servers[0]
            
    def _round_robin_selection(self, servers: List[Dict]) -> Dict:
        """Round-robin server selection"""
        server = servers[self.current_index % len(servers)]
        self.current_index += 1
        return server
        
    def _least_connections_selection(self, servers: List[Dict]) -> Dict:
        """Select server with least active connections"""
        return min(servers, key=lambda s: s['active_connections'])
        
    def _weighted_response_time_selection(self, servers: List[Dict]) -> Dict:
        """Select server based on weighted response time"""
        # Lower response time and higher weight = better score
        def score(server):
            response_time = max(1, server['response_time'])  # Avoid division by zero
            weight = server['weight']
            cpu_factor = max(0.1, 1 - (server['cpu_usage'] / 100))
            return (weight * cpu_factor) / response_time
            
        return max(servers, key=score)
        
    def update_server_metrics(self, server_id: str, metrics: Dict):
        """Update server performance metrics"""
        for server in self.servers:
            if server['id'] == server_id:
                server.update(metrics)
                server['last_health_check'] = time.time()
                break

class AutoScaler:
    """Automatic scaling based on load and performance metrics"""
    
    def __init__(self, performance_monitor: PerformanceMonitor):
        self.performance_monitor = performance_monitor
        self.scaling_enabled = False
        self.min_instances = 1
        self.max_instances = 5
        self.current_instances = 1
        self.scaling_cooldown = 300  # 5 minutes
        self.last_scaling_action = 0
        self.logger = logging.getLogger(__name__)
        
        # Scaling thresholds
        self.scale_up_thresholds = {
            'cpu_usage': 70,
            'memory_usage': 80,
            'response_time': 2000,  # ms
            'error_rate': 5  # percent
        }
        
        self.scale_down_thresholds = {
            'cpu_usage': 30,
            'memory_usage': 40,
            'response_time': 500,  # ms
            'error_rate': 1  # percent
        }
        
    def enable_scaling(self):
        """Enable automatic scaling"""
        self.scaling_enabled = True
        self.logger.info("Auto-scaling enabled")
        
    def disable_scaling(self):
        """Disable automatic scaling"""
        self.scaling_enabled = False
        self.logger.info("Auto-scaling disabled")
        
    def should_scale_up(self) -> bool:
        """Determine if scaling up is needed"""
        if not self.scaling_enabled:
            return False
            
        if self.current_instances >= self.max_instances:
            return False
            
        if time.time() - self.last_scaling_action < self.scaling_cooldown:
            return False
            
        metrics = self.performance_monitor.get_current_metrics()
        
        # Check if any threshold is exceeded
        scale_up_conditions = [
            metrics['cpu_usage_avg'] > self.scale_up_thresholds['cpu_usage'],
            metrics['memory_usage_avg'] > self.scale_up_thresholds['memory_usage'],
            metrics['response_time_avg'] > self.scale_up_thresholds['response_time'],
            metrics['error_rate_avg'] > self.scale_up_thresholds['error_rate']
        ]
        
        return any(scale_up_conditions)
        
    def should_scale_down(self) -> bool:
        """Determine if scaling down is needed"""
        if not self.scaling_enabled:
            return False
            
        if self.current_instances <= self.min_instances:
            return False
            
        if time.time() - self.last_scaling_action < self.scaling_cooldown:
            return False
            
        metrics = self.performance_monitor.get_current_metrics()
        
        # Check if all thresholds are below scale-down limits
        scale_down_conditions = [
            metrics['cpu_usage_avg'] < self.scale_down_thresholds['cpu_usage'],
            metrics['memory_usage_avg'] < self.scale_down_thresholds['memory_usage'],
            metrics['response_time_avg'] < self.scale_down_thresholds['response_time'],
            metrics['error_rate_avg'] < self.scale_down_thresholds['error_rate']
        ]
        
        return all(scale_down_conditions)
        
    def scale_up(self) -> bool:
        """Scale up by adding instance"""
        try:
            # This would integrate with your deployment system
            # For now, just update the counter
            self.current_instances += 1
            self.last_scaling_action = time.time()
            
            self.logger.info(f"Scaled up to {self.current_instances} instances")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to scale up: {e}")
            return False
            
    def scale_down(self) -> bool:
        """Scale down by removing instance"""
        try:
            # This would integrate with your deployment system
            # For now, just update the counter
            self.current_instances -= 1
            self.last_scaling_action = time.time()
            
            self.logger.info(f"Scaled down to {self.current_instances} instances")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to scale down: {e}")
            return False

class ServerManager:
    """Main server management coordinator"""
    
    def __init__(self):
        self.performance_monitor = PerformanceMonitor()
        self.load_balancer = LoadBalancer()
        self.auto_scaler = AutoScaler(self.performance_monitor)
        self.management_active = False
        self.management_thread = None
        self.logger = logging.getLogger(__name__)
        
        # Register alert callback for auto-scaling
        self.performance_monitor.alert_callbacks.append(self._handle_performance_alert)
        
    def start_management(self):
        """Start comprehensive server management"""
        if self.management_active:
            return
            
        self.management_active = True
        
        # Start performance monitoring
        self.performance_monitor.start_monitoring()
        
        # Start management loop
        self.management_thread = threading.Thread(
            target=self._management_loop,
            daemon=True
        )
        self.management_thread.start()
        
        self.logger.info("Server management started")
        
    def stop_management(self):
        """Stop server management"""
        self.management_active = False
        
        # Stop performance monitoring
        self.performance_monitor.stop_monitoring()
        
        # Wait for management thread
        if self.management_thread:
            self.management_thread.join(timeout=5)
            
        self.logger.info("Server management stopped")
        
    def _management_loop(self):
        """Main management loop"""
        while self.management_active:
            try:
                # Check if scaling is needed
                if self.auto_scaler.should_scale_up():
                    self.auto_scaler.scale_up()
                elif self.auto_scaler.should_scale_down():
                    self.auto_scaler.scale_down()
                    
                time.sleep(60)  # Check every minute
                
            except Exception as e:
                self.logger.error(f"Management loop error: {e}")
                time.sleep(60)
                
    def _handle_performance_alert(self, alert: Dict):
        """Handle performance alerts for automated responses"""
        alert_type = alert['type']
        
        if 'critical' in alert_type:
            # Critical alerts may trigger immediate scaling
            if self.auto_scaler.should_scale_up():
                self.auto_scaler.scale_up()
                self.logger.info(f"Emergency scale-up triggered by {alert_type}")
                
    def get_system_status(self) -> Dict:
        """Get comprehensive system status"""
        return {
            'timestamp': datetime.now().isoformat(),
            'management_active': self.management_active,
            'performance_metrics': self.performance_monitor.get_current_metrics(),
            'load_balancer': {
                'servers': len(self.load_balancer.servers),
                'healthy_servers': len([s for s in self.load_balancer.servers if s['healthy']]),
                'algorithm': self.load_balancer.balancing_algorithm
            },
            'auto_scaler': {
                'enabled': self.auto_scaler.scaling_enabled,
                'current_instances': self.auto_scaler.current_instances,
                'min_instances': self.auto_scaler.min_instances,
                'max_instances': self.auto_scaler.max_instances
            }
        }

# Global instance
server_manager = ServerManager()
