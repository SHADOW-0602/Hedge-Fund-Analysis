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
        const response = await fetch(`${API_BASE}/api/upload-portfolio`, {
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
            if (window.updateFileSelectors) {
                await window.updateFileSelectors();
            }

            if (window.DataMerger) {
                window.DataMerger.updateManualData('portfolio', portfolioData);
            } else {
                await displayPortfolio(portfolioData);
            }

            statusDiv.innerHTML = '<span class="text-green-600">✓ Portfolio uploaded successfully</span>';

            // Show data action buttons
            if (typeof showDataActions === 'function') {
                showDataActions();
            }

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
    if (window.showPortfolioAnalysis) {
        window.showPortfolioAnalysis();
    }

    // Update key metrics
    updatePortfolioMetrics(data);

    const hasStoredResults = await loadStoredResultsForPortfolio(data);

    // Show the data table
    if (typeof window.viewLoadedData === 'function') {
        window.viewLoadedData('portfolio');
    }
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
    window.currentPortfolioData = data;

    // Set portfolio data for enhanced analytics
    if (window.enhancedAnalytics) {
        window.enhancedAnalytics.setPortfolio(data);
    }

    // Dispatch portfolio loaded event
    document.dispatchEvent(new CustomEvent('portfolioLoaded', {
        detail: { portfolio: data }
    }));

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

    // Analytics are now loaded on-demand via sidebar clicks
}

async function loadUserPortfolios() {
    if (!currentUser || !currentUser.user_id) {
        console.log('No user logged in for portfolio loading');
        return;
    }

    try {
        console.log('Loading portfolios for user:', currentUser.user_id);
        const url = `${API_BASE}/api/load-portfolios?user_id=${currentUser.user_id}&_t=${Date.now()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Load portfolios data:', data);

        if (data.success) {
            const portfolios = Array.isArray(data.portfolios) ? data.portfolios : [];
            window.userPortfolios = portfolios;
            console.log('Loaded portfolios array:', portfolios.length);
            updatePortfolioDropdown();

            // Auto-load the most recent portfolio if no data is currently loaded
            if (portfolios.length > 0 && (!window.portfolioData || window.portfolioData.length === 0)) {
                console.log('Auto-loading most recent portfolio (Silent):', portfolios[0].portfolio_name);
                const latestPortfolio = portfolios[0];

                // Handle different data structures
                const pData = latestPortfolio.portfolio_data || latestPortfolio.data || latestPortfolio;

                // Silent Load: Set global state via merger
                if (window.DataMerger) {
                    window.DataMerger.updateManualData('portfolio', pData);
                } else {
                    window.portfolioData = pData;
                    localStorage.setItem('currentPortfolio', JSON.stringify(pData));
                    if (typeof updatePortfolioMetrics === 'function') {
                        updatePortfolioMetrics(pData);
                    }
                }

                // Just set the dropdown value, don't trigger view
                const select = document.getElementById('portfolioFileSelect');
                if (select) {
                    select.value = 0; // Select first item index
                }

                // Show notification as requested
                showSuccess(`Portfolio "${latestPortfolio.portfolio_name}" loaded successfully`);
            }
        } else {
            console.error('Load portfolios failed:', data.error);
        }
    } catch (error) {
        console.error('Portfolio loading error:', error);
    }
}

function updatePortfolioDropdown() {
    const portfolios = window.userPortfolios || [];
    console.log('Updating portfolio dropdowns with', portfolios.length, 'items');

    const select = document.getElementById('savedPortfolios');
    const fileSelect = document.getElementById('portfolioFileSelect');
    const currentValue = select ? select.value : '';

    if (select) {
        select.innerHTML = '<option value="">Select a portfolio...</option>';
        portfolios.forEach(portfolio => {
            const displayDate = portfolio.created_at ? new Date(portfolio.created_at).toLocaleDateString() : 'Unknown';
            const option = document.createElement('option');
            option.value = portfolio.id;
            option.textContent = `${portfolio.portfolio_name} (${displayDate})`;
            select.appendChild(option);
        });

        if (currentValue && !portfolios.find(p => p.id === currentValue)) {
            select.value = '';
            const deleteBtn = document.getElementById('deletePortfolioBtn');
            if (deleteBtn) deleteBtn.style.display = 'none';
        }
    }

    if (fileSelect) {
        fileSelect.innerHTML = '<option value="" selected>Select portfolio file...</option>';
        portfolios.forEach((portfolio, index) => {
            const option = document.createElement('option');
            // Use Index as value to match viewSelectedPortfolio logic
            option.value = index;
            // Display name fallback
            option.textContent = portfolio.portfolio_name || `Portfolio ${index + 1}`;
            fileSelect.appendChild(option);
        });

        if (portfolios.length === 0) {
            console.log('Portfolios list is empty');
        }
    } else {
        console.error('portfolioFileSelect element NOT found');
    }
}

async function viewSelectedPortfolio() {
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
    const portfolios = window.userPortfolios || [];
    const selectedPortfolio = portfolios[selectedIndex];

    if (!selectedPortfolio) {
        showError('No portfolio data found in selected file');
        return;
    }

    // Handle both Supabase structure (data field) and direct structure
    // Handle both Supabase structure (portfolio_data/data field) and direct structure
    portfolioData = selectedPortfolio.portfolio_data || selectedPortfolio.data || selectedPortfolio;

    // Set global data - DO NOT clear transactions to allow hybrid analysis
    if (window.DataMerger) {
        window.DataMerger.updateManualData('portfolio', portfolioData);
    } else {
        window.portfolioData = portfolioData;
        localStorage.setItem('currentPortfolio', JSON.stringify(portfolioData));
        window.displayPortfolio(portfolioData);
    }

    // Show success message
    showSuccess(`Portfolio "${filename}" loaded successfully`);

    // Show the data table ONLY (as per user request "only view the file data")
    if (typeof window.viewLoadedData === 'function') {
        window.viewLoadedData('portfolio');
    }

    // Explicitly hide analysis visualization until user asks for it (e.g. by clicking a sidebar item)
    // displayPortfolio triggers the dashboard, so we skip it here.
    // Instead we just calculate metrics silently if needed, or wait for analysis trigger.
    if (typeof updatePortfolioMetrics === 'function') {
        updatePortfolioMetrics(portfolioData);
    }

    // Show data action buttons
    if (typeof showDataActions === 'function') {
        showDataActions();
    }

    showSuccess(`Portfolio "${filename}" loaded successfully`);

    // Show data action buttons
    if (typeof showDataActions === 'function') {
        showDataActions();
    }
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
            const response = await fetch(`${API_BASE}/api/delete-portfolio`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'User-ID': currentUser.user_id
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

            localStorage.removeItem('currentPortfolio');
        }

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
window.viewSelectedPortfolio = viewSelectedPortfolio;
window.togglePortfolioDelete = togglePortfolioDelete;
window.deleteSelectedPortfolio = deleteSelectedPortfolio;
window.refreshPortfolioAnalysis = refreshPortfolioAnalysis;