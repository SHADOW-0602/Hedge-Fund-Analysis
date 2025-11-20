// Individual Analysis View Handler
document.addEventListener('DOMContentLoaded', function () {
    const analysisButtons = document.querySelectorAll('[data-analysis]');

    analysisButtons.forEach(button => {
        button.addEventListener('click', function () {
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

    return `
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div class="flex justify-between items-center mb-6">
                <div class="flex items-center space-x-4">
                    <button onclick="showDefaultUpload()" class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                    <h2 class="text-2xl font-bold text-gray-900">${analysisConfig.title}</h2>
                </div>
                <button onclick="refreshAnalysis('${analysisType}')" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                    </svg>
                    Refresh
                </button>
            </div>
            
            <div id="${analysisConfig.containerId}" class="min-h-96">
                <div class="text-center py-12 text-blue-600">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
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
        'cash-flow': { title: 'Cash Flow Analysis', containerId: 'cashFlowAnalysis' },
        'fifo-lifo': { title: 'FIFO/LIFO Accounting', containerId: 'fifoLifoAnalysis' },
        'trade-timing': { title: 'Trade Timing Analysis', containerId: 'tradeTimingAnalysis' },
        'drawdown-analysis': { title: 'Drawdown Analysis', containerId: 'drawdownAnalysis' },
        'return-attribution': { title: 'Return Attribution', containerId: 'returnAttribution' }
    };

    return configs[analysisType] || { title: 'Analysis', containerId: 'analysisResults' };
}

function loadSpecificAnalysis(analysisType) {
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