# 🔒 Enhanced Secure Chat Application

A military-grade secure messaging application with advanced security features, global accessibility, and intelligent management systems.

## 🚀 Latest Enhancements

### 🌍 **Global Accessibility**
- **🔗 Instant SSL-secured public links** - Get HTTPS URLs instantly when you run the app
- **🏠 Host on your laptop, access anywhere** - Share secure links with anyone worldwide
- **📱 QR codes for mobile access** - Automatically generated for easy sharing
- **🔄 Multiple tunnel methods** with automatic failover (ngrok, Cloudflare, LocalTunnel, Serveo)
- **🛡️ SSL encryption by default** - All public access is automatically secured with HTTPS
- **📊 Web dashboard** for tunnel management at `/api/v1/access/dashboard`

### 🛡️ **Advanced Security Features**
- **End-to-end encryption** with RSA-2048 + AES-256-GCM
- **AI-powered threat detection** and pattern analysis
- **Advanced rate limiting** with intelligent adaptation
- **Comprehensive file security scanning** and quarantine
- **Automatic backup and disaster recovery**
- **Secure local chat history storage** with user consent

### ⚡ **Performance & Management**
- **Real-time performance monitoring** with auto-optimization
- **Intelligent load balancing** with multiple algorithms
- **Auto-scaling capabilities** based on system load
- **Fast message delivery** with advanced queueing
- **Advanced API management** with versioning and quotas

### 💾 **Local Storage System**
- **Device-level encrypted storage** using core libraries
- **User consent required** from both parties
- **Secure export capabilities** in multiple formats
- **Automatic cleanup** and maintenance
- **Cross-platform compatibility** (Web, Desktop, Mobile)

## 📋 Prerequisites

- Python 3.9 or higher
- pip (Python package installer)
- Git
- Optional: Node.js (for LocalTunnel)
- Optional: ngrok account (for premium features)

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd flask-secure-chat
```

### 2. Create Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
# Install basic Python dependencies
pip install -r requirements.txt

# Install enhanced features dependencies
./install_dependencies.sh
```

### 4. Initialize Database
```bash
python -c "
import sqlite3
with open('schema.sql', 'r') as f:
    schema = f.read()
conn = sqlite3.connect('secure_chat.db')
conn.executescript(schema)
conn.close()
print('Database initialized!')
"
```

### 5. Set Environment Variables (Optional)
```bash
export FLASK_ENV=development
export SECRET_KEY="your-secret-key"
export NGROK_AUTH_TOKEN="your-ngrok-token"  # Optional
```

## 🚀 Running the Application

### Quick Start with SSL-Secured Public Access
```bash
# 1. Install dependencies
pip install -r requirements.txt
./install_dependencies.sh

# 2. Initialize database
python -c "
import sqlite3
with open('schema.sql', 'r') as f:
    schema = f.read()
conn = sqlite3.connect('secure_chat.db')
conn.executescript(schema)
conn.close()
print('Database initialized!')
"

# 3. Run the application
python flask-secure-chat.py
```

**🌍 That's it!** Your app will automatically:
- Start on your laptop (localhost:5001)
- Generate SSL-secured public links 
- Display QR codes for mobile access
- Show all access URLs in the startup banner

### Access Your Chat

The application will be available at:
- **🏠 Local**: http://localhost:5001
- **🌐 Network**: http://[your-ip]:5001
- **🔗 Public SSL URLs**: Automatically generated and displayed in logs

### Global Access Dashboard

Visit **`/api/v1/access/dashboard`** for a web interface to:
- 📊 View all active tunnel URLs
- 🚀 Setup specific tunnel methods
- 📱 Access QR codes
- 🧹 Manage tunnel connections

## 🔐 Security Features

### Advanced Rate Limiting
- **Intelligent adaptation** based on user behavior
- **Multiple algorithms**: round-robin, least connections, weighted response time
- **Progressive penalties** for violations
- **Whitelist/blacklist** management
- **Distributed rate limiting** with Redis support

### Local Chat History Storage
```javascript
// Request storage consent
POST /api/v1/storage/consent
{
    "partner_id": "user123",
    "room_id": "room456"
}

// Grant consent
POST /api/v1/storage/consent/{consent_id}/grant

// Initialize device storage
POST /api/v1/storage/initialize

// Export chat history
POST /api/v1/storage/export/{room_id}
{
    "format": "json"  // or "text"
}
```

### File Security Scanning
- **Multi-layer malware detection**
- **MIME type validation**
- **Content pattern analysis**
- **Automatic quarantine** for suspicious files
- **Detailed scan reports**

## 🌐 API Documentation

### Authentication
All API endpoints require authentication. Include your session token or API key:

```bash
# Using session (after login)
curl -H "Cookie: session=your-session-token" \
     http://localhost:5001/api/v1/messages

# Using API key
curl -H "X-API-Key: your-api-key" \
     http://localhost:5001/api/v1/system/status
```

### Core Endpoints

#### Messaging
```bash
# Send message with fast delivery
POST /api/v1/messages
{
    "room_id": "room123",
    "content": "Hello, world!",
    "type": "text"
}

# Get message history
GET /api/v1/messages/{room_id}?limit=50
```

#### File Upload
```bash
# Upload with security scanning
POST /api/v1/upload
Content-Type: multipart/form-data
file: [binary data]
```

#### System Management
```bash
# Get system status
GET /api/v1/system/status

# Get performance metrics
GET /api/v1/system/metrics

# Create manual backup
POST /api/v1/system/backup

# List available backups
GET /api/v1/system/backups
```

#### Global Access
```bash
# Get all access URLs
GET /api/v1/access/urls

# Setup specific tunnel method
POST /api/v1/access/setup/ngrok
POST /api/v1/access/setup/cloudflare
POST /api/v1/access/setup/localtunnel
POST /api/v1/access/setup/serveo
```

## 🔧 Configuration

### Environment Variables
```bash
# Application settings
FLASK_ENV=development              # or production
SECRET_KEY=your-secret-key
DATABASE=secure_chat.db

# Rate limiting
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Global access
NGROK_AUTH_TOKEN=your-token        # For ngrok pro features
CLOUDFLARE_TUNNEL_TOKEN=your-token # For permanent tunnels

# Security settings
ENABLE_FILE_SCANNING=true
MESSAGE_ENCRYPTION_ENABLED=true
AUTO_BACKUP_ENABLED=true
```

### Advanced Configuration
Edit `config.py` to customize:
- Rate limiting thresholds
- Security policies
- Performance monitoring settings
- Auto-scaling parameters
- Backup retention policies

## 📊 Monitoring & Management

### Performance Dashboard
Access real-time metrics at `/api/v1/system/metrics`:
- CPU and memory usage
- Response times
- Error rates
- Active connections
- Rate limiting statistics

### Backup Management
- **Automatic backups** every hour (configurable)
- **Encrypted storage** with secure keys
- **Disaster recovery** with auto-restoration
- **Manual backup** via API or admin interface

### Health Monitoring
- **System health checks** every 5 minutes
- **Auto-optimization** when thresholds exceeded
- **Alert system** for critical issues
- **Graceful degradation** during high load

## 🛠️ Troubleshooting

### Common Issues

#### Rate Limiting Too Aggressive
```bash
# Temporary fix: increase limits in config.py
RATE_LIMIT_LOGIN_ATTEMPTS = 50
RATE_LIMIT_MESSAGE_SENDS = 200
```

#### Global Access Not Working
```bash
# Check available methods
curl http://localhost:5001/api/v1/access/urls

# Manually setup specific method
curl -X POST http://localhost:5001/api/v1/access/setup/cloudflare
```

#### Local Storage Issues
```bash
# Check storage initialization
curl -X POST http://localhost:5001/api/v1/storage/initialize

# Verify consent status
curl http://localhost:5001/api/v1/storage/stats
```

#### Performance Issues
```bash
# Check system metrics
curl http://localhost:5001/api/v1/system/metrics

# Force optimization
curl -X POST http://localhost:5001/api/v1/system/optimize
```

### Logs and Debugging
- **Application logs**: `logs/secure_chat.log`
- **Security logs**: `logs/security.log`
- **Performance logs**: Check system metrics endpoint
- **Debug mode**: Set `FLASK_ENV=development`

## 🔒 Security Best Practices

### Production Deployment
1. **Use HTTPS** with valid SSL certificates
2. **Set secure environment variables**
3. **Enable Redis** for distributed rate limiting
4. **Configure firewall** rules appropriately
5. **Set up monitoring** and alerting
6. **Regular security updates**
7. **Backup testing** and recovery procedures

### User Privacy
1. **Inform users** about local storage
2. **Obtain explicit consent** for data storage
3. **Provide data export** options
4. **Secure deletion** capabilities
5. **Transparent security** practices

## 📈 Scaling and Performance

### Horizontal Scaling
- **Load balancer** with health checks
- **Auto-scaling** based on metrics
- **Session affinity** for WebSocket connections
- **Database replication** for high availability

### Performance Optimization
- **Message queueing** for fast delivery
- **Intelligent caching** strategies
- **Resource monitoring** and optimization
- **Graceful degradation** under load

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add comprehensive tests
5. Update documentation
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation
- Monitor system logs for errors

## 🔮 Roadmap

### Upcoming Features
- **Mobile applications** (iOS/Android)
- **Desktop clients** (Electron-based)
- **Voice and video calling**
- **Group management** improvements
- **Plugin system** for extensions
- **Blockchain integration** for message integrity
- **AI-powered spam detection**
- **Multi-language support**

---

**⚠️ Security Notice**: This application implements military-grade security. Always keep your software updated and follow security best practices in production environments.
