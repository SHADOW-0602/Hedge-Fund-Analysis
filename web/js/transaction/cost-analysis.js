// Cost Analysis with Interactive Parameters
let costAnalysisChart = null;

// Toggle Cost Analysis settings panel
function toggleCostSettings() {
    const settings = document.getElementById('costSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update Cost Analysis
function updateCostAnalysis() {
    const transactionData = window.currentTransactionData;
    if (!transactionData || transactionData.length === 0) {
        showCostError('No transaction data available. Please upload transaction data first.');
        return;
    }
    
    loadCostAnalysis(transactionData);
}

// Main Cost Analysis loading function
function loadCostAnalysis(transactionData) {
    const container = document.getElementById('costAnalysis');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            <p class="text-gray-600">Analyzing Trading Costs...</p>
        </div>
    `;
    
    // Get interactive parameters
    const options = {
        period: document.getElementById('costPeriod')?.value || '1Y',
        cost_type: document.getElementById('costType')?.value || 'Total',
        breakdown: document.getElementById('costBreakdown')?.value || 'By Symbol',
        benchmark: document.getElementById('costBenchmark')?.value || 'Industry average',
        view: document.getElementById('costView')?.value || 'Absolute $'
    };
    
    // Call API
    fetch('/api/cost-analysis', {
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
            displayCostAnalysis(data.cost_analysis, options);
        } else {
            showCostError(data.error || 'Failed to analyze trading costs');
        }
    })
    .catch(error => {
        console.error('Cost Analysis error:', error);
        showCostError('Error analyzing trading costs: ' + error.message);
    });
}

// Display Cost Analysis results
function displayCostAnalysis(data, options) {
    const container = document.getElementById('costAnalysis');
    if (!container) return;
    
    const { summary, breakdown, benchmark, cost_components, parameters } = data;
    const viewSuffix = options.view === 'Absolute $' ? '' : options.view === '% of Trade Value' ? '%' : '% of P&L';
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                    <h4 class="text-sm font-medium text-red-800 mb-1">Total Costs</h4>
                    <p class="text-2xl font-bold text-red-600">
                        ${formatCostValue(summary.total_costs, options.view)}
                    </p>
                    <p class="text-xs text-red-600 mt-1">${parameters.period}</p>
                </div>
                <div class="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                    <h4 class="text-sm font-medium text-orange-800 mb-1">Commissions</h4>
                    <p class="text-2xl font-bold text-orange-600">
                        ${formatCostValue(summary.total_commissions, options.view)}
                    </p>
                    <p class="text-xs text-orange-600 mt-1">${cost_components.commissions_pct.toFixed(1)}% of total</p>
                </div>
                <div class="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200">
                    <h4 class="text-sm font-medium text-yellow-800 mb-1">Spreads</h4>
                    <p class="text-2xl font-bold text-yellow-600">
                        ${formatCostValue(summary.total_spreads, options.view)}
                    </p>
                    <p class="text-xs text-yellow-600 mt-1">${cost_components.spreads_pct.toFixed(1)}% of total</p>
                </div>
                <div class="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <h4 class="text-sm font-medium text-purple-800 mb-1">Slippage</h4>
                    <p class="text-2xl font-bold text-purple-600">
                        ${formatCostValue(summary.total_slippage, options.view)}
                    </p>
                    <p class="text-xs text-purple-600 mt-1">${cost_components.slippage_pct.toFixed(1)}% of total</p>
                </div>
            </div>
            
            <!-- Trading Metrics -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Total Volume</h4>
                    <p class="text-lg font-bold text-gray-900">${formatCurrency(summary.total_volume)}</p>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Total Trades</h4>
                    <p class="text-lg font-bold text-gray-900">${summary.total_trades}</p>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Avg Cost/Trade</h4>
                    <p class="text-lg font-bold text-gray-900">${formatCostValue(summary.avg_cost_per_trade, options.view)}</p>
                </div>
            </div>
            
            <!-- Benchmark Comparison -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-4">Benchmark Comparison</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="text-center">
                        <p class="text-sm text-gray-600">Your Rate</p>
                        <p class="text-2xl font-bold text-indigo-600">${benchmark.actual_rate.toFixed(3)}%</p>
                        <p class="text-xs text-gray-500">of trade value</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600">${benchmark.type}</p>
                        <p class="text-2xl font-bold text-gray-600">${benchmark.value.toFixed(3)}%</p>
                        <p class="text-xs text-gray-500">benchmark</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600">vs Benchmark</p>
                        <p class="text-2xl font-bold ${benchmark.vs_benchmark < 0 ? 'text-green-600' : 'text-red-600'}">
                            ${benchmark.vs_benchmark > 0 ? '+' : ''}${benchmark.vs_benchmark.toFixed(1)}%
                        </p>
                        <p class="text-xs ${benchmark.vs_benchmark < 0 ? 'text-green-500' : 'text-red-500'}">
                            ${benchmark.vs_benchmark < 0 ? 'Better' : 'Higher'} than benchmark
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Cost Breakdown -->
            <div class="bg-white border rounded-lg">
                <div class="px-4 py-3 border-b border-gray-200">
                    <h4 class="text-lg font-semibold text-gray-900">
                        Cost Breakdown - ${options.breakdown} (${options.view})
                    </h4>
                    <p class="text-sm text-gray-600">
                        Period: ${parameters.start_date} to ${parameters.end_date}
                    </p>
                </div>
                <div class="p-4">
                    <div id="costChart" class="mb-4" style="height: 400px;"></div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ${options.breakdown}
                                    </th>
                                    ${options.cost_type === 'Total' || options.cost_type === 'Commissions' ? `
                                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commissions</th>
                                    ` : ''}
                                    ${options.cost_type === 'Total' || options.cost_type === 'Spreads' ? `
                                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Spreads</th>
                                    ` : ''}
                                    ${options.cost_type === 'Total' || options.cost_type === 'Slippage' ? `
                                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Slippage</th>
                                    ` : ''}
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Trades</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${Object.entries(breakdown).map(([key, data]) => `
                                    <tr class="hover:bg-gray-50">
                                        <td class="px-4 py-2 text-sm font-medium text-gray-900">${key}</td>
                                        ${options.cost_type === 'Total' || options.cost_type === 'Commissions' ? `
                                            <td class="px-4 py-2 text-sm text-right text-red-600">
                                                ${formatCostValue(data.commissions, options.view)}
                                            </td>
                                        ` : ''}
                                        ${options.cost_type === 'Total' || options.cost_type === 'Spreads' ? `
                                            <td class="px-4 py-2 text-sm text-right text-yellow-600">
                                                ${formatCostValue(data.spreads, options.view)}
                                            </td>
                                        ` : ''}
                                        ${options.cost_type === 'Total' || options.cost_type === 'Slippage' ? `
                                            <td class="px-4 py-2 text-sm text-right text-purple-600">
                                                ${formatCostValue(data.slippage, options.view)}
                                            </td>
                                        ` : ''}
                                        <td class="px-4 py-2 text-sm text-right font-semibold text-red-600">
                                            ${formatCostValue(data.total, options.view)}
                                        </td>
                                        <td class="px-4 py-2 text-sm text-right text-gray-600">
                                            ${formatCurrency(data.volume)}
                                        </td>
                                        <td class="px-4 py-2 text-sm text-right text-gray-600">
                                            ${data.trades}
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
    
    // Create cost chart
    createCostChart(breakdown, options);
}

// Create Cost Analysis chart
function createCostChart(breakdown, options) {
    const chartContainer = document.getElementById('costChart');
    if (!chartContainer) return;
    
    const labels = Object.keys(breakdown);
    const traces = [];
    
    if (options.cost_type === 'Total' || options.cost_type === 'Commissions') {
        traces.push({
            x: labels,
            y: labels.map(key => breakdown[key].commissions),
            name: 'Commissions',
            type: 'bar',
            marker: { color: '#F97316' }
        });
    }
    
    if (options.cost_type === 'Total' || options.cost_type === 'Spreads') {
        traces.push({
            x: labels,
            y: labels.map(key => breakdown[key].spreads),
            name: 'Spreads',
            type: 'bar',
            marker: { color: '#EAB308' }
        });
    }
    
    if (options.cost_type === 'Total' || options.cost_type === 'Slippage') {
        traces.push({
            x: labels,
            y: labels.map(key => breakdown[key].slippage),
            name: 'Slippage',
            type: 'bar',
            marker: { color: '#A855F7' }
        });
    }
    
    const layout = {
        title: {
            text: `Trading Costs - ${options.breakdown} (${options.view})`,
            font: { size: 16, color: '#1F2937' }
        },
        xaxis: {
            title: options.breakdown,
            tickangle: -45
        },
        yaxis: {
            title: `Cost (${options.view})`,
            tickformat: options.view === 'Absolute $' ? ',.0f' : '.2f'
        },
        barmode: options.cost_type === 'Total' ? 'stack' : 'group',
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
    if (costAnalysisChart) {
        Plotly.purge(chartContainer);
    }
    
    Plotly.newPlot(chartContainer, traces, layout, config);
    costAnalysisChart = true;
}

// Show Cost Analysis error
function showCostError(message) {
    const container = document.getElementById('costAnalysis');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                <svg class="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="text-lg font-medium text-red-800 mb-2">Cost Analysis Error</h3>
                <p class="text-red-600">${message}</p>
                <button onclick="updateCostAnalysis()" class="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                    Retry Analysis
                </button>
            </div>
        </div>
    `;
}

// Format cost values based on view type
function formatCostValue(value, view) {
    if (view === 'Absolute $') {
        return formatCurrency(value);
    } else {
        return `${value.toFixed(2)}%`;
    }
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
window.toggleCostSettings = toggleCostSettings;
window.updateCostAnalysis = updateCostAnalysis;
window.loadCostAnalysis = loadCostAnalysis;