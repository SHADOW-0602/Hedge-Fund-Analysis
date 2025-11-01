// Strategy Backtesting Module
class StrategyBacktesting {
    constructor() {
        this.currentData = null;
        this.isLoading = false;
    }

    async runBacktest(portfolio, options = {}) {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const response = await fetch('/api/strategy-backtesting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portfolio, options })
            });

            const data = await response.json();
            if (data.success) {
                this.currentData = data.backtest;
                this.displayResults(data.backtest);
            } else {
                this.displayError(data.error);
            }
        } catch (error) {
            console.error('Strategy backtesting error:', error);
            this.displayError('Failed to run backtest');
        } finally {
            this.isLoading = false;
        }
    }

    displayResults(data) {
        const container = document.getElementById('backtestingResults');
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-6">
                ${this.renderPerformanceMetrics(data.performance_metrics)}
                ${this.renderRiskMetrics(data.risk_metrics)}
                ${this.renderBenchmarkComparison(data.benchmark_comparison)}
                ${this.renderPerformanceChart(data.time_series)}
                ${this.renderBacktestSummary(data.backtest_parameters)}
            </div>
        `;
    }

    renderPerformanceMetrics(metrics) {
        return `
            <div class="bg-blue-50 rounded-lg p-4">
                <h4 class="text-lg font-semibold mb-3">Performance Metrics</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600">${(metrics.total_return * 100).toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Total Return</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600">${(metrics.annual_return * 100).toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Annual Return</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600">${(metrics.volatility * 100).toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Volatility</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600">${(metrics.win_rate * 100).toFixed(1)}%</div>
                        <div class="text-sm text-gray-600">Win Rate</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-gray-600">${metrics.total_trades}</div>
                        <div class="text-sm text-gray-600">Total Trades</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-red-600">${metrics.transaction_costs_impact.toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Transaction Costs</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderRiskMetrics(metrics) {
        const getSharpeColor = (sharpe) => {
            if (sharpe > 1.5) return 'text-green-600';
            if (sharpe > 1.0) return 'text-yellow-600';
            return 'text-red-600';
        };

        return `
            <div class="bg-gray-50 rounded-lg p-4">
                <h4 class="text-lg font-semibold mb-3">Risk Metrics</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    <div class="text-center">
                        <div class="text-xl font-bold ${getSharpeColor(metrics.sharpe_ratio)}">${metrics.sharpe_ratio.toFixed(3)}</div>
                        <div class="text-sm text-gray-600">Sharpe Ratio</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-blue-600">${metrics.sortino_ratio.toFixed(3)}</div>
                        <div class="text-sm text-gray-600">Sortino Ratio</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-purple-600">${metrics.calmar_ratio.toFixed(3)}</div>
                        <div class="text-sm text-gray-600">Calmar Ratio</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-red-600">${(metrics.max_drawdown * 100).toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Max Drawdown</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-gray-600">${metrics.beta.toFixed(3)}</div>
                        <div class="text-sm text-gray-600">Beta</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-green-600">${(metrics.alpha * 100).toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Alpha</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-orange-600">${(metrics.tracking_error * 100).toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Tracking Error</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-indigo-600">${metrics.information_ratio.toFixed(3)}</div>
                        <div class="text-sm text-gray-600">Info Ratio</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderBenchmarkComparison(benchmark) {
        const excessColor = benchmark.excess_return >= 0 ? 'text-green-600' : 'text-red-600';
        
        return `
            <div class="bg-yellow-50 rounded-lg p-4">
                <h4 class="text-lg font-semibold mb-3">Benchmark Comparison (${benchmark.benchmark_symbol})</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div class="text-center">
                        <div class="text-xl font-bold text-gray-600">${(benchmark.benchmark_return * 100).toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Benchmark Return</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-gray-600">${(benchmark.benchmark_annual_return * 100).toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Benchmark Annual</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-gray-600">${(benchmark.benchmark_volatility * 100).toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Benchmark Vol</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-gray-600">${benchmark.benchmark_sharpe.toFixed(3)}</div>
                        <div class="text-sm text-gray-600">Benchmark Sharpe</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold ${excessColor}">${(benchmark.excess_return * 100).toFixed(2)}%</div>
                        <div class="text-sm text-gray-600">Excess Return</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-bold text-blue-600">${benchmark.volatility_ratio.toFixed(3)}</div>
                        <div class="text-sm text-gray-600">Vol Ratio</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderPerformanceChart(timeSeries) {
        if (!timeSeries || !timeSeries.dates) return '';

        // Create Plotly chart
        setTimeout(() => {
            const chartDiv = document.getElementById('backtestChart');
            if (!chartDiv) return;

            const portfolioTrace = {
                x: timeSeries.dates,
                y: timeSeries.portfolio_cumulative,
                type: 'scatter',
                mode: 'lines',
                name: 'Portfolio',
                line: { color: '#3B82F6', width: 2 }
            };

            const benchmarkTrace = {
                x: timeSeries.dates,
                y: timeSeries.benchmark_cumulative,
                type: 'scatter',
                mode: 'lines',
                name: 'Benchmark',
                line: { color: '#EF4444', width: 2 }
            };

            const drawdownTrace = {
                x: timeSeries.dates,
                y: timeSeries.drawdown,
                type: 'scatter',
                mode: 'lines',
                name: 'Drawdown',
                line: { color: '#F59E0B', width: 1 },
                yaxis: 'y2',
                fill: 'tonexty',
                fillcolor: 'rgba(245, 158, 11, 0.1)'
            };

            const layout = {
                title: 'Portfolio Performance vs Benchmark',
                xaxis: { title: 'Date' },
                yaxis: { title: 'Cumulative Return', side: 'left' },
                yaxis2: { title: 'Drawdown', side: 'right', overlaying: 'y' },
                showlegend: true,
                height: 400,
                margin: { t: 50, r: 50, b: 50, l: 50 }
            };

            Plotly.newPlot(chartDiv, [portfolioTrace, benchmarkTrace, drawdownTrace], layout, {
                responsive: true,
                displayModeBar: true
            });
        }, 100);

        return `
            <div class="bg-white rounded-lg p-4 border">
                <div id="backtestChart" style="width: 100%; height: 400px;"></div>
            </div>
        `;
    }

    renderBacktestSummary(params) {
        return `
            <div class="bg-green-50 rounded-lg p-4">
                <h4 class="text-lg font-semibold mb-3">Backtest Summary</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                    <div>
                        <div class="font-medium text-gray-700">Period</div>
                        <div class="text-xl font-bold text-green-600">${params.period}</div>
                    </div>
                    <div>
                        <div class="font-medium text-gray-700">Rebalancing</div>
                        <div class="text-xl font-bold text-green-600">${params.rebalancing}</div>
                    </div>
                    <div>
                        <div class="font-medium text-gray-700">Transaction Costs</div>
                        <div class="text-xl font-bold text-green-600">${params.transaction_costs.toFixed(2)}%</div>
                    </div>
                    <div>
                        <div class="font-medium text-gray-700">Benchmark</div>
                        <div class="text-xl font-bold text-green-600">${params.benchmark}</div>
                    </div>
                    <div>
                        <div class="font-medium text-gray-700">Data Points</div>
                        <div class="text-xl font-bold text-green-600">${params.data_points}</div>
                    </div>
                    <div>
                        <div class="font-medium text-gray-700">Symbols</div>
                        <div class="text-xl font-bold text-green-600">${params.symbols_analyzed}</div>
                    </div>
                </div>
            </div>
        `;
    }

    displayError(error) {
        const container = document.getElementById('backtestingResults');
        if (!container) return;

        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <div class="flex items-center">
                    <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-red-800 font-medium">Strategy Backtesting Error</span>
                </div>
                <p class="text-red-700 mt-1">${error}</p>
            </div>
        `;
    }

    getCurrentOptions() {
        return {
            backtest_period: document.getElementById('backtestPeriod')?.value || '1Y',
            rebalancing: document.getElementById('backtestRebalancing')?.value || 'Quarterly',
            transaction_costs: parseFloat(document.getElementById('backtestTransactionCosts')?.value || '0.1'),
            benchmark: document.getElementById('backtestBenchmark')?.value || 'SPY'
        };
    }
}

// Global instance
const strategyBacktesting = new StrategyBacktesting();

// Global functions for HTML onclick handlers
function toggleBacktestingSettings() {
    const settings = document.getElementById('backtestingSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function updateStrategyBacktesting() {
    if (window.currentPortfolioData && window.currentPortfolioData.length > 0) {
        const options = strategyBacktesting.getCurrentOptions();
        strategyBacktesting.runBacktest(window.currentPortfolioData, options);
    } else {
        strategyBacktesting.displayError('No portfolio data available. Please upload a portfolio first.');
    }
}

// Auto-run when portfolio data is available
function runStrategyBacktesting(portfolioData) {
    if (portfolioData && portfolioData.length > 0) {
        const options = strategyBacktesting.getCurrentOptions();
        strategyBacktesting.runBacktest(portfolioData, options);
    }
}