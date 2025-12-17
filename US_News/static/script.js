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
            if (currentTickers.length > 0) selectTicker(currentTickers[0]);
        }

        // Search Handler
        const searchInput = document.getElementById('tickerSearch');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(handleSearchInput, 300));

            // Allow Enter key to select top result
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const dropdown = document.getElementById('searchDropdown');
                    const firstItem = dropdown.querySelector('.search-result-item');
                    if (firstItem) {
                        firstItem.click();
                        e.target.blur();
                    } else if (e.target.value.length >= 2) {
                        // If no suggestions but user hits enter, try exact match
                        selectTicker(e.target.value.toUpperCase());
                        e.target.value = '';
                        e.target.blur();
                    }
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-container')) {
                    const dropdown = document.getElementById('searchDropdown');
                    if (dropdown) dropdown.classList.remove('show');
                }
            });
        }

    } catch (error) {
        console.error('Error loading tickers:', error);
    }
});

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function handleSearchInput(e) {
    const query = e.target.value.trim();
    const dropdown = document.getElementById('searchDropdown');

    if (query.length < 1) {
        dropdown.classList.remove('show');
        dropdown.innerHTML = '';
        return;
    }

    let results = [];

    // 1. Search Local First (Instant)
    const upperQuery = query.toUpperCase();
    const localMatches = currentTickers.filter(t => t.includes(upperQuery));
    localMatches.forEach(ticker => {
        results.push({
            symbol: ticker,
            shortname: 'Watchlist Ticker',
            type: 'LOCAL'
        });
    });

    // 2. Fetch API Results
    try {
        const response = await fetch(`api/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
            const data = await response.json();
            const quotes = data.quotes || [];

            // Relaxed filtering: Check for valid symbol and ensure it's not already added from local
            const apiMatches = quotes.filter(q => {
                const type = (q.quoteType || '').toUpperCase();
                return (type === 'EQUITY' || type === 'ETF' || type === 'MUTUALFUND');
            }).map(q => ({
                symbol: q.symbol,
                shortname: q.shortname || q.longname || q.symbol,
                type: 'API'
            }));

            // Merge unique
            apiMatches.forEach(match => {
                if (!results.find(r => r.symbol === match.symbol)) {
                    results.push(match);
                }
            });
        }
    } catch (error) {
        console.error('Search error:', error);
    }

    // Limit results
    results = results.slice(0, 8);

    if (results.length > 0) {
        dropdown.innerHTML = results.map(quote => `
            <div class="search-result-item" onclick="selectSearchResult('${quote.symbol}')">
                <div style="display:flex; flex-direction:column;">
                    <span class="result-symbol">${quote.symbol}</span>
                    ${quote.type === 'LOCAL' ? '<span style="font-size:10px; color:var(--accent);">In Watchlist</span>' : ''}
                </div>
                <span class="result-name">${quote.shortname}</span>
            </div>
        `).join('');
        dropdown.classList.add('show');
    } else {
        dropdown.innerHTML = '<div class="search-result-item" style="cursor:default; color:var(--text-secondary);">No results found</div>';
        dropdown.classList.add('show');
    }
}

function selectSearchResult(ticker) {
    const searchInput = document.getElementById('tickerSearch');
    const dropdown = document.getElementById('searchDropdown');

    searchInput.value = ''; // Clear input
    dropdown.classList.remove('show');

    // Check if valid ticker via normal flow
    selectTicker(ticker);
}




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


// Expose generation function globally for the refresh button
window.generateTickerSummary = async function (ticker, event) {
    const summaryContent = document.getElementById('summaryContent');
    let isInlineRefresh = false;
    let refreshBtn = null;

    // Check if triggered by button click (Authentication/Event handling)
    if (event && event.currentTarget) {
        isInlineRefresh = true;
        refreshBtn = event.currentTarget;
        // Start spinning
        refreshBtn.querySelector('svg').classList.add('spinning');
        refreshBtn.disabled = true;
    }

    // Only show full loading card if NOT an inline refresh
    if (!isInlineRefresh) {
        summaryContent.innerHTML = `
            <div class="loading">
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
    }

    try {
        const apiToken = document.querySelector('meta[name="api-token"]')?.content;
        const headers = apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {};

        // Trigger generation (GET)
        const res = await fetch(`api/generate/${ticker}`, {
            method: 'GET',
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
                    if (!isInlineRefresh) {
                        summaryContent.innerHTML = `
                            <div class="placeholder">
                                <div class="glass-card">
                                    <h2 class="glass-title">Analysis Failed</h2>
                                    <p class="glass-subtitle">Could not generate data for ${ticker}.<br>Please try again later.</p>
                                </div>
                            </div>
                        `;
                    } else if (refreshBtn) {
                        refreshBtn.querySelector('svg').classList.remove('spinning');
                        refreshBtn.disabled = false;
                        alert('Analysis timed out. Please try again.');
                    }
                }
            }, 3000);
        }
    } catch (e) {
        console.error('Auto-generation failed', e);
        if (!isInlineRefresh) {
            summaryContent.innerHTML = `
                <div class="placeholder">
                    <h3>Connection Error</h3>
                    <p>Could not trigger analysis.</p>
                </div>
            `;
        } else if (refreshBtn) {
            refreshBtn.querySelector('svg').classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }
}

// Polling interval tracking
let quotePollInterval = null;

async function selectTicker(ticker) {
    // Clear existing interval if any
    if (quotePollInterval) {
        clearInterval(quotePollInterval);
        quotePollInterval = null;
    }

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

            // Start polling for this ticker (every 2 seconds)
            fetchAndDisplayQuote(ticker); // Initial immediate fetch
            quotePollInterval = setInterval(() => {
                fetchAndDisplayQuote(ticker);
            }, 2000);

        } else {
            throw new Error('Summary not available');
        }

    } catch (error) {
        // Auto-generate if missing
        window.generateTickerSummary(ticker);
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
            <h2 style="display: flex; align-items: center; gap: 12px;">
                ${data.ticker}
                <div style="display:flex; gap:8px;">
                    <span id="ticker-price-${data.ticker}" class="header-badge price-badge" style="font-size: 0.6em; padding: 4px 8px; border-radius: 6px; background: rgba(128,128,128,0.1); color: var(--text-primary); font-family:monospace;">...</span>
                    <span id="ticker-change-${data.ticker}" class="header-badge change-badge" style="font-size: 0.6em; padding: 4px 8px; border-radius: 6px; background: rgba(128,128,128,0.1); font-family:monospace;">...</span>
                </div>
                <button onclick="window.generateTickerSummary('${data.ticker}', event)" class="ticker-refresh-btn" title="Force Refresh Analysis">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 4v6h-6"></path>
                        <path d="M1 20v-6h6"></path>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
            </h2>
            
            <div class="summary-section-block">
                <h3>Executive Summary</h3>
                <div class="summary-content">${cleanText(data.executive_summary)}</div>
            </div>
            
            <div class="summary-section-block">
                <h3>What changed today?</h3>
                <div class="summary-content">${cleanText(data.what_changed)}</div>
            </div>
            
            <div class="summary-section-block">
                <h3>Analyst/Earnings Updates</h3>
                <div class="summary-content">${cleanText(data.analyst_earnings)}</div>
            </div>
            
            <div class="summary-section-block">
                <h3>Last week updates</h3>
                <div class="summary-content">${cleanText(data.last_week_updates)}</div>
            </div>
            
            ${sourcesHTML}
        </div>
    `;

    // Initial fetch
    fetchAndDisplayQuote(data.ticker);

    // Clear existing interval if any
    if (window.quoteInterval) clearInterval(window.quoteInterval);

    // Start 2-second polling
    window.quoteInterval = setInterval(() => {
        fetchAndDisplayQuote(data.ticker);
    }, 2000);
}

async function fetchAndDisplayQuote(ticker) {
    try {
        const qRes = await fetch(`api/quote/${ticker}`);
        const qData = await qRes.json();

        const priceBadge = document.getElementById(`ticker-price-${ticker}`);
        const changeBadge = document.getElementById(`ticker-change-${ticker}`);

        // Only update if badges exist (user hasn't switched away)
        if (priceBadge && changeBadge && qData.change_percent !== undefined) {
            const isPos = qData.change_percent >= 0;
            const sign = isPos ? '+' : '';

            // Format Price (Use Current Price for dynamic updates)
            const rawPrice = qData.price || qData.previous_close;
            const displayPrice = Number(rawPrice).toFixed(2);
            const priceText = `$${displayPrice}`;

            // Format Change
            const chgPct = Number(qData.change_percent).toFixed(2);
            const changeText = `${sign}${chgPct}%`;

            // Update Price Badge
            if (priceBadge.textContent !== priceText) {
                priceBadge.textContent = priceText;
            }

            // Update Change Badge
            if (changeBadge.textContent !== changeText) {
                const color = isPos ? '#4ade80' : '#f87171';
                const bg = isPos ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)';

                changeBadge.classList.remove('anim-slide-in');

                // Direct update for now, animation on 2s poll can be distracting if full slide
                // keeping it simple or reusing slide if desired.
                // Creating a subtle pulse or just text update.

                changeBadge.textContent = changeText;
                changeBadge.style.color = color;
                changeBadge.style.background = bg;
                changeBadge.style.border = `1px solid ${color}`;

                // Re-add slide in for effect
                changeBadge.classList.remove('anim-slide-out');
                changeBadge.classList.add('anim-slide-in');
            }
        }
    } catch (e) {
        console.error('Quote fetch failed', e);
    }
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


