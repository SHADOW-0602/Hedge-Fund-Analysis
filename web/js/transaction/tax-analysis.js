// Tax Analysis Module - Matches P&L Analysis UI Style
let currentTaxOptions = {
    tax_year: 'Current',
    holding_period: 'All',
    tax_rate: 'Federal',
    wash_sale: 'Include',
    harvesting: 'Opportunities'
};

let currentTaxController = null;

async function loadTaxAnalysis(transactions, options = {}) {
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

    if (!container && !options.background) {
        console.error('No suitable container found for tax analysis');
        return;
    }
    if (container) console.log('Tax analysis container found:', container.id);

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
        if (container && !options.background) {
            container.innerHTML = `
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Tax Analysis</h2>
                </div>
                <div class="text-center py-4 text-yellow-500">No transactions available for tax analysis</div>
            `;
        }
        return;
    }

    // Store transactions for refresh
    window.currentTaxTransactions = transactions;

    // Ensure container is visible
    if (container && !options.background) container.classList.remove('hidden');

    // Initial load - check for saved settings first
    try {
        const savedSettings = localStorage.getItem('taxSettings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            currentTaxOptions = { ...currentTaxOptions, ...parsed };
        }
    } catch (e) {
        console.error('Failed to load tax settings:', e);
    }

    await fetchTaxAnalysis(transactions, options);
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

    // Save to localStorage
    try {
        localStorage.setItem('taxSettings', JSON.stringify(currentTaxOptions));
    } catch (e) {
        console.error('Failed to save tax settings:', e);
    }
}

async function fetchTaxAnalysis(transactions, options = {}) {
    const container = document.getElementById('taxAnalysis') || (window.isIndividualTaxAnalysis ? document.getElementById('analysisContent') : null);
    if (!container && !options.background) return;

    // Validate transactions before proceeding
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        if (container && !options.background) {
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
        }
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
    if (container && !options.background) {
        container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Tax Analysis</h2>
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
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Year</label>
                    <select id="taxYear" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" onchange="updateTaxAnalysis()">
                        <option value="Current" ${currentTaxOptions.tax_year === 'Current' ? 'selected' : ''}>Current (${new Date().getFullYear()})</option>
                        <option value="Previous" ${currentTaxOptions.tax_year === 'Previous' ? 'selected' : ''}>Previous (${new Date().getFullYear() - 1})</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Holding Period</label>
                    <select id="holdingPeriod" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" onchange="updateTaxAnalysis()">
                        <option value="All" ${currentTaxOptions.holding_period === 'All' ? 'selected' : ''}>All</option>
                        <option value="Short" ${currentTaxOptions.holding_period === 'Short' ? 'selected' : ''}>Short-term (&lt;1Y)</option>
                        <option value="Long" ${currentTaxOptions.holding_period === 'Long' ? 'selected' : ''}>Long-term (&gt;1Y)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Rate</label>
                    <select id="taxRate" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" onchange="updateTaxAnalysis()">
                        <option value="Federal" ${currentTaxOptions.tax_rate === 'Federal' ? 'selected' : ''}>Federal Only</option>
                        <option value="State" ${currentTaxOptions.tax_rate === 'State' ? 'selected' : ''}>State Only</option>
                        <option value="Combined" ${currentTaxOptions.tax_rate === 'Combined' ? 'selected' : ''}>Combined</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wash Sale</label>
                    <select id="washSale" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" onchange="updateTaxAnalysis()">
                        <option value="Include" ${currentTaxOptions.wash_sale === 'Include' ? 'selected' : ''}>Include</option>
                        <option value="Exclude" ${currentTaxOptions.wash_sale === 'Exclude' ? 'selected' : ''}>Exclude</option>
                        <option value="Highlight" ${currentTaxOptions.wash_sale === 'Highlight' ? 'selected' : ''}>Highlight</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Harvesting</label>
                    <select id="harvesting" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" onchange="updateTaxAnalysis()">
                        <option value="Opportunities" ${currentTaxOptions.harvesting === 'Opportunities' ? 'selected' : ''}>Opportunities</option>
                        <option value="Realized" ${currentTaxOptions.harvesting === 'Realized' ? 'selected' : ''}>Realized</option>
                        <option value="Potential" ${currentTaxOptions.harvesting === 'Potential' ? 'selected' : ''}>Potential</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div id="taxContent" class="analysis-card p-12 text-center text-gray-900 dark:text-white">
            <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Processing Tax Analysis</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">Analyzing ${transactions?.length || 0} transactions for tax implications...</p>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4 max-w-md mx-auto">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Calculating gains, losses, and wash sales</p>
        </div>
    `;

    }

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
            signal: currentTaxController.signal
        });

        currentTaxController = null;
        console.log('Tax analysis response status:', response.status);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        console.log('Tax analysis response data:', data);

        if (data.success && data.tax_analysis) {
            console.log('Tax analysis successful, displaying results');
            if (!options.background) {
                displayTaxAnalysis(data.tax_analysis);
            } else {
                console.log('[Tax Analysis] Background load complete');
            }
        } else {
            console.error('Tax analysis API error:', data);
            if (!options.background) {
                showTaxError(data.error || 'No valid transactions found');
            }
        }
    } catch (error) {
        console.error('Tax Analysis error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        if (!options.background) {
            showTaxError(error.name === 'AbortError' ? 'Request timeout' : error.message);
        }
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
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Short-term Gains/Losses</h3>
                <p class="text-3xl font-bold ${shortTermGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                    ${shortTermGainLoss >= 0 ? '+' : ''}$${Math.abs(shortTermGainLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">≤1 year holding</p>
            </div>
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Long-term Gains/Losses</h3>
                <p class="text-3xl font-bold ${longTermGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                    ${longTermGainLoss >= 0 ? '+' : ''}$${Math.abs(longTermGainLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">&gt;1 year holding</p>
            </div>
            <div class="analysis-card p-6">
                <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Tax Liability</h3>
                <p class="text-3xl font-bold text-red-600 dark:text-red-400">
                    $${totalTaxLiability.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${effectiveTaxRate.toFixed(1)}% effective rate</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="analysis-card p-6">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Wash Sale Analysis</h3>
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600 dark:text-gray-400">Wash Sale Adjustments:</span>
                        <span class="font-semibold text-orange-600 dark:text-orange-400">$${washSaleAdjustments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600 dark:text-gray-400">Status:</span>
                        <span class="font-semibold ${washSaleAdjustments > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}">
                            ${washSaleAdjustments > 0 ? 'Wash Sales Detected' : 'No Wash Sales'}
                        </span>
                    </div>
                    ${washSaleAdjustments > 0 ? `
                        <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mt-3">
                            <p class="text-sm text-orange-800 dark:text-orange-300">
                                <strong>Warning:</strong> Wash sale rules apply. Consider waiting 31 days before repurchasing.
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="analysis-card p-6">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tax Loss Harvesting</h3>
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600 dark:text-gray-400">Harvestable Losses:</span>
                        <span class="font-semibold text-green-600 dark:text-green-400">$${harvestablelosses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600 dark:text-gray-400">Potential Tax Savings:</span>
                        <span class="font-semibold text-green-600 dark:text-green-400">$${(data.potential_tax_savings || harvestablelosses * 0.37).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    ${harvestablelosses > 0 ? `
                        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-3">
                            <p class="text-sm text-green-800 dark:text-green-300">
                                <strong>Opportunity:</strong> Consider harvesting losses to offset gains.
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>

        ${data.harvest_opportunities && data.harvest_opportunities.length > 0 ? `
            <div class="analysis-card p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Loss Harvesting Opportunities</h3>
                    <button onclick="showTaxLossHarvestingPopup()" 
                            class="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors text-sm">
                        View All (${data.harvest_opportunities.length})
                    </button>
                </div>
                <!-- Store data globally for the popup -->
                <script>
                    window.currentHarvestOpportunities = ${JSON.stringify(data.harvest_opportunities)};
                    window.currentPotentialSavings = ${data.potential_tax_savings || harvestablelosses * 0.37};
                </script>
                <div class="space-y-2">
                    ${data.harvest_opportunities.slice(0, 5).map(opp => `
                        <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                            <div>
                                <span class="font-medium text-gray-900 dark:text-white">${opp.symbol}</span>
                                <span class="text-sm text-gray-600 dark:text-gray-400 ml-2">${opp.quantity} shares @ $${opp.avg_cost.toFixed(2)}</span>
                            </div>
                            <div class="text-right">
                                <span class="font-semibold text-red-600 dark:text-red-400">-$${opp.unrealized_loss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <div class="text-sm text-gray-600 dark:text-gray-400">${opp.loss_percentage.toFixed(1)}% loss</div>
                            </div>
                        </div>
                    `).join('')}
                    ${data.harvest_opportunities.length > 5 ? `
                        <div class="text-center pt-2">
                             <span class="text-sm text-gray-500 italic">...and ${data.harvest_opportunities.length - 5} more positions</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : ''}

        <div class="analysis-card p-6">
            <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Tax Analysis Parameters</h4>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div><span class="text-gray-600 dark:text-gray-400">Tax Year:</span> <span class="font-medium text-gray-900 dark:text-white">${currentTaxOptions.tax_year}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">Holding Period:</span> <span class="font-medium text-gray-900 dark:text-white">${currentTaxOptions.holding_period}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">Tax Rate:</span> <span class="font-medium text-gray-900 dark:text-white">${currentTaxOptions.tax_rate}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">Wash Sale:</span> <span class="font-medium text-gray-900 dark:text-white">${currentTaxOptions.wash_sale}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">Harvesting:</span> <span class="font-medium text-gray-900 dark:text-white">${currentTaxOptions.harvesting}</span></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-2">
                <div><span class="text-gray-600 dark:text-gray-400">Analysis Year:</span> <span class="font-medium text-gray-900 dark:text-white">${data.tax_year || new Date().getFullYear()}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">Net Capital Gains:</span> <span class="font-medium text-gray-900 dark:text-white">$${(data.net_capital_gains || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div><span class="text-gray-600 dark:text-gray-400">Short-term Tax:</span> <span class="font-medium text-gray-900 dark:text-white">$${(data.short_term_tax || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
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
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-red-600 dark:text-red-400">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-xl font-semibold mb-2">Tax Analysis Error</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">${message}</p>
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
// Tax Loss Harvesting Popup Functions
window.showTaxLossHarvestingPopup = () => {
    const opportunities = window.currentHarvestOpportunities || [];
    const potentialSavings = window.currentPotentialSavings || 0;

    const popup = document.createElement('div');
    popup.id = 'taxLossHarvestingPopup';
    popup.className = 'fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-center justify-center';
    popup.innerHTML = `
        <div class="relative mx-auto p-5 border w-full max-w-5xl shadow-lg rounded-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Tax-Loss Harvesting Opportunities</h3>
                <button onclick="closeTaxLossHarvestingPopup()" class="text-gray-400 hover:text-gray-500 focus:outline-none">
                    <span class="sr-only">Close</span>
                    <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div class="flex flex-col md:flex-row justify-between items-center">
                    <div>
                         <p class="text-sm text-blue-800 dark:text-blue-300 font-medium">Potential Tax Savings</p>
                         <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">$${potentialSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                     <div>
                         <p class="text-sm text-blue-800 dark:text-blue-300 font-medium">Total Opportunities</p>
                         <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">${opportunities.length}</p>
                    </div>
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Cost</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Price</th>
                            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unrealized Loss</th>
                            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">% Loss</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        ${opportunities.map(opp => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${opp.symbol}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${opp.quantity}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">$${opp.avg_cost.toFixed(2)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">$${opp.current_price.toFixed(2)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 dark:text-red-400">-$${opp.unrealized_loss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">${opp.loss_percentage.toFixed(1)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="mt-6 flex justify-end space-x-3">
                <button onclick="closeTaxLossHarvestingPopup()" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600">Close</button>
                 <button onclick="applyFifoMethod()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    Go to Accounting Analysis (FIFO/LIFO)
                </button>
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