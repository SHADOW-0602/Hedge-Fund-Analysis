// Cost Analysis Module - Matches Risk Analysis UI Style
let currentCostOptions = {
    period: '1Y',
    breakdown: 'By Symbol',
    benchmark: 'Industry average',
    view: 'Absolute $'
};

async function loadCostAnalysis(transactions) {
    console.log('loadCostAnalysis called with:', transactions?.length || 0, 'transactions');

    const container = document.getElementById('analysisContent');
    if (!container) {
        console.error('analysisContent container not found');
        return;
    }
    
    // Show the container
    container.classList.remove('hidden');

    // Ensure API_BASE is defined
    if (typeof API_BASE === 'undefined') {
        window.API_BASE = window.location.origin;
        console.log('API_BASE not defined, using:', window.API_BASE);
    }

    // Validate transactions
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-yellow-500">No transactions available for cost analysis</div>';
        return;
    }

    // Store transactions for refresh
    window.currentCostTransactions = transactions;

    // Initial load
    await fetchCostAnalysis(transactions);
}

function updateCostOptions() {
    currentCostOptions = {
        period: document.getElementById('costPeriod')?.value || '1Y',
        breakdown: document.getElementById('costBreakdown')?.value || 'By Symbol',
        benchmark: document.getElementById('costBenchmark')?.value || 'Industry average',
        view: document.getElementById('costView')?.value || 'Absolute $'
    };

    // Trigger refresh
    if (window.currentCostTransactions) {
        fetchCostAnalysis(window.currentCostTransactions);
    }
}

function toggleCostSettings() {
    const settingsPanel = document.getElementById('costSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
}

async function fetchCostAnalysis(transactions) {
    const container = document.getElementById('analysisContent');
    if (!container) return;

    // Preserve settings state if they exist
    const settingsPanel = document.getElementById('costSettings');
    const settingsHidden = settingsPanel ? settingsPanel.classList.contains('hidden') : true;

    // Show loading state with full UI matching Risk Analysis
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="analysis-title">Cost Analysis</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleCostSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    Settings
                </button>
                <button onclick="updateCostOptions()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center opacity-50 cursor-not-allowed" disabled>
                    <svg class="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Analyzing...
                </button>
                <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        </div>
        
        <!-- Cost Settings Panel -->
        <div id="costSettings" class="settings-panel ${settingsHidden ? 'hidden' : ''} mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select id="costPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCostOptions()">
                        <option value="1M" ${currentCostOptions.period === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${currentCostOptions.period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentCostOptions.period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentCostOptions.period === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="YTD" ${currentCostOptions.period === 'YTD' ? 'selected' : ''}>Year to Date</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Breakdown</label>
                    <select id="costBreakdown" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCostOptions()">
                        <option value="By Symbol" ${currentCostOptions.breakdown === 'By Symbol' ? 'selected' : ''}>By Symbol</option>
                        <option value="By Trade Size" ${currentCostOptions.breakdown === 'By Trade Size' ? 'selected' : ''}>By Trade Size</option>
                        <option value="By Broker" ${currentCostOptions.breakdown === 'By Broker' ? 'selected' : ''}>By Broker</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                    <select id="costBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCostOptions()">
                        <option value="Industry average" ${currentCostOptions.benchmark === 'Industry average' ? 'selected' : ''}>Industry average</option>
                        <option value="None" ${currentCostOptions.benchmark === 'None' ? 'selected' : ''}>None</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">View</label>
                    <select id="costView" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCostOptions()">
                        <option value="Absolute $" ${currentCostOptions.view === 'Absolute $' ? 'selected' : ''}>Absolute $</option>
                        <option value="% of Trade Value" ${currentCostOptions.view === '% of Trade Value' ? 'selected' : ''}>% of Trade Value</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div id="costContent" class="bg-white rounded-lg shadow p-12 text-center">
            <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Calculating Costs</h3>
            <p class="text-gray-600 mb-4">Processing your data...</p>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
            </div>
            <p class="text-sm text-gray-500">This may take a few moments</p>
        </div>
    `;

    try {
        console.log('Making Cost Analysis API call with options:', currentCostOptions);
        console.log(`Sending ${transactions.length} transactions to backend`);
        if (transactions.length > 0) {
            console.log('Sample transaction:', transactions[0]);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('Request timeout after 15 seconds');
            controller.abort();
        }, 15000);

        const response = await fetch(`${API_BASE}/api/cost-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions, options: currentCostOptions }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success && data.cost_analysis) {
            displayCostAnalysis(data.cost_analysis);
        } else {
            showError(data.error || 'No valid cost analysis data returned');
        }
    } catch (error) {
        console.error('Cost Analysis error:', error);
        if (error.name === 'AbortError') {
            showError('Request timed out after 15 seconds. Please try again.');
        } else if (error.message.includes('Failed to fetch')) {
            showError('Network error. Please check your connection and try again.');
        } else {
            showError(`Analysis failed: ${error.message}`);
        }
    }
}

function displayCostAnalysis(data) {
    const contentDiv = document.getElementById('costContent');
    if (!contentDiv) return;

    // Check if all costs are zero - hide if no meaningful data
    const totalCosts = data.total_costs || 0;
    const commissions = data.total_commissions || 0;
    const spreads = data.total_spreads || 0;
    const slippage = data.total_slippage || 0;
    
    if (totalCosts === 0 && commissions === 0 && spreads === 0 && slippage === 0) {
        contentDiv.innerHTML = `
            <div class="bg-white rounded-lg shadow p-8 text-center">
                <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">No Trading Costs Found</h3>
                <p class="text-gray-600 mb-4">No commission fees, spreads, or slippage costs detected for the selected period.</p>
                <p class="text-sm text-gray-500">This typically indicates commission-free trading or insufficient market data for cost estimation.</p>
            </div>
        `;
        return;
    }
    
    const currencySymbol = '$';
    let breakdownHtml = '';
    const breakdownType = currentCostOptions.breakdown || 'By Symbol';
    const breakdownData = data.breakdown || [];

    if (breakdownData.length > 0) {
        breakdownHtml = createCostBreakdown(breakdownData, breakdownType, currencySymbol);
    }

    contentDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Total Costs</h3>
                <p class="text-3xl font-bold text-red-600">
                    ${currencySymbol}${Math.abs(totalCosts).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-500 mt-1">${currentCostOptions.period}</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Commissions</h3>
                <p class="text-2xl font-bold text-white">
                    ${currencySymbol}${Math.abs(commissions).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-500 mt-1">Direct Fees</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Est. Spreads</h3>
                <p class="text-2xl font-bold text-white">
                    ${currencySymbol}${Math.abs(spreads).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-500 mt-1">Implicit Cost</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Est. Slippage</h3>
                <p class="text-2xl font-bold text-white">
                    ${currencySymbol}${Math.abs(slippage).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-500 mt-1">Market Impact</p>
            </div>
        </div>

        ${breakdownHtml ? `
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">${breakdownType} Breakdown</h3>
                <div class="space-y-2">${breakdownHtml}</div>
            </div>
        ` : ''}

        <div class="bg-gray-50 rounded-lg p-6">
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Analysis Parameters</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span class="text-gray-600">Period:</span> <span class="font-medium text-gray-900">${currentCostOptions.period}</span></div>
                <div><span class="text-gray-600">View:</span> <span class="font-medium text-gray-900">${currentCostOptions.view}</span></div>
                <div><span class="text-gray-600">Breakdown:</span> <span class="font-medium text-gray-900">${breakdownType}</span></div>
                <div><span class="text-gray-600">Benchmark:</span> <span class="font-medium text-gray-900">${currentCostOptions.benchmark}</span></div>
            </div>
        </div>
    `;
}

function createCostBreakdown(breakdownData, type, currencySymbol) {
    return breakdownData
        .sort((a, b) => (b.total || 0) - (a.total || 0))
        .filter(item => (item.total || 0) > 0.001)
        .map(item => {
            const total = item.total || 0;
            const comms = item.commissions || 0;
            const spreads = item.spreads || 0;
            const slippage = item.slippage || 0;
            const name = item.name || 'Unknown';

            return `
                <div class="flex flex-col py-3 border-b border-gray-200">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-medium text-gray-900">${name}</span>
                        <span class="font-semibold text-red-600">
                            ${currencySymbol}${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div class="flex justify-between text-xs text-gray-500 pl-2">
                        <span>Commission: ${currencySymbol}${comms.toFixed(2)}</span>
                        <span>Spreads: ${currencySymbol}${spreads.toFixed(2)}</span>
                        <span>Slippage: ${currencySymbol}${slippage.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }).join('');
}

function showError(message) {
    const contentDiv = document.getElementById('costContent');
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

// Export for global access
window.loadCostAnalysis = loadCostAnalysis;