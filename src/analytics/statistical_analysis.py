import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from clients.market_data_client import MarketDataClient
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

class StatisticalAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
        self.benchmarks = {
            'SPY': 'S&P 500',
            'QQQ': 'NASDAQ 100', 
            'IWM': 'Russell 2000',
            'VTI': 'Total Stock Market',
            'EFA': 'International Developed',
            'EEM': 'Emerging Markets'
        }
    
    def _ewma_cov(self, returns: pd.DataFrame, lambda_: float) -> np.ndarray:
        """
        Exponentially Weighted Moving Average Covariance
        Args:
            returns: DataFrame of asset returns
            lambda_: Decay factor (0 < lambda < 1)
        Returns:
            Covariance matrix as numpy array
        """
        demeaned = returns - returns.mean()
        n_assets = returns.shape[1]
        cov = np.zeros((n_assets, n_assets))
        
        # Optimize loop using numpy values
        values = demeaned.values
        for t in range(len(values)):
            x = values[t].reshape(-1, 1)
            cov = lambda_ * cov + (1 - lambda_) * (x @ x.T)
            
        return cov

    def _compute_horizon_stats(self, returns: pd.DataFrame, horizon_config: Dict, horizon_name: str) -> Dict:
        """Compute correlation statistics for a specific horizon"""
        
        # 1. EWMA Correlation
        lambda_val = 0.97 if horizon_name == 'long' else 0.94 if horizon_name == 'medium' else 0.90
        
        cov_matrix = self._ewma_cov(returns, lambda_val)
        std_devs = np.sqrt(np.diag(cov_matrix))
        ewma_corr = cov_matrix / np.outer(std_devs, std_devs)
        
        # Fix numerical issues
        np.fill_diagonal(ewma_corr, 1.0)
        ewma_corr = np.clip(ewma_corr, -1.0, 1.0)
        
        # 2. Rolling Correlation Statistics
        # Parse window string to integer
        window_str = horizon_config['rolling_window']
        if window_str.endswith('obs'):
            window = int(window_str.replace('obs', ''))
        elif window_str.endswith('d'):
            window = int(window_str.replace('d', ''))
        elif window_str.endswith('y'):
            window = 104 if horizon_config['freq'] == 'W' else 504 
        else:
            window = 100 
            
        rolling_corr = returns.rolling(window=window).corr()
        
        # Compress rolling correlations into summary matrices
        n_assets = len(returns.columns)
        mean_corr = np.zeros((n_assets, n_assets))
        stress_corr = np.zeros((n_assets, n_assets)) # 90th percentile
        divers_corr = np.zeros((n_assets, n_assets)) # 10th percentile
        
        symbols = returns.columns
        
        # Optimize extraction using numpy for efficiency where possible, but MultiIndex slicing is straightforward
        for i, sym1 in enumerate(symbols):
            for j, sym2 in enumerate(symbols):
                if i == j:
                    mean_corr[i, j] = 1.0
                    stress_corr[i, j] = 1.0
                    divers_corr[i, j] = 1.0
                    continue
                
                try:
                    # Rolling corr has MultiIndex (Date, Symbol) or similar
                    # Efficient access: rolling_corr is (N*T) x N matrix or similar
                    # xs(sym1, level=1)[sym2] is reliable
                    pair_corrs = rolling_corr.xs(sym1, level=1)[sym2]
                    valid_corrs = pair_corrs.dropna()
                    
                    if not valid_corrs.empty:
                        mean_corr[i, j] = valid_corrs.mean()
                        stress_corr[i, j] = valid_corrs.quantile(0.90)
                        divers_corr[i, j] = valid_corrs.quantile(0.10)
                    else:
                        mean_corr[i, j] = ewma_corr[i, j]
                        stress_corr[i, j] = ewma_corr[i, j]
                        divers_corr[i, j] = ewma_corr[i, j]
                        
                except Exception:
                    # Fallback
                    mean_corr[i, j] = ewma_corr[i, j]
                    stress_corr[i, j] = ewma_corr[i, j]
                    divers_corr[i, j] = ewma_corr[i, j]

        return {
            'mean_correlation_matrix': pd.DataFrame(mean_corr, index=symbols, columns=symbols).to_dict(),
            'stress_correlation_matrix': pd.DataFrame(stress_corr, index=symbols, columns=symbols).to_dict(),
            'diversification_correlation_matrix': pd.DataFrame(divers_corr, index=symbols, columns=symbols).to_dict()
        }
    def correlation_analysis(self, symbols: List[str], horizons: Dict = None, period: str = "3mo", method: str = "pearson") -> Dict:
        """
        Institutional-Grade Multi-Horizon Correlation Engine
        Computes Mean, Stress (90%), and Diversification (10%) correlation matrices
        for Long, Medium, and Short term horizons.
        
        Args:
            symbols: List of symbols to analyze
            horizons: Optional custom horizon/frequency configuration
            period: legacy parameter (ignored for multi-horizon but kept for signature)
            method: legacy parameter (ignored)
        """
        if not horizons:
            horizons = {
                "long":   {"freq": "W", "lookback": "10y", "rolling_window": "2y"},
                "medium": {"freq": "D", "lookback": "2y", "rolling_window": "100d"},
                "short":  {"freq": "H", "lookback": "3mo", "rolling_window": "100obs"}
            }
            
        results = {}
        
        for horizon_term, config in horizons.items():
            try:
                # 1. Pull Data - Independent per horizon
                price_data = None
                
                if horizon_term == 'long':
                    # Strict: Pull data using config lookback (default 10y), resample "W"
                    lookback = config.get('lookback', '10y')
                    price_data = self.data_client.get_price_data(symbols, lookback, interval="1d")
                    if price_data is not None and not price_data.empty:
                        price_data = price_data.resample("W").last()
                        
                elif horizon_term == 'medium':
                     # Strict: Pull data using config lookback (default 2y)
                    lookback = config.get('lookback', '2y')
                    price_data = self.data_client.get_price_data(symbols, lookback, interval="1d")
                    
                elif horizon_term == 'short':
                    # Strict: Pull data using config lookback (default 3mo)
                    lookback = config.get('lookback', '3mo')
                    price_data = self.data_client.get_price_data(symbols, lookback, interval="1h")



                # Validation
                if price_data is None or price_data.empty:
                    # Provide empty valid structure if data fail
                    results[f"{horizon_term}_term"] = {
                        "frequency": "weekly" if config['freq'] == 'W' else "daily" if config['freq'] == 'D' else "hourly",
                        "lookback": config['lookback'],
                        "rolling_window": config['rolling_window'],
                        "mean_correlation_matrix": {},
                        "stress_correlation_matrix": {},
                        "diversification_correlation_matrix": {},
                        "error": "No data available"
                    }
                    continue
                    
                # 2. Log Returns (Mandatory)
                returns = np.log(price_data / price_data.shift(1)).dropna()
                
                # Check for insufficient data
                min_obs = 10
                if returns.empty or len(returns) < min_obs:
                     results[f"{horizon_term}_term"] = {
                        "frequency": "weekly" if config['freq'] == 'W' else "daily" if config['freq'] == 'D' else "hourly",
                        "lookback": config['lookback'],
                        "rolling_window": config['rolling_window'],
                        "mean_correlation_matrix": {},
                        "stress_correlation_matrix": {},
                        "diversification_correlation_matrix": {},
                        "error": "Insufficient return data"
                    }
                     continue

                # 3. Compute Stats
                horizon_stats = self._compute_horizon_stats(returns, config, horizon_term)
                
                # 4. Final Output Structure
                results[f"{horizon_term}_term"] = {
                    "frequency": "weekly" if config['freq'] == 'W' else "daily" if config['freq'] == 'D' else "hourly",
                    "lookback": config['lookback'],
                    "rolling_window": config['rolling_window'],
                    **horizon_stats
                }
                
            except Exception as e:
                print(f"Error calculating {horizon_term} correlation: {e}")
                results[f"{horizon_term}_term"] = {
                    "error": str(e),
                    "mean_correlation_matrix": {}
                }

        return results

    
    def diversification_ratio(self, symbols: List[str], weights: Dict[str, float], period: str = "3mo") -> float:
        """Portfolio diversification effectiveness measurement"""
        price_data = self.data_client.get_price_data(symbols, period)
        returns = price_data.pct_change().dropna()
        
        # Individual volatilities
        individual_vols = returns.std() * np.sqrt(252)
        
        # Weighted average of individual volatilities
        weight_array = np.array([weights.get(symbol, 0) for symbol in symbols])
        weighted_avg_vol = np.sum(weight_array * individual_vols)
        
        # Portfolio volatility
        cov_matrix = returns.cov() * 252
        portfolio_vol = np.sqrt(np.dot(weight_array.T, np.dot(cov_matrix, weight_array)))
        
        # Diversification ratio
        return weighted_avg_vol / portfolio_vol if portfolio_vol > 0 else 0
    
    def effective_number_of_assets(self, weights: Dict[str, float]) -> float:
        """Concentration risk assessment"""
        weight_values = list(weights.values())
        herfindahl_index = sum(w**2 for w in weight_values)
        return 1 / herfindahl_index if herfindahl_index > 0 else 0
    
    def simple_clustering(self, symbols: List[str], period: str = "3mo") -> Dict:
        """Simple correlation-based grouping"""
        try:
            price_data = self.data_client.get_price_data(symbols, period)
            returns = price_data.pct_change().dropna()
            correlation_matrix = returns.corr()
            
            # Simple clustering based on correlation threshold
            clusters = {}
            used_symbols = set()
            cluster_id = 1
            
            for symbol in symbols:
                if symbol in used_symbols:
                    continue
                
                cluster = [symbol]
                used_symbols.add(symbol)
                
                for other_symbol in symbols:
                    if other_symbol != symbol and other_symbol not in used_symbols:
                        if symbol in correlation_matrix.columns and other_symbol in correlation_matrix.columns:
                            corr = abs(correlation_matrix.loc[symbol, other_symbol])
                            if corr > 0.7:
                                cluster.append(other_symbol)
                                used_symbols.add(other_symbol)
                
                clusters[cluster_id] = cluster
                cluster_id += 1
            
            return {'clusters': clusters}
        except Exception:
            return {'clusters': {1: symbols}}
    
    def advanced_statistical_analysis(self, symbols: List[str], weights: Dict[str, float] = None, 
                                    lookback_period: str = '1Y', frequency: str = 'Daily',
                                    benchmark: str = 'SPY', confidence_level: float = 0.95) -> Dict:
        """Advanced statistical analysis with interactive parameters"""
        try:
            # Convert parameters
            period_map = {'3M': '3mo', '6M': '6mo', '1Y': '1y', '2Y': '2y', '3Y': '3y'}
            period = period_map.get(lookback_period, '1y')
            
            # Get market data
            all_symbols = symbols + [benchmark] if benchmark not in symbols else symbols
            price_data = self.data_client.get_price_data(all_symbols, period)
            
            if price_data is None or price_data.empty:
                return {'error': 'No market data available'}
            
            # Resample based on frequency
            if frequency == 'Weekly':
                price_data = price_data.resample('W').last()
            elif frequency == 'Monthly':
                price_data = price_data.resample('M').last()
            
            # Calculate returns
            # Check for data limitations before dropping NaNs
            first_valid_indices = price_data.apply(lambda x: x.first_valid_index())
            if not first_valid_indices.empty:
                latest_start_date = first_valid_indices.max()
                limiting_symbol = first_valid_indices.idxmax()
            else:
                latest_start_date = None
                limiting_symbol = None

            returns = price_data.pct_change().dropna()
            
            if returns.empty:
                return {'error': 'Insufficient return data'}
            
            # Align symbols with available data
            valid_symbols = [s for s in symbols if s in returns.columns]
            
            if not valid_symbols:
                return {'error': f'No valid data found for symbols: {symbols}. Market data source provided: {list(returns.columns)}'}
            
            # Warn if some symbols are missing
            missing_symbols = set(symbols) - set(valid_symbols)
            if missing_symbols:
                print(f"[Statistical Analysis] Warning: Missing data for symbols: {missing_symbols}")

            # Portfolio returns if weights provided
            portfolio_returns = None
            if weights:
                # Filter weights to valid symbols
                valid_weights = {k: v for k, v in weights.items() if k in valid_symbols}
                # Renormalize weights
                total_w = sum(valid_weights.values())
                if total_w > 0:
                    valid_weights = {k: v/total_w for k, v in valid_weights.items()}
                
                if valid_weights:
                    portfolio_returns = (returns[valid_symbols] * pd.Series(valid_weights)).sum(axis=1)
            
            # Benchmark returns
            benchmark_returns = returns[benchmark] if benchmark in returns.columns else None
            
            results = {
                'parameters': {
                    'lookback_period': lookback_period,
                    'frequency': frequency,
                    'benchmark': f"{benchmark} ({self.benchmarks.get(benchmark, 'Custom')})",
                    'confidence_level': confidence_level,
                    'data_points': len(returns),
                    'symbols_analyzed': len(valid_symbols),
                    'missing_symbols': list(missing_symbols),
                    'limiting_symbol': limiting_symbol,
                    'limiting_date': latest_start_date.strftime('%Y-%m-%d') if latest_start_date else None
                },
                'correlation_analysis': self._calculate_correlations(returns[valid_symbols], confidence_level),
                'risk_metrics': self._calculate_risk_metrics(returns[valid_symbols], confidence_level, frequency),
                'performance_metrics': self._calculate_performance_metrics(returns[valid_symbols], benchmark_returns, confidence_level, frequency)
            }
            
            # Add portfolio-specific metrics if weights provided
            if portfolio_returns is not None and benchmark_returns is not None:
                results['portfolio_metrics'] = self._calculate_portfolio_metrics(
                    portfolio_returns, benchmark_returns, confidence_level, frequency
                )
            
            return results
            
        except Exception as e:
            return {'error': f'Statistical analysis failed: {str(e)}'}
    
    def _calculate_correlations(self, returns: pd.DataFrame, confidence_level: float) -> Dict:
        """Calculate correlation matrix with confidence intervals"""
        corr_matrix = returns.corr()
        n = len(returns)
        
        # Calculate confidence intervals for correlations
        z_score = stats.norm.ppf((1 + confidence_level) / 2)
        
        correlations = {}
        for i, symbol1 in enumerate(corr_matrix.columns):
            for j, symbol2 in enumerate(corr_matrix.columns):
                if i < j:  # Only upper triangle
                    r = corr_matrix.loc[symbol1, symbol2]
                    if not np.isnan(r):
                        # Fisher transformation for confidence interval
                        z_r = 0.5 * np.log((1 + r) / (1 - r))
                        se = 1 / np.sqrt(n - 3)
                        z_lower = z_r - z_score * se
                        z_upper = z_r + z_score * se
                        
                        # Transform back
                        r_lower = (np.exp(2 * z_lower) - 1) / (np.exp(2 * z_lower) + 1)
                        r_upper = (np.exp(2 * z_upper) - 1) / (np.exp(2 * z_upper) + 1)
                        
                        correlations[f"{symbol1}-{symbol2}"] = {
                            'correlation': float(r),
                            'confidence_interval': [float(r_lower), float(r_upper)],
                            'significant': abs(r_lower) > 0 or abs(r_upper) > 0
                        }
        
        return {
            'matrix': corr_matrix.to_dict(),
            'pairs': correlations,
            'average_correlation': float(np.nanmean(corr_matrix.values))
        }
    
    def _calculate_risk_metrics(self, returns: pd.DataFrame, confidence_level: float, frequency: str = 'Daily') -> Dict:
        """Calculate comprehensive risk metrics"""
        metrics = {}
        
        for symbol in returns.columns:
            symbol_returns = returns[symbol].dropna()
            # Adjust minimum data requirements based on frequency
            min_required = 10 if frequency == 'Daily' else 6 if frequency == 'Weekly' else 3
            if len(symbol_returns) < min_required:
                continue
                
            # Basic statistics
            mean_return = float(symbol_returns.mean())
            volatility = float(symbol_returns.std())
            skewness = float(symbol_returns.skew())
            kurtosis = float(symbol_returns.kurtosis())
            
            # VaR and CVaR
            var = float(symbol_returns.quantile(1 - confidence_level))
            cvar = float(symbol_returns[symbol_returns <= var].mean())
            
            # Annualized Sharpe ratio
            from utils.fed_rate import get_risk_free_rate
            risk_free_rate = get_risk_free_rate()
            
            # Annualize return and volatility for Sharpe calculation
            annualized_return = mean_return * 252
            annualized_vol = volatility * np.sqrt(252)
            
            excess_return = annualized_return - risk_free_rate
            sharpe = float(excess_return / annualized_vol) if annualized_vol > 0 else 0.0
            
            # Handle NaN/inf values
            if np.isnan(sharpe) or np.isinf(sharpe):
                sharpe = 0.0
            
            # Maximum drawdown
            cumulative = (1 + symbol_returns).cumprod()
            running_max = cumulative.expanding().max()
            drawdown = (cumulative - running_max) / running_max
            max_drawdown = float(drawdown.min())
            
            metrics[symbol] = {
                'mean_return': mean_return,
                'volatility': volatility,
                'sharpe_ratio': sharpe,
                'skewness': skewness,
                'kurtosis': kurtosis,
                'var': var,
                'cvar': cvar,
                'max_drawdown': max_drawdown
            }
        
        return metrics
    
    def _calculate_performance_metrics(self, returns: pd.DataFrame, benchmark_returns: pd.Series, confidence_level: float, frequency: str = 'Daily') -> Dict:
        """Calculate performance metrics vs benchmark"""
        if benchmark_returns is None:
            return {}
        
        metrics = {}
        
        for symbol in returns.columns:
            symbol_returns = returns[symbol].dropna()
            aligned_benchmark = benchmark_returns.reindex(symbol_returns.index).dropna()
            aligned_symbol = symbol_returns.reindex(aligned_benchmark.index).dropna()
            
            # Adjust minimum data requirements based on frequency
            min_required = 10 if frequency == 'Daily' else 6 if frequency == 'Weekly' else 3
            if len(aligned_symbol) < min_required or len(aligned_benchmark) < min_required:
                continue
            
            # Beta calculation
            covariance = np.cov(aligned_symbol, aligned_benchmark)[0, 1]
            benchmark_variance = np.var(aligned_benchmark)
            beta = float(covariance / benchmark_variance) if benchmark_variance > 0 else 0
            
            # Alpha calculation (CAPM)
            from utils.fed_rate import get_risk_free_rate
            risk_free_rate = get_risk_free_rate() / 252
            expected_return = risk_free_rate + beta * (aligned_benchmark.mean() - risk_free_rate)
            alpha = float(aligned_symbol.mean() - expected_return)
            
            # R-squared
            correlation = np.corrcoef(aligned_symbol, aligned_benchmark)[0, 1]
            r_squared = float(correlation ** 2) if not np.isnan(correlation) else 0
            
            # Tracking error
            tracking_error = float((aligned_symbol - aligned_benchmark).std())
            
            # Information ratio
            excess_returns = aligned_symbol - aligned_benchmark
            information_ratio = float(excess_returns.mean() / excess_returns.std()) if excess_returns.std() > 0 else 0
            
            metrics[symbol] = {
                'beta': beta,
                'alpha': alpha,
                'r_squared': r_squared,
                'tracking_error': tracking_error,
                'information_ratio': information_ratio,
                'correlation_with_benchmark': float(correlation) if not np.isnan(correlation) else 0
            }
        
        return metrics
    
    def _calculate_portfolio_metrics(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series, confidence_level: float, frequency: str = 'Daily') -> Dict:
        """Calculate portfolio-level metrics"""
        aligned_portfolio = portfolio_returns.dropna()
        aligned_benchmark = benchmark_returns.reindex(aligned_portfolio.index).dropna()
        aligned_portfolio = aligned_portfolio.reindex(aligned_benchmark.index).dropna()
        
        # Adjust minimum data requirements based on frequency
        min_required = 10 if frequency == 'Daily' else 6 if frequency == 'Weekly' else 3
        if len(aligned_portfolio) < min_required:
            return {}
        
        # Portfolio beta
        covariance = np.cov(aligned_portfolio, aligned_benchmark)[0, 1]
        benchmark_variance = np.var(aligned_benchmark)
        portfolio_beta = float(covariance / benchmark_variance) if benchmark_variance > 0 else 0
        
        # Portfolio alpha
        from utils.fed_rate import get_risk_free_rate
        risk_free_rate = get_risk_free_rate() / 252
        expected_return = risk_free_rate + portfolio_beta * (aligned_benchmark.mean() - risk_free_rate)
        portfolio_alpha = float(aligned_portfolio.mean() - expected_return)
        
        # Portfolio R-squared
        correlation = np.corrcoef(aligned_portfolio, aligned_benchmark)[0, 1]
        portfolio_r_squared = float(correlation ** 2) if not np.isnan(correlation) else 0
        
        return {
            'portfolio_beta': portfolio_beta,
            'portfolio_alpha': portfolio_alpha,
            'portfolio_r_squared': portfolio_r_squared,
            'portfolio_r_squared': portfolio_r_squared,
            'portfolio_sharpe': float((aligned_portfolio.mean() * 252 - risk_free_rate * 252) / (aligned_portfolio.std() * np.sqrt(252))) if aligned_portfolio.std() > 0 else 0,
            'portfolio_volatility': float(aligned_portfolio.std()),
            'excess_return': float(aligned_portfolio.mean() - aligned_benchmark.mean())
        }
    
    def comprehensive_analysis(self, symbols: List[str], weights: Dict[str, float]) -> Dict:
        """Comprehensive statistical analysis with all metrics"""
        try:
            # Basic correlation analysis
            correlation_results = self.correlation_analysis(symbols)
            
            # Diversification metrics
            diversification_ratio = self.diversification_ratio(symbols, weights)
            effective_assets = self.effective_number_of_assets(weights)
            
            # Clustering analysis
            clustering_results = self.simple_clustering(symbols)
            
            return {
                'correlation_analysis': correlation_results,
                'diversification_ratio': diversification_ratio,
                'effective_number_of_assets': effective_assets,
                'clustering': clustering_results,
                'portfolio_statistics': {
                    'total_symbols': len(symbols),
                    'total_weight': sum(weights.values())
                }
            }
        except Exception as e:
            return {'error': str(e)}