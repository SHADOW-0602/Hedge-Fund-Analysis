let currentTickers = [];
let currentIndex = 0;
let cachedTAData = null;

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
                // Re-render chart if data exists
                if (cachedTAData) {
                    renderTA(cachedTAData);
                }
            });
        }

        // --- sidebar click handling ---
        const tickerItems = document.querySelectorAll('.ticker-item');
        tickerItems.forEach(item => {
            item.addEventListener('click', () => {
                const ticker = item.dataset.ticker;
                currentTicker = ticker; // Update global state
                selectTicker(ticker);
            });
        });

        // Cleanup formats once on load
        cleanupTickerFormats();

        // Init Chart
        initChart();

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
                        selectTicker(e.target.value.toUpperCase().trim());
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

        // Initialize Tabs
        initTabListeners();

        // --- Mobile Menu Handling ---
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        const closeMenuBtn = document.getElementById('closeMenuBtn');

        if (hamburgerBtn && mobileMenu) {
            hamburgerBtn.addEventListener('click', () => {
                mobileMenu.classList.add('open');
            });
        }
        if (closeMenuBtn && mobileMenu) {
            closeMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.remove('open');
            });
        }

        // Mobile Refresh Listener
        const refreshBtnMobile = document.getElementById('refreshBtnMobile');
        if (refreshBtnMobile) {
            refreshBtnMobile.addEventListener('click', handleRefresh);
        }

        // Mobile Theme Listener
        const themeToggleMobile = document.getElementById('themeToggleMobile');
        if (themeToggleMobile) {
            // Sync state initially
            themeToggleMobile.checked = document.documentElement.getAttribute('data-theme') === 'dark';

            themeToggleMobile.addEventListener('change', () => {
                const isDark = themeToggleMobile.checked;
                const newTheme = isDark ? 'dark' : 'light'; // Checkbox checked = dark (moon) based on CSS/HTML structure
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);

                // Sync desktop toggle if it exists
                if (themeToggle) themeToggle.checked = isDark;

                if (cachedTAData) renderTA(cachedTAData);
            });
        }

    } catch (error) {
        console.error('Error loading tickers:', error);
    }
});

// Force cleanup of ticker formats (remove percentages, add brackets) on load
const cleanupTickerFormats = () => {
    document.querySelectorAll('.ticker-change').forEach(el => {
        let text = el.textContent.trim();
        // 1. Extract purely the number with sign
        const match = text.match(/[+\-]?\d+\.\d+/);
        if (match) {
            const val = match[0];
            // 2. Enforce Bracket Format: (Value)
            // Ensure strictly (Value) - strip anything else
            el.textContent = `(${val})`;
        }
    });
};
cleanupTickerFormats();


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
    // Ignore swipes on tables (allow horizontal scroll)
    // Ignore swipes on tables (allow horizontal scroll)
    if (event.target.closest('table')) {
        touchStartX = null;
        return;
    }
    // Ignore swipes on the chart, tabs, or ticker list to allow native scrolling
    if (event.target.closest('#overviewChart') ||
        event.target.closest('.tv-lightweight-charts') ||
        event.target.closest('.tabs-container') ||
        event.target.closest('.ticker-list') ||
        event.target.closest('.chart-controls')) {
        touchStartX = null;
        return;
    }
    touchStartX = event.changedTouches[0].screenX;
}

function handleTouchEnd(event) {
    if (touchStartX === null) return;
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

async function handleRefresh(e) {
    let btn = document.getElementById('refreshBtn');

    // If triggered by event (e.g. mobile button), use that target
    if (e && e.target) {
        btn = e.target.closest('button');
    }
    // Fallback
    if (!btn) btn = document.getElementById('refreshBtn');

    const span = btn.querySelector('span'); // specific to mobile with text span? Desktop handles svg spinning via class

    // Disable button and show spinner
    btn.disabled = true;
    btn.classList.add('spinning');
    if (span) span.textContent = 'Started...';
    btn.title = 'Refresh Started...';

    try {
        const apiToken = document.querySelector('meta[name="api-token"]')?.content;
        const headers = apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {};

        const response = await fetch('api/refresh', {
            method: 'POST',
            headers: headers
        });
        const data = await response.json();

        if (response.ok) {
            if (span) span.textContent = 'Updating...';
            btn.title = 'Updating all news...';

            // Poll for completion
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch('api/status');
                    const statusData = await statusRes.json();

                    if (!statusData.is_processing) {
                        clearInterval(pollInterval);
                        if (span) span.textContent = 'Done!';
                        btn.title = 'Refresh Complete!';
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
        if (span) span.textContent = 'Error';
        btn.title = 'Refresh Error';
        btn.classList.remove('spinning');

        setTimeout(() => {
            btn.disabled = false;
            if (span) span.textContent = 'Refresh News';
            btn.title = 'Update all news';
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
        } else {
            // Handle HTTP Error from Generate Endpoint
            throw new Error(`Generation trigger failed: ${res.status}`);
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
let quotePollTimeout = null;
let currentActiveTicker = null; // Track globally for Tabs

function startPolling(ticker) {
    // Clear existing
    if (quotePollTimeout) {
        clearTimeout(quotePollTimeout);
        quotePollTimeout = null;
    }

    // Recursive polling function
    const poll = async () => {
        // Stop if ticker switched
        if (currentActiveTicker !== ticker) return;

        await fetchAndDisplayQuote(ticker);

        // Schedule next poll only after completion
        if (currentActiveTicker === ticker) {
            quotePollTimeout = setTimeout(poll, 2000);
        }
    };

    // Start immediately
    poll();
}


async function selectTicker(ticker) {
    ticker = ticker.trim(); // Sanitize input
    currentActiveTicker = ticker; // Set global

    // Show loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    // Check which tab is active
    const taTab = document.querySelector('.tab-btn[data-tab="ta"]');
    if (taTab && taTab.classList.contains('active')) {
        loadTAData(ticker);
    }

    // Continue with standard summary load...
    // Clear existing interval if any
    if (quotePollTimeout) {
        clearTimeout(quotePollTimeout);
        quotePollTimeout = null;
    }

    // Save state
    localStorage.setItem('selectedTicker', ticker);

    // Update active state
    document.querySelectorAll('.ticker-item').forEach(item => {
        item.classList.toggle('active', item.dataset.ticker === ticker);
    });

    // Show loading state - REMOVED, now handled by loadingOverlay
    // const summaryContent = document.getElementById('summaryContent');
    // summaryContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    console.log(`[selectTicker] Fetching summary for ${ticker}...`);
    try {
        const response = await fetch(`api/summary/${ticker}`);
        const data = await response.json();
        console.log(`[selectTicker] Response for ${ticker}:`, data);

        if (data.ticker || data.executive_summary) { // Check for actual summary data
            console.log(`[selectTicker] Summary found, displaying...`);
            displaySummary(data);

            // Start polling for this ticker
            startPolling(ticker);

        } else {
            console.warn(`[selectTicker] Summary not found (status=${data.status}), triggering generation...`);
            throw new Error('Summary not available');
        }

    } catch (error) {
        console.log(`[selectTicker] Cache miss, triggering auto-generation...`);
        // Auto-generate if missing
        window.generateTickerSummary(ticker);
    } finally {
        // Hide loading overlay
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500); // Small delay for smooth UX
        }
    }

    // Trigger Chart Load if Overview is active OR just pre-load it
    // Check if overview tab is effectively active (even if hidden)
    loadChartData(ticker);
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
    if (summaryContent) {
        summaryContent.style.display = 'flex';
        summaryContent.style.opacity = '1';
    }

    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) {
        tabsContainer.style.display = 'flex';
    }

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

    // Use marked.js if available, otherwise fallback to simple text
    // Fix: Replace literal \n string with actual newlines
    let rawText = (data.executive_summary || '').replace(/\\n/g, '\n');

    // Fix: Handle "No News" state explicitly with a nice UI
    if (rawText.includes("No significant news articles found") || rawText.includes("No specific news or recent events")) {
        const summaryContent = document.getElementById('summaryContent');
        if (summaryContent) {
            summaryContent.innerHTML = `
                <div class="research-report" style="display: flex; justify-content: center; align-items: center; min-height: 200px;">
                    <div style="text-align: center; color: var(--text-secondary); width: 100%; max-width: 400px; padding: 20px;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.5; display: inline-block;">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="8" y1="13" x2="16" y2="13"></line>
                            <line x1="8" y1="17" x2="16" y2="17"></line>
                        </svg>
                        <h3 style="margin-bottom: 8px; color: var(--text-primary);">No News Found</h3>
                        <p style="font-size: 0.95rem; line-height: 1.5;">No significant news articles were found for this ticker in the last 7 days.</p>
                    </div>
                </div>
            `;
        }
        return; // Stop further processing
    }

    // Fix: Check if we are displaying a raw JSON dump (legacy/bad data) and clean it
    if (rawText.trim().startsWith('{') && rawText.includes('"executive_summary"')) {
        try {
            // Attempt to parse if valid JSON
            const parsed = JSON.parse(rawText);
            if (parsed.executive_summary) rawText = parsed.executive_summary;
        } catch (e) {
            // If invalid JSON (fallback), manually strip the wrapper
            console.warn('Client-side cleaning of malformed JSON wrapper');
            const startMarker = '"executive_summary":';
            const startIdx = rawText.indexOf(startMarker);
            if (startIdx !== -1) {
                // Heuristic: Take content after key, strip quotes/braces
                let content = rawText.substring(startIdx + startMarker.length).trim();
                if (content.startsWith('"')) content = content.substring(1);
                if (content.endsWith('}')) content = content.substring(0, content.length - 1).trim();
                if (content.endsWith('"')) content = content.substring(0, content.length - 1);
                rawText = content;
            }
        }
    }

    // Fix: Remove "Part 10: Sources" if it exists (Client-side cleanup for legacy data)
    // Matches "## Part 10: Sources" until end of string, case insensitive
    rawText = rawText.replace(/##\s*Part\s*10:?\s*Sources[\s\S]*$/i, '');

    // Fix: Remove Sector and Analyst headers (Client-side cleanup)
    rawText = rawText.replace(/>\s*(Sector|Analyst):.*(\n|$)/gi, '');
    rawText = rawText.replace(/^\|\s*(Sector|Analyst):.*(\n|$)/gmi, ''); // Check for pipe just in case

    // Fix: Remove "Part X:" numbering from headers
    rawText = rawText.replace(/##\s*Part\s*\d+:\s*/gi, '## ');

    // Fix: Remove inline citations like "(Source 12)"
    rawText = rawText.replace(/\s*\(Source\s*\d+\)/gi, '');

    const reportContent = window.marked
        ? marked.parse(rawText)
        : rawText;

    summaryContent.innerHTML = `
        <div class="summary-display">
            <h2 style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                ${data.ticker}
                <div style="display:flex; gap:12px; align-items: center;">
                    <span id="ticker-price-${data.ticker}" class="header-badge price-badge" style="font-size: 0.6em; padding: 4px 8px; border-radius: 6px; background: rgba(128,128,128,0.1); color: var(--text-primary); font-family:monospace;">...</span>
                </div>
                <button onclick="window.generateTickerSummary('${data.ticker}', event)" class="ticker-refresh-btn" title="Force Refresh Analysis">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 4v6h-6"></path>
                        <path d="M1 20v-6h6"></path>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
            </h2>
            
            <article class="research-report markdown-body">
                ${reportContent}
            </article>
            
            ${sourcesHTML}
        </div>
    `;

    // Initial fetch
    fetchAndDisplayQuote(data.ticker);
}

async function fetchAndDisplayQuote(ticker) {
    try {
        const qRes = await fetch(`api/quote/${ticker}`);
        if (!qRes.ok) {
            console.warn(`Quote fetch failed for ${ticker}: ${qRes.status}`);
            return;
        }
        const qData = await qRes.json();
        console.log(`[Quote Update] ${ticker}:`, qData);

        const priceBadge = document.getElementById(`ticker-price-${ticker}`);
        const changeBadge = document.getElementById(`ticker-change-${ticker}`);

        // --- 1. Header Update (Requested Change: Prev Close Only) ---
        if (priceBadge && qData.previous_close !== undefined) {
            // Format Previous Close
            const prevPrice = Number(qData.previous_close).toFixed(2);
            priceBadge.textContent = `Prev Close: $${prevPrice}`;

            // Neutral styling
            priceBadge.style.background = 'rgba(128,128,128,0.1)';
            priceBadge.style.color = 'var(--text-primary)';
            priceBadge.style.border = 'none';

            // Hide Change Badge if exists
            if (changeBadge) changeBadge.style.display = 'none';
        }

        // --- 2. Sidebar Update (Keep Live Data if available) ---
        const sidebarPrice = document.getElementById(`sidebar-price-${ticker}`);
        const sidebarChange = document.getElementById(`sidebar-change-${ticker}`);

        if (sidebarPrice && sidebarChange && qData.price !== undefined) {
            const isPos = qData.change >= 0;
            const sign = isPos ? '+' : '';
            const displayPrice = Number(qData.price).toFixed(2);
            const displayChange = Number(qData.change).toFixed(2);

            // Update Price
            sidebarPrice.textContent = `$${displayPrice}`;

            // Update Change
            sidebarChange.textContent = `(${sign}${displayChange})`;
            sidebarChange.className = `ticker-change ${isPos ? 'positive' : 'negative'}`;
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


/* --- Technical Analysis Logic --- */
let priceChartInstance = null;
let macdChartInstance = null;

function initTabListeners() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });

            // Add active to clicked
            tab.classList.add('active');
            const targetId = tab.dataset.tab;

            // Save active tab to localStorage
            localStorage.setItem('activeTab', targetId);

            // Find and show target content
            const targetContent = document.querySelector(`[data-tab-content="${targetId}"]`) ||
                document.getElementById(targetId + 'Content');
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.style.display = 'flex';
            }

            // Tab-specific loading logic
            if (targetId === 'overview' && currentChartTicker) {
                loadChartData(currentChartTicker);
                if (chartInstance) chartInstance.timeScale().fitContent();
            } else {
                // Stop polling when leaving Overview tab
                stopChartPolling();
            }

            if (targetId === 'ta' && currentActiveTicker) {
                console.log("[TA] Tab clicked, loading data...");
                loadTAData(currentActiveTicker);
            }

            if (targetId === 'fin' && currentActiveTicker) {
                console.log("[Fundamentals] Tab clicked, loading data...");
                loadFundamentals(currentActiveTicker);
            }
        });
    });

    // Restore last active tab on page load
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) {
        const tabToActivate = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
        if (tabToActivate) {
            // Delay to ensure DOM is ready
            setTimeout(() => tabToActivate.click(), 100);
        }
    }
}

async function loadTAData(ticker) {
    const taContent = document.getElementById('taContent');
    // Safety check: specific parent visibility or tab active state
    const taTab = document.querySelector('.tab-btn[data-tab="ta"]');
    if (!taTab.classList.contains('active')) return;

    // Show loading state in stats
    const levelsDiv = document.getElementById('levelsContent');
    const indicatorsDiv = document.getElementById('indicatorsContent');
    if (levelsDiv) levelsDiv.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px;"></div>';
    if (indicatorsDiv) indicatorsDiv.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px;"></div>';

    try {
        console.log(`[TA] Fetching data for ${ticker}...`);
        const response = await fetch(`api/ta/${ticker}`);
        const data = await response.json();

        if (data.error) {
            console.error(data.error);
            if (levelsDiv) levelsDiv.innerHTML = '<span style="color:var(--text-secondary)">Data unavailable</span>';
            if (indicatorsDiv) indicatorsDiv.innerHTML = '<span style="color:var(--text-secondary)">Data unavailable</span>';
            return;
        }

        cachedTAData = data;
        renderTA(data);

    } catch (e) {
        console.error("TA Load Error", e);
        if (levelsDiv) levelsDiv.innerHTML = '<span style="color:#ef4444">Connection Error</span>';
        if (indicatorsDiv) indicatorsDiv.innerHTML = '<span style="color:#ef4444">Connection Error</span>';
    }
}

function renderTA(data) {
    // 1. Key Levels Table
    const levelsDiv = document.getElementById('levelsContent');
    if (levelsDiv) {
        let html = '<div style="margin-bottom:10px; font-weight:bold; color:var(--text-primary);">Fibonacci Retracement</div>';
        for (const [key, val] of Object.entries(data.fibonacci)) {
            html += `<div class="level-row"><span>${key}</span><span>$${val.toFixed(2)}</span></div>`;
        }
        html += '<div style="margin-top:15px; margin-bottom:10px; font-weight:bold; color:var(--text-primary);">Support/Resistance (Pivot)</div>';
        data.resistances.slice(0, 3).forEach(r => {
            html += `<div class="level-row"><span style="color:#f87171">Res</span><span>$${r.toFixed(2)}</span></div>`;
        });
        data.supports.slice(0, 3).forEach(s => {
            html += `<div class="level-row"><span style="color:#34d399">Sup</span><span>$${s.toFixed(2)}</span></div>`;
        });
        levelsDiv.innerHTML = html;
    }

    // 2. Indicators Summary
    const indicatorsDiv = document.getElementById('indicatorsContent');
    if (indicatorsDiv) {
        const s = data.summary;
        let html = `
            <div class="level-row"><span>Current Price</span><span style="font-weight:bold">$${s.price.toFixed(2)}</span></div>
            <div class="level-row"><span>RSI (14)</span><span style="${s.rsi > 70 ? 'color:#f87171' : (s.rsi < 30 ? 'color:#34d399' : '')}">${s.rsi.toFixed(1)}</span></div>
            <div class="level-row">
                <span>MACD Action</span>
                <span class="indicator-badge ${s.macd_action.toLowerCase()}">${s.macd_action}</span>
            </div>
            <!-- Added MACD Details -->
            <div class="level-row" style="font-size: 0.8rem; color: var(--text-secondary); justify-content: flex-end; margin-top: -8px; margin-bottom: 8px;">
                <span>MACD: ${data.chart_data[data.chart_data.length - 1].macd.toFixed(2)} | Sig: ${data.chart_data[data.chart_data.length - 1].signal.toFixed(2)}</span>
            </div>
            <div class="level-row">
                <span>Trend (SMA 200)</span>
                <span class="indicator-badge ${s.sma_trend.toLowerCase()}">${s.sma_trend}</span>
            </div>
        `;
        indicatorsDiv.innerHTML = html;
    }

    // 3. Charts
    const ctxPrice = document.getElementById('priceChart').getContext('2d');
    const ctxMacd = document.getElementById('macdChart').getContext('2d');

    const labels = data.chart_data.map(d => d.date);
    const closes = data.chart_data.map(d => d.close);
    const sma50 = data.chart_data.map(d => d.sma50);
    const sma200 = data.chart_data.map(d => d.sma200);

    // Determines Theme Colors
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#1e293b' : '#fff';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    const labelColor = isLight ? '#64748b' : '#94a3b8';

    // Destroy old instances
    if (priceChartInstance) priceChartInstance.destroy();
    if (macdChartInstance) macdChartInstance.destroy();

    // Price Chart
    priceChartInstance = new Chart(ctxPrice, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Price',
                    data: closes,
                    borderColor: '#3b82f6', // Accent Blue
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1
                },
                {
                    label: 'SMA 50',
                    data: sma50,
                    borderColor: '#f59e0b', // Orange
                    borderWidth: 1,
                    pointRadius: 0,
                    borderDash: [5, 5]
                },
                {
                    label: 'SMA 200',
                    data: sma200,
                    borderColor: '#ef4444', // Red
                    borderWidth: 1,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { labels: { color: labelColor } },
                title: { display: true, text: 'Price History (Daily)', color: textColor }
            },
            scales: {
                x: { ticks: { color: labelColor, maxTicksLimit: 10 }, grid: { color: gridColor } },
                y: { ticks: { color: labelColor }, grid: { color: gridColor } }
            }
        }
    });

    // MACD Chart
    macdChartInstance = new Chart(ctxMacd, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Histogram',
                    data: data.chart_data.map(d => d.hist),
                    backgroundColor: data.chart_data.map(d => d.hist >= 0 ? '#34d399' : '#f87171'),
                    barPercentage: 1,
                    categoryPercentage: 1
                },
                {
                    type: 'line',
                    label: 'MACD',
                    data: data.chart_data.map(d => d.macd),
                    borderColor: '#3b82f6',
                    borderWidth: 1.5,
                    pointRadius: 0
                },
                {
                    type: 'line',
                    label: 'Signal',
                    data: data.chart_data.map(d => d.signal),
                    borderColor: '#f59e0b',
                    borderWidth: 1.5,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, labels: { color: labelColor } },
                title: { display: true, text: 'MACD (12, 26, 9)', color: textColor }
            },
            scales: {
                x: { display: true, ticks: { color: labelColor, maxTicksLimit: 10 }, grid: { color: gridColor } },
                y: { ticks: { color: labelColor }, grid: { color: gridColor } }
            }
        }
    });
}

// --- 3. Fundamentals Functions ---
async function loadFundamentals(ticker) {
    const finContent = document.getElementById('finContent');
    if (!finContent) return;

    finContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        console.log(`[Fundamentals] Fetching data for ${ticker}...`);
        const response = await fetch(`api/financials/${ticker}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);
        renderFundamentals(data);

    } catch (e) {
        console.error('[Fundamentals] Error:', e);
        finContent.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <h3 style="color: #ef4444; margin-bottom: 16px;">⚠️ Unable to Load Data</h3>
                <p style="color: var(--text-secondary);">Error: ${e.message}</p>
            </div>
        `;
    }
}

function renderFundamentals(data) {
    const finContent = document.getElementById('finContent');
    if (!finContent) return;

    const f = data.fundamentals || {};
    const aiText = data.ai_analysis || "No analysis generated.";
    const technicals = data.technicals || {};

    // Format Helpers
    const fmtNum = (n) => n ? new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(n) : 'N/A';
    const fmtPct = (n) => n ? (n * 100).toFixed(2) + '%' : 'N/A';
    const fmtVal = (n) => n ? n.toFixed(2) : '-';

    // 1. Valuation Logic
    const currentPrice = technicals.price || 0;
    const fairValue = f.fair_value;
    let valuationBadge = '';

    if (fairValue && currentPrice > 0) {
        const diff = ((currentPrice - fairValue) / fairValue) * 100;
        // Undervalued if Price < Fair Value (e.g. -20%)
        if (diff < -15) {
            valuationBadge = '<span class="status-badge undervalued">UNDERVALUED</span>';
        } else if (diff > 15) {
            valuationBadge = '<span class="status-badge overvalued">OVERVALUED</span>';
        } else {
            valuationBadge = '<span class="status-badge fair">FAIR VALUE</span>';
        }
    }

    // 2. Health Logic
    const deRatio = f.debt_to_equity;
    const currRatio = f.current_ratio;

    // Determine signal color for AI Card
    let signalClass = 'neutral';
    if (aiText.toUpperCase().includes('SIGNAL: BUY')) signalClass = 'buy';
    if (aiText.toUpperCase().includes('SIGNAL: SELL')) signalClass = 'sell';

    const cleanAiText = aiText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');

    /* HTML Generation */
    finContent.innerHTML = `
        <div class="financials-layout">
            <!-- AI Recommendation Card -->
            <div class="ai-card ${signalClass}">
                <div class="ai-header">
                    <span class="ai-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 2a10 10 0 0 1 10 10"></path><path d="M2 12h10"></path></svg>
                        Analysis Results
                    </span>
                    <span class="ai-badge ${signalClass}">${signalClass.toUpperCase()}</span>
                </div>
                <div class="ai-body">
                    ${cleanAiText}
                </div>
            </div>

            <!-- Enhanced Fundamentals Grid -->
            <div class="fundamentals-grid">
                
                <!-- 1. Valuation Card -->
                <div class="fund-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4>Valuation</h4>
                        ${valuationBadge}
                    </div>
                    <div class="metric-row"><span>Fair Value (Graham)</span> <strong>${fairValue ? '$' + fairValue : 'N/A'}</strong></div>
                    <div class="metric-row"><span>Latest Price</span> <strong>$${currentPrice.toFixed(2)}</strong></div>
                    <div class="metric-divider"></div>
                    <div class="metric-row"><span>P/E Ratio</span> <strong>${fmtVal(f.pe_ratio)}</strong></div>
                    <div class="metric-row"><span>PEG Ratio</span> <strong>${fmtVal(f.peg_ratio)}</strong></div>
                    <div class="metric-row"><span>P/B Ratio</span> <strong>${fmtVal(f.price_to_book)}</strong></div>
                </div>

                <!-- 2. Profitability & Growth -->
                <div class="fund-card">
                    <h4>Profitability</h4>
                    <div class="metric-row"><span>Revenue (TTM)</span> <strong>${fmtNum(f.revenue_ttm)}</strong></div>
                    <div class="metric-row"><span>Net Income</span> <strong>${fmtNum(f.net_income_ttm)}</strong></div>
                    <div class="metric-row"><span>EPS (TTM)</span> <strong>${fmtVal(f.eps)}</strong></div>
                    <div class="metric-divider"></div>
                    <div class="metric-row"><span>Profit Margin</span> <strong>${fmtPct(f.profit_margins)}</strong></div>
                    <div class="metric-row"><span>ROE</span> <strong>${fmtPct(f.return_on_equity)}</strong></div>
                </div>
                
                <!-- 3. Financial Health -->
                 <div class="fund-card">
                    <h4>Financial Health</h4>
                    <div class="metric-row">
                        <span>Debt/Equity</span> 
                        <strong style="color: ${deRatio > 200 ? '#f87171' : ''}">${fmtVal(deRatio)}%</strong>
                    </div>
                    <div class="metric-row">
                        <span>Current Ratio</span> 
                        <strong style="color: ${currRatio < 1 ? '#f87171' : ''}">${fmtVal(currRatio)}</strong>
                    </div>
                    <div class="metric-divider"></div>
                    <div class="metric-row"><span>Dividend Yield</span> <strong>${fmtPct(f.dividend_yield)}</strong></div>
                    <div class="metric-row"><span>Beta (Vol)</span> <strong>${fmtVal(f.beta)}</strong></div>
                </div>
            </div>
        </div>
    `;
}





// --- Charting Logic ---
// Global chart variables
let chartInstance = null;
let candleSeries = null;
let volumeSeries = null;
let currentChartTicker = null;
let resizeObserver = null;

// Real-time polling variables
let chartPollingInterval = null;
let isChartPolling = false;


function initChart() {
    console.log('[Overview] initializing chart...');
    const container = document.getElementById('overviewChart');
    if (!container) {
        console.error('[Overview] Container #overviewChart not found');
        return;
    }

    try {
        // Destroy existing if any (clean re-init)
        if (chartInstance) {
            chartInstance.remove();
            chartInstance = null;
        }

        console.log('[Overview] Creating chart instance...');
        // Create Chart
        chartInstance = LightweightCharts.createChart(container, {
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#333',
            },
            grid: {
                vertLines: { color: 'rgba(197, 203, 206, 0.5)' },
                horzLines: { color: 'rgba(197, 203, 206, 0.5)' },
            },
            rightPriceScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
            },
            timeScale: {
                borderVisible: false,
                timeVisible: false, // Hide 00:00:00 for daily bars
                secondsVisible: false,
                fixLeftEdge: true,
                fixRightEdge: true,
                rightOffset: 2,
                minBarSpacing: 0.5, // Prevent zooming out into blank space
            },
        });

        // Add Series
        candleSeries = chartInstance.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        volumeSeries = chartInstance.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: '', // Overlay mode
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== container) return;
            const newRect = entries[0].contentRect;
            if (chartInstance) {
                // Subtract 2px to prevent sub-pixel rounding cutoffs, especially on mobile
                const textWidthParam = window.innerWidth < 768 ? 2 : 0;
                const newWidth = Math.max(0, newRect.width - textWidthParam);
                const newHeight = Math.max(0, newRect.height);

                if (newWidth === 0 || newHeight === 0) return;

                chartInstance.applyOptions({
                    width: newWidth,
                    height: newHeight
                });

                // Force fit content removed to prevent snapback on mobile scroll

            }
        });
        resizeObserver.observe(container);

        // Initial Theme Sync
        syncChartTheme();

        // Timeframe Buttons - Remove old listeners if needed (using cloning or just re-adding is fine if careful)
        const tfBtns = document.querySelectorAll('.chart-tf-btn');
        tfBtns.forEach(btn => {
            // Clone to strip old listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-tf-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                if (currentChartTicker) loadChartData(currentChartTicker);
            });
        });

        // Add window resize handler for responsiveness
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (chartInstance && container) {
                    chartInstance.applyOptions({
                        width: container.clientWidth,
                        height: container.clientHeight
                    });
                }
            }, 250); // Debounce resize events
        });

        // Setup Tab Switching Logic if not already handled elsewhere
    } catch (e) {
        console.error('[Overview] Init Failed:', e);
    }
}

function syncChartTheme() {
    if (!chartInstance) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    chartInstance.applyOptions({
        layout: {
            textColor: isDark ? '#e2e8f0' : '#1e293b',
            background: { type: 'solid', color: isDark ? '#1e293b' : '#ffffff' }
        },
        grid: {
            vertLines: { color: isDark ? '#334155' : '#e2e8f0' },
            horzLines: { color: isDark ? '#334155' : '#e2e8f0' },
        },
        timeScale: { borderColor: isDark ? '#475569' : '#cbd5e1' },
        rightPriceScale: { borderColor: isDark ? '#475569' : '#cbd5e1' }
    });
}

async function loadChartData(ticker) {
    if (!chartInstance) return;
    currentChartTicker = ticker;

    // Update Header Display
    const tickerDisplay = document.getElementById('chartTickerDisplay');
    if (tickerDisplay) tickerDisplay.innerText = ticker;

    // Get active TF
    const activeBtn = document.querySelector('.chart-tf-btn.active');
    const tf = activeBtn ? activeBtn.dataset.tf : '1y';

    // Map TF to API params
    let period = '1y';
    let interval = '1d';
    if (tf === '1mo') { period = '1mo'; interval = '1d'; }
    if (tf === '6mo') { period = '6mo'; interval = '1d'; }
    if (tf === '5y') { period = '5y'; interval = '1wk'; } // 5Y uses weekly for performance/overview

    try {
        const res = await fetch(`api/history/${ticker}?period=${period}&interval=${interval}`);
        const data = await res.json();

        if (data.error) { console.error('Chart Data Error:', data.error); return; }

        const candles = data.data.map(d => ({
            time: d.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
        }));

        const volumes = data.data.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? '#26a69a' : '#ef5350'
        }));

        candleSeries.setData(candles);
        volumeSeries.setData(volumes);

        // Use fitContent() with a slight delay to ensure correct sizing after render
        const totalBars = candles.length;
        if (totalBars > 0) {
            setTimeout(() => {
                if (chartInstance) {
                    chartInstance.timeScale().fitContent();
                }
            }, 100);
        }

        // Start real-time updates
        stopChartPolling(); // Stop any existing polling first
        startChartPolling(ticker);

    } catch (e) {
        console.error('Chart Fetch Error:', e);
    }
}

// Hook into theme toggle
const themeToggleBtn = document.getElementById('themeToggleMobile');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('change', () => setTimeout(syncChartTheme, 50));
}

const themeObserver = new MutationObserver(syncChartTheme);
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// Real-time chart polling functions
let pollingErrorCount = 0;
const MAX_POLLING_ERRORS = 3;

function startChartPolling(ticker) {
    if (isChartPolling || !chartInstance) return;

    console.log(`[Chart Polling] Starting for ${ticker}...`);
    isChartPolling = true;
    pollingErrorCount = 0; // Reset error counter

    const liveIndicator = document.getElementById('chartLiveIndicator');
    if (liveIndicator) liveIndicator.style.display = 'flex';

    // Define poller
    const poll = async () => {
        try {
            const res = await fetch(`api/latest-price/${ticker}`);
            const data = await res.json();

            if (!data.error && candleSeries && volumeSeries) {
                candleSeries.update({
                    time: data.time,
                    open: data.open,
                    high: data.high,
                    low: data.low,
                    close: data.close
                });

                volumeSeries.update({
                    time: data.time,
                    value: data.volume,
                    color: data.close >= data.open ? '#26a69a' : '#ef5350'
                });

                // --- Update Header Stats ---
                const priceEl = document.getElementById('headerPrice');
                const changeEl = document.getElementById('headerChange');
                const prevEl = document.getElementById('headerPrevClose');

                if (priceEl && changeEl && prevEl) {
                    priceEl.innerText = '$' + data.close.toFixed(2);

                    const prevClose = data.previous_close;
                    if (prevClose) {
                        prevEl.innerText = '$' + prevClose.toFixed(2);
                        const diff = data.close - prevClose;
                        const pct = (diff / prevClose) * 100;

                        const sign = diff >= 0 ? '+' : '';
                        changeEl.innerText = `${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%)`;
                        changeEl.style.color = diff >= 0 ? '#22c55e' : '#ef4444';
                    } else {
                        prevEl.innerText = 'N/A';
                        changeEl.innerText = '--';
                        changeEl.style.color = 'var(--text-secondary)';
                    }
                }

                // Reset error count on success
                pollingErrorCount = 0;
                console.log(`[Chart Polling] Updated at ${new Date().toLocaleTimeString()}`);
            } else {
                throw new Error(data.error || 'Invalid data received');
            }
        } catch (e) {
            pollingErrorCount++;
            console.error(`[Chart Polling] Error (${pollingErrorCount}/${MAX_POLLING_ERRORS}):`, e);

            // Stop polling after max errors
            if (pollingErrorCount >= MAX_POLLING_ERRORS) {
                console.warn('[Chart Polling] Max errors reached, stopping polling');
                stopChartPolling();

                // Show error indicator
                if (liveIndicator) {
                    liveIndicator.style.background = 'rgba(239, 68, 68, 0.1)';
                    liveIndicator.style.borderColor = '#ef4444';
                    liveIndicator.querySelector('span:first-child').style.background = '#ef4444';
                    liveIndicator.querySelector('span:last-child').textContent = 'ERROR';
                    liveIndicator.querySelector('span:last-child').style.color = '#ef4444';
                    liveIndicator.style.display = 'flex';
                }
            }
        }
    };

    // Run immediately then interval
    poll();
    chartPollingInterval = setInterval(poll, 60000);
}

function stopChartPolling() {
    if (!isChartPolling) return;

    console.log('[Chart Polling] Stopping...');
    if (chartPollingInterval) {
        clearInterval(chartPollingInterval);
        chartPollingInterval = null;
    }
    isChartPolling = false;
    pollingErrorCount = 0; // Reset error counter

    const liveIndicator = document.getElementById('chartLiveIndicator');
    if (liveIndicator) {
        liveIndicator.style.display = 'none';
        // Reset styling in case it was in error state
        liveIndicator.style.background = 'rgba(34, 197, 94, 0.1)';
        liveIndicator.style.borderColor = '#22c55e';
        liveIndicator.querySelector('span:first-child').style.background = '#22c55e';
        liveIndicator.querySelector('span:last-child').textContent = 'LIVE';
        liveIndicator.querySelector('span:last-child').style.color = '#22c55e';
    }
}
