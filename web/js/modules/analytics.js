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
            portfolioData = Object.values(data);
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

    try {
        // Load all analytics
        await Promise.allSettled([
            loadRiskAnalytics(portfolioData, options),
            loadOptionsAnalytics(portfolioData, options),
            loadPerformanceAttribution(portfolioData, options),
            loadMonteCarloAnalysis(portfolioData, options),
            loadCorrelationAnalysis(portfolioData, options),
            loadTechnicalAnalysis(portfolioData, options),
            loadStatisticalAnalysis(portfolioData, options),
            loadSectorAnalysis(portfolioData, options),
            loadPortfolioOptimization(portfolioData, options)
        ]);

        console.log('Analytics loading completed');

    } catch (error) {
        console.error('Analytics loading failed:', error);
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
    console.log('Loading risk analytics for', portfolioData.length, 'positions with options:', options);

    const url = `${API_BASE}/analyze-risk?nocache=${Date.now()}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ 
                portfolio: portfolioData, 
                user_role: user.role,
                options: options
            })
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
            updateRiskResults(freshMetrics, options);
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

    console.log('Loading options analytics for symbols:', symbols, 'with options:', options);

    const url = `${API_BASE}/scan-options?nocache=${Date.now()}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ 
                symbols,
                options: options
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Options scan server error:', errorText);
            updateOptionsResults({ error: `Server error: HTTP ${response.status}` });
            return;
        }

        const optionsData = await response.json();

        if (optionsData.success) {
            updateOptionsResults(optionsData.opportunities, optionsData.summary, options);
        } else {
            console.error('Options scan failed:', optionsData.error);
            updateOptionsResults({ error: optionsData.error || 'Options scan failed' });
        }
    } catch (error) {
        console.error('Options analytics error:', error);
        updateOptionsResults({ error: error.message });
    }
}

async function loadMonteCarloAnalysis(portfolioData, options = {}) {
    const container = document.getElementById('monteCarloResults');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>Running Monte Carlo simulation...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/monte-carlo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData, options })
        });
        
        const data = await response.json();
        if (data.success) {
            displayMonteCarloResults(data.results);
        } else {
            container.innerHTML = `<div class="text-red-500">Monte Carlo simulation failed: ${data.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="text-red-500">Error: ${error.message}</div>`;
    }
}

function displayMonteCarloResults(results) {
    const container = document.getElementById('monteCarloResults');
    if (!container || !results) return;
    
    container.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div class="text-center">
                <div class="text-2xl font-bold text-green-600">${(results.expected_return * 100).toFixed(1)}%</div>
                <div class="text-sm text-gray-600">Expected Return</div>
            </div>
            <div class="text-center">
                <div class="text-2xl font-bold text-blue-600">${(results.volatility * 100).toFixed(1)}%</div>
                <div class="text-sm text-gray-600">Volatility</div>
            </div>
        </div>
        <div class="mt-4 space-y-2">
            ${Object.entries(results.percentiles || {}).map(([key, value]) => 
                `<div class="flex justify-between">
                    <span>${key} Confidence:</span>
                    <span class="font-semibold">${(value * 100).toFixed(1)}%</span>
                </div>`
            ).join('')}
        </div>
    `;
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

function updateRiskResults(metrics, options = {}) {
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

    // Add interactive controls
    const controlsHtml = `
        <div class="mb-4 p-3 bg-gray-50 rounded-lg border">
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="text-xs font-medium text-gray-700 block mb-1">Time Period</label>
                    <select id="riskPeriod" onchange="updateRiskAnalysis()" class="w-full text-xs p-1 border rounded">
                        <option value="1M" ${options.period === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${options.period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${options.period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${options.period === '1Y' || !options.period ? 'selected' : ''}>1 Year</option>
                        <option value="2Y" ${options.period === '2Y' ? 'selected' : ''}>2 Years</option>
                        <option value="3Y" ${options.period === '3Y' ? 'selected' : ''}>3 Years</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-700 block mb-1">VaR Confidence</label>
                    <select id="riskConfidence" onchange="updateRiskAnalysis()" class="w-full text-xs p-1 border rounded">
                        <option value="90" ${options.confidence === '90' ? 'selected' : ''}>90%</option>
                        <option value="95" ${options.confidence === '95' || !options.confidence ? 'selected' : ''}>95%</option>
                        <option value="99" ${options.confidence === '99' ? 'selected' : ''}>99%</option>
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs font-medium text-gray-700 block mb-1">Risk Model</label>
                    <select id="riskModel" onchange="updateRiskAnalysis()" class="w-full text-xs p-1 border rounded">
                        <option value="Historical" ${options.model === 'Historical' || !options.model ? 'selected' : ''}>Historical</option>
                        <option value="MonteCarlo" ${options.model === 'MonteCarlo' ? 'selected' : ''}>Monte Carlo</option>
                        <option value="Parametric" ${options.model === 'Parametric' ? 'selected' : ''}>Parametric</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-700 block mb-1">Benchmark</label>
                    <select id="riskBenchmark" onchange="updateRiskAnalysis()" class="w-full text-xs p-1 border rounded">
                        <option value="SPY" ${options.benchmark === 'SPY' || !options.benchmark ? 'selected' : ''}>S&P 500</option>
                        <option value="QQQ" ${options.benchmark === 'QQQ' ? 'selected' : ''}>NASDAQ</option>
                        <option value="IWM" ${options.benchmark === 'IWM' ? 'selected' : ''}>Russell 2000</option>
                        <option value="Custom" ${options.benchmark === 'Custom' ? 'selected' : ''}>Custom</option>
                    </select>
                </div>
            </div>
            <div class="mt-3">
                <label class="text-xs font-medium text-gray-700 block mb-1">Rolling Window</label>
                <select id="riskWindow" onchange="updateRiskAnalysis()" class="w-full text-xs p-1 border rounded">
                    <option value="30" ${options.window === '30' ? 'selected' : ''}>30 days</option>
                    <option value="60" ${options.window === '60' ? 'selected' : ''}>60 days</option>
                    <option value="90" ${options.window === '90' || !options.window ? 'selected' : ''}>90 days</option>
                    <option value="252" ${options.window === '252' ? 'selected' : ''}>252 days</option>
                </select>
            </div>
        </div>
    `;

    // Use portfolio value from backend if available, otherwise calculate from frontend data
    let totalValue = metrics.portfolio_value;
    if (!totalValue && window.portfolioData) {
        totalValue = window.portfolioData.reduce((sum, item) => sum + (item.quantity * (item.avg_cost || item.price || 0)), 0);
    }

    const resultsHtml = `
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <span class="text-gray-600">Value at Risk (${options.confidence || '95'}%)</span>
                <span class="font-semibold">${(metrics.var_95 !== undefined && metrics.var_95 !== null && !isNaN(metrics.var_95)) ? ((Math.abs(metrics.var_95) * 100).toFixed(1) + '%') : 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-600">Expected Shortfall</span>
                <span class="font-semibold">${(metrics.cvar_95 !== undefined && metrics.cvar_95 !== null && !isNaN(metrics.cvar_95)) ? ((Math.abs(metrics.cvar_95) * 100).toFixed(1) + '%') : 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-600">Volatility (${options.period || '1Y'})</span>
                <span class="font-semibold">${(metrics.portfolio_volatility !== undefined && metrics.portfolio_volatility !== null && !isNaN(metrics.portfolio_volatility)) ? ((metrics.portfolio_volatility * 100).toFixed(1)) + '%' : 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-600">Tracking Error vs ${options.benchmark || 'S&P 500'}</span>
                <span class="font-semibold">${(metrics.tracking_error !== undefined && metrics.tracking_error !== null && !isNaN(metrics.tracking_error)) ? ((metrics.tracking_error * 100).toFixed(1)) + '%' : 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-600">Model: ${options.model || 'Historical'}</span>
                <span class="font-semibold text-blue-600">${options.window || '90'}d window</span>
            </div>
        </div>
    `;

    container.innerHTML = controlsHtml + resultsHtml;
}

function updateOptionsResults(opportunities, summary, options = {}) {
    const container = document.getElementById('optionsResults');
    if (!container) return;

    if (opportunities && opportunities.error) {
        container.innerHTML = `<div class="text-center text-red-500 py-4">Options scan failed: ${opportunities.error}</div>`;
        return;
    }

    // Add interactive controls
    const controlsHtml = `
        <div class="mb-4 p-3 bg-gray-50 rounded-lg border">
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="text-xs font-medium text-gray-700 block mb-1">Expiration</label>
                    <select id="optionsExpiration" onchange="updateOptionsAnalysis()" class="w-full text-xs p-1 border rounded">
                        <option value="1M" ${options.expiration === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="2M" ${options.expiration === '2M' ? 'selected' : ''}>2 Months</option>
                        <option value="3M" ${options.expiration === '3M' || !options.expiration ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${options.expiration === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${options.expiration === '1Y' ? 'selected' : ''}>1 Year</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-700 block mb-1">Moneyness</label>
                    <select id="optionsMoneyness" onchange="updateOptionsAnalysis()" class="w-full text-xs p-1 border rounded">
                        <option value="All" ${options.moneyness === 'All' || !options.moneyness ? 'selected' : ''}>All</option>
                        <option value="ITM" ${options.moneyness === 'ITM' ? 'selected' : ''}>In-the-Money</option>
                        <option value="ATM" ${options.moneyness === 'ATM' ? 'selected' : ''}>At-the-Money</option>
                        <option value="OTM" ${options.moneyness === 'OTM' ? 'selected' : ''}>Out-of-Money</option>
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="text-xs font-medium text-gray-700 block mb-1">Strategy Filter</label>
                    <select id="optionsStrategy" onchange="updateOptionsAnalysis()" class="w-full text-xs p-1 border rounded">
                        <option value="All" ${options.strategy === 'All' || !options.strategy ? 'selected' : ''}>All Strategies</option>
                        <option value="CoveredCalls" ${options.strategy === 'CoveredCalls' ? 'selected' : ''}>Covered Calls</option>
                        <option value="ProtectivePuts" ${options.strategy === 'ProtectivePuts' ? 'selected' : ''}>Protective Puts</option>
                        <option value="Spreads" ${options.strategy === 'Spreads' ? 'selected' : ''}>Spreads</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-700 block mb-1">Min Premium</label>
                    <select id="optionsMinPremium" onchange="updateOptionsAnalysis()" class="w-full text-xs p-1 border rounded">
                        <option value="0.50" ${options.minPremium === '0.50' || !options.minPremium ? 'selected' : ''}>$0.50</option>
                        <option value="1.00" ${options.minPremium === '1.00' ? 'selected' : ''}>$1.00</option>
                        <option value="2.00" ${options.minPremium === '2.00' ? 'selected' : ''}>$2.00</option>
                        <option value="5.00" ${options.minPremium === '5.00' ? 'selected' : ''}>$5.00</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="text-xs font-medium text-gray-700 block mb-1">Delta Range</label>
                <select id="optionsDelta" onchange="updateOptionsAnalysis()" class="w-full text-xs p-1 border rounded">
                    <option value="All" ${options.delta === 'All' || !options.delta ? 'selected' : ''}>All Deltas</option>
                    <option value="0.1-0.3" ${options.delta === '0.1-0.3' ? 'selected' : ''}>0.1 - 0.3 (Low)</option>
                    <option value="0.3-0.7" ${options.delta === '0.3-0.7' ? 'selected' : ''}>0.3 - 0.7 (Medium)</option>
                    <option value="0.7-1.0" ${options.delta === '0.7-1.0' ? 'selected' : ''}>0.7 - 1.0 (High)</option>
                </select>
            </div>
        </div>
    `;

    const formatValue = (value) => {
        if (value > 1000) {
            return `$${(value / 1000).toFixed(0)}K`;
        } else if (value > 0) {
            return `$${value.toFixed(0)}`;
        } else {
            return '$0';
        }
    };

    let resultsHtml = '';
    if (summary) {
        const ccValue = summary.covered_calls?.total_premium || 0;
        const ppValue = summary.protective_puts?.total_cost || 0;
        const icValue = summary.iron_condors?.total_premium || 0;
        const ccCount = summary.covered_calls?.count || 0;
        const ppCount = summary.protective_puts?.count || 0;
        const icCount = summary.iron_condors?.count || 0;

        resultsHtml = `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Covered Calls (${ccCount})</span>
                    <span class="font-semibold ${ccValue > 0 ? 'text-green-600' : 'text-gray-500'}">+${formatValue(ccValue)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Protective Puts (${ppCount})</span>
                    <span class="font-semibold ${ppValue > 0 ? 'text-red-600' : 'text-gray-500'}">${ppValue > 0 ? '-' : ''}${formatValue(ppValue)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Iron Condors (${icCount})</span>
                    <span class="font-semibold ${icValue > 0 ? 'text-green-600' : 'text-gray-500'}">+${formatValue(icValue)}</span>
                </div>
                <div class="mt-4 pt-3 border-t border-gray-200">
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-gray-600">Filter: ${options.strategy || 'All'} | ${options.expiration || '3M'}</span>
                        <span class="text-blue-600">Min: ${formatValue(parseFloat(options.minPremium || '0.50'))}</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        resultsHtml = `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Covered Calls (0)</span>
                    <span class="font-semibold text-gray-500">+$0</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Protective Puts (0)</span>
                    <span class="font-semibold text-gray-500">-$0</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Iron Condors (0)</span>
                    <span class="font-semibold text-gray-500">+$0</span>
                </div>
            </div>
        `;
    }

    container.innerHTML = controlsHtml + resultsHtml;
}

// Placeholder functions for enhanced analytics
async function loadPerformanceAttribution(portfolioData, options = {}) {
    const container = document.getElementById('performanceAttribution');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>Analyzing performance...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/performance-attribution`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData, options })
        });
        
        const data = await response.json();
        if (data.success) {
            displayPerformanceResults(data.attribution);
        } else {
            container.innerHTML = `<div class="text-red-500">Performance analysis failed: ${data.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="text-red-500">Error: ${error.message}</div>`;
    }
}

function displayPerformanceResults(attribution) {
    const container = document.getElementById('performanceAttribution');
    if (!container || !attribution) return;
    
    container.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between">
                <span>Asset Allocation:</span>
                <span class="font-semibold">${(attribution.asset_allocation * 100).toFixed(2)}%</span>
            </div>
            <div class="flex justify-between">
                <span>Security Selection:</span>
                <span class="font-semibold">${(attribution.security_selection * 100).toFixed(2)}%</span>
            </div>
            <div class="flex justify-between">
                <span>Interaction Effect:</span>
                <span class="font-semibold">${(attribution.interaction * 100).toFixed(2)}%</span>
            </div>
            <div class="border-t pt-2 flex justify-between font-bold">
                <span>Total Active Return:</span>
                <span>${(attribution.total_active_return * 100).toFixed(2)}%</span>
            </div>
        </div>
    `;
}





async function loadStatisticalAnalysis(portfolioData, options = {}) {
    const container = document.getElementById('statisticalAnalysis');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>Analyzing statistics...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/statistical-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData, options })
        });
        
        const data = await response.json();
        if (data.success) {
            displayStatisticalResults(data.statistics);
        } else {
            container.innerHTML = `<div class="text-red-500">Statistical analysis failed: ${data.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="text-red-500">Error: ${error.message}</div>`;
    }
}

function displayStatisticalResults(stats) {
    const container = document.getElementById('statisticalAnalysis');
    if (!container || !stats) return;
    
    container.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span>Sharpe Ratio:</span>
                    <span class="font-semibold">${stats.sharpe_ratio?.toFixed(3) || 'N/A'}</span>
                </div>
                <div class="flex justify-between">
                    <span>Sortino Ratio:</span>
                    <span class="font-semibold">${stats.sortino_ratio?.toFixed(3) || 'N/A'}</span>
                </div>
            </div>
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span>Information Ratio:</span>
                    <span class="font-semibold">${stats.information_ratio?.toFixed(3) || 'N/A'}</span>
                </div>
                <div class="flex justify-between">
                    <span>Max Drawdown:</span>
                    <span class="font-semibold">${stats.max_drawdown ? (stats.max_drawdown * 100).toFixed(1) + '%' : 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
}

async function loadSectorAnalysis(portfolioData, options = {}) {
    const container = document.getElementById('sectorAllocation');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>Analyzing sectors...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/sector-allocation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData, options })
        });
        
        const data = await response.json();
        if (data.success) {
            displaySectorResults(data.allocation);
        } else {
            container.innerHTML = `<div class="text-red-500">Sector analysis failed: ${data.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="text-red-500">Error: ${error.message}</div>`;
    }
}

function displaySectorResults(allocation) {
    const container = document.getElementById('sectorAllocation');
    if (!container || !allocation) return;
    
    const sectors = Object.entries(allocation).sort((a, b) => b[1] - a[1]);
    
    container.innerHTML = `
        <div class="space-y-3">
            ${sectors.map(([sector, percentage]) => `
                <div class="flex justify-between items-center">
                    <span>${sector}:</span>
                    <div class="flex items-center">
                        <div class="w-20 bg-gray-200 rounded-full h-2 mr-2">
                            <div class="bg-blue-600 h-2 rounded-full" style="width: ${percentage}%"></div>
                        </div>
                        <span class="font-semibold">${percentage.toFixed(1)}%</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}





async function loadCorrelationAnalysis(portfolioData, options = {}) {
    const container = document.getElementById('correlationResults');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>Calculating correlations...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/correlation-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData, options })
        });
        
        const data = await response.json();
        if (data.success) {
            displayCorrelationResults(data.correlation_matrix, data.summary);
        } else {
            container.innerHTML = `<div class="text-red-500">Correlation analysis failed: ${data.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="text-red-500">Error: ${error.message}</div>`;
    }
}

function displayCorrelationResults(matrix, summary) {
    const container = document.getElementById('correlationResults');
    if (!container || !matrix) return;
    
    container.innerHTML = `
        <div class="mb-4">
            <div class="grid grid-cols-3 gap-4 text-center">
                <div>
                    <div class="text-lg font-bold">${summary?.average_correlation?.toFixed(3) || 'N/A'}</div>
                    <div class="text-sm text-gray-600">Average Correlation</div>
                </div>
                <div>
                    <div class="text-lg font-bold text-green-600">${summary?.max_correlation?.toFixed(3) || 'N/A'}</div>
                    <div class="text-sm text-gray-600">Highest</div>
                </div>
                <div>
                    <div class="text-lg font-bold text-red-600">${summary?.min_correlation?.toFixed(3) || 'N/A'}</div>
                    <div class="text-sm text-gray-600">Lowest</div>
                </div>
            </div>
        </div>
        <div id="correlationMatrix" class="mt-4"></div>
    `;
    
    // Create correlation matrix visualization
    createCorrelationMatrix(matrix);
}

function createCorrelationMatrix(matrix) {
    const container = document.getElementById('correlationMatrix');
    if (!container || !matrix) return;
    
    const symbols = Object.keys(matrix);
    let html = '<div class="overflow-x-auto"><table class="min-w-full text-xs">';
    
    // Header
    html += '<thead><tr><th></th>';
    symbols.forEach(symbol => {
        html += `<th class="px-1 py-1 text-center">${symbol}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Rows
    symbols.forEach(symbol1 => {
        html += `<tr><td class="font-semibold px-1 py-1">${symbol1}</td>`;
        symbols.forEach(symbol2 => {
            const corr = matrix[symbol1]?.[symbol2] || 0;
            const color = corr > 0.7 ? 'bg-green-200' : corr < -0.7 ? 'bg-red-200' : corr > 0.3 ? 'bg-green-100' : corr < -0.3 ? 'bg-red-100' : 'bg-gray-50';
            html += `<td class="px-1 py-1 text-center ${color}">${corr.toFixed(2)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
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

async function loadPortfolioOptimization(portfolioData, options = {}) {
    const container = document.getElementById('optimizationChart');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>Optimizing portfolio...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/portfolio-optimization`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData, options })
        });
        
        const data = await response.json();
        if (data.success) {
            displayOptimizationResults(data.optimization);
        } else {
            container.innerHTML = `<div class="text-red-500">Portfolio optimization failed: ${data.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="text-red-500">Error: ${error.message}</div>`;
    }
}

function displayOptimizationResults(optimization) {
    const container = document.getElementById('optimizationChart');
    if (!container || !optimization) return;
    
    container.innerHTML = `
        <div class="grid grid-cols-2 gap-6">
            <div>
                <h4 class="font-semibold mb-2">Current Portfolio</h4>
                <div class="space-y-1">
                    <div class="flex justify-between">
                        <span>Expected Return:</span>
                        <span>${optimization.current_portfolio?.expected_return ? (optimization.current_portfolio.expected_return * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Volatility:</span>
                        <span>${optimization.current_portfolio?.volatility ? (optimization.current_portfolio.volatility * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Sharpe Ratio:</span>
                        <span>${optimization.current_portfolio?.sharpe_ratio?.toFixed(3) || 'N/A'}</span>
                    </div>
                </div>
            </div>
            <div>
                <h4 class="font-semibold mb-2">Optimized Portfolio</h4>
                <div class="space-y-1">
                    <div class="flex justify-between">
                        <span>Expected Return:</span>
                        <span class="text-green-600">${optimization.maximum_sharpe?.expected_return ? (optimization.maximum_sharpe.expected_return * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Volatility:</span>
                        <span class="text-blue-600">${optimization.maximum_sharpe?.volatility ? (optimization.maximum_sharpe.volatility * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Sharpe Ratio:</span>
                        <span class="text-green-600 font-bold">${optimization.maximum_sharpe?.sharpe_ratio?.toFixed(3) || 'N/A'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadTechnicalAnalysis(portfolioData, options = {}) {
    const container = document.getElementById('technicalAnalysis');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>Analyzing technical indicators...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/technical-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData, options })
        });
        
        const data = await response.json();
        if (data.success) {
            displayTechnicalResults(data.analysis);
        } else {
            container.innerHTML = `<div class="text-red-500">Technical analysis failed: ${data.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="text-red-500">Error: ${error.message}</div>`;
    }
}

function displayTechnicalResults(analysis) {
    const container = document.getElementById('technicalAnalysis');
    if (!container || !analysis) return;
    
    container.innerHTML = `
        <div class="mb-4">
            <div class="text-center">
                <div class="text-lg font-bold ${analysis.portfolio_signal?.signal === 'BUY' ? 'text-green-600' : analysis.portfolio_signal?.signal === 'SELL' ? 'text-red-600' : 'text-gray-600'}">
                    ${analysis.portfolio_signal?.signal || 'NEUTRAL'}
                </div>
                <div class="text-sm text-gray-600">Portfolio Signal</div>
            </div>
        </div>
        <div class="space-y-2">
            ${Object.entries(analysis.individual_signals || {}).map(([symbol, signals]) => `
                <div class="flex justify-between items-center">
                    <span class="font-medium">${symbol}:</span>
                    <div class="flex space-x-2">
                        <span class="text-xs px-2 py-1 rounded ${signals.overall_signal === 'BUY' ? 'bg-green-100 text-green-800' : signals.overall_signal === 'SELL' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">
                            ${signals.overall_signal}
                        </span>
                        <span class="text-xs text-gray-600">RSI: ${signals.indicators?.RSI?.toFixed(0) || 'N/A'}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Risk analysis update function
function updateRiskAnalysis() {
    const period = document.getElementById('riskPeriod')?.value || '1Y';
    const confidence = document.getElementById('riskConfidence')?.value || '95';
    const model = document.getElementById('riskModel')?.value || 'Historical';
    const benchmark = document.getElementById('riskBenchmark')?.value || 'SPY';
    const window = document.getElementById('riskWindow')?.value || '90';
    
    const options = { period, confidence, model, benchmark, window };
    console.log('Updating risk analysis with options:', options);
    
    const portfolioData = window.portfolioData || JSON.parse(localStorage.getItem('currentPortfolio') || '[]');
    if (portfolioData && portfolioData.length > 0) {
        loadRiskAnalytics(portfolioData, options);
    }
}

// Options analysis update function
function updateOptionsAnalysis() {
    const expiration = document.getElementById('optionsExpiration')?.value || '3M';
    const moneyness = document.getElementById('optionsMoneyness')?.value || 'All';
    const strategy = document.getElementById('optionsStrategy')?.value || 'All';
    const minPremium = document.getElementById('optionsMinPremium')?.value || '0.50';
    const delta = document.getElementById('optionsDelta')?.value || 'All';
    
    const options = { expiration, moneyness, strategy, minPremium, delta };
    console.log('Updating options analysis with options:', options);
    
    const portfolioData = window.portfolioData || JSON.parse(localStorage.getItem('currentPortfolio') || '[]');
    if (portfolioData && portfolioData.length > 0) {
        loadOptionsAnalytics(portfolioData, options);
    }
}

// Performance attribution update function
function updateAttributionAnalysis() {
    const period = document.getElementById('attributionPeriod')?.value || '3M';
    const model = document.getElementById('attributionModel')?.value || 'brinson';
    const benchmark = document.getElementById('attributionBenchmark')?.value || 'SPY';
    const currency = document.getElementById('attributionCurrency')?.value || 'USD';
    const frequency = document.getElementById('attributionFrequency')?.value || 'daily';
    
    const options = { period, model, benchmark, currency, frequency };
    console.log('Updating performance attribution with options:', options);
    
    const portfolioData = window.portfolioData || JSON.parse(localStorage.getItem('currentPortfolio') || '[]');
    if (portfolioData && portfolioData.length > 0) {
        updateAttributionResults(portfolioData, options);
    }
}

// Refresh portfolio analysis with interactive controls
function refreshPortfolioAnalysis() {
    const portfolioData = window.portfolioData || JSON.parse(localStorage.getItem('currentPortfolio') || '[]');
    if (portfolioData && portfolioData.length > 0) {
        console.log('Refreshing portfolio analysis with interactive controls');
        loadAllRealAnalytics(portfolioData);
    } else {
        console.log('No portfolio data available for refresh');
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
window.updateRiskAnalysis = updateRiskAnalysis;
window.updateOptionsAnalysis = updateOptionsAnalysis;
window.updateAttributionAnalysis = updateAttributionAnalysis;
window.refreshPortfolioAnalysis = refreshPortfolioAnalysis;

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