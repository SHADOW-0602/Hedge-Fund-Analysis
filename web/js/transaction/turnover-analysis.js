// Turnover Analysis with Interactive Parameters
let turnoverChart = null;

// Toggle Turnover Analysis settings panel
function toggleTurnoverSettings() {
    const settings = document.getElementById('turnoverSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update Turnover Analysis
function updateTurnoverAnalysis() {
    const transactionData = window.currentTransactionData;
    if (!transactionData || transactionData.length === 0) {
        showTurnoverError('No transaction data available. Please upload transaction data first.');
        return;
    }
    
    loadTurnoverAnalysis(transactionData);
}

// Main Turnover Analysis loading function
function loadTurnoverAnalysis(transactionData) {
    const container = document.getElementById('turnoverAnalysis');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            <p class="text-gray-600">Calculating Turnover Analysis...</p>
        </div>
    `;
    
    // Get interactive parameters
    const options = {
        period: document.getElementById('turnoverPeriod')?.value || '1Y',
        calculation: document.getElementById('turnoverCalculation')?.value || 'Buy+Sell',
        frequency: document.getElementById('turnoverFrequency')?.value || 'Monthly',
        benchmark: document.getElementById('turnoverBenchmark')?.value || 'Mutual Fund avg',
        trend: document.getElementById('turnoverTrend')?.value || '90d'
    };
    
    // Call API
    fetch('/api/turnover-analysis', {
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
            displayTurnoverAnalysis(data.turnover_analysis, options);
        } else {
            showTurnoverError(data.error || 'Failed to analyze turnover');
        }
    })
    .catch(error => {
        console.error('Turnover Analysis error:', error);
        showTurnoverError('Error analyzing turnover: ' + error.message);
    });
}

// Display Turnover Analysis results
function displayTurnoverAnalysis(data, options) {
    const container = document.getElementById('turnoverAnalysis');
    if (!container) return;
    
    const { summary, benchmark, trend, frequency_analysis, parameters } = data;
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Key Metrics -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <h4 class="text-sm font-medium text-blue-800 mb-1">Annual Turnover</h4>
                    <p class="text-2xl font-bold text-blue-600">${(summary.annual_turnover * 100).toFixed(1)}%</p>
                    <p class="text-xs text-blue-600 mt-1">${parameters.calculation}</p>
                </div>
                <div class="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <h4 class="text-sm font-medium text-green-800 mb-1">Buy Turnover</h4>
                    <p class="text-2xl font-bold text-green-600">${(summary.buy_turnover * 100).toFixed(1)}%</p>
                    <p class="text-xs text-green-600 mt-1">Purchase activity</p>
                </div>
                <div class="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                    <h4 class="text-sm font-medium text-red-800 mb-1">Sell Turnover</h4>
                    <p class="text-2xl font-bold text-red-600">${(summary.sell_turnover * 100).toFixed(1)}%</p>
                    <p class="text-xs text-red-600 mt-1">Sale activity</p>
                </div>
                <div class="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <h4 class="text-sm font-medium text-purple-800 mb-1">Avg Holding Period</h4>
                    <p class="text-2xl font-bold text-purple-600">${summary.avg_holding_period_months.toFixed(1)}mo</p>
                    <p class="text-xs text-purple-600 mt-1">${summary.avg_holding_period_days.toFixed(0)} days</p>
                </div>
            </div>
            
            <!-- Portfolio Activity -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Buy Volume</h4>
                    <p class="text-lg font-bold text-green-600">${formatCurrency(summary.total_buy_volume)}</p>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Sell Volume</h4>
                    <p class="text-lg font-bold text-red-600">${formatCurrency(summary.total_sell_volume)}</p>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Avg Portfolio Value</h4>
                    <p class="text-lg font-bold text-gray-900">${formatCurrency(summary.avg_portfolio_value)}</p>
                </div>
            </div>
            
            <!-- Benchmark Comparison -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-4">Benchmark Comparison</h4>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="text-center">
                        <p class="text-sm text-gray-600">Your Turnover</p>
                        <p class="text-2xl font-bold text-indigo-600">${(summary.annual_turnover * 100).toFixed(1)}%</p>
                        <p class="text-xs text-gray-500">annual rate</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600">${benchmark.type}</p>
                        <p class="text-2xl font-bold text-gray-600">${(benchmark.rate * 100).toFixed(1)}%</p>
                        <p class="text-xs text-gray-500">benchmark</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600">vs Benchmark</p>
                        <p class="text-2xl font-bold ${benchmark.vs_benchmark > 0 ? 'text-red-600' : 'text-green-600'}">
                            ${benchmark.vs_benchmark > 0 ? '+' : ''}${benchmark.vs_benchmark.toFixed(1)}%
                        </p>
                        <p class="text-xs ${benchmark.vs_benchmark > 0 ? 'text-red-500' : 'text-green-500'}">
                            ${benchmark.vs_benchmark > 0 ? 'Higher' : 'Lower'} than benchmark
                        </p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600">Activity Level</p>
                        <p class="text-lg font-bold ${getTurnoverColor(summary.annual_turnover)}">
                            ${getTurnoverLabel(summary.annual_turnover)}
                        </p>
                        <p class="text-xs text-gray-500">classification</p>
                    </div>
                </div>
            </div>
            
            <!-- All Benchmarks Comparison -->
            <div class="bg-gray-50 rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">Industry Benchmarks</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    ${Object.entries(benchmark.all_benchmarks).map(([type, rate]) => `
                        <div class="text-center p-3 bg-white rounded-lg border ${benchmark.type === type ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'}">
                            <p class="text-sm font-medium text-gray-700">${type}</p>
                            <p class="text-xl font-bold text-gray-900">${(rate * 100).toFixed(1)}%</p>
                            <p class="text-xs ${summary.annual_turnover > rate ? 'text-red-500' : 'text-green-500'}">
                                ${summary.annual_turnover > rate ? 'Above' : 'Below'} your rate
                            </p>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Trend Analysis -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-4">Trend Analysis (${trend.period})</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="text-center p-4 bg-gray-50 rounded-lg">
                        <p class="text-sm text-gray-600">Recent Turnover</p>
                        <p class="text-2xl font-bold text-indigo-600">${(trend.recent_turnover * 100).toFixed(1)}%</p>
                        <p class="text-xs text-gray-500">annualized rate</p>
                    </div>
                    <div class="text-center p-4 bg-gray-50 rounded-lg">
                        <p class="text-sm text-gray-600">Trend vs Overall</p>
                        <p class="text-2xl font-bold ${trend.trend_vs_overall > 0 ? 'text-red-600' : 'text-green-600'}">
                            ${trend.trend_vs_overall > 0 ? '+' : ''}${trend.trend_vs_overall.toFixed(1)}%
                        </p>
                        <p class="text-xs ${trend.trend_vs_overall > 0 ? 'text-red-500' : 'text-green-500'}">
                            ${trend.trend_vs_overall > 0 ? 'Increasing' : 'Decreasing'} activity
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Frequency Analysis -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-4">Trading Frequency (${frequency_analysis.period})</h4>
                <div class="text-center p-4 bg-blue-50 rounded-lg">
                    <p class="text-sm text-blue-800">Average Trades per ${frequency_analysis.period}</p>
                    <p class="text-3xl font-bold text-blue-600">${frequency_analysis.avg_trades_per_period.toFixed(1)}</p>
                    <p class="text-xs text-blue-600">trading frequency</p>
                </div>
            </div>
            
            <!-- Analysis Summary -->
            <div class="bg-white border rounded-lg">
                <div class="px-4 py-3 border-b border-gray-200">
                    <h4 class="text-lg font-semibold text-gray-900">Analysis Summary</h4>
                    <p class="text-sm text-gray-600">
                        Period: ${parameters.start_date} to ${parameters.end_date} | 
                        Method: ${parameters.calculation} | 
                        Frequency: ${parameters.frequency}
                    </p>
                </div>
                <div class="p-4">
                    <div id="turnoverChart" style="height: 300px;"></div>
                </div>
            </div>
        </div>
    `;
    
    // Create turnover chart
    createTurnoverChart(data, options);
}

// Create Turnover visualization chart
function createTurnoverChart(data, options) {
    const chartContainer = document.getElementById('turnoverChart');
    if (!chartContainer) return;
    
    const { summary, benchmark } = data;
    
    // Create comparison chart
    const trace = {
        x: ['Your Portfolio', benchmark.type, 'Mutual Fund avg', 'ETF avg', 'Hedge Fund avg'],
        y: [
            summary.annual_turnover * 100,
            benchmark.rate * 100,
            benchmark.all_benchmarks['Mutual Fund avg'] * 100,
            benchmark.all_benchmarks['ETF avg'] * 100,
            benchmark.all_benchmarks['Hedge Fund avg'] * 100
        ],
        type: 'bar',
        marker: {
            color: ['#4F46E5', '#6B7280', '#10B981', '#F59E0B', '#EF4444']
        },
        text: [
            `${(summary.annual_turnover * 100).toFixed(1)}%`,
            `${(benchmark.rate * 100).toFixed(1)}%`,
            `${(benchmark.all_benchmarks['Mutual Fund avg'] * 100).toFixed(1)}%`,
            `${(benchmark.all_benchmarks['ETF avg'] * 100).toFixed(1)}%`,
            `${(benchmark.all_benchmarks['Hedge Fund avg'] * 100).toFixed(1)}%`
        ],
        textposition: 'auto'
    };
    
    const layout = {
        title: {
            text: 'Turnover Rate Comparison',
            font: { size: 16, color: '#1F2937' }
        },
        xaxis: {
            title: 'Portfolio Type'
        },
        yaxis: {
            title: 'Annual Turnover Rate (%)',
            tickformat: '.1f'
        },
        showlegend: false,
        margin: { t: 50, b: 80, l: 60, r: 50 },
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
    if (turnoverChart) {
        Plotly.purge(chartContainer);
    }
    
    Plotly.newPlot(chartContainer, [trace], layout, config);
    turnoverChart = true;
}

// Get turnover classification color
function getTurnoverColor(turnover) {
    if (turnover < 0.25) return 'text-green-600';
    if (turnover < 0.75) return 'text-yellow-600';
    if (turnover < 1.5) return 'text-orange-600';
    return 'text-red-600';
}

// Get turnover classification label
function getTurnoverLabel(turnover) {
    if (turnover < 0.25) return 'Low';
    if (turnover < 0.75) return 'Moderate';
    if (turnover < 1.5) return 'High';
    return 'Very High';
}

// Show Turnover Analysis error
function showTurnoverError(message) {
    const container = document.getElementById('turnoverAnalysis');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                <svg class="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="text-lg font-medium text-red-800 mb-2">Turnover Analysis Error</h3>
                <p class="text-red-600">${message}</p>
                <button onclick="updateTurnoverAnalysis()" class="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
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
window.toggleTurnoverSettings = toggleTurnoverSettings;
window.updateTurnoverAnalysis = updateTurnoverAnalysis;
window.loadTurnoverAnalysis = loadTurnoverAnalysis;