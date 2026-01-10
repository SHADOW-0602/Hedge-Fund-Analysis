// Cash Flow Analysis Module - Matches P&L Attribution UI Style
let currentCashFlowOptions = {
    period: '1Y',
    flow_type: 'Net',
    frequency: 'Daily',
    smoothing: 'None',
    benchmark: 'Cash yield'
};

async function loadCashFlowAnalysis(transactions, options = {}) {
    console.log('loadCashFlowAnalysis called with:', transactions?.length || 0, 'transactions');

    const container = document.getElementById('cashFlowAnalysis');
    if (!container && !options.background) {
        console.error('Cash flow analysis container not found');
        return;
    }

    // Ensure API_BASE is defined
    if (typeof API_BASE === 'undefined') {
        window.API_BASE = window.location.origin;
        console.log('API_BASE not defined, using:', window.API_BASE);
    }

    // Validate transactions
    if (!transactions || transactions.length === 0) {
        if (container && !options.background) {
            container.innerHTML = `
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-primary">Cash Flow Analysis</h2>
                </div>
                <div class="text-center py-8 text-yellow-600">
                    <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p class="text-lg font-medium">No transactions available</p>
                    <p class="text-sm text-secondary mt-2">Upload transaction data to view cash flow analysis</p>
                </div>
            `;
        }
        return;
    }

    // Store transactions for refresh
    window.currentCashFlowTransactions = transactions;

    // Initial load - check for saved settings first
    try {
        const savedSettings = localStorage.getItem('cashFlowSettings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            currentCashFlowOptions = { ...currentCashFlowOptions, ...parsed };
        }
    } catch (e) {
        console.error('Failed to load cash flow settings:', e);
    }

    await fetchCashFlowAnalysis(transactions, options);
}

function updateCashFlowOptions() {
    currentCashFlowOptions = {
        period: document.getElementById('cashFlowPeriod')?.value || '1Y',
        flow_type: document.getElementById('cashFlowType')?.value || 'Net',
        frequency: document.getElementById('cashFlowFrequency')?.value || 'Daily',
        smoothing: document.getElementById('cashFlowSmoothing')?.value || 'None',
        benchmark: document.getElementById('cashFlowBenchmark')?.value || 'Cash yield'
    };

    // Save to localStorage
    try {
        localStorage.setItem('cashFlowSettings', JSON.stringify(currentCashFlowOptions));
    } catch (e) {
        console.error('Failed to save cash flow settings:', e);
    }

    // Trigger refresh
    if (window.currentCashFlowTransactions) {
        fetchCashFlowAnalysis(window.currentCashFlowTransactions);
    }
}

function toggleCashFlowSettings() {
    const settingsPanel = document.getElementById('cashFlowSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
}

async function fetchCashFlowAnalysis(transactions, options = {}) {
    const container = document.getElementById('cashFlowAnalysis');
    if (!container && !options.background) return;

    // Preserve settings state if they exist
    const settingsPanel = document.getElementById('cashFlowSettings');
    const settingsHidden = settingsPanel ? settingsPanel.classList.contains('hidden') : true;

    // Show loading state with minimal UI (only if not background)
    if (container && !options.background) {
        container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-primary">Cash Flow Analysis</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleCashFlowSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    Settings
                </button>
                <button onclick="refreshCashFlowAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center" disabled>
                    <svg class="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Analyzing...
                </button>
            </div>
        </div>

        <!-- Cash Flow Settings Panel -->
        <div id="cashFlowSettings" class="settings-panel ${settingsHidden ? 'hidden' : ''} mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select id="cashFlowPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCashFlowOptions()">
                        <option value="1W" ${currentCashFlowOptions.period === '1W' ? 'selected' : ''}>1 Week</option>
                        <option value="1M" ${currentCashFlowOptions.period === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${currentCashFlowOptions.period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentCashFlowOptions.period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentCashFlowOptions.period === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="YTD" ${currentCashFlowOptions.period === 'YTD' ? 'selected' : ''}>Year to Date</option>
                        <option value="ITD" ${currentCashFlowOptions.period === 'ITD' ? 'selected' : ''}>Inception to Date</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Flow Type</label>
                    <select id="cashFlowType" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCashFlowOptions()">
                        <option value="Net" ${currentCashFlowOptions.flow_type === 'Net' ? 'selected' : ''}>Net</option>
                        <option value="Inflows" ${currentCashFlowOptions.flow_type === 'Inflows' ? 'selected' : ''}>Inflows</option>
                        <option value="Outflows" ${currentCashFlowOptions.flow_type === 'Outflows' ? 'selected' : ''}>Outflows</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <select id="cashFlowFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCashFlowOptions()">
                        <option value="Daily" ${currentCashFlowOptions.frequency === 'Daily' ? 'selected' : ''}>Daily</option>
                        <option value="Weekly" ${currentCashFlowOptions.frequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="Monthly" ${currentCashFlowOptions.frequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Smoothing</label>
                    <select id="cashFlowSmoothing" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCashFlowOptions()">
                        <option value="None" ${currentCashFlowOptions.smoothing === 'None' ? 'selected' : ''}>None</option>
                        <option value="7-day MA" ${currentCashFlowOptions.smoothing === '7-day MA' ? 'selected' : ''}>7-day MA</option>
                        <option value="30-day MA" ${currentCashFlowOptions.smoothing === '30-day MA' ? 'selected' : ''}>30-day MA</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                    <select id="cashFlowBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCashFlowOptions()">
                        <option value="Cash yield" ${currentCashFlowOptions.benchmark === 'Cash yield' ? 'selected' : ''}>Cash yield</option>
                        <option value="Money market" ${currentCashFlowOptions.benchmark === 'Money market' ? 'selected' : ''}>Money market</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div id="cashFlowContent" class="analysis-card p-12 text-center">
            <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <h3 class="text-xl font-semibold text-primary mb-2">Processing Your Data</h3>
            <p class="text-secondary mb-4">Analyzing ${transactions?.length || 0} transactions and calculating cash flows...</p>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
            </div>
            <p class="text-sm text-secondary">This may take a few moments</p>
        </div>
    `;
    } try {
        console.log('Making Cash Flow Analysis API call with options:', currentCashFlowOptions);
        console.log(`Sending ${transactions.length} transactions to backend`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('Request timeout after 300 seconds');
            controller.abort();
        }, 300000);

        const response = await fetch(`${API_BASE}/api/cash-flow-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions, options: currentCashFlowOptions }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success && data.cash_flow_analysis) {
            if (!options.background) {
                displayCashFlowAnalysis(data.cash_flow_analysis);
                // Enable refresh button after successful load
                updateRefreshButton();
            } else {
                console.log('[Cash Flow Analysis] Background load complete');
            }
        } else {
            console.error('[Cash Flow Analysis] Analysis failed:', data);
            if (!options.background) {
                showError(data.error || 'No valid cash flow analysis data returned');
            }
        }
    } catch (error) {
        console.error('Cash Flow Analysis error:', error);
        if (!options.background) {
            if (error.name === 'AbortError') {
                showError('Request timed out after 15 seconds. Please try again.');
            } else if (error.message.includes('Failed to fetch')) {
                showError('Network error. Please check your connection and try again.');
            } else {
                showError(`Analysis failed: ${error.message}`);
            }
        }
    }
}

function updateRefreshButton() {
    const container = document.getElementById('cashFlowAnalysis');
    if (!container) return;

    const headerDiv = container.querySelector('.flex.justify-between.items-center');
    if (headerDiv) {
        const buttonContainer = headerDiv.querySelector('.flex.items-center.space-x-2');
        if (buttonContainer) {
            buttonContainer.innerHTML = `
                <button onclick="toggleCashFlowSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    Settings
                </button>
                <button onclick="refreshCashFlowAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Refresh
                </button>
            `;
        }
    }
}

function displayCashFlowAnalysis(data) {
    let contentDiv = document.getElementById('cashFlowContent');

    // Resilience: Recreate container if missing (e.g., cleared by navigation/loading)
    if (!contentDiv) {
        console.warn('cashFlowContent div not found, rebuilding structure...');
        const container = document.getElementById('cashFlowAnalysis');
        if (container) {
            // Re-build the structure
            container.innerHTML = `
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-primary">Cash Flow Analysis</h2>
                    <div class="flex items-center space-x-2">
                        <button onclick="toggleCashFlowSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                            Settings
                        </button>
                        <button onclick="refreshCashFlowAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>
                <!-- Cash Flow Settings Panel (Re-inserted hidden) -->
                <div id="cashFlowSettings" class="settings-panel hidden mb-6">
                     <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                            <select id="cashFlowPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCashFlowOptions()">
                                <option value="1W">1 Week</option>
                                <option value="1M">1 Month</option>
                                <option value="3M">3 Months</option>
                                <option value="6M">6 Months</option>
                                <option value="1Y" selected>1 Year</option>
                                <option value="YTD">Year to Date</option>
                                <option value="ITD">Inception to Date</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Flow Type</label>
                            <select id="cashFlowType" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCashFlowOptions()">
                                <option value="Net" selected>Net</option>
                                <option value="Inflows">Inflows</option>
                                <option value="Outflows">Outflows</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                            <select id="cashFlowFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCashFlowOptions()">
                                <option value="Daily" selected>Daily</option>
                                <option value="Weekly">Weekly</option>
                                <option value="Monthly">Monthly</option>
                            </select>
                        </div>
                         <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Smoothing</label>
                            <select id="cashFlowSmoothing" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCashFlowOptions()">
                                <option value="None" selected>None</option>
                                <option value="7-day MA">7-day MA</option>
                                <option value="30-day MA">30-day MA</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                            <select id="cashFlowBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCashFlowOptions()">
                                <option value="Cash yield" selected>Cash yield</option>
                                <option value="Money market">Money market</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div id="cashFlowContent" class="analysis-card p-4"></div>
            `;
            contentDiv = document.getElementById('cashFlowContent');
        } else {
            console.error('cashFlowAnalysis container also not found, cannot display results');
            return;
        }
    }

    const totalInflows = data.total_inflows || 0;
    const totalOutflows = data.total_outflows || 0;
    const netFlow = data.net_flow || 0;
    const summary = data.summary || {};
    const currencySymbol = '$';

    // Create chart if data exists
    let chartHtml = '';
    if (data.chart_data && data.chart_data.length > 0) {
        chartHtml = createCashFlowChart(data.chart_data, data.benchmark_data);
    }



    contentDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Total Inflows</h3>
                <p class="text-3xl font-bold text-green-600">
                    ${currencySymbol}${Math.abs(totalInflows).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-secondary mt-1">${summary.period || '1Y'}</p>
            </div>
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Total Outflows</h3>
                <p class="text-3xl font-bold text-red-600">
                    ${currencySymbol}${Math.abs(totalOutflows).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-secondary mt-1">Investments & Fees</p>
            </div>
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Net Flow</h3>
                <p class="text-3xl font-bold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${netFlow >= 0 ? '+' : ''}${currencySymbol}${Math.abs(netFlow).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-secondary mt-1">Net Position</p>
            </div>
        </div>

        ${chartHtml}

        <div class="analysis-card p-6">
            <h4 class="text-sm font-semibold text-primary mb-3">Analysis Parameters</h4>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div><span class="text-secondary">Period:</span> <span class="font-medium text-primary">${summary.period || 'ITD'}</span></div>
                <div><span class="text-secondary">Flow Type:</span> <span class="font-medium text-primary">${summary.flow_type || 'Net'}</span></div>
                <div><span class="text-secondary">Frequency:</span> <span class="font-medium text-primary">${summary.frequency || 'Daily'}</span></div>
                <div><span class="text-secondary">Smoothing:</span> <span class="font-medium text-primary">${summary.smoothing || 'None'}</span></div>
                <div><span class="text-secondary">Benchmark:</span> <span class="font-medium text-primary">${summary.benchmark || 'Cash yield'}</span></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                <div><span class="text-secondary">Avg Daily Inflow:</span> <span class="font-medium text-primary">${currencySymbol}${(summary.avg_daily_inflow || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div><span class="text-secondary">Avg Daily Outflow:</span> <span class="font-medium text-primary">${currencySymbol}${(summary.avg_daily_outflow || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div><span class="text-secondary">Avg Daily Net:</span> <span class="font-medium text-primary">${currencySymbol}${(summary.avg_daily_net || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div><span class="text-secondary">Data Points:</span> <span class="font-medium text-primary">${summary.data_points || 0}</span></div>
            </div>
        </div>
    `;
}

function createCashFlowChart(chartData, benchmarkData) {
    const chartId = 'cashFlowChart_' + Date.now();
    console.log('createCashFlowChart: Creating chart with ID:', chartId);

    // Render chart after DOM is updated
    setTimeout(() => {
        const canvas = document.getElementById(chartId);
        if (canvas && window.Chart) {
            renderCashFlowChart(chartId, chartData, benchmarkData);
        } else if (!canvas) {
            setTimeout(() => {
                const retryCanvas = document.getElementById(chartId);
                if (retryCanvas && window.Chart) {
                    renderCashFlowChart(chartId, chartData, benchmarkData);
                }
            }, 200);
        }
    }, 100);

    return `
        <div class="analysis-card p-6 mb-6">
            <h3 class="text-lg font-semibold text-primary mb-4">Cash Flow Trend</h3>
            <div style="position: relative; height: 400px; width: 100%;">
                <canvas id="${chartId}" style="width: 100%; height: 100%;"></canvas>
            </div>
        </div>
    `;
}

function renderCashFlowChart(chartId, chartData, benchmarkData) {
    console.log('renderCashFlowChart called with:', chartId);
    console.log('Chart.js available:', !!window.Chart);
    console.log('Chart constructor:', typeof window.Chart);

    const canvas = document.getElementById(chartId);
    if (!canvas) {
        console.error('Canvas element not found:', chartId);
        return;
    }
    console.log('Canvas found:', canvas);
    console.log('Rendering chart with data:', chartData);

    if (!window.Chart) {
        console.error('Chart.js not available');
        return;
    }

    const ctx = canvas.getContext('2d');

    // Prepare data for Chart.js
    // Filter out zero values to avoid empty bars and "ghost" tooltips
    const validData = chartData.filter(item => Math.abs(item.value) > 0.01);

    if (validData.length === 0 && chartData.length > 0) {
        // If all are zero, maybe show a message or just keep empty
        console.log('All cash flow values are zero');
    }

    const labels = validData.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const values = validData.map(item => item.value);
    console.log('Chart values:', values);

    if (values.some(v => v === undefined || v === null || isNaN(v))) {
        console.error('Invalid chart values detected:', values);
    }

    const colors = values.map(value => value >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)');
    const borderColors = values.map(value => value >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)');

    try {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cash Flow',
                    data: values,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 4,
                    minBarLength: 4 // Ensure small values are at least 4px tall
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.parsed.y;
                                return `Cash Flow: ${value >= 0 ? '+' : ''}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: function (value) {
                                return '$' + (Math.abs(value) >= 1000 ? (value / 1000).toFixed(0) + 'K' : value.toFixed(0));
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        console.log('Chart created successfully');
    } catch (error) {
        console.error('Failed to create Chart.js instance:', error);
    }
}

function showError(message) {
    const contentDiv = document.getElementById('cashFlowContent');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="analysis-card p-8 text-center text-red-600">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl font-semibold mb-2">Analysis Error</p>
                <p class="text-sm text-secondary">${message}</p>
            </div>
        `;
    }
}



// Global functions - match P&L pattern
window.loadCashFlowAnalysis = loadCashFlowAnalysis;
window.toggleCashFlowSettings = () => document.getElementById('cashFlowSettings')?.classList.toggle('hidden');
window.updateCashFlowAnalysis = () => {
    updateCashFlowOptions();
};
window.refreshCashFlowAnalysis = () => {
    if (window.currentCashFlowTransactions) fetchCashFlowAnalysis(window.currentCashFlowTransactions);
};
window.displayCashFlowAnalysis = displayCashFlowAnalysis;
window.renderCashFlowChart = renderCashFlowChart;