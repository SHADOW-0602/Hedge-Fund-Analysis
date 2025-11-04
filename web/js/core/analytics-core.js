// Unified Analytics Core - Eliminates duplicate code patterns
class AnalyticsCore {
    constructor() {
        this.portfolioData = null;
        this.transactionData = null;
        this.apiBase = window.API_BASE || 'http://127.0.0.1:8080';
    }

    // Generic API call handler
    async callAPI(endpoint, data, options = {}) {
        try {
            console.log(`Making API call to ${endpoint} with data:`, data);
            const response = await fetch(`${this.apiBase}/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, options })
            });
            const result = await response.json();
            console.log(`API response from ${endpoint}:`, result);
            return result;
        } catch (error) {
            console.error(`API call failed for ${endpoint}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Generic loading spinner - removed
    showLoading(containerId, message = 'Loading...') {
        // Loading spinner removed
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
        if (!form) return {};
        
        const options = {};
        const inputs = form.querySelectorAll('select, input');
        inputs.forEach(input => {
            if (input.id) {
                options[input.id] = input.value;
            }
        });
        return options;
    }

    // Portfolio analysis wrapper
    async analyzePortfolio(endpoint, containerId, displayFunction, settingsId = null) {
        // Check multiple sources for portfolio data
        let portfolioData = this.portfolioData;
        if (!portfolioData) {
            portfolioData = window.currentPortfolioData;
        }
        if (!portfolioData) {
            portfolioData = window.portfolioData;
        }
        if (!portfolioData) {
            try {
                portfolioData = JSON.parse(localStorage.getItem('currentPortfolio') || 'null');
            } catch (e) {}
        }
        
        if (!portfolioData || !Array.isArray(portfolioData) || portfolioData.length === 0) {
            const container = document.getElementById('analysisContent');
            if (container) {
                container.classList.remove('hidden');
                container.innerHTML = `
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-900">Portfolio Analysis</h2>
                        <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="text-center py-8">
                        <div class="text-gray-400 mb-4">
                            <svg class="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">No Portfolio Data</h3>
                        <p class="text-gray-600 mb-4">Upload portfolio files or connect via Plaid to perform portfolio analysis.</p>
                        <div class="flex gap-2 justify-center">
                            <button onclick="document.getElementById('portfolioFile').click()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                                Upload Portfolio
                            </button>
                            <button onclick="togglePlaidConnection()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                                Connect Plaid
                            </button>
                        </div>
                    </div>
                `;
            }
            return;
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
        if (endpoint === 'performance-attribution' && this.performanceSettings) {
            options = { ...options, ...this.performanceSettings };
            console.log('Using performance settings:', this.performanceSettings);
        }
        
        // For Monte Carlo, use stored settings if available
        if (endpoint === 'monte-carlo' && this.monteCarloSettings) {
            options = { ...options, ...this.monteCarloSettings };
            console.log('Using Monte Carlo settings:', this.monteCarloSettings);
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
        // Check multiple sources for transaction data
        let transactionData = this.transactionData;
        if (!transactionData) {
            transactionData = window.currentTransactions;
        }
        if (!transactionData) {
            try {
                transactionData = JSON.parse(localStorage.getItem('currentTransactions') || 'null');
            } catch (e) {}
        }
        
        if (!transactionData || !Array.isArray(transactionData) || transactionData.length === 0) {
            const container = document.getElementById('analysisContent');
            if (container) {
                container.classList.remove('hidden');
                container.innerHTML = `
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-900">Transaction Analysis</h2>
                        <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="text-center py-8">
                        <div class="text-gray-400 mb-4">
                            <svg class="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">No Transaction Data</h3>
                        <p class="text-gray-600 mb-4">Upload transaction files to perform transaction-based analysis.</p>
                        <button onclick="document.getElementById('transactionFile').click()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                            Upload Transactions
                        </button>
                    </div>
                `;
            }
            return;
        }

        // Show container without loading spinner
        const container = document.getElementById('analysisContent');
        if (container) {
            container.classList.remove('hidden');
        }
        
        const options = settingsId ? this.getFormOptions(settingsId) : {};
        const result = await this.callAPI(endpoint, { transactions: transactionData }, options);
        
        if (result.success) {
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
}

// Create global instance
window.analyticsCore = new AnalyticsCore();

// Export for modules
window.AnalyticsCore = AnalyticsCore;