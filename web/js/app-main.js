async function connectPlaid() {
    try {
        const plaidStatus = document.getElementById('plaidStatus');
        if (plaidStatus) {
            plaidStatus.textContent = 'Initializing Plaid connection...';
            plaidStatus.className = 'mt-2 text-xs text-blue-600';
        }

        // Get link token from backend
        const response = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/create-link-token`, {
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
                    const exchangeResponse = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/exchange-token`, {
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
                            const portfolioResponse = await fetch(`${window.API_BASE || 'http://127.0.0.1:8080'}/api/plaid-portfolio?user_id=${window.currentUser?.user_id || 'demo_user'}`);

                            if (portfolioResponse.ok) {
                                const portfolioData = await portfolioResponse.json();

                                if (portfolioData.success && portfolioData.holdings && portfolioData.holdings.length > 0) {
                                    window.portfolioData = portfolioData.holdings;
                                    window.currentPortfolioData = portfolioData.holdings;

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
        const response = await fetch(`${API_BASE}/api/analyze-transactions`, {
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

            // Load detailed analytics using new modular system
            if (window.loadAllTransactionAnalytics) {
                window.loadAllTransactionAnalytics(transactions);
            }
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
        // Turnover analysis handled by dedicated module
        withTimeout(loadTaxAnalysis(transactions)).catch(() => console.log('Tax analysis failed')),
        // Cash flow analysis handled by dedicated module
        withTimeout(loadFifoLifoAnalysis(transactions)).catch(() => console.log('FIFO/LIFO analysis failed')),
        withTimeout(loadTradeTimingAnalysis(transactions)).catch(() => console.log('Trade timing analysis failed')),
        // Drawdown analysis handled by dedicated module
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

// Cost Analysis moved to separate file

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
    // Simply trigger a reload of data which will update dropdowns via module functions
    if (currentUser && currentUser.user_id) {
        try {
            await Promise.all([
                loadUserPortfolios(),
                loadUserTransactions()
            ]);
            console.log('File selectors updated via modules');
        } catch (error) {
            console.error('Failed to update file selectors:', error);
        }
    }
}

async function connectSupabaseAndLoadData() {
    if (!currentUser || !currentUser.user_id) {
        console.log('No user logged in, skipping Supabase connection');
        return;
    }

    try {
        console.log('Connecting to Supabase and loading stored data...');

        const response = await fetch(`${API_BASE}/api/load-portfolios?user_id=${currentUser.user_id}`);
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

// loadTurnoverAnalysis removed - using dedicated interactive version from turnover-analysis.js

// loadCashFlowAnalysis removed - using dedicated cash-flow-analysis.js module

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

// Old drawdown analysis function removed - using comprehensive version from drawdown-analysis.js

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