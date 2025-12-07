// Pexels API configuration
let PEXELS_API_KEY = '';

// Fetch API key from backend
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE}/api/config`);
        const config = await response.json();
        PEXELS_API_KEY = config.pexels_api_key || '';
    } catch (error) {
        console.warn('Failed to load config:', error);
    }
}

// Helper to check availability of the API key
function hasPexelsKey() {
    return PEXELS_API_KEY && PEXELS_API_KEY.trim().length > 0;
}

// Pexels API functions
async function fetchPexelsImage(query, size = 'medium') {
    if (!hasPexelsKey()) {
        // API key not configured; avoid attempting network call and log a warning for diagnostics
        console.warn('Pexels API key not configured; skipping image fetch for query:', query);
        return '';
    }

    try {
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&size=${encodeURIComponent(size)}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': PEXELS_API_KEY,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn('Pexels API responded with non-OK status:', response.status, response.statusText);
            return '';
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            console.warn('Pexels API returned unexpected content type:', contentType);
            return '';
        }

        const data = await response.json();
        if (!data || !Array.isArray(data.photos) || data.photos.length === 0) {
            return '';
        }

        const photoSrc = data.photos[0] && data.photos[0].src && (data.photos[0].src.medium || data.photos[0].src.original || '');
        return photoSrc || '';
    } catch (error) {
        // Catch network, parsing, and other runtime errors and return a safe fallback
        console.error('Error fetching Pexels image:', error);
        return '';
    }
}

// Helper function to decode HTML entities
function decodeHtmlEntities(text) {
    if (!text) return text;
    const div = document.createElement('div');
    div.innerHTML = text;
    return div.textContent || div.innerText || text;
}

// Load news headlines
async function loadNews() {
    const cacheKey = 'news_cache';
    const cacheTimeKey = 'news_cache_time';

    // Check if cached news is still valid (6 hours)
    const cachedTime = localStorage.getItem(cacheTimeKey);
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    if (cachedTime && new Date(cachedTime) > sixHoursAgo) {
        const cachedNews = localStorage.getItem(cacheKey);
        if (cachedNews) {
            try {
                displayNews(JSON.parse(cachedNews));
                return;
            } catch (parseError) {
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(cacheTimeKey);
            }
        }
    }

    try {
        const response = await fetch(`${API_BASE}/api/news`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();

        if (data.success && data.articles) {
            localStorage.setItem(cacheKey, JSON.stringify(data.articles));
            localStorage.setItem(cacheTimeKey, now.toISOString());
            displayNews(data.articles);
            return;
        }
        throw new Error('Invalid response format');
    } catch (error) {
        console.warn('News API failed:', error.message);
        displayNews([]);
    }
}

function displayNews(articles) {
    const newsGrid = document.getElementById('newsGrid');

    if (!newsGrid) {
        console.warn('newsGrid element not found');
        return;
    }

    let html = '';

    if (!Array.isArray(articles)) {
        console.warn('displayNews expected an array but received:', articles);
        newsGrid.innerHTML = '<p>No news available.</p>';
        return;
    }

    articles.forEach(article => {
        try {
            const title = article && article.title ? decodeHtmlEntities(article.title) : 'Untitled';
            const description = article && article.description ? decodeHtmlEntities(article.description) : 'Market analysis and financial insights for portfolio management.';
            const url = article && article.url ? article.url : '#';
            const sourceName = article && article.source && article.source.name ? decodeHtmlEntities(article.source.name) : 'Unknown Source';

            let publishedDate = '';
            if (article && article.publishedAt) {
                const parsed = new Date(article.publishedAt);
                if (!isNaN(parsed.getTime())) {
                    publishedDate = parsed.toLocaleDateString();
                }
            }

            html += `
                <div class="news-card">
                    <div class="news-meta">
                        <span class="news-source">${sourceName}</span>
                        <span class="news-date">${publishedDate}</span>
                    </div>
                    <h3 class="news-title">${title}</h3>
                    <p class="news-description">${description}</p>
                    <a href="${url}" class="news-link" target="_blank">Read More →</a>
                </div>
            `;
        } catch (err) {
            console.error('Error rendering article:', err, article);
            // skip this article on error
        }
    });

    newsGrid.innerHTML = html || '<p>No news available.</p>';
}

// Load images on page load
async function loadImages() {
    const imageElements = [
        { id: 'heroImg', query: 'financial charts trading' },
        { id: 'portfolioImg', query: 'portfolio management' },
        { id: 'riskImg', query: 'risk analysis charts' },
        { id: 'optionsImg', query: 'stock options trading' },
        { id: 'brokerImg', query: 'financial technology' },
        { id: 'transactionImg', query: 'transaction analysis' },
        { id: 'performanceImg', query: 'performance tracking' },
        { id: 'aboutImg', query: 'professional trading desk' }
    ];

    const imagePromises = imageElements.map(async ({ id, query }) => {
        try {
            const element = document.getElementById(id);
            if (element) {
                const imageUrl = await fetchPexelsImage(query);
                if (imageUrl) {
                    element.src = imageUrl;
                    element.style.opacity = '0';
                    element.onload = () => {
                        element.style.transition = 'opacity 0.5s ease';
                        element.style.opacity = '1';
                    };
                    element.onerror = () => {
                        console.debug(`Image failed to load for ${id}`);
                    };
                }
            }
        } catch (error) {
            console.debug(`Failed to load image for ${id}:`, error);
        }
    });

    try {
        await Promise.all(imagePromises);
    } catch (error) {
        console.debug('Some images failed to load:', error);
    }
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animationPlayState = 'running';
        }
    });
}, observerOptions);

// Check authentication state and update buttons
function checkAuthState() {
    if (window.SessionManager && SessionManager.isLoggedIn()) {
        const session = SessionManager.getSession();
        updateAuthButtons(session);
        updateHeroButton(session);
    }
}

// Update authentication buttons based on login state
function updateAuthButtons(user = null) {
    try {
        const authButtons = document.querySelector('.auth-buttons');
        if (!authButtons) return;
        // Clear any existing content
        authButtons.innerHTML = '';

        if (user && typeof user === 'object') {
            // Build elements using DOM methods to avoid injecting untrusted HTML
            const container = document.createElement('div');
            container.className = 'user-info-landing';

            const span = document.createElement('span');
            span.className = 'user-welcome';
            // Safely use textContent to prevent XSS
            span.textContent = `Welcome, ${String(user.username || 'User')}`;

            const dashBtn = document.createElement('button');
            dashBtn.className = 'btn-auth btn-dashboard';
            dashBtn.textContent = 'Dashboard';
            dashBtn.addEventListener('click', () => { window.location.href = '/app'; });

            const logoutBtn = document.createElement('button');
            logoutBtn.className = 'btn-auth btn-logout';
            logoutBtn.textContent = 'Logout';
            logoutBtn.addEventListener('click', () => logout());

            container.appendChild(span);
            container.appendChild(dashBtn);
            container.appendChild(logoutBtn);
            authButtons.appendChild(container);
        } else {
            // User not logged in - show signin/signup buttons
            const signin = document.createElement('button');
            signin.className = 'btn-auth btn-signin';
            signin.textContent = 'Sign In';
            signin.addEventListener('click', () => { window.location.href = '/app'; });

            const signup = document.createElement('button');
            signup.className = 'btn-auth btn-signup';
            signup.textContent = 'Sign Up';
            signup.addEventListener('click', () => { window.location.href = '/app'; });

            authButtons.appendChild(signin);
            authButtons.appendChild(signup);
        }
    } catch (err) {
        console.error('updateAuthButtons error:', err);
        // Fallback safe minimal UI
        const authButtons = document.querySelector('.auth-buttons');
        if (authButtons) {
            authButtons.innerHTML = '<button onclick="window.location.href=\'/app\'" class="btn-auth">Open App</button>';
        }
    }
}

// Update hero section button based on login state
function updateHeroButton(user = null) {
    const heroButtons = document.querySelector('.hero-buttons');
    if (!heroButtons) return;

    if (user) {
        // User is logged in - show dashboard button
        heroButtons.innerHTML = `
            <button onclick="window.location.href='/app'" class="btn-primary">Go to Dashboard</button>
            <button onclick="scrollToSection('features')" class="btn-secondary">Learn More</button>
        `;
    } else {
        // User not logged in - show start analysis button
        heroButtons.innerHTML = `
            <button onclick="window.location.href='/app'" class="btn-primary">Start Analysis</button>
            <button onclick="scrollToSection('features')" class="btn-secondary">Learn More</button>
        `;
    }
}

// Logout function for landing page
function logout() {
    if (window.SessionManager) {
        SessionManager.clearSession();
    }
    localStorage.removeItem('currentUser');
    updateAuthButtons(); // Reset to signin/signup buttons
    updateHeroButton(); // Reset hero button
    // Optionally show a logout message
    setTimeout(() => {
        alert('You have been logged out successfully.');
    }, 100);
}

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme after utils.js is loaded
    if (window.ThemeManager) {
        ThemeManager.init();
    } else {
        // Fallback theme toggle
        const themeToggle = document.getElementById('themeToggle');
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.checked = savedTheme === 'dark';

        themeToggle.addEventListener('change', () => {
            const newTheme = themeToggle.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Load config first, then initialize components
    loadConfig().then(() => {
        // Check authentication state after utils.js is loaded
        setTimeout(checkAuthState, 100);

        // Load images
        loadImages();

        // Load tickers
        loadTickers();

        // Auto-fetch missing logos after initial load
        setTimeout(() => {
            fetch(`${API_BASE}/api/fetch-logos`, { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log('Auto logo fetch:', data.message);
                        // Reload tickers to show new logos
                        setTimeout(() => loadTickers(), 1500);
                    }
                })
                .catch(error => console.debug('Auto logo fetch failed:', error));
        }, 2000);
    });



    // Observe feature cards for staggered animation
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.2}s`;
        card.style.animationFillMode = 'both';
        observer.observe(card);
    });

    // Header scroll effect
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const header = document.querySelector('.header');
        const currentScrollY = window.scrollY;

        if (currentScrollY > 100) {
            header.style.transform = currentScrollY > lastScrollY ? 'translateY(-100%)' : 'translateY(0)';
            header.style.boxShadow = 'var(--shadow)';
        } else {
            header.style.transform = 'translateY(0)';
            header.style.boxShadow = 'none';
        }

        lastScrollY = currentScrollY;
    });

    // Parallax effect for hero section
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const heroImage = document.querySelector('.hero-image img');
        if (heroImage) {
            heroImage.style.transform = `translateY(${scrolled * 0.2}px)`;
        }
    });
});

// Add loading animation
function showLoading() {
    document.body.style.overflow = 'hidden';
    const loader = document.createElement('div');
    loader.className = 'page-loader';
    loader.innerHTML = `
        <div class="loader-content">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
    `;
    document.body.appendChild(loader);

    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(loader);
            document.body.style.overflow = 'auto';
        }, 300);
    }, 1000);
}

// Add loader styles
const loaderStyles = `
    .page-loader {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--bg-primary);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        transition: opacity 0.3s ease;
    }
    
    .loader-content {
        text-align: center;
    }
    
    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid var(--border-color);
        border-top: 4px solid var(--accent-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

// Inject loader styles
const styleSheet = document.createElement('style');
styleSheet.textContent = loaderStyles;
document.head.appendChild(styleSheet);

// Show loading on page load
window.addEventListener('load', showLoading);

// Newsletter subscription function
async function subscribeNewsletter() {
    const emailInput = document.getElementById('newsletter-email');
    const message = document.getElementById('newsletter-message');
    const email = emailInput.value.trim();

    if (!email || !email.includes('@')) {
        message.textContent = 'Please enter a valid email address';
        message.className = 'message error';
        message.style.color = 'var(--error-color)';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        if (response.ok) {
            message.textContent = '🎉 Successfully subscribed! Check your inbox for daily reports.';
            message.className = 'message success';
            message.style.color = 'var(--success-color)';
            emailInput.value = '';
            setTimeout(() => {
                message.textContent = '';
                message.className = 'message';
            }, 3000);
        } else {
            let errorMsg = 'Subscription failed';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (parseError) {
                errorMsg = `HTTP ${response.status}: ${response.statusText || 'Request failed'}`;
            }
            message.textContent = errorMsg;
            message.className = 'message error';
            message.style.color = 'var(--error-color)';
        }
    } catch (error) {
        message.textContent = 'Network error. Please try again.';
        message.className = 'message error';
        message.style.color = 'var(--error-color)';
    }
}

// Add ticker function
async function addTicker() {
    const input = document.getElementById('ticker-input');
    const symbol = input.value.trim().toUpperCase();
    const message = document.getElementById('add-message');

    if (!symbol) {
        message.textContent = 'Please enter a ticker symbol';
        message.className = 'message error';
        message.style.color = 'var(--error-color)';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/tickers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: symbol })
        });

        if (response.ok) {
            message.textContent = `${symbol} added successfully!`;
            message.className = 'message success';
            message.style.color = 'var(--success-color)';
            input.value = '';
            loadTickers();
            setTimeout(() => {
                message.textContent = '';
                message.className = 'message';
            }, 3000);
        } else {
            let errorMsg = 'Failed to add ticker';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (parseError) {
                errorMsg = `HTTP ${response.status}: ${response.statusText || 'Request failed'}`;
            }
            message.textContent = errorMsg;
            message.className = 'message error';
            message.style.color = 'var(--error-color)';
        }
    } catch (error) {
        const errorMsg = error.name === 'TypeError' && error.message.includes('fetch')
            ? 'Network error. Please check your connection.'
            : 'Error adding ticker. Please try again.';
        message.textContent = errorMsg;
        message.className = 'message error';
        message.style.color = 'var(--error-color)';
        console.error('Add ticker error:', error);
    }
}

// Render stocks grid
function renderStocksGrid(tickersWithLogos) {
    const stocksGrid = document.getElementById('stocks-grid');
    if (!stocksGrid) return;

    if (!tickersWithLogos || tickersWithLogos.length === 0) {
        stocksGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">No stocks added yet. Add some tickers to get started!</p>';
        return;
    }

    stocksGrid.innerHTML = tickersWithLogos.map(ticker => `
        <div class="stock-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; text-align: center; position: relative; transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--shadow-lg)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <button class="remove-btn" onclick="removeTicker('${ticker.symbol}')" style="position: absolute; top: 8px; right: 8px; background: var(--error-color); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
            <div class="stock-logo" onclick="viewStock('${ticker.symbol}')" style="width: 60px; height: 60px; margin: 0 auto 1rem; background: var(--primary-color); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: white;">
                ${ticker.logoUrl ?
            `<img src="${ticker.logoUrl}" alt="${ticker.symbol}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;">` :
            `${ticker.symbol.charAt(0)}`
        }
            </div>
            <h4 onclick="viewStock('${ticker.symbol}')" style="color: var(--text-primary); margin: 0 0 0.5rem; font-size: 1.1rem; font-weight: 600;">${ticker.symbol}</h4>
            <p onclick="viewStock('${ticker.symbol}')" style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${ticker.company_name || 'Company Name'}</p>
        </div>
    `).join('');
}

// Load tickers from API with caching
async function loadTickers() {
    const cacheKey = 'landing_tickers_cache';
    const stocksGrid = document.getElementById('stocks-grid');

    // 1. Try to load from cache
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        try {
            const tickersWithLogos = JSON.parse(cachedData);
            // console.log('Loading tickers from cache');
            renderStocksGrid(tickersWithLogos);
        } catch (e) {
            console.warn('Error parsing cached tickers', e);
        }
    }

    try {
        const response = await fetch(`${API_BASE}/api/tickers`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const tickers = await response.json();

        if (!Array.isArray(tickers)) {
            throw new Error('Invalid response format');
        }

        if (tickers.length === 0) {
            localStorage.removeItem(cacheKey);
            renderStocksGrid([]);
            return;
        }

        // Load logos for each ticker with parallel fetching
        const logoPromises = tickers.map(async (tickerData) => {
            const symbol = typeof tickerData === 'string' ? tickerData : tickerData.symbol;
            let logoUrl = null;

            try {
                const logoResponse = await fetch(`${API_BASE}/api/logo/${symbol}`);
                if (logoResponse.status === 200) {
                    const logoData = await logoResponse.json();
                    logoUrl = logoData?.image || null;
                } else if (!logoResponse.ok) {
                    await logoResponse.text(); // Consume response
                }
            } catch (error) {
                // Silently handle logo fetch errors
            }

            return {
                symbol: symbol,
                company_name: typeof tickerData === 'object' ? tickerData.company_name : null,
                logoUrl: logoUrl
            };
        });

        const tickersWithLogos = await Promise.all(logoPromises);

        // Update cache
        localStorage.setItem(cacheKey, JSON.stringify(tickersWithLogos));

        // Render fresh data
        renderStocksGrid(tickersWithLogos);

    } catch (error) {
        console.error('Error loading tickers:', error);
        if (!cachedData) {
            document.getElementById('stocks-grid').innerHTML = `<p style="text-align: center; color: var(--error-color); grid-column: 1 / -1;">Error loading stocks: ${error.message}</p>`;
        }
    }
}

// View stock function
function viewStock(symbol) {
    window.open(`/stock/${symbol}`, '_blank');
}

// Remove ticker function
async function removeTicker(symbol) {
    if (!confirm(`Remove ${symbol} from your portfolio?`)) return;

    // Add removing animation
    const stockCards = document.querySelectorAll('.stock-card');
    const targetCard = Array.from(stockCards).find(card =>
        card.querySelector('h4').textContent === symbol
    );

    if (targetCard) {
        targetCard.style.opacity = '0.5';
        targetCard.style.transform = 'scale(0.9)';
    }

    try {
        const response = await fetch(`${API_BASE}/api/tickers/${symbol}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Wait for animation to complete before reloading
            setTimeout(() => loadTickers(), 200);
        } else {
            // Remove animation if failed
            if (targetCard) {
                targetCard.style.opacity = '1';
                targetCard.style.transform = 'scale(1)';
            }
            alert('Failed to remove ticker');
        }
    } catch (error) {
        if (targetCard) {
            targetCard.style.opacity = '1';
            targetCard.style.transform = 'scale(1)';
        }
        alert('Error removing ticker');
    }
}

// Add event listeners for Enter key
document.addEventListener('DOMContentLoaded', () => {
    // Newsletter subscription on Enter
    const newsletterEmail = document.getElementById('newsletter-email');
    if (newsletterEmail) {
        newsletterEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') subscribeNewsletter();
        });
    }

    // Add ticker on Enter
    const tickerInput = document.getElementById('ticker-input');
    if (tickerInput) {
        tickerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTicker();
        });

        // Auto-uppercase ticker input
        tickerInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    // Load tickers when page loads
    loadTickers();

    // Auto-fetch missing logos on page load
    setTimeout(() => {
        fetch(`${API_BASE}/api/fetch-logos`, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Logo fetch result:', data.message);
                    // Reload tickers to show new logos
                    setTimeout(() => loadTickers(), 2000);
                }
            })
            .catch(error => console.debug('Logo fetch failed:', error));
    }, 2000);
});