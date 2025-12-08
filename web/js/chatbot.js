document.addEventListener('DOMContentLoaded', () => {
    // strict mode
    'use strict';

    // Injection function
    function injectChatbot() {
        if (document.getElementById('shm-chatbot-widget')) return;

        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'shm-chatbot-widget';
        widgetContainer.className = 'chatbot-widget';

        widgetContainer.innerHTML = `
            <div class="chatbot-popup" id="chatbotPopup">
                <div class="chatbot-header">
                    <h3>Support</h3>
                    <button id="chatbotClose" class="chatbot-close">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="chatbot-body">
                    <p class="chatbot-message">Not satisfied with the answer?</p>
                    <div class="chatbot-email-box">
                        <a href="mailto:himanshu_somani@ymail.com" class="chatbot-email-link">
                            himanshu_somani@ymail.com
                        </a>
                    </div>
                </div>
            </div>
            <button id="chatbotToggle" class="chatbot-toggle" aria-label="Open Support">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                </svg>
            </button>
        `;

        document.body.appendChild(widgetContainer);

        // Event Listeners
        const toggleBtn = document.getElementById('chatbotToggle');
        const closeBtn = document.getElementById('chatbotClose');
        const popup = document.getElementById('chatbotPopup');

        function toggleChat() {
            popup.classList.toggle('active');
        }

        toggleBtn.addEventListener('click', toggleChat);
        closeBtn.addEventListener('click', () => {
            popup.classList.remove('active');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!widgetContainer.contains(e.target) && popup.classList.contains('active')) {
                popup.classList.remove('active');
            }
        });
    }

    // Initialize
    injectChatbot();
});
