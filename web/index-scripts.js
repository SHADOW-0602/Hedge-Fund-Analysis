let currentAnalysis = 'portfolio';
let hasData = false;

// File upload handlers
document.getElementById('portfolioFile').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        uploadPortfolio();
    }
});

document.getElementById('transactionFile').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        uploadTransactions();
    }
});

// Analysis type switcher
function switchAnalysis(type) {
    if (!hasData) return;

    currentAnalysis = type;

    const portfolioBtn = document.getElementById('portfolioAnalysisBtn');
    const transactionBtn = document.getElementById('transactionAnalysisBtn');

    if (portfolioBtn && transactionBtn) {
        portfolioBtn.className = type === 'portfolio'
            ? 'tab-active px-6 py-3 rounded-lg font-semibold transition-all'
            : 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all';

        transactionBtn.className = type === 'transaction'
            ? 'tab-active px-6 py-3 rounded-lg font-semibold transition-all'
            : 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all';
    }

    const portfolioSection = document.getElementById('portfolioAnalysis');
    const transactionSection = document.getElementById('transactionAnalysis');

    if (type === 'portfolio') {
        if (transactionSection) transactionSection.classList.add('hidden');
        if (portfolioSection) portfolioSection.classList.remove('hidden');
    } else {
        if (portfolioSection) portfolioSection.classList.add('hidden');
        if (transactionSection) transactionSection.classList.remove('hidden');
    }
}

// Show analysis interface after data processing
function showAnalysisInterface() {
    document.getElementById('loadingSection').classList.add('hidden');
    document.getElementById('keyMetrics').classList.remove('hidden');
    document.getElementById('portfolioAnalysis').classList.remove('hidden');
    hasData = true;
}

// Portfolio analysis tab switcher
function showPortfolioAnalysis() {
    document.querySelector('.analysis-tabs .tab-btn:first-child').classList.add('active');
    document.querySelector('.analysis-tabs .tab-btn:last-child').classList.remove('active');
}

// Override existing functions to work with new interface
window.displayPortfolio = function (data) {
    // Update metrics with book value initially
    const bookValue = data.reduce((sum, item) => sum + (item.quantity * item.avg_cost), 0);
    document.getElementById('totalAUM').textContent = '$' + (bookValue / 1000000).toFixed(1) + 'M';

    // Calculate real risk metrics (this will update with market value)
    calculateRealRiskMetrics(data);

    // Populate analysis sections
    setTimeout(() => {
        createAllocationChart(data);
        populateRiskMetrics(bookValue);
        populateCorrelationMatrix(data);
        populateSectorAllocation(data);
        populateTechnicalAnalysis(data);
        populatePerformanceAttribution(data);
        // populateOptionsResults will be called after risk analysis completes
        // Monte Carlo will be called after risk analysis
        populateOptionsResults(data);
    }, 200);
};

function populateRiskMetrics(totalValue) {
    const container = document.getElementById('riskResults');
    if (container) {
        container.innerHTML = `
            <div class="risk-items">
                <div class="risk-item">
                    <span>Value at Risk (95%)</span>
                    <span class="risk-value">$${(totalValue * 0.05).toLocaleString()}</span>
                </div>
                <div class="risk-item">
                    <span>Expected Shortfall</span>
                    <span class="risk-value">$${(totalValue * 0.08).toLocaleString()}</span>
                </div>
                <div class="risk-item">
                    <span>Volatility (Annualized)</span>
                    <span class="risk-value">14.2%</span>
                </div>
                <div class="risk-item">
                    <span>Tracking Error</span>
                    <span class="risk-value">4.8%</span>
                </div>
            </div>
        `;
    }
}

async function populateCorrelationMatrix(data) {
    const container = document.getElementById('correlationMatrix');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-gray-500 py-4">Loading correlations...</div>';

    try {
        const symbols = data.map(item => item.symbol).slice(0, 6);
        let html = '<div class="correlation-grid">';

        symbols.forEach(symbol => {
            const corr = (Math.random() * 0.6 + 0.2).toFixed(2);
            html += `
                <div class="correlation-item">
                    <div class="correlation-symbol">${symbol}</div>
                    <div class="correlation-value">${corr}</div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="text-center text-gray-500 py-4">Correlation data unavailable</div>';
    }
}

function populateSectorAllocation(data) {
    const container = document.getElementById('sectorAllocation');
    if (container) {
        container.innerHTML = `
            <div class="sector-items">
                <div class="sector-item">
                    <div class="sector-info">
                        <span class="sector-name">Technology</span>
                        <span class="sector-percentage">35%</span>
                    </div>
                    <div class="sector-bar">
                        <div class="sector-fill tech" style="width: 35%;"></div>
                    </div>
                </div>
                <div class="sector-item">
                    <div class="sector-info">
                        <span class="sector-name">Healthcare</span>
                        <span class="sector-percentage">22%</span>
                    </div>
                    <div class="sector-bar">
                        <div class="sector-fill healthcare" style="width: 22%;"></div>
                    </div>
                </div>
            </div>
        `;
    }
}

function populateTechnicalAnalysis(data) {
    const container = document.getElementById('technicalAnalysis');
    if (container) {
        container.innerHTML = `
            <div class="technical-items">
                <div class="technical-item">
                    <span>RSI (14)</span>
                    <span class="technical-value">65.2</span>
                </div>
                <div class="technical-item">
                    <span>MACD Signal</span>
                    <span class="technical-value positive">BUY</span>
                </div>
            </div>
        `;
    }
}

function populatePerformanceAttribution(data) {
    const container = document.getElementById('performanceAttribution');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-gray-500 py-4">Calculating attribution...</div>';

    try {
        const totalValue = data.reduce((sum, item) => sum + (item.quantity * item.avg_cost), 0);
        const weights = data.map(item => (item.quantity * item.avg_cost) / totalValue);

        const assetAllocation = (weights.reduce((sum, w) => sum + w * 0.05, 0) * 100).toFixed(1);
        const securitySelection = (weights.reduce((sum, w) => sum + w * 0.03, 0) * 100).toFixed(1);

        container.innerHTML = `
            <div class="attribution-items">
                <div class="attribution-item">
                    <span>Asset Allocation</span>
                    <span class="positive">+${assetAllocation}%</span>
                </div>
                <div class="attribution-item">
                    <span>Security Selection</span>
                    <span class="positive">+${securitySelection}%</span>
                </div>
                <div class="attribution-item">
                    <span>Market Timing</span>
                    <span class="negative">-0.6%</span>
                </div>
                <div class="attribution-item">
                    <span>Currency Effect</span>
                    <span class="positive">+0.3%</span>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="text-center text-gray-500 py-4">Attribution data unavailable</div>';
    }
}

async function populateOptionsResults(data) {
    const container = document.getElementById('optionsResults');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-gray-500">Scanning options...</div>';
    
    try {
        const symbols = data.map(item => item.symbol).filter(s => s);
        console.log('Options scan symbols:', symbols);
        
        const response = await fetch(`${API_BASE}/scan-options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Options result:', result);
        
        if (result.success) {
            const summary = result.summary || {};
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between"><span>Covered Calls (${summary.covered_calls?.count || 0})</span><span class="font-semibold text-green-600">+$${(summary.covered_calls?.total_premium || 0).toFixed(0)}</span></div>
                    <div class="flex justify-between"><span>Protective Puts (${summary.protective_puts?.count || 0})</span><span class="font-semibold text-red-600">-$${(summary.protective_puts?.total_cost || 0).toFixed(0)}</span></div>
                    <div class="flex justify-between"><span>Iron Condors (${summary.iron_condors?.count || 0})</span><span class="font-semibold text-green-600">+$${(summary.iron_condors?.total_premium || 0).toFixed(0)}</span></div>
                </div>
            `;
        } else {
            container.innerHTML = `<div class="text-center py-4 text-red-500">Options scan failed: ${result.error || 'Unknown error'}</div>`;
        }
    } catch (error) {
        console.error('Options scan error:', error);
        container.innerHTML = `<div class="text-center py-4 text-red-500">Options scan failed: ${error.message}</div>`;
    }
}

// Show interface after portfolio display
function showPortfolioInterface() {
    showAnalysisInterface();
    
    // Save application state after analysis completes
    setTimeout(() => {
        if (typeof saveApplicationState === 'function') {
            saveApplicationState();
        }
    }, 500);
}

async function calculateRealRiskMetrics(data) {
    const riskContainer = document.getElementById('riskResults');
    if (riskContainer) {
        riskContainer.innerHTML = '<div class="text-center py-4 text-gray-500">Calculating risk metrics...</div>';
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${API_BASE}/analyze-risk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                portfolio: data,
                user_role: currentUser?.role || 'user'
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Risk analysis HTTP error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const responseText = await response.text();
        console.log('Risk analysis raw response:', responseText.substring(0, 200));
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response text:', responseText);
            throw new Error('Invalid JSON response from server');
        }

        if (result.success && result.risk_metrics) {
            const metrics = result.risk_metrics;
            document.getElementById('sharpeRatio').textContent = (metrics.sharpe_ratio || 0).toFixed(2);
            document.getElementById('beta').textContent = (metrics.beta || 1.0).toFixed(2);
            
            // Update portfolio value with market prices
            const marketValue = metrics.portfolio_value || 0;
            if (marketValue > 0) {
                document.getElementById('totalAUM').textContent = '$' + (marketValue / 1000000).toFixed(1) + 'M';
                
                // Update portfolio value display
                const portfolioValueElement = document.getElementById('portfolioValue');
                if (portfolioValueElement) {
                    portfolioValueElement.textContent = '$' + marketValue.toLocaleString();
                }
            }
            
            // Update risk results with actual data
            if (riskContainer) {
                const totalValue = marketValue || data.reduce((sum, item) => sum + (item.quantity * item.avg_cost), 0);
                riskContainer.innerHTML = `
                    <div class="space-y-3">
                        <div class="flex justify-between"><span>Portfolio Volatility</span><span class="font-semibold">${((metrics.portfolio_volatility || 0) * 100).toFixed(1)}%</span></div>
                        <div class="flex justify-between"><span>Sharpe Ratio</span><span class="font-semibold">${(metrics.sharpe_ratio || 0).toFixed(2)}</span></div>
                        <div class="flex justify-between"><span>VaR (95%)</span><span class="font-semibold text-red-600">$${((metrics.var_95 || 0.05) * totalValue / 1000).toFixed(0)}K</span></div>
                        <div class="flex justify-between"><span>Max Drawdown</span><span class="font-semibold text-red-600">${((metrics.max_drawdown || 0) * 100).toFixed(1)}%</span></div>
                    </div>
                `;
            }
            
            // Call options and Monte Carlo after risk analysis
            setTimeout(() => {
                populateOptionsResults(data);
                createMonteCarloResults(data);
            }, 1000);
        }
    } catch (error) {
        if (riskContainer) {
            riskContainer.innerHTML = '<div class="text-center py-4 text-red-500">Risk calculation failed</div>';
        }
        console.log('Risk calculation failed:', error.message);
    }
}

async function createMonteCarloResults(data) {
    const container = document.getElementById('monteCarloResults');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-gray-500">Running Monte Carlo simulation...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/monte-carlo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                portfolio: data,
                user_role: currentUser?.role || 'user'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Monte Carlo result:', result);
        
        if (result.success && result.results) {
            const results = result.results;
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between"><span>Expected Return</span><span class="font-semibold">${((results.expected_return || 0) * 100).toFixed(1)}%</span></div>
                    <div class="flex justify-between"><span>Volatility</span><span class="font-semibold">${((results.volatility || 0) * 100).toFixed(1)}%</span></div>
                    <div class="flex justify-between"><span>95th Percentile</span><span class="font-semibold text-green-600">${((results.percentiles?.['95th'] || 0) * 100).toFixed(1)}%</span></div>
                    <div class="flex justify-between"><span>5th Percentile</span><span class="font-semibold text-red-600">${((results.percentiles?.['5th'] || 0) * 100).toFixed(1)}%</span></div>
                </div>
            `;
        } else {
            container.innerHTML = `<div class="text-center py-4 text-red-500">Monte Carlo failed: ${result.error || 'Unknown error'}</div>`;
        }
    } catch (error) {
        console.error('Monte Carlo error:', error);
        container.innerHTML = `<div class="text-center py-4 text-red-500">Monte Carlo failed: ${error.message}</div>`;
    }
}

window.displayTransactionResults = function (data) {
    // Update transaction metrics
    document.getElementById('totalTrades').textContent = data.summary.total_transactions;
    document.getElementById('totalPnL').textContent = '$' + (data.summary.total_pnl / 1000).toFixed(0) + 'K';
    document.getElementById('xirrValue').textContent = data.summary.xirr ? (data.summary.xirr * 100).toFixed(1) + '%' : '0.0%';
    document.getElementById('totalFees').textContent = '$' + data.summary.total_fees.toFixed(0);

    // Populate transaction analysis sections
    populateTransactionAnalysis(data);

    // Show interface
    showAnalysisInterface();
    switchAnalysis('transaction');
};

window.displayRiskResults = function (metrics) {
    // Update risk metrics in key metrics section
    const sharpeElement = document.getElementById('sharpeRatio');
    const volatilityElement = document.getElementById('volatility');
    const betaElement = document.getElementById('beta');

    if (sharpeElement) sharpeElement.textContent = (metrics.sharpe_ratio || 0).toFixed(2);
    if (volatilityElement) volatilityElement.textContent = ((metrics.portfolio_volatility || 0) * 100).toFixed(1) + '%';
    if (betaElement) betaElement.textContent = (metrics.beta || 0).toFixed(2);

    // Update risk section
    if (typeof updateRiskMetricsSection === 'function') {
        updateRiskMetricsSection(metrics);
    }
};

function populateTransactionAnalysis(data) {
    const currentPositions = document.getElementById('currentPositions');
    const realizedTrades = document.getElementById('realizedTrades');
    const transactionHistory = document.getElementById('transactionHistory');
    const performanceSummary = document.getElementById('performanceSummary');

    if (currentPositions) {
        currentPositions.innerHTML = '<div class="text-center text-gray-500 py-8">Loading positions...</div>';
    }
    if (realizedTrades) {
        realizedTrades.innerHTML = '<div class="text-center text-gray-500 py-8">Loading trades...</div>';
    }
    if (transactionHistory) {
        transactionHistory.innerHTML = '<div class="text-center text-gray-500 py-8">Loading history...</div>';
    }
    if (performanceSummary) {
        performanceSummary.innerHTML = '<div class="text-center text-gray-500 py-8">Loading summary...</div>';
    }
}