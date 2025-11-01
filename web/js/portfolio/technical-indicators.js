// Technical Indicators Analysis Module
class TechnicalIndicators {
    constructor() {
        this.currentData = null;
        this.isLoading = false;
    }

    async analyzeTechnicalIndicators(portfolio, options = {}) {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const response = await fetch(`${API_BASE}/technical-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portfolio, options })
            });

            const data = await response.json();
            if (data.success) {
                this.currentData = data.technical_analysis;
                this.displayResults(data.technical_analysis);
            } else {
                this.displayError(data.error);
            }
        } catch (error) {
            console.error('Technical analysis error:', error);
            this.displayError('Failed to analyze technical indicators');
        } finally {
            this.isLoading = false;
        }
    }

    displayResults(data) {
        const container = document.getElementById('technicalAnalysis');
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-6">
                ${this.renderPortfolioSignals(data.portfolio_signals)}
                ${this.renderIndividualAnalysis(data.individual_analysis)}
                ${this.renderSummary(data.summary)}
            </div>
        `;
    }

    renderPortfolioSignals(signals) {
        if (!signals) return '';

        const overallColor = signals.overall === 'Bullish' ? 'text-green-600' : 
                           signals.overall === 'Bearish' ? 'text-red-600' : 'text-gray-600';

        return `
            <div class="bg-gray-50 rounded-lg p-4">
                <h4 class="text-lg font-semibold mb-3">Portfolio Technical Signals</h4>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold ${overallColor}">${signals.overall}</div>
                        <div class="text-sm text-gray-600">Overall Signal</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-semibold text-green-600">${(signals.bullish_weight * 100).toFixed(1)}%</div>
                        <div class="text-sm text-gray-600">Bullish Weight</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-semibold text-red-600">${(signals.bearish_weight * 100).toFixed(1)}%</div>
                        <div class="text-sm text-gray-600">Bearish Weight</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-semibold text-gray-600">${(signals.neutral_weight * 100).toFixed(1)}%</div>
                        <div class="text-sm text-gray-600">Neutral Weight</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderIndividualAnalysis(analysis) {
        if (!analysis || Object.keys(analysis).length === 0) return '';

        const symbols = Object.keys(analysis).slice(0, 10);
        
        return `
            <div>
                <h4 class="text-lg font-semibold mb-3">Individual Stock Analysis</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white border border-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Overall</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">RSI</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">MACD</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bollinger</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SMA</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">EMA</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Strength</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${symbols.map(symbol => this.renderSymbolRow(symbol, analysis[symbol])).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderSymbolRow(symbol, data) {
        const getSignalColor = (signal) => {
            if (!signal) return 'text-gray-500';
            if (signal.includes('Bullish')) return 'text-green-600';
            if (signal.includes('Bearish')) return 'text-red-600';
            return 'text-gray-600';
        };

        const getStrengthColor = (strength) => {
            if (strength === 'Strong') return 'text-green-600';
            if (strength === 'Medium') return 'text-yellow-600';
            return 'text-gray-600';
        };

        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 font-medium">${symbol}</td>
                <td class="px-4 py-2 ${getSignalColor(data.overall_signal)}">${data.overall_signal}</td>
                <td class="px-4 py-2 ${getSignalColor(data.signals.rsi)}">
                    ${data.signals.rsi || 'N/A'}
                    ${data.values.rsi ? `<br><span class="text-xs text-gray-500">${data.values.rsi.toFixed(1)}</span>` : ''}
                </td>
                <td class="px-4 py-2 ${getSignalColor(data.signals.macd)}">${data.signals.macd || 'N/A'}</td>
                <td class="px-4 py-2 ${getSignalColor(data.signals.bollinger)}">${data.signals.bollinger || 'N/A'}</td>
                <td class="px-4 py-2 ${getSignalColor(data.signals.sma)}">${data.signals.sma || 'N/A'}</td>
                <td class="px-4 py-2 ${getSignalColor(data.signals.ema)}">${data.signals.ema || 'N/A'}</td>
                <td class="px-4 py-2 ${getStrengthColor(data.signal_strength)}">${data.signal_strength}</td>
            </tr>
        `;
    }

    renderSummary(summary) {
        if (!summary) return '';

        return `
            <div class="bg-blue-50 rounded-lg p-4">
                <h4 class="text-lg font-semibold mb-3">Analysis Summary</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <div class="font-medium text-gray-700">Symbols Analyzed</div>
                        <div class="text-xl font-bold text-blue-600">${summary.symbols_analyzed}</div>
                    </div>
                    <div>
                        <div class="font-medium text-gray-700">Data Points</div>
                        <div class="text-xl font-bold text-blue-600">${summary.data_points}</div>
                    </div>
                    <div>
                        <div class="font-medium text-gray-700">Period</div>
                        <div class="text-xl font-bold text-blue-600">${summary.period_analyzed}</div>
                    </div>
                    <div>
                        <div class="font-medium text-gray-700">Timeframe</div>
                        <div class="text-xl font-bold text-blue-600">${summary.timeframe}</div>
                    </div>
                </div>
            </div>
        `;
    }

    displayError(error) {
        const container = document.getElementById('technicalAnalysis');
        if (!container) return;

        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <div class="flex items-center">
                    <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-red-800 font-medium">Technical Analysis Error</span>
                </div>
                <p class="text-red-700 mt-1">${error}</p>
            </div>
        `;
    }

    getSelectedIndicators() {
        const indicators = [];
        if (document.getElementById('indicatorRSI')?.checked) indicators.push('RSI');
        if (document.getElementById('indicatorMACD')?.checked) indicators.push('MACD');
        if (document.getElementById('indicatorBollinger')?.checked) indicators.push('Bollinger');
        if (document.getElementById('indicatorSMA')?.checked) indicators.push('SMA');
        if (document.getElementById('indicatorEMA')?.checked) indicators.push('EMA');
        return indicators;
    }

    getCurrentOptions() {
        return {
            period: document.getElementById('technicalPeriod')?.value || '1Y',
            indicators: this.getSelectedIndicators(),
            timeframe: document.getElementById('technicalTimeframe')?.value || 'Daily',
            rsi_period: parseInt(document.getElementById('rsiPeriod')?.value || '14'),
            rsi_oversold: parseInt(document.getElementById('rsiOversold')?.value || '30'),
            rsi_overbought: parseInt(document.getElementById('rsiOverbought')?.value || '70'),
            macd_fast: parseInt(document.getElementById('macdFast')?.value || '12'),
            macd_slow: parseInt(document.getElementById('macdSlow')?.value || '26'),
            macd_signal: parseInt(document.getElementById('macdSignal')?.value || '9'),
            bb_period: parseInt(document.getElementById('bbPeriod')?.value || '20'),
            bb_std: parseFloat(document.getElementById('bbStd')?.value || '2'),
            signal_strength: document.getElementById('technicalSignalStrength')?.value || 'Medium'
        };
    }
}

// Global instance
const technicalIndicators = new TechnicalIndicators();

// Global functions for HTML onclick handlers
function toggleTechnicalSettings() {
    const settings = document.getElementById('technicalSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function updateTechnicalAnalysis() {
    if (window.currentPortfolioData && window.currentPortfolioData.length > 0) {
        const options = technicalIndicators.getCurrentOptions();
        technicalIndicators.analyzeTechnicalIndicators(window.currentPortfolioData, options);
    } else {
        technicalIndicators.displayError('No portfolio data available. Please upload a portfolio first.');
    }
}

// Auto-run when portfolio data is available
function runTechnicalAnalysis(portfolioData) {
    if (portfolioData && portfolioData.length > 0) {
        const options = technicalIndicators.getCurrentOptions();
        technicalIndicators.analyzeTechnicalIndicators(portfolioData, options);
    }
}