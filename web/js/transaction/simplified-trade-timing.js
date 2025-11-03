// Simplified Trade Timing - Replaces complex trade-timing-analysis.js
window.loadTradeTimingAnalysis = function(transactions) {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('trade-timing');
    }
};

// Keep existing functions for backward compatibility
window.toggleTradeTimingSettings = () => window.analyticsCore?.toggleSettings('tradeTimingSettings');
window.updateTradeTimingAnalysis = () => window.analyticsManager?.loadModule('trade-timing');