// Refactored main application file
class HedgeFundApp {
    constructor() {
        this.API_BASE = 'http://localhost:5000/api';
        this.initializeManagers();
        this.bindEventListeners();
    }

    initializeManagers() {
        // Initialize all manager instances
        this.authManager = new AuthManager();
        this.portfolioManager = new PortfolioManager();
        this.transactionManager = new TransactionManager();
        this.analyticsManager = new AnalyticsManager();
        this.uiManager = new UIManager();
        this.plaidManager = new PlaidManager();
        this.displayManager = new DisplayManager();

        // Make managers globally available
        window.authManager = this.authManager;
        window.portfolioManager = this.portfolioManager;
        window.transactionManager = this.transactionManager;
        window.analyticsManager = this.analyticsManager;
        window.uiManager = this.uiManager;
        window.plaidManager = this.plaidManager;
        window.displayManager = this.displayManager;
    }

    bindEventListeners() {
        // File upload listeners
        const portfolioFileInput = document.getElementById('portfolioFile');
        const transactionFileInput = document.getElementById('transactionFile');

        if (portfolioFileInput) {
            portfolioFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.handlePortfolioUpload(file);
            });
        }

        if (transactionFileInput) {
            transactionFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.handleTransactionUpload(file);
            });
        }

        // Global function bindings for HTML onclick handlers
        window.handleLogin = this.handleLogin.bind(this);
        window.handleRegister = this.handleRegister.bind(this);
        window.logout = this.authManager.logout.bind(this.authManager);
        window.showTab = this.uiManager.showTab.bind(this.uiManager);
        window.showAuthTab = this.uiManager.showAuthTab.bind(this.uiManager);
        window.uploadPortfolio = this.handlePortfolioUpload.bind(this);
        window.uploadTransactions = this.handleTransactionUpload.bind(this);
        window.connectPlaid = this.plaidManager.connectPlaid.bind(this.plaidManager);
        window.analyzeRisk = this.handleRiskAnalysis.bind(this);
        window.scanOptions = this.handleOptionsAnalysis.bind(this);
        window.runMonteCarlo = this.handleMonteCarloAnalysis.bind(this);
        window.downloadSamplePortfolio = this.downloadSamplePortfolio.bind(this);
        window.downloadSampleTransactions = this.transactionManager.generateSampleTransactions.bind(this.transactionManager);
        window.runBacktestAnalysis = this.handleBacktestAnalysis.bind(this);
        window.runStockScreening = this.handleStockScreening.bind(this);
        window.showStockScreener = this.showStockScreener.bind(this);
    }

    async initialize() {
        console.log('Initializing Hedge Fund Analysis App...');

        // Check authentication
        if (!this.authManager.isLoggedIn()) {
            window.location.href = 'auth.html';
            return;
        }

        const currentUser = this.authManager.getCurrentUser();
        if (currentUser) {
            this.showMainApp();
            await this.connectSupabaseAndLoadData();
        }
    }

    showMainApp() {
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.style.display = 'flex';
        }

        const currentUser = this.authManager.getCurrentUser();
        if (currentUser) {
            this.authManager.applyRoleBasedAccess(currentUser.role);

            // Show admin button if admin
            const adminBtn = document.getElementById('adminBtn');
            if (adminBtn && currentUser.role === 'admin') {
                adminBtn.style.display = 'inline-block';
            }
        }

        this.loadUserData();
    }

    async loadUserData() {
        await Promise.all([
            this.portfolioManager.loadUserPortfolios(),
            this.transactionManager.loadUserTransactions()
        ]);
        this.uiManager.updateFileSelectors();
    }

    async connectSupabaseAndLoadData() {
        const currentUser = this.authManager.getCurrentUser();
        if (!currentUser || !currentUser.user_id) {
            console.log('No user logged in, skipping Supabase connection');
            return;
        }

        try {
            console.log('Connecting to Supabase and loading stored data...');
            await this.loadUserData();
            console.log('✓ Data loaded successfully');
        } catch (error) {
            console.log('Database connection failed, using local storage only:', error);
        }
    }

    // Event handlers
    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        this.uiManager.showLoading(true);

        const result = await this.authManager.handleLogin(username, password);

        if (result.success) {
            this.showMainApp();
            this.uiManager.showSuccess('Login successful');
        } else {
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    async handleRegister(e) {
        e.preventDefault();
        const userData = {
            username: document.getElementById('registerUsername').value,
            email: document.getElementById('registerEmail').value,
            phone: document.getElementById('registerPhone').value,
            role: document.getElementById('registerRole').value,
            password: document.getElementById('registerPassword').value
        };

        this.uiManager.showLoading(true);

        const result = await this.authManager.handleRegister(userData);

        if (result.success) {
            this.uiManager.showSuccess('Registration successful! Please login.');
            this.uiManager.showAuthTab('login');
        } else {
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    async handlePortfolioUpload(file) {
        if (!file) {
            const fileInput = document.getElementById('portfolioFile');
            file = fileInput?.files[0];
        }

        if (!file) {
            this.uiManager.showError('Please select a portfolio file');
            return;
        }

        const statusDiv = document.getElementById('portfolioUploadStatus');
        if (statusDiv) {
            statusDiv.innerHTML = '<span class="text-blue-600">Uploading portfolio...</span>';
        }

        this.uiManager.showLoading(true);

        const result = await this.portfolioManager.uploadPortfolio(file);

        if (result.success) {
            this.displayManager.displayPortfolio(result.portfolio);

            if (statusDiv) {
                statusDiv.innerHTML = '<span class="text-green-600">✓ Portfolio uploaded successfully</span>';
            }

            this.uiManager.showSuccess('Portfolio uploaded successfully');

            // Show save section
            const saveSection = document.getElementById('savePortfolioSection');
            if (saveSection) {
                saveSection.style.display = 'block';
            }
        } else {
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="text-red-600">✗ Upload failed</span>';
            }
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    async handleTransactionUpload(file) {
        if (!file) {
            const fileInput = document.getElementById('transactionFile');
            file = fileInput?.files[0];
        }

        if (!file) {
            this.uiManager.showError('Please select a transaction file');
            return;
        }

        const statusDiv = document.getElementById('transactionUploadStatus');
        if (statusDiv) {
            statusDiv.innerHTML = '<span class="text-purple-600">Uploading transactions...</span>';
        }

        this.uiManager.showLoading(true);

        const result = await this.transactionManager.uploadTransactions(file);

        if (result.success) {
            const analysisResult = await this.transactionManager.analyzeTransactions(result.transactions);

            if (analysisResult.success) {
                this.displayManager.displayTransactionResults(analysisResult);
            }

            if (statusDiv) {
                statusDiv.innerHTML = '<span class="text-green-600">✓ Transactions uploaded successfully</span>';
            }

            this.uiManager.showSuccess('Transactions uploaded successfully');
        } else {
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="text-red-600">✗ Upload failed</span>';
            }
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    async handleRiskAnalysis() {
        const portfolioData = this.portfolioManager.getPortfolioData();
        if (!portfolioData || portfolioData.length === 0) {
            this.uiManager.showError('Please upload portfolio first');
            return;
        }

        this.uiManager.showLoading(true);

        const currentUser = this.authManager.getCurrentUser();
        const result = await this.analyticsManager.analyzeRisk(portfolioData, currentUser?.role || 'user');

        if (result.success) {
            this.displayManager.updateRiskResults(result.risk_metrics);
            this.uiManager.showSuccess('Risk analysis completed');
        } else {
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    async handleOptionsAnalysis() {
        const portfolioData = this.portfolioManager.getPortfolioData();
        if (!portfolioData) {
            this.uiManager.showError('Please upload portfolio first');
            return;
        }

        this.uiManager.showLoading(true);

        const symbols = portfolioData.map(p => p.symbol);
        console.log(`[OPTIONS ANALYSIS] Starting analysis for ${symbols.length} symbols:`, symbols);

        const result = await this.analyticsManager.scanOptions(symbols);
        console.log(`[OPTIONS ANALYSIS] Result:`, result);

        if (result.success) {
            console.log(`[OPTIONS ANALYSIS] Found ${result.opportunities?.length || 0} opportunities`);
            // Use the analytics manager's display function directly
            this.analyticsManager.displayOptionsStrategies(result, {});
            this.uiManager.showSuccess('Options analysis completed');
        } else {
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    async handleMonteCarloAnalysis() {
        const portfolioData = this.portfolioManager.getPortfolioData();
        if (!portfolioData) {
            this.uiManager.showError('Please upload portfolio first');
            return;
        }

        this.uiManager.showLoading(true);

        const currentUser = this.authManager.getCurrentUser();
        const result = await this.analyticsManager.runMonteCarlo(portfolioData, currentUser?.role || 'user');

        if (result.success) {
            this.displayManager.createMonteCarloResults(portfolioData, result.results);
            this.uiManager.showSuccess('Monte Carlo simulation completed');
        } else {
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    async downloadSamplePortfolio() {
        // Check for logged in user
        const currentUser = this.authManager.getCurrentUser();
        if (!currentUser || !currentUser.user_id) {
            this.uiManager.showError('Please login to export portfolio');
            return;
        }

        this.uiManager.showLoading(true);

        try {
            let portfolioToExport = [];

            // 1. Prioritize currently viewed portfolio
            const portfolioData = this.portfolioManager.getPortfolioData();
            if (portfolioData && portfolioData.length > 0) {
                portfolioToExport = portfolioData;
                console.log('Exporting currently viewed portfolio');
            }
            // 2. Fallback to API fetch
            else {
                console.log('Fetching portfolio from API for export');
                const url = `${this.API_BASE}/load-portfolios?user_id=${currentUser.user_id}&_t=${Date.now()}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.success && Array.isArray(data.portfolios) && data.portfolios.length > 0) {
                    const latest = data.portfolios[0];
                    let pData = latest.portfolio_data || [];
                    if (typeof pData === 'string') {
                        try { pData = JSON.parse(pData); } catch (e) { pData = []; }
                    }
                    portfolioToExport = pData;
                }
            }

            if (!portfolioToExport || portfolioToExport.length === 0) {
                this.uiManager.showError('No portfolio data found to export.');
                this.uiManager.showLoading(false);
                return;
            }

            // Generate CSV
            const headers = ['Symbol', 'Quantity', 'Price', 'Date', 'Type']; // Standard headers
            // Or infer headers from data
            const allKeys = new Set();
            portfolioToExport.forEach(p => Object.keys(p).forEach(k => allKeys.add(k)));
            const dynamicHeaders = Array.from(allKeys);

            // Allow standard headers priority but fall back to dynamic
            const finalHeaders = dynamicHeaders.length > 0 ? dynamicHeaders : headers;

            const csvRows = [finalHeaders.join(',')];

            portfolioToExport.forEach(p => {
                const row = finalHeaders.map(header => {
                    let val = p[header] !== undefined ? p[header] : '';
                    if (typeof val === 'string') {
                        val = val.replace(/"/g, '""');
                    }
                    return `"${val}"`;
                });
                csvRows.push(row.join(','));
            });

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'export_portfolio.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.uiManager.showSuccess('Portfolio exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            this.uiManager.showError('Failed to export portfolio: ' + error.message);
        } finally {
            this.uiManager.showLoading(false);
        }
    }

    // Portfolio management functions
    async saveCurrentPortfolio() {
        const portfolioName = document.getElementById('portfolioName')?.value;
        if (!portfolioName) {
            this.uiManager.showError('Please enter a portfolio name');
            return;
        }

        this.uiManager.showLoading(true);

        const result = await this.portfolioManager.saveCurrentPortfolio(portfolioName);

        if (result.success) {
            this.uiManager.showSuccess('Portfolio saved successfully!');
            document.getElementById('portfolioName').value = '';
            document.getElementById('portfolioFile').value = '';
            const saveSection = document.getElementById('savePortfolioSection');
            if (saveSection) {
                saveSection.style.display = 'none';
            }
        } else {
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    async loadSavedPortfolio() {
        const select = document.getElementById('savedPortfolios');
        const portfolioId = select?.value;

        if (!portfolioId) {
            return;
        }

        this.uiManager.showLoading(true);

        const result = await this.portfolioManager.loadSavedPortfolio(portfolioId);

        if (result.success) {
            this.displayManager.displayPortfolio(result.portfolio);
            this.uiManager.showSuccess(`Loaded portfolio: ${result.name}`);
        } else {
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    async handleBacktestAnalysis() {
        const portfolioData = this.portfolioManager.getPortfolioData();
        if (!portfolioData) {
            this.uiManager.showError('Please upload portfolio first');
            return;
        }

        const strategy = document.getElementById('backtestStrategy')?.value || 'buy_hold';
        const symbols = portfolioData.map(p => p.symbol);
        const startDate = '2023-01-01';
        const endDate = '2024-01-01';

        this.uiManager.showLoading(true);

        const result = await this.analyticsManager.runBacktest(strategy, symbols, startDate, endDate);

        if (result.success) {
            this.displayManager.displayBacktestResults(result);
            this.uiManager.showSuccess('Backtest completed');
        } else {
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    async handleStockScreening() {
        const criteria = {
            market_cap: document.getElementById('marketCapFilter')?.value || '',
            pe_ratio_max: parseFloat(document.getElementById('peRatioMax')?.value) || null,
            dividend_yield_min: parseFloat(document.getElementById('dividendYieldMin')?.value) || null
        };

        const universe = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'META', 'AMZN', 'JPM', 'JNJ', 'PG'];

        this.uiManager.showLoading(true);

        const result = await this.analyticsManager.screenStocks(criteria, universe);

        if (result.success) {
            this.displayManager.displayScreeningResults(result);
            this.uiManager.showSuccess('Stock screening completed');
        } else {
            this.uiManager.showError(result.error);
        }

        this.uiManager.showLoading(false);
    }

    showStockScreener() {
        const screener = document.getElementById('stockScreener');
        if (screener) {
            screener.classList.remove('hidden');
            screener.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

// Global functions for HTML onclick handlers
window.saveCurrentPortfolio = function () {
    window.app?.saveCurrentPortfolio();
};

window.loadSavedPortfolio = function () {
    window.app?.loadSavedPortfolio();
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, initializing refactored app...');

    window.app = new HedgeFundApp();
    window.app.initialize();

    console.log('Refactored app initialized successfully');
});