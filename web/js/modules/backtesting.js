// Strategy Backtesting Module
class BacktestingManager {
    constructor() {
        this.apiBase = `${window.location.origin}/api`;
        this.currentResults = null;
    }

    async runBacktest(portfolioData, options = {}) {
        if (!portfolioData || portfolioData.length === 0) {
            throw new Error('No portfolio data provided');
        }

        const payload = {
            portfolio: portfolioData,
            options: {
                backtest_period: options.period || '1Y',
                rebalancing: options.rebalancing || 'Quarterly',
                transaction_costs: options.transactionCosts || 0.1,
                benchmark: options.benchmark || 'SPY'
            }
        };

        console.log('Running backtest with payload:', payload);

        const response = await fetch(`${this.apiBase}/strategy-backtesting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Backtesting failed');
        }

        this.currentResults = data.backtesting_results;
        return this.currentResults;
    }

    displayResults(results, containerId = 'backtestingResults') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!results) {
            container.innerHTML = '<p class="text-gray-500">No backtesting results available</p>';
            return;
        }

        const performance = results.performance_metrics || {};
        const risk = results.risk_metrics || {};
        const summary = results.summary || {};

        let html = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Performance Metrics -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">Performance</h4>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Total Return</span>
                            <span class="font-semibold ${(performance.total_return || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${((performance.total_return || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Annual Return</span>
                            <span class="font-semibold ${(performance.annualized_return || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${((performance.annualized_return || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Volatility</span>
                            <span class="font-semibold text-blue-600">
                                ${((performance.volatility || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Win Rate</span>
                            <span class="font-semibold text-purple-600">
                                ${this.calculateWinRate(results)}%
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Risk Metrics -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">Risk Metrics</h4>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Sharpe Ratio</span>
                            <span class="font-semibold text-blue-600">
                                ${(performance.sharpe_ratio || 0).toFixed(2)}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Max Drawdown</span>
                            <span class="font-semibold text-red-600">
                                ${((risk.max_drawdown || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Calmar Ratio</span>
                            <span class="font-semibold text-green-600">
                                ${(risk.calmar_ratio || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Benchmark Comparison -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">Benchmark Comparison</h4>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Benchmark Return</span>
                            <span class="font-semibold ${(performance.benchmark_return || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${((performance.benchmark_return || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Excess Return</span>
                            <span class="font-semibold ${(performance.excess_return || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${((performance.excess_return || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Beta</span>
                            <span class="font-semibold text-blue-600">
                                ${(performance.beta || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Backtest Parameters -->
            <div class="mt-6 bg-gray-50 rounded-lg p-4">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">Backtest Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span class="font-medium text-gray-700">Period:</span>
                        <span class="ml-2">${summary.backtest_period || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="font-medium text-gray-700">Rebalancing:</span>
                        <span class="ml-2">${summary.rebalancing_frequency || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="font-medium text-gray-700">Transaction Costs:</span>
                        <span class="ml-2">${summary.transaction_cost_rate || '0%'}</span>
                    </div>
                    <div>
                        <span class="font-medium text-gray-700">Data Points:</span>
                        <span class="ml-2">${summary.total_periods || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    calculateWinRate(results) {
        if (!results.portfolio_returns || results.portfolio_returns.length === 0) {
            return '0.00';
        }
        
        const positiveReturns = results.portfolio_returns.filter(r => r > 0).length;
        const totalReturns = results.portfolio_returns.length;
        return ((positiveReturns / totalReturns) * 100).toFixed(2);
    }

    showBacktestingSettings() {
        const settingsHtml = `
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Strategy Backtesting Settings</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Backtest Period</label>
                        <select id="backtestPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="6M">6 Months</option>
                            <option value="1Y" selected>1 Year</option>
                            <option value="2Y">2 Years</option>
                            <option value="3Y">3 Years</option>
                            <option value="5Y">5 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Rebalancing</label>
                        <select id="rebalancing" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly" selected>Quarterly</option>
                            <option value="Semi-annual">Semi-annual</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Transaction Costs</label>
                        <select id="transactionCosts" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="0">0%</option>
                            <option value="0.1" selected>0.1%</option>
                            <option value="0.25">0.25%</option>
                            <option value="0.5">0.5%</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Benchmark</label>
                        <select id="benchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="SPY" selected>S&P 500 (SPY)</option>
                            <option value="QQQ">NASDAQ 100 (QQQ)</option>
                            <option value="IWM">Russell 2000 (IWM)</option>
                            <option value="VTI">Total Stock Market (VTI)</option>
                        </select>
                    </div>
                </div>
                <div class="mt-4">
                    <button onclick="runStrategyBacktest()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                        Run Backtest
                    </button>
                </div>
            </div>
        `;

        const container = document.getElementById('backtestingResults');
        if (container) {
            container.innerHTML = settingsHtml;
        }
    }
}

// Global instance
window.backtestingManager = new BacktestingManager();

// Global functions for HTML onclick handlers
async function runStrategyBacktest() {
    if (!portfolioData || portfolioData.length === 0) {
        showError('Please upload a portfolio first');
        return;
    }

    showLoading(true);

    try {
        const options = {
            period: document.getElementById('backtestPeriod')?.value || '1Y',
            rebalancing: document.getElementById('rebalancing')?.value || 'Quarterly',
            transactionCosts: parseFloat(document.getElementById('transactionCosts')?.value || '0.1'),
            benchmark: document.getElementById('benchmark')?.value || 'SPY'
        };

        console.log('Running backtest with options:', options);

        const results = await window.backtestingManager.runBacktest(portfolioData, options);
        window.backtestingManager.displayResults(results);
        
        showSuccess('Backtesting completed successfully');
    } catch (error) {
        console.error('Backtesting error:', error);
        showError('Backtesting failed: ' + error.message);
    }

    showLoading(false);
}

function showBacktestingSettings() {
    window.backtestingManager.showBacktestingSettings();
}