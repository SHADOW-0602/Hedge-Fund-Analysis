// Unified Analytics Core - Eliminates duplicate code patterns
class AnalyticsCore {
    constructor() {
        this.portfolioData = null;
        this.transactionData = null;
        this.apiBase = window.API_BASE || window.location.origin;
        this.resultsCache = new Map(); // Cache for API results
    }

    // Clear cache when data changes
    clearCache() {
        console.log('[ANALYTICS-CORE] Clearing results cache');
        this.resultsCache.clear();
    }

    // Generic API call handler
    async callAPI(endpoint, data, options = {}) {
        // Generate cache key
        const cacheOptions = { ...options };
        const cacheKey = `${endpoint}_${JSON.stringify(cacheOptions)}`;

        // Return cached result if available
        if (this.resultsCache.has(cacheKey)) {
            console.log(`[ANALYTICS-CORE] Returning cached result for ${endpoint}`);
            return this.resultsCache.get(cacheKey);
        }

        const timeoutDuration = options.timeout || 300000; // Default 300 seconds (5 minutes)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        try {
            console.log(`Making API call to ${endpoint} with data:`, data);
            console.log(`Making API call to ${endpoint} with options:`, options);
            const requestBody = { ...data, options };
            console.log(`Final request body for ${endpoint}:`, requestBody);

            const response = await fetch(`${this.apiBase}/api/${endpoint}?t=${Date.now()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const result = await response.json();
            console.log(`API response from ${endpoint}:`, result);

            if (result.success) {
                this.resultsCache.set(cacheKey, result);
            }

            return result;
        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`API call failed for ${endpoint}:`, error);

            if (error.name === 'AbortError') {
                return { success: false, error: `Request timed out after ${timeoutDuration / 1000} seconds. The analysis might be too complex or the server is busy.` };
            }

            return { success: false, error: error.message };
        }
    }

    // Show transaction loading screen
    showTransactionLoadingScreen(container, endpoint, transactionCount) {
        const analysisName = this.getAnalysisDisplayName(endpoint);

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">${analysisName}</h2>
                <button class="bg-indigo-600 text-white px-3 py-1 rounded-lg transition-colors text-sm flex items-center opacity-50 cursor-not-allowed" disabled>
                    <svg class="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Analyzing...
                </button>
            </div>
            
            <div class="p-12 text-center">
                <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Processing Your Data</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-4">Analyzing ${transactionCount} transactions for ${analysisName.toLowerCase()}...</p>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4 max-w-md mx-auto">
                    <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">This may take a few moments</p>
            </div>
        `;
    }

    // Show portfolio loading screen
    showPortfolioLoadingScreen(container, endpoint, portfolioCount) {
        const analysisName = this.getAnalysisDisplayName(endpoint);

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">${analysisName}</h2>
                <button class="bg-indigo-600 text-white px-3 py-1 rounded-lg transition-colors text-sm flex items-center opacity-50 cursor-not-allowed" disabled>
                    <svg class="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Analyzing...
                </button>
            </div>
            
            <div class="p-12 text-center">
                <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Processing Your Data</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-4">Analyzing ${portfolioCount} positions for ${analysisName.toLowerCase()}...</p>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4 max-w-md mx-auto">
                    <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">This may take a few moments</p>
            </div>
        `;
    }

    // Get display name for analysis type
    getAnalysisDisplayName(endpoint) {
        const displayNames = {
            'return-attribution': 'Return Attribution Analysis',
            'performance-attribution': 'Performance Attribution',
            'pnl-attribution': 'P&L Attribution Analysis',
            'trade-performance': 'Trade Performance Analysis',
            'turnover-analysis': 'Turnover Analysis',
            'tax-analysis': 'Tax Analysis',
            'cash-flow-analysis': 'Cash Flow Analysis',
            'drawdown-analysis': 'Drawdown Analysis',
            'trade-timing-analysis': 'Trade Timing Analysis',
            'fifo-lifo-accounting': 'Accounting Analysis',
            'analyze-risk': 'Risk Metrics',
            'scan-options': 'Options Strategy Scanner',
            'portfolio-optimization': 'Portfolio Optimization',
            'correlation-analysis': 'Correlation Analysis',
            'sector-allocation': 'Sector Allocation',
            'statistical-analysis': 'Statistical Analysis',
            'technical-analysis': 'Technical Analysis',
            'strategy-backtesting': 'Strategy Backtesting',
            'monte-carlo': 'Monte Carlo Simulation'
        };
        return displayNames[endpoint] || 'Transaction Analysis';
    }

    // Generic error display
    showError(containerId, message = 'Analysis failed') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div class="text-red-600 text-center py-4">${message}</div>`;
        }
    }

    // Generic settings toggle
    toggleSettings(settingsId) {
        const settings = document.getElementById(settingsId);
        if (settings) settings.classList.toggle('hidden');
    }

    // Format utilities
    formatPercent(value) {
        if (value === null || value === undefined || isNaN(value) || typeof value !== 'number') return 'N/A';
        return (value * 100).toFixed(2) + '%';
    }

    formatNumber(value) {
        if (value === null || value === undefined || isNaN(value) || typeof value !== 'number') return 'N/A';
        return parseFloat(value).toFixed(2);
    }

    formatCurrency(value) {
        if (value === null || value === undefined || isNaN(value) || typeof value !== 'number') return 'N/A';
        return '$' + value.toLocaleString();
    }

    // Get form options from UI
    getFormOptions(formId) {
        const form = document.getElementById(formId);
        if (!form) {
            // For correlation analysis, try to get values directly from elements
            if (formId === 'correlationSettings') {
                const options = {};
                const period = document.getElementById('correlationPeriod');
                const frequency = document.getElementById('correlationFrequency');
                const method = document.getElementById('correlationMethod');
                const rollingWindow = document.getElementById('correlationRollingWindow');

                if (period) options.period = period.value;
                if (frequency) options.frequency = frequency.value;
                if (method) options.method = method.value;
                if (rollingWindow) options.rolling_window = rollingWindow.value;

                console.log('[ANALYTICS-CORE] Extracted correlation options directly:', options);
                return options;
            }

            // For statistical analysis, try to get values directly from elements
            if (formId === 'statisticalSettings') {
                const options = {};
                const lookbackPeriod = document.getElementById('statisticalLookbackPeriod');
                const frequency = document.getElementById('statisticalFrequency');
                const benchmark = document.getElementById('statisticalBenchmark');
                const confidenceLevel = document.getElementById('statisticalConfidenceLevel');

                if (lookbackPeriod) options.lookback_period = lookbackPeriod.value;
                if (frequency) options.frequency = frequency.value;
                if (benchmark) options.benchmark = benchmark.value;
                if (confidenceLevel) options.confidence_level = parseFloat(confidenceLevel.value);

                console.log('[ANALYTICS-CORE] Extracted statistical options directly:', options);
                return options;
            }

            // For technical analysis, try to get values directly from elements
            if (formId === 'technicalSettings') {
                const options = {};

                // Main Settings
                const period = document.getElementById('technicalPeriod');
                const timeframe = document.getElementById('technicalTimeframe');
                const signalStrength = document.getElementById('technicalSignalStrength');

                if (period) options.period = period.value;
                if (timeframe) options.timeframe = timeframe.value;
                if (signalStrength) options.signal_strength = signalStrength.value;

                // Indicators (Multi-select)
                // Assuming we use checkboxes or a multi-select implementation
                const indicators = [];
                ['RSI', 'MACD', 'Bollinger', 'SMA', 'EMA'].forEach(ind => {
                    const el = document.getElementById(`technicalInd${ind}`);
                    if (el && el.checked) indicators.push(ind);
                });
                if (indicators.length > 0) options.indicators = indicators;
                else options.indicators = ['RSI', 'MACD', 'Bollinger', 'SMA', 'EMA']; // Default all if none found/selected

                // Detailed Parameters
                const rsiPeriod = document.getElementById('technicalRsiPeriod');
                const rsiOversold = document.getElementById('technicalRsiOversold');
                const rsiOverbought = document.getElementById('technicalRsiOverbought');

                const macdFast = document.getElementById('technicalMacdFast');
                const macdSlow = document.getElementById('technicalMacdSlow');
                const macdSignal = document.getElementById('technicalMacdSignal');

                const bbPeriod = document.getElementById('technicalBbPeriod');
                const bbStd = document.getElementById('technicalBbStd');

                if (rsiPeriod) options.rsi_period = parseInt(rsiPeriod.value);
                if (rsiOversold) options.rsi_oversold = parseInt(rsiOversold.value);
                if (rsiOverbought) options.rsi_overbought = parseInt(rsiOverbought.value);

                if (macdFast) options.macd_fast = parseInt(macdFast.value);
                if (macdSlow) options.macd_slow = parseInt(macdSlow.value);
                if (macdSignal) options.macd_signal = parseInt(macdSignal.value);

                if (bbPeriod) options.bb_period = parseInt(bbPeriod.value);
                if (bbStd) options.bb_std = parseInt(bbStd.value);

                console.log('[ANALYTICS-CORE] Extracted technical options directly:', options);
                return options;
            }
            return {};
        }

        const options = {};
        const inputs = form.querySelectorAll('select, input');
        inputs.forEach(input => {
            if (input.id) {
                // Map form field IDs to API parameter names
                let paramName = input.id;
                if (input.id === 'correlationPeriod') paramName = 'period';
                else if (input.id === 'correlationFrequency') paramName = 'frequency';
                else if (input.id === 'correlationMethod') paramName = 'method';
                else if (input.id === 'correlationRollingWindow') paramName = 'rolling_window';
                else if (input.id === 'statisticalLookbackPeriod') paramName = 'lookback_period';
                else if (input.id === 'statisticalFrequency') paramName = 'frequency';
                else if (input.id === 'statisticalBenchmark') paramName = 'benchmark';
                else if (input.id === 'statisticalConfidenceLevel') paramName = 'confidence_level';
                else if (input.id === 'technicalPeriod') paramName = 'period';
                else if (input.id === 'technicalTimeframe') paramName = 'timeframe';
                else if (input.id === 'technicalRsiPeriod') paramName = 'rsi_period';
                else if (input.id === 'technicalMacdFast') paramName = 'macd_fast';
                else if (input.id === 'technicalSignalStrength') paramName = 'signal_strength';
                else if (input.id === 'riskPeriod') paramName = 'period';
                else if (input.id === 'riskConfidence') paramName = 'var_confidence';
                else if (input.id === 'riskModel') paramName = 'risk_model';
                else if (input.id === 'riskBenchmark') paramName = 'benchmark';
                else if (input.id === 'riskRollingWindow') paramName = 'rolling_window';
                else if (input.id === 'sectorClassification') paramName = 'classification';
                else if (input.id === 'sectorLevel') paramName = 'level';
                else if (input.id === 'sectorBenchmark') paramName = 'benchmark';
                else if (input.id === 'sectorView') paramName = 'view';
                else if (input.id === 'sectorThreshold') paramName = 'threshold';

                let value = input.value;
                if (paramName === 'confidence_level') {
                    value = parseFloat(value);
                }
                options[paramName] = value;
            }
        });
        console.log(`[ANALYTICS-CORE] Extracted options from form ${formId}:`, options);
        return options;
    }

    // Portfolio analysis wrapper
    async analyzePortfolio(endpoint, containerId, displayFunction, settingsId = null, explicitSettings = null) {
        // Check user authentication first
        if (!this.isUserLoggedIn()) {
            this.showLoginRequired();
            return;
        }

        // Check for portfolio data - no fallbacks
        let portfolioData = this.portfolioData || window.currentPortfolioData;

        if (!portfolioData || !Array.isArray(portfolioData) || portfolioData.length === 0) {
            console.log('[ANALYTICS-CORE] No portfolio data available for', endpoint);
            const analysisName = this.getAnalysisDisplayName(endpoint);
            const container = document.getElementById(containerId) || document.getElementById('analysisContent');
            if (container) {
                container.innerHTML = `
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">${analysisName}</h2>
                    </div>
                    <div class="text-center py-4 text-yellow-500">No portfolio data available for ${analysisName.toLowerCase()}</div>
                `;
                container.classList.remove('hidden');
            }
            return;
        }

        // Show loading screen for portfolio analysis
        const container = document.getElementById(containerId) || document.getElementById('analysisContent');
        if (container && !explicitSettings?.background) {
            container.classList.remove('hidden');
            this.showPortfolioLoadingScreen(container, endpoint, portfolioData.length);
        }

        // Get options from settings form or stored settings
        let options = settingsId ? this.getFormOptions(settingsId) : {};

        // Apply explicit settings if provided (highest priority)
        if (explicitSettings) {
            options = { ...options, ...explicitSettings };
            console.log('[ANALYTICS-CORE] Applied explicit settings:', explicitSettings);
        }

        // For risk analysis, use stored settings if available
        if (endpoint === 'analyze-risk' && this.riskSettings) {
            options = { ...options, ...this.riskSettings };
            console.log('Using risk settings:', this.riskSettings);
        }

        // For strategy backtesting, use stored settings if available
        if (endpoint === 'strategy-backtesting' && this.backtestSettings) {
            options = { ...options, ...this.backtestSettings };
            console.log('Using backtest settings:', this.backtestSettings);
        }

        // For options analysis, use stored settings if available
        if (endpoint === 'scan-options' && this.optionsSettings) {
            options = { ...options, ...this.optionsSettings };
            console.log('Using options settings:', this.optionsSettings);
        }

        // For performance attribution, use stored settings if available
        if (endpoint === 'performance-attribution' && this.performanceAttributionSettings) {
            options = { ...options, ...this.performanceAttributionSettings };
            console.log('Using performance attribution settings:', this.performanceAttributionSettings);
        }

        // For Monte Carlo, use stored settings if available
        if (endpoint === 'monte-carlo' && this.monteCarloSettings) {
            options = { ...options, ...this.monteCarloSettings };
            console.log('Using Monte Carlo settings:', this.monteCarloSettings);
        }



        // For portfolio optimization, use stored settings if available
        if (endpoint === 'portfolio-optimization' && this.optimizationSettings) {
            options = { ...options, ...this.optimizationSettings };
            console.log('Using optimization settings:', this.optimizationSettings);
        }

        // For sector allocation, use stored settings if available
        if (endpoint === 'sector-allocation' && this.sectorSettings) {
            options = { ...options, ...this.sectorSettings };
            console.log('Using sector allocation settings:', this.sectorSettings);
        }

        // For correlation analysis, use stored settings if available
        if (endpoint === 'correlation-analysis') {
            // Use temporarily stored options or get from form
            const storedOptions = this.correlationOptions || this.correlationSettings || {};
            const freshOptions = this.getFormOptions('correlationSettings');
            options = { ...options, ...storedOptions, ...freshOptions };
            console.log('[ANALYTICS-CORE] Using correlation settings:', { storedOptions, freshOptions, final: options });
            console.log('[ANALYTICS-CORE] Final API request will include:', options);
            // Clear stored options after use
            delete this.correlationOptions;
            delete this.correlationSettings;
        }

        // For statistical analysis, use stored settings if available
        if (endpoint === 'statistical-analysis') {
            const storedOptions = this.statisticalOptions || this.statisticalSettings || {};
            const freshOptions = this.getFormOptions('statisticalSettings');
            options = { ...options, ...storedOptions, ...freshOptions };
            console.log('[ANALYTICS-CORE] Using statistical settings:', { storedOptions, freshOptions, final: options });
            // Clear stored options after use
            delete this.statisticalOptions;
            delete this.statisticalSettings;
        }

        // For technical analysis, use stored settings if available
        if (endpoint === 'technical-analysis') {
            const storedOptions = this.technicalOptions || this.technicalSettings || {};
            const freshOptions = this.getFormOptions('technicalSettings');
            options = { ...options, ...storedOptions, ...freshOptions };
            console.log('[ANALYTICS-CORE] Using technical settings:', { storedOptions, freshOptions, final: options });
            // Clear stored options after use
            delete this.technicalOptions;
            delete this.technicalSettings;
        }

        // Debug: Log all options being sent
        console.log(`[ANALYTICS-CORE] Endpoint: ${endpoint}, Options being sent:`, options);

        // Special handling for correlation analysis to ensure settings are applied
        if (endpoint === 'correlation-analysis' && Object.keys(options).length > 0) {
            console.log('[ANALYTICS-CORE] CORRELATION: Forcing fresh analysis with options:', options);
        }

        // Filter out options contracts and currency symbols for options analysis
        let filteredData = portfolioData;
        if (endpoint === 'scan-options') {
            filteredData = portfolioData.filter(item => {
                const symbol = item.symbol;
                // Filter out options contracts (contain dates/strikes) and currency symbols
                return symbol &&
                    !symbol.startsWith('CUR:') &&
                    !symbol.includes('C00') &&
                    !symbol.includes('P00') &&
                    !/\d{6}[CP]\d{8}/.test(symbol) &&
                    symbol.length <= 5;
            });
            console.log(`Filtered ${portfolioData.length} items to ${filteredData.length} valid stock symbols for options:`, filteredData.map(p => p.symbol));
        }

        console.log(`Sending ${filteredData.length} portfolio items to ${endpoint}:`, filteredData.map(p => p.symbol));
        const result = await this.callAPI(endpoint, { portfolio: filteredData }, options);

        if (result.success) {
            console.log(`[ANALYTICS-CORE] Calling display function for ${endpoint} with result:`, result);
            console.log(`[ANALYTICS-CORE] Display function options:`, options);

            // Special debugging for Monte Carlo
            if (endpoint === 'monte-carlo') {
                console.log('[ANALYTICS-CORE] MONTE CARLO DEBUG - Result structure:');
                console.log('[ANALYTICS-CORE] Result keys:', Object.keys(result));
                if (result.results) {
                    console.log('[ANALYTICS-CORE] Results keys:', Object.keys(result.results));
                    if (result.results.simulation_data) {
                        const simData = result.results.simulation_data;
                        console.log('[ANALYTICS-CORE] Simulation data type:', typeof simData);
                        console.log('[ANALYTICS-CORE] Simulation data is array:', Array.isArray(simData));
                        console.log('[ANALYTICS-CORE] Simulation data length:', simData?.length || 'N/A');
                        if (Array.isArray(simData) && simData.length > 0) {
                            console.log('[ANALYTICS-CORE] First path type:', typeof simData[0]);
                            console.log('[ANALYTICS-CORE] First path is array:', Array.isArray(simData[0]));
                            console.log('[ANALYTICS-CORE] First path length:', simData[0]?.length || 'N/A');
                            if (Array.isArray(simData[0]) && simData[0].length > 0) {
                                console.log('[ANALYTICS-CORE] First path sample:', simData[0].slice(0, 5));
                            }
                        }
                    }
                }
            }

            // Special debugging for correlation analysis
            if (endpoint === 'correlation-analysis') {
                console.log('[ANALYTICS-CORE] CORRELATION DEBUG - Result structure:');
                console.log('[ANALYTICS-CORE] Result keys:', Object.keys(result));
                if (result.correlation_analysis) {
                    console.log('[ANALYTICS-CORE] Correlation analysis keys:', Object.keys(result.correlation_analysis));
                    console.log('[ANALYTICS-CORE] Correlation matrix keys:', Object.keys(result.correlation_analysis.correlation_matrix || {}));
                    console.log('[ANALYTICS-CORE] Summary:', result.correlation_analysis.summary);
                    // Cache the API result for correlation analysis
                    window.lastCorrelationApiResult = result;
                }
            }

            if (options.background) {
                console.log(`[ANALYTICS-CORE] Background fetch complete for ${endpoint}. Skipping render.`);
                return;
            }

            displayFunction(result, options);
        } else {
            const container = document.getElementById('analysisContent');
            if (container && !options.background) {
                container.innerHTML = `
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-900">Analysis Error</h2>
                        <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="text-red-600 text-center py-4">${result.error || 'Analysis failed'}</div>
                `;
            }
        }
    }

    // Transaction analysis wrapper
    async analyzeTransactions(endpoint, containerId, displayFunction, settingsId = null, explicitSettings = null) {
        // Check user authentication first
        if (!this.isUserLoggedIn()) {
            this.showLoginRequired();
            return;
        }

        // Check for transaction data - no fallbacks
        let transactionData = this.transactionData || window.currentTransactions;

        console.log('[ANALYTICS-CORE] Transaction data check:', {
            hasTransactionData: !!transactionData,
            isArray: Array.isArray(transactionData),
            length: transactionData?.length || 0,
            endpoint: endpoint
        });

        if (!transactionData || !Array.isArray(transactionData) || transactionData.length === 0) {
            console.log('[ANALYTICS-CORE] No transaction data available for', endpoint);
            const analysisName = this.getAnalysisDisplayName(endpoint);
            const container = document.getElementById('analysisContent');
            if (container && !explicitSettings?.background) {
                container.innerHTML = `
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">${analysisName}</h2>
                    </div>
                    <div class="text-center py-4 text-yellow-500">No transaction data available for ${analysisName.toLowerCase()}</div>
                `;
                container.classList.remove('hidden');
            }
            return;
        }

        // Show loading screen for transaction analysis
        const container = document.getElementById('analysisContent');
        if (container && !explicitSettings?.background) {
            container.classList.remove('hidden');
            this.showTransactionLoadingScreen(container, endpoint, transactionData.length);
        }

        let options = settingsId ? this.getFormOptions(settingsId) : {};

        // Apply explicit settings if provided (highest priority)
        if (explicitSettings) {
            options = { ...options, ...explicitSettings };
            console.log('[ANALYTICS-CORE] Applied explicit settings:', explicitSettings);
        }

        // For return attribution, use stored settings if available
        if (endpoint === 'return-attribution' && this.returnAttributionSettings) {
            options = { ...options, ...this.returnAttributionSettings };
            console.log('Using return attribution settings:', this.returnAttributionSettings);
        }

        // For performance attribution, use stored settings if available
        if (endpoint === 'performance-attribution' && this.performanceAttributionSettings) {
            options = { ...options, ...this.performanceAttributionSettings };
            console.log('Using performance attribution settings:', this.performanceAttributionSettings);
        }

        console.log('[ANALYTICS-CORE] Calling API:', {
            endpoint: endpoint,
            transactionCount: transactionData.length,
            sampleTransaction: transactionData[0],
            options: options
        });

        try {
            const result = await this.callAPI(endpoint, { transactions: transactionData }, options);

            console.log(`[ANALYTICS-CORE] ${endpoint} result:`, result);

            if (result.success) {
                if (options.background) {
                    console.log(`[ANALYTICS-CORE] Background fetch complete for ${endpoint}. Skipping render.`);
                    return;
                }
                console.log(`[ANALYTICS-CORE] Calling displayFunction for ${endpoint}`);
                displayFunction(result, options);
            } else {
                if (container && !options.background) {
                    container.innerHTML = `
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-900">Analysis Error</h2>
                            <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="text-red-600 text-center py-4">${result.error || 'Analysis failed'}</div>
                    `;
                }
            }
        } catch (error) {
            console.error(`[ANALYTICS-CORE] ${endpoint} error:`, error);
            if (container) {
                container.innerHTML = `
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Analysis Error</h2>
                    </div>
                    <div class="text-red-500 text-center py-4">Analysis failed: ${error.message}</div>
                `;
            }
        }
    }

    // Set data
    setPortfolioData(data) {
        this.portfolioData = data;
        window.currentPortfolioData = data;
        this.clearCache(); // Invalidate cache on new data
    }

    setTransactionData(data) {
        this.transactionData = data;
        window.currentTransactions = data;
        this.clearCache(); // Invalidate cache on new data
    }

    // Show data source selection
    showDataSourceSelection(type) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        // Ensure other sections are hidden
        const defaultUpload = document.getElementById('defaultUploadSection');
        if (defaultUpload) defaultUpload.classList.add('hidden');
        const dataPreview = document.getElementById('dataPreview');
        if (dataPreview) dataPreview.classList.add('hidden');

        container.classList.remove('hidden');
        const title = type === 'portfolio' ? 'Portfolio Analysis' : 'Transaction Analysis';
        const dataType = type === 'portfolio' ? 'Portfolio' : 'Transaction';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">${title}</h2>
            </div>
            <div class="text-center py-8">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Choose Data Source</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">Select how you want to load ${type} data for analysis:</p>

                <div class="grid grid-cols-1 md:grid-cols-${type === 'portfolio' ? '2' : '1'} gap-4 max-w-lg mx-auto">
                    <div class="border-2 border-card rounded-lg p-6 hover:border-indigo-500 cursor-pointer bg-card" onclick="selectDataSource('${type}', 'upload')">
                        <div class="text-indigo-600 mb-3">
                            <svg class="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <h4 class="font-semibold text-gray-900 dark:text-white mb-2">Upload File</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Upload CSV/Excel files from your computer</p>
                    </div>

                    ${type === 'portfolio' ? `
                    <div class="border-2 border-card rounded-lg p-6 hover:border-green-500 cursor-pointer bg-card" onclick="selectDataSource('${type}', 'plaid')">
                        <div class="text-green-600 mb-3">
                            <svg class="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <h4 class="font-semibold text-gray-900 dark:text-white mb-2">Connect Plaid</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Link your brokerage account directly</p>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Check if user is logged in
    isUserLoggedIn() {
        const user = window.currentUser || localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
        console.log('[AUTH CHECK] User login status:', !!user, user ? 'Logged in' : 'Not logged in');
        return user;
    }

    // Show login required message
    showLoginRequired() {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Login Required</h2>
            </div>
            <div class="text-center py-8">
                <div class="text-gray-400 mb-4">
                    <svg class="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
                <p class="text-gray-600 mb-4">Please log in to access portfolio analysis features.</p>
                <button onclick="showLoginModal()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                    Login
                </button>
            </div>
        `;
    }
}

// Create global instance
window.analyticsCore = new AnalyticsCore();

// Export for modules
window.AnalyticsCore = AnalyticsCore;

// Global data source selection handler
window.selectDataSource = (type, source) => {
    console.log(`Selected ${source} for ${type} data`);

    switch (source) {
        case 'upload':
            if (type === 'portfolio') {
                document.getElementById('portfolioFile').click();
            } else {
                document.getElementById('transactionFile').click();
            }
            break;
        case 'plaid':
            if (type === 'portfolio') {
                togglePlaidConnection();
            }
            break;

    }
};

