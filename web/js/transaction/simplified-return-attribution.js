// Simplified Return Attribution - Replaces complex return-attribution.js
window.loadReturnAttribution = function(transactions) {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('return-attribution');
    }
};

// Keep existing functions for backward compatibility
window.toggleReturnAttributionSettings = () => window.analyticsCore?.toggleSettings('returnAttributionSettings');
window.updateReturnAttribution = () => window.analyticsManager?.loadModule('return-attribution');