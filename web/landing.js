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
    return true; // Backend handles key
}

// Pexels API functions
async function fetchPexelsImage(query, size = 'medium') {
    try {
        // Use backend proxy to avoid CORS issues and expose API key
        // Note: The backend endpoint /api/pexels-image defaults to 'medium' size
        const url = `${API_BASE}/api/pexels-image?query=${encodeURIComponent(query)}`;

        const response = await fetch(url);

        if (!response.ok) {
            // Silently fail for 404s (image not found)
            if (response.status !== 404) {
                console.warn('Pexels Proxy responded with non-OK status:', response.status);
            }
            return '';
        }

        const data = await response.json();
        return data.image || '';

    } catch (error) {
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
            <button onclick="window.location.href='learn-more.html'" class="btn-secondary">Learn More</button>
        `;
    } else {
        // User not logged in - show start analysis button
        heroButtons.innerHTML = `
            <button onclick="window.location.href='/app'" class="btn-primary">Start Analysis</button>
            <button onclick="window.location.href='learn-more.html'" class="btn-secondary">Learn More</button>
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



// Add event listeners for Enter key
document.addEventListener('DOMContentLoaded', () => {
    // Newsletter subscription on Enter
    const newsletterEmail = document.getElementById('newsletter-email');
    if (newsletterEmail) {
        newsletterEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') subscribeNewsletter();
        });
    }


});