document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    function injectChatbot() {
        // Check if user is logged in
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) return;

        if (document.getElementById('shm-chatbot-widget')) return;

        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'shm-chatbot-widget';
        widgetContainer.className = 'chatbot-widget';

        widgetContainer.innerHTML = `
            <div class="chatbot-popup" id="chatbotPopup">
                <!-- Chat View -->
                <div id="chatView" class="chatbot-view active">
                    <div class="chatbot-header">
                        <h3>SHM Ventures</h3>
                        <button id="chatbotClose" class="chatbot-close" aria-label="Close Chat">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="chatbot-body">
                        <div class="chatbot-messages" id="chatbotMessages">
                            <div class="message bot-message">
                                Hello! I'm your AI assistant. How can I help you regarding Hedge Fund Analysis today?
                            </div>
                        </div>
                    </div>
                    <div class="chatbot-footer">
                        <div class="input-group">
                            <input type="text" id="chatbotInput" placeholder="Type your question..." autocomplete="off">
                            <button id="chatbotSend" aria-label="Send Message">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="chatbot-support-link">
                             <a href="#" id="openSupportBtn">Not satisfied? Contact Support</a>
                        </div>
                    </div>
                </div>

                <!-- Support View -->
                <div id="supportView" class="chatbot-view">
                    <div class="chatbot-header">
                        <h3>Send us a message</h3>
                        <button id="supportClose" class="chatbot-close" aria-label="Close Support Form">
                             <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="chatbot-body support-body">
                        <div class="form-group">
                            <label for="supportName">Name <span class="required">*</span></label>
                            <div class="row">
                                <input type="text" id="supportName" placeholder="Enter your full name">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="supportEmail">Email <span class="required">*</span></label>
                            <input type="email" id="supportEmail" placeholder="">
                        </div>
                        <div class="form-group">
                            <label for="supportMessage">Type your message here <span class="required">*</span></label>
                            <textarea id="supportMessage" rows="4"></textarea>
                        </div>
                        <button id="supportSubmit" class="support-submit-btn">SUBMIT</button>
                        <div class="support-actions">
                             <a href="#" id="backToChatBtn">Back to Chat</a>
                        </div>
                        <div id="supportStatus" class="support-status"></div>
                    </div>
                </div>
            </div>
            <button id="chatbotToggle" class="chatbot-toggle" aria-label="Open Chat">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                </svg>
            </button>
        `;

        document.body.appendChild(widgetContainer);

        // Elements
        const popup = document.getElementById('chatbotPopup');
        const toggleBtn = document.getElementById('chatbotToggle');
        const closeBtn = document.getElementById('chatbotClose');
        const supportCloseBtn = document.getElementById('supportClose');

        const chatView = document.getElementById('chatView');
        const supportView = document.getElementById('supportView');

        const openSupportBtn = document.getElementById('openSupportBtn');
        const backToChatBtn = document.getElementById('backToChatBtn');

        const messagesContainer = document.getElementById('chatbotMessages');
        const inputField = document.getElementById('chatbotInput');
        const sendBtn = document.getElementById('chatbotSend');

        let chatHistory = [];

        // Toggle visibility
        toggleBtn.addEventListener('click', () => {
            popup.classList.toggle('active');
            if (popup.classList.contains('active')) {
                if (chatView.classList.contains('active')) {
                    inputField.focus();
                    scrollToBottom();
                }
            }
        });

        const closePopup = () => popup.classList.remove('active');
        closeBtn.addEventListener('click', closePopup);
        supportCloseBtn.addEventListener('click', closePopup);

        // View Switching
        openSupportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            chatView.classList.remove('active');
            supportView.classList.add('active');
        });

        backToChatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            supportView.classList.remove('active');
            chatView.classList.add('active');
        });

        // Support Form Submission
        document.getElementById('supportSubmit').addEventListener('click', async () => {
            const name = document.getElementById('supportName').value.trim();
            const email = document.getElementById('supportEmail').value.trim();
            const message = document.getElementById('supportMessage').value.trim();
            const statusDiv = document.getElementById('supportStatus');
            const submitBtn = document.getElementById('supportSubmit');

            if (!name || !email || !message) {
                statusDiv.textContent = 'Please fill in all required fields.';
                statusDiv.className = 'support-status error';
                return;
            }

            // Disable button
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            statusDiv.textContent = '';

            try {
                const response = await fetch('/api/chat/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, message })
                });

                const data = await response.json();

                if (response.ok) {
                    statusDiv.textContent = 'Message sent successfully!';
                    statusDiv.className = 'support-status success';
                    // Clear form
                    document.getElementById('supportName').value = '';
                    document.getElementById('supportEmail').value = '';
                    document.getElementById('supportMessage').value = '';

                    setTimeout(() => {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'SUBMIT';
                        statusDiv.textContent = '';
                        // Go back to chat
                        supportView.classList.remove('active');
                        chatView.classList.add('active');
                    }, 2000);
                } else {
                    throw new Error(data.error || 'Failed to send');
                }
            } catch (error) {
                console.error(error);
                statusDiv.textContent = 'Error sending message. Please try again.';
                statusDiv.className = 'support-status error';
                submitBtn.disabled = false;
                submitBtn.textContent = 'SUBMIT';
            }
        });

        // Sending Messages
        async function sendMessage() {
            const text = inputField.value.trim();
            if (!text) return;

            addMessage(text, 'user');
            inputField.value = '';
            chatHistory.push({ sender: 'user', text: text });

            const loadingId = addLoadingIndicator();

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: text,
                        history: chatHistory
                    })
                });

                removeMessage(loadingId);

                if (response.ok) {
                    const data = await response.json();
                    const aiText = data.response;
                    addMessage(aiText, 'bot');
                    chatHistory.push({ sender: 'model', text: aiText });
                } else {
                    addMessage("Sorry, I encountered an error. Please try again.", 'bot');
                }
            } catch (error) {
                removeMessage(loadingId);
                console.error('Chat error:', error);
                addMessage("Network error. Please try again later.", 'bot');
            }
        }

        // Event Listeners for Input
        sendBtn.addEventListener('click', sendMessage);
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        function addMessage(text, sender) {
            const div = document.createElement('div');
            div.className = `message ${sender}-message`;

            // Format text if it's from the bot
            if (sender === 'bot') {
                // simple markdown parsing
                let formattedText = text
                    // Bold: **text** -> <strong>text</strong>
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    // Italic: *text* -> <em>text</em>
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    // Newlines to breaks
                    .replace(/\n/g, '<br>');

                // Handle bullet points properly (simple heuristic)
                // If text contains <br>* or starts with *, treat as list items
                if (formattedText.includes('<br>* ') || formattedText.startsWith('* ')) {
                    formattedText = formattedText
                        // Replace "* " at start of line with bullet point
                        .replace(/(^|<br>)\* /g, '$1• ');
                }

                div.innerHTML = formattedText;
            } else {
                div.textContent = text;
            }

            messagesContainer.appendChild(div);
            scrollToBottom();
            return div;
        }

        function addLoadingIndicator() {
            const div = document.createElement('div');
            div.className = 'message bot-message loading-message';
            div.id = 'loading-' + Date.now();
            div.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
            messagesContainer.appendChild(div);
            scrollToBottom();
            return div.id;
        }

        function removeMessage(id) {
            const el = document.getElementById(id);
            if (el) el.remove();
        }

        function scrollToBottom() {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    injectChatbot();
});
