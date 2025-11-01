// Risk Metrics Analysis with Interactive Controls
function loadRiskMetrics(portfolioData, options = {}) {
    const container = document.getElementById('riskResults');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Calculating risk metrics...</div>';
    
    // Get current settings from UI
    const period = options.period || document.getElementById('riskPeriod')?.value || '1Y';
    const varConfidence = options.var_confidence || document.getElementById('varConfidence')?.value || '95';
    const riskModel = options.risk_model || document.getElementById('riskModel')?.value || 'historical';
    const benchmark = options.benchmark || document.getElementById('riskBenchmark')?.value || 'S&P 500';
    const rollingWindow = options.rolling_window || document.getElementById('rollingWindow')?.value || '252';
    
    // Call API with parameters
    fetch(`${API_BASE}/analyze-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            portfolio: portfolioData,
            options: {
                period: period,
                var_confidence: parseInt(varConfidence),
                risk_model: riskModel,
                benchmark: benchmark,
                rolling_window: parseInt(rollingWindow)
            }
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.risk_metrics) {
            displayRiskMetrics(data.risk_metrics, { period, varConfidence, riskModel, benchmark, rollingWindow });
        } else {
            container.innerHTML = '<div class="text-red-600 text-center py-4">Error calculating risk metrics</div>';
        }
    })
    .catch(error => {
        console.error('Risk analysis error:', error);
        container.innerHTML = '<div class="text-red-600 text-center py-4">Error calculating risk metrics</div>';
    });
}

function displayRiskMetrics(metrics, settings) {
    const container = document.getElementById('riskResults');
    const varLabel = `Value at Risk (${settings.varConfidence}%)`;
    const benchmarkLabel = `Beta (vs ${settings.benchmark})`;
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-3">
                <div class="flex justify-between"><span class="text-gray-700">Portfolio Volatility</span><span class="font-semibold text-blue-600">${formatPercent(metrics.portfolio_volatility)}</span></div>
                <div class="flex justify-between"><span class="text-gray-700">${varLabel}</span><span class="font-semibold text-red-600">${formatPercent(metrics.var_95)}</span></div>
                <div class="flex justify-between"><span class="text-gray-700">Conditional VaR</span><span class="font-semibold text-red-600">${formatPercent(metrics.cvar_95)}</span></div>
                <div class="flex justify-between"><span class="text-gray-700">Sharpe Ratio</span><span class="font-semibold text-green-600">${formatNumber(metrics.sharpe_ratio)}</span></div>
                <div class="flex justify-between"><span class="text-gray-700">Sortino Ratio</span><span class="font-semibold text-green-600">${formatNumber(metrics.sortino_ratio)}</span></div>
            </div>
            <div class="space-y-3">
                <div class="flex justify-between"><span class="text-gray-700">Maximum Drawdown</span><span class="font-semibold text-red-600">${formatPercent(metrics.max_drawdown)}</span></div>
                <div class="flex justify-between"><span class="text-gray-700">${benchmarkLabel}</span><span class="font-semibold text-gray-900">${formatNumber(metrics.beta)}</span></div>
                <div class="flex justify-between"><span class="text-gray-700">Tracking Error</span><span class="font-semibold text-orange-600">${formatPercent(metrics.tracking_error)}</span></div>
                <div class="flex justify-between"><span class="text-gray-700">Average Correlation</span><span class="font-semibold text-purple-600">${formatNumber(metrics.avg_correlation)}</span></div>
                <div class="flex justify-between"><span class="text-gray-700">Risk Model</span><span class="font-semibold text-gray-600">${settings.riskModel}</span></div>
            </div>
        </div>
        <div class="mt-4 p-3 bg-gray-50 rounded-lg">
            <div class="text-xs text-gray-600">
                Analysis Period: ${settings.period} | Rolling Window: ${settings.rollingWindow} days | Confidence: ${settings.varConfidence}%
            </div>
        </div>
    `;
}

function toggleRiskSettings() {
    const settings = document.getElementById('riskSettings');
    settings.classList.toggle('hidden');
}

function updateRiskAnalysis() {
    const portfolioData = window.currentPortfolioData;
    if (!portfolioData) {
        alert('Please load portfolio data first');
        return;
    }
    loadRiskMetrics(portfolioData);
}

function formatPercent(value) {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return (value * 100).toFixed(2) + '%';
}

function formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return parseFloat(value).toFixed(2);
}

window.loadRiskMetrics = loadRiskMetrics;
window.toggleRiskSettings = toggleRiskSettings;
window.updateRiskAnalysis = updateRiskAnalysis;

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Auto-load risk metrics when portfolio data is available
    document.addEventListener('portfolioLoaded', function(event) {
        const portfolioData = event.detail.portfolio;
        if (portfolioData && portfolioData.length > 0) {
            setTimeout(() => {
                loadRiskMetrics(portfolioData);
            }, 1000);
        }
    });
});