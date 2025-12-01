// Unified Analytics Core - Eliminates duplicate code patterns
class AnalyticsCore {
    constructor() {
        this.portfolioData = null;
        this.transactionData = null;
        this.apiBase = window.API_BASE || window.location.origin;
    }

    // Generic API call handler
    async callAPI(endpoint, data, options = {}) {
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
                body: JSON.stringify(requestBody)
            });
            const result = await response.json();
            console.log(`API response from ${endpoint}:`, result);
            return result;
        } catch (error) {
            console.error(`API call failed for ${endpoint}:`, error);
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
            
            <div class="bg-white rounded-lg shadow p-12 text-center">
                <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Processing Your Data</h3>
                <p class="text-gray-600 mb-4">Analyzing ${transactionCount} transactions for ${analysisName.toLowerCase()}...</p>
                <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                    <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
                </div>
                <p class="text-sm text-gray-500">This may take a few moments</p>
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
            
            <div class="bg-white rounded-lg shadow p-12 text-center">
                <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Processing Your Data</h3>
                <p class="text-gray-600 mb-4">Analyzing ${portfolioCount} positions for ${analysisName.toLowerCase()}...</p>
                <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                    <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
                </div>
                <p class="text-sm text-gray-500">This may take a few moments</p>
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
            'fifo-lifo-accounting': 'Accounting Analysis'
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

                options[paramName] = input.value;
            }
        });
        console.log(`[ANALYTICS-CORE] Extracted options from form ${formId}:`, options);
        return options;
    }

    // Portfolio analysis wrapper
    async analyzePortfolio(endpoint, containerId, displayFunction, settingsId = null) {
        // Check user authentication first
        if (!this.isUserLoggedIn()) {
            this.showLoginRequired();
            return;
        }

        // Check for portfolio data - no fallbacks
        let portfolioData = this.portfolioData || window.currentPortfolioData;

        if (!portfolioData || !Array.isArray(portfolioData) || portfolioData.length === 0) {
            this.showDataSourceSelection('portfolio');
            return;
        }

        // Show loading screen for portfolio analysis
        const container = document.getElementById('analysisContent');
        if (container) {
            container.classList.remove('hidden');
            this.showPortfolioLoadingScreen(container, endpoint, portfolioData.length);
        }

        // Get options from settings form or stored settings
        let options = settingsId ? this.getFormOptions(settingsId) : {};

        // For risk analysis, use stored settings if available
        if (endpoint === 'analyze-risk' && this.riskSettings) {
            options = { ...options, ...this.riskSettings };
            console.log('Using risk settings:', this.riskSettings);
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
            displayFunction(result, options);
        } else {
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
                    <div class="text-red-600 text-center py-4">${result.error || 'Analysis failed'}</div>
                `;
            }
        }
    }

    // Transaction analysis wrapper
    async analyzeTransactions(endpoint, containerId, displayFunction, settingsId = null) {
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
            this.showDataSourceSelection('transaction');
            return;
        }

        // Show loading screen for transaction analysis
        const container = document.getElementById('analysisContent');
        if (container) {
            container.classList.remove('hidden');
            this.showTransactionLoadingScreen(container, endpoint, transactionData.length);
        }

        let options = settingsId ? this.getFormOptions(settingsId) : {};

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
                console.log(`[ANALYTICS-CORE] Calling displayFunction for ${endpoint}`);
                displayFunction(result, options);
            } else {
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
                        <div class="text-red-600 text-center py-4">${result.error || 'Analysis failed'}</div>
                    `;
                }
            }
        } catch (error) {
            console.error(`[ANALYTICS-CORE] ${endpoint} error:`, error);
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
                    <div class="text-red-600 text-center py-4">Analysis failed: ${error.message}</div>
                `;
            }
        }
    }

    // Set data
    setPortfolioData(data) {
        this.portfolioData = data;
        window.currentPortfolioData = data;
    }

    setTransactionData(data) {
        this.transactionData = data;
        window.currentTransactions = data;
    }

    // Show data source selection
    showDataSourceSelection(type) {
        const container = document.getElementById('analysisContent');
        if (!container) return;

        container.classList.remove('hidden');
        const title = type === 'portfolio' ? 'Portfolio Analysis' : 'Transaction Analysis';
        const dataType = type === 'portfolio' ? 'Portfolio' : 'Transaction';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">${title}</h2>
                <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
            <div class="text-center py-8">
                <h3 class="text-lg font-medium text-gray-900 mb-4">Choose Data Source</h3>
                <p class="text-gray-600 mb-6">Select how you want to load ${type} data for analysis:</p>
                
                <div class="grid grid-cols-1 md:grid-cols-${type === 'portfolio' ? '2' : '1'} gap-4 max-w-lg mx-auto">
                    <div class="border-2 border-gray-200 rounded-lg p-6 hover:border-indigo-300 cursor-pointer" onclick="selectDataSource('${type}', 'upload')">
                        <div class="text-indigo-600 mb-3">
                            <svg class="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <h4 class="font-semibold text-gray-900 mb-2">Upload File</h4>
                        <p class="text-sm text-gray-600">Upload CSV/Excel files from your computer</p>
                    </div>
                    
                    ${type === 'portfolio' ? `
                    <div class="border-2 border-gray-200 rounded-lg p-6 hover:border-green-300 cursor-pointer" onclick="selectDataSource('${type}', 'plaid')">
                        <div class="text-green-600 mb-3">
                            <svg class="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <h4 class="font-semibold text-gray-900 mb-2">Connect Plaid</h4>
                        <p class="text-sm text-gray-600">Link your brokerage account directly</p>
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
                <h2 class="text-2xl font-bold text-gray-900">Login Required</h2>
                <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
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

