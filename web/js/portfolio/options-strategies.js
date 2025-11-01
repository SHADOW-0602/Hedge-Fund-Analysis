// Options Strategies Analysis with Interactive Controls
function loadOptionsStrategies(portfolioData, options = {}) {
    const container = document.getElementById('optionsResults');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Analyzing options strategies...</div>';
    
    // Get current settings from UI
    const expiration = options.expiration || document.getElementById('optionsExpiration')?.value || '3M';
    const moneyness = options.moneyness || document.getElementById('optionsMoneyness')?.value || 'All';
    const strategy = options.strategy || document.getElementById('optionsStrategy')?.value || 'All';
    const minPremium = options.min_premium || document.getElementById('optionsMinPremium')?.value || '0.50';
    const deltaRange = options.delta_range || document.getElementById('optionsDelta')?.value || 'All';
    
    // Call API with parameters
    fetch('/api/scan-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            portfolio: portfolioData,
            options: {
                expiration: expiration,
                moneyness: moneyness,
                strategy: strategy,
                min_premium: parseFloat(minPremium),
                delta_range: deltaRange
            }
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displayOptionsResults(data.opportunities, data.summary, { expiration, moneyness, strategy, minPremium, deltaRange });
        } else {
            container.innerHTML = '<div class="text-red-600 text-center py-4">Error analyzing options strategies</div>';
        }
    })
    .catch(error => {
        console.error('Options analysis error:', error);
        container.innerHTML = '<div class="text-red-600 text-center py-4">Error analyzing options strategies</div>';
    });
}

function displayOptionsResults(opportunities, summary, settings) {
    const container = document.getElementById('optionsResults');
    
    const formatValue = (value) => {
        if (value > 1000) {
            return `$${(value / 1000).toFixed(0)}K`;
        } else if (value > 0) {
            return `$${value.toFixed(0)}`;
        } else {
            return '$0';
        }
    };
    
    const ccValue = summary?.covered_calls?.total_premium || 0;
    const ppValue = summary?.protective_puts?.total_cost || 0;
    const icValue = summary?.iron_condors?.total_premium || 0;
    const ccCount = summary?.covered_calls?.count || 0;
    const ppCount = summary?.protective_puts?.count || 0;
    const icCount = summary?.iron_condors?.count || 0;
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-green-50 p-4 rounded-lg">
                <h5 class="font-semibold text-green-800 mb-2">Covered Calls (${ccCount})</h5>
                <div class="text-2xl font-bold text-green-600">${formatValue(ccValue)}</div>
                <div class="text-sm text-green-700 mt-1">Total Premium</div>
            </div>
            <div class="bg-blue-50 p-4 rounded-lg">
                <h5 class="font-semibold text-blue-800 mb-2">Protective Puts (${ppCount})</h5>
                <div class="text-2xl font-bold text-blue-600">${formatValue(ppValue)}</div>
                <div class="text-sm text-blue-700 mt-1">Total Cost</div>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg">
                <h5 class="font-semibold text-purple-800 mb-2">Spreads (${icCount})</h5>
                <div class="text-2xl font-bold text-purple-600">${formatValue(icValue)}</div>
                <div class="text-sm text-purple-700 mt-1">Total Premium</div>
            </div>
        </div>
        <div class="mt-4 p-3 bg-gray-50 rounded-lg">
            <div class="text-xs text-gray-600">
                Filter: ${settings.strategy} | Expiration: ${settings.expiration} | Min Premium: $${settings.minPremium} | Moneyness: ${settings.moneyness}
            </div>
        </div>
    `;
}

function toggleOptionsSettings() {
    const settings = document.getElementById('optionsSettings');
    settings.classList.toggle('hidden');
}

function updateOptionsAnalysis() {
    const portfolioData = window.currentPortfolioData;
    if (!portfolioData) {
        alert('Please load portfolio data first');
        return;
    }
    loadOptionsStrategies(portfolioData);
}

window.loadOptionsStrategies = loadOptionsStrategies;
window.toggleOptionsSettings = toggleOptionsSettings;
window.updateOptionsAnalysis = updateOptionsAnalysis;