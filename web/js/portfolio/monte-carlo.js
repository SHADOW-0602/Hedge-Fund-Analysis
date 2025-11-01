// Monte Carlo Simulation
function loadMonteCarlo(portfolioData) {
    const container = document.getElementById('monteCarloResults');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Running simulations...</div>';
    
    // Get current settings
    const options = {
        forecast_period: document.getElementById('forecastPeriod')?.value || '3M',
        simulations: parseInt(document.getElementById('numSimulations')?.value || '10000'),
        confidence_intervals: (document.getElementById('confidenceIntervals')?.value || '80,90,95,99')
            .split(',').map(x => parseFloat(x.trim()) / 100),
        market_regime: document.getElementById('marketRegime')?.value || 'normal',
        volatility_adjustment: parseFloat(document.getElementById('volatilityAdjustment')?.value || '0')
    };
    
    // Call API with interactive parameters
    fetch(`${API_BASE}/monte-carlo`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            portfolio: portfolioData,
            options: options
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.results) {
            const results = data.results;
            
            // Format confidence intervals display
            let confidenceDisplay = '';
            if (results.confidence_intervals) {
                const intervals = Object.entries(results.confidence_intervals);
                if (intervals.length > 0) {
                    const mainInterval = intervals.find(([key]) => key === '95%') || intervals[0];
                    const [level, range] = mainInterval;
                    confidenceDisplay = `${(range.lower * 100).toFixed(1)}% to ${(range.upper * 100).toFixed(1)}%`;
                }
            }
            
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-gray-700 dark:text-gray-300">Expected Return</span>
                        <span class="font-semibold ${results.expected_return >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${results.expected_return >= 0 ? '+' : ''}${(results.expected_return * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-700 dark:text-gray-300">Volatility</span>
                        <span class="font-semibold text-gray-900 dark:text-gray-100">
                            ${(results.volatility * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-700 dark:text-gray-300">95% Confidence Range</span>
                        <span class="font-semibold text-gray-900 dark:text-gray-100">
                            ${confidenceDisplay || 'N/A'}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-700 dark:text-gray-300">Probability of Loss</span>
                        <span class="font-semibold text-red-600 dark:text-red-400">
                            ${(results.probability_loss * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-700 dark:text-gray-300">Sharpe Ratio</span>
                        <span class="font-semibold ${results.sharpe_ratio >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${results.sharpe_ratio.toFixed(2)}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-700 dark:text-gray-300">Max Drawdown</span>
                        <span class="font-semibold text-red-600 dark:text-red-400">
                            ${(results.max_drawdown * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded mt-4">
                        <div class="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                            <div>Simulations: ${results.num_simulations?.toLocaleString() || options.simulations.toLocaleString()}</div>
                            <div>Time Horizon: ${results.time_horizon_days || 'N/A'} days</div>
                            <div>Market Regime: ${results.market_regime || options.market_regime}</div>
                            <div>Volatility Adj: ${results.volatility_adjustment !== undefined ? (results.volatility_adjustment * 100).toFixed(0) + '%' : 'N/A'}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>Unable to run Monte Carlo simulation</p>
                    <p class="text-sm mt-2">${data.error || 'Please check your portfolio data'}</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Monte Carlo simulation error:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <p>Error running Monte Carlo simulation</p>
                <p class="text-sm mt-2">Please try again later</p>
            </div>
        `;
    });
}

// Toggle Monte Carlo settings panel
function toggleMonteCarloSettings() {
    const settings = document.getElementById('monteCarloSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update Monte Carlo simulation with new parameters
function updateMonteCarloSimulation() {
    const portfolioData = window.currentPortfolioData;
    if (portfolioData && portfolioData.length > 0) {
        loadMonteCarlo(portfolioData);
    } else {
        console.warn('No portfolio data available for Monte Carlo simulation update');
    }
}

window.loadMonteCarlo = loadMonteCarlo;
window.toggleMonteCarloSettings = toggleMonteCarloSettings;
window.updateMonteCarloSimulation = updateMonteCarloSimulation;