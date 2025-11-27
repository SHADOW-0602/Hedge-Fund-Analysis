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
            settingsId: null,
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
            settingsId: null,
            displayFunction: this.displayPerformanceAttribution,
            type: 'portfolio'
        });

        this.register('monte-carlo', {
            endpoint: 'monte-carlo',
            containerId: 'monteCarloResults',
            settingsId: 'monteCarloSettings',
            displayFunction: this.displayMonteCarloResults,
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

        // Register market news module
        this.register('market-news', {
            endpoint: 'news',
            containerId: 'analysisContent',
            settingsId: null,
            displayFunction: this.displayMarketNews,
            type: 'news'
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
            endpoint: 'trade-performance', // Use existing trade-performance endpoint
            containerId: 'analysisContent',
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
            displayFunction: null, // Handled by dedicated module
            type: 'transaction'
        });

        this.register('accounting-analysis', {
            endpoint: 'fifo-lifo-accounting',
            containerId: 'accountingAnalysis',
            settingsId: 'accountingSettings',
            displayFunction: this.displayAccountingAnalysis,
            type: 'transaction'
        });

        this.register('trade-timing', {
            endpoint: 'drawdown-analysis', // Use existing drawdown endpoint for now
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
            endpoint: 'pnl-attribution', // Use existing P&L attribution endpoint
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
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-900">Loading Analysis...</h2>
                        <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="text-center py-8">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                        <p class="text-gray-600">Making API call to backend...</p>
                        <p class="text-sm text-gray-500 mt-2">Endpoint: ${module.endpoint}</p>
                    </div>
                `;
            }
        }

        try {
            if (module.type === 'portfolio') {
                await window.analyticsCore.analyzePortfolio(
                    module.endpoint,
                    module.containerId,
                    module.displayFunction,
                    module.settingsId
                );
            } else if (module.type === 'news') {
                await this.loadMarketNews(module);
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
            const container = document.getElementById('analysisContent');
            if (container) {
                container.innerHTML = `
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-900">Analysis Error</h2>
                        <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="text-red-600 text-center py-4">
                        <p class="font-semibold">Failed to load ${name}</p>
                        <p class="text-sm mt-2">${error.message}</p>
                    </div>
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
        const currentPeriod = options?.period || metrics.period;
        const currentConfidence = options?.var_confidence || metrics.var_confidence;
        const currentModel = options?.risk_model || metrics.risk_model;
        const currentBenchmark = options?.benchmark || metrics.benchmark;
        const currentWindow = options?.rolling_window || metrics.rolling_window;

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="analysis-title">Risk Metrics Analysis</h2>
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
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Risk Settings Panel -->
            <div id="riskSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
                        <select id="riskPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateRiskAnalysis()">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentPeriod === '2Y' ? 'selected' : ''}>2 Years</option>
                            <option value="3Y" ${currentPeriod === '3Y' ? 'selected' : ''}>3 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">VaR Confidence</label>
                        <select id="riskVarConfidence" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateRiskAnalysis()">
                            <option value="0.90" ${currentConfidence === 0.90 ? 'selected' : ''}>90%</option>
                            <option value="0.95" ${currentConfidence === 0.95 ? 'selected' : ''}>95%</option>
                            <option value="0.99" ${currentConfidence === 0.99 ? 'selected' : ''}>99%</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Risk Model</label>
                        <select id="riskModel" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateRiskAnalysis()">
                            <option value="historical" ${currentModel === 'historical' ? 'selected' : ''}>Historical</option>
                            <option value="monte_carlo" ${currentModel === 'monte_carlo' ? 'selected' : ''}>Monte Carlo</option>
                            <option value="parametric" ${currentModel === 'parametric' ? 'selected' : ''}>Parametric</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                        <select id="riskBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateRiskAnalysis()">
                            <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500</option>
                            <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>NASDAQ</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Rolling Window</label>
                        <select id="riskRollingWindow" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateRiskAnalysis()">
                            <option value="30" ${currentWindow === 30 ? 'selected' : ''}>30 days</option>
                            <option value="60" ${currentWindow === 60 ? 'selected' : ''}>60 days</option>
                            <option value="90" ${currentWindow === 90 ? 'selected' : ''}>90 days</option>
                            <option value="252" ${currentWindow === 252 ? 'selected' : ''}>252 days</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="space-y-6">
                <!-- Portfolio Summary -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="details-box">
                        <h4 class="section-header">Portfolio Value</h4>
                        <p class="text-2xl font-bold metric-value neutral">${metrics.portfolio_value ? window.analyticsCore.formatCurrency(metrics.portfolio_value) : 'N/A'}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Positions</h4>
                        <p class="text-2xl font-bold metric-value neutral">${metrics.num_positions || 'N/A'}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Symbols Analyzed</h4>
                        <p class="text-2xl font-bold metric-value neutral">${metrics.symbols_analyzed?.length || 'N/A'}</p>
                    </div>
                </div>
                
                <!-- Risk Metrics Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-3">
                        <h4 class="section-header">Volatility & Risk</h4>
                        <div class="metric-row">
                            <span class="metric-label">Portfolio Volatility</span>
                            <span class="metric-value ${(metrics.portfolio_volatility || 0) > 0.3 ? 'negative' : 'neutral'}">${metrics.portfolio_volatility ? window.analyticsCore.formatPercent(metrics.portfolio_volatility) : 'N/A'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">VaR (${currentConfidence ? (currentConfidence * 100).toFixed(0) : '95'}%)</span>
                            <span class="metric-value negative">${metrics.var_95 !== null && metrics.var_95 !== undefined ? window.analyticsCore.formatPercent(Math.abs(metrics.var_95)) : 'N/A'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">CVaR (${currentConfidence ? (currentConfidence * 100).toFixed(0) : '95'}%)</span>
                            <span class="metric-value negative">${metrics.cvar_95 !== null && metrics.cvar_95 !== undefined ? window.analyticsCore.formatPercent(Math.abs(metrics.cvar_95)) : 'N/A'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Max Drawdown</span>
                            <span class="metric-value negative">${metrics.max_drawdown ? window.analyticsCore.formatPercent(Math.abs(metrics.max_drawdown)) : 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <h4 class="section-header">Performance Ratios</h4>
                        <div class="metric-row">
                            <span class="metric-label">Sharpe Ratio</span>
                            <span class="metric-value ${(metrics.sharpe_ratio || 0) > 1 ? 'positive' : (metrics.sharpe_ratio || 0) > 0 ? 'neutral' : 'negative'}">${metrics.sharpe_ratio !== null && metrics.sharpe_ratio !== undefined ? window.analyticsCore.formatNumber(metrics.sharpe_ratio) : 'N/A'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Sortino Ratio</span>
                            <span class="metric-value ${(metrics.sortino_ratio || 0) > 1 ? 'positive' : (metrics.sortino_ratio || 0) > 0 ? 'neutral' : 'negative'}">${metrics.sortino_ratio !== null && metrics.sortino_ratio !== undefined ? window.analyticsCore.formatNumber(metrics.sortino_ratio) : 'N/A'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Beta (vs ${currentBenchmark || 'Benchmark'})</span>
                            <span class="metric-value ${(metrics.beta || 0) > 1.2 ? 'negative' : (metrics.beta || 0) < 0.8 ? 'positive' : 'neutral'}">${metrics.beta !== null && metrics.beta !== undefined ? window.analyticsCore.formatNumber(metrics.beta) : 'N/A'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Tracking Error</span>
                            <span class="metric-value neutral">${metrics.tracking_error ? window.analyticsCore.formatPercent(metrics.tracking_error) : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Correlation Analysis -->
                ${metrics.avg_correlation !== undefined && metrics.avg_correlation !== null ? `
                    <div class="details-box">
                        <h4 class="section-header">Correlation Analysis</h4>
                        <div class="metric-row">
                            <span class="metric-label">Average Correlation</span>
                            <span class="metric-value ${(metrics.avg_correlation || 0) > 0.7 ? 'negative' : (metrics.avg_correlation || 0) > 0.3 ? 'neutral' : 'positive'}">${window.analyticsCore.formatNumber(metrics.avg_correlation)}</span>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Risk Contribution -->
                ${metrics.risk_contribution && Object.keys(metrics.risk_contribution).length > 0 ? `
                    <div class="details-box">
                        <h4 class="section-header">Risk Contribution by Symbol</h4>
                        <div class="space-y-2">
                            ${Object.entries(metrics.risk_contribution).slice(0, 10).map(([symbol, contribution]) => `
                                <div class="metric-row">
                                    <span class="metric-label">${symbol}</span>
                                    <span class="metric-value neutral">${window.analyticsCore.formatPercent(contribution)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Analysis Details -->
                <div class="details-box">
                    <h4 class="section-header">Analysis Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span class="detail-label">Period:</span> <span class="detail-value">${currentPeriod || 'N/A'}</span></div>
                        <div><span class="detail-label">Risk Model:</span> <span class="detail-value">${currentModel || 'N/A'}</span></div>
                        <div><span class="detail-label">Benchmark:</span> <span class="detail-value">${currentBenchmark || 'N/A'}</span></div>
                        <div><span class="detail-label">Window:</span> <span class="detail-value">${currentWindow || 'N/A'} days</span></div>
                    </div>
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
        const itemsPerPage = 20; // Increased from 10 to show more results
        const totalPages = Math.ceil(filteredOpportunities.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentOpportunities = filteredOpportunities.slice(startIndex, endIndex);

        console.log(`[OPTIONS DISPLAY] Filtered opportunities: ${filteredOpportunities.length}, Current page: ${currentPage}, Showing: ${currentOpportunities.length}`);

        // Get available strategies and symbols
        const availableStrategies = [...new Set(allOpportunities.map(opp => opp.strategy))];
        const availableSymbols = [...new Set(allOpportunities.map(opp => opp.symbol))].sort();

        const strategyOptions = availableStrategies.map(strategy => {
            const displayName = strategy.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            return `<option value="${strategy}">${displayName}</option>`;
        }).join('');

        const symbolOptions = availableSymbols.map(symbol =>
            `<option value="${symbol}">${symbol}</option>`
        ).join('');

        // Get current settings
        const currentExpiration = options?.expiration || '3M';
        const currentMoneyness = options?.moneyness || 'All';
        const currentMinPremium = options?.min_premium || '0.50';
        const currentDeltaRange = options?.delta_range || 'All';

        // Define fixed list of strategies to ensure all are displayed
        const definedStrategies = ['covered_calls', 'protective_puts', 'iron_condors'];

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Options Strategies</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleOptionsSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <select id="symbolFilter" onchange="filterOptionsStrategies()" class="px-3 py-1 border rounded-lg text-sm">
                        <option value="all">All Symbols</option>
                        ${symbolOptions}
                    </select>
                    <button onclick="updateOptionsAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Options Settings Panel -->
            <div id="optionsSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Expiration</label>
                        <select id="optionsExpiration" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateOptionsAnalysis()">
                            <option value="1M" ${currentExpiration === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="2M" ${currentExpiration === '2M' ? 'selected' : ''}>2 Months</option>
                            <option value="3M" ${currentExpiration === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentExpiration === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentExpiration === '1Y' ? 'selected' : ''}>1 Year</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Moneyness</label>
                        <select id="optionsMoneyness" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateOptionsAnalysis()">
                            <option value="All" ${currentMoneyness === 'All' ? 'selected' : ''}>All</option>
                            <option value="ITM" ${currentMoneyness === 'ITM' ? 'selected' : ''}>ITM</option>
                            <option value="ATM" ${currentMoneyness === 'ATM' ? 'selected' : ''}>ATM</option>
                            <option value="OTM" ${currentMoneyness === 'OTM' ? 'selected' : ''}>OTM</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Min Premium</label>
                        <select id="optionsMinPremium" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateOptionsAnalysis()">
                            <option value="0.50" ${currentMinPremium === '0.50' ? 'selected' : ''}>$0.50</option>
                            <option value="1.00" ${currentMinPremium === '1.00' ? 'selected' : ''}>$1.00</option>
                            <option value="2.00" ${currentMinPremium === '2.00' ? 'selected' : ''}>$2.00</option>
                            <option value="5.00" ${currentMinPremium === '5.00' ? 'selected' : ''}>$5.00</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Delta Range</label>
                        <select id="optionsDeltaRange" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateOptionsAnalysis()">
                            <option value="All" ${currentDeltaRange === 'All' ? 'selected' : ''}>All</option>
                            <option value="0.1-0.3" ${currentDeltaRange === '0.1-0.3' ? 'selected' : ''}>0.1-0.3</option>
                            <option value="0.3-0.7" ${currentDeltaRange === '0.3-0.7' ? 'selected' : ''}>0.3-0.7</option>
                            <option value="0.7-1.0" ${currentDeltaRange === '0.7-1.0' ? 'selected' : ''}>0.7-1.0</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    ${definedStrategies.map(strategy => {
            const strategyOpportunities = allOpportunities.filter(o => o.strategy === strategy);
            const totalPremium = strategyOpportunities.reduce((sum, o) => sum + (o.premium || 0), 0);
            const displayName = strategy.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            const colorClass = strategy === 'covered_calls' ? 'blue' : strategy === 'protective_puts' ? 'green' : 'purple';
            return `
                            <div class="bg-${colorClass}-50 p-4 rounded-lg">
                                <h4 class="font-semibold text-${colorClass}-800">${displayName}</h4>
                                <p class="text-2xl font-bold text-${colorClass}-600">${strategyOpportunities.length}</p>
                                <p class="text-sm text-${colorClass}-600">${strategy.includes('put') ? 'Cost' : 'Premium'}: ${window.analyticsCore.formatCurrency(totalPremium)}</p>
                            </div>
                        `;
        }).join('')}
                </div>
                ${allOpportunities.length > 0 ? `
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
                                ${currentOpportunities.map(opp => `
                                    <tr>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${opp.symbol}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${opp.strategy}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${window.analyticsCore.formatCurrency(opp.strike)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">${window.analyticsCore.formatCurrency(opp.premium)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${opp.delta ? window.analyticsCore.formatNumber(opp.delta) : 'N/A'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ${totalPages > 1 ? `
                        <div class="flex justify-center items-center space-x-2 mt-4">
                            <button onclick="changeOptionsPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="px-3 py-1 bg-gray-200 rounded ${currentPage === 1 ? 'opacity-50' : 'hover:bg-gray-300'}">Previous</button>
                            <span class="text-sm text-gray-600">Page ${currentPage} of ${totalPages} (${filteredOpportunities.length} total)</span>
                            <button onclick="changeOptionsPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1 bg-gray-200 rounded ${currentPage === totalPages ? 'opacity-50' : 'hover:bg-gray-300'}">Next</button>
                        </div>
                    ` : ''}
                ` : '<p class="text-gray-500 text-center py-4">No options opportunities found</p>'}
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

    displayPerformanceAttribution(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const attribution = result.attribution || result;

        // Get current settings
        const currentPeriod = options?.period || '1Y';
        const currentModel = options?.attribution_model || 'brinson';
        const currentBenchmark = options?.benchmark || 'SPY';
        const currentCurrency = options?.currency || 'USD';
        const currentFrequency = options?.frequency || 'daily';

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
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
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
                            <option value="EFA" ${currentBenchmark === 'EFA' ? 'selected' : ''}>EAFE (EFA)</option>
                            <option value="EEM" ${currentBenchmark === 'EEM' ? 'selected' : ''}>Emerging Markets (EEM)</option>
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
                        <span class="metric-value ${attribution.asset_allocation === null || attribution.asset_allocation === undefined ? 'neutral' : (attribution.asset_allocation > 0 ? 'positive' : 'negative')}">${attribution.asset_allocation === null || attribution.asset_allocation === undefined ? 'N/A' : window.analyticsCore.formatPercent(attribution.asset_allocation / 100)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Security Selection</span>
                        <span class="metric-value ${attribution.security_selection === null || attribution.security_selection === undefined ? 'neutral' : (attribution.security_selection > 0 ? 'positive' : 'negative')}">${attribution.security_selection === null || attribution.security_selection === undefined ? 'N/A' : window.analyticsCore.formatPercent(attribution.security_selection / 100)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Interaction Effect</span>
                        <span class="metric-value ${attribution.interaction_effect === null || attribution.interaction_effect === undefined ? 'neutral' : (attribution.interaction_effect > 0 ? 'positive' : 'negative')}">${attribution.interaction_effect === null || attribution.interaction_effect === undefined ? 'N/A' : window.analyticsCore.formatPercent(attribution.interaction_effect / 100)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Currency Effect</span>
                        <span class="metric-value ${attribution.currency_effect === null || attribution.currency_effect === undefined ? 'neutral' : (attribution.currency_effect > 0 ? 'positive' : 'negative')}">${attribution.currency_effect === null || attribution.currency_effect === undefined ? 'N/A' : window.analyticsCore.formatPercent(attribution.currency_effect / 100)}</span>
                    </div>
                </div>
                <div class="space-y-3">
                    <h4 class="section-header">Performance Summary</h4>
                    <div class="metric-row">
                        <span class="metric-label">Portfolio Return</span>
                        <span class="metric-value ${(attribution.portfolio_return || 0) > 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent((attribution.portfolio_return || 0) / 100)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Benchmark Return</span>
                        <span class="metric-value neutral">${window.analyticsCore.formatPercent((attribution.benchmark_return || 0) / 100)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Active Return</span>
                        <span class="metric-value ${(attribution.active_return || 0) > 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent((attribution.active_return || 0) / 100)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Market Timing</span>
                        <span class="metric-value ${(attribution.market_timing || 0) > 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent((attribution.market_timing || 0) / 100)}</span>
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

    displayPortfolioOptimization(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const optimization = result.optimization || {};
        const optimal = optimization.optimal_portfolio || {};

        // Get current settings
        const currentObjective = options?.objective || 'max_sharpe';
        const currentConstraint = options?.constraint || 'long_only';
        const currentRebalancing = options?.rebalancing || 'monthly';
        const currentRiskBudget = options?.risk_budget || 'equal';
        const currentLookback = options?.lookback_period || '1y';

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
                        Optimize
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Portfolio Optimization Settings Panel -->
            <div id="optimizationSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Objective</label>
                        <select id="optimizationObjective" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePortfolioOptimization()">
                            <option value="max_sharpe" ${currentObjective === 'max_sharpe' ? 'selected' : ''}>Max Sharpe</option>
                            <option value="min_volatility" ${currentObjective === 'min_volatility' ? 'selected' : ''}>Min Volatility</option>
                            <option value="max_return" ${currentObjective === 'max_return' ? 'selected' : ''}>Max Return</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Constraints</label>
                        <select id="optimizationConstraint" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePortfolioOptimization()">
                            <option value="long_only" ${currentConstraint === 'long_only' ? 'selected' : ''}>Long-only</option>
                            <option value="130_30" ${currentConstraint === '130_30' ? 'selected' : ''}>130/30</option>
                            <option value="market_neutral" ${currentConstraint === 'market_neutral' ? 'selected' : ''}>Market Neutral</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Rebalancing</label>
                        <select id="optimizationRebalancing" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePortfolioOptimization()">
                            <option value="monthly" ${currentRebalancing === 'monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="quarterly" ${currentRebalancing === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                            <option value="semi_annual" ${currentRebalancing === 'semi_annual' ? 'selected' : ''}>Semi-annual</option>
                            <option value="annual" ${currentRebalancing === 'annual' ? 'selected' : ''}>Annual</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Risk Budget</label>
                        <select id="optimizationRiskBudget" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePortfolioOptimization()">
                            <option value="equal" ${currentRiskBudget === 'equal' ? 'selected' : ''}>Equal</option>
                            <option value="risk_parity" ${currentRiskBudget === 'risk_parity' ? 'selected' : ''}>Risk Parity</option>
                            <option value="custom" ${currentRiskBudget === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Lookback Period</label>
                        <select id="optimizationLookback" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updatePortfolioOptimization()">
                            <option value="1y" ${currentLookback === '1y' ? 'selected' : ''}>1Y</option>
                            <option value="2y" ${currentLookback === '2y' ? 'selected' : ''}>2Y</option>
                            <option value="3y" ${currentLookback === '3y' ? 'selected' : ''}>3Y</option>
                            <option value="5y" ${currentLookback === '5y' ? 'selected' : ''}>5Y</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="space-y-6">
                <!-- Optimal Portfolio Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="details-box">
                        <h4 class="section-header">Expected Return</h4>
                        <p class="text-2xl font-bold metric-value positive">${window.analyticsCore.formatPercent(optimal.expected_return || 0)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Risk (Volatility)</h4>
                        <p class="text-2xl font-bold metric-value neutral">${window.analyticsCore.formatPercent(optimal.volatility || 0)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Sharpe Ratio</h4>
                        <p class="text-2xl font-bold metric-value ${(optimal.sharpe_ratio || 0) > 1 ? 'positive' : 'neutral'}">${window.analyticsCore.formatNumber(optimal.sharpe_ratio || 0)}</p>
                    </div>
                </div>
                
                <!-- Portfolio Comparison -->
                <div class="details-box">
                    <h4 class="section-header">Portfolio Comparison</h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Portfolio</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sharpe</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Optimal</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">${window.analyticsCore.formatPercent(optimal.expected_return || 0)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${window.analyticsCore.formatPercent(optimal.volatility || 0)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600">${window.analyticsCore.formatNumber(optimal.sharpe_ratio || 0)}</td>
                                </tr>
                                ${optimization.equal_weight ? `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Equal Weight</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">${window.analyticsCore.formatPercent(optimization.equal_weight.expected_return || 0)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${window.analyticsCore.formatPercent(optimization.equal_weight.volatility || 0)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600">${window.analyticsCore.formatNumber(optimization.equal_weight.sharpe_ratio || 0)}</td>
                                </tr>
                                ` : ''}
                                ${optimization.risk_parity ? `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Risk Parity</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">${window.analyticsCore.formatPercent(optimization.risk_parity.expected_return || 0)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${window.analyticsCore.formatPercent(optimization.risk_parity.volatility || 0)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600">${window.analyticsCore.formatNumber(optimization.risk_parity.sharpe_ratio || 0)}</td>
                                </tr>
                                ` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Optimal Weights -->
                ${optimal.weights && Object.keys(optimal.weights).length > 0 ? `
                    <div class="details-box">
                        <h4 class="section-header">Optimal Portfolio Weights</h4>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            ${Object.entries(optimal.weights).filter(([symbol, weight]) => weight > 0.001).map(([symbol, weight]) => `
                                <div class="text-center">
                                    <div class="text-sm font-medium text-gray-900">${symbol}</div>
                                    <div class="text-lg font-bold text-indigo-600">${window.analyticsCore.formatPercent(weight)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Optimization Parameters -->
                <div class="details-box">
                    <h4 class="section-header">Optimization Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div><span class="detail-label">Objective:</span> <span class="detail-value">${currentObjective.replace('_', ' ')}</span></div>
                        <div><span class="detail-label">Constraints:</span> <span class="detail-value">${currentConstraint.replace('_', ' ')}</span></div>
                        <div><span class="detail-label">Rebalancing:</span> <span class="detail-value">${currentRebalancing.replace('_', ' ')}</span></div>
                        <div><span class="detail-label">Risk Budget:</span> <span class="detail-value">${currentRiskBudget.replace('_', ' ')}</span></div>
                        <div><span class="detail-label">Lookback:</span> <span class="detail-value">${currentLookback.toUpperCase()}</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    displayMonteCarloResults(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const results = result.results || {};

        // Get current settings
        const currentPeriod = options?.forecast_period || '3M';
        const currentSimulations = options?.simulations || 10000;
        const currentConfidence = options?.confidence_intervals || 0.95;
        const currentRegime = options?.market_regime || 'normal';
        const currentVolatility = options?.volatility_adjustment || 0.0;

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
                        Run Simulation
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Monte Carlo Settings Panel -->
            <div id="monteCarloSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Forecast Period</label>
                        <select id="mcForecastPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateMonteCarloAnalysis()">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentPeriod === '2Y' ? 'selected' : ''}>2 Years</option>
                            <option value="5Y" ${currentPeriod === '5Y' ? 'selected' : ''}>5 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Simulations</label>
                        <select id="mcSimulations" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateMonteCarloAnalysis()">
                            <option value="1000" ${currentSimulations === 1000 ? 'selected' : ''}>1K</option>
                            <option value="5000" ${currentSimulations === 5000 ? 'selected' : ''}>5K</option>
                            <option value="10000" ${currentSimulations === 10000 ? 'selected' : ''}>10K</option>
                            <option value="50000" ${currentSimulations === 50000 ? 'selected' : ''}>50K</option>
                            <option value="100000" ${currentSimulations === 100000 ? 'selected' : ''}>100K</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Confidence Intervals</label>
                        <select id="mcConfidenceIntervals" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateMonteCarloAnalysis()">
                            <option value="0.80" ${currentConfidence === 0.80 ? 'selected' : ''}>80%</option>
                            <option value="0.90" ${currentConfidence === 0.90 ? 'selected' : ''}>90%</option>
                            <option value="0.95" ${currentConfidence === 0.95 ? 'selected' : ''}>95%</option>
                            <option value="0.99" ${currentConfidence === 0.99 ? 'selected' : ''}>99%</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Market Regime</label>
                        <select id="mcMarketRegime" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateMonteCarloAnalysis()">
                            <option value="bull" ${currentRegime === 'bull' ? 'selected' : ''}>Bull (+20%)</option>
                            <option value="normal" ${currentRegime === 'normal' ? 'selected' : ''}>Normal (0%)</option>
                            <option value="bear" ${currentRegime === 'bear' ? 'selected' : ''}>Bear (-20%)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Volatility Adjustment</label>
                        <select id="mcVolatilityAdjustment" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateMonteCarloAnalysis()">
                            <option value="-0.5" ${currentVolatility === -0.5 ? 'selected' : ''}>-50%</option>
                            <option value="0.0" ${currentVolatility === 0.0 ? 'selected' : ''}>Normal</option>
                            <option value="0.5" ${currentVolatility === 0.5 ? 'selected' : ''}>+50%</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="space-y-6">
                <!-- Simulation Summary -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="details-box">
                        <h4 class="section-header">Expected Return</h4>
                        <p class="text-2xl font-bold metric-value ${(results.expected_return || 0) > 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(results.expected_return || 0)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Volatility</h4>
                        <p class="text-2xl font-bold metric-value neutral">${window.analyticsCore.formatPercent(results.volatility || 0)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Max Drawdown</h4>
                        <p class="text-2xl font-bold metric-value negative">${window.analyticsCore.formatPercent(Math.abs(results.max_drawdown || 0))}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Sharpe Ratio</h4>
                        <p class="text-2xl font-bold metric-value ${(results.sharpe_ratio || 0) > 1 ? 'positive' : (results.sharpe_ratio || 0) > 0 ? 'neutral' : 'negative'}">${window.analyticsCore.formatNumber(results.sharpe_ratio || 0)}</p>
                    </div>
                </div>
                
                <!-- Risk Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-3">
                        <h4 class="section-header">Simulation Results</h4>
                        <div class="metric-row">
                            <span class="metric-label">Mean Final Value</span>
                            <span class="metric-value neutral">${window.analyticsCore.formatNumber(results.mean_final_value || 1.0)}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">95th Percentile</span>
                            <span class="metric-value positive">${window.analyticsCore.formatPercent(results.percentile_95 || 0)}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">5th Percentile</span>
                            <span class="metric-value negative">${window.analyticsCore.formatPercent(results.percentile_5 || 0)}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Probability of Loss</span>
                            <span class="metric-value ${(results.probability_loss || 0) > 0.3 ? 'negative' : 'neutral'}">${window.analyticsCore.formatPercent(results.probability_loss || 0)}</span>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <h4 class="section-header">Confidence Intervals</h4>
                        ${results.confidence_intervals ? Object.entries(results.confidence_intervals).map(([level, bounds]) => `
                            <div class="metric-row">
                                <span class="metric-label">${level} Confidence</span>
                                <span class="metric-value neutral">${window.analyticsCore.formatPercent(bounds.lower)} to ${window.analyticsCore.formatPercent(bounds.upper)}</span>
                            </div>
                        `).join('') : '<p class="text-gray-500">No confidence intervals available</p>'}
                    </div>
                </div>
                
                <!-- Simulation Parameters -->
                <div class="details-box">
                    <h4 class="section-header">Simulation Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div><span class="detail-label">Period:</span> <span class="detail-value">${currentPeriod}</span></div>
                        <div><span class="detail-label">Simulations:</span> <span class="detail-value">${currentSimulations.toLocaleString()}</span></div>
                        <div><span class="detail-label">Confidence:</span> <span class="detail-value">${(currentConfidence * 100).toFixed(0)}%</span></div>
                        <div><span class="detail-label">Market Regime:</span> <span class="detail-value">${currentRegime}</span></div>
                        <div><span class="detail-label">Vol Adjustment:</span> <span class="detail-value">${currentVolatility > 0 ? '+' : ''}${(currentVolatility * 100).toFixed(0)}%</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    displaySectorAllocation(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const allocation = result.allocation || {};
        const sectorData = allocation.sector_allocation || {};
        const geoData = allocation.geographic_allocation || {};
        const styleData = allocation.style_analysis || {};
        const diversification = allocation.diversification_metrics || {};
        const summary = allocation.summary || {};

        // Get current settings from stored settings or defaults
        const storedSettings = window.analyticsCore?.sectorSettings || {};
        const currentClassification = storedSettings.classification || options?.classification || summary.classification || 'GICS';
        const currentView = storedSettings.view || options?.view || 'pie';
        const currentCurrency = storedSettings.currency || options?.currency || summary.currency || 'USD';
        const currentBenchmark = storedSettings.benchmark || options?.benchmark || summary.benchmark || 'SPY';
        const currentPeriod = storedSettings.period || options?.period || summary.period || '1Y';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Sector Allocation Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleSectorSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="updateSectorAllocation()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Sector Settings Panel -->
            <div id="sectorSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Classification</label>
                        <select id="sectorClassification" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateSectorAllocation()">
                            <option value="GICS" ${currentClassification === 'GICS' ? 'selected' : ''}>GICS</option>
                            <option value="ICB" ${currentClassification === 'ICB' ? 'selected' : ''}>ICB</option>
                            <option value="NAICS" ${currentClassification === 'NAICS' ? 'selected' : ''}>NAICS</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">View</label>
                        <select id="sectorView" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateSectorView()">
                            <option value="pie">Pie Chart</option>
                            <option value="bar">Bar Chart</option>
                            <option value="treemap">Treemap</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                        <select id="sectorCurrency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateSectorAllocation()">
                            <option value="USD" ${currentCurrency === 'USD' ? 'selected' : ''}>USD</option>
                            <option value="EUR" ${currentCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                            <option value="GBP" ${currentCurrency === 'GBP' ? 'selected' : ''}>GBP</option>
                            <option value="MULTI" ${currentCurrency === 'MULTI' ? 'selected' : ''}>Multi-currency</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                        <select id="sectorBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateSectorAllocation()">
                            <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>NASDAQ (QQQ)</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                            <option value="VTI" ${currentBenchmark === 'VTI' ? 'selected' : ''}>Total Stock Market (VTI)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                        <select id="sectorPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateSectorAllocation()">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="YTD" ${currentPeriod === 'YTD' ? 'selected' : ''}>Year to Date</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="space-y-6">
                <!-- Portfolio Summary -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="details-box">
                        <h4 class="section-header">Total Sectors</h4>
                        <p class="text-2xl font-bold metric-value neutral">${summary.total_sectors || Object.keys(sectorData).length}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Portfolio Value</h4>
                        <p class="text-2xl font-bold metric-value neutral">${summary.total_value ? window.analyticsCore.formatCurrency(summary.total_value) : 'N/A'}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Effective Sectors</h4>
                        <p class="text-2xl font-bold metric-value ${(diversification.effective_number_sectors || 0) > 5 ? 'positive' : 'neutral'}">${window.analyticsCore.formatNumber(diversification.effective_number_sectors || 0)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Concentration Ratio</h4>
                        <p class="text-2xl font-bold metric-value ${(diversification.sector_concentration || 0) > 0.5 ? 'negative' : 'neutral'}">${window.analyticsCore.formatPercent(diversification.sector_concentration || 0)}</p>
                    </div>
                </div>
                
                <!-- Sector Chart Visualization -->
                <div id="sectorChartContainer" class="mb-6">
                    <div class="bg-gray-100 p-4 rounded-lg text-center text-gray-500">
                        <p>Loading sector visualization...</p>
                    </div>
                </div>
                
                <!-- Sector Allocation -->
                ${Object.keys(sectorData).length > 0 ? `
                    <div class="details-box">
                        <h4 class="section-header">Sector Breakdown</h4>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sector</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbols</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    ${Object.entries(sectorData).sort((a, b) => b[1].weight - a[1].weight).map(([sector, data]) => `
                                        <tr>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${sector}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-indigo-600">${window.analyticsCore.formatPercent(data.weight)}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">${window.analyticsCore.formatCurrency(data.value || 0)}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${(data.symbols || []).join(', ')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : '<p class="text-gray-500 text-center py-4">No sector allocation data available</p>'}
                
                <!-- Geographic Allocation -->
                ${Object.keys(geoData).length > 0 ? `
                    <div class="details-box">
                        <h4 class="section-header">Geographic Allocation</h4>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            ${Object.entries(geoData).sort((a, b) => b[1].weight - a[1].weight).map(([country, data]) => `
                                <div class="text-center">
                                    <div class="text-sm font-medium text-gray-900">${country}</div>
                                    <div class="text-lg font-bold text-indigo-600">${window.analyticsCore.formatPercent(data.weight)}</div>
                                    <div class="text-xs text-gray-500">${(data.symbols || []).length} symbols</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Style Analysis -->
                ${styleData.market_cap || styleData.style ? `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        ${styleData.market_cap ? `
                            <div class="details-box">
                                <h4 class="section-header">Market Cap Allocation</h4>
                                <div class="space-y-2">
                                    <div class="metric-row">
                                        <span class="metric-label">Large Cap</span>
                                        <span class="metric-value neutral">${window.analyticsCore.formatPercent(styleData.market_cap.large || 0)}</span>
                                    </div>
                                    <div class="metric-row">
                                        <span class="metric-label">Mid Cap</span>
                                        <span class="metric-value neutral">${window.analyticsCore.formatPercent(styleData.market_cap.mid || 0)}</span>
                                    </div>
                                    <div class="metric-row">
                                        <span class="metric-label">Small Cap</span>
                                        <span class="metric-value neutral">${window.analyticsCore.formatPercent(styleData.market_cap.small || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        ${styleData.style ? `
                            <div class="details-box">
                                <h4 class="section-header">Investment Style</h4>
                                <div class="space-y-2">
                                    <div class="metric-row">
                                        <span class="metric-label">Growth</span>
                                        <span class="metric-value positive">${window.analyticsCore.formatPercent(styleData.style.growth || 0)}</span>
                                    </div>
                                    <div class="metric-row">
                                        <span class="metric-label">Value</span>
                                        <span class="metric-value positive">${window.analyticsCore.formatPercent(styleData.style.value || 0)}</span>
                                    </div>
                                    <div class="metric-row">
                                        <span class="metric-label">Blend</span>
                                        <span class="metric-value neutral">${window.analyticsCore.formatPercent(styleData.style.blend || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                
                <!-- Diversification Metrics -->
                <div class="details-box">
                    <h4 class="section-header">Diversification Analysis</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="metric-row">
                            <span class="metric-label">Herfindahl Index</span>
                            <span class="metric-value ${(diversification.herfindahl_index || 0) > 0.25 ? 'negative' : 'positive'}">${window.analyticsCore.formatNumber(diversification.herfindahl_index || 0)}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Effective Number of Sectors</span>
                            <span class="metric-value ${(diversification.effective_number_sectors || 0) > 5 ? 'positive' : 'neutral'}">${window.analyticsCore.formatNumber(diversification.effective_number_sectors || 0)}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Sector Concentration</span>
                            <span class="metric-value ${(diversification.sector_concentration || 0) > 0.5 ? 'negative' : 'positive'}">${window.analyticsCore.formatPercent(diversification.sector_concentration || 0)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Analysis Parameters -->
                <div class="details-box">
                    <h4 class="section-header">Analysis Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div><span class="detail-label">Classification:</span> <span class="detail-value">${currentClassification}</span></div>
                        <div><span class="detail-label">View:</span> <span class="detail-value" data-param="view">${currentView === 'pie' ? 'Pie Chart' : currentView === 'bar' ? 'Bar Chart' : currentView === 'treemap' ? 'Treemap' : 'Pie Chart'}</span></div>
                        <div><span class="detail-label">Currency:</span> <span class="detail-value">${currentCurrency}</span></div>
                        <div><span class="detail-label">Benchmark:</span> <span class="detail-value">${currentBenchmark}</span></div>
                        <div><span class="detail-label">Period:</span> <span class="detail-value">${currentPeriod}</span></div>
                    </div>
                </div>
            </div>
        `;

        // Initialize sector charts if module is available
        setTimeout(() => {
            if (window.sectorCharts && Object.keys(sectorData).length > 0) {
                console.log('Initializing sector charts with data:', sectorData);
                window.sectorCharts.currentData = { sector_allocation: sectorData };
                window.sectorCharts.currentView = 'pie'; // Set default view
                window.sectorCharts.renderChart();
            } else {
                console.log('Sector charts not available or no data');
            }
        }, 200);
    }

    displayStatisticalAnalysis(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const analysis = result.statistical_analysis || result.analysis || {};
        const portfolioStats = analysis.parameters || {};
        const riskMetrics = analysis.risk_metrics || {};
        const performanceMetrics = analysis.performance_metrics || {};
        const correlationAnalysis = analysis.correlation_analysis || {};

        // Get current settings
        const currentLookback = options?.lookback_period || 252;
        const currentFrequency = options?.frequency || 'daily';
        const currentBenchmark = options?.benchmark || 'SPY';
        const currentConfidence = options?.confidence_level || 0.95;

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Statistical Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleStatisticalSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="updateStatisticalAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Statistical Analysis Settings Panel -->
            <div id="statisticalSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Lookback Period</label>
                        <select id="statisticalLookback" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStatisticalAnalysis()">
                            <option value="63" ${currentLookback == 63 ? 'selected' : ''}>3 Months</option>
                            <option value="126" ${currentLookback == 126 ? 'selected' : ''}>6 Months</option>
                            <option value="252" ${currentLookback == 252 ? 'selected' : ''}>1 Year</option>
                            <option value="504" ${currentLookback == 504 ? 'selected' : ''}>2 Years</option>
                            <option value="756" ${currentLookback == 756 ? 'selected' : ''}>3 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                        <select id="statisticalFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStatisticalAnalysis()">
                            <option value="daily" ${currentFrequency === 'daily' ? 'selected' : ''}>Daily</option>
                            <option value="weekly" ${currentFrequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="monthly" ${currentFrequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                        <select id="statisticalBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStatisticalAnalysis()">
                            <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>NASDAQ 100 (QQQ)</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                            <option value="VTI" ${currentBenchmark === 'VTI' ? 'selected' : ''}>Total Stock Market (VTI)</option>
                            <option value="EFA" ${currentBenchmark === 'EFA' ? 'selected' : ''}>International Developed (EFA)</option>
                            <option value="EEM" ${currentBenchmark === 'EEM' ? 'selected' : ''}>Emerging Markets (EEM)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Confidence Level</label>
                        <select id="statisticalConfidence" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStatisticalAnalysis()">
                            <option value="0.90" ${currentConfidence === 0.90 ? 'selected' : ''}>90%</option>
                            <option value="0.95" ${currentConfidence === 0.95 ? 'selected' : ''}>95%</option>
                            <option value="0.99" ${currentConfidence === 0.99 ? 'selected' : ''}>99%</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="space-y-6">
                <!-- Portfolio Statistics -->
                <div class="details-box">
                    <h4 class="section-header">Portfolio Statistics</h4>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="metric-row">
                            <span class="metric-label">Total Symbols</span>
                            <span class="metric-value ${Math.max(Object.keys(riskMetrics).length, Object.keys(performanceMetrics).length) === 0 ? 'negative' : 'neutral'}">${Math.max(Object.keys(riskMetrics).length, Object.keys(performanceMetrics).length) || 'Insufficient Data'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Data Points</span>
                            <span class="metric-value neutral">${Math.round(portfolioStats.data_points) || 'N/A'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Period</span>
                            <span class="metric-value neutral">${portfolioStats.converted_period || portfolioStats.lookback_period || (currentLookback + ' days')}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Frequency</span>
                            <span class="metric-value neutral">${portfolioStats.frequency || currentFrequency}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Risk Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-3">
                        <h4 class="section-header">Risk Metrics</h4>
                        ${Object.keys(riskMetrics).length > 0 ? (() => {
                const firstSymbol = Object.keys(riskMetrics)[0];
                const metrics = riskMetrics[firstSymbol];
                return `
                                <div class="metric-row">
                                    <span class="metric-label">Volatility (${firstSymbol})</span>
                                    <span class="metric-value ${(metrics.volatility || 0) > 0.3 ? 'negative' : 'neutral'}">${metrics.volatility ? window.analyticsCore.formatPercent(metrics.volatility) : 'N/A'}</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">VaR (${(currentConfidence * 100).toFixed(0)}%)</span>
                                    <span class="metric-value negative">${metrics.var ? window.analyticsCore.formatPercent(Math.abs(metrics.var)) : 'N/A'}</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">CVaR (${(currentConfidence * 100).toFixed(0)}%)</span>
                                    <span class="metric-value negative">${metrics.cvar ? window.analyticsCore.formatPercent(Math.abs(metrics.cvar)) : 'N/A'}</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Max Drawdown</span>
                                    <span class="metric-value negative">${metrics.max_drawdown ? window.analyticsCore.formatPercent(Math.abs(metrics.max_drawdown)) : 'N/A'}</span>
                                </div>
                            `;
            })() : `
                            <div class="metric-row">
                                <span class="metric-label">Volatility</span>
                                <span class="metric-value neutral">N/A</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">VaR (${(currentConfidence * 100).toFixed(0)}%)</span>
                                <span class="metric-value negative">N/A</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">CVaR (${(currentConfidence * 100).toFixed(0)}%)</span>
                                <span class="metric-value negative">N/A</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">Max Drawdown</span>
                                <span class="metric-value negative">N/A</span>
                            </div>
                        `}
                    </div>
                    
                    <div class="space-y-3">
                        <h4 class="section-header">Performance Metrics</h4>
                        ${Object.keys(performanceMetrics).length > 0 ? (() => {
                const firstSymbol = Object.keys(performanceMetrics)[0];
                const metrics = performanceMetrics[firstSymbol];
                // Get Sharpe ratio from risk metrics if not in performance metrics
                const sharpeRatio = metrics.sharpe_ratio || (riskMetrics[firstSymbol] && riskMetrics[firstSymbol].sharpe_ratio);
                return `
                                <div class="metric-row">
                                    <span class="metric-label">Sharpe Ratio (${firstSymbol})</span>
                                    <span class="metric-value ${(sharpeRatio || 0) > 1 ? 'positive' : (sharpeRatio || 0) > 0 ? 'neutral' : 'negative'}">${sharpeRatio !== null && sharpeRatio !== undefined && !isNaN(sharpeRatio) ? window.analyticsCore.formatNumber(sharpeRatio) : 'N/A'}</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Beta (vs ${currentBenchmark})</span>
                                    <span class="metric-value ${(metrics.beta || 0) > 1.2 ? 'negative' : (metrics.beta || 0) < 0.8 ? 'positive' : 'neutral'}">${metrics.beta !== null && metrics.beta !== undefined ? window.analyticsCore.formatNumber(metrics.beta) : 'N/A'}</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">Alpha</span>
                                    <span class="metric-value ${(metrics.alpha || 0) > 0 ? 'positive' : 'negative'}">${metrics.alpha !== null && metrics.alpha !== undefined ? window.analyticsCore.formatPercent(metrics.alpha) : 'N/A'}</span>
                                </div>
                                <div class="metric-row">
                                    <span class="metric-label">R-Squared</span>
                                    <span class="metric-value neutral">${metrics.r_squared !== null && metrics.r_squared !== undefined ? window.analyticsCore.formatPercent(metrics.r_squared) : 'N/A'}</span>
                                </div>
                            `;
            })() : `
                            <div class="metric-row">
                                <span class="metric-label">Sharpe Ratio</span>
                                <span class="metric-value neutral">N/A</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">Beta (vs ${currentBenchmark})</span>
                                <span class="metric-value neutral">N/A</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">Alpha</span>
                                <span class="metric-value neutral">N/A</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">R-Squared</span>
                                <span class="metric-value neutral">N/A</span>
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- Analysis Summary -->
                <div class="details-box">
                    <h4 class="section-header">Analysis Summary</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span class="detail-label">Lookback:</span> <span class="detail-value">${currentLookback} days</span></div>
                        <div><span class="detail-label">Frequency:</span> <span class="detail-value">${currentFrequency}</span></div>
                        <div><span class="detail-label">Benchmark:</span> <span class="detail-value">${currentBenchmark}</span></div>
                        <div><span class="detail-label">Confidence:</span> <span class="detail-value">${(currentConfidence * 100).toFixed(0)}%</span></div>
                    </div>
                    ${(portfolioStats.data_points && portfolioStats.data_points < 10) ? `
                        <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div class="flex items-center">
                                <svg class="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                </svg>
                                <div>
                                    <p class="text-sm font-medium text-yellow-800">Insufficient Data Warning</p>
                                    <p class="text-xs text-yellow-700 mt-1">Only ${Math.round(portfolioStats.data_points)} data points available. Consider using a longer lookback period or higher frequency (daily) for more reliable analysis.</p>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }



    displayTechnicalIndicators(result, options) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const analysis = result.technical_analysis || {};
        const parameters = analysis.parameters || {};
        const individualAnalysis = analysis.individual_analysis || {};
        const portfolioSignals = analysis.portfolio_signals || {};
        const summary = analysis.summary || {};

        // Get current settings
        const currentPeriod = options?.period || parameters.period || '6M';
        const currentTimeframe = options?.timeframe || parameters.timeframe || 'Daily';
        const currentIndicators = options?.indicators || parameters.indicators || ['RSI', 'MACD', 'Bollinger', 'SMA', 'EMA'];
        const currentRsiPeriod = options?.rsi_period || parameters.rsi_parameters?.period || 14;
        const currentRsiOversold = options?.rsi_oversold || parameters.rsi_parameters?.oversold || 30;
        const currentRsiOverbought = options?.rsi_overbought || parameters.rsi_parameters?.overbought || 70;
        const currentMacdFast = options?.macd_fast || parameters.macd_parameters?.fast || 12;
        const currentMacdSlow = options?.macd_slow || parameters.macd_parameters?.slow || 26;
        const currentMacdSignal = options?.macd_signal || parameters.macd_parameters?.signal || 9;
        const currentBbPeriod = options?.bb_period || parameters.bollinger_parameters?.period || 20;
        const currentBbStd = options?.bb_std || parameters.bollinger_parameters?.std_dev || 2;
        const currentSignalStrength = options?.signal_strength || parameters.signal_strength || 'Medium';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Technical Analysis</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleTechnicalSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="updateTechnicalAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Technical Settings Panel -->
            <div id="technicalSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                        <select id="technicalPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalAnalysis()">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
                        <select id="technicalTimeframe" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalAnalysis()">
                            <option value="Daily" ${currentTimeframe === 'Daily' ? 'selected' : ''}>Daily</option>
                            <option value="Weekly" ${currentTimeframe === 'Weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="Monthly" ${currentTimeframe === 'Monthly' ? 'selected' : ''}>Monthly</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">RSI Period</label>
                        <select id="technicalRsiPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalAnalysis()">
                            <option value="14" ${currentRsiPeriod == 14 ? 'selected' : ''}>14</option>
                            <option value="21" ${currentRsiPeriod == 21 ? 'selected' : ''}>21</option>
                            <option value="30" ${currentRsiPeriod == 30 ? 'selected' : ''}>30</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Signal Strength</label>
                        <select id="technicalSignalStrength" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalAnalysis()">
                            <option value="Weak" ${currentSignalStrength === 'Weak' ? 'selected' : ''}>Weak</option>
                            <option value="Medium" ${currentSignalStrength === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="Strong" ${currentSignalStrength === 'Strong' ? 'selected' : ''}>Strong</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">RSI Oversold</label>
                        <input type="number" id="technicalRsiOversold" value="${currentRsiOversold}" min="10" max="40" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalAnalysis()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">RSI Overbought</label>
                        <input type="number" id="technicalRsiOverbought" value="${currentRsiOverbought}" min="60" max="90" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalAnalysis()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">MACD Fast</label>
                        <input type="number" id="technicalMacdFast" value="${currentMacdFast}" min="5" max="20" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalAnalysis()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">MACD Slow</label>
                        <input type="number" id="technicalMacdSlow" value="${currentMacdSlow}" min="20" max="40" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalAnalysis()">
                    </div>
                </div>
            </div>
            
            <div class="space-y-6">
                <!-- Portfolio Summary -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="details-box">
                        <h4 class="section-header">Overall Signal</h4>
                        <p class="text-2xl font-bold metric-value ${portfolioSignals.overall === 'Bullish' ? 'positive' : portfolioSignals.overall === 'Bearish' ? 'negative' : 'neutral'}">${portfolioSignals.overall || 'Neutral'}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Symbols Analyzed</h4>
                        <p class="text-2xl font-bold metric-value neutral">${summary.symbols_analyzed || Object.keys(individualAnalysis).length}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Data Points</h4>
                        <p class="text-2xl font-bold metric-value neutral">${summary.data_points || 'N/A'}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Timeframe</h4>
                        <p class="text-2xl font-bold metric-value neutral">${summary.timeframe || currentTimeframe}</p>
                    </div>
                </div>
                
                <!-- Portfolio Signals -->
                ${portfolioSignals.bullish_weight !== undefined ? `
                    <div class="details-box">
                        <h4 class="section-header">Portfolio Signal Distribution</h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="metric-row">
                                <span class="metric-label">Bullish Weight</span>
                                <span class="metric-value positive">${window.analyticsCore.formatPercent(portfolioSignals.bullish_weight)}</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">Bearish Weight</span>
                                <span class="metric-value negative">${window.analyticsCore.formatPercent(portfolioSignals.bearish_weight)}</span>
                            </div>
                            <div class="metric-row">
                                <span class="metric-label">Neutral Weight</span>
                                <span class="metric-value neutral">${window.analyticsCore.formatPercent(portfolioSignals.neutral_weight)}</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Individual Analysis -->
                ${Object.keys(individualAnalysis).length > 0 ? `
                    <div class="details-box">
                        <h4 class="section-header">Individual Symbol Analysis</h4>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overall Signal</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signal Strength</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">RSI</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MACD</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bollinger</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SMA</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">EMA</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    ${Object.entries(individualAnalysis).map(([symbol, analysis]) => `
                                        <tr>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${symbol}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm ${analysis.overall_signal === 'Bullish' ? 'text-green-600' :
                analysis.overall_signal === 'Bearish' ? 'text-red-600' : 'text-gray-500'
            }">${analysis.overall_signal || 'Neutral'}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${analysis.signal_strength || 'N/A'}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm ${analysis.signals?.rsi?.includes('Bullish') ? 'text-green-600' :
                analysis.signals?.rsi?.includes('Bearish') ? 'text-red-600' : 'text-gray-500'
            }">${analysis.signals?.rsi || 'N/A'}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm ${analysis.signals?.macd === 'Bullish' ? 'text-green-600' :
                analysis.signals?.macd === 'Bearish' ? 'text-red-600' : 'text-gray-500'
            }">${analysis.signals?.macd || 'N/A'}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm ${analysis.signals?.bollinger?.includes('Bullish') ? 'text-green-600' :
                analysis.signals?.bollinger?.includes('Bearish') ? 'text-red-600' : 'text-gray-500'
            }">${analysis.signals?.bollinger || 'N/A'}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm ${analysis.signals?.sma === 'Bullish' ? 'text-green-600' :
                analysis.signals?.sma === 'Bearish' ? 'text-red-600' : 'text-gray-500'
            }">${analysis.signals?.sma || 'N/A'}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm ${analysis.signals?.ema === 'Bullish' ? 'text-green-600' :
                analysis.signals?.ema === 'Bearish' ? 'text-red-600' : 'text-gray-500'
            }">${analysis.signals?.ema || 'N/A'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : '<p class="text-gray-500 text-center py-4">No technical analysis data available</p>'}
                
                <!-- Analysis Parameters -->
                <div class="details-box">
                    <h4 class="section-header">Analysis Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span class="detail-label">Period:</span> <span class="detail-value">${currentPeriod}</span></div>
                        <div><span class="detail-label">Timeframe:</span> <span class="detail-value">${currentTimeframe}</span></div>
                        <div><span class="detail-label">Indicators:</span> <span class="detail-value">${Array.isArray(currentIndicators) ? currentIndicators.join(', ') : currentIndicators}</span></div>
                        <div><span class="detail-label">Signal Strength:</span> <span class="detail-value">${currentSignalStrength}</span></div>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                        <div><span class="detail-label">RSI:</span> <span class="detail-value">${currentRsiPeriod} (${currentRsiOversold}/${currentRsiOverbought})</span></div>
                        <div><span class="detail-label">MACD:</span> <span class="detail-value">(${currentMacdFast},${currentMacdSlow},${currentMacdSignal})</span></div>
                        <div><span class="detail-label">Bollinger:</span> <span class="detail-value">${currentBbPeriod}, ${currentBbStd}σ</span></div>
                        <div><span class="detail-label">Data Points:</span> <span class="detail-value">${summary.data_points || 'N/A'}</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    // Add missing display functions as class methods
    // displayPnLAttribution removed to prevent conflict with specialized module
    displayPnLAttribution(result, options) {
        // No-op: Handled by pnl-attribution.js
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
            container.innerHTML = `<div class="text-center py-4">Trade performance data received but display function not available</div>`;
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
                <div class="text-center py-8">
                    <div class="text-gray-400 mb-4">
                        <svg class="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">Turnover Analysis Module Not Available</h3>
                    <p class="text-gray-600">The turnover analysis module could not be loaded.</p>
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

    displayDrawdownAnalysis(result, options) {
        console.log('Drawdown Analysis result:', result);
    }

    displayReturnAttribution(result, options) {
        console.log('Return Attribution result:', result);
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
                    <button onclick="toggleBacktestingSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="updateStrategyBacktesting()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
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
            
            <!-- Backtesting Settings Panel -->
            <div id="backtestingSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Backtest Period</label>
                        <select id="backtestPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStrategyBacktesting()">
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentPeriod === '2Y' ? 'selected' : ''}>2 Years</option>
                            <option value="3Y" ${currentPeriod === '3Y' ? 'selected' : ''}>3 Years</option>
                            <option value="5Y" ${currentPeriod === '5Y' ? 'selected' : ''}>5 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Rebalancing</label>
                        <select id="backtestRebalancing" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStrategyBacktesting()">
                            <option value="Monthly" ${currentRebalancing === 'Monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="Quarterly" ${currentRebalancing === 'Quarterly' ? 'selected' : ''}>Quarterly</option>
                            <option value="Semi-annual" ${currentRebalancing === 'Semi-annual' ? 'selected' : ''}>Semi-annual</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Transaction Costs</label>
                        <select id="backtestTransactionCosts" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStrategyBacktesting()">
                            <option value="0" ${currentTransactionCosts === '0%' ? 'selected' : ''}>0%</option>
                            <option value="0.1" ${currentTransactionCosts === '0.1%' ? 'selected' : ''}>0.1%</option>
                            <option value="0.25" ${currentTransactionCosts === '0.25%' ? 'selected' : ''}>0.25%</option>
                            <option value="0.5" ${currentTransactionCosts === '0.5%' ? 'selected' : ''}>0.5%</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                        <select id="backtestBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStrategyBacktesting()">
                            <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>NASDAQ 100 (QQQ)</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                            <option value="VTI" ${currentBenchmark === 'VTI' ? 'selected' : ''}>Total Stock Market (VTI)</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="space-y-6">
                <!-- Performance Summary -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="details-box">
                        <h4 class="section-header">Total Return</h4>
                        <p class="text-2xl font-bold metric-value ${(performance.total_return || 0) > 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(performance.total_return || 0)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Annual Return</h4>
                        <p class="text-2xl font-bold metric-value ${(performance.annualized_return || 0) > 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(performance.annualized_return || 0)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Volatility</h4>
                        <p class="text-2xl font-bold metric-value neutral">${window.analyticsCore.formatPercent(performance.volatility || 0)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Win Rate</h4>
                        <p class="text-2xl font-bold metric-value ${window.analyticsManager.calculateWinRate(backtest) > 50 ? 'positive' : 'negative'}">${window.analyticsManager.calculateWinRate(backtest)}%</p>
                    </div>
                </div>
                
                <!-- Risk Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-3">
                        <h4 class="section-header">Risk Metrics</h4>
                        <div class="metric-row">
                            <span class="metric-label">Sharpe Ratio</span>
                            <span class="metric-value ${(performance.sharpe_ratio || 0) > 1 ? 'positive' : 'neutral'}">${window.analyticsCore.formatNumber(performance.sharpe_ratio || 0)}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Max Drawdown</span>
                            <span class="metric-value negative">${window.analyticsCore.formatPercent(Math.abs(risk.max_drawdown || 0))}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Calmar Ratio</span>
                            <span class="metric-value ${(risk.calmar_ratio || 0) > 1 ? 'positive' : 'neutral'}">${window.analyticsCore.formatNumber(risk.calmar_ratio || 0)}</span>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <h4 class="section-header">Benchmark Comparison</h4>
                        <div class="metric-row">
                            <span class="metric-label">Benchmark Return</span>
                            <span class="metric-value neutral">${window.analyticsCore.formatPercent(performance.benchmark_return || 0)}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Excess Return</span>
                            <span class="metric-value ${(performance.excess_return || 0) > 0 ? 'positive' : 'negative'}">${window.analyticsCore.formatPercent(performance.excess_return || 0)}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Beta</span>
                            <span class="metric-value neutral">${window.analyticsCore.formatNumber(performance.beta || 0)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Backtest Parameters -->
                <div class="details-box">
                    <h4 class="section-header">Backtest Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span class="detail-label">Period:</span> <span class="detail-value">${currentPeriod}</span></div>
                        <div><span class="detail-label">Rebalancing:</span> <span class="detail-value">${currentRebalancing}</span></div>
                        <div><span class="detail-label">Transaction Costs:</span> <span class="detail-value">${currentTransactionCosts}</span></div>
                        <div><span class="detail-label">Data Points:</span> <span class="detail-value">${summary.total_periods || 'N/A'}</span></div>
                    </div>
                </div>
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

        container.classList.remove('hidden');
        const correlation = result.correlation_matrix || {};
        const summary = result.summary || {};

        console.log('[CORRELATION DISPLAY] Received result:', { summary, options });

        // Get current settings from options or summary
        const currentPeriod = options?.period || summary.period || '1Y';
        const currentFrequency = options?.frequency || summary.frequency || 'Daily';
        const currentMethod = options?.method || summary.method || 'pearson';
        const currentRollingWindow = options?.rolling_window || summary.rolling_window || '30d';

        console.log('[CORRELATION DISPLAY] Using settings:', { currentPeriod, currentFrequency, currentMethod, currentRollingWindow });

        // Get symbols for matrix display
        const symbols = Object.keys(correlation);

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
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Correlation Settings Panel -->
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
            
            <div class="space-y-6">
                <!-- Summary Statistics -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="details-box">
                        <h4 class="section-header">Average Correlation</h4>
                        <p class="text-2xl font-bold metric-value ${(summary.average_correlation || 0) > 0.7 ? 'negative' : (summary.average_correlation || 0) > 0.3 ? 'neutral' : 'positive'}" title="Period: ${currentPeriod}, Method: ${currentMethod}">${window.analyticsCore.formatNumber(summary.average_correlation || 0)}</p>
                        <p class="text-xs text-gray-500 mt-1">${currentMethod} • ${currentPeriod} • ${summary.data_points || 0} pts</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Max Correlation</h4>
                        <p class="text-2xl font-bold metric-value ${(summary.max_correlation || 0) > 0.8 ? 'negative' : 'neutral'}">${window.analyticsCore.formatNumber(summary.max_correlation || 0)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Min Correlation</h4>
                        <p class="text-2xl font-bold metric-value ${(summary.min_correlation || 0) < -0.3 ? 'positive' : 'neutral'}">${window.analyticsCore.formatNumber(summary.min_correlation || 0)}</p>
                    </div>
                    <div class="details-box">
                        <h4 class="section-header">Symbols Analyzed</h4>
                        <p class="text-2xl font-bold metric-value neutral">${summary.symbols_analyzed || symbols.length}</p>
                    </div>
                </div>
                
                <!-- Correlation Matrix -->
                ${symbols.length > 0 ? `
                    <div class="details-box">
                        <h4 class="section-header">Correlation Matrix</h4>
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
            return `<td class="px-4 py-2 whitespace-nowrap text-sm text-center ${colorClass}">${window.analyticsCore.formatNumber(corrValue)}</td>`;
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
                ` : '<p class="text-gray-500 text-center py-4">No correlation data available</p>'}
                
                <!-- Analysis Parameters -->
                <div class="details-box">
                    <h4 class="section-header">Analysis Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span class="detail-label">Period:</span> <span class="detail-value">${currentPeriod}</span></div>
                        <div><span class="detail-label">Frequency:</span> <span class="detail-value">${currentFrequency}</span></div>
                        <div><span class="detail-label">Method:</span> <span class="detail-value">${currentMethod}</span></div>
                        <div><span class="detail-label">Rolling Window:</span> <span class="detail-value">${currentRollingWindow}</span></div>
                    </div>
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
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Market News & Insights</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="window.analyticsManager.loadModule('market-news')" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh News
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p class="text-gray-600">Loading latest market news...</p>
            </div>
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
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">Market News & Insights</h2>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
                <div class="text-center text-red-600 py-4">
                    <p class="font-semibold">Failed to load market news</p>
                    <p class="text-sm mt-2">Please check your internet connection and try again.</p>
                </div>
            `;
        }
    }

    // Scan options method for compatibility with refactored app
    async scanOptions(symbols) {
        try {
            console.log(`[ANALYTICS MANAGER] scanOptions called with ${symbols.length} symbols:`, symbols);

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
            console.log(`[ANALYTICS MANAGER] scanOptions response:`, data);

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

    // Display market news
    displayMarketNews(result) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const articles = result.articles || [];

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Market News & Insights</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="window.analyticsManager.loadModule('market-news')" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh News
                    </button>
                    <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${articles.map(article => `
                    <div class="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
                        <div class="flex justify-between items-start mb-3">
                            <span class="text-sm font-medium text-indigo-600">${article.source?.name || 'Market News'}</span>
                            <span class="text-xs text-gray-500">${new Date(article.publishedAt).toLocaleDateString()}</span>
                        </div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3 line-clamp-2">${article.title}</h3>
                        <p class="text-gray-600 text-sm mb-4 line-clamp-3">${article.description}</p>
                        ${article.url && article.url !== '#' ? `
                            <a href="${article.url}" target="_blank" class="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                                Read More
                                <svg class="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                </svg>
                            </a>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            
            ${articles.length === 0 ? `
                <div class="text-center py-8">
                    <div class="text-gray-400 mb-4">
                        <svg class="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No News Available</h3>
                    <p class="text-gray-600">Unable to load market news at this time. Please try again later.</p>
                </div>
            ` : ''}
        `;
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

    console.log(`[OPTIONS FILTER] Symbol filter: ${symbolFilter}, Total opportunities: ${opportunities.length}`);

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

    window.analyticsCore.performanceSettings = {
        period,
        attribution_model: model,
        benchmark,
        currency,
        frequency
    };

    window.analyticsManager.loadModule('performance-attribution');
};

window.updateRiskAnalysis = () => {
    // Get settings values from form - no fallbacks
    const period = document.getElementById('riskPeriod')?.value;
    const varConfidence = parseFloat(document.getElementById('riskVarConfidence')?.value);
    const riskModel = document.getElementById('riskModel')?.value;
    const benchmark = document.getElementById('riskBenchmark')?.value;
    const rollingWindow = parseInt(document.getElementById('riskRollingWindow')?.value);

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

    window.analyticsCore.optionsSettings = {
        expiration,
        moneyness,
        min_premium: minPremium,
        delta_range: deltaRange
    };

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
    const objective = document.getElementById('optimizationObjective')?.value;
    const constraint = document.getElementById('optimizationConstraint')?.value;
    const rebalancing = document.getElementById('optimizationRebalancing')?.value;
    const riskBudget = document.getElementById('optimizationRiskBudget')?.value;
    const lookback = document.getElementById('optimizationLookback')?.value;

    if (!objective || !constraint || !rebalancing || !riskBudget || !lookback) {
        console.error('Missing required optimization settings');
        return;
    }

    window.analyticsCore.optimizationSettings = {
        objective,
        constraint,
        rebalancing,
        risk_budget: riskBudget,
        lookback_period: lookback
    };

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
        <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4">
            <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 class="text-lg font-semibold text-gray-900">Statistical Analysis Settings</h3>
                <button onclick="closeStatisticalSettingsModal()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Lookback Period</label>
                        <select id="lookbackPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="63">3 Months</option>
                            <option value="126">6 Months</option>
                            <option value="252" selected>1 Year</option>
                            <option value="504">2 Years</option>
                            <option value="756">3 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                        <select id="frequency" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="daily" selected>Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Benchmark</label>
                        <select id="benchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="SPY" selected>S&P 500 (SPY)</option>
                            <option value="QQQ">NASDAQ 100 (QQQ)</option>
                            <option value="IWM">Russell 2000 (IWM)</option>
                            <option value="VTI">Total Stock Market (VTI)</option>
                            <option value="EFA">International Developed (EFA)</option>
                            <option value="EEM">Emerging Markets (EEM)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Confidence Level</label>
                        <select id="confidenceLevel" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="0.90">90%</option>
                            <option value="0.95" selected>95%</option>
                            <option value="0.99">99%</option>
                        </select>
                    </div>
                </div>
                <div class="mt-6 flex justify-end space-x-3">
                    <button onclick="closeStatisticalSettingsModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">
                        Cancel
                    </button>
                    <button onclick="runStatisticalAnalysisWithSettings()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        Run Analysis
                    </button>
                </div>
            </div>
        </div>
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
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Statistical Analysis</h2>
                <div class="text-gray-400">Updating...</div>
            </div>
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p class="text-gray-600">Recalculating with new parameters...</p>
                <p class="text-sm text-gray-500 mt-2">Lookback: ${lookback} days, Frequency: ${frequency}, Benchmark: ${benchmark}</p>
            </div>
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
                    <div class="text-center py-8 text-red-600">
                        <p class="font-semibold">Analysis Failed</p>
                        <p class="text-sm mt-2">${data.error || 'Unknown error'}</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('[STATISTICAL UPDATE] Error:', error);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-red-600">
                    <p class="font-semibold">Request Failed</p>
                    <p class="text-sm mt-2">${error.message}</p>
                </div>
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
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Technical Analysis</h2>
                <div class="text-gray-400">Updating...</div>
            </div>
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p class="text-gray-600">Calculating technical indicators...</p>
                <p class="text-sm text-gray-500 mt-2">Period: ${period}, Timeframe: ${timeframe}</p>
            </div>
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
                    <div class="text-center py-8 text-red-600">
                        <p class="font-semibold">Analysis Failed</p>
                        <p class="text-sm mt-2">${data.error || 'Unknown error'}</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('[TECHNICAL UPDATE] Error:', error);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-red-600">
                    <p class="font-semibold">Request Failed</p>
                    <p class="text-sm mt-2">${error.message}</p>
                </div>
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
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Strategy Backtesting</h2>
                <div class="text-gray-400">Running backtest...</div>
            </div>
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p class="text-gray-600">Running strategy backtest...</p>
                <p class="text-sm text-gray-500 mt-2">Period: ${period}, Rebalancing: ${rebalancing}, Costs: ${transactionCosts}%</p>
            </div>
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
                    <div class="text-center py-8 text-red-600">
                        <p class="font-semibold">Backtesting Failed</p>
                        <p class="text-sm mt-2">${data.error || 'Unknown error'}</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('[BACKTESTING] Error:', error);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-red-600">
                    <p class="font-semibold">Request Failed</p>
                    <p class="text-sm mt-2">${error.message}</p>
                </div>
            `;
        }
    }
};

