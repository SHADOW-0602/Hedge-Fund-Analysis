import pandas as pd
import numpy as np
from typing import Dict, List
import sys
import os
sys.path.append('src')
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from sector_mapper import SectorMapper
try:
    from clients.market_data_client import MarketDataClient
except ImportError:
    sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
    from clients.market_data_client import MarketDataClient

class BenchmarkAnalyzer:
    def __init__(self):
        self.client = MarketDataClient()
        self.sector_mapper = SectorMapper()
        self.benchmarks = {
            'S&P 500': 'SPY',
            'Russell 3000': 'IWV', 
            'MSCI World': 'URTH'
        }
    
    def analyze_portfolio_vs_benchmarks(self, portfolio_data, period='1y'):
        """Compare portfolio performance against benchmarks"""
        # Get portfolio symbols and weights
        symbols = [p['symbol'] for p in portfolio_data]
        total_value = sum(p.get('market_value', 0) or p.get('quantity', 0) * p.get('price', 0) for p in portfolio_data)
        weights = {p['symbol']: (p.get('market_value', 0) or p.get('quantity', 0) * p.get('price', 0)) / total_value 
                  for p in portfolio_data if total_value > 0}
        
        # Get portfolio price data
        portfolio_prices = self.client.get_price_data(symbols, period)
        if portfolio_prices.empty:
            return {'error': 'No portfolio data available'}
        
        # Calculate portfolio returns
        portfolio_returns = self._calculate_portfolio_returns(portfolio_prices, weights)
        
        # Get benchmark data
        benchmark_symbols = list(self.benchmarks.values())
        benchmark_prices = self.client.get_price_data(benchmark_symbols, period)
        if benchmark_prices.empty:
            return {'error': 'No benchmark data available'}
        
        # Calculate benchmark returns
        benchmark_returns = benchmark_prices.pct_change().dropna()
        
        # Performance metrics
        results = {
            'portfolio_performance': self._calculate_performance_metrics(portfolio_returns),
            'benchmark_performance': {},
            'relative_performance': {},
            'sector_analysis': self.sector_mapper.analyze_portfolio_sectors(portfolio_data)
        }
        
        # Calculate benchmark metrics
        for name, symbol in self.benchmarks.items():
            if symbol in benchmark_returns.columns:
                bench_perf = self._calculate_performance_metrics(benchmark_returns[symbol])
                results['benchmark_performance'][name] = bench_perf
                
                # Relative performance
                portfolio_total = (1 + portfolio_returns).prod() - 1
                benchmark_total = (1 + benchmark_returns[symbol]).prod() - 1
                results['relative_performance'][name] = {
                    'excess_return': portfolio_total - benchmark_total,
                    'tracking_error': (portfolio_returns - benchmark_returns[symbol]).std() * np.sqrt(252),
                    'information_ratio': (portfolio_total - benchmark_total) / ((portfolio_returns - benchmark_returns[symbol]).std() * np.sqrt(252)) if (portfolio_returns - benchmark_returns[symbol]).std() > 0 else 0
                }
        
        return results
    
    def _calculate_portfolio_returns(self, prices, weights):
        """Calculate weighted portfolio returns"""
        returns = prices.pct_change().dropna()
        portfolio_returns = pd.Series(0, index=returns.index)
        
        for symbol, weight in weights.items():
            if symbol in returns.columns:
                portfolio_returns += returns[symbol] * weight
        
        return portfolio_returns
    
    def _calculate_performance_metrics(self, returns):
        """Calculate standard performance metrics"""
        if len(returns) == 0:
            return {}
        
        total_return = (1 + returns).prod() - 1
        annualized_return = (1 + returns).prod() ** (252 / len(returns)) - 1
        volatility = returns.std() * np.sqrt(252)
        sharpe_ratio = (annualized_return - 0.02) / volatility if volatility > 0 else 0
        
        # Downside metrics
        negative_returns = returns[returns < 0]
        downside_deviation = negative_returns.std() * np.sqrt(252) if len(negative_returns) > 0 else 0
        sortino_ratio = (annualized_return - 0.02) / downside_deviation if downside_deviation > 0 else 0
        
        # Max drawdown
        cumulative = (1 + returns).cumprod()
        rolling_max = cumulative.expanding().max()
        drawdown = (cumulative - rolling_max) / rolling_max
        max_drawdown = drawdown.min()
        
        return {
            'total_return': total_return,
            'annualized_return': annualized_return,
            'volatility': volatility,
            'sharpe_ratio': sharpe_ratio,
            'sortino_ratio': sortino_ratio,
            'max_drawdown': max_drawdown,
            'win_rate': len(returns[returns > 0]) / len(returns) if len(returns) > 0 else 0
        }

def test_benchmark_analysis():
    """Test benchmark analysis with sample portfolio"""
    portfolio = [
        {'symbol': 'AAPL', 'quantity': 100, 'price': 150.0},
        {'symbol': 'MSFT', 'quantity': 50, 'price': 300.0},
        {'symbol': 'GOOGL', 'quantity': 25, 'price': 2500.0},
        {'symbol': 'TSLA', 'quantity': 30, 'price': 200.0},
        {'symbol': 'JPM', 'quantity': 40, 'price': 140.0}
    ]
    
    analyzer = BenchmarkAnalyzer()
    results = analyzer.analyze_portfolio_vs_benchmarks(portfolio)
    
    if 'error' in results:
        print(f"Error: {results['error']}")
        return
    
    print("=== Portfolio vs Benchmark Analysis ===")
    
    # Portfolio performance
    port_perf = results['portfolio_performance']
    print(f"\nPortfolio Performance:")
    print(f"  Total Return: {port_perf.get('total_return', 0)*100:.2f}%")
    print(f"  Annualized Return: {port_perf.get('annualized_return', 0)*100:.2f}%")
    print(f"  Volatility: {port_perf.get('volatility', 0)*100:.2f}%")
    print(f"  Sharpe Ratio: {port_perf.get('sharpe_ratio', 0):.2f}")
    print(f"  Max Drawdown: {port_perf.get('max_drawdown', 0)*100:.2f}%")
    
    # Benchmark comparison
    print(f"\nBenchmark Comparison:")
    for name, perf in results['benchmark_performance'].items():
        rel_perf = results['relative_performance'].get(name, {})
        print(f"  {name}:")
        print(f"    Return: {perf.get('total_return', 0)*100:.2f}%")
        print(f"    Excess Return: {rel_perf.get('excess_return', 0)*100:.2f}%")
        print(f"    Information Ratio: {rel_perf.get('information_ratio', 0):.2f}")
    
    # Sector allocation
    sectors = results['sector_analysis']['sectors']
    print(f"\nTop Sectors:")
    for sector, data in sorted(sectors.items(), key=lambda x: x[1]['value'], reverse=True)[:3]:
        print(f"  {sector}: {data['percentage']:.1f}%")

if __name__ == "__main__":
    test_benchmark_analysis()