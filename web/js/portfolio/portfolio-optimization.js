// Portfolio Optimization Renderer
window.renderOptimizationResults = (apiResponse) => {
    // 1. Data Validation
    const optimization = apiResponse.optimization || apiResponse;
    if (!optimization || !optimization.optimal_portfolio) {
        console.error('Invalid optimization data format', apiResponse);
        document.getElementById('optimizationResults').innerHTML = '<div class="text-red-500 p-4">Error: Invalid optimization data received from server.</div>';
        return;
    }

    const { optimal_portfolio, current_portfolio, efficient_frontier } = optimization;
    const container = document.getElementById('optimizationResults');
    if (!container) return;

    // Helper formatting
    const fmtPct = (val) => (val * 100).toFixed(2) + '%';
    const fmtNum = (val) => val.toFixed(2);

    // 2. Prepare Chart Data (Efficient Frontier)
    // Frontier Line
    const frontierData = (efficient_frontier || [])
        .sort((a, b) => a.volatility - b.volatility) // Sort by risk
        .map(pt => ({ x: pt.volatility, y: pt.expected_return }));

    // Points of Interest
    const currentPoint = { x: current_portfolio.volatility, y: current_portfolio.expected_return };
    const optimalPoint = { x: optimal_portfolio.volatility, y: optimal_portfolio.expected_return };

    // 3. Render Dashboard using Grid
    container.innerHTML = `
        <!-- Metrics Summary -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div class="text-xs font-medium text-gray-500 uppercase">Sharpe Ratio</div>
                <div class="mt-1 flex items-baseline">
                    <div class="text-2xl font-bold text-gray-900">${fmtNum(optimal_portfolio.sharpe_ratio)}</div>
                    <span class="ml-2 text-sm ${optimal_portfolio.sharpe_ratio >= current_portfolio.sharpe_ratio ? 'text-green-600' : 'text-red-600'}">
                        vs ${fmtNum(current_portfolio.sharpe_ratio)}
                    </span>
                </div>
            </div>
            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div class="text-xs font-medium text-gray-500 uppercase">Expected Return</div>
                <div class="mt-1 flex items-baseline">
                    <div class="text-2xl font-bold text-gray-900">${fmtPct(optimal_portfolio.expected_return)}</div>
                    <span class="ml-2 text-sm ${optimal_portfolio.expected_return >= current_portfolio.expected_return ? 'text-green-600' : 'text-red-600'}">
                        vs ${fmtPct(current_portfolio.expected_return)}
                    </span>
                </div>
            </div>
            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div class="text-xs font-medium text-gray-500 uppercase">Annual Volatility</div>
                <div class="mt-1 flex items-baseline">
                    <div class="text-2xl font-bold text-gray-900">${fmtPct(optimal_portfolio.volatility)}</div>
                    <span class="ml-2 text-sm ${optimal_portfolio.volatility <= current_portfolio.volatility ? 'text-green-600' : 'text-red-600'}">
                        vs ${fmtPct(current_portfolio.volatility)}
                    </span>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Left: Efficient Frontier Chart -->
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 class="text-lg font-medium text-gray-900 mb-4">Efficient Frontier</h3>
                <div class="h-80 w-full relative">
                    <canvas id="frontierChart"></canvas>
                </div>
                <div class="mt-4 text-xs text-gray-500 text-center">
                    X: Annualized Volatility (Risk) | Y: Expected Annual Return
                </div>
            </div>

            <!-- Right: Allocation Table -->
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 class="text-lg font-medium text-gray-900 mb-4">Optimal Allocation</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current</th>
                                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Optimal</th>
                                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200 text-sm" id="weightsTableBody">
                            <!-- Rows injected below -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // 4. Render Chart
    const ctx = document.getElementById('frontierChart').getContext('2d');

    // Destroy existing chart if it exists
    if (window.frontierChartInstance) {
        window.frontierChartInstance.destroy();
    }

    window.frontierChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Efficient Frontier',
                    data: frontierData,
                    showLine: true,
                    borderColor: '#4F46E5', // Indigo 600
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0, // Hide points on line
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Optimal Portfolio',
                    data: [optimalPoint],
                    backgroundColor: '#10B981', // Emerald 500
                    borderColor: '#059669',
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    pointStyle: 'star'
                },
                {
                    label: 'Current Portfolio',
                    data: [currentPoint],
                    backgroundColor: '#EF4444', // Red 500
                    borderColor: '#B91C1C',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointStyle: 'circle'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Volatility (Risk)' },
                    ticks: { callback: (val) => (val * 100).toFixed(1) + '%' }
                },
                y: {
                    title: { display: true, text: 'Expected Return' },
                    ticks: { callback: (val) => (val * 100).toFixed(1) + '%' }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const pt = ctx.raw;
                            return `${ctx.dataset.label}: Risk ${(pt.x * 100).toFixed(2)}%, Ret ${(pt.y * 100).toFixed(2)}%`;
                        }
                    }
                }
            }
        }
    });

    // 5. Render Weights Table
    const tableBody = document.getElementById('weightsTableBody');
    const weights = optimal_portfolio.weights;
    const currentWeights = current_portfolio.weights || {};

    // Union of all keys
    const allSymbols = Array.from(new Set([...Object.keys(weights), ...Object.keys(currentWeights)]));

    // Sort by optimal weight descending
    allSymbols.sort((a, b) => (weights[b] || 0) - (weights[a] || 0));

    tableBody.innerHTML = allSymbols.map(sym => {
        const curr = currentWeights[sym] || 0;
        const opt = weights[sym] || 0;
        const diff = opt - curr;

        // Skip if both are negligible
        if (Math.abs(curr) < 0.001 && Math.abs(opt) < 0.001) return '';

        return `
            <tr>
                <td class="px-3 py-2 font-medium text-gray-900">${sym}</td>
                <td class="px-3 py-2 text-right text-gray-500">${fmtPct(curr)}</td>
                <td class="px-3 py-2 text-right font-semibold text-indigo-600">${fmtPct(opt)}</td>
                <td class="px-3 py-2 text-right ${diff > 0 ? 'text-green-600' : (diff < 0 ? 'text-red-600' : 'text-gray-500')}">
                    ${diff > 0 ? '+' : ''}${fmtPct(diff)}
                </td>
            </tr>
        `;
    }).join('');
};
