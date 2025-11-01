// Return Attribution Module
class ReturnAttribution {
    constructor() {
        this.currentData = null;
        this.isLoading = false;
    }

    async updateAnalysis() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this.showLoading();

            const transactions = await this.getTransactionData();
            if (!transactions || transactions.length === 0) {
                this.showError('No transaction data available. Please upload transaction data first.');
                return;
            }

            const options = this.getAnalysisOptions();
            
            const response = await fetch('/api/return-attribution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transactions: transactions,
                    options: options
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.currentData = result.return_attribution;
                this.renderAnalysis(result.return_attribution);
            } else {
                this.showError(result.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('Return attribution error:', error);
            this.showError('Failed to perform return attribution analysis: ' + error.message);
        } finally {
            this.isLoading = false;
        }
    }

    getAnalysisOptions() {
        return {
            period: document.getElementById('returnPeriod')?.value || '1Y',
            attribution: document.getElementById('returnAttribution')?.value || 'Asset Allocation',
            benchmark: document.getElementById('returnBenchmark')?.value || 'Index',
            frequency: document.getElementById('returnFrequency')?.value || 'Daily',
            currency: document.getElementById('returnCurrency')?.value || 'Local'
        };
    }

    async getTransactionData() {
        if (window.currentTransactionData && window.currentTransactionData.length > 0) {
            return window.currentTransactionData;
        }
        
        const transactionSelect = document.getElementById('transactionFileSelect');
        if (transactionSelect && transactionSelect.value) {
            try {
                const response = await fetch(`/api/get-transaction-file/${transactionSelect.value}`);
                if (response.ok) {
                    const data = await response.json();
                    return data.transactions || [];
                }
            } catch (error) {
                console.error('Error fetching transaction data:', error);
            }
        }
        
        return [];
    }

    renderAnalysis(data) {
        const container = document.getElementById('returnAttribution');
        if (!container) return;

        const html = `
            <div class="space-y-6">
                <!-- Summary Cards -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-blue-800 mb-1">Portfolio Return</h4>
                        <p class="text-2xl font-bold text-blue-600">${data.summary.portfolio_return.toFixed(2)}%</p>
                        <p class="text-xs text-blue-600 mt-1">${data.parameters.period}</p>
                    </div>
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-gray-800 mb-1">Benchmark Return</h4>
                        <p class="text-2xl font-bold text-gray-600">${data.summary.benchmark_return.toFixed(2)}%</p>
                        <p class="text-xs text-gray-600 mt-1">${data.summary.benchmark_symbol}</p>
                    </div>
                    <div class="bg-${data.summary.excess_return >= 0 ? 'green' : 'red'}-50 border border-${data.summary.excess_return >= 0 ? 'green' : 'red'}-200 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-${data.summary.excess_return >= 0 ? 'green' : 'red'}-800 mb-1">Excess Return</h4>
                        <p class="text-2xl font-bold text-${data.summary.excess_return >= 0 ? 'green' : 'red'}-600">${data.summary.excess_return >= 0 ? '+' : ''}${data.summary.excess_return.toFixed(2)}%</p>
                        <p class="text-xs text-${data.summary.excess_return >= 0 ? 'green' : 'red'}-600 mt-1">${data.summary.attribution_type}</p>
                    </div>
                </div>

                <!-- Attribution Breakdown Chart -->
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-lg font-semibold mb-4">${data.summary.attribution_type} Attribution</h4>
                    <div id="attributionChart" style="height: 400px;"></div>
                </div>

                <!-- Attribution Details Table -->
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-lg font-semibold mb-4">Attribution Breakdown</h4>
                    <div class="overflow-x-auto">
                        ${this.renderAttributionTable(data.attribution_breakdown, data.summary.attribution_type)}
                    </div>
                </div>

                <!-- Performance Chart -->
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-lg font-semibold mb-4">Portfolio Performance Over Time</h4>
                    <div id="performanceChart" style="height: 300px;"></div>
                </div>

                <!-- Analysis Parameters -->
                <div class="bg-gray-50 border rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Analysis Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                            <span class="text-gray-500">Period:</span>
                            <span class="ml-1 font-medium">${data.parameters.period}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Attribution:</span>
                            <span class="ml-1 font-medium">${data.parameters.attribution}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Benchmark:</span>
                            <span class="ml-1 font-medium">${data.parameters.benchmark}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Frequency:</span>
                            <span class="ml-1 font-medium">${data.parameters.frequency}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Currency:</span>
                            <span class="ml-1 font-medium">${data.parameters.currency}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        
        // Render charts
        this.renderAttributionChart(data.attribution_breakdown, data.summary.attribution_type);
        this.renderPerformanceChart(data.time_series);
    }

    renderAttributionTable(breakdown, attributionType) {
        if (!breakdown || Object.keys(breakdown).length === 0) {
            return '<p class="text-gray-500 text-center py-4">No attribution data available</p>';
        }

        let headers = [];
        let getRowData = null;

        if (attributionType === 'Asset Allocation') {
            headers = ['Symbol', 'Portfolio Weight', 'Benchmark Weight', 'Symbol Return', 'Allocation Effect'];
            getRowData = (symbol, data) => [
                symbol,
                `${(data.portfolio_weight * 100).toFixed(2)}%`,
                `${(data.benchmark_weight * 100).toFixed(2)}%`,
                `${data.symbol_return.toFixed(2)}%`,
                `${data.allocation_effect >= 0 ? '+' : ''}${data.allocation_effect.toFixed(2)}%`
            ];
        } else if (attributionType === 'Security Selection') {
            headers = ['Symbol', 'Portfolio Weight', 'Symbol Return', 'Benchmark Return', 'Selection Effect'];
            getRowData = (symbol, data) => [
                symbol,
                `${(data.portfolio_weight * 100).toFixed(2)}%`,
                `${data.symbol_return.toFixed(2)}%`,
                `${data.benchmark_return.toFixed(2)}%`,
                `${data.selection_effect >= 0 ? '+' : ''}${data.selection_effect.toFixed(2)}%`
            ];
        } else { // Timing
            headers = ['Symbol', 'Average Weight', 'Weight Volatility', 'Timing Effect'];
            getRowData = (symbol, data) => [
                symbol,
                `${(data.avg_weight * 100).toFixed(2)}%`,
                `${(data.weight_volatility * 100).toFixed(2)}%`,
                `${data.timing_effect >= 0 ? '+' : ''}${data.timing_effect.toFixed(2)}%`
            ];
        }

        const headerRow = headers.map(h => `<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">${h}</th>`).join('');
        
        const rows = Object.entries(breakdown).map(([symbol, data]) => {
            const rowData = getRowData(symbol, data);
            return `<tr>${rowData.map(cell => `<td class="px-4 py-2 text-sm text-gray-900">${cell}</td>`).join('')}</tr>`;
        }).join('');

        return `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>${headerRow}</tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${rows}
                </tbody>
            </table>
        `;
    }

    renderAttributionChart(breakdown, attributionType) {
        if (!breakdown || Object.keys(breakdown).length === 0) return;

        const symbols = Object.keys(breakdown);
        let values = [];
        let title = '';

        if (attributionType === 'Asset Allocation') {
            values = symbols.map(symbol => breakdown[symbol].allocation_effect);
            title = 'Allocation Effect by Symbol';
        } else if (attributionType === 'Security Selection') {
            values = symbols.map(symbol => breakdown[symbol].selection_effect);
            title = 'Selection Effect by Symbol';
        } else {
            values = symbols.map(symbol => breakdown[symbol].timing_effect);
            title = 'Timing Effect by Symbol';
        }

        const colors = values.map(v => v >= 0 ? '#10B981' : '#EF4444');

        const trace = {
            x: symbols,
            y: values,
            type: 'bar',
            marker: {
                color: colors
            },
            text: values.map(v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`),
            textposition: 'outside'
        };

        const layout = {
            title: {
                text: title,
                font: { size: 16 }
            },
            xaxis: {
                title: 'Symbol'
            },
            yaxis: {
                title: 'Effect (%)',
                tickformat: '.2f'
            },
            margin: { t: 50, r: 30, b: 50, l: 50 }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            displaylogo: false
        };

        Plotly.newPlot('attributionChart', [trace], layout, config);
    }

    renderPerformanceChart(timeSeriesData) {
        if (!timeSeriesData || timeSeriesData.length === 0) return;

        const dates = timeSeriesData.map(d => d.date);
        const values = timeSeriesData.map(d => d.portfolio_value);

        // Calculate cumulative returns
        const initialValue = values[0];
        const cumulativeReturns = values.map(v => ((v / initialValue - 1) * 100));

        const trace = {
            x: dates,
            y: cumulativeReturns,
            type: 'scatter',
            mode: 'lines',
            name: 'Portfolio Return',
            line: { color: '#3B82F6', width: 2 }
        };

        const layout = {
            title: {
                text: 'Cumulative Portfolio Return',
                font: { size: 16 }
            },
            xaxis: {
                title: 'Date',
                type: 'date'
            },
            yaxis: {
                title: 'Cumulative Return (%)',
                tickformat: '.1f'
            },
            hovermode: 'x unified',
            margin: { t: 50, r: 30, b: 50, l: 50 }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            displaylogo: false
        };

        Plotly.newPlot('performanceChart', [trace], layout, config);
    }

    showLoading() {
        const container = document.getElementById('returnAttribution');
        if (container) {
            container.innerHTML = `
                <div class="flex items-center justify-center py-12">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span class="ml-3 text-gray-600">Analyzing return attribution...</span>
                </div>
            `;
        }
    }

    showError(message) {
        const container = document.getElementById('returnAttribution');
        if (container) {
            container.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <h3 class="text-sm font-medium text-red-800">Analysis Error</h3>
                            <p class="mt-1 text-sm text-red-700">${message}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

// Global functions for UI interaction
function toggleReturnAttributionSettings() {
    const settings = document.getElementById('returnAttributionSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function updateReturnAttribution() {
    if (window.returnAttribution) {
        window.returnAttribution.updateAnalysis();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.returnAttribution = new ReturnAttribution();
});

// Auto-update when transaction data changes
document.addEventListener('transactionDataUpdated', function() {
    if (window.returnAttribution && !document.getElementById('returnAttributionSettings').classList.contains('hidden')) {
        window.returnAttribution.updateAnalysis();
    }
});