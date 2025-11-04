// Transaction Analytics Module
async function loadAllTransactionAnalytics(transactions) {
    if (!transactions || transactions.length === 0) {
        showError('No transaction data available');
        return;
    }
    
    // Show transaction analysis section
    const analysisSection = document.getElementById('transactionAnalysis');
    if (analysisSection) {
        analysisSection.classList.remove('hidden');
    }
    
    // Update overview metrics
    updateTransactionOverview(transactions);
    
    // Load all analysis modules
    const analysisPromises = [
        loadPnlAttribution && loadPnlAttribution(transactions),
        loadTradePerformance && loadTradePerformance(transactions),
        loadCostAnalysis && loadCostAnalysis(transactions),
        loadTurnoverAnalysis && loadTurnoverAnalysis(transactions),
        loadTaxAnalysis && loadTaxAnalysis(transactions),
        loadCashFlowAnalysis && loadCashFlowAnalysis(transactions),
        loadFifoLifoAnalysis && loadFifoLifoAnalysis(transactions),
        loadTradeTimingAnalysis && loadTradeTimingAnalysis(transactions),
        loadDrawdownAnalysis && loadDrawdownAnalysis(transactions),
        loadReturnAttribution && loadReturnAttribution(transactions)
    ].filter(Boolean);
    
    try {
        await Promise.allSettled(analysisPromises);
    } catch (error) {
        console.error('Error loading transaction analytics:', error);
    }
}

function updateTransactionOverview(transactions) {
    const trades = transactions.filter(t => ['BUY', 'SELL', 'Buy', 'Sell'].includes(t.transaction_type));
    const totalTrades = trades.length;
    
    // Calculate basic metrics
    let totalVolume = 0;
    let winningTrades = 0;
    
    trades.forEach(trade => {
        const value = Math.abs((trade.quantity || 0) * (trade.price || 0));
        totalVolume += value;
        
        if (trade.transaction_type === 'SELL' && (trade.price || 0) > 0) {
            winningTrades++;
        }
    });
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(1) : '0.0';
    const avgTradeSize = totalTrades > 0 ? (totalVolume / totalTrades) : 0;
    const turnoverRatio = (totalVolume / 100000).toFixed(1); // Simplified calculation
    
    // Update overview cards
    const elements = {
        'totalTrades': totalTrades.toLocaleString(),
        'winRate': `${winRate}%`,
        'avgTradeSize': `$${(avgTradeSize / 1000).toFixed(1)}K`,
        'turnoverRatio': `${turnoverRatio}x`
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

// Export for global access
window.loadAllTransactionAnalytics = loadAllTransactionAnalytics;