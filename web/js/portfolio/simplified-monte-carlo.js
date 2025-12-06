// Simplified Monte Carlo - Replaces complex monte-carlo.js

// Main entry point called by AnalysisManager
window.loadMonteCarlo = function (portfolioData) {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('monte-carlo');
    }
};

// Render function called by AnalyticsManager.displayMonteCarloResults
window.renderMonteCarloChart = function (apiResponse) {
    console.log('[Monte Carlo] Rendering results:', apiResponse);

    const container = document.getElementById('monteCarloResults');
    if (!container) {
        console.error('[Monte Carlo] Container not found');
        return;
    }

    // Handle different response structures (results vs direct)
    const results = apiResponse.results || apiResponse;
    const simData = results.simulation_data || [];
    // Fix: Backend returns 'summary_statistics', not 'statistics'
    const stats = results.summary_statistics || results.statistics || {};

    if (!simData || simData.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">No simulation data available.</div>';
        return;
    }

    // 1. Build Stats Summary HTML
    let statsHtml = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div class="text-xs text-gray-500 uppercase">Exp. Return</div>
                <div class="text-lg font-bold text-gray-900">${formatPercent(stats.mean_return || stats.expected_return)}</div>
            </div>
            <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div class="text-xs text-gray-500 uppercase">VaR (95%)</div>
                <div class="text-lg font-bold text-red-600">${formatCurrency(stats.value_at_risk_95 || stats.var_95 || stats.value_at_risk)}</div>
            </div>
            <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div class="text-xs text-gray-500 uppercase">Sharpe Ratio</div>
                <div class="text-lg font-bold text-gray-900">${formatNumber(stats.sharpe_ratio)}</div>
            </div>
            <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div class="text-xs text-gray-500 uppercase">Max Drawdown</div>
                <div class="text-lg font-bold text-red-600">${formatPercent(stats.max_drawdown)}</div>
            </div>
        </div>
    `;

    // 2. Prepare Chart Container
    const chartContainer = `
        <div class="relative h-80 w-full bg-white rounded-lg border border-gray-200 p-2">
            <canvas id="monteCarloChart"></canvas>
        </div>
        <div class="mt-4 text-xs text-gray-500 text-center">
            Simulated ${simData.length} paths over forecast period. Showing spread of potential outcomes.
        </div>
    `;

    container.innerHTML = statsHtml + chartContainer;

    // 3. Process Data for Chart
    // Plot a subset of paths (e.g. 50) to avoid performance issues
    const maxPathsToPlot = 50;
    const step = Math.ceil(simData.length / maxPathsToPlot);
    const datasets = [];

    // Generate labels (Days)
    const numDays = simData[0]?.length || 0;
    const labels = Array.from({ length: numDays }, (_, i) => `Day ${i}`);

    // Add individual simulation paths (thin, grey)
    // simData is array of arrays [path1, path2...]
    simData.forEach((path, index) => {
        if (index % step === 0) {
            datasets.push({
                label: `Sim ${index}`,
                data: path,
                borderColor: 'rgba(156, 163, 175, 0.1)', // Gray-400 with low opacity
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            });
        }
    });

    // Calculate Percentiles per day for Highlight Lines
    // This requires transposing the data: days -> paths
    const p10 = [];
    const p50 = [];
    const p90 = [];

    for (let day = 0; day < numDays; day++) {
        const valuesAtDay = simData.map(path => path[day]).sort((a, b) => a - b);
        p10.push(valuesAtDay[Math.floor(valuesAtDay.length * 0.10)]);
        p50.push(valuesAtDay[Math.floor(valuesAtDay.length * 0.50)]);
        p90.push(valuesAtDay[Math.floor(valuesAtDay.length * 0.90)]);
    }

    // Add Highlight Lines
    datasets.push({
        label: 'Best Case (90th vs Start)',
        data: p90,
        borderColor: 'rgba(16, 185, 129, 0.8)', // Green-500
        borderWidth: 2,
        pointRadius: 0,
        fill: false
    });

    datasets.push({
        label: 'Median Case',
        data: p50,
        borderColor: 'rgba(59, 130, 246, 1)', // Blue-500
        borderWidth: 3,
        pointRadius: 0,
        fill: false
    });

    datasets.push({
        label: 'Worst Case (10th vs Start)',
        data: p10,
        borderColor: 'rgba(239, 68, 68, 0.8)', // Red-500
        borderWidth: 2,
        pointRadius: 0,
        fill: false
    });

    // 4. Render Chart
    const ctx = document.getElementById('monteCarloChart').getContext('2d');

    // Destroy previous instance if exists
    if (window.monteCarloChartInstance) {
        window.monteCarloChartInstance.destroy();
    }

    window.monteCarloChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        filter: function (item, chart) {
                            // Only show summary lines in legend
                            return !item.text.startsWith('Sim');
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            if (context.dataset.label && !context.dataset.label.startsWith('Sim')) {
                                return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`;
                            }
                            return null;
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Portfolio Value ($)' },
                    grid: { color: '#f3f4f6' }
                },
                x: {
                    title: { display: true, text: 'Forecast Days' },
                    grid: { display: false },
                    ticks: { maxTicksLimit: 10 }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });

    console.log('[Monte Carlo] Chart rendered successfully');
};

// Helper Formatters
function formatCurrency(value) {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercent(value) {
    if (value === undefined || value === null) return 'N/A';
    // If decimal < 1 (e.g. 0.05), mult by 100. If > 1 (e.g. 5.0), assume percent?
    // Usually backend returns decimals.
    const val = parseFloat(value);
    if (Math.abs(val) <= 1.0) return (val * 100).toFixed(2) + '%';
    return val.toFixed(2) + '%';
}

function formatNumber(value) {
    if (value === undefined || value === null) return 'N/A';
    return parseFloat(value).toFixed(2);
}

// Keep existing functions for backward compatibility
window.toggleMonteCarloSettings = () => window.analyticsCore?.toggleSettings('monteCarloSettings');
window.updateMonteCarloSimulation = () => window.analyticsManager?.loadModule('monte-carlo');