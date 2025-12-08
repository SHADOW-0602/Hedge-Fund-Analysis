let currentTickers = [];
let currentIndex = 0;

// Touch/swipe handling variables
let touchStartX = 0;
let touchEndX = 0;

// Load tickers on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('api/tickers');
        const data = await response.json();
        currentTickers = data.tickers;

        // Theme Handling (Synced with Landing Page)
        const themeToggle = document.getElementById('themeToggle');
        const savedTheme = localStorage.getItem('theme') || 'light';

        // Apply saved theme
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (themeToggle) {
            themeToggle.checked = savedTheme === 'dark';

            // Listen for changes
            themeToggle.addEventListener('change', () => {
                const newTheme = themeToggle.checked ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
            });
        }

        // Add click handlers to ticker items
        const tickerItems = document.querySelectorAll('.ticker-item');
        tickerItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                currentIndex = index;
                selectTicker(item.dataset.ticker);
            });
        });

        // Add refresh button handler
        document.getElementById('refreshBtn').addEventListener('click', handleRefresh);

        // Add keyboard navigation (arrow keys)
        document.addEventListener('keydown', handleKeyboardNavigation);

        // Add swipe gesture support for mobile
        const summarySection = document.querySelector('.summary-section');
        summarySection.addEventListener('touchstart', handleTouchStart, { passive: true });
        summarySection.addEventListener('touchend', handleTouchEnd, { passive: true });

        // Initialize ticker persistence
        const savedTicker = localStorage.getItem('selectedTicker');
        if (savedTicker && currentTickers.includes(savedTicker)) {
            currentIndex = currentTickers.indexOf(savedTicker);
            selectTicker(savedTicker);
        } else {
            // Optional: Auto-select first ticker or stay on empty state
            if (currentTickers.length > 0) selectTicker(currentTickers[0]);
        }


    } catch (error) {
        console.error('Error loading tickers:', error);
    }
});

// Keyboard navigation handler
function handleKeyboardNavigation(event) {
    // Only handle arrow keys if a ticker is selected
    if (currentIndex === -1) return;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        navigatePrev();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        navigateNext();
    }
}

// Touch/swipe handlers for mobile
function handleTouchStart(event) {
    touchStartX = event.changedTouches[0].screenX;
}

function handleTouchEnd(event) {
    touchEndX = event.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const swipeThreshold = 50; // Minimum distance for a swipe
    const swipeDistance = touchEndX - touchStartX;

    if (Math.abs(swipeDistance) < swipeThreshold) return;

    if (swipeDistance > 0) {
        // Swipe right - go to previous
        navigatePrev();
    } else {
        // Swipe left - go to next
        navigateNext();
    }
}

async function handleRefresh() {
    const btn = document.getElementById('refreshBtn');
    const span = btn.querySelector('span');

    // Disable button and show spinner
    btn.disabled = true;
    btn.classList.add('spinning');
    span.textContent = 'Started...';

    try {
        const apiToken = document.querySelector('meta[name="api-token"]')?.content;
        const headers = apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {};

        const response = await fetch('api/refresh', {
            method: 'POST',
            headers: headers
        });
        const data = await response.json();

        if (response.ok) {
            span.textContent = 'Updating...';

            // Poll for completion
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch('api/status');
                    const statusData = await statusRes.json();

                    if (!statusData.is_processing) {
                        clearInterval(pollInterval);
                        span.textContent = 'Done!';
                        btn.classList.remove('spinning');

                        setTimeout(() => {
                            location.reload();
                        }, 1000);
                    }
                } catch (e) {
                    console.error('Polling error', e);
                }
            }, 3000); // Check every 3 seconds
        } else {
            throw new Error(data.message || 'Refresh failed');
        }
    } catch (error) {
        console.error('Refresh error:', error);
        span.textContent = 'Error';
        btn.classList.remove('spinning');

        setTimeout(() => {
            btn.disabled = false;
            span.textContent = 'Refresh News';
        }, 3000);
    }
}

async function selectTicker(ticker) {
    // Save state
    localStorage.setItem('selectedTicker', ticker);

    // Update active state
    document.querySelectorAll('.ticker-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`[data-ticker="${ticker}"]`);
    if (activeItem) activeItem.classList.add('active');

    // Show loading state
    const summaryContent = document.getElementById('summaryContent');
    summaryContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await fetch(`api/summary/${ticker}`);
        const data = await response.json();

        if (response.ok && data.status === 'found') {
            displaySummary(data);
        } else {
            throw new Error('Summary not available');
        }

    } catch (error) {
        // Auto-generate if missing
        summaryContent.innerHTML = `
                    <div class="glass-card">
                        <div class="glass-icon">
                            <svg class="spinning" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                            </svg>
                        </div>
                        <h2 class="glass-title">Generating Intelligence</h2>
                        <p class="glass-subtitle">Analyzing ${ticker} data strings... please wait.<br>This may take up to a minute during high load.</p>
                    </div>
                </div>
            `;

        try {
            const apiToken = document.querySelector('meta[name="api-token"]')?.content;
            const headers = apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {};

            // Trigger generation
            const res = await fetch(`api/generate/${ticker}`, {
                method: 'POST',
                headers: headers
            });

            if (res.ok) {
                // Poll for completion
                let attempts = 0;
                const checkInterval = setInterval(async () => {
                    attempts++;
                    try {
                        const summaryRes = await fetch(`api/summary/${ticker}`);
                        if (summaryRes.ok) {
                            const data = await summaryRes.json();
                            if (data.status === 'found') {
                                clearInterval(checkInterval);
                                displaySummary(data);
                            }
                        }
                    } catch (e) { }

                    if (attempts > 60) { // Timeout after 180s (3mins)
                        clearInterval(checkInterval);
                        summaryContent.innerHTML = `
                                <div class="placeholder">
                                    <div class="glass-card">
                                        <h2 class="glass-title">Analysis Failed</h2>
                                        <p class="glass-subtitle">Could not generate data for ${ticker}.<br>Please try again later.</p>
                                    </div>
                                </div>
                            `;
                    }
                }, 3000);
            }
        } catch (e) {
            console.error('Auto-generation failed', e);
        }
    }
}

function cleanText(text) {
    if (!text) return '';
    // Remove (XX words) patterns, case insensitive
    return text.replace(/\(\d+\s*words\)/gi, '').trim();
}

// Modal Toggle Function
window.toggleSourcesModal = function (event) {
    if (event) event.preventDefault();
    const modal = document.getElementById('sourcesModal');
    if (modal) {
        if (modal.classList.contains('open')) {
            modal.classList.remove('open');
            setTimeout(() => { modal.style.display = 'none'; }, 300); // Wait for transition
        } else {
            modal.style.display = 'flex';
            // slight delay to allow display:flex to apply before adding opacity class
            setTimeout(() => { modal.classList.add('open'); }, 10);
        }
    }
}

function displaySummary(data) {
    const summaryContent = document.getElementById('summaryContent');

    let sourcesHTML = '';
    if (data.sources && data.sources.length > 0) {
        // Trigger Link
        const sourcesTrigger = `
            <div class="sources-trigger-wrapper">
                <a href="#" class="sources-trigger" onclick="toggleSourcesModal(event)">
                    <span>Sources</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
            </div>
        `;

        // Modal Structure
        const sourcesList = data.sources.map(source => `
            <a href="${source.url}" target="_blank" class="source-item">
                <div style="font-weight: 500; margin-bottom: 2px;">${source.title}</div>
                <div style="font-size: 12px; color: var(--accent);">${source.source}</div>
            </a>
        `).join('');

        const modal = `
            <div id="sourcesModal" class="modal-overlay" onclick="toggleSourcesModal(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Sources Used</h3>
                        <button class="modal-close" onclick="toggleSourcesModal(event)">×</button>
                    </div>
                    <div class="modal-body">
                        ${sourcesList}
                    </div>
                </div>
            </div>
        `;

        sourcesHTML = sourcesTrigger + modal;
    }

    summaryContent.innerHTML = `
        <div class="summary-display">
            <h2>${data.ticker}</h2>
            
            <div class="summary-section-block">
                <h3>Executive Summary</h3>
                <p>${cleanText(data.executive_summary)}</p>
            </div>
            
            <div class="summary-section-block">
                <h3>What changed today?</h3>
                <p>${cleanText(data.what_changed)}</p>
            </div>
            
            <div class="summary-section-block">
                <h3>Analyst/Earnings Updates</h3>
                <p>${cleanText(data.analyst_earnings)}</p>
            </div>
            
            <div class="summary-section-block">
                <h3>Last week updates</h3>
                <p>${cleanText(data.last_week_updates)}</p>
            </div>
            
            ${sourcesHTML}
        </div>
    `;
}

function navigatePrev() {
    if (currentIndex > 0) {
        currentIndex--;
        const ticker = currentTickers[currentIndex];
        selectTicker(ticker);
    }
}

function navigateNext() {
    if (currentIndex < currentTickers.length - 1) {
        currentIndex++;
        const ticker = currentTickers[currentIndex];
        selectTicker(ticker);
    }
}


