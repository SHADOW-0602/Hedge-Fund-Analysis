"""
Strategy Backtesting Engine
Comprehensive backtesting with risk metrics and performance analysis
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import warnings
warnings.filterwarnings('ignore')

class StrategyBacktester:
    def __init__(self, data_client):
        self.data_client = data_client
        
    def backtest_strategy(self, symbols: List[str], weights: Dict[str, float], 
                         backtest_period: str, rebalancing: str, 
                         transaction_costs: float, benchmark: str) -> Dict:
        """
        Comprehensive strategy backtesting with risk metrics
        """
        try:
            # Get historical data
            price_data = self._get_historical_data(symbols, backtest_period)
            if price_data is None or price_data.empty:
                raise ValueError("No historical data available for backtesting")
            
            benchmark_data = self._get_benchmark_data(benchmark, backtest_period)
            if benchmark_data is None or benchmark_data.empty:
                raise ValueError(f"No benchmark data available for {benchmark}")
            
            # Calculate returns
            returns = price_data.pct_change().dropna()
            benchmark_returns = benchmark_data.pct_change().dropna()
            
            # Align data
            common_dates = returns.index.intersection(benchmark_returns.index)
            returns = returns.loc[common_dates]
            benchmark_returns = benchmark_returns.loc[common_dates]
            
            if len(returns) < 20:
                raise ValueError(f"Insufficient data for backtesting: {len(returns)} periods")
            
            # Run backtest simulation
            portfolio_returns = self._simulate_strategy(
                returns, weights, rebalancing, transaction_costs
            )
            
            # Calculate performance metrics
            performance_metrics = self._calculate_performance_metrics(
                portfolio_returns, benchmark_returns, transaction_costs
            )
            
            # Calculate risk metrics
            risk_metrics = self._calculate_risk_metrics(
                portfolio_returns, benchmark_returns
            )
            
            # Generate backtest summary
            summary = self._generate_backtest_summary(
                portfolio_returns, benchmark_returns, symbols, weights,
                backtest_period, rebalancing, transaction_costs, benchmark
            )
            
            return {
                'performance_metrics': performance_metrics,
                'risk_metrics': risk_metrics,
                'summary': summary,
                'portfolio_returns': portfolio_returns.tolist(),
                'benchmark_returns': benchmark_returns.tolist(),
                'dates': [d.strftime('%Y-%m-%d') for d in portfolio_returns.index],
                'parameters': {
                    'symbols': symbols,
                    'weights': weights,
                    'backtest_period': backtest_period,
                    'rebalancing': rebalancing,
                    'transaction_costs': transaction_costs,
                    'benchmark': benchmark
                }
            }
            
        except Exception as e:
            return {'error': f'Backtesting failed: {str(e)}'}
    
    def _get_historical_data(self, symbols: List[str], period: str) -> pd.DataFrame:
        """Get historical price data"""
        period_map = {
            '6M': '6mo', '1Y': '1y', '2Y': '2y', 
            '3Y': '3y', '5Y': '5y'
        }
        data_period = period_map.get(period, '1y')
        
        price_data = self.data_client.get_price_data(symbols, period=data_period)
        return price_data
    
    def _get_benchmark_data(self, benchmark: str, period: str) -> pd.Series:
        """Get benchmark data"""
        period_map = {
            '6M': '6mo', '1Y': '1y', '2Y': '2y', 
            '3Y': '3y', '5Y': '5y'
        }
        data_period = period_map.get(period, '1y')
        
        benchmark_data = self.data_client.get_price_data([benchmark], period=data_period)
        if benchmark_data is not None and not benchmark_data.empty:
            return benchmark_data[benchmark]
        return pd.Series()
    
    def _simulate_strategy(self, returns: pd.DataFrame, weights: Dict[str, float], 
                          rebalancing: str, transaction_costs: float) -> pd.Series:
        """Simulate strategy with rebalancing and transaction costs"""
        
        # Calculate rebalancing frequency
        rebalance_freq = {
            'Monthly': 21, 'Quarterly': 63, 'Semi-annual': 126
        }.get(rebalancing, 63)
        
        # Initialize portfolio
        portfolio_value = 1.0
        portfolio_returns = []
        current_weights = weights.copy()
        
        for i, (date, row) in enumerate(returns.iterrows()):
            # Calculate daily return
            daily_return = sum(current_weights.get(symbol, 0) * row.get(symbol, 0) 
                             for symbol in current_weights.keys())
            
            # Apply transaction costs on rebalancing days
            if i > 0 and i % rebalance_freq == 0:
                # Calculate turnover and apply costs
                turnover = sum(abs(current_weights.get(symbol, 0) - weights.get(symbol, 0)) 
                             for symbol in set(list(current_weights.keys()) + list(weights.keys())))
                cost = turnover * transaction_costs / 100
                daily_return -= cost
                current_weights = weights.copy()
            
            portfolio_value *= (1 + daily_return)
            portfolio_returns.append(daily_return)
        
        return pd.Series(portfolio_returns, index=returns.index)
    
    def _calculate_performance_metrics(self, portfolio_returns: pd.Series, 
                                     benchmark_returns: pd.Series, 
                                     transaction_costs: float) -> Dict:
        """Calculate comprehensive performance metrics"""
        
        # Annualized returns
        portfolio_annual = (1 + portfolio_returns.mean()) ** 252 - 1
        benchmark_annual = (1 + benchmark_returns.mean()) ** 252 - 1
        
        # Volatility
        portfolio_vol = portfolio_returns.std() * np.sqrt(252)
        benchmark_vol = benchmark_returns.std() * np.sqrt(252)
        
        # Sharpe ratio (using real Fed rate)
        from utils.fed_rate import get_risk_free_rate
        risk_free_rate = get_risk_free_rate()
        sharpe_ratio = (portfolio_annual - risk_free_rate) / portfolio_vol if portfolio_vol > 0 else 0
        
        # Alpha and Beta
        covariance = np.cov(portfolio_returns, benchmark_returns)[0, 1]
        benchmark_variance = benchmark_returns.var()
        beta = covariance / benchmark_variance if benchmark_variance > 0 else 0
        alpha = portfolio_annual - beta * benchmark_annual
        
        # Information ratio
        active_returns = portfolio_returns - benchmark_returns
        tracking_error = active_returns.std() * np.sqrt(252)
        information_ratio = (portfolio_annual - benchmark_annual) / tracking_error if tracking_error > 0 else 0
        
        # Cumulative returns
        cumulative_portfolio = (1 + portfolio_returns).cumprod().iloc[-1] - 1
        cumulative_benchmark = (1 + benchmark_returns).cumprod().iloc[-1] - 1
        
        return {
            'total_return': float(cumulative_portfolio),
            'annualized_return': float(portfolio_annual),
            'volatility': float(portfolio_vol),
            'sharpe_ratio': float(sharpe_ratio),
            'alpha': float(alpha),
            'beta': float(beta),
            'information_ratio': float(information_ratio),
            'tracking_error': float(tracking_error),
            'benchmark_return': float(cumulative_benchmark),
            'excess_return': float(cumulative_portfolio - cumulative_benchmark),
            'transaction_costs_impact': float(transaction_costs)
        }
    
    def _calculate_risk_metrics(self, portfolio_returns: pd.Series, 
                               benchmark_returns: pd.Series) -> Dict:
        """Calculate advanced risk metrics"""
        
        # Maximum Drawdown
        cumulative = (1 + portfolio_returns).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        max_drawdown = float(drawdown.min())
        
        # Annualized return for risk calculations
        annualized_return = (1 + portfolio_returns.mean()) ** 252 - 1
        
        # Sortino Ratio (downside deviation)
        from utils.fed_rate import get_risk_free_rate
        risk_free_rate = get_risk_free_rate()
        downside_returns = portfolio_returns[portfolio_returns < 0]
        downside_deviation = downside_returns.std() * np.sqrt(252) if len(downside_returns) > 0 else portfolio_returns.std() * np.sqrt(252)
        sortino_ratio = (annualized_return - risk_free_rate) / downside_deviation if downside_deviation > 0 else 0
        
        # Calmar Ratio
        calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0
        
        # Value at Risk (95%)
        var_95 = float(np.percentile(portfolio_returns, 5))
        
        # Conditional Value at Risk
        cvar_95 = float(portfolio_returns[portfolio_returns <= var_95].mean()) if len(portfolio_returns[portfolio_returns <= var_95]) > 0 else var_95
        
        return {
            'max_drawdown': max_drawdown,
            'sortino_ratio': float(sortino_ratio),
            'calmar_ratio': float(calmar_ratio),
            'var_95': var_95,
            'cvar_95': cvar_95,
            'downside_deviation': float(downside_deviation),
            'upside_capture': self._calculate_upside_capture(portfolio_returns, benchmark_returns),
            'downside_capture': self._calculate_downside_capture(portfolio_returns, benchmark_returns)
        }
    
    def _calculate_upside_capture(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate upside capture ratio"""
        up_market = benchmark_returns > 0
        if up_market.sum() == 0:
            return 0.0
        
        portfolio_up = portfolio_returns[up_market].mean()
        benchmark_up = benchmark_returns[up_market].mean()
        
        return float(portfolio_up / benchmark_up) if benchmark_up != 0 else 0.0
    
    def _calculate_downside_capture(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate downside capture ratio"""
        down_market = benchmark_returns < 0
        if down_market.sum() == 0:
            return 0.0
        
        portfolio_down = portfolio_returns[down_market].mean()
        benchmark_down = benchmark_returns[down_market].mean()
        
        return float(portfolio_down / benchmark_down) if benchmark_down != 0 else 0.0
    
    def _generate_backtest_summary(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series,
                                  symbols: List[str], weights: Dict[str, float],
                                  backtest_period: str, rebalancing: str, 
                                  transaction_costs: float, benchmark: str) -> Dict:
        """Generate comprehensive backtest summary"""
        
        return {
            'start_date': portfolio_returns.index[0].strftime('%Y-%m-%d'),
            'end_date': portfolio_returns.index[-1].strftime('%Y-%m-%d'),
            'total_periods': len(portfolio_returns),
            'symbols_count': len(symbols),
            'rebalancing_frequency': rebalancing,
            'transaction_cost_rate': f"{transaction_costs}%",
            'benchmark_used': benchmark,
            'data_quality': 'Real market data',
            'backtest_period': backtest_period
        }