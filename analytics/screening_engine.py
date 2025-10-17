import pandas as pd
import numpy as np
from typing import List, Dict, Tuple
from clients.market_data_client import MarketDataClient
from scipy import stats

class QuantitativeScreener:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def momentum_screen(self, symbols: List[str], lookback_periods: List[int] = [20, 50, 200]) -> Dict:
        """Price momentum analysis with configurable lookback periods"""
        price_data = self.data_client.get_price_data(symbols, "1y")
        
        momentum_scores = {}
        for symbol in symbols:
            if symbol not in price_data.columns:
                continue
                
            prices = price_data[symbol].dropna()
            if len(prices) < max(lookback_periods):
                continue
            
            current_price = prices.iloc[-1]
            momentum_metrics = {}
            
            for period in lookback_periods:
                if len(prices) >= period:
                    past_price = prices.iloc[-period]
                    momentum_metrics[f'{period}d_return'] = (current_price - past_price) / past_price
            
            # Composite momentum score
            momentum_score = np.mean(list(momentum_metrics.values()))
            
            momentum_scores[symbol] = {
                'momentum_score': momentum_score,
                'metrics': momentum_metrics,
                'current_price': current_price
            }
        
        # Rank by momentum
        ranked = sorted(momentum_scores.items(), key=lambda x: x[1]['momentum_score'], reverse=True)
        
        return {
            'momentum_rankings': ranked,
            'top_momentum': ranked[:10],
            'bottom_momentum': ranked[-10:]
        }
    
    def volatility_screen(self, symbols: List[str], period: int = 30) -> Dict:
        """Low-volatility and high-volatility stock identification"""
        price_data = self.data_client.get_price_data(symbols, "6m")
        returns = price_data.pct_change().dropna()
        
        volatility_metrics = {}
        for symbol in symbols:
            if symbol not in returns.columns:
                continue
                
            symbol_returns = returns[symbol].dropna()
            if len(symbol_returns) < period:
                continue
            
            # Rolling volatility
            rolling_vol = symbol_returns.rolling(period).std() * np.sqrt(252)
            current_vol = rolling_vol.iloc[-1]
            avg_vol = rolling_vol.mean()
            
            volatility_metrics[symbol] = {
                'current_volatility': current_vol,
                'average_volatility': avg_vol,
                'volatility_percentile': stats.percentileofscore(rolling_vol.dropna(), current_vol)
            }
        
        # Sort by volatility
        low_vol = sorted(volatility_metrics.items(), key=lambda x: x[1]['current_volatility'])
        high_vol = sorted(volatility_metrics.items(), key=lambda x: x[1]['current_volatility'], reverse=True)
        
        return {
            'volatility_metrics': volatility_metrics,
            'low_volatility': low_vol[:10],
            'high_volatility': high_vol[:10]
        }
    
    def mean_reversion_screen(self, symbols: List[str], lookback: int = 20, threshold: float = 2.0) -> Dict:
        """Statistical mean reversion opportunity detection"""
        price_data = self.data_client.get_price_data(symbols, "6m")
        
        mean_reversion_candidates = {}
        for symbol in symbols:
            if symbol not in price_data.columns:
                continue
                
            prices = price_data[symbol].dropna()
            if len(prices) < lookback * 2:
                continue
            
            # Calculate z-score relative to moving average
            rolling_mean = prices.rolling(lookback).mean()
            rolling_std = prices.rolling(lookback).std()
            z_score = (prices - rolling_mean) / rolling_std
            
            current_z = z_score.iloc[-1]
            
            # Mean reversion signal
            if abs(current_z) > threshold:
                mean_reversion_candidates[symbol] = {
                    'z_score': current_z,
                    'signal': 'OVERSOLD' if current_z < -threshold else 'OVERBOUGHT',
                    'current_price': prices.iloc[-1],
                    'mean_price': rolling_mean.iloc[-1],
                    'deviation': abs(current_z)
                }
        
        # Sort by deviation magnitude
        ranked = sorted(mean_reversion_candidates.items(), 
                       key=lambda x: x[1]['deviation'], reverse=True)
        
        return {
            'mean_reversion_candidates': mean_reversion_candidates,
            'ranked_opportunities': ranked,
            'oversold': [(k, v) for k, v in ranked if v['signal'] == 'OVERSOLD'],
            'overbought': [(k, v) for k, v in ranked if v['signal'] == 'OVERBOUGHT']
        }
    
    def quality_screen(self, symbols: List[str]) -> Dict:
        """Risk-adjusted return and consistency analysis"""
        price_data = self.data_client.get_price_data(symbols, "1y")
        returns = price_data.pct_change().dropna()
        
        quality_metrics = {}
        for symbol in symbols:
            if symbol not in returns.columns:
                continue
                
            symbol_returns = returns[symbol].dropna()
            if len(symbol_returns) < 50:
                continue
            
            # Quality metrics
            avg_return = symbol_returns.mean() * 252
            volatility = symbol_returns.std() * np.sqrt(252)
            sharpe = avg_return / volatility if volatility > 0 else 0
            
            # Consistency metrics
            positive_days = (symbol_returns > 0).sum() / len(symbol_returns)
            max_drawdown = self._calculate_max_drawdown(symbol_returns)
            
            quality_score = sharpe * positive_days * (1 - abs(max_drawdown))
            
            quality_metrics[symbol] = {
                'quality_score': quality_score,
                'sharpe_ratio': sharpe,
                'positive_day_ratio': positive_days,
                'max_drawdown': max_drawdown,
                'volatility': volatility,
                'annual_return': avg_return
            }
        
        # Rank by quality score
        ranked = sorted(quality_metrics.items(), key=lambda x: x[1]['quality_score'], reverse=True)
        
        return {
            'quality_rankings': ranked,
            'high_quality': ranked[:10],
            'quality_metrics': quality_metrics
        }
    
    def breakout_detection(self, symbols: List[str], period: int = 20) -> Dict:
        """Technical breakout pattern identification"""
        price_data = self.data_client.get_price_data(symbols, "6m")
        
        breakout_candidates = {}
        for symbol in symbols:
            if symbol not in price_data.columns:
                continue
                
            prices = price_data[symbol].dropna()
            if len(prices) < period * 2:
                continue
            
            # Calculate resistance and support levels
            rolling_max = prices.rolling(period).max()
            rolling_min = prices.rolling(period).min()
            
            current_price = prices.iloc[-1]
            resistance = rolling_max.iloc[-2]  # Previous resistance
            support = rolling_min.iloc[-2]    # Previous support
            
            # Breakout signals
            upward_breakout = current_price > resistance * 1.02  # 2% above resistance
            downward_breakout = current_price < support * 0.98   # 2% below support
            
            if upward_breakout or downward_breakout:
                breakout_candidates[symbol] = {
                    'breakout_type': 'UPWARD' if upward_breakout else 'DOWNWARD',
                    'current_price': current_price,
                    'resistance_level': resistance,
                    'support_level': support,
                    'breakout_strength': (current_price - resistance) / resistance if upward_breakout 
                                       else (support - current_price) / support
                }
        
        return {
            'breakout_candidates': breakout_candidates,
            'upward_breakouts': {k: v for k, v in breakout_candidates.items() 
                               if v['breakout_type'] == 'UPWARD'},
            'downward_breakouts': {k: v for k, v in breakout_candidates.items() 
                                 if v['breakout_type'] == 'DOWNWARD'}
        }
    
    def correlation_arbitrage(self, symbols: List[str], min_correlation: float = 0.8) -> List[Tuple]:
        """High-correlation pair identification for pairs trading"""
        price_data = self.data_client.get_price_data(symbols, "6m")
        returns = price_data.pct_change().dropna()
        
        correlation_matrix = returns.corr()
        high_correlation_pairs = []
        
        for i, symbol1 in enumerate(symbols):
            for j, symbol2 in enumerate(symbols[i+1:], i+1):
                if symbol1 in correlation_matrix.index and symbol2 in correlation_matrix.columns:
                    correlation = correlation_matrix.loc[symbol1, symbol2]
                    
                    if abs(correlation) >= min_correlation:
                        # Calculate current spread
                        prices1 = price_data[symbol1].dropna()
                        prices2 = price_data[symbol2].dropna()
                        
                        if len(prices1) > 0 and len(prices2) > 0:
                            # Normalize prices and calculate spread
                            norm_prices1 = prices1 / prices1.iloc[0]
                            norm_prices2 = prices2 / prices2.iloc[0]
                            spread = norm_prices1 - norm_prices2
                            
                            high_correlation_pairs.append({
                                'pair': (symbol1, symbol2),
                                'correlation': correlation,
                                'current_spread': spread.iloc[-1],
                                'spread_mean': spread.mean(),
                                'spread_std': spread.std(),
                                'z_score': (spread.iloc[-1] - spread.mean()) / spread.std()
                            })
        
        # Sort by absolute z-score (trading opportunity)
        high_correlation_pairs.sort(key=lambda x: abs(x['z_score']), reverse=True)
        
        return {
            'correlation_pairs': high_correlation_pairs,
            'trading_opportunities': [pair for pair in high_correlation_pairs 
                                    if abs(pair['z_score']) > 2.0]
        }
    
    def _calculate_max_drawdown(self, returns: pd.Series) -> float:
        """Helper function to calculate maximum drawdown"""
        cumulative = (1 + returns).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        return drawdown.min()