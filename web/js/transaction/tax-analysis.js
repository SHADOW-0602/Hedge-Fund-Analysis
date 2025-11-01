/**
 * Tax Analysis Module
 * Provides comprehensive tax analysis with interactive parameters
 */

// Global variables
let currentTaxData = null;

// Toggle settings panel
function toggleTaxSettings() {
    const settings = document.getElementById('taxSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update tax analysis with current parameters
async function updateTaxAnalysis() {
    try {
        const transactions = getCurrentTransactions();
        if (!transactions || transactions.length === 0) {
            displayTaxError('No transaction data available. Please upload transaction data first.');
            return;
        }

        // Get interactive parameters
        const options = {
            tax_year: document.getElementById('taxYear')?.value || 'Current',
            holding_period: document.getElementById('taxHoldingPeriod')?.value || 'All',
            tax_rate: document.getElementById('taxRate')?.value || 'Federal',
            wash_sale: document.getElementById('taxWashSale')?.value || 'Include',
            harvesting: document.getElementById('taxHarvesting')?.value || 'Opportunities'
        };

        console.log('Tax Analysis - Sending request with options:', options);
        
        // Show loading state
        showTaxLoading();

        const response = await fetch(`${API_BASE}/tax-analysis`, {
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
        console.log('Tax Analysis - API Response:', data);

        if (data.success && data.tax_analysis) {
            currentTaxData = data.tax_analysis;
            displayTaxResults(data.tax_analysis);
        } else {
            displayTaxError(data.error || 'Tax analysis failed');
        }

    } catch (error) {
        console.error('Tax Analysis Error:', error);
        displayTaxError('Failed to perform tax analysis: ' + error.message);
    }
}

// Show loading state
function showTaxLoading() {
    const container = document.getElementById('taxAnalysis');
    if (container) {
        container.innerHTML = `
            <div class="flex items-center justify-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                <span class="text-gray-600">Analyzing tax implications...</span>
            </div>
        `;
    }
}

// Display tax analysis results
function displayTaxResults(results) {
    const container = document.getElementById('taxAnalysis');
    if (!container || !results) return;

    const summary = results.summary || {};
    const realizedGains = results.realized_gains || [];
    const washSales = results.wash_sales || [];
    const harvestingOps = results.harvesting_opportunities || [];
    const symbolSummary = results.symbol_summary || {};
    const taxRates = results.tax_rates || {};

    container.innerHTML = `
        <!-- Tax Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <h4 class="text-sm font-medium text-green-800 mb-1">Total Realized P&L</h4>
                <p class="text-2xl font-bold ${summary.total_realized_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${formatCurrency(summary.total_realized_gain_loss || 0)}
                </p>
                <p class="text-xs text-green-600 mt-1">Tax Year ${summary.tax_year || 'Current'}</p>
            </div>
            
            <div class="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <h4 class="text-sm font-medium text-blue-800 mb-1">Tax Liability</h4>
                <p class="text-2xl font-bold text-blue-600">
                    ${formatCurrency(summary.total_tax_liability || 0)}
                </p>
                <p class="text-xs text-blue-600 mt-1">Effective Rate: ${(summary.effective_tax_rate || 0).toFixed(1)}%</p>
            </div>
            
            <div class="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <h4 class="text-sm font-medium text-purple-800 mb-1">Short-term P&L</h4>
                <p class="text-2xl font-bold ${summary.short_term_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${formatCurrency(summary.short_term_gain_loss || 0)}
                </p>
                <p class="text-xs text-purple-600 mt-1">Tax: ${formatCurrency(summary.short_term_tax || 0)}</p>
            </div>
            
            <div class="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                <h4 class="text-sm font-medium text-orange-800 mb-1">Long-term P&L</h4>
                <p class="text-2xl font-bold ${summary.long_term_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${formatCurrency(summary.long_term_gain_loss || 0)}
                </p>
                <p class="text-xs text-orange-600 mt-1">Tax: ${formatCurrency(summary.long_term_tax || 0)}</p>
            </div>
        </div>

        <!-- Tax Rates Information -->
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 class="text-lg font-semibold text-gray-900 mb-3">Tax Rate Information</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-center">
                    <p class="text-sm text-gray-600">Tax Rate Type</p>
                    <p class="text-lg font-semibold text-gray-900">${taxRates.type || 'Federal'}</p>
                </div>
                <div class="text-center">
                    <p class="text-sm text-gray-600">Short-term Rate</p>
                    <p class="text-lg font-semibold text-red-600">${(taxRates.short_term_rate || 0).toFixed(1)}%</p>
                </div>
                <div class="text-center">
                    <p class="text-sm text-gray-600">Long-term Rate</p>
                    <p class="text-lg font-semibold text-green-600">${(taxRates.long_term_rate || 0).toFixed(1)}%</p>
                </div>
            </div>
        </div>

        <!-- Charts Container -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <!-- Gain/Loss Distribution Chart -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">Gain/Loss Distribution</h4>
                <div id="taxGainLossChart" style="height: 300px;"></div>
            </div>
            
            <!-- Holding Period Analysis -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">Holding Period Analysis</h4>
                <div id="taxHoldingChart" style="height: 300px;"></div>
            </div>
        </div>

        <!-- Detailed Tables -->
        <div class="space-y-6">
            ${washSales.length > 0 ? createWashSalesTable(washSales) : ''}
            ${harvestingOps.length > 0 ? createHarvestingTable(harvestingOps) : ''}
            ${createSymbolSummaryTable(symbolSummary)}
            ${createRealizedGainsTable(realizedGains.slice(0, 20))}
        </div>
    `;

    // Create charts
    createTaxCharts(results);
}

// Create wash sales table
function createWashSalesTable(washSales) {
    return `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 class="text-lg font-semibold text-red-800 mb-3">
                Wash Sales (${washSales.length})
                <span class="text-sm font-normal text-red-600 ml-2">- Disallowed Losses</span>
            </h4>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-red-200">
                    <thead class="bg-red-100">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase">Symbol</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase">Sale Date</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase">Loss Amount</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase">Disallowed</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-red-200">
                        ${washSales.map(ws => `
                            <tr>
                                <td class="px-4 py-2 text-sm font-medium text-gray-900">${ws.symbol}</td>
                                <td class="px-4 py-2 text-sm text-gray-600">${formatDate(ws.sale_date)}</td>
                                <td class="px-4 py-2 text-sm text-red-600">${formatCurrency(ws.loss_amount)}</td>
                                <td class="px-4 py-2 text-sm text-red-600">${formatCurrency(ws.disallowed_loss)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Create tax loss harvesting table
function createHarvestingTable(opportunities) {
    return `
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 class="text-lg font-semibold text-green-800 mb-3">
                Tax Loss Harvesting Opportunities (${opportunities.length})
                <span class="text-sm font-normal text-green-600 ml-2">- Potential Tax Savings</span>
            </h4>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-green-200">
                    <thead class="bg-green-100">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-green-800 uppercase">Symbol</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-green-800 uppercase">Quantity</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-green-800 uppercase">Cost Basis</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-green-800 uppercase">Current Price</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-green-800 uppercase">Unrealized Loss</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-green-800 uppercase">Tax Savings</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-green-800 uppercase">Term</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-green-200">
                        ${opportunities.map(opp => `
                            <tr>
                                <td class="px-4 py-2 text-sm font-medium text-gray-900">${opp.symbol}</td>
                                <td class="px-4 py-2 text-sm text-gray-600">${opp.quantity.toFixed(0)}</td>
                                <td class="px-4 py-2 text-sm text-gray-600">${formatCurrency(opp.cost_basis)}</td>
                                <td class="px-4 py-2 text-sm text-gray-600">${formatCurrency(opp.current_price)}</td>
                                <td class="px-4 py-2 text-sm text-red-600">${formatCurrency(opp.unrealized_loss)}</td>
                                <td class="px-4 py-2 text-sm text-green-600">${formatCurrency(opp.tax_savings)}</td>
                                <td class="px-4 py-2 text-sm ${opp.is_long_term ? 'text-green-600' : 'text-orange-600'}">
                                    ${opp.is_long_term ? 'Long' : 'Short'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Create symbol summary table
function createSymbolSummaryTable(symbolSummary) {
    const symbols = Object.keys(symbolSummary);
    if (symbols.length === 0) return '';

    return `
        <div class="bg-white border rounded-lg p-4">
            <h4 class="text-lg font-semibold text-gray-900 mb-3">Tax Summary by Symbol</h4>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total P&L</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Short-term</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Long-term</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Wash Sales</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${symbols.map(symbol => {
                            const data = symbolSummary[symbol];
                            return `
                                <tr>
                                    <td class="px-4 py-2 text-sm font-medium text-gray-900">${symbol}</td>
                                    <td class="px-4 py-2 text-sm ${data.total_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                                        ${formatCurrency(data.total_gain_loss)}
                                    </td>
                                    <td class="px-4 py-2 text-sm ${data.short_term_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                                        ${formatCurrency(data.short_term_gain_loss)}
                                    </td>
                                    <td class="px-4 py-2 text-sm ${data.long_term_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                                        ${formatCurrency(data.long_term_gain_loss)}
                                    </td>
                                    <td class="px-4 py-2 text-sm text-gray-600">${data.transactions}</td>
                                    <td class="px-4 py-2 text-sm ${data.wash_sales > 0 ? 'text-red-600' : 'text-gray-600'}">
                                        ${data.wash_sales}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Create realized gains table
function createRealizedGainsTable(gains) {
    if (gains.length === 0) return '';

    return `
        <div class="bg-white border rounded-lg p-4">
            <h4 class="text-lg font-semibold text-gray-900 mb-3">
                Recent Realized Gains/Losses (Top 20)
            </h4>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Purchase</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sale</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">P&L</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Days Held</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Wash Sale</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${gains.map(gain => `
                            <tr class="${gain.is_wash_sale ? 'bg-red-50' : ''}">
                                <td class="px-3 py-2 text-sm font-medium text-gray-900">${gain.symbol}</td>
                                <td class="px-3 py-2 text-sm text-gray-600">${gain.quantity.toFixed(0)}</td>
                                <td class="px-3 py-2 text-sm text-gray-600">${formatDate(gain.purchase_date)}</td>
                                <td class="px-3 py-2 text-sm text-gray-600">${formatDate(gain.sale_date)}</td>
                                <td class="px-3 py-2 text-sm ${gain.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    ${formatCurrency(gain.gain_loss)}
                                </td>
                                <td class="px-3 py-2 text-sm text-gray-600">${gain.holding_days}</td>
                                <td class="px-3 py-2 text-sm ${gain.is_long_term ? 'text-green-600' : 'text-orange-600'}">
                                    ${gain.is_long_term ? 'Long' : 'Short'}
                                </td>
                                <td class="px-3 py-2 text-sm ${gain.is_wash_sale ? 'text-red-600' : 'text-gray-400'}">
                                    ${gain.is_wash_sale ? 'Yes' : 'No'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Create tax analysis charts
function createTaxCharts(results) {
    const summary = results.summary || {};
    const realizedGains = results.realized_gains || [];

    // Gain/Loss Distribution Chart
    const gainLossData = [{
        x: ['Short-term Gains', 'Short-term Losses', 'Long-term Gains', 'Long-term Losses'],
        y: [
            Math.max(0, summary.short_term_gain_loss || 0),
            Math.abs(Math.min(0, summary.short_term_gain_loss || 0)),
            Math.max(0, summary.long_term_gain_loss || 0),
            Math.abs(Math.min(0, summary.long_term_gain_loss || 0))
        ],
        type: 'bar',
        marker: {
            color: ['#10B981', '#EF4444', '#059669', '#DC2626']
        },
        text: [
            formatCurrency(Math.max(0, summary.short_term_gain_loss || 0)),
            formatCurrency(Math.abs(Math.min(0, summary.short_term_gain_loss || 0))),
            formatCurrency(Math.max(0, summary.long_term_gain_loss || 0)),
            formatCurrency(Math.abs(Math.min(0, summary.long_term_gain_loss || 0)))
        ],
        textposition: 'auto'
    }];

    const gainLossLayout = {
        title: 'Realized Gains & Losses',
        xaxis: { title: 'Category' },
        yaxis: { title: 'Amount ($)' },
        showlegend: false,
        margin: { t: 40, r: 20, b: 60, l: 60 }
    };

    Plotly.newPlot('taxGainLossChart', gainLossData, gainLossLayout, {responsive: true});

    // Holding Period Analysis
    const shortTermCount = realizedGains.filter(g => !g.is_long_term).length;
    const longTermCount = realizedGains.filter(g => g.is_long_term).length;

    const holdingData = [{
        labels: ['Short-term (<1 year)', 'Long-term (>1 year)'],
        values: [shortTermCount, longTermCount],
        type: 'pie',
        marker: {
            colors: ['#F59E0B', '#10B981']
        },
        textinfo: 'label+percent+value',
        textposition: 'auto'
    }];

    const holdingLayout = {
        title: 'Trades by Holding Period',
        showlegend: true,
        margin: { t: 40, r: 20, b: 20, l: 20 }
    };

    Plotly.newPlot('taxHoldingChart', holdingData, holdingLayout, {responsive: true});
}

// Display error message
function displayTaxError(message) {
    const container = document.getElementById('taxAnalysis');
    if (container) {
        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <div class="flex items-center">
                    <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-red-800 font-medium">Tax Analysis Error</span>
                </div>
                <p class="text-red-700 mt-2">${message}</p>
            </div>
        `;
    }
}

// Get current transactions from global state
function getCurrentTransactions() {
    // This should be implemented to get transactions from the current state
    // For now, return empty array - this will be connected to the main app state
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

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return 'N/A';
    }
}

// Initialize tax analysis when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Tax Analysis module loaded');
});

// Export functions for global access
window.toggleTaxSettings = toggleTaxSettings;
window.updateTaxAnalysis = updateTaxAnalysis;