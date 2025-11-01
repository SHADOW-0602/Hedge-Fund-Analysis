// Sidebar functionality for navigation
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const chevronId = sectionId.replace('Section', 'Chevron');
    const chevron = document.getElementById(chevronId);
    
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        chevron.style.transform = 'rotate(180deg)';
    } else {
        section.classList.add('hidden');
        chevron.style.transform = 'rotate(0deg)';
    }
}

function showAnalysisSection(analysisType) {
    // Hide default upload section
    document.getElementById('defaultUploadSection').classList.add('hidden');
    
    // Show analysis container
    document.getElementById('analysisContainer').classList.remove('hidden');
    
    // Hide all analysis sections
    document.getElementById('portfolioAnalysis').classList.add('hidden');
    document.getElementById('transactionAnalysis').classList.add('hidden');
    
    // Show selected analysis section
    document.getElementById(analysisType).classList.remove('hidden');
}

function showDefaultUpload() {
    // Show default upload section
    document.getElementById('defaultUploadSection').classList.remove('hidden');
    
    // Hide analysis container
    document.getElementById('analysisContainer').classList.add('hidden');
}

function showDataActions() {
    // Show view/clear data buttons after data is loaded
    document.getElementById('dataActions').classList.remove('hidden');
}

function hideDataActions() {
    // Hide view/clear data buttons
    document.getElementById('dataActions').classList.add('hidden');
}

function viewLoadedData() {
    const dataPreview = document.getElementById('dataPreview');
    if (dataPreview.classList.contains('hidden')) {
        showDataPreview();
    } else {
        hideDataPreview();
    }
}

function showDataPreview() {
    const portfolioData = window.portfolioData || JSON.parse(localStorage.getItem('currentPortfolio') || '[]');
    const transactionData = JSON.parse(localStorage.getItem('currentTransactions') || '[]');
    const dataPreviewContent = document.getElementById('dataPreviewContent');
    
    let content = '';
    
    if (portfolioData && portfolioData.length > 0) {
        content += '<div class="mb-6">';
        content += '<h4 class="font-semibold text-indigo-800 dark:text-indigo-200 mb-3">Portfolio Holdings (' + portfolioData.length + ')</h4>';
        content += '<div class="overflow-x-auto">';
        content += '<table class="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">';
        content += '<thead class="bg-indigo-50 dark:bg-indigo-900">';
        content += '<tr><th class="px-4 py-2 text-left text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Symbol</th>';
        content += '<th class="px-4 py-2 text-right text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Quantity</th>';
        content += '<th class="px-4 py-2 text-right text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Avg Cost</th>';
        content += '<th class="px-4 py-2 text-right text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Market Value</th></tr>';
        content += '</thead><tbody class="divide-y divide-gray-200 dark:divide-gray-600">';
        
        portfolioData.forEach((item, index) => {
            const value = (item.quantity * (item.avg_cost || item.price || 0));
            const rowClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700';
            content += '<tr class="' + rowClass + '">';
            content += '<td class="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">' + item.symbol + '</td>';
            content += '<td class="px-4 py-2 text-right text-gray-700 dark:text-gray-300">' + item.quantity.toLocaleString() + '</td>';
            content += '<td class="px-4 py-2 text-right text-gray-700 dark:text-gray-300">$' + (item.avg_cost || item.price || 0).toFixed(2) + '</td>';
            content += '<td class="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-100">$' + value.toLocaleString() + '</td>';
            content += '</tr>';
        });
        
        content += '</tbody></table></div></div>';
    }
    
    if (transactionData && transactionData.length > 0) {
        content += '<div class="mb-6">';
        content += '<h4 class="font-semibold text-purple-800 dark:text-purple-200 mb-3">Recent Transactions (' + transactionData.length + ')</h4>';
        content += '<div class="overflow-x-auto">';
        content += '<table class="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">';
        content += '<thead class="bg-purple-50 dark:bg-purple-900">';
        content += '<tr><th class="px-4 py-2 text-left text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wider">Symbol</th>';
        content += '<th class="px-4 py-2 text-center text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wider">Type</th>';
        content += '<th class="px-4 py-2 text-right text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wider">Quantity</th>';
        content += '<th class="px-4 py-2 text-right text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wider">Price</th>';
        content += '<th class="px-4 py-2 text-right text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wider">Date</th></tr>';
        content += '</thead><tbody class="divide-y divide-gray-200 dark:divide-gray-600">';
        
        transactionData.slice(0, 10).forEach((item, index) => {
            const typeColor = item.transaction_type === 'BUY' ? 'text-green-600 dark:text-green-400' : item.transaction_type === 'SELL' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400';
            const rowClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700';
            const date = item.date ? new Date(item.date).toLocaleDateString() : 'N/A';
            content += '<tr class="' + rowClass + '">';
            content += '<td class="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">' + item.symbol + '</td>';
            content += '<td class="px-4 py-2 text-center"><span class="px-2 py-1 text-xs font-medium rounded ' + typeColor + ' bg-opacity-10">' + item.transaction_type + '</span></td>';
            content += '<td class="px-4 py-2 text-right text-gray-700 dark:text-gray-300">' + Math.abs(item.quantity).toLocaleString() + '</td>';
            content += '<td class="px-4 py-2 text-right text-gray-700 dark:text-gray-300">$' + (item.price || 0).toFixed(2) + '</td>';
            content += '<td class="px-4 py-2 text-right text-gray-700 dark:text-gray-300">' + date + '</td>';
            content += '</tr>';
        });
        
        if (transactionData.length > 10) {
            content += '<tr class="bg-purple-50 dark:bg-purple-900"><td colspan="5" class="px-4 py-2 text-center text-purple-600 dark:text-purple-300 text-sm">+ ' + (transactionData.length - 10) + ' more transactions</td></tr>';
        }
        
        content += '</tbody></table></div></div>';
    }
    
    if ((!portfolioData || portfolioData.length === 0) && (!transactionData || transactionData.length === 0)) {
        content = '<div class="text-gray-500 dark:text-gray-400 text-center py-8">No data currently loaded</div>';
    }
    
    dataPreviewContent.innerHTML = content;
    document.getElementById('dataPreview').classList.remove('hidden');
}

function hideDataPreview() {
    document.getElementById('dataPreview').classList.add('hidden');
}

function showAnalysisPreview(type) {
    const portfolioData = window.portfolioData || JSON.parse(localStorage.getItem('currentPortfolio') || '[]');
    const transactionData = JSON.parse(localStorage.getItem('currentTransactions') || '[]');
    
    if ((!portfolioData || portfolioData.length === 0) && (!transactionData || transactionData.length === 0)) {
        alert('Please upload data first to view analysis');
        return;
    }
    
    const analysisContainer = document.getElementById('analysisContainer');
    const defaultUpload = document.getElementById('defaultUploadSection');
    const dataPreview = document.getElementById('dataPreview');
    
    // Hide default sections
    defaultUpload.classList.add('hidden');
    dataPreview.classList.add('hidden');
    analysisContainer.classList.remove('hidden');
    
    const analysisNames = {
        'risk': 'Risk Metrics',
        'options': 'Options Strategies',
        'performance': 'Performance Attribution',
        'montecarlo': 'Monte Carlo Simulation',
        'optimization': 'Portfolio Optimization',
        'correlation': 'Correlation Analysis',
        'sector': 'Sector Allocation',
        'statistical': 'Statistical Analysis',
        'technical': 'Technical Indicators',
        'backtesting': 'Strategy Backtesting',
        'pnl': 'P&L Attribution',
        'trade': 'Trade Performance',
        'cost': 'Cost Analysis',
        'turnover': 'Turnover Analysis',
        'tax': 'Tax Analysis',
        'cashflow': 'Cash Flow Analysis',
        'fifo': 'FIFO/LIFO Accounting',
        'timing': 'Trade Timing Analysis',
        'drawdown': 'Drawdown Analysis',
        'return': 'Return Attribution'
    };
    
    const isPortfolio = ['risk', 'options', 'performance', 'montecarlo', 'optimization', 'correlation', 'sector', 'statistical', 'technical', 'backtesting'].includes(type);
    const themeColor = isPortfolio ? 'indigo' : 'purple';
    
    // Create individual analysis card
    let content = '<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">';
    content += '<div class="flex justify-between items-center mb-4">';
    content += '<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">' + analysisNames[type] + '</h3>';
    content += '<button onclick="showDefaultUpload()" class="text-gray-400 hover:text-gray-600">';
    content += '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
    content += '</button></div>';
    content += '<div id="' + type + 'Results"></div></div>';
    
    analysisContainer.innerHTML = content;
    
    // Load specific analysis with proper container ID
    switch(type) {
        case 'risk':
            const riskContainer = document.getElementById('riskResults');
            if (riskContainer) {
                riskContainer.innerHTML = '';
                if (typeof loadRiskAnalytics === 'function') {
                    loadRiskAnalytics(portfolioData);
                }
            }
            break;
        case 'options':
            const optionsContainer = document.getElementById('optionsResults');
            if (optionsContainer) {
                optionsContainer.innerHTML = '';
                if (typeof loadOptionsAnalytics === 'function') {
                    loadOptionsAnalytics(portfolioData);
                }
            }
            break;
        case 'performance':
            const performanceContainer = document.getElementById('performanceResults');
            if (performanceContainer) {
                performanceContainer.id = 'performanceAttribution';
                performanceContainer.innerHTML = '';
                if (typeof loadEnhancedPerformanceAttribution === 'function') {
                    loadEnhancedPerformanceAttribution(portfolioData);
                }
            }
            break;
        case 'montecarlo':
            const montecarloContainer = document.getElementById('montecarloResults');
            if (montecarloContainer) {
                montecarloContainer.id = 'monteCarloResults';
                montecarloContainer.innerHTML = '';
                if (typeof createMonteCarloResults === 'function') {
                    createMonteCarloResults(portfolioData);
                }
            }
            break;
        case 'optimization':
            const optimizationContainer = document.getElementById('optimizationResults');
            if (optimizationContainer) {
                optimizationContainer.id = 'portfolioOptimization';
                optimizationContainer.innerHTML = '';
                if (typeof loadPortfolioOptimization === 'function') {
                    loadPortfolioOptimization(portfolioData);
                }
            }
            break;
        case 'correlation':
            const correlationContainer = document.getElementById('correlationResults');
            if (correlationContainer) {
                correlationContainer.id = 'correlationMatrix';
                correlationContainer.innerHTML = '';
                if (typeof loadCorrelationAnalysis === 'function') {
                    loadCorrelationAnalysis(portfolioData);
                }
            }
            break;
        case 'sector':
            const sectorContainer = document.getElementById('sectorResults');
            if (sectorContainer) {
                sectorContainer.id = 'sectorAllocation';
                sectorContainer.innerHTML = '';
                if (typeof loadEnhancedSectorAnalysis === 'function') {
                    loadEnhancedSectorAnalysis(portfolioData);
                }
            }
            break;
        case 'statistical':
            const statisticalContainer = document.getElementById('statisticalResults');
            if (statisticalContainer) {
                statisticalContainer.id = 'statisticalAnalysis';
                statisticalContainer.innerHTML = '';
                if (typeof loadStatisticalAnalysis === 'function') {
                    loadStatisticalAnalysis(portfolioData);
                }
            }
            break;
        case 'technical':
            // Create the container with the correct ID that the function expects
            const technicalContainer = document.getElementById('technicalResults');
            if (technicalContainer) {
                technicalContainer.id = 'enhancedTechnicalAnalysis';
                technicalContainer.innerHTML = '';
                if (typeof loadEnhancedTechnicalAnalysis === 'function') {
                    loadEnhancedTechnicalAnalysis(portfolioData);
                }
            }
            break;
        case 'backtesting':
            const backtestingContainer = document.getElementById('backtestingResults');
            if (backtestingContainer) {
                backtestingContainer.innerHTML = '';
                if (typeof loadBacktestingResults === 'function') {
                    loadBacktestingResults(portfolioData);
                }
            }
            break;
        case 'pnl':
            // Rename container to match function expectation
            const pnlContainer = document.getElementById('pnlResults');
            if (pnlContainer) {
                pnlContainer.id = 'pnlAttribution';
                pnlContainer.innerHTML = '';
                if (typeof loadPnLAttribution === 'function') {
                    loadPnLAttribution(transactionData);
                }
            }
            break;
        case 'trade':
            const tradeContainer = document.getElementById('tradeResults');
            if (tradeContainer) {
                tradeContainer.id = 'tradePerformance';
                tradeContainer.innerHTML = '';
                if (typeof loadTradePerformance === 'function') {
                    loadTradePerformance(transactionData);
                }
            }
            break;
        case 'cost':
            const costContainer = document.getElementById('costResults');
            if (costContainer) {
                costContainer.id = 'costAnalysis';
                costContainer.innerHTML = '';
                if (typeof loadCostAnalysis === 'function') {
                    loadCostAnalysis(transactionData);
                }
            }
            break;
        case 'turnover':
            const turnoverContainer = document.getElementById('turnoverResults');
            if (turnoverContainer) {
                turnoverContainer.id = 'turnoverAnalysis';
                turnoverContainer.innerHTML = '';
                if (typeof loadTurnoverAnalysis === 'function') {
                    loadTurnoverAnalysis(transactionData);
                }
            }
            break;
        case 'tax':
            const taxContainer = document.getElementById('taxResults');
            if (taxContainer) {
                taxContainer.id = 'taxAnalysis';
                taxContainer.innerHTML = '';
                if (typeof loadTaxAnalysis === 'function') {
                    loadTaxAnalysis(transactionData);
                }
            }
            break;
        case 'cashflow':
            const cashflowContainer = document.getElementById('cashflowResults');
            if (cashflowContainer) {
                cashflowContainer.id = 'cashFlowAnalysis';
                cashflowContainer.innerHTML = '';
                if (typeof loadCashFlowAnalysis === 'function') {
                    loadCashFlowAnalysis(transactionData);
                }
            }
            break;
        case 'fifo':
            const fifoContainer = document.getElementById('fifoResults');
            if (fifoContainer) {
                fifoContainer.id = 'fifoLifoAnalysis';
                fifoContainer.innerHTML = '';
                if (typeof loadFifoLifoAnalysis === 'function') {
                    loadFifoLifoAnalysis(transactionData);
                }
            }
            break;
        case 'timing':
            const timingContainer = document.getElementById('timingResults');
            if (timingContainer) {
                timingContainer.id = 'tradeTimingAnalysis';
                timingContainer.innerHTML = '';
                if (typeof loadTradeTimingAnalysis === 'function') {
                    loadTradeTimingAnalysis(transactionData);
                }
            }
            break;
        case 'drawdown':
            const drawdownContainer = document.getElementById('drawdownResults');
            if (drawdownContainer) {
                drawdownContainer.id = 'drawdownAnalysis';
                drawdownContainer.innerHTML = '';
                if (typeof loadDrawdownAnalysis === 'function') {
                    loadDrawdownAnalysis(transactionData);
                }
            }
            break;
        case 'return':
            const returnContainer = document.getElementById('returnResults');
            if (returnContainer) {
                returnContainer.id = 'returnAttribution';
                returnContainer.innerHTML = '';
                if (typeof loadReturnAttribution === 'function') {
                    loadReturnAttribution(transactionData);
                }
            }
            break;
        default:
            document.getElementById(type + 'Results').innerHTML = '<div class="text-center py-8 text-gray-500">Analysis coming soon...</div>';
    }
}

// Initialize sidebar state
document.addEventListener('DOMContentLoaded', function() {
    // Show default upload section on load
    showDefaultUpload();
});