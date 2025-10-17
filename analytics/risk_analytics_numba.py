import numpy as np
import pandas as pd
from numba import jit, prange
from typing import Dict, List
from clients.market_data_client import MarketDataClient
from utils.logger import logger

@jit(nopython=True, parallel=True)
def calculate_portfolio_metrics_jit(returns_matrix, weights):
    """JIT-compiled portfolio calculations"""
    n_assets, n_periods = returns_matrix.shape
    
    # Portfolio returns
    portfolio_returns = np.zeros(n_periods)
    for i in prange(n_periods):
        portfolio_returns[i] = np.sum(returns_matrix[:, i] * weights)
    
    # Covariance matrix
    cov_matrix = np.cov(returns_matrix) * 252
    
    # Portfolio volatility
    portfolio_vol = np.sqrt(weights.T @ cov_matrix @ weights)
    
    # Individual volatilities
    individual_vols = np.std(returns_matrix, axis=1) * np.sqrt(252)
    
    # VaR and CVaR
    sorted_returns = np.sort(portfolio_returns)
    var_5_idx = int(0.05 * len(sorted_returns))
    var_5 = sorted_returns[var_5_idx]
    cvar_5 = np.mean(sorted_returns[:var_5_idx])
    
    # Sharpe ratio
    mean_return = np.mean(portfolio_returns) * 252
    vol = np.std(portfolio_returns) * np.sqrt(252)
    sharpe = (mean_return - 0.02) / vol if vol > 0 else 0.0
    
    # Sortino ratio
    downside_returns = portfolio_returns[portfolio_returns < 0]
    downside_vol = np.std(downside_returns) * np.sqrt(252) if len(downside_returns) > 0 else vol
    sortino = (mean_return - 0.02) / downside_vol if downside_vol > 0 else 0.0
    
    # Max drawdown
    cumulative = np.cumprod(1 + portfolio_returns)
    running_max = np.maximum.accumulate(cumulative)
    drawdowns = (cumulative - running_max) / running_max
    max_drawdown = np.min(drawdowns)
    
    return portfolio_vol, individual_vols, var_5, cvar_5, sharpe, sortino, max_drawdown

@jit(nopython=True)
def correlation_matrix_jit(returns_matrix):
    """JIT-compiled correlation matrix"""
    n_assets = returns_matrix.shape[0]
    corr_matrix = np.zeros((n_assets, n_assets))
    
    for i in range(n_assets):
        for j in range(i, n_assets):
            if i == j:
                corr_matrix[i, j] = 1.0
            else:
                corr = np.corrcoef(returns_matrix[i], returns_matrix[j])[0, 1]
                corr_matrix[i, j] = corr
                corr_matrix[j, i] = corr
    
    return corr_matrix

class RiskAnalyzerNumba:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def analyze_portfolio_risk_jit(self, symbols: List[str], weights: Dict[str, float], period: str = "1y") -> Dict:
        """JIT-compiled risk analysis"""
        logger.info(f"Starting JIT risk analysis for {len(symbols)} symbols")
        
        # Get data
        price_data = self.data_client.get_price_data(symbols, period)
        returns = price_data.pct_change().dropna()
        
        # Filter available symbols
        available_symbols = [s for s in symbols if s in returns.columns]
        if not available_symbols:
            return self._empty_risk_metrics()
        
        # Prepare data for JIT functions
        returns_matrix = returns[available_symbols].values.T  # Shape: (n_assets, n_periods)
        weights_array = np.array([weights.get(s, 0) for s in available_symbols])
        weights_array = weights_array / weights_array.sum()
        
        # JIT-compiled calculations
        portfolio_vol, individual_vols, var_5, cvar_5, sharpe, sortino, max_drawdown = calculate_portfolio_metrics_jit(
            returns_matrix, weights_array
        )
        
        corr_matrix = correlation_matrix_jit(returns_matrix)
        avg_correlation = np.mean(corr_matrix[np.triu_indices_from(corr_matrix, k=1)]) if len(available_symbols) > 1 else 0.0
        
        return {
            'portfolio_volatility': float(portfolio_vol),
            'individual_volatilities': dict(zip(available_symbols, individual_vols)),
            'avg_correlation': float(avg_correlation),
            'correlation_matrix': corr_matrix,
            'var_5': float(var_5),
            'cvar_5': float(cvar_5),
            'sharpe_ratio': float(sharpe),
            'sortino_ratio': float(sortino),
            'max_drawdown': float(max_drawdown),
            'beta': 0.0,
            'tracking_error': 0.0
        }
    
    def _empty_risk_metrics(self) -> Dict:
        return {
            'portfolio_volatility': 0.0,
            'individual_volatilities': {},
            'avg_correlation': 0.0,
            'correlation_matrix': pd.DataFrame(),
            'var_5': 0.0,
            'cvar_5': 0.0,
            'sharpe_ratio': 0.0,
            'sortino_ratio': 0.0,
            'max_drawdown': 0.0,
            'beta': 0.0,
            'tracking_error': 0.0
        }