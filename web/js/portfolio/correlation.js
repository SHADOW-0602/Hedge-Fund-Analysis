// Correlation Analysis
function loadCorrelationAnalysis(portfolioData) {
    const container = document.getElementById('correlationResults');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4 text-blue-600"><div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>Calculating correlations...</div>';
    
    // Get current settings
    const options = {
        period: document.getElementById('correlationPeriod')?.value || '1Y',
        frequency: document.getElementById('correlationFrequency')?.value || 'daily',
        method: document.getElementById('correlationMethod')?.value || 'pearson',
        rolling_window: parseInt(document.getElementById('correlationRollingWindow')?.value || '252'),
        heatmap_style: document.getElementById('correlationHeatmapStyle')?.value || 'color_intensity'
    };
    
    // Call API with interactive parameters
    fetch(`${API_BASE}/correlation-analysis`, {
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
        if (data.success && data.correlation_matrix) {
            displayCorrelationResults(data, container);
        } else {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>Unable to calculate correlations</p>
                    <p class="text-sm mt-2">${data.error || 'Please check your portfolio data'}</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Correlation analysis error:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <p>Error calculating correlations</p>
                <p class="text-sm mt-2">Please try again later</p>
            </div>
        `;
    });
}

function displayCorrelationResults(data, container) {
    const matrix = data.correlation_matrix;
    const summary = data.summary;
    const symbols = Object.keys(matrix);
    
    if (symbols.length < 2) {
        container.innerHTML = '<div class="text-center py-8 text-gray-500">Need at least 2 symbols for correlation analysis</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Summary Statistics -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-blue-900 mb-2">Average Correlation</h4>
                    <div class="text-2xl font-bold text-blue-700">
                        ${summary.average_correlation.toFixed(3)}
                    </div>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-green-900 mb-2">Max Correlation</h4>
                    <div class="text-2xl font-bold text-green-700">
                        ${summary.max_correlation.toFixed(3)}
                    </div>
                </div>
                <div class="bg-red-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-red-900 mb-2">Min Correlation</h4>
                    <div class="text-2xl font-bold text-red-700">
                        ${summary.min_correlation.toFixed(3)}
                    </div>
                </div>
            </div>
            
            <!-- Advanced Correlation Heatmap -->
            <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">Correlation Matrix</h4>
                <div id="correlationHeatmap" style="width: 100%; height: 600px;"></div>
            </div>
            
            <!-- Analysis Parameters -->
            <div class="bg-gray-50 p-3 rounded-lg">
                <div class="text-xs text-gray-600 space-y-1">
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div><strong>Method:</strong> ${summary.method}</div>
                        <div><strong>Period:</strong> ${summary.period}</div>
                        <div><strong>Frequency:</strong> ${summary.frequency}</div>
                        <div><strong>Rolling Window:</strong> ${summary.rolling_window}d</div>
                        <div><strong>Style:</strong> ${summary.heatmap_style}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Create advanced Plotly heatmap
    setTimeout(() => createAdvancedCorrelationHeatmap(matrix, symbols), 100);
}

function createAdvancedCorrelationHeatmap(matrix, symbols) {
    // Prepare data for Plotly heatmap
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
                    size: Math.max(8, Math.min(12, 400 / symbols.length))
                }
            });
        });
        z.push(row);
    });
    
    // Create professional heatmap with custom colorscale
    const trace = {
        z: z,
        x: symbols,
        y: symbols,
        type: 'heatmap',
        colorscale: [
            [0, '#d73027'],    // Strong negative - red
            [0.1, '#f46d43'],  // Negative - orange-red
            [0.2, '#fdae61'],  // Weak negative - orange
            [0.3, '#fee08b'],  // Very weak negative - yellow
            [0.4, '#ffffbf'],  // Near zero - light yellow
            [0.5, '#ffffff'],  // Zero - white
            [0.6, '#e0f3f8'],  // Very weak positive - light blue
            [0.7, '#abd9e9'],  // Weak positive - blue
            [0.8, '#74add1'],  // Positive - medium blue
            [0.9, '#4575b4'],  // Strong positive - dark blue
            [1, '#313695']     // Very strong positive - navy
        ],
        zmin: -1,
        zmax: 1,
        showscale: true,
        colorbar: {
            title: 'Correlation',
            titleside: 'right',
            thickness: 15,
            len: 0.7,
            tickmode: 'array',
            tickvals: [-1, -0.5, 0, 0.5, 1],
            ticktext: ['-1.0', '-0.5', '0.0', '0.5', '1.0']
        },
        hoverongaps: false,
        hovertemplate: '<b>%{y}</b> vs <b>%{x}</b><br>Correlation: %{z:.3f}<extra></extra>'
    };
    
    const layout = {
        title: {
            text: 'Portfolio Correlation Matrix',
            font: { size: 16, color: '#374151' }
        },
        xaxis: {
            title: '',
            tickangle: -45,
            side: 'bottom',
            tickfont: { size: 10, color: '#6b7280' },
            showgrid: false
        },
        yaxis: {
            title: '',
            tickfont: { size: 10, color: '#6b7280' },
            showgrid: false,
            autorange: 'reversed'
        },
        annotations: annotations,
        margin: { l: 80, r: 80, t: 60, b: 100 },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        font: { family: 'Inter, system-ui, sans-serif' }
    };
    
    const config = {
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false,
        toImageButtonOptions: {
            format: 'png',
            filename: 'correlation_matrix',
            height: 600,
            width: 800,
            scale: 2
        }
    };
    
    // Create the plot
    Plotly.newPlot('correlationHeatmap', [trace], layout, config);
}

// Toggle correlation settings panel
function toggleCorrelationSettings() {
    const settings = document.getElementById('correlationSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
}

// Update correlation analysis with new parameters
function updateCorrelationAnalysis() {
    const portfolioData = window.currentPortfolioData;
    if (portfolioData && portfolioData.length > 0) {
        loadCorrelationAnalysis(portfolioData);
    } else {
        console.warn('No portfolio data available for correlation analysis update');
    }
}

// Export correlation matrix as image
function exportCorrelationMatrix() {
    const element = document.getElementById('correlationHeatmap');
    if (element && element._fullLayout) {
        Plotly.downloadImage('correlationHeatmap', {
            format: 'png',
            width: 1200,
            height: 800,
            filename: 'portfolio_correlation_matrix'
        });
    }
}

window.loadCorrelationAnalysis = loadCorrelationAnalysis;
window.toggleCorrelationSettings = toggleCorrelationSettings;
window.updateCorrelationAnalysis = updateCorrelationAnalysis;
window.exportCorrelationMatrix = exportCorrelationMatrix;