// Trade Performance Analysis with Interactive Parameters
let tradePerformanceChart = null;

// Toggle Trade Performance settings panel
function toggleTradeSettings() {
    const settings = document.getElementById('tradeSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update Trade Performance analysis
function updateTradePerformance() {
    const transactionData = window.currentTransactionData;
    if (!transactionData || transactionData.length === 0) {
        showTradeError('No transaction data available. Please upload transaction data first.');
        return;
    }
    
    loadTradePerformance(transactionData);
}

// Main Trade Performance loading function
function loadTradePerformance(transactionData) {
    const container = document.getElementById('tradePerformance');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            <p class="text-gray-600">Analyzing Trade Performance...</p>
        </div>
    `;
    
    // Get interactive parameters
    const options = {
        period: document.getElementById('tradePeriod')?.value || '1Y',
        trade_size: document.getElementById('tradeSize')?.value || 'All',
        metric: document.getElementById('tradeMetric')?.value || 'P&L',
        ranking: document.getElementById('tradeRanking')?.value || '10',
        filter: document.getElementById('tradeFilter')?.value || 'All'
    };
    
    // Call API
    fetch(`${API_BASE}/trade-performance`, {
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
            displayTradePerformance(data.trade_performance, options);
        } else {
            showTradeError(data.error || 'Failed to analyze trade performance');
        }
    })
    .catch(error => {
        console.error('Trade Performance error:', error);
        showTradeError('Error analyzing trade performance: ' + error.message);
    });
}

// Display Trade Performance results
function displayTradePerformance(data, options) {
    const container = document.getElementById('tradePerformance');
    if (!container) return;
    
    const { summary, best_trades, worst_trades, parameters } = data;
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Summary Metrics -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <h4 class="text-sm font-medium text-blue-800 mb-1">Total Trades</h4>
                    <p class="text-2xl font-bold text-blue-600">${summary.total_trades}</p>
                    <p class="text-xs text-blue-600 mt-1">${parameters.period}</p>
                </div>
                <div class="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <h4 class="text-sm font-medium text-green-800 mb-1">Win Rate</h4>
                    <p class="text-2xl font-bold text-green-600">${(summary.win_rate * 100).toFixed(1)}%</p>
                    <p class="text-xs text-green-600 mt-1">Profitable trades</p>
                </div>
                <div class="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <h4 class="text-sm font-medium text-purple-800 mb-1">Total P&L</h4>
                    <p class="text-2xl font-bold ${summary.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${formatCurrency(summary.total_pnl)}
                    </p>
                    <p class="text-xs text-purple-600 mt-1">Net result</p>
                </div>
                <div class="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200">
                    <h4 class="text-sm font-medium text-yellow-800 mb-1">Profit Factor</h4>
                    <p class="text-2xl font-bold text-yellow-600">
                        ${summary.profit_factor === Infinity ? '∞' : summary.profit_factor.toFixed(2)}
                    </p>
                    <p class="text-xs text-yellow-600 mt-1">Avg Win / Avg Loss</p>
                </div>
            </div>
            
            <!-- Performance Details -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Average Win</h4>
                    <p class="text-lg font-bold text-green-600">${formatCurrency(summary.avg_win)}</p>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Average Loss</h4>
                    <p class="text-lg font-bold text-red-600">${formatCurrency(summary.avg_loss)}</p>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Best Trade</h4>
                    <p class="text-lg font-bold text-green-600">${formatCurrency(summary.best_trade)}</p>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Worst Trade</h4>
                    <p class="text-lg font-bold text-red-600">${formatCurrency(summary.worst_trade)}</p>
                </div>
            </div>
            
            <!-- Sharpe Ratio (if applicable) -->
            ${summary.sharpe_ratio !== 0 ? `
                <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-sm font-medium text-indigo-800">Sharpe Ratio</h4>
                            <p class="text-2xl font-bold text-indigo-600">${summary.sharpe_ratio.toFixed(2)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm text-indigo-600">Risk-adjusted returns</p>
                            <p class="text-xs text-indigo-500">Higher is better</p>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Trade Rankings -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Best Trades -->
                <div class="bg-white border rounded-lg">
                    <div class="px-4 py-3 border-b border-gray-200 bg-green-50">
                        <h4 class="text-lg font-semibold text-green-800">
                            Best ${options.ranking} Trades (${options.metric})
                        </h4>
                    </div>
                    <div class="p-4">
                        <div class="space-y-3">
                            ${best_trades.map((trade, index) => `
                                <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                    <div class="flex items-center">
                                        <span class="w-6 h-6 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center mr-3">
                                            ${index + 1}
                                        </span>
                                        <div>
                                            <p class="font-semibold text-gray-900">${trade.symbol}</p>
                                            <p class="text-xs text-gray-600">${trade.quantity} shares @ $${trade.exit_price.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <p class="font-bold text-green-600">${formatCurrency(trade.pnl)}</p>
                                        <p class="text-xs text-green-500">${trade.pnl_percent.toFixed(1)}%</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <!-- Worst Trades -->
                <div class="bg-white border rounded-lg">
                    <div class="px-4 py-3 border-b border-gray-200 bg-red-50">
                        <h4 class="text-lg font-semibold text-red-800">
                            Worst ${options.ranking} Trades (${options.metric})
                        </h4>
                    </div>
                    <div class="p-4">
                        <div class="space-y-3">
                            ${worst_trades.map((trade, index) => `
                                <div class="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                    <div class="flex items-center">
                                        <span class="w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center mr-3">
                                            ${index + 1}
                                        </span>
                                        <div>
                                            <p class="font-semibold text-gray-900">${trade.symbol}</p>
                                            <p class="text-xs text-gray-600">${trade.quantity} shares @ $${trade.exit_price.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <p class="font-bold text-red-600">${formatCurrency(trade.pnl)}</p>
                                        <p class="text-xs text-red-500">${trade.pnl_percent.toFixed(1)}%</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Performance Chart -->
            <div class="bg-white border rounded-lg">
                <div class="px-4 py-3 border-b border-gray-200">
                    <h4 class="text-lg font-semibold text-gray-900">Trade Performance Distribution</h4>
                    <p class="text-sm text-gray-600">
                        Period: ${parameters.start_date} to ${parameters.end_date} | 
                        Filter: ${parameters.filter} | 
                        Size: ${parameters.trade_size}
                    </p>
                </div>
                <div class="p-4">
                    <div id="tradeChart" style="height: 400px;"></div>
                </div>
            </div>
        </div>
    `;
    
    // Create performance chart
    createTradeChart(data, options);
}

// Create Trade Performance chart
function createTradeChart(data, options) {
    const chartContainer = document.getElementById('tradeChart');
    if (!chartContainer) return;
    
    const trades = data.all_trades;
    
    // Create scatter plot of trades
    const trace = {
        x: trades.map((_, index) => index + 1),
        y: trades.map(trade => options.metric === '%' ? trade.pnl_percent : trade.pnl),
        mode: 'markers',
        type: 'scatter',
        marker: {
            color: trades.map(trade => trade.pnl >= 0 ? '#10B981' : '#EF4444'),
            size: trades.map(trade => Math.min(Math.max(Math.abs(trade.trade_value) / 1000, 5), 20)),
            opacity: 0.7
        },
        text: trades.map(trade => 
            `${trade.symbol}<br>` +
            `P&L: ${formatCurrency(trade.pnl)}<br>` +
            `Return: ${trade.pnl_percent.toFixed(1)}%<br>` +
            `Value: ${formatCurrency(trade.trade_value)}`
        ),
        hovertemplate: '%{text}<extra></extra>',
        name: 'Trades'
    };
    
    const layout = {
        title: {
            text: `Trade Performance - ${options.metric}`,
            font: { size: 16, color: '#1F2937' }
        },
        xaxis: {
            title: 'Trade Number',
            showgrid: true,
            gridcolor: '#E5E7EB'
        },
        yaxis: {
            title: options.metric === '%' ? 'Return (%)' : 'P&L ($)',
            showgrid: true,
            gridcolor: '#E5E7EB',
            zeroline: true,
            zerolinecolor: '#6B7280'
        },
        showlegend: false,
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 50, b: 50, l: 80, r: 50 }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
    };
    
    // Clear previous chart
    if (tradePerformanceChart) {
        Plotly.purge(chartContainer);
    }
    
    Plotly.newPlot(chartContainer, [trace], layout, config);
    tradePerformanceChart = true;
}

// Show Trade Performance error
function showTradeError(message) {
    const container = document.getElementById('tradePerformance');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                <svg class="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="text-lg font-medium text-red-800 mb-2">Trade Performance Error</h3>
                <p class="text-red-600">${message}</p>
                <button onclick="updateTradePerformance()" class="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                    Retry Analysis
                </button>
            </div>
        </div>
    `;
}

// Format currency values
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

// Export functions to global scope
window.toggleTradeSettings = toggleTradeSettings;
window.updateTradePerformance = updateTradePerformance;
window.loadTradePerformance = loadTradePerformance;