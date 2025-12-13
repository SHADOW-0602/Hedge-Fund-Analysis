// Image Configuration for Learn More Page
const techImages = {
    'img-ai': { query: 'Artificial Intelligence Technology', orientation: 'landscape', size: 'medium' },
    'img-data': { query: 'Stock Market Data Screen', orientation: 'landscape', size: 'medium' },
    'img-security': { query: 'Cyber Security Shield Lock', orientation: 'landscape', size: 'medium' }
};

// State
let pexelsKey = '';

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

// Load Configuration
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            pexelsKey = config.pexels_api_key;
        }
    } catch (error) {
        console.warn('Could not load config, images may not load');
    }
}

// Load Images from Pexels
async function loadImages() {
    for (const [id, config] of Object.entries(techImages)) {
        const imgElement = document.getElementById(id);
        if (imgElement) {
            fetchImage(config.query, imgElement);
        }
    }
}

async function fetchImage(query, imgElement) {
    try {
        // Use our backend proxy
        const response = await fetch(`${API_BASE}/api/pexels-image?query=${encodeURIComponent(query)}&orientation=landscape&size=medium`);

        if (response.ok) {
            const data = await response.json();
            if (data.imageUrl) {
                const tempImg = new Image();
                tempImg.onload = () => {
                    imgElement.src = data.imageUrl;
                    imgElement.classList.add('loaded'); // Trigger fade-in
                };
                tempImg.src = data.imageUrl;
            }
        }
    } catch (error) {
        console.warn(`Failed to load image for ${query}`, error);
        // Fallback or keep placeholder
    }
}
