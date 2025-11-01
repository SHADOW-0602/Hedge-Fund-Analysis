// Authentication JavaScript
const API_BASE = `${window.location.origin}/api`;

document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    if (window.SessionManager && SessionManager.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }
    
    // Setup forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
});

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
        loginBtn.className = 'tab-active px-6 py-3 rounded-lg font-semibold transition-all flex-1';
        registerBtn.className = 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all flex-1';
    } else {
        registerBtn.className = 'tab-active px-6 py-3 rounded-lg font-semibold transition-all flex-1';
        loginBtn.className = 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all flex-1';
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
            // Save session
            if (window.SessionManager) {
                SessionManager.saveSession(data.user);
            }
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            
            // Redirect to main app
            window.location.href = 'index.html';
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
    const password = document.getElementById('registerPassword').value;

    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, phone, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Registration successful! Please sign in.');
            showAuthTab('login');
            // Clear form
            document.getElementById('registerForm').reset();
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Registration failed');
    }
    
    showLoading(false);
}

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