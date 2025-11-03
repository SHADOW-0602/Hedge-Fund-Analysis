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
            displayNews(JSON.parse(cachedNews));
            return;
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
    }

    // Fallback to sample news
    const sampleNews = [
        {
            title: "Market Volatility Continues as Fed Signals Rate Changes",
            description: "Financial markets show mixed signals as Federal Reserve hints at upcoming policy adjustments affecting portfolio strategies.",
            source: { name: "Financial Times" },
            publishedAt: new Date().toISOString(),
            url: "#"
        },
        {
            title: "Tech Stocks Rally on AI Investment Surge",
            description: "Technology sector sees significant gains as artificial intelligence investments drive market optimism and portfolio rebalancing.",
            source: { name: "Bloomberg" },
            publishedAt: new Date().toISOString(),
            url: "#"
        },
        {
            title: "Options Trading Volume Hits Record High",
            description: "Derivatives markets experience unprecedented activity as retail and institutional investors increase options strategies.",
            source: { name: "Reuters" },
            publishedAt: new Date().toISOString(),
            url: "#"
        }
    ];
    displayNews(sampleNews);
}

function displayNews(articles) {
    const newsGrid = document.getElementById('newsGrid');

    let html = '';

    if (!Array.isArray(articles)) {
        console.warn('displayNews expected an array but received:', articles);
        newsGrid.innerHTML = '<p>No news available.</p>';
        return;
    }

    articles.forEach(article => {
        try {
            const title = article && article.title ? article.title : 'Untitled';
            const description = article && article.description ? article.description : 'Market analysis and financial insights for portfolio management.';
            const url = article && article.url ? article.url : '#';
            const sourceName = article && article.source && article.source.name ? article.source.name : 'Unknown Source';

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
            }
        }
    });

    await Promise.all(imagePromises);
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

        // Load images and news
        loadImages();
        loadNews();
    });

    // Set up 6-hour news refresh interval
    setInterval(() => {
        const now = new Date();
        const hours = now.getHours();
        // Refresh at 12am, 6am, 12pm, 6pm
        if (hours % 6 === 0 && now.getMinutes() === 0) {
            localStorage.removeItem('news_cache');
            localStorage.removeItem('news_cache_time');
            loadNews();
        }
    }, 60000); // Check every minute

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