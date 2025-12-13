// Accounting Analysis Module - Matches P&L Attribution UI Style
let currentAccountingOptions = {
    method: 'FIFO',
    period: '1Y',
    tax_impact: 'Current rates',
    comparison: 'None'
};

let isAccountingAnalysisLoading = false;
let accountingAnalysisTimeout = null;

async function loadAccountingAnalysis(transactions) {
    console.log('loadAccountingAnalysis called with:', transactions?.length || 0, 'transactions');

    const container = document.getElementById('accountingAnalysis');
    if (!container) {
        console.error('accountingAnalysis container not found');
        return;
    }

    // Ensure API_BASE is defined
    if (typeof API_BASE === 'undefined') {
        window.API_BASE = window.location.origin;
    }

    // Validate transactions
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-yellow-500">No transactions available for accounting analysis</div>';
        return;
    }

    // Store transactions for refresh
    window.currentAccountingTransactions = transactions;

    // Initial load
    await fetchAccountingAnalysis(transactions);
}

function updateAccountingOptions() {
    currentAccountingOptions = {
        method: document.getElementById('accountingMethod')?.value || 'FIFO',
        period: document.getElementById('accountingPeriod')?.value || '1Y',
        tax_impact: document.getElementById('accountingTaxImpact')?.value || 'Current rates',
        comparison: document.getElementById('accountingComparison')?.value || 'None'
    };
}

async function fetchAccountingAnalysis(transactions) {
    const container = document.getElementById('accountingAnalysis');
    if (!container) return;

    if (isAccountingAnalysisLoading) {
        console.log('Accounting analysis already in progress');
        return;
    }

    isAccountingAnalysisLoading = true;

    // Preserve settings state if they exist
    const settingsPanel = document.getElementById('accountingSettings');
    const settingsHidden = settingsPanel ? settingsPanel.classList.contains('hidden') : true;

    // Show loading state with minimal UI
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">FIFO/LIFO Accounting</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleAccountingSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    Settings
                </button>
                <button onclick="refreshAccountingAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center" disabled>
                    <svg class="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Analyzing...
                </button>
            </div>
        </div>

        <!-- Accounting Settings Panel -->
        <div id="accountingSettings" class="settings-panel ${settingsHidden ? 'hidden' : ''} mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Method</label>
                    <select id="accountingMethod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="window.updateAccountingAnalysis()">
                        <option value="FIFO" ${currentAccountingOptions.method === 'FIFO' ? 'selected' : ''}>FIFO</option>
                        <option value="LIFO" ${currentAccountingOptions.method === 'LIFO' ? 'selected' : ''}>LIFO</option>
                        <option value="SPECIFIC_ID" ${currentAccountingOptions.method === 'SPECIFIC_ID' ? 'selected' : ''}>Specific ID</option>
                        <option value="AVERAGE_COST" ${currentAccountingOptions.method === 'AVERAGE_COST' ? 'selected' : ''}>Average Cost</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select id="accountingPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="window.updateAccountingAnalysis()">
                        <option value="1M" ${currentAccountingOptions.period === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${currentAccountingOptions.period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentAccountingOptions.period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentAccountingOptions.period === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="YTD" ${currentAccountingOptions.period === 'YTD' ? 'selected' : ''}>Year to Date</option>
                        <option value="ITD" ${currentAccountingOptions.period === 'ITD' ? 'selected' : ''}>Inception to Date</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tax Impact</label>
                    <select id="accountingTaxImpact" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="window.updateAccountingAnalysis()">
                        <option value="Current rates" ${currentAccountingOptions.tax_impact === 'Current rates' ? 'selected' : ''}>Current rates</option>
                        <option value="Historical rates" ${currentAccountingOptions.tax_impact === 'Historical rates' ? 'selected' : ''}>Historical rates</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Optimization</label>
                    <select id="accountingOptimization" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="handleOptimizationChange()">
                        <option value="None">None</option>
                        <option value="Tax-loss harvesting">Tax-loss harvesting</option>
                        <option value="Gain optimization">Gain optimization</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Comparison</label>
                    <select id="accountingComparison" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="window.updateAccountingAnalysis()">
                        <option value="None" ${currentAccountingOptions.comparison === 'None' ? 'selected' : ''}>None</option>
                        <option value="FIFO vs LIFO" ${currentAccountingOptions.comparison === 'FIFO vs LIFO' ? 'selected' : ''}>FIFO vs LIFO</option>
                        <option value="All Methods" ${currentAccountingOptions.comparison === 'All Methods' ? 'selected' : ''}>All Methods</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div id="accountingContent" class="analysis-card p-12 text-center">
            <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <h3 class="text-xl font-semibold text-primary mb-2">Processing Your Data</h3>
            <p class="text-secondary mb-4">Analyzing ${transactions?.length || 0} transactions using ${currentAccountingOptions.method}...</p>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
            </div>
            <p class="text-sm text-gray-500">This may take a few moments</p>
        </div>
    `;

    try {
        console.log('Making Accounting Analysis API call with options:', {
            accountingMethod: currentAccountingOptions.method,
            accountingPeriod: currentAccountingOptions.period,
            taxImpact: currentAccountingOptions.tax_impact,
            comparison: currentAccountingOptions.comparison
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const requestBody = {
            transactions,
            options: {
                accountingMethod: currentAccountingOptions.method,
                accountingPeriod: currentAccountingOptions.period,
                taxImpact: currentAccountingOptions.tax_impact,
                comparison: currentAccountingOptions.comparison
            }
        };

        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(`${API_BASE}/api/fifo-lifo-accounting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        console.log('Response keys:', Object.keys(data));
        console.log('Success flag:', data.success);
        console.log('Has fifo_lifo_analysis:', !!data.fifo_lifo_analysis);

        if (data.success && data.fifo_lifo_analysis) {
            console.log('Analysis data received:', data.fifo_lifo_analysis);
            console.log('Analysis data keys:', Object.keys(data.fifo_lifo_analysis));
            console.log('Analysis data type:', typeof data.fifo_lifo_analysis);
            console.log('Calling displayAccountingAnalysis with:', data.fifo_lifo_analysis);
            displayAccountingAnalysis(data.fifo_lifo_analysis);
            // Enable refresh button after successful load
            enableRefreshButton();
        } else {
            console.error('Analysis failed:', data);
            console.error('Expected success=true and fifo_lifo_analysis, got:', data);
            console.error('Data structure:', JSON.stringify(data, null, 2));
            showError(data.error || 'No valid analysis data returned');
        }
    } catch (error) {
        console.error('Accounting Analysis error:', error);
        showError(error.name === 'AbortError' ? 'Request timeout' : error.message);
        // Enable refresh button even on error
        enableRefreshButton();
    } finally {
        isAccountingAnalysisLoading = false;
    }
}

function enableRefreshButton() {
    const container = document.getElementById('accountingAnalysis');
    if (!container) return;

    const refreshButton = container.querySelector('button[disabled]');
    if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.className = 'bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center';
        refreshButton.onclick = () => window.refreshAccountingAnalysis();
        refreshButton.innerHTML = `
            <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
            </svg>
            Refresh
        `;
    }
}

function displayAccountingAnalysis(data) {
    console.log('displayAccountingAnalysis called with:', data);
    const contentDiv = document.getElementById('accountingContent');
    if (!contentDiv) {
        console.error('accountingContent div not found');
        return;
    }

    // Handle Comparison View
    if (data.comparison_summary) {
        console.log('Displaying comparison view');
        displayComparisonView(data, contentDiv);
        return;
    }

    // Handle Single Method View
    const result = data.primary_method || data;
    console.log('Using result data:', result);
    const realizedPnl = result.realized_pnl || 0;
    const taxLiability = result.tax_liability || 0;
    const shortTerm = result.short_term_gains || 0;
    const longTerm = result.long_term_gains || 0;
    console.log('Extracted values:', { realizedPnl, taxLiability, shortTerm, longTerm });

    contentDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Realized P&L</h3>
                <p class="text-3xl font-bold ${realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${realizedPnl >= 0 ? '+' : ''}$${Math.abs(realizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-secondary mt-1">Using ${result.method || currentAccountingOptions.method}</p>
            </div>
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Est. Tax Liability</h3>
                <p class="text-3xl font-bold text-red-600">
                    $${Math.abs(taxLiability).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-secondary mt-1">Based on ${currentAccountingOptions.tax_impact}</p>
            </div>
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Tax Efficiency</h3>
                <p class="text-3xl font-bold ${realizedPnl > 0 ? 'text-blue-600' : 'text-gray-600'}">
                    ${realizedPnl > 0 ? ((1 - (taxLiability / realizedPnl)) * 100).toFixed(1) + '%' : 'N/A'}
                </p>
                <p class="text-sm text-secondary mt-1">After-tax retention</p>
            </div>
        </div>

        <div class="analysis-card p-6 mb-6">
            <h3 class="text-lg font-semibold text-primary mb-4">Gain/Loss Breakdown</h3>
            <div class="space-y-4">
                <div class="flex justify-between items-center py-2 border-b border-card">
                    <span class="font-medium text-primary">Short-Term Gains (< 1 Year)</span>
                    <span class="font-semibold ${shortTerm >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${shortTerm >= 0 ? '+' : ''}$${Math.abs(shortTerm).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-card">
                    <span class="font-medium text-primary">Long-Term Gains (> 1 Year)</span>
                    <span class="font-semibold ${longTerm >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${longTerm >= 0 ? '+' : ''}$${Math.abs(longTerm).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        </div>

        <div class="analysis-card p-6">
            <h4 class="text-sm font-semibold text-primary mb-3">Analysis Parameters</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span class="text-secondary">Method:</span> <span class="font-medium text-primary">${result.method || currentAccountingOptions.method}</span></div>
                <div><span class="text-secondary">Period:</span> <span class="font-medium text-primary">${currentAccountingOptions.period}</span></div>
                <div><span class="text-secondary">Tax Impact:</span> <span class="font-medium text-primary">${currentAccountingOptions.tax_impact}</span></div>
                <div><span class="text-secondary">Transactions:</span> <span class="font-medium text-primary">${result.transaction_count || 0}</span></div>
            </div>
        </div>
    `;
}

function displayComparisonView(data, contentDiv) {
    const summary = data.comparison_summary;
    const details = summary.details || [];

    let comparisonHtml = details.map(d => `
        <tr class="hover:bg-white/5">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">${d.method}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${d.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                ${d.realized_pnl >= 0 ? '+' : ''}$${Math.abs(d.realized_pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                $${Math.abs(d.tax_liability).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
        </tr>
    `).join('');

    contentDiv.innerHTML = `
        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 text-left">
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm text-blue-700">
                        Based on your transactions, <strong>${summary.best_method_for_tax}</strong> results in the lowest tax liability, potentially saving 
                        <strong>$${summary.tax_savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> compared to the highest tax method.
                    </p>
                </div>
            </div>
        </div>

        <div class="analysis-card overflow-hidden mb-6">
            <table class="min-w-full divide-y divide-card">
                <thead class="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Method</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Realized P&L</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Est. Tax Liability</th>
                    </tr>
                </thead>
                <tbody class="bg-card divide-y divide-card">
                    ${comparisonHtml}
                </tbody>
            </table>
        </div>
        
        <div class="analysis-card p-6">
            <h4 class="text-sm font-semibold text-primary mb-3">Analysis Parameters</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span class="text-secondary">Comparison:</span> <span class="font-medium text-primary">${currentAccountingOptions.comparison}</span></div>
                <div><span class="text-secondary">Period:</span> <span class="font-medium text-primary">${currentAccountingOptions.period}</span></div>
                <div><span class="text-secondary">Tax Impact:</span> <span class="font-medium text-primary">${currentAccountingOptions.tax_impact}</span></div>
            </div>
        </div>
    `;
}

function showError(message) {
    const contentDiv = document.getElementById('accountingContent');
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

// Global functions
window.loadAccountingAnalysis = loadAccountingAnalysis;
window.toggleAccountingSettings = () => document.getElementById('accountingSettings')?.classList.toggle('hidden');
window.updateAccountingAnalysis = () => {
    if (isAccountingAnalysisLoading) {
        console.log('Accounting analysis already loading, skipping...');
        return;
    }

    // Debounce multiple rapid calls
    if (accountingAnalysisTimeout) {
        clearTimeout(accountingAnalysisTimeout);
    }

    accountingAnalysisTimeout = setTimeout(() => {
        updateAccountingOptions();
        if (window.currentAccountingTransactions) fetchAccountingAnalysis(window.currentAccountingTransactions);
    }, 300);
};
window.refreshAccountingAnalysis = () => {
    if (window.currentAccountingTransactions) fetchAccountingAnalysis(window.currentAccountingTransactions);
};

window.showTaxOptimization = async () => {
    if (!window.currentAccountingTransactions) {
        alert('No transaction data available for tax optimization');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/tax-optimization`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions: window.currentAccountingTransactions })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success && data.tax_optimization) {
            displayTaxOptimizationModal(data.tax_optimization);
        } else {
            throw new Error(data.error || 'Tax optimization analysis failed');
        }
    } catch (error) {
        console.error('Tax optimization error:', error);
        alert('Tax optimization analysis failed: ' + error.message);
    }
};

function displayTaxOptimizationModal(data) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold">Tax-Loss Harvesting Optimization</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 class="font-medium text-green-800 mb-2">Optimal Method: ${data.optimal_method}</h4>
                <p class="text-sm text-green-700">Potential tax savings: $${(data.potential_savings || 0).toLocaleString()}</p>
            </div>
            
            <div class="space-y-4">
                <h4 class="font-medium text-gray-800">Tax-Loss Harvesting Recommendations:</h4>
                <ul class="space-y-2">
                    ${(data.recommendations || []).map(rec => `
                        <li class="flex items-start space-x-2">
                            <svg class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                            </svg>
                            <span class="text-sm text-gray-700">${rec}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4 border-t mt-4">
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                    Close
                </button>
                <button onclick="applyOptimalMethod('${data.optimal_method}')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    Apply ${data.optimal_method} Method
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function applyOptimalMethod(method) {
    const methodSelector = document.getElementById('accountingMethod');
    if (methodSelector) {
        methodSelector.value = method;
        window.updateAccountingAnalysis();
    }
    document.querySelector('.fixed.inset-0').remove();
}

window.handleOptimizationChange = () => {
    const optimization = document.getElementById('accountingOptimization')?.value;
    if (optimization === 'Tax-loss harvesting') {
        showTaxOptimization();
    } else if (optimization === 'Gain optimization') {
        showGainOptimization();
    }
};

function showGainOptimization() {
    alert('Gain optimization: Consider using LIFO method to realize higher-cost basis shares first, potentially reducing taxable gains.');
}
