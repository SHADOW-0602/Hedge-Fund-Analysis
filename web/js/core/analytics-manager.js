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

        // Replaced by portfolio return attribution
        // this.register('return-attribution', {
        //     endpoint: 'return-attribution',
        //     containerId: 'returnAttributionAnalysis',
        //     settingsId: null,
        //     displayFunction: this.displayReturnAttribution,
        //     type: 'transaction'
        // });

        this.register('return-attribution', {
            endpoint: 'return-attribution',
            containerId: 'returnAttribution',
            settingsId: 'returnAttributionSettings',
            displayFunction: this.displayReturnAttribution,
            type: 'transaction'
        });

        // Add performance-attribution as a separate module
        this.register('performance-attribution', {
            endpoint: 'performance-attribution',
            containerId: 'performanceAttribution',
            settingsId: 'performanceAttributionSettings',
            displayFunction: this.displayPerformanceAttribution,
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
                        Settings
                        Refresh
            
            
                
                    
                
                ${metrics.avg_correlation !== undefined && metrics.avg_correlation !== null ? `
                ` : ''}
                
                ${metrics.risk_contribution && Object.keys(metrics.risk_contribution).length > 0 ? `
                            ${Object.entries(metrics.risk_contribution).slice(0, 10).map(([symbol, contribution]) => `
                            `).join('')}
                ` : ''}
                
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
                        Settings
                        ${symbolOptions}
                        Refresh
            
            
                    ${definedStrategies.map(strategy => {
            const strategyOpportunities = allOpportunities.filter(o => o.strategy === strategy);
            const totalPremium = strategyOpportunities.reduce((sum, o) => sum + (o.premium || 0), 0);
            const displayName = strategy.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            const colorClass = strategy === 'covered_calls' ? 'blue' : strategy === 'protective_puts' ? 'green' : 'purple';
            return `
                        `;
        }).join('')}
                ${allOpportunities.length > 0 ? `
                                ${currentOpportunities.map(opp => `
                                `).join('')}
                    ${totalPages > 1 ? `
                    ` : ''}
                ` : '<p class="text-gray-500 text-center py-4">No options opportunities found</p>'}
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
        const container = document.getElementById('analysisContent');
        if (!container) return;
        container.classList.remove('hidden');

        container.innerHTML = `
            <div class="p-4 bg-gray-50 rounded-lg">
                <p class="text-gray-600">Portfolio Optimization results display is currently being updated.</p>
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
        <div class="p-4 bg-gray-50 rounded-lg">
            <p class="text-gray-600">Monte Carlo results display is currently being updated.</p>
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
            <div class="p-4 bg-gray-50 rounded-lg">
                <p class="text-gray-600">Sector Allocation results display is currently being updated.</p>
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
        <div class="p-4 bg-gray-50 rounded-lg">
            <p class="text-gray-600">Statistical Analysis results display is currently being updated.</p>
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
            <div class="p-4 bg-gray-50 rounded-lg">
                <p class="text-gray-600">Technical Indicators results display is currently being updated.</p>
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
                <h2 class="text-2xl font-bold text-gray-900">Performance Attribution Analysis</h2>
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
                        Settings
                        Refresh
            
            
                
                ${symbols.length > 0 ? `
                                        ${symbols.map(symbol => `<th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">${symbol}</th>`).join('')}
                                    ${symbols.map(symbol1 => `
                                            ${symbols.map(symbol2 => {
            const corrValue = correlation[symbol1]?.[symbol2] || 0;
            const colorClass = symbol1 === symbol2 ? 'bg-gray-100' :
                corrValue > 0.7 ? 'bg-red-100 text-red-800' :
                    corrValue > 0.3 ? 'bg-yellow-100 text-yellow-800' :
                        corrValue < -0.3 ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800';
            return `<td class="px-4 py-2 whitespace-nowrap text-sm text-center ${colorClass}">${window.analyticsCore.formatNumber(corrValue)}</td>`;
        }).join('')}
                                    `).join('')}
                ` : '<p class="text-gray-500 text-center py-4">No correlation data available</p>'}
                
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
window.togglePerformanceAttributionSettings = () => {
    const settings = document.getElementById('performanceAttributionSettings');
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

