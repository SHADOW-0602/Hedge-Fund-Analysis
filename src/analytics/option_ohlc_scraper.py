import os
import time
import random
import requests
import pandas as pd
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Union
from concurrent.futures import ThreadPoolExecutor, as_completed

# Setup logger
logger = logging.getLogger(__name__)

class OptionOHLCScraper:
    """
    A reusable, fault-tolerant system to programmatically generate and fetch
    Polygon.io option OHLC data.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('POLYGON_API_KEY')
        if not self.api_key:
            raise ValueError("POLYGON_API_KEY is required.")
            
        self.base_url = "https://api.polygon.io"
        self.session = requests.Session()
        
        # Configuration
        self.ENABLE_STRIKE_FILTER = False  # Set to True to enable dynamic strike filtering
        self.STRIKE_FILTER_PERCENT = 0.20  # +/- 20%
        self.MAX_WORKERS = 2               # For parallel processing
        self.RETRY_ATTEMPTS = 3
        self.RETRY_BACKOFF = 12            # Seconds
        
        # Simple in-memory cache for underlying prices to avoid repeated calls
        # Key: "{symbol}_{date}" -> Value: price
        self.price_cache = {}

    def format_expiry_date(self, date_str: str) -> str:
        """
        Converts human-readable date (1/17/2025 or 2025-01-17) to YYMMDD format.
        """
        try:
            # Try MM/DD/YYYY first
            dt = datetime.strptime(date_str, "%m/%d/%Y")
        except ValueError:
            try:
                # Try YYYY-MM-DD
                dt = datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                raise ValueError(f"Invalid date format: {date_str}. Expected MM/DD/YYYY or YYYY-MM-DD.")
        
        return dt.strftime("%y%m%d")

    def format_strike(self, strike: float) -> str:
        """
        Converts strike price to Polygon OCC format (scaled by 1000, zero-padded to 8 digits).
        Example: 2.5 -> 00002500
        """
        scaled_strike = int(strike * 1000)
        return f"{scaled_strike:08d}"

    def build_option_symbol(self, underlying: str, expiry_date: str, 
                           option_type: str, strike: float) -> str:
        """
        Constructs the OCC option symbol.
        Format: O:{UNDERLYING}{YYMMDD}{C/P}{STRIKE_PADDED}
        """
        # Sanitize Inputs
        underlying = underlying.replace('$', '').strip()
        strike = float(strike) # Ensure float

        formatted_expiry = self.format_expiry_date(expiry_date)
        formatted_strike = self.format_strike(strike)
        # Using "O:" prefix as per Polygon docs for v2/aggs usually, 
        # but the ticker itself in the path usually doesn't have "O:" prefix inside the URL segment 
        # for some endpoints, but let's stick to the standard ticker format.
        # Polygon Ticker: O:AAPL250117C00015000
        return f"O:{underlying.upper()}{formatted_expiry}{option_type.upper()}{formatted_strike}"

    def get_underlying_price_on_date(self, symbol: str, date_str: str) -> Optional[float]:
        """
        Fetches the closing price of the underlying symbol on a specific date.
        Uses in-memory cache to minimize API calls.
        """
        cache_key = f"{symbol}_{date_str}"
        if cache_key in self.price_cache:
            return self.price_cache[cache_key]

        # Convert date format if necessary for API: YYYY-MM-DD
        try:
            target_date = datetime.strptime(date_str, "%m/%d/%Y").strftime("%Y-%m-%d")
        except ValueError:
            target_date = date_str # Assume it's already YYYY-MM-DD or compatible

        # Fetch daily open/close for that date
        url = f"{self.base_url}/v1/open-close/{symbol.upper()}/{target_date}"
        params = {"adjusted": "true", "apiKey": self.api_key}
        
        try:
            response = self.session.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                price = data.get('close')
                self.price_cache[cache_key] = price
                return price
            else:
                logger.warning(f"Failed to fetch price for {symbol} on {target_date}: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error fetching price for {symbol}: {e}")
            return None

    def fetch_option_ohlc(self, option_symbol: str, 
                         start_date: str = "2023-01-01", 
                         end_date: str = None) -> List[Dict]:
        """
        Fetches OHLC data for a specific option symbol.
        Tries Polygon first, then Yahoo Finance, then Finnhub.
        """
        # Default end date to today if not provided
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
            
        # 1. Try Polygon
        results = self._fetch_from_polygon(option_symbol, start_date, end_date)
        if results:
            return results
            
        logger.info(f"Polygon failed or empty for {option_symbol}. Trying fallback providers...")
        
        # 2. Try Yahoo Finance (Free, Good for active options)
        # Yahoo Option Format: AAPL250117C00015000 (Same as OCC but check casing/prefix)
        # Polygon uses O: prefix sometimes, OCC is without. yfinance expects just the ticker.
        # option_symbol passed here is likely "O:..." from build_option_symbol. Clean it.
        clean_symbol = option_symbol.replace("O:", "")
        results = self._fetch_from_yfinance(clean_symbol, start_date, end_date)
        if results:
            logger.info(f"Detailed fetch from Yahoo Finance successful for {clean_symbol}")
            return results

        # 3. Try Finnhub (Often requires premium for options, but added as requested)
        results = self._fetch_from_finnhub(clean_symbol, start_date, end_date)
        if results:
             logger.info(f"Detailed fetch from Finnhub successful for {clean_symbol}")
             return results
             
        return []

    def _fetch_from_polygon(self, option_symbol: str, start_date: str, end_date: str) -> List[Dict]:
        """Polygon implementation"""
        url = f"{self.base_url}/v2/aggs/ticker/{option_symbol}/range/1/day/{start_date}/{end_date}"
        params = {
            "adjusted": "true",
            "sort": "asc",
            "limit": 50000,
            "apiKey": self.api_key
        }
        
        for attempt in range(self.RETRY_ATTEMPTS):
            try:
                # Add jitter to prevent thundering herd
                time.sleep(random.uniform(1.5, 3.0))
                
                response = self.session.get(url, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "OK" and data.get("resultsCount", 0) > 0:
                        return data.get("results", []) # Polygon format: [{'t':..., 'o':...}]
                    return []
                elif response.status_code == 429:
                    logger.warning(f"Polygon Rate limit on {option_symbol}. Retrying...")
                    time.sleep(self.RETRY_BACKOFF * (attempt + 1))
                elif response.status_code == 404:
                    return []
                else:
                    return []
            except Exception as e:
                logger.error(f"Polygon error: {e}")
                time.sleep(self.RETRY_BACKOFF)
        return []

    def _fetch_from_yfinance(self, symbol: str, start_date: str, end_date: str) -> List[Dict]:
        """Yahoo Finance implementation using yfinance"""
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            # yfinance history returns a DataFrame
            df = ticker.history(start=start_date, end=end_date, interval="1d")
            
            if df.empty:
                return []
                
            results = []
            for index, row in df.iterrows():
                # Convert to Polygon-like format for consistency
                results.append({
                    't': int(index.timestamp() * 1000),
                    'o': row['Open'],
                    'h': row['High'],
                    'l': row['Low'],
                    'c': row['Close'],
                    'v': row['Volume'],
                    'vw': 0, # Not provided
                    'n': 0   # Not provided
                })
            return results
        except Exception as e:
            logger.warning(f"Yahoo Finance fetch failed for {symbol}: {e}")
            return []

    def _fetch_from_finnhub(self, symbol: str, start_date: str, end_date: str) -> List[Dict]:
        """Finnhub implementation"""
        finnhub_key = os.getenv('FINNHUB_API_KEY')
        if not finnhub_key:
            return []
            
        # Finnhub Stock Candles endpoint (may work for options if symbol matches)
        # https://finnhub.io/api/v1/stock/candle?symbol=...
        url = "https://finnhub.io/api/v1/stock/candle"
        
        try:
            # Convert dates to unix timestamp
            start_ts = int(datetime.strptime(start_date, "%Y-%m-%d").timestamp())
            end_ts = int(datetime.strptime(end_date, "%Y-%m-%d").timestamp())
            
            # Note: Finnhub option symbols often have slightly different format or require specific endpoint.
            # We try the standard OCC symbol here.
            params = {
                'symbol': symbol,
                'resolution': 'D',
                'from': start_ts,
                'to': end_ts,
                'token': finnhub_key
            }
            
            response = self.session.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('s') == 'ok':
                    # Convert to Polygon format
                    results = []
                    for i in range(len(data['t'])):
                        results.append({
                            't': data['t'][i] * 1000,
                            'o': data['o'][i],
                            'h': data['h'][i],
                            'l': data['l'][i],
                            'c': data['c'][i],
                            'v': data['v'][i],
                            'vw': 0,
                            'n': 0
                        })
                    return results
            return []
        except Exception as e:
            logger.warning(f"Finnhub fetch failed for {symbol}: {e}")
            return []

    def process_single_task(self, task: Dict) -> List[Dict]:
        """
        Worker function for processing a single option task.
        Returns a list of daily records.
        """
        symbol = task['symbol']
        expiry = task['expiry']
        strike = task['strike']
        option_type = task.get('type', 'C')
        
        # 1. Price Filter Check (if enabled)
        if self.ENABLE_STRIKE_FILTER:
            # We need a reference date to check the price. 
            # Ideally this is "today" or the date we are considering purchasing.
            # For backfilling, maybe use valid date or just skip filter for now.
            # Simulating logic: Check price on *expiry date* (or nearest past date if future)
            # This logic is nuanced. For now, let's assume we check 'recent' price or skip.
            # To strictly follow: "Fetch underlying stock price on or before expiration date"
            
            # Use yesterday's date as a proxy for "current/recent" if fetching active options
            # If expired, use expiry date.
            check_date = expiry 
            underlying_price = self.get_underlying_price_on_date(symbol, check_date)
            
            if underlying_price:
                lower = underlying_price * (1 - self.STRIKE_FILTER_PERCENT)
                upper = underlying_price * (1 + self.STRIKE_FILTER_PERCENT)
                if not (lower <= strike <= upper):
                    return [] # Skip this strike


        # 2. Build Symbol
        try:
            option_ticker = self.build_option_symbol(symbol, expiry, option_type, strike)
        except ValueError as e:
            logger.error(f"Error building symbol: {e}")
            return []

        # 3. Fetch OHLC
        # Start date: A reasonable lookback, e.g., 2 years or from listing
        results = self.fetch_option_ohlc(option_ticker, start_date="2023-01-01")
        
        # 4. Transform Results
        records = []
        for day in results:
            records.append({
                "underlying": symbol,
                "expiration": self.format_expiry_date(expiry), # Store as YYMMDD or standard format? User requested standard in metadata? No, let's keep clean.
                "expiration_date": expiry,
                "strike": strike,
                "option_type": option_type,
                "option_symbol": option_ticker,
                "date": datetime.fromtimestamp(day['t'] / 1000).strftime('%Y-%m-%d'),
                "open": day.get('o'),
                "high": day.get('h'),
                "low": day.get('l'),
                "close": day.get('c'),
                "volume": day.get('v'),
                "vwap": day.get('vw'),
                "transactions": day.get('n')
            })
            
        return records

    def run_scraper(self, symbols: List[str], expirations: List[str], 
                   strikes: List[float]) -> pd.DataFrame:
        """
        Main batch job entry point.
        """
        tasks = []
        # Generate task list
        for symbol in symbols:
            for expiry in expirations:
                for strike in strikes:
                    tasks.append({
                        'symbol': symbol,
                        'expiry': expiry,
                        'strike': strike,
                        'type': 'C' # Default to Calls
                    })
        
        logger.info(f"Starting scraper for {len(tasks)} combinations...")
        all_records = []
        
        # Parallel Execution
        with ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as executor:
            future_to_task = {executor.submit(self.process_single_task, task): task for task in tasks}
            
            for i, future in enumerate(as_completed(future_to_task)):
                task = future_to_task[future]
                try:
                    data = future.result()
                    if data:
                        all_records.extend(data)
                    
                    if (i + 1) % 10 == 0:
                        logger.info(f"Processed {i + 1}/{len(tasks)} tasks...")
                        
                except Exception as e:
                    logger.error(f"Task failed for {task}: {e}")
        
        df = pd.DataFrame(all_records)
        return df

    def generate_csv(self, df: pd.DataFrame) -> Optional[str]:
        """
        Saves DataFrame to CSV and optionally uploads to Cloudflare R2.
        Returns the local filepath or R2 object URL.
        """
        if df.empty:
            return None
            
        filename = f"option_ohlc_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        # Save locally first
        import tempfile
        temp_dir = tempfile.gettempdir()
        local_filepath = os.path.join(temp_dir, filename)
        
        df.to_csv(local_filepath, index=False)
        logger.info(f"Saved local CSV to {local_filepath}")

        # Upload to R2 if credentials exist
        r2_url = self.upload_to_r2(local_filepath, filename)
        if r2_url:
            return r2_url
            
        return local_filepath

    def upload_to_r2(self, filepath: str, filename: str) -> Optional[str]:
        """
        Uploads a file to Cloudflare R2.
        """
        account_id = os.getenv('CLOUDFLARE_ACCOUNT_ID')
        access_key = os.getenv('R2_ACCESS_KEY_ID')
        secret_key = os.getenv('R2_SECRET_ACCESS_KEY')
        bucket_name = os.getenv('R2_BUCKET_NAME')
        
        if not all([account_id, access_key, secret_key, bucket_name]):
            logger.warning("Cloudflare R2 credentials missing. Skipping upload.")
            return None
            
        try:
            import boto3
            from botocore.config import Config
            
            s3 = boto3.client(
                's3',
                endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                config=Config(signature_version='s3v4')
            )
            
            logger.info(f"Uploading {filename} to R2 bucket {bucket_name}...")
            s3.upload_file(filepath, bucket_name, filename)
            logger.info("Upload successful.")
            
            # Return a generic indication or construct a URL if public access is enabled
            # For now, returning the R2 path identifier
            return f"r2://{bucket_name}/{filename}"
            
        except ImportError:
            logger.error("boto3 not installed. Cannot upload to R2.")
            return None
        except Exception as e:
            logger.error(f"R2 Upload failed: {e}")
            return None
