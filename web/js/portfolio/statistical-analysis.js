// Statistical Analysis Module - Matches P&L Attribution UI Style
let currentStatisticalOptions = {
    lookback_period: '1Y',
    frequency: 'Daily',
    benchmark: 'SPY',
    confidence_level: 0.95
};

window.loadStatisticalAnalysis = function (portfolioData, options = {}) {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('statistical-analysis');
    }
};

// Display function for statistical analysis
window.displayStatisticalAnalysisResults = function (result, options) {
    const container = document.getElementById('statisticalAnalysis') || document.getElementById('analysisContent');
    if (!container) return;

    container.classList.remove('hidden');

    console.log('[STATISTICAL] Raw result received:', result);
    console.log('[STATISTICAL] Options received:', options);

    // Handle the actual API response structure
    let statisticalData, parameters, riskMetrics, performanceMetrics, correlationAnalysis;

    if (result.statistical_analysis) {
        // API response format: { success: true, statistical_analysis: {...} }
        statisticalData = result.statistical_analysis;
        parameters = statisticalData.parameters || {};
        riskMetrics = statisticalData.risk_metrics || {};
        performanceMetrics = statisticalData.performance_metrics || {};
        correlationAnalysis = statisticalData.correlation_analysis || {};
    } else {
        // Direct format
        statisticalData = result;
        parameters = result.parameters || {};
        riskMetrics = result.risk_metrics || {};
        performanceMetrics = result.performance_metrics || {};
        correlationAnalysis = result.correlation_analysis || {};
    }

    console.log('[STATISTICAL] Processed data:', { statisticalData, parameters, riskMetrics, performanceMetrics });

    // Update current options from result or passed options
    currentStatisticalOptions = {
        lookback_period: options?.lookback_period || parameters.lookback_period || currentStatisticalOptions.lookback_period,
        frequency: options?.frequency || parameters.frequency || currentStatisticalOptions.frequency,
        benchmark: options?.benchmark || parameters.benchmark || currentStatisticalOptions.benchmark,
        confidence_level: options?.confidence_level || parameters.confidence_level || currentStatisticalOptions.confidence_level
    };

    // Get symbols for analysis
    const riskSymbols = Object.keys(riskMetrics);
    const performanceSymbols = Object.keys(performanceMetrics);
    const allSymbols = [...new Set([...riskSymbols, ...performanceSymbols])];

    console.log('[STATISTICAL] Symbols found:', { riskSymbols, performanceSymbols, allSymbols });

    // If no statistical data, show error with debug info
    if (allSymbols.length === 0) {
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Statistical Analysis - DEBUG MODE</h2>
            </div>
            <div class="analysis-card p-8">
                <h3 class="text-lg font-bold text-red-600 mb-4">DEBUG: No statistical data found</h3>
                <div class="space-y-3 text-sm">
                    <div><strong>Raw result:</strong> <pre class="bg-gray-100 p-2 rounded text-xs overflow-auto">${JSON.stringify(result, null, 2)}</pre></div>
                    <div><strong>Result keys:</strong> ${Object.keys(result).join(', ')}</div>
                    <div><strong>Has statistical_analysis:</strong> ${!!result.statistical_analysis}</div>
                    <div><strong>Has parameters:</strong> ${!!result.parameters}</div>
                    <div><strong>Risk metrics symbols:</strong> ${riskSymbols.length} (${riskSymbols.join(', ')})</div>
                    <div><strong>Performance metrics symbols:</strong> ${performanceSymbols.length} (${performanceSymbols.join(', ')})</div>
                    <div><strong>Options passed:</strong> ${JSON.stringify(options)}</div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Statistical Analysis</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleStatisticalSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                    Settings
                </button>
                <button onclick="updateStatisticalAnalysis()" class="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Refresh
                </button>
            </div>
        </div>
        
        <!-- Statistical Settings Panel -->
        <div id="statisticalSettings" class="settings-panel hidden mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Lookback Period</label>
                    <select id="statisticalLookbackPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStatisticalAnalysis()">
                        <option value="3M" ${currentStatisticalOptions.lookback_period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentStatisticalOptions.lookback_period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentStatisticalOptions.lookback_period === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="2Y" ${currentStatisticalOptions.lookback_period === '2Y' ? 'selected' : ''}>2 Years</option>
                        <option value="3Y" ${currentStatisticalOptions.lookback_period === '3Y' ? 'selected' : ''}>3 Years</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <select id="statisticalFrequency" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStatisticalAnalysis()">
                        <option value="Daily" ${currentStatisticalOptions.frequency === 'Daily' ? 'selected' : ''}>Daily</option>
                        <option value="Weekly" ${currentStatisticalOptions.frequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="Monthly" ${currentStatisticalOptions.frequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Benchmark</label>
                    <select id="statisticalBenchmark" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStatisticalAnalysis()">
                        <option value="SPY" ${currentStatisticalOptions.benchmark === 'SPY' ? 'selected' : ''}>S&P 500 (SPY)</option>
                        <option value="QQQ" ${currentStatisticalOptions.benchmark === 'QQQ' ? 'selected' : ''}>NASDAQ 100 (QQQ)</option>
                        <option value="IWM" ${currentStatisticalOptions.benchmark === 'IWM' ? 'selected' : ''}>Russell 2000 (IWM)</option>
                        <option value="VTI" ${currentStatisticalOptions.benchmark === 'VTI' ? 'selected' : ''}>Total Stock Market (VTI)</option>
                        <option value="EFA" ${currentStatisticalOptions.benchmark === 'EFA' ? 'selected' : ''}>International Developed (EFA)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Confidence Level</label>
                    <select id="statisticalConfidenceLevel" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateStatisticalAnalysis()">
                        <option value="0.90" ${currentStatisticalOptions.confidence_level === 0.90 ? 'selected' : ''}>90%</option>
                        <option value="0.95" ${currentStatisticalOptions.confidence_level === 0.95 ? 'selected' : ''}>95%</option>
                        <option value="0.99" ${currentStatisticalOptions.confidence_level === 0.99 ? 'selected' : ''}>99%</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="space-y-6">
            <!-- Summary Statistics -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Symbols Analyzed</h3>
                    <p class="text-3xl font-bold text-blue-600">
                        ${allSymbols.length}
                    </p>
                    <p class="text-sm text-secondary mt-1">Portfolio positions</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Data Points</h3>
                    <p class="text-3xl font-bold text-blue-600">
                        ${parameters.data_points || 'N/A'}
                    </p>
                    <p class="text-sm text-secondary mt-1">${currentStatisticalOptions.frequency} observations</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Benchmark</h3>
                    <p class="text-3xl font-bold text-blue-600">
                        ${currentStatisticalOptions.benchmark}
                    </p>
                    <p class="text-sm text-secondary mt-1">${parameters.benchmark || 'Market index'}</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Confidence Level</h3>
                    <p class="text-3xl font-bold text-blue-600">
                        ${(currentStatisticalOptions.confidence_level * 100).toFixed(0)}%
                    </p>
                    <p class="text-sm text-secondary mt-1">Statistical significance</p>
                </div>
            </div>
            
            <!-- Risk Metrics Table -->
            ${Object.keys(riskMetrics).length > 0 ? `
                <div class="analysis-card p-6 mb-6">
                    <h3 class="text-lg font-semibold text-primary mb-4">Risk Metrics</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-card">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-secondary uppercase">Symbol</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">Volatility</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">Sharpe Ratio</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">VaR</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">CVaR</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">Max Drawdown</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">Skewness</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">Kurtosis</th>
                                </tr>
                            </thead>
                            <tbody class="bg-card divide-y divide-card">
                                ${Object.entries(riskMetrics).map(([symbol, metrics]) => `
                                    <tr>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-primary">${symbol}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center text-primary">${window.analyticsCore.formatPercent(metrics.volatility)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center ${metrics.sharpe_ratio > 1 ? 'text-green-600' : metrics.sharpe_ratio > 0 ? 'text-blue-600' : 'text-red-600'}">${window.analyticsCore.formatNumber(metrics.sharpe_ratio)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center text-red-600">${window.analyticsCore.formatPercent(metrics.var)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center text-red-600">${window.analyticsCore.formatPercent(metrics.cvar)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center text-red-600">${window.analyticsCore.formatPercent(metrics.max_drawdown)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center ${metrics.skewness > 0 ? 'text-green-600' : 'text-red-600'}">${window.analyticsCore.formatNumber(metrics.skewness)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center ${metrics.kurtosis > 3 ? 'text-red-600' : 'text-blue-600'}">${window.analyticsCore.formatNumber(metrics.kurtosis)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
            
            <!-- Performance Metrics Table -->
            ${Object.keys(performanceMetrics).length > 0 ? `
                <div class="analysis-card p-6 mb-6">
                    <h3 class="text-lg font-semibold text-primary mb-4">Performance vs Benchmark</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-card">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-secondary uppercase">Symbol</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">Beta</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">Alpha</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">R-Squared</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">Tracking Error</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">Information Ratio</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-secondary uppercase">Correlation</th>
                                </tr>
                            </thead>
                            <tbody class="bg-card divide-y divide-card">
                                ${Object.entries(performanceMetrics).map(([symbol, metrics]) => `
                                    <tr>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-primary">${symbol}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center ${metrics.beta > 1.2 ? 'text-red-600' : metrics.beta < 0.8 ? 'text-green-600' : 'text-blue-600'}">${window.analyticsCore.formatNumber(metrics.beta)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center ${metrics.alpha > 0 ? 'text-green-600' : 'text-red-600'}">${window.analyticsCore.formatPercent(metrics.alpha)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center text-primary">${window.analyticsCore.formatPercent(metrics.r_squared)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center text-primary">${window.analyticsCore.formatPercent(metrics.tracking_error)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center ${metrics.information_ratio > 0 ? 'text-green-600' : 'text-red-600'}">${window.analyticsCore.formatNumber(metrics.information_ratio)}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center text-primary">${window.analyticsCore.formatNumber(metrics.correlation_with_benchmark)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
            
            <!-- Correlation Analysis -->
            ${correlationAnalysis.matrix ? `
                <div class="analysis-card p-6 mb-6">
                    <h3 class="text-lg font-semibold text-primary mb-4">Correlation Analysis</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-600">${window.analyticsCore.formatNumber(correlationAnalysis.average_correlation)}</div>
                            <div class="text-sm text-secondary">Average Correlation</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-red-600">${window.analyticsCore.formatNumber(correlationAnalysis.pairs ? Object.keys(correlationAnalysis.pairs).length : 0)}</div>
                            <div class="text-sm text-secondary">Correlation Pairs</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-green-600">${allSymbols.length}</div>
                            <div class="text-sm text-secondary">Symbols Analyzed</div>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Portfolio Metrics -->
            ${statisticalData.portfolio_metrics ? `
                <div class="analysis-card p-6 mb-6">
                    <h3 class="text-lg font-semibold text-primary mb-4">Portfolio-Level Metrics</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="text-center">
                            <div class="text-2xl font-bold ${statisticalData.portfolio_metrics.portfolio_beta > 1 ? 'text-red-600' : 'text-green-600'}">${window.analyticsCore.formatNumber(statisticalData.portfolio_metrics.portfolio_beta)}</div>
                            <div class="text-sm text-secondary">Portfolio Beta</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold ${statisticalData.portfolio_metrics.portfolio_alpha > 0 ? 'text-green-600' : 'text-red-600'}">${window.analyticsCore.formatPercent(statisticalData.portfolio_metrics.portfolio_alpha)}</div>
                            <div class="text-sm text-secondary">Portfolio Alpha</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold ${statisticalData.portfolio_metrics.portfolio_sharpe > 1 ? 'text-green-600' : 'text-blue-600'}">${window.analyticsCore.formatNumber(statisticalData.portfolio_metrics.portfolio_sharpe)}</div>
                            <div class="text-sm text-secondary">Portfolio Sharpe</div>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Analysis Parameters -->
            <div class="analysis-card p-6">
                <h4 class="text-sm font-semibold text-primary mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span class="text-secondary">Lookback Period:</span> <span class="font-medium text-primary">${currentStatisticalOptions.lookback_period}</span></div>
                    <div><span class="text-secondary">Frequency:</span> <span class="font-medium text-primary">${currentStatisticalOptions.frequency}</span></div>
                    <div><span class="text-secondary">Benchmark:</span> <span class="font-medium text-primary">${currentStatisticalOptions.benchmark}</span></div>
                    <div><span class="text-secondary">Confidence Level:</span> <span class="font-medium text-primary">${(currentStatisticalOptions.confidence_level * 100).toFixed(0)}%</span></div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                    <div><span class="text-secondary">Data Points:</span> <span class="font-medium text-primary">${parameters.data_points || 'N/A'}</span></div>
                    <div><span class="text-secondary">Symbols:</span> <span class="font-medium text-primary">${allSymbols.length}</span></div>
                    <div><span class="text-secondary">Risk Metrics:</span> <span class="font-medium text-primary">${Object.keys(riskMetrics).length}</span></div>
                    <div><span class="text-secondary">Performance Metrics:</span> <span class="font-medium text-primary">${Object.keys(performanceMetrics).length}</span></div>
                </div>
            </div>
        </div>
    `;
};

// Settings toggle
window.toggleStatisticalSettings = () => {
    const settings = document.getElementById('statisticalSettings');
    if (settings) {
        settings.classList.toggle('hidden');

        // Set default values if not already set
        if (!document.getElementById('statisticalLookbackPeriod').value) {
            document.getElementById('statisticalLookbackPeriod').value = '1Y';
        }
        if (!document.getElementById('statisticalFrequency').value) {
            document.getElementById('statisticalFrequency').value = 'Daily';
        }
        if (!document.getElementById('statisticalBenchmark').value) {
            document.getElementById('statisticalBenchmark').value = 'SPY';
        }
        if (!document.getElementById('statisticalConfidenceLevel').value) {
            document.getElementById('statisticalConfidenceLevel').value = '0.95';
        }
    }
};

// Update statistical options
function updateStatisticalOptions() {
    currentStatisticalOptions = {
        lookback_period: document.getElementById('statisticalLookbackPeriod')?.value || '1Y',
        frequency: document.getElementById('statisticalFrequency')?.value || 'Daily',
        benchmark: document.getElementById('statisticalBenchmark')?.value || 'SPY',
        confidence_level: parseFloat(document.getElementById('statisticalConfidenceLevel')?.value || '0.95')
    };
}

// Update analysis
window.updateStatisticalAnalysis = () => {
    updateStatisticalOptions();
    console.log('[STATISTICAL] Updating with settings:', currentStatisticalOptions);

    // Store options and call analysis
    window.analyticsCore.statisticalOptions = currentStatisticalOptions;

    // Show loading state first
    const container = document.getElementById('statisticalAnalysis') || document.getElementById('analysisContent');
    if (container) {
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-900">Statistical Analysis</h2>
                <button class="bg-indigo-600 text-white px-3 py-1 rounded-lg transition-colors text-sm flex items-center opacity-50 cursor-not-allowed" disabled>
                    <svg class="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Analyzing...
                </button>
            </div>
            <div class="analysis-card p-12 text-center">
                <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <h3 class="text-xl font-semibold text-primary mb-2">Calculating Statistics</h3>
                <p class="text-secondary mb-4">Analyzing portfolio statistics...</p>
            </div>
        `;
    }

    window.analyticsCore.analyzePortfolio(
        'statistical-analysis',
        'statisticalAnalysis',
        window.displayStatisticalAnalysisResults,
        'statisticalSettings'
    );
};

// Refresh statistical analysis
window.refreshStatisticalAnalysis = () => {
    window.analyticsCore.analyzePortfolio(
        'statistical-analysis',
        'statisticalAnalysis',
        window.displayStatisticalAnalysisResults,
        'statisticalSettings'
    );
};