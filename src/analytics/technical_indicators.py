import pandas as pd
import numpy as np
from typing import Dict, List
from clients.market_data_client import MarketDataClient
from utils.logger import logger

class TechnicalAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Calculate RSI (Relative Strength Index) - NO FALLBACK DATA"""
        if len(prices) < period + 1:
            raise ValueError(f"Insufficient data for RSI calculation: need {period + 1}, got {len(prices)}")
        
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        # Avoid division by zero
        loss = loss.replace(0, 0.0001)
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        final_rsi = rsi.iloc[-1]
        if pd.isna(final_rsi):
            raise ValueError("RSI calculation resulted in NaN - insufficient real market data")
        
        return float(final_rsi)
    
    def calculate_macd(self, prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> str:
        """Calculate MACD signal - NO FALLBACK DATA"""
        if len(prices) < slow + signal:
            raise ValueError(f"Insufficient data for MACD calculation: need {slow + signal}, got {len(prices)}")
        
        ema_fast = prices.ewm(span=fast).mean()
        ema_slow = prices.ewm(span=slow).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal).mean()
        
        current_macd = macd_line.iloc[-1]
        current_signal = signal_line.iloc[-1]
        
        if pd.isna(current_macd) or pd.isna(current_signal):
            raise ValueError("MACD calculation resulted in NaN - insufficient real market data")
        
        if current_macd > current_signal:
            return "Bullish"
        elif current_macd < current_signal:
            return "Bearish"
        else:
            return "Neutral"
    
    def calculate_bollinger_position(self, prices: pd.Series, period: int = 20, std_dev: int = 2) -> str:
        """Calculate Bollinger Bands position - NO FALLBACK DATA"""
        if len(prices) < period:
            raise ValueError(f"Insufficient data for Bollinger Bands calculation: need {period}, got {len(prices)}")
        
        ma = prices.rolling(window=period).mean()
        std = prices.rolling(window=period).std()
        upper_band = ma + (std * std_dev)
        lower_band = ma - (std * std_dev)
        
        current_price = prices.iloc[-1]
        current_upper = upper_band.iloc[-1]
        current_lower = lower_band.iloc[-1]
        current_ma = ma.iloc[-1]
        
        if pd.isna(current_price) or pd.isna(current_upper) or pd.isna(current_lower) or pd.isna(current_ma):
            raise ValueError("Bollinger Bands calculation resulted in NaN - insufficient real market data")
        
        if current_price > current_upper:
            return "Above Upper Band"
        elif current_price < current_lower:
            return "Below Lower Band"
        elif current_price > current_ma:
            return "Above Middle"
        else:
            return "Below Middle"
    
    def analyze_portfolio_technical(self, symbols: List[str], weights: Dict[str, float]) -> Dict:
        """Analyze technical indicators for portfolio using real market data"""
        try:
            logger.info(f"Starting technical analysis for {len(symbols)} symbols")
            
            # Try multiple periods if 6mo fails
            price_data = None
            for period in ["6mo", "3mo", "1mo"]:
                try:
                    price_data = self.data_client.get_price_data(symbols, period=period)
                    if price_data is not None and not price_data.empty:
                        logger.info(f"Successfully fetched data with {period} period")
                        break
                except Exception as e:
                    logger.warning(f"Failed to fetch data with {period}: {e}")
                    continue
            
            if price_data is None or price_data.empty:
                raise ValueError("No real market data available for technical analysis")
            
            valid_symbols = []
            for symbol in symbols:
                if symbol in price_data.columns:
                    prices = price_data[symbol].dropna()
                    if len(prices) >= 20:  # Lowered to 20 days minimum
                        valid_symbols.append(symbol)
                        logger.info(f"Valid data for {symbol}: {len(prices)} days")
                    else:
                        logger.warning(f"Insufficient data for {symbol}: {len(prices)} days")
                else:
                    logger.warning(f"No data found for {symbol}")
            
            if not valid_symbols:
                raise ValueError("No symbols have sufficient real market data for technical analysis")
            
            weighted_rsi = 0.0
            portfolio_momentum = 0.0
            portfolio_bollinger = 0.0
            total_weight = 0.0
            
            for symbol in valid_symbols:
                weight = weights.get(symbol, 0)
                if weight <= 0:
                    continue
                
                try:
                    prices = price_data[symbol].dropna()
                    
                    rsi = self.calculate_rsi(prices, 14)
                    macd_signal = self.calculate_macd(prices)
                    bollinger_position = self.calculate_bollinger_position(prices)
                    
                    logger.info(f"{symbol}: RSI={rsi:.1f}, MACD={macd_signal}, Bollinger={bollinger_position}")
                    
                    weighted_rsi += rsi * weight
                    
                    momentum_score = 1 if macd_signal == "Bullish" else -1 if macd_signal == "Bearish" else 0
                    bollinger_score = 1 if bollinger_position == "Above Upper Band" else -1 if bollinger_position == "Below Lower Band" else 0
                    
                    portfolio_momentum += momentum_score * weight
                    portfolio_bollinger += bollinger_score * weight
                    total_weight += weight
                    
                except Exception as e:
                    logger.warning(f"Error calculating indicators for {symbol}: {e}")
                    continue
            
            if total_weight == 0:
                raise ValueError("No valid weighted positions with sufficient real market data")
            
            weighted_rsi = weighted_rsi / total_weight
            portfolio_momentum = portfolio_momentum / total_weight
            portfolio_bollinger = portfolio_bollinger / total_weight
            
            macd_signal = "Bullish" if portfolio_momentum > 0.2 else "Bearish" if portfolio_momentum < -0.2 else "Neutral"
            bollinger_position = "Above Upper" if portfolio_bollinger > 0.3 else "Below Lower" if portfolio_bollinger < -0.3 else "Middle Range"
            
            result = {
                'rsi_14': round(weighted_rsi, 1),
                'macd_signal': macd_signal,
                'bollinger_position': bollinger_position,
                'momentum_score': round(portfolio_momentum, 2),
                'bollinger_score': round(portfolio_bollinger, 2)
            }
            
            logger.info(f"Technical analysis completed: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Technical analysis failed: {e}")
            raise ValueError(f"Technical analysis failed with real market data: {e}")