// Sector Chart Visualization Module
class SectorCharts {
    constructor() {
        this.currentView = 'pie';
        this.currentData = null;
    }

    updateView(view, data) {
        this.currentView = view;
        this.currentData = data;
        this.renderChart();
    }

    renderChart() {
        const container = document.getElementById('sectorChartContainer');
        if (!container || !this.currentData) return;

        const sectorData = this.currentData.sector_allocation || {};

        switch (this.currentView) {
            case 'pie':
                this.renderPieChart(container, sectorData);
                break;
            case 'bar':
                this.renderBarChart(container, sectorData);
                break;
            case 'treemap':
                this.renderTreemap(container, sectorData);
                break;
        }
    }

    renderPieChart(container, sectorData) {
        const data = Object.entries(sectorData).map(([sector, info]) => ({
            name: sector,
            value: info.weight * 100
        }));

        // Use Chart.js for pie chart
        container.innerHTML = `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Sector Allocation - Pie Chart</h4>
                <div class="flex items-center justify-center">
                    <div style="width: 400px; height: 300px;">
                        <canvas id="sectorPieChart" width="400" height="300"></canvas>
                    </div>
                </div>
            </div>
        `;

        // Create Chart.js pie chart
        setTimeout(() => {
            const ctx = document.getElementById('sectorPieChart');
            if (ctx && window.Chart) {
                // Destroy existing chart if it exists
                const existingChart = Chart.getChart(ctx);
                if (existingChart) {
                    existingChart.destroy();
                }

                const isDark = document.documentElement.classList.contains('dark');
                const themeColors = {
                    text: isDark ? '#e5e7eb' : '#374151'
                };

                new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: data.map(item => item.name),
                        datasets: [{
                            data: data.map(item => item.value),
                            backgroundColor: data.map(item => this.getColor(item.name)),
                            borderWidth: 2,
                            borderColor: isDark ? '#1f2937' : '#fff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    usePointStyle: true,
                                    padding: 20,
                                    color: themeColors.text
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        return context.label + ': ' + context.parsed.toFixed(1) + '%';
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }, 100);
    }

    renderBarChart(container, sectorData) {
        const data = Object.entries(sectorData).map(([sector, info]) => ({
            name: sector,
            value: info.weight * 100
        })).sort((a, b) => b.value - a.value);

        // Use Chart.js for bar chart
        container.innerHTML = `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Sector Allocation - Bar Chart</h4>
                <div style="width: 100%; height: 400px;">
                    <canvas id="sectorBarChart" width="800" height="400"></canvas>
                </div>
            </div>
        `;

        // Create Chart.js bar chart
        setTimeout(() => {
            const ctx = document.getElementById('sectorBarChart');
            if (ctx && window.Chart) {
                // Destroy existing chart if it exists
                const existingChart = Chart.getChart(ctx);
                if (existingChart) {
                    existingChart.destroy();
                }

                const isDark = document.documentElement.classList.contains('dark');
                const themeColors = {
                    text: isDark ? '#e5e7eb' : '#374151',
                    grid: isDark ? '#374151' : '#e5e7eb'
                };

                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: data.map(item => item.name),
                        datasets: [{
                            label: 'Sector Weight (%)',
                            data: data.map(item => item.value),
                            backgroundColor: data.map(item => this.getColor(item.name)),
                            borderColor: data.map(item => this.getColor(item.name)),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                ticks: { color: themeColors.text },
                                grid: { color: themeColors.grid }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: themeColors.text,
                                    callback: function (value) {
                                        return value + '%';
                                    }
                                },
                                grid: { color: themeColors.grid }
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%';
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }, 100);
    }

    renderTreemap(container, sectorData) {
        const data = Object.entries(sectorData).map(([sector, info]) => ({
            name: sector,
            value: info.weight * 100,
            symbols: info.symbols || []
        }));

        // Use D3.js for treemap
        container.innerHTML = `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Sector Allocation - Treemap</h4>
                <div id="sectorTreemap" style="width: 100%; height: 400px;"></div>
            </div>
        `;

        // Create D3.js treemap
        setTimeout(() => {
            const treemapContainer = document.getElementById('sectorTreemap');
            if (treemapContainer && window.d3) {
                const width = treemapContainer.offsetWidth;
                const height = 400;

                const svg = d3.select('#sectorTreemap')
                    .append('svg')
                    .attr('width', width)
                    .attr('height', height);

                const root = d3.hierarchy({ children: data })
                    .sum(d => d.value)
                    .sort((a, b) => b.value - a.value);

                d3.treemap()
                    .size([width, height])
                    .padding(2)
                    (root);

                const leaf = svg.selectAll('g')
                    .data(root.leaves())
                    .enter().append('g')
                    .attr('transform', d => `translate(${d.x0},${d.y0})`);

                const isDark = document.documentElement.classList.contains('dark');

                leaf.append('rect')
                    .attr('width', d => d.x1 - d.x0)
                    .attr('height', d => d.y1 - d.y0)
                    .attr('fill', d => this.getColor(d.data.name))
                    .attr('stroke', isDark ? '#1f2937' : 'white')
                    .attr('stroke-width', 2);

                leaf.append('text')
                    .attr('x', 4)
                    .attr('y', 16)
                    .text(d => d.data.name)
                    .attr('font-size', '12px')
                    .attr('fill', 'white')
                    .attr('font-weight', 'bold');

                leaf.append('text')
                    .attr('x', 4)
                    .attr('y', 32)
                    .text(d => d.data.value.toFixed(1) + '%')
                    .attr('font-size', '14px')
                    .attr('fill', 'white')
                    .attr('font-weight', 'bold');
            }
        }, 100);
    }

    getColor(sector) {
        const colors = {
            // Technology sectors
            'Technology': '#3B82F6',
            'Software': '#1E40AF',

            // Financial sectors
            'Financials': '#10B981',
            'Financial': '#059669',
            'Financial Services': '#047857',

            // Healthcare
            'Healthcare': '#F59E0B',
            'Health Care': '#D97706',

            // Consumer sectors
            'Consumer Discretionary': '#EF4444',
            'Consumer Cyclical': '#DC2626',
            'Consumer Staples': '#84CC16',
            'Consumer Defensive': '#65A30D',

            // Communication
            'Communication Services': '#14B8A6',
            'Communication': '#0F766E',

            // Industrial
            'Industrials': '#06B6D4',
            'Industrial': '#0891B2',

            // Materials & Energy
            'Materials': '#8B5CF6',
            'Basic Materials': '#7C3AED',
            'Energy': '#F97316',

            // Utilities & Real Estate
            'Utilities': '#6366F1',
            'Real Estate': '#EC4899',

            // ETFs and Special
            'Broad Market ETF': '#F59E0B',
            'Technology ETF': '#3B82F6',
            'Financial ETF': '#10B981',
            'Healthcare ETF': '#F59E0B',
            'Energy ETF': '#F97316',
            'International ETF': '#8B5CF6',

            // Other
            'Other': '#6B7280',
            'Unknown': '#9CA3AF'
        };
        return colors[sector] || '#6B7280';
    }
}

// Global instance
window.sectorCharts = new SectorCharts();

// Update sector view function
window.updateSectorView = () => {
    const viewSelect = document.getElementById('sectorView');
    if (viewSelect && window.sectorCharts && window.sectorCharts.currentData) {
        window.sectorCharts.updateView(viewSelect.value, window.sectorCharts.currentData);

        // Update the analysis parameters display
        const viewParam = document.querySelector('[data-param="view"]');
        if (viewParam) {
            viewParam.textContent = viewSelect.options[viewSelect.selectedIndex].text;
        }
    }
};