// Test backend connectivity and load sample data
async function testBackendConnection() {
    console.log('Testing backend connection...');
    
    // Test sample portfolio data
    const samplePortfolio = [
        { symbol: 'AAPL', quantity: 100, avg_cost: 150.00 },
        { symbol: 'MSFT', quantity: 50, avg_cost: 280.00 },
        { symbol: 'GOOGL', quantity: 25, avg_cost: 2500.00 },
        { symbol: 'TSLA', quantity: 30, avg_cost: 200.00 },
        { symbol: 'NVDA', quantity: 40, avg_cost: 400.00 },
        { symbol: 'AMZN', quantity: 20, avg_cost: 3000.00 },
        { symbol: 'META', quantity: 35, avg_cost: 300.00 },
        { symbol: 'NFLX', quantity: 15, avg_cost: 450.00 },
        { symbol: 'AMD', quantity: 60, avg_cost: 100.00 }
    ];
    
    try {
        // Test risk analysis endpoint
        const response = await fetch('http://127.0.0.1:8080/api/analyze-risk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                portfolio: samplePortfolio,
                options: {
                    period: '1Y',
                    var_confidence: 0.95,
                    risk_model: 'historical',
                    benchmark: 'SPY',
                    rolling_window: 252
                }
            })
        });
        
        const data = await response.json();
        console.log('Backend test result:', data);
        
        if (data.success) {
            console.log('✅ Backend is working correctly');
            
            // Load sample data into the application
            window.portfolioData = samplePortfolio;
            window.currentPortfolioData = samplePortfolio;
            localStorage.setItem('currentPortfolio', JSON.stringify(samplePortfolio));
            
            // Set analytics core data
            if (window.analyticsCore) {
                window.analyticsCore.setPortfolioData(samplePortfolio);
            }
            
            // Dispatch portfolio loaded event
            document.dispatchEvent(new CustomEvent('portfolioLoaded', {
                detail: { portfolio: samplePortfolio }
            }));
            
            console.log('✅ Sample portfolio data loaded');
            return true;
        } else {
            console.error('❌ Backend error:', data.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Backend connection failed:', error);
        return false;
    }
}

// Auto-load sample data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Page loaded, testing backend...');
    await testBackendConnection();
});

// Export for manual testing
window.testBackendConnection = testBackendConnection;