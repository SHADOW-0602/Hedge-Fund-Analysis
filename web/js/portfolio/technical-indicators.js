// Technical Indicators Module - Matches P&L Attribution UI Style
let currentTechnicalOptions = {
    period: '1Y',
    indicators: ['RSI', 'MACD', 'Bollinger', 'SMA', 'EMA'],
    timeframe: 'Daily',
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    macd_fast: 12,
    macd_slow: 26,
    signal_strength: 'Medium'
};

async function loadTechnicalIndicators(portfolioData, options = {}) {
    console.log('loadTechnicalIndicators called with:', portfolioData?.length || 0, 'positions');

    // Try multiple possible container IDs
    let container = document.getElementById('technicalIndicators') ||
        document.getElementById('technicalAnalysis') ||
        document.getElementById('analysisContent');

    if (!container) {
        console.error('Technical indicators container not found');
        return;
    }

    // Ensure API_BASE is defined
    if (typeof API_BASE === 'undefined') {
        window.API_BASE = window.location.origin;
        console.log('API_BASE not defined, using:', window.API_BASE);
    }

    // Validate portfolio data
    if (!portfolioData || portfolioData.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-yellow-500">No portfolio data available for technical analysis</div>';
        return;
    }

    // Store portfolio for refresh
    window.currentTechnicalPortfolio = portfolioData;

    // Initial load
    await fetchTechnicalIndicators(portfolioData);
}

function updateTechnicalOptions() {
    // Default active indicators
    const indicators = ['RSI', 'MACD', 'Bollinger', 'SMA', 'EMA'];

    currentTechnicalOptions = {
        period: document.getElementById('technicalPeriod')?.value || '1Y',
        indicators: indicators,
        timeframe: document.getElementById('technicalTimeframe')?.value || 'Daily',
        rsi_period: parseInt(document.getElementById('technicalRsiPeriod')?.value) || 14,
        rsi_oversold: 30,
        rsi_overbought: 70,
        macd_fast: parseInt(document.getElementById('technicalMacdFast')?.value) || 12,
        macd_slow: 26,
        macd_signal: 9,
        bb_period: 20,
        bb_std: 2,
        signal_strength: document.getElementById('technicalSignalStrength')?.value || 'Medium'
    };
}

async function fetchTechnicalIndicators(portfolioData) {
    // Try multiple possible container IDs
    const container = document.getElementById('technicalIndicators') ||
        document.getElementById('technicalAnalysis') ||
        document.getElementById('analysisContent');
    if (!container) return;

    // Preserve settings state if they exist
    const settingsPanel = document.getElementById('technicalSettings');
    const settingsHidden = settingsPanel ? settingsPanel.classList.contains('hidden') : true;

    // Show loading state with full UI matching P&L attribution
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Technical Indicators</h2>
            <div class="flex items-center space-x-2">
                <button onclick="toggleTechnicalSettings()" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
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
        
        <!-- Technical Settings Panel -->
        <div id="technicalSettings" class="settings-panel ${settingsHidden ? 'hidden' : ''} mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select id="technicalPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalIndicators()">
                        <option value="1M" ${currentTechnicalOptions.period === '1M' ? 'selected' : ''}>1 Month</option>
                        <option value="3M" ${currentTechnicalOptions.period === '3M' ? 'selected' : ''}>3 Months</option>
                        <option value="6M" ${currentTechnicalOptions.period === '6M' ? 'selected' : ''}>6 Months</option>
                        <option value="1Y" ${currentTechnicalOptions.period === '1Y' ? 'selected' : ''}>1 Year</option>
                        <option value="2Y" ${currentTechnicalOptions.period === '2Y' ? 'selected' : ''}>2 Years</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
                    <select id="technicalTimeframe" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalIndicators()">
                        <option value="Daily" ${currentTechnicalOptions.timeframe === 'Daily' ? 'selected' : ''}>Daily</option>
                        <option value="Weekly" ${currentTechnicalOptions.timeframe === 'Weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="Monthly" ${currentTechnicalOptions.timeframe === 'Monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">RSI Period</label>
                    <select id="technicalRsiPeriod" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalIndicators()">
                        <option value="14" ${currentTechnicalOptions.rsi_period === 14 ? 'selected' : ''}>14</option>
                        <option value="21" ${currentTechnicalOptions.rsi_period === 21 ? 'selected' : ''}>21</option>
                        <option value="30" ${currentTechnicalOptions.rsi_period === 30 ? 'selected' : ''}>30</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">MACD Fast</label>
                    <select id="technicalMacdFast" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalIndicators()">
                        <option value="12" ${currentTechnicalOptions.macd_fast === 12 ? 'selected' : ''}>12</option>
                        <option value="8" ${currentTechnicalOptions.macd_fast === 8 ? 'selected' : ''}>8</option>
                        <option value="15" ${currentTechnicalOptions.macd_fast === 15 ? 'selected' : ''}>15</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Signal Strength</label>
                    <select id="technicalSignalStrength" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" onchange="updateTechnicalIndicators()">
                        <option value="Weak" ${currentTechnicalOptions.signal_strength === 'Weak' ? 'selected' : ''}>Weak</option>
                        <option value="Medium" ${currentTechnicalOptions.signal_strength === 'Medium' ? 'selected' : ''}>Medium</option>
                        <option value="Strong" ${currentTechnicalOptions.signal_strength === 'Strong' ? 'selected' : ''}>Strong</option>
                    </select>
                </div>
            </div>
            

        </div>
        
        <div id="technicalContent" class="analysis-card p-12 text-center">
            <div class="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
            <h3 class="text-xl font-semibold text-primary mb-2">Processing Your Data</h3>
            <p class="text-secondary mb-4">Analyzing ${portfolioData?.length || 0} positions and calculating technical indicators...</p>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500 animate-pulse" style="width: 60%"></div>
            </div>
            <p class="text-sm text-gray-500">This may take a few moments</p>
        </div>
    `;

    try {
        console.log('Making Technical Analysis API call with options:', currentTechnicalOptions);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${API_BASE}/api/technical-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio: portfolioData, options: currentTechnicalOptions }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success && data.technical_analysis) {
            displayTechnicalIndicators(data.technical_analysis);
            // Re-enable refresh button
            const refreshBtn = container.querySelector('button[disabled]');
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                refreshBtn.onclick = () => updateTechnicalIndicators();
                refreshBtn.innerHTML = `
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Refresh
                `;
            }
        } else {
            showTechnicalError(data.error || 'No valid portfolio data found');
        }
    } catch (error) {
        console.error('Technical Analysis error:', error);
        showTechnicalError(error.name === 'AbortError' ? 'Request timeout' : error.message);
    }
}

// Display function for technical indicators - ensure it's properly defined
function displayTechnicalIndicators(technicalData) {
    // Try multiple possible content container IDs
    let contentDiv = document.getElementById('technicalContent');

    // If technicalContent doesn't exist, we're probably in the main container
    if (!contentDiv) {
        contentDiv = document.getElementById('technicalIndicators') ||
            document.getElementById('technicalAnalysis') ||
            document.getElementById('analysisContent');
    }

    if (!contentDiv) return;

    console.log('[TECHNICAL] Raw result received:', technicalData);

    console.log('[TECHNICAL] Processed data:', technicalData);

    // Update current options from result parameters
    if (technicalData.parameters) {
        currentTechnicalOptions = {
            period: technicalData.parameters.period || currentTechnicalOptions.period,
            indicators: technicalData.parameters.indicators || currentTechnicalOptions.indicators,
            timeframe: technicalData.parameters.timeframe || currentTechnicalOptions.timeframe,
            rsi_period: technicalData.parameters.rsi_parameters?.period || currentTechnicalOptions.rsi_period,
            rsi_oversold: technicalData.parameters.rsi_parameters?.oversold || currentTechnicalOptions.rsi_oversold,
            rsi_overbought: technicalData.parameters.rsi_parameters?.overbought || currentTechnicalOptions.rsi_overbought,
            macd_fast: technicalData.parameters.macd_parameters?.fast || currentTechnicalOptions.macd_fast,
            macd_slow: technicalData.parameters.macd_parameters?.slow || currentTechnicalOptions.macd_slow,
            signal_strength: technicalData.parameters.signal_strength || currentTechnicalOptions.signal_strength
        };
    }

    // Get symbols from individual_analysis
    const individualAnalysis = technicalData.individual_analysis || {};
    const symbols = Object.keys(individualAnalysis);

    console.log('[TECHNICAL] Symbols found:', symbols);
    console.log('[TECHNICAL] Individual analysis:', individualAnalysis);
    console.log('[TECHNICAL] Full technical data structure:', technicalData);

    // If no technical data, show error with debug info
    if (symbols.length === 0) {
        showTechnicalError('No technical data found - API returned success but no individual_analysis data');
        return;
    }

    // Calculate signal counts
    let bullishCount = 0, bearishCount = 0, neutralCount = 0;
    symbols.forEach(symbol => {
        const analysis = individualAnalysis[symbol] || {};
        const overallSignal = analysis.overall_signal || 'Neutral';
        if (overallSignal === 'Bullish') bullishCount++;
        else if (overallSignal === 'Bearish') bearishCount++;
        else neutralCount++;
    });

    const totalSignals = bullishCount + bearishCount + neutralCount;

    contentDiv.innerHTML = `
        <div class="space-y-6">
            <!-- Summary Statistics -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Total Signals</h3>
                    <p class="text-3xl font-bold text-blue-600">
                        ${totalSignals}
                    </p>
                    <p class="text-sm text-secondary mt-1">Technical indicators</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Overall Signal</h3>
                    <p class="text-3xl font-bold ${technicalData.portfolio_signals?.overall === 'Bullish' ? 'text-green-600' : technicalData.portfolio_signals?.overall === 'Bearish' ? 'text-red-600' : 'text-gray-600'}">
                        ${technicalData.portfolio_signals?.overall || 'Neutral'}
                    </p>
                    <p class="text-sm text-secondary mt-1">Portfolio signal</p>
                </div>
                <div class="analysis-card p-6">
                    <h3 class="text-sm font-medium text-secondary uppercase tracking-wide mb-2">Data Points</h3>
                    <p class="text-3xl font-bold text-blue-600">
                        ${technicalData.summary?.data_points || 'N/A'}
                    </p>
                    <p class="text-sm text-secondary mt-1">${currentTechnicalOptions.period} analysis</p>
                </div>
            </div>
            
            <!-- Signal Breakdown -->
            <div class="analysis-card p-6 mb-6">
                <h3 class="text-lg font-medium text-primary mb-4">Signal Breakdown</h3>
                <div class="grid grid-cols-3 gap-4">
                    <div class="text-center">
                        <div class="text-3xl font-bold text-green-600 mb-2">${bullishCount}</div>
                        <div class="text-sm font-medium text-primary">Bullish Signals</div>
                        <div class="text-xs text-secondary mt-1">Buy opportunities</div>
                    </div>
                    <div class="text-center">
                        <div class="text-3xl font-bold text-red-600 mb-2">${bearishCount}</div>
                        <div class="text-sm font-medium text-primary">Bearish Signals</div>
                        <div class="text-xs text-secondary mt-1">Sell warnings</div>
                    </div>
                    <div class="text-center">
                        <div class="text-3xl font-bold text-gray-500 mb-2">${neutralCount}</div>
                        <div class="text-sm font-medium text-primary">Neutral Signals</div>
                        <div class="text-xs text-secondary mt-1">Hold / Indecisive</div>
                    </div>
                </div>
            </div>

            
            <!-- Technical Indicators Table -->
            ${symbols.length > 0 ? `
                <div class="analysis-card overflow-hidden mb-6">
                    <div class="px-4 py-3 border-b border-card">
                        <h3 class="text-lg font-medium text-primary">Technical Analysis Results</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Symbol</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Overall Signal</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">RSI</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">MACD</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Bollinger</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">SMA</th>
                                </tr>
                            </thead>
                            <tbody class="bg-card divide-y border-card">
                                ${symbols.map(symbol => {
        const analysis = individualAnalysis[symbol] || {};
        const signals = analysis.signals || {};
        const values = analysis.values || {};
        const overallSignal = analysis.overall_signal || 'Neutral';

        console.log(`[TECHNICAL] Symbol ${symbol} analysis:`, analysis);
        console.log(`[TECHNICAL] Symbol ${symbol} signals:`, signals);
        console.log(`[TECHNICAL] Symbol ${symbol} values:`, values);

        return `
                                        <tr>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">${symbol}</td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${overallSignal === 'Bullish' ? 'bg-green-100 text-green-800' :
                overallSignal === 'Bearish' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
            }">${overallSignal}</span>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                                                ${values.rsi ? values.rsi.toFixed(2) : 'N/A'}
                                                <div class="text-xs text-gray-400">${signals.rsi || 'N/A'}</div>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                                                ${values.macd?.histogram ? values.macd.histogram.toFixed(3) : 'N/A'}
                                                <div class="text-xs text-gray-400">${signals.macd || 'N/A'}</div>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                                                <div class="text-xs text-gray-400">${signals.bollinger || 'N/A'}</div>
                                            </td>
                                            <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                                                <div class="text-xs text-gray-400">${signals.sma || 'N/A'}</div>
                                            </td>
                                        </tr>
                                    `;
    }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
            
            <!-- Analysis Parameters -->
            <div class="analysis-card p-6">
                <h4 class="text-sm font-semibold text-primary mb-3">Analysis Parameters</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span class="text-secondary">Period:</span> <span class="font-medium text-primary">${currentTechnicalOptions.period}</span></div>
                    <div><span class="text-secondary">Timeframe:</span> <span class="font-medium text-primary">${currentTechnicalOptions.timeframe}</span></div>
                    <div><span class="text-secondary">RSI Period:</span> <span class="font-medium text-primary">${currentTechnicalOptions.rsi_period}</span></div>
                    <div><span class="text-secondary">MACD Fast:</span> <span class="font-medium text-primary">${currentTechnicalOptions.macd_fast}</span></div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                    <div><span class="text-secondary">Signal Strength:</span> <span class="font-medium text-primary">${currentTechnicalOptions.signal_strength}</span></div>
                    <div><span class="text-secondary">Symbols:</span> <span class="font-medium text-primary">${symbols.length}</span></div>
                    <div><span class="text-secondary">Data Points:</span> <span class="font-medium text-primary">${technicalData.summary?.data_points || 'N/A'}</span></div>
                    <div><span class="text-secondary">Last Updated:</span> <span class="font-medium text-primary">${new Date().toLocaleDateString()}</span></div>
                </div>
            </div>
        </div>
    `;
}

function showTechnicalError(message) {
    // Try multiple possible content container IDs
    let contentDiv = document.getElementById('technicalContent');

    // If technicalContent doesn't exist, use main container
    if (!contentDiv) {
        contentDiv = document.getElementById('technicalIndicators') ||
            document.getElementById('technicalAnalysis') ||
            document.getElementById('analysisContent');
    }

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
window.loadTechnicalIndicators = loadTechnicalIndicators;
window.toggleTechnicalSettings = () => document.getElementById('technicalSettings')?.classList.toggle('hidden');
window.updateTechnicalIndicators = () => {
    updateTechnicalOptions();
    if (window.currentTechnicalPortfolio) fetchTechnicalIndicators(window.currentTechnicalPortfolio);
};
window.refreshTechnicalIndicators = () => {
    if (window.currentTechnicalPortfolio) fetchTechnicalIndicators(window.currentTechnicalPortfolio);
};

// Export the display function to window for backward compatibility
window.displayTechnicalIndicatorsResults = displayTechnicalIndicators;