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

    // Store for re-rendering on theme change
    window.lastCorrelationResult = result;
    window.lastCorrelationOptions = options;

    container.classList.remove('hidden');

    console.log('[CORRELATION] Raw result received:', result);
    console.log('[CORRELATION] Options received:', options);

    // Setup Theme Observer if not already active
    if (!window.correlationThemeObserver) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    // Slight delay to allow transitions
                    setTimeout(() => {
                        // Re-render if we have data and container is visible
                        const container = document.getElementById('analysisContent');
                        if (container && !container.classList.contains('hidden') && window.lastCorrelationResult) {
                            console.log('[CORRELATION] Theme change detected, re-rendering...');
                            window.displayCorrelationAnalysisResults(window.lastCorrelationResult, window.lastCorrelationOptions);
                        }
                    }, 50);
                }
            });
        });

        // Watch both html and body for class changes
        observer.observe(document.documentElement, { attributes: true });
        observer.observe(document.body, { attributes: true });
        window.correlationThemeObserver = observer;
    }

    // Dark mode detection - Check BOTH html and body
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    const bgClass = isDark ? 'bg-gray-800' : 'bg-white';
    const textClass = isDark ? 'text-white' : 'text-gray-900';
    const subTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
    const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';
    const headerBgClass = isDark ? 'bg-gray-700' : 'bg-gray-50';
    const rowHoverClass = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50';

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

    // Update currentoptions from result or passed options
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
                <h2 class="text-2xl font-bold ${textClass}">Correlation Analysis - DEBUG MODE</h2>
            </div>
            <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-8">
                <h3 class="text-lg font-bold text-red-600 mb-4">DEBUG: No correlation data found</h3>
                <div class="space-y-3 text-sm ${textClass}">
                    <div><strong>Raw result:</strong> <pre class="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-auto">${JSON.stringify(result, null, 2)}</pre></div>
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
            <h2 class="text-2xl font-bold ${textClass}">Correlation Analysis</h2>
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
            </div>
        </div>
        
        <!-- Correlation Settings Panel -->
        <div id="correlationSettings" class="settings-panel hidden mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium ${textClass} mb-1">Period</label>
                    <select id="correlationPeriod" class="w-full px-3 py-2 border ${borderClass} ${bgClass} ${textClass} rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                        <option value="1M" ${currentCorrelationOptions.period === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${currentCorrelationOptions.period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentCorrelationOptions.period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentCorrelationOptions.period === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="2Y" ${currentCorrelationOptions.period === '2Y' ? 'selected' : ''}>2 Years</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium ${textClass} mb-1">Frequency</label>
                    <select id="correlationFrequency" class="w-full px-3 py-2 border ${borderClass} ${bgClass} ${textClass} rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                        <option value="Daily" ${currentCorrelationOptions.frequency === 'Daily' ? 'selected' : ''}>Daily</option>
                        <option value="Weekly" ${currentCorrelationOptions.frequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="Monthly" ${currentCorrelationOptions.frequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium ${textClass} mb-1">Method</label>
                    <select id="correlationMethod" class="w-full px-3 py-2 border ${borderClass} ${bgClass} ${textClass} rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                        <option value="pearson" ${currentCorrelationOptions.method === 'pearson' ? 'selected' : ''}>Pearson</option>
                        <option value="spearman" ${currentCorrelationOptions.method === 'spearman' ? 'selected' : ''}>Spearman</option>
                        <option value="kendall" ${currentCorrelationOptions.method === 'kendall' ? 'selected' : ''}>Kendall</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium ${textClass} mb-1">Rolling Window</label>
                    <select id="correlationRollingWindow" class="w-full px-3 py-2 border ${borderClass} ${bgClass} ${textClass} rounded-md text-sm" onchange="updateCorrelationAnalysis()">
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
                <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6">
                    <h3 class="text-sm font-medium ${subTextClass} uppercase tracking-wide mb-2">Average Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.average_correlation || 0) > 0.7 ? isDark ? 'text-red-400' : 'text-red-600' : (summary.average_correlation || 0) > 0.3 ? isDark ? 'text-yellow-400' : 'text-yellow-600' : isDark ? 'text-green-400' : 'text-green-600'}">
                        ${window.analyticsCore.formatNumber(summary.average_correlation || 0)}
                    </p>
                    <p class="text-sm ${subTextClass} mt-1">${(summary.average_correlation || 0) > 0.7 ? 'High correlation' : (summary.average_correlation || 0) > 0.3 ? 'Moderate correlation' : 'Low correlation'}</p>
                </div>
                <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6">
                    <h3 class="text-sm font-medium ${subTextClass} uppercase tracking-wide mb-2">Max Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.max_correlation || 0) > 0.8 ? isDark ? 'text-red-400' : 'text-red-600' : isDark ? 'text-blue-400' : 'text-blue-600'}">
                        ${window.analyticsCore.formatNumber(summary.max_correlation || 0)}
                    </p>
                    <p class="text-sm ${subTextClass} mt-1">Highest pair correlation</p>
                </div>
                <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6">
                    <h3 class="text-sm font-medium ${subTextClass} uppercase tracking-wide mb-2">Min Correlation</h3>
                    <p class="text-3xl font-bold ${(summary.min_correlation || 0) < -0.3 ? isDark ? 'text-green-400' : 'text-green-600' : isDark ? 'text-blue-400' : 'text-blue-600'}">
                        ${window.analyticsCore.formatNumber(summary.min_correlation || 0)}
                    </p>
                    <p class="text-sm ${subTextClass} mt-1">Lowest pair correlation</p>
                </div>
                <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6">
                    <h3 class="text-sm font-medium ${subTextClass} uppercase tracking-wide mb-2">Data Points</h3>
                    <p class="text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}">
                        ${summary.data_points || 'N/A'}
                    </p>
                    <p class="text-sm ${subTextClass} mt-1">${symbols.length} symbols analyzed</p>
                </div>
            </div>
            
            <!-- Correlation Matrix -->
            ${symbols.length > 0 ? `
                <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6 mb-6">
                    <h3 class="text-lg font-semibold ${textClass} mb-4">Correlation Matrix</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y ${borderClass}">
                            <thead class="${headerBgClass}">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium ${subTextClass} uppercase">Symbol</th>
                                    ${symbols.map(symbol => `<th class="px-4 py-2 text-center text-xs font-medium ${subTextClass} uppercase">${symbol}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody class="${bgClass} divide-y ${borderClass}">
                                ${symbols.map(symbol1 => `
                                    <tr>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm font-medium ${textClass}">${symbol1}</td>
                                        ${symbols.map(symbol2 => {
        const corrValue = correlation[symbol1]?.[symbol2] || 0;
        const colorClass = corrValue > 0.7 ? (isDark ? 'bg-red-900 text-red-100' : 'bg-red-100 text-red-800') :
            corrValue > 0.3 ? (isDark ? 'bg-yellow-900 text-yellow-100' : 'bg-yellow-100 text-yellow-800') :
                corrValue < -0.3 ? (isDark ? 'bg-green-900 text-green-100' : 'bg-green-100 text-green-800') :
                    (isDark ? 'bg-blue-900 text-blue-100' : 'bg-blue-100 text-blue-800');
        return `<td class="px-4 py-2 whitespace-nowrap text-sm text-center ${colorClass}">${window.analyticsCore.formatNumber(corrValue)}</td>`;
    }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-4 text-sm ${subTextClass}">
                        <div class="flex flex-wrap gap-4">
                            <div class="flex items-center"><div class="w-4 h-4 ${isDark ? 'bg-red-900 border-red-800' : 'bg-red-100 border-red-200'} border mr-2"></div>Strong Positive (>0.7)</div>
                            <div class="flex items-center"><div class="w-4 h-4 ${isDark ? 'bg-yellow-900 border-yellow-800' : 'bg-yellow-100 border-yellow-200'} border mr-2"></div>Moderate Positive (0.3-0.7)</div>
                            <div class="flex items-center"><div class="w-4 h-4 ${isDark ? 'bg-blue-900 border-blue-800' : 'bg-blue-100 border-blue-200'} border mr-2"></div>Weak (-0.3-0.3)</div>
                            <div class="flex items-center"><div class="w-4 h-4 ${isDark ? 'bg-green-900 border-green-800' : 'bg-green-100 border-green-200'} border mr-2"></div>Negative (<-0.3)</div>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- High Correlation Pairs -->
            ${correlationData.high_correlation_pairs && correlationData.high_correlation_pairs.length > 0 ? `
                <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6 mb-6">
                    <h3 class="text-lg font-semibold ${textClass} mb-4">High Correlation Pairs</h3>
                    <div class="space-y-2">
                        ${correlationData.high_correlation_pairs.slice(0, 5).map(pair => `
                            <div class="flex justify-between items-center py-2 border-b ${borderClass}">
                                <span class="font-medium ${textClass}">${pair.pair.join(' - ')}</span>
                                <span class="px-2 py-1 rounded text-sm ${Math.abs(pair.correlation) > 0.8 ? (isDark ? 'bg-red-900 text-white' : 'bg-red-100 text-red-800') :
            Math.abs(pair.correlation) > 0.6 ? (isDark ? 'bg-yellow-900 text-white' : 'bg-yellow-100 text-yellow-800') :
                (isDark ? 'bg-blue-900 text-white' : 'bg-blue-100 text-blue-800')
        }">${window.analyticsCore.formatNumber(pair.correlation)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Correlation Insights -->
            ${symbols.length > 1 ? `
                <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6 mb-6">
                    <h3 class="text-lg font-semibold ${textClass} mb-4">Correlation Insights</h3>
                    <div class="space-y-3">
                        ${generateCorrelationInsights(correlation, symbols)}
                    </div>
                </div>
            ` : ''}
            
            <!-- Analysis Parameters -->
            <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-6">
                <h4 class="text-sm font-semibold ${textClass} mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span class="${subTextClass}">Period:</span> <span class="font-medium ${textClass}">${currentCorrelationOptions.period}</span></div>
                    <div><span class="${subTextClass}">Frequency:</span> <span class="font-medium ${textClass}">${currentCorrelationOptions.frequency}</span></div>
                    <div><span class="${subTextClass}">Method:</span> <span class="font-medium ${textClass}">${currentCorrelationOptions.method}</span></div>
                    <div><span class="${subTextClass}">Rolling Window:</span> <span class="font-medium ${textClass}">${currentCorrelationOptions.rolling_window}</span></div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                    <div><span class="${subTextClass}">Data Points:</span> <span class="font-medium ${textClass}">${summary.data_points || 'N/A'}</span></div>
                    <div><span class="${subTextClass}">Symbols:</span> <span class="font-medium ${textClass}">${symbols.length}</span></div>
                    <div><span class="${subTextClass}">Data Source:</span> <span class="font-medium ${textClass}">${correlationData.data_source || 'Market Data'}</span></div>
                    <div><span class="${subTextClass}">High Pairs:</span> <span class="font-medium ${textClass}">${correlationData.high_correlation_pairs?.length || 0}</span></div>
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
        // Dark mode detection
        const isDark = document.documentElement.classList.contains('dark');
        const bgClass = isDark ? 'bg-gray-800' : 'bg-white';
        const textClass = isDark ? 'text-white' : 'text-gray-900';
        const subTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
        const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold ${textClass}">Correlation Analysis</h2>
                <button class="bg-indigo-600 text-white px-3 py-1 rounded-lg transition-colors text-sm flex items-center opacity-50 cursor-not-allowed" disabled>
                    <svg class="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Analyzing...
                </button>
            </div>
            <div class="${bgClass} rounded-xl shadow-sm border ${borderClass} p-12 text-center">
                <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <h3 class="text-xl font-semibold ${textClass} mb-2">Calculating Correlations</h3>
                <p class="${subTextClass} mb-4">Analyzing portfolio correlations...</p>
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