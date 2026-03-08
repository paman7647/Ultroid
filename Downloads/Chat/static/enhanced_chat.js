// Enhanced SecureChat JavaScript with Advanced Features
// Privacy Features, Online Status, Themes, Message Customization

class SecureChatPro {
    constructor() {
        this.currentTheme = localStorage.getItem('chat-theme') || 'dark';
        this.messageStyle = localStorage.getItem('message-style') || 'rounded';
        this.privacySettings = this.loadPrivacySettings();
        this.contacts = new Map();
        this.currentChat = null;
        this.socket = null;
        this.typingTimeout = null;
        this.lastSeen = new Map();
        this.onlineUsers = new Set();
        
        this.init();
    }
    
    init() {
        this.applyTheme();
        this.applyMessageStyle();
        this.setupEventListeners();
        this.loadContacts();
        this.initializeSocket();
        this.startHeartbeat();
        this.setupNotifications();
        this.loadEmojiPicker();
        
        console.log('🔒 SecureChat Pro initialized with enhanced features');
    }
    
    // Theme Management
    applyTheme() {
        document.body.className = `theme-${this.currentTheme}`;
        this.updateThemeButtons();
    }
    
    updateThemeButtons() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.currentTheme);
        });
    }
    
    changeTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('chat-theme', theme);
        this.applyTheme();
        this.showNotification('Theme changed', `Switched to ${theme} theme`);
    }
    
    // Message Style Management
    applyMessageStyle() {
        document.body.className = document.body.className.replace(/message-style-\w+/g, '');
        document.body.classList.add(`message-style-${this.messageStyle}`);
        this.updateStyleButtons();
    }
    
    updateStyleButtons() {
        document.querySelectorAll('.style-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.style === this.messageStyle);
        });
    }
    
    changeMessageStyle(style) {
        this.messageStyle = style;
        localStorage.setItem('message-style', style);
        this.applyMessageStyle();
        this.showNotification('Message style changed', `Switched to ${style} style`);
    }
    
    // Privacy Settings
    loadPrivacySettings() {
        const defaults = {
            showOnlineStatus: true,
            showLastSeen: true,
            readReceipts: true,
            typingIndicators: true,
            autoDelete: true,
            soundNotifications: true,
            desktopNotifications: true,
            vibration: true
        };
        
        return {
            ...defaults,
            ...JSON.parse(localStorage.getItem('privacy-settings') || '{}')
        };
    }
    
    savePrivacySettings() {
        localStorage.setItem('privacy-settings', JSON.stringify(this.privacySettings));
    }
    
    updatePrivacySetting(setting, value) {
        this.privacySettings[setting] = value;
        this.savePrivacySettings();
        this.applyPrivacySettings();
        this.showNotification('Privacy updated', `${setting} ${value ? 'enabled' : 'disabled'}`);
    }
    
    applyPrivacySettings() {
        // Update UI based on privacy settings
        if (!this.privacySettings.showOnlineStatus) {
            document.querySelectorAll('.status-indicator').forEach(el => el.style.display = 'none');
        }
        
        if (!this.privacySettings.showLastSeen) {
            document.querySelectorAll('.last-seen').forEach(el => el.style.display = 'none');
        }
        
        if (!this.privacySettings.typingIndicators) {
            document.getElementById('typing-indicator').style.display = 'none';
        }
    }
    
    // Contact Management
    loadContacts() {
        // Simulate loading contacts with online status
        const mockContacts = [
            {
                id: 1,
                name: '🤖 SecureBot',
                avatar: this.generateAvatar('SB'),
                status: 'online',
                lastSeen: 'Online',
                unreadCount: 0,
                lastMessage: 'Welcome to SecureChat Pro!'
            },
            {
                id: 2,
                name: '👤 Alice Cooper',
                avatar: this.generateAvatar('AC'),
                status: 'online',
                lastSeen: 'Online',
                unreadCount: 3,
                lastMessage: 'Hey! How are you doing?'
            },
            {
                id: 3,
                name: '👨‍💻 Bob Wilson',
                avatar: this.generateAvatar('BW'),
                status: 'away',
                lastSeen: '5 minutes ago',
                unreadCount: 0,
                lastMessage: 'I\'ll be back in a bit'
            },
            {
                id: 4,
                name: '👩‍🎨 Carol Smith',
                avatar: this.generateAvatar('CS'),
                status: 'busy',
                lastSeen: '1 hour ago',
                unreadCount: 1,
                lastMessage: 'Working on the new design'
            },
            {
                id: 5,
                name: '🧑‍🔬 David Lee',
                avatar: this.generateAvatar('DL'),
                status: 'offline',
                lastSeen: 'Yesterday',
                unreadCount: 0,
                lastMessage: 'See you tomorrow!'
            }
        ];
        
        mockContacts.forEach(contact => {
            this.contacts.set(contact.id, contact);
        });
        
        this.renderContacts();
        this.updateOnlineCount();
    }
    
    generateAvatar(initials) {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        const color = colors[initials.charCodeAt(0) % colors.length];
        
        return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='${encodeURIComponent(color)}'/><text x='50' y='60' font-size='32' text-anchor='middle' fill='white' font-family='Arial'>${initials}</text></svg>`;
    }
    
    renderContacts() {
        const contactsList = document.getElementById('contacts-list');
        const recentList = document.getElementById('recent-chats');
        
        if (!contactsList) return;
        
        contactsList.innerHTML = '';
        recentList.innerHTML = '';
        
        this.contacts.forEach(contact => {
            const contactElement = this.createContactElement(contact);
            contactsList.appendChild(contactElement);
            
            // Add to recent if there are messages
            if (contact.lastMessage) {
                const recentElement = this.createRecentElement(contact);
                recentList.appendChild(recentElement);
            }
        });
    }
    
    createContactElement(contact) {
        const li = document.createElement('li');
        li.className = 'contact-item';
        li.dataset.contactId = contact.id;
        
        li.innerHTML = `
            <div class="contact-info">
                <div class="contact-avatar">
                    <img src="${contact.avatar}" alt="${contact.name}">
                    <div class="status-indicator ${contact.status}"></div>
                </div>
                <div class="contact-details">
                    <span class="contact-name">${contact.name}</span>
                    <span class="contact-last-message">${contact.lastMessage || 'No messages yet'}</span>
                </div>
            </div>
            <div class="contact-meta">
                <span class="message-time">${this.formatTime(new Date())}</span>
                ${contact.unreadCount > 0 ? `<span class="unread-count">${contact.unreadCount}</span>` : ''}
            </div>
        `;
        
        li.addEventListener('click', () => this.selectContact(contact.id));
        
        return li;
    }
    
    createRecentElement(contact) {
        const li = document.createElement('li');
        li.className = 'recent-item';
        li.dataset.contactId = contact.id;
        
        li.innerHTML = `
            <div class="contact-info">
                <div class="contact-avatar">
                    <img src="${contact.avatar}" alt="${contact.name}">
                    <div class="status-indicator ${contact.status}"></div>
                </div>
                <div class="contact-details">
                    <span class="contact-name">${contact.name}</span>
                    <span class="contact-last-message">${contact.lastMessage}</span>
                </div>
            </div>
            <div class="contact-meta">
                <span class="message-time">${this.formatTime(new Date())}</span>
                ${contact.unreadCount > 0 ? `<span class="unread-count">${contact.unreadCount}</span>` : ''}
            </div>
        `;
        
        li.addEventListener('click', () => this.selectContact(contact.id));
        
        return li;
    }
    
    selectContact(contactId) {
        const contact = this.contacts.get(contactId);
        if (!contact) return;
        
        this.currentChat = contact;
        
        // Update active states
        document.querySelectorAll('.contact-item, .recent-item').forEach(el => {
            el.classList.toggle('active', el.dataset.contactId == contactId);
        });
        
        // Update chat header
        this.updateChatHeader(contact);
        
        // Load chat messages
        this.loadChatMessages(contactId);
        
        // Mark as read
        contact.unreadCount = 0;
        this.renderContacts();
    }
    
    updateChatHeader(contact) {
        document.getElementById('chat-title').textContent = contact.name;
        document.getElementById('chat-avatar').src = contact.avatar;
        document.getElementById('contact-status').className = `status-indicator ${contact.status}`;
        document.getElementById('contact-last-seen').textContent = this.privacySettings.showLastSeen ? contact.lastSeen : '';
    }
    
    updateOnlineCount() {
        const onlineCount = Array.from(this.contacts.values()).filter(c => c.status === 'online').length;
        const onlineCountEl = document.getElementById('online-count');
        if (onlineCountEl) {
            onlineCountEl.textContent = `${onlineCount} online`;
        }
    }
    
    // Message Management
    loadChatMessages(contactId) {
        const messageList = document.getElementById('message-list');
        if (!messageList) return;
        
        // Clear existing messages except system message
        const systemMessage = messageList.querySelector('.system-message');
        messageList.innerHTML = '';
        if (systemMessage) {
            messageList.appendChild(systemMessage);
        }
        
        // Load mock messages for demonstration
        const mockMessages = this.getMockMessages(contactId);
        mockMessages.forEach(message => {
            this.addMessage(message, false);
        });
        
        this.scrollToBottom();
    }
    
    getMockMessages(contactId) {
        const messages = {
            1: [ // SecureBot
                {
                    id: 1,
                    type: 'received',
                    content: '🛡️ Welcome to SecureChat Pro! Your messages are protected with military-grade encryption.',
                    timestamp: new Date(Date.now() - 300000),
                    status: 'delivered'
                },
                {
                    id: 2,
                    type: 'received',
                    content: '🎨 You can now customize themes, message styles, and privacy settings!',
                    timestamp: new Date(Date.now() - 240000),
                    status: 'delivered'
                }
            ],
            2: [ // Alice
                {
                    id: 3,
                    type: 'received',
                    content: 'Hey! How are you doing?',
                    timestamp: new Date(Date.now() - 120000),
                    status: 'delivered'
                },
                {
                    id: 4,
                    type: 'received',
                    content: 'I love the new theme options! 🎨',
                    timestamp: new Date(Date.now() - 60000),
                    status: 'delivered'
                },
                {
                    id: 5,
                    type: 'received',
                    content: 'The message bubbles look so cool now!',
                    timestamp: new Date(Date.now() - 30000),
                    status: 'delivered'
                }
            ]
        };
        
        return messages[contactId] || [];
    }
    
    addMessage(messageData, animate = true) {
        const messageList = document.getElementById('message-list');
        if (!messageList) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${messageData.type}`;
        messageElement.dataset.messageId = messageData.id;
        
        if (animate) {
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateY(20px) scale(0.95)';
        }
        
        messageElement.innerHTML = `
            <div class="message-content">
                ${this.processMessageContent(messageData.content)}
            </div>
            <div class="message-meta">
                <span class="message-time">${this.formatTime(messageData.timestamp)}</span>
                ${messageData.type === 'sent' ? `<span class="message-status ${messageData.status}">
                    ${this.getStatusIcon(messageData.status)}
                </span>` : ''}
            </div>
        `;
        
        // Add context menu
        messageElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showMessageContextMenu(e, messageData);
        });
        
        messageList.appendChild(messageElement);
        
        if (animate) {
            requestAnimationFrame(() => {
                messageElement.style.transition = 'all 0.3s ease-out';
                messageElement.style.opacity = '1';
                messageElement.style.transform = 'translateY(0) scale(1)';
            });
        }
        
        // Auto-delete if enabled
        if (this.privacySettings.autoDelete && messageData.type === 'received') {
            this.scheduleMessageDeletion(messageElement, 30000); // 30 seconds for demo
        }
        
        this.scrollToBottom();
    }
    
    processMessageContent(content) {
        // Process emojis, links, mentions, etc.
        return content
            .replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank" rel="noopener">$&</a>')
            .replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    }
    
    getStatusIcon(status) {
        const icons = {
            sending: '⏳',
            sent: '✓',
            delivered: '✓✓',
            read: '✓✓'
        };
        return icons[status] || '';
    }
    
    scheduleMessageDeletion(messageElement, delay) {
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.style.transition = 'all 0.5s ease-out';
                messageElement.style.opacity = '0';
                messageElement.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    if (messageElement.parentNode) {
                        messageElement.remove();
                    }
                }, 500);
            }
        }, delay);
    }
    
    // Message Sending
    sendMessage() {
        const input = document.getElementById('message-input');
        if (!input) return;
        
        const content = input.value.trim();
        if (!content || !this.currentChat) return;
        
        const messageData = {
            id: Date.now(),
            type: 'sent',
            content: content,
            timestamp: new Date(),
            status: 'sending'
        };
        
        // Add message to UI
        this.addMessage(messageData);
        
        // Clear input
        input.value = '';
        this.updateCharCount();
        this.toggleSendButton();
        
        // Simulate sending process
        this.simulateSendingProcess(messageData);
        
        // Play send sound
        if (this.privacySettings.soundNotifications) {
            this.playSound('send');
        }
        
        // Stop typing indicator
        this.stopTyping();
    }
    
    simulateSendingProcess(messageData) {
        // Update status to sent
        setTimeout(() => {
            this.updateMessageStatus(messageData.id, 'sent');
        }, 500);
        
        // Update status to delivered
        setTimeout(() => {
            this.updateMessageStatus(messageData.id, 'delivered');
        }, 1000);
        
        // Simulate response
        setTimeout(() => {
            this.simulateResponse(messageData.content);
        }, 2000 + Math.random() * 3000);
    }
    
    updateMessageStatus(messageId, status) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;
        
        const statusElement = messageElement.querySelector('.message-status');
        if (statusElement) {
            statusElement.className = `message-status ${status}`;
            statusElement.innerHTML = this.getStatusIcon(status);
        }
    }
    
    simulateResponse(originalMessage) {
        if (!this.currentChat || this.currentChat.id === 1) { // SecureBot responses
            const responses = [
                '🔒 Message received and encrypted successfully!',
                '🛡️ Your communication is secure and private.',
                '⚡ Processing through secure channels...',
                '🔍 No threats detected in your message.',
                `🤖 Echo: "${originalMessage}" - Encryption verified!`,
                '🎨 Try changing the theme or message style!',
                '🔐 All messages are end-to-end encrypted.',
                '📱 You can access this chat from any device securely.'
            ];
            
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            
            const responseData = {
                id: Date.now() + 1,
                type: 'received',
                content: randomResponse,
                timestamp: new Date(),
                status: 'delivered'
            };
            
            // Show typing indicator first
            this.showTypingIndicator();
            
            setTimeout(() => {
                this.hideTypingIndicator();
                this.addMessage(responseData);
                
                // Show notification if not active
                if (document.hidden && this.privacySettings.desktopNotifications) {
                    this.showDesktopNotification('SecureBot', randomResponse);
                }
                
                // Play receive sound
                if (this.privacySettings.soundNotifications) {
                    this.playSound('receive');
                }
            }, 1500);
        }
    }
    
    // Typing Indicators
    showTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator && this.privacySettings.typingIndicators) {
            indicator.classList.add('active');
        }
    }
    
    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
    }
    
    handleTyping() {
        if (!this.privacySettings.typingIndicators) return;
        
        // Clear previous timeout
        clearTimeout(this.typingTimeout);
        
        // Simulate sending typing event
        if (this.currentChat) {
            console.log('Typing to:', this.currentChat.name);
        }
        
        // Stop typing after 3 seconds of inactivity
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 3000);
    }
    
    stopTyping() {
        clearTimeout(this.typingTimeout);
        // Simulate stopping typing event
        if (this.currentChat) {
            console.log('Stopped typing to:', this.currentChat.name);
        }
    }
    
    // Event Listeners
    setupEventListeners() {
        // Settings panel
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.toggleSettingsPanel();
        });
        
        document.getElementById('close-settings')?.addEventListener('click', () => {
            this.closeSettingsPanel();
        });
        
        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.changeTheme(btn.dataset.theme);
            });
        });
        
        // Style buttons
        document.querySelectorAll('.style-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.changeMessageStyle(btn.dataset.style);
            });
        });
        
        // Privacy settings
        document.querySelectorAll('.settings-panel input[type="checkbox"]').forEach(checkbox => {
            const setting = checkbox.id.replace(/-/g, '');
            checkbox.checked = this.privacySettings[setting];
            
            checkbox.addEventListener('change', () => {
                this.updatePrivacySetting(setting, checkbox.checked);
            });
        });
        
        // Message input
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                this.handleTyping();
                this.updateCharCount();
                this.toggleSendButton();
                this.autoResize();
            });
            
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        // Send button
        document.getElementById('send-button')?.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // Emoji picker
        document.getElementById('emoji-btn')?.addEventListener('click', () => {
            this.toggleEmojiPicker();
        });
        
        // File upload
        document.getElementById('file-btn')?.addEventListener('click', () => {
            document.getElementById('file-input')?.click();
        });
        
        document.getElementById('file-input')?.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
        
        // Voice note
        document.getElementById('voice-note-btn')?.addEventListener('click', () => {
            this.toggleVoiceRecording();
        });
        
        // Contact info
        document.getElementById('chat-info-btn')?.addEventListener('click', () => {
            this.toggleContactInfo();
        });
        
        document.getElementById('close-contact-info')?.addEventListener('click', () => {
            this.closeContactInfo();
        });
        
        // Search
        document.getElementById('contact-search')?.addEventListener('input', (e) => {
            this.searchContacts(e.target.value);
        });
        
        // Scroll to bottom
        document.getElementById('scroll-bottom')?.addEventListener('click', () => {
            this.scrollToBottom();
        });
        
        // Close context menu on click outside
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });
        
        // Theme toggle
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            this.cycleTheme();
        });
        
        // Notification close
        document.getElementById('close-notification')?.addEventListener('click', () => {
            this.hideNotification();
        });
        
        // Voice recorder controls
        document.getElementById('cancel-recording')?.addEventListener('click', () => {
            this.cancelVoiceRecording();
        });
        
        document.getElementById('send-recording')?.addEventListener('click', () => {
            this.sendVoiceRecording();
        });
    }
    
    // UI Helper Methods
    toggleSettingsPanel() {
        const panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.toggle('open');
        }
    }
    
    closeSettingsPanel() {
        const panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.remove('open');
        }
    }
    
    toggleContactInfo() {
        const panel = document.getElementById('contact-info-panel');
        if (panel && this.currentChat) {
            panel.classList.toggle('open');
            this.updateContactInfo();
        }
    }
    
    updateContactInfo() {
        if (!this.currentChat) return;
        
        document.getElementById('info-avatar').src = this.currentChat.avatar;
        document.getElementById('info-name').textContent = this.currentChat.name;
        document.getElementById('info-status').textContent = this.currentChat.lastSeen;
    }
    
    closeContactInfo() {
        const panel = document.getElementById('contact-info-panel');
        if (panel) {
            panel.classList.remove('open');
        }
    }
    
    updateCharCount() {
        const input = document.getElementById('message-input');
        const counter = document.getElementById('char-count');
        
        if (input && counter) {
            const count = input.value.length;
            const max = 4000;
            counter.textContent = `${count}/${max}`;
            
            counter.className = 'char-count';
            if (count > max * 0.9) {
                counter.classList.add('warning');
            }
            if (count >= max) {
                counter.classList.add('error');
            }
        }
    }
    
    toggleSendButton() {
        const input = document.getElementById('message-input');
        const button = document.getElementById('send-button');
        
        if (input && button) {
            const hasContent = input.value.trim().length > 0;
            button.disabled = !hasContent;
        }
    }
    
    autoResize() {
        const input = document.getElementById('message-input');
        if (input) {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        }
    }
    
    scrollToBottom() {
        const messageList = document.getElementById('message-list');
        if (messageList) {
            messageList.scrollTop = messageList.scrollHeight;
        }
    }
    
    cycleTheme() {
        const themes = ['dark', 'light', 'neon', 'ocean', 'forest', 'sunset'];
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.changeTheme(themes[nextIndex]);
    }
    
    // Emoji Picker
    loadEmojiPicker() {
        const emojiCategories = {
            recent: ['😀', '😂', '🥰', '😎', '🤔', '👍', '❤️', '🎉'],
            smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
            people: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
            nature: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇'],
            food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔'],
            activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷'],
            travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍', '🛵', '🚲', '🛴', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞'],
            objects: ['💡', '🔦', '🏮', '🪔', '📱', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚'],
            symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐'],
            flags: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇺🇸', '🇬🇧', '🇫🇷', '🇩🇪', '🇮🇹', '🇪🇸', '🇯🇵', '🇨🇳', '🇰🇷', '🇮🇳', '🇷🇺', '🇧🇷', '🇨🇦', '🇦🇺', '🇲🇽', '🇦🇷', '🇿🇦', '🇳🇬', '🇪🇬', '🇸🇦', '🇮🇱', '🇹🇷']
        };
        
        this.emojiCategories = emojiCategories;
        this.setupEmojiPicker();
    }
    
    setupEmojiPicker() {
        const categories = document.querySelectorAll('.emoji-cat');
        categories.forEach(cat => {
            cat.addEventListener('click', () => {
                this.showEmojiCategory(cat.dataset.cat);
                categories.forEach(c => c.classList.remove('active'));
                cat.classList.add('active');
            });
        });
        
        this.showEmojiCategory('recent');
    }
    
    showEmojiCategory(category) {
        const grid = document.getElementById('emoji-grid');
        if (!grid || !this.emojiCategories[category]) return;
        
        grid.innerHTML = '';
        
        this.emojiCategories[category].forEach(emoji => {
            const button = document.createElement('button');
            button.className = 'emoji-item';
            button.textContent = emoji;
            button.addEventListener('click', () => {
                this.insertEmoji(emoji);
            });
            grid.appendChild(button);
        });
    }
    
    insertEmoji(emoji) {
        const input = document.getElementById('message-input');
        if (input) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const text = input.value;
            input.value = text.substring(0, start) + emoji + text.substring(end);
            input.selectionStart = input.selectionEnd = start + emoji.length;
            input.focus();
            this.updateCharCount();
            this.toggleSendButton();
        }
        this.hideEmojiPicker();
    }
    
    toggleEmojiPicker() {
        const picker = document.getElementById('emoji-picker');
        if (picker) {
            const isVisible = picker.style.display !== 'none';
            picker.style.display = isVisible ? 'none' : 'block';
        }
    }
    
    hideEmojiPicker() {
        const picker = document.getElementById('emoji-picker');
        if (picker) {
            picker.style.display = 'none';
        }
    }
    
    // File Upload
    handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        Array.from(files).forEach(file => {
            this.uploadFile(file);
        });
    }
    
    uploadFile(file) {
        // Validate file
        if (file.size > 8 * 1024 * 1024) { // 8MB limit
            this.showNotification('File too large', 'Maximum file size is 8MB');
            return;
        }
        
        // Show upload progress
        this.showUploadProgress(file.name);
        
        // Simulate upload
        this.simulateFileUpload(file);
    }
    
    showUploadProgress(filename) {
        const progress = document.getElementById('upload-progress');
        const text = progress.querySelector('.progress-text');
        const fill = progress.querySelector('.progress-fill');
        
        if (progress && text && fill) {
            text.textContent = `Uploading ${filename}... 0%`;
            fill.style.width = '0%';
            progress.style.display = 'block';
        }
    }
    
    simulateFileUpload(file) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                this.completeFileUpload(file);
            }
            
            const progressEl = document.getElementById('upload-progress');
            const text = progressEl?.querySelector('.progress-text');
            const fill = progressEl?.querySelector('.progress-fill');
            
            if (text && fill) {
                text.textContent = `Uploading ${file.name}... ${Math.round(progress)}%`;
                fill.style.width = `${progress}%`;
            }
        }, 200);
    }
    
    completeFileUpload(file) {
        // Hide progress
        const progress = document.getElementById('upload-progress');
        if (progress) {
            setTimeout(() => {
                progress.style.display = 'none';
            }, 1000);
        }
        
        // Add file message
        const fileMessage = {
            id: Date.now(),
            type: 'sent',
            content: `📎 ${file.name} (${this.formatFileSize(file.size)})`,
            timestamp: new Date(),
            status: 'sent'
        };
        
        this.addMessage(fileMessage);
        
        this.showNotification('File uploaded', `${file.name} uploaded successfully`);
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Voice Recording
    toggleVoiceRecording() {
        if (this.isRecording) {
            this.stopVoiceRecording();
        } else {
            this.startVoiceRecording();
        }
    }
    
    startVoiceRecording() {
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        
        // Show recorder UI
        const recorder = document.getElementById('voice-recorder');
        if (recorder) {
            recorder.style.display = 'block';
        }
        
        // Start timer
        this.startRecordingTimer();
        
        // Request microphone permission (simulated)
        this.showNotification('Recording started', 'Speak now...');
        
        if (this.privacySettings.vibration && navigator.vibrate) {
            navigator.vibrate(100);
        }
    }
    
    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timeDisplay = document.getElementById('recording-time');
            if (timeDisplay) {
                timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    stopVoiceRecording() {
        this.isRecording = false;
        clearInterval(this.recordingTimer);
        
        // Hide recorder UI
        const recorder = document.getElementById('voice-recorder');
        if (recorder) {
            recorder.style.display = 'none';
        }
    }
    
    cancelVoiceRecording() {
        this.stopVoiceRecording();
        this.showNotification('Recording cancelled', 'Voice note discarded');
    }
    
    sendVoiceRecording() {
        const duration = Date.now() - this.recordingStartTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        this.stopVoiceRecording();
        
        // Add voice message
        const voiceMessage = {
            id: Date.now(),
            type: 'sent',
            content: `🎤 Voice message (${minutes}:${seconds.toString().padStart(2, '0')})`,
            timestamp: new Date(),
            status: 'sent'
        };
        
        this.addMessage(voiceMessage);
        this.showNotification('Voice message sent', 'Recording sent successfully');
    }
    
    // Context Menu
    showMessageContextMenu(event, messageData) {
        const menu = document.getElementById('message-context-menu');
        if (!menu) return;
        
        menu.style.display = 'block';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        
        // Store current message data
        this.contextMenuMessage = messageData;
        
        // Add event listeners to context items
        menu.querySelectorAll('.context-item').forEach(item => {
            item.onclick = () => this.handleContextAction(item.dataset.action);
        });
    }
    
    hideContextMenu() {
        const menu = document.getElementById('message-context-menu');
        if (menu) {
            menu.style.display = 'none';
        }
    }
    
    handleContextAction(action) {
        if (!this.contextMenuMessage) return;
        
        switch (action) {
            case 'reply':
                this.replyToMessage(this.contextMenuMessage);
                break;
            case 'forward':
                this.forwardMessage(this.contextMenuMessage);
                break;
            case 'copy':
                this.copyMessage(this.contextMenuMessage);
                break;
            case 'star':
                this.starMessage(this.contextMenuMessage);
                break;
            case 'delete':
                this.deleteMessage(this.contextMenuMessage);
                break;
        }
        
        this.hideContextMenu();
    }
    
    replyToMessage(messageData) {
        const input = document.getElementById('message-input');
        if (input) {
            input.value = `Reply to: "${messageData.content.substring(0, 50)}..."\n\n`;
            input.focus();
            this.updateCharCount();
            this.toggleSendButton();
        }
    }
    
    forwardMessage(messageData) {
        this.showNotification('Forward', 'Select a contact to forward this message to');
    }
    
    copyMessage(messageData) {
        navigator.clipboard.writeText(messageData.content).then(() => {
            this.showNotification('Copied', 'Message copied to clipboard');
        });
    }
    
    starMessage(messageData) {
        this.showNotification('Starred', 'Message added to starred messages');
    }
    
    deleteMessage(messageData) {
        const messageElement = document.querySelector(`[data-message-id="${messageData.id}"]`);
        if (messageElement) {
            messageElement.style.transition = 'all 0.3s ease-out';
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'scale(0.8)';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 300);
        }
        this.showNotification('Deleted', 'Message deleted');
    }
    
    // Search
    searchContacts(query) {
        const contacts = document.querySelectorAll('.contact-item');
        contacts.forEach(contact => {
            const name = contact.querySelector('.contact-name').textContent.toLowerCase();
            const match = name.includes(query.toLowerCase());
            contact.style.display = match ? 'flex' : 'none';
        });
    }
    
    // Notifications
    setupNotifications() {
        if ('Notification' in window && this.privacySettings.desktopNotifications) {
            Notification.requestPermission();
        }
    }
    
    showNotification(title, message, duration = 3000) {
        const popup = document.getElementById('notification-popup');
        const titleEl = document.getElementById('notification-title');
        const messageEl = document.getElementById('notification-message');
        
        if (popup && titleEl && messageEl) {
            titleEl.textContent = title;
            messageEl.textContent = message;
            popup.style.display = 'block';
            
            setTimeout(() => {
                this.hideNotification();
            }, duration);
        }
    }
    
    hideNotification() {
        const popup = document.getElementById('notification-popup');
        if (popup) {
            popup.style.display = 'none';
        }
    }
    
    showDesktopNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: '/static/icon.png',
                badge: '/static/badge.png'
            });
        }
    }
    
    // Sounds
    playSound(type) {
        // Create audio context for sound effects
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const sounds = {
            send: { frequency: 800, duration: 100 },
            receive: { frequency: 600, duration: 150 },
            typing: { frequency: 400, duration: 50 }
        };
        
        const sound = sounds[type];
        if (!sound) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(sound.frequency, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sound.duration / 1000);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + sound.duration / 1000);
    }
    
    // Socket Management (simulated)
    initializeSocket() {
        // Simulate WebSocket connection
        console.log('🔌 Initializing secure WebSocket connection...');
        
        // Simulate connection events
        setTimeout(() => {
            console.log('✅ Secure connection established');
            this.onSocketConnected();
        }, 1000);
    }
    
    onSocketConnected() {
        // Update UI to show connected state
        this.showNotification('Connected', 'Secure connection established');
    }
    
    // Heartbeat for online status
    startHeartbeat() {
        setInterval(() => {
            // Update last seen times
            this.updateLastSeenTimes();
            
            // Simulate random status changes
            if (Math.random() < 0.1) { // 10% chance
                this.simulateStatusChange();
            }
        }, 30000); // Every 30 seconds
    }
    
    updateLastSeenTimes() {
        this.contacts.forEach(contact => {
            if (contact.status === 'offline') {
                // Update offline users' last seen time
                const minutesAgo = Math.floor(Math.random() * 60) + 1;
                contact.lastSeen = `${minutesAgo} minutes ago`;
            }
        });
    }
    
    simulateStatusChange() {
        const contactIds = Array.from(this.contacts.keys());
        const randomId = contactIds[Math.floor(Math.random() * contactIds.length)];
        const contact = this.contacts.get(randomId);
        
        if (contact) {
            const statuses = ['online', 'away', 'busy', 'offline'];
            const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
            
            if (contact.status !== newStatus) {
                contact.status = newStatus;
                contact.lastSeen = newStatus === 'online' ? 'Online' : 'Just now';
                
                this.renderContacts();
                this.updateOnlineCount();
                
                if (this.currentChat && this.currentChat.id === contact.id) {
                    this.updateChatHeader(contact);
                }
            }
        }
    }
    
    // Utility Methods
    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Initialize the enhanced chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.secureChatPro = new SecureChatPro();
});
