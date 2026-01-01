// Trade Timing Analysis Module
window.loadTradeTimingAnalysis = function (transactions, options = {}) {
    console.log('Loading trade timing analysis with', transactions?.length || 0, 'transactions');

    const container = document.getElementById('analysisContent');

    if (!transactions || transactions.length === 0) {
        console.log('No transactions available for trade timing analysis');
        if (container && !options.background) {
            container.innerHTML = `
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Trade Timing Analysis</h2>
                </div>
                <div class="text-center py-4 text-yellow-500">No transactions available for trade timing analysis</div>
            `;
            container.classList.remove('hidden');
        }
        return;
    }

    // Show container and loading state (only if not background)
    if (container && !options.background) {
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Trade Timing Analysis</h2>
            </div>
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p class="text-gray-600 dark:text-gray-400">Analyzing trade timing patterns...</p>
            </div>
        `;
    }

    // Get current settings or use defaults
    const settings = window.getTradeTimingSettings();

    // Make API call
    const API_BASE = window.API_BASE || 'http://127.0.0.1:8080';
    fetch(`${API_BASE}/api/trade-timing-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            transactions: transactions,
            options: settings
        })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Trade timing analysis response:', data);
            if (data.success) {
                if (!options.background) {
                    displayTradeTimingResults(data.trade_timing_analysis, settings);
                } else {
                    console.log('[Trade Timing] Background analysis complete');
                }
            } else {
                throw new Error(data.error || 'Analysis failed');
            }
        })
        .catch(error => {
            console.error('Trade timing analysis error:', error);
            if (container && !options.background) {
                container.innerHTML = `
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Trade Timing Analysis</h2>
                </div>
                <div class="text-center py-8 text-red-600">
                    <p class="font-semibold">Analysis Failed</p>
                    <p class="text-sm mt-2">${error.message}</p>
                </div>
            `;
            }
        });
};

window.getTradeTimingSettings = function () {
    // Get from stored settings or form elements
    let stored = window.tradeTimingStoredSettings;

    // If not in memory, check localStorage
    if (!stored) {
        try {
            const saved = localStorage.getItem('tradeTimingSettings');
            if (saved) {
                stored = JSON.parse(saved);
                window.tradeTimingStoredSettings = stored;
            }
        } catch (e) {
            console.error('Failed to load trade timing settings:', e);
        }
    }

    stored = stored || {};

    return {
        period: document.getElementById('tradeTimingPeriod')?.value || stored.period || '1Y',
        timeBuckets: document.getElementById('tradeTimingTimeBuckets')?.value || stored.timeBuckets || 'All',
        dayAnalysis: 'All',
        marketConditions: document.getElementById('tradeTimingMarketConditions')?.value || stored.marketConditions || 'All',
        performanceView: document.getElementById('tradeTimingPerformanceView')?.value || stored.performanceView || 'Combined'
    };
};

function displayTradeTimingResults(result, options) {
    const container = document.getElementById('analysisContent');
    if (!container) return;

    const timeBuckets = result.time_bucket_performance || {};
    const dayPerformance = result.day_performance || {};

    // Ensure proper weekday ordering
    const orderedDayPerformance = {};
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
        if (dayPerformance[day]) {
            orderedDayPerformance[day] = dayPerformance[day];
        }
    });
    const marketConditions = result.market_condition_performance || {};
    const combined = result.combined_performance || {};
    const summary = result.summary || {};
    const parameters = result.parameters || {};

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-primary">Trade Timing Analysis</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleTradeTimingSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    Settings
                </button>
                <button onclick="updateTradeTimingAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Refresh
                </button>
            </div>
        </div>

        <!-- Settings Panel -->
        <div id="tradeTimingSettings" class="settings-panel hidden mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-secondary mb-1">Period</label>
                    <select id="tradeTimingPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTradeTimingAnalysis()">
                        <option value="1M" ${(options.period || window.tradeTimingStoredSettings?.period) === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${(options.period || window.tradeTimingStoredSettings?.period) === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${(options.period || window.tradeTimingStoredSettings?.period) === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${(options.period || window.tradeTimingStoredSettings?.period || '1Y') === '1Y' ? 'selected' : ''}>1 Year</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-secondary mb-1">Time Buckets</label>
                    <select id="tradeTimingTimeBuckets" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTradeTimingAnalysis()">
                        <option value="All" ${(options.timeBuckets || window.tradeTimingStoredSettings?.timeBuckets || 'All') === 'All' ? 'selected' : ''}>All</option>
                        <option value="Market Open" ${(options.timeBuckets || window.tradeTimingStoredSettings?.timeBuckets) === 'Market Open' ? 'selected' : ''}>Market Open</option>
                        <option value="Mid-day" ${(options.timeBuckets || window.tradeTimingStoredSettings?.timeBuckets) === 'Mid-day' ? 'selected' : ''}>Mid-day</option>
                        <option value="Close" ${(options.timeBuckets || window.tradeTimingStoredSettings?.timeBuckets) === 'Close' ? 'selected' : ''}>Close</option>
                        <option value="After-hours" ${(options.timeBuckets || window.tradeTimingStoredSettings?.timeBuckets) === 'After-hours' ? 'selected' : ''}>After-hours</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-secondary mb-1">Market Conditions</label>
                    <select id="tradeTimingMarketConditions" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTradeTimingAnalysis()">
                        <option value="All" ${(options.marketConditions || window.tradeTimingStoredSettings?.marketConditions || 'All') === 'All' ? 'selected' : ''}>All</option>
                        <option value="Up days" ${(options.marketConditions || window.tradeTimingStoredSettings?.marketConditions) === 'Up days' ? 'selected' : ''}>Up Days</option>
                        <option value="Down days" ${(options.marketConditions || window.tradeTimingStoredSettings?.marketConditions) === 'Down days' ? 'selected' : ''}>Down Days</option>
                        <option value="Volatile days" ${(options.marketConditions || window.tradeTimingStoredSettings?.marketConditions) === 'Volatile days' ? 'selected' : ''}>Volatile Days</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-secondary mb-1">Performance View</label>
                    <select id="tradeTimingPerformanceView" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTradeTimingAnalysis()">
                        <option value="Combined" ${(options.performanceView || window.tradeTimingStoredSettings?.performanceView || 'Combined') === 'Combined' ? 'selected' : ''}>Combined</option>
                        <option value="By time" ${(options.performanceView || window.tradeTimingStoredSettings?.performanceView) === 'By time' ? 'selected' : ''}>By Time</option>
                        <option value="By day" ${(options.performanceView || window.tradeTimingStoredSettings?.performanceView) === 'By day' ? 'selected' : ''}>By Day</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="space-y-6">
            <!-- Summary Stats -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="analysis-card p-4 dark:bg-gray-800">
                    <h4 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Total Trades</h4>
                    <p class="text-2xl font-bold metric-value neutral">${summary.total_trades || 0}</p>
                </div>
                <div class="analysis-card p-4 dark:bg-gray-800">
                    <h4 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Most Active Time</h4>
                    <p class="text-2xl font-bold metric-value neutral">${summary.most_active_time || 'N/A'}</p>
                </div>
                <div class="analysis-card p-4 dark:bg-gray-800">
                    <h4 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Most Active Day</h4>
                    <p class="text-2xl font-bold metric-value neutral">${summary.most_active_day || 'N/A'}</p>
                </div>
                <div class="analysis-card p-4 dark:bg-gray-800">
                    <h4 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Buy/Sell Ratio</h4>
                    <p class="text-2xl font-bold metric-value neutral">${summary.buy_sell_ratio ? summary.buy_sell_ratio.toFixed(2) : 'N/A'}</p>
                </div>
            </div>

            <!-- Time Bucket Performance -->
            ${Object.keys(timeBuckets).length > 0 ? `
                <div class="analysis-card p-6 dark:bg-gray-800">
                    <h4 class="text-lg font-bold text-primary mb-4">Time Bucket Performance</h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Time Bucket</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Trade Count</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Total Value</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Avg Trade Size</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Buy/Sell</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Performance</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-primary">
                                ${Object.entries(timeBuckets).map(([bucket, data]) => `
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${bucket}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">${data.trade_count}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-green-500">${window.analyticsCore.formatCurrency(data.total_value)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">${window.analyticsCore.formatCurrency(data.avg_trade_size)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">${data.buy_trades}/${data.sell_trades}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-indigo-500">${data.performance_score.toFixed(1)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}

            <!-- Day of Week Performance -->
            ${Object.keys(dayPerformance).length > 0 ? `
                <div class="analysis-card p-6 dark:bg-gray-800">
                    <h4 class="text-lg font-bold text-primary mb-4">Day of Week Performance</h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Day</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Trade Count</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Total Value</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Avg Trade Size</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Buy/Sell</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Performance</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-primary">
                                ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                .filter(day => dayPerformance[day])
                .map(day => {
                    const data = dayPerformance[day];
                    return `
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${day}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">${data.trade_count}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-green-500">${window.analyticsCore.formatCurrency(data.total_value)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">${window.analyticsCore.formatCurrency(data.avg_trade_size)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">${data.buy_trades}/${data.sell_trades}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-indigo-500">${data.performance_score.toFixed(1)}</td>
                                    </tr>
                                `;
                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}

            <!-- Market Conditions Performance -->
            ${Object.keys(marketConditions).length > 0 ? `
                <div class="analysis-card p-6 dark:bg-gray-800">
                    <h4 class="text-lg font-bold text-primary mb-4">Market Conditions Performance</h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Condition</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Trade Count</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Total Value</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Avg Market Return</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase">Performance</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 text-primary">
                                ${Object.entries(marketConditions).map(([condition, data]) => `
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${condition}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">${data.trade_count}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-green-500">${window.analyticsCore.formatCurrency(data.total_value)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm ${data.avg_market_return > 0 ? 'text-green-500' : 'text-red-500'}">${window.analyticsCore.formatPercent(data.avg_market_return)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-indigo-500">${data.performance_score.toFixed(1)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}

            <!-- Analysis Parameters -->
            <div class="analysis-card p-6 dark:bg-gray-800">
                <h4 class="text-sm font-semibold text-primary mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span class="text-secondary">Period:</span> <span class="font-medium text-primary">${parameters.period || 'N/A'}</span></div>
                    <div><span class="text-secondary">Time Buckets:</span> <span class="font-medium text-primary">${parameters.time_buckets || 'N/A'}</span></div>
                    <div><span class="text-secondary">Market Conditions:</span> <span class="font-medium text-primary">${parameters.market_conditions || 'N/A'}</span></div>
                    <div><span class="text-secondary">Performance View:</span> <span class="font-medium text-primary">${parameters.performance_view || 'N/A'}</span></div>
                </div>
            </div>
        </div>
    `;
}

// Settings functions
window.toggleTradeTimingSettings = () => {
    const settings = document.getElementById('tradeTimingSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateTradeTimingAnalysis = () => {
    // Store current settings
    const settings = {
        period: document.getElementById('tradeTimingPeriod')?.value || '1Y',
        timeBuckets: document.getElementById('tradeTimingTimeBuckets')?.value || 'All',
        marketConditions: document.getElementById('tradeTimingMarketConditions')?.value || 'All',
        performanceView: document.getElementById('tradeTimingPerformanceView')?.value || 'Combined'
    };

    window.tradeTimingStoredSettings = settings;

    // Save to localStorage
    try {
        localStorage.setItem('tradeTimingSettings', JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save trade timing settings:', e);
    }

    const transactions = window.currentTransactions || [];
    if (transactions.length === 0) {
        console.log('No transactions available for update');
        return;
    }
    window.loadTradeTimingAnalysis(transactions);
};