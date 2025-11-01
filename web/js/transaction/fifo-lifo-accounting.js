// FIFO/LIFO Accounting Analysis Module
class FifoLifoAccountingAnalyzer {
    constructor() {
        this.currentData = null;
        this.isLoading = false;
    }

    async analyzeFifoLifoAccounting(transactions, options = {}) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const container = document.getElementById('fifoLifoAnalysis');
        
        try {
            // Show loading state
            container.innerHTML = `
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                    <span class="text-gray-600">Analyzing accounting methods...</span>
                </div>
            `;

            const response = await fetch(`${API_BASE}/fifo-lifo-accounting`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transactions: transactions,
                    options: options
                })
            });

            const data = await response.json();

            if (data.success) {
                this.currentData = data.fifo_lifo_analysis;
                this.renderAnalysis(this.currentData);
            } else {
                throw new Error(data.error || 'Analysis failed');
            }

        } catch (error) {
            console.error('FIFO/LIFO Accounting analysis error:', error);
            container.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                        </svg>
                        <span class="text-red-800">Error: ${error.message}</span>
                    </div>
                </div>
            `;
        } finally {
            this.isLoading = false;
        }
    }

    renderAnalysis(data) {
        const container = document.getElementById('fifoLifoAnalysis');
        
        container.innerHTML = `
            <div class="space-y-6">
                ${this.renderSummaryCards(data.summary)}
                ${this.renderMethodComparison(data.method_results, data.comparison_analysis)}
                ${this.renderSymbolBreakdown(data.symbol_breakdown)}
                ${this.renderTaxImpactChart(data.method_results)}
            </div>
        `;
    }

    renderSummaryCards(summary) {
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-blue-600">Method</p>
                            <p class="text-2xl font-bold text-blue-900">${summary.method}</p>
                        </div>
                        <div class="p-2 bg-blue-200 rounded-lg">
                            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-green-600">Total Gain/Loss</p>
                            <p class="text-2xl font-bold ${summary.total_realized_gain_loss >= 0 ? 'text-green-900' : 'text-red-900'}">
                                ${this.formatCurrency(summary.total_realized_gain_loss)}
                            </p>
                        </div>
                        <div class="p-2 bg-green-200 rounded-lg">
                            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-yellow-600">Short-term G/L</p>
                            <p class="text-2xl font-bold ${summary.short_term_gain_loss >= 0 ? 'text-green-900' : 'text-red-900'}">
                                ${this.formatCurrency(summary.short_term_gain_loss)}
                            </p>
                        </div>
                        <div class="p-2 bg-yellow-200 rounded-lg">
                            <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-purple-600">Tax Liability</p>
                            <p class="text-2xl font-bold text-purple-900">${this.formatCurrency(summary.tax_liability)}</p>
                        </div>
                        <div class="p-2 bg-purple-200 rounded-lg">
                            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"></path>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderMethodComparison(methodResults, comparisonAnalysis) {
        if (Object.keys(methodResults).length <= 1) {
            return '';
        }

        const methods = Object.keys(methodResults);
        const comparisonRows = methods.map(method => {
            const result = methodResults[method];
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${method}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${result.total_realized_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${this.formatCurrency(result.total_realized_gain_loss)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${result.short_term_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${this.formatCurrency(result.short_term_gain_loss)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${result.long_term_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${this.formatCurrency(result.long_term_gain_loss)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${this.formatCurrency(result.tax_liability)}
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-900">Method Comparison</h3>
                    <p class="text-sm text-gray-600 mt-1">Compare different accounting methods</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total G/L</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Short-term</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Long-term</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Liability</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${comparisonRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderSymbolBreakdown(symbolBreakdown) {
        const symbols = Object.keys(symbolBreakdown);
        if (symbols.length === 0) {
            return '';
        }

        const symbolRows = symbols.map(symbol => {
            const data = symbolBreakdown[symbol];
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${symbol}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${data.realized_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${this.formatCurrency(data.realized_gain_loss)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${data.short_term_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${this.formatCurrency(data.short_term_gain_loss)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${data.long_term_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${this.formatCurrency(data.long_term_gain_loss)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${data.remaining_positions}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatNumber(data.remaining_quantity)}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-900">Symbol Breakdown</h3>
                    <p class="text-sm text-gray-600 mt-1">Detailed analysis by symbol</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Realized G/L</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Short-term</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Long-term</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Positions</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${symbolRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderTaxImpactChart(methodResults) {
        const chartId = 'fifoLifoTaxChart';
        
        setTimeout(() => {
            const methods = Object.keys(methodResults);
            const taxData = methods.map(method => methodResults[method].tax_liability);
            const gainData = methods.map(method => methodResults[method].total_realized_gain_loss);

            const trace1 = {
                x: methods,
                y: taxData,
                type: 'bar',
                name: 'Tax Liability',
                marker: { color: '#ef4444' }
            };

            const trace2 = {
                x: methods,
                y: gainData,
                type: 'bar',
                name: 'Total Gain/Loss',
                marker: { color: '#10b981' },
                yaxis: 'y2'
            };

            const layout = {
                title: 'Tax Impact by Accounting Method',
                xaxis: { title: 'Accounting Method' },
                yaxis: { 
                    title: 'Tax Liability ($)',
                    side: 'left'
                },
                yaxis2: {
                    title: 'Total Gain/Loss ($)',
                    side: 'right',
                    overlaying: 'y'
                },
                showlegend: true,
                height: 400,
                margin: { t: 50, r: 50, b: 50, l: 50 }
            };

            Plotly.newPlot(chartId, [trace1, trace2], layout, {
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
            });
        }, 100);

        return `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-900">Tax Impact Analysis</h3>
                    <p class="text-sm text-gray-600 mt-1">Compare tax implications across methods</p>
                </div>
                <div class="p-6">
                    <div id="${chartId}"></div>
                </div>
            </div>
        `;
    }

    formatCurrency(value) {
        if (value === null || value === undefined || isNaN(value)) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    formatNumber(value) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(value);
    }
}

// Global functions for UI interaction
function toggleFifoLifoSettings() {
    const settings = document.getElementById('fifoLifoSettings');
    settings.classList.toggle('hidden');
}

function updateFifoLifoAnalysis() {
    const transactions = window.currentTransactionData;
    if (!transactions || transactions.length === 0) {
        alert('Please upload transaction data first');
        return;
    }

    const options = {
        method: document.getElementById('accountingMethod').value,
        period: document.getElementById('accountingPeriod').value,
        tax_impact: document.getElementById('accountingTaxImpact').value,
        comparison: document.getElementById('accountingComparison').value,
        optimization: document.getElementById('accountingOptimization').value
    };

    const analyzer = new FifoLifoAccountingAnalyzer();
    analyzer.analyzeFifoLifoAccounting(transactions, options);
}

// Initialize analyzer
window.fifoLifoAccountingAnalyzer = new FifoLifoAccountingAnalyzer();