// Modern Portfolio Analysis App
let currentUser = null;
let portfolioData = null;
let plaidHandler = null;
let userPortfolios = [];

const API_BASE = `${window.location.origin}/api`;

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    console.log('Modern app initializing...');

    // Theme toggle setup
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.checked = savedTheme === 'dark';

        themeToggle.addEventListener('change', () => {
            const newTheme = themeToggle.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    initializeApp();
});

function initializeApp() {
    // Check if user is logged in
    if (window.SessionManager && SessionManager.isLoggedIn()) {
        currentUser = SessionManager.getSession();
        showMainApp();
    }

    // Setup forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    // Load user data if logged in
    if (currentUser) {
        loadUserPortfolios();
        loadUserTransactions();
    }
}

// Authentication functions
function showAuthTab(tabName) {
    // Hide all auth tabs
    document.getElementById('loginTab').classList.add('hidden');
    document.getElementById('registerTab').classList.add('hidden');

    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.remove('hidden');

    // Update button styles
    const loginBtn = document.getElementById('loginTabBtn');
    const registerBtn = document.getElementById('registerTabBtn');

    if (tabName === 'login') {
        loginBtn.className = 'tab-active px-6 py-3 rounded-lg font-semibold transition-all';
        registerBtn.className = 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all';
    } else {
        registerBtn.className = 'tab-active px-6 py-3 rounded-lg font-semibold transition-all';
        loginBtn.className = 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            if (window.SessionManager) {
                SessionManager.saveSession(currentUser);
            }
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showMainApp();
        } else {
            showError(data.error || 'Invalid credentials');
        }
    } catch (error) {
        showError('Login failed: ' + error.message);
    }

    showLoading(false);
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const role = document.getElementById('registerRole').value;
    const password = document.getElementById('registerPassword').value;

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, phone, role, password })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Registration successful! Please login.');
            showAuthTab('login');
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Registration failed');
    }

    showLoading(false);
}

function logout() {
    if (window.SessionManager) {
        SessionManager.clearSession();
    }
    localStorage.removeItem('currentUser');

    currentUser = null;
    portfolioData = null;
    userPortfolios = [];

    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('userInfo').style.display = 'none';

    showSuccess('Logged out successfully');
}

function showMainApp() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('username').textContent = currentUser.username;
    document.getElementById('userInfo').style.display = 'flex';

    applyRoleBasedAccess(currentUser.role);

    setTimeout(() => {
        const lastTab = localStorage.getItem('activeTab') || 'portfolio';
        showTab(lastTab);
    }, 100);

    loadUserPortfolios();
    loadUserTransactions();
}

function applyRoleBasedAccess(userRole) {
    const rolePermissions = {
        'portfolio_manager': ['portfolio', 'transactions', 'plaid', 'risk', 'options', 'analytics'],
        'analyst': ['portfolio', 'transactions', 'risk', 'analytics'],
        'risk_manager': ['portfolio', 'transactions', 'risk', 'analytics'],
        'compliance': ['portfolio', 'transactions'],
        'viewer': ['portfolio', 'transactions', 'risk', 'options', 'analytics'],
        'admin': ['portfolio', 'transactions', 'plaid', 'risk', 'options', 'analytics']
    };

    const allowedTabs = rolePermissions[userRole] || ['portfolio', 'transactions', 'risk', 'options', 'analytics'];
    const allTabs = ['portfolio', 'transactions', 'plaid', 'risk', 'options', 'analytics'];

    allTabs.forEach(tab => {
        const tabButton = document.getElementById(tab + 'NavBtn');
        if (tabButton) {
            if (allowedTabs.includes(tab)) {
                tabButton.style.display = 'block';
            } else {
                tabButton.style.display = 'none';
            }
        }
    });

    // Show Admin Button if user is admin
    const adminBtn = document.getElementById('adminBtn');
    const mobileAdminBtn = document.getElementById('mobileAdminBtn');

    console.log('[RoleAccess] Checking admin access for role:', userRole);

    const isAdmin = ['admin', 'sub_admin', 'super_admin'].includes(userRole?.toLowerCase());

    if (isAdmin) {
        console.log('[RoleAccess] User is admin, showing buttons');
        if (adminBtn) adminBtn.style.display = 'block';
        if (mobileAdminBtn) mobileAdminBtn.style.display = 'block';
    } else {
        console.log('[RoleAccess] User is NOT admin');
        if (adminBtn) adminBtn.style.display = 'none';
        if (mobileAdminBtn) mobileAdminBtn.style.display = 'none';
    }
}

function showAdminPanel() {
    window.location.href = 'admin.html';
}

// Tab navigation with modern styling
function showTab(tabName) {
    console.log('Switching to tab:', tabName);
    localStorage.setItem('activeTab', tabName);

    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });

    // Show selected tab
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) {
        targetTab.style.display = 'block';
    }

    // Update navigation button styles
    const allNavBtns = ['portfolioNavBtn', 'transactionsNavBtn', 'plaidNavBtn', 'riskNavBtn', 'optionsNavBtn', 'analyticsNavBtn'];
    allNavBtns.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (btnId === tabName + 'NavBtn') {
                btn.className = 'tab-active px-6 py-3 rounded-lg font-semibold transition-all';
            } else {
                btn.className = 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all';
            }
        }
    });
}

// Portfolio functions (keeping existing functionality)
async function uploadPortfolio() {
    const fileInput = document.getElementById('portfolioFile');
    const file = fileInput.files[0];

    if (!file) {
        showError('Please select a file');
        return;
    }

    showLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/upload-portfolio`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            portfolioData = data.portfolio;
            displayPortfolio(portfolioData);
            showSuccess('Portfolio uploaded successfully');
        } else {
            showError(data.error || 'Upload failed');
        }
    } catch (error) {
        showError('Upload failed: ' + error.message);
    }

    showLoading(false);
}

function displayPortfolio(data) {
    const container = document.getElementById('portfolioData');

    let html = '<div class="bg-white rounded-xl shadow-lg p-6 mb-8">';
    html += '<h3 class="text-xl font-bold text-gray-900 mb-4">Portfolio Holdings</h3>';
    html += '<div class="overflow-x-auto">';
    html += '<table class="min-w-full">';
    html += '<thead><tr><th class="text-left">Symbol</th><th class="text-left">Quantity</th><th class="text-left">Avg Cost</th><th class="text-left">Market Value</th></tr></thead>';
    html += '<tbody>';

    let totalValue = 0;
    data.forEach(holding => {
        const marketValue = holding.quantity * holding.avg_cost;
        totalValue += marketValue;
        html += `<tr>
            <td class="font-semibold text-indigo-600">${holding.symbol}</td>
            <td class="metric-value">${holding.quantity}</td>
            <td class="metric-value">$${holding.avg_cost.toFixed(2)}</td>
            <td class="metric-value">$${marketValue.toFixed(2)}</td>
        </tr>`;
    });

    html += '</tbody></table></div>';

    // Total value card
    html += '<div class="mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">';
    html += '<div class="text-center">';
    html += `<div class="text-3xl font-bold metric-value">$${totalValue.toLocaleString()}</div>`;
    html += '<div class="text-indigo-100">Total Portfolio Value</div>';
    html += '</div></div>';
    html += '</div>';

    container.innerHTML = html;

    // Create charts
    createPortfolioCharts(data);

    // Auto-run analysis
    setTimeout(() => {
        if (currentUser && currentUser.role) {
            analyzeRisk();
            scanOptions();
            runMonteCarlo();
            technicalAnalysis();
        }
    }, 1000);

    // Show save section
    if (currentUser && currentUser.user_id) {
        document.getElementById('savePortfolioSection').style.display = 'block';
    }
}

function createPortfolioCharts(data) {
    if (!data || data.length === 0) return;

    // Validate and Clean Data
    const validData = data.filter(item =>
        item.symbol &&
        !isNaN(parseFloat(item.quantity)) &&
        !isNaN(parseFloat(item.avg_cost))
    );

    if (validData.length === 0) return;

    // Portfolio Allocation Chart (ApexCharts)
    const allocationOptions = {
        series: validData.map(item => {
            const val = parseFloat(item.quantity) * parseFloat(item.avg_cost);
            return isNaN(val) ? 0 : val;
        }),
        chart: { type: 'donut', height: 350 },
        labels: validData.map(item => item.symbol),
        colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'],
        title: { text: 'Portfolio Allocation', align: 'center', style: { fontSize: '18px', fontWeight: 'bold' } },
        legend: { position: 'bottom' },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total Value',
                            formatter: () => {
                                const total = validData.reduce((sum, item) => {
                                    const val = parseFloat(item.quantity) * parseFloat(item.avg_cost);
                                    return sum + (isNaN(val) ? 0 : val);
                                }, 0);
                                return '$' + total.toLocaleString();
                            }
                        }
                    }
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: (val) => isNaN(val) ? '0%' : val.toFixed(1) + '%'
        }
    };

    // Performance Bar Chart
    const performanceOptions = {
        series: [{
            name: 'Market Value',
            data: validData.map(item => {
                const val = parseFloat(item.quantity) * parseFloat(item.avg_cost);
                return isNaN(val) ? 0 : val;
            })
        }],
        chart: { type: 'bar', height: 350 },
        xaxis: { categories: validData.map(item => item.symbol) },
        yaxis: {
            labels: {
                formatter: val => '$' + (isNaN(val) ? 0 : val).toLocaleString()
            }
        },
        colors: ['#6366f1'],
        title: { text: 'Holdings Comparison', align: 'center', style: { fontSize: '18px', fontWeight: 'bold' } },
        dataLabels: {
            enabled: true,
            formatter: val => '$' + (isNaN(val) ? 0 : val).toLocaleString()
        },
        plotOptions: {
            bar: {
                borderRadius: 4,
                horizontal: false
            }
        }
    };

    // Clear and render charts
    const allocationContainer = document.querySelector('#allocationChart');
    const performanceContainer = document.querySelector('#performanceChart');

    if (allocationContainer) {
        allocationContainer.innerHTML = '';
        new ApexCharts(allocationContainer, allocationOptions).render();
    }

    if (performanceContainer) {
        performanceContainer.innerHTML = '';
        new ApexCharts(performanceContainer, performanceOptions).render();
    }
}

// Keep existing API functions but update UI styling
async function loadUserPortfolios() {
    if (!currentUser || !currentUser.user_id) return;

    try {
        const response = await fetch(`${API_BASE}/load-portfolios?user_id=${currentUser.user_id}`);
        const data = await response.json();

        if (data.success) {
            userPortfolios = data.portfolios || [];
            updatePortfolioDropdown();
        }
    } catch (error) {
        console.error('Failed to load portfolios:', error);
    }
}

function updatePortfolioDropdown() {
    const select = document.getElementById('savedPortfolios');
    select.innerHTML = '<option value="">Select a portfolio...</option>';

    userPortfolios.forEach(portfolio => {
        const option = document.createElement('option');
        option.value = portfolio.id;
        option.textContent = `${portfolio.portfolio_name} (${new Date(portfolio.created_at).toLocaleDateString()})`;
        select.appendChild(option);
    });
}

async function loadSavedPortfolio() {
    const select = document.getElementById('savedPortfolios');
    const portfolioId = select.value;
    const deleteBtn = document.getElementById('deletePortfolioBtn');

    if (!portfolioId) {
        deleteBtn.style.display = 'none';
        return;
    }

    deleteBtn.style.display = 'block';

    const portfolio = userPortfolios.find(p => p.id === portfolioId);
    if (portfolio) {
        portfolioData = portfolio.portfolio_data;
        displayPortfolio(portfolioData);
        document.getElementById('savePortfolioSection').style.display = 'none';
        showSuccess(`Loaded portfolio: ${portfolio.portfolio_name}`);
    }
}

// Utility functions
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `${type} fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg max-w-sm`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 5000);
}

// Keep all existing analysis functions but update their display styling
// (analyzeRisk, scanOptions, runMonteCarlo, etc. - these would need similar UI updates)

// Placeholder functions for missing functionality
async function loadUserTransactions() {
    // Implementation would be similar to loadUserPortfolios
}

async function analyzeRisk() {
    if (!portfolioData || portfolioData.length === 0) {
        showError('Please upload a portfolio first');
        return;
    }
    showError('Risk analysis integration pending');
}

async function scanOptions() {
    // Keep existing implementation  
}

async function runMonteCarlo() {
    // Keep existing implementation
}

async function technicalAnalysis() {
    // Keep existing implementation
}

// Analytics placeholder functions
async function runMonteCarlo() {
    showError('Monte Carlo analysis not yet implemented');
}

async function analyzeSentiment() {
    showError('Sentiment analysis not yet implemented');
}

async function runMLPrediction() {
    showError('ML prediction not yet implemented');
}

async function portfolioOptimization() {
    showError('Portfolio optimization not yet implemented');
}

async function sectorAnalysis() {
    showError('Sector analysis not yet implemented');
}

// Strategy Backtesting
async function strategyBacktesting() {
    console.log('Strategy backtesting button clicked');

    if (!portfolioData || portfolioData.length === 0) {
        showError('Please upload a portfolio first');
        return;
    }

    // Show backtesting settings interface
    if (window.backtestingManager) {
        window.backtestingManager.showBacktestingSettings();
    } else {
        showError('Backtesting module not loaded');
    }
}

async function analyzeTradePerformance() {
    showError('Trade performance analysis not yet implemented');
}

async function analyzeTurnover() {
    showError('Turnover analysis not yet implemented');
}

async function analyzeTaxHarvesting() {
    showError('Tax harvesting analysis not yet implemented');
}

async function analyzeCashFlow() {
    showError('Cash flow analysis not yet implemented');
}

async function analyzeTradeTimimg() {
    showError('Trade timing analysis not yet implemented');
}

async function analyzeDrawdown() {
    showError('Drawdown analysis not yet implemented');
}

async function downloadSamplePortfolio() {
    // Keep existing implementation
}

async function saveCurrentPortfolio() {
    // Keep existing implementation with updated UI
}

async function refreshPortfolios() {
    loadUserPortfolios();
    showSuccess('Portfolios refreshed');
}

async function deleteSelectedPortfolio() {
    // Keep existing implementation
}

// Statistical Analysis Functions
function statisticalAnalysis() {
    console.log('Statistical analysis button clicked');

    // Check if we have portfolio data
    if (!portfolioData || portfolioData.length === 0) {
        showError('Please upload a portfolio first');
        return;
    }

    // Use analytics manager to load statistical analysis
    if (window.analyticsManager && window.analyticsManager.loadModule) {
        window.analyticsManager.loadModule('statistical-analysis');
    }
}

async function runStatisticalAnalysis() {
    if (!portfolioData || portfolioData.length === 0) {
        showError('Please upload a portfolio first');
        return;
    }

    showLoading(true);

    try {
        const options = {
            lookback_period: document.getElementById('lookbackPeriod').value,
            frequency: document.getElementById('frequency').value,
            benchmark: document.getElementById('benchmark').value,
            confidence_level: parseFloat(document.getElementById('confidenceLevel').value)
        };

        console.log('Sending statistical analysis request:', { portfolio: portfolioData, options });

        const response = await fetch(`${API_BASE}/statistical-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                portfolio: portfolioData,
                options: options
            })
        });

        const data = await response.json();
        console.log('Statistical analysis response:', data);

        if (data.success && data.statistical_analysis) {
            displayStatisticalResults(data.statistical_analysis);
            showSuccess('Statistical analysis completed');
        } else {
            console.error('Statistical analysis error:', data.error);
            showError(data.error || 'Statistical analysis failed');
        }
    } catch (error) {
        showError('Statistical analysis failed: ' + error.message);
    }

    showLoading(false);
}

function displayStatisticalResults(results) {
    console.log('Displaying statistical results:', results);

    const resultsDiv = document.getElementById('statisticalResults');
    const contentDiv = document.getElementById('statisticalContent');

    if (!resultsDiv || !contentDiv) {
        console.error('Statistical results containers not found');
        return;
    }

    if (!results) {
        console.error('No results to display');
        contentDiv.innerHTML = '<p class="text-red-600">No statistical analysis results available</p>';
        resultsDiv.style.display = 'block';
        return;
    }

    resultsDiv.style.display = 'block';

    let html = '';

    // Parameters Summary
    if (results.parameters) {
        html += '<div class="mb-6 p-4 bg-gray-50 rounded-lg">';
        html += '<h4 class="font-semibold text-gray-900 mb-2">Analysis Parameters</h4>';
        html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">';
        html += `<div><span class="font-medium">Period:</span> ${results.parameters.lookback_period}</div>`;
        html += `<div><span class="font-medium">Frequency:</span> ${results.parameters.frequency}</div>`;
        html += `<div><span class="font-medium">Benchmark:</span> ${results.parameters.benchmark}</div>`;
        html += `<div><span class="font-medium">Confidence:</span> ${(results.parameters.confidence_level * 100).toFixed(0)}%</div>`;
        html += '</div></div>';
    }

    // Correlation Analysis
    if (results.correlation_analysis) {
        html += '<div class="mb-6">';
        html += '<h4 class="font-semibold text-gray-900 mb-3">Correlation Analysis</h4>';
        html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">';
        html += `<div class="bg-blue-50 p-4 rounded-lg text-center">`;
        html += `<div class="text-2xl font-bold text-blue-600">${(results.correlation_analysis.average_correlation * 100).toFixed(1)}%</div>`;
        html += `<div class="text-sm text-gray-600">Average Correlation</div>`;
        html += `</div>`;
        html += `<div class="bg-green-50 p-4 rounded-lg text-center">`;
        html += `<div class="text-2xl font-bold text-green-600">${(Math.max(...Object.values(results.correlation_analysis.matrix).map(row => Math.max(...Object.values(row).filter(v => v < 1)))) * 100).toFixed(1)}%</div>`;
        html += `<div class="text-sm text-gray-600">Highest Correlation</div>`;
        html += `</div>`;
        html += `<div class="bg-red-50 p-4 rounded-lg text-center">`;
        html += `<div class="text-2xl font-bold text-red-600">${(Math.min(...Object.values(results.correlation_analysis.matrix).map(row => Math.min(...Object.values(row)))) * 100).toFixed(1)}%</div>`;
        html += `<div class="text-sm text-gray-600">Lowest Correlation</div>`;
        html += `</div>`;
        html += '</div>';

        // High correlation pairs
        if (results.correlation_analysis.pairs && Object.keys(results.correlation_analysis.pairs).length > 0) {
            html += '<div class="bg-yellow-50 p-4 rounded-lg">';
            html += '<h5 class="font-medium text-gray-900 mb-2">Significant Correlations</h5>';
            html += '<div class="space-y-1 text-sm">';
            Object.entries(results.correlation_analysis.pairs).slice(0, 5).forEach(([pair, data]) => {
                const correlation = (data.correlation * 100).toFixed(1);
                const color = Math.abs(data.correlation) > 0.7 ? 'text-red-600' : 'text-yellow-600';
                html += `<div class="flex justify-between"><span>${pair}</span><span class="${color} font-medium">${correlation}%</span></div>`;
            });
            html += '</div></div>';
        }
        html += '</div>';
    }

    // Risk Metrics
    if (results.risk_metrics) {
        html += '<div class="mb-6">';
        html += '<h4 class="font-semibold text-gray-900 mb-3">Risk Metrics</h4>';
        html += '<div class="overflow-x-auto">';
        html += '<table class="min-w-full bg-white border border-gray-200 rounded-lg">';
        html += '<thead class="bg-gray-50"><tr>';
        html += '<th class="px-4 py-2 text-left text-sm font-medium text-gray-900">Symbol</th>';
        html += '<th class="px-4 py-2 text-left text-sm font-medium text-gray-900">Volatility</th>';
        html += '<th class="px-4 py-2 text-left text-sm font-medium text-gray-900">Sharpe Ratio</th>';
        html += '<th class="px-4 py-2 text-left text-sm font-medium text-gray-900">VaR</th>';
        html += '<th class="px-4 py-2 text-left text-sm font-medium text-gray-900">Max Drawdown</th>';
        html += '</tr></thead><tbody>';

        Object.entries(results.risk_metrics).forEach(([symbol, metrics]) => {
            html += '<tr class="border-t">';
            html += `<td class="px-4 py-2 font-medium text-indigo-600">${symbol}</td>`;
            html += `<td class="px-4 py-2">${(metrics.volatility * 100).toFixed(2)}%</td>`;
            html += `<td class="px-4 py-2">${metrics.sharpe_ratio.toFixed(3)}</td>`;
            html += `<td class="px-4 py-2">${(metrics.var * 100).toFixed(2)}%</td>`;
            html += `<td class="px-4 py-2">${(metrics.max_drawdown * 100).toFixed(2)}%</td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div></div>';
    }

    // Performance Metrics
    if (results.performance_metrics) {
        html += '<div class="mb-6">';
        html += '<h4 class="font-semibold text-gray-900 mb-3">Performance vs Benchmark</h4>';
        html += '<div class="overflow-x-auto">';
        html += '<table class="min-w-full bg-white border border-gray-200 rounded-lg">';
        html += '<thead class="bg-gray-50"><tr>';
        html += '<th class="px-4 py-2 text-left text-sm font-medium text-gray-900">Symbol</th>';
        html += '<th class="px-4 py-2 text-left text-sm font-medium text-gray-900">Beta</th>';
        html += '<th class="px-4 py-2 text-left text-sm font-medium text-gray-900">Alpha</th>';
        html += '<th class="px-4 py-2 text-left text-sm font-medium text-gray-900">R-squared</th>';
        html += '<th class="px-4 py-2 text-left text-sm font-medium text-gray-900">Correlation</th>';
        html += '</tr></thead><tbody>';

        Object.entries(results.performance_metrics).forEach(([symbol, metrics]) => {
            html += '<tr class="border-t">';
            html += `<td class="px-4 py-2 font-medium text-indigo-600">${symbol}</td>`;
            html += `<td class="px-4 py-2">${metrics.beta.toFixed(3)}</td>`;
            html += `<td class="px-4 py-2">${(metrics.alpha * 100).toFixed(3)}%</td>`;
            html += `<td class="px-4 py-2">${(metrics.r_squared * 100).toFixed(1)}%</td>`;
            html += `<td class="px-4 py-2">${(metrics.correlation_with_benchmark * 100).toFixed(1)}%</td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div></div>';
    }

    // Portfolio Metrics (if available)
    if (results.portfolio_metrics) {
        html += '<div class="mb-6">';
        html += '<h4 class="font-semibold text-gray-900 mb-3">Portfolio Summary</h4>';
        html += '<div class="grid grid-cols-2 md:grid-cols-3 gap-4">';
        html += `<div class="bg-indigo-50 p-4 rounded-lg text-center">`;
        html += `<div class="text-2xl font-bold text-indigo-600">${results.portfolio_metrics.portfolio_beta.toFixed(3)}</div>`;
        html += `<div class="text-sm text-gray-600">Portfolio Beta</div>`;
        html += `</div>`;
        html += `<div class="bg-green-50 p-4 rounded-lg text-center">`;
        html += `<div class="text-2xl font-bold text-green-600">${(results.portfolio_metrics.portfolio_alpha * 100).toFixed(3)}%</div>`;
        html += `<div class="text-sm text-gray-600">Portfolio Alpha</div>`;
        html += `</div>`;
        html += `<div class="bg-blue-50 p-4 rounded-lg text-center">`;
        html += `<div class="text-2xl font-bold text-blue-600">${(results.portfolio_metrics.portfolio_r_squared * 100).toFixed(1)}%</div>`;
        html += `<div class="text-sm text-gray-600">R-squared</div>`;
        html += `</div>`;
        html += '</div></div>';
    }

    contentDiv.innerHTML = html;
}

// Simple fallback display for statistical results
function displaySimpleStatisticalResults(data) {
    console.log('Using simple display for:', data);

    const contentDiv = document.getElementById('statisticalContent');
    if (!contentDiv) return;

    let html = '<div class="p-4 bg-gray-50 rounded-lg">';
    html += '<h4 class="font-semibold text-gray-900 mb-4">Statistical Analysis Results</h4>';

    // Handle different response formats
    if (data.portfolio_statistics) {
        html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">';
        html += `<div class="bg-blue-50 p-3 rounded text-center">`;
        html += `<div class="text-xl font-bold text-blue-600">${(data.portfolio_statistics.benchmark_correlation * 100).toFixed(1)}%</div>`;
        html += `<div class="text-sm text-gray-600">Correlation</div></div>`;
        html += `<div class="bg-green-50 p-3 rounded text-center">`;
        html += `<div class="text-xl font-bold text-green-600">${data.portfolio_statistics.beta.toFixed(3)}</div>`;
        html += `<div class="text-sm text-gray-600">Beta</div></div>`;
        html += `<div class="bg-purple-50 p-3 rounded text-center">`;
        html += `<div class="text-xl font-bold text-purple-600">${(data.portfolio_statistics.alpha * 100).toFixed(2)}%</div>`;
        html += `<div class="text-sm text-gray-600">Alpha</div></div>`;
        html += `<div class="bg-red-50 p-3 rounded text-center">`;
        html += `<div class="text-xl font-bold text-red-600">${(data.portfolio_statistics.r_squared * 100).toFixed(1)}%</div>`;
        html += `<div class="text-sm text-gray-600">R-Squared</div></div>`;
        html += '</div>';
    }

    if (data.risk_metrics) {
        html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">';
        html += `<div class="bg-yellow-50 p-3 rounded text-center">`;
        html += `<div class="text-xl font-bold text-yellow-600">${(data.risk_metrics.portfolio_volatility * 100).toFixed(2)}%</div>`;
        html += `<div class="text-sm text-gray-600">Portfolio Volatility</div></div>`;
        html += `<div class="bg-orange-50 p-3 rounded text-center">`;
        html += `<div class="text-xl font-bold text-orange-600">${(data.risk_metrics.tracking_error * 100).toFixed(2)}%</div>`;
        html += `<div class="text-sm text-gray-600">Tracking Error</div></div>`;
        html += `<div class="bg-indigo-50 p-3 rounded text-center">`;
        html += `<div class="text-xl font-bold text-indigo-600">${data.risk_metrics.information_ratio.toFixed(3)}</div>`;
        html += `<div class="text-sm text-gray-600">Information Ratio</div></div>`;
        html += `<div class="bg-teal-50 p-3 rounded text-center">`;
        html += `<div class="text-xl font-bold text-teal-600">${(data.performance_metrics.sharpe_ratio || 0).toFixed(3)}</div>`;
        html += `<div class="text-sm text-gray-600">Sharpe Ratio</div></div>`;
        html += '</div>';
    }

    if (data.summary) {
        html += '<div class="mt-4 p-3 bg-white rounded border">';
        html += '<h5 class="font-medium text-gray-900 mb-2">Analysis Summary</h5>';
        html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">';
        html += `<div><span class="font-medium">Period:</span> ${data.summary.lookback_period || 'N/A'}</div>`;
        html += `<div><span class="font-medium">Benchmark:</span> ${data.summary.benchmark || 'N/A'}</div>`;
        html += `<div><span class="font-medium">Confidence:</span> ${data.summary.confidence_level || 'N/A'}%</div>`;
        html += `<div><span class="font-medium">Data Points:</span> ${data.summary.data_points || 'N/A'}</div>`;
        html += '</div></div>';
    }

    html += '</div>';
    contentDiv.innerHTML = html;
}

// Analysis type switching for analytics tab
function switchAnalysisType(type) {
    // Update button styles
    const portfolioBtn = document.getElementById('portfolioAnalysisBtn');
    const transactionBtn = document.getElementById('transactionAnalysisBtn');

    if (type === 'portfolio') {
        portfolioBtn.className = 'tab-active px-6 py-3 rounded-lg font-semibold transition-all';
        transactionBtn.className = 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all';

        document.getElementById('portfolioAnalysisSection').style.display = 'block';
        document.getElementById('transactionAnalysisSection').style.display = 'none';
    } else {
        transactionBtn.className = 'tab-active px-6 py-3 rounded-lg font-semibold transition-all';
        portfolioBtn.className = 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all';

        document.getElementById('portfolioAnalysisSection').style.display = 'none';
        document.getElementById('transactionAnalysisSection').style.display = 'block';
    }

    // Clear results
    const resultsDiv = document.getElementById('analyticsResults');
    if (resultsDiv) resultsDiv.innerHTML = '';
}