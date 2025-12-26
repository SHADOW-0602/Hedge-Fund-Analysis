// Plaid Multiple Connections Manager
class PlaidConnectionsManager {
    constructor() {
        this.connections = [];
        this.activeConnection = null;
    }

    async loadConnections() {
        try {
            console.log('[PLAID] Loading connections...');
            const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/plaid-status`, {
                method: 'POST',
                credentials: 'include'
            });
            const result = await response.json();

            console.log('[PLAID] Status response:', result);

            if (result.success) {
                this.connections = result.connections || [];
                console.log('[PLAID] Loaded connections:', this.connections);
                this.updateConnectionsUI();

                // Auto-select removed - User must explicitly load data
                if (this.connections.length > 0 && !this.activeConnection) {
                    // Just set the ID but DO NOT trigger load
                    this.activeConnection = this.connections[0].connection_id;
                }

                return this.connections;
            } else {
                console.log('[PLAID] Status failed:', result.error);
                this.connections = [];
                this.updateConnectionsUI();
            }
        } catch (error) {
            console.error('[PLAID] Failed to load connections:', error);
            this.connections = [];
            this.updateConnectionsUI();
        }
        return this.connections;
    }

    updateConnectionsUI() {
        const container = document.getElementById('plaidConnectionsList');
        if (!container) {
            console.log('[PLAID] Container plaidConnectionsList not found');
            return;
        }

        console.log('[PLAID] Updating UI with', this.connections.length, 'connections');

        if (this.connections.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <p class="text-sm text-gray-600 mb-3">No connections found. Try refreshing or check console for errors.</p>
                    <button onclick="connectPlaid()" class="text-sm px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 mr-2">
                        Add New Account
                    </button>
                    <button onclick="window.plaidConnectionsManager.loadConnections()" class="text-sm px-3 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-700">
                        Refresh
                    </button>
                </div>
            `;
            return;
        }

        const connectionsHTML = this.connections.map(conn => `
            <div class="border rounded-lg p-4 mb-3 hover:shadow-md transition-all duration-200" style="background: var(--bg-card); border-color: var(--border-card);">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background: rgba(59, 130, 246, 0.1);">
                            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="text-base font-semibold truncate" style="color: var(--text-primary);">${conn.institution_name}</h4>
                            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                <p class="text-sm" style="color: var(--text-secondary);">ID: ${conn.connection_id.substring(0, 12)}...</p>
                                <p class="text-sm" style="color: var(--text-secondary);">Created: ${new Date(conn.created_at).toLocaleDateString()}</p>
                                ${conn.accounts_count ? `<p class="text-sm text-blue-600 font-medium">Accounts: ${conn.accounts_count}</p>` : ''}
                                ${conn.status ? `<p class="text-sm font-medium ${conn.status === 'active' ? 'status-active' : conn.status === 'error' ? 'status-error' : 'status-pending'}">Status: ${conn.status}</p>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 flex-shrink-0">
                        <button onclick="plaidConnectionsManager.viewConnectionData('${conn.connection_id}')" 
                                class="px-4 py-2 rounded-lg font-medium transition-all" 
                                style="background: rgba(99, 102, 241, 0.1); color: var(--accent-color);">
                            View Data
                        </button>
                        <button onclick="plaidConnectionsManager.selectConnection('${conn.connection_id}')" 
                                class="px-4 py-2 rounded-lg font-medium transition-all ${this.activeConnection === conn.connection_id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-200'}"
                                style="${this.activeConnection !== conn.connection_id ? 'background: var(--bg-body); color: var(--text-primary);' : ''}">
                            ${this.activeConnection === conn.connection_id ? 'Active' : 'Select'}
                        </button>
                        <button onclick="plaidConnectionsManager.deleteConnection('${conn.connection_id}')" 
                                class="px-4 py-2 rounded-lg font-medium transition-all hover:opacity-80"
                                style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="mb-4">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-medium" style="color: var(--text-primary);">Connected Accounts (${this.connections.length})</h3>
                    <button onclick="connectPlaid()" class="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                        Add Account
                    </button>
                </div>
                ${connectionsHTML}
            </div>
        `;
    }

    async selectConnection(connectionId) {
        this.activeConnection = connectionId;
        this.updateConnectionsUI();

        // Update status - DO NOT load data automatically
        const statusDiv = document.getElementById('plaidStatus');
        if (statusDiv) {
            const conn = this.connections.find(c => c.connection_id === connectionId);
            statusDiv.textContent = `Selected: ${conn?.institution_name || 'Unknown'}. Click "Reload Data" to fetch.`;
            statusDiv.className = 'mt-2 text-xs text-blue-600 font-medium';
        }
    }

    async viewConnectionData(connectionId) {
        // First select and load the connection
        await this.selectConnection(connectionId);

        // Then scroll to data view
        if (typeof viewLoadedData === 'function') {
            viewLoadedData({ source: 'plaid', connection_id: connectionId });
        } else {
            console.error('[PLAID] viewLoadedData function not available');
        }
    }

    async loadConnectionData(connectionId) {
        console.log(`[PLAID] Loading connection data for: ${connectionId}`);
        try {
            const baseUrl = window.API_BASE || window.location.origin;

            // Load portfolio data
            const portfolioPromise = fetch(`${baseUrl}/api/plaid-portfolio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ connection_id: connectionId })
            });

            // Load transaction data (default 90 days)
            const transactionsPromise = fetch(`${baseUrl}/api/plaid-transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ connection_id: connectionId, days: 90 })
            });

            const [responsePortfolio, responseTransactions] = await Promise.all([portfolioPromise, transactionsPromise]);
            const resultPortfolio = await responsePortfolio.json();
            const resultTransactions = await responseTransactions.json();

            // Process Portfolio Data
            if (resultPortfolio.success && resultPortfolio.holdings) {
                const portfolioData = resultPortfolio.holdings.map(holding => ({
                    symbol: holding.symbol,
                    quantity: holding.quantity,
                    avg_cost: holding.avg_cost,
                    market_value: holding.market_value,
                    cost_basis: holding.cost_basis,
                    source: 'plaid',
                    connection_id: connectionId
                }));

                // Update standard display function if available
                if (typeof displayPortfolio === 'function') {
                    displayPortfolio(portfolioData);
                }
                // Store global
                window.portfolioData = portfolioData;
                window.currentPortfolio = portfolioData;
            } else {
                console.error('[PLAID] Failed to load portfolio data:', resultPortfolio.error || 'Unknown error');
            }

            // Process Transaction Data
            if (resultTransactions.success && resultTransactions.transactions) {
                console.log(`[PLAID] Loaded ${resultTransactions.count} transactions`);
                const transactionData = resultTransactions.transactions.map(txn => ({
                    ...txn,
                    source: 'plaid',
                    connection_id: connectionId,
                    data_source: 'Plaid' // Helper for some checks
                }));

                // Store global
                window.currentTransactions = transactionData;

                // Update standard display function if available (assuming one exists or data view handles it)
                // Note: displayTransactions might expect different format, but updating global is key for View Data
            } else {
                console.error('[PLAID] Failed to load transaction data:', resultTransactions.error || 'Unknown error');
                window.currentTransactions = [];
            }

            if (typeof showDataActions === 'function') {
                showDataActions();
            }

        } catch (error) {
            console.error('[PLAID] Failed to load connection data:', error);
        }
    }

    async deleteConnection(connectionId) {
        const conn = this.connections.find(c => c.connection_id === connectionId);
        const institutionName = conn?.institution_name || 'this connection';

        if (!confirm(`Are you sure you want to delete ${institutionName}? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/delete-plaid-connection`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ connection_id: connectionId })
            });

            const result = await response.json();

            if (result.success) {
                // Remove from local array
                this.connections = this.connections.filter(c => c.connection_id !== connectionId);

                // Clear active connection if it was deleted
                if (this.activeConnection === connectionId) {
                    this.activeConnection = this.connections.length > 0 ? this.connections[0].connection_id : null;
                }

                this.updateConnectionsUI();

                // Clear portfolio if no connections left
                if (this.connections.length === 0 && typeof clearPortfolioData === 'function') {
                    clearPortfolioData();
                }

                console.log(`[PLAID] Connection ${connectionId} deleted successfully`);
            } else {
                throw new Error(result.error || 'Delete failed');
            }
        } catch (error) {
            console.error('[PLAID] Delete failed:', error);
            alert(`Failed to delete connection: ${error.message}`);
        }
    }

    getActiveConnection() {
        return this.activeConnection;
    }

    hasConnections() {
        return this.connections.length > 0;
    }
}

// Global instance
window.plaidConnectionsManager = new PlaidConnectionsManager();

// Auto-load connections on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[PLAID] DOM loaded, initializing connections manager');
    setTimeout(() => {
        if (window.plaidConnectionsManager) {
            window.plaidConnectionsManager.loadConnections();
        } else {
            console.log('[PLAID] Connections manager not available');
        }
    }, 1000);
});

// Load connections when user logs in
window.addEventListener('userLoggedIn', () => {
    window.plaidConnectionsManager.loadConnections();
});