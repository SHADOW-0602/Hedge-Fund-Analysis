// Drawdown Analysis Module
window.loadDrawdownAnalysis = function(transactions) {
    console.log('Loading drawdown analysis with', transactions?.length || 0, 'transactions');
    
    if (!transactions || transactions.length === 0) {
        console.log('No transactions available for drawdown analysis');
        window.analyticsCore.showDataSourceSelection('transaction');
        return;
    }

    // Show container and loading state
    const container = document.getElementById('analysisContent');
    if (container) {
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Drawdown Analysis</h2>
            </div>
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p class="text-gray-600">Analyzing portfolio drawdowns...</p>
            </div>
        `;
    }

    // Get current settings or use defaults
    const settings = window.getDrawdownSettings();
    
    // Make API call
    const API_BASE = window.API_BASE || 'http://127.0.0.1:8080';
    fetch(`${API_BASE}/api/drawdown-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            transactions: transactions,
            options: settings
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Drawdown analysis response:', data);
        if (data.success) {
            displayDrawdownResults(data.drawdown_analysis, settings);
        } else {
            throw new Error(data.error || 'Analysis failed');
        }
    })
    .catch(error => {
        console.error('Drawdown analysis error:', error);
        if (container) {
            container.innerHTML = `
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">Drawdown Analysis</h2>
                </div>
                <div class="text-center py-8 text-red-600">
                    <p class="font-semibold">Analysis Failed</p>
                    <p class="text-sm mt-2">${error.message}</p>
                </div>
            `;
        }
    });
};

window.getDrawdownSettings = function() {
    // Load from localStorage first
    const savedSettings = JSON.parse(localStorage.getItem('drawdownSettings') || '{}');
    const stored = window.drawdownStoredSettings || savedSettings || {};
    return {
        period: document.getElementById('drawdownPeriod')?.value || stored.period || '1Y',
        frequency: document.getElementById('drawdownFrequency')?.value || stored.frequency || 'Daily',
        severity_filter: document.getElementById('drawdownSeverity')?.value || stored.severity || 'All',
        comparison: document.getElementById('drawdownComparison')?.value || stored.comparison || 'None'
    };
};

function displayDrawdownResults(result, options) {
    console.log('[DEBUG] displayDrawdownResults called with:', result, options);
    console.log('[DEBUG] Result type:', typeof result);
    console.log('[DEBUG] Result keys:', result ? Object.keys(result) : 'null/undefined');
    
    const container = document.getElementById('analysisContent');
    if (!container) {
        console.error('[DEBUG] analysisContent container not found');
        return;
    }
    console.log('[DEBUG] Container found:', container);

    const drawdownPeriods = result.drawdown_periods || [];
    const severityBreakdown = result.severity_breakdown || {};
    const recoveryAnalysis = result.recovery_analysis || {};
    const summary = result.summary || {};
    
    console.log('[DEBUG] Extracted drawdown data:');
    console.log('[DEBUG] - drawdownPeriods:', drawdownPeriods);
    console.log('[DEBUG] - severityBreakdown:', severityBreakdown);
    console.log('[DEBUG] - recoveryAnalysis:', recoveryAnalysis);
    console.log('[DEBUG] - summary:', summary);
    console.log('[DEBUG] About to set container innerHTML...');
    console.log('[DEBUG] Container element:', container);
    console.log('[DEBUG] Container classes:', container.className);
    console.log('[DEBUG] Container parent:', container.parentElement);

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Drawdown Analysis</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleDrawdownSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    Settings
                </button>
                <button onclick="updateDrawdownAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Refresh
                </button>

            </div>
        </div>

        <!-- Settings Panel -->
        <div id="drawdownSettings" class="settings-panel hidden mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select id="drawdownPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateDrawdownAnalysis()">
                        <option value="3M" ${(options.period || window.drawdownStoredSettings?.period) === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${(options.period || window.drawdownStoredSettings?.period) === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${(options.period || window.drawdownStoredSettings?.period || '1Y') === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="2Y" ${(options.period || window.drawdownStoredSettings?.period) === '2Y' ? 'selected' : ''}>2 Years</option>
                        <option value="All Time" ${(options.period || window.drawdownStoredSettings?.period) === 'All Time' ? 'selected' : ''}>All Time</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <select id="drawdownFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateDrawdownAnalysis()">
                        <option value="Daily" ${(options.frequency || window.drawdownStoredSettings?.frequency || 'Daily') === 'Daily' ? 'selected' : ''}>Daily</option>
                        <option value="Weekly" ${(options.frequency || window.drawdownStoredSettings?.frequency) === 'Weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="Monthly" ${(options.frequency || window.drawdownStoredSettings?.frequency) === 'Monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                    <select id="drawdownSeverity" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateDrawdownAnalysis()">
                        <option value="All" ${(options.severity || window.drawdownStoredSettings?.severity || 'All') === 'All' ? 'selected' : ''}>All</option>
                        <option value="<5%" ${(options.severity || window.drawdownStoredSettings?.severity) === '<5%' ? 'selected' : ''}>&lt;5%</option>
                        <option value="5-10%" ${(options.severity || window.drawdownStoredSettings?.severity) === '5-10%' ? 'selected' : ''}>5-10%</option>
                        <option value="10-20%" ${(options.severity || window.drawdownStoredSettings?.severity) === '10-20%' ? 'selected' : ''}>10-20%</option>
                        <option value=">20%" ${(options.severity || window.drawdownStoredSettings?.severity) === '>20%' ? 'selected' : ''}>&gt;20%</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Comparison</label>
                    <select id="drawdownComparison" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateDrawdownAnalysis()">
                        <option value="None" ${(options.comparison || window.drawdownStoredSettings?.comparison || 'None') === 'None' ? 'selected' : ''}>None</option>
                        <option value="vs Benchmark" ${(options.comparison || window.drawdownStoredSettings?.comparison) === 'vs Benchmark' ? 'selected' : ''}>vs Benchmark</option>
                        <option value="vs Market" ${(options.comparison || window.drawdownStoredSettings?.comparison) === 'vs Market' ? 'selected' : ''}>vs Market</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="space-y-6">
            <!-- Key Metrics -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="details-box">
                    <h4 class="section-header">Max Drawdown</h4>
                    <p class="text-2xl font-bold metric-value ${summary.max_drawdown > 10 ? 'negative' : 'neutral'}">${summary.max_drawdown || 0}%</p>
                </div>
                <div class="details-box">
                    <h4 class="section-header">Total Periods</h4>
                    <p class="text-2xl font-bold metric-value neutral">${summary.total_periods || 0}</p>
                </div>
                <div class="details-box">
                    <h4 class="section-header">Avg Duration</h4>
                    <p class="text-2xl font-bold metric-value neutral">${summary.avg_duration_days || 0} days</p>
                </div>
                <div class="details-box">
                    <h4 class="section-header">Avg Recovery</h4>
                    <p class="text-2xl font-bold metric-value neutral">${recoveryAnalysis.avg_recovery_days || 0} days</p>
                </div>
            </div>

            <!-- Drawdown Periods -->
            <div class="grid grid-cols-1 gap-6">
                <div class="details-box">
                    <h4 class="section-header">Drawdown Periods (${drawdownPeriods.length} found)</h4>
                    ${drawdownPeriods.length > 0 ? `
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Max DD</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recovery</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    ${drawdownPeriods.slice(0, 10).map(period => `
                                        <tr>
                                            <td class="px-3 py-2 text-sm text-gray-900">${period.start_date}</td>
                                            <td class="px-3 py-2 text-sm text-gray-900">${period.end_date}</td>
                                            <td class="px-3 py-2 text-sm font-medium ${period.max_drawdown > 10 ? 'text-red-600' : 'text-gray-900'}">${period.max_drawdown}%</td>
                                            <td class="px-3 py-2 text-sm text-gray-900">${period.duration_days} days</td>
                                            <td class="px-3 py-2 text-sm text-gray-900">${period.recovery_days ? period.recovery_days + ' days' : 'Ongoing'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            ${drawdownPeriods.length > 10 ? `<p class="text-sm text-gray-500 mt-2">Showing first 10 of ${drawdownPeriods.length} periods</p>` : ''}
                        </div>
                    ` : '<p class="text-gray-500">No significant drawdown periods found</p>'}
                </div>

                <!-- Recovery Analysis -->
                <div class="details-box">
                    <h4 class="section-header">Recovery Analysis</h4>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="detail-label">Avg Recovery:</span>
                            <span class="detail-value">${recoveryAnalysis.avg_recovery_days || 0} days</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="detail-label">Max Recovery:</span>
                            <span class="detail-value">${recoveryAnalysis.max_recovery_days || 0} days</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="detail-label">Total Periods:</span>
                            <span class="detail-value">${summary.total_periods || 0}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="detail-label">Period:</span>
                            <span class="detail-value">${options.period || '1Y'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Severity Breakdown -->
            <div class="details-box">
                <h4 class="section-header">Severity Breakdown</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="text-center">
                        <p class="text-lg font-semibold text-green-600">${severityBreakdown['<5%'] || 0}</p>
                        <p class="text-sm text-gray-600">Mild (&lt;5%)</p>
                    </div>
                    <div class="text-center">
                        <p class="text-lg font-semibold text-yellow-600">${severityBreakdown['5-10%'] || 0}</p>
                        <p class="text-sm text-gray-600">Moderate (5-10%)</p>
                    </div>
                    <div class="text-center">
                        <p class="text-lg font-semibold text-orange-600">${severityBreakdown['10-20%'] || 0}</p>
                        <p class="text-sm text-gray-600">Severe (10-20%)</p>
                    </div>
                    <div class="text-center">
                        <p class="text-lg font-semibold text-red-600">${severityBreakdown['>20%'] || 0}</p>
                        <p class="text-sm text-gray-600">Extreme (&gt;20%)</p>
                    </div>
                </div>
            </div>


        </div>
    `;
}

// Expose globally
window.displayDrawdownResults = displayDrawdownResults;

// Settings functions
window.toggleDrawdownSettings = () => {
    const settings = document.getElementById('drawdownSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateDrawdownAnalysis = () => {
    // Store current settings
    window.drawdownStoredSettings = {
        period: document.getElementById('drawdownPeriod')?.value || '1Y',
        frequency: document.getElementById('drawdownFrequency')?.value || 'Daily',
        severity: document.getElementById('drawdownSeverity')?.value || 'All',
        comparison: document.getElementById('drawdownComparison')?.value || 'None'
    };
    
    // Save to localStorage
    localStorage.setItem('drawdownSettings', JSON.stringify(window.drawdownStoredSettings));
    
    const transactions = window.currentTransactions || [];
    if (transactions.length === 0) {
        console.log('No transactions available for update');
        return;
    }
    window.loadDrawdownAnalysis(transactions);
};