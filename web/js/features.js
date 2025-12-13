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

// Pexels API functions
async function fetchPexelsImage(query) {
    try {
        // Use backend proxy to avoid CORS issues and expose API key
        const url = `${API_BASE}/api/pexels-image?query=${encodeURIComponent(query)}`;
        const response = await fetch(url);

        if (!response.ok) {
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

// Load images on page load
async function loadImages() {
    const imageElements = [
        { id: 'img-portfolio', query: 'financial portfolio dashboard monitor' },
        { id: 'img-risk', query: 'financial risk analysis chart graph' },
        { id: 'img-options', query: 'stock options trading screen derivatives' },
        { id: 'img-broker', query: 'fintech payment connection digital banking' },
        { id: 'img-transaction', query: 'stock market transaction history list' },
        { id: 'img-performance', query: 'stock market performance rising graph success' }
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Header (injects header and handles theme/auth)
    if (window.HeaderManager) {
        HeaderManager.init();
    }

    loadConfig().then(() => {
        loadImages();
    });
});
