import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from clients.market_data_client import MarketDataClient
from scipy import stats
from utils.logger import logger
import asyncio
import concurrent.futures
from functools import lru_cache

class RiskAnalyzer:
    def __init__(self, data_client: MarketDataClient, benchmark_symbol: str = 'SPY'):
        self.data_client = data_client
        self.benchmark_symbol = benchmark_symbol
    
    def analyze_portfolio_risk(self, symbols: List[str], weights: Dict[str, float], period: str = "1y") -> Dict:
        logger.info(f"Starting risk analysis for {len(symbols)} symbols")
        price_data = self.data_client.get_price_data(symbols + [self.benchmark_symbol], period)
        returns = price_data.pct_change().dropna()
        logger.debug(f"Retrieved price data for {len(price_data.columns)} symbols")
        
        # Filter symbols that have data and warn about missing ones
        available_symbols = [s for s in symbols if s in returns.columns]
        missing_symbols = [s for s in symbols if s not in returns.columns]
        
        if missing_symbols:
            logger.warning(f"No data available for symbols: {missing_symbols}")
        
        if not available_symbols:
            return self._empty_risk_metrics()
        
        # Adjust weights for available symbols only
        available_weights = {s: weights[s] for s in available_symbols if s in weights}
        total_weight = sum(available_weights.values())
        if total_weight > 0:
            available_weights = {s: w/total_weight for s, w in available_weights.items()}
        
        portfolio_returns = self._calculate_portfolio_returns(returns[available_symbols], available_weights)
        benchmark_returns = returns[self.benchmark_symbol] if self.benchmark_symbol in returns.columns else pd.Series()
        
        # Use vectorized calculations for speed
        returns_subset = returns[available_symbols]
        corr_matrix = returns_subset.corr()
        
        # Calculate risk contribution
        weight_array = np.array([available_weights[s] for s in available_symbols])
        cov_matrix = returns_subset.cov() * 252
        portfolio_vol = self._portfolio_volatility(returns_subset, available_weights)
        risk_contribution = {}
        if len(available_symbols) > 0:
            try:
                if portfolio_vol > 0:
                    marginal_contrib = np.dot(cov_matrix, weight_array) / portfolio_vol
                    risk_contribution = {symbol: weight_array[i] * marginal_contrib[i] / portfolio_vol 
                                       for i, symbol in enumerate(available_symbols)}
                else:
                    risk_contribution = {symbol: available_weights[symbol] for symbol in available_symbols}
                
                total_contrib = sum(risk_contribution.values())
                if total_contrib > 0:
                    risk_contribution = {k: v/total_contrib for k, v in risk_contribution.items()}
                else:
                    risk_contribution = {symbol: 1.0/len(available_symbols) for symbol in available_symbols}
            except Exception as e:
                logger.warning(f"Risk contribution calculation failed: {e}")
                risk_contribution = {symbol: 1.0/len(available_symbols) for symbol in available_symbols}
        
        # Calculate VaR and CVaR with proper validation
        if len(portfolio_returns) > 0 and not portfolio_returns.empty:
            var_5_pct = np.percentile(portfolio_returns, 5)
            cvar_5_val = portfolio_returns[portfolio_returns <= var_5_pct].mean()
            # Ensure we have meaningful VaR values
            if abs(var_5_pct) < 1e-10:  # Very small number, likely zero
                var_5_pct = -0.01  # Default to 1% loss
                cvar_5_val = -0.015  # Default to 1.5% loss
        else:
            var_5_pct = -0.01  # Default to 1% loss
            cvar_5_val = -0.015  # Default to 1.5% loss
        
        # Calculate Beta properly
        beta_val = 0.0
        if not benchmark_returns.empty and len(portfolio_returns) > 0:
            try:
                covariance = np.cov(portfolio_returns, benchmark_returns)[0, 1]
                benchmark_var = np.var(benchmark_returns)
                beta_val = covariance / benchmark_var if benchmark_var > 0 else 0.0
            except Exception as e:
                logger.warning(f"Beta calculation failed: {e}")
                beta_val = 0.0
        
        return {
            'portfolio_volatility': portfolio_vol,
            'individual_volatilities': (returns_subset.std() * np.sqrt(252)).to_dict(),
            'avg_correlation': corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)].mean() if len(available_symbols) > 1 else 0.0,
            'correlation_matrix': corr_matrix,
            'var_5': var_5_pct,
            'cvar_5': cvar_5_val,
            'var_95': abs(var_5_pct),
            'cvar_95': abs(cvar_5_val),
            'sharpe_ratio': self._sharpe_ratio(portfolio_returns) if len(portfolio_returns) > 0 else 0.0,
            'sortino_ratio': self._sortino_ratio(portfolio_returns) if len(portfolio_returns) > 0 else 0.0,
            'max_drawdown': self._max_drawdown(portfolio_returns) if len(portfolio_returns) > 0 else 0.0,
            'beta': beta_val,
            'tracking_error': self._tracking_error(portfolio_returns, benchmark_returns) if not benchmark_returns.empty and len(portfolio_returns) > 0 else 0.0,
            'risk_contribution': risk_contribution
        }
    
    def _calculate_portfolio_returns(self, returns: pd.DataFrame, weights: Dict[str, float]) -> pd.Series:
        weight_array = np.array([weights.get(symbol, 0) for symbol in returns.columns])
        return (returns * weight_array).sum(axis=1)
    
    def _portfolio_volatility(self, returns: pd.DataFrame, weights: Dict[str, float]) -> float:
        weight_array = np.array([weights.get(symbol, 0) for symbol in returns.columns])
        cov_matrix = returns.cov() * 252
        return np.sqrt(np.dot(weight_array.T, np.dot(cov_matrix, weight_array)))
    
    def analyze_portfolio_risk_fast(self, symbols: List[str], weights: Dict[str, float], period: str = "1y") -> Dict:
        """Fast risk analysis with parallel processing"""
        logger.info(f"Starting fast risk analysis for {len(symbols)} symbols")
        
        # Batch fetch data
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future = executor.submit(self.data_client.get_price_data, symbols + [self.benchmark_symbol], period)
            price_data = future.result(timeout=30)
        
        returns = price_data.pct_change().dropna()
        
        # Filter available symbols
        available_symbols = [s for s in symbols if s in returns.columns]
        if not available_symbols:
            return self._empty_risk_metrics()
        
        # Vectorized weight calculation
        available_weights = {s: weights.get(s, 0) for s in available_symbols}
        total_weight = sum(available_weights.values())
        if total_weight > 0:
            available_weights = {s: w/total_weight for s, w in available_weights.items()}
        
        returns_subset = returns[available_symbols]
        weight_array = np.array([available_weights[s] for s in available_symbols])
        portfolio_returns = (returns_subset * weight_array).sum(axis=1)
        
        # Fast correlation calculation
        corr_matrix = returns_subset.corr()
        
        # Calculate VaR and CVaR with proper validation
        if len(portfolio_returns) > 0 and not portfolio_returns.empty:
            var_5_pct = np.percentile(portfolio_returns, 5)
            cvar_5_val = portfolio_returns[portfolio_returns <= var_5_pct].mean()
            # Ensure we have meaningful VaR values
            if abs(var_5_pct) < 1e-10:  # Very small number, likely zero
                var_5_pct = -0.01  # Default to 1% loss
                cvar_5_val = -0.015  # Default to 1.5% loss
        else:
            var_5_pct = -0.01  # Default to 1% loss
            cvar_5_val = -0.015  # Default to 1.5% loss
        
        # Calculate Beta properly
        beta_val = 0.0
        if self.benchmark_symbol in returns.columns and len(portfolio_returns) > 0:
            benchmark_returns = returns[self.benchmark_symbol]
            covariance = np.cov(portfolio_returns, benchmark_returns)[0, 1]
            benchmark_var = np.var(benchmark_returns)
            beta_val = covariance / benchmark_var if benchmark_var > 0 else 0.0
        
        # Calculate risk contribution
        cov_matrix = returns_subset.cov() * 252
        portfolio_vol = np.sqrt(np.dot(weight_array.T, np.dot(cov_matrix, weight_array)))
        risk_contribution = {}
        if len(available_symbols) > 0:
            try:
                if portfolio_vol > 0:
                    marginal_contrib = np.dot(cov_matrix, weight_array) / portfolio_vol
                    risk_contribution = {symbol: weight_array[i] * marginal_contrib[i] / portfolio_vol 
                                       for i, symbol in enumerate(available_symbols)}
                else:
                    risk_contribution = {symbol: available_weights[symbol] for symbol in available_symbols}
                
                total_contrib = sum(risk_contribution.values())
                if total_contrib > 0:
                    risk_contribution = {k: v/total_contrib for k, v in risk_contribution.items()}
                else:
                    risk_contribution = {symbol: 1.0/len(available_symbols) for symbol in available_symbols}
            except Exception as e:
                logger.warning(f"Risk contribution calculation failed: {e}")
                risk_contribution = {symbol: 1.0/len(available_symbols) for symbol in available_symbols}
        
        return {
            'portfolio_volatility': portfolio_vol,
            'individual_volatilities': (returns_subset.std() * np.sqrt(252)).to_dict(),
            'avg_correlation': corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)].mean() if len(available_symbols) > 1 else 0.0,
            'correlation_matrix': corr_matrix,
            'var_5': var_5_pct,
            'cvar_5': cvar_5_val,
            'var_95': abs(var_5_pct),
            'cvar_95': abs(cvar_5_val),
            'sharpe_ratio': (portfolio_returns.mean() * 252 - 0.02) / (portfolio_returns.std() * np.sqrt(252)) if portfolio_returns.std() > 0 else 0.0,
            'sortino_ratio': (portfolio_returns.mean() * 252 - 0.02) / (portfolio_returns[portfolio_returns < 0].std() * np.sqrt(252)) if len(portfolio_returns[portfolio_returns < 0]) > 0 else 0.0,
            'max_drawdown': ((1 + portfolio_returns).cumprod() / (1 + portfolio_returns).cumprod().expanding().max() - 1).min() if len(portfolio_returns) > 0 else 0.0,
            'beta': beta_val,
            'tracking_error': (portfolio_returns - returns[self.benchmark_symbol]).std() * np.sqrt(252) if self.benchmark_symbol in returns.columns and len(portfolio_returns) > 0 else 0.0,
            'risk_contribution': risk_contribution
        }
    
    def _value_at_risk(self, returns: pd.Series, confidence_level: float = 0.95) -> float:
        """Calculate Value at Risk (VaR) using the historical method."""
        return returns.quantile(1 - confidence_level)

    def _conditional_var(self, returns: pd.Series, confidence_level: float = 0.95) -> float:
        """Calculate Conditional VaR (CVaR)."""
        var = self._value_at_risk(returns, confidence_level)
        return returns[returns <= var].mean()

    def _sharpe_ratio(self, returns: pd.Series, risk_free_rate: float = 0.02) -> float:
        """Calculate Sharpe Ratio."""
        if len(returns) == 0:
            return 0.0
        annualized_return = returns.mean() * 252
        annualized_volatility = returns.std() * np.sqrt(252)
        return (annualized_return - risk_free_rate) / annualized_volatility if annualized_volatility > 0 else 0.0

    def _sortino_ratio(self, returns: pd.Series, risk_free_rate: float = 0.02) -> float:
        """Calculate Sortino Ratio."""
        if len(returns) == 0:
            return 0.0
        annualized_return = returns.mean() * 252
        downside_returns = returns[returns < 0]
        if len(downside_returns) == 0:
            return 0.0
        downside_deviation = downside_returns.std() * np.sqrt(252)
        return (annualized_return - risk_free_rate) / downside_deviation if downside_deviation > 0 else 0.0

    def _beta(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate the portfolio beta."""
        if len(portfolio_returns) == 0 or len(benchmark_returns) == 0:
            return 0.0
        try:
            covariance = portfolio_returns.cov(benchmark_returns)
            benchmark_variance = benchmark_returns.var()
            return covariance / benchmark_variance if benchmark_variance > 0 else 0.0
        except Exception:
            return 0.0
    
    def _max_drawdown(self, returns: pd.Series) -> float:
        """Calculate Maximum Drawdown"""
        if len(returns) == 0:
            return 0.0
        try:
            cumulative = (1 + returns).cumprod()
            running_max = cumulative.expanding().max()
            drawdown = (cumulative - running_max) / running_max
            return drawdown.min()
        except Exception:
            return 0.0
    
    def get_correlation_matrix(self, symbols: List[str], period: str = "1y") -> pd.DataFrame:
        """Get the correlation matrix for a list of symbols."""
        price_data = self.data_client.get_price_data(symbols, period)
        returns = price_data.pct_change().dropna()
        return returns.corr()
    
    def _tracking_error(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate Tracking Error"""
        active_returns = portfolio_returns - benchmark_returns
        return active_returns.std() * np.sqrt(252)
    
    def _empty_risk_metrics(self) -> Dict:
        """Return empty risk metrics when no data available"""
        return {
            'portfolio_volatility': 0.0,
            'individual_volatilities': {},
            'avg_correlation': 0.0,
            'correlation_matrix': pd.DataFrame(),
            'var_5': -0.01,
            'cvar_5': -0.015,
            'var_95': 0.01,
            'cvar_95': 0.015,
            'sharpe_ratio': 0.0,
            'sortino_ratio': 0.0,
            'max_drawdown': 0.0,
            'beta': 0.0,
            'tracking_error': 0.0,
            'risk_contribution': {}
        }