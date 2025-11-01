// Statistical Analysis
function loadStatisticalAnalysis(portfolioData) {
    const container = document.getElementById('statisticalAnalysis');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Calculating statistical metrics...</div>';
    
    // Get current settings
    const options = {
        lookback_period: document.getElementById('statisticalLookback')?.value || '1Y',
        frequency: document.getElementById('statisticalFrequency')?.value || 'Daily',
        benchmark: document.getElementById('statisticalBenchmark')?.value || 'SPY',
        confidence_level: document.getElementById('statisticalConfidence')?.value || '95',
        metrics: getSelectedMetrics()
    };
    
    // Call API with interactive parameters
    fetch(`${API_BASE}/statistical-analysis`, {
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
        if (data.success && data.statistics) {
            displayStatisticalResults(data.statistics, container, options);
        } else {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>Unable to calculate statistical metrics</p>
                    <p class="text-sm mt-2">${data.error || 'Please check your portfolio data'}</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Statistical analysis error:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <p>Error calculating statistical metrics</p>
                <p class="text-sm mt-2">Please try again later</p>
            </div>
        `;
    });
}

function getSelectedMetrics() {
    const metrics = [];
    if (document.getElementById('metricCorrelation')?.checked) metrics.push('Correlation');
    if (document.getElementById('metricBeta')?.checked) metrics.push('Beta');
    if (document.getElementById('metricAlpha')?.checked) metrics.push('Alpha');
    if (document.getElementById('metricRSquared')?.checked) metrics.push('R-squared');
    return metrics;
}

function displayStatisticalResults(statistics, container, options) {
    const portfolioStats = statistics.portfolio_statistics || {};
    const individualStats = statistics.individual_statistics || {};
    const correlationAnalysis = statistics.correlation_analysis || {};
    const riskMetrics = statistics.risk_metrics || {};
    const performanceMetrics = statistics.performance_metrics || {};
    const summary = statistics.summary || {};
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Portfolio-Level Statistics -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">Portfolio Statistics vs ${options.benchmark}</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    ${options.metrics.includes('Correlation') ? `
                        <div class="bg-blue-50 p-3 rounded-lg">
                            <h5 class="font-medium text-blue-900 mb-1">Correlation</h5>
                            <div class="text-xl font-bold text-blue-700">
                                ${portfolioStats.benchmark_correlation ? portfolioStats.benchmark_correlation.toFixed(3) : 'N/A'}
                            </div>
                        </div>
                    ` : ''}
                    ${options.metrics.includes('Beta') ? `
                        <div class="bg-green-50 p-3 rounded-lg">
                            <h5 class="font-medium text-green-900 mb-1">Beta</h5>
                            <div class="text-xl font-bold text-green-700">
                                ${portfolioStats.beta ? portfolioStats.beta.toFixed(3) : 'N/A'}
                            </div>
                        </div>
                    ` : ''}
                    ${options.metrics.includes('Alpha') ? `
                        <div class="bg-purple-50 p-3 rounded-lg">
                            <h5 class="font-medium text-purple-900 mb-1">Alpha</h5>
                            <div class="text-xl font-bold text-purple-700">
                                ${portfolioStats.alpha ? (portfolioStats.alpha * 100).toFixed(2) + '%' : 'N/A'}
                            </div>
                        </div>
                    ` : ''}
                    ${options.metrics.includes('R-squared') ? `
                        <div class="bg-orange-50 p-3 rounded-lg">
                            <h5 class="font-medium text-orange-900 mb-1">R-squared</h5>
                            <div class="text-xl font-bold text-orange-700">
                                ${portfolioStats.r_squared ? portfolioStats.r_squared.toFixed(3) : 'N/A'}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Risk Metrics -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">Risk Metrics</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="bg-red-50 p-3 rounded-lg">
                        <h5 class="font-medium text-red-900 mb-1">Portfolio Volatility</h5>
                        <div class="text-xl font-bold text-red-700">
                            ${riskMetrics.portfolio_volatility ? (riskMetrics.portfolio_volatility * 100).toFixed(2) + '%' : 'N/A'}
                        </div>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <h5 class="font-medium text-gray-900 mb-1">Benchmark Volatility</h5>
                        <div class="text-xl font-bold text-gray-700">
                            ${riskMetrics.benchmark_volatility ? (riskMetrics.benchmark_volatility * 100).toFixed(2) + '%' : 'N/A'}
                        </div>
                    </div>
                    <div class="bg-yellow-50 p-3 rounded-lg">
                        <h5 class="font-medium text-yellow-900 mb-1">Tracking Error</h5>
                        <div class="text-xl font-bold text-yellow-700">
                            ${riskMetrics.tracking_error ? (riskMetrics.tracking_error * 100).toFixed(2) + '%' : 'N/A'}
                        </div>
                    </div>
                    <div class="bg-indigo-50 p-3 rounded-lg">
                        <h5 class="font-medium text-indigo-900 mb-1">Information Ratio</h5>
                        <div class="text-xl font-bold text-indigo-700">
                            ${riskMetrics.information_ratio ? riskMetrics.information_ratio.toFixed(3) : 'N/A'}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Performance Metrics with Confidence Intervals -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">Performance Metrics (${options.confidence_level}% Confidence)</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div class="bg-green-50 p-3 rounded-lg">
                        <h5 class="font-medium text-green-900 mb-1">Annualized Return</h5>
                        <div class="text-xl font-bold text-green-700">
                            ${performanceMetrics.annualized_return ? (performanceMetrics.annualized_return * 100).toFixed(2) + '%' : 'N/A'}
                        </div>
                        <div class="text-xs text-green-600 mt-1">
                            CI: [${performanceMetrics.confidence_interval_lower ? (performanceMetrics.confidence_interval_lower * 100).toFixed(1) : 'N/A'}%, 
                            ${performanceMetrics.confidence_interval_upper ? (performanceMetrics.confidence_interval_upper * 100).toFixed(1) : 'N/A'}%]
                        </div>
                    </div>
                    <div class="bg-blue-50 p-3 rounded-lg">
                        <h5 class="font-medium text-blue-900 mb-1">Annualized Volatility</h5>
                        <div class="text-xl font-bold text-blue-700">
                            ${performanceMetrics.annualized_volatility ? (performanceMetrics.annualized_volatility * 100).toFixed(2) + '%' : 'N/A'}
                        </div>
                    </div>
                    <div class="bg-purple-50 p-3 rounded-lg">
                        <h5 class="font-medium text-purple-900 mb-1">Sharpe Ratio</h5>
                        <div class="text-xl font-bold text-purple-700">
                            ${performanceMetrics.sharpe_ratio ? performanceMetrics.sharpe_ratio.toFixed(3) : 'N/A'}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Individual Stock Statistics -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">Individual Stock Statistics</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                                ${options.metrics.includes('Correlation') ? '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correlation</th>' : ''}
                                ${options.metrics.includes('Beta') ? '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beta</th>' : ''}
                                ${options.metrics.includes('Alpha') ? '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alpha</th>' : ''}
                                ${options.metrics.includes('R-squared') ? '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">R-squared</th>' : ''}
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${Object.entries(individualStats).map(([symbol, stats]) => `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${symbol}</td>
                                    ${options.metrics.includes('Correlation') ? `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${stats.benchmark_correlation ? stats.benchmark_correlation.toFixed(3) : 'N/A'}</td>` : ''}
                                    ${options.metrics.includes('Beta') ? `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${stats.beta ? stats.beta.toFixed(3) : 'N/A'}</td>` : ''}
                                    ${options.metrics.includes('Alpha') ? `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${stats.alpha ? (stats.alpha * 100).toFixed(2) + '%' : 'N/A'}</td>` : ''}
                                    ${options.metrics.includes('R-squared') ? `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${stats.r_squared ? stats.r_squared.toFixed(3) : 'N/A'}</td>` : ''}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Correlation Matrix Visualization -->
            ${options.metrics.includes('Correlation') && correlationAnalysis.matrix ? `
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="font-semibold text-gray-900 mb-3">Portfolio Correlation Matrix</h4>
                    <div id="correlationHeatmapStats" style="width: 100%; height: 400px;"></div>
                    <div class="mt-2 text-sm text-gray-600">
                        Average Correlation: ${correlationAnalysis.average_correlation ? correlationAnalysis.average_correlation.toFixed(3) : 'N/A'}
                    </div>
                </div>
            ` : ''}
            
            <!-- Analysis Parameters -->
            <div class="bg-gray-50 p-3 rounded-lg">
                <div class="text-xs text-gray-600 space-y-1">
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div><strong>Period:</strong> ${summary.lookback_period}</div>
                        <div><strong>Frequency:</strong> ${summary.frequency}</div>
                        <div><strong>Benchmark:</strong> ${summary.benchmark}</div>
                        <div><strong>Confidence:</strong> ${summary.confidence_level}%</div>
                        <div><strong>Data Points:</strong> ${summary.data_points}</div>
                    </div>
                    <div><strong>Metrics:</strong> ${summary.metrics_calculated ? summary.metrics_calculated.join(', ') : 'N/A'}</div>
                </div>
            </div>
        </div>
    `;
    
    // Create correlation heatmap if available
    if (options.metrics.includes('Correlation') && correlationAnalysis.matrix) {
        setTimeout(() => createCorrelationHeatmapStats(correlationAnalysis.matrix), 100);
    }
}

function createCorrelationHeatmapStats(matrix) {
    const symbols = Object.keys(matrix);
    const z = [];
    const annotations = [];
    
    // Build correlation matrix data
    symbols.forEach((symbol1, i) => {
        const row = [];
        symbols.forEach((symbol2, j) => {
            const corr = matrix[symbol1][symbol2];
            row.push(corr);
            
            // Add text annotations
            annotations.push({
                x: j,
                y: i,
                text: corr.toFixed(2),
                showarrow: false,
                font: {
                    color: Math.abs(corr) > 0.5 ? 'white' : 'black',
                    size: Math.max(8, Math.min(12, 300 / symbols.length))
                }
            });
        });
        z.push(row);
    });
    
    const trace = {
        z: z,
        x: symbols,
        y: symbols,
        type: 'heatmap',
        colorscale: [
            [0, '#d73027'], [0.1, '#f46d43'], [0.2, '#fdae61'], [0.3, '#fee08b'],
            [0.4, '#ffffbf'], [0.5, '#ffffff'], [0.6, '#e0f3f8'], [0.7, '#abd9e9'],
            [0.8, '#74add1'], [0.9, '#4575b4'], [1, '#313695']
        ],
        zmin: -1,
        zmax: 1,
        showscale: true,
        colorbar: {
            title: 'Correlation',
            titleside: 'right',
            thickness: 15,
            len: 0.7
        },
        hovertemplate: '<b>%{y}</b> vs <b>%{x}</b><br>Correlation: %{z:.3f}<extra></extra>'
    };
    
    const layout = {
        title: {
            text: 'Portfolio Correlation Matrix',
            font: { size: 14, color: '#374151' }
        },
        xaxis: {
            title: '',
            tickangle: -45,
            tickfont: { size: 10 }
        },
        yaxis: {
            title: '',
            tickfont: { size: 10 },
            autorange: 'reversed'
        },
        annotations: annotations,
        margin: { l: 60, r: 60, t: 40, b: 80 },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white'
    };
    
    const config = {
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
    };
    
    Plotly.newPlot('correlationHeatmapStats', [trace], layout, config);
}

// Toggle statistical settings panel
function toggleStatisticalSettings() {
    const settings = document.getElementById('statisticalSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update statistical analysis with new parameters
function updateStatisticalAnalysis() {
    const portfolioData = window.currentPortfolioData;
    if (portfolioData && portfolioData.length > 0) {
        loadStatisticalAnalysis(portfolioData);
    } else {
        console.warn('No portfolio data available for statistical analysis update');
    }
}

// Export functions to global scope
window.loadStatisticalAnalysis = loadStatisticalAnalysis;
window.toggleStatisticalSettings = toggleStatisticalSettings;
window.updateStatisticalAnalysis = updateStatisticalAnalysis;