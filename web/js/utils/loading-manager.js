// Loading Manager - Prevents duplicate loading containers
class LoadingManager {
    constructor() {
        this.activeLoadings = new Set();
    }

    // Clear all loading states
    clearAll() {
        // Remove any elements containing "Loading" text
        document.querySelectorAll('*').forEach(el => {
            if (el.textContent && 
                el.textContent.includes('Loading') && 
                el.id !== 'analysisContent' &&
                el.offsetHeight > 0 && 
                el.offsetHeight < 200) {
                el.remove();
            }
        });

        // Clear the active loadings set
        this.activeLoadings.clear();
    }

    // Show loading for a specific container
    showLoading(containerId, message = 'Loading...') {
        this.clearAll(); // Clear any existing loading states first
        
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                    <p class="text-gray-600">${message}</p>
                </div>
            `;
            this.activeLoadings.add(containerId);
        }
    }

    // Clear loading for a specific container
    clearLoading(containerId) {
        this.activeLoadings.delete(containerId);
        
        // If no more active loadings, clear all
        if (this.activeLoadings.size === 0) {
            this.clearAll();
        }
    }
}

// Create global instance
window.loadingManager = new LoadingManager();

// Global functions for backward compatibility
window.showLoadingSpinner = (containerId, message) => {
    window.loadingManager.showLoading(containerId, message);
};

window.clearAllLoadingSpinners = () => {
    window.loadingManager.clearAll();
};

window.clearLoadingSpinner = (containerId) => {
    window.loadingManager.clearLoading(containerId);
};