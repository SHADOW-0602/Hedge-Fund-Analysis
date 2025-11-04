// P&L Attribution Analysis Module
async function loadPnlAttribution(transactions) {
    const container = document.getElementById('pnlAttribution');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-gray-500">Loading pnl attribution...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/pnl-attribution`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions })
        });
        
        const data = await response.json();
        
        if (data.success && data.pnl_attribution) {
            displayPnlAttribution(data.pnl_attribution);
        } else {
            container.innerHTML = '<div class="text-center py-4 text-red-500">Analysis Error<br><small>No valid transactions found</small></div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="text-center py-4 text-red-500">Analysis Error<br><small>Failed to load P&L attribution</small></div>';
    }
}

function displayPnlAttribution(data) {
    const container = document.getElementById('pnlAttribution');
    if (!container) return;
    
    const totalPnl = data.total_pnl || 0;
    const realizedPnl = data.realized_pnl || 0;
    const unrealizedPnl = data.unrealized_pnl || 0;
    const bySymbol = data.by_symbol || {};
    
    // Create symbol breakdown
    let symbolBreakdown = '';
    Object.entries(bySymbol).forEach(([symbol, symbolData]) => {
        const symbolTotal = symbolData.total_pnl || 0;
        if (Math.abs(symbolTotal) > 0.01) {
            symbolBreakdown += `
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">${symbol}:</span>
                    <span class="font-medium ${symbolTotal >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${symbolTotal >= 0 ? '+' : ''}$${symbolTotal.toFixed(2)}
                    </span>
                </div>
            `;
        }
    });
    
    container.innerHTML = `
        <div class="space-y-4">
            <div class="text-center">
                <div class="text-2xl font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}
                </div>
                <div class="text-sm text-gray-500">Total P&L</div>
            </div>
            
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-gray-600">Realized P&L:</span>
                    <span class="font-medium ${realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)}
                    </span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Unrealized P&L:</span>
                    <span class="font-medium ${unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)}
                    </span>
                </div>
            </div>
            
            ${symbolBreakdown ? `
                <div class="border-t pt-3">
                    <div class="text-sm font-medium text-gray-700 mb-2">By Symbol</div>
                    <div class="space-y-1">
                        ${symbolBreakdown}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Export for global access
window.loadPnlAttribution = loadPnlAttribution;