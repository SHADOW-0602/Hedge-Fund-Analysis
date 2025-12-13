// Admin Portal JavaScript
const API_BASE = window.API_BASE || window.location.origin;

let currentUser = null;

document.addEventListener('DOMContentLoaded', function () {
    // Check if user is logged in and is admin
    checkAdminAccess();
    loadUsers();
});

function checkAdminAccess() {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!user.username || user.role !== 'admin') {
        alert('Admin access required');
        window.location.href = 'auth.html';
        return;
    }

    currentUser = user;
    document.getElementById('adminInfo').textContent = `Welcome, ${user.username}`;
}

async function loadUsers() {
    if (!currentUser) return;

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/api/admin/users`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': currentUser.role
            }
        });

        const data = await response.json();

        if (data.success) {
            displayUsers(data.users);
            updateStatistics(data.users);
        } else {
            showError(data.error || 'Failed to load users');
        }
    } catch (error) {
        showError('Failed to load users: ' + error.message);
    }

    showLoading(false);
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    const noUsersMessage = document.getElementById('noUsersMessage');

    if (!users || users.length === 0) {
        tbody.innerHTML = '';
        noUsersMessage.style.display = 'block';
        return;
    }

    noUsersMessage.style.display = 'none';

    tbody.innerHTML = users.map(user => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-${user.role === 'admin' ? 'red' : 'blue'}-100 rounded-full flex items-center justify-center mr-3">
                        <span class="text-${user.role === 'admin' ? 'red' : 'blue'}-600 font-semibold text-sm">
                            ${user.username.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-900">${user.username}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${user.email}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin'
            ? 'bg-red-100 text-red-800'
            : 'bg-blue-100 text-blue-800'
        }">
                    ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${user.created_at ? formatDate(user.created_at) : 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${user.last_login ? formatDate(user.last_login) : 'Never'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
        </tr>
    `).join('');
}

function updateStatistics(users) {
    const totalUsers = users.length;
    const activeUsers = users.filter(user => user.is_active).length;
    const adminUsers = users.filter(user => user.role === 'admin').length;

    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('activeUsers').textContent = activeUsers;
    document.getElementById('adminUsers').textContent = adminUsers;
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
        return 'Invalid Date';
    }
}



function refreshUsers() {
    loadUsers();
}

function goToMainApp() {
    window.location.href = 'index.html';
}

function logout() {
    localStorage.removeItem('currentUser');
    if (window.SessionManager) {
        SessionManager.clearSession();
    }
    window.location.href = 'auth.html';
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
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