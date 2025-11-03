// Simplified Analytics Manager - Replaces complex integration files
class AnalyticsManager {
    constructor() {
        this.modules = new Map();
        this.initialized = false;
    }

    // Register analytics modules
    register(name, config) {
        this.modules.set(name, {
            endpoint: config.endpoint,
            containerId: config.containerId,
            settingsId: config.settingsId,
            displayFunction: config.displayFunction,
            type: config.type || 'portfolio' // 'portfolio' or 'transaction'
        });
    }

    // Initialize all modules
    initialize() {
        if (this.initialized) return;

        // Register portfolio modules
        this.register('risk-metrics', {
            endpoint: 'analyze-risk',
            containerId: 'riskResults',
            settingsId: 'riskSettings',
            displayFunction: this.displayRiskMetrics,
            type: 'portfolio'
        });

        this.register('options-strategies', {
            endpoint: 'scan-options',
            containerId: 'optionsResults',
            settingsId: 'optionsSettings',
            displayFunction: this.displayOptionsStrategies,
            type: 'portfolio'
        });

        this.register('performance-attribution', {
            endpoint: 'performance-attribution',
            containerId: 'performanceAttribution',
            settingsId: 'performanceSettings',
            displayFunction: this.displayPerformanceAttribution,
            type: 'portfolio'
        });

        this.register('monte-carlo', {
            endpoint: 'monte-carlo',
            containerId: 'monteCarloResults',
            settingsId: 'monteCarloSettings',
            displayFunction: this.displayMonteCarlo,
            type: 'portfolio'
        });

        this.register('portfolio-optimization', {
            endpoint: 'portfolio-optimization',
            containerId: 'optimizationChart',
            settingsId: 'optimizationSettings',
            displayFunction: this.displayPortfolioOptimization,
            type: 'portfolio'
        });

        this.register('correlation-analysis', {
            endpoint: 'correlation-analysis',
            containerId: 'correlationResults',
            settingsId: 'correlationSettings',
            displayFunction: this.displayCorrelationAnalysis,
            type: 'portfolio'
        });

        this.register('sector-allocation', {
            endpoint: 'sector-allocation',
            containerId: 'sectorAllocation',
            settingsId: 'sectorSettings',
            displayFunction: this.displaySectorAllocation,
            type: 'portfolio'
        });

        this.register('statistical-analysis', {
            endpoint: 'statistical-analysis',
            containerId: 'statisticalAnalysis',
            settingsId: 'statisticalSettings',
            displayFunction: this.displayStatisticalAnalysis,
            type: 'portfolio'
        });

        this.register('technical-indicators', {
            endpoint: 'technical-analysis',
            containerId: 'technicalAnalysis',
            settingsId: 'technicalSettings',
            displayFunction: this.displayTechnicalIndicators,
            type: 'portfolio'
        });

        this.register('strategy-backtesting', {
            endpoint: 'strategy-backtesting',
            containerId: 'strategyBacktesting',
            settingsId: 'backtestingSettings',
            displayFunction: this.displayStrategyBacktesting,
            type: 'portfolio'
        });

        // Register transaction modules
        this.register('pnl-attribution', {
            endpoint: 'pnl-attribution',
            containerId: 'pnlAttribution',
            settingsId: 'pnlSettings',
            displayFunction: this.displayPnLAttribution,
            type: 'transaction'
        });

        this.register('trade-performance', {
            endpoint: 'trade-performance',
            containerId: 'tradePerformance',
            settingsId: 'tradeSettings',
            displayFunction: this.displayTradePerformance,
            type: 'transaction'
        });

        this.register('cost-analysis', {
            endpoint: 'cost-analysis',
            containerId: 'costAnalysis',
            settingsId: 'costSettings',
            displayFunction: this.displayCostAnalysis,
            type: 'transaction'
        });

        this.register('turnover-analysis', {
            endpoint: 'turnover-analysis',
            containerId: 'turnoverAnalysis',
            settingsId: 'turnoverSettings',
            displayFunction: this.displayTurnoverAnalysis,
            type: 'transaction'
        });

        this.register('tax-analysis', {
            endpoint: 'tax-analysis',
            containerId: 'taxAnalysis',
            settingsId: 'taxSettings',
            displayFunction: this.displayTaxAnalysis,
            type: 'transaction'
        });

        this.register('cash-flow', {
            endpoint: 'cash-flow-analysis',
            containerId: 'cashFlowAnalysis',
            settingsId: 'cashFlowSettings',
            displayFunction: this.displayCashFlowAnalysis,
            type: 'transaction'
        });

        this.register('fifo-lifo', {
            endpoint: 'fifo-lifo-accounting',
            containerId: 'fifoLifoAnalysis',
            settingsId: 'fifoLifoSettings',
            displayFunction: this.displayFifoLifoAccounting,
            type: 'transaction'
        });

        this.register('trade-timing', {
            endpoint: 'trade-timing-analysis',
            containerId: 'tradeTimingAnalysis',
            settingsId: 'tradeTimingSettings',
            displayFunction: this.displayTradeTiming,
            type: 'transaction'
        });

        this.register('drawdown-analysis', {
            endpoint: 'drawdown-analysis',
            containerId: 'drawdownAnalysis',
            settingsId: 'drawdownSettings',
            displayFunction: this.displayDrawdownAnalysis,
            type: 'transaction'
        });

        this.register('return-attribution', {
            endpoint: 'return-attribution',
            containerId: 'analysisContent',
            settingsId: 'returnAttributionSettings',
            displayFunction: this.displayReturnAttribution,
            type: 'transaction'
        });

        // Bind events
        this.bindEvents();
        this.bindSidebarEvents();
        this.initialized = true;
    }

    // Bind sidebar events for analysis selection
    bindSidebarEvents() {
        document.addEventListener('click', (event) => {
            const analysisButton = event.target.closest('[data-analysis]');
            if (analysisButton) {
                const analysisType = analysisButton.getAttribute('data-analysis');
                this.loadModule(analysisType);
            }
        });
    }

    // Bind data events
    bindEvents() {
        document.addEventListener('portfolioLoaded', (event) => {
            window.analyticsCore.setPortfolioData(event.detail.portfolio);
            // No auto-loading - analytics only shown when clicked from sidebar
        });

        document.addEventListener('transactionsLoaded', (event) => {
            window.analyticsCore.setTransactionData(event.detail.transactions);
        });
    }

    // Load analysis (alias for loadModule for compatibility)
    async loadAnalysis(name) {
        return await this.loadModule(name);
    }

    // Load specific module
    async loadModule(name) {
        const module = this.modules.get(name);
        if (!module) return;

        // Show loading spinner
        if (window.showLoadingSpinner) {
            window.showLoadingSpinner(module.containerId, `Loading ${name.replace('-', ' ')}...`);
        }

        try {
            if (module.type === 'portfolio') {
                await window.analyticsCore.analyzePortfolio(
                    module.endpoint,
                    module.containerId,
                    module.displayFunction,
                    module.settingsId
                );
            } else {
                await window.analyticsCore.analyzeTransactions(
                    module.endpoint,
                    module.containerId,
                    module.displayFunction,
                    module.settingsId
                );
            }
        } catch (error) {
            console.error(`Failed to load ${name}:`, error);
            // Clear loading spinner on error
            if (window.clearAllLoadingSpinners) {
                window.clearAllLoadingSpinners();
            }
        }
    }

    // Display functions for each module
    displayRiskMetrics(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        const metrics = result.risk_metrics || {};
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Risk Metrics Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateRiskAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="space-y-4">
                <div class="metric-row">
                    <span class="metric-label">Portfolio Value</span>
                    <span class="metric-value neutral">${window.analyticsCore.formatCurrency(metrics.portfolio_value || 0)}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Number of Positions</span>
                    <span class="metric-value neutral">${metrics.num_positions || 0}</span>
                </div>
                ${Object.keys(metrics).length <= 2 ? '<div class="details-box"><p class="metric-label">Advanced risk metrics require additional market data integration.</p></div>' : ''}
            </div>
        `;
    }

    displayMonteCarlo(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Monte Carlo Simulation</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateMonteCarloSimulation()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        const results = result.results;
        container.innerHTML += `
            <div class="space-y-3">
                <div class="flex justify-between">
                    <span class="text-gray-700">Expected Return</span>
                    <span class="font-semibold ${results.expected_return >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${results.expected_return >= 0 ? '+' : ''}${(results.expected_return * 100).toFixed(1)}%
                    </span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-700">Volatility</span>
                    <span class="font-semibold text-gray-900">${(results.volatility * 100).toFixed(1)}%</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-700">Probability of Loss</span>
                    <span class="font-semibold text-red-600">${(results.probability_loss * 100).toFixed(1)}%</span>
                </div>
            </div>
        `;
    }

    displayReturnAttribution(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        // Clear any loading state and show content
        container.classList.remove('hidden');
        
        // Loading spinners removed
        
        const attribution = result.return_attribution?.attribution || {};
        const summary = result.return_attribution?.summary || {};
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Return Attribution Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateReturnAttribution()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-3">
                        <h4 class="section-header">Performance Summary</h4>
                        <div class="metric-row"><span class="metric-label">Portfolio Return</span><span class="metric-value ${attribution.portfolio_return >= 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(attribution.portfolio_return || 0)}</span></div>
                        <div class="metric-row"><span class="metric-label">Benchmark Return</span><span class="metric-value neutral">${window.analyticsCore.formatPercent(attribution.benchmark_return || 0)}</span></div>
                        <div class="metric-row"><span class="metric-label">Excess Return</span><span class="metric-value ${attribution.excess_return >= 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(attribution.excess_return || 0)}</span></div>
                    </div>
                    <div class="space-y-3">
                        <h4 class="section-header">Attribution Effects</h4>
                        <div class="metric-row"><span class="metric-label">Asset Allocation</span><span class="metric-value ${attribution.asset_allocation_effect >= 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(attribution.asset_allocation_effect || 0)}</span></div>
                        <div class="metric-row"><span class="metric-label">Security Selection</span><span class="metric-value ${attribution.security_selection_effect >= 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(attribution.security_selection_effect || 0)}</span></div>
                        <div class="metric-row"><span class="metric-label">Interaction Effect</span><span class="metric-value ${attribution.interaction_effect >= 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(attribution.interaction_effect || 0)}</span></div>
                    </div>
                </div>
                
                <div class="details-box">
                    <h4 class="section-header">Analysis Details</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span class="detail-label">Method:</span> <span class="detail-value">${attribution.method || summary.attribution_method || 'Brinson'}</span></div>
                        <div><span class="detail-label">Benchmark:</span> <span class="detail-value">${summary.benchmark || result.return_attribution?.parameters?.benchmark || 'SPY'}</span></div>
                        <div><span class="detail-label">Period:</span> <span class="detail-value">${summary.period || result.return_attribution?.parameters?.period || '1Y'}</span></div>
                        <div><span class="detail-label">Symbols:</span> <span class="detail-value">${summary.total_symbols || Object.keys(attribution.symbol_details || {}).length || 0}</span></div>
                    </div>
                </div>
                
                ${attribution.symbol_details ? `
                    <div class="table-container">
                        <h4 class="section-header">Symbol-Level Attribution</h4>
                        <table class="attribution-table">
                            <thead>
                                <tr>
                                    <th class="table-header">Symbol</th>
                                    <th class="table-header text-right">Weight</th>
                                    <th class="table-header text-right">Return</th>
                                    <th class="table-header text-right">Asset Allocation</th>
                                    <th class="table-header text-right">Security Selection</th>
                                    <th class="table-header text-right">Total Contribution</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(attribution.symbol_details).slice(0, 10).map(([symbol, details]) => `
                                    <tr class="table-row">
                                        <td class="table-cell symbol-cell">${symbol}</td>
                                        <td class="table-cell text-right">${window.analyticsCore.formatPercent(details.portfolio_weight)}</td>
                                        <td class="table-cell text-right ${details.symbol_return >= 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(details.symbol_return)}</td>
                                        <td class="table-cell text-right ${details.asset_allocation_effect >= 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(details.asset_allocation_effect)}</td>
                                        <td class="table-cell text-right ${details.security_selection_effect >= 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(details.security_selection_effect)}</td>
                                        <td class="table-cell text-right font-bold ${details.total_contribution >= 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(details.total_contribution)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
            </div>
        `;
    }

    displayOptionsStrategies(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Options Strategies</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateOptionsAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        const opportunities = result.opportunities || [];
        const summary = result.summary || {};
        
        container.innerHTML += `
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h4 class="font-semibold text-blue-800">Covered Calls</h4>
                        <p class="text-2xl font-bold text-blue-600">${summary.covered_calls?.count || 0}</p>
                        <p class="text-sm text-blue-600">Premium: ${window.analyticsCore.formatCurrency(summary.covered_calls?.total_premium || 0)}</p>
                    </div>
                    <div class="bg-green-50 p-4 rounded-lg">
                        <h4 class="font-semibold text-green-800">Protective Puts</h4>
                        <p class="text-2xl font-bold text-green-600">${summary.protective_puts?.count || 0}</p>
                        <p class="text-sm text-green-600">Cost: ${window.analyticsCore.formatCurrency(summary.protective_puts?.total_cost || 0)}</p>
                    </div>
                    <div class="bg-purple-50 p-4 rounded-lg">
                        <h4 class="font-semibold text-purple-800">Iron Condors</h4>
                        <p class="text-2xl font-bold text-purple-600">${summary.iron_condors?.count || 0}</p>
                        <p class="text-sm text-purple-600">Premium: ${window.analyticsCore.formatCurrency(summary.iron_condors?.total_premium || 0)}</p>
                    </div>
                </div>
                ${opportunities.length > 0 ? `
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strategy</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strike</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Premium</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delta</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${opportunities.slice(0, 10).map(opp => `
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${opp.symbol}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${opp.strategy}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${window.analyticsCore.formatCurrency(opp.strike)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">${window.analyticsCore.formatCurrency(opp.premium)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${window.analyticsCore.formatNumber(opp.delta)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="text-gray-500 text-center py-4">No options opportunities found</p>'}
            </div>
        `;
    }

    displayPerformanceAttribution(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Performance Attribution</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updatePerformanceAttribution()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        const attribution = result.attribution || {};
        container.innerHTML += `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Asset Allocation</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatPercent(attribution.asset_allocation || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Security Selection</span><span class="font-semibold text-green-600">${window.analyticsCore.formatPercent(attribution.security_selection || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Interaction Effect</span><span class="font-semibold text-purple-600">${window.analyticsCore.formatPercent(attribution.interaction || 0)}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Total Attribution</span><span class="font-semibold text-gray-900">${window.analyticsCore.formatPercent(attribution.total || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Benchmark Return</span><span class="font-semibold text-gray-600">${window.analyticsCore.formatPercent(attribution.benchmark_return || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Active Return</span><span class="font-semibold text-indigo-600">${window.analyticsCore.formatPercent(attribution.active_return || 0)}</span></div>
                </div>
            </div>
        `;
    }

    displayPortfolioOptimization(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        
        // Remove loading text
        setTimeout(() => {
            document.querySelectorAll('*').forEach(el => {
                if (el.textContent && el.textContent.includes('Loading portfolio optimization') && el.offsetHeight < 200) {
                    el.remove();
                }
            });
        }, 100);
        
        const optimization = result.optimization || {};
        const optimal = optimization.optimal_portfolio || {};
        
        const expectedReturn = optimal.expected_return;
        const volatility = optimal.volatility;
        const sharpeRatio = optimal.sharpe_ratio;
        const weights = optimal.weights || {};
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Portfolio Optimization</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updatePortfolioOptimization()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="details-box">
                        <h4 class="section-header">Expected Return</h4>
                        <p class="text-2xl font-bold metric-value positive">${window.analyticsCore.formatPercent(expectedReturn)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Volatility</h4>
                        <p class="text-2xl font-bold metric-value negative">${window.analyticsCore.formatPercent(volatility)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Sharpe Ratio</h4>
                        <p class="text-2xl font-bold metric-value neutral">${window.analyticsCore.formatNumber(sharpeRatio)}</p>
                    </div>
                </div>
                <div class="details-box">
                    <h4 class="section-header">Optimal Weights</h4>
                    <div class="space-y-2">
                        ${Object.entries(weights).map(([symbol, weight]) => `
                            <div class="metric-row">
                                <span class="metric-label">${symbol}</span>
                                <span class="metric-value neutral">${window.analyticsCore.formatPercent(weight)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    displayCorrelationAnalysis(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        
        // Remove all loading text from page
        setTimeout(() => {
            document.querySelectorAll('*').forEach(el => {
                if (el.textContent && 
                    (el.textContent.includes('Computing') || 
                     el.textContent.includes('Analyzing') ||
                     el.textContent.includes('Loading')) && 
                    el.offsetHeight < 200 &&
                    !el.closest('#analysisContent')) {
                    el.remove();
                }
            });
        }, 100);
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Correlation Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateCorrelationAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        const matrix = result.correlation_matrix || {};
        const summary = result.summary || {};
        
        container.innerHTML += `
            <div class="space-y-4">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-blue-800">Average Correlation</h4>
                    <p class="text-2xl font-bold text-blue-600">${window.analyticsCore.formatNumber(summary.average_correlation || 0)}</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">Symbol</th>
                                ${Object.keys(matrix).slice(0, 5).map(symbol => `<th class="px-4 py-2 text-center text-xs font-medium text-gray-500">${symbol}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${Object.entries(matrix).slice(0, 5).map(([symbol, correlations]) => `
                                <tr>
                                    <td class="px-4 py-2 font-medium text-gray-900">${symbol}</td>
                                    ${Object.keys(matrix).slice(0, 5).map(otherSymbol => {
                                        const corr = correlations[otherSymbol] || 0;
                                        const color = corr > 0.7 ? 'text-red-600' : corr > 0.3 ? 'text-yellow-600' : 'text-green-600';
                                        return `<td class="px-4 py-2 text-center ${color}">${window.analyticsCore.formatNumber(corr)}</td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    displaySectorAllocation(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Sector Allocation</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateSectorAllocation()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        const allocation = result.allocation || {};
        const sectors = allocation.sector_allocation || {};
        
        container.innerHTML += `
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${Object.entries(sectors).map(([sector, data]) => `
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <h4 class="font-semibold text-gray-800">${sector}</h4>
                            <p class="text-2xl font-bold text-blue-600">${window.analyticsCore.formatPercent(data.weight || 0)}</p>
                            <p class="text-sm text-gray-600">${data.symbols?.length || 0} symbols</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    displayStatisticalAnalysis(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Statistical Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateStatisticalAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        const statistics = result.statistics || {};
        const portfolio = statistics.portfolio_statistics || {};
        
        container.innerHTML += `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Benchmark Correlation</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatNumber(portfolio.benchmark_correlation || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Beta</span><span class="font-semibold text-green-600">${window.analyticsCore.formatNumber(portfolio.beta || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Alpha</span><span class="font-semibold text-purple-600">${window.analyticsCore.formatPercent(portfolio.alpha || 0)}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">R-squared</span><span class="font-semibold text-gray-900">${window.analyticsCore.formatNumber(portfolio.r_squared || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Tracking Error</span><span class="font-semibold text-red-600">${window.analyticsCore.formatPercent(statistics.risk_metrics?.tracking_error || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Information Ratio</span><span class="font-semibold text-indigo-600">${window.analyticsCore.formatNumber(statistics.risk_metrics?.information_ratio || 0)}</span></div>
                </div>
            </div>
        `;
    }

    displayTechnicalIndicators(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Technical Indicators</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateTechnicalAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        const analysis = result.technical_analysis || {};
        const signals = analysis.portfolio_signals || {};
        
        container.innerHTML += `
            <div class="space-y-4">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold mb-2">Portfolio Signals</h4>
                    <div class="grid grid-cols-3 gap-4">
                        <div class="text-center">
                            <p class="text-2xl font-bold text-green-600">${window.analyticsCore.formatPercent(signals.bullish_weight || 0)}</p>
                            <p class="text-sm text-gray-600">Bullish</p>
                        </div>
                        <div class="text-center">
                            <p class="text-2xl font-bold text-red-600">${window.analyticsCore.formatPercent(signals.bearish_weight || 0)}</p>
                            <p class="text-sm text-gray-600">Bearish</p>
                        </div>
                        <div class="text-center">
                            <p class="text-2xl font-bold text-gray-600">${window.analyticsCore.formatPercent(signals.neutral_weight || 0)}</p>
                            <p class="text-sm text-gray-600">Neutral</p>
                        </div>
                    </div>
                    <div class="mt-4 text-center">
                        <p class="font-semibold">Overall Signal: <span class="text-blue-600">${signals.overall || 'Neutral'}</span></p>
                    </div>
                </div>
            </div>
        `;
    }

    displayStrategyBacktesting(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Strategy Backtesting</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateStrategyBacktesting()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        const backtest = result.backtest || {};
        const performance = backtest.performance_metrics || {};
        const risk = backtest.risk_metrics || {};
        
        container.innerHTML += `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <h4 class="font-semibold text-gray-800">Performance Metrics</h4>
                    <div class="flex justify-between"><span class="text-gray-700">Total Return</span><span class="font-semibold text-green-600">${window.analyticsCore.formatPercent(performance.total_return || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Annual Return</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatPercent(performance.annual_return || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Volatility</span><span class="font-semibold text-red-600">${window.analyticsCore.formatPercent(performance.volatility || 0)}</span></div>
                </div>
                <div class="space-y-3">
                    <h4 class="font-semibold text-gray-800">Risk Metrics</h4>
                    <div class="flex justify-between"><span class="text-gray-700">Sharpe Ratio</span><span class="font-semibold text-green-600">${window.analyticsCore.formatNumber(risk.sharpe_ratio || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Max Drawdown</span><span class="font-semibold text-red-600">${window.analyticsCore.formatPercent(risk.max_drawdown || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Win Rate</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatPercent(performance.win_rate || 0)}</span></div>
                </div>
            </div>
        `;
    }

    displayPnLAttribution(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        const pnl = result.pnl_attribution || {};
        const summary = pnl.summary || {};
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">P&L Attribution Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updatePnLAttribution()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Realized P&L</span><span class="font-semibold ${summary.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">${window.analyticsCore.formatCurrency(summary.realized_pnl || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Unrealized P&L</span><span class="font-semibold ${summary.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">${window.analyticsCore.formatCurrency(summary.unrealized_pnl || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Dividend Income</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatCurrency(summary.dividend_income || 0)}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Total P&L</span><span class="font-semibold ${summary.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">${window.analyticsCore.formatCurrency(summary.total_pnl || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Fees Paid</span><span class="font-semibold text-red-600">${window.analyticsCore.formatCurrency(summary.fees_paid || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Tax Impact</span><span class="font-semibold text-orange-600">${window.analyticsCore.formatCurrency(summary.tax_impact || 0)}</span></div>
                </div>
            </div>
        `;
    }

    displayTradePerformance(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        const performance = result.trade_performance || {};
        const summary = performance;
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Trade Performance Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateTradePerformance()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Total Trades</span><span class="font-semibold text-blue-600">${summary.total_trades || 0}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Winning Trades</span><span class="font-semibold text-green-600">${summary.winning_trades || 0}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Losing Trades</span><span class="font-semibold text-red-600">${summary.losing_trades || 0}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Win Rate</span><span class="font-semibold text-green-600">${window.analyticsCore.formatPercent(summary.win_rate || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Avg Win</span><span class="font-semibold text-green-600">${window.analyticsCore.formatCurrency(summary.avg_win || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Avg Loss</span><span class="font-semibold text-red-600">${window.analyticsCore.formatCurrency(summary.avg_loss || 0)}</span></div>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Profit Factor</span><span class="font-semibold text-purple-600">${window.analyticsCore.formatNumber(summary.profit_factor || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Avg Trade Size</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatCurrency(summary.avg_trade_size || 0)}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Largest Trade</span><span class="font-semibold text-green-600">${window.analyticsCore.formatCurrency(summary.largest_trade || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Smallest Trade</span><span class="font-semibold text-gray-600">${window.analyticsCore.formatCurrency(summary.smallest_trade || 0)}</span></div>
                </div>
            </div>
        `;
    }

    displayCostAnalysis(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        const costs = result.cost_analysis || {};
        const summary = costs.summary || {};
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Cost Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateCostAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Total Commissions</span><span class="font-semibold text-red-600">${window.analyticsCore.formatCurrency(summary.total_commissions || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Total Spreads</span><span class="font-semibold text-orange-600">${window.analyticsCore.formatCurrency(summary.total_spreads || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Total Slippage</span><span class="font-semibold text-yellow-600">${window.analyticsCore.formatCurrency(summary.total_slippage || 0)}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Total Costs</span><span class="font-semibold text-red-600">${window.analyticsCore.formatCurrency(summary.total_costs || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Cost as % Volume</span><span class="font-semibold text-gray-600">${window.analyticsCore.formatPercent(summary.cost_as_pct_volume / 100 || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Avg Cost/Trade</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatCurrency(summary.avg_cost_per_trade || 0)}</span></div>
                </div>
            </div>
        `;
    }

    displayTurnoverAnalysis(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        const turnover = result.turnover_analysis || {};
        const summary = turnover.summary || {};
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Turnover Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateTurnoverAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Annual Turnover</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatPercent(summary.annual_turnover || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Buy Turnover</span><span class="font-semibold text-green-600">${window.analyticsCore.formatPercent(summary.buy_turnover || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Sell Turnover</span><span class="font-semibold text-red-600">${window.analyticsCore.formatPercent(summary.sell_turnover || 0)}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Avg Holding Period</span><span class="font-semibold text-gray-600">${window.analyticsCore.formatNumber(summary.avg_holding_period_days || 0)} days</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Total Buy Volume</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatCurrency(summary.total_buy_volume || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Total Sell Volume</span><span class="font-semibold text-purple-600">${window.analyticsCore.formatCurrency(summary.total_sell_volume || 0)}</span></div>
                </div>
            </div>
        `;
    }

    displayTaxAnalysis(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        const tax = result.tax_analysis || {};
        const summary = tax;
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Tax Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateTaxAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Short-term Gain/Loss</span><span class="font-semibold ${summary.short_term_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">${window.analyticsCore.formatCurrency(summary.short_term_gain_loss || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Long-term Gain/Loss</span><span class="font-semibold ${summary.long_term_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}">${window.analyticsCore.formatCurrency(summary.long_term_gain_loss || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Total Tax Liability</span><span class="font-semibold text-red-600">${window.analyticsCore.formatCurrency(summary.total_tax_liability || 0)}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Wash Sale Adjustments</span><span class="font-semibold text-orange-600">${window.analyticsCore.formatCurrency(summary.wash_sale_adjustments || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Effective Tax Rate</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatPercent(summary.effective_tax_rate / 100 || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Tax Year</span><span class="font-semibold text-gray-600">${summary.tax_year || 'N/A'}</span></div>
                </div>
            </div>
        `;
    }

    displayCashFlowAnalysis(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        const cashFlow = result.cash_flow_analysis || {};
        const summary = cashFlow.summary || {};
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Cash Flow Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateCashFlowAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Total Inflows</span><span class="font-semibold text-green-600">${window.analyticsCore.formatCurrency(summary.total_inflows || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Total Outflows</span><span class="font-semibold text-red-600">${window.analyticsCore.formatCurrency(summary.total_outflows || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Net Cash Flow</span><span class="font-semibold ${summary.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}">${window.analyticsCore.formatCurrency(summary.net_cash_flow || 0)}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Cash Flow Return</span><span class="font-semibold text-blue-600">${window.analyticsCore.formatPercent(summary.cash_flow_return || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Largest Inflow</span><span class="font-semibold text-green-600">${window.analyticsCore.formatCurrency(summary.largest_inflow || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Largest Outflow</span><span class="font-semibold text-red-600">${window.analyticsCore.formatCurrency(summary.largest_outflow || 0)}</span></div>
                </div>
            </div>
        `;
    }

    displayFifoLifoAccounting(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        container.className = 'bg-gray-800 rounded-xl shadow-lg p-6 mb-8';
        const accounting = result.fifo_lifo_analysis || {};
        const summary = accounting.summary || {};
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <div class="flex items-center space-x-4">
                    <button onclick="showDefaultUpload()" class="text-gray-400 hover:text-white">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                    <h2 class="text-2xl font-bold text-white">FIFO/LIFO Accounting</h2>
                </div>
                <button onclick="updateFifoLifoAnalysis()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Refresh
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between py-2"><span class="text-gray-300">Method</span><span class="text-white font-semibold">${summary.method || 'FIFO'}</span></div>
                    <div class="flex justify-between py-2"><span class="text-gray-300">Total Realized Gain/Loss</span><span class="font-semibold ${summary.total_realized_gain_loss >= 0 ? 'text-green-400' : 'text-red-400'}">${window.analyticsCore.formatCurrency(summary.total_realized_gain_loss || 0)}</span></div>
                    <div class="flex justify-between py-2"><span class="text-gray-300">Short-term Gain/Loss</span><span class="font-semibold ${summary.short_term_gain_loss >= 0 ? 'text-green-400' : 'text-red-400'}">${window.analyticsCore.formatCurrency(summary.short_term_gain_loss || 0)}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between py-2"><span class="text-gray-300">Long-term Gain/Loss</span><span class="font-semibold ${summary.long_term_gain_loss >= 0 ? 'text-green-400' : 'text-red-400'}">${window.analyticsCore.formatCurrency(summary.long_term_gain_loss || 0)}</span></div>
                    <div class="flex justify-between py-2"><span class="text-gray-300">Tax Liability</span><span class="font-semibold text-red-400">${window.analyticsCore.formatCurrency(summary.tax_liability || 0)}</span></div>
                    <div class="flex justify-between py-2"><span class="text-gray-300">Period</span><span class="font-semibold text-white">${options.period || '1Y'}</span></div>
                </div>
            </div>
        `;
    }

    displayTradeTiming(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        const timing = result.trade_timing_analysis || {};
        const summary = timing.summary || {};
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Trade Timing Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateTradeTimingAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Best Time Bucket</span><span class="font-semibold text-green-600">${summary.best_time_bucket || 'N/A'}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Best Time Return</span><span class="font-semibold text-green-600">${window.analyticsCore.formatPercent(summary.best_time_return || 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Morning Trades</span><span class="font-semibold text-blue-600">${summary.morning_trades || 0}</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Afternoon Trades</span><span class="font-semibold text-purple-600">${summary.afternoon_trades || 0}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Best Day</span><span class="font-semibold text-green-600">${summary.best_day || 'N/A'}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Total Volume</span><span class="font-semibold text-gray-600">${window.analyticsCore.formatCurrency(summary.total_volume || 0)}</span></div>
                </div>
            </div>
        `;
    }

    displayDrawdownAnalysis(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        container.classList.remove('hidden');
        const drawdown = result.drawdown || {};
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Drawdown Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="updateDrawdownAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Max Drawdown</span><span class="font-semibold text-red-600">${drawdown.max_drawdown_pct || 0}%</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Avg Drawdown</span><span class="font-semibold text-orange-600">${drawdown.avg_drawdown_pct || 0}%</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Recovery Time</span><span class="font-semibold text-blue-600">${drawdown.recovery_days || 0} days</span></div>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between"><span class="text-gray-700">Drawdown Periods</span><span class="font-semibold text-gray-600">${drawdown.drawdown_periods || 0}</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Time in Drawdown</span><span class="font-semibold text-red-600">${drawdown.time_in_drawdown_pct || 0}%</span></div>
                    <div class="flex justify-between"><span class="text-gray-700">Frequency</span><span class="font-semibold text-gray-600">${drawdown.frequency || 'Daily'}</span></div>
                </div>
            </div>
        `;
    }
}

// Create global instance
window.analyticsManager = new AnalyticsManager();

// Export the class for external use
window.AnalyticsManager = AnalyticsManager;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsManager.initialize();
});

// Global update functions for UI - Portfolio Analysis
window.updateRiskAnalysis = () => window.analyticsManager.loadModule('risk-metrics');
window.updateOptionsAnalysis = () => window.analyticsManager.loadModule('options-strategies');
window.updatePerformanceAttribution = () => window.analyticsManager.loadModule('performance-attribution');
window.updateMonteCarloSimulation = () => window.analyticsManager.loadModule('monte-carlo');
window.updatePortfolioOptimization = () => window.analyticsManager.loadModule('portfolio-optimization');
window.updateCorrelationAnalysis = () => window.analyticsManager.loadModule('correlation-analysis');
window.updateSectorAllocation = () => window.analyticsManager.loadModule('sector-allocation');
window.updateStatisticalAnalysis = () => window.analyticsManager.loadModule('statistical-analysis');
window.updateTechnicalAnalysis = () => window.analyticsManager.loadModule('technical-indicators');
window.updateStrategyBacktesting = () => window.analyticsManager.loadModule('strategy-backtesting');

// Global update functions for UI - Transaction Analysis
window.updatePnLAttribution = () => window.analyticsManager.loadModule('pnl-attribution');
window.updateTradePerformance = () => window.analyticsManager.loadModule('trade-performance');
window.updateCostAnalysis = () => window.analyticsManager.loadModule('cost-analysis');
window.updateTurnoverAnalysis = () => window.analyticsManager.loadModule('turnover-analysis');
window.updateTaxAnalysis = () => window.analyticsManager.loadModule('tax-analysis');
window.updateCashFlowAnalysis = () => window.analyticsManager.loadModule('cash-flow');
window.updateFifoLifoAnalysis = () => window.analyticsManager.loadModule('fifo-lifo');
window.updateTradeTimingAnalysis = () => window.analyticsManager.loadModule('trade-timing');
window.updateDrawdownAnalysis = () => window.analyticsManager.loadModule('drawdown-analysis');
window.updateReturnAttribution = () => window.analyticsManager.loadModule('return-attribution');

// Settings toggles - Portfolio Analysis
window.toggleRiskSettings = () => window.analyticsCore.toggleSettings('riskSettings');
window.toggleOptionsSettings = () => window.analyticsCore.toggleSettings('optionsSettings');
window.togglePerformanceSettings = () => window.analyticsCore.toggleSettings('performanceSettings');
window.toggleMonteCarloSettings = () => window.analyticsCore.toggleSettings('monteCarloSettings');
window.toggleOptimizationSettings = () => window.analyticsCore.toggleSettings('optimizationSettings');
window.toggleCorrelationSettings = () => window.analyticsCore.toggleSettings('correlationSettings');
window.toggleSectorSettings = () => window.analyticsCore.toggleSettings('sectorSettings');
window.toggleStatisticalSettings = () => window.analyticsCore.toggleSettings('statisticalSettings');
window.toggleTechnicalSettings = () => window.analyticsCore.toggleSettings('technicalSettings');
window.toggleBacktestingSettings = () => window.analyticsCore.toggleSettings('backtestingSettings');

// Settings toggles - Transaction Analysis
window.togglePnLSettings = () => window.analyticsCore.toggleSettings('pnlSettings');
window.toggleTradeSettings = () => window.analyticsCore.toggleSettings('tradeSettings');
window.toggleCostSettings = () => window.analyticsCore.toggleSettings('costSettings');
window.toggleTurnoverSettings = () => window.analyticsCore.toggleSettings('turnoverSettings');
window.toggleTaxSettings = () => window.analyticsCore.toggleSettings('taxSettings');
window.toggleCashFlowSettings = () => window.analyticsCore.toggleSettings('cashFlowSettings');
window.toggleFifoLifoSettings = () => window.analyticsCore.toggleSettings('fifoLifoSettings');
window.toggleTradeTimingSettings = () => window.analyticsCore.toggleSettings('tradeTimingSettings');
window.toggleDrawdownSettings = () => window.analyticsCore.toggleSettings('drawdownSettings');
window.toggleReturnAttributionSettings = () => window.analyticsCore.toggleSettings('returnAttributionSettings');