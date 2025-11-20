// Trade Performance Analysis Module - Matches P&L Attribution UI Style
let currentTradeOptions = {
    period: '1Y',
    tradeSize: 'All',
    metric: 'P&L',
    ranking: 'Best 5',
    type: 'All'
};

async function loadTradePerformance(transactions) {
    console.log('[TRADE-PERFORMANCE] Loading with transactions:', transactions?.length);

    const container = document.getElementById('tradePerformance');
    if (!container) {
        console.error('tradePerformance container not found');
        return;
    }

    if (typeof API_BASE === 'undefined') {
        window.API_BASE = window.location.origin;
    }

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-yellow-500">No transactions available for trade performance analysis</div>';
        return;
    }

    // Store transactions globally
    window.currentTradeTransactions = transactions;

    // Initial load
    await fetchTradeData();
}

function updateTradeOptions() {
    currentTradeOptions = {
        period: document.getElementById('tradePeriod')?.value || '1Y',
        tradeSize: document.getElementById('tradeSize')?.value || 'All',
        metric: document.getElementById('tradeMetric')?.value || 'P&L',
        ranking: document.getElementById('tradeRanking')?.value || 'Best 5',
        type: document.getElementById('tradeType')?.value || 'All'
    };
}

async function fetchTradeData() {
    const container = document.getElementById('tradePerformance');
    if (!container) return;

    // Preserve settings state if they exist
    const settingsPanel = document.getElementById('tradeSettings');
    const settingsHidden = settingsPanel ? settingsPanel.classList.contains('hidden') : true;

    // Show loading state with full UI
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Trade Performance</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleTradeSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    Settings
                </button>
                <button class="bg-indigo-600 text-white px-3 py-1 rounded-lg transition-colors text-sm flex items-center opacity-50 cursor-not-allowed" disabled>
                    <svg class="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Analyzing...
                </button>
            </div>
        </div>
        
        <!-- Trade Settings Panel -->
        <div id="tradeSettings" class="settings-panel ${settingsHidden ? 'hidden' : ''} mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Analysis Period</label>
                    <select id="tradePeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTradePerformance()">
                        <option value="1M" ${currentTradeOptions.period === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${currentTradeOptions.period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentTradeOptions.period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentTradeOptions.period === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="All Time" ${currentTradeOptions.period === 'All Time' ? 'selected' : ''}>All Time</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Trade Size</label>
                    <select id="tradeSize" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTradePerformance()">
                        <option value="All" ${currentTradeOptions.tradeSize === 'All' ? 'selected' : ''}>All</option>
                        <option value="<$1K" ${currentTradeOptions.tradeSize === '<$1K' ? 'selected' : ''}>&lt;$1K</option>
                        <option value="$1K-$10K" ${currentTradeOptions.tradeSize === '$1K-$10K' ? 'selected' : ''}>$1K-$10K</option>
                        <option value="$10K-$100K" ${currentTradeOptions.tradeSize === '$10K-$100K' ? 'selected' : ''}>$10K-$100K</option>
                        <option value=">$100K" ${currentTradeOptions.tradeSize === '>$100K' ? 'selected' : ''}>&gt;$100K</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Performance Metric</label>
                    <select id="tradeMetric" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTradePerformance()">
                        <option value="P&L" ${currentTradeOptions.metric === 'P&L' ? 'selected' : ''}>P&L</option>
                        <option value="%" ${currentTradeOptions.metric === '%' ? 'selected' : ''}>% Return</option>
                        <option value="Sharpe" ${currentTradeOptions.metric === 'Sharpe' ? 'selected' : ''}>Sharpe</option>
                        <option value="Win Rate" ${currentTradeOptions.metric === 'Win Rate' ? 'selected' : ''}>Win Rate</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Ranking</label>
                    <select id="tradeRanking" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTradePerformance()">
                        <option value="Best 5" ${currentTradeOptions.ranking === 'Best 5' ? 'selected' : ''}>Best 5 trades</option>
                        <option value="Best 10" ${currentTradeOptions.ranking === 'Best 10' ? 'selected' : ''}>Best 10 trades</option>
                        <option value="Best 20" ${currentTradeOptions.ranking === 'Best 20' ? 'selected' : ''}>Best 20 trades</option>
                        <option value="Worst 5" ${currentTradeOptions.ranking === 'Worst 5' ? 'selected' : ''}>Worst 5 trades</option>
                        <option value="Worst 10" ${currentTradeOptions.ranking === 'Worst 10' ? 'selected' : ''}>Worst 10 trades</option>
                        <option value="Worst 20" ${currentTradeOptions.ranking === 'Worst 20' ? 'selected' : ''}>Worst 20 trades</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Filter</label>
                    <select id="tradeType" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTradePerformance()">
                        <option value="All" ${currentTradeOptions.type === 'All' ? 'selected' : ''}>All</option>
                        <option value="Profitable" ${currentTradeOptions.type === 'Profitable' ? 'selected' : ''}>Profitable</option>
                        <option value="Loss-making" ${currentTradeOptions.type === 'Loss-making' ? 'selected' : ''}>Loss-making</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div id="tradeContent" class="bg-white rounded-lg shadow p-12 text-center">
            <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Processing Your Data</h3>
            <p class="text-gray-600 mb-4">Analyzing ${window.currentTradeTransactions?.length || 0} transactions...</p>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
            </div>
            <p class="text-sm text-gray-500">This may take a few moments</p>
        </div>
    `;

    try {
        console.log('[TRADE-PERFORMANCE] Making API call with options:', currentTradeOptions);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${API_BASE}/api/trade-performance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactions: window.currentTradeTransactions,
                options: currentTradeOptions
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        console.log('[TRADE-PERFORMANCE] API response:', data);

        if (data.success && data.trade_performance) {
            displayResults(data.trade_performance);
        } else {
            showError(data.error || 'No valid trade data found');
        }
    } catch (error) {
        console.error('[TRADE-PERFORMANCE] Error:', error);
        showError(error.name === 'AbortError' ? 'Request timeout' : error.message);
    }
}

function displayResults(data) {
    const contentDiv = document.getElementById('tradeContent');
    if (!contentDiv) return;

    const trades = data.ranked_trades || [];
    const winRate = (data.win_rate * 100).toFixed(1);
    const totalPnl = data.total_pnl || 0;
    const profitFactor = data.profit_factor ? data.profit_factor.toFixed(2) : '0.00';

    contentDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Win Rate</h3>
                <p class="text-3xl font-bold ${data.win_rate >= 0.5 ? 'text-green-600' : 'text-red-600'}">
                    ${winRate}%
                </p>
                <p class="text-sm text-gray-600 mt-1">Success ratio</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Total P&L</h3>
                <p class="text-3xl font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-600 mt-1">Net profit/loss</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Profit Factor</h3>
                <p class="text-3xl font-bold ${data.profit_factor >= 1.5 ? 'text-green-600' : data.profit_factor >= 1 ? 'text-yellow-600' : 'text-red-600'}">
                    ${profitFactor}
                </p>
                <p class="text-sm text-gray-600 mt-1">Gross Profit / Gross Loss</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Total Trades</h3>
                <p class="text-3xl font-bold text-gray-900">
                    ${data.total_trades}
                </p>
                <p class="text-sm text-gray-600 mt-1">Executed trades</p>
            </div>
        </div>

        ${trades.length > 0 ? `
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Top Trades (${currentTradeOptions.ranking})</h3>
                <div class="space-y-2">
                    ${trades.map(trade => `
                        <div class="flex justify-between items-center py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors px-2 rounded">
                            <div class="flex items-center">
                                <span class="font-medium text-gray-900 mr-3">${trade.symbol}</span>
                                <span class="text-xs px-2 py-1 rounded-full ${trade.type === 'Long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${trade.type || 'Trade'}</span>
                            </div>
                            <div class="text-right">
                                <span class="font-semibold block ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    ${trade.pnl >= 0 ? '+' : ''}$${Math.abs(trade.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span class="text-xs text-gray-500">${trade.return_pct ? (trade.return_pct * 100).toFixed(2) + '%' : ''}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '<div class="text-center py-8 text-gray-500 bg-white rounded-lg shadow">No trades found matching criteria</div>'}

        <div class="bg-gray-50 rounded-lg p-6">
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Analysis Parameters</h4>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div><span class="text-gray-600">Period:</span> <span class="font-medium text-gray-900">${currentTradeOptions.period}</span></div>
                <div><span class="text-gray-600">Size:</span> <span class="font-medium text-gray-900">${currentTradeOptions.tradeSize}</span></div>
                <div><span class="text-gray-600">Metric:</span> <span class="font-medium text-gray-900">${currentTradeOptions.metric}</span></div>
                <div><span class="text-gray-600">Ranking:</span> <span class="font-medium text-gray-900">${currentTradeOptions.ranking}</span></div>
                <div><span class="text-gray-600">Filter:</span> <span class="font-medium text-gray-900">${currentTradeOptions.type}</span></div>
            </div>
        </div>
    `;
}

function showError(message) {
    const contentDiv = document.getElementById('tradeContent');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="bg-white rounded-lg shadow p-8 text-center text-red-600">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl font-semibold mb-2">Analysis Error</p>
                <p class="text-sm text-gray-600">${message}</p>
            </div>
        `;
    }
}

function updateTradePerformance() {
    updateTradeOptions();
    fetchTradeData();
}

function toggleTradeSettings() {
    const settings = document.getElementById('tradeSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Global exports
window.loadTradePerformance = loadTradePerformance;
window.updateTradePerformance = updateTradePerformance;
window.toggleTradeSettings = toggleTradeSettings;