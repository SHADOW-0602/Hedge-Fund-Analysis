// Supabase connection functionality
async function connectSupabase() {
    const statusDiv = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    
    if (!currentUser || !currentUser.user_id) {
        console.log('No user logged in for Supabase connection');
        return false;
    }
    
    // Show connecting status
    if (statusDiv && statusText) {
        statusDiv.style.display = 'block';
        statusDiv.className = 'text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-800';
        statusText.textContent = 'Connecting...';
    }
    
    try {
        console.log('Testing Supabase connection...');
        
        // Test connection by trying to load user data
        const response = await fetch(`${API_BASE}/api/load-portfolios?user_id=${currentUser.user_id}`);
        const data = await response.json();
        
        if (data.success) {
            console.log('✓ Supabase connection successful');
            
            // Show connected status
            if (statusDiv && statusText) {
                statusDiv.className = 'text-sm px-3 py-1 rounded-full bg-green-100 text-green-800';
                statusText.textContent = '✓ Database Connected';
                
                // Hide after 3 seconds
                setTimeout(() => {
                    if (statusDiv) statusDiv.style.display = 'none';
                }, 3000);
            }
            
            return true;
        } else {
            throw new Error('Connection test failed');
        }
    } catch (error) {
        console.log('✗ Supabase connection failed:', error.message);
        
        // Show error status
        if (statusDiv && statusText) {
            statusDiv.className = 'text-sm px-3 py-1 rounded-full bg-red-100 text-red-800';
            statusText.textContent = '✗ Database Offline';
            
            // Hide after 5 seconds
            setTimeout(() => {
                if (statusDiv) statusDiv.style.display = 'none';
            }, 5000);
        }
        
        return false;
    }
}

// Admin panel function
function showAdminPanel() {
    if (currentUser?.role === 'admin') {
        window.location.href = 'admin.html';
    } else {
        showError('Access denied - Admin role required');
    }
}

// Check if stored results exist for current portfolio
async function checkStoredResults(portfolioData) {
    if (!currentUser?.user_id || !portfolioData) return null;
    
    try {
        const portfolioHash = btoa(JSON.stringify(portfolioData)).substring(0, 32);
        
        const response = await fetch(`${API_BASE}/api/load-analytics?user_id=${currentUser.user_id}&portfolio_hash=${portfolioHash}`);
        const data = await response.json();
        
        if (data.success && data.analytics) {
            console.log('✓ Found stored analytics for current portfolio');
            
            // Show stored results indicator
            const statusDiv = document.getElementById('connectionStatus');
            const statusText = document.getElementById('connectionText');
            if (statusDiv && statusText) {
                statusDiv.style.display = 'block';
                statusDiv.className = 'text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-800';
                statusText.textContent = '✓ Loaded Stored Results';
                
                setTimeout(() => {
                    if (statusDiv) statusDiv.style.display = 'none';
                }, 3000);
            }
            
            return data.analytics.analytics_data;
        }
    } catch (error) {
        console.log('No stored results found for current portfolio');
    }
    
    return null;
}

// Load and display stored results if available
async function loadStoredResultsForPortfolio(portfolioData) {
    const storedAnalytics = await checkStoredResults(portfolioData);
    
    if (storedAnalytics) {
        console.log('Loading stored analytics results...');
        
        // Update risk metrics if available
        if (storedAnalytics.risk_metrics) {
            updateRiskMetricsSection(storedAnalytics.risk_metrics);
            updatePortfolioMetrics(storedAnalytics.risk_metrics);
        }
        
        // Update Monte Carlo results if available
        if (storedAnalytics.monte_carlo) {
            displayCachedMonteCarloResults(storedAnalytics.monte_carlo, portfolioData);
        }
        
        // Update options results if available
        if (storedAnalytics.options_results) {
            updateOptionsSection(storedAnalytics.options_results);
        }
        
        // Load stored options results
        await loadStoredOptionsResults(portfolioData);
        
        showSuccess('Loaded stored analysis results from database');
        return true;
    }
    
    return false;
}

// Load stored options results
async function loadStoredOptionsResults(portfolioData) {
    if (!currentUser?.user_id || !portfolioData) return;
    
    try {
        const portfolioHash = btoa(JSON.stringify(portfolioData)).substring(0, 32);
        
        const response = await fetch(`${API_BASE}/api/load-options-results?user_id=${currentUser.user_id}&portfolio_hash=${portfolioHash}`);
        const data = await response.json();
        
        if (data.success && data.options_results && data.options_results.length > 0) {
            console.log('✓ Found stored options results');
            
            // Group by strategy type and show most recent
            const latestResults = {};
            data.options_results.forEach(result => {
                if (!latestResults[result.strategy_type] || 
                    new Date(result.calculated_at) > new Date(latestResults[result.strategy_type].calculated_at)) {
                    latestResults[result.strategy_type] = result;
                }
            });
            
            // Update options section with stored results
            if (latestResults.covered_calls) {
                updateOptionsSection(latestResults.covered_calls.results);
            }
        }
    } catch (error) {
        console.log('No stored options results found');
    }
}

// Make functions globally available
window.connectSupabase = connectSupabase;
window.showAdminPanel = showAdminPanel;
window.checkStoredResults = checkStoredResults;
window.loadStoredResultsForPortfolio = loadStoredResultsForPortfolio;
window.loadStoredOptionsResults = loadStoredOptionsResults;