async function connectPlaid() {
    try {
        const plaidStatus = document.getElementById('plaidStatus');
        if (plaidStatus) {
            plaidStatus.textContent = 'Initializing Plaid connection...';
            plaidStatus.className = 'mt-2 text-xs text-blue-600';
        }

        // Get link token from backend
        const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080/api'}/create-link-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: window.currentUser?.user_id || 'demo_user' })
        });

        const data = await response.json();

        if (data.success && data.link_token) {
            // Initialize Plaid Link
            const handler = Plaid.create({
                token: data.link_token,
                onSuccess: async (public_token, metadata) => {
                    if (plaidStatus) {
                        plaidStatus.textContent = 'Processing connection...';
                    }

                    // Exchange public token
                    const exchangeResponse = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080/api'}/exchange-token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            public_token,
                            user_id: window.currentUser?.user_id || 'demo_user'
                        })
                    });

                    const exchangeData = await exchangeResponse.json();

                    if (exchangeData.success) {
                        try {
                            // Load portfolio data
                            const portfolioResponse = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080/api'}/plaid-portfolio?user_id=${window.currentUser?.user_id || 'demo_user'}`);

                            if (portfolioResponse.ok) {
                                const portfolioData = await portfolioResponse.json();

                                if (portfolioData.success && portfolioData.holdings && portfolioData.holdings.length > 0) {
                                    window.portfolioData = portfolioData.holdings;
                                    
                                    // Update portfolio value display
                                    const aumElement = document.getElementById('totalAUM');
                                    if (aumElement && portfolioData.portfolio_value) {
                                        const value = portfolioData.portfolio_value;
                                        if (value >= 1000) {
                                            aumElement.textContent = `$${(value / 1000).toFixed(0)}K`;
                                        } else {
                                            aumElement.textContent = `$${value.toFixed(2)}`;
                                        }
                                    }
                                    
                                    if (window.displayPortfolio) {
                                        window.displayPortfolio(portfolioData.holdings);
                                    }

                                    if (plaidStatus) {
                                        const valueText = portfolioData.portfolio_value ? ` (${portfolioData.portfolio_value >= 1000 ? '$' + (portfolioData.portfolio_value / 1000).toFixed(0) + 'K' : '$' + portfolioData.portfolio_value.toFixed(2)})` : '';
                                        plaidStatus.textContent = `✓ Portfolio loaded from Plaid${valueText}`;
                                        plaidStatus.className = 'mt-2 text-xs text-green-600';
                                    }

                                    if (window.showSuccess) {
                                        window.showSuccess('Portfolio connected via Plaid');
                                    }
                                } else {
                                    throw new Error('No portfolio data found');
                                }
                            } else {
                                throw new Error('Failed to fetch portfolio data');
                            }
                        } catch (error) {
                            console.log('Plaid portfolio data not available:', error);

                            if (plaidStatus) {
                                plaidStatus.textContent = '⚠ Plaid connected - No portfolio data available';
                                plaidStatus.className = 'mt-2 text-xs text-orange-600';
                            }

                            if (window.showError) {
                                window.showError('Plaid connected but no portfolio data found. Please ensure your account has holdings.');
                            }
                        }
                    }
                },
                onExit: (err, metadata) => {
                    if (plaidStatus) {
                        plaidStatus.textContent = 'Connection cancelled';
                        plaidStatus.className = 'mt-2 text-xs text-gray-600';
                    }
                }
            });

            handler.open();

        } else {
            throw new Error(data.error || 'Failed to initialize Plaid');
        }

    } catch (error) {
        console.log('Plaid connection failed:', error);

        const plaidStatus = document.getElementById('plaidStatus');
        if (plaidStatus) {
            plaidStatus.textContent = 'Plaid connection failed';
            plaidStatus.className = 'mt-2 text-xs text-red-600';
        }

        if (window.showError) {
            window.showError('Plaid connection failed: ' + error.message);
        }
    }
}

function loadDemoData() {
    const plaidStatus = document.getElementById('plaidStatus');
    if (plaidStatus) {
        plaidStatus.textContent = 'Demo data disabled - Please connect real Plaid account';
        plaidStatus.className = 'mt-2 text-xs text-orange-600';
    }

    if (window.showError) {
        window.showError('Demo data is disabled. Please connect your real Plaid account or upload a portfolio file.');
    }
}

async function calculateAdvancedTransactionMetrics(transactions) {
    try {
        const advancedResponse = await fetch(`${API_BASE}/advanced-transaction-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions, type: 'all' })
        });

        const result = await advancedResponse.json();
        if (result.success) {
            updateAdvancedPnLSection(result.results);
        }
    } catch (error) {
        console.log('Advanced transaction analysis failed');
    }
}

function updateAdvancedPnLSection(results) {
    const pnlSection = document.querySelector('.pnl-items');
    if (pnlSection && results) {
        const turnoverRate = results.turnover_analysis?.annualized_turnover_rate || 0;
        const maxDrawdown = results.drawdown_analysis?.max_drawdown_pct || 0;

        pnlSection.innerHTML += `
            <div class="pnl-item">
                <span>Turnover Rate</span>
                <span class="neutral">${(turnoverRate * 100).toFixed(1)}%</span>
            </div>
            <div class="pnl-item">
                <span>Max Drawdown</span>
                <span class="negative">${(maxDrawdown * 100).toFixed(1)}%</span>
            </div>
        `;
    }
}

async function loadTransactionAnalytics(transactions) {
    console.log('Loading transaction analytics for:', transactions?.length, 'transactions');

    if (!transactions || transactions.length === 0) {
        showError('No transaction data to analyze');
        return;
    }

    showAllTransactionCardLoading();

    try {
        const response = await fetch(`${API_BASE}/analyze-transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions })
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            // Use the actual transactions data directly
            const actualTransactions = transactions;
            const totalTrades = actualTransactions.length;
            
            console.log('Transaction metrics - total transactions:', totalTrades);
            console.log('Sample transaction:', actualTransactions[0]);
            
            // Calculate metrics from actual transaction data
            const totalVolume = actualTransactions.reduce((sum, t) => {
                const qty = Math.abs(parseFloat(t.quantity) || 0);
                const price = parseFloat(t.price) || 0;
                return sum + (qty * price);
            }, 0);
            
            const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
            
            // Calculate win rate
            const sellTrades = actualTransactions.filter(t => 
                (t.transaction_type && t.transaction_type.toLowerCase().includes('sell')) || parseFloat(t.quantity) < 0
            );
            const buyTrades = actualTransactions.filter(t => 
                (t.transaction_type && t.transaction_type.toLowerCase().includes('buy')) || parseFloat(t.quantity) > 0
            );
            
            let winRate = 0;
            if (sellTrades.length > 0 && buyTrades.length > 0) {
                const avgSellPrice = sellTrades.reduce((sum, t) => sum + parseFloat(t.price), 0) / sellTrades.length;
                const avgBuyPrice = buyTrades.reduce((sum, t) => sum + parseFloat(t.price), 0) / buyTrades.length;
                winRate = avgSellPrice > avgBuyPrice ? ((avgSellPrice - avgBuyPrice) / avgBuyPrice * 100) : 0;
            }
            
            // Calculate turnover ratio
            const portfolioValue = totalVolume / 2; // Estimate portfolio value
            const turnoverRatio = portfolioValue > 0 ? (totalVolume / portfolioValue) : 1.0;
            
            console.log('Calculated metrics:', { totalTrades, totalVolume, avgTradeSize, winRate, turnoverRatio });

            const totalTradesEl = document.getElementById('totalTrades');
            const winRateEl = document.getElementById('winRate');
            const avgTradeSizeEl = document.getElementById('avgTradeSize');
            const turnoverRatioEl = document.getElementById('turnoverRatio');

            if (totalTradesEl) totalTradesEl.textContent = totalTrades.toLocaleString();
            if (winRateEl) winRateEl.textContent = winRate.toFixed(1) + '%';
            if (avgTradeSizeEl) avgTradeSizeEl.textContent = `$${avgTradeSize > 1000 ? (avgTradeSize / 1000).toFixed(0) + 'K' : avgTradeSize.toFixed(0)}`;
            if (turnoverRatioEl) turnoverRatioEl.textContent = turnoverRatio.toFixed(1) + 'x';
            
            // Update XIRR metrics if available
            if (data.summary) {
                const xirrEl = document.getElementById('xirrMetric');
                const twrEl = document.getElementById('twrMetric');
                if (xirrEl && data.summary.xirr) xirrEl.textContent = (data.summary.xirr >= 0 ? '+' : '') + data.summary.xirr.toFixed(1) + '%';
                if (twrEl && data.summary.time_weighted_return) twrEl.textContent = (data.summary.time_weighted_return >= 0 ? '+' : '') + data.summary.time_weighted_return.toFixed(1) + '%';
            }

            loadDetailedTransactionAnalytics(transactions);
            showSuccess('Transaction analytics loaded successfully');
        } else {
            throw new Error(data.error || 'Transaction analysis failed');
        }
    } catch (error) {
        console.error('Transaction analytics failed:', error);
        showError('Server connection required for transaction analysis');
        throw error;
    }
}

async function loadDetailedTransactionAnalytics(transactions) {
    const withTimeout = (promise, timeoutMs = 3000) => {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
            )
        ]);
    };

    const analyticsPromises = [
        withTimeout(loadPnLAttribution(transactions)).catch(() => console.log('P&L attribution failed')),
        withTimeout(loadCostAnalysis(transactions)).catch(() => console.log('Cost analysis failed')),
        withTimeout(loadReturnAttribution(transactions)).catch(() => console.log('Return attribution failed')),
        withTimeout(loadTradePerformance(transactions)).catch(() => console.log('Trade performance failed')),
        withTimeout(loadTurnoverAnalysis(transactions)).catch(() => console.log('Turnover analysis failed')),
        withTimeout(loadTaxAnalysis(transactions)).catch(() => console.log('Tax analysis failed')),
        withTimeout(loadCashFlowAnalysis(transactions)).catch(() => console.log('Cash flow analysis failed')),
        withTimeout(loadFifoLifoAnalysis(transactions)).catch(() => console.log('FIFO/LIFO analysis failed')),
        withTimeout(loadTradeTimingAnalysis(transactions)).catch(() => console.log('Trade timing analysis failed')),
        withTimeout(loadDrawdownAnalysis(transactions)).catch(() => console.log('Drawdown analysis failed')),
        withTimeout(loadXIRRAnalysis(transactions)).catch(() => console.log('XIRR analysis failed'))
    ];

    await Promise.allSettled(analyticsPromises);
}

async function loadPnLAttribution(transactions) {
    const container = document.getElementById('pnlAttribution');
    if (!container) return;
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No transaction data available</p>';
        return;
    }

    const totalVolume = transactions.reduce((sum, t) => {
        const qty = Math.abs(parseFloat(t.quantity) || 0);
        const price = parseFloat(t.price) || 0;
        return sum + (qty * price);
    }, 0);

    const totalFees = transactions.reduce((sum, t) => sum + (parseFloat(t.fees) || 0), 0);
    
    // Calculate actual P&L from buy/sell transactions
    let realizedPnL = 0;
    const positions = {};
    
    transactions.forEach(t => {
        const symbol = t.symbol;
        const qty = parseFloat(t.quantity) || 0;
        const price = parseFloat(t.price) || 0;
        
        if (!positions[symbol]) positions[symbol] = { qty: 0, avgCost: 0, totalCost: 0 };
        
        if (qty > 0) { // Buy
            const newTotalCost = positions[symbol].totalCost + (qty * price);
            const newQty = positions[symbol].qty + qty;
            positions[symbol].avgCost = newTotalCost / newQty;
            positions[symbol].qty = newQty;
            positions[symbol].totalCost = newTotalCost;
        } else if (qty < 0) { // Sell
            const sellQty = Math.abs(qty);
            const sellValue = sellQty * price;
            const costBasis = sellQty * positions[symbol].avgCost;
            realizedPnL += sellValue - costBasis;
            positions[symbol].qty += qty; // qty is negative
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

async function loadCostAnalysis(transactions) {
    console.log('Cost Analysis (app-main.js) - Called with transactions:', transactions?.length);
    console.log('Cost Analysis - Sample transaction:', transactions?.[0]);
    
    if (!transactions || transactions.length === 0) {
        document.getElementById('costAnalysis').innerHTML = '<p class="text-gray-500">No transaction data for cost analysis</p>';
        return;
    }

    // Check if this is portfolio data (no fees) or transaction data
    const hasTransactionData = transactions.some(t => t.hasOwnProperty('fees') || t.hasOwnProperty('transaction_type'));

    if (!hasTransactionData) {
        // This is portfolio data, show estimated costs
        const totalValue = transactions.reduce((sum, t) => sum + ((parseFloat(t.quantity) || 0) * (parseFloat(t.avg_cost) || 0)), 0);
        const estimatedTrades = transactions.length * 2; // Assume buy + sell for each position
        const estimatedFees = estimatedTrades * 9.95; // $9.95 per trade
        const avgFeePerTrade = estimatedFees / estimatedTrades;
        const feePercentage = totalValue > 0 ? (estimatedFees / totalValue) * 100 : 0;

        document.getElementById('costAnalysis').innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between"><span>Estimated Total Fees</span><span class="font-semibold">$${estimatedFees.toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Avg Fee per Trade</span><span class="font-semibold">$${avgFeePerTrade.toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Fee as % of Portfolio</span><span class="font-semibold">${feePercentage.toFixed(3)}%</span></div>
            </div>
        `;
    } else {
        // This is transaction data with actual fees
        const totalFees = transactions.reduce((sum, t) => sum + (parseFloat(t.fees) || 0), 0);
        const totalVolume = transactions.reduce((sum, t) => sum + Math.abs((parseFloat(t.quantity) || 0) * (parseFloat(t.price) || 0)), 0);
        const avgFeePerTrade = transactions.length > 0 ? totalFees / transactions.length : 0;
        const feePercentage = totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0;
        
        console.log('Cost Analysis - Total Fees:', totalFees);
        console.log('Cost Analysis - Total Volume:', totalVolume);
        console.log('Cost Analysis - Fee Percentage:', feePercentage);

        document.getElementById('costAnalysis').innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between"><span>Total Fees</span><span class="font-semibold">$${totalFees.toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Avg Fee per Trade</span><span class="font-semibold">$${avgFeePerTrade.toFixed(2)}</span></div>
                <div class="flex justify-between"><span>Fee as % of Volume</span><span class="font-semibold">${feePercentage.toFixed(3)}%</span></div>
            </div>
        `;
    }
}

async function loadReturnAttribution(transactions) {
    const symbols = [...new Set(transactions.map(t => t.symbol).filter(s => s !== 'CASH'))];
    const sellTrades = transactions.filter(t => 
        (t.transaction_type && t.transaction_type.toLowerCase().includes('sell')) || parseFloat(t.quantity) < 0
    );
    const avgSellPrice = sellTrades.length > 0 ? sellTrades.reduce((sum, t) => sum + parseFloat(t.price), 0) / sellTrades.length : 0;
    const buyTrades = transactions.filter(t => 
        (t.transaction_type && t.transaction_type.toLowerCase().includes('buy')) || parseFloat(t.quantity) > 0
    );
    const avgBuyPrice = buyTrades.length > 0 ? buyTrades.reduce((sum, t) => sum + parseFloat(t.price), 0) / buyTrades.length : 0;

    const alphaEstimate = (avgBuyPrice > 0 && avgSellPrice > 0) ? ((avgSellPrice - avgBuyPrice) / avgBuyPrice * 100) : null;

    document.getElementById('returnAttribution').innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between"><span>Alpha Generation</span><span class="font-semibold">${alphaEstimate !== null ? (alphaEstimate >= 0 ? '+' : '') + alphaEstimate.toFixed(1) + '%' : 'N/A'}</span></div>
            <div class="flex justify-between"><span>Beta Exposure</span><span class="font-semibold">N/A</span></div>
            <div class="flex justify-between"><span>Sector Rotation</span><span class="font-semibold">N/A</span></div>
        </div>
    `;
}

async function updateFileSelectors() {
    const portfolioSelect = document.getElementById('portfolioFileSelect');
    const transactionSelect = document.getElementById('transactionFileSelect');

    // Force reload from Supabase to get fresh data
    if (currentUser && currentUser.user_id) {
        await loadUserPortfolios();
    }

    if (portfolioSelect) {
        portfolioSelect.innerHTML = '<option value="" selected>Select portfolio file...</option>';
        userPortfolios.forEach((portfolio, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${portfolio.portfolio_name} (${new Date(portfolio.created_at).toLocaleDateString()})`;
            portfolioSelect.appendChild(option);
        });
    }

    let transactionFiles = [];

    if (currentUser && currentUser.user_id) {
        try {
            // Force fresh reload with cache-busting parameter
            const transactionResponse = await fetch(`${API_BASE}/load-transactions?user_id=${currentUser.user_id}&_t=${Date.now()}`);
            const transactionData = await transactionResponse.json();
            if (transactionData.success && transactionData.transactions) {
                transactionFiles = transactionData.transactions.map(t => ({
                    id: t.id,
                    filename: t.transaction_set_name,
                    data: typeof t.transactions_data === 'string' ? JSON.parse(t.transactions_data) : t.transactions_data,
                    source: 'supabase',
                    created_at: t.created_at
                }));
            }
        } catch (error) {
            console.log('Failed to load from Supabase, trying local storage:', error);
        }
    }

    if (transactionFiles.length === 0) {
        const localTransactions = JSON.parse(localStorage.getItem('transactionFiles') || '[]');
        transactionFiles = localTransactions.map((file, index) => ({
            ...file,
            id: index,
            source: 'local',
            filename: file.filename || `Transaction Set ${index + 1}`
        }));
    }

    // No sample transactions - only real data

    if (transactionSelect) {
        transactionSelect.innerHTML = '<option value="" selected>Select transaction file...</option>';
        transactionFiles.forEach((file, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = file.filename + (file.source === 'sample' ? ' (Demo)' : '');
            transactionSelect.appendChild(option);
        });
    }

    window.portfolioFiles = userPortfolios.map(p => ({
        id: p.id,
        filename: p.portfolio_name,
        data: typeof p.portfolio_data === 'string' ? JSON.parse(p.portfolio_data) : p.portfolio_data,
        source: 'supabase'
    }));
    window.transactionFiles = transactionFiles;
}

async function connectSupabaseAndLoadData() {
    if (!currentUser || !currentUser.user_id) {
        console.log('No user logged in, skipping Supabase connection');
        return;
    }

    try {
        console.log('Connecting to Supabase and loading stored data...');

        const response = await fetch(`${API_BASE}/load-portfolios?user_id=${currentUser.user_id}`);
        const data = await response.json();

        if (data.success) {
            userPortfolios = data.portfolios || [];
            updateFileSelectors();
            await loadUserTransactions();
            console.log(`✓ Loaded ${userPortfolios.length} portfolios`);
        }
    } catch (error) {
        console.log('Database connection failed, using local storage only:', error);
        updateFileSelectors();
    }
}

async function loadStoredResultsForPortfolio(portfolioData) {
    // Placeholder - returns false for now
    return false;
}

async function saveAnalyticsToSupabase(portfolioData, analyticsData) {
    if (!currentUser?.user_id || !portfolioData) return;

    try {
        const portfolioHash = btoa(JSON.stringify(portfolioData)).substring(0, 32);

        const response = await fetch(`${API_BASE}/save-analytics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.user_id,
                portfolio_hash: portfolioHash,
                analytics_data: analyticsData,
                calculated_at: new Date().toISOString()
            })
        });

        if (response.ok) {
            console.log('Analytics saved to Supabase');
        }
    } catch (error) {
        console.log('Failed to save analytics to Supabase:', error);
    }
}

async function savePortfolioToSupabase(filename, data) {
    const response = await fetch(`${API_BASE}/save-portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.user_id,
            portfolio_name: filename,
            portfolio_data: data
        })
    });
    
    if (!response.ok) {
        throw new Error(`Server connection failed: HTTP ${response.status}`);
    }
    
    return await response.json();
}

async function saveTransactionsToSupabase(filename, data) {
    const response = await fetch(`${API_BASE}/save-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.user_id,
            transaction_set_name: filename,
            transactions_data: data
        })
    });
    
    if (!response.ok) {
        throw new Error(`Server connection failed: HTTP ${response.status}`);
    }
    
    return await response.json();
}

async function loadTradePerformance(transactions) {
    const totalTrades = transactions.length;
    const totalVolume = transactions.reduce((sum, t) => {
        const qty = Math.abs(parseFloat(t.quantity) || 0);
        const price = parseFloat(t.price) || 0;
        return sum + (qty * price);
    }, 0);
    const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
    
    console.log('Trade Performance - Total Volume:', totalVolume, 'Avg Trade Size:', avgTradeSize);
    
    document.getElementById('tradePerformance').innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between"><span>Total Trades</span><span class="font-semibold">${totalTrades}</span></div>
            <div class="flex justify-between"><span>Avg Trade Size</span><span class="font-semibold">$${avgTradeSize > 1000 ? (avgTradeSize / 1000).toFixed(0) + 'K' : avgTradeSize.toFixed(0)}</span></div>
            <div class="flex justify-between"><span>Best Trade</span><span class="font-semibold text-green-600">N/A</span></div>
            <div class="flex justify-between"><span>Worst Trade</span><span class="font-semibold text-red-600">N/A</span></div>
        </div>
    `;
}

async function loadTurnoverAnalysis(transactions) {
    const totalVolume = transactions.reduce((sum, t) => sum + Math.abs((parseFloat(t.quantity) || 0) * (parseFloat(t.price) || 0)), 0);
    const portfolioValue = totalVolume / 2;
    const turnoverRatio = portfolioValue > 0 ? totalVolume / portfolioValue : 1.0;
    const annualizedTurnover = turnoverRatio * 4; // Quarterly to annual
    
    document.getElementById('turnoverAnalysis').innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between"><span>Turnover Ratio</span><span class="font-semibold">${turnoverRatio.toFixed(1)}x</span></div>
            <div class="flex justify-between"><span>Annualized Turnover</span><span class="font-semibold">${annualizedTurnover.toFixed(1)}x</span></div>
            <div class="flex justify-between"><span>Trading Frequency</span><span class="font-semibold">${transactions.length > 20 ? 'High' : 'Moderate'}</span></div>
        </div>
    `;
}

async function loadTaxAnalysis(transactions) {
    if (!transactions || transactions.length === 0) {
        document.getElementById('taxAnalysis').innerHTML = '<div class="text-center text-gray-500 py-4">No transaction data</div>';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/analyze-transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.summary) {
                const shortTermGains = data.summary.short_term_gains || 0;
                const longTermGains = data.summary.long_term_gains || 0;
                const estimatedTaxLiability = data.summary.estimated_tax_liability || 0;
                const harvestableLosses = data.summary.harvestable_losses || 0;
                
                // Format currency values
                const formatCurrency = (value) => {
                    if (Math.abs(value) >= 1000000) {
                        return `$${(value / 1000000).toFixed(1)}M`;
                    } else if (Math.abs(value) >= 1000) {
                        return `$${(value / 1000).toFixed(0)}K`;
                    } else {
                        return `$${value.toFixed(0)}`;
                    }
                };
                
                // Update both the transaction analysis section and reference.html elements
                document.getElementById('taxAnalysis').innerHTML = `
                    <div class="space-y-3">
                        <div class="flex justify-between"><span>Short-term Gains</span><span class="font-semibold">${formatCurrency(shortTermGains)}</span></div>
                        <div class="flex justify-between"><span>Long-term Gains</span><span class="font-semibold">${formatCurrency(longTermGains)}</span></div>
                        <div class="flex justify-between"><span>Tax Loss Harvesting</span><span class="font-semibold text-green-600">${harvestableLosses > 0 ? '-' : ''}${formatCurrency(Math.abs(harvestableLosses))}</span></div>
                        <div class="flex justify-between"><span>Estimated Tax Liability</span><span class="font-semibold text-red-600">${formatCurrency(estimatedTaxLiability)}</span></div>
                    </div>
                `;
                
                // Update reference.html elements if they exist
                const shortTermEl = document.getElementById('shortTermGains');
                const longTermEl = document.getElementById('longTermGains');
                const harvestableLossesEl = document.getElementById('harvestableLosses');
                const taxLiabilityEl = document.getElementById('estimatedTaxLiability');
                
                if (shortTermEl) shortTermEl.textContent = formatCurrency(shortTermGains);
                if (longTermEl) longTermEl.textContent = formatCurrency(longTermGains);
                if (harvestableLossesEl) harvestableLossesEl.textContent = `${harvestableLosses > 0 ? '-' : ''}${formatCurrency(Math.abs(harvestableLosses))}`;
                if (taxLiabilityEl) taxLiabilityEl.textContent = formatCurrency(estimatedTaxLiability);
                
            } else {
                throw new Error('Tax analysis data not available');
            }
        } else {
            throw new Error('API request failed');
        }
    } catch (error) {
        console.error('Tax analysis error:', error);
        document.getElementById('taxAnalysis').innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between"><span>Short-term Gains</span><span class="font-semibold">$0</span></div>
                <div class="flex justify-between"><span>Long-term Gains</span><span class="font-semibold">$0</span></div>
                <div class="flex justify-between"><span>Tax Loss Harvesting</span><span class="font-semibold">$0</span></div>
                <div class="flex justify-between"><span>Estimated Tax Liability</span><span class="font-semibold">$0</span></div>
            </div>
        `;
    }
}

async function loadCashFlowAnalysis(transactions) {
    console.log('Cash Flow Analysis - transactions:', transactions);
    
    if (!transactions || transactions.length === 0) {
        document.getElementById('cashFlowAnalysis').innerHTML = '<div class="text-center text-gray-500 py-4">No transaction data</div>';
        return;
    }
    
    // Calculate based on transaction types
    const sellTrades = transactions.filter(t => 
        (t.transaction_type && t.transaction_type.toLowerCase().includes('sell')) || 
        parseFloat(t.quantity) < 0
    );
    const buyTrades = transactions.filter(t => 
        (t.transaction_type && t.transaction_type.toLowerCase().includes('buy')) || 
        parseFloat(t.quantity) > 0
    );
    
    console.log('Sell trades:', sellTrades.length, 'Buy trades:', buyTrades.length);
    
    const sellVolume = sellTrades.reduce((sum, t) => {
        const qty = Math.abs(parseFloat(t.quantity) || 0);
        const price = parseFloat(t.price) || 0;
        return sum + (qty * price);
    }, 0);
    
    const buyVolume = buyTrades.reduce((sum, t) => {
        const qty = Math.abs(parseFloat(t.quantity) || 0);
        const price = parseFloat(t.price) || 0;
        return sum + (qty * price);
    }, 0);
    
    console.log('Sell volume:', sellVolume, 'Buy volume:', buyVolume);
    
    const netCashFlow = sellVolume - buyVolume;
    
    document.getElementById('cashFlowAnalysis').innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between"><span>Net Cash Flow</span><span class="font-semibold ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}">${netCashFlow >= 0 ? '+' : ''}$${Math.abs(netCashFlow) > 1000 ? (netCashFlow / 1000).toFixed(0) + 'K' : netCashFlow.toFixed(0)}</span></div>
            <div class="flex justify-between"><span>Est. Dividend Income</span><span class="font-semibold">N/A</span></div>
            <div class="flex justify-between"><span>Cash Efficiency</span><span class="font-semibold">N/A</span></div>
        </div>
    `;
}

async function loadFifoLifoAnalysis(transactions) {
    document.getElementById('fifoLifoAnalysis').innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between"><span>FIFO Gains</span><span class="font-semibold">$0</span></div>
            <div class="flex justify-between"><span>LIFO Gains</span><span class="font-semibold">$0</span></div>
            <div class="flex justify-between"><span>Tax Advantage</span><span class="font-semibold">N/A</span></div>
        </div>
    `;
}

async function loadTradeTimingAnalysis(transactions) {
    const morningTrades = transactions.filter(t => {
        const hour = new Date(t.date).getHours();
        return hour >= 9 && hour <= 11;
    }).length;
    const afternoonTrades = transactions.length - morningTrades;
    
    document.getElementById('tradeTimingAnalysis').innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between"><span>Morning Trades</span><span class="font-semibold">${morningTrades}</span></div>
            <div class="flex justify-between"><span>Afternoon Trades</span><span class="font-semibold">${afternoonTrades}</span></div>
            <div class="flex justify-between"><span>Optimal Timing</span><span class="font-semibold">${morningTrades === afternoonTrades ? 'Equal' : morningTrades > afternoonTrades ? 'Morning' : 'Afternoon'}</span></div>
        </div>
    `;
}

async function loadDrawdownAnalysis(transactions) {
    const container = document.getElementById('drawdownAnalysis');
    if (!container || !transactions || transactions.length === 0) {
        if (container) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No transaction data</div>';
        }
        return;
    }
    
    // Calculate actual drawdown from transaction data
    let runningValue = 0;
    let peakValue = 0;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    
    transactions.forEach(t => {
        const qty = parseFloat(t.quantity) || 0;
        const price = parseFloat(t.price) || 0;
        const value = qty * price;
        
        if (qty > 0) { // Buy - reduces cash
            runningValue -= value;
        } else { // Sell - increases cash
            runningValue += Math.abs(value);
        }
        
        if (runningValue > peakValue) {
            peakValue = runningValue;
        }
        
        const drawdown = peakValue > 0 ? (peakValue - runningValue) / peakValue : 0;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    });
    
    currentDrawdown = peakValue > 0 ? (peakValue - runningValue) / peakValue : 0;
    
    container.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between"><span>Max Drawdown</span><span class="font-semibold text-red-600">${(maxDrawdown * 100).toFixed(1)}%</span></div>
            <div class="flex justify-between"><span>Current Drawdown</span><span class="font-semibold">${(currentDrawdown * 100).toFixed(1)}%</span></div>
            <div class="flex justify-between"><span>Recovery Status</span><span class="font-semibold">${currentDrawdown < 0.05 ? 'Recovered' : 'In Drawdown'}</span></div>
        </div>
    `;
}

async function loadXIRRAnalysis(transactions) {
    const container = document.getElementById('xirrAnalysis');
    if (!container) {
        // Create XIRR container if it doesn't exist (add to HTML)
        console.log('XIRR container not found - add xirrAnalysis div to transaction analysis HTML');
        return;
    }
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-4">No transaction data</div>';
        return;
    }
    
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Calculating XIRR...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/analyze-transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.summary) {
                const xirr = data.summary.xirr || 0;
                const twr = data.summary.time_weighted_return || 0;
                const annualizedReturn = data.summary.annualized_return || 0;
                const sharpeRatio = data.summary.sharpe_ratio || 0;
                const volatility = data.summary.volatility || 0;
                const holdingDays = data.summary.holding_period_days || 0;
                
                container.innerHTML = `
                    <div class="space-y-3">
                        <div class="flex justify-between"><span>XIRR</span><span class="font-semibold ${xirr >= 0 ? 'text-green-600' : 'text-red-600'}">${xirr >= 0 ? '+' : ''}${xirr.toFixed(1)}%</span></div>
                        <div class="flex justify-between"><span>Time-Weighted Return</span><span class="font-semibold ${twr >= 0 ? 'text-green-600' : 'text-red-600'}">${twr >= 0 ? '+' : ''}${twr.toFixed(1)}%</span></div>
                        <div class="flex justify-between"><span>Annualized Return</span><span class="font-semibold ${annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}">${annualizedReturn >= 0 ? '+' : ''}${annualizedReturn.toFixed(1)}%</span></div>
                        <div class="flex justify-between"><span>Sharpe Ratio</span><span class="font-semibold">${sharpeRatio.toFixed(2)}</span></div>
                        <div class="flex justify-between"><span>Volatility</span><span class="font-semibold">${volatility.toFixed(1)}%</span></div>
                        <div class="flex justify-between"><span>Holding Period</span><span class="font-semibold">${holdingDays} days</span></div>
                    </div>
                `;
            } else {
                throw new Error('XIRR calculation failed');
            }
        } else {
            throw new Error('API request failed');
        }
    } catch (error) {
        console.error('XIRR analysis error:', error);
        container.innerHTML = '<div class="text-center text-gray-500 py-4">XIRR calculation requires server connection</div>';
    }
}

// Add Plaid-specific transaction processing functions
function processPlaidTransactionData(transactions) {
    if (!transactions || !Array.isArray(transactions)) {
        console.error('Invalid Plaid transaction data');
        return null;
    }
    
    // Validate Plaid transaction structure
    const validTransactions = transactions.filter(t => {
        return t && 
               typeof t.symbol === 'string' && 
               t.symbol.length > 0 &&
               !isNaN(parseFloat(t.quantity)) &&
               !isNaN(parseFloat(t.price)) &&
               t.date &&
               t.transaction_type;
    });
    
    console.log(`Processed ${validTransactions.length} valid Plaid transactions from ${transactions.length} total`);
    return validTransactions;
}

function analyzePlaidTransactionPatterns(transactions) {
    if (!transactions || transactions.length === 0) return null;
    
    const patterns = {
        account_ids: [...new Set(transactions.map(t => t.account_id).filter(Boolean))],
        symbols: [...new Set(transactions.map(t => t.symbol).filter(Boolean))],
        transaction_types: [...new Set(transactions.map(t => t.transaction_type).filter(Boolean))],
        date_range: {
            start: Math.min(...transactions.map(t => new Date(t.date).getTime())),
            end: Math.max(...transactions.map(t => new Date(t.date).getTime()))
        }
    };
    
    console.log('Plaid transaction patterns:', patterns);
    return patterns;
}

// Export additional functions
window.connectPlaid = connectPlaid;
window.loadDemoData = loadDemoData;
window.calculateAdvancedTransactionMetrics = calculateAdvancedTransactionMetrics;
window.loadTransactionAnalytics = loadTransactionAnalytics;
window.updateFileSelectors = updateFileSelectors;
window.connectSupabaseAndLoadData = connectSupabaseAndLoadData;
window.loadStoredResultsForPortfolio = loadStoredResultsForPortfolio;
window.saveAnalyticsToSupabase = saveAnalyticsToSupabase;
window.savePortfolioToSupabase = savePortfolioToSupabase;
window.saveTransactionsToSupabase = saveTransactionsToSupabase;
window.processPlaidTransactionData = processPlaidTransactionData;
window.analyzePlaidTransactionPatterns = analyzePlaidTransactionPatterns;