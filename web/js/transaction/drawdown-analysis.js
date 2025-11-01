// Drawdown Analysis Module
class DrawdownAnalysis {
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
            
            const response = await fetch(`${API_BASE}/drawdown-analysis`, {
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
                this.currentData = result.drawdown_analysis;
                this.renderAnalysis(result.drawdown_analysis);
            } else {
                this.showError(result.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('Drawdown analysis error:', error);
            this.showError('Failed to perform drawdown analysis: ' + error.message);
        } finally {
            this.isLoading = false;
        }
    }

    getAnalysisOptions() {
        return {
            period: document.getElementById('drawdownPeriod')?.value || '1Y',
            frequency: document.getElementById('drawdownFrequency')?.value || 'Daily',
            recovery_time: document.getElementById('drawdownRecovery')?.value || 'Days',
            severity: document.getElementById('drawdownSeverity')?.value || 'All',
            comparison: document.getElementById('drawdownComparison')?.value || 'None'
        };
    }

    async getTransactionData() {
        // Get transaction data from the global state or API
        if (window.currentTransactionData && window.currentTransactionData.length > 0) {
            return window.currentTransactionData;
        }
        
        // Try to get from uploaded files
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
        const container = document.getElementById('drawdownAnalysis');
        if (!container) return;

        const html = `
            <div class="space-y-6">
                <!-- Summary Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-red-800 mb-1">Max Drawdown</h4>
                        <p class="text-2xl font-bold text-red-600">${data.summary.max_drawdown_pct.toFixed(2)}%</p>
                        <p class="text-xs text-red-600 mt-1">${data.summary.max_drawdown_start || 'N/A'}</p>
                    </div>
                    <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-orange-800 mb-1">Avg Drawdown</h4>
                        <p class="text-2xl font-bold text-orange-600">${data.summary.avg_drawdown_pct.toFixed(2)}%</p>
                        <p class="text-xs text-orange-600 mt-1">${data.summary.total_drawdown_periods} periods</p>
                    </div>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-blue-800 mb-1">Recovery Time</h4>
                        <p class="text-2xl font-bold text-blue-600">${data.summary.max_recovery_time.toFixed(0)}</p>
                        <p class="text-xs text-blue-600 mt-1">${data.summary.recovery_time_unit}</p>
                    </div>
                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-purple-800 mb-1">Drawdown Days</h4>
                        <p class="text-2xl font-bold text-purple-600">${data.summary.total_drawdown_days}</p>
                        <p class="text-xs text-purple-600 mt-1">Total days</p>
                    </div>
                </div>

                <!-- Benchmark Comparison -->
                ${this.renderBenchmarkComparison(data.benchmark_comparison)}

                <!-- Drawdown Chart -->
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-lg font-semibold mb-4">Portfolio Drawdown Over Time</h4>
                    <div id="drawdownChart" style="height: 400px;"></div>
                </div>

                <!-- Drawdown Periods Table -->
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="text-lg font-semibold mb-4">Drawdown Periods</h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trough Date</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Max Drawdown</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recovery Time</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${data.drawdown_periods.map(period => `
                                    <tr>
                                        <td class="px-4 py-2 text-sm text-gray-900">${period.start_date}</td>
                                        <td class="px-4 py-2 text-sm text-gray-900">${period.trough_date}</td>
                                        <td class="px-4 py-2 text-sm text-gray-900">${period.end_date}</td>
                                        <td class="px-4 py-2 text-sm font-medium text-red-600">-${period.max_drawdown_pct.toFixed(2)}%</td>
                                        <td class="px-4 py-2 text-sm text-gray-900">${period.duration_days} days</td>
                                        <td class="px-4 py-2 text-sm text-gray-900">${period.recovery_time.toFixed(0)} ${period.recovery_time_unit.toLowerCase()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
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
                            <span class="text-gray-500">Frequency:</span>
                            <span class="ml-1 font-medium">${data.parameters.frequency}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Recovery:</span>
                            <span class="ml-1 font-medium">${data.parameters.recovery_time}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Severity:</span>
                            <span class="ml-1 font-medium">${data.parameters.severity}</span>
                        </div>
                        <div>
                            <span class="text-gray-500">Comparison:</span>
                            <span class="ml-1 font-medium">${data.parameters.comparison}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        
        // Render the chart
        this.renderDrawdownChart(data.time_series);
    }

    renderBenchmarkComparison(benchmarkData) {
        if (!benchmarkData || benchmarkData.error || Object.keys(benchmarkData).length === 0) {
            return '';
        }

        const comparisonColor = benchmarkData.comparison === 'Better' ? 'green' : 'red';
        const comparisonIcon = benchmarkData.comparison === 'Better' ? '↑' : '↓';

        return `
            <div class="bg-${comparisonColor}-50 border border-${comparisonColor}-200 rounded-lg p-4">
                <h4 class="text-lg font-semibold text-${comparisonColor}-800 mb-2">
                    Benchmark Comparison (${benchmarkData.symbol})
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <span class="text-sm text-${comparisonColor}-600">Portfolio Max Drawdown:</span>
                        <p class="text-lg font-bold text-${comparisonColor}-800">${this.currentData.summary.max_drawdown_pct.toFixed(2)}%</p>
                    </div>
                    <div>
                        <span class="text-sm text-${comparisonColor}-600">Benchmark Max Drawdown:</span>
                        <p class="text-lg font-bold text-${comparisonColor}-800">${benchmarkData.max_drawdown_pct.toFixed(2)}%</p>
                    </div>
                    <div>
                        <span class="text-sm text-${comparisonColor}-600">Difference:</span>
                        <p class="text-lg font-bold text-${comparisonColor}-800">
                            ${comparisonIcon} ${Math.abs(benchmarkData.difference).toFixed(2)}% ${benchmarkData.comparison}
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    renderDrawdownChart(timeSeriesData) {
        if (!timeSeriesData || timeSeriesData.length === 0) return;

        const dates = timeSeriesData.map(d => d.date);
        const portfolioValues = timeSeriesData.map(d => d.portfolio_value);
        const drawdowns = timeSeriesData.map(d => d.drawdown_pct);
        const cumulativeMax = timeSeriesData.map(d => d.cumulative_max);

        const trace1 = {
            x: dates,
            y: portfolioValues,
            type: 'scatter',
            mode: 'lines',
            name: 'Portfolio Value',
            line: { color: '#3B82F6', width: 2 },
            yaxis: 'y'
        };

        const trace2 = {
            x: dates,
            y: cumulativeMax,
            type: 'scatter',
            mode: 'lines',
            name: 'Peak Value',
            line: { color: '#10B981', width: 1, dash: 'dash' },
            yaxis: 'y'
        };

        const trace3 = {
            x: dates,
            y: drawdowns,
            type: 'scatter',
            mode: 'lines',
            name: 'Drawdown %',
            line: { color: '#EF4444', width: 2 },
            fill: 'tonexty',
            fillcolor: 'rgba(239, 68, 68, 0.1)',
            yaxis: 'y2'
        };

        const layout = {
            title: {
                text: 'Portfolio Value and Drawdown Analysis',
                font: { size: 16 }
            },
            xaxis: {
                title: 'Date',
                type: 'date'
            },
            yaxis: {
                title: 'Portfolio Value ($)',
                side: 'left',
                tickformat: '$,.0f'
            },
            yaxis2: {
                title: 'Drawdown (%)',
                side: 'right',
                overlaying: 'y',
                tickformat: '.1f',
                range: [Math.min(...drawdowns) * 1.1, 5]
            },
            legend: {
                x: 0,
                y: 1,
                bgcolor: 'rgba(255,255,255,0.8)'
            },
            hovermode: 'x unified',
            margin: { t: 50, r: 60, b: 50, l: 60 }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            displaylogo: false
        };

        Plotly.newPlot('drawdownChart', [trace1, trace2, trace3], layout, config);
    }

    showLoading() {
        const container = document.getElementById('drawdownAnalysis');
        if (container) {
            container.innerHTML = `
                <div class="flex items-center justify-center py-12">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span class="ml-3 text-gray-600">Analyzing drawdowns...</span>
                </div>
            `;
        }
    }

    showError(message) {
        const container = document.getElementById('drawdownAnalysis');
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
function toggleDrawdownSettings() {
    const settings = document.getElementById('drawdownSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function updateDrawdownAnalysis() {
    if (window.drawdownAnalysis) {
        window.drawdownAnalysis.updateAnalysis();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.drawdownAnalysis = new DrawdownAnalysis();
});

// Auto-update when transaction data changes
document.addEventListener('transactionDataUpdated', function() {
    if (window.drawdownAnalysis && !document.getElementById('drawdownSettings').classList.contains('hidden')) {
        window.drawdownAnalysis.updateAnalysis();
    }
});