// Analytics module for portfolio and transaction analysis
// Use global API_BASE

async function loadAllRealAnalytics(data, options = {}) {
    console.log('loadAllRealAnalytics called with data:', data, 'options:', options);

    if (!data) {
        console.error('No data provided to loadAllRealAnalytics');
        return;
    }

    // Ensure data is in the correct format
    let portfolioData = data;
    if (!Array.isArray(data)) {
        if (typeof data === 'object' && data !== null) {
            // Try to convert object to array
            portfolioData = Object.values(data);
            console.log('Converted object to array:', portfolioData);
        } else {
            console.error('Data is not an array or object:', typeof data, data);
            return;
        }
    }

    if (portfolioData.length === 0) {
        console.error('Portfolio data array is empty');
        return;
    }

    console.log('Processing portfolio data:', portfolioData.length, 'positions');

    const withTimeout = (promise, timeoutMs = 60000) => {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
            )
        ]);
    };

    const showAnalyticsError = (containerId, error) => {
        console.error('Analytics error for', containerId, ':', error);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div class="text-center text-red-500 py-4">${error}</div>`;
        }
    };

    try {
        // Load core analytics first
        console.log('Loading core analytics...');
        await Promise.allSettled([
            withTimeout(loadRiskAnalytics(portfolioData, options)).catch(e => {
                console.error('Risk analytics failed:', e);
                showAnalyticsError('riskResults', 'Risk calculation failed: ' + e.message);
            }),
            withTimeout(loadOptionsAnalytics(portfolioData, options)).catch(e => {
                console.error('Options analytics failed:', e);
                showAnalyticsError('optionsResults', 'Options scan failed: ' + e.message);
            })
        ]);

        // Load enhanced analytics
        console.log('Loading enhanced analytics...');
        await Promise.allSettled([
            withTimeout(loadEnhancedPerformanceAttribution(portfolioData)).catch(e => {
                console.error('Performance attribution error:', e);
                showAnalyticsError('performanceAttribution', 'Performance attribution failed: ' + e.message);
            }),


            withTimeout(loadStatisticalAnalysis(portfolioData)).catch(e => showAnalyticsError('statisticalAnalysis', 'Statistical analysis failed: ' + e.message)),
            withTimeout(loadEnhancedSectorAnalysis(portfolioData)).catch(e => showAnalyticsError('sectorAllocation', 'Sector analysis failed: ' + e.message)),

            withTimeout(loadEnhancedTechnicalAnalysis(portfolioData)).catch(e => showAnalyticsError('enhancedTechnicalAnalysis', 'Technical analysis failed: ' + e.message)),
            withTimeout(loadBacktestingResults(portfolioData)).catch(e => showAnalyticsError('backtestingResults', 'Backtesting failed: ' + e.message)),
            withTimeout(createMonteCarloResults(portfolioData)).catch(e => showAnalyticsError('monteCarloResults', 'Monte Carlo failed: ' + e.message)),
            withTimeout(loadCorrelationAnalysis(portfolioData)).catch(e => showAnalyticsError('correlationMatrix', 'Correlation analysis failed: ' + e.message)),
            withTimeout(loadPortfolioOptimization(portfolioData)).catch(e => showAnalyticsError('portfolioOptimization', 'Portfolio optimization failed: ' + e.message))
        ]);

        console.log('All analytics loading completed');

    } catch (error) {
        console.error('Analytics loading failed:', error);
        showAnalyticsError('riskResults', 'Analytics system error: ' + error.message);
    }
}

async function loadRiskAnalytics(data, options = {}) {
    if (!data || (Array.isArray(data) && data.length === 0)) {
        updateRiskResults({ error: 'No portfolio data available' });
        return;
    }

    // Handle both array and object data formats
    let portfolioData = [];
    if (Array.isArray(data)) {
        portfolioData = data;
    } else if (typeof data === 'object') {
        // Convert object to array format
        portfolioData = Object.values(data);
    }

    // Filter out invalid symbols
    portfolioData = portfolioData.filter(p => {
        const symbol = p && p.symbol;
        return symbol && typeof symbol === 'string' &&
            !symbol.startsWith('CUR:') &&
            !symbol.startsWith('CASH') &&
            symbol.length <= 10;
    });

    if (portfolioData.length === 0) {
        updateRiskResults({ error: 'No portfolio positions found' });
        return;
    }

    const user = window.currentUser || { role: 'user' };
    console.log('Loading risk analytics for', portfolioData.length, 'positions');

    const url = `${API_BASE}/analyze-risk?nocache=${Date.now()}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ portfolio: portfolioData, user_role: user.role })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Risk analysis server error:', errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const riskData = await response.json();

        if (riskData.success) {
            console.log('Risk analysis successful, updating metrics with:', riskData.risk_metrics);
            // Force fresh data update
            const freshMetrics = riskData.risk_metrics;
            console.log('Fresh API data - Sharpe:', freshMetrics.sharpe_ratio, 'Beta:', freshMetrics.beta);
            updateTopMetrics(freshMetrics);
            updateRiskResults(freshMetrics);
        } else {
            console.error('Risk analysis failed:', riskData.error);
            updateRiskResults({ error: riskData.error || 'Risk calculation failed' });
        }
    } catch (error) {
        console.error('Risk analytics error:', error);
        updateRiskResults({ error: error.message });
    }
}

async function loadOptionsAnalytics(data, options = {}) {
    const container = document.getElementById('optionsResults');
    if (container) {
        container.innerHTML = '<div class="text-center py-4 text-gray-600"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div><div>Scanning options strategies...</div></div>';
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
        updateOptionsResults({ error: 'No portfolio data available' });
        return;
    }

    // Handle both array and object data formats
    let symbols = [];
    if (Array.isArray(data)) {
        symbols = data.map(p => p && p.symbol).filter(s => s && typeof s === 'string' && !s.startsWith('CUR:') && !s.startsWith('CASH') && s.length <= 10);
    } else if (typeof data === 'object') {
        // Handle object format - extract symbols from object values
        symbols = Object.values(data).map(p => p && p.symbol).filter(s => s && typeof s === 'string' && !s.startsWith('CUR:') && !s.startsWith('CASH') && s.length <= 10);
    }

    if (symbols.length === 0) {
        updateOptionsResults({ error: 'No valid symbols found' });
        return;
    }

    console.log('Loading options analytics for symbols:', symbols);

    const url = `${API_BASE}/scan-options?nocache=${Date.now()}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ symbols })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Options scan server error:', errorText);
            updateOptionsResults({ error: `Server error: HTTP ${response.status}` });
            return;
        }

        const optionsData = await response.json();

        if (optionsData.success) {
            updateOptionsResults(optionsData.opportunities, optionsData.summary);
        } else {
            console.error('Options scan failed:', optionsData.error);
            updateOptionsResults({ error: optionsData.error || 'Options scan failed' });
        }
    } catch (error) {
        console.error('Options analytics error:', error);
        updateOptionsResults({ error: error.message });
    }
}

async function createMonteCarloResults(portfolioData) {
    const chartContainer = document.getElementById('monteCarloResults');
    if (!chartContainer) return;

    chartContainer.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Running Monte Carlo simulation...</div>';

    try {
        // Use fresh data passed to function, not cached window.portfolioData
        const actualData = portfolioData || window.portfolioData;
        
        if (!actualData || actualData.length === 0) {
            chartContainer.innerHTML = '<div class="text-center text-gray-500 py-4">No portfolio data available</div>';
            return;
        }
        
        const portfolioDataFiltered = actualData.filter(item => 
            item && item.symbol && !isNaN(parseFloat(item.quantity)) && !isNaN(parseFloat(item.avg_cost || item.price))
        );
        
        console.log('Monte Carlo - Sending portfolio data:', portfolioDataFiltered);
        const response = await fetch(`${API_BASE}/monte-carlo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioDataFiltered, user_role: 'user' })
        });
        
        console.log('Monte Carlo API response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Monte Carlo API error:', errorText);
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Monte Carlo API full response:', result);
        
        if (result.success && result.results) {
            const mc = result.results;
            console.log('Monte Carlo API response:', mc);
            console.log('Monte Carlo values - Expected Return:', mc.expected_return, 'Volatility:', mc.volatility);
            console.log('Monte Carlo percentiles - 5th:', mc.percentile_5, '95th:', mc.percentile_95);
            
            // AGGRESSIVE DEBUGGING - Check each value
            console.log('DEBUGGING MONTE CARLO:');
            console.log('mc object:', JSON.stringify(mc, null, 2));
            console.log('expected_return type:', typeof mc.expected_return, 'value:', mc.expected_return);
            console.log('volatility type:', typeof mc.volatility, 'value:', mc.volatility);
            console.log('percentile_95 type:', typeof mc.percentile_95, 'value:', mc.percentile_95);
            console.log('percentile_5 type:', typeof mc.percentile_5, 'value:', mc.percentile_5);
            
            const expectedReturn = typeof mc.expected_return === 'number' ? (mc.expected_return * 100).toFixed(1) + '%' : 'N/A';
            const volatility = typeof mc.volatility === 'number' ? (mc.volatility * 100).toFixed(1) + '%' : 'N/A';
            const percentile95 = typeof mc.percentile_95 === 'number' ? '+' + (mc.percentile_95 * 100).toFixed(1) + '%' : 'N/A';
            const percentile5 = typeof mc.percentile_5 === 'number' ? (mc.percentile_5 * 100).toFixed(1) + '%' : 'N/A';
            
            console.log('Monte Carlo display values:', {expectedReturn, volatility, percentile95, percentile5});
            
            chartContainer.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Expected Return</span>
                        <span class="font-semibold">${expectedReturn}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Volatility</span>
                        <span class="font-semibold">${volatility}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">95th Percentile</span>
                        <span class="font-semibold text-green-600">${percentile95}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">5th Percentile</span>
                        <span class="font-semibold text-red-600">${percentile5}</span>
                    </div>
                </div>
            `;
        } else {
            console.error('Monte Carlo API error:', result);
            throw new Error(result.error || 'Monte Carlo simulation failed');
        }
    } catch (error) {
        console.error('Monte Carlo error:', error);
        chartContainer.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Expected Return</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Volatility</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">95th Percentile</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">5th Percentile</span>
                    <span class="font-semibold">N/A</span>
                </div>
            </div>
        `;
    }
}

function createOptimizationChart() {
    const chartContainer = document.getElementById('optimizationChart');
    if (!chartContainer) return;

    try {
        const options = {
            series: [{
                name: 'Efficient Frontier',
                data: [[10, 8], [12, 10], [14, 11.5], [16, 12.5], [18, 13], [20, 13.5]]
            }, {
                name: 'Current Portfolio',
                data: [[15, 12.3]]
            }],
            chart: { type: 'scatter', height: 300 },
            colors: ['#6366f1', '#ef4444'],
            xaxis: { title: { text: 'Risk (%)' } },
            yaxis: { title: { text: 'Return (%)' } },
            legend: { position: 'top' },
            markers: { size: [4, 8] }
        };

        new ApexCharts(chartContainer, options).render();
    } catch (error) {
        console.error('Chart creation error:', error);
    }
}

function updateTopMetrics(metrics) {
    console.log('updateTopMetrics called with:', metrics);
    
    const sharpeElement = document.getElementById('sharpeRatio');
    const drawdownElement = document.getElementById('maxDrawdown');
    const betaElement = document.getElementById('beta');
    const aumElement = document.getElementById('totalAUM');

    console.log('Sharpe Ratio from API:', metrics.sharpe_ratio);
    console.log('Beta from API:', metrics.beta);
    console.log('Max Drawdown from API:', metrics.max_drawdown);
    console.log('Sortino Ratio from Risk API:', metrics.sortino_ratio, 'Type:', typeof metrics.sortino_ratio);

    if (sharpeElement) {
        const sharpeValue = (metrics.sharpe_ratio !== undefined && metrics.sharpe_ratio !== null && !isNaN(metrics.sharpe_ratio)) ? metrics.sharpe_ratio.toFixed(2) : 'N/A';
        console.log('FORCING Sharpe Ratio update to:', sharpeValue, 'from API value:', metrics.sharpe_ratio);
        sharpeElement.textContent = sharpeValue;
        sharpeElement.style.color = 'red'; // Visual indicator of update
        setTimeout(() => sharpeElement.style.color = '', 1000);
        
        // Update Sharpe description based on value
        const sharpeDesc = document.getElementById('sharpeDescription');
        if (sharpeDesc && metrics.sharpe_ratio !== undefined && metrics.sharpe_ratio !== null && !isNaN(metrics.sharpe_ratio)) {
            if (metrics.sharpe_ratio > 1.0) {
                sharpeDesc.textContent = 'Excellent';
                sharpeDesc.className = 'text-sm text-green-600 mt-1';
            } else if (metrics.sharpe_ratio > 0.5) {
                sharpeDesc.textContent = 'Good';
                sharpeDesc.className = 'text-sm text-blue-600 mt-1';
            } else if (metrics.sharpe_ratio > 0) {
                sharpeDesc.textContent = 'Below average';
                sharpeDesc.className = 'text-sm text-yellow-600 mt-1';
            } else {
                sharpeDesc.textContent = 'Poor performance';
                sharpeDesc.className = 'text-sm text-red-600 mt-1';
            }
        }
    }
    
    if (drawdownElement) {
        const drawdownValue = (metrics.max_drawdown !== undefined && metrics.max_drawdown !== null && !isNaN(metrics.max_drawdown)) ? `-${(Math.abs(metrics.max_drawdown) * 100).toFixed(1)}%` : 'N/A';
        console.log('Setting Max Drawdown to:', drawdownValue);
        drawdownElement.textContent = drawdownValue;
        
        // Update drawdown description based on severity
        const drawdownDesc = document.getElementById('drawdownDescription');
        if (drawdownDesc && metrics.max_drawdown !== undefined && metrics.max_drawdown !== null && !isNaN(metrics.max_drawdown)) {
            const drawdownPct = Math.abs(metrics.max_drawdown) * 100;
            if (drawdownPct > 30) {
                drawdownDesc.textContent = 'High risk';
            } else if (drawdownPct > 15) {
                drawdownDesc.textContent = 'Moderate risk';
            } else if (drawdownPct > 5) {
                drawdownDesc.textContent = 'Low risk';
            } else {
                drawdownDesc.textContent = 'Very low risk';
            }
        }
    }
    
    if (betaElement) {
        const betaValue = (metrics.beta !== undefined && metrics.beta !== null && !isNaN(metrics.beta)) ? metrics.beta.toFixed(2) : 'N/A';
        console.log('FORCING Beta update to:', betaValue, 'from API value:', metrics.beta);
        betaElement.textContent = betaValue;
        betaElement.style.color = 'red'; // Visual indicator of update
        setTimeout(() => betaElement.style.color = '', 1000);
        
        // Update beta description
        const betaDesc = document.querySelector('#beta').parentElement.querySelector('p');
        if (betaDesc && metrics.beta !== undefined && metrics.beta !== null && !isNaN(metrics.beta)) {
            const betaValue = metrics.beta.toFixed(2);
            if (metrics.beta > 1.2) {
                betaDesc.textContent = `β=${betaValue} - High volatility vs S&P 500`;
                betaDesc.className = 'text-sm text-red-600 mt-1';
            } else if (metrics.beta > 0.8) {
                betaDesc.textContent = `β=${betaValue} - Market-like vs S&P 500`;
                betaDesc.className = 'text-sm text-blue-600 mt-1';
            } else if (metrics.beta > 0.3) {
                betaDesc.textContent = `β=${betaValue} - Low volatility vs S&P 500`;
                betaDesc.className = 'text-sm text-green-600 mt-1';
            } else {
                betaDesc.textContent = `β=${betaValue} - Very defensive vs S&P 500`;
                betaDesc.className = 'text-sm text-gray-600 mt-1';
            }
        }
    }
    
    // Calculate portfolio value from frontend data if not provided by backend
    if (aumElement) {
        let portfolioValue = metrics.portfolio_value;
        
        // If backend doesn't provide portfolio value, calculate from frontend data
        if ((!portfolioValue || portfolioValue <= 0) && window.portfolioData) {
            portfolioValue = window.portfolioData.reduce((sum, item) => {
                const quantity = parseFloat(item.quantity) || 0;
                const price = parseFloat(item.avg_cost || item.price) || 0;
                return sum + (quantity * price);
            }, 0);
            console.log('Calculated portfolio value from frontend data:', portfolioValue);
        }
        
        if (portfolioValue && portfolioValue > 0) {
            if (portfolioValue >= 1000000) {
                aumElement.textContent = `$${(portfolioValue / 1000000).toFixed(1)}M`;
            } else if (portfolioValue >= 1000) {
                aumElement.textContent = `$${(portfolioValue / 1000).toFixed(0)}K`;
            } else {
                aumElement.textContent = `$${portfolioValue.toFixed(2)}`;
            }
            console.log('Setting AUM display to:', aumElement.textContent);
        } else {
            aumElement.textContent = 'N/A';
            console.log('Setting AUM to N/A, no valid portfolio value');
        }
    }
}

function updateRiskResults(metrics) {
    const container = document.getElementById('riskResults');
    if (!container) return;

    if (metrics.error) {
        container.innerHTML = `
            <div class="text-center text-red-500 py-4">
                <div class="font-semibold">Risk Analysis Failed</div>
                <div class="text-sm mt-2">${metrics.error}</div>
            </div>
        `;
        return;
    }

    // Use portfolio value from backend if available, otherwise calculate from frontend data
    let totalValue = metrics.portfolio_value;
    if (!totalValue && window.portfolioData) {
        totalValue = window.portfolioData.reduce((sum, item) => sum + (item.quantity * (item.avg_cost || item.price || 0)), 0);
    }

    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <span class="text-gray-600">Value at Risk (95%)</span>
                <span class="font-semibold">${(metrics.var_95 !== undefined && metrics.var_95 !== null && !isNaN(metrics.var_95)) ? ((Math.abs(metrics.var_95) * 100).toFixed(1) + '%') : 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-600">Expected Shortfall</span>
                <span class="font-semibold">${(metrics.cvar_95 !== undefined && metrics.cvar_95 !== null && !isNaN(metrics.cvar_95)) ? ((Math.abs(metrics.cvar_95) * 100).toFixed(1) + '%') : 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-600">Volatility (Annualized)</span>
                <span class="font-semibold">${(metrics.portfolio_volatility !== undefined && metrics.portfolio_volatility !== null && !isNaN(metrics.portfolio_volatility)) ? ((metrics.portfolio_volatility * 100).toFixed(1)) + '%' : 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-600">Tracking Error</span>
                <span class="font-semibold">${(metrics.tracking_error !== undefined && metrics.tracking_error !== null && !isNaN(metrics.tracking_error)) ? ((metrics.tracking_error * 100).toFixed(1)) + '%' : 'N/A'}</span>
            </div>
        </div>
    `;
}

function updateOptionsResults(opportunities, summary) {
    const container = document.getElementById('optionsResults');
    if (!container) return;

    if (opportunities && opportunities.error) {
        container.innerHTML = `<div class="text-center text-red-500 py-4">Options scan failed: ${opportunities.error}</div>`;
        return;
    }

    if (summary) {
        const ccValue = summary.covered_calls?.total_premium || 0;
        const ppValue = summary.protective_puts?.total_cost || 0;
        const icValue = summary.iron_condors?.total_premium || 0;

        const formatValue = (value) => {
            if (value > 1000) {
                return `$${(value / 1000).toFixed(0)}K`;
            } else if (value > 0) {
                return `$${value.toFixed(0)}`;
            } else {
                return '$0';
            }
        };

        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Covered Calls</span>
                    <span class="font-semibold ${ccValue > 0 ? 'text-green-600' : 'text-gray-500'}">+${formatValue(ccValue)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Protective Puts</span>
                    <span class="font-semibold ${ppValue > 0 ? 'text-red-600' : 'text-gray-500'}">${ppValue > 0 ? '-' : ''}${formatValue(ppValue)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Iron Condors</span>
                    <span class="font-semibold ${icValue > 0 ? 'text-green-600' : 'text-gray-500'}">+${formatValue(icValue)}</span>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Covered Calls</span>
                    <span class="font-semibold text-gray-500">+$0</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Protective Puts</span>
                    <span class="font-semibold text-gray-500">-$0</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Iron Condors</span>
                    <span class="font-semibold text-gray-500">+$0</span>
                </div>
            </div>
        `;
    }
}

// Placeholder functions for enhanced analytics
async function loadEnhancedPerformanceAttribution(data) {
    const container = document.getElementById('performanceAttribution');
    if (!container) {
        console.error('Performance attribution container not found!');
        return;
    }

    console.log('Starting performance attribution analysis with fresh data:', data);
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Analyzing performance...</div>';

    try {
        // Use fresh data passed to function, not cached window.portfolioData
        const actualData = data || window.portfolioData;
        
        if (!actualData || actualData.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No portfolio data available</div>';
            return;
        }
        
        const portfolioData = actualData.filter(item => 
            item && item.symbol && !isNaN(parseFloat(item.quantity)) && !isNaN(parseFloat(item.avg_cost || item.price))
        );
        
        console.log('Performance Attribution - Sending portfolio data:', portfolioData);
        const response = await fetch(`${API_BASE}/performance-attribution`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData })
        });
        
        console.log('Performance Attribution API response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Performance Attribution API error:', errorText);
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Performance Attribution API full response:', result);
        
        if (result.success && result.results) {
            const perf = result.results;
            console.log('Performance Attribution values received:', perf);
            console.log('Asset Allocation:', perf.asset_allocation, 'Security Selection:', perf.security_selection);
            console.log('Currency Effect:', perf.currency_effect, 'Market Timing:', perf.market_timing);
            
            // AGGRESSIVE DEBUGGING - Check each value
            console.log('DEBUGGING PERFORMANCE ATTRIBUTION:');
            console.log('perf object:', JSON.stringify(perf, null, 2));
            console.log('asset_allocation type:', typeof perf.asset_allocation, 'value:', perf.asset_allocation);
            console.log('security_selection type:', typeof perf.security_selection, 'value:', perf.security_selection);
            console.log('currency_effect type:', typeof perf.currency_effect, 'value:', perf.currency_effect);
            console.log('market_timing type:', typeof perf.market_timing, 'value:', perf.market_timing);
            
            // Test each value individually
            const assetAllocationDisplay = typeof perf.asset_allocation === 'number' ? ((perf.asset_allocation >= 0 ? '+' : '') + perf.asset_allocation.toFixed(1) + '%') : 'N/A';
            const securitySelectionDisplay = typeof perf.security_selection === 'number' ? ((perf.security_selection >= 0 ? '+' : '') + perf.security_selection.toFixed(1) + '%') : 'N/A';
            const currencyEffectDisplay = typeof perf.currency_effect === 'number' ? ((perf.currency_effect >= 0 ? '+' : '') + perf.currency_effect.toFixed(1) + '%') : 'N/A';
            const marketTimingDisplay = typeof perf.market_timing === 'number' ? ((perf.market_timing >= 0 ? '+' : '') + perf.market_timing.toFixed(2) + '%') : 'N/A';
            
            console.log('DISPLAY VALUES:');
            console.log('Asset Allocation Display:', assetAllocationDisplay);
            console.log('Security Selection Display:', securitySelectionDisplay);
            console.log('Currency Effect Display:', currencyEffectDisplay);
            console.log('Market Timing Display:', marketTimingDisplay);
            
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Asset Allocation</span>
                        <span class="font-semibold ${(perf.asset_allocation || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${assetAllocationDisplay}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Security Selection</span>
                        <span class="font-semibold ${(perf.security_selection || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${securitySelectionDisplay}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Currency Effect</span>
                        <span class="font-semibold ${(perf.currency_effect || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${currencyEffectDisplay}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Market Timing</span>
                        <span class="font-semibold ${(perf.market_timing || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${marketTimingDisplay}</span>
                    </div>
                </div>
            `;
            
            console.log('Performance Attribution HTML updated with values:', {assetAllocationDisplay, securitySelectionDisplay, currencyEffectDisplay, marketTimingDisplay});
        } else {
            throw new Error(result.error || 'Performance attribution failed');
        }
    } catch (error) {
        console.error('Performance attribution error:', error);
        container.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Asset Allocation</span>
                    <span class="font-semibold text-gray-500">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Security Selection</span>
                    <span class="font-semibold text-gray-500">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Currency Effect</span>
                    <span class="font-semibold text-gray-500">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Market Timing</span>
                    <span class="font-semibold text-gray-500">N/A</span>
                </div>
            </div>
        `;
    }
}





async function loadStatisticalAnalysis(data) {
    const container = document.getElementById('statisticalAnalysis');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div><div>Computing statistics...</div></div>';

    try {
        const actualData = window.portfolioData || data;
        
        if (!actualData || actualData.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No portfolio data available</div>';
            return;
        }
        
        const portfolioData = actualData.filter(item => 
            item && item.symbol && !isNaN(parseFloat(item.quantity)) && !isNaN(parseFloat(item.avg_cost || item.price))
        );
        
        const response = await fetch(`${API_BASE}/statistical-analysis?nocache=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ portfolio: portfolioData })
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.results) {
            const stats = result.results;
            
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Avg Correlation</span>
                        <span class="font-semibold">${stats.avg_correlation !== null && stats.avg_correlation !== undefined ? stats.avg_correlation.toFixed(2) : 'N/A'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Diversification Ratio</span>
                        <span class="font-semibold">${stats.diversification_ratio !== null && stats.diversification_ratio !== undefined ? stats.diversification_ratio.toFixed(2) : 'N/A'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Portfolio Concentration</span>
                        <span class="font-semibold">${stats.concentration_level || 'N/A'}</span>
                    </div>
                </div>
            `;
        } else {
            throw new Error(result.error || 'Statistical analysis failed');
        }
    } catch (error) {
        console.error('Statistical analysis error:', error);
        container.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Avg Correlation</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Diversification Ratio</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Portfolio Concentration</span>
                    <span class="font-semibold">N/A</span>
                </div>
            </div>
        `;
    }
}

async function loadEnhancedSectorAnalysis(data) {
    const container = document.getElementById('sectorAllocation');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Analyzing sectors...</div>';

    setTimeout(async () => {
        const actualData = window.portfolioData || data;
        
        if (!actualData || actualData.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No portfolio data available</div>';
            return;
        }
        
        // Validate data structure
        const validData = actualData.filter(item => 
            item && 
            item.symbol && 
            typeof item.symbol === 'string' &&
            !isNaN(parseFloat(item.quantity)) &&
            !isNaN(parseFloat(item.avg_cost || item.price))
        );
        
        if (validData.length === 0) {
            console.error('Sector Analysis - No valid portfolio positions found');
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No valid portfolio positions for sector analysis</div>';
            return;
        }
        
        console.log(`Sector Analysis - Processing ${validData.length} valid positions out of ${actualData.length} total`);
        console.log('Sector Analysis - Using portfolio data:', validData);
        
        const totalValue = validData.reduce((sum, item) => {
            const value = item.quantity * (item.avg_cost || item.price || 0);
            console.log(`${item.symbol}: ${item.quantity} * ${item.avg_cost || item.price || 0} = ${value}`);
            return sum + value;
        }, 0);
        
        console.log('Total portfolio value:', totalValue);
        
        // Call backend API to get real sector data from Yahoo Finance
        try {
            const symbols = validData.map(item => item.symbol).filter(s => s);
            const response = await fetch(`${API_BASE}/sector-data?nocache=${Date.now()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
                body: JSON.stringify({ symbols })
            });
            
            let sectorData = {};
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    sectorData = result.sector_data;
                }
            }
            
            // Function to get sector for a symbol
            const getSector = (symbol) => {
                const sector = sectorData[symbol];
                console.log(`Sector lookup for ${symbol}: ${sector}`);
                return sector || 'Other/Unclassified';
            };
        
        let sectorWeights = { tech: 0, healthcare: 0, financial: 0, consumer: 0, energy: 0, industrial: 0, materials: 0, utilities: 0, realestate: 0, communication: 0, other: 0 };
        
        validData.forEach(item => {
            const value = item.quantity * (item.avg_cost || item.price || 0);
            const weight = totalValue > 0 ? value / totalValue : 0;
            let symbol = item.symbol;
            
            // Clean and normalize symbol
            if (symbol) {
                symbol = symbol.toString().trim().toUpperCase();
                // Remove common prefixes/suffixes
                symbol = symbol.replace(/\.(US|USD|NASDAQ|NYSE)$/i, '');
                symbol = symbol.replace(/^(NASDAQ:|NYSE:)/i, '');
            }
            
            console.log(`Processing ${item.symbol} -> ${symbol}: value=${value}, weight=${weight.toFixed(4)}`);
            
            const sector = getSector(symbol);
            console.log(`${symbol} -> ${sector} sector`);
            
            // Debug: log all portfolio symbols
            if (!window.portfolioSymbolsLogged) {
                console.log('All portfolio symbols:', validData.map(d => d.symbol));
                window.portfolioSymbolsLogged = true;
            }
            
            console.log(`Mapping ${symbol} with sector '${sector}' and weight ${weight.toFixed(4)}`);
            
            switch(sector) {
                case 'Technology':
                    sectorWeights.tech += weight;
                    break;
                case 'Communication Services':
                    sectorWeights.communication += weight;
                    break;
                case 'Consumer Discretionary':
                    sectorWeights.consumer += weight;
                    break;
                case 'Health Care':
                    sectorWeights.healthcare += weight;
                    break;
                case 'Financials':
                    sectorWeights.financial += weight;
                    break;
                case 'Industrials':
                    sectorWeights.industrial += weight;
                    break;
                case 'Commodities':
                    sectorWeights.materials += weight;
                    break;
                case 'Multi-Sector ETF':
                    sectorWeights.other += weight;
                    break;
                case 'Energy':
                    sectorWeights.energy += weight;
                    break;
                case 'Materials':
                    sectorWeights.materials += weight;
                    break;
                case 'Utilities':
                    sectorWeights.utilities += weight;
                    break;
                case 'Real Estate':
                    sectorWeights.realestate += weight;
                    break;
                default:
                    console.log(`Unknown sector '${sector}' for ${symbol}, mapping to Other`);
                    sectorWeights.other += weight;
            }
        });
        
        console.log('Final sector weights:', sectorWeights);
        console.log('Portfolio symbols being analyzed:', validData.map(item => item.symbol));
        
        const techPercent = (sectorWeights.tech * 100).toFixed(0);
        const healthPercent = (sectorWeights.healthcare * 100).toFixed(0);
        const finPercent = (sectorWeights.financial * 100).toFixed(0);
        const consumerPercent = (sectorWeights.consumer * 100).toFixed(0);
        const otherPercent = (sectorWeights.other * 100).toFixed(0);
        
        console.log(`Sector percentages: Tech=${techPercent}%, Health=${healthPercent}%, Financial=${finPercent}%, Consumer=${consumerPercent}%, Other=${otherPercent}%`);
        
        // Create array of all sectors with their percentages, only include those > 0
        const sectorResults = [
            { name: 'Technology', percent: parseFloat(techPercent) },
            { name: 'Healthcare', percent: parseFloat(healthPercent) },
            { name: 'Financial', percent: parseFloat(finPercent) },
            { name: 'Consumer', percent: parseFloat(consumerPercent) },
            { name: 'Energy', percent: parseFloat(((sectorWeights.energy || 0) * 100).toFixed(0)) },
            { name: 'Industrial', percent: parseFloat(((sectorWeights.industrial || 0) * 100).toFixed(0)) },
            { name: 'Materials', percent: parseFloat(((sectorWeights.materials || 0) * 100).toFixed(0)) },
            { name: 'Utilities', percent: parseFloat(((sectorWeights.utilities || 0) * 100).toFixed(0)) },
            { name: 'Real Estate', percent: parseFloat(((sectorWeights.realestate || 0) * 100).toFixed(0)) },
            { name: 'Communication', percent: parseFloat(((sectorWeights.communication || 0) * 100).toFixed(0)) },
            { name: 'Other/Unclassified', percent: parseFloat(otherPercent) }
        ].filter(sector => sector.percent > 0)
         .sort((a, b) => b.percent - a.percent); // Sort by percentage descending
        
        console.log('All sector results:', sectorResults);
        
        if (sectorResults.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No sector data available</div>';
        } else {
            // Show ALL sectors, not just top 3
            const sectorColors = {
                'Technology': '#3b82f6',
                'Healthcare': '#10b981', 
                'Financial': '#f59e0b',
                'Energy': '#ef4444',
                'Communication': '#8b5cf6',
                'Consumer': '#06b6d4',
                'Industrial': '#84cc16',
                'Materials': '#f97316',
                'Utilities': '#6b7280',
                'Real Estate': '#ec4899',
                'Other/Unclassified': '#6b7280'
            };
            
            const sectorHTML = sectorResults.map(sector => {
                const color = sectorColors[sector.name] || '#6b7280';
                return `
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <div class="w-3 h-3 rounded-full mr-3" style="background-color: ${color}"></div>
                            <span class="text-gray-600">${sector.name}</span>
                        </div>
                        <div class="flex items-center">
                            <div class="w-20 h-2 bg-gray-200 rounded-full mr-3">
                                <div class="h-2 rounded-full" style="background-color: ${color}; width: ${sector.percent}%"></div>
                            </div>
                            <span class="font-semibold text-sm">${sector.percent.toFixed(0)}%</span>
                        </div>
                    </div>
                `;
            }).join('');
            
            container.innerHTML = `<div class="space-y-3">${sectorHTML}</div>`;
            console.log('Displaying sectors:', sectorResults.map(s => `${s.name}: ${s.percent}%`));
        }
        } catch (apiError) {
            console.error('Sector API error:', apiError);
            console.log('Portfolio symbols when API failed:', validData.map(d => d.symbol));
            
            // Fallback to basic classification if API fails
            validData.forEach(item => {
                const value = item.quantity * (item.avg_cost || item.price || 0);
                const weight = totalValue > 0 ? value / totalValue : 0;
                sectorWeights.other += weight;
            });
            
            const otherPercent = (sectorWeights.other * 100).toFixed(0);
            const fallbackSectorData = [{ name: 'Other/Unclassified', percent: parseFloat(otherPercent) }].filter(sector => sector.percent > 0);
            
            if (fallbackSectorData.length === 0) {
                container.innerHTML = '<div class="text-center text-gray-500 py-4">No sector data available</div>';
            } else {
                const sectorHTML = fallbackSectorData.map(sector => `
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">${sector.name}</span>
                        <span class="font-semibold">${sector.percent.toFixed(0)}%</span>
                    </div>
                `).join('');
                container.innerHTML = `<div class="space-y-3">${sectorHTML}</div>`;
            }
        }
    }, 1000);
}



async function loadBacktestingResults(data) {
    const container = document.getElementById('backtestingResults');
    if (!container) {
        console.error('Backtesting container not found!');
        return;
    }

    console.log('Starting backtesting analysis with data:', data);
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div><div>Running backtests...</div></div>';

    try {
        const actualData = window.portfolioData || data;
        console.log('Backtesting - actualData:', actualData);
        
        if (!actualData || actualData.length === 0) {
            console.log('Backtesting - No data available');
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No portfolio data available</div>';
            return;
        }
        
        const portfolioData = actualData.filter(item => {
            const isValid = item && item.symbol && 
                           !isNaN(parseFloat(item.quantity)) && 
                           !isNaN(parseFloat(item.avg_cost || item.price)) &&
                           !item.symbol.startsWith('CUR:') && 
                           !item.symbol.startsWith('CASH');
            console.log(`Backtesting filter - ${item?.symbol}: ${isValid}`);
            return isValid;
        });
        
        console.log('Backtesting - filtered portfolioData:', portfolioData);
        
        if (portfolioData.length === 0) {
            console.log('Backtesting - No valid portfolio data after filtering');
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No valid portfolio data for backtesting</div>';
            return;
        }
        
        console.log('Sending backtesting request with portfolio data:', portfolioData);
        const response = await fetch(`${API_BASE}/backtest-portfolio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData })
        });
        
        console.log('Backtesting API response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backtesting API error:', errorText);
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Backtesting API full response:', result);
        
        if (result.success && result.backtest_results) {
            const metrics = result.backtest_results;
            console.log('Backtesting metrics received:', metrics);
            console.log('Annual return value:', metrics.annual_return, 'Type:', typeof metrics.annual_return);
            console.log('Max drawdown value:', metrics.max_drawdown, 'Type:', typeof metrics.max_drawdown);
            console.log('Sortino ratio value:', metrics.sortino_ratio, 'Type:', typeof metrics.sortino_ratio);
            
            // Format values with better validation
            const formatReturn = (value) => {
                if (value === null || value === undefined || isNaN(value)) return 'N/A';
                const pct = (value * 100).toFixed(1);
                return value >= 0 ? `+${pct}%` : `${pct}%`;
            };
            
            const formatDrawdown = (value) => {
                if (value === null || value === undefined || isNaN(value)) return 'N/A';
                return `${(Math.abs(value) * 100).toFixed(1)}%`;
            };
            
            const formatRatio = (value) => {
                console.log('Formatting Backtesting Sortino ratio:', value, 'Type:', typeof value);
                if (value === null || value === undefined || isNaN(value)) return 'N/A';
                return value.toFixed(2);
            };
            
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">1Y Return</span>
                        <span class="font-semibold ${(metrics.annual_return || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatReturn(metrics.annual_return)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Max Drawdown</span>
                        <span class="font-semibold text-red-600">${formatDrawdown(metrics.max_drawdown)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Sortino Ratio</span>
                        <span class="font-semibold ${(metrics.sortino_ratio || 0) >= 0 ? 'text-green-600' : 'text-red-600'}">${formatRatio(metrics.sortino_ratio)}</span>
                    </div>
                </div>
            `;
            console.log('Backtesting display updated successfully');
        } else {
            console.error('Backtesting API error:', result);
            throw new Error(result.error || 'Backtesting failed');
        }
    } catch (error) {
        console.error('Backtesting error:', error);
        container.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">1Y Return</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Max Drawdown</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Sortino Ratio</span>
                    <span class="font-semibold">N/A</span>
                </div>
            </div>
        `;
    }
}

async function loadCorrelationAnalysis(data) {
    const container = document.getElementById('correlationMatrix');
    if (!container || !data) return;
    
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Computing correlations...</div>';
    
    setTimeout(async () => {
        const actualData = window.portfolioData || data;
        
        if (!actualData || actualData.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No portfolio data available</div>';
            return;
        }
        
        const validData = actualData.filter(item => 
            item && item.symbol && !isNaN(parseFloat(item.quantity)) && !isNaN(parseFloat(item.avg_cost || item.price))
        );
        
        if (validData.length < 2) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">Need at least 2 stocks for correlation analysis</div>';
            return;
        }
        
        try {
            const symbols = validData.map(item => item.symbol)
                .filter(s => s && !s.startsWith('CUR:') && !s.startsWith('CASH') && s.length <= 10)
                .slice(0, 6);
            
            if (symbols.length < 2) {
                container.innerHTML = '<div class="text-center text-gray-500 py-4">Need at least 2 valid stocks for correlation</div>';
                return;
            }
            
            const response = await fetch(`${API_BASE}/correlation-data?nocache=${Date.now()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
                body: JSON.stringify({ symbols })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    createD3CorrelationMatrix(symbols, result.correlation_matrix, result.average_correlation, container);
                } else {
                    throw new Error(result.error || 'Correlation calculation failed');
                }
            } else {
                throw new Error('API request failed');
            }
        } catch (error) {
            console.error('Correlation analysis error:', error);
            container.innerHTML = '<div class="text-center text-gray-500 py-4">Correlation analysis requires market data API integration</div>';
        }
    }, 1600);
}

function createD3CorrelationMatrix(symbols, correlations, avgCorr, container) {
    // Clear container
    container.innerHTML = '';
    
    // Set dimensions
    const margin = {top: 30, right: 30, bottom: 30, left: 30};
    const cellSize = Math.min(300 / symbols.length, 60);
    const width = cellSize * symbols.length;
    const height = cellSize * symbols.length;
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Prepare data
    const matrixData = [];
    symbols.forEach(symbol1 => {
        symbols.forEach(symbol2 => {
            const value = correlations[symbol1] && correlations[symbol1][symbol2] ? correlations[symbol1][symbol2] : 0;
            matrixData.push({x: symbol1, y: symbol2, value: value});
        });
    });
    
    // Scales
    const x = d3.scaleBand().range([0, width]).domain(symbols).padding(0.05);
    const y = d3.scaleBand().range([height, 0]).domain(symbols).padding(0.05);
    const color = d3.scaleLinear().domain([-1, 0, 1]).range(['#2563eb', '#f3f4f6', '#dc2626']);
    
    // Create tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'correlation-tooltip')
        .style('position', 'absolute')
        .style('background', '#1f2937')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '6px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 1000);
    
    // Create cells
    svg.selectAll('.cell')
        .data(matrixData)
        .enter().append('rect')
        .attr('class', 'cell')
        .attr('x', d => x(d.x))
        .attr('y', d => y(d.y))
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .style('fill', d => color(d.value))
        .style('stroke', '#fff')
        .style('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).style('stroke-width', 4).style('stroke', '#374151');
            tooltip.transition().duration(200).style('opacity', .9);
            tooltip.html(`${d.x} vs ${d.y}<br/>Correlation: ${d.value.toFixed(3)}`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function(d) {
            d3.select(this).style('stroke-width', 2).style('stroke', '#fff');
            tooltip.transition().duration(500).style('opacity', 0);
        });
    
    // Add text labels
    svg.selectAll('.label')
        .data(matrixData)
        .enter().append('text')
        .attr('class', 'label')
        .attr('x', d => x(d.x) + x.bandwidth() / 2)
        .attr('y', d => y(d.y) + y.bandwidth() / 2)
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'middle')
        .style('font-size', `${Math.min(cellSize / 4, 12)}px`)
        .style('font-weight', 'bold')
        .style('fill', d => Math.abs(d.value) > 0.5 ? 'white' : 'black')
        .style('pointer-events', 'none')
        .text(d => d.x === d.y ? d.x : d.value.toFixed(2));
    
    // Add average correlation below
    d3.select(container)
        .append('div')
        .style('text-align', 'center')
        .style('margin-top', '15px')
        .html(`
            <div style="display: inline-flex; align-items: center; padding: 8px 16px; background: ${color(avgCorr)}; color: ${Math.abs(avgCorr) > 0.5 ? 'white' : 'black'}; border-radius: 8px; font-weight: bold;">
                Portfolio Average: ${avgCorr.toFixed(3)}
            </div>
        `);
}

async function loadPortfolioOptimization(data) {
    const container = document.getElementById('portfolioOptimization');
    if (!container || !data) {
        console.error('Portfolio optimization container not found or no data provided');
        return;
    }
    
    console.log('Starting portfolio optimization...');
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div><div>Optimizing portfolio...</div></div>';
    
    try {
        const actualData = window.portfolioData || data;
        
        if (!actualData || actualData.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No portfolio data available</div>';
            return;
        }
        
        const portfolioData = actualData.filter(item => 
            item && item.symbol && !isNaN(parseFloat(item.quantity)) && !isNaN(parseFloat(item.avg_cost || item.price))
        );
        
        console.log('Sending portfolio optimization request with data:', portfolioData);
        const response = await fetch(`${API_BASE}/portfolio-optimization`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData })
        });
        
        console.log('Portfolio optimization API response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Portfolio optimization API error:', errorText);
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Portfolio optimization API response:', result);
        
        if (result.success && result.optimization) {
            const opt = result.optimization;
            
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Min Volatility Return</span>
                        <span class="font-semibold text-blue-600">${opt.minimum_volatility?.expected_return ? (opt.minimum_volatility.expected_return * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Min Volatility Risk</span>
                        <span class="font-semibold">${opt.minimum_volatility?.volatility ? (opt.minimum_volatility.volatility * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Max Sharpe Return</span>
                        <span class="font-semibold text-green-600">${opt.maximum_sharpe?.expected_return ? (opt.maximum_sharpe.expected_return * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Max Sharpe Ratio</span>
                        <span class="font-semibold">${opt.maximum_sharpe?.sharpe_ratio ? opt.maximum_sharpe.sharpe_ratio.toFixed(2) : 'N/A'}</span>
                    </div>
                </div>
            `;
        } else {
            throw new Error(result.error || 'Portfolio optimization failed');
        }
    } catch (error) {
        console.error('Portfolio optimization error:', error);
        container.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Min Volatility Return</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Min Volatility Risk</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Max Sharpe Return</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Max Sharpe Ratio</span>
                    <span class="font-semibold">N/A</span>
                </div>
            </div>
        `;
    }
}

async function loadEnhancedTechnicalAnalysis(data) {
    const container = document.getElementById('enhancedTechnicalAnalysis');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div><div>Analyzing technical indicators...</div></div>';

    try {
        const actualData = window.portfolioData || data;
        
        if (!actualData || actualData.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">No portfolio data available</div>';
            return;
        }
        
        const portfolioData = actualData.filter(item => 
            item && item.symbol && !isNaN(parseFloat(item.quantity)) && !isNaN(parseFloat(item.avg_cost || item.price))
        );
        
        const response = await fetch(`${API_BASE}/technical-analysis?nocache=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ portfolio: portfolioData })
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.technical_metrics) {
            const metrics = result.technical_metrics;
            
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">RSI (14-day)</span>
                        <span class="font-semibold ${metrics.rsi_14 > 70 ? 'text-red-600' : metrics.rsi_14 < 30 ? 'text-green-600' : 'text-gray-600'}">${metrics.rsi_14 || 'N/A'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">MACD Signal</span>
                        <span class="font-semibold ${metrics.macd_signal === 'Bullish' ? 'text-green-600' : metrics.macd_signal === 'Bearish' ? 'text-red-600' : 'text-gray-600'}">${metrics.macd_signal || 'N/A'}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Bollinger Position</span>
                        <span class="font-semibold ${metrics.bollinger_position === 'Above Upper' ? 'text-red-600' : metrics.bollinger_position === 'Below Lower' ? 'text-green-600' : 'text-gray-600'}">${metrics.bollinger_position || 'N/A'}</span>
                    </div>
                </div>
            `;
        } else {
            throw new Error(result.error || 'Technical analysis failed');
        }
    } catch (error) {
        console.error('Technical analysis error:', error);
        container.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">RSI (14-day)</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">MACD Signal</span>
                    <span class="font-semibold">N/A</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Bollinger Position</span>
                    <span class="font-semibold">N/A</span>
                </div>
            </div>
        `;
    }
}

// Export functions
window.loadAllRealAnalytics = loadAllRealAnalytics;
window.createMonteCarloResults = createMonteCarloResults;
window.createOptimizationChart = createOptimizationChart;
window.updateTopMetrics = updateTopMetrics;
window.updateRiskResults = updateRiskResults;
window.updateOptionsResults = updateOptionsResults;
window.createD3CorrelationMatrix = createD3CorrelationMatrix;

// Clear cached display data
function clearCachedDisplayData() {
    // Clear localStorage cache
    localStorage.removeItem('cachedRiskMetrics');
    localStorage.removeItem('cachedPortfolioData');
    
    // Reset display elements to loading state
    const elements = ['sharpeRatio', 'beta', 'maxDrawdown', 'totalAUM'];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'Loading...';
    });
}

window.clearCachedDisplayData = clearCachedDisplayData;