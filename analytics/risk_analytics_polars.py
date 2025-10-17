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
        """Ultra-fast risk analysis using Polars"""
        logger.info(f"Starting ultra-fast risk analysis for {len(symbols)} symbols")
        
        # Get data as pandas first, then convert to Polars
        price_data = self.data_client.get_price_data(symbols + [self.benchmark_symbol], period)
        
        # Convert to Polars LazyFrame for maximum speed
        df = pl.from_pandas(price_data).lazy()
        
        # Calculate returns in one operation
        returns_df = df.select([
            (pl.col(col).pct_change().alias(f"{col}_return")) 
            for col in df.columns if col != 'Date'
        ]).drop_nulls()
        
        # Collect only once
        returns = returns_df.collect()
        
        # Filter available symbols
        available_symbols = [s for s in symbols if f"{s}_return" in returns.columns]
        if not available_symbols:
            return self._empty_risk_metrics()
        
        # Vectorized weight calculation
        available_weights = np.array([weights.get(s, 0) for s in available_symbols])
        available_weights = available_weights / available_weights.sum()
        
        # Get return columns as numpy arrays for speed
        return_cols = [f"{s}_return" for s in available_symbols]
        returns_matrix = returns.select(return_cols).to_numpy()
        
        # Portfolio returns (vectorized)
        portfolio_returns = returns_matrix @ available_weights
        
        # Correlation matrix (numpy is faster for small matrices)
        corr_matrix = np.corrcoef(returns_matrix.T)
        
        # All calculations in numpy for maximum speed
        portfolio_vol = np.sqrt(available_weights.T @ np.cov(returns_matrix.T) * 252 @ available_weights)
        individual_vols = np.std(returns_matrix, axis=0) * np.sqrt(252)
        
        return {
            'portfolio_volatility': float(portfolio_vol),
            'individual_volatilities': dict(zip(available_symbols, individual_vols)),
            'avg_correlation': float(np.mean(corr_matrix[np.triu_indices_from(corr_matrix, k=1)])) if len(available_symbols) > 1 else 0.0,
            'correlation_matrix': corr_matrix,
            'var_5': float(np.percentile(portfolio_returns, 5)),
            'cvar_5': float(np.mean(portfolio_returns[portfolio_returns <= np.percentile(portfolio_returns, 5)])),
            'sharpe_ratio': float((np.mean(portfolio_returns) * 252 - 0.02) / (np.std(portfolio_returns) * np.sqrt(252))),
            'sortino_ratio': float((np.mean(portfolio_returns) * 252 - 0.02) / (np.std(portfolio_returns[portfolio_returns < 0]) * np.sqrt(252))),
            'max_drawdown': float(np.min((np.cumprod(1 + portfolio_returns) / np.maximum.accumulate(np.cumprod(1 + portfolio_returns))) - 1)),
            'beta': 0.0,  # Calculate if needed
            'tracking_error': 0.0  # Calculate if needed
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