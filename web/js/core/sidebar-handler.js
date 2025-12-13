// Individual Analysis View Handler
document.addEventListener('DOMContentLoaded', function () {
    const analysisButtons = document.querySelectorAll('[data-analysis]');

    analysisButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove active class from all buttons
            analysisButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');

            const analysisType = this.getAttribute('data-analysis');
            showIndividualAnalysis(analysisType);
        });
    });
});

function showIndividualAnalysis(analysisType) {
    // Hide all main sections
    hideAllSections();

    // Show individual analysis container
    const container = document.getElementById('analysisContent');
    if (container) {
        container.innerHTML = createIndividualAnalysisHTML(analysisType);
        container.classList.remove('hidden');
    }

    // Load the specific analysis
    setTimeout(() => {
        loadSpecificAnalysis(analysisType);
    }, 100);
}

function hideAllSections() {
    // Use navigation manager if available
    if (window.navigationManager) {
        window.navigationManager.hideAllSections();
        return;
    }

    // Fallback implementation
    const sections = [
        'defaultUploadSection',
        'portfolioAnalysis',
        'transactionAnalysis',
        'dataPreview',
        'analysisContent',
        'loadingSection'
    ];
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('hidden');
            element.style.display = 'none'; // Force hide
        }
    });

    // Clear any existing loading spinners
    if (window.clearAllLoadingSpinners) {
        window.clearAllLoadingSpinners();
    }
}

function createIndividualAnalysisHTML(analysisType) {
    const analysisConfig = getAnalysisConfig(analysisType);

    // For tax analysis, check if we're in transaction analysis context
    if (analysisType === 'tax-analysis') {
        const transactionAnalysisSection = document.getElementById('transactionAnalysis');
        if (transactionAnalysisSection && !transactionAnalysisSection.classList.contains('hidden')) {
            // We're in transaction analysis context, don't create individual view
            return '';
        }
        // For individual tax analysis view, don't show header with back/refresh buttons
        return `
            <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
                <div id="${analysisConfig.containerId}" class="min-h-96">
                    <div class="text-center py-12 text-blue-600">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
                        Loading ${analysisConfig.title.toLowerCase()}...
                    </div>
                </div>
            </div>
        `;
    }

    const settingsFunction = analysisType === 'accounting-analysis' ? 'toggleAccountingSettings()' :
        analysisType === 'cash-flow' ? 'toggleCashFlowSettings()' :
            analysisType === 'return-attribution' ? 'toggleReturnAttributionSettings()' : 'toggleSettings()';

    // Special handling for analyses that should not have cross button
    const noCloseButtonAnalyses = [
        'strategy-backtesting', 'technical-indicators', 'pnl-attribution',
        'cost-analysis', 'cash-flow', 'accounting-analysis', 'trade-performance',
        'turnover-analysis', 'drawdown-analysis', 'return-attribution', 'statistical-analysis',
        'sector-allocation'
    ];

    if (noCloseButtonAnalyses.includes(analysisType)) {
        return '';
    }

    const buttonsHtml = analysisConfig.hasSettings ? `
        <div class="flex items-center space-x-2">
            <button onclick="${settingsFunction}" class="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors text-sm">
                Settings
            </button>
            <button onclick="refreshAnalysis('${analysisType}')" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center">
                <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                </svg>
                Refresh
            </button>
        </div>
    ` : `
        <button onclick="refreshAnalysis('${analysisType}')" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center">
            <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
            </svg>
            Refresh
        </button>
    `;

    return `
        <div class="analysis-card p-6 mb-8">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-primary">${analysisConfig.title}</h2>
                ${buttonsHtml}
            </div>
            
            <div id="${analysisConfig.containerId}" class="min-h-96">
                <div class="text-center py-12 text-indigo-500">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-2"></div>
                    Loading ${analysisConfig.title.toLowerCase()}...
                </div>
            </div>
        </div>
    `;
}

function getAnalysisConfig(analysisType) {
    const configs = {
        'risk-metrics': { title: 'Risk Metrics', containerId: 'riskResults' },
        'options-strategies': { title: 'Options Strategies', containerId: 'optionsResults' },
        'performance-attribution': { title: 'Performance Attribution', containerId: 'performanceAttribution' },
        'monte-carlo': { title: 'Monte Carlo Simulation', containerId: 'monteCarloResults' },
        'portfolio-optimization': { title: 'Portfolio Optimization', containerId: 'optimizationChart' },
        'correlation-analysis': { title: 'Correlation Analysis', containerId: 'correlationMatrix' },
        'sector-allocation': { title: 'Sector Allocation', containerId: 'sectorAllocation' },
        'statistical-analysis': { title: 'Statistical Analysis', containerId: 'statisticalAnalysis' },
        'technical-indicators': { title: 'Technical Indicators', containerId: 'technicalAnalysis' },
        'strategy-backtesting': { title: 'Strategy Backtesting', containerId: 'strategyBacktesting' },

        'pnl-attribution': { title: 'P&L Attribution', containerId: 'pnlAttribution' },
        'trade-performance': { title: 'Trade Performance', containerId: 'tradePerformance' },
        'cost-analysis': { title: 'Cost Analysis', containerId: 'costAnalysis' },
        'turnover-analysis': { title: 'Turnover Analysis', containerId: 'turnoverAnalysis' },
        'tax-analysis': { title: 'Tax Analysis', containerId: 'taxAnalysis' },
        'cash-flow': { title: 'Cash Flow Analysis', containerId: 'cashFlowAnalysis', hasSettings: true },
        'accounting-analysis': { title: 'FIFO/LIFO Accounting', containerId: 'accountingAnalysis', hasSettings: true },
        'trade-timing': { title: 'Trade Timing Analysis', containerId: 'tradeTimingAnalysis' },
        'drawdown-analysis': { title: 'Drawdown Analysis', containerId: 'drawdownAnalysis' },
        'return-attribution': { title: 'Return Attribution', containerId: 'returnAttribution' }
    };

    return configs[analysisType] || { title: 'Analysis', containerId: 'analysisResults' };
}

function loadSpecificAnalysis(analysisType) {
    // Special handling for tax analysis - use dedicated module
    if (analysisType === 'tax-analysis' && window.loadTaxAnalysis) {
        const transactions = window.currentTransactions || window.currentTaxTransactions || [];
        // Set flag to indicate this is individual analysis mode
        window.isIndividualTaxAnalysis = true;
        window.loadTaxAnalysis(transactions);
        return;
    }

    // Special handling for strategy backtesting - use dedicated module
    if (analysisType === 'strategy-backtesting' && window.loadStrategyBacktesting) {
        const portfolioData = window.portfolioData || window.currentPortfolio || [];
        window.loadStrategyBacktesting(portfolioData);
        return;
    }

    if (window.analyticsManager && window.analyticsManager.loadAnalysis) {
        window.analyticsManager.loadAnalysis(analysisType);
    }
}

function refreshAnalysis(analysisType) {
    loadSpecificAnalysis(analysisType);
}

// Section toggle function
window.toggleSection = function (sectionId) {
    const section = document.getElementById(sectionId);
    const chevron = document.getElementById(sectionId.replace('Section', 'Chevron'));

    if (section) {
        section.classList.toggle('hidden');
        if (chevron) {
            chevron.classList.toggle('rotate-180');
        }
    }
};