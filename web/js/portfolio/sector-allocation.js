// Sector Allocation Analysis
function loadSectorAllocation(portfolioData) {
    const container = document.getElementById('sectorAllocation');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Analyzing sector allocation...</div>';
    
    // Get current settings
    const options = {
        classification: document.getElementById('sectorClassification')?.value || 'GICS',
        level: document.getElementById('sectorLevel')?.value || 'Sector',
        benchmark: document.getElementById('sectorBenchmark')?.value || 'SPY',
        view: document.getElementById('sectorView')?.value || 'Pie Chart',
        threshold: document.getElementById('sectorThreshold')?.value || '1'
    };
    
    // Call API with interactive parameters
    fetch('/api/sector-allocation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            portfolio: portfolioData,
            options: options
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.allocation) {
            displaySectorResults(data.allocation, container, options);
        } else {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>Unable to analyze sector allocation</p>
                    <p class="text-sm mt-2">${data.error || 'Please check your portfolio data'}</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Sector allocation error:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <p>Error analyzing sector allocation</p>
                <p class="text-sm mt-2">Please try again later</p>
            </div>
        `;
    });
}

function displaySectorResults(allocation, container, options) {
    const filtered = allocation.filtered_allocation || {};
    const summary = allocation.summary || {};
    const diversification = allocation.diversification_metrics || {};
    const benchmark = allocation.benchmark_comparison || {};
    
    if (Object.keys(filtered).length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-500">No sectors meet the threshold criteria</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Summary Statistics -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-blue-900 mb-2">Total ${options.level}s</h4>
                    <div class="text-2xl font-bold text-blue-700">
                        ${summary.total_sectors || 0}
                    </div>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-green-900 mb-2">Above Threshold</h4>
                    <div class="text-2xl font-bold text-green-700">
                        ${summary.above_threshold || 0}
                    </div>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-purple-900 mb-2">Effective ${options.level}s</h4>
                    <div class="text-2xl font-bold text-purple-700">
                        ${diversification.effective_sectors ? diversification.effective_sectors.toFixed(1) : 'N/A'}
                    </div>
                </div>
                <div class="bg-orange-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-orange-900 mb-2">Concentration</h4>
                    <div class="text-2xl font-bold text-orange-700">
                        ${diversification.concentration_ratio ? (diversification.concentration_ratio * 100).toFixed(1) + '%' : 'N/A'}
                    </div>
                </div>
            </div>
            
            <!-- Sector Allocation Chart -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">${options.level} Allocation (${options.view})</h4>
                <div id="sectorChart" style="width: 100%; height: 400px;"></div>
            </div>
            
            <!-- Benchmark Comparison -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">Benchmark Comparison (${benchmark.name || options.benchmark})</h4>
                <div id="benchmarkComparison"></div>
            </div>
            
            <!-- Detailed Breakdown -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">Detailed ${options.level} Breakdown</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${options.level}</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbols</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${Object.entries(filtered).map(([sector, data]) => `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${sector}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${(data.weight * 100).toFixed(2)}%</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$${data.value ? data.value.toLocaleString() : 'N/A'}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${data.symbols ? data.symbols.join(', ') : 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Analysis Parameters -->
            <div class="bg-gray-50 p-3 rounded-lg">
                <div class="text-xs text-gray-600 space-y-1">
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div><strong>Classification:</strong> ${options.classification}</div>
                        <div><strong>Level:</strong> ${options.level}</div>
                        <div><strong>Benchmark:</strong> ${options.benchmark}</div>
                        <div><strong>View:</strong> ${options.view}</div>
                        <div><strong>Threshold:</strong> >${options.threshold}%</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Create sector allocation chart
    setTimeout(() => createSectorChart(filtered, options), 100);
    
    // Create benchmark comparison
    setTimeout(() => createBenchmarkComparison(filtered, benchmark), 200);
}

function createSectorChart(allocation, options) {
    const chartData = prepareChartData(allocation, options.view);
    
    if (options.view === 'Pie Chart') {
        createPieChart(chartData);
    } else if (options.view === 'Bar Chart') {
        createBarChart(chartData);
    } else if (options.view === 'Treemap') {
        createTreemapChart(chartData);
    }
}

function prepareChartData(allocation, viewType) {
    const labels = Object.keys(allocation);
    const values = Object.values(allocation).map(data => data.weight * 100);
    const colors = getSectorColors(labels);
    
    return {
        labels: labels,
        values: values,
        colors: colors,
        symbols: Object.values(allocation).map(data => data.symbols || [])
    };
}

function createPieChart(chartData) {
    const trace = {
        type: 'pie',
        labels: chartData.labels,
        values: chartData.values,
        marker: {
            colors: chartData.colors
        },
        textinfo: 'label+percent',
        textposition: 'auto',
        hovertemplate: '<b>%{label}</b><br>Weight: %{percent}<br>Symbols: %{customdata}<extra></extra>',
        customdata: chartData.symbols.map(symbols => symbols.join(', '))
    };
    
    const layout = {
        title: {
            text: 'Portfolio Sector Allocation',
            font: { size: 16, color: '#374151' }
        },
        showlegend: true,
        legend: {
            orientation: 'v',
            x: 1.02,
            y: 0.5
        },
        margin: { l: 50, r: 150, t: 50, b: 50 },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white'
    };
    
    const config = {
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
    };
    
    Plotly.newPlot('sectorChart', [trace], layout, config);
}

function createBarChart(chartData) {
    const trace = {
        type: 'bar',
        x: chartData.labels,
        y: chartData.values,
        marker: {
            color: chartData.colors
        },
        text: chartData.values.map(v => v.toFixed(1) + '%'),
        textposition: 'auto',
        hovertemplate: '<b>%{x}</b><br>Weight: %{y:.1f}%<br>Symbols: %{customdata}<extra></extra>',
        customdata: chartData.symbols.map(symbols => symbols.join(', '))
    };
    
    const layout = {
        title: {
            text: 'Portfolio Sector Allocation',
            font: { size: 16, color: '#374151' }
        },
        xaxis: {
            title: 'Sectors',
            tickangle: -45
        },
        yaxis: {
            title: 'Weight (%)',
            tickformat: '.1f'
        },
        margin: { l: 60, r: 50, t: 60, b: 100 },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white'
    };
    
    const config = {
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
    };
    
    Plotly.newPlot('sectorChart', [trace], layout, config);
}

function createTreemapChart(chartData) {
    const trace = {
        type: 'treemap',
        labels: chartData.labels,
        values: chartData.values,
        parents: Array(chartData.labels.length).fill(''),
        textinfo: 'label+value+percent parent',
        marker: {
            colors: chartData.colors
        },
        hovertemplate: '<b>%{label}</b><br>Weight: %{value:.1f}%<br>Symbols: %{customdata}<extra></extra>',
        customdata: chartData.symbols.map(symbols => symbols.join(', '))
    };
    
    const layout = {
        title: {
            text: 'Portfolio Sector Allocation (Treemap)',
            font: { size: 16, color: '#374151' }
        },
        margin: { l: 50, r: 50, t: 50, b: 50 },
        paper_bgcolor: 'white'
    };
    
    const config = {
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
    };
    
    Plotly.newPlot('sectorChart', [trace], layout, config);
}

function createBenchmarkComparison(portfolioAllocation, benchmark) {
    const container = document.getElementById('benchmarkComparison');
    if (!container) return;
    
    const benchmarkWeights = benchmark.sector_weights || {};
    const portfolioSectors = Object.keys(portfolioAllocation);
    const benchmarkSectors = Object.keys(benchmarkWeights);
    const allSectors = [...new Set([...portfolioSectors, ...benchmarkSectors])];
    
    const comparisonData = allSectors.map(sector => {
        const portfolioWeight = (portfolioAllocation[sector]?.weight || 0) * 100;
        const benchmarkWeight = (benchmarkWeights[sector] || 0) * 100;
        const difference = portfolioWeight - benchmarkWeight;
        
        return {
            sector: sector,
            portfolio: portfolioWeight,
            benchmark: benchmarkWeight,
            difference: difference
        };
    }).filter(item => item.portfolio > 0 || item.benchmark > 0);
    
    if (comparisonData.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-gray-500">No benchmark comparison data available</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sector</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Portfolio</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Benchmark</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difference</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${comparisonData.map(item => `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.sector}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.portfolio.toFixed(2)}%</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.benchmark.toFixed(2)}%</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm ${item.difference >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${item.difference >= 0 ? '+' : ''}${item.difference.toFixed(2)}%
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getSectorColors(sectors) {
    const colorMap = {
        'Technology': '#1f77b4',
        'Healthcare': '#ff7f0e',
        'Financials': '#2ca02c',
        'Consumer Discretionary': '#d62728',
        'Communication Services': '#9467bd',
        'Industrials': '#8c564b',
        'Consumer Staples': '#e377c2',
        'Energy': '#7f7f7f',
        'Utilities': '#bcbd22',
        'Real Estate': '#17becf',
        'Materials': '#ff9896',
        'Unknown': '#cccccc'
    };
    
    return sectors.map(sector => colorMap[sector] || '#cccccc');
}

// Toggle sector settings panel
function toggleSectorSettings() {
    const settings = document.getElementById('sectorSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update sector allocation with new parameters
function updateSectorAllocation() {
    const portfolioData = window.currentPortfolioData;
    if (portfolioData && portfolioData.length > 0) {
        loadSectorAllocation(portfolioData);
    } else {
        console.warn('No portfolio data available for sector allocation update');
    }
}

// Export functions to global scope
window.loadSectorAllocation = loadSectorAllocation;
window.toggleSectorSettings = toggleSectorSettings;
window.updateSectorAllocation = updateSectorAllocation;