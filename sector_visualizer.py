import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
from sector_mapper import SectorMapper

class SectorVisualizer:
    def __init__(self):
        self.mapper = SectorMapper()
        
    def create_pie_chart(self, portfolio_data, title="Sector Allocation"):
        """Create pie chart for sector allocation"""
        analysis = self.mapper.analyze_portfolio_sectors(portfolio_data)
        
        sectors = list(analysis['sectors'].keys())
        values = [analysis['sectors'][s]['value'] for s in sectors]
        
        fig = px.pie(values=values, names=sectors, title=title,
                    color_discrete_sequence=px.colors.qualitative.Set3)
        fig.update_traces(textposition='inside', textinfo='percent+label')
        return fig
    
    def create_bar_chart(self, portfolio_data, title="Sector Allocation"):
        """Create bar chart for sector allocation"""
        analysis = self.mapper.analyze_portfolio_sectors(portfolio_data)
        
        df = pd.DataFrame([
            {'Sector': k, 'Value': v['value'], 'Percentage': v['percentage']}
            for k, v in analysis['sectors'].items()
        ]).sort_values('Value', ascending=True)
        
        fig = px.bar(df, x='Value', y='Sector', orientation='h', title=title,
                    color='Percentage', color_continuous_scale='viridis')
        fig.update_layout(xaxis_title="Portfolio Value ($)", yaxis_title="Sector")
        return fig
    
    def create_treemap(self, portfolio_data, title="Portfolio Treemap"):
        """Create treemap for sector and industry allocation"""
        analysis = self.mapper.analyze_portfolio_sectors(portfolio_data)
        
        data = []
        for sector, sector_data in analysis['sectors'].items():
            for symbol in sector_data['symbols']:
                industry = self.mapper.get_industry(symbol)
                position = next((p for p in portfolio_data if p['symbol'].upper() == symbol), None)
                if position:
                    value = position.get('market_value', 0) or position.get('quantity', 0) * position.get('price', 0)
                    data.append({
                        'Sector': sector,
                        'Industry': industry,
                        'Symbol': symbol,
                        'Value': value
                    })
        
        df = pd.DataFrame(data)
        fig = px.treemap(df, path=['Sector', 'Industry', 'Symbol'], values='Value',
                        title=title, color='Value', color_continuous_scale='RdYlBu')
        return fig
    
    def create_dashboard(self, portfolio_data):
        """Create comprehensive dashboard with all chart types"""
        analysis = self.mapper.analyze_portfolio_sectors(portfolio_data)
        
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Sector Pie Chart', 'Industry Bar Chart', 'Country Distribution', 'Value Treemap'),
            specs=[[{"type": "pie"}, {"type": "bar"}],
                   [{"type": "pie"}, {"type": "treemap"}]]
        )
        
        # Pie chart - Sectors
        sectors = list(analysis['sectors'].keys())
        sector_values = [analysis['sectors'][s]['value'] for s in sectors]
        fig.add_trace(go.Pie(labels=sectors, values=sector_values, name="Sectors"), row=1, col=1)
        
        # Bar chart - Top Industries
        industries = sorted(analysis['industries'].items(), key=lambda x: x[1]['value'], reverse=True)[:10]
        industry_names = [i[0] for i in industries]
        industry_values = [i[1]['value'] for i in industries]
        fig.add_trace(go.Bar(x=industry_values, y=industry_names, orientation='h', name="Industries"), row=1, col=2)
        
        # Pie chart - Countries
        countries = list(analysis['countries'].keys())
        country_values = [analysis['countries'][c]['value'] for c in countries]
        fig.add_trace(go.Pie(labels=countries, values=country_values, name="Countries"), row=2, col=1)
        
        fig.update_layout(height=800, title_text="Portfolio Analysis Dashboard")
        return fig

def test_visualizations():
    """Test all visualization types"""
    # Sample portfolio
    portfolio = [
        {'symbol': 'AAPL', 'quantity': 100, 'price': 150.0},
        {'symbol': 'MSFT', 'quantity': 50, 'price': 300.0},
        {'symbol': 'GOOGL', 'quantity': 25, 'price': 2500.0},
        {'symbol': 'TSLA', 'quantity': 30, 'price': 200.0},
        {'symbol': 'JPM', 'quantity': 40, 'price': 140.0}
    ]
    
    viz = SectorVisualizer()
    
    # Create charts
    pie_fig = viz.create_pie_chart(portfolio)
    bar_fig = viz.create_bar_chart(portfolio)
    treemap_fig = viz.create_treemap(portfolio)
    dashboard_fig = viz.create_dashboard(portfolio)
    
    # Save as HTML files
    pie_fig.write_html("sector_pie_chart.html")
    bar_fig.write_html("sector_bar_chart.html")
    treemap_fig.write_html("sector_treemap.html")
    dashboard_fig.write_html("portfolio_dashboard.html")
    
    print("Charts created successfully!")
    print("Files: sector_pie_chart.html, sector_bar_chart.html, sector_treemap.html, portfolio_dashboard.html")

if __name__ == "__main__":
    test_visualizations()