// Authentication JavaScript
const API_URL = `${window.location.origin}/api`;

document.addEventListener('DOMContentLoaded', function () {
    // Check if already logged in
    if (window.SessionManager && SessionManager.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    // Setup forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordRequestForm').addEventListener('submit', handleResetRequest);
    document.getElementById('forgotPasswordConfirmForm').addEventListener('submit', handleResetConfirm);

    // Password Auto-Suggest
    const regPassInput = document.getElementById('registerPassword');
    if (regPassInput) {
        regPassInput.addEventListener('focus', function () {
            if (!this.value) {
                const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
                let password = '';
                const length = 16;

                // Ensure complexity
                password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));
                password += 'abcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * 26));
                password += '0123456789'.charAt(Math.floor(Math.random() * 10));
                password += '!@#$%^&*'.charAt(Math.floor(Math.random() * 8));

                for (let i = 4; i < length; i++) {
                    password += chars.charAt(Math.floor(Math.random() * chars.length));
                }

                password = password.split('').sort(() => 0.5 - Math.random()).join('');

                this.value = password;
                this.type = 'text'; // Show it
                this.select(); // Select for easy overwrite
                updateStrengthMeter(this.value);
            }
        });

        regPassInput.addEventListener('blur', function () {
            if (this.value) {
                this.type = 'password'; // Hide on blur
            }
        });

        regPassInput.addEventListener('input', function () {
            updateStrengthMeter(this.value);
        });
    }
});

function updateStrengthMeter(password) {
    const meter = document.getElementById('passwordStrength');
    const feedback = document.getElementById('passwordFeedback');
    const bars = document.querySelectorAll('.strength-bar');

    if (!password) {
        meter.classList.add('hidden');
        return;
    }

    meter.classList.remove('hidden');

    let score = 0;
    let messages = [];

    if (password.length > 8) score++;
    if (password.length > 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    // Cap score at 4 for 4 bars
    // But calculate detailed score for logic
    // Simplified logic for 4 bars:
    // 0: Very Weak (<8 chars)
    // 1: Weak (>8 chars)
    // 2: Medium (Mixed content)
    // 3: Strong (Complex)
    // 4: Very Strong

    // Recalculate robust score
    let robustScore = 0;
    if (password.length >= 8) robustScore += 1;
    if (password.length >= 12) robustScore += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) robustScore += 1;
    if (/[0-9]/.test(password)) robustScore += 1;
    if (/[^A-Za-z0-9]/.test(password)) robustScore += 1;

    // Normalize to 0-4 bars
    let activeBars = Math.min(4, Math.max(1, robustScore - 1));
    if (password.length < 8) activeBars = 1;

    // Reset colors
    bars.forEach(bar => {
        bar.className = 'strength-bar flex-1 rounded-full bg-gray-200 transition-all duration-300';
    });

    // Set active colors
    let colorClass = 'bg-red-500';
    let message = 'Too weak';

    if (robustScore >= 4) {
        colorClass = 'bg-green-500';
        message = 'Strong password';
    } else if (robustScore >= 3) {
        colorClass = 'bg-yellow-500';
        message = 'Medium strength';
    } else {
        if (password.length < 8) message = 'Too short (min 8 chars)';
        else message = 'Add numbers/symbols for strength';
    }

    for (let i = 0; i < activeBars; i++) {
        bars[i].classList.remove('bg-gray-200');
        bars[i].classList.add(colorClass);
    }

    feedback.textContent = message;
    feedback.className = `text-xs font-medium ${robustScore >= 4 ? 'text-green-600' : (robustScore >= 3 ? 'text-yellow-600' : 'text-red-500')}`;
}

function showAuthTab(tabName) {
    // Hide all auth tabs
    document.getElementById('loginTab').classList.add('hidden');
    document.getElementById('registerTab').classList.add('hidden');
    document.getElementById('forgotPasswordTab').classList.add('hidden');

    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.remove('hidden');

    // Update button styles
    const loginBtn = document.getElementById('loginTabBtn');
    const registerBtn = document.getElementById('registerTabBtn');

    // Reset buttons
    loginBtn.className = 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all flex-1';
    registerBtn.className = 'bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all flex-1';

    if (tabName === 'login') {
        loginBtn.className = 'tab-active px-6 py-3 rounded-lg font-semibold transition-all flex-1';
    } else if (tabName === 'register') {
        registerBtn.className = 'tab-active px-6 py-3 rounded-lg font-semibold transition-all flex-1';
    }
}

function handleGoogleLogin() {
    window.location.href = `${API_URL}/auth/google/login`;
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    showLoading(true);

    try {
        const response = await fetch(`${API_URL}/login`, {
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
        const response = await fetch(`${API_URL}/register`, {
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

async function handleResetRequest(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;

    showLoading(true);

    try {
        const response = await fetch(`${API_URL}/auth/reset-password-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Verification code sent to your email');
            document.getElementById('forgotPasswordRequestForm').classList.add('hidden');
            document.getElementById('forgotPasswordConfirmForm').classList.remove('hidden');
        } else {
            showError(data.error || 'Failed to send code');
        }
    } catch (error) {
        showError('Request failed: ' + error.message);
    }

    showLoading(false);
}

async function handleResetConfirm(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const otp = document.getElementById('forgotOtp').value;
    const new_password = document.getElementById('forgotNewPassword').value;

    showLoading(true);

    try {
        const response = await fetch(`${API_URL}/auth/reset-password-confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, new_password })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Password reset successfully! Please sign in.');
            showAuthTab('login');
            // Clear forms
            document.getElementById('forgotPasswordRequestForm').reset();
            document.getElementById('forgotPasswordConfirmForm').reset();
            // Reset visibility
            document.getElementById('forgotPasswordRequestForm').classList.remove('hidden');
            document.getElementById('forgotPasswordConfirmForm').classList.add('hidden');
        } else {
            showError(data.error || 'Failed to reset password');
        }
    } catch (error) {
        showError('Reset failed: ' + error.message);
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