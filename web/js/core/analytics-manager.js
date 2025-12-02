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
    // Initialize all modules
    initialize() {
        if (this.initialized) return;

        // Register portfolio modules
        this.register('risk-metrics', {
            endpoint: 'analyze-risk',
            containerId: 'riskResults',
            settingsId: null,
            displayFunction: this.displayRiskMetrics.bind(this),
            type: 'portfolio'
        });

        this.register('options-strategies', {
            endpoint: 'scan-options',
            settingsId: 'optionsSettings',
            displayFunction: this.displayOptionsStrategies.bind(this),
            type: 'portfolio'
        });

        this.register('monte-carlo', {
            endpoint: 'monte-carlo',
            containerId: 'analysisContent',
            settingsId: 'monteCarloSettings',
            displayFunction: this.displayMonteCarloResults.bind(this),
            type: 'portfolio'
        });

        this.register('portfolio-optimization', {
            endpoint: 'portfolio-optimization',
            containerId: 'analysisContent',
            settingsId: 'optimizationSettings',
            displayFunction: this.displayPortfolioOptimization.bind(this),
            type: 'portfolio'
        });

        this.register('correlation-analysis', {
            endpoint: 'correlation-analysis',
            containerId: 'correlationResults',
            settingsId: 'correlationSettings',
            displayFunction: this.displayCorrelationAnalysis.bind(this),
            type: 'portfolio'
        });

        this.register('sector-allocation', {
            endpoint: 'sector-allocation',
            containerId: 'sectorAllocation',
            settingsId: 'sectorSettings',
            displayFunction: this.displaySectorAllocation.bind(this),
            type: 'portfolio'
        });

        this.register('statistical-analysis', {
            endpoint: 'statistical-analysis',
            containerId: 'statisticalAnalysis',
            settingsId: 'statisticalSettings',
            displayFunction: this.displayStatisticalAnalysis.bind(this),
            type: 'portfolio'
        });

        this.register('technical-indicators', {
            endpoint: 'technical-analysis',
            containerId: 'technicalAnalysis',
            settingsId: 'technicalSettings',
            displayFunction: this.displayTechnicalIndicators.bind(this),
            type: 'portfolio'
        });

        this.register('strategy-backtesting', {
            endpoint: 'strategy-backtesting',
            containerId: 'strategyBacktesting',
            settingsId: 'backtestingSettings',
            displayFunction: this.displayStrategyBacktesting.bind(this),
            type: 'portfolio'
        });

        // Register market news module
        this.register('market-news', {
            endpoint: 'news',
            containerId: 'analysisContent',
            settingsId: null,
            displayFunction: this.displayMarketNews.bind(this),
            type: 'news'
        });

        // Register transaction modules
        this.register('pnl-attribution', {
            endpoint: 'pnl-attribution',
            containerId: 'pnlAttribution',
            settingsId: 'pnlSettings',
            displayFunction: this.displayPnLAttribution.bind(this),
            type: 'transaction'
        });

        this.register('trade-performance', {
            endpoint: 'trade-performance',
            containerId: 'tradePerformance',
            settingsId: 'tradeSettings',
            displayFunction: this.displayTradePerformance.bind(this),
            type: 'transaction'
        });

        this.register('cost-analysis', {
            endpoint: 'cost-analysis',
            containerId: 'analysisContent',
            settingsId: 'costSettings',
            displayFunction: this.displayCostAnalysis.bind(this),
            type: 'transaction'
        });

        this.register('turnover-analysis', {
            endpoint: 'turnover-analysis',
            containerId: 'turnoverAnalysis',
            settingsId: 'turnoverSettings',
            displayFunction: this.displayTurnoverAnalysis.bind(this),
            type: 'transaction'
        });

        this.register('tax-analysis', {
            endpoint: 'tax-analysis',
            containerId: 'taxAnalysis',
            settingsId: 'taxSettings',
            displayFunction: this.displayTaxAnalysis.bind(this),
            type: 'transaction'
        });

        this.register('cash-flow', {
            endpoint: 'cash-flow-analysis',
            containerId: 'cashFlowAnalysis',
            settingsId: 'cashFlowSettings',
            displayFunction: null, // Handled by dedicated module
            type: 'transaction'
        });

        this.register('accounting-analysis', {
            endpoint: 'accounting-analysis',
            containerId: 'accountingAnalysis',
            settingsId: 'accountingSettings',
            displayFunction: this.displayAccountingAnalysis.bind(this),
            type: 'transaction'
        });

        this.register('trade-timing', {
            endpoint: 'trade-timing-analysis',
            containerId: 'tradeTimingAnalysis',
            settingsId: 'tradeTimingSettings',
            displayFunction: this.displayTradeTiming.bind(this),
            type: 'transaction'
        });

        this.register('drawdown-analysis', {
            endpoint: 'drawdown-analysis',
            containerId: 'drawdownAnalysis',
            settingsId: 'drawdownSettings',
            displayFunction: this.displayDrawdownAnalysis.bind(this),
            type: 'transaction'
        });

        this.register('return-attribution', {
            endpoint: 'return-attribution',
            containerId: 'returnAttribution',
            settingsId: 'returnAttributionSettings',
            displayFunction: this.displayReturnAttribution.bind(this),
            type: 'transaction'
        });

        // Add performance-attribution as a separate module
        this.register('performance-attribution', {
            endpoint: 'performance-attribution',
            containerId: 'performanceAttribution',
            settingsId: 'performanceAttributionSettings',
            displayFunction: this.displayPerformanceAttribution.bind(this),
            type: 'portfolio'
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
            this.transactionData = event.detail.transactions;
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
        if (!module) {
            console.error(`Module ${name} not found`);
            return;
        }

        // Pass stored settings as options for return-attribution
        if (name === 'return-attribution' && window.analyticsCore?.returnAttributionSettings) {
            await window.analyticsCore.analyzeTransactions(
                module.endpoint,
                module.containerId,
                module.displayFunction,
                module.settingsId,
                window.analyticsCore.returnAttributionSettings
            );
            return;
        }

        // Special handling for P&L Attribution to use its own dedicated handler
        // This ensures the enhanced filters and controls are rendered correctly
        if (name === 'pnl-attribution' && window.loadPnlAttribution) {
            console.log('Delegating to loadPnlAttribution');
            // Ensure container is visible
            const container = document.getElementById('analysisContent');
            if (container) container.classList.remove('hidden');

            // Use the P&L container ID defined in registration
            const pnlContainer = document.getElementById(module.containerId);
            if (pnlContainer) {
                // Clear any previous content/spinner from AnalyticsManager
                if (container && container !== pnlContainer) {
                    container.innerHTML = '';
                    container.appendChild(pnlContainer);
                }
                pnlContainer.classList.remove('hidden');
            }

            window.loadPnlAttribution(this.transactionData || window.currentTransactions);
            return;
        }

        // Special handling for Turnover Analysis to use its own dedicated handler
        if (name === 'turnover-analysis' && window.loadTurnoverAnalysis) {
            console.log('Delegating to loadTurnoverAnalysis');
            // Ensure container is visible
            const container = document.getElementById('analysisContent');
            if (container) container.classList.remove('hidden');

            // Use the Turnover container ID defined in registration
            const turnoverContainer = document.getElementById(module.containerId);
            if (turnoverContainer) {
                // Clear any previous content/spinner from AnalyticsManager
                if (container && container !== turnoverContainer) {
                    container.innerHTML = '';
                    container.appendChild(turnoverContainer);
                }
                turnoverContainer.classList.remove('hidden');
            }

            window.loadTurnoverAnalysis(this.transactionData || window.currentTransactions);
            return;
        }

        // Special handling for Trade Performance to use its own dedicated handler
        if (name === 'trade-performance' && window.loadTradePerformance) {
            console.log('Delegating to loadTradePerformance');
            // Ensure container is visible
            const container = document.getElementById('analysisContent');
            if (container) container.classList.remove('hidden');

            // Use the Trade Performance container ID defined in registration
            const tpContainer = document.getElementById(module.containerId);
            if (tpContainer) {
                // Clear any previous content/spinner from AnalyticsManager
                if (container && container !== tpContainer) {
                    container.innerHTML = '';
                    container.appendChild(tpContainer);
                }
                tpContainer.classList.remove('hidden');
            }

            window.loadTradePerformance(this.transactionData || window.currentTransactions);
            return;
        }

        // Special handling for Cost Analysis to use its own dedicated handler
        if (name === 'cost-analysis' && window.loadCostAnalysis) {
            console.log('Delegating to loadCostAnalysis');

            // Ensure container is visible
            const container = document.getElementById('analysisContent');
            if (container) {
                container.classList.remove('hidden');
                container.innerHTML = '';
            }

            // Check for transaction data
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for cost analysis');
                window.analyticsCore.showDataSourceSelection('transaction');
                return;
            }

            // Use the dedicated cost analysis handler directly
            window.loadCostAnalysis(transactions);
            return;
        }

        // Special handling for Tax Analysis to use its own dedicated handler
        if (name === 'tax-analysis' && window.loadTaxAnalysis) {
            console.log('Delegating to loadTaxAnalysis');
            console.log('Transaction data available:', !!(this.transactionData || window.currentTransactions));
            console.log('Transaction count:', (this.transactionData || window.currentTransactions)?.length || 0);

            // Check for transaction data first
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for tax analysis');
                window.analyticsCore.showDataSourceSelection('transaction');
                return;
            }

            // Call tax analysis with proper data - let it handle its own container
            console.log('Calling loadTaxAnalysis with', transactions.length, 'transactions');
            window.loadTaxAnalysis(transactions);
            return;
        }

        // Special handling for Cash Flow Analysis to use its own dedicated handler
        if (name === 'cash-flow' && window.loadCashFlowAnalysis) {
            console.log('✓ CASH FLOW: Delegating to loadCashFlowAnalysis');

            // Check for transaction data first
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for cash flow analysis');
                window.analyticsCore.showDataSourceSelection('transaction');
                return;
            }

            // Call cash flow analysis with proper data - let it handle its own container
            console.log('✓ CASH FLOW: Calling loadCashFlowAnalysis with', transactions.length, 'transactions');
            window.loadCashFlowAnalysis(transactions);
            return;
        }

        // Special handling for Trade Timing Analysis to use its own dedicated handler
        if (name === 'trade-timing' && window.loadTradeTimingAnalysis) {
            console.log('Delegating to loadTradeTimingAnalysis');

            // Check for transaction data first
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for trade timing analysis');
                window.analyticsCore.showDataSourceSelection('transaction');
                return;
            }

            window.loadTradeTimingAnalysis(transactions);
            return;
        }

        // Special handling for Drawdown Analysis to use its own dedicated handler
        if (name === 'drawdown-analysis' && window.loadDrawdownAnalysis) {
            console.log('Delegating to loadDrawdownAnalysis');

            // Check for transaction data first
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for drawdown analysis');
                window.analyticsCore.showDataSourceSelection('transaction');
                return;
            }

            window.loadDrawdownAnalysis(transactions);
            return;
        }

        // Special handling for Accounting Analysis to use its own dedicated handler
        if ((name === 'accounting-analysis' || name === 'fifo-lifo') && window.loadAccountingAnalysis) {
            console.log('Delegating to loadAccountingAnalysis for', name);

            // Prevent multiple simultaneous calls
            if (window.accountingAnalysisInProgress) {
                console.log('Accounting analysis already in progress, skipping...');
                return;
            }
            window.accountingAnalysisInProgress = true;

            // Check for transaction data first
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for accounting analysis');
                window.analyticsCore.showDataSourceSelection('transaction');
                window.accountingAnalysisInProgress = false;
                return;
            }

            // Call accounting analysis with proper data
            try {
                window.loadAccountingAnalysis(transactions);
            } finally {
                // Reset flag after a delay to allow the analysis to complete
                setTimeout(() => {
                    window.accountingAnalysisInProgress = false;
                }, 1000);
            }
            return;
        }

        // For risk-metrics, ensure default settings are available
        if (name === 'risk-metrics' && !window.analyticsCore.riskSettings) {
            window.analyticsCore.riskSettings = {
                period: '1Y',
                var_confidence: 0.95,
                risk_model: 'historical',
                benchmark: 'SPY',
                rolling_window: 252
            };
        }

        // For options-strategies, pass stored settings as options
        if (name === 'options-strategies' && window.analyticsCore?.optionsSettings) {
            await window.analyticsCore.analyzePortfolio(
                module.endpoint,
                module.containerId,
                module.displayFunction,
                module.settingsId,
                window.analyticsCore.optionsSettings
            );
            return;
        }

        // For monte-carlo, pass stored settings as options
        if (name === 'monte-carlo' && window.analyticsCore?.monteCarloSettings) {
            await window.analyticsCore.analyzePortfolio(
                module.endpoint,
                module.containerId,
                module.displayFunction,
                module.settingsId,
                window.analyticsCore.monteCarloSettings
            );
            return;
        }

        // Clear any existing loading states first
        if (window.loadingManager) {
            window.loadingManager.clearAll();
        }

        // Show loading indicator - skip for cost analysis as it handles its own UI
        if (name !== 'cost-analysis' && name !== 'accounting-analysis') {
            const container = document.getElementById('analysisContent');
            if (container) {
                container.classList.remove('hidden');
                container.innerHTML = `
                `;
            }
        }

        try {
            if (module.type === 'portfolio') {
                console.log(`[LOAD MODULE] Loading portfolio analysis: ${name}`);
                await window.analyticsCore.analyzePortfolio(
                    module.endpoint,
                    module.containerId,
                    module.displayFunction,
                    module.settingsId
                );
            } else if (module.type === 'news') {
                await this.loadMarketNews(module);
            } else {
                console.log(`[LOAD MODULE] Loading transaction analysis: ${name}`);
                await window.analyticsCore.analyzeTransactions(
                    module.endpoint,
                    module.containerId,
                    module.displayFunction,
                    module.settingsId
                );
            }
        } catch (error) {
            console.error(`Failed to load ${name}:`, error);
            const container = document.getElementById('analysisContent');
            if (container) {
                container.innerHTML = `
                `;
            }
            if (window.loadingManager) {
                window.loadingManager.clearAll();
            }
        }
    }



    // Display functions for each module
    displayRiskMetrics(result, options) {
        if (window.loadingManager) {
            window.loadingManager.clearAll();
        }

        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const metrics = result.risk_metrics || {};

        // Get current settings or use API response values
        const currentPeriod = options?.period || metrics.period || '1Y';
        const currentConfidence = options?.var_confidence || metrics.var_confidence || 0.95;
        const currentModel = options?.risk_model || metrics.risk_model || 'historical';
        const currentBenchmark = options?.benchmark || metrics.benchmark || 'SPY';
        const currentWindow = options?.rolling_window || metrics.rolling_window || 252;

        // Helper for formatting
        const fmtPct = (val) => (val === null || val === undefined) ? 'N/A' : (val * 100).toFixed(2) + '%';
        const fmtNum = (val) => (val === null || val === undefined) ? 'N/A' : val.toFixed(2);

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">Risk Metrics</h2>
                    <p class="text-sm text-gray-500 mt-1">Analysis based on current portfolio holdings (Ex-Ante Risk)</p>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleRiskSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="updateRiskAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div id="riskSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                        <select id="riskPeriod" onchange="updateRiskAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="YTD" ${currentPeriod === 'YTD' ? 'selected' : ''}>Year to Date</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">VaR Confidence</label>
                        <select id="riskConfidence" onchange="updateRiskAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="0.90" ${currentConfidence == 0.90 ? 'selected' : ''}>90%</option>
                            <option value="0.95" ${currentConfidence == 0.95 ? 'selected' : ''}>95%</option>
                            <option value="0.99" ${currentConfidence == 0.99 ? 'selected' : ''}>99%</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
                        <select id="riskModel" onchange="updateRiskAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="historical" ${currentModel === 'historical' ? 'selected' : ''}>Historical</option>
                            <option value="parametric" ${currentModel === 'parametric' ? 'selected' : ''}>Parametric</option>
                            <option value="monte_carlo" ${currentModel === 'monte_carlo' ? 'selected' : ''}>Monte Carlo</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                        <select id="riskBenchmark" onchange="updateRiskAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>NASDAQ (QQQ)</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Rolling Window</label>
                        <select id="riskWindow" onchange="updateRiskAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="30" ${currentWindow == 30 ? 'selected' : ''}>30 Days</option>
                            <option value="60" ${currentWindow == 60 ? 'selected' : ''}>60 Days</option>
                            <option value="90" ${currentWindow == 90 ? 'selected' : ''}>90 Days</option>
                            <option value="252" ${currentWindow == 252 ? 'selected' : ''}>252 Days</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Annual Volatility</h3>
                    <p class="text-2xl font-bold text-gray-900 mt-2">${fmtPct(metrics.portfolio_volatility)}</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Value at Risk (${(currentConfidence * 100).toFixed(0)}%)</h3>
                    <p class="text-2xl font-bold text-red-600 mt-2">${fmtPct(metrics.value_at_risk || metrics.var_95)}</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Sharpe Ratio</h3>
                    <p class="text-2xl font-bold text-gray-900 mt-2">${fmtNum(metrics.sharpe_ratio)}</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Sortino Ratio</h3>
                    <p class="text-2xl font-bold text-gray-900 mt-2">${fmtNum(metrics.sortino_ratio)}</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Max Drawdown</h3>
                    <p class="text-2xl font-bold text-red-600 mt-2">${fmtPct(metrics.max_drawdown)}</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Beta vs ${currentBenchmark}</h3>
                    <p class="text-2xl font-bold text-gray-900 mt-2">${fmtNum(metrics.beta)}</p>
                </div>
            </div>

            ${metrics.risk_contribution && Object.keys(metrics.risk_contribution).length > 0 ? `
                <div class="bg-white rounded-lg shadow overflow-hidden mb-6">
                    <div class="px-4 py-3 border-b border-gray-200">
                        <h3 class="text-lg font-medium text-gray-900">Risk Contribution (Top 10)</h3>
                    </div>
                    <div class="p-4 overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Contribution</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${Object.entries(metrics.risk_contribution).slice(0, 10).map(([symbol, contribution]) => `
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${symbol}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">${fmtPct(contribution)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
            
            <div class="bg-gray-50 rounded-lg p-6">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="text-gray-600">Period:</span> <span class="font-medium text-gray-900">${currentPeriod}</span></div>
                    <div><span class="text-gray-600">VaR Confidence:</span> <span class="font-medium text-gray-900">${(currentConfidence * 100).toFixed(0)}%</span></div>
                    <div><span class="text-gray-600">Model:</span> <span class="font-medium text-gray-900">${currentModel}</span></div>
                    <div><span class="text-gray-600">Benchmark:</span> <span class="font-medium text-gray-900">${currentBenchmark}</span></div>
                    <div><span class="text-gray-600">Rolling Window:</span> <span class="font-medium text-gray-900">${currentWindow} days</span></div>
                </div>
            </div>
        `;
    }

    displayOptionsStrategies(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');

        const allOpportunities = (result.opportunities || []).sort((a, b) => a.symbol.localeCompare(b.symbol));
        const summary = result.summary || {};

        console.log(`[OPTIONS DISPLAY] Total opportunities received: ${allOpportunities.length}`);
        console.log(`[OPTIONS DISPLAY] Symbols in opportunities:`, [...new Set(allOpportunities.map(o => o.symbol))]);

        const filteredOpportunities = window.getFilteredOpportunities ? window.getFilteredOpportunities(allOpportunities) : allOpportunities;
        const currentPage = window.optionsCurrentPage || 1;
        const itemsPerPage = 20;
        const totalPages = Math.ceil(filteredOpportunities.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentOpportunities = filteredOpportunities.slice(startIndex, endIndex);

        console.log(`[OPTIONS DISPLAY] Filtered opportunities: ${filteredOpportunities.length}, Current page: ${currentPage}, Showing: ${currentOpportunities.length}`);

        const availableStrategies = [...new Set(allOpportunities.map(opp => opp.strategy))];
        const availableSymbols = [...new Set(allOpportunities.map(opp => opp.symbol))].sort();

        const strategyOptions = availableStrategies.map(strategy => {
            const displayName = strategy.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            return `<option value="${strategy}">${displayName}</option>`;
        }).join('');

        const symbolOptions = availableSymbols.map(symbol =>
            `<option value="${symbol}">${symbol}</option>`
        ).join('');

        const currentExpiration = options?.expiration || '3M';
        const currentMoneyness = options?.moneyness || 'All';
        const currentMinPremium = options?.min_premium || '0.50';
        const currentDeltaRange = options?.delta_range || 'All';

        const definedStrategies = ['covered_calls', 'protective_puts', 'iron_condors'];

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Options Strategies</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleOptionsSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <select id="symbolFilter" onchange="filterOptionsStrategies()" class="px-3 py-1 border border-gray-300 rounded-md text-sm">
                        <option value="all">All Symbols</option>
                        ${symbolOptions}
                    </select>
                    <button onclick="updateOptionsAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm">
                        Refresh
                    </button>
                </div>
            </div>
            
            <div id="optionsSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Expiration</label>
                        <select id="optionsExpiration" onchange="updateOptionsAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="1M" ${currentExpiration === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentExpiration === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentExpiration === '6M' ? 'selected' : ''}>6 Months</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Moneyness</label>
                        <select id="optionsMoneyness" onchange="updateOptionsAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="All" ${currentMoneyness === 'All' ? 'selected' : ''}>All</option>
                            <option value="ITM" ${currentMoneyness === 'ITM' ? 'selected' : ''}>In The Money</option>
                            <option value="ATM" ${currentMoneyness === 'ATM' ? 'selected' : ''}>At The Money</option>
                            <option value="OTM" ${currentMoneyness === 'OTM' ? 'selected' : ''}>Out The Money</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Min Premium</label>
                        <input type="number" id="optionsMinPremium" value="${currentMinPremium}" step="0.25" onchange="updateOptionsAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Delta Range</label>
                        <select id="optionsDeltaRange" onchange="updateOptionsAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="All" ${currentDeltaRange === 'All' ? 'selected' : ''}>All</option>
                            <option value="0.2-0.4" ${currentDeltaRange === '0.2-0.4' ? 'selected' : ''}>0.2 - 0.4</option>
                            <option value="0.4-0.6" ${currentDeltaRange === '0.4-0.6' ? 'selected' : ''}>0.4 - 0.6</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                ${definedStrategies.map(strategy => {
            const strategyOpportunities = allOpportunities.filter(o => o.strategy === strategy);
            const totalPremium = strategyOpportunities.reduce((sum, o) => sum + (o.premium || 0), 0);
            const displayName = strategy.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            const colorClass = strategy === 'covered_calls' ? 'blue' : strategy === 'protective_puts' ? 'green' : 'purple';
            return `
                        <div class="bg-white p-4 rounded-lg shadow">
                            <h3 class="text-sm font-medium text-gray-500">${displayName}</h3>
                            <p class="text-2xl font-bold text-${colorClass}-600 mt-2">${strategyOpportunities.length}</p>
                            <p class="text-xs text-gray-500 mt-1">$${totalPremium.toFixed(2)} total premium</p>
                        </div>
                    `;
        }).join('')}
            </div>
            
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Options Opportunities</h3>
                </div>
                ${allOpportunities.length > 0 ? `
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategy</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strike</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Premium</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiration</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${currentOpportunities.map(opp => `
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${opp.symbol}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${opp.strategy?.replace('_', ' ')}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$${opp.strike?.toFixed(2) || 'N/A'}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$${opp.premium?.toFixed(2) || '0.00'}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${opp.expiration || 'N/A'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ${totalPages > 1 ? `
                        <div class="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
                            <button onclick="changeOptionsPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="px-3 py-1 border rounded text-sm">Previous</button>
                            <span class="text-sm text-gray-700">Page ${currentPage} of ${totalPages}</span>
                            <button onclick="changeOptionsPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1 border rounded text-sm">Next</button>
                        </div>
                    ` : ''}
                ` : '<div class="p-4"><p class="text-gray-500 text-center py-4">No options opportunities found</p></div>'}
            </div>
            
            <div class="bg-gray-50 rounded-lg p-6 mt-6">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span class="text-gray-600">Expiration:</span> <span class="font-medium text-gray-900">${currentExpiration}</span></div>
                    <div><span class="text-gray-600">Moneyness:</span> <span class="font-medium text-gray-900">${currentMoneyness}</span></div>
                    <div><span class="text-gray-600">Min Premium:</span> <span class="font-medium text-gray-900">$${currentMinPremium}</span></div>
                    <div><span class="text-gray-600">Delta Range:</span> <span class="font-medium text-gray-900">${currentDeltaRange}</span></div>
                </div>
            </div>
        `;

        // Store opportunities and summary for pagination
        window.optionsOpportunities = allOpportunities;
        window.optionsSummary = summary;
        window.optionsCurrentPage = currentPage;

        // Clear loading spinner
        if (window.clearAllLoadingSpinners) {
            window.clearAllLoadingSpinners();
        }

        // Restore filter selections
        setTimeout(() => {
            const strategySelect = document.getElementById('strategyFilter');
            const symbolSelect = document.getElementById('symbolFilter');

            if (strategySelect && window.optionsStrategyFilter) {
                strategySelect.value = window.optionsStrategyFilter;
            }
            if (symbolSelect && window.optionsSymbolFilter) {
                symbolSelect.value = window.optionsSymbolFilter;
            }

            if (strategySelect) {
                strategySelect.addEventListener('change', () => {
                    window.optionsStrategyFilter = strategySelect.value;
                });
            }
            if (symbolSelect) {
                symbolSelect.addEventListener('change', () => {
                    window.optionsSymbolFilter = symbolSelect.value;
                });
            }
        }, 50);
    }

    displayPortfolioOptimization(result, options) {
        console.log('[PORTFOLIO OPTIMIZATION DEBUG] Display function called');
        console.log('[PORTFOLIO OPTIMIZATION DEBUG] Result:', result);
        console.log('[PORTFOLIO OPTIMIZATION DEBUG] Options:', options);
        
        const container = document.getElementById('analysisContent');
        if (!container) {
            console.error('[PORTFOLIO OPTIMIZATION DEBUG] Container not found');
            return;
        }

        container.classList.remove('hidden');
        const optimization = result.optimization || result;
        console.log('[PORTFOLIO OPTIMIZATION DEBUG] Optimization data:', optimization);
        
        const efficientFrontier = optimization.efficient_frontier || [];
        const optimal = optimization.optimal_portfolio || {};
        const current = optimization.current_portfolio || {};
        const trades = optimization.recommended_trades || [];
        
        console.log('[PORTFOLIO OPTIMIZATION DEBUG] Data extracted:', {
            efficientFrontier: efficientFrontier.length,
            optimal: Object.keys(optimal),
            current: Object.keys(current),
            trades: trades.length
        });

        // Get current settings
        const currentObjective = options?.objective || 'max_sharpe';
        const currentConstraint = options?.constraint || 'long_only';
        const currentRebalancing = options?.rebalancing || 'quarterly';
        const currentRiskBudget = options?.risk_budget || 'equal';
        const currentLookback = options?.lookback_period || '1Y';

        // Helper for formatting
        const fmtPct = (val) => (val === null || val === undefined || isNaN(val)) ? 'N/A' : (val * 100).toFixed(2) + '%';
        const fmtNum = (val) => (val === null || val === undefined || isNaN(val)) ? 'N/A' : val.toFixed(2);

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Portfolio Optimization</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleOptimizationSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="updatePortfolioOptimization()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div id="optimizationSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Objective</label>
                        <select id="optimizationObjective" onchange="updatePortfolioOptimization()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="max_sharpe" ${currentObjective === 'max_sharpe' ? 'selected' : ''}>Max Sharpe Ratio</option>
                            <option value="min_volatility" ${currentObjective === 'min_volatility' ? 'selected' : ''}>Min Volatility</option>
                            <option value="max_return" ${currentObjective === 'max_return' ? 'selected' : ''}>Max Return</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Constraint</label>
                        <select id="optimizationConstraint" onchange="updatePortfolioOptimization()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="long_only" ${currentConstraint === 'long_only' ? 'selected' : ''}>Long Only</option>
                            <option value="130_30" ${currentConstraint === '130_30' ? 'selected' : ''}>130/30 Strategy</option>
                            <option value="market_neutral" ${currentConstraint === 'market_neutral' ? 'selected' : ''}>Market Neutral</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Rebalancing</label>
                        <select id="optimizationRebalancing" onchange="updatePortfolioOptimization()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="monthly" ${currentRebalancing === 'monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="quarterly" ${currentRebalancing === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                            <option value="semi_annual" ${currentRebalancing === 'semi_annual' ? 'selected' : ''}>Semi-Annual</option>
                            <option value="annual" ${currentRebalancing === 'annual' ? 'selected' : ''}>Annual</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Risk Budget</label>
                        <select id="optimizationRiskBudget" onchange="updatePortfolioOptimization()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="equal" ${currentRiskBudget === 'equal' ? 'selected' : ''}>Equal Weight</option>
                            <option value="risk_parity" ${currentRiskBudget === 'risk_parity' ? 'selected' : ''}>Risk Parity</option>
                            <option value="custom" ${currentRiskBudget === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Lookback Period</label>
                        <select id="optimizationLookback" onchange="updatePortfolioOptimization()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="1Y" ${currentLookback === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentLookback === '2Y' ? 'selected' : ''}>2 Years</option>
                            <option value="3Y" ${currentLookback === '3Y' ? 'selected' : ''}>3 Years</option>
                            <option value="5Y" ${currentLookback === '5Y' ? 'selected' : ''}>5 Years</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <!-- Summary Cards -->
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Sharpe Ratio</h3>
                    <div class="flex justify-between items-end mt-2">
                        <div>
                            <span class="text-2xl font-bold text-gray-900">${fmtNum(optimal.sharpe_ratio || 0)}</span>
                            <span class="text-xs text-green-600 ml-2">Optimal</span>
                        </div>
                        <div class="text-right">
                            <span class="text-sm text-gray-500">${fmtNum(current.sharpe_ratio || 0)}</span>
                            <span class="text-xs text-gray-400 block">Current</span>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Expected Return</h3>
                    <div class="flex justify-between items-end mt-2">
                        <div>
                            <span class="text-2xl font-bold text-gray-900">${fmtPct(optimal.expected_return || 0)}</span>
                            <span class="text-xs text-green-600 ml-2">Optimal</span>
                        </div>
                        <div class="text-right">
                            <span class="text-sm text-gray-500">${fmtPct(current.expected_return || 0)}</span>
                            <span class="text-xs text-gray-400 block">Current</span>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Volatility (Risk)</h3>
                    <div class="flex justify-between items-end mt-2">
                        <div>
                            <span class="text-2xl font-bold text-gray-900">${fmtPct(optimal.volatility || 0)}</span>
                            <span class="text-xs text-blue-600 ml-2">Optimal</span>
                        </div>
                        <div class="text-right">
                            <span class="text-sm text-gray-500">${fmtPct(current.volatility || 0)}</span>
                            <span class="text-xs text-gray-400 block">Current</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <!-- Efficient Frontier Chart -->
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Efficient Frontier</h3>
                    <div class="h-64 relative">
                        <canvas id="efficientFrontierChart"></canvas>
                    </div>
                </div>

                <!-- Allocation Comparison -->
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Allocation Comparison</h3>
                    <div class="h-64 relative">
                        <canvas id="allocationChart"></canvas>
                    </div>
                </div>
            </div>

            ${trades && trades.length > 0 ? `
            <!-- Recommended Trades -->
            <div class="bg-white rounded-lg shadow overflow-hidden mb-6">
                <div class="px-4 py-3 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Recommended Trades</h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight Change</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${trades.map(trade => `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${trade.symbol}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${trade.action === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                            ${trade.action}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${Math.abs(trade.quantity).toFixed(2)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$${Math.abs(trade.value).toLocaleString()}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${(trade.weight_change * 100).toFixed(2)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}

            <div class="bg-gray-50 rounded-lg p-6">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="text-gray-600">Objective:</span> <span class="font-medium text-gray-900">${currentObjective.replace('_', ' ')}</span></div>
                    <div><span class="text-gray-600">Constraint:</span> <span class="font-medium text-gray-900">${currentConstraint.replace('_', ' ')}</span></div>
                    <div><span class="text-gray-600">Rebalancing:</span> <span class="font-medium text-gray-900">${currentRebalancing.replace('_', ' ')}</span></div>
                    <div><span class="text-gray-600">Risk Budget:</span> <span class="font-medium text-gray-900">${currentRiskBudget.replace('_', ' ')}</span></div>
                    <div><span class="text-gray-600">Lookback:</span> <span class="font-medium text-gray-900">${currentLookback}</span></div>
                </div>
            </div>
        `;

        // Render Charts after DOM is ready
        setTimeout(() => {
            if (typeof Chart !== 'undefined') {
                this.renderEfficientFrontierChart(efficientFrontier, current, optimal);
                this.renderAllocationChart(current.weights, optimal.weights);
            } else {
                console.warn('Chart.js not available for portfolio optimization charts');
            }
        }, 100);
    }

    renderEfficientFrontierChart(frontier, current, optimal) {
        const ctx = document.getElementById('efficientFrontierChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.frontierChartInstance) {
            this.frontierChartInstance.destroy();
        }

        console.log('[FRONTIER CHART] Data:', { frontier, current, optimal });

        // Prepare datasets
        const datasets = [];

        // Add efficient frontier if available
        if (frontier && frontier.length > 0) {
            const frontierData = frontier.filter(p => 
                p && typeof p.volatility === 'number' && typeof p.expected_return === 'number' &&
                !isNaN(p.volatility) && !isNaN(p.expected_return)
            ).map(p => ({ x: p.volatility, y: p.expected_return }));
            
            if (frontierData.length > 0) {
                datasets.push({
                    label: 'Efficient Frontier',
                    data: frontierData,
                    borderColor: '#4F46E5',
                    showLine: true,
                    fill: false,
                    pointRadius: 2
                });
            }
        }

        // Add current portfolio point if valid
        if (current && typeof current.volatility === 'number' && typeof current.expected_return === 'number' &&
            !isNaN(current.volatility) && !isNaN(current.expected_return)) {
            datasets.push({
                label: 'Current Portfolio',
                data: [{ x: current.volatility, y: current.expected_return }],
                backgroundColor: '#EF4444',
                borderColor: '#EF4444',
                pointRadius: 8,
                pointStyle: 'triangle'
            });
        }

        // Add optimal portfolio point if valid
        if (optimal && typeof optimal.volatility === 'number' && typeof optimal.expected_return === 'number' &&
            !isNaN(optimal.volatility) && !isNaN(optimal.expected_return)) {
            datasets.push({
                label: 'Optimal Portfolio',
                data: [{ x: optimal.volatility, y: optimal.expected_return }],
                backgroundColor: '#10B981',
                borderColor: '#10B981',
                pointRadius: 8,
                pointStyle: 'rectRot'
            });
        }

        console.log('[FRONTIER CHART] Datasets:', datasets);

        this.frontierChartInstance = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Volatility (Risk)' }, 
                        ticks: { callback: v => (v * 100).toFixed(1) + '%' }
                    },
                    y: { 
                        title: { display: true, text: 'Expected Return' }, 
                        ticks: { callback: v => (v * 100).toFixed(1) + '%' }
                    }
                }
            }
        });
    }

    renderAllocationChart(currentWeights, optimalWeights) {
        const ctx = document.getElementById('allocationChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.allocationChartInstance) {
            this.allocationChartInstance.destroy();
        }

        console.log('[ALLOCATION CHART] Weights:', { currentWeights, optimalWeights });

        const safeCurrentWeights = currentWeights || {};
        const safeOptimalWeights = optimalWeights || {};

        const symbols = [...new Set([...Object.keys(safeCurrentWeights), ...Object.keys(safeOptimalWeights)])]
            .filter(s => s && s.length > 0);

        if (symbols.length === 0) {
            console.warn('[ALLOCATION CHART] No symbols found');
            return;
        }

        const datasets = [];
        
        // Add current weights if available
        if (Object.keys(safeCurrentWeights).length > 0) {
            datasets.push({
                label: 'Current',
                data: symbols.map(s => (safeCurrentWeights[s] || 0) * 100),
                backgroundColor: '#9CA3AF',
                borderColor: '#6B7280',
                borderWidth: 1
            });
        }
        
        // Add optimal weights if available
        if (Object.keys(safeOptimalWeights).length > 0) {
            datasets.push({
                label: 'Optimal',
                data: symbols.map(s => (safeOptimalWeights[s] || 0) * 100),
                backgroundColor: '#4F46E5',
                borderColor: '#3730A3',
                borderWidth: 1
            });
        }

        console.log('[ALLOCATION CHART] Final datasets:', datasets);

        this.allocationChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: symbols,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    y: { 
                        title: { display: true, text: 'Weight (%)' },
                        beginAtZero: true
                    }
                }
            }
        });
    }
    displayMonteCarloResults(result, options) {
        console.log('[MONTE CARLO DEBUG] Display function called');
        console.log('[MONTE CARLO DEBUG] Result:', result);
        console.log('[MONTE CARLO DEBUG] Options:', options);

        const container = document.getElementById('analysisContent');
        if (!container) {
            console.error('[MONTE CARLO DEBUG] Container not found');
            return;
        }

        container.classList.remove('hidden');
        const results = result.results || {};
        const simulationData = results.simulation_data || [];
        const summary = results.summary_statistics || {};

        console.log('[MONTE CARLO DEBUG] Simulation data length:', simulationData.length);
        console.log('[MONTE CARLO DEBUG] Summary stats:', summary);

        // Get current settings
        const currentPeriod = options?.forecast_period || '1Y';
        const currentSimulations = options?.simulations || 1000;
        const currentConfidence = options?.confidence_intervals || 0.95;
        const currentRegime = options?.market_regime || 'normal';
        const currentVolatility = options?.volatility_adjustment || 1.0;

        // Helper for formatting
        const fmtPct = (val) => (val * 100).toFixed(2) + '%';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Monte Carlo Simulation</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleMonteCarloSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="updateMonteCarloAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div id="monteCarloSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Forecast Period</label>
                        <select id="mcForecastPeriod" onchange="updateMonteCarloAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentPeriod === '2Y' ? 'selected' : ''}>2 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Simulations</label>
                        <select id="mcSimulations" onchange="updateMonteCarloAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="1000" ${currentSimulations == 1000 ? 'selected' : ''}>1,000</option>
                            <option value="5000" ${currentSimulations == 5000 ? 'selected' : ''}>5,000</option>
                            <option value="10000" ${currentSimulations == 10000 ? 'selected' : ''}>10,000</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Confidence Level</label>
                        <select id="mcConfidenceIntervals" onchange="updateMonteCarloAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="0.90" ${currentConfidence == 0.90 ? 'selected' : ''}>90%</option>
                            <option value="0.95" ${currentConfidence == 0.95 ? 'selected' : ''}>95%</option>
                            <option value="0.99" ${currentConfidence == 0.99 ? 'selected' : ''}>99%</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Market Regime</label>
                        <select id="mcMarketRegime" onchange="updateMonteCarloAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="normal" ${currentRegime === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="bull" ${currentRegime === 'bull' ? 'selected' : ''}>Bull Market</option>
                            <option value="bear" ${currentRegime === 'bear' ? 'selected' : ''}>Bear Market</option>
                            <option value="volatile" ${currentRegime === 'volatile' ? 'selected' : ''}>High Volatility</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Volatility Adjustment</label>
                        <select id="mcVolatilityAdjustment" onchange="updateMonteCarloAnalysis()" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option value="0.8" ${currentVolatility == 0.8 ? 'selected' : ''}>0.8x (Lower)</option>
                            <option value="1.0" ${currentVolatility == 1.0 ? 'selected' : ''}>1.0x (Normal)</option>
                            <option value="1.2" ${currentVolatility == 1.2 ? 'selected' : ''}>1.2x (Higher)</option>
                            <option value="1.5" ${currentVolatility == 1.5 ? 'selected' : ''}>1.5x (Much Higher)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Expected Return (Mean)</h3>
                    <p class="text-2xl font-bold text-gray-900 mt-2">${fmtPct(summary.mean_return || 0)}</p>
                    <p class="text-xs text-gray-500 mt-1">Average outcome</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Value at Risk (${(currentConfidence * 100).toFixed(0)}%)</h3>
                    <p class="text-2xl font-bold text-red-600 mt-2">${fmtPct(summary.value_at_risk_95 || 0)}</p>
                    <p class="text-xs text-gray-500 mt-1">Worst ${((1 - currentConfidence) * 100).toFixed(0)}% outcome</p>
                </div>
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-gray-500">Best Case (${(currentConfidence * 100).toFixed(0)}%)</h3>
                    <p class="text-2xl font-bold text-green-600 mt-2">${fmtPct(summary.percentile_95 || 0)}</p>
                    <p class="text-xs text-gray-500 mt-1">Top ${((1 - currentConfidence) * 100).toFixed(0)}% outcome</p>
                </div>
            </div>

            <div class="bg-white p-4 rounded-lg shadow mb-6">
                <h3 class="text-lg font-medium text-gray-900 mb-4">Monte Carlo Simulation Paths</h3>
                <div class="h-80 relative">
                    <canvas id="monteCarloChart"></canvas>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow overflow-hidden mb-6">
                <div class="px-4 py-3 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Simulation Statistics</h3>
                </div>
                <div class="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <span class="text-sm text-gray-500 block">Median Return</span>
                        <span class="text-lg font-semibold text-gray-900">${fmtPct(summary.median_return || 0)}</span>
                    </div>
                    <div>
                        <span class="text-sm text-gray-500 block">Standard Deviation</span>
                        <span class="text-lg font-semibold text-gray-900">${fmtPct(summary.std_dev || 0)}</span>
                    </div>
                    <div>
                        <span class="text-sm text-gray-500 block">Min Return</span>
                        <span class="text-lg font-semibold text-red-600">${fmtPct(summary.min_return || 0)}</span>
                    </div>
                    <div>
                        <span class="text-sm text-gray-500 block">Max Return</span>
                        <span class="text-lg font-semibold text-green-600">${fmtPct(summary.max_return || 0)}</span>
                    </div>
                </div>
            </div>

            <div class="bg-gray-50 rounded-lg p-6">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="text-gray-600">Forecast Period:</span> <span class="font-medium text-gray-900">${currentPeriod}</span></div>
                    <div><span class="text-gray-600">Simulations:</span> <span class="font-medium text-gray-900">${currentSimulations.toLocaleString()}</span></div>
                    <div><span class="text-gray-600">Confidence Level:</span> <span class="font-medium text-gray-900">${(currentConfidence * 100).toFixed(0)}%</span></div>
                    <div><span class="text-gray-600">Market Regime:</span> <span class="font-medium text-gray-900">${currentRegime}</span></div>
                    <div><span class="text-gray-600">Volatility Adj:</span> <span class="font-medium text-gray-900">${currentVolatility}x</span></div>
                </div>
            </div>
        `;

        console.log('[MONTE CARLO DEBUG] HTML content set, chart canvas should be available');
        console.log('[MONTE CARLO DEBUG] Simulation data available:', !!simulationData, 'Length:', simulationData?.length || 0);

        console.log('[MONTE CARLO] Display completed successfully');

        // Try to render chart after DOM is ready
        setTimeout(() => {
            const canvas = document.getElementById('monteCarloChart');
            if (canvas && typeof Chart !== 'undefined' && simulationData?.length > 0) {
                try {
                    this.renderMonteCarloChart(simulationData);
                } catch (e) {
                    console.log('[MONTE CARLO DEBUG] Chart render failed:', e.message);
                }
            }
        }, 200);
    }

    // Fallback chart creation when Chart.js fails
    createFallbackMonteCarloChart(canvas, simulationData) {
        console.log('[MONTE CARLO DEBUG] Creating fallback SVG chart');

        const container = canvas.parentElement;
        if (!container) {
            console.error('[MONTE CARLO DEBUG] No container found for fallback chart');
            return;
        }

        // Hide the canvas and create SVG
        canvas.style.display = 'none';

        // Remove any existing fallback
        const existingFallback = container.querySelector('.monte-carlo-fallback');
        if (existingFallback) {
            existingFallback.remove();
        }

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.className = 'monte-carlo-fallback';
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '320');
        svg.setAttribute('viewBox', '0 0 800 320');
        svg.style.border = '1px solid #e5e7eb';
        svg.style.borderRadius = '8px';
        svg.style.backgroundColor = '#f9fafb';

        // Add title
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', '400');
        title.setAttribute('y', '30');
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-family', 'Arial, sans-serif');
        title.setAttribute('font-size', '16');
        title.setAttribute('font-weight', 'bold');
        title.setAttribute('fill', '#374151');
        title.textContent = 'Monte Carlo Simulation Paths (Fallback View)';
        svg.appendChild(title);

        if (!simulationData || !Array.isArray(simulationData) || simulationData.length === 0) {
            // Show no data message
            const noDataText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            noDataText.setAttribute('x', '400');
            noDataText.setAttribute('y', '160');
            noDataText.setAttribute('text-anchor', 'middle');
            noDataText.setAttribute('font-family', 'Arial, sans-serif');
            noDataText.setAttribute('font-size', '14');
            noDataText.setAttribute('fill', '#6b7280');
            noDataText.textContent = 'No simulation data available';
            svg.appendChild(noDataText);

            const debugText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            debugText.setAttribute('x', '400');
            debugText.setAttribute('y', '180');
            debugText.setAttribute('text-anchor', 'middle');
            debugText.setAttribute('font-family', 'Arial, sans-serif');
            debugText.setAttribute('font-size', '12');
            debugText.setAttribute('fill', '#9ca3af');
            debugText.textContent = `Data type: ${typeof simulationData}, Length: ${simulationData?.length || 0}`;
            svg.appendChild(debugText);
        } else {
            // Draw simplified paths
            const maxPaths = Math.min(20, simulationData.length);
            const pathLength = simulationData[0] ? simulationData[0].length : 0;

            console.log('[MONTE CARLO DEBUG] Drawing', maxPaths, 'paths with length', pathLength);

            if (pathLength > 0) {
                // Calculate scales
                let minValue = Infinity;
                let maxValue = -Infinity;

                for (let i = 0; i < maxPaths; i++) {
                    if (simulationData[i] && Array.isArray(simulationData[i])) {
                        for (let j = 0; j < simulationData[i].length; j++) {
                            const val = simulationData[i][j];
                            if (typeof val === 'number' && !isNaN(val)) {
                                minValue = Math.min(minValue, val);
                                maxValue = Math.max(maxValue, val);
                            }
                        }
                    }
                }

                if (minValue !== Infinity && maxValue !== -Infinity) {
                    const xScale = 750 / (pathLength - 1);
                    const yScale = 220 / (maxValue - minValue);
                    const yOffset = 270;

                    // Draw paths
                    for (let i = 0; i < maxPaths; i++) {
                        if (simulationData[i] && Array.isArray(simulationData[i])) {
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                            const points = simulationData[i].map((value, index) => {
                                if (typeof value === 'number' && !isNaN(value)) {
                                    const x = 25 + index * xScale;
                                    const y = yOffset - (value - minValue) * yScale;
                                    return `${x},${y}`;
                                }
                                return null;
                            }).filter(p => p !== null).join(' ');

                            if (points) {
                                path.setAttribute('points', points);
                                path.setAttribute('fill', 'none');
                                path.setAttribute('stroke', `rgba(79, 70, 229, ${0.2 + (i / maxPaths) * 0.3})`);
                                path.setAttribute('stroke-width', '1.5');
                                svg.appendChild(path);
                            }
                        }
                    }

                    // Add axes
                    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    xAxis.setAttribute('x1', '25');
                    xAxis.setAttribute('y1', yOffset);
                    xAxis.setAttribute('x2', '775');
                    xAxis.setAttribute('y2', yOffset);
                    xAxis.setAttribute('stroke', '#d1d5db');
                    xAxis.setAttribute('stroke-width', '1');
                    svg.appendChild(xAxis);

                    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    yAxis.setAttribute('x1', '25');
                    yAxis.setAttribute('y1', '50');
                    yAxis.setAttribute('x2', '25');
                    yAxis.setAttribute('y2', yOffset);
                    yAxis.setAttribute('stroke', '#d1d5db');
                    yAxis.setAttribute('stroke-width', '1');
                    svg.appendChild(yAxis);

                    // Add labels
                    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    xLabel.setAttribute('x', '400');
                    xLabel.setAttribute('y', '310');
                    xLabel.setAttribute('text-anchor', 'middle');
                    xLabel.setAttribute('font-family', 'Arial, sans-serif');
                    xLabel.setAttribute('font-size', '12');
                    xLabel.setAttribute('fill', '#6b7280');
                    xLabel.textContent = 'Time (Days)';
                    svg.appendChild(xLabel);

                    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    yLabel.setAttribute('x', '15');
                    yLabel.setAttribute('y', '160');
                    yLabel.setAttribute('text-anchor', 'middle');
                    yLabel.setAttribute('font-family', 'Arial, sans-serif');
                    yLabel.setAttribute('font-size', '12');
                    yLabel.setAttribute('fill', '#6b7280');
                    yLabel.setAttribute('transform', 'rotate(-90, 15, 160)');
                    yLabel.textContent = 'Portfolio Value';
                    svg.appendChild(yLabel);

                    // Add value labels
                    const minLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    minLabel.setAttribute('x', '20');
                    minLabel.setAttribute('y', yOffset + 5);
                    minLabel.setAttribute('text-anchor', 'end');
                    minLabel.setAttribute('font-family', 'Arial, sans-serif');
                    minLabel.setAttribute('font-size', '10');
                    minLabel.setAttribute('fill', '#9ca3af');
                    minLabel.textContent = minValue.toFixed(0);
                    svg.appendChild(minLabel);

                    const maxLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    maxLabel.setAttribute('x', '20');
                    maxLabel.setAttribute('y', '55');
                    maxLabel.setAttribute('text-anchor', 'end');
                    maxLabel.setAttribute('font-family', 'Arial, sans-serif');
                    maxLabel.setAttribute('font-size', '10');
                    maxLabel.setAttribute('fill', '#9ca3af');
                    maxLabel.textContent = maxValue.toFixed(0);
                    svg.appendChild(maxLabel);
                }
            }

            // Add info text
            const infoText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            infoText.setAttribute('x', '400');
            infoText.setAttribute('y', '295');
            infoText.setAttribute('text-anchor', 'middle');
            infoText.setAttribute('font-family', 'Arial, sans-serif');
            infoText.setAttribute('font-size', '10');
            infoText.setAttribute('fill', '#9ca3af');
            infoText.textContent = `Showing ${Math.min(20, simulationData.length)} of ${simulationData.length} simulation paths`;
            svg.appendChild(infoText);
        }

        container.appendChild(svg);
        console.log('[MONTE CARLO DEBUG] Fallback chart created and added to DOM');
    }

    renderMonteCarloChart(simulationData) {
        console.log('[MONTE CARLO DEBUG] renderMonteCarloChart called with data:', simulationData?.length || 0, 'paths');

        const ctx = document.getElementById('monteCarloChart');
        if (!ctx) {
            console.error('[MONTE CARLO DEBUG] Canvas element not found');
            return;
        }

        console.log('[MONTE CARLO DEBUG] Canvas element found:', ctx);

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('[MONTE CARLO DEBUG] Chart.js is not loaded');
            return;
        }

        // Destroy existing chart if it exists
        if (this.monteCarloChartInstance) {
            console.log('[MONTE CARLO DEBUG] Destroying existing chart instance');
            this.monteCarloChartInstance.destroy();
        }

        // Validate simulation data
        if (!simulationData || !Array.isArray(simulationData) || simulationData.length === 0) {
            console.error('[MONTE CARLO DEBUG] Invalid simulation data:', simulationData);
            // Show placeholder message
            ctx.getContext('2d').fillText('No simulation data available', 50, 50);
            return;
        }

        // Downsample if too many paths for performance
        const maxPaths = 100;
        const pathsToShow = simulationData.slice(0, maxPaths);
        console.log('[MONTE CARLO DEBUG] Showing', pathsToShow.length, 'paths');

        // Validate path data
        if (pathsToShow.length === 0 || !pathsToShow[0] || !Array.isArray(pathsToShow[0])) {
            console.error('[MONTE CARLO DEBUG] Invalid path data structure:', pathsToShow[0]);
            return;
        }

        const labels = Array.from({ length: pathsToShow[0]?.length || 0 }, (_, i) => i);
        console.log('[MONTE CARLO DEBUG] Chart labels length:', labels.length);

        const datasets = pathsToShow.map((path, i) => ({
            label: `Path ${i + 1}`,
            data: path,
            borderColor: 'rgba(79, 70, 229, 0.1)', // Very transparent blue
            borderWidth: 1,
            pointRadius: 0,
            fill: false
        }));

        console.log('[MONTE CARLO DEBUG] Created', datasets.length, 'datasets');

        try {
            this.monteCarloChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        x: { title: { display: true, text: 'Days' } },
                        y: { title: { display: true, text: 'Portfolio Value' } }
                    },
                    animation: false
                }
            });
            console.log('[MONTE CARLO DEBUG] Chart created successfully:', this.monteCarloChartInstance);
        } catch (error) {
            console.error('[MONTE CARLO DEBUG] Chart creation failed:', error);
            console.error('[MONTE CARLO DEBUG] Error stack:', error.stack);

            // Show error message instead of fallback
            console.log('[MONTE CARLO DEBUG] Chart creation failed, showing error');
            const container = ctx.parentElement;
            if (container) {
                container.innerHTML = '<div class="text-center py-8 text-gray-500">Chart rendering failed. Please refresh and try again.</div>';
            }
        }
    }

    displaySectorAllocation(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const allocation = result.allocation || {};
        const sectorData = allocation.sector_allocation || {};

        const sectors = Object.entries(sectorData).sort((a, b) => b[1] - a[1]);
        const labels = sectors.map(s => s[0]);
        const data = sectors.map(s => (s[1] * 100).toFixed(2));
        const colors = [
            '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#06B6D4'
        ];

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <!-- Sector Chart -->
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Sector Allocation</h3>
                    <div class="h-64 relative">
                        <canvas id="sectorPieChart"></canvas>
                    </div>
                </div>

                <!-- Sector Table -->
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <div class="px-4 py-3 border-b border-gray-200">
                        <h3 class="text-lg font-medium text-gray-900">Sector Breakdown</h3>
                    </div>
                    <div class="overflow-y-auto max-h-64">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sector</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${sectors.map((sector, i) => `
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            <span class="inline-block w-3 h-3 rounded-full mr-2" style="background-color: ${colors[i % colors.length]}"></span>
                                            ${sector[0]}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">${(sector[1] * 100).toFixed(2)}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.renderSectorChart(labels, data, colors);
    }

    renderSectorChart(labels, data, colors) {
        const ctx = document.getElementById('sectorPieChart');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    }

    displayStatisticalAnalysis(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const analysis = result.statistical_analysis || result.analysis || {};
        const riskMetrics = analysis.risk_metrics || {};
        const performanceMetrics = analysis.performance_metrics || {};
        const correlationAnalysis = analysis.correlation_analysis || {};

        // Helper for formatting
        const fmtPct = (val) => (val * 100).toFixed(2) + '%';
        const fmtNum = (val) => val.toFixed(2);

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <!-- Risk Metrics -->
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <div class="px-4 py-3 border-b border-gray-200">
                        <h3 class="text-lg font-medium text-gray-900">Risk Metrics</h3>
                    </div>
                    <div class="p-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <span class="text-sm text-gray-500 block">Annual Volatility</span>
                                <span class="text-lg font-semibold text-gray-900">${fmtPct(riskMetrics.annual_volatility || 0)}</span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500 block">Beta</span>
                                <span class="text-lg font-semibold text-gray-900">${fmtNum(riskMetrics.beta || 0)}</span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500 block">Sharpe Ratio</span>
                                <span class="text-lg font-semibold text-gray-900">${fmtNum(riskMetrics.sharpe_ratio || 0)}</span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500 block">Sortino Ratio</span>
                                <span class="text-lg font-semibold text-gray-900">${fmtNum(riskMetrics.sortino_ratio || 0)}</span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500 block">Max Drawdown</span>
                                <span class="text-lg font-semibold text-red-600">${fmtPct(riskMetrics.max_drawdown || 0)}</span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500 block">Value at Risk (95%)</span>
                                <span class="text-lg font-semibold text-red-600">${fmtPct(riskMetrics.value_at_risk || 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Performance Metrics -->
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <div class="px-4 py-3 border-b border-gray-200">
                        <h3 class="text-lg font-medium text-gray-900">Performance Metrics</h3>
                    </div>
                    <div class="p-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <span class="text-sm text-gray-500 block">Total Return</span>
                                <span class="text-lg font-semibold ${performanceMetrics.total_return >= 0 ? 'text-green-600' : 'text-red-600'}">${fmtPct(performanceMetrics.total_return || 0)}</span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500 block">Annual Return</span>
                                <span class="text-lg font-semibold ${performanceMetrics.annual_return >= 0 ? 'text-green-600' : 'text-red-600'}">${fmtPct(performanceMetrics.annual_return || 0)}</span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500 block">Alpha</span>
                                <span class="text-lg font-semibold ${performanceMetrics.alpha >= 0 ? 'text-green-600' : 'text-red-600'}">${fmtPct(performanceMetrics.alpha || 0)}</span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500 block">Information Ratio</span>
                                <span class="text-lg font-semibold text-gray-900">${fmtNum(performanceMetrics.information_ratio || 0)}</span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500 block">Win Rate</span>
                                <span class="text-lg font-semibold text-gray-900">${fmtPct(performanceMetrics.win_rate || 0)}</span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500 block">Profit Factor</span>
                                <span class="text-lg font-semibold text-gray-900">${fmtNum(performanceMetrics.profit_factor || 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Correlation Matrix -->
            <div class="bg-white rounded-lg shadow overflow-hidden mb-6">
                <div class="px-4 py-3 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Correlation Matrix</h3>
                </div>
                <div class="p-4 overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                                ${Object.keys(correlationAnalysis).map(s => `<th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">${s}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${Object.entries(correlationAnalysis).map(([rowSymbol, correlations]) => `
                                <tr>
                                    <td class="px-3 py-2 text-sm font-medium text-gray-900">${rowSymbol}</td>
                                    ${Object.entries(correlations).map(([colSymbol, val]) => {
            const bgClass = val === 1 ? 'bg-gray-100' :
                val > 0.7 ? 'bg-red-100 text-red-800' :
                    val > 0.3 ? 'bg-yellow-100 text-yellow-800' :
                        val < -0.3 ? 'bg-green-100 text-green-800' : 'text-gray-500';
            return `<td class="px-3 py-2 text-sm text-center ${bgClass}">${val.toFixed(2)}</td>`;
        }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    displayTechnicalIndicators(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const analysis = result.technical_analysis || {};
        const individualAnalysis = analysis.individual_analysis || {};

        // Helper for signal color
        const getSignalClass = (signal) => {
            if (!signal) return 'bg-gray-100 text-gray-800';
            const s = signal.toLowerCase();
            if (s.includes('buy')) return 'bg-green-100 text-green-800';
            if (s.includes('sell')) return 'bg-red-100 text-red-800';
            return 'bg-yellow-100 text-yellow-800';
        };

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Technical Signals</h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Signal</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RSI</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MACD</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bollinger</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SMA Trend</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${Object.entries(individualAnalysis).map(([symbol, data]) => `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${symbol}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSignalClass(data.summary?.signal)}">
                                            ${data.summary?.signal || 'Neutral'}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ${data.indicators?.rsi?.value?.toFixed(2) || 'N/A'}
                                        <span class="text-xs ml-1 ${getSignalClass(data.indicators?.rsi?.signal)}">${data.indicators?.rsi?.signal || ''}</span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ${data.indicators?.macd?.histogram?.toFixed(2) || 'N/A'}
                                        <span class="text-xs ml-1 ${getSignalClass(data.indicators?.macd?.signal)}">${data.indicators?.macd?.signal || ''}</span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span class="text-xs ${getSignalClass(data.indicators?.bollinger?.signal)}">${data.indicators?.bollinger?.signal || 'Neutral'}</span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span class="text-xs ${getSignalClass(data.indicators?.sma?.signal)}">${data.indicators?.sma?.signal || 'Neutral'}</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    displayTradePerformance(result, options) {
        console.log('Trade Performance result:', result);

        // Use the dedicated display function directly
        if (window.displayTradePerformanceResults && result.trade_performance) {
            window.displayTradePerformanceResults(result.trade_performance, options);
            return;
        }

        // Simple fallback display
        const container = document.getElementById('analysisContent');
        if (container) {
            container.innerHTML = `< div class="text-center py-4" > Trade performance data received but display function not available</div > `;
        }
    }

    displayCostAnalysis(result, options) {
        console.log('Cost Analysis result:', result);
    }

    displayTurnoverAnalysis(result, options) {
        console.log('Turnover Analysis result:', result);

        // Use the dedicated turnover analysis module if available
        if (window.loadTurnoverAnalysis) {
            // Get current transactions from the analytics core
            const transactions = this.transactionData || window.currentTransactions || [];
            console.log('Calling loadTurnoverAnalysis with transactions:', transactions?.length || 0);
            window.loadTurnoverAnalysis(transactions);
            return;
        }

        // Fallback: show basic message in the correct container
        const container = document.getElementById('turnoverAnalysis') || document.getElementById('analysisContent');
        if (container) {
            container.innerHTML = `
            <div class="p-4 bg-gray-50 rounded-lg">
                <p class="text-gray-600">Turnover Analysis results display is currently being updated.</p>
            </div>
        `;
        }
    }

    displayTaxAnalysis(result, options) {
        console.log('Tax Analysis result:', result);
    }



    displayFifoLifoAccounting(result, options) {
        console.log('FIFO/LIFO Accounting result:', result);
    }

    displayTradeTiming(result, options) {
        console.log('Trade Timing result:', result);
    }

    // Display market news
    displayMarketNews(result) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const articles = result.articles || [];

        container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Market News</h3>
            <button onclick="loadMarketNews(this)" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                Refresh News
            </button>
        </div>
        <div class="space-y-4">
            ${articles.map(article => `
                <div class="border-b border-gray-200 pb-4 last:border-0">
                    <h4 class="text-md font-medium text-gray-900 mb-1">${article.title}</h4>
                    <p class="text-sm text-gray-600 mb-2">${article.summary || ''}</p>
                    <div class="flex justify-between items-center text-xs text-gray-500">
                        <span>${article.source || 'Unknown Source'}</span>
                        <span>${article.published_at ? new Date(article.published_at).toLocaleDateString() : ''}</span>
                    </div>
                    ${article.url && article.url !== '#' ? `
                        <a href="${article.url}" target="_blank" class="text-indigo-600 hover:text-indigo-800 text-sm mt-2 inline-block">Read More</a>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        ${articles.length === 0 ? `
            <p class="text-gray-500 text-center py-4">No news articles available</p>
        ` : ''}
    `;
    }

    displayPnLAttribution(result, options) {
        console.log('PnL Attribution result:', result);
        if (window.loadPnlAttribution) {
            const transactions = this.transactionData || window.currentTransactions || [];
            window.loadPnlAttribution(transactions);
        }
    }

    displayAccountingAnalysis(result, options) {
        console.log('Accounting Analysis result:', result);
        if (window.loadAccountingAnalysis) {
            const transactions = this.transactionData || window.currentTransactions || [];
            window.loadAccountingAnalysis(transactions);
        }
    }

    displayDrawdownAnalysis(result, options) {
        console.log('[DEBUG] Analytics Manager displayDrawdownAnalysis called with:', result);
        console.log('[DEBUG] Options:', options);

        // The API response structure is: { success: true, drawdown_analysis: {...} }
        // But the display function expects just the drawdown_analysis part
        const drawdownData = result.drawdown_analysis || result;
        console.log('[DEBUG] Extracted drawdown data:', drawdownData);
        console.log('[DEBUG] Calling window.displayDrawdownResults...');
        window.displayDrawdownResults(drawdownData, options);
    }

    displayReturnAttribution(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        // Debug logging
        console.log('[RETURN ATTRIBUTION] Raw result:', result);
        console.log('[RETURN ATTRIBUTION] Options:', options);

        // Extract attribution data from result
        const attribution = result.return_attribution || result.attribution || result;
        const effects = attribution.attribution_effects || attribution.effects || attribution;

        console.log('[RETURN ATTRIBUTION] Extracted attribution:', attribution);
        console.log('[RETURN ATTRIBUTION] Extracted effects:', effects);

        const getValueClass = (value) => {
            if (value === null || value === undefined || isNaN(value)) return 'neutral';
            return value > 0 ? 'positive' : 'negative';
        };

        const formatValue = (value) => {
            if (value === null || value === undefined || isNaN(value)) return 'N/A';
            return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
        };

        const storedSettings = window.analyticsCore?.returnAttributionSettings || {};
        const currentPeriod = storedSettings.period || options?.period || '1Y';
        const currentModel = storedSettings.attribution_model || options?.attribution_model || 'brinson';
        const currentBenchmark = storedSettings.benchmark || options?.benchmark || 'SPY';
        const currentCurrency = storedSettings.currency || options?.currency || 'USD';
        const currentFrequency = storedSettings.frequency || options?.frequency || 'daily';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Return Attribution</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleReturnAttributionSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="updateReturnAttribution()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>
            
            <div id="returnAttributionSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                        <select id="returnPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateReturnAttribution()">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="YTD" ${currentPeriod === 'YTD' ? 'selected' : ''}>Year to Date</option>
                            <option value="ITD" ${currentPeriod === 'ITD' ? 'selected' : ''}>Inception to Date</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Attribution Model</label>
                        <select id="returnModel" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateReturnAttribution()">
                            <option value="brinson" ${currentModel === 'brinson' ? 'selected' : ''}>Brinson</option>
                            <option value="factor" ${currentModel === 'factor' ? 'selected' : ''}>Factor-based</option>
                            <option value="holdings" ${currentModel === 'holdings' ? 'selected' : ''}>Holdings-based</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                        <select id="returnBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateReturnAttribution()">
                            <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>NASDAQ (QQQ)</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                            <option value="VTI" ${currentBenchmark === 'VTI' ? 'selected' : ''}>Total Stock Market (VTI)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                        <select id="returnCurrency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateReturnAttribution()">
                            <option value="USD" ${currentCurrency === 'USD' ? 'selected' : ''}>USD</option>
                            <option value="EUR" ${currentCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                            <option value="GBP" ${currentCurrency === 'GBP' ? 'selected' : ''}>GBP</option>
                            <option value="MULTI" ${currentCurrency === 'MULTI' ? 'selected' : ''}>Multi-currency</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                        <select id="returnFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateReturnAttribution()">
                            <option value="daily" ${currentFrequency === 'daily' ? 'selected' : ''}>Daily</option>
                            <option value="weekly" ${currentFrequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="monthly" ${currentFrequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <h4 class="section-header">Attribution Effects</h4>
                    <div class="metric-row">
                        <span class="metric-label">Asset Allocation</span>
                        <span class="metric-value ${getValueClass(effects.asset_allocation)}">${formatValue(effects.asset_allocation)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Security Selection</span>
                        <span class="metric-value ${getValueClass(effects.security_selection)}">${formatValue(effects.security_selection)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Interaction Effect</span>
                        <span class="metric-value ${getValueClass(effects.interaction_effect)}">${formatValue(effects.interaction_effect)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Currency Effect</span>
                        <span class="metric-value ${getValueClass(effects.currency_effect)}">${formatValue(effects.currency_effect)}</span>
                    </div>
                </div>
                <div class="space-y-3">
                    <h4 class="section-header">Performance Summary</h4>
                    <div class="metric-row">
                        <span class="metric-label">Portfolio Return</span>
                        <span class="metric-value ${getValueClass(attribution.portfolio_return)}">${formatValue(attribution.portfolio_return)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Benchmark Return</span>
                        <span class="metric-value ${getValueClass(attribution.benchmark_return)}">${formatValue(attribution.benchmark_return)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Active Return</span>
                        <span class="metric-value ${getValueClass(attribution.active_return)}">${formatValue(attribution.active_return)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Market Timing</span>
                        <span class="metric-value ${getValueClass(attribution.market_timing)}">${formatValue(attribution.market_timing)}</span>
                    </div>
                </div>
            </div>
            
            <div class="details-box mt-6">
                <h4 class="section-header">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="detail-label">Period:</span> <span class="detail-value">${currentPeriod === '1Y' ? '1 Year' : currentPeriod}</span></div>
                    <div><span class="detail-label">Model:</span> <span class="detail-value">${currentModel === 'brinson' ? 'Brinson' : currentModel === 'factor' ? 'Factor-based' : currentModel === 'holdings' ? 'Holdings-based' : currentModel}</span></div>
                    <div><span class="detail-label">Benchmark:</span> <span class="detail-value">${currentBenchmark === 'SPY' ? 'S&P 500 (SPY)' : currentBenchmark === 'QQQ' ? 'NASDAQ (QQQ)' : currentBenchmark === 'IWM' ? 'Russell 2000 (IWM)' : currentBenchmark === 'VTI' ? 'Total Stock Market (VTI)' : currentBenchmark}</span></div>
                    <div><span class="detail-label">Currency:</span> <span class="detail-value">${currentCurrency === 'USD' ? 'USD' : currentCurrency === 'EUR' ? 'EUR' : currentCurrency === 'GBP' ? 'GBP' : currentCurrency === 'MULTI' ? 'Multi-currency' : currentCurrency}</span></div>
                    <div><span class="detail-label">Frequency:</span> <span class="detail-value">${currentFrequency === 'daily' ? 'Daily' : currentFrequency === 'weekly' ? 'Weekly' : currentFrequency === 'monthly' ? 'Monthly' : currentFrequency}</span></div>
                </div>
            </div>
        `;
    }

    displayPerformanceAttribution(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        // Handle both performance-attribution and return-attribution API responses
        const attribution = result.performance_attribution || result.return_attribution || result.attribution || result;

        // Extract attribution effects - the data is directly in the attribution object
        const effects = attribution.attribution_effects || attribution.effects || attribution;

        // Get current settings
        const currentPeriod = options?.period || attribution.settings?.period || '1Y';
        const currentModel = options?.attribution_model || attribution.settings?.attribution_model || 'brinson';
        const currentBenchmark = options?.benchmark || attribution.settings?.benchmark || 'SPY';
        const currentCurrency = options?.currency || attribution.settings?.currency || 'USD';
        const currentFrequency = options?.frequency || attribution.settings?.frequency || 'daily';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Performance Attribution</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="togglePerformanceSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="updatePerformanceAttribution()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>
            
            <!-- Performance Attribution Settings Panel -->
            <div id="performanceSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                        <select id="performancePeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePerformanceAttribution()">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="YTD" ${currentPeriod === 'YTD' ? 'selected' : ''}>Year to Date</option>
                            <option value="ITD" ${currentPeriod === 'ITD' ? 'selected' : ''}>Inception to Date</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Attribution Model</label>
                        <select id="performanceModel" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePerformanceAttribution()">
                            <option value="brinson" ${currentModel === 'brinson' ? 'selected' : ''}>Brinson</option>
                            <option value="factor" ${currentModel === 'factor' ? 'selected' : ''}>Factor-based</option>
                            <option value="holdings" ${currentModel === 'holdings' ? 'selected' : ''}>Holdings-based</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                        <select id="performanceBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePerformanceAttribution()">
                            <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>NASDAQ (QQQ)</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                            <option value="VTI" ${currentBenchmark === 'VTI' ? 'selected' : ''}>Total Stock Market (VTI)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                        <select id="performanceCurrency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePerformanceAttribution()">
                            <option value="USD" ${currentCurrency === 'USD' ? 'selected' : ''}>USD</option>
                            <option value="EUR" ${currentCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                            <option value="GBP" ${currentCurrency === 'GBP' ? 'selected' : ''}>GBP</option>
                            <option value="MULTI" ${currentCurrency === 'MULTI' ? 'selected' : ''}>Multi-currency</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                        <select id="performanceFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePerformanceAttribution()">
                            <option value="daily" ${currentFrequency === 'daily' ? 'selected' : ''}>Daily</option>
                            <option value="weekly" ${currentFrequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="monthly" ${currentFrequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-3">
                    <h4 class="section-header">Attribution Effects</h4>
                    <div class="metric-row">
                        <span class="metric-label">Asset Allocation</span>
                        <span class="metric-value ${effects.asset_allocation === null || effects.asset_allocation === undefined ? 'neutral' : (effects.asset_allocation > 0 ? 'positive' : 'negative')}">${effects.asset_allocation === null || effects.asset_allocation === undefined ? 'N/A' : (effects.asset_allocation >= 0 ? '+' : '') + effects.asset_allocation.toFixed(2) + '%'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Security Selection</span>
                        <span class="metric-value ${effects.security_selection === null || effects.security_selection === undefined ? 'neutral' : (effects.security_selection > 0 ? 'positive' : 'negative')}">${effects.security_selection === null || effects.security_selection === undefined ? 'N/A' : (effects.security_selection >= 0 ? '+' : '') + effects.security_selection.toFixed(2) + '%'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Interaction Effect</span>
                        <span class="metric-value ${effects.interaction_effect === null || effects.interaction_effect === undefined ? 'neutral' : (effects.interaction_effect > 0 ? 'positive' : 'negative')}">${effects.interaction_effect === null || effects.interaction_effect === undefined ? 'N/A' : (effects.interaction_effect >= 0 ? '+' : '') + effects.interaction_effect.toFixed(2) + '%'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Currency Effect</span>
                        <span class="metric-value ${effects.currency_effect === null || effects.currency_effect === undefined ? 'neutral' : (effects.currency_effect > 0 ? 'positive' : 'negative')}">${effects.currency_effect === null || effects.currency_effect === undefined ? 'N/A' : (effects.currency_effect >= 0 ? '+' : '') + effects.currency_effect.toFixed(2) + '%'}</span>
                    </div>
                </div>
                <div class="space-y-3">
                    <h4 class="section-header">Performance Summary</h4>
                    <div class="metric-row">
                        <span class="metric-label">Portfolio Return</span>
                        <span class="metric-value ${(attribution.portfolio_return || 0) > 0 ? 'positive' : 'negative'}">${attribution.portfolio_return === null || attribution.portfolio_return === undefined ? 'N/A' : (attribution.portfolio_return >= 0 ? '+' : '') + attribution.portfolio_return.toFixed(2) + '%'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Benchmark Return</span>
                        <span class="metric-value neutral">${attribution.benchmark_return === null || attribution.benchmark_return === undefined ? 'N/A' : (attribution.benchmark_return >= 0 ? '+' : '') + attribution.benchmark_return.toFixed(2) + '%'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Active Return</span>
                        <span class="metric-value ${(attribution.active_return || 0) > 0 ? 'positive' : 'negative'}">${attribution.active_return === null || attribution.active_return === undefined ? 'N/A' : (attribution.active_return >= 0 ? '+' : '') + attribution.active_return.toFixed(2) + '%'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Market Timing</span>
                        <span class="metric-value ${(attribution.market_timing || 0) > 0 ? 'positive' : 'negative'}">${attribution.market_timing === null || attribution.market_timing === undefined ? 'N/A' : (attribution.market_timing >= 0 ? '+' : '') + attribution.market_timing.toFixed(2) + '%'}</span>
                    </div>
                </div>
            </div>
            
            <!-- Analysis Parameters -->
            <div class="details-box mt-6">
                <h4 class="section-header">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="detail-label">Period:</span> <span class="detail-value">${currentPeriod}</span></div>
                    <div><span class="detail-label">Model:</span> <span class="detail-value">${currentModel}</span></div>
                    <div><span class="detail-label">Benchmark:</span> <span class="detail-value">${currentBenchmark}</span></div>
                    <div><span class="detail-label">Currency:</span> <span class="detail-value">${currentCurrency}</span></div>
                    <div><span class="detail-label">Frequency:</span> <span class="detail-value">${currentFrequency}</span></div>
                </div>
            </div>
        `;
    }




    displayStrategyBacktesting(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');

        // Handle both direct results and nested results
        const backtest = result.backtesting_results || result.backtest || result;
        const performance = backtest.performance_metrics || {};
        const risk = backtest.risk_metrics || {};
        const summary = backtest.summary || {};
        const parameters = backtest.parameters || summary || {};

        // Get current settings
        const currentPeriod = options?.backtest_period || parameters.backtest_period || '1Y';
        const currentRebalancing = options?.rebalancing || parameters.rebalancing_frequency || 'Quarterly';
        const currentTransactionCosts = options?.transaction_costs || parameters.transaction_cost_rate || '0.1%';
        const currentBenchmark = options?.benchmark || parameters.benchmark_used || 'SPY';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Strategy Backtesting</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleBacktestSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="runStrategyBacktest()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
                        </svg>
                        Run Backtest
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
                <p class="text-gray-600">Backtesting results display is currently being updated.</p>
            </div>
        `;
    }

    calculateWinRate(results) {
        if (!results.portfolio_returns || results.portfolio_returns.length === 0) {
            return '0.00';
        }

        const positiveReturns = results.portfolio_returns.filter(r => r > 0).length;
        const totalReturns = results.portfolio_returns.length;
        return ((positiveReturns / totalReturns) * 100).toFixed(2);
    }

    displayCorrelationAnalysis(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;
        
        const correlationData = result.correlation_analysis || result;
        const correlation = correlationData.correlation_matrix || {};
        const summary = correlationData.summary || {};
        const symbols = Object.keys(correlation);
        
        const currentPeriod = options?.period || summary.period || '1Y';
        const currentFrequency = options?.frequency || summary.frequency || 'Daily';
        const currentMethod = options?.method || summary.method || 'pearson';
        const currentRollingWindow = options?.rolling_window || '30d';
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Correlation Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleCorrelationSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="updateCorrelationAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>
            
            <div id="correlationSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                        <select id="correlationPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentPeriod === '2Y' ? 'selected' : ''}>2 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                        <select id="correlationFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                            <option value="Daily" ${currentFrequency === 'Daily' ? 'selected' : ''}>Daily</option>
                            <option value="Weekly" ${currentFrequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="Monthly" ${currentFrequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Method</label>
                        <select id="correlationMethod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                            <option value="pearson" ${currentMethod === 'pearson' ? 'selected' : ''}>Pearson</option>
                            <option value="spearman" ${currentMethod === 'spearman' ? 'selected' : ''}>Spearman</option>
                            <option value="kendall" ${currentMethod === 'kendall' ? 'selected' : ''}>Kendall</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Rolling Window</label>
                        <select id="correlationRollingWindow" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                            <option value="30d" ${currentRollingWindow === '30d' ? 'selected' : ''}>30 days</option>
                            <option value="60d" ${currentRollingWindow === '60d' ? 'selected' : ''}>60 days</option>
                            <option value="90d" ${currentRollingWindow === '90d' ? 'selected' : ''}>90 days</option>
                            <option value="252d" ${currentRollingWindow === '252d' ? 'selected' : ''}>252 days</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Average Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.average_correlation || 0) > 0.7 ? 'text-red-600' : (summary.average_correlation || 0) > 0.3 ? 'text-yellow-600' : 'text-green-600'}">
                        ${(summary.average_correlation || 0).toFixed(3)}
                    </p>
                    <p class="text-sm text-gray-600 mt-1">${(summary.average_correlation || 0) > 0.7 ? 'High correlation' : (summary.average_correlation || 0) > 0.3 ? 'Moderate correlation' : 'Low correlation'}</p>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Max Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.max_correlation || 0) > 0.8 ? 'text-red-600' : 'text-blue-600'}">
                        ${(summary.max_correlation || 0).toFixed(3)}
                    </p>
                    <p class="text-sm text-gray-600 mt-1">Highest pair correlation</p>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Min Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.min_correlation || 0) < -0.3 ? 'text-green-600' : 'text-blue-600'}">
                        ${(summary.min_correlation || 0).toFixed(3)}
                    </p>
                    <p class="text-sm text-gray-600 mt-1">Lowest pair correlation</p>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Data Points</h3>
                    <p class="text-3xl font-bold text-blue-600">
                        ${summary.data_points || 'N/A'}
                    </p>
                    <p class="text-sm text-gray-600 mt-1">${symbols.length} symbols analyzed</p>
                </div>
            </div>
            
            ${symbols.length > 0 ? `
                <div class="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Correlation Matrix</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                                    ${symbols.map(symbol => `<th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">${symbol}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${symbols.map(symbol1 => `
                                    <tr>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${symbol1}</td>
                                        ${symbols.map(symbol2 => {
                                            const corrValue = correlation[symbol1]?.[symbol2] || 0;
                                            const colorClass = symbol1 === symbol2 ? 'bg-gray-100' : 
                                                             corrValue > 0.7 ? 'bg-red-100 text-red-800' :
                                                             corrValue > 0.3 ? 'bg-yellow-100 text-yellow-800' :
                                                             corrValue < -0.3 ? 'bg-green-100 text-green-800' :
                                                             'bg-blue-100 text-blue-800';
                                            return `<td class="px-4 py-2 whitespace-nowrap text-sm text-center ${colorClass}">${corrValue.toFixed(3)}</td>`;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-4 text-sm text-gray-600">
                        <div class="flex flex-wrap gap-4">
                            <div class="flex items-center"><div class="w-4 h-4 bg-red-100 border mr-2"></div>Strong Positive (>0.7)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-yellow-100 border mr-2"></div>Moderate Positive (0.3-0.7)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-blue-100 border mr-2"></div>Weak (-0.3-0.3)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-green-100 border mr-2"></div>Negative (<-0.3)</div>
                        </div>
                    </div>
                </div>
            ` : '<div class="bg-white rounded-lg shadow p-6 mb-6"><p class="text-gray-500 text-center">No correlation data available</p></div>'}
            
            <div class="bg-gray-50 rounded-lg p-6">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span class="text-gray-600">Period:</span> <span class="font-medium text-gray-900">${currentPeriod}</span></div>
                    <div><span class="text-gray-600">Frequency:</span> <span class="font-medium text-gray-900">${currentFrequency}</span></div>
                    <div><span class="text-gray-600">Method:</span> <span class="font-medium text-gray-900">${currentMethod}</span></div>
                    <div><span class="text-gray-600">Rolling Window:</span> <span class="font-medium text-gray-900">${currentRollingWindow}</span></div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                    <div><span class="text-gray-600">Data Points:</span> <span class="font-medium text-gray-900">${summary.data_points || 'N/A'}</span></div>
                    <div><span class="text-gray-600">Symbols:</span> <span class="font-medium text-gray-900">${symbols.length}</span></div>
                    <div><span class="text-gray-600">Data Source:</span> <span class="font-medium text-gray-900">${correlationData.data_source || 'Market Data'}</span></div>
                    <div><span class="text-gray-600">High Pairs:</span> <span class="font-medium text-gray-900">${correlationData.high_correlation_pairs?.length || 0}</span></div>
                </div>
            </div>
        `;
    }

    // Load market news
    async loadMarketNews(module) {
        const container = document.getElementById(module.containerId);
        if (!container) return;

        container.classList.remove('hidden');
        container.innerHTML = `
                        Refresh News
                    `;

        try {
            const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/news`);
            const data = await response.json();

            if (data.success && data.articles) {
                module.displayFunction.call(this, { articles: data.articles });
            } else {
                throw new Error('Failed to load news');
            }
        } catch (error) {
            console.error('News loading failed:', error);
            container.innerHTML = `
                    `;
        }
    }

    // Scan options method for compatibility with refactored app
    async scanOptions(symbols) {
        try {
            console.log(`[ANALYTICS MANAGER] scanOptions called with ${symbols.length} symbols: `, symbols);

            const API_BASE = window.API_BASE || 'http://127.0.0.1:8080';
            const response = await fetch(`${API_BASE}/api/scan-options`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbols: symbols,
                    options: {
                        expiration: '3M',
                        moneyness: 'All',
                        strategy: 'All',
                        min_premium: 0.50,
                        delta_range: 'All'
                    }
                })
            });

            const data = await response.json();
            console.log(`[ANALYTICS MANAGER] scanOptions response: `, data);

            return data;
        } catch (error) {
            console.error('[ANALYTICS MANAGER] scanOptions error:', error);
            return { success: false, error: error.message };
        }
    }

    // Risk analysis method for compatibility
    async analyzeRisk(portfolioData, role = 'user') {
        try {
            const API_BASE = window.API_BASE || 'http://127.0.0.1:8080';
            const response = await fetch(`${API_BASE}/api/analyze-risk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portfolio: portfolioData })
            });

            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Monte Carlo method for compatibility
    async runMonteCarlo(portfolioData, role = 'user') {
        try {
            const symbols = portfolioData.map(p => p.symbol);
            const API_BASE = window.API_BASE || 'http://127.0.0.1:8080';
            const response = await fetch(`${API_BASE}/api/monte-carlo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: symbols })
            });

            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Backtest method for compatibility
    async runBacktest(strategy, symbols, startDate, endDate) {
        try {
            const API_BASE = window.API_BASE || 'http://127.0.0.1:8080';
            const response = await fetch(`${API_BASE}/api/strategy-backtesting`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy,
                    symbols,
                    start_date: startDate,
                    end_date: endDate
                })
            });

            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Stock screening method for compatibility
    async screenStocks(criteria, universe) {
        try {
            const API_BASE = window.API_BASE || 'http://127.0.0.1:8080';
            const response = await fetch(`${API_BASE}/api/screen-stocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ criteria, universe })
            });

            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }


}

// Create global instance
window.analyticsManager = new AnalyticsManager();

// Export the class for external use
window.AnalyticsManager = AnalyticsManager;

// Options pagination functions
window.changeOptionsPage = (newPage) => {
    if (!window.optionsOpportunities) return;

    const itemsPerPage = 10;
    const totalPages = Math.ceil(window.optionsOpportunities.length / itemsPerPage);

    if (newPage < 1 || newPage > totalPages) return;

    window.optionsCurrentPage = newPage;

    // Re-display with new page
    const result = {
        opportunities: window.optionsOpportunities,
        summary: window.optionsSummary
    };

    window.analyticsManager.displayOptionsStrategies(result, {});
};

window.filterOptionsStrategies = () => {
    if (!window.optionsOpportunities) return;

    window.optionsCurrentPage = 1; // Reset to first page

    const result = {
        opportunities: window.optionsOpportunities,
        summary: window.optionsSummary
    };

    window.analyticsManager.displayOptionsStrategies(result, {});
};

window.getFilteredOpportunities = (opportunities) => {
    if (!opportunities) return [];

    const symbolFilter = document.getElementById('symbolFilter')?.value || 'all';

    console.log(`[OPTIONS FILTER] Symbol filter: ${symbolFilter}, Total opportunities: ${opportunities.length} `);

    let filtered = opportunities;

    if (symbolFilter && symbolFilter !== 'all') {
        filtered = filtered.filter(opp => opp.symbol === symbolFilter);
        console.log(`[OPTIONS FILTER] After symbol filter: ${filtered.length} opportunities`);
    }

    return filtered;
};

// Hide analysis content function
window.hideAnalysisContent = () => {
    const container = document.getElementById('analysisContent');
    if (container) {
        container.classList.add('hidden');
    }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsManager.initialize();
});

// Correlation Analysis Functions
window.toggleCorrelationSettings = () => {
    const settings = document.getElementById('correlationSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateCorrelationAnalysis = () => {
    // Get settings values from form - no fallbacks
    const period = document.getElementById('correlationPeriod')?.value;
    const frequency = document.getElementById('correlationFrequency')?.value;
    const method = document.getElementById('correlationMethod')?.value;
    const rollingWindow = document.getElementById('correlationRollingWindow')?.value;

    // Validate required settings
    if (!period || !frequency || !method || !rollingWindow) {
        console.error('Missing required correlation analysis settings');
        return;
    }

    console.log('[CORRELATION] Updating with NEW settings:', { period, frequency, method, rolling_window: rollingWindow });

    // Clear any existing cached settings
    delete window.analyticsCore.correlationSettings;
    delete window.analyticsCore.correlationOptions;

    // Store fresh settings for API call
    window.analyticsCore.correlationSettings = {
        period,
        frequency,
        method,
        rolling_window: rollingWindow
    };

    // Show immediate feedback that settings are being applied
    const container = document.getElementById('analysisContent');
    if (container) {
        const summaryBoxes = container.querySelectorAll('.details-box .metric-value');
        summaryBoxes.forEach(box => {
            box.style.opacity = '0.5';
            box.textContent = 'Updating...';
        });
    }

    // Force reload with new settings
    window.analyticsManager.loadModule('correlation-analysis');
};

// Return Attribution Settings
window.toggleReturnAttributionSettings = () => {
    const settings = document.getElementById('returnAttributionSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};



// Performance Attribution Settings
window.togglePerformanceSettings = () => {
    const settings = document.getElementById('performanceSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updatePerformanceAttribution = () => {
    const period = document.getElementById('performancePeriod')?.value;
    const model = document.getElementById('performanceModel')?.value;
    const benchmark = document.getElementById('performanceBenchmark')?.value;
    const currency = document.getElementById('performanceCurrency')?.value;
    const frequency = document.getElementById('performanceFrequency')?.value;

    if (!period || !model || !benchmark || !currency || !frequency) {
        console.error('Missing required performance attribution settings');
        return;
    }

    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.performanceAttributionSettings = {
        period,
        attribution_model: model,
        benchmark,
        currency,
        frequency
    };

    window.analyticsManager.loadModule('performance-attribution');
};

// Settings toggles - Risk Analysis
window.toggleRiskSettings = () => {
    const settings = document.getElementById('riskSettings');
    if (settings) {
        settings.classList.toggle('hidden');

        // Set default values if not already set
        if (!document.getElementById('riskPeriod').value) {
            document.getElementById('riskPeriod').value = '1Y';
        }
        if (!document.getElementById('riskVarConfidence').value) {
            document.getElementById('riskVarConfidence').value = '0.95';
        }
        if (!document.getElementById('riskModel').value) {
            document.getElementById('riskModel').value = 'historical';
        }
        if (!document.getElementById('riskBenchmark').value) {
            document.getElementById('riskBenchmark').value = 'SPY';
        }
        if (!document.getElementById('riskRollingWindow').value) {
            document.getElementById('riskRollingWindow').value = '252';
        }
    }
};

// Return Attribution Settings
window.toggleReturnAttributionSettings = () => {
    const settings = document.getElementById('returnAttributionSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateReturnAttribution = () => {
    const period = document.getElementById('returnPeriod')?.value;
    const model = document.getElementById('returnModel')?.value;
    const benchmark = document.getElementById('returnBenchmark')?.value;
    const currency = document.getElementById('returnCurrency')?.value;
    const frequency = document.getElementById('returnFrequency')?.value;

    if (!period || !model || !benchmark || !currency || !frequency) {
        console.error('Missing required return attribution settings');
        return;
    }

    // Store settings in analyticsCore
    if (window.analyticsCore) {
        window.analyticsCore.returnAttributionSettings = {
            period,
            attribution_model: model,
            benchmark,
            currency,
            frequency
        };
    }

    window.analyticsManager.loadModule('return-attribution');
};

window.updateRiskAnalysis = () => {
    // Get settings values from form - no fallbacks
    const period = document.getElementById('riskPeriod')?.value;
    const varConfidence = parseFloat(document.getElementById('riskConfidence')?.value);
    const riskModel = document.getElementById('riskModel')?.value;
    const benchmark = document.getElementById('riskBenchmark')?.value;
    const rollingWindow = parseInt(document.getElementById('riskWindow')?.value);

    // Validate required settings
    if (!period || !varConfidence || !riskModel || !benchmark || !rollingWindow) {
        console.error('Missing required risk analysis settings');
        return;
    }

    // Store settings for API call
    window.analyticsCore.riskSettings = {
        period,
        var_confidence: varConfidence,
        risk_model: riskModel,
        benchmark,
        rolling_window: rollingWindow
    };

    // Force reload of risk metrics with new settings
    window.analyticsManager.loadModule('risk-metrics');
};

// Options Settings
window.toggleOptionsSettings = () => {
    const settings = document.getElementById('optionsSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateOptionsAnalysis = () => {
    const expiration = document.getElementById('optionsExpiration')?.value;
    const moneyness = document.getElementById('optionsMoneyness')?.value;
    const minPremium = document.getElementById('optionsMinPremium')?.value;
    const deltaRange = document.getElementById('optionsDeltaRange')?.value;

    if (!expiration || !moneyness || !minPremium || !deltaRange) {
        console.error('Missing required options settings');
        return;
    }

    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.optionsSettings = {
        expiration,
        moneyness,
        min_premium: parseFloat(minPremium),
        delta_range: deltaRange
    };

    console.log('[OPTIONS] Updating with settings:', window.analyticsCore.optionsSettings);
    window.analyticsManager.loadModule('options-strategies');
};

// Monte Carlo Settings
window.toggleMonteCarloSettings = () => {
    const settings = document.getElementById('monteCarloSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateMonteCarloAnalysis = () => {
    const period = document.getElementById('mcForecastPeriod')?.value;
    const simulations = parseInt(document.getElementById('mcSimulations')?.value);
    const confidence = parseFloat(document.getElementById('mcConfidenceIntervals')?.value);
    const regime = document.getElementById('mcMarketRegime')?.value;
    const volatility = parseFloat(document.getElementById('mcVolatilityAdjustment')?.value);

    if (!period || !simulations || !confidence || !regime || volatility === undefined) {
        console.error('Missing required Monte Carlo settings');
        return;
    }

    window.analyticsCore.monteCarloSettings = {
        forecast_period: period,
        simulations,
        confidence_intervals: confidence,
        market_regime: regime,
        volatility_adjustment: volatility
    };

    window.analyticsManager.loadModule('monte-carlo');
};

// Portfolio Optimization Settings
window.toggleOptimizationSettings = () => {
    const settings = document.getElementById('optimizationSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updatePortfolioOptimization = () => {
    const objective = document.getElementById('optimizationObjective')?.value || 'max_sharpe';
    const constraint = document.getElementById('optimizationConstraint')?.value || 'long_only';
    const rebalancing = document.getElementById('optimizationRebalancing')?.value || 'quarterly';
    const riskBudget = document.getElementById('optimizationRiskBudget')?.value || 'equal';
    const lookback = document.getElementById('optimizationLookback')?.value || '1Y';

    console.log('[OPTIMIZATION UPDATE] Settings:', { objective, constraint, rebalancing, riskBudget, lookback });

    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.optimizationSettings = {
        objective,
        constraint,
        rebalancing,
        risk_budget: riskBudget,
        lookback_period: lookback
    };

    console.log('[OPTIMIZATION UPDATE] Stored settings:', window.analyticsCore.optimizationSettings);
    window.analyticsManager.loadModule('portfolio-optimization');
};

// Sector Allocation Settings
window.toggleSectorSettings = () => {
    const settings = document.getElementById('sectorSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateSectorAllocation = () => {
    const classification = document.getElementById('sectorClassification')?.value || 'GICS';
    const view = document.getElementById('sectorView')?.value || 'pie';
    const currency = document.getElementById('sectorCurrency')?.value || 'USD';
    const benchmark = document.getElementById('sectorBenchmark')?.value || 'SPY';
    const period = document.getElementById('sectorPeriod')?.value || '1Y';

    window.analyticsCore.sectorSettings = {
        classification,
        view,
        currency,
        benchmark,
        period
    };

    window.analyticsManager.loadModule('sector-allocation');
};

// Statistical Analysis Modal Functions
window.showStatisticalSettings = () => {
    // Create settings modal
    let settingsModal = document.getElementById('statisticalSettingsModal');
    if (!settingsModal) {
        settingsModal = document.createElement('div');
        settingsModal.id = 'statisticalSettingsModal';
        settingsModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        settingsModal.style.display = 'none';
        document.body.appendChild(settingsModal);
    }

    settingsModal.innerHTML = `
                        Cancel
                        Run Analysis
                        `;

    settingsModal.style.display = 'flex';
};

window.closeStatisticalSettingsModal = () => {
    const modal = document.getElementById('statisticalSettingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.closeStatisticalModal = () => {
    const modal = document.getElementById('statisticalModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.refreshStatisticalAnalysis = () => {
    window.runStatisticalAnalysisWithSettings();
};

window.runStatisticalAnalysisWithSettings = async () => {
    const lookbackPeriod = document.getElementById('lookbackPeriod')?.value || 252;
    const frequency = document.getElementById('frequency')?.value || 'daily';
    const benchmark = document.getElementById('benchmark')?.value || 'SPY';
    const confidenceLevel = parseFloat(document.getElementById('confidenceLevel')?.value || 0.95);

    // Close settings modal
    window.closeStatisticalSettingsModal();

    // Get portfolio data
    const portfolioData = window.analyticsCore?.portfolioData || [];
    if (!portfolioData || portfolioData.length === 0) {
        alert('Please upload a portfolio first');
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:8080/api/statistical-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                portfolio: portfolioData,
                lookback_period: parseInt(lookbackPeriod),
                frequency: frequency,
                benchmark: benchmark,
                confidence_level: confidenceLevel
            })
        });

        const data = await response.json();
        if (data.success) {
            window.analyticsManager.displayStatisticalAnalysis(data, {
                lookback_period: lookbackPeriod,
                frequency: frequency,
                benchmark: benchmark,
                confidence_level: confidenceLevel
            });
        } else {
            alert('Statistical analysis failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Failed to run statistical analysis: ' + error.message);
    }
};

// Statistical Analysis Settings
window.toggleStatisticalSettings = () => {
    const settings = document.getElementById('statisticalSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateStatisticalAnalysis = async () => {
    const lookback = parseInt(document.getElementById('statisticalLookback')?.value) || 252;
    const frequency = document.getElementById('statisticalFrequency')?.value || 'daily';
    const benchmark = document.getElementById('statisticalBenchmark')?.value || 'SPY';
    const confidence = parseFloat(document.getElementById('statisticalConfidence')?.value) || 0.95;

    console.log('[STATISTICAL UPDATE] New settings:', { lookback, frequency, benchmark, confidence });

    // Show loading state
    const container = document.getElementById('analysisContent');
    if (container) {
        container.innerHTML = `
                    `;
    }

    // Get portfolio data
    const portfolioData = window.analyticsCore?.portfolioData || [];
    if (!portfolioData || portfolioData.length === 0) {
        alert('Please upload a portfolio first');
        return;
    }

    try {
        // Add timestamp to prevent caching
        const response = await fetch('http://127.0.0.1:8080/api/statistical-analysis?' + Date.now(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                portfolio: portfolioData,
                options: {
                    lookback_period: lookback,
                    frequency: frequency,
                    benchmark: benchmark,
                    confidence_level: confidence
                }
            })
        });

        const data = await response.json();
        console.log('[STATISTICAL UPDATE] API Response:', data);

        if (data.success) {
            window.analyticsManager.displayStatisticalAnalysis(data, {
                lookback_period: lookback,
                frequency: frequency,
                benchmark: benchmark,
                confidence_level: confidence
            });
        } else {
            if (container) {
                container.innerHTML = `
                        `;
            }
        }
    } catch (error) {
        console.error('[STATISTICAL UPDATE] Error:', error);
        if (container) {
            container.innerHTML = `
                        `;
        }
    }
};

// Technical Analysis Settings
window.toggleTechnicalSettings = () => {
    const settings = document.getElementById('technicalSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateTechnicalAnalysis = async () => {
    const period = document.getElementById('technicalPeriod')?.value || '6M';
    const timeframe = document.getElementById('technicalTimeframe')?.value || 'Daily';
    const rsiPeriod = parseInt(document.getElementById('technicalRsiPeriod')?.value) || 14;
    const rsiOversold = parseInt(document.getElementById('technicalRsiOversold')?.value) || 30;
    const rsiOverbought = parseInt(document.getElementById('technicalRsiOverbought')?.value) || 70;
    const macdFast = parseInt(document.getElementById('technicalMacdFast')?.value) || 12;
    const macdSlow = parseInt(document.getElementById('technicalMacdSlow')?.value) || 26;
    const signalStrength = document.getElementById('technicalSignalStrength')?.value || 'Medium';

    // Store settings for API call
    window.analyticsCore.technicalSettings = {
        period,
        timeframe,
        indicators: ['RSI', 'MACD', 'Bollinger', 'SMA', 'EMA'],
        rsi_period: rsiPeriod,
        rsi_oversold: rsiOversold,
        rsi_overbought: rsiOverbought,
        macd_fast: macdFast,
        macd_slow: macdSlow,
        macd_signal: 9,
        bb_period: 20,
        bb_std: 2,
        signal_strength: signalStrength
    };

    // Show loading state
    const container = document.getElementById('analysisContent');
    if (container) {
        container.innerHTML = `
                    `;
    }

    // Get portfolio data
    const portfolioData = window.analyticsCore?.portfolioData || [];
    if (!portfolioData || portfolioData.length === 0) {
        alert('Please upload a portfolio first');
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:8080/api/technical-analysis?' + Date.now(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                portfolio: portfolioData,
                options: window.analyticsCore.technicalSettings
            })
        });

        const data = await response.json();
        console.log('[TECHNICAL UPDATE] API Response:', data);

        if (data.success) {
            window.analyticsManager.displayTechnicalIndicators(data, window.analyticsCore.technicalSettings);
        } else {
            if (container) {
                container.innerHTML = `
                        `;
            }
        }
    } catch (error) {
        console.error('[TECHNICAL UPDATE] Error:', error);
        if (container) {
            container.innerHTML = `
                        `;
        }
    }
};

// Strategy Backtesting Settings
window.toggleBacktestingSettings = () => {
    const settings = document.getElementById('backtestingSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

// Alias for compatibility
window.toggleBacktestSettings = () => {
    return window.toggleBacktestingSettings();
};

window.updateStrategyBacktesting = async () => {
    // Get portfolio data
    const portfolioData = window.analyticsCore?.portfolioData || [];
    if (!portfolioData || portfolioData.length === 0) {
        alert('Please upload a portfolio first');
        return;
    }

    // Get settings from form
    const period = document.getElementById('backtestPeriod')?.value || '1Y';
    const rebalancing = document.getElementById('backtestRebalancing')?.value || 'Quarterly';
    const transactionCosts = parseFloat(document.getElementById('backtestTransactionCosts')?.value || '0.1');
    const benchmark = document.getElementById('backtestBenchmark')?.value || 'SPY';

    // Show loading state
    const container = document.getElementById('analysisContent');
    if (container) {
        container.innerHTML = `
                    `;
    }

    try {
        const response = await fetch('http://127.0.0.1:8080/api/strategy-backtesting', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                portfolio: portfolioData,
                options: {
                    backtest_period: period,
                    rebalancing: rebalancing,
                    transaction_costs: transactionCosts,
                    benchmark: benchmark
                }
            })
        });

        const data = await response.json();
        console.log('[BACKTESTING] API Response:', data);

        if (data.success && data.backtesting_results) {
            window.analyticsManager.displayStrategyBacktesting(data, {
                backtest_period: period,
                rebalancing: rebalancing,
                transaction_costs: transactionCosts,
                benchmark: benchmark
            });
        } else {
            if (container) {
                container.innerHTML = `
                        `;
            }
        }
    } catch (error) {
        console.error('[BACKTESTING] Error:', error);
        if (container) {
            container.innerHTML = `
                        `;
        }
    }
};

