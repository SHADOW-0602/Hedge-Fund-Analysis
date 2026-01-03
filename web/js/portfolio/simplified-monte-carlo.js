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
    window.lastMonteCarloData = apiResponse; // Store for re-rendering

    const container = document.getElementById('monteCarloChartContainer');
    if (!container) {
        console.error('[Monte Carlo] Container not found');
        return;
    }

    // Setup Theme Observer if not already active
    if (!window.monteCarloThemeObserver) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    // Slight delay to allow transitions
                    setTimeout(() => {
                        const container = document.getElementById('monteCarloChartContainer');
                        if (container && window.lastMonteCarloData) {
                            // Only re-render if data hasn't changed to avoid loops, 
                            // but here we just want to update styles.
                            // Check if we are visible?
                            window.renderMonteCarloChart(window.lastMonteCarloData);
                        }
                    }, 50);
                }
            });
        });

        // Watch both html and body for class changes
        observer.observe(document.documentElement, { attributes: true });
        observer.observe(document.body, { attributes: true });
        window.monteCarloThemeObserver = observer;
    }

    // Handle different response structures (results vs direct)
    const results = apiResponse.results || apiResponse;
    const simData = results.simulation_data || [];
    // Fix: Backend returns 'summary_statistics', not 'statistics'
    const stats = results.summary_statistics || results.statistics || {};

    if (results.error) {
        container.innerHTML = `<div class="text-center text-red-500 py-8">${results.error}</div>`;
        return;
    }

    if (!simData || simData.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">No simulation data available.</div>';
        return;
    }

    // 1. Detect Theme
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    const bgClass = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
    const textClass = isDark ? 'text-white' : 'text-gray-900';
    const subTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
    const redTextClass = isDark ? 'text-red-400' : 'text-red-600';

    // 2. Build Stats Summary HTML
    let statsHtml = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="${bgClass} p-3 rounded-lg border shadow-sm">
                <div class="text-xs ${subTextClass} uppercase">Exp. Return</div>
                <div class="text-lg font-bold ${textClass}">${formatPercent(stats.mean_return || stats.expected_return)}</div>
            </div>
            <div class="${bgClass} p-3 rounded-lg border shadow-sm">
                <div class="text-xs ${subTextClass} uppercase">VaR (95%)</div>
                <div class="text-lg font-bold ${redTextClass}">${formatCurrency(stats.value_at_risk_95 || stats.var_95 || stats.value_at_risk)}</div>
            </div>
            <div class="${bgClass} p-3 rounded-lg border shadow-sm">
                <div class="text-xs ${subTextClass} uppercase">Sharpe Ratio</div>
                <div class="text-lg font-bold ${textClass}">${formatNumber(stats.sharpe_ratio)}</div>
            </div>
            <div class="${bgClass} p-3 rounded-lg border shadow-sm">
                <div class="text-xs ${subTextClass} uppercase">Max Drawdown</div>
                <div class="text-lg font-bold ${redTextClass}">${formatPercent(stats.max_drawdown)}</div>
            </div>
        </div>
    `;

    // 3. Prepare Chart Container
    const chartContainer = `
        <div class="relative h-80 w-full ${bgClass} rounded-lg border p-2 shadow-sm">
            <canvas id="monteCarloChart"></canvas>
        </div>
        <div class="mt-4 text-xs ${subTextClass} text-center">
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

    // const isDark is already declared at top of function
    const simulationColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(107, 114, 128, 0.2)'; // More visible in dark
    const textColor = isDark ? '#e5e7eb' : '#374151'; // Gray-200 vs Gray-700
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    // Add individual simulation paths (thin)
    simData.forEach((path, index) => {
        if (index % step === 0) {
            datasets.push({
                label: `Sim ${index}`,
                data: path,
                borderColor: simulationColor,
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            });
        }
    });

    // Calculate Percentiles per day for Highlight Lines
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
        label: 'Best Case (90th)',
        data: p90,
        borderColor: '#10B981', // Emerald-500
        borderWidth: 2,
        pointRadius: 0,
        fill: false
    });

    datasets.push({
        label: 'Median Case',
        data: p50,
        borderColor: '#3B82F6', // Blue-500
        borderWidth: 3,
        pointRadius: 0,
        fill: false
    });

    datasets.push({
        label: 'Worst Case (10th)',
        data: p10,
        borderColor: '#EF4444', // Red-500
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
                        color: textColor,
                        filter: function (item, chart) {
                            return !item.text.startsWith('Sim');
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    titleColor: textColor,
                    bodyColor: textColor,
                    backgroundColor: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                    borderColor: gridColor,
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            if (context.dataset.label && !context.dataset.label.startsWith('Sim')) {
                                return `${context.dataset.label}: $${parseFloat(context.parsed.y).toLocaleString()}`;
                            }
                            return null;
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Portfolio Value ($)', color: textColor },
                    grid: { color: gridColor },
                    ticks: { color: textColor, callback: function (value) { return '$' + value.toLocaleString(); } }
                },
                x: {
                    title: { display: true, text: 'Forecast Days', color: textColor },
                    grid: { display: false },
                    ticks: { maxTicksLimit: 10, color: textColor }
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