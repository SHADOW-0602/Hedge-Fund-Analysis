// Simplified Monte Carlo - Replaces complex monte-carlo.js
window.loadMonteCarlo = function(portfolioData) {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('monte-carlo');
    }
};

// Keep existing functions for backward compatibility
window.toggleMonteCarloSettings = () => window.analyticsCore?.toggleSettings('monteCarloSettings');
window.updateMonteCarloSimulation = () => window.analyticsManager?.loadModule('monte-carlo');