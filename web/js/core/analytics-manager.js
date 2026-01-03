// Simplified Analytics Manager - Replaces complex integration files
const API_BASE_URL = window.API_BASE || 'http://127.0.0.1:8080';
const DEFAULT_CONTAINER_ID = 'analysisContent';

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
            containerId: 'optionsResults',
            settingsId: 'optionsSettings',
            displayFunction: this.displayOptionsStrategies.bind(this),
            type: 'portfolio'
        });

        this.register('monte-carlo', {
            endpoint: 'monte-carlo',
            containerId: null, // Use default container
            settingsId: 'monteCarloSettings',
            displayFunction: this.displayMonteCarloResults.bind(this),
            type: 'portfolio'
        });

        this.register('portfolio-optimization', {
            endpoint: 'portfolio-optimization',
            containerId: 'portfolioOptimization',
            settingsId: 'optimizationSettings',
            displayFunction: this.displayPortfolioOptimization.bind(this),
            type: 'portfolio'
        });

        this.register('correlation-analysis', {
            endpoint: 'correlation-analysis',
            containerId: null, // Use default container
            settingsId: 'correlationSettings',
            displayFunction: window.displayCorrelationAnalysisResults,
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
            displayFunction: window.displayStatisticalAnalysisResults,
            type: 'portfolio'
        });

        this.register('technical-indicators', {
            endpoint: 'technical-analysis',
            containerId: 'enhancedTechnicalAnalysis',
            settingsId: 'technicalSettings',
            displayFunction: this.displayTechnicalIndicators.bind(this),
            type: 'portfolio'
        });

        this.register('strategy-backtesting', {
            endpoint: 'strategy-backtesting',
            containerId: 'strategyBacktesting',
            settingsId: 'backtestSettings',
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

        this.register('risk-metrics', {
            endpoint: 'analyze-risk',
            containerId: 'riskResults',
            settingsId: 'riskSettings', // Updated to enable settings collection
            displayFunction: this.displayRiskMetrics.bind(this),
            type: 'portfolio'
        });

        this.register('cash-flow', {
            endpoint: 'cash-flow-analysis',
            containerId: 'cashFlowAnalysis',
            settingsId: 'cashFlowSettings',
            displayFunction: window.displayCashFlowAnalysis,
            type: 'transaction'
        });

        this.register('accounting-analysis', {
            endpoint: 'accounting-analysis',
            containerId: 'accountingAnalysis',
            settingsId: 'accountingSettings',
            displayFunction: window.displayAccountingAnalysis,
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

        // Register new unified XIRR Analysis
        this.register('xirr-analysis', {
            endpoint: 'transaction-xirr', // Reuses the enhanced transaction endpoint
            containerId: 'xirrAnalysis',
            settingsId: 'xirrSettings',
            displayFunction: (result, options) => window.fetchXirrAnalysis('xirrAnalysis', options, result),
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
    async loadModule(name, options = {}) {
        console.log(`Loading module: ${name}`);

        // Only hide upload and preview sections if this is a foreground request
        if (!options.background) {
            const uploadSection = document.getElementById('defaultUploadSection');
            if (uploadSection) uploadSection.classList.add('hidden');

            const previewSection = document.getElementById('dataPreview');
            if (previewSection) previewSection.classList.add('hidden');
        }



        const originalModule = this.modules.get(name);
        if (!originalModule) {
            console.error(`Module ${name} not found`);
            return;
        }

        // Clone module config to allow local overrides for this call
        const module = { ...originalModule };

        // For background requests, use a no-op display function to prevent rendering
        if (options.background) {
            module.displayFunction = (data) => console.log(`[Background] ${name} data fetched and cached`);
        }

        // Pass stored settings as options for return-attribution
        if (name === 'return-attribution' && window.analyticsCore?.returnAttributionSettings) {
            await window.analyticsCore.analyzeTransactions(
                module.endpoint,
                module.containerId,
                module.displayFunction,
                module.settingsId,
                { ...window.analyticsCore.returnAttributionSettings, ...options }
            );
            return;
        }

        // Special handling for P&L Attribution to use its own dedicated handler
        // This ensures the enhanced filters and controls are rendered correctly
        if (name === 'pnl-attribution' && window.loadPnlAttribution) {
            console.log('Delegating to loadPnlAttribution');
            // Ensure container is visible
            const container = document.getElementById(DEFAULT_CONTAINER_ID);

            // Only unhide container if NOT background
            if (container && !options.background) {
                container.classList.remove('hidden');
            }

            // Use the P&L container ID defined in registration or default
            const containerId = module ? module.containerId : 'pnlAttribution';
            let pnlContainer = document.getElementById(containerId);

            // Self-healing: Create container if it was deleted from DOM
            if (!pnlContainer) {
                console.log('Restoring missing pnl-attribution container');
                pnlContainer = document.createElement('div');
                pnlContainer.id = containerId;
                pnlContainer.className = 'bg-white rounded-xl shadow-lg p-6 mb-8'; // Add default styling
            }

            if (pnlContainer) {
                // Clear any previous content/spinner from AnalyticsManager
                if (container && container !== pnlContainer) {
                    // Check if pnlContainer is already in container to avoid moving it unnecessarily
                    if (!container.contains(pnlContainer) || container.children.length > 1) {
                        container.innerHTML = '';
                        container.appendChild(pnlContainer);
                    }
                }
                if (!options.background) {
                    pnlContainer.classList.remove('hidden');
                }
            }

            // Check for transaction data
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for pnl attribution');
                if (container && pnlContainer && !options.background) {
                    pnlContainer.innerHTML = `
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">P&L Attribution</h2>
                        </div>
                        <div class="text-center py-4 text-yellow-500">No transactions available for P&L attribution analysis</div>
                    `;
                }
                return;
            }

            window.loadPnlAttribution(transactions, options);
            return;
        }





        // Special handling for Turnover Analysis to use its own dedicated handler
        if (name === 'turnover-analysis' && window.loadTurnoverAnalysis) {
            console.log('Delegating to loadTurnoverAnalysis');
            // Ensure container is visible
            const container = document.getElementById(DEFAULT_CONTAINER_ID);
            if (container && !options.background) {
                container.classList.remove('hidden');
            }

            // Use the Turnover container ID defined in registration or default
            const containerId = module ? module.containerId : 'turnoverAnalysis';
            let turnoverContainer = document.getElementById(containerId);

            // Self-healing: Create container if it was deleted from DOM
            if (!turnoverContainer) {
                console.log('Restoring missing turnover-analysis container');
                turnoverContainer = document.createElement('div');
                turnoverContainer.id = containerId;
                turnoverContainer.className = 'bg-white rounded-xl shadow-lg p-6 mb-8'; // Add default styling
            }

            if (turnoverContainer) {
                // Clear any previous content/spinner from AnalyticsManager
                if (container && container !== turnoverContainer) {
                    if (!container.contains(turnoverContainer) || container.children.length > 1) {
                        container.innerHTML = '';
                        container.appendChild(turnoverContainer);
                    }
                }
                if (!options.background) {
                    turnoverContainer.classList.remove('hidden');
                }
            }

            // Check for transaction data
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for turnover analysis');
                if (turnoverContainer && !options.background) {
                    turnoverContainer.innerHTML = `
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Turnover Analysis</h2>
                        </div>
                        <div class="text-center py-4 text-yellow-500">No transaction data available for turnover analysis</div>
                    `;
                }
                return;
            }

            window.loadTurnoverAnalysis(transactions, options);
            return;
        }

        // Special handling for Trade Performance to use its own dedicated handler
        if (name === 'trade-performance' && window.loadTradePerformance) {
            console.log('Delegating to loadTradePerformance');
            // Ensure container is visible
            const container = document.getElementById(DEFAULT_CONTAINER_ID);
            if (container && !options.background) container.classList.remove('hidden');

            // Use the Trade Performance container ID defined in registration or default
            const containerId = module ? module.containerId : 'tradePerformance';
            let tpContainer = document.getElementById(containerId);

            // Self-healing: Create container if it was deleted from DOM
            if (!tpContainer) {
                console.log('Restoring missing trade-performance container');
                tpContainer = document.createElement('div');
                tpContainer.id = containerId;
                tpContainer.className = 'bg-white rounded-xl shadow-lg p-6 mb-8'; // Add default styling
            }

            if (container) {
                // Check if we need to clear (only if the content isn't already just our container)
                if (container.firstElementChild !== tpContainer || container.children.length > 1) {
                    container.innerHTML = '';
                    container.appendChild(tpContainer);
                }
                if (!options.background) tpContainer.classList.remove('hidden');
            }

            // Check for transaction data
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for trade performance');
                if (container && !options.background) {
                    container.innerHTML = `
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Trade Performance</h2>
                        </div>
                        <div class="text-center py-4 text-yellow-500">No transaction data available for trade performance</div>
                    `;
                }
                return;
            }

            window.loadTradePerformance(transactions, options);
            return;
        }

        // Special handling for Cost Analysis to use its own dedicated handler
        if (name === 'cost-analysis' && window.loadCostAnalysis) {
            console.log('Delegating to loadCostAnalysis');

            // Ensure container is visible
            const container = document.getElementById(DEFAULT_CONTAINER_ID);
            if (container) {
                if (!options.background) {
                    container.classList.remove('hidden');
                    container.innerHTML = '';
                }
            }

            // Check for transaction data
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for cost analysis');
                const container = document.getElementById(DEFAULT_CONTAINER_ID);
                if (container && !options.background) {
                    container.classList.remove('hidden');
                    container.innerHTML = `
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Cost Analysis</h2>
                        </div>
                        <div class="text-center py-4 text-yellow-500">No transaction data available for cost analysis</div>
                    `;
                }
                return;
            }

            // Use the dedicated cost analysis handler directly
            window.loadCostAnalysis(transactions, options);
            return;
        }

        // Special handling for Unified XIRR Analysis
        if (name === 'xirr-analysis') {
            console.log('Delegating to unified XIRR Analysis');

            if (!options.background) {
                const container = document.getElementById(DEFAULT_CONTAINER_ID);
                if (container) container.classList.remove('hidden');

                const containerId = module ? module.containerId : 'xirrAnalysis';
                let xirrContainer = document.getElementById(containerId);

                if (!xirrContainer) {
                    xirrContainer = document.createElement('div');
                    xirrContainer.id = containerId;
                }

                if (container) {
                    if (container.firstElementChild !== xirrContainer || container.children.length > 1) {
                        container.innerHTML = '';
                        container.appendChild(xirrContainer);
                    }
                    xirrContainer.classList.remove('hidden');
                }
            }

            if (module && module.displayFunction) {
                module.displayFunction(null, options);
            }
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
                const container = document.getElementById(DEFAULT_CONTAINER_ID);
                if (container && !options.background) {
                    container.classList.remove('hidden');
                    container.innerHTML = `
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Tax Analysis</h2>
                        </div>
                        <div class="text-center py-4 text-yellow-500">No transaction data available for tax analysis</div>
                    `;
                }
                return;
            }

            // Call tax analysis with proper data - let it handle its own container
            console.log('Calling loadTaxAnalysis with', transactions.length, 'transactions');
            window.loadTaxAnalysis(transactions, options);
            return;
        }

        // Special handling for Cash Flow Analysis to use its own dedicated handler
        if (name === 'cash-flow' && window.loadCashFlowAnalysis) {
            console.log('✓ CASH FLOW: Delegating to loadCashFlowAnalysis');

            // Ensure container is visible
            const container = document.getElementById(DEFAULT_CONTAINER_ID);
            if (container && !options.background) container.classList.remove('hidden');

            // Use the Cash Flow container ID defined in registration or default
            const containerId = module ? module.containerId : 'cashFlowAnalysis';
            let cfContainer = document.getElementById(containerId);

            // Self-healing: Create container if it was deleted from DOM
            if (!cfContainer) {
                console.log('Restoring missing cash-flow container');
                cfContainer = document.createElement('div');
                cfContainer.id = containerId;
                cfContainer.className = 'bg-card rounded-xl shadow-lg p-6 mb-8'; // Add default styling
                // Don't append yet - we clean parent first
            }

            if (container) {
                // Check if we need to clear (only if the content isn't already just our container)
                // This prevents flickering if clicking the same tab
                if (container.firstElementChild !== cfContainer || container.children.length > 1) {
                    container.innerHTML = '';
                    container.appendChild(cfContainer);
                }
                if (!options.background) cfContainer.classList.remove('hidden');
            }

            // Check for transaction data first
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for cash flow analysis');
                const container = document.getElementById(DEFAULT_CONTAINER_ID);
                if (container && !options.background) {
                    container.classList.remove('hidden');
                    container.innerHTML = `
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Cash Flow Analysis</h2>
                        </div>
                        <div class="text-center py-4 text-yellow-500">No transaction data available for cash flow analysis</div>
                    `;
                }
                return;
            }

            // Call cash flow analysis with proper data - let it handle its own container
            console.log('✓ CASH FLOW: Calling loadCashFlowAnalysis with', transactions.length, 'transactions');
            window.loadCashFlowAnalysis(transactions, options);
            return;
        }

        // Special handling for Trade Timing Analysis to use its own dedicated handler
        if (name === 'trade-timing' && window.loadTradeTimingAnalysis) {
            console.log('Delegating to loadTradeTimingAnalysis');

            // Check for transaction data first
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for trade timing analysis');
                const container = document.getElementById(DEFAULT_CONTAINER_ID);
                if (container && !options.background) {
                    container.classList.remove('hidden');
                    container.innerHTML = `
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Trade Timing Analysis</h2>
                        </div>
                        <div class="text-center py-4 text-yellow-500">No transaction data available for trade timing analysis</div>
                    `;
                }
                return;
            }

            window.loadTradeTimingAnalysis(transactions, options);
            return;
        }

        // Special handling for Drawdown Analysis to use its own dedicated handler
        if (name === 'drawdown-analysis' && window.loadDrawdownAnalysis) {
            console.log('Delegating to loadDrawdownAnalysis');

            // Check for transaction data first
            const transactions = this.transactionData || window.currentTransactions;
            if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                console.log('No transaction data available for drawdown analysis');
                const container = document.getElementById(DEFAULT_CONTAINER_ID);
                if (container && !options.background) {
                    container.classList.remove('hidden');
                    container.innerHTML = `
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Drawdown Analysis</h2>
                        </div>
                        <div class="text-center py-4 text-yellow-500">No transaction data available for drawdown analysis</div>
                    `;
                }
                return;
            }

            window.loadDrawdownAnalysis(transactions, options);
            return;
        }

        // Special handling for Accounting Analysis to use its own dedicated handler
        if ((name === 'accounting-analysis' || name === 'fifo-lifo') && window.loadAccountingAnalysis) {
            console.log('Delegating to loadAccountingAnalysis for', name);

            // Ensure container is visible
            const container = document.getElementById(DEFAULT_CONTAINER_ID);
            if (container && !options.background) container.classList.remove('hidden');

            // Use the Accounting container ID defined in registration or default
            const containerId = module ? module.containerId : 'accountingAnalysis';
            let accContainer = document.getElementById(containerId);

            // Self-healing: Create container if it was deleted from DOM
            if (!accContainer) {
                console.log('Restoring missing accounting-analysis container');
                accContainer = document.createElement('div');
                accContainer.id = containerId;
                accContainer.className = 'bg-card rounded-xl shadow-lg p-6 mb-8'; // Add default styling
            }

            if (container) {
                // Check if we need to clear (only if the content isn't already just our container)
                if (container.firstElementChild !== accContainer || container.children.length > 1) {
                    container.innerHTML = '';
                    container.appendChild(accContainer);
                }
                if (!options.background) accContainer.classList.remove('hidden');
            }

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
                const container = document.getElementById(DEFAULT_CONTAINER_ID);
                if (container && !options.background) {
                    container.classList.remove('hidden');
                    container.innerHTML = `
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">FIFO/LIFO Analysis</h2>
                        </div>
                        <div class="text-center py-4 text-yellow-500">No transaction data available for accounting analysis</div>
                    `;
                }
                window.accountingAnalysisInProgress = false;
                return;
            }

            // Call accounting analysis with proper data
            try {
                window.loadAccountingAnalysis(transactions, options);
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
                { ...window.analyticsCore.optionsSettings, ...options }
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
                { ...window.analyticsCore.monteCarloSettings, ...options }
            );
            return;
        }

        // For sector-allocation, pass stored settings as options
        if (name === 'sector-allocation' && window.analyticsCore?.sectorSettings) {
            console.log('[LOAD MODULE] Specialized sector-allocation handling with settings:', window.analyticsCore.sectorSettings);
            await window.analyticsCore.analyzePortfolio(
                module.endpoint,
                module.containerId,
                module.displayFunction,
                module.settingsId,
                { ...window.analyticsCore.sectorSettings, ...options }
            );
            return;
        }

        // For strategy-backtesting, pass stored settings as options
        if (name === 'strategy-backtesting' && window.analyticsCore?.backtestSettings) {
            await window.analyticsCore.analyzePortfolio(
                module.endpoint,
                module.containerId,
                module.displayFunction,
                module.settingsId,
                { ...window.analyticsCore.backtestSettings, ...options }
            );
            return;
        }

        // For performance-attribution, pass stored settings as options
        if (name === 'performance-attribution' && window.analyticsCore?.performanceAttributionSettings) {
            await window.analyticsCore.analyzePortfolio(
                module.endpoint,
                module.containerId,
                module.displayFunction,
                module.settingsId,
                { ...window.analyticsCore.performanceAttributionSettings, ...options }
            );
            return;
        }

        // For portfolio-optimization, pass stored settings as options
        if (name === 'portfolio-optimization' && window.analyticsCore?.optimizationSettings) {
            await window.analyticsCore.analyzePortfolio(
                module.endpoint,
                module.containerId,
                module.displayFunction,
                module.settingsId,
                { ...window.analyticsCore.optimizationSettings, ...options }
            );
            return;
        }

        // Clear any existing loading states first
        if (window.loadingManager) {
            window.loadingManager.clearAll();
        }

        // Show loading indicator for all analysis types
        // Show loading indicator for all analysis types (unless running in background)
        // Show loading indicator in the appropriate container
        const targetContainerId = module.containerId || DEFAULT_CONTAINER_ID;
        const container = document.getElementById(targetContainerId) || document.getElementById(DEFAULT_CONTAINER_ID);

        // If we are using a custom container AND IT EXISTS, hide the default one
        const targetElement = document.getElementById(targetContainerId);
        if (targetContainerId !== DEFAULT_CONTAINER_ID && targetElement) {
            const defaultContainer = document.getElementById(DEFAULT_CONTAINER_ID);
            if (defaultContainer) defaultContainer.classList.add('hidden');
        }

        if (container && !['cost-analysis', 'accounting-analysis', 'pnl-attribution', 'turnover-analysis', 'trade-performance', 'cash-flow', 'trade-timing', 'drawdown-analysis'].includes(name)) {
            container.classList.remove('hidden');
            container.innerHTML = '<div class="text-center py-8"><div class="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div><p class="mt-2 text-gray-600 dark:text-gray-400">Loading analysis...</p></div>';
        }

        try {
            if (module.type === 'portfolio') {
                console.log(`[LOAD MODULE] Loading portfolio analysis: ${name}`);
                await window.analyticsCore.analyzePortfolio(
                    module.endpoint,
                    module.containerId,
                    module.displayFunction,
                    module.settingsId,
                    options
                );
            } else if (module.type === 'news') {
                await this.loadMarketNews(module);
            } else {
                console.log(`[LOAD MODULE] Loading transaction analysis: ${name}`);
                await window.analyticsCore.analyzeTransactions(
                    module.endpoint,
                    module.containerId,
                    module.displayFunction,
                    module.settingsId,
                    options
                );
            }
        } catch (error) {
            console.error(`Failed to load ${name}:`, error);
            const container = document.getElementById(DEFAULT_CONTAINER_ID);
            if (container) {
                container.innerHTML = `<div class="text-center py-8 text-red-600">
                    <p class="font-bold">Failed to load module</p>
                    <p class="text-sm mt-2">${error.message}</p>
                </div>`;
            }
        }
    }


    displayTradePerformance(result, options) {
        console.log('Trade Performance result:', result);

        // Use the dedicated display function directly
        if (window.displayTradePerformanceResults && result.trade_performance) {
            window.displayTradePerformanceResults(result.trade_performance, options);
            return;
        }

        // Simple fallback display
        const container = document.getElementById(DEFAULT_CONTAINER_ID);
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
            window.loadTurnoverAnalysis(transactions, options);
            return;
        }

        // Fallback: show basic message in the correct container
        const container = document.getElementById('turnoverAnalysis') || document.getElementById(DEFAULT_CONTAINER_ID);
        if (container && !options.background) {
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
        const container = document.getElementById(DEFAULT_CONTAINER_ID);
        if (!container) return;

        container.classList.remove('hidden');
        const articles = result.articles || [];

        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Market News</h3>
                <button onclick="loadMarketNews(this)" class="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                    Refresh News
                </button>
            </div>
            <div class="space-y-4">
                ${articles.map(article => `
                    <div class="border-b border-card pb-4 last:border-0">
                        <h4 class="text-md font-medium text-gray-900 dark:text-white mb-1">${article.title}</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">${article.summary || ''}</p>
                        <div class="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                            <span>${article.source || 'Unknown Source'}</span>
                            <span>${article.published_at ? new Date(article.published_at).toLocaleDateString() : ''}</span>
                        </div>
                        ${article.url && article.url !== '#' ? `
                            <a href="${article.url}" target="_blank" class="text-indigo-600 hover:text-indigo-500 text-sm mt-2 inline-block">Read More</a>
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
        const container = document.getElementById(DEFAULT_CONTAINER_ID);
        if (!container) return;

        // Debug logging
        console.log('[RETURN ATTRIBUTION] Using fixed displayReturnAttribution');
        console.log('[RETURN ATTRIBUTION] Raw result:', result);

        // Extract attribution data from result
        // Handle various possible response structures
        const attribution = result.return_attribution || result.attribution || result;
        const effects = attribution.attribution_effects || attribution.effects || attribution;

        // Ensure we have valid objects to prevent errors
        const safeEffects = effects || {};
        const safeAttribution = attribution || {};

        console.log('[RETURN ATTRIBUTION] Extracted attribution:', safeAttribution);
        console.log('[RETURN ATTRIBUTION] Extracted effects:', safeEffects);

        const getValueClass = (value) => {
            if (value === null || value === undefined || isNaN(value)) return 'neutral';
            return value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600';
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
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Return Attribution</h2>
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
            
            <div id="returnAttributionSettings" class="settings-panel hidden mb-6 analysis-card p-4 rounded-lg">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Period</label>
                        <select id="returnPeriod" onchange="updateReturnAttribution()" class="w-full p-2 border rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="YTD" ${currentPeriod === 'YTD' ? 'selected' : ''}>YTD</option>
                            <option value="ITD" ${currentPeriod === 'ITD' ? 'selected' : ''}>Inception</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Model</label>
                        <select id="returnModel" onchange="updateReturnAttribution()" class="w-full p-2 border rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                            <option value="brinson" ${currentModel === 'brinson' ? 'selected' : ''}>Brinson</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Benchmark</label>
                        <select id="returnBenchmark" onchange="updateReturnAttribution()" class="w-full p-2 border rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                            <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>NASDAQ (QQQ)</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                            <option value="VTI" ${currentBenchmark === 'VTI' ? 'selected' : ''}>Total Market (VTI)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Currency</label>
                        <select id="returnCurrency" onchange="updateReturnAttribution()" class="w-full p-2 border rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                            <option value="USD" ${currentCurrency === 'USD' ? 'selected' : ''}>USD</option>
                            <option value="EUR" ${currentCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                            <option value="GBP" ${currentCurrency === 'GBP' ? 'selected' : ''}>GBP</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Frequency</label>
                        <select id="returnFrequency" onchange="updateReturnAttribution()" class="w-full p-2 border rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                            <option value="daily" ${currentFrequency === 'daily' ? 'selected' : ''}>Daily</option>
                            <option value="weekly" ${currentFrequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="monthly" ${currentFrequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Attribution Effects -->
                <div class="analysis-card rounded-lg p-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attribution Effects</h3>
                    <div class="space-y-1">
                        <div class="attribution-item flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Asset Allocation</span>
                            <span class="text-lg font-bold ${getValueClass(safeEffects.asset_allocation)}">${formatValue(safeEffects.asset_allocation)}</span>
                        </div>
                        <div class="attribution-item flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Security Selection</span>
                            <span class="text-lg font-bold ${getValueClass(safeEffects.security_selection)}">${formatValue(safeEffects.security_selection)}</span>
                        </div>
                        <div class="attribution-item flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Interaction Effect</span>
                            <span class="text-lg font-bold ${getValueClass(safeEffects.interaction_effect)}">${formatValue(safeEffects.interaction_effect)}</span>
                        </div>
                        <div class="attribution-item flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Currency Effect</span>
                            <span class="text-lg font-bold ${getValueClass(safeEffects.currency_effect)}">${formatValue(safeEffects.currency_effect)}</span>
                        </div>
                    </div>
                </div>

                <!-- Performance Summary -->
                <div class="analysis-card rounded-lg p-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Summary</h3>
                    <div class="space-y-1">
                        <div class="attribution-item flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Portfolio Return</span>
                            <span class="text-lg font-bold ${getValueClass(safeAttribution.portfolio_return)}">${formatValue(safeAttribution.portfolio_return)}</span>
                        </div>
                        <div class="attribution-item flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Benchmark Return</span>
                            <span class="text-lg font-bold ${getValueClass(safeAttribution.benchmark_return)}">${formatValue(safeAttribution.benchmark_return)}</span>
                        </div>
                        <div class="attribution-item flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Active Return</span>
                            <span class="text-lg font-bold ${getValueClass(safeAttribution.active_return)}">${formatValue(safeAttribution.active_return)}</span>
                        </div>
                        <div class="attribution-item flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Market Timing</span>
                            <span class="text-lg font-bold ${getValueClass(safeAttribution.market_timing)}">${formatValue(safeAttribution.market_timing)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="analysis-card mt-6 p-4">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="text-gray-600 dark:text-gray-400">Period:</span> <span class="font-medium text-gray-900 dark:text-white">${currentPeriod === '1Y' ? '1 Year' : currentPeriod}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Model:</span> <span class="font-medium text-gray-900 dark:text-white">${currentModel === 'brinson' ? 'Brinson' : currentModel === 'factor' ? 'Factor-based' : currentModel === 'holdings' ? 'Holdings-based' : currentModel}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Benchmark:</span> <span class="font-medium text-gray-900 dark:text-white">${currentBenchmark === 'SPY' ? 'S&P 500 (SPY)' : currentBenchmark === 'QQQ' ? 'NASDAQ (QQQ)' : currentBenchmark === 'IWM' ? 'Russell 2000 (IWM)' : currentBenchmark === 'VTI' ? 'Total Stock Market (VTI)' : currentBenchmark}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Currency:</span> <span class="font-medium text-gray-900 dark:text-white">${currentCurrency === 'USD' ? 'USD' : currentCurrency === 'EUR' ? 'EUR' : currentCurrency === 'GBP' ? 'GBP' : currentCurrency === 'MULTI' ? 'Multi-currency' : currentCurrency}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Frequency:</span> <span class="font-medium text-gray-900 dark:text-white">${currentFrequency === 'daily' ? 'Daily' : currentFrequency === 'weekly' ? 'Weekly' : currentFrequency === 'monthly' ? 'Monthly' : currentFrequency}</span></div>
                </div>
            </div>
        `;
    }

    displayPerformanceAttribution(result, options) {
        const container = document.getElementById(DEFAULT_CONTAINER_ID);
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
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Performance Attribution</h2>
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
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Period</label>
                        <select id="performancePeriod" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="updatePerformanceAttribution()">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="YTD" ${currentPeriod === 'YTD' ? 'selected' : ''}>Year to Date</option>
                            <option value="ITD" ${currentPeriod === 'ITD' ? 'selected' : ''}>Inception to Date</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Attribution Model</label>
                        <select id="performanceModel" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="updatePerformanceAttribution()">
                            <option value="brinson" ${currentModel === 'brinson' ? 'selected' : ''}>Brinson</option>
                            <option value="factor" ${currentModel === 'factor' ? 'selected' : ''}>Factor-based</option>
                            <option value="holdings" ${currentModel === 'holdings' ? 'selected' : ''}>Holdings-based</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Benchmark</label>
                        <select id="performanceBenchmark" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="updatePerformanceAttribution()">
                            <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>NASDAQ (QQQ)</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                            <option value="VTI" ${currentBenchmark === 'VTI' ? 'selected' : ''}>Total Stock Market (VTI)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Currency</label>
                        <select id="performanceCurrency" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="updatePerformanceAttribution()">
                            <option value="USD" ${currentCurrency === 'USD' ? 'selected' : ''}>USD</option>
                            <option value="EUR" ${currentCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                            <option value="GBP" ${currentCurrency === 'GBP' ? 'selected' : ''}>GBP</option>
                            <option value="MULTI" ${currentCurrency === 'MULTI' ? 'selected' : ''}>Multi-currency</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Frequency</label>
                        <select id="performanceFrequency" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="updatePerformanceAttribution()">
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
            <div class="analysis-card mt-6 p-6">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Analysis Parameters</h4>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div><span class="text-gray-600 dark:text-gray-400">Period:</span> <span class="font-medium text-gray-900 dark:text-white">${currentPeriod}</span></div>
            <div><span class="text-gray-600 dark:text-gray-400">Model:</span> <span class="font-medium text-gray-900 dark:text-white">${currentModel}</span></div>
            <div><span class="text-gray-600 dark:text-gray-400">Benchmark:</span> <span class="font-medium text-gray-900 dark:text-white">${currentBenchmark}</span></div>
            <div><span class="text-gray-600 dark:text-gray-400">Currency:</span> <span class="font-medium text-gray-900 dark:text-white">${currentCurrency}</span></div>
            <div><span class="text-gray-600 dark:text-gray-400">Frequency:</span> <span class="font-medium text-gray-900 dark:text-white">${currentFrequency}</span></div>
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
        const container = document.getElementById('correlationMatrix') || document.getElementById(DEFAULT_CONTAINER_ID);
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
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Correlation Analysis</h2>
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
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period</label>
                        <select id="correlationPeriod" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" onchange="updateCorrelationAnalysis()">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentPeriod === '2Y' ? 'selected' : ''}>2 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                        <select id="correlationFrequency" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" onchange="updateCorrelationAnalysis()">
                            <option value="Daily" ${currentFrequency === 'Daily' ? 'selected' : ''}>Daily</option>
                            <option value="Weekly" ${currentFrequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="Monthly" ${currentFrequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Method</label>
                        <select id="correlationMethod" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" onchange="updateCorrelationAnalysis()">
                            <option value="pearson" ${currentMethod === 'pearson' ? 'selected' : ''}>Pearson</option>
                            <option value="spearman" ${currentMethod === 'spearman' ? 'selected' : ''}>Spearman</option>
                            <option value="kendall" ${currentMethod === 'kendall' ? 'selected' : ''}>Kendall</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rolling Window</label>
                        <select id="correlationRollingWindow" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" onchange="updateCorrelationAnalysis()">
                            <option value="30d" ${currentRollingWindow === '30d' ? 'selected' : ''}>30 days</option>
                            <option value="60d" ${currentRollingWindow === '60d' ? 'selected' : ''}>60 days</option>
                            <option value="90d" ${currentRollingWindow === '90d' ? 'selected' : ''}>90 days</option>
                            <option value="252d" ${currentRollingWindow === '252d' ? 'selected' : ''}>252 days</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Average Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.average_correlation || 0) > 0.7 ? 'text-red-600 dark:text-red-400' : (summary.average_correlation || 0) > 0.3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}">
                        ${(summary.average_correlation || 0).toFixed(3)}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${(summary.average_correlation || 0) > 0.7 ? 'High correlation' : (summary.average_correlation || 0) > 0.3 ? 'Moderate correlation' : 'Low correlation'}</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Max Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.max_correlation || 0) > 0.8 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}">
                        ${(summary.max_correlation || 0).toFixed(3)}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Highest pair correlation</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Min Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.min_correlation || 0) < -0.3 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}">
                        ${(summary.min_correlation || 0).toFixed(3)}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Lowest pair correlation</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Data Points</h3>
                    <p class="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        ${summary.data_points || 'N/A'}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${symbols.length} symbols analyzed</p>
                </div>
            </div>
            
            ${symbols.length > 0 ? `
                <div class="analysis-card p-6 mb-6">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Correlation Matrix</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead class="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Symbol</th>
                                    ${symbols.map(symbol => `<th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">${symbol}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                                ${symbols.map(symbol1 => `
                                    <tr>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800">${symbol1}</td>
                                        ${symbols.map(symbol2 => {
            const corrValue = correlation[symbol1]?.[symbol2] || 0;
            const colorClass = symbol1 === symbol2 ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-300' :
                corrValue > 0.7 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' :
                    corrValue > 0.3 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                        corrValue < -0.3 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
            return `<td class="px-4 py-2 whitespace-nowrap text-sm text-center ${colorClass}">${corrValue.toFixed(3)}</td>`;
        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
                        <div class="flex flex-wrap gap-4">
                            <div class="flex items-center"><div class="w-4 h-4 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-700 mr-2"></div>Strong Positive (>0.7)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 mr-2"></div>Moderate Positive (0.3-0.7)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 mr-2"></div>Weak (-0.3-0.3)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-green-100 dark:bg-green-900 border border-green-200 dark:border-green-700 mr-2"></div>Negative (<-0.3)</div>
                        </div>
                    </div>
                </div>
            ` : '<div class="analysis-card p-6 mb-6"><p class="text-gray-500 dark:text-gray-400 text-center">No correlation data available</p></div>'
            }

<div class="analysis-card p-6">
    <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Analysis Parameters</h4>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span class="text-gray-600 dark:text-gray-400">Period:</span> <span class="font-medium text-gray-900 dark:text-white">${currentPeriod}</span></div>
        <div><span class="text-gray-600 dark:text-gray-400">Frequency:</span> <span class="font-medium text-gray-900 dark:text-white">${currentFrequency}</span></div>
        <div><span class="text-gray-600 dark:text-gray-400">Method:</span> <span class="font-medium text-gray-900 dark:text-white">${currentMethod}</span></div>
        <div><span class="text-gray-600 dark:text-gray-400">Rolling Window:</span> <span class="font-medium text-gray-900 dark:text-white">${currentRollingWindow}</span></div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
        <div><span class="text-gray-600 dark:text-gray-400">Data Points:</span> <span class="font-medium text-gray-900 dark:text-white">${summary.data_points || 'N/A'}</span></div>
        <div><span class="text-gray-600 dark:text-gray-400">Symbols:</span> <span class="font-medium text-gray-900 dark:text-white">${symbols.length}</span></div>
        <div><span class="text-gray-600 dark:text-gray-400">Data Source:</span> <span class="font-medium text-gray-900 dark:text-white">${correlationData.data_source || 'Market Data'}</span></div>
        <div><span class="text-gray-600 dark:text-gray-400">High Pairs:</span> <span class="font-medium text-gray-900 dark:text-white">${correlationData.high_correlation_pairs?.length || 0}</span></div>
    </div>
</div>
`;
    }

    // Load market news (Refactored to use API_BASE_URL)
    async loadMarketNews(module) {
        const container = document.getElementById(module.containerId);
        if (!container) return;

        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
                <p class="mt-2 text-gray-600 dark:text-gray-400">Loading news...</p>
            </div>
        `;

        try {
            const response = await fetch(`${API_BASE_URL}/api/news`);
            const data = await response.json();

            if (data.success && data.articles) {
                module.displayFunction.call(this, { articles: data.articles });
            } else {
                throw new Error('Failed to load news');
            }
        } catch (error) {
            console.error('News loading failed:', error);
            container.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-red-600 mb-4">
                        <svg class="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">News Loading Failed</h3>
                    <p class="text-gray-600 mb-4">Unable to load market news at this time.</p>
                    <button onclick="loadMarketNews()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    // Scan options method for compatibility with refactored app
    async scanOptions(symbols) {
        try {
            console.log(`[ANALYTICS MANAGER] scanOptions called with ${symbols.length} symbols:`, symbols);

            const response = await fetch(`${API_BASE_URL}/api/scan-options`, {
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
            const response = await fetch(`${API_BASE_URL}/api/analyze-risk`, {
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
            const response = await fetch(`${API_BASE_URL}/api/monte-carlo`, {
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
        console.log('[AnalyticsManager] runBacktest called with', { strategy, symbols, startDate, endDate });
        try {
            const response = await fetch(`${API_BASE_URL}/api/strategy-backtesting`, {
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
            const response = await fetch(`${API_BASE_URL}/api/screen-stocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ criteria, universe })
            });

            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }



    displayRiskMetrics(result, options) {
        console.log('Risk Metrics result:', result);

        // Try to find specific container first, then fall back to generic analysis content
        let container = document.getElementById('riskResults') || document.getElementById(DEFAULT_CONTAINER_ID);
        if (!container) return;

        // Ensure container is visible
        container.classList.remove('hidden');

        const metrics = result.risk_metrics || result;

        // Helper for formatting
        const fmtPct = (val) => (val === null || val === undefined || isNaN(val)) ? 'N/A' : (val * 100).toFixed(2) + '%';
        const fmtNum = (val) => (val === null || val === undefined || isNaN(val)) ? 'N/A' : val.toFixed(2);

        // Helper for color coding (Tiered)
        const getColorClass = (value, type) => {
            if (value === null || value === undefined || isNaN(value)) return 'text-gray-400';

            switch (type) {
                case 'sharpe':
                case 'sortino':
                case 'calmar':
                    if (value >= 1.5) return 'text-green-600 font-bold'; // Excellent
                    if (value >= 1.0) return 'text-green-500';           // Good
                    if (value >= 0) return 'text-gray-900';              // Neutral/Positive
                    return 'text-red-500';                               // Negative

                case 'drawdown':
                case 'volatility':
                case 'var':
                case 'cvar':
                    // Lower is better (inverted logic for color)
                    if (type === 'drawdown') {
                        if (value > -0.10) return 'text-green-600'; // < 10% DD
                        if (value > -0.20) return 'text-yellow-600'; // 10-20% DD
                        return 'text-red-600 font-bold';            // > 20% DD
                    }
                    return 'text-gray-900';

                case 'generic':
                default:
                    return value >= 0 ? 'text-green-600' : 'text-red-600';
            }
        };

        // --- Extract Current Settings ---
        if (!window.analyticsCore.riskSettings) {
            window.analyticsCore.riskSettings = {};
            // Load from localStorage
            try {
                const saved = localStorage.getItem('riskSettings');
                if (saved) {
                    window.analyticsCore.riskSettings = JSON.parse(saved);
                    console.log('Loaded Risk settings from localStorage');
                }
            } catch (e) {
                console.error('Failed to load risk settings:', e);
            }
        }
        const settings = window.analyticsCore.riskSettings;

        // Get current settings
        const currentPeriod = options?.period || settings.period || metrics.settings?.period || '1Y';
        const currentConfidence = options?.var_confidence || settings.var_confidence || metrics.settings?.var_confidence || 0.95;
        const currentModel = options?.risk_model || settings.risk_model || metrics.settings?.risk_model || 'historical';
        const currentBenchmark = options?.benchmark || settings.benchmark || metrics.settings?.benchmark || 'SPY';
        const currentWindow = options?.rolling_window || settings.rolling_window || metrics.settings?.rolling_window || 252;

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Risk Metrics</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="window.toggleRiskSettingsPanel()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="window.updateRiskAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>
            
            <div id="riskSettings" class="settings-panel hidden mb-6 p-4">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Time Period</label>
                        <select id="riskPeriod" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="window.updateRiskAnalysis()">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentPeriod === '2Y' ? 'selected' : ''}>2 Years</option>
                            <option value="3Y" ${currentPeriod === '3Y' ? 'selected' : ''}>3 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Confidence</label>
                        <select id="riskConfidence" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="window.updateRiskAnalysis()">
                            <option value="0.90" ${Math.abs(currentConfidence - 0.90) < 0.01 ? 'selected' : ''}>90%</option>
                            <option value="0.95" ${Math.abs(currentConfidence - 0.95) < 0.01 ? 'selected' : ''}>95%</option>
                            <option value="0.99" ${Math.abs(currentConfidence - 0.99) < 0.01 ? 'selected' : ''}>99%</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Risk Model</label>
                        <select id="riskModel" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="window.updateRiskAnalysis()">
                            <option value="historical" ${currentModel === 'historical' ? 'selected' : ''}>Historical</option>
                            <option value="monte_carlo" ${currentModel === 'monte_carlo' ? 'selected' : ''}>Monte Carlo</option>
                            <option value="parametric" ${currentModel === 'parametric' ? 'selected' : ''}>Parametric</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Benchmark</label>
                        <select id="riskBenchmark" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="window.updateRiskAnalysis()">
                            <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>NASDAQ (QQQ)</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Rolling Window</label>
                        <select id="riskRollingWindow" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="window.updateRiskAnalysis()">
                            <option value="30" ${currentWindow == 30 ? 'selected' : ''}>30 Days</option>
                            <option value="60" ${currentWindow == 60 ? 'selected' : ''}>60 Days</option>
                            <option value="90" ${currentWindow == 90 ? 'selected' : ''}>90 Days</option>
                            <option value="252" ${currentWindow == 252 ? 'selected' : ''}>252 Days</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Column 1: Drawdown Metrics -->
                <div class="space-y-3">
                    <h4 class="section-header">Drawdown Analysis</h4>
                    <div class="metric-row">
                        <span class="metric-label">Max Drawdown</span>
                        <span class="metric-value ${getColorClass(metrics.max_drawdown, 'drawdown')}">${fmtPct(metrics.max_drawdown)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Value at Risk (95%)</span>
                        <span class="metric-value ${getColorClass(metrics.var_95, 'var')}">${fmtPct(metrics.var_95)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Conditional VaR (95%)</span>
                        <span class="metric-value ${getColorClass(metrics.cvar_95, 'cvar')}">${fmtPct(metrics.cvar_95)}</span>
                    </div>
                     <div class="metric-row">
                        <span class="metric-label">Downside Deviation</span>
                        <span class="metric-value">${fmtPct(metrics.downside_deviation)}</span>
                    </div>
                </div>

                <!-- Column 2: Ratios & Volatility -->
                <div class="space-y-3">
                    <h4 class="section-header">Risk-Return Metrics</h4>
                    <div class="metric-row">
                        <span class="metric-label">Sharpe Ratio</span>
                        <span class="metric-value ${getColorClass(metrics.sharpe_ratio, 'sharpe')}">${fmtNum(metrics.sharpe_ratio)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Sortino Ratio</span>
                        <span class="metric-value ${getColorClass(metrics.sortino_ratio, 'sortino')}">${fmtNum(metrics.sortino_ratio)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Calmar Ratio</span>
                        <span class="metric-value ${getColorClass(metrics.calmar_ratio, 'calmar')}">${fmtNum(metrics.calmar_ratio)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Volatility (Ann.)</span>
                        <span class="metric-value">${fmtPct(metrics.volatility)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Beta</span>
                        <span class="metric-value">${fmtNum(metrics.beta)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Upside Capture</span>
                        <span class="metric-value">${fmtNum(metrics.upside_capture)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Downside Capture</span>
                        <span class="metric-value">${fmtNum(metrics.downside_capture)}</span>
                    </div>
                </div>
            </div>
            
            <div class="analysis-card mt-6 p-6">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="text-gray-600 dark:text-gray-400">Period:</span> <span class="font-medium text-gray-900 dark:text-white">${currentPeriod}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Confidence:</span> <span class="font-medium text-gray-900 dark:text-white">${(currentConfidence * 100).toFixed(0)}%</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Model:</span> <span class="font-medium text-gray-900 dark:text-white">${currentModel.charAt(0).toUpperCase() + currentModel.slice(1).replace('_', ' ')}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Benchmark:</span> <span class="font-medium text-gray-900 dark:text-white">${currentBenchmark}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Window:</span> <span class="font-medium text-gray-900 dark:text-white">${currentWindow} Days</span></div>
                </div>
            </div>
        `;
    }


    displayOptionsStrategies(result, options) {
        console.log('[OPTIONS] Displaying results:', result);
        const container = document.getElementById('optionsResults') || document.getElementById(DEFAULT_CONTAINER_ID);
        if (!container) return;

        // Store data for pagination and filtering
        window.optionsOpportunities = result.opportunities || [];
        window.optionsSummary = result.summary || {};
        window.optionsMainResult = result; // Store full result for reference
        window.optionsCurrentPage = 1;

        // Extract unique symbols for the dynamic filter
        const uniqueSymbols = [...new Set(window.optionsOpportunities.map(o => o.symbol))].sort();

        // --- Extract Current Settings ---
        if (!window.analyticsCore.optionsSettings) {
            window.analyticsCore.optionsSettings = {};
            // Load from localStorage
            try {
                const saved = localStorage.getItem('optionsSettings');
                if (saved) {
                    window.analyticsCore.optionsSettings = JSON.parse(saved);
                    console.log('Loaded Options settings from localStorage');
                }
            } catch (e) {
                console.error('Failed to load options settings:', e);
            }
        }
        const settings = window.analyticsCore.optionsSettings;

        // Get current settings/defaults
        const currentExpiration = settings.expiration || '3M';
        const currentMoneyness = settings.moneyness || 'All';
        const currentStrategy = settings.strategy || 'All';
        const currentMinPremium = settings.min_premium || 0.50;
        const currentDelta = settings.delta_range || 'All';

        // --- 1. Header with Dynamic Filter & Actions ---
        container.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Options Strategy Scanner</h2>
                
                <div class="flex flex-wrap items-center gap-2">
                    <!-- Dynamic Symbol Filter -->
                    <div class="relative">
                        <select id="optionsSymbolFilter" onchange="window.filterOptionsStrategies()" 
                                class="block w-32 pl-3 pr-10 py-1.5 text-base border-card focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-card text-gray-900 dark:text-white">
                            <option value="all">All Symbols</option>
                            ${uniqueSymbols.map(sym => `<option value="${sym}">${sym}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Settings Toggle -->
                    <button onclick="toggleOptionsSettings()" class="bg-gray-600 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        Settings
                    </button>

                    <!-- Refresh Button -->
                    <button onclick="window.updateOptionsAnalysis()" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center shadow-sm">
                        <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- --- 2. Settings Panel --- -->
            <div id="optionsSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Expiration</label>
                        <select id="optionsExpiration" onchange="window.updateOptionsAnalysis()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="1M" ${currentExpiration === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="2M" ${currentExpiration === '2M' ? 'selected' : ''}>2 Months</option>
                            <option value="3M" ${currentExpiration === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentExpiration === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentExpiration === '1Y' ? 'selected' : ''}>1 Year</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Moneyness</label>
                        <select id="optionsMoneyness" onchange="window.updateOptionsAnalysis()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="All" ${currentMoneyness === 'All' ? 'selected' : ''}>All</option>
                            <option value="ITM" ${currentMoneyness === 'ITM' ? 'selected' : ''}>In The Money (ITM)</option>
                            <option value="ATM" ${currentMoneyness === 'ATM' ? 'selected' : ''}>At The Money (ATM)</option>
                            <option value="OTM" ${currentMoneyness === 'OTM' ? 'selected' : ''}>Out of The Money (OTM)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Strategy Type</label>
                        <select id="optionsStrategy" onchange="window.updateOptionsAnalysis()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="All" ${currentStrategy === 'All' ? 'selected' : ''}>All Strategies</option>
                            <option value="Covered Call" ${currentStrategy === 'Covered Call' ? 'selected' : ''}>Covered Call</option>
                            <option value="Protective Put" ${currentStrategy === 'Protective Put' ? 'selected' : ''}>Protective Put</option>
                            <option value="Bull Call Spread" ${currentStrategy === 'Bull Call Spread' ? 'selected' : ''}>Bull Call Spread</option>
                            <option value="Bear Put Spread" ${currentStrategy === 'Bear Put Spread' ? 'selected' : ''}>Bear Put Spread</option>
                            <option value="Iron Condor" ${currentStrategy === 'Iron Condor' ? 'selected' : ''}>Iron Condor</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Min Premium ($)</label>
                        <select id="optionsMinPremium" onchange="window.updateOptionsAnalysis()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="0.10" ${currentMinPremium === 0.10 ? 'selected' : ''}>$0.10</option>
                            <option value="0.50" ${currentMinPremium === 0.50 ? 'selected' : ''}>$0.50</option>
                            <option value="1.00" ${currentMinPremium === 1.00 ? 'selected' : ''}>$1.00</option>
                            <option value="2.00" ${currentMinPremium === 2.00 ? 'selected' : ''}>$2.00</option>
                            <option value="5.00" ${currentMinPremium === 5.00 ? 'selected' : ''}>$5.00</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Delta Target</label>
                        <select id="optionsDeltaRange" onchange="window.updateOptionsAnalysis()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="All" ${currentDelta === 'All' ? 'selected' : ''}>Any Delta</option>
                            <option value="0.1-0.3" ${currentDelta === '0.1-0.3' ? 'selected' : ''}>Low (0.1 - 0.3)</option>
                            <option value="0.3-0.7" ${currentDelta === '0.3-0.7' ? 'selected' : ''}>Medium (0.3 - 0.7)</option>
                            <option value="0.7-1.0" ${currentDelta === '0.7-1.0' ? 'selected' : ''}>High (0.7 - 1.0)</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- --- 3. Summary Cards --- -->
            <div id="optionsSummaryCards" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <!-- Populated dynamically via JS to allow filtering updates -->
            </div>

            <!-- --- 4. Results Table with Pagination --- -->
             <div class="analysis-card overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-card">
                        <thead class="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Strategy</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Expiration</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Strike(s)</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Premium</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Delta</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">IV</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Exp. Return</th>
                            </tr>
                        </thead>
                        <tbody id="optionsOpportunitiesBody" class="bg-card divide-y divide-card">
                            <!-- Rows populated via JS -->
                        </tbody>
                    </table>
                </div>
                
                <!-- Pagination Controls -->
                <div class="bg-card px-4 py-3 border-t border-card flex items-center justify-between sm:px-6">
                    <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div class="flex items-center">
                            <div class="flex items-center space-x-2 mr-6">
                                <span class="text-sm text-gray-600 dark:text-gray-400">Rows:</span>
                                <select id="optItemsPerPage" onchange="window.changeOptionsPage(1)" class="text-sm border-card rounded-md focus:ring-indigo-500 focus:border-indigo-500 py-1 pl-2 pr-6 bg-card text-gray-900 dark:text-white">
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                    <option value="all">All</option>
                                </select>
                            </div>
                            </div>
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                                Showing <span class="font-medium text-gray-900 dark:text-white" id="optStart">1</span> to <span class="font-medium text-gray-900 dark:text-white" id="optEnd">10</span> of <span class="font-medium text-gray-900 dark:text-white" id="optTotal">20</span> results
                            </p>
                        </div>
                        <div>
                            <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button onclick="window.changeOptionsPage(window.optionsCurrentPage - 1)" class="relative inline-flex items-center px-4 py-2 rounded-l-md border border-card bg-card text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <svg class="h-5 w-5 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                                    </svg>
                                    Previous
                                </button>
                                <span id="optPageIndicator" class="relative inline-flex items-center px-4 py-2 border-t border-b border-card bg-card text-sm font-medium text-gray-900 dark:text-white">
                                    Page 1
                                </span>
                                <button onclick="window.changeOptionsPage(window.optionsCurrentPage + 1)" class="relative inline-flex items-center px-4 py-2 rounded-r-md border border-card bg-card text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Next
                                    <svg class="h-5 w-5 ml-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>

            <!-- --- 5. Analysis Parameters Footer-- - -->
            <div class="details-box mt-6">
                <h4 class="section-header">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="detail-label">Expiration:</span> <span class="detail-value">${currentExpiration}</span></div>
                    <div><span class="detail-label">Moneyness:</span> <span class="detail-value">${currentMoneyness}</span></div>
                    <div><span class="detail-label">Strategy:</span> <span class="detail-value">${currentStrategy}</span></div>
                    <div><span class="detail-label">Min Premium:</span> <span class="detail-value">$${currentMinPremium.toFixed(2)}</span></div>
                    <div><span class="detail-label">Delta:</span> <span class="detail-value">${currentDelta}</span></div>
                </div>
            </div>
        `;

        // Render initial data table and summary
        window.filterOptionsStrategies();
    }

    displayMonteCarloResults(result, options) {
        console.log('Monte Carlo result:', result);
        const container = document.getElementById('monteCarloResults') || document.getElementById(DEFAULT_CONTAINER_ID);
        if (!container) {
            console.error('[Monte Carlo] No container found');
            return;
        }

        // Force container visibility
        container.classList.remove('hidden');

        try {
            // --- Extract Current Settings ---
            if (!window.analyticsCore.monteCarloSettings) {
                window.analyticsCore.monteCarloSettings = {};
                // Load from localStorage
                try {
                    const saved = localStorage.getItem('monteCarloSettings');
                    if (saved) {
                        window.analyticsCore.monteCarloSettings = JSON.parse(saved);
                        console.log('Loaded Monte Carlo settings from localStorage');
                    }
                } catch (e) {
                    console.error('Failed to load Monte Carlo settings:', e);
                }
            }
            const settings = window.analyticsCore.monteCarloSettings;

            const currentPeriod = settings.forecast_period || '3M';
            const currentSims = settings.simulations || '10000';
            const currentConfidence = settings.confidence_intervals || '0.95';
            const currentRegime = settings.market_regime || 'normal';
            const currentVolAdj = settings.volatility_adjustment || '0.0';

            // --- 1. Header with Settings Toggle ---
            container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Monte Carlo Simulation</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Probabilistic portfolio forecasting</p>
                </div>
                <div class="flex space-x-3">
                    <button onclick="window.toggleMonteCarloSettings()" class="flex items-center px-3 py-2 border border-card shadow-sm text-sm font-medium rounded-md text-gray-600 dark:text-gray-400 bg-card hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <svg class="-ml-1 mr-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01-.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                        </svg>
                        Settings
                    </button>
                    <button onclick="window.analyticsManager.loadModule('monte-carlo')" class="flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- 2. Settings Panel -->
            <div id="monteCarloSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Forecast Period</label>
                        <select id="mcPeriod" onchange="window.updateMonteCarloParams()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentPeriod === '2Y' ? 'selected' : ''}>2 Years</option>
                            <option value="5Y" ${currentPeriod === '5Y' ? 'selected' : ''}>5 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Simulations</label>
                        <select id="mcSimulations" onchange="window.updateMonteCarloParams()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="1000" ${currentSims == 1000 ? 'selected' : ''}>1K (Fast)</option>
                            <option value="5000" ${currentSims == 5000 ? 'selected' : ''}>5K</option>
                            <option value="10000" ${currentSims == 10000 ? 'selected' : ''}>10K (Standard)</option>
                            <option value="50000" ${currentSims == 50000 ? 'selected' : ''}>50K (Detailed)</option>
                            <option value="100000" ${currentSims == 100000 ? 'selected' : ''}>100K (Precise)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Confidence Interval</label>
                        <select id="mcConfidence" onchange="window.updateMonteCarloParams()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="0.80" ${currentConfidence == 0.80 ? 'selected' : ''}>80%</option>
                            <option value="0.90" ${currentConfidence == 0.90 ? 'selected' : ''}>90%</option>
                            <option value="0.95" ${currentConfidence == 0.95 ? 'selected' : ''}>95% (Standard)</option>
                            <option value="0.99" ${currentConfidence == 0.99 ? 'selected' : ''}>99%</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Market Regime</label>
                        <select id="mcRegime" onchange="window.updateMonteCarloParams()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="bull" ${currentRegime === 'bull' ? 'selected' : ''}>Bull (+20%)</option>
                            <option value="normal" ${currentRegime === 'normal' ? 'selected' : ''}>Normal (0%)</option>
                            <option value="bear" ${currentRegime === 'bear' ? 'selected' : ''}>Bear (-20%)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Volatility Adj.</label>
                        <select id="mcVolAdj" onchange="window.updateMonteCarloParams()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="-0.5" ${currentVolAdj == -0.5 ? 'selected' : ''}>Low (-50%)</option>
                            <option value="0.0" ${currentVolAdj == 0.0 ? 'selected' : ''}>Normal</option>
                            <option value="0.5" ${currentVolAdj == 0.5 ? 'selected' : ''}>High (+50%)</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- 3. Results Container -->
            <div id="monteCarloChartContainer">
                <!-- Content injected by renderMonteCarloChart -->
            </div>

            <!-- 4. Analysis Parameters Footer -->
            <div class="analysis-card mt-6 mb-8 p-6">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="text-gray-600 dark:text-gray-400">Period:</span> <span class="font-medium text-gray-900 dark:text-white">${currentPeriod}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Simulations:</span> <span class="font-medium text-gray-900 dark:text-white">${parseInt(currentSims).toLocaleString()}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Confidence:</span> <span class="font-medium text-gray-900 dark:text-white">${(currentConfidence * 100).toFixed(0)}%</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Regime:</span> <span class="font-medium text-gray-900 dark:text-white capitalize">${currentRegime}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Vol Adj:</span> <span class="font-medium text-gray-900 dark:text-white">${currentVolAdj > 0 ? '+' : ''}${currentVolAdj * 100}%</span></div>
                </div>
            </div>
        `;

            // Pass control to renderer
            if (window.renderMonteCarloChart) {
                window.renderMonteCarloChart(result);
            } else {
                console.error('[AnalyticsManager] renderMonteCarloChart not found');
                const chartContainer = document.getElementById('monteCarloChartContainer');
                if (chartContainer) {
                    chartContainer.innerHTML = '<div class="text-red-500 p-4">Error: Monte Carlo renderer (simplified-monte-carlo.js) not loaded. Please refresh the page.</div>';
                }
            }
        } catch (e) {
            console.error('[Monte Carlo] Display error:', e);
            if (container) {
                container.innerHTML = `<div class="p-6 text-red-600">
                <h3 class="font-bold">Error Displaying Monte Carlo Results</h3>
                <p>${e.message}</p>
                <pre class="text-xs mt-2">${e.stack}</pre>
            </div>`;
            }
        }
    }

    // Helper function to update parameters (attached to window for global access)
    // Note: This needs to be defined outside the class or attached to window
    // We'll define it at the bottom or in the helper script.

    displayPortfolioOptimization(result, options) {
        console.log('Portfolio Optimization result:', result);
        const container = document.getElementById('portfolioOptimization') || document.getElementById(DEFAULT_CONTAINER_ID);
        if (!container) return;

        // --- Extract Current Settings ---
        // Load from localStorage if available and not already in memory
        if (!window.analyticsCore.optimizationSettings) {
            window.analyticsCore.optimizationSettings = {};
            try {
                const saved = localStorage.getItem('optimizationSettings');
                if (saved) {
                    window.analyticsCore.optimizationSettings = JSON.parse(saved);
                    console.log('Loaded Portfolio Optimization settings from localStorage');
                }
            } catch (e) {
                console.error('Failed to load optimization settings:', e);
            }
        }
        const settings = window.analyticsCore.optimizationSettings;

        const currentObjective = settings.objective || 'max_sharpe';
        const currentConstraint = settings.constraint || 'long_only';
        const currentRebalancing = settings.rebalancing || 'quarterly';
        const currentRiskBudget = settings.risk_budget || 'equal';
        const currentLookback = settings.lookback_period || '1Y';

        // --- UI Structure ---
        container.innerHTML = `
                <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Portfolio Optimization</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Efficient Frontier & Optimal Allocation</p>
                </div>
                <div class="flex space-x-3">
                    <button onclick="window.toggleOptimizationSettings()" class="flex items-center px-3 py-2 border border-card shadow-sm text-sm font-medium rounded-md text-gray-600 dark:text-gray-400 bg-card hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <svg class="-ml-1 mr-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01-.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                        </svg>
                        Settings
                    </button>
                    <button onclick="window.analyticsManager.loadModule('portfolio-optimization')" class="flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Settings Panel -->
            <div id="optimizationSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Objective</label>
                        <select id="optObjective" onchange="window.updatePortfolioOptimization()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="max_sharpe" ${currentObjective === 'max_sharpe' ? 'selected' : ''}>Max Sharpe Ratio</option>
                            <option value="min_volatility" ${currentObjective === 'min_volatility' ? 'selected' : ''}>Min Volatility</option>
                            <option value="max_return" ${currentObjective === 'max_return' ? 'selected' : ''}>Max Return</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Constraints</label>
                        <select id="optConstraint" onchange="window.updatePortfolioOptimization()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="long_only" ${currentConstraint === 'long_only' ? 'selected' : ''}>Long Only</option>
                            <option value="130_30" ${currentConstraint === '130_30' ? 'selected' : ''}>130/30</option>
                            <option value="market_neutral" ${currentConstraint === 'market_neutral' ? 'selected' : ''}>Market Neutral</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rebalancing</label>
                        <select id="optRebalancing" onchange="window.updatePortfolioOptimization()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="monthly" ${currentRebalancing === 'monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="quarterly" ${currentRebalancing === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                            <option value="semi_annual" ${currentRebalancing === 'semi_annual' ? 'selected' : ''}>Semi-Annual</option>
                            <option value="annual" ${currentRebalancing === 'annual' ? 'selected' : ''}>Annual</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Risk Budget</label>
                        <select id="optRiskBudget" onchange="window.updatePortfolioOptimization()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="equal" ${currentRiskBudget === 'equal' ? 'selected' : ''}>Equal Risk</option>
                            <option value="risk_parity" ${currentRiskBudget === 'risk_parity' ? 'selected' : ''}>Risk Parity</option>
                            <option value="custom" ${currentRiskBudget === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Lookback Period</label>
                        <select id="optLookback" onchange="window.updatePortfolioOptimization()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                            <option value="1Y" ${currentLookback === '1Y' ? 'selected' : ''}>1 Year</option>
                            <option value="2Y" ${currentLookback === '2Y' ? 'selected' : ''}>2 Years</option>
                            <option value="3Y" ${currentLookback === '3Y' ? 'selected' : ''}>3 Years</option>
                            <option value="5Y" ${currentLookback === '5Y' ? 'selected' : ''}>5 Years</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Results -->
            <div id="optimizationResults"></div>

            <!-- Analysis Parameters Footer -->
            <div class="analysis-card mt-6 mb-8 p-6">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="text-gray-600 dark:text-gray-400">Objective:</span> <span class="font-medium text-gray-900 dark:text-white capitalize">${currentObjective.replace('_', ' ')}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Constraint:</span> <span class="font-medium text-gray-900 dark:text-white capitalize">${currentConstraint.replace('_', ' ')}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Rebalancing:</span> <span class="font-medium text-gray-900 dark:text-white capitalize">${currentRebalancing.replace('_', ' ')}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Risk Budget:</span> <span class="font-medium text-gray-900 dark:text-white capitalize">${currentRiskBudget.replace('_', ' ')}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Lookback:</span> <span class="font-medium text-gray-900 dark:text-white">${currentLookback}</span></div>
                </div>
            </div>
        `;

        // 1. Data Validation
        const optimization = result.optimization || result;
        if (!optimization || !optimization.optimal_portfolio) {
            console.error('Invalid optimization data format', result);
            document.getElementById('optimizationResults').innerHTML = '<div class="text-red-500 p-4">Error: Invalid optimization data received from server.</div>';
            return;
        }

        const { optimal_portfolio, current_portfolio, efficient_frontier } = optimization;
        const resultsContainer = document.getElementById('optimizationResults');
        if (!resultsContainer) return;

        // Helper formatting
        const fmtPct = (val) => (val * 100).toFixed(2) + '%';
        const fmtNum = (val) => val.toFixed(2);

        // 2. Prepare Chart Data (Efficient Frontier)
        const frontierData = (efficient_frontier || [])
            .sort((a, b) => a.volatility - b.volatility) // Sort by risk
            .map(pt => ({ x: pt.volatility, y: pt.expected_return }));

        // Points of Interest
        const currentPoint = { x: current_portfolio.volatility, y: current_portfolio.expected_return };
        const optimalPoint = { x: optimal_portfolio.volatility, y: optimal_portfolio.expected_return };

        // 3. Render Dashboard using Grid
        resultsContainer.innerHTML = `
                < !--Metrics Summary-- >
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="analysis-card p-4">
                    <div class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Sharpe Ratio</div>
                    <div class="mt-1 flex items-baseline">
                        <div class="text-2xl font-bold text-gray-900 dark:text-white">${fmtNum(optimal_portfolio.sharpe_ratio)}</div>
                        <span class="ml-2 text-sm ${optimal_portfolio.sharpe_ratio >= current_portfolio.sharpe_ratio ? 'text-green-600' : 'text-red-600'}">
                            vs ${fmtNum(current_portfolio.sharpe_ratio)}
                        </span>
                    </div>
                </div>
                <div class="analysis-card p-4">
                    <div class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Expected Return</div>
                    <div class="mt-1 flex items-baseline">
                        <div class="text-2xl font-bold text-gray-900 dark:text-white">${fmtPct(optimal_portfolio.expected_return)}</div>
                        <span class="ml-2 text-sm ${optimal_portfolio.expected_return >= current_portfolio.expected_return ? 'text-green-600' : 'text-red-600'}">
                            vs ${fmtPct(current_portfolio.expected_return)}
                        </span>
                    </div>
                </div>
                <div class="analysis-card p-4">
                    <div class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Annual Volatility</div>
                    <div class="mt-1 flex items-baseline">
                        <div class="text-2xl font-bold text-gray-900 dark:text-white">${fmtPct(optimal_portfolio.volatility)}</div>
                        <span class="ml-2 text-sm ${optimal_portfolio.volatility <= current_portfolio.volatility ? 'text-green-600' : 'text-red-600'}">
                            vs ${fmtPct(current_portfolio.volatility)}
                        </span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Left: Efficient Frontier Chart -->
                <div class="analysis-card p-6">
                    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Efficient Frontier</h3>
                    <div class="h-80 w-full relative">
                        <div id="frontierChart" class="w-full h-full"></div>
                    </div>
                    <div class="mt-4 text-xs text-gray-600 dark:text-gray-400 text-center">
                        X: Annualized Volatility (Risk) | Y: Expected Annual Return
                    </div>
                </div>

                <!-- Right: Allocation Table -->
                <div class="analysis-card p-6">
                    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Optimal Allocation</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-card">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Asset</th>
                                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Current</th>
                                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Optimal</th>
                                    <th class="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Change</th>
                                </tr>
                            </thead>
                            <tbody class="bg-card divide-y divide-card text-sm" id="weightsTableBody">
                                <!-- Rows injected below -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            `;

        // 4. Render Chart (Plotly)
        setTimeout(() => {
            const chartDiv = document.getElementById('frontierChart');
            if (chartDiv) {
                // Determine theme
                const isDark = document.documentElement.classList.contains('dark');
                const themeColors = {
                    text: isDark ? '#e5e7eb' : '#374151',
                    grid: isDark ? '#374151' : '#e5e7eb',
                    bg: 'rgba(0,0,0,0)',
                    tooltipBg: isDark ? '#1e293b' : '#ffffff',   // Slate-800 or White
                    tooltipBorder: isDark ? '#374151' : '#e5e7eb' // Gray-700 or Gray-200
                };

                const traceFrontier = {
                    x: frontierData.map(pt => pt.x),
                    y: frontierData.map(pt => pt.y),
                    mode: 'lines+markers', // Show points on the line
                    name: 'Efficient Frontier',
                    marker: { size: 4 },   // Small markers for the curve
                    line: { shape: 'spline', color: '#4F46E5', width: 3 }, // Indigo 600
                    hovertemplate: 'Efficient Frontier<br>Risk: %{x:.2%}<br>Return: %{y:.2%}<extra></extra>'
                };

                const traceOptimal = {
                    x: [optimalPoint.x],
                    y: [optimalPoint.y],
                    mode: 'markers',
                    name: 'Optimal Portfolio',
                    marker: { size: 14, color: '#10B981', symbol: 'star' }, // Emerald 500
                    hovertemplate: 'Optimal<br>Risk: %{x:.2%}<br>Return: %{y:.2%}<extra></extra>'
                };

                const traceCurrent = {
                    x: [currentPoint.x],
                    y: [currentPoint.y],
                    mode: 'markers',
                    name: 'Current Portfolio',
                    marker: { size: 12, color: '#EF4444', symbol: 'circle' }, // Red 500
                    hovertemplate: 'Current<br>Risk: %{x:.2%}<br>Return: %{y:.2%}<extra></extra>'
                };

                const layout = {
                    autosize: true,
                    margin: { l: 60, r: 20, t: 20, b: 50 },
                    paper_bgcolor: themeColors.bg,
                    plot_bgcolor: themeColors.bg,
                    showlegend: true,
                    legend: {
                        orientation: 'h',
                        y: 1.1,
                        x: 0.5,
                        xanchor: 'center',
                        font: { color: themeColors.text }
                    },
                    xaxis: {
                        title: { text: 'Volatility (Risk)', font: { color: themeColors.text } },
                        tickfont: { color: themeColors.text },
                        tickformat: '.1%',
                        gridcolor: themeColors.grid,
                        zerolinecolor: themeColors.grid,
                        showspikes: false,            // Disable crosshair spikes
                        showline: true
                    },
                    yaxis: {
                        title: { text: 'Expected Return', font: { color: themeColors.text } },
                        tickfont: { color: themeColors.text },
                        tickformat: '.1%',
                        gridcolor: themeColors.grid,
                        zerolinecolor: themeColors.grid,
                        showspikes: false,            // Disable crosshair spikes
                        showline: true
                    },
                    hovermode: 'closest', // Show only the nearest point (cleaner)
                    hoverdistance: 100,  // "Sticky" feel: finds points within 100px
                    spikedistance: 100,  // Show spikes when within 100px
                    dragmode: 'pan',     // Enable panning by default
                    hoverlabel: {
                        bgcolor: themeColors.tooltipBg,
                        bordercolor: themeColors.tooltipBorder,
                        font: { color: isDark ? '#ffffff' : '#1f2937' } // Removed extra styling to fix overflow
                    }
                };

                const config = {
                    responsive: true,
                    displayModeBar: false, // Hide control panels
                    scrollZoom: true,      // Enable mouse/touch zoom
                    displaylogo: false
                };

                Plotly.newPlot(chartDiv, [traceFrontier, traceOptimal, traceCurrent], layout, config);

                // Handle Resize
                window.addEventListener('resize', () => {
                    if (chartDiv && document.body.contains(chartDiv)) {
                        Plotly.Plots.resize(chartDiv);
                    }
                });

                // Dynamic Theme Handling
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'class') {
                            const isDarkNow = document.documentElement.classList.contains('dark');
                            const newColors = {
                                text: isDarkNow ? '#e5e7eb' : '#374151',
                                grid: isDarkNow ? '#374151' : '#e5e7eb',
                                bg: 'rgba(0,0,0,0)',
                                tooltipBg: isDarkNow ? '#1e293b' : '#ffffff',
                                tooltipBorder: isDarkNow ? '#374151' : '#e5e7eb'
                            };

                            const update = {
                                'font.color': newColors.text,
                                'xaxis.title.font.color': newColors.text,
                                'xaxis.tickfont.color': newColors.text,
                                'xaxis.gridcolor': newColors.grid,
                                'xaxis.zerolinecolor': newColors.grid,
                                'yaxis.title.font.color': newColors.text,
                                'yaxis.tickfont.color': newColors.text,
                                'yaxis.gridcolor': newColors.grid,
                                'yaxis.zerolinecolor': newColors.grid,
                                'paper_bgcolor': newColors.bg,
                                'plot_bgcolor': newColors.bg,
                                'legend.font.color': newColors.text,
                                'hoverlabel.bgcolor': newColors.tooltipBg,
                                'hoverlabel.bordercolor': newColors.tooltipBorder,
                                'hoverlabel.font.color': isDarkNow ? '#ffffff' : '#1f2937'
                            };

                            if (chartDiv && document.body.contains(chartDiv)) {
                                Plotly.relayout(chartDiv, update);
                            }
                        }
                    });
                });

                observer.observe(document.documentElement, { attributes: true });
            }
        }, 100);

        // 5. Render Weights Table
        const tableBody = document.getElementById('weightsTableBody');
        const weights = optimal_portfolio.weights;
        const currentWeights = current_portfolio.weights || {};

        // Union of all keys
        const allSymbols = Array.from(new Set([...Object.keys(weights), ...Object.keys(currentWeights)]));

        // Sort by optimal weight descending
        allSymbols.sort((a, b) => (weights[b] || 0) - (weights[a] || 0));

        tableBody.innerHTML = allSymbols.map(sym => {
            const curr = currentWeights[sym] || 0;
            const opt = weights[sym] || 0;
            const diff = opt - curr;

            // Skip if both are negligible
            if (Math.abs(curr) < 0.001 && Math.abs(opt) < 0.001) return '';

            return `
                < tr >
                    <td class="px-3 py-2 font-medium text-gray-900 dark:text-white">${sym}</td>
                    <td class="px-3 py-2 text-right text-gray-600 dark:text-gray-400">${fmtPct(curr)}</td>
                    <td class="px-3 py-2 text-right font-semibold text-indigo-600">${fmtPct(opt)}</td>
                    <td class="px-3 py-2 text-right ${diff > 0 ? 'text-green-600' : (diff < 0 ? 'text-red-600' : 'text-gray-500')}">
                        ${diff > 0 ? '+' : ''}${fmtPct(diff)}
                    </td>
                </tr >
                `;
        }).join('');
    }

    // Display Technical Indicators result
    displayTechnicalIndicators(result, options) {
        console.log('Technical Indicators result:', result);
        // Robust container selection
        const container = document.getElementById('enhancedTechnicalAnalysis') ||
            document.getElementById('technicalAnalysis') ||
            document.getElementById('technicalIndicators') ||
            document.getElementById(DEFAULT_CONTAINER_ID);

        if (!container) {
            console.error('Technical Indicators container not found');
            return;
        }

        const data = result.technical_analysis || {};
        const settings = options || {}; // Fix ReferenceError
        const summary = data.summary || {};
        const individual = data.individual_analysis || {};
        let portSignals = data.portfolio_signals || {};

        // Always calculate signal counts from individual analysis for consistency and chart data
        let bullishCount = 0, bearishCount = 0, neutralCount = 0, totalCount = 0;
        Object.values(individual).forEach(analysis => {
            const signal = analysis.overall_signal || 'Neutral';
            if (signal === 'Bullish') bullishCount++;
            else if (signal === 'Bearish') bearishCount++;
            else neutralCount++;
            totalCount++;
        });

        // Use calculated weights if total > 0, otherwise defaults
        if (totalCount > 0) {
            portSignals.bullish_weight = bullishCount / totalCount;
            portSignals.bearish_weight = bearishCount / totalCount;
            portSignals.neutral_weight = neutralCount / totalCount;

            // Determine overall signal based on max count
            if (bullishCount > bearishCount && bullishCount > neutralCount) portSignals.overall = 'Bullish';
            else if (bearishCount > bullishCount && bearishCount > neutralCount) portSignals.overall = 'Bearish';
            else portSignals.overall = 'Neutral';
        } else if (portSignals.bullish_weight === undefined) {
            // Fallback if no individual data and no API weights
            portSignals.bullish_weight = 0;
            portSignals.bearish_weight = 0;
            portSignals.neutral_weight = 1;
            portSignals.overall = 'Neutral';

            // Ensure weights are assigned to data object
            data.portfolio_signals = portSignals;
        }

        // Current Settings (for UI state)
        const currentPeriod = options.period || '1Y';
        const currentTimeframe = options.timeframe || 'Daily';
        const currentSignalStrength = options.signal_strength || 'Medium';
        const currentIndicators = options.indicators || ['RSI', 'MACD', 'Bollinger', 'SMA', 'EMA'];

        // Helper to check if indicator is selected
        const isIndSelected = (ind) => currentIndicators.includes(ind);

        // Parameters
        const rsiParams = options.rsi_parameters || { period: 14, oversold: 30, overbought: 70 };
        const macdParams = options.macd_parameters || { fast: 12, slow: 26, signal: 9 };
        const bbParams = options.bollinger_parameters || { period: 20, std_dev: 2 };

        const getSignalColor = (signal) => {
            if (!signal) return 'gray';
            const s = signal.toLowerCase();
            if (s.includes('bullish')) return 'green';
            if (s.includes('bearish')) return 'red';
            return 'gray';
        };

        const getSignalBadge = (signal) => {
            const color = getSignalColor(signal);
            const label = signal || 'Neutral';
            return `< span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${color}-100 text-${color}-800" >
                ${label}
            </span > `;
        };



        // Render UI - Matching P&L Attribution Style (No Apply Button, Auto-Update)
        container.innerHTML = `
                < div class="flex justify-between items-center mb-6" >
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Technical Analysis</h2>
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
                </div>
            </div >

            < !--Settings Panel-- >
            <div id="technicalSettings" class="settings-panel hidden mb-6">
                <!-- Row 1: 5-Column Grid matching P&L Attribution -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Period</label>
                        <select id="technicalPeriod" onchange="updateTechnicalAnalysis()" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white">
                            <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                            <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                            <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Timeframe</label>
                        <select id="technicalTimeframe" onchange="updateTechnicalAnalysis()" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white">
                            <option value="Daily" ${currentTimeframe === 'Daily' ? 'selected' : ''}>Daily</option>
                            <option value="Weekly" ${currentTimeframe === 'Weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="Monthly" ${currentTimeframe === 'Monthly' ? 'selected' : ''}>Monthly</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">RSI Period</label>
                        <select id="technicalRsiPeriod" onchange="updateTechnicalAnalysis()" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white">
                            <option value="14" ${settings?.rsi_period === 14 ? 'selected' : ''}>14</option>
                            <option value="21" ${settings?.rsi_period === 21 ? 'selected' : ''}>21</option>
                            <option value="30" ${settings?.rsi_period === 30 ? 'selected' : ''}>30</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">MACD Fast</label>
                        <select id="technicalMacdFast" onchange="updateTechnicalAnalysis()" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white">
                            <option value="12" ${settings?.macd_fast === 12 ? 'selected' : ''}>12</option>
                            <option value="8" ${settings?.macd_fast === 8 ? 'selected' : ''}>8</option>
                            <option value="15" ${settings?.macd_fast === 15 ? 'selected' : ''}>15</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Signal Strength</label>
                        <select id="technicalSignalStrength" onchange="updateTechnicalAnalysis()" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white">
                            <option value="Weak" ${currentSignalStrength === 'Weak' ? 'selected' : ''}>Weak</option>
                            <option value="Medium" ${currentSignalStrength === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="Strong" ${currentSignalStrength === 'Strong' ? 'selected' : ''}>Strong</option>
                        </select>
                    </div>
                </div>
                

            </div>

            <!--Summary Cards-- >
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                 <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Overall Sentiment</h3>
                    <div class="flex items-center">
                        ${getSignalBadge(portSignals.overall)}
                    </div>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Signal Breakdown</h3>
                    <div class="grid grid-cols-3 gap-1 text-center text-xs">
                        <div>
                            <div class="font-bold text-green-600">${bullishCount}</div>
                            <div>Bull</div>
                        </div>
                        <div>
                            <div class="font-bold text-red-600">${bearishCount}</div>
                            <div>Bear</div>
                        </div>
                        <div>
                            <div class="font-bold text-gray-600 dark:text-gray-400">${neutralCount}</div>
                            <div>Neut</div>
                        </div>
                    </div>
                </div>
                <div class="analysis-card p-6 col-span-2">
                    <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Signal Distribution</h3>
                     <div id="signalDistChart" class="h-32 w-full"></div>
                </div>
            </div>

            <!--Detailed Table-- >
            <div class="analysis-card overflow-hidden">
                <div class="px-6 py-4 border-b border-card">
                     <h3 class="text-lg font-medium text-gray-900 dark:text-white">Indicator Analysis</h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-card">
                        <thead class="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Overall</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">RSI</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">MACD</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Bollinger</th>
                            </tr>
                        </thead>
                        <tbody class="bg-card divide-y divide-card">
                            ${Object.entries(individual).map(([sym, details]) => `
                                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${sym}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">$${details.values?.current_price?.toFixed(2) || '0.00'}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">${getSignalBadge(details.overall_signal)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        <div class="flex flex-col">
                                            <span class="font-medium">${details.values?.rsi?.toFixed(1) || '-'}</span>
                                            <span class="text-xs text-gray-600 dark:text-gray-400">${details.signals?.rsi || '-'}</span>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                         <div class="flex flex-col">
                                            <span class="text-xs text-gray-600 dark:text-gray-400">${details.signals?.macd || '-'}</span>
                                            <span class="text-xs text-gray-600 dark:text-gray-400">H: ${details.values?.macd?.histogram.toFixed(2) || '-'}</span>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                         <span class="text-xs text-gray-600 dark:text-gray-400">${details.signals?.bollinger || '-'}</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="analysis-card mt-6 p-6">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span class="text-gray-600 dark:text-gray-400">Period:</span> <span class="font-medium text-gray-900 dark:text-white">${currentPeriod}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Timeframe:</span> <span class="font-medium text-gray-900 dark:text-white">${currentTimeframe}</span></div>
                    <div><span class="text-gray-600 dark:text-gray-400">Signal Str:</span> <span class="font-medium text-gray-900 dark:text-white">${currentSignalStrength}</span></div>
                    <div class="col-span-2"><span class="text-gray-600 dark:text-gray-400">Indicators:</span> <span class="font-medium text-gray-900 dark:text-white">${currentIndicators.join(', ')}</span></div>
                </div>
            </div>
            `;

        // Render Chart
        setTimeout(() => {
            if (!document.querySelector("#signalDistChart")) return;

            // Clean up
            if (window.techSignalChart) {
                window.techSignalChart.destroy();
                window.techSignalChart = null;
            }

            // Calculations are done above, just use them
            const rawSeries = [
                portSignals.bullish_weight,
                portSignals.bearish_weight,
                portSignals.neutral_weight
            ];

            // Validate and convert to percentages
            const series = rawSeries.map(v => {
                const num = parseFloat(v);
                return (!isNaN(num) && num >= 0) ? num * 100 : 0;
            });

            // Check if we have any data to prevent NaN errors in chart
            const totalVal = series.reduce((a, b) => a + b, 0);
            if (totalVal <= 0.01) {
                document.querySelector("#signalDistChart").innerHTML =
                    '<div class="flex items-center justify-center h-full text-gray-400 text-xs">No Signal Data</div>';
                return;
            }

            const options = {
                series: series,
                labels: ['Bullish', 'Bearish', 'Neutral'],
                colors: ['#10B981', '#EF4444', '#9CA3AF'],
                chart: {
                    type: 'donut',
                    height: 140,
                    background: 'transparent'
                },
                theme: {
                    mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
                },
                tooltip: {
                    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                    style: {
                        fontSize: '12px',
                        fontFamily: 'inherit'
                    }
                },
                dataLabels: { enabled: false },
                legend: {
                    position: 'right',
                    fontSize: '12px',
                    markers: { radius: 12 },
                    itemMargin: { horizontal: 5, vertical: 5 },
                    labels: {
                        colors: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151'
                    }
                },
                plotOptions: {
                    pie: {
                        donut: {
                            size: '75%',
                            labels: {
                                show: true,
                                name: { show: false },
                                value: {
                                    show: true,
                                    fontSize: '22px',
                                    fontWeight: 700,
                                    color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#111827',
                                    offsetY: 6,
                                    formatter: function (val) {
                                        return parseInt(val) + "%";
                                    }
                                },
                                total: {
                                    show: true,
                                    showAlways: true,
                                    label: 'Sentiment',
                                    fontSize: '12px',
                                    color: '#9ca3af',
                                    formatter: function (w) {
                                        // Show dominant sentiment in center
                                        const b = w.globals.seriesTotals[0]; // Bullish
                                        const r = w.globals.seriesTotals[1]; // Bearish
                                        return b > r ? 'Bullish' : (r > b ? 'Bearish' : 'Neutral');
                                    }
                                }
                            }
                        }
                    }
                },
                tooltip: {
                    y: { formatter: (val) => val.toFixed(1) + '%' },
                    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                    style: { fontSize: '12px', fontFamily: 'inherit' }
                },
                stroke: { show: false }
            };

            if (!options.background) {
                window.techSignalChart = new ApexCharts(document.querySelector("#signalDistChart"), options);
                window.techSignalChart.render();
            }
        }, 100);
    }

    // Display Sector Allocation result
    // Display Sector Allocation result

    // Display Performance Attribution result (Brinson)
    displayPerformanceAttribution(result, options) {
        console.log('Performance Attribution result:', result);
        const container = document.getElementById('performanceAttribution') || document.getElementById(DEFAULT_CONTAINER_ID);
        if (!container) return;

        // Extract data robustly (handle nested structures)
        const attribution = result.performance_attribution || result.return_attribution || result.attribution || result;

        // Helper for safe formatting
        const fmtNum = (val) => (val === undefined || val === null || isNaN(val)) ? '0.00' : Number(val).toFixed(2);
        const fmtPct = (val) => fmtNum(val) + '%';
        const isPos = (val) => (val || 0) >= 0;

        // --- Extract Current Settings ---
        if (!window.analyticsCore.performanceAttributionSettings) {
            window.analyticsCore.performanceAttributionSettings = {};
            // Load from localStorage
            try {
                const saved = localStorage.getItem('performanceAttributionSettings');
                if (saved) {
                    window.analyticsCore.performanceAttributionSettings = JSON.parse(saved);
                    console.log('Loaded Performance Attribution settings from localStorage');
                }
            } catch (e) {
                console.error('Failed to load attribution settings:', e);
            }
        }
        const settings = window.analyticsCore.performanceAttributionSettings;

        // Default or Saved Settings
        const currentPeriod = settings.period || '1Y';
        const currentModel = settings.attribution_model || 'brinson';
        const currentBenchmark = settings.benchmark || 'SPY';
        const currentCurrency = settings.currency || 'USD';
        const currentFrequency = settings.frequency || 'Daily';

        // 1. Header with Settings Toggle
        container.innerHTML = `
                < div class="flex justify-between items-center mb-6" >
                <div>
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Performance Attribution</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Analyze sources of return vs benchmark</p>
                </div>
                <div class="flex space-x-3">
                     <button onclick="window.togglePerformanceAttributionSettings()" class="flex items-center px-3 py-2 border border-card shadow-sm text-sm font-medium rounded-md text-gray-600 dark:text-gray-400 bg-card hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <svg class="-ml-1 mr-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01-.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                        </svg>
                        Settings
                    </button>
                    <button onclick="window.analyticsManager.loadModule('performance-attribution')" class="flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div >

            < !--2. Settings Panel-- >
            <div id="performanceAttributionSettings" class="settings-panel hidden mb-6 p-4">
                <!-- Using grid to match other modules -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Period</label>
                        <select id="performancePeriod" onchange="window.updatePerformanceAttribution()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                             <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                             <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                             <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                             <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                             <option value="YTD" ${currentPeriod === 'YTD' ? 'selected' : ''}>YTD</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Benchmark</label>
                        <select id="performanceBenchmark" onchange="window.updatePerformanceAttribution()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                             <option value="SPY" ${currentBenchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                             <option value="QQQ" ${currentBenchmark === 'QQQ' ? 'selected' : ''}>Nasdaq 100 (QQQ)</option>
                             <option value="IWM" ${currentBenchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                             <option value="VT" ${currentBenchmark === 'VT' ? 'selected' : ''}>Global Stocks (VT)</option>
                             <option value="AGG" ${currentBenchmark === 'AGG' ? 'selected' : ''}>Agg Bond (AGG)</option>
                        </select>
                    </div>
                     <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Model</label>
                        <select id="performanceModel" onchange="window.updatePerformanceAttribution()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                             <option value="brinson" ${currentModel === 'brinson' ? 'selected' : ''}>Brinson-Fachler</option>
                             <option value="holdings" ${currentModel === 'holdings' ? 'selected' : ''}>Holdings Based</option>
                        </select>
                    </div>
                     <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Currency</label>
                        <select id="performanceCurrency" onchange="window.updatePerformanceAttribution()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                             <option value="USD" ${currentCurrency === 'USD' ? 'selected' : ''}>USD</option>
                             <option value="EUR" ${currentCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                             <option value="CAD" ${currentCurrency === 'CAD' ? 'selected' : ''}>CAD</option>
                             <option value="GBP" ${currentCurrency === 'GBP' ? 'selected' : ''}>GBP</option>
                        </select>
                    </div>
                     <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Frequency</label>
                        <select id="performanceFrequency" onchange="window.updatePerformanceAttribution()" class="w-full px-3 py-2 border border-card rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-card text-gray-900 dark:text-white">
                             <option value="Daily" ${currentFrequency === 'Daily' ? 'selected' : ''}>Daily</option>
                             <option value="Weekly" ${currentFrequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
                             <option value="Monthly" ${currentFrequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
                        </select>
                    </div>
                </div>
            </div>

            <!--3. Results Dashboard-- >
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Summary Card -->
                <div class="analysis-card p-6 col-span-1 lg:col-span-3">
                     <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Attribution Summary</h3>
                     <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                             <div class="text-sm text-gray-500 dark:text-gray-400">Total Active Return</div>
                             <div class="text-2xl font-bold ${isPos(attribution.active_return) ? 'text-green-600' : 'text-red-600'}">
                                ${isPos(attribution.active_return) ? '+' : ''}${fmtPct(attribution.active_return)}
                             </div>
                        </div>
                         <div>
                             <div class="text-sm text-gray-500 dark:text-gray-400">Portfolio Return</div>
                             <div class="text-xl font-semibold text-gray-900 dark:text-white">
                                ${fmtPct(attribution.portfolio_return)}
                             </div>
                        </div>
                         <div>
                             <div class="text-sm text-gray-500 dark:text-gray-400">Benchmark Return</div>
                             <div class="text-xl font-semibold text-gray-900 dark:text-white">
                                ${fmtPct(attribution.benchmark_return)}
                             </div>
                        </div>
                        <div>
                             <div class="text-sm text-gray-500 dark:text-gray-400">Unexplained</div>
                             <div class="text-xl font-semibold text-gray-500">
                                ${(attribution.active_return - (attribution.asset_allocation + attribution.security_selection + attribution.interaction_effect + attribution.currency_effect + attribution.market_timing)) ? fmtPct(attribution.active_return - (attribution.asset_allocation + attribution.security_selection + attribution.interaction_effect + attribution.currency_effect + attribution.market_timing)) : '0.00%'}
                             </div>
                        </div>
                     </div>
                </div>

                <!-- Effects Breakdown -->
                <div class="analysis-card p-6 col-span-1 lg:col-span-3">
                    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Return Breakdown</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-card">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Effect</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                                </tr>
                            </thead>
                            <tbody class="bg-card divide-y divide-card">
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">Asset Allocation</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right ${isPos(attribution.asset_allocation) ? 'text-green-600' : 'text-red-600'} font-bold">
                                        ${isPos(attribution.asset_allocation) ? '+' : ''}${fmtPct(attribution.asset_allocation)}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">Value added by over/underweighting sectors/assets</td>
                                </tr>
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">Security Selection</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right ${isPos(attribution.security_selection) ? 'text-green-600' : 'text-red-600'} font-bold">
                                        ${isPos(attribution.security_selection) ? '+' : ''}${fmtPct(attribution.security_selection)}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">Value added by specific stock picking</td>
                                </tr>
                                 <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">Interaction</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right ${isPos(attribution.interaction_effect) ? 'text-green-600' : 'text-red-600'} font-bold">
                                        ${isPos(attribution.interaction_effect) ? '+' : ''}${fmtPct(attribution.interaction_effect)}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">Combined effect of allocation and selection</td>
                                </tr>
                                ${attribution.market_timing ? `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">Market Timing</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right ${isPos(attribution.market_timing) ? 'text-green-600' : 'text-red-600'} font-bold">
                                        ${isPos(attribution.market_timing) ? '+' : ''}${fmtPct(attribution.market_timing)}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">Value from beta adjustments over time</td>
                                </tr>` : ''}
                                 <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">Currency</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right ${isPos(attribution.currency_effect) ? 'text-green-600' : 'text-red-600'} font-bold">
                                        ${isPos(attribution.currency_effect) ? '+' : ''}${fmtPct(attribution.currency_effect)}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">Impact of foreign exchange movements</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!--Analysis Parameters-- >
                <div class="analysis-card mt-6 p-6">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Analysis Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div><span class="text-gray-600 dark:text-gray-400">Period:</span> <span class="font-medium text-gray-900 dark:text-white">${currentPeriod}</span></div>
                        <div><span class="text-gray-600 dark:text-gray-400">Model:</span> <span class="font-medium text-gray-900 dark:text-white">${currentModel}</span></div>
                        <div><span class="text-gray-600 dark:text-gray-400">Benchmark:</span> <span class="font-medium text-gray-900 dark:text-white">${currentBenchmark}</span></div>
                        <div><span class="text-gray-600 dark:text-gray-400">Currency:</span> <span class="font-medium text-gray-900 dark:text-white">${currentCurrency}</span></div>
                        <div><span class="text-gray-600 dark:text-gray-400">Frequency:</span> <span class="font-medium text-gray-900 dark:text-white">${currentFrequency}</span></div>
                    </div>
                </div>
            `;
    }

    displaySectorAllocation(result, options) {
        console.log('Sector Allocation result:', result);
        const container = document.getElementById('sectorAllocation') || document.getElementById(DEFAULT_CONTAINER_ID);
        if (!container) return;

        // LOAD SETTINGS FROM LOCAL STORAGE IF NOT IN MEMORY
        try {
            if (!window.analyticsCore) window.analyticsCore = {};
            // Only load if not already set (preserve session changes) or force merge? 
            // Better to load if empty.
            if (!window.analyticsCore.sectorSettings) {
                const saved = localStorage.getItem('sectorAllocationSettings');
                if (saved) {
                    window.analyticsCore.sectorSettings = JSON.parse(saved);
                }
            }
        } catch (e) {
            console.error('Failed to load sector settings:', e);
        }

        // Current Settings - prioritize options passed from core (which include explicit updates)
        const settings = window.analyticsCore?.sectorSettings || {};

        // Use options if available (they represent the actual parameters sent to API), fallback to global or defaults
        const currentLevel = options?.level || settings.level || 'Sector';
        const currentBenchmark = options?.benchmark || settings.benchmark || 'SPY';
        const currentView = options?.view || settings.view || 'Pie';
        const currentThreshold = parseFloat(options?.threshold !== undefined ? options.threshold : (settings.threshold || 0));
        const currentClassification = options?.classification || settings.classification || 'GICS';

        // Data Preparation
        let data = [];
        // Support both API response formats (result.analysis or result.allocation)
        const rawSource = result.analysis || result.allocation;

        if (rawSource && !Array.isArray(rawSource)) {
            // Handle Dictionary Format (New API / Sector Mapper)
            // Map UI level to API key
            let levelKey = 'sectors';
            if (currentLevel === 'Industry') levelKey = 'industries';
            else if (currentLevel === 'Sub-industry') levelKey = 'industries'; // Fallback
            else if (currentLevel === 'Country') levelKey = 'countries';

            // Attempt to find data using diverse keys
            let analysisData = rawSource[levelKey];
            if (!analysisData) {
                // Fallback for result.allocation format (comprehensive routes)
                if (levelKey === 'sectors') analysisData = rawSource['sector_allocation'];
                else if (levelKey === 'countries') analysisData = rawSource['geographic_allocation'];
                else if (levelKey === 'industries') analysisData = rawSource['industry_allocation'];
            }
            analysisData = analysisData || {};

            // Transform dictionary to array
            data = Object.entries(analysisData).map(([name, stats]) => {
                // Normalize portfolio share (handle 'percentage' 0-100 vs 'weight' 0-1)
                // Use explicit checks and defaults to avoid NaN
                let portShare = 0;
                if (stats && stats.weight !== undefined && stats.weight !== null) {
                    portShare = Number(stats.weight);
                } else if (stats && stats.percentage !== undefined && stats.percentage !== null) {
                    portShare = Number(stats.percentage) / 100;
                }
                if (isNaN(portShare)) portShare = 0;

                // Get benchmark share
                let benchShare = 0;
                if (stats && stats.benchmark_weight !== undefined && stats.benchmark_weight !== null) {
                    benchShare = Number(stats.benchmark_weight);
                }
                if (isNaN(benchShare)) benchShare = 0;

                return {
                    name: name || 'Unknown',
                    portfolio: portShare,
                    benchmark: benchShare,
                    active: portShare - benchShare
                };
            });

            // Sort by portfolio percentage descending
            data.sort((a, b) => b.portfolio - a.portfolio);
        } else {
            // Legacy array format or empty
            data = Array.isArray(rawSource) ? rawSource : [];
        }

        // Apply Threshold
        // Apply Threshold
        let filteredData = [];
        if (currentThreshold > 0) {
            let otherPort = 0;
            let otherBench = 0;
            let hasOther = false;

            data.forEach(d => {
                const pVal = Number(d.portfolio) || 0;
                const bVal = Number(d.benchmark) || 0;

                if (pVal >= currentThreshold || bVal >= currentThreshold) {
                    filteredData.push(d);
                } else {
                    hasOther = true;
                    otherPort += pVal;
                    otherBench += bVal;
                }
            });

            if (hasOther) {
                filteredData.push({
                    name: 'Other (<' + (currentThreshold * 100).toFixed(0) + '%)',
                    portfolio: otherPort,
                    benchmark: otherBench,
                    active: otherPort - otherBench
                });
            }
        } else {
            filteredData = data;
        }

        // Helper
        const fmtPct = (val) => (val * 100).toFixed(1) + '%';
        // Expanded Color Palette (20 distinct colors to minimize clashes)
        const colors = [
            '#4F46E5', // Indigo
            '#10B981', // Emerald
            '#F59E0B', // Amber
            '#EF4444', // Red
            '#8B5CF6', // Violet
            '#EC4899', // Pink
            '#06B6D4', // Cyan
            '#84CC16', // Lime
            '#F97316', // Orange
            '#6366F1', // Indigo Light
            '#14B8A6', // Teal
            '#D946EF', // Fuchsia
            '#EAB308', // Yellow
            '#64748B', // Slate
            '#A855F7', // Purple
            '#FB7185', // Rose
            '#2DD4BF', // Teal Light
            '#3B82F6', // Blue
            '#A3E635', // Lime Light
            '#9CA3AF'  // Gray
        ];

        // Consistent Color Hashing
        const getSectorColor = (name) => {
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            return colors[Math.abs(hash) % colors.length];
        };

        // Dark Mode Detection & Classes
        const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
        const bgClass = isDark ? 'bg-gray-800' : 'bg-white';
        const textClass = isDark ? 'text-white' : 'text-gray-900';
        const subTextClass = isDark ? 'text-gray-400' : 'text-gray-600';
        const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';
        const headerBgClass = isDark ? 'bg-gray-700' : 'bg-gray-50';

        // UI Shell
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold ${textClass}">Sector Allocation</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleSectorSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="window.updateSectorAllocationV2 && window.updateSectorAllocationV2()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Settings Panel -->
            <div id="sectorSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium ${subTextClass} mb-1">Classification</label>
                        <select id="sectorClassification" class="w-full px-3 py-2 border ${borderClass} rounded-md text-sm ${bgClass} ${textClass}" onchange="window.updateSectorAllocationV2()">
                            <option value="GICS" ${currentClassification === 'GICS' ? 'selected' : ''}>GICS</option>
                            <option value="ICB" ${currentClassification === 'ICB' ? 'selected' : ''}>ICB</option>
                            <option value="Custom" ${currentClassification === 'Custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium ${subTextClass} mb-1">Level</label>
                        <select id="sectorLevel" class="w-full px-3 py-2 border ${borderClass} rounded-md text-sm ${bgClass} ${textClass}" onchange="window.updateSectorAllocationV2()">
                            <option value="Sector" ${currentLevel === 'Sector' ? 'selected' : ''}>Sector</option>
                            <option value="Industry" ${currentLevel === 'Industry' ? 'selected' : ''}>Industry</option>
                            <option value="Sub-industry" ${currentLevel === 'Sub-industry' ? 'selected' : ''}>Sub-industry</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium ${subTextClass} mb-1">Benchmark</label>
                        <select id="sectorBenchmark" class="w-full px-3 py-2 border ${borderClass} rounded-md text-sm ${bgClass} ${textClass}" onchange="window.updateSectorAllocationV2()">
                            <option value="None" ${currentBenchmark === 'None' ? 'selected' : ''}>None</option>
                            <option value="SPY" ${currentBenchmark === 'SPY' || currentBenchmark === 'S&P 500' ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="IWM" ${currentBenchmark === 'IWM' || currentBenchmark === 'Russell 3000' ? 'selected' : ''}>Russell 3000 (IWM)</option>
                            <option value="URTH" ${currentBenchmark === 'URTH' || currentBenchmark === 'MSCI World' ? 'selected' : ''}>MSCI World (URTH)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium ${subTextClass} mb-1">View</label>
                        <select id="sectorView" class="w-full px-3 py-2 border ${borderClass} rounded-md text-sm ${bgClass} ${textClass}" onchange="window.updateSectorAllocationV2()">
                            <option value="Pie" ${currentView === 'Pie' ? 'selected' : ''}>Pie Chart</option>
                            <option value="Bar" ${currentView === 'Bar' ? 'selected' : ''}>Bar Chart</option>
                            <option value="Treemap" ${currentView === 'Treemap' ? 'selected' : ''}>Treemap</option>
                        </select>
                    </div>
                     <div>
                        <label class="block text-sm font-medium ${subTextClass} mb-1">Threshold</label>
                        <select id="sectorThreshold" class="w-full px-3 py-2 border ${borderClass} rounded-md text-sm ${bgClass} ${textClass}" onchange="window.updateSectorAllocationV2()">
                            <option value="0" ${currentThreshold == 0 ? 'selected' : ''}>All</option>
                            <option value="0.01" ${currentThreshold == 0.01 ? 'selected' : ''}>> 1%</option>
                            <option value="0.05" ${currentThreshold == 0.05 ? 'selected' : ''}>> 5%</option>
                            <option value="0.10" ${currentThreshold == 0.10 ? 'selected' : ''}>> 10%</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-8 mb-6">
                <!-- Top: Chart -->
                <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6">
                    <h3 class="text-lg font-medium ${textClass} mb-4">${currentLevel} Analysis</h3>
                    <div id="sectorChartContainer" class="h-80 w-full relative">
                        <!-- Chart injected here -->
                    </div>
                </div>

                <!-- Bottom: Table -->
                <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6">
                    <h3 class="text-lg font-medium ${textClass} mb-4">Detailed Breakdown</h3>
                    <div class="overflow-x-auto max-h-80 overflow-y-auto">
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
                            <thead class="${headerBgClass} sticky top-0">
                                <tr>
                                    <th class="px-2 py-2 text-left text-xs font-medium ${subTextClass} uppercase tracking-wider">Name</th>
                                    <th class="px-2 py-2 text-right text-xs font-medium ${subTextClass} uppercase tracking-wider">Port%</th>
                                    ${currentBenchmark !== 'None' ? `<th class="px-2 py-2 text-right text-xs font-medium ${subTextClass} uppercase tracking-wider">Bench%</th>` : ''}
                                    ${currentBenchmark !== 'None' ? `<th class="px-2 py-2 text-right text-xs font-medium ${subTextClass} uppercase tracking-wider">Active%</th>` : ''}
                                </tr>
                            </thead>
                            <tbody class="${bgClass} divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                ${filteredData.map((row, i) => `
                                    <tr>
                                        <td class="px-2 py-2 font-medium ${textClass} flex items-center text-xs">
                                            <span class="w-2 h-2 rounded-full mr-1" style="background-color: ${getSectorColor(row.name)}"></span>
                                            ${row.name}
                                        </td>
                                        <td class="px-2 py-2 text-right font-medium text-xs ${textClass}">${fmtPct(row.portfolio)}</td>
                                        ${currentBenchmark !== 'None' ? `<td class="px-2 py-2 text-right ${subTextClass} text-xs">${row.benchmark > 0 ? fmtPct(row.benchmark) : '-'}</td>` : ''}
                                        ${currentBenchmark !== 'None' ? `<td class="px-2 py-2 text-right text-xs ${row.active > 0 ? 'text-green-600' : (row.active < 0 ? 'text-red-600' : 'text-gray-400')}">
                                            ${row.active > 0 ? '+' : ''}${fmtPct(row.active)}
                                        </td>` : ''}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
             <!-- Analysis Parameters -->
                <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6 mt-6">
                    <h4 class="text-sm font-semibold ${textClass} mb-3">Analysis Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span class="${subTextClass}">Classification:</span> <span class="font-medium ${textClass}">${currentClassification}</span></div>
                        <div><span class="${subTextClass}">Level:</span> <span class="font-medium ${textClass}">${currentLevel}</span></div>
                        <div><span class="${subTextClass}">Benchmark:</span> <span class="font-medium ${textClass}">${currentBenchmark}</span></div>
                        <div><span class="${subTextClass}">View:</span> <span class="font-medium ${textClass}">${currentView} Chart</span></div>
                        <div><span class="${subTextClass}">Threshold:</span> <span class="font-medium ${textClass}">${currentThreshold > 0 ? '> ' + (currentThreshold * 100).toFixed(0) + '%' : 'All'}</span></div>
                    </div>
                </div>
            `;

        // Render Chart Logic - ApexCharts Upgrade
        setTimeout(() => {
            const chartContainer = document.getElementById('sectorChartContainer');
            if (!chartContainer) return;

            // Cleanup existing charts
            chartContainer.innerHTML = '';
            if (window.sectorApexChart) {
                window.sectorApexChart.destroy();
                window.sectorApexChart = null;
            }

            // Helper formatting (ensure they exist)
            const fmtPct = (val) => (val * 100).toFixed(2) + '%';

            // Theme Detection
            const isDark = document.documentElement.classList.contains('dark');
            const themeColors = {
                text: isDark ? '#e5e7eb' : '#374151',
                grid: isDark ? '#374151' : '#e5e7eb',
                borderColor: isDark ? '#4b5563' : '#e2e8f0'
            };

            // Common Options
            const commonOptions = {
                chart: {
                    background: 'transparent',
                    toolbar: { show: false },
                    animations: { enabled: true, easing: 'easeinout', speed: 800 },
                    foreColor: themeColors.text
                },
                theme: {
                    mode: isDark ? 'dark' : 'light',
                    palette: 'palette1'
                },
                colors: colors,
                dataLabels: { enabled: true, dropShadow: { enabled: false } },
                legend: { position: 'right', fontFamily: 'Inter, sans-serif' },
                tooltip: {
                    theme: isDark ? 'dark' : 'light',
                    style: {
                        fontSize: '12px',
                        fontFamily: 'Inter, sans-serif'
                    },
                    x: { show: true },
                    y: {
                        formatter: (val) => fmtPct(val),
                        title: {
                            formatter: (seriesName) => seriesName + ':'
                        }
                    },
                    marker: { show: true }
                }
            };

            let apexOptions = {};

            // Helper to safely get number
            const safeNum = (v) => {
                if (v === null || v === undefined || isNaN(v)) return 0;
                return Number(v);
            };

            if (currentView === 'Treemap') {
                // ApexCharts Treemap
                // Treemap requires POSITIVE values for area calculation. Filter out 0 or negative.
                const seriesData = filteredData
                    .map(d => ({
                        x: d.name,
                        y: safeNum(d.portfolio)
                    }))
                    .filter(item => item.y > 0);

                apexOptions = {
                    ...commonOptions,
                    series: [{ data: seriesData }],
                    chart: { ...commonOptions.chart, type: 'treemap', height: 320 },
                    dataLabels: {
                        enabled: true,
                        style: { fontSize: '12px', fontWeight: 'bold' },
                        formatter: function (text, op) {
                            return [text, fmtPct(op.value)];
                        }
                    },
                    plotOptions: {
                        treemap: {
                            distributed: true,
                            enableShades: false
                        }
                    }
                };

            } else if (currentView === 'Bar') {
                // ApexCharts Bar (Horizontal)
                const categories = filteredData.map(d => d.name);
                const pfSeries = filteredData.map(d => safeNum(d.portfolio));

                const series = [{ name: 'Portfolio', data: pfSeries }];

                // Add Benchmark if present
                if (currentBenchmark !== 'None') {
                    const bmSeries = filteredData.map(d => safeNum(d.benchmark));
                    series.push({ name: currentBenchmark, data: bmSeries });
                }

                apexOptions = {
                    ...commonOptions,
                    series: series,
                    chart: { ...commonOptions.chart, type: 'bar', height: 320 },
                    plotOptions: {
                        bar: {
                            horizontal: true,
                            borderRadius: 4,
                            barHeight: '70%',
                            dataLabels: { position: 'center' } // inside bar
                        }
                    },
                    xaxis: {
                        categories: categories,
                        labels: {
                            formatter: (val) => (val * 100).toFixed(0) + '%',
                            style: { colors: themeColors.text }
                        }
                    },
                    dataLabels: {
                        enabled: true,
                        formatter: (val) => (val * 100).toFixed(1) + '%',
                        style: { colors: ['#fff'] }
                    },
                    grid: { borderColor: themeColors.grid }
                };

            } else {
                // ApexCharts Pie (Donut) - Default
                const labels = filteredData.map(d => d.name);
                const values = filteredData.map(d => safeNum(d.portfolio));
                const totalVal = values.reduce((a, b) => a + b, 0);

                if (totalVal <= 0) {
                    chartContainer.innerHTML = `
                        <div class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
                            No allocation data to display
                        </div>`;
                    return;
                }

                apexOptions = {
                    ...commonOptions,
                    series: values,
                    labels: labels,
                    chart: { ...commonOptions.chart, type: 'donut', height: 320 },
                    plotOptions: {
                        pie: {
                            donut: {
                                size: '65%',
                                labels: {
                                    show: true,
                                    name: { show: true, fontSize: '14px', fontFamily: 'Inter, sans-serif' },
                                    value: {
                                        show: true,
                                        fontSize: '16px',
                                        fontFamily: 'Inter, sans-serif',
                                        formatter: (val) => fmtPct(val)
                                    },
                                    total: {
                                        show: true,
                                        showAlways: true,
                                        label: 'Total',
                                        formatter: () => '100%'
                                    }
                                }
                            }
                        }
                    },
                    dataLabels: { enabled: false }, // Use legend and center for info
                    stroke: { show: false }
                };
            }

            // Render
            if (!options.background) {
                window.sectorApexChart = new ApexCharts(document.querySelector("#sectorChartContainer"), apexOptions);
                window.sectorApexChart.render();
            }

        }, 100);
    }

    displayStrategyBacktesting(result, options) {
        console.log('[AnalyticsManager] displayStrategyBacktesting received result:', result);
        console.log('[AnalyticsManager] displayStrategyBacktesting received options:', options);

        // Try to find the specific container, or fallback to generic analysis container
        let container = document.getElementById('strategyBacktesting') ||
            document.getElementById('backtestingResults') ||
            document.getElementById(DEFAULT_CONTAINER_ID);

        console.log('[AnalyticsManager] Container found:', container?.id || 'NONE');

        if (!container) {
            console.error('[AnalyticsManager] No suitable container found for strategy backtesting');
            console.error('[AnalyticsManager] Available elements:', {
                strategyBacktesting: !!document.getElementById('strategyBacktesting'),
                backtestingResults: !!document.getElementById('backtestingResults'),
                analysisContent: !!document.getElementById(DEFAULT_CONTAINER_ID)
            });
            return;
        }

        // If using the generic container, clear it first (removes spinner)
        if (container.id === 'analysisContent') {
            console.log('[AnalyticsManager] Using analysisContent container, creating wrapper');
            container.innerHTML = '';
            // Create a wrapper to match expected structure if needed, or just render directly
            const wrapper = document.createElement('div');
            wrapper.id = 'strategyBacktesting';
            container.appendChild(wrapper);
            container = wrapper;
        }

        console.log('[AnalyticsManager] Final container for rendering:', container.id);



        const backtestResults = result.backtesting_results || result.results || result;
        const performanceMetrics = backtestResults.performance_metrics || {};
        const riskMetrics = backtestResults.risk_metrics || {};
        const equityCurve = backtestResults.equity_curve || [];

        // Get parameters from multiple sources with proper fallbacks
        const apiParams = result.parameters || {};
        const settingsParams = window.analyticsCore?.backtestSettings || {};

        // Merge parameters with priority: API response > stored settings > defaults
        const parameters = {
            period: apiParams.backtest_period || apiParams.period || settingsParams.period || '6M',
            rebalancing: apiParams.rebalancing || settingsParams.rebalancing || 'Quarterly',
            transactionCosts: apiParams.transaction_costs !== undefined ? apiParams.transaction_costs :
                (apiParams.transactionCosts !== undefined ? apiParams.transactionCosts :
                    (settingsParams.transactionCosts !== undefined ? settingsParams.transactionCosts : 0.001)),
            benchmark: apiParams.benchmark || settingsParams.benchmark || 'SPY',
            riskModel: apiParams.risk_model || settingsParams.riskModel || 'historical'
        };

        console.log('[AnalyticsManager] Final parameters for display:', parameters);

        // Helper for formatting with color coding
        const fmtPct = (val) => {
            if (val === null || val === undefined || isNaN(val)) return 'N/A';
            return (val * 100).toFixed(2) + '%';
        };
        const fmtNum = (val) => {
            if (val === null || val === undefined || isNaN(val)) return 'N/A';
            return val.toFixed(2);
        };



        // Better Helper that supports the tiered coloring from before but maps to standard classes where possible, or tailwind
        const getColorClass = (value, type) => {
            if (value === null || value === undefined || isNaN(value)) return 'text-gray-400';

            switch (type) {
                case 'return':
                    return value >= 0 ? 'text-green-600' : 'text-red-600';
                case 'ratio':
                    if (value >= 1.5) return 'text-green-600';
                    if (value >= 1.0) return 'text-yellow-600';
                    if (value >= 0.5) return 'text-orange-600';
                    return 'text-red-600';
                case 'drawdown':
                    // Drawdown is typically 0 to -1. Or 0 to 1 magnitude
                    const mag = Math.abs(value);
                    if (mag <= 0.05) return 'text-green-600';
                    if (mag <= 0.10) return 'text-yellow-600';
                    if (mag <= 0.20) return 'text-orange-600';
                    return 'text-red-600';
                case 'winrate':
                    if (value >= 0.70) return 'text-green-600';
                    if (value >= 0.60) return 'text-yellow-600';
                    if (value >= 0.50) return 'text-orange-600';
                    return 'text-red-600';
                default:
                    return 'text-gray-900';
            }
        };

        container.innerHTML = `
                < div class="flex justify-between items-center mb-6" >
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Strategy Backtesting</h2>
                <div class="flex items-center space-x-2">
                    <button onclick="toggleBacktestSettingsPanel()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                        Settings
                    </button>
                    <button onclick="window.updateStrategyBacktesting && window.updateStrategyBacktesting()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div >

            <div id="backtestSettings" class="settings-panel hidden mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Backtest Period</label>
                        <select id="backtestPeriod" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="window.updateStrategyBacktesting()">
                            <option value="6M" ${parameters.period === '6M' ? 'selected' : ''}>6 Months</option>
                            <option value="1Y" ${parameters.period === '1Y' || !parameters.period ? 'selected' : ''}>1 Year</option>
                            <option value="3Y" ${parameters.period === '3Y' ? 'selected' : ''}>3 Years</option>
                            <option value="5Y" ${parameters.period === '5Y' ? 'selected' : ''}>5 Years</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Rebalancing</label>
                        <select id="backtestRebalancing" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="window.updateStrategyBacktesting()">
                            <option value="Monthly" ${parameters.rebalancing === 'Monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="Quarterly" ${parameters.rebalancing === 'Quarterly' || !parameters.rebalancing ? 'selected' : ''}>Quarterly</option>
                            <option value="Semi-annual" ${parameters.rebalancing === 'Semi-annual' ? 'selected' : ''}>Semi-annual</option>
                            <option value="Annually" ${parameters.rebalancing === 'Annually' ? 'selected' : ''}>Annually</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Transaction Costs</label>
                        <select id="backtestCosts" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="window.updateStrategyBacktesting()">
                            <option value="0.000" ${parameters.transactionCosts === 0 ? 'selected' : ''}>0%</option>
                            <option value="0.001" ${parameters.transactionCosts === 0.001 || parameters.transactionCosts === undefined ? 'selected' : ''}>0.1%</option>
                            <option value="0.0025" ${parameters.transactionCosts === 0.0025 ? 'selected' : ''}>0.25%</option>
                            <option value="0.005" ${parameters.transactionCosts === 0.005 ? 'selected' : ''}>0.5%</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Benchmark</label>
                        <select id="backtestBenchmark" class="w-full px-3 py-2 border border-card rounded-md text-sm bg-card text-gray-900 dark:text-white" onchange="window.updateStrategyBacktesting()">
                            <option value="SPY" ${parameters.benchmark === 'SPY' || !parameters.benchmark ? 'selected' : ''}>S&P 500 (SPY)</option>
                            <option value="QQQ" ${parameters.benchmark === 'QQQ' ? 'selected' : ''}>Nasdaq 100 (QQQ)</option>
                            <option value="IWM" ${parameters.benchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                            <option value="AGG" ${parameters.benchmark === 'AGG' ? 'selected' : ''}>US Aggregate Bond (AGG)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div class="space-y-3">
                    <h4 class="section-header">Performance Metrics</h4>
                    <div class="metric-row">
                        <span class="metric-label">Total Return</span>
                        <span class="metric-value ${getColorClass(performanceMetrics.total_return, 'return')}">
                            ${fmtPct(performanceMetrics.total_return)}
                        </span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Sharpe Ratio</span>
                        <span class="metric-value ${getColorClass(performanceMetrics.sharpe_ratio, 'ratio')}">${fmtNum(performanceMetrics.sharpe_ratio)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Max Drawdown</span>
                        <span class="metric-value ${getColorClass(riskMetrics.max_drawdown, 'drawdown')}">${fmtPct(riskMetrics.max_drawdown)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Win Rate</span>
                        <span class="metric-value ${getColorClass(performanceMetrics.win_rate, 'winrate')}">${fmtPct(performanceMetrics.win_rate)}</span>
                    </div>
                </div>
                
                <div class="space-y-3">
                    <h4 class="section-header">Risk Analysis</h4>
                    <div class="metric-row">
                        <span class="metric-label">Volatility</span>
                        <span class="metric-value text-gray-900 dark:text-white">${fmtPct(riskMetrics.volatility)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Beta</span>
                        <span class="metric-value text-gray-900 dark:text-white">${fmtNum(riskMetrics.beta)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Alpha</span>
                        <span class="metric-value ${getColorClass(performanceMetrics.alpha, 'return')}">${fmtPct(performanceMetrics.alpha)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Profitable Trades</span>
                        <span class="metric-value text-gray-900 dark:text-white">${performanceMetrics.profitable_trades !== undefined ? performanceMetrics.profitable_trades : 'N/A'}</span>
                    </div>
                </div>
            </div>

            <!--Chart Container Placeholder-- >
            <div id="backtestChartContainer" class="analysis-card p-6 mb-6 hidden">
                <div id="backtestChart" style="width:100%; height:400px;"></div>
            </div>

            <!--Analysis Parameters-- >
                <div class="analysis-card p-6 mb-6">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Analysis Parameters</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span class="text-gray-600 dark:text-gray-400">Period:</span> <span class="font-medium text-gray-900 dark:text-white">${parameters.period}</span></div>
                        <div><span class="text-gray-600 dark:text-gray-400">Rebalancing:</span> <span class="font-medium text-gray-900 dark:text-white">${parameters.rebalancing}</span></div>
                        <div><span class="text-gray-600 dark:text-gray-400">Costs:</span> <span class="font-medium text-gray-900 dark:text-white">${(parameters.transactionCosts * 100).toFixed(2)}%</span></div>
                        <div><span class="text-gray-600 dark:text-gray-400">Benchmark:</span> <span class="font-medium text-gray-900 dark:text-white">${parameters.benchmark}</span></div>
                    </div>
                </div>
            `;

        // Render Chart if available
        if (equityCurve && equityCurve.length > 0) {
            // Show chart container
            const chartContainer = document.getElementById('backtestChartContainer');
            if (chartContainer) {
                chartContainer.classList.remove('hidden');
            }

            // Render chart using ApexCharts in a timeout to ensure container is visible and sized
            setTimeout(() => {
                if (window.ApexCharts && document.querySelector("#backtestChart")) {
                    // Validate and format data
                    // Validate and format data for time-series - FIX NAN ERROR
                    const chartData = equityCurve
                        .map(p => {
                            if (!p || !p.date || p.equity === undefined || p.equity === null) return null;
                            const timestamp = new Date(p.date).getTime();
                            const val = parseFloat(p.equity);
                            if (isNaN(timestamp) || isNaN(val) || !isFinite(val)) return null;
                            return { x: timestamp, y: val };
                        })
                        .filter(p => p !== null)
                        .sort((a, b) => a.x - b.x);

                    if (chartData.length === 0) {
                        console.warn('No valid equity curve points found');
                        document.getElementById('backtestChart').innerHTML = '<p class="text-center text-gray-500 py-10">No valid chart data available</p>';
                        return;
                    }

                    // Destroy existing if any
                    if (window.backtestChartInstance) {
                        try { window.backtestChartInstance.destroy(); } catch (e) { }
                    }

                    // Detect current theme
                    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

                    const options = {
                        series: [{
                            name: 'Portfolio Value',
                            data: chartData
                        }],
                        chart: {
                            type: 'area',
                            height: 350,
                            toolbar: {
                                show: true,
                                tools: {
                                    download: false,
                                    selection: true,
                                    zoom: true,
                                    zoomin: true,
                                    zoomout: true,
                                    pan: true,
                                    reset: true
                                },
                                autoSelected: 'zoom'
                            },
                            animations: {
                                enabled: true,
                                easing: 'easeinout',
                                speed: 800,
                                animateGradually: {
                                    enabled: true,
                                    delay: 150
                                },
                                dynamicAnimation: {
                                    enabled: true,
                                    speed: 350
                                }
                            },
                            background: 'transparent',
                            foreColor: isDarkMode ? '#9CA3AF' : '#6B7280',
                            zoom: {
                                enabled: true,
                                type: 'x',
                                autoScaleYaxis: true
                            }
                        },
                        dataLabels: { enabled: false },
                        markers: {
                            size: 0,
                            colors: undefined,
                            strokeColors: '#fff',
                            strokeWidth: 2,
                            strokeOpacity: 0.9,
                            strokeDashArray: 0,
                            fillOpacity: 1,
                            discrete: [],
                            shape: "circle",
                            radius: 2,
                            offsetX: 0,
                            offsetY: 0,
                            onClick: undefined,
                            onDblClick: undefined,
                            showNullDataPoints: true,
                            hover: {
                                size: 5,
                                sizeOffset: 3
                            }
                        },
                        stroke: {
                            curve: 'smooth',
                            width: 2,
                            colors: [isDarkMode ? '#818CF8' : '#4F46E5']
                        },
                        xaxis: {
                            type: 'datetime', // Use datetime axis for robustness
                            crosshairs: {
                                show: true,
                                width: 1,
                                position: 'back',
                                opacity: 0.9,
                                stroke: {
                                    color: isDarkMode ? '#6B7280' : '#b6b6b6',
                                    width: 1,
                                    dashArray: 3,
                                },
                                fill: {
                                    type: 'solid',
                                    color: isDarkMode ? '#374151' : '#B1B9C4',
                                    gradient: {
                                        colorFrom: isDarkMode ? '#374151' : '#D8E3F0',
                                        colorTo: isDarkMode ? '#4B5563' : '#BED1E6',
                                        stops: [0, 100],
                                        opacityFrom: 0.4,
                                        opacityTo: 0.5,
                                    },
                                }
                            },
                            title: {
                                text: 'Date',
                                style: {
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: isDarkMode ? '#9CA3AF' : '#6B7280'
                                }
                            },
                            labels: {
                                show: true,
                                rotate: -45,
                                rotateAlways: false,
                                hideOverlappingLabels: true,
                                showDuplicates: false,
                                trim: false,
                                style: {
                                    fontSize: '11px',
                                    colors: isDarkMode ? '#9CA3AF' : '#6B7280'
                                }
                            },
                            axisBorder: {
                                show: true,
                                color: isDarkMode ? '#4B5563' : '#E5E7EB'
                            },
                            axisTicks: {
                                show: true,
                                color: isDarkMode ? '#4B5563' : '#E5E7EB'
                            },
                            tooltip: { enabled: true },
                            tickAmount: chartData.length > 10 ? Math.min(12, Math.floor(chartData.length / 5)) : undefined
                        },
                        yaxis: {
                            title: {
                                text: 'Portfolio Value',
                                style: {
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: isDarkMode ? '#9CA3AF' : '#6B7280'
                                }
                            },
                            labels: {
                                formatter: function (value) {
                                    if (value == null || isNaN(value)) return '$0';
                                    // Handle different value ranges
                                    if (value >= 1000000) {
                                        return '$' + (value / 1000000).toFixed(2) + 'M';
                                    } else if (value >= 1000) {
                                        return '$' + (value / 1000).toFixed(1) + 'k';
                                    } else if (value >= 1) {
                                        return '$' + value.toFixed(2);
                                    } else {
                                        // For normalized values (0-1 range)
                                        return value.toFixed(3);
                                    }
                                },
                                style: {
                                    colors: isDarkMode ? '#9CA3AF' : '#6B7280'
                                }
                            },
                            axisBorder: {
                                show: true,
                                color: isDarkMode ? '#4B5563' : '#E5E7EB'
                            },
                            axisTicks: {
                                show: true,
                                color: isDarkMode ? '#4B5563' : '#E5E7EB'
                            }
                        },
                        grid: {
                            borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                            strokeDashArray: 4,
                            xaxis: {
                                lines: { show: true }
                            },
                            yaxis: {
                                lines: { show: true }
                            }
                        },
                        theme: { mode: isDarkMode ? 'dark' : 'light' },
                        colors: [isDarkMode ? '#818CF8' : '#4F46E5'],
                        fill: {
                            type: 'gradient',
                            gradient: {
                                shadeIntensity: 1,
                                opacityFrom: isDarkMode ? 0.5 : 0.7,
                                opacityTo: isDarkMode ? 0.7 : 0.9,
                                stops: [0, 90, 100]
                            }
                        },
                        tooltip: {
                            theme: isDarkMode ? 'dark' : 'light',
                            x: {
                                format: 'dd MMM yyyy'
                            },
                            y: {
                                formatter: function (value, { series, seriesIndex, dataPointIndex, w }) {
                                    let formattedValue = '';
                                    if (value == null || isNaN(value)) formattedValue = '$0';
                                    else if (value >= 1000000) formattedValue = '$' + (value / 1000000).toFixed(2) + 'M';
                                    else if (value >= 1000) formattedValue = '$' + (value / 1000).toFixed(2) + 'k';
                                    else if (value >= 1) formattedValue = '$' + value.toFixed(2);
                                    else formattedValue = value.toFixed(3);

                                    // Calculate daily return
                                    if (dataPointIndex > 0 && w && w.globals && w.globals.series) {
                                        const prevValue = w.globals.series[seriesIndex][dataPointIndex - 1];
                                        if (prevValue && prevValue !== 0) {
                                            const change = ((value - prevValue) / prevValue) * 100;
                                            const sign = change >= 0 ? '+' : '';
                                            return formattedValue + ` (${sign}${change.toFixed(2)} %)`;
                                        }
                                    }
                                    return formattedValue;
                                }
                            }
                        }
                    };

                    if (!options.background) {
                        window.backtestChartInstance = new ApexCharts(document.querySelector("#backtestChart"), options);
                        window.backtestChartInstance.render();
                    }
                } else {
                    console.warn('ApexCharts not loaded or container missing');
                    const chartEl = document.getElementById('backtestChart');
                    if (chartEl) chartEl.innerHTML = '<p class="text-center text-gray-500">Chart library not loaded</p>';
                }
            }, 100);
        }
    }

    // Duplicate displayReturnAttribution removed

}

// Create global instance
window.analyticsManager = new AnalyticsManager();

// Export the class for external use
window.AnalyticsManager = AnalyticsManager;

// Options pagination and filtering functions
window.changeOptionsPage = (newPage) => {
    if (!window.filteredOptionsOpportunities) return;

    const itemsSelect = document.getElementById('optItemsPerPage');
    const itemsPerPageVal = itemsSelect ? itemsSelect.value : '10';

    let itemsPerPage = 10;
    if (itemsPerPageVal === 'all') {
        itemsPerPage = Math.max(window.filteredOptionsOpportunities.length, 1);
    } else {
        itemsPerPage = parseInt(itemsPerPageVal);
    }

    const totalPages = Math.ceil(window.filteredOptionsOpportunities.length / itemsPerPage);

    if (newPage < 1) newPage = 1;
    if (newPage > totalPages && totalPages > 0) newPage = totalPages;

    window.optionsCurrentPage = newPage;

    // Update pagination UI
    const startNum = ((newPage - 1) * itemsPerPage) + 1;
    const endNum = Math.min(newPage * itemsPerPage, window.filteredOptionsOpportunities.length);

    document.getElementById('optStart').textContent = window.filteredOptionsOpportunities.length > 0 ? startNum : 0;
    document.getElementById('optEnd').textContent = endNum;
    document.getElementById('optTotal').textContent = window.filteredOptionsOpportunities.length;
    document.getElementById('optPageIndicator').textContent = `Page ${newPage} of ${totalPages || 1} `;

    // Render Table Rows
    const startIdx = (newPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageItems = window.filteredOptionsOpportunities.slice(startIdx, endIdx);

    const tbody = document.getElementById('optionsOpportunitiesBody');
    if (tbody) {
        tbody.innerHTML = pageItems.map(opp => {
            // Normalize Data Fields
            const expiry = opp.expiration || opp.expiry || 'N/A';
            // Delta is top-level in python backend
            const delta = opp.delta !== undefined ? opp.delta : (opp.greeks?.delta);
            const deltaDisplay = delta !== undefined && delta !== null ? delta.toFixed(2) : 'N/A';

            // IV is not currently returned by backend
            const ivDisplay = opp.iv !== undefined ? (opp.iv * 100).toFixed(1) + '%' : 'N/A';

            // Normalize Return Logic
            let returnDisplay = '0.0%';
            let returnVal = 0;

            if (opp.annualized_return !== undefined) {
                // Covered Calls send annualized_return as decimal (0.15 for 15%)
                returnVal = opp.annualized_return;
                returnDisplay = (returnVal * 100).toFixed(1) + '%';
            } else if (opp.profit_potential !== undefined) {
                // Collars send profit_potential as PERCENTAGE (15.0 for 15%)
                returnVal = opp.profit_potential / 100;
                returnDisplay = opp.profit_potential.toFixed(1) + '%';
            } else if (opp.protection_cost_pct !== undefined) {
                // Protective puts have cost, not return. Show cost in red.
                returnVal = -1 * (opp.protection_cost_pct / 100);
                returnDisplay = '-' + opp.protection_cost_pct.toFixed(1) + '% (Cost)';
            }

            // Strategy Name Formatting
            const strategyName = opp.strategy ? opp.strategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'N/A';
            const returnColor = returnVal >= 0 ? 'text-green-600' : 'text-red-600';

            return `
                < tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" >
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${opp.symbol}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">${strategyName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">${expiry}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">${opp.strike || opp.call_strike || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">$${opp.premium?.toFixed(2) || opp.net_premium?.toFixed(2) || '0.00'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 text-right">${deltaDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 text-right">${ivDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${returnColor} text-right font-bold">${returnDisplay}</td>
            </tr > `;
        }).join('');
    }
};

window.filterOptionsStrategies = () => {
    if (!window.optionsOpportunities) return;

    const symbolFilter = document.getElementById('optionsSymbolFilter')?.value || 'all';

    // Filter data
    let filtered = window.optionsOpportunities;
    if (symbolFilter !== 'all') {
        filtered = filtered.filter(opp => opp.symbol === symbolFilter);
    }
    window.filteredOptionsOpportunities = filtered;

    // Update Summary Cards
    const totalCount = filtered.length;

    // Calculate Avg Return properly normalizing percentages
    let totalReturnSum = 0;
    let returnCount = 0;
    let totalPremiumVal = 0;

    filtered.forEach(opp => {
        // Accumulate Premium
        totalPremiumVal += (opp.premium || opp.net_premium || 0);

        // Accumulate Return
        if (opp.annualized_return !== undefined) {
            totalReturnSum += opp.annualized_return; // decimal
            returnCount++;
        } else if (opp.profit_potential !== undefined) {
            totalReturnSum += (opp.profit_potential / 100); // convert percent to decimal
            returnCount++;
        }
    });

    const avgReturn = returnCount > 0
        ? (totalReturnSum / returnCount * 100).toFixed(1)
        : "0.0";

    const summaryContainer = document.getElementById('optionsSummaryCards');
    if (summaryContainer) {
        summaryContainer.innerHTML = `
                < div class="analysis-card p-4 border-l-4 border-indigo-500" >
                <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Opportunities</div>
                <div class="text-2xl font-bold text-gray-900 dark:text-white">${totalCount}</div>
            </div >
            <div class="analysis-card p-4 border-l-4 border-green-500">
                <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Est. Avg Return</div>
                <div class="text-2xl font-bold text-gray-900 dark:text-white">${avgReturn}%</div>
            </div>
            <div class="analysis-card p-4 border-l-4 border-blue-500">
                <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Total Potential Premium</div>
                <div class="text-2xl font-bold text-gray-900 dark:text-white">$${Math.round(totalPremiumVal).toLocaleString()}</div>
            </div>
            `;
    }

    // Reset to first page and render
    window.changeOptionsPage(1);
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
    const container = document.getElementById(DEFAULT_CONTAINER_ID);
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
    const container = document.getElementById(DEFAULT_CONTAINER_ID);
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

    // Save to localStorage
    try {
        localStorage.setItem('performanceAttributionSettings', JSON.stringify(window.analyticsCore.performanceAttributionSettings));
        console.log('[Performance Attribution] Saved settings to localStorage');
    } catch (e) {
        console.error('Failed to save performance attribution settings:', e);
    }

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
    const strategy = document.getElementById('optionsStrategy')?.value;
    const minPremium = document.getElementById('optionsMinPremium')?.value;
    const deltaRange = document.getElementById('optionsDeltaRange')?.value;

    if (!expiration || !moneyness || !strategy || !minPremium || !deltaRange) {
        console.error('Missing required options settings');
        return;
    }

    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.optionsSettings = {
        expiration,
        moneyness,
        strategy,
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

    // Save to localStorage
    try {
        localStorage.setItem('monteCarloSettings', JSON.stringify(window.analyticsCore.monteCarloSettings));
    } catch (e) {
        console.error('Failed to save Monte Carlo settings:', e);
    }

    window.analyticsManager.loadModule('monte-carlo');
};

// Alias for HTML handlers
window.updateMonteCarloParams = window.updateMonteCarloAnalysis;

// Portfolio Optimization Settings
window.toggleOptimizationSettings = () => {
    const settings = document.getElementById('optimizationSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updatePortfolioOptimization = () => {
    const objective = document.getElementById('optObjective')?.value || 'max_sharpe';
    const constraint = document.getElementById('optConstraint')?.value || 'long_only';
    const rebalancing = document.getElementById('optRebalancing')?.value || 'quarterly';
    const riskBudget = document.getElementById('optRiskBudget')?.value || 'equal';
    const lookback = document.getElementById('optLookback')?.value || '1Y';

    console.log('[OPTIMIZATION UPDATE] DOM Values:', {
        objectiveValue: document.getElementById('optObjective')?.value,
        constraintValue: document.getElementById('optConstraint')?.value,
        objective,
        constraint,
        rebalancing,
        riskBudget,
        lookback
    });

    window.analyticsCore.optimizationSettings = {
        objective,
        constraint,
        rebalancing,
        risk_budget: riskBudget,
        lookback_period: lookback
    };

    // Save to localStorage
    try {
        localStorage.setItem('optimizationSettings', JSON.stringify(window.analyticsCore.optimizationSettings));
    } catch (e) {
        console.error('Failed to save optimization settings:', e);
    }


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

window.updateSectorAllocationV2 = () => {
    const classification = document.getElementById('sectorClassification')?.value || 'GICS';
    const level = document.getElementById('sectorLevel')?.value || 'Sector';
    const benchmark = document.getElementById('sectorBenchmark')?.value || 'SPY';
    const view = document.getElementById('sectorView')?.value || 'Pie';
    const threshold = document.getElementById('sectorThreshold')?.value || '0';

    console.log('[SECTOR SETTINGS] Updating with:', { classification, level, benchmark, view, threshold });

    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.sectorSettings = {
        classification,
        level,
        benchmark,
        view,
        threshold
    };

    // Save to localStorage
    try {
        localStorage.setItem('sectorAllocationSettings', JSON.stringify(window.analyticsCore.sectorSettings));
    } catch (e) {
        console.error('Failed to save sector allocation settings:', e);
    }

    console.log('[SECTOR SETTINGS] Stored settings:', window.analyticsCore.sectorSettings);
    window.analyticsManager.loadModule('sector-allocation');
};

// Technical Analysis Settings
window.toggleTechnicalSettings = () => {
    const settings = document.getElementById('technicalSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateTechnicalAnalysis = () => {
    // Collect all settings from DOM
    const period = document.getElementById('technicalPeriod')?.value || '1Y';
    const timeframe = document.getElementById('technicalTimeframe')?.value || 'Daily';
    const rsiPeriod = parseInt(document.getElementById('technicalRsiPeriod')?.value) || 14;
    const macdFast = parseInt(document.getElementById('technicalMacdFast')?.value) || 12;
    const signalStrength = document.getElementById('technicalSignalStrength')?.value || 'Medium';

    // Default indicators
    const indicators = ['RSI', 'MACD', 'Bollinger', 'SMA', 'EMA'];

    const options = {
        period,
        timeframe,
        rsi_period: rsiPeriod,
        macd_fast: macdFast,
        signal_strength: signalStrength,
        indicators,
        rsi_oversold: 30,
        rsi_overbought: 70,
        macd_slow: 26,
        macd_signal: 9,
        bb_period: 20,
        bb_std: 2
    };

    console.log('[TECHNICAL UPDATE] Updating with options:', options);

    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.technicalSettings = options;

    window.analyticsManager.loadModule('technical-indicators');
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
        const response = await fetch(`${window.API_BASE || window.location.origin} /api/statistical - analysis`, {
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

        // Set default values if not already set
        if (!document.getElementById('statisticalLookbackPeriod')?.value) {
            const lookbackSelect = document.getElementById('statisticalLookbackPeriod');
            if (lookbackSelect) lookbackSelect.value = '1Y';
        }
        if (!document.getElementById('statisticalFrequency')?.value) {
            const frequencySelect = document.getElementById('statisticalFrequency');
            if (frequencySelect) frequencySelect.value = 'Daily';
        }
        if (!document.getElementById('statisticalBenchmark')?.value) {
            const benchmarkSelect = document.getElementById('statisticalBenchmark');
            if (benchmarkSelect) benchmarkSelect.value = 'SPY';
        }
        if (!document.getElementById('statisticalConfidenceLevel')?.value) {
            const confidenceSelect = document.getElementById('statisticalConfidenceLevel');
            if (confidenceSelect) confidenceSelect.value = '0.95';
        }
    }
};

window.updateStatisticalAnalysis = () => {
    const lookbackPeriod = document.getElementById('statisticalLookbackPeriod')?.value || '1Y';
    const frequency = document.getElementById('statisticalFrequency')?.value || 'Daily';
    const benchmark = document.getElementById('statisticalBenchmark')?.value || 'SPY';
    const confidenceLevel = parseFloat(document.getElementById('statisticalConfidenceLevel')?.value || '0.95');

    console.log('[STATISTICAL UPDATE] New settings:', { lookbackPeriod, frequency, benchmark, confidenceLevel });

    // Store settings for API call
    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.statisticalSettings = {
        lookback_period: lookbackPeriod,
        frequency: frequency,
        benchmark: benchmark,
        confidence_level: confidenceLevel
    };

    // Force reload of statistical analysis with new settings
    window.analyticsManager.loadModule('statistical-analysis');
};

// Technical Analysis Settings
window.toggleTechnicalSettings = () => {
    const settings = document.getElementById('technicalSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};



// Strategy Backtesting Settings
// Strategy Backtesting Settings
window.toggleBacktestSettingsPanel = () => {
    console.log('[UI] Toggling backtest settings panel');
    const settings = document.getElementById('backtestSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    } else {
        console.error('[UI] Backtest settings panel not found (id=backtestSettings)');
    }
};

// Alias for compatibility
window.toggleBacktestingSettings = window.toggleBacktestSettingsPanel;


// Alias for compatibility




window.updateStrategyBacktesting = () => {
    console.log('[UI] updateStrategyBacktesting triggered');

    // Update settings object (like P&L Attribution's updatePnlOptions)
    const period = document.getElementById('backtestPeriod')?.value || '6M';
    const rebalancing = document.getElementById('backtestRebalancing')?.value || 'Quarterly';
    const costs = parseFloat(document.getElementById('backtestCosts')?.value || '0.001') * 100; // Convert to percentage (0.1 for 0.1%)
    const benchmark = document.getElementById('backtestBenchmark')?.value || 'SPY';

    // Save to analyticsCore.backtestSettings (persistent storage)
    if (window.analyticsCore) {
        window.analyticsCore.backtestSettings = {
            period: period,
            rebalancing: rebalancing,
            transactionCosts: costs,
            benchmark: benchmark,
            riskModel: 'historical'
        };
        console.log('[UI] Updated backtestSettings:', window.analyticsCore.backtestSettings);

        // Reload analysis with new settings
        window.analyticsManager.loadModule('strategy-backtesting');
    } else {
        console.error('[UI] window.analyticsCore not available');
    }
};

// Helper for Monte Carlo instant updates
window.updateMonteCarloParams = () => {
    const period = document.getElementById('mcPeriod')?.value;
    const simulations = document.getElementById('mcSimulations')?.value;
    const confidence = document.getElementById('mcConfidence')?.value;
    const regime = document.getElementById('mcRegime')?.value;
    const volAdj = document.getElementById('mcVolAdj')?.value;

    if (!period || !simulations || !confidence || !regime || !volAdj) {
        console.error('Missing required Monte Carlo settings');
        return;
    }

    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.monteCarloSettings = {
        forecast_period: period,
        simulations: parseInt(simulations),
        confidence_intervals: parseFloat(confidence),
        market_regime: regime,
        volatility_adjustment: parseFloat(volAdj)
    };

    // Save to localStorage
    try {
        localStorage.setItem('monteCarloSettings', JSON.stringify(window.analyticsCore.monteCarloSettings));
        console.log('[Monte Carlo] Saved settings to localStorage');
    } catch (e) {
        console.error('Failed to save Monte Carlo settings:', e);
    }

    console.log('[Monte Carlo] Updating with settings:', window.analyticsCore.monteCarloSettings);
    window.analyticsManager.loadModule('monte-carlo');
};

// ----------------------------------------------------------------------------------
// Options Strategies Helpers
// ----------------------------------------------------------------------------------

window.toggleOptionsSettings = () => {
    const settings = document.getElementById('optionsSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateOptionsAnalysis = () => {
    const expiration = document.getElementById('optionsExpiration')?.value || '3M';
    const moneyness = document.getElementById('optionsMoneyness')?.value || 'All';
    const strategy = document.getElementById('optionsStrategy')?.value || 'All';
    const minPremium = parseFloat(document.getElementById('optionsMinPremium')?.value || 0.50);
    const deltaRange = document.getElementById('optionsDeltaRange')?.value || 'All';

    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.optionsSettings = {
        expiration: expiration,
        moneyness: moneyness,
        strategy: strategy,
        min_premium: minPremium,
        delta_range: deltaRange
    };

    // Save to localStorage
    try {
        localStorage.setItem('optionsSettings', JSON.stringify(window.analyticsCore.optionsSettings));
        console.log('[Options] Saved settings to localStorage');
    } catch (e) {
        console.error('Failed to save options settings:', e);
    }

    console.log('[Options] Updating with settings:', window.analyticsCore.optionsSettings);
    window.analyticsManager.loadModule('options-strategies');
};

window.filterOptionsStrategies = () => {
    const symbolFilter = document.getElementById('optionsSymbolFilter')?.value || 'all';
    const itemsPerPage = document.getElementById('optItemsPerPage')?.value;
    const limit = itemsPerPage === 'all' ? 1000 : parseInt(itemsPerPage || 10);

    // Filter data
    let filtered = window.optionsOpportunities || [];
    if (symbolFilter !== 'all') {
        filtered = filtered.filter(o => o.symbol === symbolFilter);
    }

    // Update summary cards based on filtered data
    const summaryContainer = document.getElementById('optionsSummaryCards');
    if (summaryContainer) {
        // Calculate dynamic summary
        let totalPremium = 0;
        let totalProfitPot = 0;
        let avgIv = 0;

        filtered.forEach(o => {
            totalPremium += (o.premium || 0) * 100; // x100 per contract
            totalProfitPot += (o.annualized_return || o.profit_potential || 0);
            avgIv += (o.iv || 0);
        });

        const avgReturn = filtered.length ? totalProfitPot / filtered.length : 0;
        const avgIvVal = filtered.length ? avgIv / filtered.length : 0;

        summaryContainer.innerHTML = `
                < div class="analysis-card p-4" >
                <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Opportunities</h3>
                <p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">${filtered.length}</p>
                <p class="text-xs text-gray-500 mt-1">Found matching criteria</p>
            </div >
            <div class="analysis-card p-4">
                <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Avg Annual Return</h3>
                <p class="text-2xl font-bold ${avgReturn > 0.2 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}">${(avgReturn * 100).toFixed(1)}%</p>
                <p class="text-xs text-gray-500 mt-1">Based on premium/capital</p>
            </div>
             <div class="analysis-card p-4">
                <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Avg IV</h3>
                <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">${(avgIvVal * 100).toFixed(1)}%</p>
                <p class="text-xs text-gray-500 mt-1">Implied Volatility</p>
            </div>
            `;
    }

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit);

    // Ensure current page is valid
    if (window.optionsCurrentPage > totalPages) window.optionsCurrentPage = 1;
    if (window.optionsCurrentPage < 1) window.optionsCurrentPage = 1;

    const startIdx = (window.optionsCurrentPage - 1) * limit;
    const endIdx = Math.min(startIdx + limit, totalItems);
    const pageItems = filtered.slice(startIdx, endIdx);

    // Render Table
    const tbody = document.getElementById('optionsOpportunitiesBody');
    if (tbody) {
        if (pageItems.length === 0) {
            tbody.innerHTML = `< tr > <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500">No opportunities found matching these criteria.</td></tr > `;
        } else {
            tbody.innerHTML = pageItems.map(opp => {
                const isPositive = (opp.annualized_return || opp.profit_potential || 0) > 0;
                const returnVal = (opp.annualized_return || opp.profit_potential || 0) * 100;
                const strategyLabel = opp.strategy === 'covered_calls' ? 'Covered Call' :
                    opp.strategy === 'protective_puts' ? 'Protective Put' :
                        opp.strategy === 'iron_condors' ? 'Iron Condor' :
                            opp.strategy.replace('_', ' ');

                return `
                < tr >
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${opp.symbol}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${strategyLabel}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${opp.expiration}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        ${opp.strike ? '$' + opp.strike.toFixed(2) :
                        (opp.call_strike && opp.put_strike ? 'C$' + opp.call_strike + '/P$' + opp.put_strike : 'N/A')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">$${(opp.premium || 0).toFixed(2)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">${(opp.delta || 0).toFixed(2)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">${((opp.iv || 0) * 100).toFixed(1)}%</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}">
                        ${returnVal.toFixed(2)}%
                    </td>
                </tr >
                `;
            }).join('');
        }
    }

    // Update pagination controls
    const startEl = document.getElementById('optStart');
    const endEl = document.getElementById('optEnd');
    const totalEl = document.getElementById('optTotal');
    const indicatorEl = document.getElementById('optPageIndicator');

    if (startEl) startEl.innerText = totalItems > 0 ? startIdx + 1 : 0;
    if (endEl) endEl.innerText = endIdx;
    if (totalEl) totalEl.innerText = totalItems;
    if (indicatorEl) indicatorEl.innerText = `Page ${window.optionsCurrentPage} `;
};

window.changeOptionsPage = (newPage) => {
    window.optionsCurrentPage = newPage;
    window.filterOptionsStrategies();
};



// Helper for Portfolio Optimization settings
window.toggleOptimizationSettings = () => {
    const settings = document.getElementById('optimizationSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

// window.updatePortfolioOptimization is defined earlier in the file

// Helper for Sector Allocation updates


// ----------------------------------------------------------------------------------
// Risk Metrics Helpers (Migrated from strategy-backtesting-globals.js)
// ----------------------------------------------------------------------------------

// Helper for Performance Attribution updates
window.togglePerformanceAttributionSettings = () => {
    const settings = document.getElementById('performanceAttributionSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updatePerformanceAttribution = () => {
    const period = document.getElementById('perfPeriod')?.value || '1Y';
    const benchmark = document.getElementById('perfBenchmark')?.value || 'SPY';
    const model = document.getElementById('perfModel')?.value || 'brinson';
    const currency = document.getElementById('perfCurrency')?.value || 'USD';
    const frequency = document.getElementById('perfFrequency')?.value || 'Daily';

    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.performanceAttributionSettings = {
        period: period,
        benchmark: benchmark,
        attribution_model: model,
        currency: currency,
        frequency: frequency
    };

    // Save to localStorage
    try {
        localStorage.setItem('performanceAttributionSettings', JSON.stringify(window.analyticsCore.performanceAttributionSettings));
        console.log('[Performance Attribution] Saved settings to localStorage');
    } catch (e) {
        console.error('Failed to save attribution settings:', e);
    }

    console.log('[Performance Attribution] Updating with settings:', window.analyticsCore.performanceAttributionSettings);
    window.analyticsManager.loadModule('performance-attribution');
};

window.toggleRiskSettingsPanel = () => {
    const settings = document.getElementById('riskSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateRiskAnalysis = () => {
    const period = document.getElementById('riskPeriod')?.value;
    const confidence = document.getElementById('riskConfidence')?.value;
    const model = document.getElementById('riskModel')?.value;
    const benchmark = document.getElementById('riskBenchmark')?.value;
    const window_size = document.getElementById('riskRollingWindow')?.value || document.getElementById('riskWindow')?.value;

    if (!period || !confidence || !model || !benchmark || !window_size) {
        console.error('Missing required Risk settings');
        return;
    }

    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.riskSettings = {
        period: period,
        var_confidence: parseFloat(confidence),
        risk_model: model,
        benchmark: benchmark,
        rolling_window: parseInt(window_size)
    };

    // Save to localStorage
    try {
        localStorage.setItem('riskSettings', JSON.stringify(window.analyticsCore.riskSettings));
        console.log('[Risk Metrics] Saved settings to localStorage');
    } catch (e) {
        console.error('Failed to save risk settings:', e);
    }

    console.log('[Risk Metrics] Updating with settings:', window.analyticsCore.riskSettings);
    window.analyticsManager.loadModule('risk-metrics');
};






// Initialize Analytics Manager instance
// Note: Instance already created at line 2812. Duplicate removed.
// Ensure instance exists
if (!window.analyticsManager) {
    window.analyticsManager = new AnalyticsManager();
}

document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not already done (handled by class method check)
    if (window.analyticsManager) {
        window.analyticsManager.initialize();
    }
});
