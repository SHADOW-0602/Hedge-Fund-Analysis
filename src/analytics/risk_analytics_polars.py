import polars as pl
import pandas as pd
import numpy as np
from typing import Dict, List
from clients.market_data_client import MarketDataClient
from utils.logger import logger

class RiskAnalyzerPolars:
    def __init__(self, data_client: MarketDataClient, benchmark_symbol: str = 'SPY'):
        self.data_client = data_client
        self.benchmark_symbol = benchmark_symbol
    
    def analyze_portfolio_risk_ultra_fast(self, symbols: List[str], weights: Dict[str, float], period: str = "1y") -> Dict:
        """Ultra-fast risk analysis using optimized numpy operations"""
        logger.info(f"Starting ultra-fast risk analysis for {len(symbols)} symbols")
        
        # Get data - this is the main bottleneck
        price_data = self.data_client.get_price_data(symbols + [self.benchmark_symbol], period)
        
        if price_data is None or price_data.empty:
            logger.warning("No price data available")
            return self._empty_risk_metrics()
        
        logger.info(f"Price data shape: {price_data.shape}, columns: {list(price_data.columns)[:5]}")
        
        # Direct numpy operations - skip Polars conversion for speed
        returns_data = price_data.pct_change().dropna()
        
        logger.info(f"Returns data shape: {returns_data.shape}")
        
        # Filter available symbols
        available_symbols = [s for s in symbols if s in returns_data.columns]
        logger.info(f"Available symbols: {len(available_symbols)} out of {len(symbols)}")
        
        if not available_symbols:
            logger.warning("No available symbols found in returns data")
            return self._empty_risk_metrics()
        
        # Get returns matrix directly as numpy
        returns_matrix = returns_data[available_symbols].values
        
        # Vectorized weight calculation
        available_weights = np.array([weights.get(s, 0) for s in available_symbols])
        if available_weights.sum() > 0:
            available_weights = available_weights / available_weights.sum()
        
        # Check if we have enough data
        if returns_matrix.size == 0 or len(available_symbols) == 0:
            return self._empty_risk_metrics()
        
        # Portfolio returns (vectorized)
        portfolio_returns = returns_matrix @ available_weights
        
        # Fast calculations with error handling
        try:
            if returns_matrix.shape[0] > 1 and returns_matrix.shape[1] > 1:
                portfolio_vol = np.sqrt(available_weights.T @ np.cov(returns_matrix.T) * 252 @ available_weights)
                individual_vols = np.std(returns_matrix, axis=0) * np.sqrt(252)
                corr_matrix = np.corrcoef(returns_matrix.T)
            else:
                portfolio_vol = 0.0
                individual_vols = np.zeros(len(available_symbols))
                corr_matrix = np.eye(len(available_symbols))
        except:
            portfolio_vol = 0.0
            individual_vols = np.zeros(len(available_symbols))
            corr_matrix = np.eye(len(available_symbols))
        
        # Risk metrics
        var_5 = np.percentile(portfolio_returns, 5)
        cvar_5 = np.mean(portfolio_returns[portfolio_returns <= var_5])
        
        # Performance metrics
        annual_return = np.mean(portfolio_returns) * 252
        annual_vol = np.std(portfolio_returns) * np.sqrt(252)
        sharpe = (annual_return - 0.02) / annual_vol if annual_vol > 0 else 0
        
        downside_returns = portfolio_returns[portfolio_returns < 0]
        downside_vol = np.std(downside_returns) * np.sqrt(252) if len(downside_returns) > 0 else annual_vol
        sortino = (annual_return - 0.02) / downside_vol if downside_vol > 0 else 0
        
        # Max drawdown
        cumulative = np.cumprod(1 + portfolio_returns)
        running_max = np.maximum.accumulate(cumulative)
        drawdowns = (cumulative - running_max) / running_max
        max_drawdown = np.min(drawdowns)
        
        return {
            'portfolio_volatility': float(portfolio_vol),
            'individual_volatilities': dict(zip(available_symbols, individual_vols)),
            'avg_correlation': float(np.mean(corr_matrix[np.triu_indices_from(corr_matrix, k=1)])) if len(available_symbols) > 1 else 0.0,
            'correlation_matrix': pd.DataFrame(corr_matrix, index=available_symbols, columns=available_symbols),
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