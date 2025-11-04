// Trade Performance Analysis Module
async function loadTradePerformance(transactions) {
    const container = document.getElementById('tradePerformance');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-gray-500">Loading trade performance...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/trade-performance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions })
        });
        
        const data = await response.json();
        
        if (data.success && data.trade_performance) {
            displayTradePerformance(data.trade_performance);
        } else {
            container.innerHTML = '<div class="text-center py-4 text-red-500">Analysis Error<br><small>No valid transactions found</small></div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="text-center py-4 text-red-500">Analysis Error<br><small>Failed to load trade performance</small></div>';
    }
}

function displayTradePerformance(data) {
    const container = document.getElementById('tradePerformance');
    if (!container) return;
    
    const totalTrades = data.total_trades || 0;
    const winRate = ((data.win_rate || 0) * 100).toFixed(1);
    const avgTradeSize = data.avg_trade_size || 0;
    const bestTrade = data.best_trade || 0;
    const worstTrade = data.worst_trade || 0;
    const totalPnl = data.total_pnl || 0;
    const profitFactor = data.profit_factor || 0;
    
    container.innerHTML = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div class="text-center">
                    <div class="text-2xl font-bold text-gray-900">${totalTrades}</div>
                    <div class="text-sm text-gray-500">Total Trades</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold ${data.win_rate >= 0.5 ? 'text-green-600' : 'text-red-600'}">${winRate}%</div>
                    <div class="text-sm text-gray-500">Win Rate</div>
                </div>
            </div>
            
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-gray-600">Avg Trade Size:</span>
                    <span class="font-medium">$${avgTradeSize.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Best Trade:</span>
                    <span class="font-medium text-green-600">$${bestTrade.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Worst Trade:</span>
                    <span class="font-medium text-red-600">$${worstTrade.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Total P&L:</span>
                    <span class="font-medium ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}">$${totalPnl.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Profit Factor:</span>
                    <span class="font-medium">${profitFactor.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;
}

// Export for global access
window.loadTradePerformance = loadTradePerformance;