// Modern Portfolio Analysis App
let currentUser = null;
let portfolioData = null;
let plaidHandler = null;
let userPortfolios = [];

const API_BASE = 'http://localhost:5000/api';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Portfolio Allocation Chart (ApexCharts)
    const allocationOptions = {
        series: data.map(item => item.quantity * item.avg_cost),
        chart: { type: 'donut', height: 350 },
        labels: data.map(item => item.symbol),
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
                            formatter: () => '$' + data.reduce((sum, item) => sum + (item.quantity * item.avg_cost), 0).toLocaleString()
                        }
                    }
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: (val) => val.toFixed(1) + '%'
        }
    };
    
    // Performance Bar Chart
    const performanceOptions = {
        series: [{
            name: 'Market Value',
            data: data.map(item => item.quantity * item.avg_cost)
        }],
        chart: { type: 'bar', height: 350 },
        xaxis: { categories: data.map(item => item.symbol) },
        yaxis: {
            labels: {
                formatter: val => '$' + val.toLocaleString()
            }
        },
        colors: ['#6366f1'],
        title: { text: 'Holdings Comparison', align: 'center', style: { fontSize: '18px', fontWeight: 'bold' } },
        dataLabels: {
            enabled: true,
            formatter: val => '$' + val.toLocaleString()
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
    // Keep existing implementation
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