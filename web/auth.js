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
    const phoneInput = document.getElementById('registerPhone').value;
    const countryCode = document.getElementById('countryCode').value;
    const password = document.getElementById('registerPassword').value;

    let phone = null;
    if (phoneInput) {
        // combine code and number
        const cleanNumber = phoneInput.replace(/^\+/, '').replace(/\D/g, '');
        if (cleanNumber) {
            phone = countryCode + cleanNumber;
        }
    }

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

// --- Country Selector Logic ---
const countries = [
    { code: "+93", flag: "🇦🇫", name: "Afghanistan" },
    { code: "+355", flag: "🇦🇱", name: "Albania" },
    { code: "+213", flag: "🇩🇿", name: "Algeria" },
    { code: "+1684", flag: "🇦🇸", name: "American Samoa" },
    { code: "+376", flag: "🇦🇩", name: "Andorra" },
    { code: "+244", flag: "🇦🇴", name: "Angola" },
    { code: "+1264", flag: "🇦🇮", name: "Anguilla" },
    { code: "+672", flag: "🇦🇶", name: "Antarctica" },
    { code: "+1268", flag: "🇦🇬", name: "Antigua and Barbuda" },
    { code: "+54", flag: "🇦🇷", name: "Argentina" },
    { code: "+374", flag: "🇦🇲", name: "Armenia" },
    { code: "+297", flag: "🇦🇼", name: "Aruba" },
    { code: "+61", flag: "🇦🇺", name: "Australia" },
    { code: "+43", flag: "🇦🇹", name: "Austria" },
    { code: "+994", flag: "🇦🇿", name: "Azerbaijan" },
    { code: "+1242", flag: "🇧🇸", name: "Bahamas" },
    { code: "+973", flag: "🇧🇭", name: "Bahrain" },
    { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
    { code: "+1246", flag: "🇧🇧", name: "Barbados" },
    { code: "+375", flag: "🇧🇾", name: "Belarus" },
    { code: "+32", flag: "🇧🇪", name: "Belgium" },
    { code: "+501", flag: "🇧🇿", name: "Belize" },
    { code: "+229", flag: "🇧🇯", name: "Benin" },
    { code: "+1441", flag: "🇧🇲", name: "Bermuda" },
    { code: "+975", flag: "🇧🇹", name: "Bhutan" },
    { code: "+591", flag: "🇧🇴", name: "Bolivia" },
    { code: "+387", flag: "🇧🇦", name: "Bosnia and Herzegovina" },
    { code: "+267", flag: "🇧🇼", name: "Botswana" },
    { code: "+55", flag: "🇧🇷", name: "Brazil" },
    { code: "+246", flag: "🇮🇴", name: "British Indian Ocean Territory" },
    { code: "+1284", flag: "🇻🇬", name: "British Virgin Islands" },
    { code: "+673", flag: "🇧🇳", name: "Brunei" },
    { code: "+359", flag: "🇧🇬", name: "Bulgaria" },
    { code: "+226", flag: "🇧🇫", name: "Burkina Faso" },
    { code: "+257", flag: "🇧🇮", name: "Burundi" },
    { code: "+855", flag: "🇰🇭", name: "Cambodia" },
    { code: "+237", flag: "🇨🇲", name: "Cameroon" },
    { code: "+1", flag: "🇨🇦", name: "Canada" },
    { code: "+238", flag: "🇨🇻", name: "Cape Verde" },
    { code: "+599", flag: "🇧🇶", name: "Caribbean Netherlands" },
    { code: "+1345", flag: "🇰🇾", name: "Cayman Islands" },
    { code: "+236", flag: "🇨🇫", name: "Central African Republic" },
    { code: "+235", flag: "🇹🇩", name: "Chad" },
    { code: "+56", flag: "🇨🇱", name: "Chile" },
    { code: "+86", flag: "🇨🇳", name: "China" },
    { code: "+61", flag: "🇨🇽", name: "Christmas Island" },
    { code: "+61", flag: "🇨🇨", name: "Cocos (Keeling) Islands" },
    { code: "+57", flag: "🇨🇴", name: "Colombia" },
    { code: "+269", flag: "🇰🇲", name: "Comoros" },
    { code: "+242", flag: "🇨🇬", name: "Congo - Brazzaville" },
    { code: "+243", flag: "🇨🇩", name: "Congo - Kinshasa" },
    { code: "+682", flag: "🇨🇰", name: "Cook Islands" },
    { code: "+506", flag: "🇨🇷", name: "Costa Rica" },
    { code: "+385", flag: "🇭🇷", name: "Croatia" },
    { code: "+53", flag: "🇨🇺", name: "Cuba" },
    { code: "+599", flag: "🇨🇼", name: "Curaçao" },
    { code: "+357", flag: "🇨🇾", name: "Cyprus" },
    { code: "+420", flag: "🇨🇿", name: "Czech Republic" },
    { code: "+45", flag: "🇩🇰", name: "Denmark" },
    { code: "+253", flag: "🇩🇯", name: "Djibouti" },
    { code: "+1767", flag: "🇩🇲", name: "Dominica" },
    { code: "+1809", flag: "🇩🇴", name: "Dominican Republic" },
    { code: "+593", flag: "🇪🇨", name: "Ecuador" },
    { code: "+20", flag: "🇪🇬", name: "Egypt" },
    { code: "+503", flag: "🇸🇻", name: "El Salvador" },
    { code: "+240", flag: "🇬🇶", name: "Equatorial Guinea" },
    { code: "+291", flag: "🇪🇷", name: "Eritrea" },
    { code: "+372", flag: "🇪🇪", name: "Estonia" },
    { code: "+251", flag: "🇪🇹", name: "Ethiopia" },
    { code: "+500", flag: "🇫🇰", name: "Falkland Islands" },
    { code: "+298", flag: "🇫🇴", name: "Faroe Islands" },
    { code: "+679", flag: "🇫🇯", name: "Fiji" },
    { code: "+358", flag: "🇫🇮", name: "Finland" },
    { code: "+33", flag: "🇫🇷", name: "France" },
    { code: "+594", flag: "🇬🇫", name: "French Guiana" },
    { code: "+689", flag: "🇵🇫", name: "French Polynesia" },
    { code: "+241", flag: "🇬🇦", name: "Gabon" },
    { code: "+220", flag: "🇬🇲", name: "Gambia" },
    { code: "+995", flag: "🇬🇪", name: "Georgia" },
    { code: "+49", flag: "🇩🇪", name: "Germany" },
    { code: "+233", flag: "🇬🇭", name: "Ghana" },
    { code: "+350", flag: "🇬🇮", name: "Gibraltar" },
    { code: "+30", flag: "🇬🇷", name: "Greece" },
    { code: "+299", flag: "🇬🇱", name: "Greenland" },
    { code: "+1473", flag: "🇬🇩", name: "Grenada" },
    { code: "+590", flag: "🇬🇵", name: "Guadeloupe" },
    { code: "+1671", flag: "🇬🇺", name: "Guam" },
    { code: "+502", flag: "🇬🇹", name: "Guatemala" },
    { code: "+44", flag: "🇬🇬", name: "Guernsey" },
    { code: "+224", flag: "🇬🇳", name: "Guinea" },
    { code: "+245", flag: "🇬🇳", name: "Guinea-Bissau" },
    { code: "+592", flag: "🇬🇾", name: "Guyana" },
    { code: "+509", flag: "🇭🇹", name: "Haiti" },
    { code: "+504", flag: "🇭🇳", name: "Honduras" },
    { code: "+852", flag: "🇭🇰", name: "Hong Kong SAR China" },
    { code: "+36", flag: "🇭🇺", name: "Hungary" },
    { code: "+354", flag: "🇮🇸", name: "Iceland" },
    { code: "+91", flag: "🇮🇳", name: "India" },
    { code: "+62", flag: "🇮🇩", name: "Indonesia" },
    { code: "+98", flag: "🇮🇷", name: "Iran" },
    { code: "+964", flag: "🇮🇶", name: "Iraq" },
    { code: "+353", flag: "🇮🇪", name: "Ireland" },
    { code: "+44", flag: "🇮🇲", name: "Isle of Man" },
    { code: "+972", flag: "🇮🇱", name: "Israel" },
    { code: "+39", flag: "🇮🇹", name: "Italy" },
    { code: "+225", flag: "🇨🇮", name: "Ivory Coast" },
    { code: "+1876", flag: "🇯🇲", name: "Jamaica" },
    { code: "+81", flag: "🇯🇵", name: "Japan" },
    { code: "+44", flag: "🇯🇪", name: "Jersey" },
    { code: "+962", flag: "🇯🇴", name: "Jordan" },
    { code: "+7", flag: "🇰🇿", name: "Kazakhstan" },
    { code: "+254", flag: "🇰🇪", name: "Kenya" },
    { code: "+686", flag: "🇰🇮", name: "Kiribati" },
    { code: "+383", flag: "🇽🇰", name: "Kosovo" },
    { code: "+965", flag: "🇰🇼", name: "Kuwait" },
    { code: "+996", flag: "🇰🇬", name: "Kyrgyzstan" },
    { code: "+856", flag: "🇱🇦", name: "Laos" },
    { code: "+371", flag: "🇱🇻", name: "Latvia" },
    { code: "+961", flag: "🇱🇧", name: "Lebanon" },
    { code: "+266", flag: "🇱🇸", name: "Lesotho" },
    { code: "+231", flag: "🇱🇷", name: "Liberia" },
    { code: "+218", flag: "🇱🇾", name: "Libya" },
    { code: "+423", flag: "🇱🇮", name: "Liechtenstein" },
    { code: "+370", flag: "🇱🇹", name: "Lithuania" },
    { code: "+352", flag: "🇱🇺", name: "Luxembourg" },
    { code: "+853", flag: "🇲🇴", name: "Macau SAR China" },
    { code: "+389", flag: "🇲🇰", name: "Macedonia" },
    { code: "+261", flag: "🇲🇬", name: "Madagascar" },
    { code: "+265", flag: "🇲🇼", name: "Malawi" },
    { code: "+60", flag: "🇲🇾", name: "Malaysia" },
    { code: "+960", flag: "🇲🇻", name: "Maldives" },
    { code: "+223", flag: "🇲🇱", name: "Mali" },
    { code: "+356", flag: "🇲🇹", name: "Malta" },
    { code: "+692", flag: "🇲🇭", name: "Marshall Islands" },
    { code: "+596", flag: "🇲🇶", name: "Martinique" },
    { code: "+222", flag: "🇲🇷", name: "Mauritania" },
    { code: "+230", flag: "🇲🇺", name: "Mauritius" },
    { code: "+262", flag: "🇾🇹", name: "Mayotte" },
    { code: "+52", flag: "🇲🇽", name: "Mexico" },
    { code: "+691", flag: "🇫🇲", name: "Micronesia" },
    { code: "+373", flag: "🇲🇩", name: "Moldova" },
    { code: "+377", flag: "🇲🇨", name: "Monaco" },
    { code: "+976", flag: "🇲🇳", name: "Mongolia" },
    { code: "+382", flag: "🇲🇪", name: "Montenegro" },
    { code: "+1664", flag: "🇲🇸", name: "Montserrat" },
    { code: "+212", flag: "🇲🇦", name: "Morocco" },
    { code: "+258", flag: "🇲🇿", name: "Mozambique" },
    { code: "+95", flag: "🇲🇲", name: "Myanmar (Burma)" },
    { code: "+264", flag: "🇳🇦", name: "Namibia" },
    { code: "+674", flag: "🇳🇷", name: "Nauru" },
    { code: "+977", flag: "🇳🇵", name: "Nepal" },
    { code: "+31", flag: "🇳🇱", name: "Netherlands" },
    { code: "+687", flag: "🇳🇨", name: "New Caledonia" },
    { code: "+64", flag: "🇳🇿", name: "New Zealand" },
    { code: "+505", flag: "🇳🇮", name: "Nicaragua" },
    { code: "+227", flag: "🇳🇪", name: "Niger" },
    { code: "+234", flag: "🇳🇬", name: "Nigeria" },
    { code: "+683", flag: "🇳🇺", name: "Niue" },
    { code: "+672", flag: "🇳🇫", name: "Norfolk Island" },
    { code: "+850", flag: "🇰🇵", name: "North Korea" },
    { code: "+1670", flag: "🇲🇵", name: "Northern Mariana Islands" },
    { code: "+47", flag: "🇳🇴", name: "Norway" },
    { code: "+968", flag: "🇴🇲", name: "Oman" },
    { code: "+92", flag: "🇵🇰", name: "Pakistan" },
    { code: "+680", flag: "🇵🇼", name: "Palau" },
    { code: "+970", flag: "🇵🇸", name: "Palestinian Territories" },
    { code: "+507", flag: "🇵🇦", name: "Panama" },
    { code: "+675", flag: "🇵🇬", name: "Papua New Guinea" },
    { code: "+595", flag: "🇵🇾", name: "Paraguay" },
    { code: "+51", flag: "🇵🇪", name: "Peru" },
    { code: "+63", flag: "🇵🇭", name: "Philippines" },
    { code: "+64", flag: "🇵🇳", name: "Pitcairn Islands" },
    { code: "+48", flag: "🇵🇱", name: "Poland" },
    { code: "+351", flag: "🇵🇹", name: "Portugal" },
    { code: "+1", flag: "🇵🇷", name: "Puerto Rico" },
    { code: "+974", flag: "🇶🇦", name: "Qatar" },
    { code: "+262", flag: "🇷🇪", name: "Réunion" },
    { code: "+40", flag: "🇷🇴", name: "Romania" },
    { code: "+7", flag: "🇷🇺", name: "Russia" },
    { code: "+250", flag: "🇷🇼", name: "Rwanda" },
    { code: "+590", flag: "🇧🇱", name: "Saint Barthélemy" },
    { code: "+290", flag: "🇸🇭", name: "Saint Helena" },
    { code: "+1869", flag: "🇰🇳", name: "Saint Kitts and Nevis" },
    { code: "+1758", flag: "🇱🇨", name: "Saint Lucia" },
    { code: "+590", flag: "🇲🇫", name: "Saint Martin" },
    { code: "+508", flag: "🇵🇲", name: "Saint Pierre and Miquelon" },
    { code: "+1784", flag: "🇻🇨", name: "Saint Vincent and the Grenadines" },
    { code: "+685", flag: "🇼🇸", name: "Samoa" },
    { code: "+378", flag: "🇸🇲", name: "San Marino" },
    { code: "+239", flag: "🇸🇹", name: "São Tomé and Príncipe" },
    { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
    { code: "+221", flag: "🇸🇳", name: "Senegal" },
    { code: "+381", flag: "🇷🇸", name: "Serbia" },
    { code: "+248", flag: "🇸🇨", name: "Seychelles" },
    { code: "+232", flag: "🇸🇱", name: "Sierra Leone" },
    { code: "+65", flag: "🇸🇬", name: "Singapore" },
    { code: "+1721", flag: "🇸🇽", name: "Sint Maarten" },
    { code: "+421", flag: "🇸🇰", name: "Slovakia" },
    { code: "+386", flag: "🇸🇮", name: "Slovenia" },
    { code: "+677", flag: "🇸🇧", name: "Solomon Islands" },
    { code: "+252", flag: "🇸🇴", name: "Somalia" },
    { code: "+27", flag: "🇿🇦", name: "South Africa" },
    { code: "+500", flag: "🇬🇸", name: "South Georgia & South Sandwich Islands" },
    { code: "+82", flag: "🇰🇷", name: "South Korea" },
    { code: "+211", flag: "🇸🇸", name: "South Sudan" },
    { code: "+34", flag: "🇪🇸", name: "Spain" },
    { code: "+94", flag: "🇱🇰", name: "Sri Lanka" },
    { code: "+249", flag: "🇸🇩", name: "Sudan" },
    { code: "+597", flag: "🇸🇷", name: "Suriname" },
    { code: "+47", flag: "🇸🇯", name: "Svalbard and Jan Mayen" },
    { code: "+268", flag: "🇸🇿", name: "Swaziland" },
    { code: "+46", flag: "🇸🇪", name: "Sweden" },
    { code: "+41", flag: "🇨🇭", name: "Switzerland" },
    { code: "+963", flag: "🇸🇾", name: "Syria" },
    { code: "+886", flag: "🇹🇼", name: "Taiwan" },
    { code: "+992", flag: "🇹🇯", name: "Tajikistan" },
    { code: "+255", flag: "🇹🇿", name: "Tanzania" },
    { code: "+66", flag: "🇹🇭", name: "Thailand" },
    { code: "+670", flag: "🇹🇱", name: "Timor-Leste" },
    { code: "+228", flag: "🇹🇬", name: "Togo" },
    { code: "+690", flag: "🇹🇰", name: "Tokelau" },
    { code: "+676", flag: "🇹🇴", name: "Tonga" },
    { code: "+1868", flag: "🇹🇹", name: "Trinidad and Tobago" },
    { code: "+216", flag: "🇹🇳", name: "Tunisia" },
    { code: "+90", flag: "🇹🇷", name: "Turkey" },
    { code: "+993", flag: "🇹🇲", name: "Turkmenistan" },
    { code: "+1649", flag: "🇹🇨", name: "Turks and Caicos Islands" },
    { code: "+688", flag: "🇹🇻", name: "Tuvalu" },
    { code: "+256", flag: "🇺🇬", name: "Uganda" },
    { code: "+380", flag: "🇺🇦", name: "Ukraine" },
    { code: "+971", flag: "🇦🇪", name: "United Arab Emirates" },
    { code: "+44", flag: "🇬🇧", name: "United Kingdom" },
    { code: "+1", flag: "🇺🇸", name: "United States" },
    { code: "+598", flag: "🇺🇾", name: "Uruguay" },
    { code: "+998", flag: "🇺🇿", name: "Uzbekistan" },
    { code: "+678", flag: "🇻🇺", name: "Vanuatu" },
    { code: "+39", flag: "🇻🇦", name: "Vatican City" },
    { code: "+58", flag: "🇻🇪", name: "Venezuela" },
    { code: "+84", flag: "🇻🇳", name: "Vietnam" },
    { code: "+681", flag: "🇼🇫", name: "Wallis and Futuna" },
    { code: "+212", flag: "🇪🇭", name: "Western Sahara" },
    { code: "+967", flag: "🇾🇪", name: "Yemen" },
    { code: "+260", flag: "🇿🇲", name: "Zambia" },
    { code: "+263", flag: "🇿🇼", name: "Zimbabwe" },
];

function setupCountrySelector() {
    const btn = document.getElementById('countryDropdownBtn');
    const menu = document.getElementById('countryDropdownMenu');
    const search = document.getElementById('countrySearch');
    const list = document.getElementById('countryList');
    const hiddenInput = document.getElementById('countryCode');
    const selectedDisplay = document.getElementById('selectedCountry');

    if (!btn || !menu || !list) return;

    // Toggle Menu with Smart Positioning
    btn.addEventListener('click', (e) => {
        e.stopPropagation();

        // Toggle visibility first
        menu.classList.toggle('hidden');

        if (!menu.classList.contains('hidden')) {
            // Reset position classes to default (downwards)
            menu.classList.remove('bottom-full', 'mb-2', 'origin-bottom-left');
            menu.classList.add('top-full', 'mt-1', 'origin-top-left');

            // Check if it goes off-screen
            const rect = menu.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // If bottom of menu is below viewport, flip it up
            if (rect.bottom > viewportHeight) {
                menu.classList.remove('top-full', 'mt-1', 'origin-top-left');
                menu.classList.add('bottom-full', 'mb-2', 'origin-bottom-left');
            }

            // Adjust width for mobile if needed (prevent horizontal overflow)
            const viewportWidth = window.innerWidth;
            if (rect.right > viewportWidth) {
                menu.style.maxWidth = `${viewportWidth - 20}px`; // 20px padding
            }

            search.focus();
            renderCountryList(countries);
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    // Search Filter
    search.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().replace('+', '');
        const filtered = countries.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.code.includes(query)
        );
        renderCountryList(filtered);
    });

    // Initial render
    renderCountryList(countries);

    function renderCountryList(items) {
        list.innerHTML = items.map(c => `
            <div data-code="${c.code}" data-flag="${c.flag}" 
                class="country-item px-3 py-2 cursor-pointer hover:bg-gray-100 rounded flex items-center justify-between transition-colors">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${c.flag}</span>
                    <span class="text-sm text-gray-700">${c.name}</span>
                </div>
                <span class="text-sm font-medium text-gray-500">${c.code}</span>
            </div>
        `).join('');

        // Selection Event
        list.querySelectorAll('.country-item').forEach(item => {
            item.addEventListener('click', () => {
                const code = item.dataset.code;
                const flag = item.dataset.flag;

                hiddenInput.value = code;
                selectedDisplay.textContent = `${flag} ${code}`;
                menu.classList.add('hidden');
            });
        });
    }
}

// Initialize selector if on auth page
document.addEventListener('DOMContentLoaded', setupCountrySelector);