let currentTickers = [];
let currentIndex = 0;
let activeTab = 'overview'; // Global tab state
let currentTickerUS = ''; // Ensure this global is consistent
let cachedTAData = null;
let isGlobalRefreshing = false; // Flag to pause polling during refresh
let isFetchingTA = false; // Flag to pause polling during TA fetch

// Touch/swipe handling variables
// Touch/swipe handling variables
let touchStartX = 0;
let touchEndX = 0;

// Helper to switch tabs programmatically
function switchTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.click();
}

// Load tickers on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('api/tickers');
        const data = await response.json();
        currentTickers = data.tickers;

        // --- Auth State Check ---
        checkAuthState();

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

                // Sync Overview Chart Theme
                if (typeof syncChartTheme === 'function') syncChartTheme();

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
        // Refresh button removed. Listener intentionally deleted.

        // Add keyboard navigation (arrow keys)
        document.addEventListener('keydown', handleKeyboardNavigation);

        // Add swipe gesture support for mobile
        const summarySection = document.querySelector('.summary-section');
        summarySection.addEventListener('touchstart', handleTouchStart, { passive: true });
        summarySection.addEventListener('touchend', handleTouchEnd, { passive: true });

        // Initialize ticker persistence
        const urlParams = new URLSearchParams(window.location.search);
        const urlTicker = urlParams.get('ticker');
        const savedTicker = localStorage.getItem('selectedTicker');

        if (urlTicker) {
            // Priority 1: URL Parameter (Allow ad-hoc tickers from search)
            const t = urlTicker.toUpperCase();

            // If ad-hoc ticker (not in universe), add it to list or just select it
            if (!currentTickers.includes(t)) {
                // Determine insertion point? Or just select.
                // For now, simple selection is enough, but adding to list allows Nav arrows to work if we want.
                // Let's just select it directly to respect user intent.
            } else {
                currentIndex = currentTickers.indexOf(t);
            }

            // Force switch to 'news' tab for incoming search redirects
            switchTab('news');
            selectTicker(t);
        } else if (savedTicker && currentTickers.includes(savedTicker)) {
            // Priority 2: LocalStorage
            currentIndex = currentTickers.indexOf(savedTicker);
            selectTicker(savedTicker);
        } else {
            // Priority 3: Default (First in list)
            if (currentTickers.length > 0) selectTicker(currentTickers[0]);
        }

        // Search Handler (Multiple inputs for Mobile/Desktop)
        const searchInputs = document.querySelectorAll('.ticker-search-input');
        searchInputs.forEach(input => {
            input.addEventListener('input', debounce(handleSearchInput, 300));

            // Allow Enter key to select top result
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const container = e.target.closest('.search-input-wrapper');
                    const dropdown = container.querySelector('.search-dropdown');
                    const firstItem = dropdown.querySelector('.search-result-item');

                    if (firstItem) {
                        const ticker = firstItem.dataset.ticker;
                        selectSearchResult(ticker); // Use unified handler
                        e.target.blur();
                    } else if (e.target.value.length >= 1) {
                        const t = e.target.value.toUpperCase().trim();
                        // Force switch to 'news' tab on explicit search
                        switchTab('news');
                        selectTicker(t);
                        e.target.value = '';
                        e.target.blur();
                        dropdown.classList.remove('show');
                    }
                }
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.querySelectorAll('.search-dropdown').forEach(d => d.classList.remove('show'));
            }
        });

        // Initialize Tabs
        initTabListeners();
        initIntervalListeners();

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
    // Find sibling dropdown
    const container = e.target.closest('.search-input-wrapper');
    const dropdown = container.querySelector('.search-dropdown');

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
            // Handle both array (legacy) and object-with-quotes behaviors just in case
            const quotes = Array.isArray(data) ? data : (data.quotes || []);

            // Backend already filters types. Map directly.
            const apiMatches = quotes.map(q => ({
                symbol: q.symbol,
                shortname: q.name || q.shortname || q.longname || q.symbol, // Backend sends 'name'
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

    // Sort combined results: Exact Match > Length
    results.sort((a, b) => {
        // Priority 1: Exact Match
        const aExact = a.symbol === upperQuery ? 0 : 1;
        const bExact = b.symbol === upperQuery ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;

        // Priority 2: Shortest Symbol
        return a.symbol.length - b.symbol.length;
    });

    // Limit results (Expanded to show all relevant)
    results = results.slice(0, 50);

    if (results.length > 0) {
        dropdown.innerHTML = results.map(quote => `
            <div class="search-result-item" data-ticker="${quote.symbol}" onclick="selectSearchResult('${quote.symbol}')">
                <div style="display:flex; flex-direction:column;">
                    <span class="result-symbol">${quote.symbol}</span>
                    ${quote.type === 'LOCAL' ? '<span style="font-size:10px; color:var(--accent);">In Watchlist</span>' : ''}
                </div>
                <span class="result-name">${quote.shortname}</span>
            </div>
        `).join('');
        // Ensure scrollability
        dropdown.style.maxHeight = '400px';
        dropdown.style.overflowY = 'auto';
        dropdown.classList.add('show');
    } else {
        dropdown.innerHTML = '<div class="search-result-item" style="cursor:default; color:var(--text-secondary);">No results found</div>';
        dropdown.classList.add('show');
    }
}

function selectSearchResult(ticker) {
    // Clear all search inputs and result dropdwons
    document.querySelectorAll('.ticker-search-input').forEach(input => input.value = '');
    document.querySelectorAll('.search-dropdown').forEach(d => d.classList.remove('show'));

    // Force switch to 'news' tab on explicit search selection
    switchTab('news');

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

    // Pause other background polls
    isGlobalRefreshing = true;

    try {
        const apiToken = document.querySelector('meta[name="api-token"]')?.content;
        const headers = apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {};

        const response = await fetch('api/refresh_fundamentals', {
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
                    // Cache bust status check
                    const statusRes = await fetch(`api/status?t=${Date.now()}`);
                    const statusData = await statusRes.json();

                    if (!statusData.is_processing) {
                        clearInterval(pollInterval);
                        isGlobalRefreshing = false; // Resume polls

                        if (span) span.textContent = 'Done!';
                        btn.title = 'Refresh Complete!';
                        btn.classList.remove('spinning');

                        setTimeout(() => {
                            // Seamless update instead of reload
                            if (typeof currentActiveTicker !== 'undefined' && currentActiveTicker) {
                                selectTicker(currentActiveTicker);
                                // Reset button state after a short delay so user sees "Done"
                                setTimeout(() => {
                                    btn.disabled = false;
                                    if (span) span.textContent = 'Refresh News';
                                    btn.title = 'Update all news';
                                }, 2000);
                            } else {
                                location.reload(); // Fallback
                            }
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
        isGlobalRefreshing = false; // Resume polls on error

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
// --- Independent Generator for Fundamentals ---
window.generateTickerFundamentals = async function (ticker, event) {
    const finContent = document.getElementById('finContent');
    let isInlineRefresh = false;
    let refreshBtn = null;

    // Check if triggered by button click
    if (event && event.currentTarget) {
        isInlineRefresh = true;
        refreshBtn = event.currentTarget;
        refreshBtn.querySelector('svg').classList.add('spinning');
        refreshBtn.disabled = true;
    }

    // Show loading state if not inline refresh
    if (!isInlineRefresh && finContent) {
        finContent.innerHTML = `
            <div class="loading">
                <div class="glass-card">
                    <div class="glass-icon">
                        <svg class="spinning" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                        </svg>
                    </div>
                    <h2 class="glass-title">Generating Fundamental Report</h2>
                    <p class="glass-subtitle">Analyzing ${ticker} data... please wait.<br>This may take up to a minute during high load.</p>
                </div>
            </div>
        `;
    }

    try {
        const apiToken = document.querySelector('meta[name="api-token"]')?.content;
        const headers = apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {};

        // Trigger generation for fundamentals
        const res = await fetch(`api/generate_fundamentals/${ticker}`, {
            method: 'GET',
            headers: headers
        });

        if (res.ok) {
            const genData = await res.json();
            const targetDate = genData.target_date;

            // Poll for completion
            let attempts = 0;
            const checkInterval = setInterval(async () => {
                attempts++;
                try {
                    const pollUrl = targetDate ? `api/fundamentals/${ticker}?min_date=${targetDate}` : `api/fundamentals/${ticker}`;
                    const summaryRes = await fetch(pollUrl);
                    if (summaryRes.ok) {
                        const data = await summaryRes.json();
                        if (data.status === 'found') {
                            clearInterval(checkInterval);
                            displaySummary(data, 'finContent'); // Only Update FinContent
                            if (refreshBtn) {
                                refreshBtn.querySelector('svg').classList.remove('spinning');
                                refreshBtn.disabled = false;
                            }
                        }
                    }
                } catch (e) { }

                if (attempts > 60) { // Timeout after 180s (3mins)
                    clearInterval(checkInterval);
                    if (!isInlineRefresh && finContent) {
                        finContent.innerHTML = `
                            <div class="placeholder">
                                <div class="glass-card">
                                    <h2 class="glass-title">Analysis Failed</h2>
                                    <p class="glass-subtitle">Could not generate fundamental data for ${ticker}.<br>Please try again later.</p>
                                </div>
                            </div>
                        `;
                    } else if (refreshBtn) {
                        refreshBtn.querySelector('svg').classList.remove('spinning');
                        refreshBtn.disabled = false;
                        alert('Fundamental analysis timed out. Please try again.');
                    }
                }
            }, 3000);
        } else {
            // Handle HTTP Error from Generate Endpoint
            throw new Error(`Fundamental generation trigger failed: ${res.status}`);
        }
    } catch (e) {
        console.error('Fundamental auto-generation failed', e);
        if (!isInlineRefresh && finContent) {
            finContent.innerHTML = `
                <div class="placeholder">
                    <h3>Connection Error</h3>
                    <p>Could not trigger fundamental analysis.</p>
                </div>
            `;
        } else if (refreshBtn) {
            refreshBtn.querySelector('svg').classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }
};

// --- Independent Generator for News ---
window.generateTickerNews = async function (ticker, event) {
    const newsContent = document.getElementById('summaryContent');
    let isInlineRefresh = false;
    let refreshBtn = null;

    // Check if triggered by button click
    if (event && event.currentTarget) {
        isInlineRefresh = true;
        refreshBtn = event.currentTarget;
        refreshBtn.querySelector('svg').classList.add('spinning');
        refreshBtn.disabled = true;
    }

    // Show loading state if not inline refresh
    if (!isInlineRefresh && newsContent) {
        newsContent.innerHTML = `
            <div class="loading">
                <div class="glass-card">
                    <div class="glass-icon">
                        <svg class="spinning" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                        </svg>
                    </div>
                    <h2 class="glass-title">Generating News Analysis</h2>
                    <p class="glass-subtitle">Analyzing ${ticker} news... please wait.<br>This may take up to a minute during high load.</p>
                </div>
            </div>
        `;
    }

    try {
        const apiToken = document.querySelector('meta[name="api-token"]')?.content;
        const headers = apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {};

        // Trigger generation for news
        const res = await fetch(`api/generate_news/${ticker}`, { // NEW News Route
            method: 'GET',
            headers: headers
        });

        if (res.ok) {
            const genData = await res.json();
            const targetDate = genData.target_date;
            // Cache the full sources list returned by the generator (all 20 articles)
            const cachedSources = (genData.sources && genData.sources.length > 0) ? genData.sources : null;

            // Poll for completion
            let attempts = 0;
            const checkInterval = setInterval(async () => {
                attempts++;
                try {
                    // Poll NEW News Endpoint
                    const pollUrl = targetDate ? `api/news/${ticker}?min_date=${targetDate}` : `api/news/${ticker}`;
                    const summaryRes = await fetch(pollUrl);
                    if (summaryRes.ok) {
                        const data = await summaryRes.json();
                        if (data.status === 'found') {
                            clearInterval(checkInterval);
                            // Inject cached sources if DB returned fewer (or none)
                            if (cachedSources && (!data.sources || data.sources.length < cachedSources.length)) {
                                data.sources = cachedSources;
                            }
                            displaySummary(data, 'summaryContent'); // Only Update NewsContent
                            if (refreshBtn) {
                                refreshBtn.querySelector('svg').classList.remove('spinning');
                                refreshBtn.disabled = false;
                            }
                        }
                    }
                } catch (e) { }

                if (attempts > 60) { // Timeout after 180s (3mins)
                    clearInterval(checkInterval);
                    if (!isInlineRefresh && newsContent) {
                        newsContent.innerHTML = `
                            <div class="placeholder">
                                <div class="glass-card">
                                    <h2 class="glass-title">Analysis Failed</h2>
                                    <p class="glass-subtitle">Could not generate news analysis for ${ticker}.<br>Please try again later.</p>
                                </div>
                            </div>
                        `;
                    } else if (refreshBtn) {
                        refreshBtn.querySelector('svg').classList.remove('spinning');
                        refreshBtn.disabled = false;
                        alert('News analysis timed out. Please try again.');
                    }
                }
            }, 3000);
        } else {
            // Handle HTTP Error from Generate Endpoint
            throw new Error(`News generation trigger failed: ${res.status}`);
        }
    } catch (e) {
        console.error('News auto-generation failed', e);
        if (!isInlineRefresh && newsContent) {
            newsContent.innerHTML = `
                <div class="placeholder">
                    <h3>Connection Error</h3>
                    <p>Could not trigger news analysis.</p>
                </div>
            `;
        } else if (refreshBtn) {
            refreshBtn.querySelector('svg').classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }
};

// Legacy alias for backward compatibility if any old calls exist, points to fundamentals as it was the primary summary
window.generateTickerSummary = window.generateTickerFundamentals;

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

        // Pause if Global Refresh is active
        if (isGlobalRefreshing) {
            // Retry in 1s instead of full flow
            quotePollTimeout = setTimeout(poll, 1000);
            return;
        }

        await fetchAndDisplayQuote(ticker);

        // Schedule next poll only after completion (5s interval to prevent rate limiting)
        if (currentActiveTicker === ticker) {
            quotePollTimeout = setTimeout(poll, 5000);
        }
    };

    // Start immediately
    poll();
}

// --- Auth Utilities ---
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function checkAuthState() {
    let userCookie = getCookie('currentUser');
    let currentUser = null;

    if (userCookie) {
        try {
            // Robust parsing (URI decode + handle potential double-serialization)
            let decoded = decodeURIComponent(userCookie);
            try {
                currentUser = JSON.parse(decoded);
            } catch (e) {
                currentUser = JSON.parse(userCookie); // Try raw
            }

            if (typeof currentUser === 'string') {
                try { currentUser = JSON.parse(currentUser); } catch (e) { }
            }
        } catch (e) {
            console.error('Error parsing user cookie:', e);
            currentUser = null;
        }
    }

    const isSignedIn = !!currentUser;

    const signInBtn = document.getElementById('signInBtn');
    const signUpBtn = document.getElementById('signUpBtn');
    const mobileSignInBtn = document.getElementById('mobileSignInBtn');
    const mobileSignUpBtn = document.getElementById('mobileSignUpBtn');

    if (isSignedIn) {
        // Desktop
        if (signInBtn) {
            signInBtn.textContent = 'Dashboard';
            signInBtn.onclick = () => window.location.href = '../app';

            // Add Welcome Message
            const authContainer = signInBtn.parentElement;
            if (authContainer && !authContainer.querySelector('.user-welcome-msg')) {
                const welcomeSpan = document.createElement('span');
                welcomeSpan.className = 'user-welcome-msg';
                welcomeSpan.style.marginRight = '12px';
                welcomeSpan.style.color = 'var(--text-primary)';
                welcomeSpan.style.fontWeight = '500';
                welcomeSpan.style.fontSize = '0.9rem';
                welcomeSpan.textContent = `Welcome, ${currentUser.username || 'User'}`;

                // Insert before the Dashboard button
                authContainer.insertBefore(welcomeSpan, signInBtn);
            }
        }
        if (signUpBtn) {
            signUpBtn.style.display = 'none'; // Hide Sign Up if logged in
        }

        // Mobile
        if (mobileSignInBtn) {
            mobileSignInBtn.textContent = 'Dashboard';
            mobileSignInBtn.onclick = () => window.location.href = '../app';
        }
        if (mobileSignUpBtn) {
            mobileSignUpBtn.style.display = 'none';
        }
    } else {
        // Desktop
        if (signInBtn) {
            signInBtn.textContent = 'Sign In';
            signInBtn.onclick = () => window.location.href = '../auth.html';

            // Remove welcome message if exists
            const authContainer = signInBtn.parentElement;
            const welcomeMsg = authContainer.querySelector('.user-welcome-msg');
            if (welcomeMsg) welcomeMsg.remove();
        }
        if (signUpBtn) {
            signUpBtn.style.display = 'block';
            signUpBtn.textContent = 'Sign Up';
            signUpBtn.onclick = () => window.location.href = '../auth.html';
        }

        // Mobile
        if (mobileSignInBtn) {
            mobileSignInBtn.textContent = 'Sign In';
            mobileSignInBtn.onclick = () => window.location.href = '../auth.html';
        }
        if (mobileSignUpBtn) {
            mobileSignUpBtn.style.display = 'block';
            mobileSignUpBtn.textContent = 'Sign Up';
            mobileSignUpBtn.onclick = () => window.location.href = '../auth.html';
        }
    }
}



async function selectTicker(ticker) {
    ticker = ticker.trim(); // Sanitize input
    currentActiveTicker = ticker; // Set global

    // Show loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    // Check which tab is active and reload specific data
    const activeTabBtn = document.querySelector('.tab-btn.active');
    const activeTabId = activeTabBtn ? activeTabBtn.dataset.tab : 'overview';

    console.log(`[selectTicker] Active Tab: ${activeTabId}`);

    // Always preload TA data in background for faster tab switching
    console.log(`[selectTicker] Preloading TA data in background for ${ticker}...`);
    // Load default/current interval immediately (visual)
    loadTAData(ticker);
    // Load ALL other intervals in background (invisible)
    preloadAllTAIntervals(ticker);

    runQuantAnalysis(ticker);

    // Load tab-specific data if needed
    if (activeTabId === 'fin') {
        loadFundamentals(ticker);
    } else if (activeTabId === 'news' || activeTabId === 'overview') {
        // Overview/News are handled by the main summary fetch below
    }

    // Continue with standard summary load...
    // Trigger background analysis if valid ticker
    if (ticker) {
        runQuantAnalysis(ticker);
    }
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
        // Cache busting to ensure fresh data after refresh
        const response = await fetch(`api/fundamentals/${ticker}?t=${Date.now()}`);
        const data = await response.json();
        console.log(`[selectTicker] Response for ${ticker}:`, data);

        if (data.ticker || data.executive_summary) { // Check for actual summary data
            console.log(`[selectTicker] Summary found, displaying...`);

            // Separate Independent Loads
            // Separate Independent Loads
            loadNews(ticker);
            loadFundamentals(ticker, data); // Pass preloaded data to fundamentals

            // Start polling for this ticker
            startPolling(ticker);

        } else {
            console.warn(`[selectTicker] Summary not found (status=${data.status}), triggering generation...`);
            throw new Error('Summary not available');
        }

    } catch (error) {
        console.log(`[selectTicker] Cache miss, triggering auto-generation sequence...`);

        // Execute "One by One" Sequence
        try {
            // 1. Fundamentals (Priority)
            await window.generateTickerFundamentals(ticker);

            // 2. News (after short delay)
            await new Promise(r => setTimeout(r, 1500));
            await window.generateTickerNews(ticker);

            // 3. Quant (after short delay)
            await new Promise(r => setTimeout(r, 1500));
            runQuantAnalysis(ticker);

        } catch (e) {
            console.error("Auto-generation sequence error:", e);
        }
    } finally {
        // Hide loading overlay
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500); // Small delay for smooth UX
        }
    }


    // Trigger Chart Load (Overview chart is now in TA tab)
    loadChartData(ticker);
}

function cleanText(text) {
    if (!text) return '';
    // Remove (XX words) patterns, case insensitive
    return text.replace(/\(\d+\s*words\)/gi, '').trim();
}

// Modal Toggle Function
window.toggleSourcesModal = function (event, modalId = 'sourcesModal') {
    if (event) event.preventDefault();
    const modal = document.getElementById(modalId);
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

function displaySummary(data, targetId = 'summaryContent') {
    // Redirect to specified Content Tab (News or Fundamentals)
    const summaryContent = document.getElementById(targetId);
    if (summaryContent) {
        summaryContent.dataset.ticker = data.ticker; // Track displayed ticker
        // Only toggle display/opacity if it's NOT the main tab container (let tab logic handle that)
        if (!summaryContent.classList.contains('tab-content')) {
            summaryContent.style.display = 'flex';
            summaryContent.style.opacity = '1';
        }
        // Ensure it's treated as the active view if needed, but styling handles layout
    }

    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) {
        tabsContainer.style.display = 'flex';
    }

    let sourcesHTML = '';
    if (data.sources && data.sources.length > 0) {
        // Create unique modal ID based on target tab
        const modalId = `sourcesModal-${targetId.replace('Content', '')}`;

        // Trigger Link
        const sourcesTrigger = `
            <div class="sources-trigger-wrapper">
                <a href="#" class="sources-trigger" onclick="toggleSourcesModal(event, '${modalId}')">
                    <span>Sources (${data.sources.length})</span>
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
            <div id="${modalId}" class="modal-overlay" onclick="toggleSourcesModal(event, '${modalId}')">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>News Coverage <span style="font-size:0.85em; font-weight:400; color:var(--text-secondary);">&#8212; ${data.sources.length} article${data.sources.length !== 1 ? 's' : ''}</span></h3>
                        <button class="modal-close" onclick="toggleSourcesModal(event, '${modalId}')">×</button>
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
        const summaryContent = document.getElementById(targetId);
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

    // Fix: Strip confidence/editorial labels like [HIGH], [MEDIUM], [LOW], [EDITORIAL] and markdown bold variants.
    rawText = rawText.replace(/\*?\[?(HIGH|MEDIUM|LOW|EDITORIAL)\]?\*?/gi, '');
    rawText = rawText.replace(/\[(HIGH|MEDIUM|LOW|EDITORIAL)\]\s*\[(HIGH|MEDIUM|LOW|EDITORIAL)\]/gi, '');
    rawText = rawText.replace(/^(\s*-\s*)\s+/gm, '$1');

    const reportContent = window.marked
        ? marked.parse(rawText)
        : rawText;

    // Only show Price Badge on Fundamentals Tab
    let priceBadgeHTML = '';
    if (targetId === 'finContent') {
        priceBadgeHTML = `
            <div style="display:flex; gap:12px; align-items: center;">
                <span class="header-badge price-badge ticker-price-update-${data.ticker}" style="font-size: 0.6em; padding: 4px 8px; border-radius: 6px; background: rgba(128,128,128,0.1); color: var(--text-primary); font-family:monospace;">...</span>
            </div>
        `;
    }

    // Determine which generation function to call for the refresh button
    const refreshFunction = targetId === 'finContent' ? 'window.generateTickerFundamentals' : 'window.generateTickerNews';
    const displayTicker = data.ticker.replace('NEWS_', ''); // Clean display ticker

    summaryContent.innerHTML = `
        <div class="summary-display">
            <h2 style="display: flex; align-items: center; gap: 16px; margin-bottom: 0px; flex-wrap: wrap;">
                ${displayTicker}
                ${priceBadgeHTML}
                
                <span class="last-updated-badge" style="font-size: 12px; color: var(--text-secondary); font-weight: 500; background: var(--bg-card); padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border); margin-left: auto;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px; display:inline-block; vertical-align:text-bottom;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Updated: ${(() => {
            if (!data.updated_at) return data.date || 'N/A';
            let d = new Date(data.updated_at);
            const now = new Date();
            // Correction for double-conversion (if > 4h ahead, assume offset error)
            if (d > now && (d.getTime() - now.getTime()) > 3600000 * 4) {
                d = new Date(d.getTime() - 19800000); // Subtract 5.5h
            }
            return d.toLocaleString(undefined, { timeZoneName: 'short' });
        })()}
                </span>

                <button onclick="${refreshFunction}('${displayTicker}', event)" class="ticker-refresh-btn" title="Force Refresh Analysis">
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

    // Wrap all tables in scrollable containers for mobile
    const tables = summaryContent.querySelectorAll('.research-report table');
    console.log(`Found ${tables.length} tables to wrap`);
    tables.forEach((table, index) => {
        if (!table.parentElement.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
            console.log(`Wrapped table ${index + 1}`);
        }
    });

    // Initial fetch
    fetchAndDisplayQuote(data.ticker);
}

async function fetchAndDisplayQuote(ticker) {
    try {
        const qRes = await fetch(`/us-news/api/quote/${ticker}`);
        if (!qRes.ok) {
            // Silently ignore 404s (likely no data available yet or blocked) to avoid console spam
            if (qRes.status !== 404) {
                console.warn(`Quote fetch failed for ${ticker}: ${qRes.status}`);
            }
            return;
        }
        const qData = await qRes.json();
        console.log(`[Quote Update] ${ticker}:`, qData);

        // Update all price badges for this ticker using Class Selector
        const priceBadges = document.querySelectorAll(`.ticker-price-update-${ticker}`);
        const changeBadges = document.querySelectorAll(`.ticker-change-update-${ticker}`);

        if (priceBadges.length > 0 && qData.previous_close !== undefined) {
            priceBadges.forEach(badge => {
                // Format Previous Close
                const prevPrice = Number(qData.previous_close).toFixed(2);
                badge.textContent = `Prev Close: $${prevPrice}`;

                // Neutral styling
                badge.style.background = 'rgba(128,128,128,0.1)';
                badge.style.color = 'var(--text-primary)';
                badge.style.border = 'none';
            });

            // Hide Change Badge if exists
            changeBadges.forEach(b => b.style.display = 'none');
        }

        // --- 1.5 Sync Main Header Stats (Fix Mismatch) ---
        const headerPriceEl = document.getElementById('headerPrice');
        const headerChangeEl = document.getElementById('headerChange');
        const headerPrevEl = document.getElementById('headerPrevClose');

        if (headerPriceEl && headerChangeEl && headerPrevEl && qData.price !== undefined) {
            headerPriceEl.innerText = '$' + Number(qData.price).toFixed(2);

            if (qData.previous_close) {
                headerPrevEl.innerText = '$' + Number(qData.previous_close).toFixed(2);
                const diff = qData.change; // data from API usually is value
                const pct = qData.change_percent;

                const sign = diff >= 0 ? '+' : '';
                const diffStr = Number(diff).toFixed(2);
                const pctStr = Number(pct).toFixed(2);

                headerChangeEl.innerText = `${sign}${diffStr} (${sign}${pctStr}%)`;
                headerChangeEl.style.color = diff >= 0 ? '#22c55e' : '#ef4444';
            }
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
            activeTab = targetId; // Update global state

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
            if (targetId === 'ta' && currentActiveTicker) {
                console.log(`[TA] Tab clicked, loading data for ${currentActiveTicker}...`);

                // CRITICAL: Resize chart after tab becomes visible
                // The chart was initialized when hidden, so it needs to recalculate dimensions
                setTimeout(() => {
                    if (chartInstance) {
                        const container = document.getElementById('overviewChart');
                        if (container) {
                            chartInstance.applyOptions({
                                width: container.clientWidth,
                                height: 450
                            });
                            chartInstance.timeScale().fitContent();
                        }
                    }
                }, 50); // Small delay to ensure tab is fully visible

                // Load Overview Chart (now in TA tab)
                if (currentChartTicker) {
                    loadChartData(currentChartTicker);
                }
                // Always load TA data when switching to TA tab
                loadTAData(currentActiveTicker);
                // Trigger Expert Quant Analysis Automatically
                runQuantAnalysis(currentActiveTicker);
            } else if (targetId === 'ta') {
                console.warn('[TA] Tab clicked but no currentActiveTicker set');
            }

            // Stop chart polling when leaving TA tab (since chart is now in TA)
            if (targetId !== 'ta') {
                stopChartPolling();
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
            setTimeout(() => {
                tabToActivate.click();

                // After tab is restored, load the appropriate data for the current ticker
                if (savedTab === 'ta' && currentActiveTicker) {
                    console.log("[Init] Restoring TA tab, loading data for:", currentActiveTicker);
                    loadTAData(currentActiveTicker);
                    runQuantAnalysis(currentActiveTicker);
                } else if (savedTab === 'fin' && currentActiveTicker) {
                    console.log("[Init] Restoring Fundamentals tab, loading data for:", currentActiveTicker);
                    loadFundamentals(currentActiveTicker);
                }
            }, 100);
        }
    }
}

async function _unused_loadTAData(ticker) {
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
        console.log(`[TA] Fetching data for ${ticker} (${interval})...`);
        const response = await fetch(`/us-news/api/ta/${ticker}?interval=${interval}`);
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

function _unused_renderTA(data) {
    // 1. Key Levels Table
    const levelsDiv = document.getElementById('levelsContent');
    if (levelsDiv) {
        let html = `
        <div class="key-levels-container">
            <!-- Left Side: Fibonacci -->
            <div class="key-levels-col">
                <div class="key-levels-header">Fibonacci Retracement</div>
        `;

        for (const [key, val] of Object.entries(data.fibonacci)) {
            html += `<div class="level-row"><span>${key}</span><span>$${val.toFixed(2)}</span></div>`;
        }

        html += `
            </div>
            <!-- Right Side: Support/Resistance -->
            <div class="key-levels-col">
                <div class="key-levels-header">Support / Resistance</div>
        `;

        data.resistances.slice(0, 3).forEach(r => {
            html += `<div class="level-row"><span style="color:#f87171">Res</span><span>$${r.toFixed(2)}</span></div>`;
        });

        data.supports.slice(0, 3).forEach(s => {
            html += `<div class="level-row"><span style="color:#34d399">Sup</span><span>$${s.toFixed(2)}</span></div>`;
        });

        html += `
            </div>
        </div>
        `;
        levelsDiv.innerHTML = html;
    }

    // 2. Indicators Detailed Tables
    const indicatorsDiv = document.getElementById('indicatorsContent');
    if (indicatorsDiv) {
        const s = data.summary;

        // Helper to Create Table Rows
        const createTableRows = (items) => {
            return items.map(item => {
                let colorClass = '';
                if (item.action === 'Buy') colorClass = 'text-green-500'; // user might not have tailwind, using inline or known classes
                else if (item.action === 'Sell') colorClass = 'text-red-500';
                else colorClass = 'text-gray-500'; // Neural/Hold

                // Safe formatting for value
                let valStr = typeof item.value === 'number' ? item.value.toFixed(2) : '-';

                // Color Style for manually mimicking classes if they don't exist
                let style = '';
                if (item.action === 'Buy') style = 'color: #34d399; font-weight: 600;';
                if (item.action === 'Sell') style = 'color: #f87171; font-weight: 600;';
                if (item.action === 'Neutral') style = 'color: var(--text-secondary);';

                return `
                    <div class="ta-table-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 0.9rem;">
                        <span style="color: var(--text-primary); flex: 2;">${item.name}</span>
                        <span style="color: var(--text-primary); flex: 1; text-align: right;">${valStr}</span>
                        <span style="${style} flex: 1; text-align: right;">${item.action || '-'}</span>
                    </div>
                `;
            }).join('');
        };

        let html = '<div class="indicators-grid">';

        // Oscillators Section
        if (s.oscillators && s.oscillators.length) {
            html += `
                <div class="ta-section">
                    <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border); padding-bottom: 8px;">Oscillators</h4>
                    <div class="ta-table-header" style="display: flex; justify-content: space-between; padding-bottom: 8px; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">
                        <span style="flex: 2;">Name</span>
                        <span style="flex: 1; text-align: right;">Value</span>
                        <span style="flex: 1; text-align: right;">Action</span>
                    </div>
                    ${createTableRows(s.oscillators)}
                </div>
            `;
        }

        // Moving Averages Section
        if (s.moving_averages && s.moving_averages.length) {
            html += `
                <div class="ta-section">
                    <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border); padding-bottom: 8px;">Moving Averages</h4>
                     <div class="ta-table-header" style="display: flex; justify-content: space-between; padding-bottom: 8px; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">
                        <span style="flex: 2;">Name</span>
                        <span style="flex: 1; text-align: right;">Value</span>
                        <span style="flex: 1; text-align: right;">Action</span>
                    </div>
                    ${createTableRows(s.moving_averages)}
                </div>
            `;
        }

        html += '</div>';

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
// --- 3. Fundamentals Functions ---
async function loadNews(ticker) {
    const summaryContent = document.getElementById('summaryContent');
    if (!summaryContent) return;

    // News uses NEWS_ prefix for caching, so we expect data.ticker to be NEWS_TSLA
    const expectedTicker = `NEWS_${ticker}`;
    const isNewTicker = summaryContent.dataset.ticker !== expectedTicker;

    if (isNewTicker || summaryContent.innerHTML.trim() === '') {
        summaryContent.innerHTML = '<div class="loading"><div class="glass-card"><h2 class="glass-title">Loading News Analysis...</h2></div></div>';
        summaryContent.dataset.ticker = expectedTicker;

        try {
            const response = await fetch(`api/news/${ticker}?t=${Date.now()}`);
            const data = await response.json();

            if (data.ticker || data.executive_summary) {
                displaySummary(data, 'summaryContent');
            } else {
                window.generateTickerNews(ticker);
            }
        } catch (error) {
            console.error('[News] Error loading news:', error);
            summaryContent.innerHTML = '<div class="error-msg">Failed to load news.</div>';
        }
    }
}

async function loadFundamentals(ticker, preloadedData = null) {
    const finContent = document.getElementById('finContent');
    if (!finContent) return;

    // Check if we need to load (different ticker or empty)
    // Note: Fundamentals ticker is just the symbol (e.g. TSLA)
    const isNewTicker = finContent.dataset.ticker !== ticker;

    if (isNewTicker || finContent.innerHTML.trim() === '') {
        finContent.innerHTML = '<div class="loading"><div class="glass-card"><h2 class="glass-title">Loading Analysis...</h2></div></div>';
        finContent.dataset.ticker = ticker; // Set immediately to prevent weird race conditions

        if (preloadedData && (preloadedData.ticker === ticker)) {
            displaySummary(preloadedData, 'finContent');
            return;
        }

        try {
            // Use Fundamentals Endpoint
            const response = await fetch(`api/fundamentals/${ticker}?t=${Date.now()}`);
            const data = await response.json();

            if (data.ticker || data.executive_summary) {
                displaySummary(data, 'finContent');
            } else {
                window.generateTickerFundamentals(ticker);
            }
        } catch (error) {
            console.error('[Fundamentals] Error loading summary:', error);
            finContent.innerHTML = '<div class="error-msg">Failed to load analysis.</div>';
        }
    }
}

function renderFundamentals(data) {
    // Content removed
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
        // Create Chart with explicit height to ensure timeScale is visible
        chartInstance = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: 450,
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
                visible: true,
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: {
                    labelVisible: true,
                    labelBackgroundColor: '#2563eb', // Force blue background for visibility
                },
                horzLine: {
                    labelVisible: true,
                    labelBackgroundColor: '#2563eb',
                },
            },
            timeScale: {
                visible: true,
                borderVisible: true, // Force border visible
                borderColor: 'rgba(197, 203, 206, 0.8)',
                timeVisible: true,
                secondsVisible: false,
                fixLeftEdge: true,
                fixRightEdge: true,
                rightOffset: 2,
                minBarSpacing: 0.5,
            },
            handleScale: {
                axisPressedMouseMove: true,
                pinch: true,
            },
            handleScroll: {
                vertTouchDrag: false, // Allow vertical page scroll
                horzTouchDrag: true,  // Allow horizontal chart pan
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



        // Add Crosshair Move Handler for Dynamic Legend
        chartInstance.subscribeCrosshairMove(param => {
            const legend = document.getElementById('chartDynamicLegend');
            if (!legend) return;

            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > container.clientWidth ||
                param.point.y < 0 ||
                param.point.y > container.clientHeight
            ) {
                // Clear or reset when out of chart
                legend.innerHTML = '';
                return;
            }

            // Get data for the specific series
            const data = param.seriesData.get(candleSeries);
            const volumeData = param.seriesData.get(volumeSeries);

            if (data) {
                // Format Date
                let dateStr;
                if (typeof param.time === 'string') {
                    // Daily data: "YYYY-MM-DD"
                    const [y, m, d] = param.time.split('-').map(Number);
                    // Create date in local timezone to prevent shifts
                    dateStr = new Date(y, m - 1, d).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric'
                    });
                } else {
                    // Intraday: Unix timestamp (seconds)
                    dateStr = new Date(param.time * 1000).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: 'numeric', minute: 'numeric' // Add time for intraday
                    });
                }

                // Format OHLC
                const open = data.open.toFixed(2);
                const high = data.high.toFixed(2);
                const low = data.low.toFixed(2);
                const close = data.close.toFixed(2);
                const vol = volumeData && volumeData.value ? (volumeData.value / 1000000).toFixed(2) + 'M' : '';

                // Color for Change
                const change = (data.close - data.open).toFixed(2);
                const color = change >= 0 ? '#22c55e' : '#ef5350';

                legend.innerHTML = `
                    <div class="chart-legend-flex-container">
                        <span class="legend-date">${dateStr}</span>
                        <div class="legend-data-group">
                            <span class="legend-item">O: ${open}</span>
                            <span class="legend-item">H: ${high}</span>
                            <span class="legend-item">L: ${low}</span>
                            <span class="legend-item">C: ${close}</span>
                            <span class="legend-item" style="color: ${color}">(${change})</span>
                            ${vol ? `<span class="legend-item">V: ${vol}</span>` : ''}
                        </div>
                    </div>
                `;
            }
        });

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


        // Add resize handler to maintain chart dimensions and timeScale visibility
        const resizeObserver = new ResizeObserver(() => {
            if (chartInstance && container) {
                chartInstance.applyOptions({
                    width: container.clientWidth,
                    height: 450
                });
            }
        });
        resizeObserver.observe(container);

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
            textColor: isDark ? '#ffffff' : '#000000', // Pure White for dark, Pure Black for light
            background: { type: 'solid', color: 'transparent' }
        },
        grid: {
            vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' },
            horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' },
        },
        timeScale: { borderColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(0, 0, 0, 0.2)' },
        rightPriceScale: { borderColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(0, 0, 0, 0.2)' }
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
        const res = await fetch(`/us-news/api/history/${ticker}?period=${period}&interval=${interval}&_=${Date.now()}`);
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
        // PAUSE if global refresh is active or TA is fetching
        if (isGlobalRefreshing || window.isFetchingTA) {
            console.log('[Chart Polling] Paused...');
            return;
        }

        try {
            const res = await fetch(`/us-news/api/latest-price/${ticker}`);
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

                // Header Stats updated by fetchAndDisplayQuote (2s interval) instead of here (60s)

                // Reset error count on success
                pollingErrorCount = 0;
                console.log(`[Chart Polling] Updated at ${new Date().toLocaleTimeString()}`);
            } else if (res.status === 429) {
                console.warn('[Chart Polling] Rate Limit (429). Skipping update.');
                // Do NOT throw error, just skip this poll cycle
                return;
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

// Global state for TA Interval
let currentTAInterval = '1d';

// Initialize TA Interval Listeners
function initIntervalListeners() {
    document.querySelectorAll('.ta-interval-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update Active State
            document.querySelectorAll('.ta-interval-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const interval = e.target.getAttribute('data-val');
            currentTAInterval = interval;

            // Reload Data if ticker exists
            if (currentActiveTicker) {
                // Show loading on gauge/tables?
                const indicatorsDiv = document.getElementById('indicatorsContent');
                if (indicatorsDiv) indicatorsDiv.innerHTML = '<div class="loader">Loading...</div>';
                loadTAData(currentActiveTicker, interval);
            }
        });
    });
}

// Call this on DOMContentLoaded - Assuming it's called in main init or we add listener here
// But existing init uses initIntervalListeners() inside the main listener, so we just declare it here.
// Wait, the main listener calls `initIntervalListeners` but it wasn't defined until now.
// We need to make sure `initIntervalListeners` is defined when DOMContentLoaded fires.
// Since this is appended to the end, it will be defined.

// Load Technical Analysis Data with Interval Support
// --- Global TA Caching ---
const taCache = {}; // Key: "TICKER_INTERVAL", Value: ResponseData
const taPromises = {}; // Key: "TICKER_INTERVAL", Value: Promise

// Helper: Fetch TA Data with Caching & Deduplication
async function fetchTAData(ticker, interval) {
    const key = `${ticker}_${interval}`;

    // 1. Return Cached Data if available
    if (taCache[key]) {
        console.log(`[TA-Cache] Returning cached data for ${key}`);
        return taCache[key];
    }

    // 2. Return In-Flight Promise if already fetching
    if (taPromises[key]) {
        console.log(`[TA-Cache] Joining in-flight request for ${key}`);
        return taPromises[key];
    }

    // 3. Fetch New Data
    console.log(`[TA-Fetch] Fetching new data for ${key}...`);
    const promise = fetch(`/us-news/api/ta/${ticker}?interval=${interval}&_=${Date.now()}`)
        .then(async (response) => {
            if (response.status === 429) {
                console.warn(`[TA] Rate Limit hit for ${key}`);
                throw new Error('Rate limit exceeded. Please wait.');
            }
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

            const data = await response.json();

            // Validate data structure before caching
            if (data && (data.summary || data.chart_data)) {
                taCache[key] = data; // Cache successful result
            }
            return data;
        })
        .finally(() => {
            delete taPromises[key]; // Remove promise when done (success or fail)
        });

    taPromises[key] = promise;
    return promise;
}

// Helper: Preload ALL Intervals in Background
function preloadAllTAIntervals(ticker) {
    const intervals = ['1m', '5m', '15m', '30m', '1h', '1d', '1wk'];
    console.log(`[TA-Preload] Triggering background fetch for all intervals of ${ticker}`);

    intervals.forEach(interval => {
        // Fetch each interval. The caching logic in fetchTAData prevents duplicates.
        // We catch errors here to ensure background tasks don't crash main thread.
        fetchTAData(ticker, interval).catch(err => {
            // Suppress errors for background preloads to avoid console noise
            // console.warn(`[TA-Preload] Bg load failed for ${interval}:`, err);
        });
    });
}

// Load Technical Analysis Data with Interval Support
async function loadTAData(ticker, interval = '1d') {
    const indicatorsDiv = document.getElementById('indicatorsContent');
    const levelsDiv = document.getElementById('levelsContent');

    // Safety check if elements exist
    if (!indicatorsDiv || !levelsDiv) return;

    // Use current global interval if not specified
    if (interval === undefined || interval === null) interval = currentTAInterval;

    if (activeTab !== 'ta' && !interval) return;

    // Check cache first to avoid flashing "Loading" if data is ready
    const key = `${ticker}_${interval}`;
    const isCached = !!taCache[key];

    // Only clear previous data if NOT cached (instant render if cached)
    if (!isCached) {
        if (indicatorsDiv) indicatorsDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        if (levelsDiv) levelsDiv.innerHTML = '<div class="loading-text">Updating...</div>';

        // Reset Gauge to "Loading" State
        const needle = document.getElementById('gaugeNeedle');
        const text = document.getElementById('gaugeText');
        const countBuy = document.getElementById('countBuy');
        const countSell = document.getElementById('countSell');
        const countNeutral = document.getElementById('countNeutral');

        if (needle) needle.style.transform = 'translateX(-50%) rotate(-90deg)'; // Left/Empty
        if (text) {
            text.innerText = 'LOADING...';
            text.style.color = 'var(--text-secondary)';
        }
        if (countBuy) countBuy.innerText = '-';
        if (countSell) countSell.innerText = '-';
        if (countNeutral) countNeutral.innerText = '-';
    }

    // Set Fetching Flag
    window.isFetchingTA = true;

    try {
        // Use our new Helper with Caching
        const data = await fetchTAData(ticker, interval);
        renderTA(data, ticker);

    } catch (error) {
        console.error('TA Load Error:', error);
        indicatorsDiv.innerHTML = `<div class="error-msg">Failed to load Technicals: ${error.message}</div>`;
        levelsDiv.innerHTML = '';

        // Reset Gauge on error
        const needle = document.getElementById('gaugeNeedle');
        const text = document.getElementById('gaugeText');
        if (needle) needle.style.transform = 'translate(-50%, 0) rotate(-90deg)';
        if (text) text.innerText = 'ERROR';
    } finally {
        window.isFetchingTA = false;
    }
}

function renderTA(data, ticker) {
    if (!data || !data.summary) return;

    // 1. Update Gauge
    if (data.summary.analysis) {
        const a = data.summary.analysis;
        const needle = document.getElementById('gaugeNeedle');
        const text = document.getElementById('gaugeText');
        const countBuy = document.getElementById('countBuy');
        const countSell = document.getElementById('countSell');
        const countNeutral = document.getElementById('countNeutral');

        // Maps
        let deg = -90; // Default left
        let color = 'var(--text-primary)';

        switch (a.recommendation) {
            case 'Strong Sell': deg = -75; color = '#ef4444'; break;
            case 'Sell': deg = -35; color = '#f87171'; break;
            case 'Neutral': deg = 0; color = 'var(--text-secondary)'; break;
            case 'Buy': deg = 35; color = '#34d399'; break;
            case 'Strong Buy': deg = 75; color = '#22c55e'; break;
        }

        if (needle) {
            // needle.style.transform = `translateX(-50%) rotate(${deg}deg)`; // This overrides the base CSS transform if not careful
            // Better to set the variable or be precise
            needle.style.transform = `translateX(-50%) rotate(${deg}deg)`; // Based on CSS of parent/needle
        }
        if (text) {
            text.innerText = a.recommendation.toUpperCase();
            text.style.color = color;
        }

        if (countBuy) countBuy.innerText = a.buy;
        if (countSell) countSell.innerText = a.sell;
        if (countNeutral) countNeutral.innerText = a.neutral;
    }

    // 2. Key Levels Table
    const levelsDiv = document.getElementById('levelsContent');
    if (levelsDiv) {
        let html = `
        <div class="key-levels-container">
            <!-- Left Side: Fibonacci -->
            <div class="key-levels-col">
                <div class="key-levels-header">Fibonacci Retracement</div>
        `;

        if (data.fibonacci) {
            for (const [key, val] of Object.entries(data.fibonacci)) {
                html += `<div class="level-row"><span>${key}</span><span>$${val.toFixed(2)}</span></div>`;
            }
        }

        html += `
            </div>
            <!-- Right Side: Support/Resistance -->
            <div class="key-levels-col">
                <div class="key-levels-header">Pivot Points</div>
        `;

        (data.resistances || []).slice(0, 3).reverse().forEach(r => {
            html += `<div class="level-row"><span style="color:#f87171">Res</span><span>$${r.toFixed(2)}</span></div>`;
        });

        (data.supports || []).slice(-3).reverse().forEach(s => {
            html += `<div class="level-row"><span style="color:#34d399">Sup</span><span>$${s.toFixed(2)}</span></div>`;
        });

        html += `
            </div>
        </div>
        `;
        levelsDiv.innerHTML = html;
    }

    // 3. Indicators Detailed Tables
    const indicatorsDiv = document.getElementById('indicatorsContent');
    if (indicatorsDiv) {
        const s = data.summary;

        // Helper to Create Table Rows
        const createTableRows = (items) => {
            return items.map(item => {
                let colorClass = '';
                // Color Style for manually mimicking classes if they don't exist
                let style = '';
                if (item.action === 'Buy') style = 'color: #34d399; font-weight: 600;';
                if (item.action === 'Sell') style = 'color: #f87171; font-weight: 600;';
                if (item.action === 'Neutral') style = 'color: var(--text-secondary);';

                // Safe formatting for value
                let valStr = typeof item.value === 'number' ? item.value.toFixed(2) : '-';

                return `
                    <div class="ta-table-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 0.9rem;">
                        <span style="color: var(--text-primary); flex: 2;">${item.name}</span>
                        <span style="color: var(--text-primary); flex: 1; text-align: right;">${valStr}</span>
                        <span style="${style} flex: 1; text-align: right;">${item.action || '-'}</span>
                    </div>
                `;
            }).join('');
        };

        let html = '<div class="indicators-grid">';

        // Oscillators Section
        if (s.oscillators && s.oscillators.length) {
            html += `
                <div class="ta-section">
                    <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border); padding-bottom: 8px;">Oscillators</h4>
                    <div class="ta-table-header" style="display: flex; justify-content: space-between; padding-bottom: 8px; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">
                        <span style="flex: 2;">Name</span>
                        <span style="flex: 1; text-align: right;">Value</span>
                        <span style="flex: 1; text-align: right;">Action</span>
                    </div>
                    ${createTableRows(s.oscillators)}
                </div>
            `;
        }

        // Moving Averages Section
        if (s.moving_averages && s.moving_averages.length) {
            html += `
                <div class="ta-section">
                    <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: var(--text-primary); border-bottom: 2px solid var(--border); padding-bottom: 8px;">Moving Averages</h4>
                     <div class="ta-table-header" style="display: flex; justify-content: space-between; padding-bottom: 8px; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">
                        <span style="flex: 2;">Name</span>
                        <span style="flex: 1; text-align: right;">Value</span>
                        <span style="flex: 1; text-align: right;">Action</span>
                    </div>
                    ${createTableRows(s.moving_averages)}
                </div>
            `;
        }

        html += '</div>';

        indicatorsDiv.innerHTML = html;
    }

    // 4. Update Charts
    if (data.chart_data) {
        // Destroy old
        if (priceChartInstance) { priceChartInstance.destroy(); priceChartInstance = null; }
        if (macdChartInstance) { macdChartInstance.destroy(); macdChartInstance = null; }

        const ctxPrice = document.getElementById('priceChart');
        const ctxMacd = document.getElementById('macdChart');

        // If elements exist
        if (ctxPrice && ctxMacd) {
            const labels = data.chart_data.map(d => d.date);
            const closes = data.chart_data.map(d => d.close);
            const sma50 = data.chart_data.map(d => d.sma50);
            const sma200 = data.chart_data.map(d => d.sma200);
            const macd = data.chart_data.map(d => d.macd);
            const signal = data.chart_data.map(d => d.signal);
            const hist = data.chart_data.map(d => d.hist);

            // Determine colors based on theme attribute
            const theme = document.documentElement.getAttribute('data-theme') || 'light';
            const isDark = theme === 'dark';
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
            const textColor = isDark ? '#9ca3af' : '#475569';

            // Price Chart
            priceChartInstance = new Chart(ctxPrice, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Price',
                            data: closes,
                            borderColor: '#3b82f6',
                            borderWidth: 2,
                            tension: 0.1,
                            pointRadius: 0,
                            fill: true,
                            backgroundColor: (context) => {
                                const ctx = context.chart.ctx;
                                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
                                gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                                return gradient;
                            }
                        },
                        {
                            label: 'SMA 50',
                            data: sma50,
                            borderColor: '#f59e0b',
                            borderWidth: 1.5,
                            tension: 0.1,
                            pointRadius: 0,
                            borderDash: [5, 5]
                        },
                        {
                            label: 'SMA 200',
                            data: sma200,
                            borderColor: '#ef4444',
                            borderWidth: 1.5,
                            tension: 0.1,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { labels: { color: textColor } },
                        tooltip: { mode: 'index', intersect: false },
                        title: {
                            display: true,
                            text: `${ticker || 'Unknown'} Price & SMA`,
                            color: textColor,
                            font: { size: 16 }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                maxTicksLimit: 8,
                                color: textColor,
                                autoSkip: true,
                                maxRotation: window.innerWidth < 768 ? 45 : 0,
                                minRotation: window.innerWidth < 768 ? 45 : 0
                            },
                            grid: { color: gridColor },
                            display: true
                        },
                        y: {
                            position: 'right',
                            ticks: { color: textColor },
                            grid: { color: gridColor },
                            beginAtZero: false,
                            grace: '5%'
                        }
                    }
                }
            });

            // MACD Chart
            macdChartInstance = new Chart(ctxMacd, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            type: 'line',
                            label: 'MACD',
                            data: macd,
                            borderColor: '#3b82f6',
                            borderWidth: 1.5,
                            pointRadius: 0
                        },
                        {
                            type: 'line',
                            label: 'Signal',
                            data: signal,
                            borderColor: '#f59e0b',
                            borderWidth: 1.5,
                            pointRadius: 0
                        },
                        {
                            type: 'bar',
                            label: 'Histogram',
                            data: hist,
                            backgroundColor: (ctx) => {
                                const val = ctx.raw;
                                return val >= 0 ? '#22c55e' : '#ef4444';
                            }
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: true, // Show Legend (Colors)
                            labels: { color: textColor }
                        },
                        tooltip: { mode: 'index', intersect: false },
                        title: {
                            display: true,
                            text: 'MACD Momentum',
                            color: textColor,
                            font: { size: 14 }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                maxTicksLimit: 8,
                                color: textColor,
                                autoSkip: true,
                                maxRotation: window.innerWidth < 768 ? 45 : 0,
                                minRotation: window.innerWidth < 768 ? 45 : 0
                            },
                            grid: { color: gridColor },
                            display: true // Force Dates to Show
                        },
                        y: {
                            position: 'right',
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        }
                    }
                }
            });
        }
    }
}

// --- Expert Quant Analysis ---
function initQuantAnalysisListener() {
    const btn = document.getElementById('runQuantAnalysisBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            if (currentActiveTicker) {
                runQuantAnalysis(currentActiveTicker);
            }
        });
    }
}

async function runQuantAnalysis(ticker, forceRefresh = false) {
    console.log(`[QuantAnalysis] Triggered for ${ticker}, Force: ${forceRefresh}`);
    const resultDiv = document.getElementById('quantAnalysisResult');
    const refreshBtn = document.getElementById('forceRefreshQuantBtn');

    if (!resultDiv) return;

    // Guard: Prevent redundant loading if already showing this ticker (and not forcing)
    if (!forceRefresh && resultDiv.dataset.ticker === ticker) {
        console.log(`[QuantAnalysis] Already loaded/loading for ${ticker}. Skipping.`);
        return;
    }

    // Mark as current immediately to block subsequent calls
    resultDiv.dataset.ticker = ticker;

    // Loading State
    resultDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px;">
            <div class="spinner" style="width: 30px; height: 30px; border-width: 3px; border-color: #8b5cf6 transparent #8b5cf6 transparent;"></div>
            <span style="color: var(--text-secondary); font-size: 0.9rem;">${forceRefresh ? 'Force refreshing' : 'Analyzing'} 1h & 1d intervals...</span>
        </div>
    `;

    // Rotate/Disable Refresh Button
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('rotating'); // Ensure CSS has .rotating { animation: spin 1s linear infinite; }
    }

    try {
        const url = `/us-news/api/quant-analysis/${ticker}${forceRefresh ? '?force=true' : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Advanced Formatting using Marked.js
        // Backend returns 'analysis' for quant endpoint, 'summary' for others. Handle both.
        let rawMarkdown = data.analysis || data.summary || "No analysis available.";

        // 1. Highlight Key Terms (Before Markdown parsing or after - safer before for simple words)
        // Wraps [BUY] [SELL] etc in spans
        rawMarkdown = rawMarkdown.replace(/\b(STRONG BUY|BUY|BULLISH)\b/gi, '<span class="signal-buy">$1</span>');
        rawMarkdown = rawMarkdown.replace(/\b(STRONG SELL|SELL|BEARISH)\b/gi, '<span class="signal-sell">$1</span>');
        rawMarkdown = rawMarkdown.replace(/\b(NEUTRAL|HOLD|CONSOLIDATION)\b/gi, '<span class="signal-neutral">$1</span>');

        // Highlight Prices (e.g. $123.45)
        rawMarkdown = rawMarkdown.replace(/(\$\d{1,3}(,\d{3})*(\.\d{2})?)/g, '<span class="price-highlight">$1</span>');

        // Parse Markdown
        let formattedStr = marked.parse(rawMarkdown);

        resultDiv.innerHTML = `<div class="quant-analysis-content markdown-body">${formattedStr}</div>`;

    } catch (e) {
        console.error("Quant Analysis Error:", e);
        resultDiv.innerHTML = `<div style="color: #ef4444; padding: 10px;">Error: ${e.message}</div>`;
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('rotating');
        }
    }
}

function initForceRefreshListener() {
    const btn = document.getElementById('forceRefreshQuantBtn');
    if (btn) {
        // Clone to remove old listeners if any, or just add
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling issues
            if (currentActiveTicker) {
                runQuantAnalysis(currentActiveTicker, true);
            }
        });
    }
}

// Ensure initQuantAnalysisListener is called
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initQuantAnalysisListener();
        initForceRefreshListener(); // Init the refresh button
    });
} else {
    initQuantAnalysisListener();
    initForceRefreshListener();
}
