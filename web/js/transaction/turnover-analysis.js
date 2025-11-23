// Turnover Analysis Module - Matches P&L Attribution UI Style
let currentTurnoverOptions = {
    period: '1Y',
    calculation: 'Buy+Sell',
    frequency: 'Daily',
    benchmark: 'Mutual Fund avg',
    trend: '30d',
    start_date: null,
    end_date: null
};

let turnoverChart = null;

async function loadTurnoverAnalysis(transactions) {
    console.log('[TURNOVER-ANALYSIS] loadTurnoverAnalysis called with:', transactions?.length || 0, 'transactions');

    const container = document.getElementById('turnoverAnalysis');
    if (!container) {
        console.error('[TURNOVER-ANALYSIS] turnoverAnalysis container not found');
        return;
    }
    
    console.log('[TURNOVER-ANALYSIS] Container found, proceeding with interactive analysis');
    
    // Clear any existing content immediately
    container.innerHTML = '';
    
    // Force display of interactive analysis
    console.log('[TURNOVER-ANALYSIS] Forcing interactive turnover analysis display');

    // Ensure API_BASE is defined
    if (typeof API_BASE === 'undefined') {
        window.API_BASE = window.location.origin;
    }

    // Validate transactions
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-yellow-500">No transactions available for Turnover Analysis</div>';
        return;
    }

    // Store transactions for refresh
    window.currentTurnoverTransactions = transactions;

    // Initial load
    await fetchTurnoverAnalysis(transactions);
}

function updateTurnoverOptions() {
    currentTurnoverOptions = {
        period: document.getElementById('turnoverPeriod')?.value || '1Y',
        calculation: document.getElementById('turnoverCalculation')?.value || 'Buy+Sell',
        frequency: document.getElementById('turnoverFrequency')?.value || 'Daily',
        benchmark: document.getElementById('turnoverBenchmark')?.value || 'Mutual Fund avg',
        trend: document.getElementById('turnoverTrend')?.value || '30d',
        start_date: document.getElementById('turnoverStartDate')?.value || null,
        end_date: document.getElementById('turnoverEndDate')?.value || null
    };
}

async function fetchTurnoverAnalysis(transactions) {
    const container = document.getElementById('turnoverAnalysis');
    if (!container) return;

    // Preserve settings state if they exist
    const settingsPanel = document.getElementById('turnoverSettings');
    const settingsHidden = settingsPanel ? settingsPanel.classList.contains('hidden') : true;

    // Show loading state with full UI
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Turnover Analysis</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleTurnoverSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    Settings
                </button>
                <button class="bg-indigo-600 text-white px-3 py-1 rounded-lg transition-colors text-sm flex items-center opacity-50 cursor-not-allowed" disabled>
                    <svg class="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Analyzing...
                </button>
            </div>
        </div>
        
        <!-- Turnover Settings Panel -->
        <div id="turnoverSettings" class="settings-panel ${settingsHidden ? 'hidden' : ''} mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select id="turnoverPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="handleTurnoverPeriodChange()">
                        <option value="1M" ${currentTurnoverOptions.period === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${currentTurnoverOptions.period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentTurnoverOptions.period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentTurnoverOptions.period === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="Annualized" ${currentTurnoverOptions.period === 'Annualized' ? 'selected' : ''}>Annualized</option>
                        <option value="Custom" ${currentTurnoverOptions.period === 'Custom' ? 'selected' : ''}>Custom Range</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Calculation</label>
                    <select id="turnoverCalculation" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTurnoverAnalysis()">
                        <option value="Buy+Sell" ${currentTurnoverOptions.calculation === 'Buy+Sell' ? 'selected' : ''}>Buy + Sell</option>
                        <option value="Portfolio-weighted" ${currentTurnoverOptions.calculation === 'Portfolio-weighted' ? 'selected' : ''}>Portfolio-weighted</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <select id="turnoverFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTurnoverAnalysis()">
                        <option value="Daily" ${currentTurnoverOptions.frequency === 'Daily' ? 'selected' : ''}>Daily</option>
                        <option value="Weekly" ${currentTurnoverOptions.frequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="Monthly" ${currentTurnoverOptions.frequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                    <select id="turnoverBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTurnoverAnalysis()">
                        <option value="Mutual Fund avg" ${currentTurnoverOptions.benchmark === 'Mutual Fund avg' ? 'selected' : ''}>Mutual Fund Avg</option>
                        <option value="ETF avg" ${currentTurnoverOptions.benchmark === 'ETF avg' ? 'selected' : ''}>ETF Avg</option>
                        <option value="Hedge Fund avg" ${currentTurnoverOptions.benchmark === 'Hedge Fund avg' ? 'selected' : ''}>Hedge Fund Avg</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Trend Window</label>
                    <select id="turnoverTrend" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTurnoverAnalysis()">
                        <option value="30d" ${currentTurnoverOptions.trend === '30d' ? 'selected' : ''}>Rolling 30d</option>
                        <option value="90d" ${currentTurnoverOptions.trend === '90d' ? 'selected' : ''}>Rolling 90d</option>
                        <option value="252d" ${currentTurnoverOptions.trend === '252d' ? 'selected' : ''}>Rolling 252d</option>
                    </select>
                </div>
            </div>
            
            <!-- Custom Date Range Inputs (Hidden by default) -->
            <div id="turnoverCustomDates" class="grid grid-cols-2 gap-4 mt-4 ${currentTurnoverOptions.period === 'Custom' ? '' : 'hidden'}">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input type="date" id="turnoverStartDate" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" value="${currentTurnoverOptions.start_date || ''}" onchange="updateTurnoverAnalysis()">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input type="date" id="turnoverEndDate" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" value="${currentTurnoverOptions.end_date || ''}" onchange="updateTurnoverAnalysis()">
                </div>
            </div>
        </div>
        
        <div id="turnoverContent" class="bg-white rounded-lg shadow p-12 text-center">
            <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Analyzing Turnover</h3>
            <p class="text-gray-600 mb-4">Processing ${transactions?.length || 0} transactions...</p>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
            </div>
            <p class="text-sm text-gray-500">This may take a few moments</p>
        </div>
    `;

    try {
        console.log('Making Turnover Analysis API call with options:', currentTurnoverOptions);

        const response = await fetch(`${API_BASE}/api/turnover-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions, options: currentTurnoverOptions })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success && data.turnover_analysis) {
            displayTurnoverResults(data.turnover_analysis);
        } else {
            showTurnoverError(data.error || 'No valid transactions found');
        }
    } catch (error) {
        console.error('Turnover Analysis error:', error);
        showTurnoverError(error.message);
    }
}

function displayTurnoverResults(data) {
    const contentDiv = document.getElementById('turnoverContent');
    if (!contentDiv) return;

    const annualizedTurnover = data.annualized_turnover_rate || 0;
    const avgDailyTurnover = data.avg_daily_turnover || 0;
    const tradingDays = data.trading_days || 0;
    const turnoverFreq = data.turnover_frequency || 0;

    contentDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Annualized Turnover</h3>
                <p class="text-3xl font-bold text-blue-600">
                    ${(annualizedTurnover * 100).toFixed(1)}%
                </p>
                <p class="text-sm text-gray-600 mt-1">Portfolio churn rate</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Avg Daily Volume</h3>
                <p class="text-3xl font-bold text-green-600">
                    $${formatCompactNumber(avgDailyTurnover)}
                </p>
                <p class="text-sm text-gray-600 mt-1">Daily trading volume</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Trading Activity</h3>
                <p class="text-3xl font-bold text-purple-600">
                    ${tradingDays}
                </p>
                <p class="text-sm text-gray-600 mt-1">Active trading days</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Trading Frequency</h3>
                <p class="text-3xl font-bold text-orange-600">
                    ${(turnoverFreq * 100).toFixed(1)}%
                </p>
                <p class="text-sm text-gray-600 mt-1">% of days with trades</p>
            </div>
        </div>

        <!-- Chart Section -->
        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Turnover Trend Analysis</h3>
            <div class="h-80 relative">
                <canvas id="turnoverTrendChart"></canvas>
            </div>
        </div>

        <!-- Analysis Parameters Footer -->
        <div class="bg-gray-50 rounded-lg p-6">
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Analysis Parameters</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span class="text-gray-600">Period:</span> <span class="font-medium text-gray-900">${currentTurnoverOptions.period}</span></div>
                <div><span class="text-gray-600">Calculation:</span> <span class="font-medium text-gray-900">${currentTurnoverOptions.calculation}</span></div>
                <div><span class="text-gray-600">Frequency:</span> <span class="font-medium text-gray-900">${currentTurnoverOptions.frequency}</span></div>
                <div><span class="text-gray-600">Benchmark:</span> <span class="font-medium text-gray-900">${currentTurnoverOptions.benchmark}</span></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-2">
                <div><span class="text-gray-600">Trend Window:</span> <span class="font-medium text-gray-900">${currentTurnoverOptions.trend}</span></div>
            </div>
        </div>
    `;

    renderTurnoverChart(data);
}

function renderTurnoverChart(data) {
    const ctx = document.getElementById('turnoverTrendChart');
    if (!ctx) return;

    if (turnoverChart) {
        turnoverChart.destroy();
        turnoverChart = null;
    }
    
    // Force canvas reset
    ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);

    const chartData = data.chart_data || [];
    const benchmarkData = data.benchmark_data || [];
    
    // Prepare datasets
    const labels = chartData.map(d => d.date);
    const rollingTurnover = chartData.map(d => d.rolling_turnover);
    const benchmarkValues = benchmarkData.map(d => d.value);

    turnoverChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Portfolio Rolling Turnover',
                    data: rollingTurnover,
                    borderColor: '#2563eb', // Blue
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                },
                {
                    label: `${data.benchmark || 'Benchmark'} (Est.)`,
                    data: benchmarkValues,
                    borderColor: '#9ca3af', // Gray
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { boxWidth: 12, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [2, 2] },
                    ticks: {
                        callback: function (value) { return value + '%' }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        maxTicksLimit: 8,
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function showTurnoverError(message) {
    const contentDiv = document.getElementById('turnoverContent');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="bg-white rounded-lg shadow p-8 text-center text-red-600">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl font-semibold mb-2">Analysis Error</p>
                <p class="text-sm text-gray-600">${message}</p>
            </div>
        `;
    }
}

function formatCompactNumber(number) {
    return new Intl.NumberFormat('en-US', {
        notation: "compact",
        maximumFractionDigits: 1
    }).format(number);
}

// Global functions
window.loadTurnoverAnalysis = loadTurnoverAnalysis;
window.toggleTurnoverSettings = () => document.getElementById('turnoverSettings')?.classList.toggle('hidden');
window.handleTurnoverPeriodChange = () => {
    const period = document.getElementById('turnoverPeriod')?.value;
    const customDates = document.getElementById('turnoverCustomDates');
    if (period === 'Custom') {
        customDates?.classList.remove('hidden');
    } else {
        customDates?.classList.add('hidden');
        updateTurnoverAnalysis();
    }
};
window.updateTurnoverAnalysis = () => {
    updateTurnoverOptions();
    if (window.currentTurnoverTransactions) fetchTurnoverAnalysis(window.currentTurnoverTransactions);
};
window.refreshTurnoverAnalysis = () => {
    if (window.currentTurnoverTransactions) fetchTurnoverAnalysis(window.currentTurnoverTransactions);
};