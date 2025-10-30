// Plaid Analysis Switcher Module

function showPlaidSwitcher() {
    const switcher1 = document.getElementById('plaidAnalysisSwitcher');
    const switcher2 = document.getElementById('plaidAnalysisSwitcher2');
    if (switcher1) switcher1.classList.remove('hidden');
    if (switcher2) switcher2.classList.remove('hidden');
}

function hidePlaidSwitcher() {
    const switcher1 = document.getElementById('plaidAnalysisSwitcher');
    const switcher2 = document.getElementById('plaidAnalysisSwitcher2');
    if (switcher1) switcher1.classList.add('hidden');
    if (switcher2) switcher2.classList.add('hidden');
}

function switchToPortfolioAnalysis() {
    // Update button states for both switchers
    const portfolioBtn1 = document.getElementById('portfolioAnalysisBtn');
    const transactionBtn1 = document.getElementById('transactionAnalysisBtn');
    const portfolioBtn2 = document.getElementById('portfolioAnalysisBtn2');
    const transactionBtn2 = document.getElementById('transactionAnalysisBtn2');
    
    if (portfolioBtn1 && transactionBtn1) {
        portfolioBtn1.className = 'px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm';
        transactionBtn1.className = 'px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900';
    }
    if (portfolioBtn2 && transactionBtn2) {
        portfolioBtn2.className = 'px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm';
        transactionBtn2.className = 'px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900';
    }
    
    // Show portfolio analysis, hide transaction analysis
    const portfolioSection = document.getElementById('portfolioAnalysis');
    const transactionSection = document.getElementById('transactionAnalysis');
    
    if (portfolioSection) portfolioSection.classList.remove('hidden');
    if (transactionSection) transactionSection.classList.add('hidden');
}

function switchToTransactionAnalysis() {
    // Update button states for both switchers
    const portfolioBtn1 = document.getElementById('portfolioAnalysisBtn');
    const transactionBtn1 = document.getElementById('transactionAnalysisBtn');
    const portfolioBtn2 = document.getElementById('portfolioAnalysisBtn2');
    const transactionBtn2 = document.getElementById('transactionAnalysisBtn2');
    
    if (portfolioBtn1 && transactionBtn1) {
        portfolioBtn1.className = 'px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900';
        transactionBtn1.className = 'px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm';
    }
    if (portfolioBtn2 && transactionBtn2) {
        portfolioBtn2.className = 'px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900';
        transactionBtn2.className = 'px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm';
    }
    
    // Show transaction analysis, hide portfolio analysis
    const portfolioSection = document.getElementById('portfolioAnalysis');
    const transactionSection = document.getElementById('transactionAnalysis');
    
    if (portfolioSection) portfolioSection.classList.add('hidden');
    if (transactionSection) transactionSection.classList.remove('hidden');
    
    // Load transaction analysis with Plaid data
    loadPlaidTransactionAnalysis();
}

// Export functions to global scope
window.showPlaidSwitcher = showPlaidSwitcher;
window.hidePlaidSwitcher = hidePlaidSwitcher;
window.switchToPortfolioAnalysis = switchToPortfolioAnalysis;
window.switchToTransactionAnalysis = switchToTransactionAnalysis;

async function loadPlaidTransactionAnalysis() {
    try {
        const userId = window.currentUser?.user_id || window.currentUser?.username || 'admin';
        console.log('[PLAID] Loading transaction data for user:', userId);
        
        const response = await fetch(`${API_BASE}/plaid-transactions?user_id=${userId}`);
        const result = await response.json();
        
        if (result.success && result.transactions && result.transactions.length > 0) {
            console.log(`[PLAID] Loaded ${result.transactions.length} transactions`);
            
            // Calculate and display metrics directly
            const transactions = result.transactions;
            const totalTrades = transactions.length;
            
            const totalVolume = transactions.reduce((sum, t) => {
                const qty = Math.abs(parseFloat(t.quantity) || 0);
                const price = parseFloat(t.price) || 0;
                return sum + (qty * price);
            }, 0);
            
            const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
            
            // Calculate actual win rate from transactions
            const sellTrades = transactions.filter(t => 
                (t.transaction_type && t.transaction_type.toLowerCase().includes('sell')) || parseFloat(t.quantity) < 0
            );
            const buyTrades = transactions.filter(t => 
                (t.transaction_type && t.transaction_type.toLowerCase().includes('buy')) || parseFloat(t.quantity) > 0
            );
            
            let winRate = 0;
            if (sellTrades.length > 0 && buyTrades.length > 0) {
                const avgSellPrice = sellTrades.reduce((sum, t) => sum + parseFloat(t.price), 0) / sellTrades.length;
                const avgBuyPrice = buyTrades.reduce((sum, t) => sum + parseFloat(t.price), 0) / buyTrades.length;
                winRate = avgSellPrice > avgBuyPrice ? ((avgSellPrice - avgBuyPrice) / avgBuyPrice * 100) : 0;
            }
            
            const portfolioValue = totalVolume / 2;
            const turnoverRatio = portfolioValue > 0 ? totalVolume / portfolioValue : 0;
            
            // Update overview metrics
            const totalTradesEl = document.getElementById('totalTrades');
            const winRateEl = document.getElementById('winRate');
            const avgTradeSizeEl = document.getElementById('avgTradeSize');
            const turnoverRatioEl = document.getElementById('turnoverRatio');

            if (totalTradesEl) totalTradesEl.textContent = totalTrades.toLocaleString();
            if (winRateEl) winRateEl.textContent = winRate.toFixed(1) + '%';
            if (avgTradeSizeEl) avgTradeSizeEl.textContent = `$${avgTradeSize > 1000 ? (avgTradeSize / 1000).toFixed(0) + 'K' : avgTradeSize.toFixed(0)}`;
            if (turnoverRatioEl) turnoverRatioEl.textContent = turnoverRatio.toFixed(1) + 'x';
            
            // Load detailed analytics
            if (typeof window.loadTransactionAnalytics === 'function') {
                window.loadTransactionAnalytics(transactions);
            } else if (typeof loadTransactionAnalytics === 'function') {
                loadTransactionAnalytics(transactions);
            }
            
            // Load additional transaction analysis functions
            loadPlaidPnLAttribution(transactions);
            loadPlaidCostAnalysis(transactions);
            loadPlaidTradePerformance(transactions);
        } else {
            console.log('[PLAID] No transaction data available');
            
            // Show message instead of error
            const transactionSection = document.getElementById('transactionAnalysis');
            if (transactionSection) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'text-center py-8 text-gray-500';
                messageDiv.innerHTML = `
                    <div class="mb-4">
                        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No Transaction Data</h3>
                    <p class="text-sm text-gray-500 mb-4">Connect your brokerage account to view transaction analysis</p>
                    <button onclick="connectPlaid()" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                        Connect Account
                    </button>
                `;
                
                // Clear existing content and add message
                transactionSection.innerHTML = '';
                transactionSection.appendChild(messageDiv);
            }
        }
    } catch (error) {
        console.error('[PLAID] Transaction load failed:', error);
        
        // Show error message
        const transactionSection = document.getElementById('transactionAnalysis');
        if (transactionSection) {
            transactionSection.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <p>Failed to load transaction data: ${error.message}</p>
                </div>
            `;
        }
    }
}

async function loadPlaidPnLAttribution(transactions) {
    const container = document.getElementById('pnlAttribution');
    if (!container || !transactions || transactions.length === 0) return;
    
    const totalVolume = transactions.reduce((sum, t) => {
        const qty = Math.abs(parseFloat(t.quantity) || 0);
        const price = parseFloat(t.price) || 0;
        return sum + (qty * price);
    }, 0);
    
    const totalFees = transactions.reduce((sum, t) => sum + (parseFloat(t.fees) || 0), 0);
    
    let realizedPnL = 0;
    const positions = {};
    
    transactions.forEach(t => {
        const symbol = t.symbol;
        const qty = parseFloat(t.quantity) || 0;
        const price = parseFloat(t.price) || 0;
        
        if (!positions[symbol]) positions[symbol] = { qty: 0, avgCost: 0, totalCost: 0 };
        
        if (qty > 0) {
            const newTotalCost = positions[symbol].totalCost + (qty * price);
            const newQty = positions[symbol].qty + qty;
            positions[symbol].avgCost = newTotalCost / newQty;
            positions[symbol].qty = newQty;
            positions[symbol].totalCost = newTotalCost;
        } else if (qty < 0) {
            const sellQty = Math.abs(qty);
            const sellValue = sellQty * price;
            const costBasis = sellQty * positions[symbol].avgCost;
            realizedPnL += sellValue - costBasis;
            positions[symbol].qty += qty;
        }
    });
    
    container.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between"><span>Total Volume</span><span class="font-semibold">$${totalVolume > 1000 ? (totalVolume / 1000).toFixed(0) + 'K' : totalVolume.toFixed(0)}</span></div>
            <div class="flex justify-between"><span>Total Fees</span><span class="font-semibold text-red-600">$${totalFees.toFixed(2)}</span></div>
            <div class="flex justify-between"><span>Realized P&L</span><span class="font-semibold ${realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}">${realizedPnL >= 0 ? '+' : ''}$${realizedPnL > 1000 ? (realizedPnL / 1000).toFixed(1) + 'K' : realizedPnL.toFixed(0)}</span></div>
        </div>
    `;
}

async function loadPlaidCostAnalysis(transactions) {
    const container = document.getElementById('costAnalysis');
    if (!container || !transactions || transactions.length === 0) return;
    
    const totalFees = transactions.reduce((sum, t) => sum + (parseFloat(t.fees) || 0), 0);
    const totalVolume = transactions.reduce((sum, t) => sum + Math.abs((parseFloat(t.quantity) || 0) * (parseFloat(t.price) || 0)), 0);
    const avgFeePerTrade = transactions.length > 0 ? totalFees / transactions.length : 0;
    const feePercentage = totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0;
    
    container.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between"><span>Total Fees</span><span class="font-semibold">$${totalFees.toFixed(2)}</span></div>
            <div class="flex justify-between"><span>Avg Fee per Trade</span><span class="font-semibold">$${avgFeePerTrade.toFixed(2)}</span></div>
            <div class="flex justify-between"><span>Fee as % of Volume</span><span class="font-semibold">${feePercentage.toFixed(3)}%</span></div>
        </div>
    `;
}

async function loadPlaidTradePerformance(transactions) {
    const container = document.getElementById('tradePerformance');
    if (!container || !transactions || transactions.length === 0) return;
    
    const totalTrades = transactions.length;
    const totalVolume = transactions.reduce((sum, t) => {
        const qty = Math.abs(parseFloat(t.quantity) || 0);
        const price = parseFloat(t.price) || 0;
        return sum + (qty * price);
    }, 0);
    const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
    
    // Calculate best and worst trades from actual data
    const tradeSizes = transactions.map(t => {
        const qty = Math.abs(parseFloat(t.quantity) || 0);
        const price = parseFloat(t.price) || 0;
        return qty * price;
    });
    
    const bestTrade = tradeSizes.length > 0 ? Math.max(...tradeSizes) : 0;
    const worstTrade = tradeSizes.length > 0 ? Math.min(...tradeSizes) : 0;
    
    container.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between"><span>Total Trades</span><span class="font-semibold">${totalTrades}</span></div>
            <div class="flex justify-between"><span>Avg Trade Size</span><span class="font-semibold">$${avgTradeSize > 1000 ? (avgTradeSize / 1000).toFixed(0) + 'K' : avgTradeSize.toFixed(0)}</span></div>
            <div class="flex justify-between"><span>Largest Trade</span><span class="font-semibold text-green-600">$${bestTrade > 1000 ? (bestTrade / 1000).toFixed(0) + 'K' : bestTrade.toFixed(0)}</span></div>
            <div class="flex justify-between"><span>Smallest Trade</span><span class="font-semibold">$${worstTrade > 1000 ? (worstTrade / 1000).toFixed(0) + 'K' : worstTrade.toFixed(0)}</span></div>
        </div>
    `;
}

// Export functions
window.loadPlaidTransactionAnalysis = loadPlaidTransactionAnalysis;
window.loadPlaidPnLAttribution = loadPlaidPnLAttribution;
window.loadPlaidCostAnalysis = loadPlaidCostAnalysis;
window.loadPlaidTradePerformance = loadPlaidTradePerformance;