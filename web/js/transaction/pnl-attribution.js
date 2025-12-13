// P&L Attribution Analysis Module - Matches Risk Analysis UI Style
let currentPnlOptions = {
    period: 'ITD',
    view: 'Total',
    grouping: 'By Symbol',
    currency: 'USD',
    tax_impact: 'Pre-tax'
};

async function loadPnlAttribution(transactions) {
    console.log('loadPnlAttribution called with:', transactions?.length || 0, 'transactions');

    const container = document.getElementById('pnlAttribution');
    if (!container) {
        console.error('pnlAttribution container not found');
        return;
    }

    // Ensure API_BASE is defined
    if (typeof API_BASE === 'undefined') {
        window.API_BASE = window.location.origin;
        console.log('API_BASE not defined, using:', window.API_BASE);
    }

    // Validate transactions
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-yellow-500">No transactions available for P&L attribution analysis</div>';
        return;
    }

    // Store transactions for refresh
    window.currentPnlTransactions = transactions;

    // Initial load
    await fetchPnlAttribution(transactions);
}

function updatePnlOptions() {
    currentPnlOptions = {
        period: document.getElementById('pnlPeriod')?.value || 'ITD',
        view: document.getElementById('pnlView')?.value || 'Total',
        grouping: document.getElementById('pnlGrouping')?.value || 'By Symbol',
        currency: document.getElementById('pnlCurrency')?.value || 'USD',
        tax_impact: document.getElementById('pnlTaxImpact')?.value || 'Pre-tax'
    };
}

async function fetchPnlAttribution(transactions) {
    const container = document.getElementById('pnlAttribution');
    if (!container) return;

    // Preserve settings state if they exist
    const settingsPanel = document.getElementById('pnlSettings');
    const settingsHidden = settingsPanel ? settingsPanel.classList.contains('hidden') : true;

    // Show loading state with full UI
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">P&L Attribution</h2>
            <div class="flex items-center space-x-2">
                <button onclick="togglePnlSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
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
        
        <!-- P&L Settings Panel -->
        <div id="pnlSettings" class="settings-panel ${settingsHidden ? 'hidden' : ''} mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select id="pnlPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePnlAttribution()">
                        <option value="1W" ${currentPnlOptions.period === '1W' ? 'selected' : ''}>1 Week</option>
                        <option value="1M" ${currentPnlOptions.period === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${currentPnlOptions.period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentPnlOptions.period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentPnlOptions.period === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="YTD" ${currentPnlOptions.period === 'YTD' ? 'selected' : ''}>Year to Date</option>
                        <option value="ITD" ${currentPnlOptions.period === 'ITD' ? 'selected' : ''}>Inception to Date</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">View</label>
                    <select id="pnlView" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePnlAttribution()">
                        <option value="Total" ${currentPnlOptions.view === 'Total' ? 'selected' : ''}>Total</option>
                        <option value="Realized" ${currentPnlOptions.view === 'Realized' ? 'selected' : ''}>Realized</option>
                        <option value="Unrealized" ${currentPnlOptions.view === 'Unrealized' ? 'selected' : ''}>Unrealized</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Grouping</label>
                    <select id="pnlGrouping" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePnlAttribution()">
                        <option value="By Symbol" ${currentPnlOptions.grouping === 'By Symbol' ? 'selected' : ''}>By Symbol</option>
                        <option value="By Sector" ${currentPnlOptions.grouping === 'By Sector' ? 'selected' : ''}>By Sector</option>
                        <option value="By Date" ${currentPnlOptions.grouping === 'By Date' ? 'selected' : ''}>By Date</option>
                        <option value="By Size" ${currentPnlOptions.grouping === 'By Size' ? 'selected' : ''}>By Size</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select id="pnlCurrency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePnlAttribution()">
                        <option value="USD" ${currentPnlOptions.currency === 'USD' ? 'selected' : ''}>USD</option>
                        <option value="EUR" ${currentPnlOptions.currency === 'EUR' ? 'selected' : ''}>EUR</option>
                        <option value="GBP" ${currentPnlOptions.currency === 'GBP' ? 'selected' : ''}>GBP</option>
                        <option value="JPY" ${currentPnlOptions.currency === 'JPY' ? 'selected' : ''}>JPY</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tax Impact</label>
                    <select id="pnlTaxImpact" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePnlAttribution()">
                        <option value="Pre-tax" ${currentPnlOptions.tax_impact === 'Pre-tax' ? 'selected' : ''}>Pre-tax</option>
                        <option value="After-tax" ${currentPnlOptions.tax_impact === 'After-tax' ? 'selected' : ''}>After-tax</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div id="pnlContent" class="analysis-card p-12 text-center">
            <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Processing Your Data</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">Analyzing ${transactions?.length || 0} transactions and calculating P&L...</p>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
            </div>
            <p class="text-sm text-gray-500">This may take a few moments</p>
        </div>
    `;

    try {
        console.log('Making P&L Attribution API call with options:', currentPnlOptions);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${API_BASE}/api/pnl-attribution`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions, options: currentPnlOptions }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success && data.pnl_attribution) {
            displayPnlAttribution(data.pnl_attribution);
        } else {
            showError(data.error || 'No valid transactions found');
        }
    } catch (error) {
        console.error('P&L Attribution error:', error);
        showError(error.name === 'AbortError' ? 'Request timeout' : error.message);
    }
}

function displayPnlAttribution(data) {
    const contentDiv = document.getElementById('pnlContent');
    if (!contentDiv) return;

    const totalPnl = data.total_pnl || 0;
    const realizedPnl = data.realized_pnl || 0;
    const unrealizedPnl = data.unrealized_pnl || 0;
    const metadata = data.metadata || {};
    const currency = metadata.currency || 'USD';
    const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;

    let breakdownHtml = '';
    const grouping = metadata.grouping || 'By Symbol';

    if (grouping === 'By Symbol' && data.by_symbol) {
        breakdownHtml = createSymbolBreakdown(data.by_symbol, currencySymbol);
    } else if (grouping === 'By Sector' && data.by_sector) {
        breakdownHtml = createSectorBreakdown(data.by_sector, currencySymbol);
    } else if (grouping === 'By Date' && data.by_date) {
        breakdownHtml = createDateBreakdown(data.by_date, currencySymbol);
    } else if (grouping === 'By Size' && data.by_size) {
        breakdownHtml = createSizeBreakdown(data.by_size, currencySymbol);
    }

    contentDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Total P&L</h3>
                <p class="text-3xl font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${totalPnl >= 0 ? '+' : ''}${currencySymbol}${Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${metadata.period || '1Y'}</p>
            </div>
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Realized P&L</h3>
                <p class="text-3xl font-bold ${realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${realizedPnl >= 0 ? '+' : ''}${currencySymbol}${Math.abs(realizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Closed positions</p>
            </div>
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Unrealized P&L</h3>
                <p class="text-3xl font-bold ${unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${unrealizedPnl >= 0 ? '+' : ''}${currencySymbol}${Math.abs(unrealizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Open positions</p>
            </div>
        </div>

        ${breakdownHtml ? `
            <div class="analysis-card p-6 mb-6">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">${grouping}</h3>
                <div class="space-y-2">${breakdownHtml}</div>
            </div>
        ` : ''}

        <div class="analysis-card p-6">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Analysis Parameters</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span class="text-gray-600 dark:text-gray-400">Period:</span> <span class="font-medium text-gray-900 dark:text-white">${metadata.period || 'ITD'}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">View:</span> <span class="font-medium text-gray-900 dark:text-white">${metadata.view || 'Total'}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">Grouping:</span> <span class="font-medium text-gray-900 dark:text-white">${metadata.grouping || 'By Symbol'}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">Currency:</span> <span class="font-medium text-gray-900 dark:text-white">${metadata.currency || 'USD'}</span></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                <div><span class="text-gray-600 dark:text-gray-400">Tax Impact:</span> <span class="font-medium text-gray-900 dark:text-white">${metadata.tax_impact || 'Pre-tax'}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">Transactions:</span> <span class="font-medium text-gray-900 dark:text-white">${metadata.transaction_count || 0}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">Start Date:</span> <span class="font-medium text-gray-900 dark:text-white">${metadata.start_date || 'N/A'}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">End Date:</span> <span class="font-medium text-gray-900 dark:text-white">${metadata.end_date || 'N/A'}</span></div>
            </div>
        </div>
    `;
}

function showError(message) {
    const contentDiv = document.getElementById('pnlContent');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="analysis-card p-8 text-center text-red-600">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl font-semibold mb-2">Analysis Error</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">${message}</p>
            </div>
        `;
    }
}

function createSymbolBreakdown(bySymbol, currencySymbol) {
    return Object.entries(bySymbol)
        .sort((a, b) => Math.abs(b[1].total_pnl || 0) - Math.abs(a[1].total_pnl || 0))
        .filter(([, data]) => Math.abs(data.total_pnl || 0) > 0.001)
        .map(([symbol, data]) => {
            const pnl = data.total_pnl || 0;
            return `
                <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                    <span class="font-medium text-gray-900 dark:text-white">${symbol}</span>
                    <span class="font-semibold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${pnl >= 0 ? '+' : ''}${currencySymbol}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            `;
        }).join('');
}

function createSectorBreakdown(bySector, currencySymbol) {
    return Object.entries(bySector)
        .sort((a, b) => Math.abs(b[1].total_pnl || 0) - Math.abs(a[1].total_pnl || 0))
        .filter(([, data]) => Math.abs(data.total_pnl || 0) > 0.001)
        .map(([sector, data]) => {
            const pnl = data.total_pnl || 0;
            return `
                <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                    <span class="font-medium text-gray-900 dark:text-white">${sector} <span class="text-sm text-gray-600 dark:text-gray-400">(${data.symbols?.length || 0} symbols)</span></span>
                    <span class="font-semibold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${pnl >= 0 ? '+' : ''}${currencySymbol}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            `;
        }).join('');
}

function createDateBreakdown(byDate, currencySymbol) {
    return Object.entries(byDate)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .filter(([, data]) => Math.abs(data.total_pnl || 0) > 0.001)
        .map(([date, data]) => {
            const pnl = data.total_pnl || 0;
            return `
                <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                    <span class="font-medium text-gray-900 dark:text-white">${date}</span>
                    <span class="font-semibold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${pnl >= 0 ? '+' : ''}${currencySymbol}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            `;
        }).join('');
}

function createSizeBreakdown(bySize, currencySymbol) {
    return ['Large', 'Medium', 'Small']
        .filter(size => bySize[size] && Math.abs(bySize[size].total_pnl || 0) > 0.001)
        .map(size => {
            const data = bySize[size];
            const pnl = data.total_pnl || 0;
            return `
                <div class="flex justify-between items-center py-2 border-b border-card">
                    <span class="font-medium text-primary">${size} <span class="text-sm text-secondary">(${data.count || 0} positions)</span></span>
                    <span class="font-semibold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${pnl >= 0 ? '+' : ''}${currencySymbol}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            `;
        }).join('');
}

// Global functions
window.loadPnlAttribution = loadPnlAttribution;
window.togglePnlSettings = () => document.getElementById('pnlSettings')?.classList.toggle('hidden');
window.updatePnlAttribution = () => {
    updatePnlOptions();
    if (window.currentPnlTransactions) fetchPnlAttribution(window.currentPnlTransactions);
};
window.refreshPnlAttribution = () => {
    if (window.currentPnlTransactions) fetchPnlAttribution(window.currentPnlTransactions);
};