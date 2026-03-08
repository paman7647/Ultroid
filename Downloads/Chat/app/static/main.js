// app/static/main.js

// This event listener ensures that our script runs only after the entire
// HTML document has been loaded and parsed.
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Global State and Constants ---
    const socket = io(); // Connect to the server's Socket.IO instance.
    let currentGroupId = null; // The ID of the currently active chat group.
    let userKeys = {
        publicKey: null,
        privateKey: null
    };
    
    // --- DOM Element References ---
    const messageList = document.getElementById('message-list');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatTitle = document.getElementById('chat-title');

    // --- Core Functions ---

    /**
     * Initializes the application by connecting to the server
     * and setting up cryptographic keys.
     */
    function initializeApp() {
        console.log("Initializing application...");
        // TODO: Add logic to generate or load user's cryptographic keys.
        // TODO: Fetch the user's initial chat list (groups and private chats).
    }
    
    /**
     * Renders a message in the main chat window.
     * @param {object} messageData - The data for the message to render.
     * @param {boolean} isSentByCurrentUser - True if the message was sent by the current user.
     */
    function displayMessage(messageData, isSentByCurrentUser = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(isSentByCurrentUser ? 'sent' : 'received');
        
        // For now, we'll just display the raw content.
        // In the full implementation, this will be decrypted content.
        messageElement.textContent = `[${messageData.sender_display_name}]: ${messageData.content}`;
        
        messageList.appendChild(messageElement);
        messageList.scrollTop = messageList.scrollHeight; // Auto-scroll to the bottom.
    }

    /**
     * Handles the sending of a new message.
     */
    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText || !currentGroupId) {
            return;
        }

        console.log(`Sending message to group ${currentGroupId}: ${messageText}`);

        // TODO: Encrypt the messageText before sending.
        const encryptedMessage = messageText; // Placeholder

        // Emit the message to the server via WebSocket.
        socket.emit('send_message', {
            group_id: currentGroupId,
            content: encryptedMessage
        });

        // Display the sent message immediately on the user's screen.
        displayMessage({
            content: messageText, // Display the unencrypted text locally.
            sender_display_name: 'You' 
        }, true);

        messageInput.value = ''; // Clear the input field.
        messageInput.focus();
    }

    // --- Socket.IO Event Handlers ---

    socket.on('connect', () => {
        console.log('Successfully connected to the server with socket ID:', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from the server.');
    });

    socket.on('status', (data) => {
        console.log('Server status message:', data.msg);
    });

    socket.on('receive_message', (data) => {
        console.log('Received a message:', data);
        
        // Only display the message if it's for the currently active chat.
        if (data.group_id === currentGroupId) {
            // TODO: Decrypt the message content before displaying.
            const decryptedContent = data.content; // Placeholder
            
            displayMessage({
                content: decryptedContent,
                sender_display_name: data.sender_display_name
            }, false);
        } else {
            // TODO: Add a notification for messages in other chats (e.g., a badge).
            console.log(`Received message for inactive group ${data.group_id}`);
        }
    });


    // --- General Event Listeners ---

    // Send message when the Send button is clicked.
    sendButton.addEventListener('click', sendMessage);

    // Send message when the Enter key is pressed in the input field.
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // --- Mock/Placeholder Functions to be developed ---
    
    // This function will be called when a user clicks on a chat in the sidebar.
    function selectChat(groupId) {
        currentGroupId = groupId;
        chatTitle.textContent = `Chat Group ${groupId}`; // Placeholder name
        messageList.innerHTML = ''; // Clear previous messages
        messageInput.disabled = false;
        sendButton.disabled = false;
        console.log(`Switched to chat group: ${groupId}`);
        // TODO: Fetch and display the message history for this group.
    }

    // Example of how you might select a chat (for testing purposes).
    // In the real app, this would be triggered by clicking a list item.
    // For now, you can call this from the browser's developer console.
    window.selectChat = selectChat; 


    // --- Initial Application Load ---
    initializeApp();

});