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

// Alias for compatibility
function toggleBacktestSettings() {
    return toggleBacktestingSettings();
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

function togglePerformanceAttributionSettings() {
    const settings = document.getElementById('performanceAttributionSettings');
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

function viewLoadedData(preferredType = null) {
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
    if (window.portfolioData && Array.isArray(window.portfolioData) && window.portfolioData.length > 0) {
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
    if (window.currentTransactions && Array.isArray(window.currentTransactions) && window.currentTransactions.length > 0) {
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

    // Check for filter (support legacy string arg)
    const filter = (typeof preferredType === 'object') ? preferredType : { type: preferredType };

    // SPECIAL HANDLING: If looking for Plaid data, ensure we have a transaction entry even if empty
    if (filter.source === 'plaid') {
        const hasTransactions = dataSources.some(ds => ds.type.includes('Transaction') && ds.source === 'plaid');
        if (!hasTransactions) {
            dataSources.push({
                type: 'Transaction Data (Plaid)',
                data: [],
                source: 'plaid'
            });
            addedTypes.add('transactions');
        }
    }

    // Filter logic
    let filteredSources = dataSources;
    if (filter.source) {
        filteredSources = filteredSources.filter(ds => ds.source && ds.source.toLowerCase() === filter.source.toLowerCase());
    }
    if (filter.connection_id) {
        // Only filter by connection_id if the source data has it
        filteredSources = filteredSources.filter(ds => {
            // Check first item in data if available to match connection_id
            const firstItem = ds.data && ds.data.length > 0 ? ds.data[0] : null;
            // If data is empty but source matches, keep it (it's our placeholder)
            if (!firstItem && ds.source === 'plaid') return true;
            return firstItem && firstItem.connection_id === filter.connection_id;
        });
    }

    if (filteredSources.length === 0) {
        // Fallback to "No Data" view if everything is filtered out
        dataPreviewContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-gray-400 mb-2">
                    <svg class="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No Matching Data Found</h3>
                <p class="text-gray-600">The selected data is not available.</p>
            </div>
        `;
    } else {
        // Create data source selector and display
        let html = `
            <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Available Data Sources (${filteredSources.length})</h3>
                <div class="mb-4">
                    <select id="dataSourceSelector" class="w-full p-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" onchange="switchDataView()">
        `;

        filteredSources.forEach((source, index) => {
            // Since we filtered the original array, we need to map the LOCAL index 0,1,2... to the GLOBAL window.availableDataSources index
            // OR we just reset window.availableDataSources to the filtered list. Resetting is safer for consistency.
            html += `<option value="${index}">${source.type} (${source.data.length} records)</option>`;
        });

        html += `
                    </select>
                </div>
                <div id="currentDataView"></div>
            </div>
        `;

        dataPreviewContent.innerHTML = html;

        // Store filtered sources as the available ones
        window.availableDataSources = filteredSources;

        // Show first data source by default
        let initialIndex = 0;
        // Legacy preferredType (string) support
        if (filter.type && typeof filter.type === 'string') {
            if (filter.type === 'transactions') {
                const txIndex = filteredSources.findIndex(s => s.type.toLowerCase().includes('transaction'));
                if (txIndex >= 0) initialIndex = txIndex;
            } else if (filter.type === 'portfolio') {
                const pfIndex = filteredSources.findIndex(s => s.type.toLowerCase().includes('portfolio'));
                if (pfIndex >= 0) initialIndex = pfIndex;
            }
        }

        switchDataView(initialIndex);

        // Update selector value to match
        const selector = document.getElementById('dataSourceSelector');
        if (selector) selector.value = initialIndex;
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
                <h4 class="font-semibold text-gray-900 dark:text-white">${selectedSource.type}</h4>
                <span class="text-sm text-gray-500 dark:text-gray-400">${selectedSource.source}</span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">Showing all ${data.length} records</p>
        </div>
        <div class="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-800">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-indigo-50 dark:bg-gray-700">
                    <tr>
    `;

    headers.forEach(header => {
        tableHTML += `<th class="px-6 py-3 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">${header.replace(/_/g, ' ')}</th>`;
    });

    tableHTML += `
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
    `;

    for (let i = 0; i < maxRows; i++) {
        const row = data[i];
        const rowClass = i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/50'; // Zebra striping

        tableHTML += `<tr class="${rowClass} hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors duration-150">`;
        headers.forEach(header => {
            const value = row[header] || '';
            let displayValue = value;
            if (typeof value === 'number') {
                displayValue = value.toLocaleString();
            } else if (typeof value === 'string' && value.length > 30) {
                displayValue = value.substring(0, 30) + '...';
            }

            // Format specific columns if needed
            if ((header.includes('price') || header.includes('value') || header.includes('cost')) && typeof value === 'number') {
                displayValue = '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }

            tableHTML += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300" title="${value}">${displayValue}</td>`;
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
window.toggleBacktestSettings = toggleBacktestSettings;
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
window.togglePerformanceAttributionSettings = togglePerformanceAttributionSettings;
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
        sidebar.classList.toggle('hidden');
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
document.addEventListener('DOMContentLoaded', () => {
    initMobileSidebar();

    // Sync Mobile Theme Toggle
    const desktopToggle = document.getElementById('themeToggle');
    const mobileToggle = document.getElementById('mobileThemeToggle');

    if (desktopToggle && mobileToggle) {
        // Sync initial state
        mobileToggle.checked = desktopToggle.checked;

        // Mobile changes Desktop
        mobileToggle.addEventListener('change', (e) => {
            desktopToggle.checked = e.target.checked;
            // Trigger change event on desktop toggle to fire existing logic
            desktopToggle.dispatchEvent(new Event('change'));
        });

        // Desktop changes Mobile (if changed elsewhere)
        desktopToggle.addEventListener('change', (e) => {
            mobileToggle.checked = e.target.checked;
        });
    }

    // Sync Admin Button Visibility
    const desktopAdmin = document.getElementById('adminBtn');
    const mobileAdmin = document.getElementById('mobileAdminBtn');

    if (desktopAdmin && mobileAdmin) {
        // Observer config
        const config = { attributes: true, attributeFilter: ['style', 'class'] };

        // Callback function to execute when mutations are observed
        const callback = function (mutationsList, observer) {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes') {
                    // Sync display style
                    mobileAdmin.style.display = desktopAdmin.style.display;
                }
            }
        };

        // Create an observer instance linked to the callback function
        const observer = new MutationObserver(callback);

        // Start observing the target node for configured mutations
        observer.observe(desktopAdmin, config);

        // Sync initial state
        mobileAdmin.style.display = desktopAdmin.style.display;
    }
});

// Close mobile sidebar when clicking analysis items
document.addEventListener('click', (event) => {
    if (event.target.closest('[data-analysis]') && window.innerWidth <= 768) {
        setTimeout(closeMobileSidebar, 100);
    }
});

window.toggleMobileSidebar = toggleMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.initMobileSidebar = initMobileSidebar;

// Options analysis functions
async function scanOptions() {
    console.log('scanOptions called');

    // Check if we have portfolio data
    const portfolioData = window.portfolioData || window.currentPortfolioData;
    if (!portfolioData || portfolioData.length === 0) {
        if (window.showError) {
            window.showError('Please upload portfolio data first');
        } else {
            alert('Please upload portfolio data first');
        }
        return;
    }

    // Extract symbols from portfolio
    const symbols = portfolioData.map(p => p.symbol).filter(s => s && s.trim());
    console.log('Scanning options for symbols:', symbols);

    if (symbols.length === 0) {
        if (window.showError) {
            window.showError('No valid symbols found in portfolio');
        } else {
            alert('No valid symbols found in portfolio');
        }
        return;
    }

    // Show loading
    const resultsContainer = document.getElementById('optionsResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p class="text-gray-600">Scanning options for ${symbols.length} symbols...</p>
                <p class="text-sm text-gray-500 mt-2">Symbols: ${symbols.join(', ')}</p>
            </div>
        `;
    }

    try {
        const API_BASE = window.API_BASE || 'http://127.0.0.1:8080';
        const response = await fetch(`${API_BASE}/api/scan-options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbols: symbols,
                options: {
                    expiration: '3M',
                    moneyness: 'All',
                    strategy: 'All',
                    min_premium: 0.50,
                    delta_range: 'All'
                }
            })
        });

        const data = await response.json();
        console.log('Options scan response:', data);

        if (data.success) {
            displayOptionsResults(data.opportunities || [], data.summary || {});
            if (window.showSuccess) {
                window.showSuccess(`Found ${data.opportunities?.length || 0} options opportunities`);
            }
        } else {
            throw new Error(data.error || 'Options scan failed');
        }
    } catch (error) {
        console.error('Options scan error:', error);
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="text-center py-8 text-red-600">
                    <p class="font-semibold">Options scan failed</p>
                    <p class="text-sm mt-2">${error.message}</p>
                </div>
            `;
        }
        if (window.showError) {
            window.showError('Options scan failed: ' + error.message);
        }
    }
}

function displayOptionsResults(opportunities, summary) {
    const resultsContainer = document.getElementById('optionsResults');
    if (!resultsContainer) return;

    console.log('Displaying options results:', { opportunities: opportunities.length, summary });

    if (opportunities.length === 0) {
        resultsContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="text-gray-400 mb-4">
                    <svg class="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No Options Opportunities Found</h3>
                <p class="text-gray-600">No viable options strategies were found for the current portfolio.</p>
            </div>
        `;
        return;
    }

    // Group opportunities by symbol
    const bySymbol = {};
    opportunities.forEach(opp => {
        const symbol = opp.symbol;
        if (!bySymbol[symbol]) bySymbol[symbol] = [];
        bySymbol[symbol].push(opp);
    });

    // Group by strategy
    const byStrategy = {};
    opportunities.forEach(opp => {
        const strategy = opp.strategy || 'unknown';
        if (!byStrategy[strategy]) byStrategy[strategy] = [];
        byStrategy[strategy].push(opp);
    });

    let html = `
        <div class="space-y-6">
            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-blue-800">Total Opportunities</h4>
                    <p class="text-2xl font-bold text-blue-600">${opportunities.length}</p>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-green-800">Symbols Analyzed</h4>
                    <p class="text-2xl font-bold text-green-600">${Object.keys(bySymbol).length}</p>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-purple-800">Strategies Found</h4>
                    <p class="text-2xl font-bold text-purple-600">${Object.keys(byStrategy).length}</p>
                </div>
            </div>
            
            <!-- Opportunities by Symbol -->
            <div class="bg-white border rounded-lg p-6">
                <h3 class="text-lg font-semibold mb-4">Opportunities by Symbol</h3>
                <div class="space-y-4">
    `;

    Object.entries(bySymbol).forEach(([symbol, opps]) => {
        const strategies = [...new Set(opps.map(o => o.strategy))];
        html += `
            <div class="border-l-4 border-indigo-500 pl-4">
                <div class="flex justify-between items-center">
                    <h4 class="font-semibold text-gray-900">${symbol}</h4>
                    <span class="text-sm text-gray-500">${opps.length} opportunities</span>
                </div>
                <p class="text-sm text-gray-600">Strategies: ${strategies.join(', ')}</p>
            </div>
        `;
    });

    html += `
                </div>
            </div>
            
            <!-- Detailed Opportunities Table -->
            <div class="bg-white border rounded-lg p-6">
                <h3 class="text-lg font-semibold mb-4">All Opportunities</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strategy</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strike</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Premium</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delta</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
    `;

    opportunities.forEach(opp => {
        html += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${opp.symbol}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${opp.strategy}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$${(opp.strike || 0).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">$${(opp.premium || 0).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${opp.delta ? opp.delta.toFixed(3) : 'N/A'}</td>
            </tr>
        `;
    });

    html += `
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    resultsContainer.innerHTML = html;
}

// Protective puts and collar strategies functions
async function scanProtectivePuts() {
    console.log('scanProtectivePuts called - using main scanOptions function');
    await scanOptions();
}

async function scanCollarStrategies() {
    console.log('scanCollarStrategies called - using main scanOptions function');
    await scanOptions();
}

// Update analysis functions for transaction analysis
function updatePnLAttribution() {
    if (window.currentTransactions && window.loadPnlAttribution) {
        window.loadPnlAttribution(window.currentTransactions);
    }
}

function updateTradePerformance() {
    if (window.currentTransactions && window.loadTradePerformance) {
        window.loadTradePerformance(window.currentTransactions);
    }
}

function updateCostAnalysis() {
    if (window.currentTransactions && window.loadCostAnalysis) {
        window.loadCostAnalysis(window.currentTransactions);
    }
}

function updateTurnoverAnalysis() {
    if (window.currentTransactions && window.loadTurnoverAnalysis) {
        window.loadTurnoverAnalysis(window.currentTransactions);
    }
}

function updateTaxAnalysis() {
    if (window.currentTransactions && window.loadTaxAnalysis) {
        window.loadTaxAnalysis(window.currentTransactions);
    }
}

function updateCashFlowAnalysis() {
    if (window.currentTransactions && window.loadCashFlowAnalysis) {
        window.loadCashFlowAnalysis(window.currentTransactions);
    }
}

function updateFifoLifoAnalysis() {
    if (window.currentTransactions && window.loadFifoLifoAnalysis) {
        window.loadFifoLifoAnalysis(window.currentTransactions);
    }
}

function updateTradeTimingAnalysis() {
    if (window.currentTransactions && window.loadTradeTimingAnalysis) {
        window.loadTradeTimingAnalysis(window.currentTransactions);
    }
}

function updateDrawdownAnalysis() {
    if (window.currentTransactions && window.loadDrawdownAnalysis) {
        window.loadDrawdownAnalysis(window.currentTransactions);
    }
}

function updateReturnAttribution() {
    const period = document.getElementById('returnPeriod')?.value;
    const model = document.getElementById('returnModel')?.value;
    const benchmark = document.getElementById('returnBenchmark')?.value;
    const currency = document.getElementById('returnCurrency')?.value;
    const frequency = document.getElementById('returnFrequency')?.value;

    if (!period || !model || !benchmark || !currency || !frequency) {
        console.error('Missing required return attribution settings');
        return;
    }

    // Store settings globally for persistence
    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.returnAttributionSettings = {
        period,
        attribution_model: model,
        benchmark,
        currency,
        frequency
    };

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('return-attribution');
    }
}

function updatePerformanceAttribution() {
    const period = document.getElementById('performancePeriod')?.value;
    const model = document.getElementById('performanceModel')?.value;
    const benchmark = document.getElementById('performanceBenchmark')?.value;
    const currency = document.getElementById('performanceCurrency')?.value;
    const frequency = document.getElementById('performanceFrequency')?.value;

    if (!period || !model || !benchmark || !currency || !frequency) {
        console.error('Missing required performance attribution settings');
        return;
    }

    // Store settings globally for persistence
    if (!window.analyticsCore) window.analyticsCore = {};
    window.analyticsCore.performanceAttributionSettings = {
        period,
        attribution_model: model,
        benchmark,
        currency,
        frequency
    };

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('performance-attribution');
    }
}

// Export update functions
window.updatePnLAttribution = updatePnLAttribution;
window.updateTradePerformance = updateTradePerformance;
window.updateCostAnalysis = updateCostAnalysis;
window.updateTurnoverAnalysis = updateTurnoverAnalysis;
window.updateTaxAnalysis = updateTaxAnalysis;
window.updateCashFlowAnalysis = updateCashFlowAnalysis;
window.updateFifoLifoAnalysis = updateFifoLifoAnalysis;
window.updateTradeTimingAnalysis = updateTradeTimingAnalysis;
window.updateDrawdownAnalysis = updateDrawdownAnalysis;
window.updateReturnAttribution = updateReturnAttribution;
window.updatePerformanceAttribution = updatePerformanceAttribution;

// Cash Flow Analysis - will be overridden by cash-flow-analysis.js
// Placeholder removed to allow proper loading

// FIFO/LIFO Analysis placeholder
async function loadFifoLifoAnalysis(transactions) {
    const container = document.getElementById('fifoLifoAnalysis');
    if (!container) return;
    container.innerHTML = `<div class="text-center py-8 text-green-600">FIFO/LIFO Analysis - Coming Soon</div>`;
}

// Drawdown Analysis - using comprehensive version from drawdown-analysis.js

// Update analysis functions
function updateTaxAnalysis() {
    if (window.currentTransactions && window.loadTaxAnalysis) {
        window.loadTaxAnalysis(window.currentTransactions);
    }
}

function updateCashFlowAnalysis() {
    if (window.currentTransactions && window.loadCashFlowAnalysis) {
        window.loadCashFlowAnalysis(window.currentTransactions);
    }
}

function updateFifoLifoAnalysis() {
    if (window.currentTransactions && window.loadFifoLifoAnalysis) {
        window.loadFifoLifoAnalysis(window.currentTransactions);
    }
}

function updateDrawdownAnalysis() {
    if (window.currentTransactions && window.loadDrawdownAnalysis) {
        window.loadDrawdownAnalysis(window.currentTransactions);
    }
}

// Cash flow analysis will be loaded by dedicated script
window.loadFifoLifoAnalysis = loadFifoLifoAnalysis;
// window.loadDrawdownAnalysis removed - using comprehensive version
window.updateTaxAnalysis = updateTaxAnalysis;
window.updateCashFlowAnalysis = updateCashFlowAnalysis;
window.updateFifoLifoAnalysis = updateFifoLifoAnalysis;
window.updateDrawdownAnalysis = updateDrawdownAnalysis;

// Export options functions
window.scanOptions = scanOptions;
window.displayOptionsResults = displayOptionsResults;
window.scanProtectivePuts = scanProtectivePuts;
window.scanCollarStrategies = scanCollarStrategies;