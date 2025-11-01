// Performance Attribution Analysis
function loadPerformanceAttribution(portfolioData) {
    const container = document.getElementById('performanceAttribution');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Calculating attribution...</div>';
    
    // Get current settings
    const options = {
        period: document.getElementById('performancePeriod')?.value || '1Y',
        attribution_model: document.getElementById('attributionModel')?.value || 'factor',
        benchmark: document.getElementById('performanceBenchmark')?.value || 'SPY',
        currency: document.getElementById('performanceCurrency')?.value || 'USD',
        frequency: document.getElementById('performanceFrequency')?.value || 'daily'
    };
    
    // Call API with interactive parameters
    fetch('/api/performance-attribution', {
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
        if (data.success && data.attribution) {
            const attr = data.attribution;
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-gray-700 dark:text-gray-300">Asset Allocation</span>
                        <span class="font-semibold ${attr.asset_allocation >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${attr.asset_allocation >= 0 ? '+' : ''}${attr.asset_allocation.toFixed(2)}%
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-700 dark:text-gray-300">Security Selection</span>
                        <span class="font-semibold ${attr.security_selection >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${attr.security_selection >= 0 ? '+' : ''}${attr.security_selection.toFixed(2)}%
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-700 dark:text-gray-300">Market Timing</span>
                        <span class="font-semibold ${attr.market_timing >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${attr.market_timing >= 0 ? '+' : ''}${attr.market_timing.toFixed(2)}%
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-700 dark:text-gray-300">Currency Effect</span>
                        <span class="font-semibold ${attr.currency_effect >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${attr.currency_effect >= 0 ? '+' : ''}${attr.currency_effect.toFixed(2)}%
                        </span>
                    </div>
                    <div class="border-t border-gray-200 dark:border-gray-600 pt-2 mt-3">
                        <div class="flex justify-between font-bold">
                            <span class="text-gray-900 dark:text-gray-100">Active Return</span>
                            <span class="${attr.active_return >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${attr.active_return >= 0 ? '+' : ''}${attr.active_return.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    <div class="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div class="text-sm text-gray-600 space-y-1">
                            <div class="flex justify-between">
                                <span>Portfolio Return:</span>
                                <span class="font-medium">${attr.portfolio_return.toFixed(2)}%</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Benchmark Return:</span>
                                <span class="font-medium">${attr.benchmark_return.toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>Unable to calculate performance attribution</p>
                    <p class="text-sm mt-2">${data.error || 'Please check your portfolio data'}</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Performance attribution error:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <p>Error calculating performance attribution</p>
                <p class="text-sm mt-2">Please try again later</p>
            </div>
        `;
    });
}

// Toggle performance settings panel
function togglePerformanceSettings() {
    const settings = document.getElementById('performanceSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update performance attribution with new parameters
function updatePerformanceAttribution() {
    const portfolioData = window.currentPortfolioData;
    if (portfolioData && portfolioData.length > 0) {
        loadPerformanceAttribution(portfolioData);
    } else {
        console.warn('No portfolio data available for performance attribution update');
    }
}

window.loadPerformanceAttribution = loadPerformanceAttribution;
window.togglePerformanceSettings = togglePerformanceSettings;
window.updatePerformanceAttribution = updatePerformanceAttribution;