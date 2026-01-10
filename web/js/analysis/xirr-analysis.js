// XIRR Analysis Module - Unifies Portfolio and Transaction Analysis

async function fetchXirrAnalysis(containerId, options = {}, preloadedData = null) {
    console.log('Fetching XIRR Analysis...');
    let container = document.getElementById(containerId);

    // Resilience: Recreate container if missing
    if (!container && !options.background) {
        console.warn('XIRR container not found, attempting to recreate...');
        const parent = document.getElementById('analysisContent') || document.getElementById('analysisContainer');
        if (parent) {
            container = document.createElement('div');
            container.id = containerId;
            parent.appendChild(container);
        } else {
            console.error('Parent container for XIRR not found');
            return;
        }
    }

    // Show loading state (only if not background AND not preloaded)
    // We check preloadedData validity later, but to avoid flash, we delay if arg is present?
    // Actually, simply check if we have data to skip the spinner.
    const hasPreloaded = preloadedData && preloadedData.transaction_xirr;

    if (container && !options.background && !hasPreloaded) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p class="text-primary font-medium">Calculating comprehensive XIRR analysis...</p>
                <p class="text-xs text-secondary mt-2">Fetching live prices & modeling option values</p>
            </div>
        `;
    }

    try {
        // Collect data from loaded files - improved checking order
        const transactions = window.currentTransactions ||
            (window.analyticsManager && window.analyticsManager.transactionData) ||
            (window.analyticsCore && window.analyticsCore.transactionData) ||
            [];

        const portfolio = window.currentPortfolio ||
            window.portfolioData ||
            window.currentPortfolioData ||
            (window.analyticsCore && window.analyticsCore.portfolioData) ||
            [];

        console.log(`[XIRR Analysis] Data sources - Transactions: ${transactions.length}, Portfolio: ${portfolio.length}`);

        if (transactions.length === 0 && portfolio.length === 0) {
            if (container && !options.background) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center p-12 bg-card rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <div class="text-indigo-500 mb-4">
                            <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-bold text-primary mb-2">No Data Available</h3>
                        <p class="text-secondary text-center max-w-md">
                            Please load your portfolio or transaction data using the data management tools to view XIRR analysis.
                        </p>
                    </div>
                `;
            }
            return;
        }

        if (preloadedData && preloadedData.transaction_xirr) {
            console.log('Using preloaded XIRR data');
            const data = preloadedData.transaction_xirr;
            if (!options.background) {
                renderXirrDashboard(container, data, {
                    hasTransactions: transactions.length > 0,
                    hasPortfolio: portfolio.length > 0
                });
            } else {
                console.log('[XIRR Analysis] Preloaded background load complete');
            }
            return;
        } else if (preloadedData) {
            console.warn('Invalid preloaded XIRR data received:', preloadedData);
        }

        const requestData = {
            transactions: transactions,
            portfolio: portfolio,
            options: {
                period: options.period || 'ITD', // Inception to Date
                view: 'Combined'
            }
        };

        const response = await fetch('/api/transaction-xirr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error);
        }

        const data = result.transaction_xirr;
        if (!options.background) {
            renderXirrDashboard(container, data, {
                hasTransactions: transactions.length > 0,
                hasPortfolio: portfolio.length > 0
            });
        } else {
            console.log('[XIRR Analysis] Background load complete');
        }

    } catch (error) {
        console.error('XIRR Analysis Error:', error);
        if (container && !options.background) {
            container.innerHTML = `
                <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                    <p class="text-red-600 dark:text-red-400 font-medium">Analysis Failed</p>
                    <p class="text-sm text-red-500 dark:text-red-300 mt-1">${error.message}</p>
                </div>
            `;
        }
    }
}

function renderXirrDashboard(container, data, context = { hasTransactions: true, hasPortfolio: true }) {
    const metrics = data.portfolio_metrics;
    const breakdown = data.ticker_breakdown;

    // Helper for currency formatting
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    };

    // Helper for percentage formatting
    const formatPct = (val) => {
        return (val * 100).toFixed(2) + '%';
    };

    // Color helper
    const getColor = (val) => val >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

    // Generate Warning Message if data is missing
    let warningMsg = '';
    if (!context.hasTransactions) {
        warningMsg = `
            <div class="mb-6 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 flex items-start">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">Transaction History Missing</h3>
                    <div class="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                        <p>Analysis is based on your current portfolio snapshot only. For accurate realized P&L and historical returns, please load your transaction history.</p>
                    </div>
                </div>
            </div>
        `;
    } else if (!context.hasPortfolio) {
        warningMsg = `
            <div class="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 flex items-start">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">Portfolio Data Missing</h3>
                    <div class="mt-2 text-sm text-blue-700 dark:text-blue-300">
                        <p>Showing analysis based on transaction history. For the most accurate current market values and unrealized P&L, please load your current portfolio file.</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Backend Warnings (e.g., missing cost basis)
    if (data.warnings && data.warnings.length > 0) {
        warningMsg += `
            <div class="mb-6 p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-orange-800 dark:text-orange-200">Data Limitations Detected</h3>
                        <div class="mt-2 text-sm text-orange-700 dark:text-orange-300">
                            <ul class="list-disc pl-5 space-y-1">
                                ${data.warnings.map(w => `<li>${w}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="space-y-8">
            ${warningMsg}
            <!-- 1. Portfolio Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- XIRR Card -->
                <div class="bg-card rounded-xl shadow p-6 border border-border-card">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide">Net Portfolio XIRR</h3>
                    <div class="mt-2 flex items-baseline">
                        <span class="text-3xl font-bold ${getColor(metrics.xirr)}">
                            ${formatPct(metrics.xirr)}
                        </span>
                        <span class="ml-2 text-sm text-secondary">annualized</span>
                    </div>
                </div>

                <!-- Total Value -->
                <div class="bg-card rounded-xl shadow p-6 border border-border-card">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide">Current Value</h3>
                    <div class="mt-2">
                        <span class="text-3xl font-bold text-primary">
                            ${formatCurrency(metrics.current_value)}
                        </span>
                    </div>
                    <div class="mt-1 text-sm text-secondary">
                        Invested: ${formatCurrency(metrics.total_invested)}
                    </div>
                </div>

                <!-- Total Return -->
                <div class="bg-card rounded-xl shadow p-6 border border-border-card">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide">Total Return</h3>
                    <div class="mt-2 flex items-baseline">
                        <span class="text-3xl font-bold ${getColor(metrics.total_return)}">
                            ${formatCurrency(metrics.total_return)}
                        </span>
                    </div>
                     <div class="mt-1 text-sm ${getColor(metrics.total_return_pct)}">
                        ${formatPct(metrics.total_return_pct)} all-time
                    </div>
                </div>

                <!-- Risk Metrics (Sharpe) - Removed per user request -->
            </div>

            <!-- 2. Detailed Breakdown Table -->
        <div class="bg-card rounded-xl shadow-lg border border-border-card">
            <div class="p-6 border-b border-border-card flex justify-between items-center">
                <h3 class="text-lg font-semibold text-primary">Performance by Ticker (Combined)</h3>
                <div class="text-sm text-secondary">
                    Includes valid option strategies + stock positions
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-secondary">
                        <tr>
                            <th class="px-6 py-3 font-semibold">Ticker</th>
                            <th class="px-6 py-3 text-right font-semibold">Market Value</th>
                            <th class="px-6 py-3 text-right font-semibold">Cost Basis</th>
                            <th class="px-6 py-3 text-right font-semibold">Unrealized P&L</th>
                            <th class="px-6 py-3 text-right font-semibold">Stock XIRR</th>
                            <th class="px-6 py-3 text-right font-semibold">Options Impact</th>
                            <th class="px-6 py-3 text-right font-semibold">Combined XIRR</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-border-card">
                        ${breakdown.map(item => `
                                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <td class="px-6 py-4 font-medium text-primary">
                                        ${item.ticker}
                                        ${item.has_options ?
            '<span class="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded dark:bg-purple-900 dark:text-purple-200">Opt</span>'
            : ''}
                                    </td>
                                    <td class="px-6 py-4 text-right text-primary">
                                        ${formatCurrency(item.market_value || 0)}
                                    </td>
                                    <td class="px-6 py-4 text-right text-secondary">
                                        ${formatCurrency(item.avg_cost * item.quantity || 0)}
                                    </td>
                                    <td class="px-6 py-4 text-right font-medium ${getColor(item.unrealized_pnl || 0)}">
                                        ${formatCurrency(item.unrealized_pnl || 0)}
                                        <div class="text-xs opacity-75">${formatPct(item.unrealized_pnl_pct || 0)}</div>
                                    </td>
                                    <td class="px-6 py-4 text-right ${getColor(item.stock_xirr)}">
                                        ${formatPct(item.stock_xirr)}
                                    </td>
                                     <td class="px-6 py-4 text-right ${getColor(item.options_impact)}">
                                        ${item.options_impact > 0 ? '+' : ''}${formatPct(item.options_impact)}
                                    </td>
                                    <td class="px-6 py-4 text-right font-bold ${getColor(item.combined_xirr)}">
                                        ${formatPct(item.combined_xirr)}
                                    </td>
                                </tr>
                            `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        </div>
        `;
}
