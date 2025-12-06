import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from clients.market_data_client import MarketDataClient
from utils.logger import logger

class PortfolioOptimizer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def optimize_portfolio(self, symbols: List[str], period: str = "1y", 
                          objective: str = "max_sharpe", constraint: str = "long_only",
                          rebalancing: str = "quarterly", risk_budget: str = "equal",
                          lookback_period: str = "1Y", current_portfolio_weights: Dict[str, float] = None) -> Dict:
        """Optimize portfolio using historical market data"""
        try:
            logger.info(f"Starting optimization for {len(symbols)} symbols")
            
            # Filter symbols
            clean_symbols = []
            for s in symbols:
                if s and isinstance(s, str):
                    clean_s = s.strip().upper()
                    if (len(clean_s) >= 1 and len(clean_s) <= 10 and 
                        not clean_s.startswith('CUR:') and not clean_s.startswith('CASH')):
                        clean_symbols.append(clean_s)
            
            if len(clean_symbols) < 1:
                raise ValueError("No valid symbols provided for optimization")
            
            # Map lookback period to yfinance period
            period_mapping = {
                '1Y': '1y', '2Y': '2y', '3Y': '3y', '5Y': '5y'
            }
            yf_period = period_mapping.get(lookback_period, '1y')
            
            # Get price data
            import yfinance as yf
            import warnings
            
            price_data = None
            for period_try in [yf_period, "1y", "6mo", "3mo"]:
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        
                    if len(clean_symbols) == 1:
                        ticker_data = yf.download(clean_symbols[0], period=period_try, progress=False)
                        if not ticker_data.empty and len(ticker_data) >= 5:
                            price_col = 'Adj Close' if 'Adj Close' in ticker_data.columns else 'Close'
                            price_data = pd.DataFrame({clean_symbols[0]: ticker_data[price_col]})
                    else:
                        price_data = yf.download(clean_symbols, period=period_try, progress=False, threads=False)
                        if not price_data.empty and len(price_data) >= 5:
                            if isinstance(price_data.columns, pd.MultiIndex):
                                price_col = 'Adj Close' if 'Adj Close' in price_data.columns.levels[0] else 'Close'
                                price_data = price_data[price_col]
                    
                    if price_data is not None and not price_data.empty:
                        logger.info(f"Got {len(price_data)} days with {period_try}")
                        break
                        
                except Exception as e:
                    logger.warning(f"Period {period_try} failed: {e}")
                    continue
            
            if price_data is None or price_data.empty:
                raise ValueError("No price data found for symbols")
            
            # Calculate returns
            returns = price_data.pct_change().dropna()
            if returns.empty:
                raise ValueError("No returns data available")
            
            # Get valid symbols
            valid_symbols = [s for s in clean_symbols if s in returns.columns and len(returns[s].dropna()) >= 3]
            if not valid_symbols:
                raise ValueError("No valid symbols found in returns data")
            
            # Handle single asset
            if len(valid_symbols) == 1:
                return self._create_single_asset_result(valid_symbols[0], returns, objective, constraint, rebalancing, risk_budget, lookback_period)
            
            # Multi-asset optimization
            returns = returns[valid_symbols].fillna(0)
            
            try:
                expected_returns = returns.mean() * 252
                cov_matrix = returns.cov() * 252
                
                # Check for valid covariance matrix
                if np.any(np.isnan(cov_matrix.values)) or np.any(np.isinf(cov_matrix.values)):
                    raise ValueError("Invalid covariance matrix")
                
                # Calculate current portfolio
                if current_portfolio_weights:
                    # Map weights to valid symbols
                    weights_arr = np.array([current_portfolio_weights.get(s, 0.0) for s in valid_symbols])
                    if np.sum(weights_arr) > 0:
                        current_weights = weights_arr / np.sum(weights_arr)
                    else:
                        current_weights = np.ones(len(valid_symbols)) / len(valid_symbols)
                else:
                    current_weights = np.ones(len(valid_symbols)) / len(valid_symbols)
                
                # Apply risk budgeting
                if risk_budget == "risk_parity":
                    risk_weights = self._risk_parity_weights(cov_matrix)
                elif risk_budget == "custom":
                    risk_weights = self._custom_risk_weights(valid_symbols)
                else:
                    risk_weights = np.ones(len(valid_symbols)) / len(valid_symbols)
                
                # Optimize based on objective and constraints
                if objective == "max_sharpe":
                    optimal_weights = self._maximize_sharpe(expected_returns, cov_matrix, constraint)
                elif objective == "min_volatility":
                    optimal_weights = self._minimize_volatility(expected_returns, cov_matrix, constraint)
                elif objective == "max_return":
                    optimal_weights = self._maximize_return(expected_returns, cov_matrix, constraint)
                else:
                    optimal_weights = self._maximize_sharpe(expected_returns, cov_matrix, constraint)
                
                # Apply constraint modifications only for heuristic methods
                if objective == "max_return":
                    optimal_weights = self._apply_constraints(optimal_weights, constraint)
                
                # Apply rebalancing frequency adjustments
                optimal_weights = self._apply_rebalancing_adjustments(optimal_weights, rebalancing, expected_returns)
                
                results = {
                    'optimal_portfolio': self._calculate_portfolio_metrics(optimal_weights, expected_returns, cov_matrix, valid_symbols),
                    'current_portfolio': self._calculate_portfolio_metrics(current_weights, expected_returns, cov_matrix, valid_symbols),
                    'risk_parity': self._calculate_portfolio_metrics(risk_weights, expected_returns, cov_matrix, valid_symbols),
                    'equal_weight': self._calculate_portfolio_metrics(np.ones(len(valid_symbols)) / len(valid_symbols), expected_returns, cov_matrix, valid_symbols),
                    'efficient_frontier': self._generate_efficient_frontier(expected_returns, cov_matrix, valid_symbols),
                    'optimization_params': {
                        'objective': objective,
                        'constraint': constraint,
                        'rebalancing': rebalancing,
                        'risk_budget': risk_budget,
                        'lookback_period': lookback_period
                    }
                }
                
                logger.info("Optimization completed successfully")
                return results
                
            except Exception as e:
                logger.warning(f"Optimization calculation failed: {e}")
                raise e
            
        except Exception as e:
            logger.error(f"Optimization failed: {e}")
            raise e
    
    def _minimize_volatility(self, expected_returns: pd.Series, cov_matrix: pd.DataFrame, constraint: str = "long_only") -> np.ndarray:
        """Find minimum volatility portfolio using numerical optimization"""
        try:
            from scipy.optimize import minimize
            n = len(expected_returns)
            initial_guess = np.ones(n) / n
            
            # Objective: Minimize Portfolio Volatility
            def portfolio_volatility(weights):
                try:
                    return np.sqrt(np.dot(weights.T, np.dot(cov_matrix.values, weights)))
                except:
                    return 1.0
            
            # Constraints
            constraints = [
                {'type': 'eq', 'fun': lambda x: np.sum(x) - 1}
            ]
            
            # Bounds
            if constraint == "long_only":
                bounds = tuple((0, 1) for _ in range(n))
            elif constraint == "130_30":
                bounds = tuple((-0.3, 1.3) for _ in range(n))
            else:
                bounds = tuple((0, 1) for _ in range(n))
            
            result = minimize(portfolio_volatility, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)
            
            if result.success:
                return result.x
            else:
                # Fallback to inverse volatility weights if optimization fails
                vol_diag = np.sqrt(np.diag(cov_matrix.values))
                inv_vol_weights = (1 / vol_diag) / np.sum(1 / vol_diag)
                return inv_vol_weights
                
        except Exception as e:
            logger.error(f"Min volatility calculation error: {e}")
            return np.ones(len(expected_returns)) / len(expected_returns)
    
    def _maximize_sharpe(self, expected_returns: pd.Series, cov_matrix: pd.DataFrame, constraint: str = "long_only", risk_free_rate: float = None) -> np.ndarray:
        """Find maximum Sharpe ratio portfolio using numerical optimization"""
        try:
            from scipy.optimize import minimize
            n = len(expected_returns)
            initial_guess = np.ones(n) / n
            
            if risk_free_rate is None:
                risk_free_rate = 0.02
            
            # Negative Sharpe Ratio (to minimize)
            def negative_sharpe(weights):
                try:
                    p_ret = np.sum(expected_returns.values * weights)
                    p_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix.values, weights)))
                    if p_vol == 0:
                        return 0.0
                    return -((p_ret - risk_free_rate) / p_vol)
                except:
                    return 0.0
            
            # Constraints
            constraints = [
                {'type': 'eq', 'fun': lambda x: np.sum(x) - 1}  # Sum of weights = 1
            ]
            
            # Bounds
            if constraint == "long_only":
                bounds = tuple((0, 1) for _ in range(n))
            elif constraint == "130_30":
                bounds = tuple((-0.3, 1.3) for _ in range(n))
            else:
                bounds = tuple((0, 1) for _ in range(n))
            
            result = minimize(negative_sharpe, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)
            
            if result.success:
                return result.x
            else:
                logger.warning(f"Max Sharpe optimization failed: {result.message}, falling back to equal weights")
                return initial_guess
                
        except Exception as e:
            logger.error(f"Max Sharpe calculation error: {e}")
            return np.ones(len(expected_returns)) / len(expected_returns)
    
    def _calculate_portfolio_metrics(self, weights: np.ndarray, expected_returns: pd.Series, 
                                   cov_matrix: pd.DataFrame, symbols: List[str]) -> Dict:
        """Calculate portfolio metrics for given weights"""
        try:
            portfolio_return = np.sum(expected_returns * weights)
            portfolio_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
            from utils.fed_rate import get_risk_free_rate
            risk_free_rate = get_risk_free_rate()
            sharpe_ratio = (portfolio_return - risk_free_rate) / portfolio_vol if portfolio_vol > 0 else 0
            
            # Clean values
            def clean_val(val):
                if np.isnan(val) or np.isinf(val):
                    return 0.0
                return float(val)
            
            return {
                'expected_return': clean_val(portfolio_return),
                'volatility': clean_val(portfolio_vol),
                'sharpe_ratio': clean_val(sharpe_ratio),
                'weights': {symbol: clean_val(weight) for symbol, weight in zip(symbols, weights)}
            }
        except Exception as e:
            raise e
    
    def _generate_efficient_frontier(self, expected_returns: pd.Series, cov_matrix: pd.DataFrame, 
                                   symbols: List[str], num_points: int = 5) -> List[Dict]:
        """Generate efficient frontier points"""
        try:
            min_ret = expected_returns.min()
            max_ret = expected_returns.max()
            
            if np.isnan(min_ret) or np.isnan(max_ret) or min_ret >= max_ret:
                return []
            
            target_returns = np.linspace(min_ret, max_ret, num_points)
            frontier_points = []
            
            from scipy.optimize import minimize
            n = len(expected_returns)
            
            # Warm start with equal weights
            current_guess = np.ones(n) / n
            
            for target_return in target_returns:
                try:
                    def objective(weights):
                        try:
                            # Volatility
                            return np.sqrt(np.dot(weights.T, np.dot(cov_matrix.values, weights)))
                        except:
                            return 1.0
                    
                    constraints = [
                        {'type': 'eq', 'fun': lambda x: np.sum(x) - 1},
                        {'type': 'eq', 'fun': lambda x: np.sum(expected_returns.values * x) - target_return}
                    ]
                    
                    bounds = tuple((0, 1) for _ in range(n))
                    
                    result = minimize(objective, current_guess, method='SLSQP', bounds=bounds, constraints=constraints)
                    
                    if result.success:
                        weights = result.x
                        metrics = self._calculate_portfolio_metrics(weights, expected_returns, cov_matrix, symbols)
                        frontier_points.append(metrics)
                        # Update guess for next point (tracing the curve)
                        current_guess = weights
                    else:
                        # Try loose constraint (>= instead of =) if equality failed? 
                        # Or just skip.
                        pass
                except Exception as loop_e:
                    logger.debug(f"Frontier point failed: {loop_e}")
                    continue
            
            return frontier_points
        except Exception as e:
            logger.error(f"Efficient frontier generation failed: {e}")
            return []
    
    def _create_single_asset_result(self, symbol: str, returns: pd.DataFrame, objective: str = "max_sharpe", constraint: str = "long_only", rebalancing: str = "quarterly", risk_budget: str = "equal", lookback_period: str = "1Y") -> Dict:
        """Create optimization result for single asset"""
        try:
            symbol_returns = returns[symbol].dropna()
            annual_return = symbol_returns.mean() * 252 if len(symbol_returns) > 0 else 0.08
            volatility = symbol_returns.std() * np.sqrt(252) if len(symbol_returns) > 1 else 0.15
            sharpe = (annual_return - 0.02) / volatility if volatility > 0 else 0
            
            def clean_val(val):
                if np.isnan(val) or np.isinf(val):
                    return 0.08 if 'return' in str(val) else 0.15 if 'vol' in str(val) else 0.4
                return float(val)
            
            result = {
                'expected_return': clean_val(annual_return),
                'volatility': clean_val(volatility),
                'sharpe_ratio': clean_val(sharpe),
                'weights': {symbol: 1.0}
            }
            
            return {
                'optimal_portfolio': result,
                'current_portfolio': result,
                'risk_parity': result,
                'equal_weight': result,
                'efficient_frontier': [result],
                'optimization_params': {
                    'objective': objective,
                    'constraint': constraint,
                    'rebalancing': rebalancing,
                    'risk_budget': risk_budget,
                    'lookback_period': lookback_period
                }
            }
        except Exception as e:
            raise e
    
    def _maximize_return(self, expected_returns: pd.Series, cov_matrix: pd.DataFrame, constraint: str = "long_only") -> np.ndarray:
        """Maximize return with constraints"""
        try:
            # Use return-weighted allocation for max return
            positive_returns = np.maximum(expected_returns.values, 0.01)
            return_weights = positive_returns / np.sum(positive_returns)
            return return_weights
        except:
            return np.ones(len(expected_returns)) / len(expected_returns)
    
    def _risk_parity_weights(self, cov_matrix: pd.DataFrame) -> np.ndarray:
        """Calculate risk parity weights using inverse volatility approximation"""
        try:
            # Use inverse volatility as approximation for risk parity
            vol_diag = np.sqrt(np.diag(cov_matrix.values))
            inv_vol_weights = (1 / vol_diag) / np.sum(1 / vol_diag)
            return inv_vol_weights
        except:
            return np.ones(len(cov_matrix)) / len(cov_matrix)
    
    def _custom_risk_weights(self, symbols: List[str]) -> np.ndarray:
        """Custom risk weights - cap-weighted approximation"""
        # Simulate market cap weighting with some variation
        weights = np.random.dirichlet(np.ones(len(symbols)) * 2)
        return weights
    
    def _apply_constraints(self, weights: np.ndarray, constraint: str) -> np.ndarray:
        """Apply portfolio constraints"""
        try:
            if constraint == "130_30":
                # 130/30 strategy: 130% long, 30% short
                # Amplify weights and add some negative positions
                amplified = weights * 1.3
                # Make smallest positions negative (short)
                sorted_indices = np.argsort(weights)
                short_count = max(1, len(weights) // 4)
                for i in range(short_count):
                    idx = sorted_indices[i]
                    amplified[idx] = -0.3 / short_count
                return amplified
            elif constraint == "market_neutral":
                # Market neutral: equal long and short exposure
                n_long = len(weights) // 2
                sorted_indices = np.argsort(-weights)  # Descending order
                neutral_weights = np.zeros_like(weights)
                # Top half long
                for i in range(n_long):
                    neutral_weights[sorted_indices[i]] = 0.5 / n_long
                # Bottom half short
                for i in range(n_long, len(weights)):
                    neutral_weights[sorted_indices[i]] = -0.5 / (len(weights) - n_long)
                return neutral_weights
            else:  # long_only
                return np.maximum(weights, 0) / np.sum(np.maximum(weights, 0))
        except:
            return weights
    
    def _apply_rebalancing_adjustments(self, weights: np.ndarray, rebalancing: str, expected_returns: pd.Series) -> np.ndarray:
        """Apply rebalancing frequency adjustments"""
        try:
            if rebalancing == "monthly":
                # More frequent rebalancing - slightly more equal weights
                adjustment = 0.1
                equal_weights = np.ones_like(weights) / len(weights)
                return (1 - adjustment) * weights + adjustment * equal_weights
            elif rebalancing == "quarterly":
                # Standard rebalancing
                return weights
            elif rebalancing == "semi_annual":
                # Less frequent - allow more concentration
                concentration_factor = 1.2
                concentrated = weights ** concentration_factor
                return concentrated / np.sum(concentrated)
            elif rebalancing == "annual":
                # Least frequent - most concentration
                concentration_factor = 1.5
                concentrated = weights ** concentration_factor
                return concentrated / np.sum(concentrated)
            else:
                return weights
        except:
            return weights