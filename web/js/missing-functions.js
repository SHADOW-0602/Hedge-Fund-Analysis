// Missing Functions - Placeholder implementations for functions referenced but not defined

// Settings toggle functions
function toggleRiskSettings() {
    const settings = document.getElementById('riskSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleOptionsSettings() {
    const settings = document.getElementById('optionsSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function togglePerformanceSettings() {
    const settings = document.getElementById('performanceSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleMonteCarloSettings() {
    const settings = document.getElementById('monteCarloSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleCorrelationSettings() {
    const settings = document.getElementById('correlationSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleTechnicalSettings() {
    const settings = document.getElementById('technicalSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleStatisticalSettings() {
    const settings = document.getElementById('statisticalSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleSectorSettings() {
    const settings = document.getElementById('sectorSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleOptimizationSettings() {
    const settings = document.getElementById('optimizationSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleBacktestingSettings() {
    const settings = document.getElementById('backtestingSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Transaction analysis settings toggles
function togglePnLSettings() {
    const settings = document.getElementById('pnlSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleTradeSettings() {
    const settings = document.getElementById('tradeSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleCostSettings() {
    const settings = document.getElementById('costSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleTurnoverSettings() {
    const settings = document.getElementById('turnoverSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleTaxSettings() {
    const settings = document.getElementById('taxSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleCashFlowSettings() {
    const settings = document.getElementById('cashFlowSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleFifoLifoSettings() {
    const settings = document.getElementById('fifoLifoSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleTradeTimingSettings() {
    const settings = document.getElementById('tradeTimingSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleDrawdownSettings() {
    const settings = document.getElementById('drawdownSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

function toggleReturnAttributionSettings() {
    const settings = document.getElementById('returnAttributionSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Export correlation matrix function
function exportCorrelationMatrix() {
    const matrix = document.getElementById('correlationMatrix');
    if (matrix) {
        // Simple CSV export
        const data = matrix.innerText || 'No correlation data available';
        const blob = new Blob([data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'correlation_matrix.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Sidebar section toggle functions
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const chevron = document.getElementById(sectionId.replace('Section', 'Chevron'));
    
    if (section) {
        section.classList.toggle('hidden');
        if (chevron) {
            chevron.classList.toggle('rotate-180');
        }
    }
}

// Refresh functions
function refreshPortfolioAnalysis() {
    if (window.loadAllPortfolioAnalytics && window.currentPortfolioData) {
        window.loadAllPortfolioAnalytics(window.currentPortfolioData);
    }
}

function refreshTransactionAnalysis() {
    if (window.loadAllTransactionAnalytics && window.currentTransactions) {
        window.loadAllTransactionAnalytics(window.currentTransactions);
    }
}

// Show/hide analysis sections
function showPortfolioAnalysis() {
    const portfolioAnalysis = document.getElementById('portfolioAnalysis');
    const transactionAnalysis = document.getElementById('transactionAnalysis');
    
    if (portfolioAnalysis) {
        portfolioAnalysis.classList.remove('hidden');
    }
    if (transactionAnalysis) {
        transactionAnalysis.classList.add('hidden');
    }
}

function showTransactionAnalysis() {
    const portfolioAnalysis = document.getElementById('portfolioAnalysis');
    const transactionAnalysis = document.getElementById('transactionAnalysis');
    
    if (portfolioAnalysis) {
        portfolioAnalysis.classList.add('hidden');
    }
    if (transactionAnalysis) {
        transactionAnalysis.classList.remove('hidden');
    }
}

function showDefaultUpload() {
    // Use navigation manager if available, otherwise fallback to direct implementation
    if (window.navigationManager) {
        window.navigationManager.showDefaultUpload();
        return;
    }
    
    // Fallback implementation
    const sectionsToHide = [
        'portfolioAnalysis',
        'transactionAnalysis', 
        'analysisContainer',
        'analysisContent',
        'dataPreview',
        'loadingSection'
    ];
    
    sectionsToHide.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('hidden');
            section.style.display = 'none'; // Force hide
        }
    });
    
    // Show default upload section
    const defaultSection = document.getElementById('defaultUploadSection');
    if (defaultSection) {
        defaultSection.classList.remove('hidden');
        defaultSection.style.display = 'block'; // Force show
    }
    
    // Clear any loading spinners
    clearAllLoadingSpinners();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDataActions() {
    const dataActions = document.getElementById('dataActions');
    if (dataActions) {
        dataActions.classList.remove('hidden');
    }
}

function hideDataActions() {
    const dataActions = document.getElementById('dataActions');
    if (dataActions) {
        dataActions.classList.add('hidden');
    }
}

function viewLoadedData() {
    const dataPreview = document.getElementById('dataPreview');
    const dataPreviewContent = document.getElementById('dataPreviewContent');
    
    if (!dataPreview || !dataPreviewContent) {
        console.error('Data preview elements not found');
        return;
    }
    
    // Collect all available data sources (deduplicated)
    const dataSources = [];
    const addedTypes = new Set();
    
    // Check portfolio data (prioritize memory over stored)
    if (window.portfolioData && window.portfolioData.length > 0) {
        // Detect if data comes from Plaid
        const isPlaidData = window.portfolioData.some(p => 
            p.data_source === 'Plaid' || 
            p.source === 'plaid' || 
            p.portfolio === 'RobinHood'
        );
        const dataType = isPlaidData ? 'Portfolio Data (Plaid)' : 'Portfolio Data (Memory)';
        dataSources.push({ type: dataType, data: window.portfolioData, source: isPlaidData ? 'plaid' : 'memory' });
        addedTypes.add('portfolio');
    } else {
        // Only check localStorage if no memory data
        const storedPortfolio = localStorage.getItem('currentPortfolio');
        if (storedPortfolio) {
            try {
                const data = JSON.parse(storedPortfolio);
                if (data && data.length > 0) {
                    dataSources.push({ type: 'Portfolio Data (Stored)', data: data, source: 'localStorage' });
                    addedTypes.add('portfolio');
                }
            } catch (e) {
                console.error('Error parsing stored portfolio:', e);
            }
        }
    }
    
    // Check transaction data (prioritize memory over stored)
    if (window.currentTransactions && window.currentTransactions.length > 0) {
        // Detect if data comes from Plaid
        const isPlaidData = window.currentTransactions.some(t => 
            t.data_source === 'Plaid' || 
            t.source === 'plaid' || 
            t.portfolio === 'RobinHood' ||
            (t.account_id && t.account_id.includes('Plaid'))
        );
        const dataType = isPlaidData ? 'Transaction Data (Plaid)' : 'Transaction Data (Memory)';
        dataSources.push({ type: dataType, data: window.currentTransactions, source: isPlaidData ? 'plaid' : 'memory' });
        addedTypes.add('transactions');
    } else {
        // Only check localStorage if no memory data
        const storedTransactions = localStorage.getItem('currentTransactions');
        if (storedTransactions) {
            try {
                const data = JSON.parse(storedTransactions);
                if (data && data.length > 0) {
                    dataSources.push({ type: 'Transaction Data (Stored)', data: data, source: 'localStorage' });
                    addedTypes.add('transactions');
                }
            } catch (e) {
                console.error('Error parsing stored transactions:', e);
            }
        }
    }
    

    
    // Check saved files
    const portfolioFiles = JSON.parse(localStorage.getItem('portfolioFiles') || '[]');
    portfolioFiles.forEach((file, index) => {
        if (file.data && file.data.length > 0) {
            dataSources.push({ type: `Portfolio File: ${file.filename}`, data: file.data, source: 'file', index });
        }
    });
    
    const transactionFiles = JSON.parse(localStorage.getItem('transactionFiles') || '[]');
    transactionFiles.forEach((file, index) => {
        if (file.data && file.data.length > 0) {
            dataSources.push({ type: `Transaction File: ${file.filename}`, data: file.data, source: 'file', index });
        }
    });
    
    if (dataSources.length === 0) {
        dataPreviewContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-gray-400 mb-2">
                    <svg class="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
                <p class="text-gray-600">Upload portfolio or transaction files to view data.</p>
            </div>
        `;
    } else {
        // Create data source selector and display
        let html = `
            <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">Available Data Sources (${dataSources.length})</h3>
                <div class="mb-4">
                    <select id="dataSourceSelector" class="w-full p-2 border rounded-md" onchange="switchDataView()">
        `;
        
        dataSources.forEach((source, index) => {
            html += `<option value="${index}">${source.type} (${source.data.length} records)</option>`;
        });
        
        html += `
                    </select>
                </div>
                <div id="currentDataView"></div>
            </div>
        `;
        
        dataPreviewContent.innerHTML = html;
        
        // Store data sources globally for switching
        window.availableDataSources = dataSources;
        
        // Show first data source by default
        switchDataView(0);
    }
    
    // Show the preview section
    dataPreview.classList.remove('hidden');
    dataPreview.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function switchDataView(index) {
    const selector = document.getElementById('dataSourceSelector');
    const viewContainer = document.getElementById('currentDataView');
    
    if (!selector || !viewContainer || !window.availableDataSources) return;
    
    const selectedIndex = index !== undefined ? index : parseInt(selector.value);
    const selectedSource = window.availableDataSources[selectedIndex];
    
    if (!selectedSource) return;
    
    const data = selectedSource.data;
    const headers = Object.keys(data[0]);
    const maxRows = data.length;
    
    let tableHTML = `
        <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-semibold text-gray-900">${selectedSource.type}</h4>
                <span class="text-sm text-gray-500">${selectedSource.source}</span>
            </div>
            <p class="text-sm text-gray-600">Showing all ${data.length} records</p>
        </div>
        <div class="overflow-x-auto border rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
    `;
    
    headers.forEach(header => {
        tableHTML += `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">${header}</th>`;
    });
    
    tableHTML += `
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;
    
    for (let i = 0; i < maxRows; i++) {
        const row = data[i];
        tableHTML += '<tr class="hover:bg-gray-50">';
        headers.forEach(header => {
            const value = row[header] || '';
            let displayValue = value;
            if (typeof value === 'number') {
                displayValue = value.toLocaleString();
            } else if (typeof value === 'string' && value.length > 30) {
                displayValue = value.substring(0, 30) + '...';
            }
            tableHTML += `<td class="px-4 py-3 text-sm text-gray-900" title="${value}">${displayValue}</td>`;
        });
        tableHTML += '</tr>';
    }
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    

    
    viewContainer.innerHTML = tableHTML;
}

function hideDataPreview() {
    const dataPreview = document.getElementById('dataPreview');
    if (dataPreview) {
        dataPreview.classList.add('hidden');
    }
}

// Export all functions to global scope
window.toggleRiskSettings = toggleRiskSettings;
window.toggleOptionsSettings = toggleOptionsSettings;
window.togglePerformanceSettings = togglePerformanceSettings;
window.toggleMonteCarloSettings = toggleMonteCarloSettings;
window.toggleCorrelationSettings = toggleCorrelationSettings;
window.toggleTechnicalSettings = toggleTechnicalSettings;
window.toggleStatisticalSettings = toggleStatisticalSettings;
window.toggleSectorSettings = toggleSectorSettings;
window.toggleOptimizationSettings = toggleOptimizationSettings;
window.toggleBacktestingSettings = toggleBacktestingSettings;
window.togglePnLSettings = togglePnLSettings;
window.toggleTradeSettings = toggleTradeSettings;
window.toggleCostSettings = toggleCostSettings;
window.toggleTurnoverSettings = toggleTurnoverSettings;
window.toggleTaxSettings = toggleTaxSettings;
window.toggleCashFlowSettings = toggleCashFlowSettings;
window.toggleFifoLifoSettings = toggleFifoLifoSettings;
window.toggleTradeTimingSettings = toggleTradeTimingSettings;
window.toggleDrawdownSettings = toggleDrawdownSettings;
window.toggleReturnAttributionSettings = toggleReturnAttributionSettings;
window.exportCorrelationMatrix = exportCorrelationMatrix;
window.toggleSection = toggleSection;
window.refreshPortfolioAnalysis = refreshPortfolioAnalysis;
window.refreshTransactionAnalysis = refreshTransactionAnalysis;
window.showPortfolioAnalysis = showPortfolioAnalysis;
window.showTransactionAnalysis = showTransactionAnalysis;
window.showDefaultUpload = showDefaultUpload;
window.showDataActions = showDataActions;
window.hideDataActions = hideDataActions;
window.viewLoadedData = viewLoadedData;
window.switchDataView = switchDataView;
window.hideDataPreview = hideDataPreview;

function hideAnalysisContent() {
    const analysisContent = document.getElementById('analysisContent');
    if (analysisContent) {
        analysisContent.classList.add('hidden');
    }
    // Also clear any loading spinners
    clearLoadingSpinners();
}

function clearLoadingSpinners() {
    // Loading spinners completely removed
}

function clearAllLoadingSpinners() {
    // Clear loading spinners from all analysis containers
    const loadingContainers = [
        'riskResults', 'optionsResults', 'performanceAttribution', 'monteCarloResults',
        'optimizationChart', 'correlationMatrix', 'sectorAllocation', 'statisticalAnalysis',
        'technicalAnalysis', 'strategyBacktesting', 'pnlAttribution', 'tradePerformance',
        'costAnalysis', 'turnoverAnalysis', 'taxAnalysis', 'cashFlowAnalysis',
        'fifoLifoAnalysis', 'tradeTimingAnalysis', 'drawdownAnalysis', 'returnAttribution'
    ];
    
    loadingContainers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            // Remove loading spinners but keep existing content
            const loadingElements = container.querySelectorAll('.animate-spin, .loading-spinner');
            loadingElements.forEach(el => el.remove());
        }
    });
    
    // Also clear main loading section
    const loadingSection = document.getElementById('loadingSection');
    if (loadingSection) {
        loadingSection.classList.add('hidden');
    }
}

function showLoadingSpinner(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="text-center py-12 text-blue-600">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
                ${message}
            </div>
        `;
    }
}

window.hideAnalysisContent = hideAnalysisContent;
window.clearLoadingSpinners = clearLoadingSpinners;
window.clearAllLoadingSpinners = clearAllLoadingSpinners;
window.showLoadingSpinner = showLoadingSpinner;

// Mobile sidebar functionality
function initMobileSidebar() {
    // Add mobile menu button if it doesn't exist
    if (!document.getElementById('mobileMenuBtn')) {
        const mobileBtn = document.createElement('button');
        mobileBtn.id = 'mobileMenuBtn';
        mobileBtn.className = 'mobile-menu-btn';
        mobileBtn.innerHTML = `
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
            </svg>
        `;
        mobileBtn.onclick = toggleMobileSidebar;
        document.body.appendChild(mobileBtn);
    }
    
    // Add mobile overlay if it doesn't exist
    if (!document.getElementById('mobileOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'mobileOverlay';
        overlay.className = 'mobile-overlay';
        overlay.onclick = closeMobileSidebar;
        document.body.appendChild(overlay);
    }
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
    }
}

// Initialize mobile sidebar on page load
document.addEventListener('DOMContentLoaded', initMobileSidebar);

// Close mobile sidebar when clicking analysis items
document.addEventListener('click', (event) => {
    if (event.target.closest('[data-analysis]') && window.innerWidth <= 768) {
        setTimeout(closeMobileSidebar, 100);
    }
});

window.toggleMobileSidebar = toggleMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.initMobileSidebar = initMobileSidebar;