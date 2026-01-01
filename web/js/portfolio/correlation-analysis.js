// Interactive Correlation Analysis Module - Matches P&L Attribution UI Style
let currentCorrelationOptions = {
    period: '1Y',
    frequency: 'Daily',
    method: 'pearson',
    rolling_window: '30d'
};

window.loadCorrelationAnalysis = function (portfolioData, options = {}) {
    // Load settings from localStorage
    try {
        const savedSettings = localStorage.getItem('correlationAnalysisSettings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            currentCorrelationOptions = { ...currentCorrelationOptions, ...parsed };
            console.log('[CORRELATION] Loaded settings from storage:', currentCorrelationOptions);
        }
    } catch (e) {
        console.error('Failed to load correlation settings:', e);
    }

    // Ensure analyticsCore has these settings
    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.correlationOptions = currentCorrelationOptions;

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('correlation-analysis');
    }
};

// Display function for correlation analysis
window.displayCorrelationAnalysisResults = function (result, options) {
    const container = document.getElementById('analysisContent');
    if (!container) return;

    container.classList.remove('hidden');

    console.log('[CORRELATION] Raw result received:', result);
    console.log('[CORRELATION] Options received:', options);

    // Handle the actual API response structure
    let correlationData, correlation, summary;

    if (result.correlation_analysis) {
        // API response format: { success: true, correlation_analysis: {...} }
        correlationData = result.correlation_analysis;
        correlation = correlationData.correlation_matrix || {};
        summary = correlationData.summary || {};
    } else if (result.summary && result.options) {
        // Analytics manager format: { summary: {...}, options: {...} }
        summary = result.summary;
        correlation = result.correlation_matrix || {};
        correlationData = result;
    } else {
        // Direct format
        correlationData = result;
        correlation = result.correlation_matrix || {};
        summary = result.summary || {};
    }

    console.log('[CORRELATION] Processed data:', { correlationData, correlation, summary });

    // Update current options from result or passed options
    currentCorrelationOptions = {
        period: options?.period || summary.period || currentCorrelationOptions.period,
        frequency: options?.frequency || summary.frequency || currentCorrelationOptions.frequency,
        method: options?.method || summary.method || currentCorrelationOptions.method,
        rolling_window: options?.rolling_window || currentCorrelationOptions.rolling_window
    };

    // Get symbols for matrix display
    const symbols = Object.keys(correlation);
    console.log('[CORRELATION] Symbols found:', symbols);

    // If no correlation data, show error with debug info
    if (symbols.length === 0) {
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Correlation Analysis - DEBUG MODE</h2>
                <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
            <div class="analysis-card p-8">
                <h3 class="text-lg font-bold text-red-600 mb-4">DEBUG: No correlation data found</h3>
                <div class="space-y-3 text-sm">
                    <div><strong>Raw result:</strong> <pre class="bg-gray-100 p-2 rounded text-xs overflow-auto">${JSON.stringify(result, null, 2)}</pre></div>
                    <div><strong>Result keys:</strong> ${Object.keys(result).join(', ')}</div>
                    <div><strong>Result type:</strong> ${typeof result}</div>
                    <div><strong>Has correlation_analysis:</strong> ${!!result.correlation_analysis}</div>
                    <div><strong>Has summary:</strong> ${!!result.summary}</div>
                    <div><strong>Has options:</strong> ${!!result.options}</div>
                    <div><strong>Correlation matrix:</strong> ${JSON.stringify(correlation)}</div>
                    <div><strong>Summary data:</strong> ${JSON.stringify(summary)}</div>
                    <div><strong>Symbols found:</strong> ${symbols.length} (${symbols.join(', ')})</div>
                    <div><strong>Options passed:</strong> ${JSON.stringify(options)}</div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Correlation Analysis</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleCorrelationSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    Settings
                </button>
                <button onclick="updateCorrelationAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Refresh
                </button>
                <button onclick="hideAnalysisContent()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        </div>
        
        <!-- Correlation Settings Panel -->
        <div id="correlationSettings" class="settings-panel hidden mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select id="correlationPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                        <option value="1M" ${currentCorrelationOptions.period === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${currentCorrelationOptions.period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentCorrelationOptions.period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentCorrelationOptions.period === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="2Y" ${currentCorrelationOptions.period === '2Y' ? 'selected' : ''}>2 Years</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <select id="correlationFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                        <option value="Daily" ${currentCorrelationOptions.frequency === 'Daily' ? 'selected' : ''}>Daily</option>
                        <option value="Weekly" ${currentCorrelationOptions.frequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="Monthly" ${currentCorrelationOptions.frequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Method</label>
                    <select id="correlationMethod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                        <option value="pearson" ${currentCorrelationOptions.method === 'pearson' ? 'selected' : ''}>Pearson</option>
                        <option value="spearman" ${currentCorrelationOptions.method === 'spearman' ? 'selected' : ''}>Spearman</option>
                        <option value="kendall" ${currentCorrelationOptions.method === 'kendall' ? 'selected' : ''}>Kendall</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Rolling Window</label>
                    <select id="correlationRollingWindow" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                        <option value="30d" ${currentCorrelationOptions.rolling_window === '30d' ? 'selected' : ''}>30 days</option>
                        <option value="60d" ${currentCorrelationOptions.rolling_window === '60d' ? 'selected' : ''}>60 days</option>
                        <option value="90d" ${currentCorrelationOptions.rolling_window === '90d' ? 'selected' : ''}>90 days</option>
                        <option value="252d" ${currentCorrelationOptions.rolling_window === '252d' ? 'selected' : ''}>252 days</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="space-y-6">
            <!-- Summary Statistics -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Average Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.average_correlation || 0) > 0.7 ? 'text-red-600' : (summary.average_correlation || 0) > 0.3 ? 'text-yellow-600' : 'text-green-600'}">
                        ${window.analyticsCore.formatNumber(summary.average_correlation || 0)}
                    </p>
                    <p class="text-sm text-secondary mt-1">${(summary.average_correlation || 0) > 0.7 ? 'High correlation' : (summary.average_correlation || 0) > 0.3 ? 'Moderate correlation' : 'Low correlation'}</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Max Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.max_correlation || 0) > 0.8 ? 'text-red-600' : 'text-blue-600'}">
                        ${window.analyticsCore.formatNumber(summary.max_correlation || 0)}
                    </p>
                    <p class="text-sm text-secondary mt-1">Highest pair correlation</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Min Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.min_correlation || 0) < -0.3 ? 'text-green-600' : 'text-blue-600'}">
                        ${window.analyticsCore.formatNumber(summary.min_correlation || 0)}
                    </p>
                    <p class="text-sm text-secondary mt-1">Lowest pair correlation</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Data Points</h3>
                    <p class="text-3xl font-bold text-blue-600">
                        ${summary.data_points || 'N/A'}
                    </p>
                    <p class="text-sm text-secondary mt-1">${symbols.length} symbols analyzed</p>
                </div>
            </div>
            
            <!-- Correlation Matrix -->
            ${symbols.length > 0 ? `
                <div class="analysis-card p-6 mb-6">
                    <h3 class="text-lg font-semibold text-primary mb-4">Correlation Matrix</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-card">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-secondary uppercase">Symbol</th>
                                    ${symbols.map(symbol => `<th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">${symbol}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody class="bg-card divide-y divide-card">
                                ${symbols.map(symbol1 => `
                                    <tr>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-primary">${symbol1}</td>
                                        ${symbols.map(symbol2 => {
        const corrValue = correlation[symbol1]?.[symbol2] || 0;
        const colorClass = symbol1 === symbol2 ? 'bg-gray-100 dark:bg-gray-700 dark:text-primary' :
            corrValue > 0.7 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-white' :
                corrValue > 0.3 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-white' :
                    corrValue < -0.3 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-white' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-white';
        return `<td class="px-4 py-2 whitespace-nowrap text-sm text-center ${colorClass}">${window.analyticsCore.formatNumber(corrValue)}</td>`;
    }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-4 text-sm text-secondary">
                        <div class="flex flex-wrap gap-4">
                            <div class="flex items-center"><div class="w-4 h-4 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 mr-2"></div>Strong Positive (>0.7)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-800 mr-2"></div>Moderate Positive (0.3-0.7)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 mr-2"></div>Weak (-0.3-0.3)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-green-100 dark:bg-green-900 border border-green-200 dark:border-green-800 mr-2"></div>Negative (<-0.3)</div>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- High Correlation Pairs -->
            ${correlationData.high_correlation_pairs && correlationData.high_correlation_pairs.length > 0 ? `
                <div class="analysis-card p-6 mb-6">
                    <h3 class="text-lg font-semibold text-primary mb-4">High Correlation Pairs</h3>
                    <div class="space-y-2">
                        ${correlationData.high_correlation_pairs.slice(0, 5).map(pair => `
                            <div class="flex justify-between items-center py-2 border-b border-card">
                                <span class="font-medium text-primary">${pair.pair.join(' - ')}</span>
                                <span class="px-2 py-1 rounded text-sm ${Math.abs(pair.correlation) > 0.8 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-white' :
            Math.abs(pair.correlation) > 0.6 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-white' :
                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-white'
        }">${window.analyticsCore.formatNumber(pair.correlation)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Correlation Insights -->
            ${symbols.length > 1 ? `
                <div class="analysis-card p-6 mb-6">
                    <h3 class="text-lg font-semibold text-primary mb-4">Correlation Insights</h3>
                    <div class="space-y-3">
                        ${generateCorrelationInsights(correlation, symbols)}
                    </div>
                </div>
            ` : ''}
            
            <!-- Analysis Parameters -->
            <div class="analysis-card p-6">
                <h4 class="text-sm font-semibold text-primary mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span class="text-secondary">Period:</span> <span class="font-medium text-primary">${currentCorrelationOptions.period}</span></div>
                    <div><span class="text-secondary">Frequency:</span> <span class="font-medium text-primary">${currentCorrelationOptions.frequency}</span></div>
                    <div><span class="text-secondary">Method:</span> <span class="font-medium text-primary">${currentCorrelationOptions.method}</span></div>
                    <div><span class="text-secondary">Rolling Window:</span> <span class="font-medium text-primary">${currentCorrelationOptions.rolling_window}</span></div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                    <div><span class="text-secondary">Data Points:</span> <span class="font-medium text-primary">${summary.data_points || 'N/A'}</span></div>
                    <div><span class="text-secondary">Symbols:</span> <span class="font-medium text-primary">${symbols.length}</span></div>
                    <div><span class="text-secondary">Data Source:</span> <span class="font-medium text-primary">${correlationData.data_source || 'Market Data'}</span></div>
                    <div><span class="text-secondary">High Pairs:</span> <span class="font-medium text-primary">${correlationData.high_correlation_pairs?.length || 0}</span></div>
                </div>
            </div>
        </div>
    `;
};

// Generate correlation insights
function generateCorrelationInsights(correlation, symbols) {
    const insights = [];

    // Find highest and lowest correlations
    let highestCorr = -1;
    let lowestCorr = 1;
    let highestPair = '';
    let lowestPair = '';

    for (let i = 0; i < symbols.length; i++) {
        for (let j = i + 1; j < symbols.length; j++) {
            const symbol1 = symbols[i];
            const symbol2 = symbols[j];
            const corrValue = correlation[symbol1]?.[symbol2] || 0;

            if (corrValue > highestCorr) {
                highestCorr = corrValue;
                highestPair = `${symbol1} - ${symbol2}`;
            }

            if (corrValue < lowestCorr) {
                lowestCorr = corrValue;
                lowestPair = `${symbol1} - ${symbol2}`;
            }
        }
    }

    if (highestPair) {
        insights.push(`<div class="metric-row"><span class="metric-label">Highest Correlation:</span> <span class="metric-value positive">${highestPair} (${window.analyticsCore.formatNumber(highestCorr)})</span></div>`);
    }

    if (lowestPair) {
        insights.push(`<div class="metric-row"><span class="metric-label">Lowest Correlation:</span> <span class="metric-value negative">${lowestPair} (${window.analyticsCore.formatNumber(lowestCorr)})</span></div>`);
    }

    // Diversification insight
    const avgCorr = (highestCorr + lowestCorr) / 2;
    const diversificationLevel = avgCorr > 0.7 ? 'Low' : avgCorr > 0.3 ? 'Moderate' : 'High';
    insights.push(`<div class="metric-row"><span class="metric-label">Diversification Level:</span> <span class="metric-value ${diversificationLevel === 'High' ? 'positive' : diversificationLevel === 'Moderate' ? 'neutral' : 'negative'}">${diversificationLevel}</span></div>`);

    return insights.join('');
}

// Settings toggle
window.toggleCorrelationSettings = () => {
    const settings = document.getElementById('correlationSettings');
    if (settings) {
        settings.classList.toggle('hidden');

        // Set default values if not already set
        if (!document.getElementById('correlationPeriod').value) {
            document.getElementById('correlationPeriod').value = '1Y';
        }
        if (!document.getElementById('correlationFrequency').value) {
            document.getElementById('correlationFrequency').value = 'Daily';
        }
        if (!document.getElementById('correlationMethod').value) {
            document.getElementById('correlationMethod').value = 'pearson';
        }
        if (!document.getElementById('correlationRollingWindow').value) {
            document.getElementById('correlationRollingWindow').value = '30d';
        }
    }
};

// Update correlation options
function updateCorrelationOptions() {
    currentCorrelationOptions = {
        period: document.getElementById('correlationPeriod')?.value || '1Y',
        frequency: document.getElementById('correlationFrequency')?.value || 'Daily',
        method: document.getElementById('correlationMethod')?.value || 'pearson',
        rolling_window: document.getElementById('correlationRollingWindow')?.value || '30d'
    };
}

// Update analysis
window.updateCorrelationAnalysis = () => {
    updateCorrelationOptions();

    // Save to localStorage
    try {
        localStorage.setItem('correlationAnalysisSettings', JSON.stringify(currentCorrelationOptions));
    } catch (e) {
        console.error('Failed to save correlation settings:', e);
    }

    console.log('[CORRELATION] Updating with settings:', currentCorrelationOptions);

    // Store options and call analysis
    window.analyticsCore.correlationOptions = currentCorrelationOptions;

    // Show loading state first
    const container = document.getElementById('analysisContent');
    if (container) {
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Correlation Analysis</h2>
                <button class="bg-indigo-600 text-white px-3 py-1 rounded-lg transition-colors text-sm flex items-center opacity-50 cursor-not-allowed" disabled>
                    <svg class="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Analyzing...
                </button>
            </div>
            <div class="analysis-card p-12 text-center">
                <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <h3 class="text-xl font-semibold text-primary mb-2">Calculating Correlations</h3>
                <p class="text-secondary mb-4">Analyzing portfolio correlations...</p>
            </div>
        `;
    }

    window.analyticsCore.analyzePortfolio(
        'correlation-analysis',
        'analysisContent',
        window.displayCorrelationAnalysisResults,
        'correlationSettings'
    );
};

// Refresh correlation analysis
window.refreshCorrelationAnalysis = () => {
    window.analyticsCore.analyzePortfolio(
        'correlation-analysis',
        'analysisContent',
        window.displayCorrelationAnalysisResults,
        'correlationSettings'
    );
};