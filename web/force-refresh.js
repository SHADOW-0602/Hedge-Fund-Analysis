// Force refresh analytics - enhanced analytics removed
console.log('Analytics refresh script loaded');

// Clear any cached data
if (typeof Storage !== "undefined") {
    localStorage.removeItem('enhancedAnalyticsCache');
    localStorage.removeItem('cachedRiskMetrics');
    localStorage.removeItem('cachedPortfolioData');
}

// Force refresh regular analytics when portfolio loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, analytics refresh ready');
    
    // Listen for portfolio updates
    document.addEventListener('portfolioLoaded', function(event) {
        console.log('Portfolio loaded, refreshing analytics');
        if (window.loadAllRealAnalytics && event.detail.portfolio) {
            window.loadAllRealAnalytics(event.detail.portfolio, { nocache: true });
        }
    });
});

// Add debug info
window.debugAnalytics = function() {
    console.log('Analytics Debug:');
    console.log('- loadAllRealAnalytics:', !!window.loadAllRealAnalytics);
    console.log('- Portfolio data:', !!window.portfolioData);
    console.log('- Risk results:', !!document.getElementById('riskResults'));
    console.log('- Options results:', !!document.getElementById('optionsResults'));
    console.log('- Monte Carlo results:', !!document.getElementById('monteCarloResults'));
    console.log('- Correlation results:', !!document.getElementById('correlationResults'));
};