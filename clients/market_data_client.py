import yfinance as yf
import requests
import pandas as pd
import time
from typing import List, Optional, Dict
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from utils.config import Config
from utils.logger import logger

class RateLimiter:
    def __init__(self, calls_per_minute: int = 60):
        self.calls_per_minute = calls_per_minute
        self.calls = []
    
    def wait_if_needed(self):
        now = datetime.now()
        self.calls = [call for call in self.calls if now - call < timedelta(minutes=1)]
        
        if len(self.calls) >= self.calls_per_minute:
            sleep_time = 60 - (now - self.calls[0]).seconds
            time.sleep(sleep_time)
        
        self.calls.append(now)

class DataProvider(ABC):
    @abstractmethod
    def get_price_data(self, symbols: List[str], period: str) -> Optional[pd.DataFrame]:
        pass
    
    @abstractmethod
    def get_options_chain(self, symbol: str) -> Optional[pd.DataFrame]:
        pass

class YFinanceProvider(DataProvider):
    def __init__(self):
        self.rate_limiter = RateLimiter(60)
    
    def _filter_symbols(self, symbols: List[str]) -> List[str]:
        """Filter out invalid symbols"""
        valid_symbols = []
        for symbol in symbols:
            if not symbol or not isinstance(symbol, str):
                continue
            
            symbol = symbol.strip().upper()
            
            # Skip options contracts and delisted stocks
            if any(x in symbol for x in ['C00', 'P00']):
                continue
            
            if symbol in ['ACHN', 'CASH']:
                continue
            
            valid_symbols.append(symbol)
        
        return valid_symbols
    
    def get_price_data(self, symbols: List[str], period: str) -> Optional[pd.DataFrame]:
        try:
            self.rate_limiter.wait_if_needed()
            
            # Filter out invalid symbols using the same logic as MarketDataClient
            valid_symbols = self._filter_symbols(symbols)
            if not valid_symbols:
                return None
            
            import warnings
            warnings.filterwarnings('ignore', category=FutureWarning)
            
            # Use auto_adjust=False to avoid the warning
            data = yf.download(
                valid_symbols, 
                period=period, 
                progress=False, 
                auto_adjust=False
            )
            
            if data.empty:
                return None
            
            # Handle single vs multiple symbols and column structure
            if data.empty:
                return None
            
            # Handle multi-level columns from yfinance
            if isinstance(data.columns, pd.MultiIndex):
                # Try Adj Close first, then Close
                if 'Adj Close' in data.columns.levels[0]:
                    result = data['Adj Close']
                elif 'Close' in data.columns.levels[0]:
                    result = data['Close']
                else:
                    # Fallback: flatten multi-index and take relevant columns
                    data.columns = ['_'.join(col).strip() for col in data.columns.values]
                    result = data
                
                # Ensure proper column names
                if hasattr(result, 'columns'):
                    return result
                else:
                    return pd.DataFrame(result)
            else:
                # Single symbol case or already flat columns
                if len(symbols) == 1 and 'Adj Close' in data.columns:
                    return pd.DataFrame({symbols[0]: data['Adj Close']})
                else:
                    return data
        except Exception as e:
            logger.error(f"YFinance provider error: {e}")
            return None
    
    def get_options_chain(self, symbol: str) -> Optional[pd.DataFrame]:
        try:
            self.rate_limiter.wait_if_needed()
            ticker = yf.Ticker(symbol)
            expirations = ticker.options
            if not expirations:
                return None
            chain = ticker.option_chain(expirations[0])
            return chain.calls
        except:
            return None

class PolygonProvider(DataProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.rate_limiter = RateLimiter(5)  # Free tier limit
        self.base_url = "https://api.polygon.io"
    
    def get_price_data(self, symbols: List[str], period: str) -> Optional[pd.DataFrame]:
        try:
            data = {}
            for symbol in symbols:
                self.rate_limiter.wait_if_needed()
                url = f"{self.base_url}/v2/aggs/ticker/{symbol}/range/1/day/2023-01-01/2024-01-01"
                response = requests.get(url, params={'apikey': self.api_key})
                if response.status_code == 200:
                    json_data = response.json()
                    if 'results' in json_data:
                        df = pd.DataFrame(json_data['results'])
                        df['date'] = pd.to_datetime(df['t'], unit='ms')
                        df.set_index('date', inplace=True)
                        data[symbol] = df['c']  # Close price
            return pd.DataFrame(data) if data else None
        except:
            return None
    
    def get_options_chain(self, symbol: str) -> Optional[pd.DataFrame]:
        return None  # Polygon options require premium subscription

class AlphaVantageProvider(DataProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.rate_limiter = RateLimiter(5)  # Free tier limit
        self.base_url = "https://www.alphavantage.co/query"
    
    def get_price_data(self, symbols: List[str], period: str) -> Optional[pd.DataFrame]:
        try:
            data = {}
            for symbol in symbols:
                self.rate_limiter.wait_if_needed()
                params = {
                    'function': 'TIME_SERIES_DAILY_ADJUSTED',
                    'symbol': symbol,
                    'apikey': self.api_key
                }
                response = requests.get(self.base_url, params=params)
                if response.status_code == 200:
                    json_data = response.json()
                    if 'Time Series (Daily)' in json_data:
                        ts_data = json_data['Time Series (Daily)']
                        df = pd.DataFrame.from_dict(ts_data, orient='index')
                        df.index = pd.to_datetime(df.index)
                        data[symbol] = df['5. adjusted close'].astype(float)
            return pd.DataFrame(data) if data else None
        except:
            return None
    
    def get_options_chain(self, symbol: str) -> Optional[pd.DataFrame]:
        return None  # Alpha Vantage doesn't provide options data

class TwelveDataProvider(DataProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.rate_limiter = RateLimiter(8)  # Free tier limit
        self.base_url = "https://api.twelvedata.com"
    
    def get_price_data(self, symbols: List[str], period: str) -> Optional[pd.DataFrame]:
        try:
            self.rate_limiter.wait_if_needed()
            symbol_str = ','.join(symbols)
            params = {
                'symbol': symbol_str,
                'interval': '1day',
                'apikey': self.api_key,
                'format': 'JSON'
            }
            response = requests.get(f"{self.base_url}/time_series", params=params)
            if response.status_code == 200:
                json_data = response.json()
                # Process Twelve Data response format
                return None  # Simplified for now
        except:
            return None
    
    def get_options_chain(self, symbol: str) -> Optional[pd.DataFrame]:
        return None

class FinnhubProvider(DataProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.rate_limiter = RateLimiter(60)  # Free tier: 60 calls/minute
        self.base_url = "https://finnhub.io/api/v1"
    
    def get_price_data(self, symbols: List[str], period: str) -> Optional[pd.DataFrame]:
        try:
            data = {}
            # Convert period to timestamps
            end_time = int(datetime.now().timestamp())
            if period == "1y":
                start_time = end_time - (365 * 24 * 3600)
            elif period == "6mo":
                start_time = end_time - (180 * 24 * 3600)
            else:
                start_time = end_time - (30 * 24 * 3600)
            
            for symbol in symbols:
                self.rate_limiter.wait_if_needed()
                params = {
                    'symbol': symbol,
                    'resolution': 'D',
                    'from': start_time,
                    'to': end_time,
                    'token': self.api_key
                }
                response = requests.get(f"{self.base_url}/stock/candle", params=params)
                if response.status_code == 200:
                    json_data = response.json()
                    if json_data.get('s') == 'ok' and 'c' in json_data:
                        dates = pd.to_datetime(json_data['t'], unit='s')
                        prices = json_data['c']  # Close prices
                        data[symbol] = pd.Series(prices, index=dates)
            return pd.DataFrame(data) if data else None
        except:
            return None
    
    def get_options_chain(self, symbol: str) -> Optional[pd.DataFrame]:
        return None

class EODHDProvider(DataProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.rate_limiter = RateLimiter(100)  # EODHD allows 100 requests/minute
        self.base_url = "https://eodhd.com/api"
    
    def get_price_data(self, symbols: List[str], period: str) -> Optional[pd.DataFrame]:
        try:
            data = {}
            for symbol in symbols:
                self.rate_limiter.wait_if_needed()
                params = {
                    'api_token': self.api_key,
                    'fmt': 'json'
                }
                response = requests.get(f"{self.base_url}/eod/{symbol}.US", params=params)
                if response.status_code == 200:
                    json_data = response.json()
                    if json_data:
                        df = pd.DataFrame(json_data)
                        df['date'] = pd.to_datetime(df['date'])
                        df.set_index('date', inplace=True)
                        data[symbol] = df['adjusted_close'].astype(float)
            return pd.DataFrame(data) if data else None
        except Exception as e:
            logger.error(f"EODHD provider error: {e}")
            return None
    
    def get_options_chain(self, symbol: str) -> Optional[pd.DataFrame]:
        try:
            self.rate_limiter.wait_if_needed()
            params = {
                'api_token': self.api_key,
                'fmt': 'json'
            }
            response = requests.get(f"{self.base_url}/options/{symbol}.US", params=params)
            if response.status_code == 200:
                return pd.DataFrame(response.json())
        except:
            pass
        return None

class MarketDataClient:
    def __init__(self):
        self.providers = []
        from utils.cache_manager import cache_manager
        self.cache_manager = cache_manager
        
        # Add providers based on available API keys (priority order)
        if Config.EODHD_API_KEY:
            self.providers.append(EODHDProvider(Config.EODHD_API_KEY))
        if Config.FINNHUB_API_KEY:
            self.providers.append(FinnhubProvider(Config.FINNHUB_API_KEY))
        if Config.POLYGON_API_KEY:
            self.providers.append(PolygonProvider(Config.POLYGON_API_KEY))
        if Config.ALPHA_VANTAGE_API_KEY:
            self.providers.append(AlphaVantageProvider(Config.ALPHA_VANTAGE_API_KEY))
        if Config.TWELVE_DATA_API_KEY:
            self.providers.append(TwelveDataProvider(Config.TWELVE_DATA_API_KEY))
        
        # YFinance as fallback (always available)
        self.providers.append(YFinanceProvider())
    
    def get_price_data(self, symbols: List[str], period: str = "1y") -> pd.DataFrame:
        # Filter valid symbols before processing
        valid_symbols = self._filter_valid_symbols(symbols)
        if not valid_symbols:
            return pd.DataFrame()
        
        for provider in self.providers:
            try:
                data = provider.get_price_data(valid_symbols, period)
                if data is not None and not data.empty:
                    logger.info(f"Successfully fetched data from {provider.__class__.__name__}")
                    return data
            except Exception as e:
                continue
        
        raise Exception("All data providers failed")
    
    def get_current_prices(self, symbols: List[str]) -> Dict[str, float]:
        # Filter valid symbols
        valid_symbols = self._filter_valid_symbols(symbols)
        
        for provider in self.providers:
            try:
                if isinstance(provider, YFinanceProvider):
                    import warnings
                    warnings.filterwarnings('ignore', category=FutureWarning)
                    
                    prices = {}
                    for symbol in valid_symbols:
                        try:
                            ticker = yf.Ticker(symbol)
                            hist = ticker.history(period="1d", auto_adjust=False)
                            if not hist.empty:
                                prices[symbol] = hist['Close'].iloc[-1]
                        except Exception as e:
                            logger.warning(f"Skipping {symbol}: {e}")
                            continue
                    if prices:
                        return prices
            except:
                continue
        return {}
    
    def _filter_valid_symbols(self, symbols: List[str]) -> List[str]:
        """Filter out invalid symbols"""
        valid_symbols = []
        for symbol in symbols:
            if not symbol or not isinstance(symbol, str):
                continue
            
            symbol = symbol.strip().upper()
            
            # Skip options contracts and delisted stocks
            if any(x in symbol for x in ['C00', 'P00']):
                logger.warning(f"Skipping options contract: {symbol}")
                continue
            
            if symbol in ['ACHN', 'CASH']:
                logger.warning(f"Skipping delisted/invalid symbol: {symbol}")
                continue
            
            valid_symbols.append(symbol)
        
        return valid_symbols
    
    def get_options_chain(self, symbol: str) -> Optional[pd.DataFrame]:
        for provider in self.providers:
            try:
                data = provider.get_options_chain(symbol)
                if data is not None and not data.empty:
                    return data
            except:
                continue
        return None