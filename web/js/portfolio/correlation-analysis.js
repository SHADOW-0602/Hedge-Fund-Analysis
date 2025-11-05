// Interactive Correlation Analysis Module
window.loadCorrelationAnalysis = function(portfolioData, options = {}) {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('correlation-analysis');
    }
};

// Display function for correlation analysis
window.analyticsManager.displayCorrelationAnalysis = function(result, options) {
    const container = document.getElementById('analysisContent');
    if (!container) return;
    
    container.classList.remove('hidden');
    const correlation = result.correlation_matrix || {};
    const summary = result.summary || {};
    
    // Get current settings
    const currentPeriod = options?.period || summary.period || '1Y';
    const currentFrequency = options?.frequency || 'Daily';
    const currentMethod = options?.method || summary.method || 'pearson';
    const currentRollingWindow = options?.rolling_window || '30d';
    
    // Get symbols for matrix display
    const symbols = Object.keys(correlation);
    
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
                        <option value="1M" ${currentPeriod === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${currentPeriod === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentPeriod === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentPeriod === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="2Y" ${currentPeriod === '2Y' ? 'selected' : ''}>2 Years</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <select id="correlationFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                        <option value="Daily" ${currentFrequency === 'Daily' ? 'selected' : ''}>Daily</option>
                        <option value="Weekly" ${currentFrequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="Monthly" ${currentFrequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Method</label>
                    <select id="correlationMethod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                        <option value="pearson" ${currentMethod === 'pearson' ? 'selected' : ''}>Pearson</option>
                        <option value="spearman" ${currentMethod === 'spearman' ? 'selected' : ''}>Spearman</option>
                        <option value="kendall" ${currentMethod === 'kendall' ? 'selected' : ''}>Kendall</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Rolling Window</label>
                    <select id="correlationRollingWindow" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateCorrelationAnalysis()">
                        <option value="30d" ${currentRollingWindow === '30d' ? 'selected' : ''}>30 days</option>
                        <option value="60d" ${currentRollingWindow === '60d' ? 'selected' : ''}>60 days</option>
                        <option value="90d" ${currentRollingWindow === '90d' ? 'selected' : ''}>90 days</option>
                        <option value="252d" ${currentRollingWindow === '252d' ? 'selected' : ''}>252 days</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="space-y-6">
            <!-- Summary Statistics -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="details-box">
                    <h4 class="section-header">Average Correlation</h4>
                    <p class="text-2xl font-bold metric-value ${(summary.average_correlation || 0) > 0.7 ? 'negative' : (summary.average_correlation || 0) > 0.3 ? 'neutral' : 'positive'}">${window.analyticsCore.formatNumber(summary.average_correlation || 0)}</p>
                </div>
                <div class="details-box">
                    <h4 class="section-header">Max Correlation</h4>
                    <p class="text-2xl font-bold metric-value ${(summary.max_correlation || 0) > 0.8 ? 'negative' : 'neutral'}">${window.analyticsCore.formatNumber(summary.max_correlation || 0)}</p>
                </div>
                <div class="details-box">
                    <h4 class="section-header">Min Correlation</h4>
                    <p class="text-2xl font-bold metric-value ${(summary.min_correlation || 0) < -0.3 ? 'positive' : 'neutral'}">${window.analyticsCore.formatNumber(summary.min_correlation || 0)}</p>
                </div>
                <div class="details-box">
                    <h4 class="section-header">Symbols Analyzed</h4>
                    <p class="text-2xl font-bold metric-value neutral">${summary.symbols_analyzed || symbols.length}</p>
                </div>
            </div>
            
            <!-- Correlation Matrix -->
            ${symbols.length > 0 ? `
                <div class="details-box">
                    <h4 class="section-header">Correlation Matrix</h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                                    ${symbols.map(symbol => `<th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">${symbol}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${symbols.map(symbol1 => `
                                    <tr>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${symbol1}</td>
                                        ${symbols.map(symbol2 => {
                                            const corrValue = correlation[symbol1]?.[symbol2] || 0;
                                            const colorClass = symbol1 === symbol2 ? 'bg-gray-100' : 
                                                             corrValue > 0.7 ? 'bg-red-100 text-red-800' :
                                                             corrValue > 0.3 ? 'bg-yellow-100 text-yellow-800' :
                                                             corrValue < -0.3 ? 'bg-green-100 text-green-800' :
                                                             'bg-blue-100 text-blue-800';
                                            return `<td class="px-4 py-2 whitespace-nowrap text-sm text-center ${colorClass}">${window.analyticsCore.formatNumber(corrValue)}</td>`;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-4 text-sm text-gray-600">
                        <div class="flex flex-wrap gap-4">
                            <div class="flex items-center"><div class="w-4 h-4 bg-red-100 border mr-2"></div>Strong Positive (>0.7)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-yellow-100 border mr-2"></div>Moderate Positive (0.3-0.7)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-blue-100 border mr-2"></div>Weak (-0.3-0.3)</div>
                            <div class="flex items-center"><div class="w-4 h-4 bg-green-100 border mr-2"></div>Negative (<-0.3)</div>
                        </div>
                    </div>
                </div>
            ` : '<p class="text-gray-500 text-center py-4">No correlation data available</p>'}
            
            <!-- Correlation Insights -->
            ${symbols.length > 1 ? `
                <div class="details-box">
                    <h4 class="section-header">Correlation Insights</h4>
                    <div class="space-y-3">
                        ${generateCorrelationInsights(correlation, symbols)}
                    </div>
                </div>
            ` : ''}
            
            <!-- Analysis Parameters -->
            <div class="details-box">
                <h4 class="section-header">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span class="detail-label">Period:</span> <span class="detail-value">${currentPeriod}</span></div>
                    <div><span class="detail-label">Frequency:</span> <span class="detail-value">${currentFrequency}</span></div>
                    <div><span class="detail-label">Method:</span> <span class="detail-value">${currentMethod}</span></div>
                    <div><span class="detail-label">Rolling Window:</span> <span class="detail-value">${currentRollingWindow}</span></div>
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

// Update analysis
window.updateCorrelationAnalysis = () => {
    // Get settings values from form
    const period = document.getElementById('correlationPeriod')?.value || '1Y';
    const frequency = document.getElementById('correlationFrequency')?.value || 'Daily';
    const method = document.getElementById('correlationMethod')?.value || 'pearson';
    const rollingWindow = document.getElementById('correlationRollingWindow')?.value || '30d';
    
    console.log('[CORRELATION] Updating with settings:', { period, frequency, method, rolling_window: rollingWindow });
    
    // Direct API call with fresh settings
    window.analyticsCore.analyzePortfolio(
        'correlation-analysis',
        'analysisContent',
        window.analyticsManager.displayCorrelationAnalysis,
        null // Don't use form settings, use direct options
    );
};