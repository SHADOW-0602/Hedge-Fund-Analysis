// P&L Attribution Analysis with Interactive Parameters
let pnlAttributionChart = null;

// Toggle P&L settings panel
function togglePnLSettings() {
    const settings = document.getElementById('pnlSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update P&L Attribution analysis
function updatePnLAttribution() {
    const transactionData = window.currentTransactionData;
    if (!transactionData || transactionData.length === 0) {
        showPnLError('No transaction data available. Please upload transaction data first.');
        return;
    }
    
    loadPnLAttribution(transactionData);
}

// Main P&L Attribution loading function
function loadPnLAttribution(transactionData) {
    const container = document.getElementById('pnlAttribution');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            <p class="text-gray-600">Calculating P&L Attribution...</p>
        </div>
    `;
    
    // Get interactive parameters
    const options = {
        period: document.getElementById('pnlPeriod')?.value || '1Y',
        view: document.getElementById('pnlView')?.value || 'Total',
        grouping: document.getElementById('pnlGrouping')?.value || 'By Symbol',
        currency: document.getElementById('pnlCurrency')?.value || 'USD',
        tax_impact: document.getElementById('pnlTaxImpact')?.value || 'Pre-tax'
    };
    
    // Call API
    fetch('/api/pnl-attribution', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            transactions: transactionData,
            options: options
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displayPnLAttribution(data.pnl_attribution, options);
        } else {
            showPnLError(data.error || 'Failed to calculate P&L attribution');
        }
    })
    .catch(error => {
        console.error('P&L Attribution error:', error);
        showPnLError('Error calculating P&L attribution: ' + error.message);
    });
}

// Display P&L Attribution results
function displayPnLAttribution(data, options) {
    const container = document.getElementById('pnlAttribution');
    if (!container) return;
    
    const { summary, grouped_data, parameters, metrics } = data;
    
    // Create comprehensive display
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <h4 class="text-sm font-medium text-green-800 mb-1">Realized P&L</h4>
                    <p class="text-2xl font-bold ${summary.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${formatCurrency(summary.realized_pnl, options.currency)}
                    </p>
                    <p class="text-xs text-green-600 mt-1">${parameters.tax_impact}</p>
                </div>
                <div class="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <h4 class="text-sm font-medium text-blue-800 mb-1">Unrealized P&L</h4>
                    <p class="text-2xl font-bold ${summary.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${formatCurrency(summary.unrealized_pnl, options.currency)}
                    </p>
                    <p class="text-xs text-blue-600 mt-1">Current positions</p>
                </div>
                <div class="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <h4 class="text-sm font-medium text-purple-800 mb-1">Dividend Income</h4>
                    <p class="text-2xl font-bold text-green-600">
                        ${formatCurrency(summary.dividend_income, options.currency)}
                    </p>
                    <p class="text-xs text-purple-600 mt-1">${parameters.tax_impact}</p>
                </div>
                <div class="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
                    <h4 class="text-sm font-medium text-gray-800 mb-1">Total P&L</h4>
                    <p class="text-2xl font-bold ${summary.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${formatCurrency(summary.total_pnl, options.currency)}
                    </p>
                    <p class="text-xs text-gray-600 mt-1">Net result</p>
                </div>
            </div>
            
            <!-- Tax Impact (if applicable) -->
            ${parameters.tax_impact === 'After-tax' && summary.tax_impact > 0 ? `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                        <div>
                            <h4 class="text-sm font-medium text-yellow-800">Tax Impact</h4>
                            <p class="text-sm text-yellow-700">Estimated tax liability: ${formatCurrency(summary.tax_impact, options.currency)}</p>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Performance Metrics -->
            <div class="bg-gray-50 rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">Performance Metrics</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="text-center">
                        <p class="text-2xl font-bold text-indigo-600">${metrics.total_transactions}</p>
                        <p class="text-sm text-gray-600">Total Transactions</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-indigo-600">${metrics.symbols_traded}</p>
                        <p class="text-sm text-gray-600">Symbols Traded</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-indigo-600">${(metrics.win_rate * 100).toFixed(1)}%</p>
                        <p class="text-sm text-gray-600">Win Rate</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold ${summary.fees_paid > 0 ? 'text-red-600' : 'text-gray-600'}">
                            ${formatCurrency(summary.fees_paid, options.currency)}
                        </p>
                        <p class="text-sm text-gray-600">Fees Paid</p>
                    </div>
                </div>
            </div>
            
            <!-- Best/Worst Performers -->
            ${metrics.best_performer && metrics.worst_performer ? `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-green-800 mb-2">Best Performer</h4>
                        <p class="text-lg font-bold text-green-600">${metrics.best_performer}</p>
                        <p class="text-sm text-green-700">
                            ${formatCurrency(grouped_data[metrics.best_performer]?.total_pnl || 0, options.currency)}
                        </p>
                    </div>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-red-800 mb-2">Worst Performer</h4>
                        <p class="text-lg font-bold text-red-600">${metrics.worst_performer}</p>
                        <p class="text-sm text-red-700">
                            ${formatCurrency(grouped_data[metrics.worst_performer]?.total_pnl || 0, options.currency)}
                        </p>
                    </div>
                </div>
            ` : ''}
            
            <!-- Detailed Breakdown -->
            <div class="bg-white border rounded-lg">
                <div class="px-4 py-3 border-b border-gray-200">
                    <h4 class="text-lg font-semibold text-gray-900">
                        P&L Breakdown - ${options.grouping} (${options.view})
                    </h4>
                    <p class="text-sm text-gray-600">
                        Period: ${parameters.start_date} to ${parameters.end_date}
                    </p>
                </div>
                <div class="p-4">
                    <div id="pnlChart" class="mb-4" style="height: 400px;"></div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ${options.grouping}
                                    </th>
                                    ${options.view === 'Total' || options.view === 'Realized' ? `
                                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Realized P&L</th>
                                    ` : ''}
                                    ${options.view === 'Total' || options.view === 'Unrealized' ? `
                                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unrealized P&L</th>
                                    ` : ''}
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Dividends</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fees</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total P&L</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${Object.entries(grouped_data).map(([key, data]) => `
                                    <tr class="hover:bg-gray-50">
                                        <td class="px-4 py-2 text-sm font-medium text-gray-900">
                                            ${key}
                                            ${data.symbols ? `<br><span class="text-xs text-gray-500">${data.symbols.length} symbols</span>` : ''}
                                        </td>
                                        ${options.view === 'Total' || options.view === 'Realized' ? `
                                            <td class="px-4 py-2 text-sm text-right ${data.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                                                ${formatCurrency(data.realized_pnl || 0, options.currency)}
                                            </td>
                                        ` : ''}
                                        ${options.view === 'Total' || options.view === 'Unrealized' ? `
                                            <td class="px-4 py-2 text-sm text-right ${data.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                                                ${formatCurrency(data.unrealized_pnl || 0, options.currency)}
                                            </td>
                                        ` : ''}
                                        <td class="px-4 py-2 text-sm text-right text-green-600">
                                            ${formatCurrency(data.dividend_income || 0, options.currency)}
                                        </td>
                                        <td class="px-4 py-2 text-sm text-right text-red-600">
                                            ${formatCurrency(data.fees || 0, options.currency)}
                                        </td>
                                        <td class="px-4 py-2 text-sm text-right font-semibold ${data.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                                            ${formatCurrency(data.total_pnl || 0, options.currency)}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Create P&L chart
    createPnLChart(grouped_data, options);
}

// Create P&L visualization chart
function createPnLChart(data, options) {
    const chartContainer = document.getElementById('pnlChart');
    if (!chartContainer) return;
    
    // Prepare chart data
    const labels = Object.keys(data);
    const realizedData = labels.map(key => data[key].realized_pnl || 0);
    const unrealizedData = labels.map(key => data[key].unrealized_pnl || 0);
    const dividendData = labels.map(key => data[key].dividend_income || 0);
    const totalData = labels.map(key => data[key].total_pnl || 0);
    
    // Create traces based on view
    const traces = [];
    
    if (options.view === 'Total' || options.view === 'Realized') {
        traces.push({
            x: labels,
            y: realizedData,
            name: 'Realized P&L',
            type: 'bar',
            marker: {
                color: realizedData.map(val => val >= 0 ? '#10B981' : '#EF4444')
            }
        });
    }
    
    if (options.view === 'Total' || options.view === 'Unrealized') {
        traces.push({
            x: labels,
            y: unrealizedData,
            name: 'Unrealized P&L',
            type: 'bar',
            marker: {
                color: unrealizedData.map(val => val >= 0 ? '#3B82F6' : '#F59E0B')
            }
        });
    }
    
    if (options.view === 'Total') {
        traces.push({
            x: labels,
            y: dividendData,
            name: 'Dividends',
            type: 'bar',
            marker: { color: '#8B5CF6' }
        });
    }
    
    const layout = {
        title: {
            text: `P&L Attribution - ${options.grouping} (${options.view})`,
            font: { size: 16, color: '#1F2937' }
        },
        xaxis: {
            title: options.grouping,
            tickangle: -45
        },
        yaxis: {
            title: `P&L (${options.currency})`,
            tickformat: ',.0f'
        },
        barmode: options.view === 'Total' ? 'group' : 'overlay',
        showlegend: true,
        legend: {
            orientation: 'h',
            y: -0.2
        },
        margin: { t: 50, b: 100, l: 80, r: 50 },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
    };
    
    // Clear previous chart
    if (pnlAttributionChart) {
        Plotly.purge(chartContainer);
    }
    
    Plotly.newPlot(chartContainer, traces, layout, config);
    pnlAttributionChart = true;
}

// Show P&L error message
function showPnLError(message) {
    const container = document.getElementById('pnlAttribution');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                <svg class="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="text-lg font-medium text-red-800 mb-2">P&L Attribution Error</h3>
                <p class="text-red-600">${message}</p>
                <button onclick="updatePnLAttribution()" class="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                    Retry Analysis
                </button>
            </div>
        </div>
    `;
}

// Format currency values
function formatCurrency(value, currency = 'USD') {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    
    return formatter.format(value);
}

// Export functions to global scope
window.togglePnLSettings = togglePnLSettings;
window.updatePnLAttribution = updatePnLAttribution;
window.loadPnLAttribution = loadPnLAttribution;