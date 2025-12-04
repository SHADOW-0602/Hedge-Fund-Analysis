// Plaid Integration for Frontend
let plaidHandler = null;

// Initialize Plaid Link
async function connectPlaid() {
    try {
        console.log('[PLAID] Initializing Plaid Link for production...');

        // Show connecting status
        updatePlaidStatus('Connecting to Plaid...', 'connecting');

        // Get link token from backend
        const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/create-link-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                user_id: window.currentUser?.user_id || window.currentUser?.username || 'admin'
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to create link token');
        }

        console.log(`[PLAID] Link token created for ${result.environment} environment`);

        // Initialize Plaid Link
        plaidHandler = Plaid.create({
            token: result.link_token,
            onSuccess: handlePlaidSuccess,
            onExit: handlePlaidExit,
            onEvent: handlePlaidEvent
        });

        // Open Plaid Link
        plaidHandler.open();

    } catch (error) {
        console.error('[PLAID] Connection failed:', error);
        updatePlaidStatus(`Connection failed: ${error.message}`, 'error');
    }
}

// Handle successful Plaid connection
async function handlePlaidSuccess(public_token, metadata) {
    try {
        console.log('[PLAID] Connection successful, exchanging token...');
        updatePlaidStatus('Exchanging tokens...', 'connecting');

        const institutionName = metadata?.institution?.name || 'Unknown Institution';

        // Exchange public token for access token
        const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/exchange-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                public_token: public_token,
                institution_name: institutionName,
                user_id: window.currentUser?.user_id || window.currentUser?.username || 'admin'
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log(`[PLAID] Token exchange successful for ${institutionName}`);
            updatePlaidStatus(`Connected to ${institutionName}!`, 'success');

            // Reload connections list
            if (window.plaidConnectionsManager) {
                await window.plaidConnectionsManager.loadConnections();
            }

            // Load portfolio data from new connection
            setTimeout(() => {
                loadPlaidPortfolio();
            }, 2000);

        } else {
            throw new Error(result.error || 'Token exchange failed');
        }

    } catch (error) {
        console.error('[PLAID] Token exchange failed:', error);
        updatePlaidStatus(`Connection failed: ${error.message}`, 'error');
    }
}

// Handle Plaid exit
function handlePlaidExit(err, metadata) {
    if (err != null) {
        console.error('[PLAID] Link exited with error:', err);
        updatePlaidStatus('Connection cancelled', 'error');
    } else {
        console.log('[PLAID] Link exited normally');
        updatePlaidStatus('Connection cancelled', 'info');
    }
}

// Handle Plaid events
function handlePlaidEvent(eventName, metadata) {
    console.log(`[PLAID] Event: ${eventName}`, metadata);

    switch (eventName) {
        case 'OPEN':
            updatePlaidStatus('Opening Plaid Link...', 'connecting');
            break;
        case 'SELECT_INSTITUTION':
            updatePlaidStatus(`Connecting to ${metadata.institution_name}...`, 'connecting');
            break;
        case 'SUBMIT_CREDENTIALS':
            updatePlaidStatus('Verifying credentials...', 'connecting');
            break;
        case 'SUBMIT_MFA':
            updatePlaidStatus('Processing MFA...', 'connecting');
            break;
    }
}

// Load portfolio data from Plaid
async function loadPlaidPortfolio() {
    try {
        console.log('[PLAID] Loading portfolio data...');
        updatePlaidStatus('Loading portfolio data...', 'connecting');

        const userId = window.currentUser?.user_id || window.currentUser?.username || 'admin';
        const connectionId = window.plaidConnectionsManager?.activeConnection;

        const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/plaid-portfolio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                user_id: userId,
                connection_id: connectionId
            })
        });
        const result = await response.json();

        if (result.success && result.holdings) {
            console.log(`[PLAID] Loaded ${result.holdings.length} positions from ${result.environment}`);

            // Convert Plaid holdings to portfolio format
            const portfolioData = result.holdings.map(holding => ({
                symbol: holding.symbol,
                quantity: holding.quantity,
                avg_cost: holding.avg_cost,
                market_value: holding.market_value,
                cost_basis: holding.cost_basis,
                source: 'plaid',
                data_source: 'Plaid',
                portfolio: 'RobinHood'
            }));

            // Display portfolio data
            console.log('[PLAID] Portfolio data ready:', portfolioData.length, 'positions');
            if (typeof displayPortfolio === 'function') {
                displayPortfolio(portfolioData);
                console.log('[PLAID] Portfolio displayed successfully');
            } else {
                console.log('[PLAID] displayPortfolio function not available');
                // Store data globally for manual access
                window.currentPortfolio = portfolioData;
                localStorage.setItem('currentPortfolio', JSON.stringify(portfolioData));
            }

            // Show Plaid switcher for portfolio/transaction analysis
            if (typeof showPlaidSwitcher === 'function') {
                showPlaidSwitcher();
            }

            // Load transaction data as well
            loadPlaidTransactions();

            // Show data action buttons
            if (typeof showDataActions === 'function') {
                showDataActions();
            }

            updatePlaidStatus(`Loaded ${result.holdings.length} positions`, 'success');
            updateConnectButton(true);

            // Auto-hide status after success
            setTimeout(() => {
                const statusDiv = document.getElementById('plaidStatus');
                if (statusDiv) {
                    statusDiv.textContent = 'Connected - Live data';
                    statusDiv.className = 'mt-2 text-xs text-green-600';
                }
            }, 3000);

        } else {
            throw new Error(result.error || 'No holdings found');
        }

    } catch (error) {
        console.error('[PLAID] Portfolio load failed:', error);
        updatePlaidStatus(`Portfolio load failed: ${error.message}`, 'error');
    }
}

// Update Plaid connection status
function updatePlaidStatus(message, type) {
    const statusDiv = document.getElementById('plaidStatus');
    if (!statusDiv) return;

    statusDiv.textContent = message;

    switch (type) {
        case 'connecting':
            statusDiv.className = 'mt-2 text-xs text-blue-600';
            break;
        case 'success':
            statusDiv.className = 'mt-2 text-xs text-green-600';
            break;
        case 'error':
            statusDiv.className = 'mt-2 text-xs text-red-600';
            break;
        case 'info':
            statusDiv.className = 'mt-2 text-xs text-gray-600';
            break;
        default:
            statusDiv.className = 'mt-2 text-xs text-gray-600';
    }
}

// Test Plaid connection status
async function testPlaidConnection() {
    try {
        const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/create-link-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: 'test_user' })
        });

        const result = await response.json();

        if (result.success) {
            console.log(`[PLAID] Service available - Environment: ${result.environment}`);
            return true;
        } else {
            console.log(`[PLAID] Service unavailable: ${result.error}`);
            return false;
        }
    } catch (error) {
        console.log(`[PLAID] Service test failed: ${error.message}`);
        return false;
    }
}

// Check if user already has Plaid connection
async function checkExistingPlaidConnection() {
    try {
        // Get actual user ID from session
        const userId = window.currentUser?.user_id || window.currentUser?.username || 'admin';
        console.log('[PLAID] Checking connections for user:', userId);

        // Load connections through manager
        if (window.plaidConnectionsManager) {
            console.log('[PLAID] Using connections manager to load connections');
            const connections = await window.plaidConnectionsManager.loadConnections();
            console.log('[PLAID] Connections manager returned:', connections.length, 'connections');

            if (connections.length === 0) {
                console.log(`[PLAID] No connections found for user: ${userId}`);
                updatePlaidStatus('Ready to connect', 'info');
                updateConnectButton(false);
                return false;
            }
        } else {
            console.log('[PLAID] Connections manager not available');
        }

        console.log('[PLAID] Falling back to direct API check');
        // Fallback to direct API check
        const statusResponse = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/plaid-status`, {
            method: 'POST',
            credentials: 'include'
        });

        const statusResult = await statusResponse.json();

        if (statusResult.connected && statusResult.connections_count > 0) {
            updatePlaidStatus(`${statusResult.connections_count} account(s) connected`, 'success');
            updateConnectButton(true);
            return true;
        } else {
            updatePlaidStatus('Ready to connect', 'info');
            updateConnectButton(false);
            return false;
        }
    } catch (error) {
        console.log('[PLAID] Connection check failed:', error);
        updatePlaidStatus('Connection check failed', 'error');
        updateConnectButton(false);
        return false;
    }
}

// Auto-connect when user is available
function autoConnectPlaid() {
    setTimeout(async () => {
        // Get actual user ID
        const userId = window.currentUser?.user_id ||
            window.currentUser?.username ||
            window.currentUser?.id ||
            localStorage.getItem('currentUserId') ||
            'admin';

        console.log('[PLAID] Auto-connecting for user:', userId);

        console.log('[PLAID] Auto-connecting for user:', userId);
        console.log('[PLAID] Current user object:', window.currentUser);
        console.log('[PLAID] SessionManager session:', window.SessionManager?.getSession());

        // Check for existing connection first
        const hasExistingConnection = await checkExistingPlaidConnection();

        if (!hasExistingConnection) {
            const statusDiv = document.getElementById('plaidStatus');
            if (statusDiv) {
                statusDiv.textContent = 'Ready to connect';
                statusDiv.className = 'mt-2 text-xs text-blue-600';
            }
            updateConnectButton(false);
        }
    }, 1500); // Increased timeout to ensure user is loaded
}

// Initialize Plaid on page load
document.addEventListener('DOMContentLoaded', autoConnectPlaid);

// Also auto-connect when user logs in
window.addEventListener('userLoggedIn', autoConnectPlaid);

// Toggle Plaid connection (connect/delete)
function togglePlaidConnection() {
    const btn = document.getElementById('plaidConnectBtn');
    if (btn && btn.textContent.includes('Delete')) {
        deletePlaidConnection();
    } else {
        connectPlaid();
    }
}

// Update connect button based on connection status
function updateConnectButton(isConnected) {
    const btn = document.getElementById('plaidConnectBtn');

    if (!btn) return;

    if (isConnected) {
        const connectionCount = window.plaidConnectionsManager?.connections?.length || 1;
        btn.textContent = connectionCount > 1 ? `Manage ${connectionCount} Accounts` : 'Manage Account';
        btn.className = 'bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm w-full sm:w-auto';
        btn.onclick = () => {
            showConnectionsManager();
            // Also show the upload section when managing accounts
            const uploadSection = document.getElementById('defaultUploadSection');
            if (uploadSection) {
                uploadSection.scrollIntoView({ behavior: 'smooth' });
            }
        };
    } else {
        btn.textContent = 'Connect Account';
        btn.className = 'bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm w-full sm:w-auto';
        btn.onclick = () => connectPlaid();
    }
}

// Show connections manager section
function showConnectionsManager() {
    const section = document.getElementById('plaidConnectionsSection');
    if (section) {
        section.classList.remove('hidden');
        if (window.plaidConnectionsManager) {
            // Force reload connections when showing manager
            window.plaidConnectionsManager.loadConnections();
        } else {
            // Manually load connections if manager not available
            loadConnectionsDirectly();
        }
    }
}

// Direct connection loading fallback
async function loadConnectionsDirectly() {
    try {
        const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/plaid-status`, {
            method: 'POST',
            credentials: 'include'
        });
        const result = await response.json();

        const container = document.getElementById('plaidConnectionsList');
        if (container && result.success && result.connections) {
            const connectionsHTML = result.connections.map(conn => `
                <div class="bg-white border border-gray-200 rounded-lg p-3 mb-2">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-sm font-medium text-gray-900">${conn.institution_name}</h4>
                            <p class="text-xs text-gray-500">ID: ${conn.connection_id}</p>
                            <p class="text-xs text-gray-500">Created: ${conn.created_at}</p>
                            ${conn.accounts_count ? `<p class="text-xs text-blue-600">Accounts: ${conn.accounts_count}</p>` : ''}
                            ${conn.status ? `<p class="text-xs text-green-600">Status: ${conn.status}</p>` : ''}
                        </div>
                        <button onclick="deleteConnection('${conn.connection_id}')" class="text-xs px-2 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200">
                            Delete
                        </button>
                    </div>
                </div>
            `).join('');

            container.innerHTML = connectionsHTML;
        }
    } catch (error) {
        console.error('[PLAID] Direct connection loading failed:', error);
    }
}

// Hide connections manager section
function hidePlaidConnections() {
    const section = document.getElementById('plaidConnectionsSection');
    if (section) {
        section.classList.add('hidden');
    }
}





// Delete Plaid connection permanently
async function deletePlaidConnection() {
    if (!confirm('Are you sure you want to permanently delete your Plaid connection? This action cannot be undone.')) {
        return;
    }

    try {
        console.log('[PLAID] Deleting connection permanently...');
        updatePlaidStatus('Deleting connection...', 'connecting');

        const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/delete-plaid-connection`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            console.log('[PLAID] Connection deleted successfully');
            updatePlaidStatus('Connection deleted', 'info');
            updateConnectButton(false);

            // Clear any loaded data
            if (typeof clearPortfolioData === 'function') {
                clearPortfolioData();
            }

            // Hide Plaid switcher
            if (typeof hidePlaidSwitcher === 'function') {
                hidePlaidSwitcher();
            }

        } else {
            throw new Error(result.error || 'Delete failed');
        }

    } catch (error) {
        console.error('[PLAID] Delete failed:', error);
        updatePlaidStatus(`Delete failed: ${error.message}`, 'error');
    }
}

// Make functions globally available
window.connectPlaid = connectPlaid;
window.deletePlaidConnection = deletePlaidConnection;
window.togglePlaidConnection = togglePlaidConnection;
window.updateConnectButton = updateConnectButton;
window.loadPlaidPortfolio = loadPlaidPortfolio;
window.testPlaidConnection = testPlaidConnection;
window.checkExistingPlaidConnection = checkExistingPlaidConnection;
window.autoConnectPlaid = autoConnectPlaid;
window.showConnectionsManager = showConnectionsManager;
window.hidePlaidConnections = hidePlaidConnections;

// Load transaction data from Plaid
async function loadPlaidTransactions() {
    try {
        console.log('[PLAID] Loading transaction data...');

        const userId = window.currentUser?.user_id || window.currentUser?.username || 'admin';
        const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/plaid-transactions?user_id=${userId}`, {
            credentials: 'include'
        });
        const result = await response.json();

        if (result.success && result.transactions) {
            console.log(`[PLAID] Loaded ${result.transactions.length} transactions`);

            // Convert Plaid transactions to standard format
            const transactionData = result.transactions.map(tx => ({
                symbol: tx.symbol || tx.security_symbol || 'UNKNOWN',
                quantity: Math.abs(parseFloat(tx.quantity || 0)),
                price: parseFloat(tx.price || tx.unit_price || 0),
                date: tx.date || tx.transaction_date,
                transaction_type: tx.type || tx.transaction_type || 'BUY',
                fees: parseFloat(tx.fees || 0),
                currency: tx.currency || 'USD',
                portfolio: 'RobinHood',
                source: 'plaid',
                data_source: 'Plaid',
                account_id: tx.account_id
            }));

            // Store transaction data globally
            window.currentTransactions = transactionData;
            if (window.analyticsCore) {
                window.analyticsCore.setTransactionData(transactionData);
            }
            localStorage.setItem('currentTransactions', JSON.stringify(transactionData));

            // Dispatch event for transaction loading
            document.dispatchEvent(new CustomEvent('transactionsLoaded', {
                detail: { transactions: transactionData }
            }));

            console.log('[PLAID] Transaction data stored for analysis:', transactionData.length, 'transactions');

        } else {
            console.log('[PLAID] No transactions found or error:', result.error);
            // Still store empty array to indicate transactions were checked
            window.currentTransactions = [];
            if (window.analyticsCore) {
                window.analyticsCore.setTransactionData([]);
            }
            localStorage.setItem('currentTransactions', JSON.stringify([]));
        }

    } catch (error) {
        console.error('[PLAID] Transaction load failed:', error);
    }
}

window.loadPlaidTransactions = loadPlaidTransactions;