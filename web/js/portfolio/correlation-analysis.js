// Interactive Correlation Analysis Module - Institutional Multi-Horizon Engine
let currentCorrelationView = {
    mode: 'portfolio', // 'portfolio', 'external'
    horizon: 'medium', // 'long', 'medium', 'short'
    matrix: 'mean',     // 'mean', 'stress', 'diversification'
    isAnalyzing: false
};

// Store custom options (Lookback/Rolling)
let currentCorrelationOptions = {
    period: '2Y',
    rolling_window: '100d',
    frequency: 'Daily',
    method: 'pearson'
};

// Keep track of original portfolio for external merge
let originalPortfolioData = [];

// Store latest full result for client-side switching
let currentCorrelationResult = null;

window.loadCorrelationAnalysis = function (portfolioData, options = {}) {
    originalPortfolioData = portfolioData;
    // Load settings from localStorage
    try {
        const savedSettings = localStorage.getItem('correlationAnalysisSettings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            // We ignore legacy settings for now as we have a strict regime
            // currentCorrelationOptions = { ...currentCorrelationOptions, ...parsed };
            // console.log('[CORRELATION] Loaded settings from storage:', currentCorrelationOptions);
        }
    } catch (e) {
        console.error('Failed to load correlation settings:', e);
    }

    // Ensure analyticsCore has these settings (dummy for compatibility)
    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.correlationOptions = {};

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('correlation-analysis');
    }
};

// Display function that delegates to client-side renderer
window.displayCorrelationAnalysisResults = function (result, options) {
    // Reset loading state
    currentCorrelationView.isAnalyzing = false;

    // Store result globally for client-side switching
    window.currentCorrelationResult = result;

    // Initial Render
    window.renderCorrelationView();
};

// Main Render Function - Client Side Switching
window.renderCorrelationView = function () {
    const result = window.currentCorrelationResult;
    if (!result || !result.correlation_analysis) return;

    const container = document.getElementById('analysisContent');
    if (!container) return;

    // Dark mode detection
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';

    // Premium Color Tokens
    const bgClass = isDark ? 'bg-[#1e293b]' : 'bg-white';
    const cardBgClass = isDark ? 'bg-slate-800/40 backdrop-blur-md' : 'bg-white';
    const innerBgClass = isDark ? 'bg-slate-900/40' : 'bg-gray-50/50';
    const textClass = isDark ? 'text-slate-100' : 'text-slate-900';
    const subTextClass = isDark ? 'text-slate-400' : 'text-slate-500';
    const borderClass = isDark ? 'border-slate-700/50' : 'border-slate-200';
    const headerBgClass = isDark ? 'bg-slate-800/60' : 'bg-slate-50';

    // Robust Data Recovery for originalPortfolioData
    if (!originalPortfolioData || originalPortfolioData.length === 0) {
        if (window.portfolioData && window.portfolioData.length > 0) {
            originalPortfolioData = window.portfolioData;
        } else if (window.currentPortfolioData && window.currentPortfolioData.length > 0) {
            originalPortfolioData = window.currentPortfolioData;
        } else {
            const stored = localStorage.getItem('currentPortfolio');
            if (stored) {
                try {
                    originalPortfolioData = JSON.parse(stored);
                } catch (e) {
                    console.error('[CORRELATION] Failed to parse stored portfolio:', e);
                }
            }
        }
    }
    // Select Data for Horizon
    const horizonKey = currentCorrelationView.horizon + '_term';
    let horizonData = result.correlation_analysis[horizonKey] || result.correlation_analysis.medium_term || {};

    // Horizon Labels
    const horizonLabels = {
        'long': 'Long Term (10Y)',
        'medium': 'Medium Term (2Y)',
        'short': 'Short Term (3M)'
    };

    // Helper to render a matrix table
    const renderMatrixTable = (name, matrix, symbols) => {
        if (!symbols || symbols.length === 0) return '';
        return `
            <div class="${cardBgClass} rounded-2xl shadow-xl border ${borderClass} p-6 mb-8 transition-all hover:shadow-2xl">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-lg font-extrabold ${textClass} tracking-tight">${name} Matrix</h3>
                    <div class="px-2 py-1 ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'} rounded text-[10px] font-bold uppercase tracking-widest border border-indigo-500/20">
                        Live Data
                    </div>
                </div>
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="min-w-full border-collapse">
                        <thead>
                            <tr class="${headerBgClass}">
                                <th class="px-4 py-3 text-left text-[10px] font-black ${subTextClass} uppercase tracking-widest border-b ${borderClass} sticky left-0 z-10 ${headerBgClass}">Symbol</th>
                                ${symbols.map(s => `<th class="px-4 py-3 text-center text-[10px] font-black ${subTextClass} uppercase tracking-widest border-b ${borderClass}">${s}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody class="divide-y ${borderClass}">
                            ${symbols.map(s1 => `
                                <tr class="hover:${isDark ? 'bg-slate-700/30' : 'bg-slate-50/50'} transition-colors">
                                    <td class="px-4 py-3 whitespace-nowrap text-xs font-black ${textClass} border-r ${borderClass} sticky left-0 z-10 ${isDark ? 'bg-[#212c3d]' : 'bg-white'}">${s1}</td>
                                    ${symbols.map(s2 => {
            const val = matrix[s1]?.[s2] || 0;
            // Heatmap styling logic - Professional Financial Scale
            // Heatmap styling logic - Professional Financial Scale (Dynamic RGBA)
            let cellStyle = '';
            let cellTextClass = '';

            if (s1 === s2) {
                // Diagonal identity - Neutral
                cellTextClass = isDark ? 'text-slate-600 font-normal' : 'text-slate-300 font-normal';
                cellStyle = isDark ? 'background-color: rgba(30, 41, 59, 0.5);' : 'background-color: rgba(248, 250, 252, 1);';
            } else {
                const absVal = Math.abs(val);
                // Calculate opacity: 0.1 to 0.95 based on magnitude
                const opacity = 0.05 + (absVal * 0.9);

                if (val > 0) {
                    // Positive Correlation (Rose/Red) -> Risk Concentration
                    // Rose-600: 225, 29, 72. Rose-500: 244, 63, 94
                    cellStyle = `background-color: rgba(225, 29, 72, ${opacity});`;
                    cellTextClass = absVal > 0.4 ? 'text-white' : (isDark ? 'text-rose-200' : 'text-rose-900');
                } else {
                    // Negative Correlation (Emerald/Green) -> Diversification
                    // Emerald-600: 5, 150, 105. Emerald-500: 16, 185, 129
                    cellStyle = `background-color: rgba(5, 150, 105, ${opacity});`;
                    cellTextClass = absVal > 0.4 ? 'text-white' : (isDark ? 'text-emerald-200' : 'text-emerald-900');
                }
            }

            // Fallback for very near zero
            if (Math.abs(val) < 0.01 && s1 !== s2) {
                cellStyle = '';
                cellTextClass = isDark ? 'text-slate-500' : 'text-slate-400';
            }

            return `<td class="px-4 py-3 whitespace-nowrap text-xs text-center font-bold ${cellTextClass} border ${borderClass} transition-all hover:scale-110 hover:z-20 cursor-default group relative" style="${cellStyle}">
                        ${window.analyticsCore.formatNumber(val)}
                    </td>`;

        }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };

    // Extract all three matrices
    const meanMatrix = horizonData.mean_correlation_matrix || horizonData.correlation_matrix || {};
    const stressMatrix = horizonData.stress_correlation_matrix || {};
    const diversificationMatrix = horizonData.diversification_correlation_matrix || {};
    const hasData = Object.keys(meanMatrix).length > 0;

    // Determine which symbols to display in the matrix
    let symbols = Object.keys(meanMatrix);

    if (currentCorrelationView.mode === 'external' && !window.includePortfolioInExternal) {
        // Filter out portfolio symbols if they chose not to include them
        const portfolioSymbols = new Set((originalPortfolioData || []).map(p => {
            const s = p.symbol || p.Symbol || p.ticker || p.Ticker || p.instrument || p.asset || p.Asset || p.id;
            return s ? s.toString().toUpperCase() : null;
        }).filter(s => s));

        symbols = symbols.filter(s => !portfolioSymbols.has(s.toUpperCase()));
    } else if (currentCorrelationView.mode === 'external' && window.includePortfolioInExternal && window.portfolioSymbolsSelection) {
        // Filter out specific symbols that are unchecked
        const portfolioSymbols = new Set((originalPortfolioData || []).map(p => {
            const s = p.symbol || p.Symbol || p.ticker || p.Ticker || p.instrument || p.asset || p.Asset || p.id;
            return s ? s.toString().toUpperCase() : null;
        }).filter(s => s));

        symbols = symbols.filter(s => {
            const upS = s.toUpperCase();
            if (portfolioSymbols.has(upS)) {
                return window.portfolioSymbolsSelection[upS] !== false;
            }
            return true;
        });
    }

    // Render HTML
    container.innerHTML = `
        <div class="flex flex-col space-y-6 mb-8">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex flex-col">
                    <h2 class="text-3xl font-black ${textClass} tracking-tight">Correlation Analysis</h2>
                    <div class="flex mt-3 space-x-1 p-1 ${isDark ? 'bg-slate-900/60' : 'bg-slate-100'} rounded-xl w-fit border ${borderClass}">
                        <button onclick="setCorrelationMode('portfolio')" 
                                class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${currentCorrelationView.mode === 'portfolio' ? (isDark ? 'bg-slate-700 shadow-lg ' + textClass : 'bg-white shadow-md ' + textClass) : 'text-slate-500 hover:text-indigo-500'}">
                            Portfolio
                        </button>
                        <button onclick="setCorrelationMode('external')" 
                                class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${currentCorrelationView.mode === 'external' ? (isDark ? 'bg-slate-700 shadow-lg ' + textClass : 'bg-white shadow-md ' + textClass) : 'text-slate-500 hover:text-indigo-500'}">
                            Ticker Analysis
                        </button>
                    </div>
                </div>

                ${currentCorrelationView.isAnalyzing ? `
                    <button class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg transition-colors text-sm flex items-center opacity-50 cursor-not-allowed shadow-md" disabled>
                        <svg class="w-4 h-4 mr-1.5 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z" clip-rule="evenodd"></path>
                        </svg>
                        Analyzing...
                    </button>
                ` : `
                    <button onclick="updateCorrelationAnalysis()" class="bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-all text-sm font-bold flex items-center shadow-md active:scale-95">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Analyze & Refresh
                    </button>
                `}
            </div>

            <!-- External Analysis Input Section -->
            ${currentCorrelationView.mode === 'external' ? `
                <div class="p-8 ${cardBgClass} border ${borderClass} rounded-[2rem] shadow-2xl space-y-6">
                    <div class="flex flex-col space-y-3">
                        <label class="text-[10px] font-black ${subTextClass} uppercase tracking-[0.2em] flex items-center ml-1">
                            <svg class="w-3.5 h-3.5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                            Analysis Tickers (Comma separated)
                        </label>
                        <div class="relative w-full">
                            <textarea id="correlationExternalSymbols" 
                                      placeholder="e.g., AAPL, MSFT, BTC-USD, GLD, TSLA"
                                      oninput="this.value = this.value.toUpperCase(); localStorage.setItem('correlationTickerStorage', this.value); window.lastExternalSymbols = this.value;"
                                      onkeydown="if(event.key === 'Enter') { event.preventDefault(); window.updateCorrelationAnalysis(); }"
                                      class="w-full px-5 py-4 pr-14 border-2 ${borderClass} ${isDark ? 'bg-slate-900/40' : 'bg-slate-50'} ${textClass} rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 h-28 shadow-inner transition-all resize-none placeholder:text-slate-600"
                            >${window.lastExternalSymbols || localStorage.getItem('correlationTickerStorage') || ''}</textarea>
                            <button onclick="window.updateCorrelationAnalysis()" 
                                    class="absolute bottom-4 right-4 p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 group z-10"
                                    title="Run Analysis">
                                <svg class="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 12h15"/></svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="flex flex-col space-y-5 ${innerBgClass} p-6 rounded-[1.5rem] border ${borderClass} transition-all">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-4">
                                <div class="relative flex items-center">
                                    <input type="checkbox" id="correlationIncludePortfolio" 
                                        ${window.includePortfolioInExternal ? 'checked' : ''}
                                        onchange="window.togglePortfolioInExternal(this.checked)"
                                        class="peer w-6 h-6 text-indigo-600 border-2 ${borderClass} rounded-lg ${isDark ? 'bg-slate-900' : 'bg-white'} focus:ring-offset-0 focus:ring-indigo-500 cursor-pointer transition-all">
                                    <svg class="absolute w-4 h-4 text-white pointer-events-none hidden peer-checked:block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="4"><path d="M5 13l4 4L19 7"/></svg>
                                </div>
                                <label for="correlationIncludePortfolio" class="text-sm font-black ${textClass} cursor-pointer select-none tracking-tight">Include current portfolio holdings</label>
                            </div>
                            
                            ${window.includePortfolioInExternal ? `
                                <div class="flex items-center space-x-4">
                                    ${Object.keys(meanMatrix || {}).length > 0 ? `
                                        <span class="flex items-center px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[9px] font-black uppercase tracking-tighter border border-emerald-500/20">
                                            <svg class="w-2.5 h-2.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                                            Filtered to Results
                                        </span>
                                    ` : ''}
                                    <div class="flex space-x-3 text-[9px]">
                                        <button onclick="window.setPortfolioSymbolsSelected(true)" class="font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-tighter transition-colors">SELECT ALL</button>
                                        <span class="text-slate-700 font-bold opacity-30">|</span>
                                        <button onclick="window.setPortfolioSymbolsSelected(false)" class="font-black text-slate-500 hover:text-slate-400 uppercase tracking-tighter transition-colors">CLEAR</button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        ${window.includePortfolioInExternal ? `
                            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 border-t ${borderClass}">
                                ${(function () {
                    // All symbols from original portfolio
                    let symbols = Array.from(new Set((originalPortfolioData || []).map(p => {
                        const s = p.symbol || p.Symbol || p.ticker || p.Ticker || p.instrument || p.asset || p.Asset || p.id;
                        return s ? s.toString().toUpperCase() : null;
                    }).filter(s => s))).sort();

                    // If we have matrix results, filter to only show symbols present in matrix
                    // (Unless the matrix is completely empty)
                    const matrixSymbols = Object.keys(meanMatrix || {});
                    if (matrixSymbols.length > 0) {
                        symbols = symbols.filter(s => matrixSymbols.includes(s));
                    }

                    if (symbols.length === 0) {
                        return `<div class="col-span-full py-6 text-center text-slate-500 text-xs italic font-bold opacity-60">
                                    ${matrixSymbols.length > 0 ? 'No portfolio symbols match the active analysis results.' : 'No portfolio symbols detected in local memory'}
                                </div>`;
                    }

                    if (window.portfolioSymbolsSelection === undefined) {
                        window.portfolioSymbolsSelection = {};
                        symbols.forEach(s => window.portfolioSymbolsSelection[s] = true);
                    }

                    return symbols.map(s => `
                                        <div class="flex items-center space-x-2.5 group p-2 rounded-xl transition-all hover:${isDark ? 'bg-slate-800' : 'bg-white'} hover:shadow-sm border border-transparent hover:${borderClass}">
                                            <input type="checkbox" id="psel_${s}" 
                                                ${window.portfolioSymbolsSelection[s] !== false ? 'checked' : ''}
                                                onchange="window.portfolioSymbolsSelection['${s}'] = this.checked; window.renderCorrelationView();"
                                                class="w-4 h-4 text-indigo-500 border-2 ${borderClass} rounded focus:ring-0 cursor-pointer ${isDark ? 'bg-slate-900' : 'bg-white'}">
                                            <label for="psel_${s}" class="text-[11px] font-bold ${subTextClass} cursor-pointer group-hover:${textClass} transition-colors tracking-tight">${s}</label>
                                        </div>
                                    `).join('');
                })()}
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}

            <!-- Controls Toolbar -->
            <div class="flex flex-wrap items-center gap-8 p-6 ${cardBgClass} border ${borderClass} rounded-[1.5rem] shadow-lg overflow-hidden relative">
                <div class="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                
                <!-- Horizon Selection -->
                <div class="flex items-center space-x-4">
                    <span class="text-[10px] font-black ${subTextClass} uppercase tracking-[0.2em]">Core Horizon</span>
                    <div class="flex p-1 ${isDark ? 'bg-slate-900/60' : 'bg-slate-100'} rounded-xl border ${borderClass}">
                        ${['long', 'medium', 'short'].map(h => `
                            <button onclick="setCorrelationHorizon('${h}')" 
                                    class="px-5 py-2 text-[10px] font-black rounded-lg transition-all ${currentCorrelationView.horizon === h
                        ? 'bg-indigo-600 text-white shadow-lg scale-[1.05]'
                        : 'text-slate-500 hover:text-indigo-400'}">
                                ${h.toUpperCase()}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <div class="w-px h-10 bg-slate-700/50 hidden md:block"></div>

                <!-- Lookback override -->
                 <div class="flex items-center space-x-4">
                    <span class="text-[10px] font-black ${subTextClass} uppercase tracking-[0.2em]">Lookback</span>
                    <select id="correlationPeriod" onchange="updateCorrelationAnalysis()" class="px-5 py-2.5 border-2 ${borderClass} ${isDark ? 'bg-slate-900/60' : 'bg-white'} ${textClass} rounded-xl text-xs font-black focus:outline-none focus:ring-4 focus:ring-indigo-500/20 cursor-pointer shadow-sm hover:border-indigo-500 transition-all appearance-none pr-10">
                        <option value="3M" ${currentCorrelationOptions.period === '3M' ? 'selected' : ''}>3 MONTHS</option>
                        <option value="6M" ${currentCorrelationOptions.period === '6M' ? 'selected' : ''}>6 MONTHS</option>
                        <option value="1Y" ${currentCorrelationOptions.period === '1Y' ? 'selected' : ''}>1 YEAR</option>
                        <option value="2Y" ${currentCorrelationOptions.period === '2Y' ? 'selected' : ''}>2 YEARS</option>
                        <option value="3Y" ${currentCorrelationOptions.period === '3Y' ? 'selected' : ''}>3 YEARS</option>
                        <option value="5Y" ${currentCorrelationOptions.period === '5Y' ? 'selected' : ''}>5 YEARS</option>
                        <option value="10Y" ${currentCorrelationOptions.period === '10Y' ? 'selected' : ''}>10 YEARS</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="space-y-10">
            <!-- Active Horizon Info Badge -->
            <div class="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-3 ${isDark ? 'bg-indigo-500/5' : 'bg-indigo-50/50'} rounded-2xl border border-indigo-500/10 transition-all">
                <div class="flex items-center space-x-3">
                    <div class="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse"></div>
                    <span class="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                        Scale: <span class="bg-indigo-600 text-white px-2 py-0.5 rounded text-[9px] ml-1">${horizonLabels[currentCorrelationView.horizon]}</span>
                    </span>
                    <span class="text-slate-300 dark:text-slate-600">|</span>
                    <span class="text-[10px] font-bold ${textClass} opacity-60">
                        MODE: ${currentCorrelationOptions.period === '2Y' && currentCorrelationView.horizon === 'medium' ? 'INSTITUTIONAL' : 'CUSTOM OVERRIDE'}
                    </span>
                </div>
                
                <div class="flex items-center gap-6">
                    <div class="flex flex-col items-end">
                        <span class="text-[9px] font-black ${subTextClass} uppercase tracking-tighter opacity-50">Frequency</span>
                        <span class="text-xs font-black ${textClass}">${horizonData.frequency || 'N/A'}</span>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-[9px] font-black ${subTextClass} uppercase tracking-tighter opacity-50">Window</span>
                        <span class="text-xs font-black ${textClass}">${horizonData.rolling_window || 'N/A'}</span>
                    </div>
                    <div class="flex items-center bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                        <span class="text-[9px] font-black text-emerald-400 uppercase">Live Processing</span>
                    </div>
                </div>
            </div>

            ${hasData ? `
                <!-- Triple Matrix Output -->
                <div class="grid grid-cols-1 gap-12">
                    ${renderMatrixTable('Mean Correlation', meanMatrix, symbols)}
                    ${renderMatrixTable('Stress Correlation (95th %)', stressMatrix, symbols)}
                    ${renderMatrixTable('Diversification (Tail Correlation)', diversificationMatrix, symbols)}
                </div>
            ` : `
                <div class="p-20 text-center ${cardBgClass} rounded-[3rem] border-4 border-dashed ${borderClass} shadow-inner transition-all hover:border-indigo-500/30">
                    <div class="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-800/20 mb-6">
                        <svg class="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-black ${textClass} tracking-tight">Insufficient Historical Data</h3>
                    <p class="text-sm ${subTextClass} mt-3 max-w-sm mx-auto font-medium leading-relaxed">
                        We need at least ${currentCorrelationOptions.rolling_window} of active trading data for all tokens to compute these robust matrices.
                    </p>
                    <div class="mt-8 inline-flex items-center px-4 py-2 bg-indigo-500/10 text-indigo-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-500/20">
                        Pro Tip: Try a shorter Lookback period
                    </div>
                </div>
            `}
        </div>
    `;
};

// Generate correlation insights (Optional helper, specific to pairs)
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

// Actions
window.setCorrelationHorizon = function (horizon) {
    if (currentCorrelationView.horizon !== horizon) {
        currentCorrelationView.horizon = horizon;
        window.renderCorrelationView();
    }
};


window.setCorrelationMode = function (mode) {
    if (currentCorrelationView.mode !== mode) {
        currentCorrelationView.mode = mode;
        window.renderCorrelationView();
    }
};

window.togglePortfolioInExternal = function (checked) {
    window.includePortfolioInExternal = checked;
    window.renderCorrelationView();
};

window.setPortfolioSymbolsSelected = function (selected) {
    if (window.portfolioSymbolsSelection) {
        Object.keys(window.portfolioSymbolsSelection).forEach(s => {
            window.portfolioSymbolsSelection[s] = selected;
        });
        window.renderCorrelationView();
    }
};

window.updateCorrelationAnalysis = () => {
    const isExternal = currentCorrelationView.mode === 'external';

    // Capture current input value BEFORE re-rendering (which would wipe it)
    if (isExternal) {
        const symbolInput = document.getElementById('correlationExternalSymbols');
        if (symbolInput) {
            window.lastExternalSymbols = symbolInput.value;
            // Also update storage immediately to be safe
            localStorage.setItem('correlationTickerStorage', symbolInput.value);
        }
    }

    currentCorrelationView.isAnalyzing = true;
    window.renderCorrelationView(); // Re-render to show loading button instantly

    // 1. Read current Lookback value
    const periodInput = document.getElementById('correlationPeriod');
    if (periodInput) currentCorrelationOptions.period = periodInput.value;

    // 2. Automate Rolling Window selection
    const rollingMap = {
        '3M': '20d',
        '6M': '30d',
        '1Y': '60d',
        '2Y': '100d',
        '3Y': '100d',
        '5Y': '252d',
        '10Y': '252d'
    };
    currentCorrelationOptions.rolling_window = rollingMap[currentCorrelationOptions.period] || '60d';

    // 3. Prepare Payload based on mode
    let payload = {
        portfolio: originalPortfolioData,
        options: currentCorrelationOptions
    };

    if (isExternal) {
        const symbolInput = document.getElementById('correlationExternalSymbols');
        const includePortfolioCheck = document.getElementById('correlationIncludePortfolio');

        // Use the captured value from window.lastExternalSymbols if available, otherwise read from DOM (fallback)
        const rawSymbolsStr = window.lastExternalSymbols !== undefined ? window.lastExternalSymbols : (symbolInput ? symbolInput.value : '');

        window.includePortfolioInExternal = includePortfolioCheck ? includePortfolioCheck.checked : false;

        const rawSymbols = rawSymbolsStr.split(',').map(s => s.trim().toUpperCase()).filter(s => s);

        // --- Integration: Global Search Ticker ---
        // Retrieve the current ticker selected from the global search (stored in News module)
        const globalSearchTicker = localStorage.getItem('selectedTicker');
        if (globalSearchTicker && !rawSymbols.includes(globalSearchTicker.toUpperCase())) {
            // Only auto-add if we have nothing in storage yet
            if (!localStorage.getItem('correlationTickerStorage')) {
                console.log('[CORRELATION] Including global search ticker:', globalSearchTicker);
                rawSymbols.push(globalSearchTicker.toUpperCase());
            }
        }

        // Save to dedicated storage
        if (rawSymbolsStr) {
            localStorage.setItem('correlationTickerStorage', rawSymbolsStr);
        }
        // ------------------------------------------

        let combinedSymbols = rawSymbols.map(s => ({ symbol: s }));

        if (window.includePortfolioInExternal) {
            // Merge unique symbols that are SELECTED
            const portfolioItems = (originalPortfolioData || []).filter(p => {
                const s = p.symbol || p.Symbol || p.ticker || p.Ticker || p.instrument;
                if (!s) return false;
                const sym = s.toString().toUpperCase();
                // Check if this symbol is selected in our dynamic list
                return window.portfolioSymbolsSelection && window.portfolioSymbolsSelection[sym] !== false;
            });

            const uniquePortfolioSymbols = Array.from(new Set(portfolioItems.map(p => {
                const s = p.symbol || p.Symbol || p.ticker || p.Ticker || p.instrument;
                return s.toString().toUpperCase();
            })));

            uniquePortfolioSymbols.forEach(s => {
                if (!rawSymbols.includes(s)) {
                    combinedSymbols.push({ symbol: s });
                    rawSymbols.push(s);
                }
            });
        }
        payload.portfolio = combinedSymbols;
    }

    // 4. Show loading state
    const container = document.getElementById('analysisContent');
    if (container) {
        container.innerHTML = `
            <div class="p-12 text-center">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
                <h3 class="text-lg font-semibold">Refetching Multi-Horizon Data...</h3>
                <p class="text-sm text-gray-500 mt-2">Mode: ${isExternal ? 'Ticker Analysis' : 'Portfolio'} | Lookback: ${currentCorrelationOptions.period} | Rolling: ${currentCorrelationOptions.rolling_window}</p>
            </div>
        `;
    }

    // 5. Pass data to API
    window.analyticsCore.analyzePortfolio(
        'correlation-analysis',
        'analysisContent',
        window.displayCorrelationAnalysisResults,
        (err) => {
            currentCorrelationView.isAnalyzing = false;
            window.renderCorrelationView();
            console.error('[CORRELATION] Analysis failed:', err);
        },
        currentCorrelationOptions,
        payload.portfolio
    );
};

// Aliases for compatibility
window.refreshCorrelationAnalysis = window.updateCorrelationAnalysis;
