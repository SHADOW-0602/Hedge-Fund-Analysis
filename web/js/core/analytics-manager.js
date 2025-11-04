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
        if (!module) {
            console.error(`Module ${name} not found`);
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

        // Show loading indicator
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
        const filteredOpportunities = window.getFilteredOpportunities ? window.getFilteredOpportunities() : allOpportunities;
        const currentPage = window.optionsCurrentPage || 1;
        const itemsPerPage = 10;
        const totalPages = Math.ceil(filteredOpportunities.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentOpportunities = filteredOpportunities.slice(startIndex, endIndex);
        
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
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h4 class="font-semibold text-blue-800">Covered Calls</h4>
                        <p class="text-2xl font-bold text-blue-600">${allOpportunities.filter(o => o.strategy === 'covered_calls').length}</p>
                        <p class="text-sm text-blue-600">Premium: ${window.analyticsCore.formatCurrency(allOpportunities.filter(o => o.strategy === 'covered_calls').reduce((sum, o) => sum + (o.premium || 0), 0))}</p>
                    </div>
                    <div class="bg-green-50 p-4 rounded-lg">
                        <h4 class="font-semibold text-green-800">Protective Puts</h4>
                        <p class="text-2xl font-bold text-green-600">${allOpportunities.filter(o => o.strategy === 'protective_puts').length}</p>
                        <p class="text-sm text-green-600">Cost: ${window.analyticsCore.formatCurrency(allOpportunities.filter(o => o.strategy === 'protective_puts').reduce((sum, o) => sum + (o.premium || 0), 0))}</p>
                    </div>
                    <div class="bg-purple-50 p-4 rounded-lg">
                        <h4 class="font-semibold text-purple-800">Iron Condors</h4>
                        <p class="text-2xl font-bold text-purple-600">${allOpportunities.filter(o => o.strategy === 'iron_condors').length}</p>
                        <p class="text-sm text-purple-600">Premium: ${window.analyticsCore.formatCurrency(allOpportunities.filter(o => o.strategy === 'iron_condors').reduce((sum, o) => sum + (o.premium || 0), 0))}</p>
                    </div>
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
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Portfolio Optimization</h2>
                <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
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
                            ${Object.entries(optimal.weights).map(([symbol, weight]) => `
                                <div class="text-center">
                                    <div class="text-sm font-medium text-gray-900">${symbol}</div>
                                    <div class="text-lg font-bold text-indigo-600">${window.analyticsCore.formatPercent(weight)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
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
window.updateMonteCarloAnalysis = () => {
    // Get settings values from form
    const forecastPeriod = document.getElementById('mcForecastPeriod')?.value || '3M';
    const simulations = parseInt(document.getElementById('mcSimulations')?.value) || 10000;
    const confidenceIntervals = parseFloat(document.getElementById('mcConfidenceIntervals')?.value) || 0.95;
    const marketRegime = document.getElementById('mcMarketRegime')?.value || 'normal';
    const volatilityAdjustment = parseFloat(document.getElementById('mcVolatilityAdjustment')?.value) || 0.0;
    
    // Store settings for API call
    window.analyticsCore.monteCarloSettings = {
        forecast_period: forecastPeriod,
        simulations: simulations,
        confidence_intervals: confidenceIntervals,
        market_regime: marketRegime,
        volatility_adjustment: volatilityAdjustment
    };
    
    // Force reload with new settings
    window.analyticsManager.loadModule('monte-carlo');
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
window.updateOptionsAnalysis = () => {
    // Get settings values from form
    const expiration = document.getElementById('optionsExpiration')?.value || '3M';
    const moneyness = document.getElementById('optionsMoneyness')?.value || 'All';
    const minPremium = document.getElementById('optionsMinPremium')?.value || '0.50';
    const deltaRange = document.getElementById('optionsDeltaRange')?.value || 'All';
    
    // Store settings for API call
    window.analyticsCore.optionsSettings = {
        expiration,
        moneyness,
        strategy: 'All',
        min_premium: minPremium,
        delta_range: deltaRange
    };
    
    // Force reload of options strategies with new settings
    window.analyticsManager.loadModule('options-strategies');
};
window.updatePerformanceAttribution = () => {
    // Get settings values from form
    const period = document.getElementById('performancePeriod')?.value || '1Y';
    const attributionModel = document.getElementById('performanceModel')?.value || 'brinson';
    const benchmark = document.getElementById('performanceBenchmark')?.value || 'SPY';
    const currency = document.getElementById('performanceCurrency')?.value || 'USD';
    const frequency = document.getElementById('performanceFrequency')?.value || 'daily';
    
    // Store settings for API call
    window.analyticsCore.performanceSettings = {
        period,
        attribution_model: attributionModel,
        benchmark,
        currency,
        frequency
    };
    console.log('Stored settings:', window.analyticsCore.performanceSettings);
    
    // Force reload with new settings
    window.analyticsManager.loadModule('performance-attribution');
};

window.togglePerformanceSettings = () => {
    const settings = document.getElementById('performanceSettings');
    if (settings) {
        settings.classList.toggle('hidden');
        
        // Set default values if not already set
        if (!document.getElementById('performancePeriod').value) {
            document.getElementById('performancePeriod').value = '1Y';
        }
        if (!document.getElementById('performanceModel').value) {
            document.getElementById('performanceModel').value = 'brinson';
        }
        if (!document.getElementById('performanceBenchmark').value) {
            document.getElementById('performanceBenchmark').value = 'SPY';
        }
        if (!document.getElementById('performanceCurrency').value) {
            document.getElementById('performanceCurrency').value = 'USD';
        }
        if (!document.getElementById('performanceFrequency').value) {
            document.getElementById('performanceFrequency').value = 'daily';
        }
    }
};

// Options pagination functions
window.changeOptionsPage = (page) => {
    if (page < 1 || !window.optionsOpportunities) return;
    const filteredOpps = window.getFilteredOpportunities();
    const totalPages = Math.ceil(filteredOpps.length / 10);
    if (page > totalPages) return;
    
    window.optionsCurrentPage = page;
    window.analyticsManager.displayOptionsStrategies({opportunities: window.optionsOpportunities, summary: window.optionsSummary || {}});
};

// Filter options strategies
window.filterOptionsStrategies = () => {
    window.optionsCurrentPage = 1;
    window.analyticsManager.displayOptionsStrategies({opportunities: window.optionsOpportunities, summary: window.optionsSummary || {}});
};

// Get filtered opportunities based on current filters
window.getFilteredOpportunities = () => {
    if (!window.optionsOpportunities) return [];
    const strategyFilter = document.getElementById('strategyFilter')?.value || 'all';
    const symbolFilter = document.getElementById('symbolFilter')?.value || 'all';
    
    let filtered = window.optionsOpportunities;
    
    if (strategyFilter !== 'all') {
        filtered = filtered.filter(opp => opp.strategy === strategyFilter);
    }
    
    if (symbolFilter !== 'all') {
        filtered = filtered.filter(opp => opp.symbol === symbolFilter);
    }
    
    return filtered;
};

// Settings toggles - Portfolio Analysis
window.toggleMonteCarloSettings = () => {
    const settings = document.getElementById('monteCarloSettings');
    if (settings) {
        settings.classList.toggle('hidden');
        
        // Set default values if not already set
        if (!document.getElementById('mcForecastPeriod').value) {
            document.getElementById('mcForecastPeriod').value = '3M';
        }
        if (!document.getElementById('mcSimulations').value) {
            document.getElementById('mcSimulations').value = '10000';
        }
        if (!document.getElementById('mcConfidenceIntervals').value) {
            document.getElementById('mcConfidenceIntervals').value = '0.95';
        }
        if (!document.getElementById('mcMarketRegime').value) {
            document.getElementById('mcMarketRegime').value = 'normal';
        }
        if (!document.getElementById('mcVolatilityAdjustment').value) {
            document.getElementById('mcVolatilityAdjustment').value = '0.0';
        }
    }
};
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
window.toggleOptionsSettings = () => {
    const settings = document.getElementById('optionsSettings');
    if (settings) {
        settings.classList.toggle('hidden');
        
        // Set default values if not already set
        if (!document.getElementById('optionsExpiration').value) {
            document.getElementById('optionsExpiration').value = '3M';
        }
        if (!document.getElementById('optionsMoneyness').value) {
            document.getElementById('optionsMoneyness').value = 'All';
        }

        if (!document.getElementById('optionsMinPremium').value) {
            document.getElementById('optionsMinPremium').value = '0.50';
        }
        if (!document.getElementById('optionsDeltaRange').value) {
            document.getElementById('optionsDeltaRange').value = 'All';
        }
    }
};