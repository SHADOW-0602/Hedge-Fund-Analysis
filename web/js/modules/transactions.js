// Transaction management module
async function uploadTransactions() {
    console.log('uploadTransactions called');
    const fileInput = document.getElementById('transactionFile');
    const file = fileInput.files[0];
    const statusDiv = document.getElementById('transactionUploadStatus');

    console.log('File input:', fileInput);
    console.log('Selected file:', file);
    console.log('Status div:', statusDiv);

    if (!file) {
        console.log('No file selected');
        showError('Please select a transaction file');
        return;
    }

    console.log('Starting upload for file:', file.name);
    statusDiv.innerHTML = '<span class="text-purple-600">Uploading transactions...</span>';
    showLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
        console.log('API_BASE:', API_BASE);
        console.log('Uploading to:', `${API_BASE}/upload-portfolio`);
        console.log('FormData:', formData);

        const response = await fetch(`${API_BASE}/api/upload-transactions`, {
            method: 'POST',
            body: formData
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            let saveSuccess = false;

            if (currentUser && currentUser.user_id) {
                try {
                    const saveResult = await saveTransactionsToSupabase(file.name, data.transactions);
                    if (saveResult && saveResult.success) {
                        console.log('Transactions saved to Supabase successfully:', saveResult.transaction_id);
                        await loadUserTransactions();
                        saveSuccess = true;
                    } else {
                        console.log('Supabase save failed:', saveResult?.error || 'Unknown error');
                    }
                } catch (err) {
                    console.log('Supabase save error:', err);
                }
            }

            // Set global transaction data
            window.currentTransactions = data.transactions;

            // Clear any existing data first
            localStorage.removeItem('currentTransactions');

            const transactionFiles = JSON.parse(localStorage.getItem('transactionFiles') || '[]');

            // Check for duplicate names in localStorage only
            const existingLocalFile = transactionFiles.find(f => f.filename === file.name);
            if (existingLocalFile) {
                if (!confirm(`A transaction file named "${file.name}" already exists. Do you want to replace it?`)) {
                    statusDiv.innerHTML = '<span class="text-yellow-600">Upload cancelled</span>';
                    showLoading(false);
                    return;
                }
                // Remove existing file from localStorage
                const index = transactionFiles.findIndex(f => f.filename === file.name);
                transactionFiles.splice(index, 1);
            }

            // Add new file data
            transactionFiles.push({ filename: file.name, data: data.transactions, timestamp: Date.now() });
            localStorage.setItem('transactionFiles', JSON.stringify(transactionFiles));
            localStorage.setItem('currentTransactions', JSON.stringify(data.transactions));

            // Force refresh file selectors to get fresh Supabase data
            await updateFileSelectors();

            try {
                await analyzeTransactionData(data.transactions);
                const message = saveSuccess ?
                    '✓ Transactions uploaded and saved successfully' :
                    '✓ Transactions uploaded (local only - server unavailable)';
                statusDiv.innerHTML = `<span class="text-green-600">${message}</span>`;

                // Show data action buttons
                if (typeof showDataActions === 'function') {
                    showDataActions();
                }
            } catch (error) {
                statusDiv.innerHTML = '<span class="text-red-600">✗ Analysis failed</span>';
                showError('Transaction analysis failed: ' + error.message);
            }
        } else {
            statusDiv.innerHTML = '<span class="text-red-600">✗ Upload failed</span>';
            showError(data.error || 'Transaction upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        statusDiv.innerHTML = '<span class="text-red-600">✗ Upload failed</span>';
        showError('Transaction upload failed: ' + error.message);
    }

    showLoading(false);
}

async function analyzeTransactionData(transactions) {
    showLoading(true);

    const transactionSection = document.getElementById('transactionAnalysis');
    if (transactionSection && !transactionSection.classList.contains('hidden')) {
        showAllTransactionCardLoading();
    }

    try {
        const response = await fetch(`${API_BASE}/api/analyze-transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions })
        });

        const data = await response.json();

        if (data.success) {
            displayTransactionResults(data);
            calculateAdvancedTransactionMetrics(transactions);
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Transaction analysis failed');
    }

    showLoading(false);
}

function displayTransactionResults(data) {
    const container = document.getElementById('transactionData');

    if (!container) {
        console.error('transactionData container not found');
        return;
    }

    const totalTrades = data.transactions ? data.transactions.length : 0;
    const totalVolume = data.summary ? (data.summary.total_volume || 0) : 0;
    const totalRealizedPnl = data.summary ? (data.summary.total_realized_pnl || 0) : 0;
    const totalUnrealizedPnl = data.summary ? (data.summary.total_unrealized_pnl || 0) : 0;
    const xirr = data.summary ? (data.summary.xirr || 0) : 0;
    const totalFees = data.summary ? (data.summary.total_fees || 0) : 0;

    const winRate = totalTrades > 0 ? ((data.transactions.filter(t => (t.quantity * t.price) > 0).length / totalTrades) * 100) : 0;
    const avgTradeSize = totalTrades > 0 ? (totalVolume / totalTrades) : 0;
    const turnoverRatio = totalVolume > 0 ? (totalVolume / 1000000) : 0;
    const totalPnl = totalRealizedPnl + totalUnrealizedPnl;

    container.innerHTML = `
        <div class="analysis-tabs">
            <button class="tab-btn" onclick="showPortfolioAnalysis()">Portfolio Analysis</button>
            <button class="tab-btn active">Transaction Analysis</button>
        </div>
        
        <div class="metrics-grid-4">
            <div class="metric-card">
                <div class="metric-value">${totalTrades.toLocaleString()}</div>
                <div class="metric-label">TOTAL TRADES</div>
                <div class="metric-sublabel">This quarter</div>
            </div>
            <div class="metric-card">
                <div class="metric-value positive">${winRate}%</div>
                <div class="metric-label">WIN RATE</div>
                <div class="metric-sublabel">Profitable trades</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">$${(avgTradeSize / 1000).toFixed(0)}K</div>
                <div class="metric-label">AVG TRADE SIZE</div>
                <div class="metric-sublabel">Per transaction</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${turnoverRatio}x</div>
                <div class="metric-label">TURNOVER RATIO</div>
                <div class="metric-sublabel">Annual</div>
            </div>
        </div>

        <div class="analysis-grid">
            <div class="analysis-section">
                <h4>P&L Attribution</h4>
                <div class="pnl-items">
                    <div class="pnl-item">
                        <span>Realized P&L</span>
                        <span class="${totalRealizedPnl >= 0 ? 'positive' : 'negative'}">${totalRealizedPnl >= 0 ? '+' : ''}$${Math.abs(totalRealizedPnl / 1000).toFixed(0)}K</span>
                    </div>
                    <div class="pnl-item">
                        <span>Unrealized P&L</span>
                        <span class="${totalUnrealizedPnl >= 0 ? 'positive' : 'negative'}">${totalUnrealizedPnl >= 0 ? '+' : ''}$${Math.abs(totalUnrealizedPnl / 1000).toFixed(0)}K</span>
                    </div>
                    <div class="pnl-item">
                        <span>Total Volume</span>
                        <span class="positive">$${(totalVolume / 1000).toFixed(0)}K</span>
                    </div>
                    <div class="pnl-item">
                        <span>Total Fees</span>
                        <span class="negative">-$${(totalFees).toFixed(0)}</span>
                    </div>
                </div>
            </div>

            <div class="analysis-section">
                <h4>Trade Performance</h4>
                <div class="chart-container">
                    <div class="chart-legend">
                        <span class="legend-item"><span class="legend-color winning"></span>Winning Trades</span>
                        <span class="legend-item"><span class="legend-color losing"></span>Losing Trades</span>
                    </div>
                    <div class="chart-bars">
                        <div class="month-bar">
                            <div class="bar-group">
                                <div class="bar winning" style="height: 72px;"></div>
                                <div class="bar losing" style="height: 36px;"></div>
                            </div>
                            <span class="month-label">Jan</span>
                        </div>
                        <div class="month-bar">
                            <div class="bar-group">
                                <div class="bar winning" style="height: 86px;"></div>
                                <div class="bar losing" style="height: 47px;"></div>
                            </div>
                            <span class="month-label">Feb</span>
                        </div>
                        <div class="month-bar">
                            <div class="bar-group">
                                <div class="bar winning" style="height: 95px;"></div>
                                <div class="bar losing" style="height: 41px;"></div>
                            </div>
                            <span class="month-label">Mar</span>
                        </div>
                        <div class="month-bar">
                            <div class="bar-group">
                                <div class="bar winning" style="height: 78px;"></div>
                                <div class="bar losing" style="height: 48px;"></div>
                            </div>
                            <span class="month-label">Apr</span>
                        </div>
                        <div class="month-bar">
                            <div class="bar-group">
                                <div class="bar winning" style="height: 89px;"></div>
                                <div class="bar losing" style="height: 37px;"></div>
                            </div>
                            <span class="month-label">May</span>
                        </div>
                        <div class="month-bar">
                            <div class="bar-group">
                                <div class="bar winning" style="height: 93px;"></div>
                                <div class="bar losing" style="height: 43px;"></div>
                            </div>
                            <span class="month-label">Jun</span>
                        </div>
                    </div>
                    <div class="trade-stats">
                        <div class="stat-item">
                            <span class="stat-label">XIRR Return</span>
                            <span class="stat-value ${xirr >= 0 ? 'positive' : 'negative'}">${(xirr * 100).toFixed(1)}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Total P&L</span>
                            <span class="stat-value ${totalPnl >= 0 ? 'positive' : 'negative'}">${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl / 1000).toFixed(0)}K</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadUserTransactions() {
    let transactions = [];

    // 1. Fetch from API if logged in
    if (currentUser && currentUser.user_id) {
        try {
            console.log('Loading transactions for user:', currentUser.user_id);
            const url = `${API_BASE}/api/load-transactions?user_id=${currentUser.user_id}&_t=${Date.now()}`;
            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.transactions)) {
                    transactions = data.transactions;
                } else {
                    console.error('Load transactions failed or invalid format:', data);
                }
            } else {
                console.error(`HTTP error loading transactions: ${response.status}`);
            }
        } catch (error) {
            console.error('Transaction loading error:', error);
        }
    }

    // 2. Fetch from LocalStorage and merge (Fallback/Offline support)
    try {
        const localFiles = JSON.parse(localStorage.getItem('transactionFiles') || '[]');
        if (Array.isArray(localFiles)) {
            let localCount = 0;
            localFiles.forEach(file => {
                // Check if already exists in API results (by name)
                const exists = transactions.some(t => t.transaction_set_name === file.filename);
                if (!exists) {
                    transactions.push({
                        id: `local_${file.timestamp || Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        transaction_set_name: file.filename,
                        created_at: new Date(file.timestamp || Date.now()).toISOString(),
                        transactions_data: file.data, // Match the schema expected by viewSelectedTransactions
                        data: file.data, // Legacy support
                        is_local: true
                    });
                    localCount++;
                }
            });
            if (localCount > 0) console.log(`Merged ${localCount} local transaction files`);
        }
    } catch (e) {
        console.error('Error loading local transaction files:', e);
    }

    // 3. Update Global State and UI
    window.userTransactions = transactions;
    console.log('Loaded transactions array:', transactions.length);
    updateTransactionsDropdown(transactions);
}

function updateTransactionsDropdown(transactions) {
    if (!Array.isArray(transactions)) {
        console.error('updateTransactionsDropdown called with non-array:', transactions);
        return;
    }

    console.log('Updating transaction dropdowns with', transactions.length, 'items');

    // Legacy element
    const savedSelect = document.getElementById('savedTransactions');
    if (savedSelect) {
        savedSelect.innerHTML = '<option value="">Select transactions...</option>';
        transactions.forEach(txn => {
            const displayDate = txn.created_at ? new Date(txn.created_at).toLocaleDateString() : 'Unknown';
            const displayName = txn.transaction_set_name || `Set ${txn.id}`;
            const option = document.createElement('option');
            option.value = txn.id;
            option.textContent = `${displayName} (${displayDate})`;
            savedSelect.appendChild(option);
        });
    }

    // Main application element
    const fileSelect = document.getElementById('transactionFileSelect');
    if (fileSelect) {
        const currentValue = fileSelect.value;
        fileSelect.innerHTML = '<option value="" selected>Select transaction file...</option>';

        transactions.forEach(txn => {
            const displayDate = txn.created_at ? new Date(txn.created_at).toLocaleDateString() : 'Unknown';
            let displayName = txn.transaction_set_name || `Set ${txn.id}`;

            // Clean up display name
            try {
                // Remove timestamp suffix like _20251020_154526
                displayName = displayName.replace(/_\d{8}_\d{6}$/, '');
                // Remove prefix
                displayName = displayName.replace(/^Transactions_/, '');
                // Remove extension
                displayName = displayName.replace(/\.csv$/i, '').replace(/\.xlsx$/i, '');
            } catch (e) {
                // Keep original
            }

            const option = document.createElement('option');
            // Use ID as value to match viewSelectedTransactions logic
            option.value = txn.id;
            // Styling fallback
            option.textContent = `${displayName} (${displayDate})`;
            fileSelect.appendChild(option);
        });

        // Restore selection if possible, or reset UI if item is gone
        if (currentValue && !transactions.find(t => t.id == currentValue)) {
            fileSelect.value = '';
            const deleteBtn = document.getElementById('deleteTransactionsBtn');
            if (deleteBtn) deleteBtn.style.display = 'none';
        }
    } else {
        console.error('transactionFileSelect element NOT found in DOM');
    }
}

function viewSelectedTransactions() {
    const select = document.getElementById('transactionFileSelect');
    const index = select.value;

    if (index === '' || index === null) {
        showError('Please select a transaction file');
        return;
    }

    const transactions = window.userTransactions || [];
    // Select value is ID
    const fileData = transactions.find(t => t.id == index || t.id === parseInt(index));

    if (!fileData) {
        showError('Transaction file not found. Please refresh and try again.');
        return;
    }

    try {
        // Hide portfolio analysis and clear portfolio selection
        const portfolioAnalysis = document.getElementById('portfolioAnalysis');
        const portfolioSelect = document.getElementById('portfolioFileSelect');
        const deletePortfolioBtn = document.getElementById('deletePortfolioBtn');

        if (portfolioAnalysis) portfolioAnalysis.classList.add('hidden');
        if (portfolioSelect) portfolioSelect.value = '';
        if (deletePortfolioBtn) deletePortfolioBtn.style.display = 'none';

        // Show transaction analysis
        // Show transaction analysis
        const transactionAnalysis = document.getElementById('transactionAnalysis');
        if (transactionAnalysis) {
            transactionAnalysis.classList.add('hidden'); // Ensure analysis is hidden

            // Also show the data table as requested by user
            if (typeof window.viewLoadedData === 'function') {
                // Pass 'transactions' preference to prioritize this data type
                setTimeout(() => window.viewLoadedData('transactions'), 100);
            }
        }

        // Robust data extraction
        let transactionData = fileData.transactions_data || fileData.data || fileData.transactions || [];

        // Ensure data is parsed if arriving as string (common with some DB adapters)
        if (typeof transactionData === 'string') {
            try {
                transactionData = JSON.parse(transactionData);
            } catch (e) {
                console.error('Failed to parse transaction JSON:', e);
                transactionData = [];
            }
        }

        if (!transactionData || transactionData.length === 0) {
            showError('File contains no transaction data.');
            return;
        }

        // Set global transaction data
        window.currentTransactions = transactionData;
        window.portfolioData = []; // Clear portfolio data to prevent confusion
        localStorage.setItem('currentTransactions', JSON.stringify(transactionData));
        localStorage.removeItem('currentPortfolio'); // Clear portfolio from local storage

        window.currentDataType = 'transaction';
        window.currentDataIndex = index;

        // Skip loading analysis for now as per user request
        /*
        showAllTransactionCardLoading();

        // Load all transaction analytics
        if (typeof loadAllTransactionAnalytics === 'function') {
            loadAllTransactionAnalytics(transactionData);
        } else if (typeof loadTransactionAnalytics === 'function') {
            loadTransactionAnalytics(transactionData);
        } else {
            // Fallback to analyzeTransactionData
            analyzeTransactionData(transactionData);
        }
        */

    } catch (error) {
        showError('Failed to load transaction data: ' + error.message);
    }
}

async function downloadSampleTransactions() {
    // Check for logged in user
    if (!currentUser || !currentUser.user_id) {
        showError('Please login to export transactions');
        return;
    }

    showLoading(true);

    try {
        let transactionsToExport = [];

        // 1. Prioritize currently viewed transactions
        if (window.currentTransactions && window.currentTransactions.length > 0) {
            transactionsToExport = window.currentTransactions;
            console.log('Exporting currently viewed transactions');
        }
        // 2. Fallback to most recent uploaded file if available in memory
        else if (window.userTransactions && window.userTransactions.length > 0) {
            console.log('Exporting most recent transaction file from memory');
            const latest = window.userTransactions[0];
            let data = latest.transactions_data || latest.data || [];

            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { data = []; }
            }
            transactionsToExport = data;
        }
        // 3. Fallback to API fetch
        else {
            console.log('Fetching transactions from API for export');
            const url = `${API_BASE}/api/load-transactions?user_id=${currentUser.user_id}&_t=${Date.now()}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.success && Array.isArray(data.transactions) && data.transactions.length > 0) {
                const latest = data.transactions[0];
                let txData = latest.transactions_data || latest.data || [];
                if (typeof txData === 'string') {
                    try { txData = JSON.parse(txData); } catch (e) { txData = []; }
                }
                transactionsToExport = txData;
            }
        }

        if (!transactionsToExport || transactionsToExport.length === 0) {
            showError('No transaction data found to export.');
            showLoading(false);
            return;
        }

        // Generate CSV
        const headers = ['symbol', 'quantity', 'price', 'date', 'transaction_type', 'fees', 'portfolio', 'currency'];
        const csvRows = [headers.join(',')];

        transactionsToExport.forEach(t => {
            const row = headers.map(header => {
                // Handle case-insensitivity and missing values
                let val = t[header] !== undefined ? t[header] :
                    (t[header.toUpperCase()] !== undefined ? t[header.toUpperCase()] : '');

                // Escape quotes if string
                if (typeof val === 'string') {
                    val = val.replace(/"/g, '""');
                }
                return `"${val}"`;
            });
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'export_transactions.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showSuccess('Transactions exported successfully');

    } catch (error) {
        console.error('Export failed:', error);
        showError('Failed to export transactions: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function deleteSelectedTransactions() {
    const select = document.getElementById('transactionFileSelect');
    if (!select || !select.value) {
        showError('Please select a transaction file to delete');
        return;
    }

    if (!confirm('Are you sure you want to delete this transaction file?')) {
        return;
    }

    const selectedIndex = parseInt(select.value);
    const transactionFiles = window.transactionFiles || [];

    if (selectedIndex < 0 || selectedIndex >= transactionFiles.length) {
        showError('Invalid transaction file selected');
        return;
    }

    const fileToDelete = transactionFiles[selectedIndex];
    showLoading(true);

    try {
        // Delete from Supabase first
        if (fileToDelete.source === 'supabase' && fileToDelete.id && currentUser?.user_id) {
            const response = await fetch(`${API_BASE}/api/delete-transactions`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': currentUser.user_id
                },
                body: JSON.stringify({ transaction_id: fileToDelete.id })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
        }

        // Also delete any matching files from uploaded_files table
        if (currentUser?.user_id) {
            try {
                await fetch(`${API_BASE}/api/delete-uploaded-file`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': currentUser.user_id
                    },
                    body: JSON.stringify({ filename: fileToDelete.filename, file_type: 'transaction' })
                });
            } catch (e) {
                console.log('Uploaded file cleanup failed:', e);
            }
        }

        // Remove only the deleted file from localStorage
        const localFiles = JSON.parse(localStorage.getItem('transactionFiles') || '[]');
        const localIndex = localFiles.findIndex(f => f.filename === fileToDelete.filename);
        if (localIndex >= 0) {
            localFiles.splice(localIndex, 1);
            localStorage.setItem('transactionFiles', JSON.stringify(localFiles));
        }
        localStorage.removeItem('currentTransactions');

        // Clear current data only
        window.currentTransactions = null;

        // Clear file input
        const fileInput = document.getElementById('transactionFile');
        if (fileInput) fileInput.value = '';

        // Hide analysis section
        const analysisSection = document.getElementById('transactionAnalysis');
        if (analysisSection) analysisSection.classList.add('hidden');

        // Clear analysis content
        const analysisCards = ['pnlAttribution', 'tradePerformance', 'costAnalysis', 'turnoverAnalysis', 'taxAnalysis', 'cashFlowAnalysis', 'fifoLifoAnalysis', 'tradeTimingAnalysis', 'drawdownAnalysis', 'returnAttribution'];
        analysisCards.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.innerHTML = '';
        });

        // Force fresh reload from Supabase
        await loadUserTransactions();
        await updateFileSelectors();

        // Reset dropdown selection and hide delete button
        select.value = '';
        const deleteBtn = document.getElementById('deleteTransactionBtn');
        if (deleteBtn) deleteBtn.style.display = 'none';

        showSuccess('Transaction file deleted successfully');

    } catch (error) {
        showError('Failed to delete transaction file: ' + error.message);
    }

    showLoading(false);
}

function toggleTransactionDelete() {
    const select = document.getElementById('transactionFileSelect');
    const deleteBtn = document.getElementById('deleteTransactionBtn');

    if (select && deleteBtn) {
        deleteBtn.style.display = select.value ? 'block' : 'none';
    }
}

function showAllTransactionCardLoading() {
    const cards = ['pnlAttribution', 'tradePerformance', 'costAnalysis', 'turnoverAnalysis', 'taxAnalysis', 'cashFlowAnalysis', 'fifoLifoAnalysis', 'tradeTimingAnalysis', 'drawdownAnalysis', 'returnAttribution'];
    cards.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = '<div class="text-center py-4 text-gray-500">Loading...</div>';
        }
    });
}

async function refreshTransactionAnalysis() {
    let currentTransactions = JSON.parse(localStorage.getItem('currentTransactions') || '[]');

    if (!currentTransactions || currentTransactions.length === 0) {
        showError('No transaction data to refresh');
        const analysisSection = document.getElementById('transactionAnalysis');
        if (analysisSection) analysisSection.classList.add('hidden');
        return;
    }

    showLoading(true);
    showAllTransactionCardLoading();

    try {
        // Re-run transaction analysis
        await analyzeTransactionData(currentTransactions);
        showSuccess('Transaction analysis refreshed successfully');
    } catch (error) {
        showError('Failed to refresh analysis: ' + error.message);
    }

    showLoading(false);
}

// Export functions
window.uploadTransactions = uploadTransactions;
window.analyzeTransactionData = analyzeTransactionData;
window.displayTransactionResults = displayTransactionResults;
window.loadUserTransactions = loadUserTransactions;
window.viewSelectedTransactions = viewSelectedTransactions;
window.downloadSampleTransactions = downloadSampleTransactions;
window.deleteSelectedTransactions = deleteSelectedTransactions;
window.toggleTransactionDelete = toggleTransactionDelete;
window.refreshTransactionAnalysis = refreshTransactionAnalysis;