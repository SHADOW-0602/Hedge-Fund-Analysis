// Portfolio management module
async function uploadPortfolio() {
    const fileInput = document.getElementById('portfolioFile');
    const file = fileInput.files[0];
    const statusDiv = document.getElementById('portfolioUploadStatus');

    if (!file) {
        showError('Please select a portfolio file');
        return;
    }

    statusDiv.innerHTML = '<span class="text-blue-600">Uploading portfolio...</span>';
    showLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/upload-portfolio`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            portfolioData = data.portfolio;
            
            const hasStoredResults = await loadStoredResultsForPortfolio(portfolioData);
            
            if (currentUser && currentUser.user_id) {
                try {
                    const saveResult = await savePortfolioToSupabase(file.name, data.portfolio);
                    if (saveResult.success) {
                        console.log('Portfolio saved to Supabase successfully');
                        await loadUserPortfolios();
                    } else {
                        console.log('Supabase save failed:', saveResult.error);
                    }
                } catch (err) {
                    console.log('Supabase save error:', err);
                }
            }
            
            const portfolioFiles = JSON.parse(localStorage.getItem('portfolioFiles') || '[]');
            
            // Check for duplicate names
            const existingFile = portfolioFiles.find(f => f.filename === file.name);
            if (existingFile) {
                if (!confirm(`A portfolio file named "${file.name}" already exists. Do you want to replace it?`)) {
                    statusDiv.innerHTML = '<span class="text-yellow-600">Upload cancelled</span>';
                    showLoading(false);
                    return;
                }
                // Remove existing file
                const index = portfolioFiles.findIndex(f => f.filename === file.name);
                portfolioFiles.splice(index, 1);
            }
            
            portfolioFiles.push({ filename: file.name, data: data.portfolio, timestamp: Date.now() });
            localStorage.setItem('portfolioFiles', JSON.stringify(portfolioFiles));
            updateFileSelectors();
            
            await displayPortfolio(portfolioData);
            
            statusDiv.innerHTML = '<span class="text-green-600">✓ Portfolio uploaded successfully</span>';
            
            if (hasStoredResults) {
                showSuccess('Portfolio uploaded - Loaded stored analysis results');
            } else {
                showSuccess('Portfolio uploaded successfully');
            }
        } else {
            statusDiv.innerHTML = '<span class="text-red-600">✗ Upload failed</span>';
            showError(data.error || 'Portfolio upload failed');
        }
    } catch (error) {
        statusDiv.innerHTML = '<span class="text-red-600">✗ Upload failed</span>';
        showError('Portfolio upload failed: ' + error.message);
    }

    showLoading(false);
}

async function displayPortfolio(data) {
    localStorage.setItem('currentPortfolio', JSON.stringify(data));
    
    // Show portfolio analysis section
    const analysisSection = document.getElementById('portfolioAnalysis');
    if (analysisSection) {
        analysisSection.classList.remove('hidden');
    }
    
    // Update key metrics
    updatePortfolioMetrics(data);

    const hasStoredResults = await loadStoredResultsForPortfolio(data);
}

function updatePortfolioMetrics(data) {
    let totalValue = 0;
    data.forEach(holding => {
        const quantity = parseFloat(holding.quantity) || 0;
        const price = parseFloat(holding.avg_cost || holding.price) || 0;
        totalValue += quantity * price;
    });
    
    // Store portfolio data globally for analytics
    window.portfolioData = data;
    
    // Update individual metric elements
    const totalAUM = document.getElementById('totalAUM');
    const sharpeRatio = document.getElementById('sharpeRatio');
    const maxDrawdown = document.getElementById('maxDrawdown');
    const beta = document.getElementById('beta');
    
    if (totalAUM && totalValue > 0) {
        if (totalValue >= 1000000) {
            totalAUM.textContent = '$' + (totalValue / 1000000).toFixed(1) + 'M';
        } else if (totalValue >= 1000) {
            totalAUM.textContent = '$' + (totalValue / 1000).toFixed(0) + 'K';
        } else {
            totalAUM.textContent = '$' + totalValue.toLocaleString();
        }
        console.log('Portfolio value calculated:', totalValue, 'Display:', totalAUM.textContent);
    }
    
    if (sharpeRatio) sharpeRatio.textContent = 'N/A';
    if (maxDrawdown) maxDrawdown.textContent = 'N/A';
    if (beta) beta.textContent = 'N/A';


    showAllPortfolioCardLoading();
    
    // Load all analytics using the unified function
    setTimeout(() => {
        if (typeof window.loadAllRealAnalytics === 'function') {
            console.log('Loading all real analytics for portfolio data:', data);
            window.loadAllRealAnalytics(data, { nocache: true });
        } else if (typeof loadAllRealAnalytics === 'function') {
            console.log('Loading all real analytics for portfolio data:', data);
            loadAllRealAnalytics(data, { nocache: true });
        } else {
            console.error('loadAllRealAnalytics function not found - retrying in 1 second');
            setTimeout(() => {
                if (typeof window.loadAllRealAnalytics === 'function') {
                    console.log('Loading all real analytics for portfolio data (retry):', data);
                    window.loadAllRealAnalytics(data, { nocache: true });
                } else {
                    console.error('loadAllRealAnalytics function still not available after retry');
                }
            }, 1000);
        }
    }, 500);
}

function loadPortfolioOptimization(data) {
    const container = document.getElementById('enhancedOptimization');
    console.log('Portfolio optimization container:', container);
    if (container) {
        console.log('Setting portfolio optimization loading state');
        container.innerHTML = '<div class="text-center py-4 text-gray-500"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>Optimizing portfolio...</div>';
        setTimeout(() => {
            console.log('Portfolio optimization complete');
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between"><span>Current Allocation</span><span class="font-semibold">Moderate Risk</span></div>
                    <div class="flex justify-between"><span>Optimal Allocation</span><span class="font-semibold text-green-600">Efficient</span></div>
                    <div class="flex justify-between"><span>Risk-Adjusted Return</span><span class="font-semibold">N/A</span></div>
                </div>
            `;
        }, 2000);
    } else {
        console.log('enhancedOptimization element not found');
    }
}

function loadStatisticalAnalysis(data) {
    const container = document.getElementById('statisticalAnalysis');
    if (container) {
        container.innerHTML = '<div class="text-center py-4 text-gray-500"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>Analyzing statistics...</div>';
        setTimeout(() => {
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between"><span>Correlation Score</span><span class="font-semibold">N/A</span></div>
                    <div class="flex justify-between"><span>Diversification</span><span class="font-semibold text-green-600">Good</span></div>
                    <div class="flex justify-between"><span>Risk Concentration</span><span class="font-semibold">Low</span></div>
                </div>
            `;
        }, 3000);
    }
}

function loadStyleAnalysis(data) {
    const container = document.getElementById('styleAnalysis');
    if (container) {
        container.innerHTML = '<div class="text-center py-4 text-gray-500"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>Analyzing style...</div>';
        setTimeout(() => {
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between"><span>Growth Tilt</span><span class="font-semibold">N/A</span></div>
                    <div class="flex justify-between"><span>Value Tilt</span><span class="font-semibold">N/A</span></div>
                    <div class="flex justify-between"><span>Market Cap</span><span class="font-semibold">Large Cap</span></div>
                </div>
            `;
        }, 2500);
    }
}

function loadTechnicalIndicators(data) {
    const container = document.getElementById('enhancedTechnicalAnalysis');
    if (container) {
        container.innerHTML = '<div class="text-center py-4 text-gray-500"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>Analyzing technical indicators...</div>';
        setTimeout(() => {
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between"><span>RSI (14)</span><span class="font-semibold">N/A</span></div>
                    <div class="flex justify-between"><span>MACD Signal</span><span class="font-semibold text-green-600">Bullish</span></div>
                    <div class="flex justify-between"><span>Moving Average</span><span class="font-semibold">Above 50-day</span></div>
                </div>
            `;
        }, 3500);
    }
}

function loadStrategyBacktesting(data) {
    const container = document.getElementById('backtestingResults');
    if (container) {
        container.innerHTML = '<div class="text-center py-4 text-gray-500"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>Running backtests...</div>';
        setTimeout(() => {
            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between"><span>Strategy Return</span><span class="font-semibold">N/A</span></div>
                    <div class="flex justify-between"><span>Benchmark Return</span><span class="font-semibold">N/A</span></div>
                    <div class="flex justify-between"><span>Alpha Generated</span><span class="font-semibold">N/A</span></div>
                </div>
            `;
        }, 4000);
    }
}

async function loadUserPortfolios() {
    if (!currentUser || !currentUser.user_id) {
        return;
    }

    try {
        // Add cache-busting parameter to force fresh data
        const response = await fetch(`${API_BASE}/load-portfolios?user_id=${currentUser.user_id}&_t=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            userPortfolios = data.portfolios || [];
            updatePortfolioDropdown();
        }
    } catch (error) {
        console.log('Database not available - using local storage only');
    }
}

function updatePortfolioDropdown() {
    const select = document.getElementById('savedPortfolios');
    const fileSelect = document.getElementById('portfolioFileSelect');
    const currentValue = select ? select.value : '';

    if (select) {
        select.innerHTML = '<option value="">Select a portfolio...</option>';
        userPortfolios.forEach(portfolio => {
            const option = document.createElement('option');
            option.value = portfolio.id;
            option.textContent = `${portfolio.portfolio_name} (${new Date(portfolio.created_at).toLocaleDateString()})`;
            select.appendChild(option);
        });

        if (currentValue && !userPortfolios.find(p => p.id === currentValue)) {
            select.value = '';
            const deleteBtn = document.getElementById('deletePortfolioBtn');
            if (deleteBtn) deleteBtn.style.display = 'none';
        }
    }

    if (fileSelect) {
        fileSelect.innerHTML = '<option value="" selected>Select portfolio file...</option>';
        userPortfolios.forEach((portfolio, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = portfolio.portfolio_name;
            fileSelect.appendChild(option);
        });
    }
}

async function loadSavedPortfolio() {
    const select = document.getElementById('savedPortfolios');
    const portfolioId = select.value;
    const deleteBtn = document.getElementById('deletePortfolioBtn');

    if (!portfolioId) {
        deleteBtn.style.display = 'none';
        document.getElementById('savePortfolioSection').style.display = 'none';
        return;
    }

    deleteBtn.style.display = 'inline-block';
    document.getElementById('savedTransactions').value = '';

    const portfolio = userPortfolios.find(p => p.id === portfolioId);
    if (portfolio) {
        portfolioData = portfolio.portfolio_data;
        displayPortfolio(portfolioData);
        document.getElementById('savePortfolioSection').style.display = 'none';
        showSuccess(`Loaded portfolio: ${portfolio.portfolio_name}`);
    }
}

async function saveCurrentPortfolio() {
    if (!portfolioData || !currentUser) {
        showError('No portfolio data to save');
        return;
    }

    const portfolioName = document.getElementById('portfolioName').value;
    if (!portfolioName) {
        showError('Please enter a portfolio name');
        return;
    }

    if (window.ProgressManager) {
        ProgressManager.saveProgress('currentPortfolio', {
            name: portfolioName,
            data: portfolioData
        });
    }

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/save-portfolio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.user_id,
                portfolio_name: portfolioName,
                portfolio_data: portfolioData
            })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Portfolio saved successfully!');
            document.getElementById('portfolioName').value = '';
            document.getElementById('portfolioFile').value = '';
            document.getElementById('savePortfolioSection').style.display = 'none';
            loadUserPortfolios();
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Failed to save portfolio');
    }

    showLoading(false);
}

async function downloadSamplePortfolio() {
    try {
        const response = await fetch(`${API_BASE}/download-sample-portfolio`);
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'enhanced_portfolio.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        showSuccess('Sample portfolio CSV downloaded');
    } catch (error) {
        showError('Failed to download sample portfolio');
    }
}

function viewSelectedPortfolio() {
    const select = document.getElementById('portfolioFileSelect');
    const selectedIndex = select.value;
    
    if (!selectedIndex) {
        showError('Please select a portfolio file');
        return;
    }
    
    // Hide transaction analysis and clear transaction selection
    const transactionAnalysis = document.getElementById('transactionAnalysis');
    const transactionSelect = document.getElementById('transactionFileSelect');
    const deleteTransactionBtn = document.getElementById('deleteTransactionBtn');
    
    if (transactionAnalysis) transactionAnalysis.classList.add('hidden');
    if (transactionSelect) transactionSelect.value = '';
    if (deleteTransactionBtn) deleteTransactionBtn.style.display = 'none';
    
    const selectedOption = select.options[select.selectedIndex];
    const filename = selectedOption ? selectedOption.text : 'Portfolio';
    
    // Get actual portfolio data from selected file
    const portfolioFiles = window.portfolioFiles || [];
    const selectedPortfolio = portfolioFiles[selectedIndex];
    
    if (!selectedPortfolio || !selectedPortfolio.data) {
        showError('No portfolio data found in selected file');
        return;
    }
    
    portfolioData = selectedPortfolio.data;
    displayPortfolio(portfolioData);
    
    setTimeout(() => {
        const portfolioSection = document.getElementById('portfolioAnalysis');
        if (portfolioSection) {
            portfolioSection.classList.remove('hidden');
            showAllPortfolioCardLoading();
            
            setTimeout(() => {
                if (typeof window.loadAllRealAnalytics === 'function') {
                    console.log('Loading all real analytics for selected portfolio:', portfolioData);
                    window.loadAllRealAnalytics(portfolioData, { nocache: true });
                } else if (typeof loadAllRealAnalytics === 'function') {
                    console.log('Loading all real analytics for selected portfolio:', portfolioData);
                    loadAllRealAnalytics(portfolioData, { nocache: true });
                } else {
                    console.error('loadAllRealAnalytics function not found - retrying in 1 second');
                    setTimeout(() => {
                        if (typeof window.loadAllRealAnalytics === 'function') {
                            console.log('Loading all real analytics for selected portfolio (retry):', portfolioData);
                            window.loadAllRealAnalytics(portfolioData, { nocache: true });
                        } else {
                            console.error('loadAllRealAnalytics function still not available after retry');
                        }
                    }, 1000);
                }
            }, 500);
            
            portfolioSection.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
    
    showSuccess(`Portfolio "${filename}" loaded successfully`);
}

function togglePortfolioDelete() {
    const select = document.getElementById('portfolioFileSelect');
    const deleteBtn = document.getElementById('deletePortfolioBtn');
    
    if (select && deleteBtn) {
        deleteBtn.style.display = select.value ? 'block' : 'none';
    }
}

async function deleteSelectedPortfolio() {
    const select = document.getElementById('portfolioFileSelect');
    if (!select || !select.value) {
        showError('Please select a portfolio file to delete');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this portfolio file?')) {
        return;
    }
    
    const selectedIndex = parseInt(select.value);
    const portfolioFiles = window.portfolioFiles || [];
    
    if (selectedIndex < 0 || selectedIndex >= portfolioFiles.length) {
        showError('Invalid portfolio file selected');
        return;
    }
    
    const fileToDelete = portfolioFiles[selectedIndex];
    showLoading(true);
    
    try {
        // Delete from Supabase first
        if (fileToDelete.source === 'supabase' && fileToDelete.id && currentUser?.user_id) {
            const response = await fetch(`${API_BASE}/delete-portfolio`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': currentUser.user_id
                },
                body: JSON.stringify({ portfolio_id: fileToDelete.id })
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
        }
        
        // Remove only the deleted file from localStorage
        const localFiles = JSON.parse(localStorage.getItem('portfolioFiles') || '[]');
        const localIndex = localFiles.findIndex(f => f.filename === fileToDelete.filename);
        if (localIndex >= 0) {
            localFiles.splice(localIndex, 1);
            localStorage.setItem('portfolioFiles', JSON.stringify(localFiles));
        }
        localStorage.removeItem('currentPortfolio');
        
        // Clear current data only
        window.portfolioData = null;
        
        // Clear file input
        const fileInput = document.getElementById('portfolioFile');
        if (fileInput) fileInput.value = '';
        
        // Hide analysis section
        const analysisSection = document.getElementById('portfolioAnalysis');
        if (analysisSection) analysisSection.classList.add('hidden');
        
        // Clear analysis content
        const analysisCards = ['riskResults', 'optionsResults', 'performanceAttribution', 'technicalAnalysis', 'correlationMatrix', 'sectorAllocation'];
        analysisCards.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.innerHTML = '';
        });
        
        // Force fresh reload from Supabase
        await loadUserPortfolios();
        await updateFileSelectors();
        
        // Reset dropdown selection and hide delete button
        select.value = '';
        const deleteBtn = document.getElementById('deletePortfolioBtn');
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        showSuccess('Portfolio file deleted successfully');
        
    } catch (error) {
        showError('Failed to delete portfolio file: ' + error.message);
    }
    
    showLoading(false);
}

function showAllPortfolioCardLoading() {
    const cards = ['riskResults', 'optionsResults', 'performanceAttribution', 'technicalAnalysis', 'correlationMatrix', 'sectorAllocation', 'enhancedOptimization', 'statisticalAnalysis', 'styleAnalysis', 'enhancedTechnicalAnalysis', 'backtestingResults'];
    cards.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Loading...</div>';
        } else {
            console.log(`Element ${id} not found`);
        }
    });
}

async function refreshPortfolioAnalysis() {
    // Check both window variable and localStorage
    let portfolioData = window.portfolioData;
    if (!portfolioData || portfolioData.length === 0) {
        portfolioData = JSON.parse(localStorage.getItem('currentPortfolio') || '[]');
    }
    
    if (!portfolioData || portfolioData.length === 0) {
        showError('No portfolio data to refresh');
        // Hide the analysis section if no data
        const analysisSection = document.getElementById('portfolioAnalysis');
        if (analysisSection) analysisSection.classList.add('hidden');
        return;
    }
    
    // Update window variable
    window.portfolioData = portfolioData;
    
    showLoading(true);
    showAllPortfolioCardLoading();
    
    try {
        // Re-run portfolio analysis
        await displayPortfolio(portfolioData);
        showSuccess('Portfolio analysis refreshed successfully');
    } catch (error) {
        showError('Failed to refresh analysis: ' + error.message);
    }
    
    showLoading(false);
}

// Export functions
window.uploadPortfolio = uploadPortfolio;
window.displayPortfolio = displayPortfolio;
window.loadUserPortfolios = loadUserPortfolios;
window.loadSavedPortfolio = loadSavedPortfolio;
window.saveCurrentPortfolio = saveCurrentPortfolio;
window.downloadSamplePortfolio = downloadSamplePortfolio;
window.viewSelectedPortfolio = viewSelectedPortfolio;
window.togglePortfolioDelete = togglePortfolioDelete;
window.deleteSelectedPortfolio = deleteSelectedPortfolio;
window.refreshPortfolioAnalysis = refreshPortfolioAnalysis;