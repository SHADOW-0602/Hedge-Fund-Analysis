// Turnover Analysis Module
async function loadTurnoverAnalysis(transactions) {
    const container = document.getElementById('turnoverAnalysis');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-gray-500">Loading turnover analysis...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/turnover-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions })
        });
        
        const data = await response.json();
        
        if (data.success && data.turnover_analysis) {
            displayTurnoverAnalysis(data.turnover_analysis);
        } else {
            container.innerHTML = '<div class="text-center py-4 text-red-500">Analysis Error<br><small>No valid transactions found</small></div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="text-center py-4 text-red-500">Analysis Error<br><small>Failed to load turnover analysis</small></div>';
    }
}

function displayTurnoverAnalysis(data) {
    const container = document.getElementById('turnoverAnalysis');
    if (!container) return;
    
    const annualizedTurnover = data.annualized_turnover_rate || 0;
    const avgDailyTurnover = data.avg_daily_turnover || 0;
    const maxDailyTurnover = data.max_daily_turnover || 0;
    const tradingDays = data.trading_days || 0;
    const turnoverFreq = data.turnover_frequency || 0;
    
    container.innerHTML = `
        <div class="space-y-4">
            <div class="text-center">
                <div class="text-2xl font-bold text-blue-600">${(annualizedTurnover * 100).toFixed(1)}%</div>
                <div class="text-sm text-gray-500">Annualized Turnover</div>
            </div>
            
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-gray-600">Avg Daily Turnover:</span>
                    <span class="font-medium">$${avgDailyTurnover.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Max Daily Turnover:</span>
                    <span class="font-medium">$${maxDailyTurnover.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Trading Days:</span>
                    <span class="font-medium">${tradingDays}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Trading Frequency:</span>
                    <span class="font-medium">${(turnoverFreq * 100).toFixed(1)}%</span>
                </div>
            </div>
        </div>
    `;
}

// Export for global access
window.loadTurnoverAnalysis = loadTurnoverAnalysis;