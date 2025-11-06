// Plaid Multiple Connections Manager
class PlaidConnectionsManager {
    constructor() {
        this.connections = [];
        this.activeConnection = null;
    }

    async loadConnections() {
        try {
            const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/plaid-status`, {
                method: 'POST',
                credentials: 'include'
            });
            const result = await response.json();
            
            if (result.success) {
                this.connections = result.connections || [];
                this.updateConnectionsUI();
                return this.connections;
            }
        } catch (error) {
            console.error('[PLAID] Failed to load connections:', error);
        }
        return [];
    }

    updateConnectionsUI() {
        const container = document.getElementById('plaidConnectionsList');
        if (!container) return;

        if (this.connections.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <div class="mb-4">
                        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No Connections</h3>
                    <p class="text-sm text-gray-500 mb-4">Connect your brokerage accounts to get started</p>
                    <button onclick="connectPlaid()" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                        Connect Account
                    </button>
                </div>
            `;
            return;
        }

        const connectionsHTML = this.connections.map(conn => `
            <div class="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="flex-shrink-0">
                            <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                                </svg>
                            </div>
                        </div>
                        <div>
                            <h4 class="text-sm font-medium text-gray-900">${conn.institution_name}</h4>
                            <p class="text-xs text-gray-500">Connected ${new Date(conn.created_at).toLocaleDateString()}</p>
                            ${conn.accounts_count ? `<p class="text-xs text-blue-600">${conn.accounts_count} accounts</p>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="plaidConnectionsManager.selectConnection('${conn.connection_id}')" 
                                class="text-sm px-3 py-1 rounded-md ${this.activeConnection === conn.connection_id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                            ${this.activeConnection === conn.connection_id ? 'Active' : 'Select'}
                        </button>
                        <button onclick="plaidConnectionsManager.deleteConnection('${conn.connection_id}')" 
                                class="text-sm px-3 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="mb-4">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-medium text-gray-900">Connected Accounts (${this.connections.length})</h3>
                    <button onclick="connectPlaid()" class="text-sm px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
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
        
        // Load data for selected connection
        await this.loadConnectionData(connectionId);
        
        // Update status
        const statusDiv = document.getElementById('plaidStatus');
        if (statusDiv) {
            const conn = this.connections.find(c => c.connection_id === connectionId);
            statusDiv.textContent = `Active: ${conn?.institution_name || 'Unknown'}`;
            statusDiv.className = 'mt-2 text-xs text-green-600';
        }
    }

    async loadConnectionData(connectionId) {
        try {
            // Load portfolio data for specific connection
            const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/plaid-portfolio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ connection_id: connectionId })
            });
            
            const result = await response.json();
            
            if (result.success && result.holdings) {
                const portfolioData = result.holdings.map(holding => ({
                    symbol: holding.symbol,
                    quantity: holding.quantity,
                    avg_cost: holding.avg_cost,
                    market_value: holding.market_value,
                    cost_basis: holding.cost_basis,
                    source: 'plaid',
                    connection_id: connectionId
                }));
                
                if (typeof displayPortfolio === 'function') {
                    displayPortfolio(portfolioData);
                }
                
                if (typeof showDataActions === 'function') {
                    showDataActions();
                }
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
    setTimeout(() => {
        window.plaidConnectionsManager.loadConnections();
    }, 1000);
});

// Load connections when user logs in
window.addEventListener('userLoggedIn', () => {
    window.plaidConnectionsManager.loadConnections();
});