// Plaid Integration for Frontend
let plaidHandler = null;

// Initialize Plaid Link
async function connectPlaid() {
    try {
        console.log('[PLAID] Initializing Plaid Link for production...');
        
        // Show connecting status
        updatePlaidStatus('Connecting to Plaid...', 'connecting');
        
        // Get link token from backend
        const response = await fetch(`${API_BASE}/create-link-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        
        // Exchange public token for access token
        const response = await fetch(`${API_BASE}/exchange-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                public_token: public_token,
                user_id: window.currentUser?.user_id || window.currentUser?.username || 'admin'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('[PLAID] Token exchange successful');
            updatePlaidStatus('Connected successfully!', 'success');
            updateConnectButton(true);
            
            // Load portfolio data from Plaid
            setTimeout(() => {
                loadPlaidPortfolio();
            }, 2000);
            
        } else {
            throw new Error(result.error || 'Token exchange failed');
        }
        
    } catch (error) {
        console.error('[PLAID] Token exchange failed:', error);
        updatePlaidStatus(`Token exchange failed: ${error.message}`, 'error');
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
        const response = await fetch(`${API_BASE}/plaid-portfolio?user_id=${userId}`);
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
                source: 'plaid'
            }));
            
            // Display portfolio data
            if (typeof displayPortfolio === 'function') {
                displayPortfolio(portfolioData);
            }
            
            // Show Plaid switcher for portfolio/transaction analysis
            if (typeof showPlaidSwitcher === 'function') {
                showPlaidSwitcher();
            }
            
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
        const response = await fetch(`${API_BASE}/create-link-token`, {
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
        const userId = window.currentUser?.user_id || window.currentUser?.username || 'admin';
        console.log('[PLAID] Checking connection for user:', userId);
        
        const response = await fetch(`${API_BASE}/plaid-portfolio?user_id=${userId}`);
        const result = await response.json();
        
        if (result.success && result.holdings && result.holdings.length > 0) {
            console.log(`[PLAID] Found existing connection with ${result.holdings.length} holdings`);
            
            // Auto-load existing data
            const portfolioData = result.holdings.map(holding => ({
                symbol: holding.symbol,
                quantity: holding.quantity,
                avg_cost: holding.avg_cost,
                market_value: holding.market_value,
                cost_basis: holding.cost_basis,
                source: 'plaid'
            }));
            
            if (typeof displayPortfolio === 'function') {
                displayPortfolio(portfolioData);
            }
            
            // Show Plaid switcher for portfolio/transaction analysis
            if (typeof showPlaidSwitcher === 'function') {
                showPlaidSwitcher();
            }
            
            // Show data action buttons
            if (typeof showDataActions === 'function') {
                showDataActions();
            }
            
            updatePlaidStatus(`Connected - ${result.holdings.length} positions loaded`, 'success');
            updateConnectButton(true);
            return true;
        }
        return false;
    } catch (error) {
        console.log('[PLAID] No existing connection found');
        return false;
    }
}

// Auto-connect when user is available
function autoConnectPlaid() {
    setTimeout(async () => {
        const userId = window.currentUser?.user_id || window.currentUser?.username || 'admin';
        console.log('[PLAID] Auto-connecting for user:', userId);
        
        // Check for existing connection first
        const hasExistingConnection = await checkExistingPlaidConnection();
        
        if (!hasExistingConnection) {
            const statusDiv = document.getElementById('plaidStatus');
            if (statusDiv) {
                statusDiv.textContent = 'Production mode - Ready to connect';
                statusDiv.className = 'mt-2 text-xs text-green-600';
            }
        }
    }, 500);
}

// Initialize Plaid on page load
document.addEventListener('DOMContentLoaded', autoConnectPlaid);

// Also auto-connect when user logs in
window.addEventListener('userLoggedIn', autoConnectPlaid);

// Toggle Plaid connection (connect/disconnect)
function togglePlaidConnection() {
    const btn = document.getElementById('plaidConnectBtn');
    if (btn && btn.textContent.includes('Disconnect')) {
        disconnectPlaid();
    } else {
        connectPlaid();
    }
}

// Disconnect from Plaid
async function disconnectPlaid() {
    try {
        console.log('[PLAID] Disconnecting...');
        updatePlaidStatus('Disconnecting...', 'connecting');
        
        const userId = window.currentUser?.user_id || window.currentUser?.username || 'admin';
        const response = await fetch(`${API_BASE}/disconnect-plaid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('[PLAID] Disconnected successfully');
            updatePlaidStatus('Disconnected', 'info');
            updateConnectButton(false);
            
            // Clear any loaded data
            if (typeof clearPortfolioData === 'function') {
                clearPortfolioData();
            }
            
        } else {
            throw new Error(result.error || 'Disconnect failed');
        }
        
    } catch (error) {
        console.error('[PLAID] Disconnect failed:', error);
        updatePlaidStatus(`Disconnect failed: ${error.message}`, 'error');
    }
}

// Update connect button based on connection status
function updateConnectButton(isConnected) {
    const btn = document.getElementById('plaidConnectBtn');
    if (!btn) return;
    
    if (isConnected) {
        btn.textContent = 'Disconnect Account';
        btn.className = 'bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm w-full sm:w-auto';
    } else {
        btn.textContent = 'Connect Account';
        btn.className = 'bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm w-full sm:w-auto';
    }
}

// Make functions globally available
window.connectPlaid = connectPlaid;
window.disconnectPlaid = disconnectPlaid;
window.togglePlaidConnection = togglePlaidConnection;
window.updateConnectButton = updateConnectButton;
window.loadPlaidPortfolio = loadPlaidPortfolio;
window.testPlaidConnection = testPlaidConnection;
window.checkExistingPlaidConnection = checkExistingPlaidConnection;
window.autoConnectPlaid = autoConnectPlaid;