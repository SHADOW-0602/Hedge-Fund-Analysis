// Tax Analysis Module - Matches P&L Analysis UI Style
let currentTaxOptions = {
    tax_year: 'Current',
    holding_period: 'All',
    tax_rate: 'Federal',
    wash_sale: 'Include',
    harvesting: 'Opportunities'
};

let currentTaxController = null;

async function loadTaxAnalysis(transactions) {
    console.log('=== TAX ANALYSIS DEBUG ===');
    console.log('loadTaxAnalysis called with:', transactions?.length || 0, 'transactions');
    console.log('Sample transaction:', transactions?.[0]);
    console.log('Individual tax analysis mode:', window.isIndividualTaxAnalysis);

    // Use analysisContent container for individual analysis, taxAnalysis for embedded
    let container;
    if (window.isIndividualTaxAnalysis) {
        container = document.getElementById('analysisContent');
        console.log('Using analysisContent for individual tax analysis');
    } else {
        container = document.getElementById('taxAnalysis');
        console.log('Using taxAnalysis for embedded tax analysis');
    }

    if (!container) {
        console.error('No suitable container found for tax analysis');
        return;
    }
    console.log('Tax analysis container found:', container.id);

    // Ensure API_BASE is defined
    if (typeof API_BASE === 'undefined') {
        window.API_BASE = window.location.origin;
        console.log('API_BASE not defined, using:', window.API_BASE);
    }

    console.log('Tax Analysis Debug Info:');
    console.log('- Container found:', !!container);
    console.log('- API_BASE:', window.API_BASE || API_BASE);
    console.log('- Transactions count:', transactions?.length || 0);
    console.log('- Current options:', currentTaxOptions);

    // Validate transactions
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        console.log('No valid transactions for tax analysis');
        container.innerHTML = '<div class="text-center py-4 text-yellow-500">No transactions available for tax analysis</div>';
        return;
    }

    // Store transactions for refresh
    window.currentTaxTransactions = transactions;

    // Ensure container is visible
    container.classList.remove('hidden');

    // Initial load
    await fetchTaxAnalysis(transactions);
}

function updateTaxOptions() {
    const newOptions = {
        tax_year: document.getElementById('taxYear')?.value || 'Current',
        holding_period: document.getElementById('holdingPeriod')?.value || 'All',
        tax_rate: document.getElementById('taxRate')?.value || 'Federal',
        wash_sale: document.getElementById('washSale')?.value || 'Include',
        harvesting: document.getElementById('harvesting')?.value || 'Opportunities'
    };
    
    console.log('Updating tax options from:', currentTaxOptions, 'to:', newOptions);
    currentTaxOptions = newOptions;
}

async function fetchTaxAnalysis(transactions) {
    const container = document.getElementById('taxAnalysis');
    if (!container) return;

    // Validate transactions before proceeding
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        const headerSection = window.isIndividualTaxAnalysis ? `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Tax Analysis</h2>
            </div>
        ` : '';
        
        container.innerHTML = `
            ${headerSection}
            <div class="text-center py-8 text-yellow-500">
                <svg class="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                </svg>
                <p class="text-lg font-medium">No transactions available for tax analysis</p>
                <p class="text-sm text-gray-500 mt-2">Upload transaction data to see tax implications</p>
            </div>
        `;
        return;
    }

    // Preserve settings state and values if they exist
    const settingsPanel = document.getElementById('taxSettings');
    const settingsHidden = settingsPanel ? settingsPanel.classList.contains('hidden') : true;
    
    // Update current options from existing form values before regenerating HTML
    if (settingsPanel) {
        updateTaxOptions();
    }

    // Show loading state with full UI - match P&L Analysis structure
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Tax Analysis</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleTaxSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
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
        
        <!-- Tax Settings Panel -->
        <div id="taxSettings" class="settings-panel ${settingsHidden ? 'hidden' : ''} mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tax Year</label>
                    <select id="taxYear" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTaxAnalysis()">
                        <option value="Current" ${currentTaxOptions.tax_year === 'Current' ? 'selected' : ''}>Current (${new Date().getFullYear()})</option>
                        <option value="Previous" ${currentTaxOptions.tax_year === 'Previous' ? 'selected' : ''}>Previous (${new Date().getFullYear() - 1})</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Holding Period</label>
                    <select id="holdingPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTaxAnalysis()">
                        <option value="All" ${currentTaxOptions.holding_period === 'All' ? 'selected' : ''}>All</option>
                        <option value="Short" ${currentTaxOptions.holding_period === 'Short' ? 'selected' : ''}>Short-term (&lt;1Y)</option>
                        <option value="Long" ${currentTaxOptions.holding_period === 'Long' ? 'selected' : ''}>Long-term (&gt;1Y)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tax Rate</label>
                    <select id="taxRate" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTaxAnalysis()">
                        <option value="Federal" ${currentTaxOptions.tax_rate === 'Federal' ? 'selected' : ''}>Federal Only</option>
                        <option value="State" ${currentTaxOptions.tax_rate === 'State' ? 'selected' : ''}>State Only</option>
                        <option value="Combined" ${currentTaxOptions.tax_rate === 'Combined' ? 'selected' : ''}>Combined</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Wash Sale</label>
                    <select id="washSale" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTaxAnalysis()">
                        <option value="Include" ${currentTaxOptions.wash_sale === 'Include' ? 'selected' : ''}>Include</option>
                        <option value="Exclude" ${currentTaxOptions.wash_sale === 'Exclude' ? 'selected' : ''}>Exclude</option>
                        <option value="Highlight" ${currentTaxOptions.wash_sale === 'Highlight' ? 'selected' : ''}>Highlight</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Harvesting</label>
                    <select id="harvesting" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTaxAnalysis()">
                        <option value="Opportunities" ${currentTaxOptions.harvesting === 'Opportunities' ? 'selected' : ''}>Opportunities</option>
                        <option value="Realized" ${currentTaxOptions.harvesting === 'Realized' ? 'selected' : ''}>Realized</option>
                        <option value="Potential" ${currentTaxOptions.harvesting === 'Potential' ? 'selected' : ''}>Potential</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div id="taxContent" class="bg-white rounded-lg shadow p-12 text-center">
            <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Processing Tax Analysis</h3>
            <p class="text-gray-600 mb-4">Analyzing ${transactions?.length || 0} transactions for tax implications...</p>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
            </div>
            <p class="text-sm text-gray-500">Calculating gains, losses, and wash sales</p>
        </div>
    `;

    try {
        console.log('Making Tax Analysis API call with options:', currentTaxOptions);

        currentTaxController = new AbortController();

        const apiUrl = `${window.API_BASE || API_BASE}/api/tax-analysis`;
        console.log('Full API URL:', apiUrl);
        console.log('Making request to:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions: transactions, options: currentTaxOptions }),

        });

        currentTaxController = null;
        console.log('Tax analysis response status:', response.status);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        console.log('Tax analysis response data:', data);

        if (data.success && data.tax_analysis) {
            console.log('Tax analysis successful, displaying results');
            displayTaxAnalysis(data.tax_analysis);
        } else {
            console.error('Tax analysis API error:', data);
            showTaxError(data.error || 'No valid transactions found');
        }
    } catch (error) {
        console.error('Tax Analysis error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        showTaxError(error.name === 'AbortError' ? 'Request timeout' : error.message);
    }
}

function displayTaxAnalysis(data) {
    console.log('=== DISPLAYING TAX ANALYSIS ===');
    console.log('displayTaxAnalysis called with data:', data);

    const contentDiv = document.getElementById('taxContent');
    if (!contentDiv) {
        console.error('taxContent container not found in displayTaxAnalysis');
    }
    console.log('About to update content div with tax analysis results');

    // Update the main container's button to Refresh (this is outside contentDiv)
    // Only add refresh button if we're in individual tax analysis mode, not embedded
    const container = document.getElementById('taxAnalysis');
    if (container && window.isIndividualTaxAnalysis) {
        const buttonContainer = container.querySelector('.flex.items-center.space-x-2');
        if (buttonContainer) {
            // Keep the settings button, replace the analyzing button
            const settingsBtn = buttonContainer.querySelector('button:first-child');
            buttonContainer.innerHTML = '';
            if (settingsBtn) buttonContainer.appendChild(settingsBtn);

            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center ml-2';
            refreshBtn.onclick = refreshTaxAnalysis;
            refreshBtn.innerHTML = `
                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                </svg>
                Refresh
            `;
            buttonContainer.appendChild(refreshBtn);
        }
    }

    const shortTermGainLoss = data.short_term_gain_loss || 0;
    const longTermGainLoss = data.long_term_gain_loss || 0;
    const totalTaxLiability = data.total_tax_liability || 0;
    const washSaleAdjustments = data.wash_sale_adjustments || 0;
    const effectiveTaxRate = data.effective_tax_rate || 0;
    const harvestablelosses = data.harvestable_losses || 0;

    contentDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Short-term Gains/Losses</h3>
                <p class="text-3xl font-bold ${shortTermGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${shortTermGainLoss >= 0 ? '+' : ''}$${Math.abs(shortTermGainLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-600 mt-1">≤1 year holding</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Long-term Gains/Losses</h3>
                <p class="text-3xl font-bold ${longTermGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${longTermGainLoss >= 0 ? '+' : ''}$${Math.abs(longTermGainLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-600 mt-1">&gt;1 year holding</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Tax Liability</h3>
                <p class="text-3xl font-bold text-red-600">
                    $${totalTaxLiability.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-600 mt-1">${effectiveTaxRate.toFixed(1)}% effective rate</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Wash Sale Analysis</h3>
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Wash Sale Adjustments:</span>
                        <span class="font-semibold text-orange-600">$${washSaleAdjustments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Status:</span>
                        <span class="font-semibold ${washSaleAdjustments > 0 ? 'text-orange-600' : 'text-green-600'}">
                            ${washSaleAdjustments > 0 ? 'Wash Sales Detected' : 'No Wash Sales'}
                        </span>
                    </div>
                    ${washSaleAdjustments > 0 ? `
                        <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-3">
                            <p class="text-sm text-orange-800">
                                <strong>Warning:</strong> Wash sale rules apply. Consider waiting 31 days before repurchasing.
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Tax Loss Harvesting</h3>
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Harvestable Losses:</span>
                        <span class="font-semibold text-green-600">$${harvestablelosses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">Potential Tax Savings:</span>
                        <span class="font-semibold text-green-600">$${(data.potential_tax_savings || harvestablelosses * 0.37).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    ${harvestablelosses > 0 ? `
                        <div class="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                            <p class="text-sm text-green-800">
                                <strong>Opportunity:</strong> Consider harvesting losses to offset gains.
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>

        ${data.harvest_opportunities && data.harvest_opportunities.length > 0 ? `
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">Loss Harvesting Opportunities</h3>
                    <button onclick="showTaxLossHarvestingPopup(${JSON.stringify(data.harvest_opportunities).replace(/"/g, '&quot;')}, ${data.potential_tax_savings || harvestablelosses * 0.37})" 
                            class="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors text-sm">
                        Optimize
                    </button>
                </div>
                <div class="space-y-2">
                    ${data.harvest_opportunities.map(opp => `
                        <div class="flex justify-between items-center py-2 border-b border-gray-200">
                            <div>
                                <span class="font-medium text-gray-900">${opp.symbol}</span>
                                <span class="text-sm text-gray-500 ml-2">${opp.quantity} shares @ $${opp.avg_cost.toFixed(2)}</span>
                            </div>
                            <div class="text-right">
                                <span class="font-semibold text-red-600">-$${opp.unrealized_loss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <div class="text-sm text-gray-500">${opp.loss_percentage.toFixed(1)}% loss</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        <div class="bg-gray-50 rounded-lg p-6">
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Tax Analysis Parameters</h4>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div><span class="text-gray-600">Tax Year:</span> <span class="font-medium text-gray-900">${currentTaxOptions.tax_year}</span></div>
                <div><span class="text-gray-600">Holding Period:</span> <span class="font-medium text-gray-900">${currentTaxOptions.holding_period}</span></div>
                <div><span class="text-gray-600">Tax Rate:</span> <span class="font-medium text-gray-900">${currentTaxOptions.tax_rate}</span></div>
                <div><span class="text-gray-600">Wash Sale:</span> <span class="font-medium text-gray-900">${currentTaxOptions.wash_sale}</span></div>
                <div><span class="text-gray-600">Harvesting:</span> <span class="font-medium text-gray-900">${currentTaxOptions.harvesting}</span></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-2">
                <div><span class="text-gray-600">Analysis Year:</span> <span class="font-medium text-gray-900">${data.tax_year || new Date().getFullYear()}</span></div>
                <div><span class="text-gray-600">Net Capital Gains:</span> <span class="font-medium text-gray-900">$${(data.net_capital_gains || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div><span class="text-gray-600">Short-term Tax:</span> <span class="font-medium text-gray-900">$${(data.short_term_tax || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            </div>
        </div>
    `;

    console.log('Tax analysis HTML updated successfully');
}
function showTaxError(message) {
    console.log('Showing tax error:', message);
    let container = document.getElementById('taxAnalysis');
    if (!container) {
        container = document.getElementById('analysisContent');
    }
    if (container) {
        // Only show retry button in header if in individual mode
        const headerButton = window.isIndividualTaxAnalysis ? `
            <div class="flex justify-end items-center mb-6">
                <button onclick="refreshTaxAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm">
                    Retry
                </button>
            </div>
        ` : '';
        
        container.innerHTML = `
            ${headerButton}
            <div class="bg-white rounded-lg shadow p-8 text-center text-red-600">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl font-semibold mb-2">Tax Analysis Error</p>
                <p class="text-sm text-gray-600">${message}</p>
                <button onclick="refreshTaxAnalysis()" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                    Try Again
                </button>
            </div>
        `;
    } else {
        console.error('No suitable container found for tax analysis error display');
    }
}

// Global functions - ensure they're available immediately
if (typeof window.loadTaxAnalysis === 'undefined') {
    window.loadTaxAnalysis = loadTaxAnalysis;
}
if (typeof window.displayTaxAnalysis === 'undefined') {
    window.displayTaxAnalysis = displayTaxAnalysis;
}
window.toggleTaxSettings = () => document.getElementById('taxSettings')?.classList.toggle('hidden');
window.updateTaxAnalysis = () => {
    console.log('updateTaxAnalysis called');
    updateTaxOptions();
    console.log('Updated options:', currentTaxOptions);
    if (window.currentTaxTransactions) {
        fetchTaxAnalysis(window.currentTaxTransactions);
    } else {
        console.error('No current tax transactions available');
    }
};
window.refreshTaxAnalysis = () => {
    console.log('Refreshing tax analysis...');
    if (window.currentTaxTransactions) {
        fetchTaxAnalysis(window.currentTaxTransactions);
    } else {
        console.error('No current tax transactions available for refresh');
        showTaxError('No transaction data available. Please reload the page.');
    }
};

// Tax Loss Harvesting Popup Functions
window.showTaxLossHarvestingPopup = (opportunities, potentialSavings) => {
    const popup = document.createElement('div');
    popup.id = 'taxLossHarvestingPopup';
    popup.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    popup.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 class="text-xl font-bold text-gray-900">Tax-Loss Harvesting Optimization</h2>
                <button onclick="closeTaxLossHarvestingPopup()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            
            <div class="p-6">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 class="text-lg font-semibold text-blue-900 mb-2">Optimization Summary</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="text-center">
                            <p class="text-2xl font-bold text-blue-600">$${potentialSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p class="text-sm text-blue-700">Potential tax savings</p>
                        </div>
                        <div class="text-center">
                            <p class="text-2xl font-bold text-green-600">${opportunities.length}</p>
                            <p class="text-sm text-green-700">Opportunities identified</p>
                        </div>
                        <div class="text-center">
                            <p class="text-2xl font-bold text-purple-600">$0</p>
                            <p class="text-sm text-purple-700">Estimated wash sale risk</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg border border-gray-200">
                    <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <h4 class="text-lg font-semibold text-gray-900">Tax-Loss Harvesting Recommendations:</h4>
                    </div>
                    <div class="p-4">
                        <div class="space-y-3">
                            <div class="flex items-center text-green-600">
                                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                                Switch to FIFO accounting method for optimal tax efficiency
                            </div>
                            <div class="flex items-center text-green-600">
                                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                                Consider harvesting tax losses before year-end
                            </div>
                            <div class="flex items-center text-green-600">
                                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                                Review holding periods to maximize long-term capital gains treatment
                            </div>
                        </div>
                        
                        <div class="mt-6 flex justify-end space-x-3">
                            <button onclick="closeTaxLossHarvestingPopup()" class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onclick="applyFifoMethod()" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                                Apply FIFO Method
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
};

window.closeTaxLossHarvestingPopup = () => {
    const popup = document.getElementById('taxLossHarvestingPopup');
    if (popup) {
        popup.remove();
    }
};

window.togglePopupSettings = () => {
    const settings = document.getElementById('popupTaxSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.applyFifoMethod = () => {
    // Close the popup
    closeTaxLossHarvestingPopup();
    
    // Switch to FIFO/LIFO accounting analysis
    if (window.analyticsManager && window.analyticsManager.loadModule) {
        window.analyticsManager.loadModule('accounting-analysis');
    } else {
        // Fallback: trigger sidebar click for accounting analysis
        const accountingBtn = document.querySelector('[data-analysis="accounting-analysis"]');
        if (accountingBtn) {
            accountingBtn.click();
        }
    }
};