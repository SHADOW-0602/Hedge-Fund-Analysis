// Portfolio Optimization
function loadPortfolioOptimization(portfolioData) {
    const container = document.getElementById('optimizationChart');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Optimizing portfolio...</div>';
    
    // Get current settings
    const options = {
        objective: document.getElementById('optimizationObjective')?.value || 'max_sharpe',
        constraint: document.getElementById('optimizationConstraints')?.value || 'long_only',
        rebalancing: document.getElementById('optimizationRebalancing')?.value || 'quarterly',
        risk_budget: document.getElementById('optimizationRiskBudget')?.value || 'equal',
        lookback_period: document.getElementById('optimizationLookback')?.value || '1Y'
    };
    
    // Call API with interactive parameters
    fetch(`${API_BASE}/portfolio-optimization`, {
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
        if (data.success && data.optimization) {
            const opt = data.optimization;
            displayOptimizationResults(opt, container);
        } else {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>Unable to optimize portfolio</p>
                    <p class="text-sm mt-2">${data.error || 'Please check your portfolio data'}</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Portfolio optimization error:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <p>Error optimizing portfolio</p>
                <p class="text-sm mt-2">Please try again later</p>
            </div>
        `;
    });
}

function displayOptimizationResults(optimization, container) {
    const optimal = optimization.optimal_portfolio || {};
    const riskParity = optimization.risk_parity || {};
    const equalWeight = optimization.equal_weight || {};
    const params = optimization.optimization_params || {};
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Optimization Summary -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-blue-900 mb-2">Optimal Portfolio</h4>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span>Expected Return:</span>
                            <span class="font-medium">${(optimal.expected_return * 100).toFixed(1)}%</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Volatility:</span>
                            <span class="font-medium">${(optimal.volatility * 100).toFixed(1)}%</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Sharpe Ratio:</span>
                            <span class="font-medium">${optimal.sharpe_ratio.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-green-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-green-900 mb-2">Risk Parity</h4>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span>Expected Return:</span>
                            <span class="font-medium">${(riskParity.expected_return * 100).toFixed(1)}%</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Volatility:</span>
                            <span class="font-medium">${(riskParity.volatility * 100).toFixed(1)}%</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Sharpe Ratio:</span>
                            <span class="font-medium">${riskParity.sharpe_ratio.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-gray-900 mb-2">Equal Weight</h4>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span>Expected Return:</span>
                            <span class="font-medium">${(equalWeight.expected_return * 100).toFixed(1)}%</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Volatility:</span>
                            <span class="font-medium">${(equalWeight.volatility * 100).toFixed(1)}%</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Sharpe Ratio:</span>
                            <span class="font-medium">${equalWeight.sharpe_ratio.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Optimal Weights -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">Optimal Asset Allocation</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    ${Object.entries(optimal.weights || {}).map(([symbol, weight]) => `
                        <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span class="font-medium text-sm">${symbol}</span>
                            <span class="text-sm">${(weight * 100).toFixed(1)}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Optimization Parameters -->
            <div class="bg-gray-50 p-3 rounded-lg">
                <div class="text-xs text-gray-600 space-y-1">
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div><strong>Objective:</strong> ${params.objective || 'N/A'}</div>
                        <div><strong>Constraints:</strong> ${params.constraint || 'N/A'}</div>
                        <div><strong>Rebalancing:</strong> ${params.rebalancing || 'N/A'}</div>
                        <div><strong>Risk Budget:</strong> ${params.risk_budget || 'N/A'}</div>
                        <div><strong>Lookback:</strong> ${params.lookback_period || 'N/A'}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Toggle optimization settings panel
function toggleOptimizationSettings() {
    const settings = document.getElementById('optimizationSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update portfolio optimization with new parameters
function updatePortfolioOptimization() {
    const portfolioData = window.currentPortfolioData;
    if (portfolioData && portfolioData.length > 0) {
        loadPortfolioOptimization(portfolioData);
    } else {
        console.warn('No portfolio data available for optimization update');
    }
}

window.loadPortfolioOptimization = loadPortfolioOptimization;
window.toggleOptimizationSettings = toggleOptimizationSettings;
window.updatePortfolioOptimization = updatePortfolioOptimization;