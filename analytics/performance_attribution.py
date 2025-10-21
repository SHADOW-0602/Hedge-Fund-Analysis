import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from clients.market_data_client import MarketDataClient
from core.transactions import TransactionPortfolio
from utils.logger import logger

class PerformanceAttributor:
    def __init__(self, data_client: MarketDataClient, benchmark_symbol: str = 'SPY'):
        self.data_client = data_client
        self.benchmark_symbol = benchmark_symbol
    
    def factor_based_attribution(self, symbols: List[str], weights: Dict[str, float], 
                                period: str = "1y") -> Dict:
        """Simplified factor-based attribution analysis"""
        
        try:
            # Limit symbols for faster processing
            limited_symbols = symbols[:10] if len(symbols) > 10 else symbols
            
            # Get price data including benchmark
            all_symbols = limited_symbols + [self.benchmark_symbol]
            price_data = self.data_client.get_price_data(all_symbols, period)
            
            if price_data is None or price_data.empty:
                return {}
            
            returns = price_data.pct_change().dropna()
            
            if returns.empty or self.benchmark_symbol not in returns.columns:
                return {}
            
            # Filter available symbols
            available_symbols = [s for s in limited_symbols if s in returns.columns]
            if not available_symbols:
                return {}
            
            # Simplified calculations
            benchmark_returns = returns[self.benchmark_symbol]
            portfolio_returns = self._calculate_portfolio_returns(returns[available_symbols], weights)
            
            # Basic attribution for available symbols only
            attribution = {}
            top_symbols = sorted(available_symbols, key=lambda s: weights.get(s, 0), reverse=True)[:5]
            
            for symbol in top_symbols:
                weight = weights.get(symbol, 0)
                symbol_return = returns[symbol].mean() * 252
                
                attribution[symbol] = {
                    'weight': weight,
                    'total_return': symbol_return,
                    'total_contribution': weight * symbol_return
                }
            
            # Portfolio-level metrics
            portfolio_return = portfolio_returns.mean() * 252
            benchmark_return = benchmark_returns.mean() * 252
            
            return {
                'portfolio_return': portfolio_return,
                'benchmark_return': benchmark_return,
                'active_return': portfolio_return - benchmark_return,
                'top_contributors': sorted(attribution.items(), 
                                         key=lambda x: x[1]['total_contribution'], reverse=True)
            }
        
        except Exception as e:
            logger.error(f"Performance attribution error: {e}")
            return {}
    
    def transaction_cost_analysis(self, txn_portfolio: TransactionPortfolio) -> Dict:
        """Detailed cost impact assessment"""
        
        transactions = txn_portfolio.transactions
        
        # Cost breakdown
        total_fees = sum(txn.fees for txn in transactions)
        total_volume = sum(abs(txn.quantity * txn.price) for txn in transactions)
        
        # Cost analysis by symbol
        cost_by_symbol = {}
        for txn in transactions:
            if txn.symbol not in cost_by_symbol:
                cost_by_symbol[txn.symbol] = {
                    'total_fees': 0,
                    'total_volume': 0,
                    'trade_count': 0,
                    'avg_trade_size': 0
                }
            
            cost_by_symbol[txn.symbol]['total_fees'] += txn.fees
            cost_by_symbol[txn.symbol]['total_volume'] += abs(txn.quantity * txn.price)
            cost_by_symbol[txn.symbol]['trade_count'] += 1
        
        # Calculate averages and rates
        for symbol_data in cost_by_symbol.values():
            symbol_data['fee_rate'] = symbol_data['total_fees'] / symbol_data['total_volume'] if symbol_data['total_volume'] > 0 else 0
            symbol_data['avg_trade_size'] = symbol_data['total_volume'] / symbol_data['trade_count'] if symbol_data['trade_count'] > 0 else 0
            symbol_data['avg_fee_per_trade'] = symbol_data['total_fees'] / symbol_data['trade_count'] if symbol_data['trade_count'] > 0 else 0
        
        # Estimate slippage (simplified)
        estimated_slippage = total_volume * 0.001  # 0.1% estimate
        
        return {
            'total_explicit_costs': total_fees,
            'estimated_slippage': estimated_slippage,
            'total_transaction_costs': total_fees + estimated_slippage,
            'overall_cost_rate': (total_fees + estimated_slippage) / total_volume if total_volume > 0 else 0,
            'cost_by_symbol': cost_by_symbol,
            'cost_efficiency_score': 1 - min((total_fees / total_volume), 0.01) if total_volume > 0 else 0
        }
    
    def benchmark_comparison(self, symbols: List[str], weights: Dict[str, float], 
                           period: str = "1y") -> Dict:
        """Active vs. passive performance analysis"""
        
        price_data = self.data_client.get_price_data(symbols + [self.benchmark_symbol], period)
        returns = price_data.pct_change().dropna()
        
        if returns.empty or self.benchmark_symbol not in returns.columns:
            return {}
        
        portfolio_returns = self._calculate_portfolio_returns(returns[symbols], weights)
        benchmark_returns = returns[self.benchmark_symbol]
        
        # Performance metrics
        portfolio_total_return = (1 + portfolio_returns).prod() - 1
        benchmark_total_return = (1 + benchmark_returns).prod() - 1
        
        portfolio_vol = portfolio_returns.std() * np.sqrt(252)
        benchmark_vol = benchmark_returns.std() * np.sqrt(252)
        
        # Active metrics
        active_returns = portfolio_returns - benchmark_returns
        tracking_error = active_returns.std() * np.sqrt(252)
        information_ratio = active_returns.mean() / active_returns.std() * np.sqrt(252) if active_returns.std() > 0 else 0
        
        # Risk-adjusted metrics
        portfolio_sharpe = self._calculate_sharpe(portfolio_returns)
        benchmark_sharpe = self._calculate_sharpe(benchmark_returns)
        
        # Beta and correlation
        beta = np.cov(portfolio_returns, benchmark_returns)[0][1] / np.var(benchmark_returns) if np.var(benchmark_returns) > 0 else 0
        correlation = np.corrcoef(portfolio_returns, benchmark_returns)[0][1]
        
        return {
            'portfolio_return': portfolio_total_return,
            'benchmark_return': benchmark_total_return,
            'excess_return': portfolio_total_return - benchmark_total_return,
            'portfolio_volatility': portfolio_vol,
            'benchmark_volatility': benchmark_vol,
            'tracking_error': tracking_error,
            'information_ratio': information_ratio,
            'portfolio_sharpe': portfolio_sharpe,
            'benchmark_sharpe': benchmark_sharpe,
            'beta': beta,
            'correlation': correlation,
            'active_share': self._calculate_active_share(weights),
            'performance_summary': self._performance_summary(portfolio_total_return, benchmark_total_return, tracking_error)
        }
    
    def risk_adjusted_returns(self, symbols: List[str], weights: Dict[str, float], 
                            period: str = "1y") -> Dict:
        """Comprehensive risk-adjusted return metrics"""
        
        price_data = self.data_client.get_price_data(symbols + [self.benchmark_symbol], period)
        returns = price_data.pct_change().dropna()
        
        if returns.empty:
            return {}
        
        portfolio_returns = self._calculate_portfolio_returns(returns[symbols], weights)
        
        # Risk metrics
        sharpe_ratio = self._calculate_sharpe(portfolio_returns)
        sortino_ratio = self._calculate_sortino(portfolio_returns)
        calmar_ratio = self._calculate_calmar(portfolio_returns)
        
        # Drawdown analysis
        max_drawdown = self._calculate_max_drawdown(portfolio_returns)
        
        # Value at Risk
        var_5 = np.percentile(portfolio_returns, 5)
        cvar_5 = portfolio_returns[portfolio_returns <= var_5].mean()
        
        # Additional metrics
        skewness = portfolio_returns.skew()
        kurtosis = portfolio_returns.kurtosis()
        
        return {
            'sharpe_ratio': sharpe_ratio,
            'sortino_ratio': sortino_ratio,
            'calmar_ratio': calmar_ratio,
            'max_drawdown': max_drawdown,
            'var_5': var_5,
            'cvar_5': cvar_5,
            'skewness': skewness,
            'kurtosis': kurtosis,
            'volatility': portfolio_returns.std() * np.sqrt(252),
            'downside_deviation': portfolio_returns[portfolio_returns < 0].std() * np.sqrt(252),
            'upside_capture': self._calculate_upside_capture(portfolio_returns, returns.get(self.benchmark_symbol)),
            'downside_capture': self._calculate_downside_capture(portfolio_returns, returns.get(self.benchmark_symbol))
        }
    
    def _calculate_portfolio_returns(self, returns: pd.DataFrame, weights: Dict[str, float]) -> pd.Series:
        """Calculate portfolio returns from individual asset returns"""
        if returns.empty:
            return pd.Series()
        weight_array = np.array([weights.get(symbol, 0) for symbol in returns.columns])
        # Normalize weights for available symbols
        if weight_array.sum() > 0:
            weight_array = weight_array / weight_array.sum()
        return (returns * weight_array).sum(axis=1)
    
    def _calculate_sharpe(self, returns: pd.Series, risk_free_rate: float = 0.02) -> float:
        """Calculate Sharpe ratio"""
        excess_returns = returns.mean() * 252 - risk_free_rate
        return excess_returns / (returns.std() * np.sqrt(252)) if returns.std() > 0 else 0
    
    def _calculate_sortino(self, returns: pd.Series, risk_free_rate: float = 0.02) -> float:
        """Calculate Sortino ratio"""
        excess_returns = returns.mean() * 252 - risk_free_rate
        downside_returns = returns[returns < 0]
        downside_deviation = downside_returns.std() * np.sqrt(252)
        return excess_returns / downside_deviation if downside_deviation > 0 else 0
    
    def _calculate_calmar(self, returns: pd.Series) -> float:
        """Calculate Calmar ratio"""
        annual_return = returns.mean() * 252
        max_drawdown = abs(self._calculate_max_drawdown(returns))
        return annual_return / max_drawdown if max_drawdown > 0 else 0
    
    def _calculate_max_drawdown(self, returns: pd.Series) -> float:
        """Calculate maximum drawdown"""
        cumulative = (1 + returns).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        return drawdown.min()
    
    def _calculate_active_share(self, weights: Dict[str, float]) -> float:
        """Calculate active share (simplified - assumes equal benchmark weights)"""
        n_assets = len(weights)
        benchmark_weight = 1 / n_assets if n_assets > 0 else 0
        
        active_share = sum(abs(weight - benchmark_weight) for weight in weights.values()) / 2
        return active_share
    
    def _calculate_upside_capture(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate upside capture ratio"""
        if benchmark_returns is None:
            return 0
        
        up_market = benchmark_returns > 0
        if up_market.sum() == 0:
            return 0
        
        portfolio_up = portfolio_returns[up_market].mean()
        benchmark_up = benchmark_returns[up_market].mean()
        
        return portfolio_up / benchmark_up if benchmark_up != 0 else 0
    
    def _calculate_downside_capture(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate downside capture ratio"""
        if benchmark_returns is None:
            return 0
        
        down_market = benchmark_returns < 0
        if down_market.sum() == 0:
            return 0
        
        portfolio_down = portfolio_returns[down_market].mean()
        benchmark_down = benchmark_returns[down_market].mean()
        
        return portfolio_down / benchmark_down if benchmark_down != 0 else 0
    
    def _performance_summary(self, portfolio_return: float, benchmark_return: float, tracking_error: float) -> str:
        """Generate performance summary"""
        excess_return = portfolio_return - benchmark_return
        
        if excess_return > 0.02:  # 2% outperformance
            return "STRONG_OUTPERFORMANCE"
        elif excess_return > 0:
            return "OUTPERFORMANCE"
        elif excess_return > -0.02:
            return "INLINE"
        else:
            return "UNDERPERFORMANCE"