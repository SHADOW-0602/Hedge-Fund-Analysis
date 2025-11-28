// Trade Timing Analysis Loader - ensures module is available
(function() {
    // Check if trade timing analysis is already loaded
    if (typeof window.loadTradeTimingAnalysis !== 'undefined') {
        return;
    }

    // Load the trade timing analysis module
    const script = document.createElement('script');
    script.src = '/js/transaction/trade-timing-analysis.js';
    script.onload = function() {
        console.log('Trade timing analysis module loaded');
    };
    script.onerror = function() {
        console.error('Failed to load trade timing analysis module');
    };
    document.head.appendChild(script);
})();