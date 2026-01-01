// Unified Data Merger Module
// Handles merging of Manual Uploads and Plaid Connections preventing overrides

window.unifiedData = {
    manual: {
        portfolio: [],
        transactions: []
    },
    plaid: {
        // [connectionId]: { portfolio: [], transactions: [] }
    }
};

const DataMerger = {
    // Update Manual Data (replaces previous manual data)
    updateManualData: function (type, data) {
        console.log(`[DataMerger] Updating Manual ${type}:`, data?.length);
        if (type === 'portfolio') {
            window.unifiedData.manual.portfolio = data || [];
        } else if (type === 'transactions') {
            window.unifiedData.manual.transactions = data || [];
        }
        this.rebuildGlobalData(type);
    },

    // Update Plaid Data for a specific connection
    updatePlaidData: function (connectionId, type, data) {
        console.log(`[DataMerger] Updating Plaid ${type} for ${connectionId}:`, data?.length);
        if (!window.unifiedData.plaid[connectionId]) {
            window.unifiedData.plaid[connectionId] = { portfolio: [], transactions: [] };
        }

        if (type === 'portfolio') {
            window.unifiedData.plaid[connectionId].portfolio = data || [];
        } else if (type === 'transactions') {
            window.unifiedData.plaid[connectionId].transactions = data || [];
        }
        this.rebuildGlobalData(type);
    },

    // Clear specific connection data (e.g. on disconnect)
    clearPlaidConnection: function (connectionId) {
        if (window.unifiedData.plaid[connectionId]) {
            delete window.unifiedData.plaid[connectionId];
            this.rebuildGlobalData('portfolio');
            this.rebuildGlobalData('transactions');
        }
    },

    // Rebuild global window.currentX and window.portfolioData arrays
    rebuildGlobalData: function (type) {
        // Debounce implementation
        if (this._debounceTimers && this._debounceTimers[type]) {
            clearTimeout(this._debounceTimers[type]);
        }

        if (!this._debounceTimers) this._debounceTimers = {};

        this._debounceTimers[type] = setTimeout(() => {
            this._executeRebuild(type);
        }, 500); // 500ms debounce
    },

    _executeRebuild: function (type) {
        // Shared Regex Normalization Helper
        const normalizeItem = (item) => {
            const newItem = { ...item };
            const keys = Object.keys(item);

            // Regex patterns for key unification
            const patterns = {
                avg_cost: /^(avg|average).*(cost|price)|cost.*basis|unit.*cost|buy.*price|price.*paid/i,
                current_price: /^current.*price|market.*price|last.*price|^price$/i,
                quantity: /^quant|^qty$|^shares$|^units$|^vol|^count$/i,
                symbol: /^symbol|^ticker|^stock|^security|^asset/i,
                name: /^name|^description|^company/i
            };

            keys.forEach(key => {
                for (const [standardKey, regex] of Object.entries(patterns)) {
                    if (regex.test(key) && !newItem[standardKey]) {
                        newItem[standardKey] = item[key];
                    }
                }
            });
            return newItem;
        };

        if (type === 'portfolio' || type === 'all') {
            let merged = [...(window.unifiedData.manual.portfolio || [])].map(normalizeItem);

            // Append all plaid portfolios
            Object.keys(window.unifiedData.plaid).forEach(connId => {
                const pData = window.unifiedData.plaid[connId].portfolio || [];
                const tagged = pData.map(item => ({
                    ...normalizeItem(item),
                    source: 'plaid',
                    connection_id: connId
                }));
                merged = merged.concat(tagged);
            });

            // --- SMART ENRICHMENT (Cross-Filling) ---
            // 1. Build Knowledge Base by Ticker
            const knowledgeBase = {};

            // Keys usually specific to a holding instance that should NOT be merged/overwritten across accounts
            const DO_NOT_MERGE = new Set([
                'quantity', 'qty', 'shares', 'units',
                'market_value', 'value', 'total',
                'unrealized_pnl', 'pnl', 'gain_loss',
                'source', 'connection_id', 'account_id', 'portfolio_id', 'data_source',
                // We DO merge avg_cost/cost_basis only if the target is missing it (handled in backfill logic)
                // but we don't want to blindly collect it as "metadata" if it varies by account.
                // However, for the purpose of "Gap Filling" (user's request), we treat it as shareable 
                // IF the target has none.
            ]);
            // Note: 'current_price' IS safe to merge as it's market-data, not user-data.

            merged.forEach(item => {
                if (!item.symbol) return;
                const sym = item.symbol.toUpperCase();
                if (!knowledgeBase[sym]) knowledgeBase[sym] = {};

                Object.keys(item).forEach(key => {
                    // Skip internal/instance-specific keys
                    if (DO_NOT_MERGE.has(key)) return;

                    const val = item[key];
                    // Save "Good" values into KB
                    // Definition of "Good":
                    // - If text: Truthy string
                    // - If number: > 0 (heuristic for cost/price)

                    let isGood = false;
                    if (typeof val === 'string' && val.trim().length > 0) isGood = true;
                    else if (typeof val === 'number' && !isNaN(val) && Math.abs(val) > 0.00001) isGood = true;

                    if (isGood) {
                        // Strategy: Last writer wins? Or prioritize 'plaid'? 
                        // For now, simple "last valid value wins" which usually means Plaid (loaded after manual) 
                        // or Manual (if manual is loaded after).
                        knowledgeBase[sym][key] = val;
                    }
                });
            });

            // 2. Backfill Missing Data
            merged = merged.map(item => {
                if (!item.symbol) return item;
                const sym = item.symbol.toUpperCase();
                const knowledge = knowledgeBase[sym];

                if (!knowledge) return item;

                const enriched = { ...item };

                // Try to fill ANY missing key in enriched from knowledge
                Object.keys(knowledge).forEach(key => {
                    const currentVal = enriched[key];

                    // Criteria to Overwrite/Fill:
                    // 1. Current is missing (undefined/null)
                    // 2. Current is empty string
                    // 3. Current is 0 (numeric) - likely placeholder

                    let needsFill = false;
                    if (currentVal === undefined || currentVal === null) needsFill = true;
                    else if (typeof currentVal === 'string' && currentVal.trim() === '') needsFill = true;
                    else if (typeof currentVal === 'number' && Math.abs(currentVal) < 0.00001) needsFill = true;

                    // Special safety for avg_cost: Only fill if truly 0. 
                    // (Already covered by number check above, but good to keep in mind)

                    if (needsFill) {
                        enriched[key] = knowledge[key];
                        // Tag it so we know it was modified (useful for debugging/UI)
                        if (!enriched._enriched_keys) enriched._enriched_keys = [];
                        enriched._enriched_keys.push(key);
                    }
                });

                return enriched;
            });

            console.log(`[DataMerger] Merged Portfolio: ${merged.length} items (with Smart Enrichment)`);

            // Update Global State
            window.portfolioData = merged;
            window.currentPortfolio = merged;
            window.currentPortfolioData = merged; // Legacy alias

            // Persist (optional, might get large)
            localStorage.setItem('currentPortfolio', JSON.stringify(merged));

            // Dispatch Event
            document.dispatchEvent(new CustomEvent('portfolioLoaded', { detail: { portfolio: merged } }));

            // Update Metrics UI
            if (typeof updatePortfolioMetrics === 'function') {
                updatePortfolioMetrics(merged);
            }
        }

        if (type === 'transactions' || type === 'all') {
            let merged = [...(window.unifiedData.manual.transactions || [])].map(normalizeItem);

            // Append all plaid transactions
            Object.keys(window.unifiedData.plaid).forEach(connId => {
                const tData = window.unifiedData.plaid[connId].transactions || [];
                const tagged = tData.map(item => ({
                    ...normalizeItem(item),
                    source: 'plaid',
                    connection_id: connId
                }));
                merged = merged.concat(tagged);
            });

            // --- SMART ENRICHMENT - Transactions ---
            // Often transactions might miss 'price' but we might know it from other sources? 
            // Less common for transactions to share exact timestamps/metadata, but we can standardise Symbols

            console.log(`[DataMerger] Merged Transactions: ${merged.length} items`);

            // Update Global State
            window.currentTransactions = merged;

            localStorage.setItem('currentTransactions', JSON.stringify(merged));

            // Dispatch Event
            document.dispatchEvent(new CustomEvent('transactionsLoaded', { detail: { transactions: merged } }));
        }
    }
};

window.DataMerger = DataMerger;
