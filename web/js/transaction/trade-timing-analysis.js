// Trade Timing Analysis Module
class TradeTimingAnalyzer {
    constructor() {
        this.currentData = null;
        this.isLoading = false;
    }

    async analyzeTradeTimingAnalysis(transactions, options = {}) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const container = document.getElementById('tradeTimingAnalysis');
        
        try {
            container.innerHTML = `
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                    <span class="text-gray-600">Analyzing trade timing patterns...</span>
                </div>
            `;

            const response = await fetch('/api/trade-timing-analysis', {
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
                this.currentData = data.trade_timing_analysis;
                this.renderAnalysis(this.currentData);
            } else {
                throw new Error(data.error || 'Analysis failed');
            }

        } catch (error) {
            console.error('Trade Timing analysis error:', error);
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
        const container = document.getElementById('tradeTimingAnalysis');
        
        container.innerHTML = `
            <div class="space-y-6">
                ${this.renderSummaryCards(data.summary)}
                ${this.renderTimingPerformance(data.timing_performance)}
                ${this.renderDayPerformance(data.day_performance)}
                ${this.renderTimingCharts(data)}
            </div>
        `;
    }

    renderSummaryCards(summary) {
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-blue-600">Total Trades</p>
                            <p class="text-2xl font-bold text-blue-900">${summary.total_trades}</p>
                        </div>
                        <div class="p-2 bg-blue-200 rounded-lg">
                            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-green-600">Best Time</p>
                            <p class="text-lg font-bold text-green-900">${summary.best_time_bucket}</p>
                            <p class="text-sm text-green-700">${this.formatPercent(summary.best_time_return)} return</p>
                        </div>
                        <div class="p-2 bg-green-200 rounded-lg">
                            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-red-600">Worst Time</p>
                            <p class="text-lg font-bold text-red-900">${summary.worst_time_bucket}</p>
                            <p class="text-sm text-red-700">${this.formatPercent(summary.worst_time_return)} return</p>
                        </div>
                        <div class="p-2 bg-red-200 rounded-lg">
                            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-purple-600">Best Day</p>
                            <p class="text-lg font-bold text-purple-900">${summary.best_day}</p>
                            <p class="text-sm text-purple-700">${this.formatCurrency(summary.best_day_volume)} volume</p>
                        </div>
                        <div class="p-2 bg-purple-200 rounded-lg">
                            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderTimingPerformance(timingPerformance) {
        if (!timingPerformance || Object.keys(timingPerformance).length === 0) {
            return '';
        }

        const timingRows = Object.entries(timingPerformance).map(([bucket, data]) => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${bucket}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${data.total_trades}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatCurrency(data.total_volume)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${data.avg_return >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${this.formatPercent(data.avg_return)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatPercent(data.win_rate)}</td>
            </tr>
        `).join('');

        return `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-900">Performance by Time Bucket</h3>
                    <p class="text-sm text-gray-600 mt-1">Trading performance across different time periods</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Bucket</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trades</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Return</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${timingRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderDayPerformance(dayPerformance) {
        if (!dayPerformance || Object.keys(dayPerformance).length === 0) {
            return '';
        }

        const dayRows = Object.entries(dayPerformance).map(([day, data]) => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${day}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${data.total_trades}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${this.formatCurrency(data.total_volume)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${Object.keys(data.time_breakdown).length} time periods
                </td>
            </tr>
        `).join('');

        return `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-900">Performance by Day of Week</h3>
                    <p class="text-sm text-gray-600 mt-1">Trading activity across weekdays</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trades</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Periods</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${dayRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderTimingCharts(data) {
        const chartId = 'tradeTimingChart';
        
        setTimeout(() => {
            // Time bucket performance chart
            const timingData = data.timing_performance;
            const buckets = Object.keys(timingData);
            const returns = buckets.map(bucket => timingData[bucket].avg_return * 100);
            const volumes = buckets.map(bucket => timingData[bucket].total_volume);

            const trace1 = {
                x: buckets,
                y: returns,
                type: 'bar',
                name: 'Avg Return (%)',
                marker: { 
                    color: returns.map(r => r >= 0 ? '#10b981' : '#ef4444')
                }
            };

            const trace2 = {
                x: buckets,
                y: volumes,
                type: 'bar',
                name: 'Volume ($)',
                yaxis: 'y2',
                marker: { color: '#3b82f6', opacity: 0.7 }
            };

            const layout = {
                title: 'Trading Performance by Time Bucket',
                xaxis: { title: 'Time Bucket' },
                yaxis: { 
                    title: 'Average Return (%)',
                    side: 'left'
                },
                yaxis2: {
                    title: 'Volume ($)',
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
                    <h3 class="text-lg font-semibold text-gray-900">Timing Performance Analysis</h3>
                    <p class="text-sm text-gray-600 mt-1">Visual analysis of trading performance by time</p>
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
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }

    formatPercent(value) {
        if (value === null || value === undefined || isNaN(value)) return '0.00%';
        return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
}

// Global functions for UI interaction
function toggleTradeTimingSettings() {
    const settings = document.getElementById('tradeTimingSettings');
    settings.classList.toggle('hidden');
}

function updateTradeTimingAnalysis() {
    const transactions = window.currentTransactionData;
    if (!transactions || transactions.length === 0) {
        alert('Please upload transaction data first');
        return;
    }

    const options = {
        period: document.getElementById('timingPeriod').value,
        time_buckets: document.getElementById('timingBuckets').value,
        day_of_week: document.getElementById('timingDayOfWeek').value,
        performance: document.getElementById('timingPerformance').value,
        market_conditions: document.getElementById('timingMarketConditions').value
    };

    const analyzer = new TradeTimingAnalyzer();
    analyzer.analyzeTradeTimingAnalysis(transactions, options);
}

// Initialize analyzer
window.tradeTimingAnalyzer = new TradeTimingAnalyzer();