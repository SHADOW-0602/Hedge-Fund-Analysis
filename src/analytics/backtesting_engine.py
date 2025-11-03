import pandas as pd
import numpy as np
from typing import Dict, List
from clients.market_data_client import MarketDataClient
from utils.logger import logger

class BacktestingEngine:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def calculate_portfolio_backtest(self, symbols: List[str], weights: Dict[str, float], period: str = "1y") -> Dict:
        """Calculate real backtesting metrics using market data"""
        try:
            logger.info(f"Starting backtest for {len(symbols)} symbols")
            
            import yfinance as yf
            import warnings
            
            # Filter valid symbols
            valid_symbols = [s for s in symbols if s and len(s) <= 10 and not s.startswith('CUR:') and not s.startswith('CASH')]
            if not valid_symbols:
                return self._empty_backtest_metrics()
            
            price_data = None
            periods_to_try = ["6mo", "3mo", "1mo", "2mo"]
            
            for period_try in periods_to_try:
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        
                    if len(valid_symbols) == 1:
                        ticker_data = yf.download(valid_symbols[0], period=period_try, progress=False)
                        if not ticker_data.empty and len(ticker_data) >= 10:
                            price_col = 'Adj Close' if 'Adj Close' in ticker_data.columns else 'Close'
                            price_data = pd.DataFrame({valid_symbols[0]: ticker_data[price_col]})
                    else:
                        price_data = yf.download(valid_symbols, period=period_try, progress=False, threads=False)
                        if not price_data.empty and len(price_data) >= 10:
                            if isinstance(price_data.columns, pd.MultiIndex):
                                price_col = 'Adj Close' if 'Adj Close' in price_data.columns.levels[0] else 'Close'
                                price_data = price_data[price_col]
                    
                    if price_data is not None and not price_data.empty:
                        logger.info(f"Downloaded {len(price_data)} days with {period_try}")
                        break
                        
                except Exception as e:
                    logger.warning(f"Period {period_try} failed: {e}")
                    continue
            
            if price_data is None or price_data.empty:
                logger.warning("No price data available")
                return self._empty_backtest_metrics()
            
            # Calculate returns
            returns = price_data.pct_change().dropna()
            if returns.empty:
                return self._empty_backtest_metrics()
            
            # Calculate portfolio returns
            portfolio_returns = self._calculate_portfolio_returns(returns, weights)
            if len(portfolio_returns) < 5:
                return self._empty_backtest_metrics()
            
            # Calculate metrics with error handling
            try:
                annual_return = self._calculate_annual_return(portfolio_returns)
                max_drawdown = self._calculate_max_drawdown(portfolio_returns)
                sortino_ratio = self._calculate_sortino_ratio(portfolio_returns)
                total_return = (1 + portfolio_returns).prod() - 1
                volatility = portfolio_returns.std() * np.sqrt(252)
            except Exception as e:
                logger.warning(f"Metrics calculation failed: {e}")
                return self._empty_backtest_metrics()
            
            def clean_value(val):
                if val is None or np.isnan(val) or np.isinf(val):
                    return None
                return float(val)
            
            result = {
                'annual_return': clean_value(annual_return),
                'max_drawdown': clean_value(max_drawdown),
                'sortino_ratio': clean_value(sortino_ratio),
                'total_return': clean_value(total_return),
                'volatility': clean_value(volatility),
                'data_points': len(portfolio_returns)
            }
            
            logger.info(f"Backtest completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Backtesting failed: {e}")
            return self._empty_backtest_metrics()
    
    def _calculate_portfolio_returns(self, returns: pd.DataFrame, weights: Dict[str, float]) -> pd.Series:
        """Calculate weighted portfolio returns"""
        available_symbols = [s for s in weights.keys() if s in returns.columns]
        if not available_symbols:
            return pd.Series()
        
        # Normalize weights for available symbols
        total_weight = sum(weights[s] for s in available_symbols)
        if total_weight == 0:
            return pd.Series()
        
        normalized_weights = {s: weights[s] / total_weight for s in available_symbols}
        
        # Calculate portfolio returns
        portfolio_returns = pd.Series(0, index=returns.index)
        for symbol in available_symbols:
            portfolio_returns += returns[symbol] * normalized_weights[symbol]
        
        return portfolio_returns.dropna()
    
    def _calculate_annual_return(self, returns: pd.Series) -> float:
        """Calculate annualized return"""
        try:
            if len(returns) == 0:
                return 0.0
            
            total_return = (1 + returns).prod() - 1
            if np.isnan(total_return) or np.isinf(total_return):
                return 0.0
            
            days = len(returns)
            if days == 0:
                return 0.0
            
            annual_return = (1 + total_return) ** (252 / days) - 1
            return annual_return if not np.isnan(annual_return) else 0.0
        except Exception:
            return 0.0
    
    def _calculate_max_drawdown(self, returns: pd.Series) -> float:
        """Calculate maximum drawdown"""
        try:
            if len(returns) == 0:
                return 0.0
            
            cumulative = (1 + returns).cumprod()
            running_max = cumulative.expanding().max()
            drawdown = (cumulative - running_max) / running_max
            
            max_dd = drawdown.min()
            return max_dd if not np.isnan(max_dd) else 0.0
        except Exception:
            return 0.0
    
    def _calculate_sortino_ratio(self, returns: pd.Series, risk_free_rate: float = None) -> float:
        """Calculate Sortino ratio"""
        try:
            if risk_free_rate is None:
                from utils.fed_rate import get_risk_free_rate
                risk_free_rate = get_risk_free_rate()
            
            if len(returns) < 5:
                return 0.0
            
            annual_return = self._calculate_annual_return(returns)
            downside_returns = returns[returns < 0]
            
            if len(downside_returns) == 0:
                return annual_return / 0.01 if annual_return > 0 else 0.0
            
            downside_deviation = downside_returns.std() * np.sqrt(252)
            if downside_deviation == 0 or np.isnan(downside_deviation):
                return 0.0
            
            sortino = (annual_return - risk_free_rate) / downside_deviation
            return sortino if not np.isnan(sortino) else 0.0
        except Exception:
            return 0.0
    
    def _empty_backtest_metrics(self) -> Dict:
        """Return empty metrics when calculation fails"""
        return {
            'annual_return': None,
            'max_drawdown': None,
            'sortino_ratio': None,
            'total_return': None,
            'volatility': None,
            'data_points': 0
        }