

async function loadAllTransactionAnalytics(transactions) {
    if (!transactions || transactions.length === 0) {
        showError('No transaction data available');
        return;
    }

    // Store transactions globally for all modules to access
    window.currentTransactions = transactions;
    window.currentTradeTransactions = transactions;
    window.currentPnlTransactions = transactions;
    console.log('[TRANSACTION-ANALYTICS] Stored transactions globally:', transactions.length);

    // Show transaction analysis section
    const analysisSection = document.getElementById('transactionAnalysis');
    if (analysisSection) {
        analysisSection.classList.remove('hidden');
    }

    // Update overview metrics
    updateTransactionOverview(transactions);

    // Load all analysis modules
    console.log('[TRANSACTION-ANALYTICS] Loading trade performance module...');
    console.log('[TRANSACTION-ANALYTICS] loadTradePerformance function exists:', typeof loadTradePerformance);

    const analysisPromises = [
        window.loadPnlAttribution && window.loadPnlAttribution(transactions),
        window.loadTradePerformance && window.loadTradePerformance(transactions),
        window.loadCostAnalysis && window.loadCostAnalysis(transactions),
        window.loadTurnoverAnalysis && window.loadTurnoverAnalysis(transactions),
        window.loadTaxAnalysis && (() => { window.isIndividualTaxAnalysis = false; return window.loadTaxAnalysis(transactions); })(),
        window.loadCashFlowAnalysis && window.loadCashFlowAnalysis(transactions),
        window.loadAccountingAnalysis && window.loadAccountingAnalysis(transactions),
        window.loadTradeTimingAnalysis && window.loadTradeTimingAnalysis(transactions),
        window.loadDrawdownAnalysis && window.loadDrawdownAnalysis(transactions),
        window.loadReturnAttribution && window.loadReturnAttribution(transactions)
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

// Refresh function for the main refresh button
function refreshTransactionAnalysis() {
    console.log('Refreshing all transaction analytics...');
    if (window.currentTransactions && window.currentTransactions.length > 0) {
        loadAllTransactionAnalytics(window.currentTransactions);
    } else {
        console.error('No current transactions available for refresh');
        showError('No transaction data available. Please reload the page.');
    }
}

// Export for global access
window.loadAllTransactionAnalytics = loadAllTransactionAnalytics;
window.refreshTransactionAnalysis = refreshTransactionAnalysis;