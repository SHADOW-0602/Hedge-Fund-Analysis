// Core application initialization and global variables
var currentUser = null;
var portfolioData = null;
var userPortfolios = [];
var userTransactions = []; // Adding this explicitly
var isServerMode = true;

// API base URL
const API_BASE = `${window.location.origin}`;

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, initializing app...');

    // Theme toggle setup
    initThemeToggle();

    // Mobile optimizations
    initializeMobileOptimizations();
    initializeApp();
    setupEventListeners();
});

function initThemeToggle() {
    console.log('Initializing theme toggle...');

    const themeToggleMobile = document.getElementById('themeToggleMobile');
    const themeToggleDesktop = document.getElementById('themeToggleDesktop');

    console.log('Theme toggles found:', {
        mobile: !!themeToggleMobile,
        desktop: !!themeToggleDesktop
    });

    const savedTheme = localStorage.getItem('theme') || 'light';
    console.log('Saved theme:', savedTheme);

    document.documentElement.setAttribute('data-theme', savedTheme);

    // Set initial state for both toggles
    if (themeToggleMobile) themeToggleMobile.checked = savedTheme === 'dark';
    if (themeToggleDesktop) themeToggleDesktop.checked = savedTheme === 'dark';

    // Add event listeners for both toggles
    [themeToggleMobile, themeToggleDesktop].forEach(toggle => {
        if (toggle) {
            toggle.addEventListener('change', () => {
                const newTheme = toggle.checked ? 'dark' : 'light';
                console.log('Theme changed to:', newTheme);

                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);

                // Sync both toggles
                if (themeToggleMobile) themeToggleMobile.checked = newTheme === 'dark';
                if (themeToggleDesktop) themeToggleDesktop.checked = newTheme === 'dark';
            });
        }
    });
}

function setupEventListeners() {
    // File upload listeners
    const portfolioFileInput = document.getElementById('portfolioFile');
    const transactionFileInput = document.getElementById('transactionFile');

    if (portfolioFileInput) {
        portfolioFileInput.addEventListener('change', function (e) {
            if (e.target.files[0]) uploadPortfolio();
        });
    }

    if (transactionFileInput) {
        transactionFileInput.addEventListener('change', function (e) {
            if (e.target.files[0]) uploadTransactions();
        });
    }

    // Transaction select listener
    const transactionSelect = document.getElementById('transactionFileSelect');
    if (transactionSelect) {
        transactionSelect.addEventListener('change', toggleTransactionDelete);
    }

    // Button listeners
    setTimeout(() => {
        const viewTransactionBtn = document.querySelector('[onclick="viewSelectedTransactions()"]');
        if (viewTransactionBtn) {
            viewTransactionBtn.addEventListener('click', function (e) {
                e.preventDefault();
                viewSelectedTransactions();
            });
        }

        const plaidBtn = document.querySelector('[onclick="connectPlaid()"]');
        if (plaidBtn) {
            plaidBtn.addEventListener('click', function (e) {
                e.preventDefault();
                connectPlaid();
            });
        }
    }, 500);
}

function initializeMobileOptimizations() {
    // Mobile viewport fix
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }

    // Prevent zoom on input focus for iOS
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        document.addEventListener('focusin', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                e.target.style.fontSize = '16px';
            }
        });
    }

    // Touch feedback
    document.addEventListener('touchstart', function (e) {
        if (e.target.classList.contains('btn-primary') ||
            e.target.classList.contains('btn-secondary') ||
            e.target.classList.contains('tab-btn')) {
            e.target.style.opacity = '0.7';
        }
    });

    document.addEventListener('touchend', function (e) {
        if (e.target.classList.contains('btn-primary') ||
            e.target.classList.contains('btn-secondary') ||
            e.target.classList.contains('tab-btn')) {
            setTimeout(() => e.target.style.opacity = '1', 150);
        }
    });

    // Handle orientation changes
    window.addEventListener('orientationchange', function () {
        setTimeout(() => {
            document.body.style.height = window.innerHeight + 'px';
            setTimeout(() => document.body.style.height = 'auto', 100);
        }, 500);
    });

    if ('ontouchstart' in window) {
        document.body.style.webkitOverflowScrolling = 'touch';
    }
}

async function initializeApp() {
    if (!window.SessionManager || !SessionManager.isLoggedIn()) {
        window.location.href = 'auth.html';
        return;
    }

    currentUser = SessionManager.getSession();

    // Sync to localStorage if missing (e.g. after Google Login)
    if (currentUser && !localStorage.getItem('currentUser')) {
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }

    window.currentUser = currentUser; // Make sure it's globally available
    console.log('[APP] Current user set:', currentUser);

    await checkServerMode();
    connectSupabaseAndLoadData();
    restoreApplicationState();
    showMainApp();

    // Trigger Plaid auto-connect after user is set
    if (window.autoConnectPlaid) {
        window.autoConnectPlaid();
    }
}

async function checkServerMode() {
    // Application is now server-only
    isServerMode = true;
    updateModeIndicator();
}

function updateModeIndicator() {
    // Remove any existing mode indicator
    const indicator = document.getElementById('modeIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Listen for mode changes from admin panel
window.addEventListener('storage', function (e) {
    if (e.key === 'serverMode' || e.key === 'modeChangeEvent') {
        checkServerMode();
    }
});

function showMainApp() {
    const userInfo = document.getElementById('userInfo');
    if (userInfo) userInfo.style.display = 'flex';

    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn && currentUser?.role === 'admin') {
        adminBtn.style.display = 'inline-block';
    }

    // Add Welcome Message
    if (currentUser?.username && userInfo) {
        // Check if welcome message already exists to avoid duplicates
        if (!userInfo.querySelector('.user-welcome-msg')) {
            const welcomeSpan = document.createElement('span');
            welcomeSpan.className = 'user-welcome-msg';
            welcomeSpan.style.marginRight = '12px';
            welcomeSpan.style.color = 'var(--text-primary)';
            welcomeSpan.style.fontWeight = '500';
            welcomeSpan.style.fontSize = '0.9rem';
            welcomeSpan.textContent = `Welcome, ${currentUser.username}`;

            // Insert at the beginning of userInfo
            userInfo.insertBefore(welcomeSpan, userInfo.firstChild);
        }
    }

    loadUserPortfolios();
    loadUserTransactions();
}

// Export global functions and variables
function updateGlobalUser(user) {
    currentUser = user;
    window.currentUser = user;
    console.log('[APP] Global user updated:', user);
}

window.currentUser = currentUser;
window.portfolioData = portfolioData;
window.API_BASE = API_BASE;
window.isServerMode = isServerMode;
window.checkServerMode = checkServerMode;
window.updateGlobalUser = updateGlobalUser;