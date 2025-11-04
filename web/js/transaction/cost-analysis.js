// Cost Analysis Module
async function loadCostAnalysis(transactions) {
    const container = document.getElementById('costAnalysis');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-gray-500">Loading cost analysis...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/cost-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions })
        });
        
        const data = await response.json();
        
        if (data.success && data.cost_analysis) {
            displayCostAnalysis(data.cost_analysis);
        } else {
            container.innerHTML = '<div class="text-center py-4 text-red-500">Analysis Error<br><small>No valid transactions found</small></div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="text-center py-4 text-red-500">Analysis Error<br><small>Failed to load cost analysis</small></div>';
    }
}

function displayCostAnalysis(data) {
    const container = document.getElementById('costAnalysis');
    if (!container) return;
    
    const totalCosts = data.total_costs || 0;
    const totalCommissions = data.total_commissions || 0;
    const totalSpreads = data.total_spreads || 0;
    const totalSlippage = data.total_slippage || 0;
    const costEfficiency = data.cost_efficiency_score || 0;
    const costPctVolume = data.cost_as_pct_volume || 0;
    
    container.innerHTML = `
        <div class="space-y-4">
            <div class="text-center">
                <div class="text-2xl font-bold text-red-600">$${totalCosts.toFixed(2)}</div>
                <div class="text-sm text-gray-500">Total Costs</div>
            </div>
            
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-gray-600">Commissions:</span>
                    <span class="font-medium text-red-600">$${totalCommissions.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Spreads:</span>
                    <span class="font-medium text-red-600">$${totalSpreads.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Slippage:</span>
                    <span class="font-medium text-red-600">$${totalSlippage.toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Cost % of Volume:</span>
                    <span class="font-medium">${costPctVolume.toFixed(3)}%</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Efficiency Score:</span>
                    <span class="font-medium ${costEfficiency >= 0.8 ? 'text-green-600' : costEfficiency >= 0.6 ? 'text-yellow-600' : 'text-red-600'}">
                        ${(costEfficiency * 100).toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>
    `;
}

// Export for global access
window.loadCostAnalysis = loadCostAnalysis;