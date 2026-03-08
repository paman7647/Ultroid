# 🔒 Flask Secure Chat

A modern, secure real-time messaging application built with Flask, featuring end-to-end encryption, disappearing messages, and a beautiful animated UI.

![Chat Application](https://img.shields.io/badge/Flask-Chat-blue) ![Security](https://img.shields.io/badge/Security-E2E%20Encryption-green) ![Real-time](https://img.shields.io/badge/Real--time-Socket.IO-orange)

## ✨ Features

### 🔐 Security & Privacy
- **End-to-End Encryption**: Messages are encrypted before leaving your device
- **Disappearing Messages**: Auto-delete messages after specified time
- **Local Database**: All data stored locally on your device
- **Secure Authentication**: Password hashing with Werkzeug
- **Session Management**: Secure session handling with Flask-Login

### 💬 Messaging
- **Real-time Chat**: Instant messaging with Socket.IO
- **Group Chats**: Create and manage group conversations
- **Direct Messages**: Private one-on-one conversations
- **Message History**: Access previous conversations
- **Typing Indicators**: See when others are typing
- **Online Status**: Real-time user presence

### 🎨 User Interface
- **Modern Design**: Clean, professional interface
- **Animated UI**: Smooth CSS3 animations and transitions
- **Responsive Layout**: Works on desktop and mobile
- **Dark Theme Ready**: Elegant color scheme
- **Message Bubbles**: Distinct styling for sent/received messages

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flask-secure-chat
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize the database**
   ```bash
   python init_db.py
   ```

5. **Start the application**
   ```bash
   python flask-secure-chat.py
   ```

6. **Open in browser**
   Navigate to `http://127.0.0.1:5000`

## 🔑 Default Login Credentials

After running `init_db.py`, you can use these sample accounts:

| Username | Password    | Role  |
|----------|-------------|-------|
| admin    | admin123    | Admin |
| alice    | password123 | User  |
| bob      | password123 | User  |
| charlie  | password123 | User  |

## 📁 Project Structure

```
flask-secure-chat/
├── app/                          # Main application package
│   ├── __init__.py              # App factory and configuration
│   ├── db.py                    # Database connection and utilities
│   ├── models.py                # Data models (User, Message, Group)
│   ├── auth/                    # Authentication blueprint
│   │   ├── __init__.py
│   │   ├── forms.py             # WTForms for login/register
│   │   ├── routes.py            # Auth routes (login, register, logout)
│   │   └── templates/           # Auth templates
│   │       ├── login.html
│   │       └── register.html
│   └── main/                    # Main application blueprint
│       ├── __init__.py
│       ├── routes.py            # Main routes (index, chat)
│       ├── events.py            # Socket.IO event handlers
│       └── templates/           # Main templates
│           ├── index.html       # Landing page
│           └── chat.html        # Chat interface
├── static/                      # Static assets
│   ├── style.css               # Base styles
│   ├── main.js                 # Main JavaScript
│   ├── login.css               # Login page styles
│   ├── register.css            # Register page styles
│   ├── index.css               # Landing page styles
│   └── chat.css                # Chat interface styles
├── instance/                    # Instance folder (created automatically)
│   └── chat.sqlite             # SQLite database
├── config.py                   # Configuration settings
├── schema.sql                  # Database schema
├── init_db.py                  # Database initialization script
├── flask-secure-chat.py        # Application entry point
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

## 💾 Database Schema

The application uses SQLite with the following main tables:

- **users**: User accounts and profiles
- **groups**: Chat groups and direct message containers
- **group_members**: Many-to-many relationship between users and groups
- **messages**: All chat messages with encryption support
- **message_receipts**: Read receipts and delivery status

## 🔧 Configuration

The application supports multiple environments:

### Development (default)
```python
FLASK_ENV=development python flask-secure-chat.py
```

### Production
```python
FLASK_ENV=production python flask-secure-chat.py
```

### Environment Variables
- `SECRET_KEY`: Flask secret key for sessions
- `DATABASE_URL`: Database connection string
- `ENCRYPTION_KEY`: Key for message encryption
- `PORT`: Server port (default: 5000)
- `HOST`: Server host (default: 127.0.0.1)

## 🛡️ Security Features

### Encryption
- Messages are encrypted using AES-256
- Keys are derived using PBKDF2
- Each message has a unique initialization vector

### Authentication
- Passwords are hashed using Werkzeug's PBKDF2
- Sessions are managed securely with Flask-Login
- CSRF protection enabled for all forms

### Privacy
- Local database storage only
- No external data transmission
- Disappearing messages auto-delete

## 🎨 Customization

### Themes
The application uses CSS custom properties for easy theming:

```css
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --accent-color: #f093fb;
    --text-color: #333;
    --bg-color: #f8f9fa;
}
```

### Message Types
The application supports multiple message types:
- `text`: Regular text messages
- `image`: Image attachments
- `file`: File attachments
- `system`: System notifications

## 🔌 Socket.IO Events

### Client Events
- `connect`: User connection established
- `disconnect`: User disconnection
- `join_room`: Join a chat group
- `leave_room`: Leave a chat group
- `send_message`: Send a new message
- `typing_start`: Start typing indicator
- `typing_stop`: Stop typing indicator

### Server Events
- `user_connected`: Broadcast user online status
- `user_disconnected`: Broadcast user offline status
- `new_message`: Broadcast new message to group
- `message_delivered`: Confirm message delivery
- `typing_status`: Broadcast typing indicators
- `error`: Error notifications

## 📱 API Endpoints

### Authentication
- `GET /auth/login` - Login page
- `POST /auth/login` - Process login
- `GET /auth/register` - Registration page
- `POST /auth/register` - Process registration
- `GET /auth/logout` - Logout user

### Main Application
- `GET /` - Landing page
- `GET /chat` - Chat interface (requires login)
- `GET /chat/<group_id>` - Open specific chat

## 🧪 Testing

Run the test suite:
```bash
pip install pytest pytest-flask
pytest tests/
```

## 🚀 Deployment

### Using Gunicorn (Production)
```bash
pip install gunicorn
gunicorn -k eventlet -w 1 --bind 0.0.0.0:8000 flask-secure-chat:app
```

### Using Docker
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-k", "eventlet", "-w", "1", "--bind", "0.0.0.0:5000", "flask-secure-chat:app"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests for new functionality
5. Commit your changes: `git commit -am 'Add some feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## 📝 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section below
2. Search existing issues on GitHub
3. Create a new issue with detailed information

## 🔧 Troubleshooting

### Common Issues

**Database not found**
```bash
python init_db.py
```

**Port already in use**
```bash
export PORT=5001
python flask-secure-chat.py
```

**Dependencies not found**
```bash
pip install -r requirements.txt
```

**Socket.IO connection failed**
- Check if eventlet is installed
- Ensure no firewall blocking the port
- Try a different browser

### Debug Mode
Enable debug mode for detailed error messages:
```bash
FLASK_ENV=development python flask-secure-chat.py
```

## 🎯 Roadmap

- [ ] File upload and sharing
- [ ] Voice messages
- [ ] Video calls
- [ ] Mobile app (React Native)
- [ ] Desktop app (Electron)
- [ ] Message encryption at rest
- [ ] Push notifications
- [ ] Message search
- [ ] User profiles and avatars
- [ ] Group administration features

## 👨‍💻 Development

### Setting up development environment
```bash
# Clone the repository
git clone <repository-url>
cd flask-secure-chat

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install development dependencies
pip install -r requirements.txt
pip install pytest pytest-flask black flake8

# Initialize database
python init_db.py

# Run in development mode
FLASK_ENV=development python flask-secure-chat.py
```

### Code Style
We use Black for code formatting:
```bash
black .
```

And Flake8 for linting:
```bash
flake8 app/
```

---

Made with ❤️ and Python. Stay secure! 🔒
