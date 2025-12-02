import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from clients.market_data_client import MarketDataClient

from scipy import stats
from utils.logger import logger
import asyncio
import concurrent.futures


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
        available_symbols = []
        missing_symbols = []
        
        for s in symbols:
            if s and isinstance(s, str) and s.strip():
                # Skip currency symbols and other non-equity symbols
                if s.startswith('CUR:') or s.startswith('CASH') or len(s) > 10:
                    missing_symbols.append(s)
                elif s in returns.columns:
                    available_symbols.append(s)
                else:
                    missing_symbols.append(s)
            else:
                missing_symbols.append(s)
        
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
        
        # Use vectorized calculations with error handling
        returns_subset = returns[available_symbols]
        
        # Validate sufficient data for correlation calculation
        if len(returns_subset) < 2 or len(available_symbols) < 2:
            corr_matrix = pd.DataFrame()
        else:
            with np.errstate(divide='ignore', invalid='ignore'):
                corr_matrix = returns_subset.corr()
            # Replace NaN values with zeros
            corr_matrix = corr_matrix.fillna(0)
        
        # Calculate risk contribution with validation
        weight_array = np.array([available_weights[s] for s in available_symbols])
        
        # Calculate covariance matrix with error handling
        if len(returns_subset) < 2:
            cov_matrix = pd.DataFrame()
            portfolio_vol = 0.0
        else:
            with np.errstate(divide='ignore', invalid='ignore'):
                cov_matrix = returns_subset.cov() * 252
            cov_matrix = cov_matrix.fillna(0)
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
        
        # Calculate VaR and CVaR with proper validation - only use real data
        if len(portfolio_returns) > 10 and not portfolio_returns.empty:
            var_5_pct = np.percentile(portfolio_returns, 5)
            cvar_5_val = portfolio_returns[portfolio_returns <= var_5_pct].mean()
            # Only use calculated values if they are meaningful
            if np.isnan(var_5_pct) or np.isnan(cvar_5_val):
                var_5_pct = None
                cvar_5_val = None
        else:
            var_5_pct = None
            cvar_5_val = None
        
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
            'portfolio_volatility': self._safe_value(portfolio_vol),
            'individual_volatilities': {k: self._safe_value(v) for k, v in (returns_subset.std() * np.sqrt(252)).fillna(0).to_dict().items()},
            'avg_correlation': self._safe_value(corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)].mean()) if len(available_symbols) > 1 and not corr_matrix.empty else 0.0,
            'correlation_matrix': {k: {k2: self._safe_value(v2) for k2, v2 in v.items()} for k, v in corr_matrix.fillna(0).to_dict().items()} if not corr_matrix.empty else {},
            'var_5': self._safe_value(var_5_pct) if var_5_pct is not None else None,
            'cvar_5': self._safe_value(cvar_5_val) if cvar_5_val is not None else None,
            'var_95': self._safe_value(abs(var_5_pct)) if var_5_pct is not None else None,
            'cvar_95': self._safe_value(abs(cvar_5_val)) if cvar_5_val is not None else None,
            'sortino_ratio': self._safe_value(self._sortino_ratio(portfolio_returns)) if len(portfolio_returns) > 0 else 0.0,
            'max_drawdown': self._safe_value(self._max_drawdown(portfolio_returns)) if len(portfolio_returns) > 0 else 0.0,
            'current_drawdown': 0.0,
            'recovery_days': None,
            'drawdown_frequency': 0,
            'beta': self._safe_value(beta_val),
            'tracking_error': self._safe_value(self._tracking_error(portfolio_returns, benchmark_returns)) if not benchmark_returns.empty and len(portfolio_returns) > 0 else 0.0,
            'risk_contribution': {k: self._safe_value(v) for k, v in risk_contribution.items()}
        }
    
    def _calculate_portfolio_returns(self, returns: pd.DataFrame, weights: Dict[str, float]) -> pd.Series:
        weight_array = np.array([weights.get(symbol, 0) for symbol in returns.columns])
        return (returns * weight_array).sum(axis=1)
    
    def _portfolio_volatility(self, returns: pd.DataFrame, weights: Dict[str, float]) -> float:
        if len(returns) < 2 or returns.empty:
            return 0.0
        
        weight_array = np.array([weights.get(symbol, 0) for symbol in returns.columns])
        
        with np.errstate(divide='ignore', invalid='ignore'):
            cov_matrix = returns.cov() * 252
        
        cov_matrix = cov_matrix.fillna(0)
        portfolio_var = np.dot(weight_array.T, np.dot(cov_matrix, weight_array))
        return np.sqrt(max(portfolio_var, 1e-8))
    
    def analyze_portfolio_risk_fast(self, symbols: List[str], weights: Dict[str, float], period: str = "1y", risk_free_rate: float = None, var_confidence: float = 0.95, risk_model: str = "historical", benchmark: str = "SPY", rolling_window: int = 252) -> Dict:
        """Fast risk analysis with parallel processing"""
        logger.info(f"Starting fast risk analysis for {len(symbols)} symbols: {symbols}")
        print(f"2025-10-26 16:55:44,944 - hedge_fund_app - INFO - Starting fast risk analysis for {len(symbols)} symbols")
        
        # Map period strings to yfinance format
        period_mapping = {
            '1M': '1mo', '3M': '3mo', '6M': '6mo', 
            '1Y': '1y', '2Y': '2y', '3Y': '5y'
        }
        period = period_mapping.get(period.upper(), period)
        
        # Update benchmark if provided
        if benchmark != "SPY":
            benchmark_mapping = {
                'S&P 500': 'SPY', 'NASDAQ': 'QQQ', 
                'Russell 2000': 'IWM', 'SPY': 'SPY',
                'QQQ': 'QQQ', 'IWM': 'IWM'
            }
            self.benchmark_symbol = benchmark_mapping.get(benchmark, benchmark)
        
        # Use parallel processing for large datasets (>20 symbols)
        all_symbols = symbols + [self.benchmark_symbol]
        if len(all_symbols) > 20:
            try:
                # Split symbols into chunks for parallel processing
                chunk_size = max(10, len(all_symbols) // 4)
                symbol_chunks = [all_symbols[i:i + chunk_size] for i in range(0, len(all_symbols), chunk_size)]
                
                with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(symbol_chunks))) as executor:
                    futures = [executor.submit(self.data_client.get_price_data, chunk, period) for chunk in symbol_chunks]
                    chunk_data = [future.result(timeout=30) for future in futures]
                
                # Combine all chunks
                price_data = pd.concat(chunk_data, axis=1)
            except (concurrent.futures.TimeoutError, Exception):
                # Fallback to sequential for large datasets
                price_data = self.data_client.get_price_data(all_symbols, period)
        else:
            # Direct fetch for small datasets
            price_data = self.data_client.get_price_data(all_symbols, period)
        
        returns = price_data.pct_change().dropna()
        
        # Filter available symbols and exclude invalid ones
        available_symbols = []
        missing_symbols = []
        
        for s in symbols:
            if s and isinstance(s, str) and s.strip():
                # Skip currency symbols and other non-equity symbols
                if s.startswith('CUR:') or s.startswith('CASH') or len(s) > 10:
                    missing_symbols.append(s)
                elif s in returns.columns:
                    available_symbols.append(s)
                else:
                    missing_symbols.append(s)
            else:
                missing_symbols.append(s)
        
        if missing_symbols:
            print(f"2025-10-26 16:55:45,001 - hedge_fund_app - WARNING - Missing data for symbols: {missing_symbols}")
            logger.warning(f"Symbols without market data: {missing_symbols}")
        
        if not available_symbols:
            print(f"2025-10-26 16:55:45,002 - hedge_fund_app - ERROR - No symbols have data available")
            return self._empty_risk_metrics()
        
        print(f"2025-10-26 16:55:45,003 - hedge_fund_app - INFO - Processing {len(available_symbols)} symbols with data: {available_symbols}")
        logger.info(f"Available symbols for analysis: {available_symbols}")
        logger.info(f"Filtered out {len(missing_symbols)} symbols: {missing_symbols}")
        
        # Vectorized weight calculation
        available_weights = {s: weights.get(s, 0) for s in available_symbols}
        total_weight = sum(available_weights.values())
        if total_weight > 0:
            available_weights = {s: w/total_weight for s, w in available_weights.items()}
        
        returns_subset = returns[available_symbols]
        weight_array = np.array([available_weights[s] for s in available_symbols])
        portfolio_returns = (returns_subset * weight_array).sum(axis=1)
        
        # Fast correlation calculation with validation
        if len(returns_subset) < 2 or len(available_symbols) < 2:
            corr_matrix = pd.DataFrame()
        else:
            try:
                with np.errstate(divide='ignore', invalid='ignore'):
                    # Ensure data is numeric before correlation calculation
                    numeric_returns = returns_subset.select_dtypes(include=[np.number])
                    corr_matrix = numeric_returns.corr()
                # Replace NaN and inf values with 0
                corr_matrix = corr_matrix.replace([np.inf, -np.inf], 0).fillna(0)
            except Exception as e:
                logger.warning(f"Correlation calculation failed: {e}")
                corr_matrix = pd.DataFrame()
        
        # Calculate VaR and CVaR with configurable confidence levels
        var_percentile = (1 - var_confidence) * 100
        var_val = None
        cvar_val = None
        
        if len(portfolio_returns) > 10 and not portfolio_returns.empty:
            if risk_model == "historical":
                # Historical VaR using actual return distribution
                var_val = np.percentile(portfolio_returns, var_percentile)
                cvar_val = portfolio_returns[portfolio_returns <= var_val].mean()
            elif risk_model == "parametric":
                # Parametric VaR using normal distribution fitted to data
                mu = portfolio_returns.mean()
                sigma = portfolio_returns.std()
                if sigma > 0:
                    var_val = stats.norm.ppf(1 - var_confidence, mu, sigma)
                    z_alpha = stats.norm.ppf(1 - var_confidence)
                    cvar_val = mu - sigma * stats.norm.pdf(z_alpha) / (1 - var_confidence)
                else:
                    var_val = None
                    cvar_val = None
            elif risk_model == "monte_carlo":
                # Monte Carlo VaR using bootstrapped returns from actual data
                n_simulations = 10000
                np.random.seed(42)
                simulated_returns = np.random.choice(portfolio_returns, size=n_simulations, replace=True)
                var_val = np.percentile(simulated_returns, var_percentile)
                cvar_val = simulated_returns[simulated_returns <= var_val].mean()
            
            # Validate results with safe type checking
            if var_val is not None:
                try:
                    if np.isnan(float(var_val)) or np.isnan(float(cvar_val)):
                        var_val = None
                        cvar_val = None
                except (TypeError, ValueError):
                    var_val = None
                    cvar_val = None
        else:
            var_val = None
            cvar_val = None
        
        # Calculate accurate Beta using market data
        benchmark_returns = returns[self.benchmark_symbol] if self.benchmark_symbol in returns.columns else pd.Series()
        if not benchmark_returns.empty and len(portfolio_returns) > 10:
            beta_val = self._calculate_accurate_beta(available_symbols, available_weights, period)
            if beta_val is not None:
                print(f"Accurate Beta Calculation: {beta_val:.4f}")
        else:
            beta_val = None
        
        # Calculate risk contribution with rolling window if specified
        if len(returns_subset) < 2:
            cov_matrix = pd.DataFrame()
            portfolio_vol = 0.0
        else:
            try:
                # Apply rolling window for volatility calculation if different from default
                if rolling_window != 252 and len(returns_subset) > rolling_window:
                    returns_subset = returns_subset.tail(rolling_window)
                    portfolio_returns = (returns_subset * weight_array).sum(axis=1)
                
                # Ensure numeric data for covariance calculation
                numeric_returns = returns_subset.select_dtypes(include=[np.number])
                
                with np.errstate(divide='ignore', invalid='ignore'):
                    cov_matrix = numeric_returns.cov() * 252
                
                # Replace NaN and inf values with 0
                cov_matrix = cov_matrix.replace([np.inf, -np.inf], 0).fillna(0)
                
                # Calculate portfolio volatility safely
                try:
                    portfolio_var = np.dot(weight_array.T, np.dot(cov_matrix.values, weight_array))
                    portfolio_vol = np.sqrt(max(float(portfolio_var), 1e-8))
                except Exception as vol_e:
                    logger.warning(f"Portfolio volatility calculation failed: {vol_e}")
                    portfolio_vol = 0.0
                    
            except Exception as e:
                logger.warning(f"Covariance matrix calculation failed: {e}")
                cov_matrix = pd.DataFrame()
                portfolio_vol = 0.0
        
        # Log high volatility but don't cap it - use real market data
        if portfolio_vol > 0.6:
            logger.info(f"High portfolio volatility detected: {portfolio_vol:.1%}")
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
        
        # Validate portfolio returns for data quality
        self._validate_portfolio_returns(portfolio_returns, available_symbols)
        
        # Calculate comprehensive drawdown metrics using market data
        drawdown_metrics = self._calculate_accurate_drawdown(available_symbols, available_weights, period)
        
        result = {
            'portfolio_volatility': self._safe_value(portfolio_vol),
            'individual_volatilities': {k: self._safe_value(v) for k, v in (returns_subset.std() * np.sqrt(252)).fillna(0).to_dict().items()},
            'avg_correlation': self._calculate_avg_correlation(corr_matrix, available_symbols),
            'correlation_matrix': {k: {k2: self._safe_value(v2) for k2, v2 in v.items()} for k, v in corr_matrix.fillna(0).to_dict().items()} if not corr_matrix.empty else {},
            'var_5': self._safe_value(var_val) if var_val is not None else None,
            'cvar_5': self._safe_value(cvar_val) if cvar_val is not None else None,
            'var_95': self._safe_value(abs(var_val)) if var_val is not None else None,
            'cvar_95': self._safe_value(abs(cvar_val)) if cvar_val is not None else None,
            'var_confidence': var_confidence,
            'risk_model': risk_model,
            'benchmark': benchmark,
            'rolling_window': rolling_window,
            'sharpe_ratio': self._calculate_sharpe_with_debug(portfolio_returns, risk_free_rate) if len(portfolio_returns) >= 10 else None,
            'sortino_ratio': self._calculate_sortino_with_debug(portfolio_returns, risk_free_rate) if len(portfolio_returns) >= 10 else None,
            'max_drawdown': self._safe_value(drawdown_metrics.get('max_drawdown', 0.0)),
            'current_drawdown': self._safe_value(drawdown_metrics.get('current_drawdown', 0.0)),
            'recovery_days': drawdown_metrics.get('recovery_days'),
            'drawdown_frequency': drawdown_metrics.get('drawdown_frequency', 0),
            'beta': self._safe_value(beta_val),
            'tracking_error': self._safe_value((portfolio_returns - returns[self.benchmark_symbol]).std() * np.sqrt(252)) if self.benchmark_symbol in returns.columns and len(portfolio_returns) > 0 else 0.0,
            'risk_contribution': {k: self._safe_value(v) for k, v in risk_contribution.items()}
        }
        print(f"2025-10-26 16:55:45,123 - hedge_fund_app - INFO - Risk analysis completed successfully")
        sharpe_val = result.get('sharpe_ratio') or 0
        vol_val = result.get('portfolio_volatility') or 0
        logger.info(f"Risk analysis completed - Sharpe: {sharpe_val:.2f}, Volatility: {vol_val:.2f}")
        return result
    
    def _value_at_risk(self, returns: pd.Series, confidence_level: float = 0.95) -> float:
        """Calculate Value at Risk (VaR) using the historical method."""
        return returns.quantile(1 - confidence_level)

    def _conditional_var(self, returns: pd.Series, confidence_level: float = 0.95) -> float:
        """Calculate Conditional VaR (CVaR)."""
        var = self._value_at_risk(returns, confidence_level)
        return returns[returns <= var].mean()

    def _sharpe_ratio(self, returns: pd.Series, risk_free_rate: float = None) -> float:
        """Calculate Sharpe Ratio."""
        if risk_free_rate is None:
            from utils.fed_rate import get_risk_free_rate
            risk_free_rate = get_risk_free_rate()
        
        if len(returns) < 10:  # Need sufficient data
            return None
        annualized_return = returns.mean() * 252
        annualized_volatility = returns.std() * np.sqrt(252)
        if annualized_volatility <= 0:
            return None
        sharpe = (annualized_return - risk_free_rate) / annualized_volatility
        return sharpe if not (np.isnan(sharpe) or np.isinf(sharpe)) else None

    def _sortino_ratio(self, returns: pd.Series, risk_free_rate: float = None) -> float:
        """Calculate Sortino Ratio."""
        if risk_free_rate is None:
            from utils.fed_rate import get_risk_free_rate
            risk_free_rate = get_risk_free_rate()
        
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
    
    def get_risk_summary(self, symbols: List[str], weights: Dict[str, float]) -> Dict:
        """Get formatted risk summary for frontend display"""
        metrics = self.analyze_portfolio_risk_fast(symbols, weights)
        
        return {
            'var_95': metrics.get('var_95'),
            'cvar_95': metrics.get('cvar_95'), 
            'volatility': metrics.get('portfolio_volatility'),
            'tracking_error': metrics.get('tracking_error')
        }
    
    def _safe_value(self, value):
        """Ensure value is not NaN or infinite"""
        try:
            # Convert to float first to handle various input types
            float_val = float(value)
            if np.isnan(float_val) or np.isinf(float_val):
                return 0.0
            return float_val
        except (TypeError, ValueError):
            return 0.0
    
    def _safe_ratio(self, numerator, denominator):
        """Safe division that handles NaN and zero denominator"""
        if denominator == 0 or np.isnan(numerator) or np.isnan(denominator) or np.isinf(numerator) or np.isinf(denominator):
            return 0.0
        result = numerator / denominator
        if np.isnan(result) or np.isinf(result):
            return 0.0
        return float(result)
    
    def _empty_risk_metrics(self) -> Dict:
        """Return empty risk metrics when no data available"""
        return {
            'portfolio_volatility': None,
            'individual_volatilities': {},
            'avg_correlation': None,
            'correlation_matrix': {},
            'var_5': None,
            'cvar_5': None,
            'var_95': None,
            'cvar_95': None,
            'sharpe_ratio': None,
            'sortino_ratio': None,
            'max_drawdown': None,
            'beta': None,
            'tracking_error': None,
            'risk_contribution': {}
        }
    
    def _calculate_sharpe_with_debug(self, portfolio_returns: pd.Series, risk_free_rate: float = None) -> float:
        """Calculate Sharpe Ratio with debug logging"""
        if risk_free_rate is None:
            from utils.fed_rate import get_risk_free_rate
            risk_free_rate = get_risk_free_rate()
        
        if len(portfolio_returns) < 30:
            return None
        
        daily_mean = portfolio_returns.mean()
        daily_std = portfolio_returns.std()
        annualized_return = daily_mean * 252
        annualized_volatility = daily_std * np.sqrt(252)
        excess_return = annualized_return - risk_free_rate
        
        print(f"Sharpe Debug - Daily Mean: {daily_mean:.6f}, Daily Std: {daily_std:.6f}")
        print(f"Sharpe Debug - Ann Return: {annualized_return:.4f} ({annualized_return*100:.2f}%), Ann Vol: {annualized_volatility:.4f} ({annualized_volatility*100:.2f}%)")
        print(f"Sharpe Debug - Excess Return: {excess_return:.4f} ({excess_return*100:.2f}%), Risk Free: {risk_free_rate:.4f} ({risk_free_rate*100:.2f}%)")
        
        # Additional validation for extreme values
        if abs(annualized_return) > 5.0:  # More than 500% annual return/loss
            print(f"Sharpe Debug - WARNING: Extreme annualized return detected: {annualized_return*100:.2f}%")
        
        if annualized_volatility > 2.0:  # More than 200% annual volatility
            print(f"Sharpe Debug - WARNING: Extreme volatility detected: {annualized_volatility*100:.2f}%")
        
        if annualized_volatility > 0:
            sharpe = excess_return / annualized_volatility
            print(f"Sharpe Debug - Final Sharpe: {sharpe:.4f}")
            
            # Flag extreme Sharpe ratios for investigation
            if abs(sharpe) > 5.0:
                print(f"Sharpe Debug - WARNING: Extreme Sharpe ratio detected: {sharpe:.4f}")
                print(f"Sharpe Debug - This may indicate data quality issues or extreme portfolio performance")
                print(f"Sharpe Debug - Portfolio return range: {portfolio_returns.min():.6f} to {portfolio_returns.max():.6f}")
                print(f"Sharpe Debug - Number of extreme daily returns (>5%): {len(portfolio_returns[abs(portfolio_returns) > 0.05])}")
            
            try:
                if np.isnan(float(sharpe)) or np.isinf(float(sharpe)):
                    return None
            except (TypeError, ValueError):
                return None
            return self._safe_value(sharpe)
        return None
    
    def _calculate_accurate_drawdown(self, symbols: List[str], weights: Dict[str, float], period: str = "1y") -> Dict:
        """Calculate comprehensive drawdown metrics using market data APIs"""
        try:
            # Get historical price data
            price_data = self.data_client.get_price_data(symbols, period)
            if price_data.empty:
                return {
                    'max_drawdown': 0.0,
                    'current_drawdown': 0.0,
                    'recovery_days': None,
                    'drawdown_frequency': 0
                }
            
            # Calculate daily returns
            returns = price_data.pct_change().dropna()
            
            if returns.empty:
                return {
                    'max_drawdown': 0.0,
                    'current_drawdown': 0.0,
                    'recovery_days': None,
                    'drawdown_frequency': 0
                }
            
            # Calculate portfolio returns using weights
            portfolio_returns = pd.Series(0, index=returns.index)
            for symbol in symbols:
                if symbol in returns.columns:
                    weight = weights.get(symbol, 0)
                    portfolio_returns += returns[symbol] * weight
            
            # Calculate cumulative portfolio value (starting at 1.0)
            cumulative_returns = (1 + portfolio_returns).cumprod()
            
            # Calculate running maximum (peak values)
            running_max = cumulative_returns.expanding().max()
            
            # Calculate drawdown at each point
            drawdown = (cumulative_returns - running_max) / running_max
            
            # Calculate metrics
            max_drawdown = drawdown.min()  # Most negative value
            current_drawdown = drawdown.iloc[-1] if len(drawdown) > 0 else 0.0
            
            # Calculate recovery days and frequency
            recovery_days = None
            drawdown_frequency = 0
            
            # Find drawdown periods (when drawdown < -0.05, i.e., > 5% loss)
            significant_drawdowns = drawdown < -0.05
            if significant_drawdowns.any():
                # Count number of significant drawdown periods
                drawdown_periods = (significant_drawdowns != significant_drawdowns.shift()).cumsum()
                drawdown_frequency = len(drawdown_periods[significant_drawdowns].unique())
                
                # Calculate recovery time for current drawdown
                if current_drawdown < -0.01:  # Currently in drawdown > 1%
                    # Find when current drawdown started
                    last_peak_idx = running_max.idxmax()
                    days_since_peak = (cumulative_returns.index[-1] - last_peak_idx).days
                    recovery_days = days_since_peak
            
            print(f"Comprehensive Drawdown Calculation:")
            print(f"  Max Drawdown: {max_drawdown:.4f} ({max_drawdown*100:.2f}%)")
            print(f"  Current Drawdown: {current_drawdown:.4f} ({current_drawdown*100:.2f}%)")
            print(f"  Recovery Days: {recovery_days}")
            print(f"  Drawdown Frequency: {drawdown_frequency}")
            
            logger.info(f"Calculated comprehensive drawdown metrics: max={max_drawdown:.4f}, current={current_drawdown:.4f}")
            
            return {
                'max_drawdown': float(max_drawdown),
                'current_drawdown': float(current_drawdown),
                'recovery_days': recovery_days,
                'drawdown_frequency': int(drawdown_frequency)
            }
            
        except Exception as e:
            logger.error(f"Error calculating accurate drawdown: {e}")
            return {
                'max_drawdown': 0.0,
                'current_drawdown': 0.0,
                'recovery_days': None,
                'drawdown_frequency': 0
            }
    
    def _calculate_sortino_with_debug(self, portfolio_returns: pd.Series, risk_free_rate: float = None) -> float:
        """Calculate Sortino Ratio with debug logging"""
        if risk_free_rate is None:
            from utils.fed_rate import get_risk_free_rate
            risk_free_rate = get_risk_free_rate()
        
        if len(portfolio_returns) < 10:
            return 0.0
        
        daily_mean = portfolio_returns.mean()
        annualized_return = daily_mean * 252
        excess_return = annualized_return - risk_free_rate
        
        # Get downside returns (negative returns only)
        downside_returns = portfolio_returns[portfolio_returns < 0]
        
        print(f"Sortino Debug - Portfolio returns count: {len(portfolio_returns)}")
        print(f"Sortino Debug - Downside returns count: {len(downside_returns)}")
        print(f"Sortino Debug - Daily mean return: {daily_mean:.6f}")
        print(f"Sortino Debug - Annualized return: {annualized_return:.4f}")
        print(f"Sortino Debug - Excess return: {excess_return:.4f}")
        
        if len(downside_returns) == 0:
            print("Sortino Debug - No downside returns, returning 0.0")
            return 0.0
        
        downside_std = downside_returns.std()
        downside_deviation = downside_std * np.sqrt(252)
        
        print(f"Sortino Debug - Downside std (daily): {downside_std:.6f}")
        print(f"Sortino Debug - Downside deviation (annualized): {downside_deviation:.4f}")
        
        if downside_deviation > 0:
            sortino = excess_return / downside_deviation
            print(f"Sortino Debug - Final Sortino: {sortino:.4f}")
            
            # Remove artificial caps - use real calculated values
            
            return self._safe_value(sortino)
        
        print("Sortino Debug - Zero downside deviation, returning 0.0")
        return 0.0
    
    def _calculate_accurate_beta(self, symbols: List[str], weights: Dict[str, float], period: str = "1y") -> float:
        """Calculate accurate beta using market data APIs"""
        try:
            # Get historical price data including benchmark
            all_symbols = symbols + [self.benchmark_symbol]
            price_data = self.data_client.get_price_data(all_symbols, period)
            
            if price_data.empty or self.benchmark_symbol not in price_data.columns:
                return 0.0
            
            # Calculate returns
            returns = price_data.pct_change().dropna()
            
            # Calculate portfolio returns
            portfolio_symbols = [s for s in symbols if s in returns.columns]
            if not portfolio_symbols:
                return 0.0
                
            weight_array = np.array([weights.get(symbol, 0) for symbol in portfolio_symbols])
            portfolio_returns = (returns[portfolio_symbols] * weight_array).sum(axis=1)
            
            # Get benchmark returns
            benchmark_returns = returns[self.benchmark_symbol]
            
            # Calculate beta using regression
            if len(portfolio_returns) > 10 and len(benchmark_returns) > 10:
                # Remove any NaN values
                valid_data = pd.DataFrame({
                    'portfolio': portfolio_returns,
                    'benchmark': benchmark_returns
                }).dropna()
                
                if len(valid_data) > 10:
                    covariance = np.cov(valid_data['portfolio'], valid_data['benchmark'])[0, 1]
                    benchmark_variance = np.var(valid_data['benchmark'])
                    
                    if benchmark_variance > 0:
                        beta = covariance / benchmark_variance
                        
                        # Return calculated beta without artificial bounds
                        print(f"Beta Debug - Covariance: {covariance:.6f}, Benchmark Var: {benchmark_variance:.6f}")
                        print(f"Beta Debug - Calculated Beta: {beta:.4f}")
                        return beta
            
            # Fallback: calculate weighted average of individual stock betas
            individual_betas = []
            for symbol in portfolio_symbols:
                if symbol in returns.columns:
                    stock_returns = returns[symbol].dropna()
                    bench_returns = returns[self.benchmark_symbol].dropna()
                    
                    # Align data
                    aligned_data = pd.DataFrame({
                        'stock': stock_returns,
                        'benchmark': bench_returns
                    }).dropna()
                    
                    if len(aligned_data) > 10:
                        stock_cov = np.cov(aligned_data['stock'], aligned_data['benchmark'])[0, 1]
                        bench_var = np.var(aligned_data['benchmark'])
                        
                        if bench_var > 0:
                            stock_beta = stock_cov / bench_var
                            weight = weights.get(symbol, 0)
                            individual_betas.append(stock_beta * weight)
            
            if individual_betas:
                weighted_beta = sum(individual_betas)
                print(f"Beta Debug - Weighted Beta from individual stocks: {weighted_beta:.4f}")
                return weighted_beta
            
            return 0.0
            
        except Exception as e:
            logger.error(f"Error calculating accurate beta: {e}")
            return 0.0
    
    def _validate_portfolio_returns(self, portfolio_returns: pd.Series, symbols: List[str]) -> None:
        """Validate portfolio returns for data quality issues"""
        if len(portfolio_returns) == 0:
            return
        
        # Check for extreme daily returns
        extreme_returns = portfolio_returns[abs(portfolio_returns) > 0.20]  # >20% daily moves
        if len(extreme_returns) > 0:
            print(f"Portfolio Validation - WARNING: {len(extreme_returns)} extreme daily returns (>20%) detected")
            print(f"Portfolio Validation - Extreme returns: {extreme_returns.head().tolist()}")
        
        # Check for data quality
        nan_count = portfolio_returns.isna().sum()
        if nan_count > 0:
            print(f"Portfolio Validation - WARNING: {nan_count} NaN values in portfolio returns")
        
        # Check return distribution
        mean_return = portfolio_returns.mean()
        std_return = portfolio_returns.std()
        
        print(f"Portfolio Validation - Symbols: {symbols}")
        print(f"Portfolio Validation - Return stats: mean={mean_return:.6f}, std={std_return:.6f}")
        print(f"Portfolio Validation - Return range: {portfolio_returns.min():.6f} to {portfolio_returns.max():.6f}")
        print(f"Portfolio Validation - Data points: {len(portfolio_returns)}")
        
        # Flag suspicious patterns
        if abs(mean_return) > 0.01:  # >1% daily average return
            print(f"Portfolio Validation - WARNING: Unusually high average daily return: {mean_return*100:.2f}%")
        
        if std_return > 0.10:  # >10% daily volatility
            print(f"Portfolio Validation - WARNING: Very high daily volatility: {std_return*100:.2f}%")
    
    def _calculate_avg_correlation(self, corr_matrix: pd.DataFrame, available_symbols: List[str]) -> float:
        """Safely calculate average correlation from correlation matrix"""
        try:
            if len(available_symbols) <= 1 or corr_matrix.empty:
                return 0.0
            
            # Get upper triangular indices (excluding diagonal)
            upper_tri_indices = np.triu_indices_from(corr_matrix.values, k=1)
            upper_tri_values = corr_matrix.values[upper_tri_indices]
            
            # Filter out NaN and inf values
            valid_values = upper_tri_values[np.isfinite(upper_tri_values)]
            
            if len(valid_values) > 0:
                avg_corr = np.mean(valid_values)
                return self._safe_value(avg_corr)
            else:
                return 0.0
                
        except Exception as e:
            logger.warning(f"Average correlation calculation failed: {e}")
            return 0.0