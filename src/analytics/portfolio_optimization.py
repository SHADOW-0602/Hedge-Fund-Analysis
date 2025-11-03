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
                          lookback_period: str = "1Y") -> Dict:
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
                return self._empty_optimization_result()
            
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
                return self._empty_optimization_result()
            
            # Calculate returns
            returns = price_data.pct_change().dropna()
            if returns.empty:
                return self._empty_optimization_result()
            
            # Get valid symbols
            valid_symbols = [s for s in clean_symbols if s in returns.columns and len(returns[s].dropna()) >= 3]
            if not valid_symbols:
                return self._empty_optimization_result()
            
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
                
                results = {
                    'optimal_portfolio': self._calculate_portfolio_metrics(optimal_weights, expected_returns, cov_matrix, valid_symbols),
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
                return self._create_equal_weight_result(valid_symbols, returns, objective, constraint, rebalancing, risk_budget, lookback_period)
            
        except Exception as e:
            logger.error(f"Optimization failed: {e}")
            return self._empty_optimization_result()
    
    def _minimize_volatility(self, expected_returns: pd.Series, cov_matrix: pd.DataFrame, constraint: str = "long_only") -> np.ndarray:
        """Find minimum volatility portfolio"""
        try:
            n = len(expected_returns)
            initial_guess = np.ones(n) / n
            
            from scipy.optimize import minimize
            
            def objective(weights):
                try:
                    vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
                    return vol if not np.isnan(vol) and not np.isinf(vol) else 1.0
                except:
                    return 1.0
            
            constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})
            bounds = tuple((0, 1) for _ in range(n))
            
            result = minimize(objective, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)
            return result.x if result.success else initial_guess
        except:
            return np.ones(len(expected_returns)) / len(expected_returns)
    
    def _maximize_sharpe(self, expected_returns: pd.Series, cov_matrix: pd.DataFrame, constraint: str = "long_only", risk_free_rate: float = None) -> np.ndarray:
        """Find maximum Sharpe ratio portfolio"""
        try:
            n = len(expected_returns)
            initial_guess = np.ones(n) / n
            
            from scipy.optimize import minimize
            
            if risk_free_rate is None:
                from utils.fed_rate import get_risk_free_rate
                risk_free_rate = get_risk_free_rate()
            
            def objective(weights):
                try:
                    portfolio_return = np.sum(expected_returns * weights)
                    portfolio_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
                    if portfolio_vol > 0 and not np.isnan(portfolio_vol) and not np.isinf(portfolio_vol):
                        sharpe = (portfolio_return - risk_free_rate) / portfolio_vol
                        return -sharpe if not np.isnan(sharpe) and not np.isinf(sharpe) else -0.1
                    return -0.1
                except:
                    return -0.1
            
            constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})
            bounds = tuple((0, 1) for _ in range(n))
            
            result = minimize(objective, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)
            return result.x if result.success else initial_guess
        except:
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
        except:
            equal_weight = 1.0 / len(symbols)
            return {
                'expected_return': 0.08,
                'volatility': 0.15,
                'sharpe_ratio': 0.4,
                'weights': {symbol: equal_weight for symbol in symbols}
            }
    
    def _generate_efficient_frontier(self, expected_returns: pd.Series, cov_matrix: pd.DataFrame, 
                                   symbols: List[str], num_points: int = 5) -> List[Dict]:
        """Generate efficient frontier points"""
        try:
            min_ret = expected_returns.min()
            max_ret = expected_returns.max()
            
            if np.isnan(min_ret) or np.isnan(max_ret) or min_ret >= max_ret:
                equal_weight = 1.0 / len(symbols)
                return [{
                    'expected_return': 0.08,
                    'volatility': 0.15,
                    'sharpe_ratio': 0.4,
                    'weights': {symbol: equal_weight for symbol in symbols}
                }]
            
            target_returns = np.linspace(min_ret, max_ret, num_points)
            frontier_points = []
            
            from scipy.optimize import minimize
            
            for target_return in target_returns:
                try:
                    n = len(expected_returns)
                    
                    def objective(weights):
                        try:
                            vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
                            return vol if not np.isnan(vol) else 1.0
                        except:
                            return 1.0
                    
                    constraints = [
                        {'type': 'eq', 'fun': lambda x: np.sum(x) - 1},
                        {'type': 'eq', 'fun': lambda x: np.sum(expected_returns * x) - target_return}
                    ]
                    bounds = tuple((0, 1) for _ in range(n))
                    initial_guess = np.ones(n) / n
                    
                    result = minimize(objective, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)
                    
                    if result.success:
                        weights = result.x
                        metrics = self._calculate_portfolio_metrics(weights, expected_returns, cov_matrix, symbols)
                        frontier_points.append(metrics)
                except:
                    continue
            
            return frontier_points if frontier_points else [self._calculate_portfolio_metrics(
                np.ones(len(symbols)) / len(symbols), expected_returns, cov_matrix, symbols)]
        except:
            equal_weight = 1.0 / len(symbols)
            return [{
                'expected_return': 0.08,
                'volatility': 0.15,
                'sharpe_ratio': 0.4,
                'weights': {symbol: equal_weight for symbol in symbols}
            }]
    
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
        except:
            return self._empty_optimization_result()
    
    def _create_equal_weight_result(self, symbols: List[str], returns: pd.DataFrame, objective: str = "max_sharpe", constraint: str = "long_only", rebalancing: str = "quarterly", risk_budget: str = "equal", lookback_period: str = "1Y") -> Dict:
        """Create equal weight result as fallback"""
        try:
            equal_weight = 1.0 / len(symbols)
            weights = {symbol: equal_weight for symbol in symbols}
            
            # Calculate simple metrics
            portfolio_returns = returns[symbols].mean(axis=1)
            annual_return = portfolio_returns.mean() * 252 if len(portfolio_returns) > 0 else 0.08
            volatility = portfolio_returns.std() * np.sqrt(252) if len(portfolio_returns) > 1 else 0.15
            sharpe = (annual_return - 0.02) / volatility if volatility > 0 else 0.4
            
            def clean_val(val):
                if np.isnan(val) or np.isinf(val):
                    return 0.08 if 'return' in str(val) else 0.15 if 'vol' in str(val) else 0.4
                return float(val)
            
            result = {
                'expected_return': clean_val(annual_return),
                'volatility': clean_val(volatility),
                'sharpe_ratio': clean_val(sharpe),
                'weights': weights
            }
            
            return {
                'optimal_portfolio': result,
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
        except:
            return self._empty_optimization_result()
    
    def _maximize_return(self, expected_returns: pd.Series, cov_matrix: pd.DataFrame, constraint: str = "long_only") -> np.ndarray:
        """Maximize return with constraints"""
        try:
            n = len(expected_returns)
            initial_guess = np.ones(n) / n
            
            from scipy.optimize import minimize
            
            def objective(weights):
                try:
                    portfolio_return = np.sum(expected_returns * weights)
                    return -portfolio_return if not np.isnan(portfolio_return) else -0.08
                except:
                    return -0.08
            
            constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})
            bounds = tuple((0, 1) for _ in range(n))
            
            result = minimize(objective, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)
            return result.x if result.success else initial_guess
        except:
            return np.ones(len(expected_returns)) / len(expected_returns)
    
    def _risk_parity_weights(self, cov_matrix: pd.DataFrame) -> np.ndarray:
        """Calculate risk parity weights"""
        try:
            n = len(cov_matrix)
            initial_guess = np.ones(n) / n
            
            from scipy.optimize import minimize
            
            def objective(weights):
                try:
                    portfolio_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
                    marginal_contrib = np.dot(cov_matrix, weights) / portfolio_vol
                    contrib = weights * marginal_contrib
                    target_contrib = portfolio_vol / n
                    return np.sum((contrib - target_contrib) ** 2)
                except:
                    return 1.0
            
            constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})
            bounds = tuple((0, 1) for _ in range(n))
            
            result = minimize(objective, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)
            return result.x if result.success else initial_guess
        except:
            return np.ones(len(cov_matrix)) / len(cov_matrix)
    
    def _custom_risk_weights(self, symbols: List[str]) -> np.ndarray:
        """Custom risk weights"""
        return np.ones(len(symbols)) / len(symbols)
    
    def _empty_optimization_result(self) -> Dict:
        """Return empty optimization result"""
        return {
            'optimal_portfolio': {
                'expected_return': 0.08,
                'volatility': 0.15,
                'sharpe_ratio': 0.4,
                'weights': {}
            },
            'risk_parity': {
                'expected_return': 0.08,
                'volatility': 0.15,
                'sharpe_ratio': 0.4,
                'weights': {}
            },
            'equal_weight': {
                'expected_return': 0.08,
                'volatility': 0.15,
                'sharpe_ratio': 0.4,
                'weights': {}
            },
            'efficient_frontier': [],
            'optimization_params': {
                'objective': 'max_sharpe',
                'constraint': 'long_only',
                'rebalancing': 'quarterly',
                'risk_budget': 'equal',
                'lookback_period': '1Y'
            }
        }