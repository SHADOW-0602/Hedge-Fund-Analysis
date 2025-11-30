// Simplified Return Attribution - Uses real API data
window.loadReturnAttribution = function(transactions, containerId = 'returnAttribution') {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('return-attribution');
    }
};

// Keep existing functions for backward compatibility
window.toggleReturnAttributionSettings = () => {
    const settings = document.getElementById('returnAttributionSettings');
    if (settings) settings.classList.toggle('hidden');
};

window.updateReturnAttribution = () => {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('return-attribution');
    }
};

window.refreshReturnAttribution = () => {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('return-attribution');
    }
};