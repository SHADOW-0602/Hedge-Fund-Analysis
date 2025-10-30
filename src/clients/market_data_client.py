import yfinance as yf
import requests
import pandas as pd
import time
from typing import List, Optional, Dict
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from utils.config import Config
from utils.logger import logger
import logging

# Setup module logger
module_logger = logging.getLogger(__name__)

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
            module_logger.info(f"YFinance: Fetching data for {len(symbols)} symbols, period: {period}")
            self.rate_limiter.wait_if_needed()
            
            # Filter out invalid symbols using the same logic as MarketDataClient
            valid_symbols = self._filter_symbols(symbols)
            if not valid_symbols:
                module_logger.warning("No valid symbols after filtering")
                return None
            
            import warnings
            warnings.filterwarnings('ignore', category=FutureWarning)
            
            # Use auto_adjust=False and suppress warnings
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                data = yf.download(
                    valid_symbols, 
                    period=period, 
                    progress=False, 
                    auto_adjust=False,
                    threads=False
                )
            
            if data.empty:
                return None
            
            # Check if data is empty
            if data.empty:
                module_logger.warning("No data returned")
                return None
            
            # Handle multi-level columns from yfinance
            if isinstance(data.columns, pd.MultiIndex):
                # Try Adj Close first, then Close
                if 'Adj Close' in data.columns.levels[0]:
                    result = data['Adj Close']
                elif 'Close' in data.columns.levels[0]:
                    result = data['Close']
                else:
                    return None
                
                # Drop rows with all NaN values
                result = result.dropna(how='all')
                if result.empty:
                    module_logger.warning("No clean data after removing NaN")
                    return None
                    
                return result
            else:
                # Single symbol case
                if len(valid_symbols) == 1:
                    if 'Adj Close' in data.columns:
                        clean_data = data['Adj Close'].dropna()
                        if clean_data.empty:
                            return None
                        return pd.DataFrame({valid_symbols[0]: clean_data})
                    elif 'Close' in data.columns:
                        clean_data = data['Close'].dropna()
                        if clean_data.empty:
                            return None
                        return pd.DataFrame({valid_symbols[0]: clean_data})
                
                # Clean and validate multi-symbol data
                clean_data = data.dropna(how='all')
                if clean_data.empty:
                    return None
                return clean_data
        except Exception as e:
            module_logger.error(f"YFinance provider error: {e}")
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
                
                # Use previous close endpoint (free tier)
                url = f"{self.base_url}/v2/aggs/ticker/{symbol}/prev"
                params = {
                    'adjusted': 'true',
                    'apikey': self.api_key
                }
                
                response = requests.get(url, params=params, timeout=5)
                
                if response.status_code == 200:
                    json_data = response.json()
                    if json_data.get('status') == 'OK' and 'results' in json_data:
                        results = json_data['results'][0]
                        # Create price series with current close
                        data[symbol] = [results['c']]  # Close price
                        
            if data:
                # Create DataFrame with current timestamp
                df = pd.DataFrame(data, index=[pd.Timestamp.now()])
                return df
            return None
        except Exception as e:
            logger.error(f"Polygon provider error: {e}")
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
                response = requests.get(self.base_url, params=params, timeout=5)
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
            response = requests.get(f"{self.base_url}/time_series", params=params, timeout=5)
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
                response = requests.get(f"{self.base_url}/stock/candle", params=params, timeout=5)
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



class MarketDataClient:
    def __init__(self):
        self.providers = []
        # Removed cache_manager - using direct API calls
        
        # Add providers based on available API keys (Polygon as primary)
        if Config.POLYGON_API_KEY:
            self.providers.append(PolygonProvider(Config.POLYGON_API_KEY))
        if Config.FINNHUB_API_KEY:
            self.providers.append(FinnhubProvider(Config.FINNHUB_API_KEY))
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
        
        # Try YFinance first for reliability, then other providers
        yfinance_provider = None
        other_providers = []
        
        for provider in self.providers:
            if isinstance(provider, YFinanceProvider):
                yfinance_provider = provider
            else:
                other_providers.append(provider)
        
        # Try YFinance first
        if yfinance_provider:
            try:
                data = yfinance_provider.get_price_data(valid_symbols, period)
                if data is not None and not data.empty:
                    logger.info(f"Successfully fetched data using YFinance")
                    return data
            except Exception as e:
                logger.warning(f"YFinance failed: {e}")
        
        # Try other providers only if YFinance fails
        for provider in other_providers[:2]:  # Limit to 2 providers to avoid timeouts
            try:
                data = provider.get_price_data(valid_symbols, period)
                if data is not None and not data.empty:
                    logger.info(f"Successfully fetched data using {provider.__class__.__name__}")
                    return data
            except Exception as e:
                logger.warning(f"{provider.__class__.__name__} failed: {e}")
                continue
        
        return pd.DataFrame()
    
    def get_current_prices(self, symbols: List[str]) -> Dict[str, float]:
        # Filter valid symbols
        valid_symbols = self._filter_valid_symbols(symbols)
        if not valid_symbols:
            return {}
        
        prices = {}
        
        # Method 1: Try YFinance Ticker.info for each symbol individually
        for symbol in valid_symbols:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
                if current_price and current_price > 0:
                    prices[symbol] = float(current_price)
                    continue
            except Exception:
                pass
            
            # Method 2: Try YFinance history for individual symbol
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period='2d')
                if not hist.empty and 'Close' in hist.columns:
                    current_price = hist['Close'].iloc[-1]
                    if current_price and current_price > 0:
                        prices[symbol] = float(current_price)
                        continue
            except Exception:
                pass
            
            # Method 3: Try batch download for remaining symbols
            try:
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    data = yf.download(symbol, period='2d', progress=False, threads=False)
                
                if not data.empty:
                    if 'Adj Close' in data.columns:
                        current_price = data['Adj Close'].iloc[-1]
                    elif 'Close' in data.columns:
                        current_price = data['Close'].iloc[-1]
                    else:
                        current_price = None
                    
                    if current_price and current_price > 0:
                        prices[symbol] = float(current_price)
            except Exception:
                pass
        
        if prices:
            logger.info(f"Successfully fetched current prices for {len(prices)}/{len(valid_symbols)} symbols")
        else:
            logger.error("All providers failed to fetch current prices")
        
        return prices
    
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