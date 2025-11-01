// Pexels API configuration
const PEXELS_API_KEY = '34CszfFBJm4vjxDmWPPb56IWveFsL34P2N82eIknxrH2qWeL2Mpt9k1r';

// Theme management handled by ThemeManager from utils.js

// Smooth scrolling
function scrollToSection(sectionId) {
    document.getElementById(sectionId).scrollIntoView({
        behavior: 'smooth'
    });
}

// Pexels API functions
async function fetchPexelsImage(query, size = 'medium') {
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=1&size=${size}`, {
            headers: {
                'Authorization': PEXELS_API_KEY
            }
        });
        
        const data = await response.json();
        return data.photos[0]?.src?.medium || '';
    } catch (error) {
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
        const response = await fetch(`${API_BASE}/news`);
        const data = await response.json();
        
        if (data.success && data.articles) {
            // Cache news and timestamp
            localStorage.setItem(cacheKey, JSON.stringify(data.articles));
            localStorage.setItem(cacheTimeKey, now.toISOString());
            displayNews(data.articles);
            return;
        }
    } catch (error) {
        console.log('Using sample news');
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
    articles.forEach(article => {
        const publishedDate = new Date(article.publishedAt).toLocaleDateString();
        html += `
            <div class="news-card">
                <div class="news-meta">
                    <span class="news-source">${article.source.name}</span>
                    <span class="news-date">${publishedDate}</span>
                </div>
                <h3 class="news-title">${article.title}</h3>
                <p class="news-description">${article.description || 'Market analysis and financial insights for portfolio management.'}</p>
                <a href="${article.url}" class="news-link" target="_blank">Read More →</a>
            </div>
        `;
    });
    
    newsGrid.innerHTML = html;
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

    for (const { id, query } of imageElements) {
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
    
    // Load images and news
    loadImages();
    loadNews();
    
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