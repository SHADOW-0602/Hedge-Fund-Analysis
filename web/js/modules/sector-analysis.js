/**
 * Sector Analysis Module
 * Provides sector allocation and analysis functionality
 */

class SectorAnalysis {
    constructor() {
        this.baseUrl = '/api/sector';
    }

    /**
     * Get sector information for a symbol
     */
    async getSectorInfo(symbol) {
        try {
            const response = await fetch(`${this.baseUrl}/lookup/${symbol}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching sector info:', error);
            throw error;
        }
    }

    /**
     * Analyze portfolio sector allocation
     */
    async analyzePortfolio(portfolioData) {
        try {
            const response = await fetch(`${this.baseUrl}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ portfolio: portfolioData })
            });
            return await response.json();
        } catch (error) {
            console.error('Error analyzing portfolio sectors:', error);
            throw error;
        }
    }

    /**
     * Get available sectors
     */
    async getAvailableSectors() {
        try {
            const response = await fetch(`${this.baseUrl}/available`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching available sectors:', error);
            throw error;
        }
    }

    /**
     * Create sector allocation chart
     */
    createSectorChart(containerId, sectorData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Create chart container
        const chartDiv = document.createElement('div');
        chartDiv.className = 'sector-chart';
        
        // Sort sectors by value
        const sortedSectors = Object.entries(sectorData)
            .sort(([,a], [,b]) => b.value - a.value);

        // Create bars
        sortedSectors.forEach(([sector, data]) => {
            const barContainer = document.createElement('div');
            barContainer.className = 'sector-bar-container';
            
            const label = document.createElement('div');
            label.className = 'sector-label';
            label.textContent = `${sector} (${data.percentage.toFixed(1)}%)`;
            
            const bar = document.createElement('div');
            bar.className = 'sector-bar';
            bar.style.width = `${data.percentage}%`;
            bar.style.backgroundColor = this.getSectorColor(sector);
            
            const value = document.createElement('div');
            value.className = 'sector-value';
            value.textContent = `$${data.value.toLocaleString()}`;
            
            barContainer.appendChild(label);
            barContainer.appendChild(bar);
            barContainer.appendChild(value);
            chartDiv.appendChild(barContainer);
        });

        container.appendChild(chartDiv);
    }

    /**
     * Get color for sector
     */
    getSectorColor(sector) {
        const colors = {
            'Technology': '#4CAF50',
            'Healthcare': '#2196F3',
            'Financial': '#FF9800',
            'Consumer Cyclical': '#9C27B0',
            'Communication Services': '#F44336',
            'Industrials': '#607D8B',
            'Consumer Staples': '#795548',
            'Energy': '#FF5722',
            'Utilities': '#009688',
            'Real Estate': '#3F51B5',
            'Materials': '#8BC34A'
        };
        return colors[sector] || '#757575';
    }

    /**
     * Display sector analysis results
     */
    displayAnalysis(containerId, analysisData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="sector-analysis-results">
                <h3>Portfolio Sector Analysis</h3>
                
                <div class="analysis-summary">
                    <div class="metric">
                        <label>Total Value:</label>
                        <span>$${analysisData.total_value.toLocaleString()}</span>
                    </div>
                    <div class="metric">
                        <label>Number of Sectors:</label>
                        <span>${Object.keys(analysisData.sectors).length}</span>
                    </div>
                </div>

                <div class="sector-breakdown">
                    <h4>Sector Allocation</h4>
                    <div id="sector-chart-${containerId}"></div>
                </div>

                <div class="top-industries">
                    <h4>Top Industries</h4>
                    <div id="industry-list-${containerId}"></div>
                </div>
            </div>
        `;

        // Create sector chart
        this.createSectorChart(`sector-chart-${containerId}`, analysisData.sectors);
        
        // Display top industries
        this.displayTopIndustries(`industry-list-${containerId}`, analysisData.industries);
    }

    /**
     * Display top industries
     */
    displayTopIndustries(containerId, industryData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const sortedIndustries = Object.entries(industryData)
            .sort(([,a], [,b]) => b.value - a.value)
            .slice(0, 5);

        const listHtml = sortedIndustries.map(([industry, data]) => `
            <div class="industry-item">
                <span class="industry-name">${industry}</span>
                <span class="industry-percentage">${data.percentage.toFixed(1)}%</span>
                <span class="industry-value">$${data.value.toLocaleString()}</span>
            </div>
        `).join('');

        container.innerHTML = listHtml;
    }

    /**
     * Create interactive visualization
     */
    async createVisualization(containerId, portfolioData, chartType = 'pie') {
        try {
            const response = await fetch(`${this.baseUrl}/visualize/${chartType}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portfolio: portfolioData })
            });
            
            const result = await response.json();
            if (result.success) {
                Plotly.newPlot(containerId, result.chart_data.data, result.chart_data.layout);
            }
        } catch (error) {
            console.error('Error creating visualization:', error);
        }
    }

    /**
     * Create chart selector interface
     */
    createChartSelector(containerId, portfolioData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="chart-controls">
                <button onclick="sectorAnalysis.createVisualization('${containerId}-chart', portfolioData, 'pie')">Pie Chart</button>
                <button onclick="sectorAnalysis.createVisualization('${containerId}-chart', portfolioData, 'bar')">Bar Chart</button>
                <button onclick="sectorAnalysis.createVisualization('${containerId}-chart', portfolioData, 'treemap')">Treemap</button>
                <button onclick="sectorAnalysis.createVisualization('${containerId}-chart', portfolioData, 'dashboard')">Dashboard</button>
            </div>
            <div id="${containerId}-chart" style="width:100%;height:500px;"></div>
        `;
        
        // Create default pie chart
        this.createVisualization(`${containerId}-chart`, portfolioData, 'pie');
    }
}

// Export for use in other modules
window.SectorAnalysis = SectorAnalysis;