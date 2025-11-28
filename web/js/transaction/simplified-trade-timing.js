// Load the full trade timing analysis module
if (typeof window.loadTradeTimingAnalysis === 'undefined') {
    // Load the full module if not already loaded
    const script = document.createElement('script');
    script.src = '/js/transaction/trade-timing-analysis.js';
    document.head.appendChild(script);
}