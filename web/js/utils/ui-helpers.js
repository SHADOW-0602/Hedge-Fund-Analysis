// UI helper functions and utilities
function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    const loadingSection = document.getElementById('loadingSection');
    if (loadingSection) {
        if (show) {
            loadingSection.classList.remove('hidden');
        } else {
            loadingSection.classList.add('hidden');
        }
    }
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (container.contains(notification)) {
                container.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

function showCardLoading(cardId, loadingText = 'Loading...') {
    const container = document.getElementById(cardId);
    if (container) {
        container.innerHTML = `
            <div class="flex items-center justify-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                <div class="text-gray-600">${loadingText}</div>
            </div>
        `;
    }
}

function showAllPortfolioCardLoading() {
    // Risk metrics loading removed
    // Options loading removed
    showCardLoading('optimizationChart', 'Optimizing portfolio...');
    showCardLoading('performanceAttribution', 'Analyzing performance...');
    showCardLoading('monteCarloResults', 'Running Monte Carlo simulation...');
    showCardLoading('technicalAnalysis', 'Analyzing technical indicators...');
    showCardLoading('correlationMatrix', 'Computing correlations...');
    showCardLoading('sectorAllocation', 'Analyzing sector allocation...');
}

function showAllTransactionCardLoading() {
    showCardLoading('pnlAttribution', 'Calculating P&L attribution...');
    showCardLoading('tradePerformance', 'Analyzing trade performance...');
    showCardLoading('costAnalysis', 'Computing cost analysis...');
    showCardLoading('turnoverAnalysis', 'Calculating turnover metrics...');
    showCardLoading('taxAnalysis', 'Analyzing tax implications...');
    showCardLoading('cashFlowAnalysis', 'Processing cash flows...');
    showCardLoading('fifoLifoAnalysis', 'Computing FIFO/LIFO accounting...');
    showCardLoading('tradeTimingAnalysis', 'Analyzing trade timing...');
    showCardLoading('drawdownAnalysis', 'Calculating drawdown metrics...');
    showCardLoading('returnAttribution', 'Attributing returns...');
}

function showTab(tabName) {
    console.log('Switching to tab:', tabName);
    localStorage.setItem('activeTab', tabName);

    if (tabName === 'portfolio') {
        const portfolioAnalysis = document.getElementById('portfolioAnalysis');
        if (portfolioAnalysis && portfolioData) {
            portfolioAnalysis.classList.remove('hidden');
        }
    }
}

function showAnalysisTab(tabName) {
    document.querySelectorAll('.analysis-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.analysis-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');

    if (portfolioData) {
        switch(tabName) {
            case 'options':
                loadOptionsAnalysis();
                break;
            case 'technical':
                loadTechnicalAnalysis();
                break;
            case 'correlation':
                loadCorrelationAnalysis();
                break;
            case 'sector':
                loadSectorAnalysis();
                break;
        }
    }
}

function switchAnalysis(tabName) {
    console.log('Switching to analysis type:', tabName);

    document.querySelectorAll('#analysisSelector button').forEach(btn => {
        btn.classList.remove('tab-active');
        btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
    });

    const activeBtn = document.getElementById(tabName + 'Tab');
    if (activeBtn) {
        activeBtn.classList.add('tab-active');
        activeBtn.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
    }

    document.getElementById('portfolioAnalysis').classList.add('hidden');
    document.getElementById('transactionAnalysis').classList.add('hidden');

    if (tabName === 'portfolio') {
        document.getElementById('portfolioAnalysis').classList.remove('hidden');
        if (portfolioData) {
            showAllPortfolioCardLoading();
            loadAllRealAnalytics(portfolioData);
        }
    } else if (tabName === 'transaction') {
        document.getElementById('transactionAnalysis').classList.remove('hidden');
        showAllTransactionCardLoading();
        const savedTransactions = localStorage.getItem('currentTransactions');
        if (savedTransactions) {
            try {
                const transactionData = JSON.parse(savedTransactions);
                loadTransactionAnalytics(transactionData);
            } catch (error) {
                console.log('Error loading transaction data');
            }
        }
    }

    localStorage.setItem('activeTab', tabName);
}

function togglePortfolioDelete() {
    const select = document.getElementById('portfolioFileSelect');
    const deleteBtn = document.getElementById('deletePortfolioBtn');
    if (deleteBtn) {
        deleteBtn.style.display = select.value ? 'block' : 'none';
    }
}

function toggleTransactionDelete() {
    const select = document.getElementById('transactionFileSelect');
    const deleteBtn = document.getElementById('deleteTransactionBtn');
    if (deleteBtn) {
        deleteBtn.style.display = select.value ? 'block' : 'none';
    }
}

// Application state management
function saveApplicationState() {
    const state = {
        portfolioData: portfolioData,
        currentAnalysisType: getCurrentAnalysisType(),
        analyticsResults: getAnalyticsResults(),
        timestamp: Date.now()
    };
    localStorage.setItem('appState', JSON.stringify(state));
}

function restoreApplicationState() {
    try {
        const savedState = localStorage.getItem('appState');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
                portfolioData = state.portfolioData;
                
                if (state.analyticsResults) {
                    setTimeout(() => {
                        restoreAnalyticsResults(state.analyticsResults);
                        showAnalysisSection(state.currentAnalysisType || 'portfolio');
                    }, 1000);
                }
            }
        }
    } catch (error) {
        console.log('Error restoring application state:', error);
    }
}

function getCurrentAnalysisType() {
    const portfolioSection = document.getElementById('portfolioAnalysis');
    const transactionSection = document.getElementById('transactionAnalysis');
    
    if (portfolioSection && !portfolioSection.classList.contains('hidden')) {
        return 'portfolio';
    } else if (transactionSection && !transactionSection.classList.contains('hidden')) {
        return 'transaction';
    }
    return 'portfolio';
}

function getAnalyticsResults() {
    const results = {};
    
    const portfolioCards = document.querySelectorAll('#portfolioAnalysis .analysis-card');
    portfolioCards.forEach(card => {
        const title = card.querySelector('h3')?.textContent;
        const content = card.querySelector('div:last-child')?.innerHTML;
        if (title && content) {
            results[title] = content;
        }
    });
    
    const transactionCards = document.querySelectorAll('#transactionAnalysis .analysis-card');
    transactionCards.forEach(card => {
        const title = card.querySelector('h3')?.textContent;
        const content = card.querySelector('div:last-child')?.innerHTML;
        if (title && content) {
            results[title] = content;
        }
    });
    
    const metrics = ['totalAUM', 'sharpeRatio', 'maxDrawdown', 'beta', 'totalTrades', 'winRate', 'avgTradeSize', 'turnoverRatio'];
    metrics.forEach(metric => {
        const element = document.getElementById(metric);
        if (element && element.textContent !== '0' && element.textContent !== '0.00' && element.textContent !== '0.0%') {
            results[metric] = element.textContent;
        }
    });
    
    return results;
}

function restoreAnalyticsResults(results) {
    const metrics = ['totalAUM', 'sharpeRatio', 'maxDrawdown', 'beta', 'totalTrades', 'winRate', 'avgTradeSize', 'turnoverRatio'];
    metrics.forEach(metric => {
        if (results[metric]) {
            const element = document.getElementById(metric);
            if (element) {
                element.textContent = results[metric];
            }
        }
    });
    
    Object.keys(results).forEach(title => {
        if (!metrics.includes(title)) {
            const card = Array.from(document.querySelectorAll('.analysis-card h3')).find(h3 => h3.textContent === title);
            if (card) {
                const contentDiv = card.parentElement.querySelector('div:last-child');
                if (contentDiv) {
                    contentDiv.innerHTML = results[title];
                }
            }
        }
    });
}

function showAnalysisSection(type) {
    const portfolioSection = document.getElementById('portfolioAnalysis');
    const transactionSection = document.getElementById('transactionAnalysis');
    
    if (type === 'portfolio' && portfolioSection) {
        portfolioSection.classList.remove('hidden');
        if (transactionSection) transactionSection.classList.add('hidden');
    } else if (type === 'transaction' && transactionSection) {
        transactionSection.classList.remove('hidden');
        if (portfolioSection) portfolioSection.classList.add('hidden');
    }
}

// Export functions
window.showLoading = showLoading;
window.showSuccess = showSuccess;
window.showError = showError;
window.showCardLoading = showCardLoading;
window.showAllPortfolioCardLoading = showAllPortfolioCardLoading;
window.showAllTransactionCardLoading = showAllTransactionCardLoading;
window.showTab = showTab;
window.showAnalysisTab = showAnalysisTab;
window.switchAnalysis = switchAnalysis;
window.togglePortfolioDelete = togglePortfolioDelete;
window.toggleTransactionDelete = toggleTransactionDelete;
window.saveApplicationState = saveApplicationState;
window.restoreApplicationState = restoreApplicationState;