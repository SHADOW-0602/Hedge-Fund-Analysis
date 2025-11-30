// Strategy Backtesting Module - Matches P&L Attribution UI Style
let currentBacktestOptions = {
    period: '1Y',
    rebalancing: 'Quarterly',
    transactionCosts: 0.1,
    benchmark: 'SPY'
};

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

    displayResults(results, containerId = 'backtestContent') {
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
                            <span class="text-gray-600">Sortino Ratio</span>
                            <span class="font-semibold text-indigo-600">
                                ${(performance.sortino_ratio || risk.sortino_ratio || 0).toFixed(2)}
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

    showBacktestingInterface(portfolioData) {
        const container = document.getElementById('strategyBacktesting');
        if (!container) return;

        // Store portfolio data for backtesting
        window.currentBacktestPortfolio = portfolioData;

        // Show loading state with full UI matching P&L Attribution style
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Strategy Backtesting</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleBacktestSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="runStrategyBacktest()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Run Backtest
                    </button>
                </div>
            </div>
            
            <!-- Backtest Settings Panel -->
            <div id="backtestSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                        <select id="backtestPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateBacktestOptions()">
                            <option value="6M" ${currentBacktestOptions.period === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentBacktestOptions.period === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentBacktestOptions.period === '2Y' ? 'selected' : ''}>2 Years</option>
                            <option value="3Y" ${currentBacktestOptions.period === '3Y' ? 'selected' : ''}>3 Years</option>
                            <option value="5Y" ${currentBacktestOptions.period === '5Y' ? 'selected' : ''}>5 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Rebalancing</label>
                        <select id="rebalancing" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateBacktestOptions()">
                            <option value="Monthly" ${currentBacktestOptions.rebalancing === 'Monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="Quarterly" ${currentBacktestOptions.rebalancing === 'Quarterly' ? 'selected' : ''}>Quarterly</option>
                            <option value="Semi-annual" ${currentBacktestOptions.rebalancing === 'Semi-annual' ? 'selected' : ''}>Semi-annual</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Transaction Costs</label>
                        <select id="transactionCosts" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateBacktestOptions()">
                            <option value="0" ${currentBacktestOptions.transactionCosts === 0 ? 'selected' : ''}>0%</option>
                            <option value="0.1" ${currentBacktestOptions.transactionCosts === 0.1 ? 'selected' : ''}>0.1%</option>
                            <option value="0.25" ${currentBacktestOptions.transactionCosts === 0.25 ? 'selected' : ''}>0.25%</option>
                            <option value="0.5" ${currentBacktestOptions.transactionCosts === 0.5 ? 'selected' : ''}>0.5%</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                        <select id="benchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateBacktestOptions()">
                            <option value="SPY" ${currentBacktestOptions.benchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${currentBacktestOptions.benchmark === 'QQQ' ? 'selected' : ''}>NASDAQ 100 (QQQ)</option>
                            <option value="IWM" ${currentBacktestOptions.benchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                            <option value="VTI" ${currentBacktestOptions.benchmark === 'VTI' ? 'selected' : ''}>Total Stock Market (VTI)</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div id="backtestContent" class="bg-white rounded-lg shadow p-8 text-center">
                <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Ready to Run Backtest</h3>
                <p class="text-gray-600 mb-4">Configure your settings and click "Run Backtest" to analyze your strategy performance.</p>
                <p class="text-sm text-gray-500">Portfolio: ${portfolioData?.length || 0} positions loaded</p>
            </div>
        `;
    }
}

// Global instance
window.backtestingManager = new BacktestingManager();

function updateBacktestOptions() {
    currentBacktestOptions = {
        period: document.getElementById('backtestPeriod')?.value || '1Y',
        rebalancing: document.getElementById('rebalancing')?.value || 'Quarterly',
        transactionCosts: parseFloat(document.getElementById('transactionCosts')?.value || '0.1'),
        benchmark: document.getElementById('benchmark')?.value || 'SPY'
    };
}

// Global functions for HTML onclick handlers
async function runStrategyBacktest() {
    const portfolioData = window.currentBacktestPortfolio || window.portfolioData;
    if (!portfolioData || portfolioData.length === 0) {
        showBacktestError('Please upload a portfolio first');
        return;
    }

    // Show loading state
    const contentDiv = document.getElementById('backtestContent');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="bg-white rounded-lg shadow p-12 text-center">
                <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Running Backtest</h3>
                <p class="text-gray-600 mb-4">Analyzing strategy performance...</p>
                <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                    <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
                </div>
                <p class="text-sm text-gray-500">This may take a few moments</p>
            </div>
        `;
    }

    try {
        updateBacktestOptions();
        console.log('Running backtest with options:', currentBacktestOptions);

        const results = await window.backtestingManager.runBacktest(portfolioData, currentBacktestOptions);
        window.backtestingManager.displayResults(results);
        
    } catch (error) {
        console.error('Backtesting error:', error);
        showBacktestError('Backtesting failed: ' + error.message);
    }
}

function showBacktestError(message) {
    const contentDiv = document.getElementById('backtestContent');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="bg-white rounded-lg shadow p-8 text-center text-red-600">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl font-semibold mb-2">Backtest Error</p>
                <p class="text-sm text-gray-600">${message}</p>
            </div>
        `;
    }
}

function loadStrategyBacktesting(portfolioData) {
    console.log('loadStrategyBacktesting called with:', portfolioData?.length || 0, 'positions');
    if (window.backtestingManager) {
        window.backtestingManager.showBacktestingInterface(portfolioData);
    }
}

// Global functions
window.loadStrategyBacktesting = loadStrategyBacktesting;
window.toggleBacktestSettings = () => document.getElementById('backtestSettings')?.classList.toggle('hidden');
window.updateBacktestOptions = updateBacktestOptions;
window.runStrategyBacktest = runStrategyBacktest;