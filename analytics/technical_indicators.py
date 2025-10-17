import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from clients.market_data_client import MarketDataClient

class TechnicalIndicators:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def moving_averages(self, symbol: str, periods: List[int] = [20, 50, 200]) -> Dict:
        """Calculate multiple moving averages"""
        price_data = self.data_client.get_price_data([symbol], "1y")
        if symbol not in price_data.columns:
            return {}
        
        prices = price_data[symbol].dropna()
        mas = {}
        
        for period in periods:
            if len(prices) >= period:
                mas[f'MA_{period}'] = prices.rolling(period).mean().iloc[-1]
        
        current_price = prices.iloc[-1]
        
        # Generate signals
        signals = {}
        if 'MA_20' in mas and 'MA_50' in mas:
            signals['golden_cross'] = mas['MA_20'] > mas['MA_50']
            signals['death_cross'] = mas['MA_20'] < mas['MA_50']
        
        return {
            'current_price': current_price,
            'moving_averages': mas,
            'signals': signals
        }
    
    def rsi(self, symbol: str, period: int = 14) -> Optional[float]:
        """Relative Strength Index"""
        price_data = self.data_client.get_price_data([symbol], "6m")
        if symbol not in price_data.columns:
            return None
        
        prices = price_data[symbol].dropna()
        if len(prices) < period + 1:
            return None
        
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi.iloc[-1]
    
    def bollinger_bands(self, symbol: str, period: int = 20, std_dev: float = 2) -> Dict:
        """Bollinger Bands"""
        price_data = self.data_client.get_price_data([symbol], "6m")
        if symbol not in price_data.columns:
            return {}
        
        prices = price_data[symbol].dropna()
        if len(prices) < period:
            return {}
        
        sma = prices.rolling(period).mean()
        std = prices.rolling(period).std()
        
        upper_band = sma + (std * std_dev)
        lower_band = sma - (std * std_dev)
        
        current_price = prices.iloc[-1]
        current_upper = upper_band.iloc[-1]
        current_lower = lower_band.iloc[-1]
        current_sma = sma.iloc[-1]
        
        # Calculate position within bands
        band_position = (current_price - current_lower) / (current_upper - current_lower)
        
        return {
            'current_price': current_price,
            'upper_band': current_upper,
            'lower_band': current_lower,
            'middle_band': current_sma,
            'band_position': band_position,
            'squeeze': (current_upper - current_lower) / current_sma < 0.1,
            'overbought': band_position > 0.8,
            'oversold': band_position < 0.2
        }
    
    def macd(self, symbol: str, fast: int = 12, slow: int = 26, signal: int = 9) -> Dict:
        """MACD (Moving Average Convergence Divergence)"""
        price_data = self.data_client.get_price_data([symbol], "1y")
        if symbol not in price_data.columns:
            return {}
        
        prices = price_data[symbol].dropna()
        if len(prices) < slow + signal:
            return {}
        
        ema_fast = prices.ewm(span=fast).mean()
        ema_slow = prices.ewm(span=slow).mean()
        
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal).mean()
        histogram = macd_line - signal_line
        
        return {
            'macd': macd_line.iloc[-1],
            'signal': signal_line.iloc[-1],
            'histogram': histogram.iloc[-1],
            'bullish_crossover': macd_line.iloc[-1] > signal_line.iloc[-1] and macd_line.iloc[-2] <= signal_line.iloc[-2],
            'bearish_crossover': macd_line.iloc[-1] < signal_line.iloc[-1] and macd_line.iloc[-2] >= signal_line.iloc[-2]
        }
    
    def stochastic(self, symbol: str, k_period: int = 14, d_period: int = 3) -> Dict:
        """Stochastic Oscillator"""
        price_data = self.data_client.get_price_data([symbol], "6m")
        if symbol not in price_data.columns:
            return {}
        
        prices = price_data[symbol].dropna()
        if len(prices) < k_period:
            return {}
        
        # Assuming we only have close prices, use close for high/low approximation
        high = prices.rolling(k_period).max()
        low = prices.rolling(k_period).min()
        
        k_percent = 100 * ((prices - low) / (high - low))
        d_percent = k_percent.rolling(d_period).mean()
        
        return {
            'k_percent': k_percent.iloc[-1],
            'd_percent': d_percent.iloc[-1],
            'overbought': k_percent.iloc[-1] > 80,
            'oversold': k_percent.iloc[-1] < 20
        }
    
    def atr(self, symbol: str, period: int = 14) -> Optional[float]:
        """Average True Range (simplified using only close prices)"""
        price_data = self.data_client.get_price_data([symbol], "6m")
        if symbol not in price_data.columns:
            return None
        
        prices = price_data[symbol].dropna()
        if len(prices) < period + 1:
            return None
        
        # Simplified ATR using only close prices
        true_range = abs(prices.diff())
        atr = true_range.rolling(period).mean()
        
        return atr.iloc[-1]
    
    def comprehensive_analysis(self, symbol: str) -> Dict:
        """Comprehensive technical analysis for a symbol"""
        analysis = {
            'symbol': symbol,
            'moving_averages': self.moving_averages(symbol),
            'rsi': self.rsi(symbol),
            'bollinger_bands': self.bollinger_bands(symbol),
            'macd': self.macd(symbol),
            'stochastic': self.stochastic(symbol),
            'atr': self.atr(symbol)
        }
        
        # Generate overall signal
        signals = []
        
        # RSI signals
        rsi_val = analysis['rsi']
        if rsi_val:
            if rsi_val > 70:
                signals.append('RSI_OVERBOUGHT')
            elif rsi_val < 30:
                signals.append('RSI_OVERSOLD')
        
        # Bollinger Band signals
        bb = analysis['bollinger_bands']
        if bb:
            if bb.get('overbought'):
                signals.append('BB_OVERBOUGHT')
            elif bb.get('oversold'):
                signals.append('BB_OVERSOLD')
        
        # MACD signals
        macd = analysis['macd']
        if macd:
            if macd.get('bullish_crossover'):
                signals.append('MACD_BULLISH')
            elif macd.get('bearish_crossover'):
                signals.append('MACD_BEARISH')
        
        # Moving average signals
        ma = analysis['moving_averages']
        if ma and ma.get('signals'):
            if ma['signals'].get('golden_cross'):
                signals.append('MA_GOLDEN_CROSS')
            elif ma['signals'].get('death_cross'):
                signals.append('MA_DEATH_CROSS')
        
        analysis['overall_signals'] = signals
        analysis['bullish_signals'] = len([s for s in signals if 'BULLISH' in s or 'GOLDEN' in s or 'OVERSOLD' in s])
        analysis['bearish_signals'] = len([s for s in signals if 'BEARISH' in s or 'DEATH' in s or 'OVERBOUGHT' in s])
        
        return analysis