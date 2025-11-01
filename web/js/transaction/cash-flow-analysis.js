/**
 * Cash Flow Analysis Module
 * Provides comprehensive cash flow analysis with interactive parameters
 */

// Global variables
let currentCashFlowData = null;

// Toggle settings panel
function toggleCashFlowSettings() {
    const settings = document.getElementById('cashFlowSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update cash flow analysis with current parameters
async function updateCashFlowAnalysis() {
    try {
        const transactions = getCurrentTransactions();
        if (!transactions || transactions.length === 0) {
            displayCashFlowError('No transaction data available. Please upload transaction data first.');
            return;
        }

        // Get interactive parameters
        const options = {
            period: document.getElementById('cashFlowPeriod')?.value || '1Y',
            flow_type: document.getElementById('cashFlowType')?.value || 'Net',
            frequency: document.getElementById('cashFlowFrequency')?.value || 'Monthly',
            smoothing: document.getElementById('cashFlowSmoothing')?.value || 'None',
            benchmark: document.getElementById('cashFlowBenchmark')?.value || 'Cash yield'
        };

        console.log('Cash Flow Analysis - Sending request with options:', options);
        
        // Show loading state
        showCashFlowLoading();

        const response = await fetch(`${API_BASE}/cash-flow-analysis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transactions: transactions,
                options: options
            })
        });

        const data = await response.json();
        console.log('Cash Flow Analysis - API Response:', data);

        if (data.success && data.cash_flow_analysis) {
            currentCashFlowData = data.cash_flow_analysis;
            displayCashFlowResults(data.cash_flow_analysis);
        } else {
            displayCashFlowError(data.error || 'Cash flow analysis failed');
        }

    } catch (error) {
        console.error('Cash Flow Analysis Error:', error);
        displayCashFlowError('Failed to perform cash flow analysis: ' + error.message);
    }
}

// Show loading state
function showCashFlowLoading() {
    const container = document.getElementById('cashFlowAnalysis');
    if (container) {
        container.innerHTML = `
            <div class="flex items-center justify-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                <span class="text-gray-600">Analyzing cash flows...</span>
            </div>
        `;
    }
}

// Display cash flow analysis results
function displayCashFlowResults(results) {
    const container = document.getElementById('cashFlowAnalysis');
    if (!container || !results) return;

    const summary = results.summary || {};
    const flowPatterns = results.flow_patterns || {};
    const benchmark = results.benchmark_comparison || {};
    const timeSeries = results.time_series || [];
    const parameters = results.parameters || {};

    container.innerHTML = `
        <!-- Cash Flow Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <h4 class="text-sm font-medium text-green-800 mb-1">Total Inflows</h4>
                <p class="text-2xl font-bold text-green-600">
                    ${formatCurrency(summary.total_inflows || 0)}
                </p>
                <p class="text-xs text-green-600 mt-1">Cash received</p>
            </div>
            
            <div class="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                <h4 class="text-sm font-medium text-red-800 mb-1">Total Outflows</h4>
                <p class="text-2xl font-bold text-red-600">
                    ${formatCurrency(summary.total_outflows || 0)}
                </p>
                <p class="text-xs text-red-600 mt-1">Cash invested</p>
            </div>
            
            <div class="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <h4 class="text-sm font-medium text-blue-800 mb-1">Net Cash Flow</h4>
                <p class="text-2xl font-bold ${summary.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${formatCurrency(summary.net_cash_flow || 0)}
                </p>
                <p class="text-xs text-blue-600 mt-1">Net position</p>
            </div>
            
            <div class="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <h4 class="text-sm font-medium text-purple-800 mb-1">Cash Flow Return</h4>
                <p class="text-2xl font-bold ${summary.cash_flow_return >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${(summary.cash_flow_return * 100 || 0).toFixed(1)}%
                </p>
                <p class="text-xs text-purple-600 mt-1">Annualized</p>
            </div>
        </div>

        <!-- Benchmark Comparison -->
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 class="text-lg font-semibold text-gray-900 mb-3">Benchmark Comparison</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-center">
                    <p class="text-sm text-gray-600">Benchmark</p>
                    <p class="text-lg font-semibold text-gray-900">${benchmark.benchmark_type || 'Cash yield'}</p>
                    <p class="text-sm text-gray-600">${(benchmark.benchmark_rate * 100 || 0).toFixed(1)}%</p>
                </div>
                <div class="text-center">
                    <p class="text-sm text-gray-600">Your Return</p>
                    <p class="text-lg font-semibold ${benchmark.cash_flow_return >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${(benchmark.cash_flow_return * 100 || 0).toFixed(1)}%
                    </p>
                </div>
                <div class="text-center">
                    <p class="text-sm text-gray-600">Excess Return</p>
                    <p class="text-lg font-semibold ${benchmark.excess_return >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${benchmark.excess_return >= 0 ? '+' : ''}${(benchmark.excess_return * 100 || 0).toFixed(1)}%
                    </p>
                </div>
            </div>
        </div>

        <!-- Charts Container -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <!-- Cash Flow Time Series Chart -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">Cash Flow Over Time</h4>
                <div id="cashFlowTimeSeriesChart" style="height: 300px;"></div>
            </div>
            
            <!-- Flow Patterns Chart -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">Flow Patterns</h4>
                <div id="cashFlowPatternsChart" style="height: 300px;"></div>
            </div>
        </div>

        <!-- Detailed Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Flow Statistics -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">Flow Statistics</h4>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Average Monthly Inflow:</span>
                        <span class="font-medium text-green-600">${formatCurrency(summary.avg_monthly_inflow || 0)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Average Monthly Outflow:</span>
                        <span class="font-medium text-red-600">${formatCurrency(summary.avg_monthly_outflow || 0)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Cash Flow Volatility:</span>
                        <span class="font-medium text-gray-900">${formatCurrency(summary.cash_flow_volatility || 0)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Largest Single Inflow:</span>
                        <span class="font-medium text-green-600">${formatCurrency(summary.largest_inflow || 0)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Largest Single Outflow:</span>
                        <span class="font-medium text-red-600">${formatCurrency(summary.largest_outflow || 0)}</span>
                    </div>
                </div>
            </div>

            <!-- Flow Patterns -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">Flow Patterns</h4>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Positive Flow Periods:</span>
                        <span class="font-medium text-green-600">${flowPatterns.positive_flow_periods || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Negative Flow Periods:</span>
                        <span class="font-medium text-red-600">${flowPatterns.negative_flow_periods || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Total Periods:</span>
                        <span class="font-medium text-gray-900">${flowPatterns.total_periods || 0}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Positive Flow Ratio:</span>
                        <span class="font-medium ${flowPatterns.positive_flow_ratio >= 0.5 ? 'text-green-600' : 'text-red-600'}">
                            ${(flowPatterns.positive_flow_ratio * 100 || 0).toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Parameters Summary -->
        <div class="mt-6 bg-gray-50 rounded-lg p-4">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Analysis Parameters</h4>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                    <span class="text-gray-600">Period:</span>
                    <span class="ml-1 font-medium">${parameters.period || 'N/A'}</span>
                </div>
                <div>
                    <span class="text-gray-600">Flow Type:</span>
                    <span class="ml-1 font-medium">${parameters.flow_type || 'N/A'}</span>
                </div>
                <div>
                    <span class="text-gray-600">Frequency:</span>
                    <span class="ml-1 font-medium">${parameters.frequency || 'N/A'}</span>
                </div>
                <div>
                    <span class="text-gray-600">Smoothing:</span>
                    <span class="ml-1 font-medium">${parameters.smoothing || 'N/A'}</span>
                </div>
                <div>
                    <span class="text-gray-600">Benchmark:</span>
                    <span class="ml-1 font-medium">${parameters.benchmark || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;

    // Create charts
    createCashFlowCharts(results);
}

// Create cash flow charts
function createCashFlowCharts(results) {
    const timeSeries = results.time_series || [];
    const flowPatterns = results.flow_patterns || {};
    const parameters = results.parameters || {};

    // Time Series Chart
    if (timeSeries.length > 0) {
        const dates = timeSeries.map(d => d.date);
        const netFlows = timeSeries.map(d => d.net_flow);
        const inflows = timeSeries.map(d => d.inflows);
        const outflows = timeSeries.map(d => d.outflows.map ? d.outflows : -Math.abs(d.outflows));

        const timeSeriesData = [];
        
        // Add net flows if selected or default
        if (parameters.flow_type === 'Net' || !parameters.flow_type) {
            timeSeriesData.push({
                x: dates,
                y: netFlows,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Net Cash Flow',
                line: { color: '#3B82F6', width: 2 },
                marker: { size: 4 }
            });
        }
        
        // Add inflows if selected
        if (parameters.flow_type === 'Inflows') {
            timeSeriesData.push({
                x: dates,
                y: inflows,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Inflows',
                line: { color: '#10B981', width: 2 },
                marker: { size: 4 }
            });
        }
        
        // Add outflows if selected
        if (parameters.flow_type === 'Outflows') {
            timeSeriesData.push({
                x: dates,
                y: outflows,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Outflows',
                line: { color: '#EF4444', width: 2 },
                marker: { size: 4 }
            });
        }

        const timeSeriesLayout = {
            title: `Cash Flow - ${parameters.frequency || 'Monthly'} ${parameters.smoothing !== 'None' ? `(${parameters.smoothing})` : ''}`,
            xaxis: { title: 'Date' },
            yaxis: { title: 'Cash Flow ($)' },
            showlegend: true,
            margin: { t: 40, r: 20, b: 60, l: 80 }
        };

        Plotly.newPlot('cashFlowTimeSeriesChart', timeSeriesData, timeSeriesLayout, {responsive: true});
    }

    // Flow Patterns Pie Chart
    const patternsData = [{
        labels: ['Positive Flow Periods', 'Negative Flow Periods'],
        values: [flowPatterns.positive_flow_periods || 0, flowPatterns.negative_flow_periods || 0],
        type: 'pie',
        marker: {
            colors: ['#10B981', '#EF4444']
        },
        textinfo: 'label+percent+value',
        textposition: 'auto'
    }];

    const patternsLayout = {
        title: 'Cash Flow Period Distribution',
        showlegend: true,
        margin: { t: 40, r: 20, b: 20, l: 20 }
    };

    Plotly.newPlot('cashFlowPatternsChart', patternsData, patternsLayout, {responsive: true});
}

// Display error message
function displayCashFlowError(message) {
    const container = document.getElementById('cashFlowAnalysis');
    if (container) {
        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <div class="flex items-center">
                    <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-red-800 font-medium">Cash Flow Analysis Error</span>
                </div>
                <p class="text-red-700 mt-2">${message}</p>
            </div>
        `;
    }
}

// Get current transactions from global state
function getCurrentTransactions() {
    return window.currentTransactions || [];
}

// Utility functions
function formatCurrency(amount) {
    if (typeof amount !== 'number') return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Initialize cash flow analysis when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Cash Flow Analysis module loaded');
});

// Export functions for global access
window.toggleCashFlowSettings = toggleCashFlowSettings;
window.updateCashFlowAnalysis = updateCashFlowAnalysis;