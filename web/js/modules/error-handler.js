// Error Handler Module for Transaction Analysis

function showAllTransactionCardLoading() {
    const loadingElements = [
        'totalTrades', 'winRate', 'avgTradeSize', 'turnoverRatio',
        'pnlAttribution', 'costAnalysis', 'returnAttribution', 
        'tradePerformance', 'turnoverAnalysis', 'taxAnalysis',
        'cashFlowAnalysis', 'fifoLifoAnalysis', 'tradeTimingAnalysis', 'drawdownAnalysis'
    ];
    
    loadingElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id.includes('Analysis') || id.includes('Attribution')) {
                element.innerHTML = '<div class="flex items-center justify-center py-4"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>';
            } else {
                element.textContent = 'Loading...';
            }
        }
    });
}

function showError(message) {
    console.error('Transaction Analysis Error:', message);
    
    // Show error in UI if available
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-red-800">Error</h3>
                        <div class="mt-2 text-sm text-red-700">${message}</div>
                    </div>
                </div>
            </div>
        `;
        errorContainer.classList.remove('hidden');
    }
}

function showSuccess(message) {
    console.log('Transaction Analysis Success:', message);
    
    // Show success in UI if available
    const successContainer = document.getElementById('successContainer');
    if (successContainer) {
        successContainer.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-green-800">Success</h3>
                        <div class="mt-2 text-sm text-green-700">${message}</div>
                    </div>
                </div>
            </div>
        `;
        successContainer.classList.remove('hidden');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            successContainer.classList.add('hidden');
        }, 3000);
    }
}

function validateTransactionData(transactions) {
    if (!transactions) {
        throw new Error('No transaction data provided');
    }
    
    if (!Array.isArray(transactions)) {
        throw new Error('Transaction data must be an array');
    }
    
    if (transactions.length === 0) {
        throw new Error('Transaction array is empty');
    }
    
    // Validate required fields
    const requiredFields = ['symbol', 'quantity', 'price'];
    const sampleTransaction = transactions[0];
    
    for (const field of requiredFields) {
        if (!(field in sampleTransaction)) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    
    return true;
}

function safeParseFloat(value, defaultValue = 0) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

function formatCurrency(value, showCents = false) {
    if (value === null || value === undefined || isNaN(value)) {
        return 'N/A';
    }
    
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    
    if (absValue >= 1000000) {
        return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
        return `${sign}$${(absValue / 1000).toFixed(showCents ? 1 : 0)}K`;
    } else {
        return `${sign}$${absValue.toFixed(showCents ? 2 : 0)}`;
    }
}

function formatPercentage(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) {
        return 'N/A';
    }
    return `${value.toFixed(decimals)}%`;
}

// Export functions to global scope
window.showAllTransactionCardLoading = showAllTransactionCardLoading;
window.showError = showError;
window.showSuccess = showSuccess;
window.validateTransactionData = validateTransactionData;
window.safeParseFloat = safeParseFloat;
window.formatCurrency = formatCurrency;
window.formatPercentage = formatPercentage;