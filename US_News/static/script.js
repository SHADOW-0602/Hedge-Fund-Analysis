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

        // Add click handlers to ticker items
        const tickerItems = document.querySelectorAll('.ticker-item');
        tickerItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                currentIndex = index;
                selectTicker(item.dataset.ticker);
            });
        });

        // Add navigation button handlers
        document.getElementById('prevBtn').addEventListener('click', navigatePrev);
        document.getElementById('nextBtn').addEventListener('click', navigateNext);

        // Add refresh button handler
        document.getElementById('refreshBtn').addEventListener('click', handleRefresh);

        // Add keyboard navigation (arrow keys)
        document.addEventListener('keydown', handleKeyboardNavigation);

        // Add swipe gesture support for mobile
        const summarySection = document.querySelector('.summary-section');
        summarySection.addEventListener('touchstart', handleTouchStart, { passive: true });
        summarySection.addEventListener('touchend', handleTouchEnd, { passive: true });

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
        const response = await fetch('api/refresh', { method: 'POST' });
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
    // Update active state
    document.querySelectorAll('.ticker-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-ticker="${ticker}"]`).classList.add('active');

    // Show loading state
    const summaryContent = document.getElementById('summaryContent');
    summaryContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    // Enable/disable navigation buttons
    updateNavigationButtons();

    try {
        const response = await fetch(`api/summary/${ticker}`);

        if (!response.ok) {
            throw new Error('Summary not available');
        }

        const data = await response.json();
        displaySummary(data);

    } catch (error) {
        summaryContent.innerHTML = `
            <div class="placeholder">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>No summary available for ${ticker} today</p>
                <p style="font-size: 14px; margin-top: 8px;">Please check back later or try another ticker</p>
            </div>
        `;
    }
}

function displaySummary(data) {
    const summaryContent = document.getElementById('summaryContent');

    let sourcesHTML = '';
    if (data.sources && data.sources.length > 0) {
        sourcesHTML = `
            <div class="sources-section">
                <h3>Sources Used</h3>
                ${data.sources.map(source => `
                    <a href="${source.url}" target="_blank" class="source-link">
                        ${source.title}
                    </a>
                `).join('')}
            </div>
        `;
    }

    summaryContent.innerHTML = `
        <div class="summary-display">
            <h2>${data.ticker}</h2>
            
            <div class="summary-section-block">
                <h3>Executive Summary</h3>
                <p>${data.executive_summary}</p>
            </div>
            
            <div class="summary-section-block">
                <h3>What changed today?</h3>
                <p>${data.what_changed}</p>
            </div>
            
            <div class="summary-section-block">
                <h3>Analyst/Earnings Updates</h3>
                <p>${data.analyst_earnings}</p>
            </div>
            
            <div class="summary-section-block">
                <h3>Last week updates</h3>
                <p>${data.last_week_updates}</p>
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

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === currentTickers.length - 1;
}
