// INSTRUCTIONS: Replace the loadTickers function in landing.js (lines 570-635) with this improved version

// Load tickers from API with comprehensive error handling
async function loadTickers() {
    const stocksGrid = document.getElementById('stocks-grid');

    try {
        // Show loading state
        if (stocksGrid) {
            stocksGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <div class="loading-spinner" style="display: inline-block; width: 40px; height: 40px; border: 4px solid rgba(79, 70, 229, 0.1); border-top-color: #4F46E5; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 1rem; color: var(--text-secondary);" class="loading-progress">Loading your stocks...</p>
                </div>
            `;
        }

        const response = await fetch(`${API_BASE}/api/tickers`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const tickers = await response.json();

        if (!Array.isArray(tickers)) {
            throw new Error('Invalid response format - expected array of tickers');
        }

        if (tickers.length === 0) {
            // No tickers available - show helpful message
            stocksGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📊</div>
                    <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.25rem;">No Stocks Added Yet</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Start building your portfolio by adding stock tickers above</p>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">Try adding popular tickers like AAPL, GOOGL, MSFT, or TSLA</p>
                </div>
            `;
            return;
        }

        // Load logos for each ticker with progress tracking
        const tickersWithLogos = [];
        let loadedCount = 0;

        // Update progress as logos load
        const updateProgress = () => {
            loadedCount++;
            if (stocksGrid && loadedCount < tickers.length) {
                const progressDiv = stocksGrid.querySelector('.loading-progress');
                if (progressDiv) {
                    progressDiv.textContent = `Loading stocks... ${loadedCount}/${tickers.length}`;
                }
            }
        };

        for (const tickerData of tickers) {
            const symbol = typeof tickerData === 'string' ? tickerData : tickerData.symbol;
            let logoUrl = null;

            try {
                const logoResponse = await fetch(`${API_BASE}/api/logo/${symbol}`);
                if (logoResponse.status === 200) {
                    const logoData = await logoResponse.json();
                    logoUrl = logoData?.image || null;
                }
                // Consume response to prevent console logging
                if (!logoResponse.ok) {
                    await logoResponse.text();
                }
            } catch (error) {
                // Silently handle logo fetch errors
                console.debug(`Logo fetch failed for ${symbol}:`, error.message);
            }

            tickersWithLogos.push({
                symbol: symbol,
                company_name: typeof tickerData === 'object' ? tickerData.company_name : null,
                logoUrl: logoUrl
            });

            updateProgress();
        }

        // Render all tickers
        stocksGrid.innerHTML = tickersWithLogos.map(ticker => `
            <div class="stock-card" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; text-align: center; position: relative; transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--shadow-lg)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                <button class="remove-btn" onclick="removeTicker('${ticker.symbol}')" style="position: absolute; top: 8px; right: 8px; background: var(--error-color); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
                <div class="stock-logo" onclick="viewStock('${ticker.symbol}')" style="width: 60px; height: 60px; margin: 0 auto 1rem; background: var(--primary-color); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: white;">
                    ${ticker.logoUrl ?
                `<img src="${ticker.logoUrl}" alt="${ticker.symbol}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;">` :
                `${ticker.symbol.charAt(0)}`
            }
                </div>
                <h4 onclick="viewStock('${ticker.symbol}')" style="color: var(--text-primary); margin: 0 0 0.5rem; font-size: 1.1rem; font-weight: 600;">${ticker.symbol}</h4>
                <p onclick="viewStock('${ticker.symbol}')" style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${ticker.company_name || 'Company Name'}</p>
            </div>
        `).join('');

        console.log(`Successfully loaded ${tickers.length} tickers`);

    } catch (error) {
        console.error('Error loading tickers:', error);

        // Show error state with retry option
        if (stocksGrid) {
            stocksGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h3 style="color: var(--error-color); margin-bottom: 0.5rem; font-size: 1.25rem;">Failed to Load Stocks</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">${error.message}</p>
                    <button onclick="loadTickers()" style="background: var(--primary-color); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-size: 1rem; transition: all 0.3s ease;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}
