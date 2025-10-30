// Transaction Analytics Module

function loadTransactionAnalysis(transactionData) {
    if (!transactionData || transactionData.length === 0) {
        console.log('No transaction data available');
        return;
    }
    
    console.log('Loading transaction analysis for', transactionData.length, 'transactions');
    
    // Store data globally for other functions
    window.currentTransactionData = transactionData;
    
    // Load all transaction analytics with data using app-main.js functions
    if (typeof window.loadDetailedTransactionAnalytics === 'function') {
        window.loadDetailedTransactionAnalytics(transactionData);
    } else {
        // Fallback to individual function calls
        loadTurnoverAnalysisModule(transactionData);
    }
}

// These functions are handled by app-main.js

function loadTurnoverAnalysisModule(data) {
    const container = document.getElementById('turnoverAnalysis');
    if (!container) return;
    
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-4">No data available</div>';
        return;
    }
    
    console.log('Turnover Analysis - Sample transaction:', data[0]);
    console.log('Turnover Analysis - All field names:', Object.keys(data[0] || {}));
    
    const totalVolume = data.reduce((sum, t) => {
        const qty = Math.abs(parseFloat(t.quantity) || 0);
        const price = parseFloat(t.price) || 0;
        return sum + (qty * price);
    }, 0);
    
    console.log('Turnover Analysis - Final Volume:', totalVolume);
    
    const displayVolume = totalVolume > 1000000 ? (totalVolume/1000000).toFixed(1) + 'M' : 
                         totalVolume > 1000 ? (totalVolume/1000).toFixed(1) + 'K' : 
                         totalVolume.toFixed(0);
    container.innerHTML = `<div class="text-center py-4"><div class="text-2xl font-bold text-purple-600">$${displayVolume}</div><div class="text-sm text-gray-500">Total Volume</div></div>`;
}

// All analysis functions are handled by app-main.js

// Export functions
window.loadTransactionAnalysis = loadTransactionAnalysis;