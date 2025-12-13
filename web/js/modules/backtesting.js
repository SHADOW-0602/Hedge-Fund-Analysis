// Strategy Backtesting Module - Matches P&L Attribution UI Style
let currentBacktestOptions = {
    period: '1Y',
    rebalancing: 'Quarterly',
    transactionCosts: 0.1,
    benchmark: 'SPY',
    riskModel: 'historical'
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
                period: options.period || '1Y',
                rebalancing: options.rebalancing || 'Quarterly',
                transactionCosts: options.transactionCosts || 0.1,
                benchmark: options.benchmark || 'SPY',
                riskModel: options.riskModel || 'historical'
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

        // Helper function to get color based on value and type
        const getValueColor = (value, type) => {
            if (value === null || value === undefined || isNaN(value)) return 'text-gray-500';

            switch (type) {
                case 'return':
                    return value >= 0 ? 'text-green-600' : 'text-red-600';
                case 'ratio':
                    if (value >= 1.5) return 'text-green-600';
                    if (value >= 1.0) return 'text-yellow-600';
                    if (value >= 0.5) return 'text-orange-600';
                    return 'text-red-600';
                case 'drawdown':
                    if (Math.abs(value) <= 0.05) return 'text-green-600';
                    if (Math.abs(value) <= 0.10) return 'text-yellow-600';
                    if (Math.abs(value) <= 0.20) return 'text-orange-600';
                    return 'text-red-600';
                case 'volatility':
                    if (value <= 0.10) return 'text-green-600';
                    if (value <= 0.20) return 'text-yellow-600';
                    if (value <= 0.30) return 'text-orange-600';
                    return 'text-red-600';
                case 'winrate':
                    if (value >= 70) return 'text-green-600';
                    if (value >= 60) return 'text-yellow-600';
                    if (value >= 50) return 'text-orange-600';
                    return 'text-red-600';
                case 'beta':
                    if (value >= 0.8 && value <= 1.2) return 'text-blue-600';
                    if (value >= 0.5 && value <= 1.5) return 'text-yellow-600';
                    return 'text-red-600';
                default:
                    return 'text-gray-600';
            }
        };

        const winRate = parseFloat(this.calculateWinRate(results));

        let html = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Performance Metrics -->
                <div class="analysis-card p-6">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">Performance</h4>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Total Return</span>
                            <span class="font-semibold ${getValueColor(performance.total_return, 'return')}">
                                ${((performance.total_return || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Annual Return</span>
                            <span class="font-semibold ${getValueColor(performance.annualized_return, 'return')}">
                                ${((performance.annualized_return || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Volatility</span>
                            <span class="font-semibold ${getValueColor(performance.volatility, 'volatility')}">
                                ${((performance.volatility || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Win Rate</span>
                            <span class="font-semibold ${getValueColor(winRate, 'winrate')}">
                                ${winRate.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Risk Metrics -->
                <div class="analysis-card p-6">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">Risk Metrics</h4>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Sharpe Ratio</span>
                            <span class="font-semibold ${getValueColor(performance.sharpe_ratio, 'ratio')}">
                                ${(performance.sharpe_ratio || 0).toFixed(2)}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Sortino Ratio</span>
                            <span class="font-semibold ${getValueColor(performance.sortino_ratio || risk.sortino_ratio, 'ratio')}">
                                ${(performance.sortino_ratio || risk.sortino_ratio || 0).toFixed(2)}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Max Drawdown</span>
                            <span class="font-semibold ${getValueColor(risk.max_drawdown, 'drawdown')}">
                                ${((risk.max_drawdown || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Calmar Ratio</span>
                            <span class="font-semibold ${getValueColor(risk.calmar_ratio, 'ratio')}">
                                ${(risk.calmar_ratio || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Benchmark Comparison -->
                <div class="analysis-card p-6">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">Benchmark Comparison</h4>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Benchmark Return</span>
                            <span class="font-semibold ${getValueColor(performance.benchmark_return, 'return')}">
                                ${((performance.benchmark_return || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Excess Return</span>
                            <span class="font-semibold ${getValueColor(performance.excess_return, 'return')}">
                                ${((performance.excess_return || 0) * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Beta</span>
                            <span class="font-semibold ${getValueColor(performance.beta, 'beta')}">
                                ${(performance.beta || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Backtest Parameters -->
            <div class="rounded-lg p-6" style="background: var(--bg-card-hover);">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="text-gray-600">Period:</span> <span class="font-medium text-gray-900">${summary.backtest_period}</span></div>
                    <div><span class="text-gray-600">Rebalancing:</span> <span class="font-medium text-gray-900">${summary.rebalancing_frequency}</span></div>
                    <div><span class="text-gray-600">Transaction Costs:</span> <span class="font-medium text-gray-900">${summary.transaction_cost_rate}</span></div>
                    <div><span class="text-gray-600">Benchmark:</span> <span class="font-medium text-gray-900">${summary.benchmark}</span></div>
                    <div><span class="text-gray-600">Risk Model:</span> <span class="font-medium text-gray-900">${summary.risk_model}</span></div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                    <div><span class="text-gray-600">Data Points:</span> <span class="font-medium text-gray-900">${results.portfolio_returns?.length || 0}</span></div>
                    <div><span class="text-gray-600">Start Date:</span> <span class="font-medium text-gray-900">${summary.start_date || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}</span></div>
                    <div><span class="text-gray-600">End Date:</span> <span class="font-medium text-gray-900">${summary.end_date || new Date().toISOString().split('T')[0]}</span></div>
                    <div><span class="text-gray-600">Symbols:</span> <span class="font-medium text-gray-900">${summary.symbols ? summary.symbols.join(', ') : (summary.symbols_count || 0)}</span></div>
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
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Risk Model</label>
                        <select id="riskModel" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateBacktestOptions()">
                            <option value="historical" ${currentBacktestOptions.riskModel === 'historical' ? 'selected' : ''}>Historical</option>
                            <option value="parametric" ${currentBacktestOptions.riskModel === 'parametric' ? 'selected' : ''}>Parametric</option>
                            <option value="monte_carlo" ${currentBacktestOptions.riskModel === 'monte_carlo' ? 'selected' : ''}>Monte Carlo</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="analysis-card p-8 text-center">
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
        benchmark: document.getElementById('benchmark')?.value || 'SPY',
        riskModel: document.getElementById('riskModel')?.value || 'historical'
    };

    // Don't auto-run, just update options
    console.log('Backtest options updated:', currentBacktestOptions);
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
            <div class="analysis-card p-12 text-center">
                <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Running Backtest</h3>
                <p class="text-gray-600 mb-4">Analyzing strategy performance...</p>
                <div class="w-full rounded-full h-2 mb-4 max-w-md mx-auto" style="background: var(--border-card);">
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

// Settings toggle function
function toggleBacktestSettings() {
    const settingsPanel = document.getElementById('backtestSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
}

function showBacktestError(message) {
    const contentDiv = document.getElementById('backtestContent');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="analysis-card p-8 text-center text-red-600">
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
window.toggleBacktestSettings = toggleBacktestSettings;
window.updateBacktestOptions = updateBacktestOptions;
window.runStrategyBacktest = runStrategyBacktest;