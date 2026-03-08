// app/static/main.js - Enhanced chat functionality with animations

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Global State and Constants ---
    let currentGroupId = null;
    let userKeys = {
        publicKey: null,
        privateKey: null
    };
    
    // Initialize Socket.IO only if it's available
    let socket = null;
    if (typeof io !== 'undefined') {
        socket = io();
    }
    
    // --- DOM Element References ---
    const messageList = document.getElementById('message-list');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatTitle = document.getElementById('chat-title');
    const contactsList = document.getElementById('contacts');

    // --- Mock Data for Development ---
    const contacts = [
        { id: 1, name: 'Alice Johnson', online: true },
        { id: 2, name: 'Bob Smith', online: false },
        { id: 3, name: 'Carol Williams', online: true },
        { id: 4, name: 'David Brown', online: false }
    ];

    const messages = {
        1: [
            { id: 1, text: 'Hey! How are you doing?', sent: false, timestamp: Date.now() - 3600000 },
            { id: 2, text: 'I\'m great! Just working on the chat app.', sent: true, timestamp: Date.now() - 3300000 },
            { id: 3, text: 'That sounds exciting! Can\'t wait to try it.', sent: false, timestamp: Date.now() - 3000000, disappearing: true }
        ],
        2: [
            { id: 4, text: 'Welcome to secure chat!', sent: false, timestamp: Date.now() - 7200000 },
            { id: 5, text: 'Thanks! This looks amazing.', sent: true, timestamp: Date.now() - 7000000 }
        ],
        3: [
            { id: 6, text: 'The encryption is working perfectly!', sent: false, timestamp: Date.now() - 1800000 }
        ],
        4: []
    };

    // --- Core Functions ---

    /**
     * Initializes the application
     */
    function initializeApp() {
        console.log("Initializing Secure Chat application...");
        
        if (contactsList) {
            loadContacts();
        }
        
        // Generate mock encryption keys
        generateMockKeys();
        
        // Setup event listeners
        setupEventListeners();
        
        console.log("Application initialized successfully!");
    }

    /**
     * Generates mock encryption keys for demonstration
     */
    function generateMockKeys() {
        userKeys.publicKey = 'mock_public_key_' + Math.random().toString(36).substr(2, 9);
        userKeys.privateKey = 'mock_private_key_' + Math.random().toString(36).substr(2, 9);
        console.log("Mock encryption keys generated");
    }

    /**
     * Sets up event listeners for the application
     */
    function setupEventListeners() {
        // Send message on button click
        if (sendButton) {
            sendButton.addEventListener('click', sendMessage);
        }

        // Send message on Enter key press
        if (messageInput) {
            messageInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    sendMessage();
                }
            });
        }

        // Socket.IO event handlers
        if (socket) {
            socket.on('connect', () => {
                console.log('Connected to server with socket ID:', socket.id);
                updateConnectionStatus(true);
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from server');
                updateConnectionStatus(false);
            });

            socket.on('receive_message', handleReceivedMessage);
        }
    }

    /**
     * Updates the connection status indicator
     */
    function updateConnectionStatus(connected) {
        const encryptionStatus = document.querySelector('.encryption-status');
        if (encryptionStatus) {
            encryptionStatus.textContent = connected ? 
                '🔒 End-to-End Encrypted' : 
                '⚠️ Connecting...';
            encryptionStatus.style.color = connected ? '#28a745' : '#ffc107';
        }
    }

    /**
     * Loads and displays the contacts list
     */
    function loadContacts() {
        if (!contactsList) return;
        
        contactsList.innerHTML = '';
        contacts.forEach(contact => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="contact-info">
                    <span class="contact-name">${contact.name}</span>
                    <span class="contact-status ${contact.online ? 'online' : 'offline'}">
                        ${contact.online ? '🟢' : '🔴'}
                    </span>
                </div>
            `;
            li.onclick = () => selectContact(contact.id);
            li.setAttribute('data-contact-id', contact.id);
            
            if (contact.id === currentGroupId) {
                li.classList.add('active');
            }
            
            contactsList.appendChild(li);
        });
    }

    /**
     * Selects a contact and loads their chat
     */
    function selectContact(contactId) {
        currentGroupId = contactId;
        const contact = contacts.find(c => c.id === contactId);
        
        if (chatTitle && contact) {
            chatTitle.textContent = contact.name;
            chatTitle.style.animation = 'fadeIn 0.5s ease-out';
        }
        
        // Update active contact in list
        document.querySelectorAll('.chat-list li').forEach(li => {
            li.classList.remove('active');
        });
        document.querySelector(`[data-contact-id="${contactId}"]`)?.classList.add('active');
        
        // Enable input
        if (messageInput && sendButton) {
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
        
        loadMessages(contactId);
        console.log(`Switched to chat with: ${contact.name}`);
    }

    /**
     * Loads and displays messages for a contact
     */
    function loadMessages(contactId) {
        if (!messageList) return;
        
        messageList.innerHTML = '';
        const contactMessages = messages[contactId] || [];
        
        contactMessages.forEach((msg, index) => {
            displayMessage(msg, msg.sent, index * 100); // Stagger animations
        });
        
        scrollToBottom();
    }

    /**
     * Displays a message in the chat
     */
    function displayMessage(messageData, isSentByCurrentUser = false, delay = 0) {
        if (!messageList) return;
        
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(isSentByCurrentUser ? 'sent' : 'received');
        
        if (messageData.disappearing) {
            messageElement.classList.add('disappearing');
        }
        
        // Create message content
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        messageContent.textContent = messageData.text || messageData.content;
        
        // Create timestamp
        const timestamp = document.createElement('div');
        timestamp.classList.add('message-timestamp');
        timestamp.textContent = formatTimestamp(messageData.timestamp || Date.now());
        
        messageElement.appendChild(messageContent);
        messageElement.appendChild(timestamp);
        
        // Animate message appearance
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px) scale(0.9)';
        messageList.appendChild(messageElement);
        
        setTimeout(() => {
            messageElement.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0) scale(1)';
        }, delay);
        
        // Handle disappearing messages
        if (messageData.disappearing) {
            setTimeout(() => {
                messageElement.style.animation = 'fadeOut 2s forwards';
                setTimeout(() => {
                    if (messageElement.parentNode) {
                        messageElement.remove();
                    }
                }, 2000);
            }, 5000); // Disappear after 5 seconds
        }
        
        scrollToBottom();
    }

    /**
     * Formats timestamp for display
     */
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    }

    /**
     * Handles sending a new message
     */
    function sendMessage() {
        if (!messageInput || !currentGroupId) return;
        
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        console.log(`Sending message to contact ${currentGroupId}: ${messageText}`);

        // Create message object
        const newMessage = {
            id: Date.now(),
            text: messageText,
            sent: true,
            timestamp: Date.now()
        };

        // Add to messages store
        if (!messages[currentGroupId]) {
            messages[currentGroupId] = [];
        }
        messages[currentGroupId].push(newMessage);

        // Display the message immediately
        displayMessage(newMessage, true);

        // Send via Socket.IO if available
        if (socket) {
            socket.emit('send_message', {
                group_id: currentGroupId,
                content: messageText,
                timestamp: newMessage.timestamp
            });
        }

        // Clear input and add sending animation
        messageInput.value = '';
        messageInput.style.transform = 'scale(0.98)';
        setTimeout(() => {
            messageInput.style.transform = 'scale(1)';
        }, 100);
        
        messageInput.focus();
    }

    /**
     * Handles received messages from Socket.IO
     */
    function handleReceivedMessage(data) {
        console.log('Received message:', data);
        
        if (data.group_id === currentGroupId) {
            const receivedMessage = {
                id: data.id || Date.now(),
                text: data.content,
                sent: false,
                timestamp: data.timestamp || Date.now(),
                disappearing: data.disappearing || false
            };
            
            displayMessage(receivedMessage, false);
            
            // Add notification sound/animation here if needed
            notifyNewMessage();
        }
    }

    /**
     * Notifies user of new message
     */
    function notifyNewMessage() {
        // Add a subtle notification animation
        if (chatTitle) {
            chatTitle.style.animation = 'pulse 0.5s ease-out';
            setTimeout(() => {
                chatTitle.style.animation = '';
            }, 500);
        }
    }

    /**
     * Scrolls to the bottom of the message list
     */
    function scrollToBottom() {
        if (messageList) {
            messageList.scrollTop = messageList.scrollHeight;
        }
    }

    // --- Initialize Application ---
    initializeApp();

    // --- Expose functions for debugging ---
    window.selectContact = selectContact;
    window.sendMessage = sendMessage;
    window.debugInfo = () => {
        console.log('Current Group ID:', currentGroupId);
        console.log('User Keys:', userKeys);
        console.log('Messages:', messages);
        console.log('Contacts:', contacts);
    };
});