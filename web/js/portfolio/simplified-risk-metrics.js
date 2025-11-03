// Simplified Risk Metrics - Replaces complex risk-metrics.js
window.loadRiskMetrics = function(portfolioData, options = {}) {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('risk-metrics');
    }
};

// Keep existing functions for backward compatibility
window.toggleRiskSettings = () => window.analyticsCore?.toggleSettings('riskSettings');
window.updateRiskAnalysis = () => window.analyticsManager?.loadModule('risk-metrics');