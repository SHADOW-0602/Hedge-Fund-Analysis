// Authentication module
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/api/login`, {
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
            if (window.ProgressManager) {
                ProgressManager.saveProgress('lastLogin', { timestamp: Date.now() });
            }
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showMainApp();
        } else {
            currentUser = null;
            localStorage.removeItem('currentUser');
            if (window.SessionManager) {
                SessionManager.clearSession();
            }
            showError(data.error || 'Invalid credentials');
        }
    } catch (error) {
        showError('Login failed: ' + error.message);
    }

    showLoading(false);
}

function logout() {
    if (window.SessionManager) {
        SessionManager.clearSession();
    }
    localStorage.removeItem('currentUser');
    localStorage.removeItem('appState');

    currentUser = null;
    portfolioData = null;
    userPortfolios = [];

    window.location.href = 'auth.html';
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
        const response = await fetch(`${API_BASE}/api/register`, {
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

function showAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(tabName + 'Tab').classList.add('active');

    const targetButton = document.querySelector(`[onclick="showAuthTab('${tabName}')"]`);
    if (targetButton) {
        targetButton.classList.add('active');
    }
}

function applyRoleBasedAccess(userRole) {
    const rolePermissions = {
        'user': ['portfolio', 'transactions', 'plaid', 'risk', 'options', 'analytics'],
        'admin': ['portfolio', 'transactions', 'plaid', 'risk', 'options', 'analytics']
    };

    const allowedTabs = rolePermissions[userRole] || ['portfolio', 'transactions', 'risk', 'options', 'analytics'];
    const allTabs = ['portfolio', 'transactions', 'plaid', 'risk', 'options', 'analytics'];

    allTabs.forEach(tab => {
        const tabButton = document.querySelector(`[onclick="showTab('${tab}')"]`);
        if (tabButton) {
            if (allowedTabs.includes(tab)) {
                tabButton.style.display = 'flex';
            } else {
                tabButton.style.display = 'none';
            }
        }
    });

    const userInfo = document.getElementById('userInfo');
    if (userRole === 'admin' && userInfo) {
        const adminLink = document.createElement('button');
        adminLink.onclick = () => window.location.href = 'admin.html';
        adminLink.className = 'bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors mr-2';
        adminLink.textContent = 'Admin Portal';
        userInfo.insertBefore(adminLink, userInfo.firstChild);
    }

    if (allowedTabs.length > 0) {
        showTab(allowedTabs[0]);
    }
}

// Export functions
window.handleLogin = handleLogin;
window.logout = logout;
window.handleRegister = handleRegister;
window.showAuthTab = showAuthTab;
window.applyRoleBasedAccess = applyRoleBasedAccess;