import os
import time
import queue # Added for AI Queue
import random
import json
import re
import threading
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
import threading
from flask import Blueprint, render_template, jsonify, request
from dotenv import load_dotenv
import requests
from supabase import create_client, Client
import google.generativeai as genai
import yfinance as yf
import pickle
import atexit

# Global Lock for Database Operations
DB_LOCK = threading.Lock()
# AI Queue (Rate Limit Protection)
AI_QUEUE = queue.Queue()

# Load environment variables
load_dotenv()

# Initialize Blueprint
us_news_bp = Blueprint('us_news', __name__, template_folder='templates', static_folder='static', url_prefix='/us-news')

# Initialize Supabase
supabase: Client = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_ANON_KEY')
)

# Groq AI uses standard Requests, no specific client needed here
# Model: llama-3.3-70b-versatile

# Universe of popular stocks to monitor (Top US Companies by Market Cap + Popular Tech/Meme)
# Universe of stocks to monitor (Full List)
TICKER_UNIVERSE = [
    # Top 7 (Priority)
    'AAPL', 'MSFT', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA',
    # Others
    'LLY', 'JPM', 'NFLX', 'BRK-B', 'V', 'UNH', 'AVGO', 'AMD', 'TSM', 'PFE', 'MRK', 'JNJ', 'ORCL', 
    'ADBE', 'CRM', 'COST', 'HD', 'WMT', 'BAC', 'GS', 'UBER', 'DELL', 'PLTR', 'ARM', 'SMCI', 'CRWD', 
    'SNOW', 'NET', 'PDD', 'BABA', 'COIN', 'SOFI', 'TTD', 'ROKU', 'REGN', 'NBIX', 'CORT', 'CAPR', 
    'CRSP', 'NVO', 'GILD', 'BA', 'CAT', 'SPY'
]

# Tickers to display on the main page
# Tickers to display on the main page
DISPLAY_TICKERS = sorted(['AAPL', 'GOOG', 'MSFT', 'META', 'NVDA', 'TSLA', 'AMZN'])

# Global variable to store current active list
# Initialize active tickers with sorted list (Priority first)
sorted_tickers = sorted(TICKER_UNIVERSE, key=lambda x: (x not in DISPLAY_TICKERS, x))
ACTIVE_TICKERS = sorted_tickers
print(f"Initialized {len(ACTIVE_TICKERS)} tickers for processing (Top: {', '.join(ACTIVE_TICKERS[:7])})")

IS_PROCESSING = False  # Track if news processing is running

# Global Cache for Quotes
# key: ticker, value: { 'data': dict, 'timestamp': float }
QUOTE_CACHE = {}

# Cache Persistence File
CACHE_FILE = 'cache_data.pkl'

# Global Cache for Fundamentals
# key: ticker, value: { 'data': dict, 'timestamp': float }
FUNDAMENTALS_CACHE = {}
# Global Cache for History
# key: ticker_period_interval, value: { 'data': dict, 'timestamp': float }
HISTORY_CACHE = {}
# Global Cache for Quant Analysis
# key: ticker, value: { 'data': dict, 'timestamp': float }
QUANT_ANALYSIS_CACHE = {}
# Global Cache for Technical Analysis
# key: ticker_interval, value: { 'data': dict, 'timestamp': float }
TA_CACHE = {}

# Redis Configuration
REDIS_URL = os.getenv('UPSTASH_REDIS_REST_URL')
REDIS_TOKEN = os.getenv('UPSTASH_REDIS_REST_TOKEN')

def get_redis_data(key):
    """Fetch JSON data from Upstash Redis via REST"""
    if not REDIS_URL or not REDIS_TOKEN: return None
    try:
        headers = {"Authorization": f"Bearer {REDIS_TOKEN}"}
        resp = requests.get(f"{REDIS_URL}/get/{key}", headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            # Redis REST returns {"result": "json_string_or_obj"}
            res = data.get('result')
            if res:
                # Upstash might return it as a string if it was stored as string
                if isinstance(res, str):
                    return json.loads(res)
                return res
    except Exception as e:
        print(f"  ⚠ Redis Read Error ({key}): {e}")
    return None

def set_redis_data(key, data):
    """Save JSON data to Upstash Redis via REST"""
    if not REDIS_URL or not REDIS_TOKEN: return
    try:
        headers = {"Authorization": f"Bearer {REDIS_TOKEN}"}
        # Serialize to ensure proper storage
        value = json.dumps(data)
        # REST command: SET key value
        resp = requests.post(f"{REDIS_URL}/set/{key}", headers=headers, data=value, timeout=10) # Post body as data for raw
        if resp.status_code != 200:
             print(f"  ⚠ Redis Write Fail ({key}): {resp.text}")
    except Exception as e:
        print(f"  ⚠ Redis Write Error ({key}): {e}")

def load_cache_from_disk():
    """Load cached data from Redis (preferred) or Pickle (fallback)"""
    global QUOTE_CACHE, FUNDAMENTALS_CACHE, HISTORY_CACHE, QUANT_ANALYSIS_CACHE, TA_CACHE
    
    # 1. Try Redis
    if REDIS_URL and REDIS_TOKEN:
        print("  Using Upstash Redis for Cache...")
        try:
            q = get_redis_data('hf:cache:quotes')
            if q: QUOTE_CACHE.update(q)
            
            f = get_redis_data('hf:cache:fundamentals')
            if f: FUNDAMENTALS_CACHE.update(f)
            
            # h = get_redis_data('hf:cache:history') # Skip heavy history? Or load it?
            # History is huge, might skip for speed if needed, but per plan lets try
            # h = get_redis_data('hf:cache:history')
            # if h: HISTORY_CACHE.update(h)
            
            qa = get_redis_data('hf:cache:quant')
            if qa: QUANT_ANALYSIS_CACHE.update(qa)
            
            ta = get_redis_data('hf:cache:ta')
            if ta: TA_CACHE.update(ta)

            print(f"  ✓ Redis Cache Loaded: {len(QUOTE_CACHE)} quotes, {len(FUNDAMENTALS_CACHE)} stats, {len(QUANT_ANALYSIS_CACHE)} quants, {len(TA_CACHE)} ta.")
            return # Success
        except Exception as e:
            print(f"  ⚠ Redis Load Failed, falling back to disk: {e}")

    # 2. Fallback to Disk
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'rb') as f:
                data = pickle.load(f)
                QUOTE_CACHE.update(data.get('quotes', {}))
                FUNDAMENTALS_CACHE.update(data.get('fundamentals', {}))
                HISTORY_CACHE.update(data.get('history', {}))
                QUANT_ANALYSIS_CACHE.update(data.get('quant', {}))
                TA_CACHE.update(data.get('ta', {}))
                print(f"  ✓ Legacy Pickle Cache Loaded: {len(QUOTE_CACHE)} quotes.")
        except Exception as e:
            print(f"  ⚠ Failed to load cache file: {e}")

def save_cache_to_disk():
    """Save caches to Redis (primary) and Disk (backup)"""
    # 1. Redis Save
    if REDIS_URL and REDIS_TOKEN:
        try:
            # Threading this would be better for performance, but keeping simple for now
            # Note: History cache might be too big for simple Redis strings without compression, skipping history to avoid errors/lag
            set_redis_data('hf:cache:quotes', QUOTE_CACHE)
            set_redis_data('hf:cache:fundamentals', FUNDAMENTALS_CACHE)
            set_redis_data('hf:cache:quant', QUANT_ANALYSIS_CACHE)
            set_redis_data('hf:cache:ta', TA_CACHE)
            # print("  ✓ Redis Cache synced.")
        except Exception as e:
            print(f"  ⚠ Redis Save Error: {e}")

    # 2. Disk Save (Backup)
    try:
        data = {
            'quotes': QUOTE_CACHE,
            'fundamentals': FUNDAMENTALS_CACHE,
            'history': HISTORY_CACHE,
            'quant': QUANT_ANALYSIS_CACHE,
            'ta': TA_CACHE
        }
        with open(CACHE_FILE, 'wb') as f:
            pickle.dump(data, f)
    except Exception as e:
        print(f"  ⚠ Failed to save local cache: {e}")


# Load immediately on import
load_cache_from_disk()

# Register save on exit
atexit.register(save_cache_to_disk)

# List of modern User-Agents to rotate
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/123.0.0.0'
]

# Free Proxy List (HTTPS) - These change frequently, so external rotation is better, 
# but this provides a rigorous "starter pack" for the user.
# Supporting env var PROXIES as comma-separated list
env_proxies = os.getenv('PROXIES')
if env_proxies:
    PROXIES = [p.strip() for p in env_proxies.split(',') if p.strip()]
else:
    # Public pool (examples)
    PROXIES = [
        # None (Direct) - Include 'None' so we sometimes use direct connection (it's faster)
        None, None, None, 
        # Add free proxies here if found, e.g. 'http://1.2.3.4:8080'
    ]

def get_yf_session():
    """Create a requests session with a random User-Agent and Proxy to bypass blocks"""
    session = requests.Session()
    session.headers.update({
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://finance.yahoo.com/',
        'Origin': 'https://finance.yahoo.com'
    })
    
    # Proxy Selection
    if PROXIES:
        proxy = random.choice(PROXIES)
        if proxy:
            session.proxies = {
                'http': proxy,
                'https': proxy
            }
            # print(f"  [DEBUG] Using Proxy: {proxy}")
            
    return session


def fetch_quote_data(ticker):
    """Helper to fetch real-time quote data using yfinance (incl. Pre/Post Market) with Caching"""
    global QUOTE_CACHE
    
    current_time = time.time()
    
    # 1. Check Cache (Reverted to 60s for stability)
    if ticker in QUOTE_CACHE:
        cached = QUOTE_CACHE[ticker]
        if current_time - cached['timestamp'] < 60:
            # print(f"  [DEBUG] Served {ticker} from Cache")
            return cached['data']

    try:
        # Use custom session to rotate User-Agent
        session = get_yf_session()
        stock = yf.Ticker(ticker, session=session)
        
        # fast_info often misses pre-market. Use history for latest tick.
        # caching: yfinance might cache history calls, but creating a new Ticker usually avoids instance cache.
        # Yahoo API itself has 1-min delay usually.
        df = stock.history(period='1d', interval='1m', prepost=True)
        
        data = None
        
        if not df.empty:
            latest = df.iloc[-1]
            last_price = float(latest['Close'])
            
            # Previous Close (Regular Market)
            # info.previous_close is reliable for yesterday's regular close
            prev_close = stock.info.get('previousClose') or stock.fast_info.previous_close
            
            # Fallback if history fetch fails or returns weird data
            if pd.isna(last_price):
                last_price = stock.fast_info.last_price

            change = last_price - prev_close if prev_close else 0
            change_percent = (change / prev_close) * 100 if prev_close else 0
            
            data = {
                'ticker': ticker,
                'price': round(last_price, 2),
                'previous_close': round(prev_close, 2) if prev_close else None,
                'change': round(change, 2),
                'change_percent': round(change_percent, 2)
            }
        else:
            # Fallback to fast_info if history is empty (e.g., weekend or no data)
            info = stock.fast_info
            last_price = info.last_price
            prev_close = info.previous_close
            
            if prev_close and prev_close > 0:
                change = last_price - prev_close
                change_percent = (change / prev_close) * 100
                data = {
                    'ticker': ticker,
                    'price': round(last_price, 2),
                    'previous_close': round(prev_close, 2) if prev_close else None,
                    'change': round(change, 2),
                    'change_percent': round(change_percent, 2)
                }

        if data:
            # Update Cache
            QUOTE_CACHE[ticker] = {
                'data': data,
                'timestamp': current_time
            }
            return data

    except Exception as e:
        print(f"  ⚠ Yahoo Quote Error for {ticker}: {str(e)}")
        
        # --- FALLBACK 1: POLYGON.IO ---
        poly_key = os.getenv('POLYGON_API_KEY')
        if poly_key:
            try:
                # url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev?adjusted=true&apiKey={poly_key}"
                # Better: Last Trade for real-time
                url = f"https://api.polygon.io/v2/last/trade/{ticker}?apiKey={poly_key}"
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    pdata = resp.json()
                    # Polygon structure: {'results': {'P': price, ...}, ...}
                    res = pdata.get('results', {})
                    price = res.get('p') # price
                    # To get change, we need prev close. 
                    # For simplicity in fallback, we might skip change or fetch prev close separately.
                    # Let's try fetching prev close agg if trade fails or to enrich
                    
                    if price:
                         print(f"  ✓ Using Polygon.io Fallback for {ticker}")
                         data = {
                            'ticker': ticker,
                            'price': round(float(price), 2),
                            'change': 0, # Placeholder
                            'change_percent': 0 # Placeholder
                         }
                         # Try getting prev close for change calculation
                         try:
                             prev_url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev?adjusted=true&apiKey={poly_key}"
                             prev_resp = requests.get(prev_url, timeout=3)
                             if prev_resp.status_code == 200:
                                 prev_res = prev_resp.json().get('results', [{}])[0]
                                 prev_c = prev_res.get('c')
                                 if prev_c:
                                     data['previous_close'] = prev_c
                                     data['change'] = round(price - prev_c, 2)
                                     data['change_percent'] = round((data['change'] / prev_c) * 100, 2)
                         except: pass
                         
                         QUOTE_CACHE[ticker] = {'data': data, 'timestamp': current_time}
                         return data
            except Exception as pe:
                print(f"  ✗ Polygon Fallback Failed: {pe}")

        # --- FALLBACK 2: FINNHUB ---
        finn_key = os.getenv('FINNHUB_API_KEY')
        if finn_key:
            try:
                url = f"https://finnhub.io/api/v1/quote?symbol={ticker}&token={finn_key}"
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    fdata = resp.json()
                    # Finnhub: c: Current, d: Change, dp: Percent, pc: Prev Close
                    price = fdata.get('c')
                    if price and price > 0:
                        print(f"  ✓ Using Finnhub Fallback for {ticker}")
                        data = {
                            'ticker': ticker,
                            'price': round(float(price), 2),
                            'change': round(float(fdata.get('d', 0)), 2),
                            'change_percent': round(float(fdata.get('dp', 0)), 2),
                            'previous_close': round(float(fdata.get('pc', 0)), 2)
                        }
                        QUOTE_CACHE[ticker] = {'data': data, 'timestamp': current_time}
                        return data
            except Exception as fe:
                 print(f"  ✗ Finnhub Fallback Failed: {fe}")

        # --- FALLBACK 3: TWELVE DATA ---
        twelve_key = os.getenv('TWELVE_DATA_API_KEY')
        if twelve_key:
            try:
                url = f"https://api.twelvedata.com/quote?symbol={ticker}&apikey={twelve_key}"
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    tdata = resp.json()
                    # TwelveData: close (or price), previous_close, change, percent_change
                    if 'close' in tdata: # /quote endpoint returns close as current usually? checking docs.
                        # Actually /quote returns real time.
                        price = tdata.get('close') or tdata.get('price') # 'price' in /price endpoint, 'close' in /quote might be daily
                        # Let's assume /quote
                        if price:
                             print(f"  ✓ Using TwelveData Fallback for {ticker}")
                             data = {
                                'ticker': ticker,
                                'price': round(float(price), 2),
                                'change': round(float(tdata.get('change', 0)), 2),
                                'change_percent': round(float(tdata.get('percent_change', 0)), 2),
                                'previous_close': round(float(tdata.get('previous_close', 0) or 0), 2)
                             }
                             QUOTE_CACHE[ticker] = {'data': data, 'timestamp': current_time}
                             return data
            except Exception as te:
                 print(f"  ✗ TwelveData Fallback Failed: {te}")

        # Check if we have stale cache to return instead of failing
        if ticker in QUOTE_CACHE:
            print(f"  ⚠ Returning STALE cache for {ticker}")
            return QUOTE_CACHE[ticker]['data']
            
    return None

# We will let the background thread or first request update this
# ACTIVE_TICKERS = get_dynamic_tickers()

def check_daily_run():
    """Check if the daily news fetch has already run today"""
    today = date.today()
    
    try:
        result = supabase.table('daily_run_tracker').select('*').eq('run_date', str(today)).execute()
        return len(result.data) > 0
    except Exception as e:
        print(f"Error checking daily run: {e}")
        return False

def mark_daily_run():
    """Mark that the daily news fetch has run today"""
    today = date.today()
    
    try:
        # Check if exists first to avoid error log
        result = supabase.table('daily_run_tracker').select('*').eq('run_date', str(today)).execute()
        if not result.data:
            supabase.table('daily_run_tracker').insert({
                'run_date': str(today),
                'status': 'completed'
            }).execute()
            print(f"  ✓ Marked daily run for {today}")
        else:
            print(f"  ✓ Daily run for {today} already marked")
    except Exception as e:
        print(f"Error marking daily run: {e}")


def fetch_av_data(ticker, interval):
    """Fetch data from Alpha Vantage as fallback"""
    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if not api_key: return pd.DataFrame()

    function = 'TIME_SERIES_DAILY'
    av_interval = None
    
    # Map interval to AV format
    if interval in ['1m', '5m', '15m', '30m', '60m', '1h']:
        function = 'TIME_SERIES_INTRADAY'
        av_interval = interval if interval != '1h' else '60min'
        if av_interval == '1m': av_interval = '1min'
        if av_interval == '5m': av_interval = '5min'
        if av_interval == '15m': av_interval = '15min'
        if av_interval == '30m': av_interval = '30min'
    
    url = f"https://www.alphavantage.co/query?function={function}&symbol={ticker}&apikey={api_key}&outputsize=compact"
    if av_interval:
        url += f"&interval={av_interval}"
        
    print(f"  ⚠ Switching to Alpha Vantage for {ticker} ({interval})...")
    try:
        r = requests.get(url, timeout=10)
        data = r.json()
        
        # Parse keys
        ts_key = next((k for k in data.keys() if "Time Series" in k), None)
        if not ts_key:
            print(f"  ✗ AV Error: {data.get('Note') or data.get('Error Message')}")
            return pd.DataFrame()
            
        ts_data = data[ts_key]
        df = pd.DataFrame.from_dict(ts_data, orient='index')
        df = df.rename(columns={
            '1. open': 'Open',
            '2. high': 'High',
            '3. low': 'Low',
            '4. close': 'Close',
            '5. volume': 'Volume'
        })
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()
        
        # Convert to float
        for col in ['Open', 'High', 'Low', 'Close', 'Volume']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            
        return df, 'alpha_vantage'
    except Exception as e:
        print(f"  ✗ AV Fetch Failed: {e}")
        return pd.DataFrame(), ''

def fetch_news_for_ticker(ticker):
    """Fetch news from multiple sources for a given ticker"""
    all_news = []
    
    # Primary 1: Try NewsAPI first
    # Primary 1: Try NewsAPI first
    for attempt in range(3):
        try:
            newsapi_key = os.getenv('NEWSAPI_KEY')
            if newsapi_key:
                url = f"https://newsapi.org/v2/everything?q={ticker}&apiKey={newsapi_key}&pageSize=5&sortBy=publishedAt"
                response = requests.get(url, timeout=5)
                
                if response.status_code == 429:
                    wait = 2 ** attempt
                    print(f"  ⚠ NewsAPI Rate Limit (429). Retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                    
                if response.status_code == 200:
                    data = response.json()
                    for article in data.get('articles', []):
                        all_news.append({
                            'title': article.get('title', ''),
                            'url': article.get('url', ''),
                            'source': article.get('source', {}).get('name', 'NewsAPI'),
                            'published_at': article.get('publishedAt', ''),
                            'description': article.get('description', '')
                        })
                    print(f"  ✓ NewsAPI: {len(data.get('articles', []))} articles")
                    break # Success
        except Exception as e:
            print(f"  ✗ NewsAPI Attempt {attempt+1} Failed: {e}")
            if attempt < 2: time.sleep(1)
    
    # Primary 2: Try Finnhub
    # Primary 2: Try Finnhub
    for attempt in range(3):
        try:
            finnhub_key = os.getenv('FINNHUB_API_KEY')
            if finnhub_key:
                today = date.today()
                week_ago = today - timedelta(days=7)
                url = f"https://finnhub.io/api/v1/company-news?symbol={ticker}&from={week_ago}&to={today}&token={finnhub_key}"
                response = requests.get(url, timeout=5)
                
                if response.status_code == 429:
                    wait = 2 ** attempt
                    print(f"  ⚠ Finnhub Rate Limit (429). Retrying in {wait}s...")
                    time.sleep(wait)
                    continue

                if response.status_code == 200:
                    data = response.json()
                    for article in data[:5]:
                        all_news.append({
                            'title': article.get('headline', ''),
                            'url': article.get('url', ''),
                            'source': article.get('source', 'Finnhub'),
                            'published_at': datetime.fromtimestamp(article.get('datetime', 0)).isoformat(),
                            'description': article.get('summary', '')
                        })
                    print(f"  ✓ Finnhub: {len(data[:5])} articles")
                    break # Success
        except Exception as e:
            print(f"  ✗ Finnhub Attempt {attempt+1} Failed: {e}")
            if attempt < 2: time.sleep(1)
    
    # Fallback 1: Try Polygon
    # Fallback 1: Try Polygon
    for attempt in range(3):
        try:
            polygon_key = os.getenv('POLYGON_API_KEY')
            if polygon_key:
                url = f"https://api.polygon.io/v2/reference/news?ticker={ticker}&limit=5&apiKey={polygon_key}"
                response = requests.get(url, timeout=5)
                
                if response.status_code == 429:
                    print(f"  ⚠ Polygon Rate Limit (429 - 5 calls/min limit). Sleeping 60s to reset...")
                    time.sleep(60)
                    continue

                if response.status_code == 200:
                    data = response.json()
                    for article in data.get('results', []):
                        all_news.append({
                            'title': article.get('title', ''),
                            'url': article.get('article_url', ''),
                            'source': article.get('publisher', {}).get('name', 'Polygon'),
                            'published_at': article.get('published_utc', ''),
                            'description': article.get('description', '')
                        })
                    print(f"  ✓ Polygon: {len(data.get('results', []))} articles")
                    break # Success
        except Exception as e:
            print(f"  ✗ Polygon Attempt {attempt+1} Failed: {e}")
            if attempt < 2: time.sleep(1)
    
    # Fallback 2: Yahoo Finance (no API key needed, reliable fallback)
    try:
        session = get_yf_session()
        stock = yf.Ticker(ticker, session=session)
        news = stock.news
        
        if news:
            for article in news[:10]:  # Get up to 10 articles
                title = article.get('title', '').strip()
                if not title: # Skip empty titles
                    continue
                    
                all_news.append({
                    'title': title,
                    'url': article.get('link', ''),
                    'source': article.get('publisher', 'Yahoo Finance'),
                    'published_at': datetime.fromtimestamp(article.get('providerPublishTime', 0)).isoformat(),
                    'description': article.get('title', '')  # Yahoo doesn't provide description
                })
            print(f"  ✓ Yahoo Finance: {len(news[:10])} articles")
    except Exception as e:
        print(f"  ✗ Yahoo Finance: {e}")
    
    # Final cleanup: Filter out any duplicates or empty titles from other sources
    unique_news = []
    seen_urls = set()
    
    for n in all_news:
        if n['title'] and n['url'] not in seen_urls:
            unique_news.append(n)
            seen_urls.add(n['url'])
            
    print(f"  → Total valid articles fetched: {len(unique_news)}")
    return unique_news

import concurrent.futures

def generate_ai_summary(ticker, news_articles, all_keys_data):
    """Generate AI summary using Gemini REST API with Smart Key Rotation"""
    if not news_articles or not all_keys_data:
        return None
    
    # ... (code omitted for brevity, logic same until request) ...
    # Prepare news content for AI
    news_text = f"Stock Ticker: {ticker}\n\n"
    sources_list = []
    
    for idx, article in enumerate(news_articles[:8], 1):  # Reduced to 8 to avoid TPM limits
        news_text += f"{idx}. {article['title']}\n"
        news_text += f"   Source: {article['source']}\n"
        news_text += f"   {article['description']}\n\n"
        sources_list.append({
            'title': article['title'],
            'url': article['url'],
            'source': article['source']
        })

    # Fetch Sector/Industry context for dynamic persona
    try:
        session = get_yf_session()
        ticker_info = yf.Ticker(ticker, session=session).info
        sector = ticker_info.get('sector', 'General Market')
        industry = ticker_info.get('industry', 'Equities')
        # Clean up if unknown
        if not sector or sector == 'N/A': sector = "General Market" 
        if not industry or industry == 'N/A': industry = "Equities"
    except Exception:
        sector = "General Market"
        industry = "Equities"

    print(f"  Analyst Persona: Specialized in {sector} / {industry}")

    # Updated Prompt to request JSON wrapper around the Markdown
    prompt = f"""
    Role: You are an expert-level **{sector}** and **{industry}** research analyst with 20 years of experience at a top-tier investment bank. You are renowned for your ability to deconstruct complex business models in the **{sector}** sector, analyze competitive moats, and provide a clear, data-driven investment thesis.

    Objective: Generate an exhaustive investment research report on **{ticker}**. The report should be structured, analytical, and serve as a complete guide for an investor.

    Target Length: Approximately 1500-2000 words. Be concise where possible but deep where necessary.

    Core Instructions:
    1. **Format**: **STRICT MARKDOWN ONLY**. Do NOT return JSON. Do NOT use '```markdown' code blocks. Just return the raw text.
    2. **Style**: Use BULLET POINTS for every section. Do NOT write long paragraphs.
    3. **Language**: English Only. Strictly no other languages.
    4. **Tone**: Professional, objective, and data-driven. Adapt your language to the specific nuances of the {industry} industry.
    5. **Metadata**: Do NOT include 'Sector:' or 'Analyst:' headers at the top. Use the title only.
    6. **Citations**: Do NOT include inline citations (e.g. (Source 1)). Sources are linked separately.

    Report Structure:

    ## Corporate Narrative and Genesis
    *   List origin, founders, and initial problem solved.
    *   List key milestones in growth trajectory and "bet the company" moments.

    ## Product & Technology Evolution
    *   List evolution from MVP to current ecosystem.
    *   List key R&D breakthroughs and velocity.
    *   List specific technology stack advantages.

    ## Business Model Deep-Dive
    *   List each revenue stream (Subscription, Ads, Hardware) and how it works.
    *   List unit economics drivers (CAC, LTV, margins).
    *   List contribution of each stream to total revenue.

    ## Go-to-Market & Moat
    *   **Bullet Points Only**: List ideal customer profiles and segments. Do NOT use paragraphs.
    *   **Bullet Points Only**: List specific competitive advantages (Network effects, Switching costs, Brand).

    ## Market & Competition
    *   List TAM/SAM/SOM market sizing trends.
    *   **Create a Markdown Table** comparing the ticker against 3 direct competitors on: Market Cap, Revenue Growth, and Key Differentiator.
    *   List indirect competitors.

    ## Strategic Opportunities & Risks
    *   List 3-5 high-impact growth opportunities.
    *   List 3-5 major existential risks (Regulatory, Tech shift).
    *   List strategic rationale of recent M&A.

    ## Leadership & Governance
    *   List key executive profiles and background.
    *   List founder influence and capital allocation strategy.

    ## Financial Performance & Valuation
    *   **Create a Markdown Table** summarizing key metrics (Recent Year/Quarter): Revenue, Gross Margin, Operating Margin, Net Income, and Free Cash Flow.
    *   List balance sheet strength (Cash vs Debt).
    *   List valuation metrics (P/E, EV/EBITDA) vs history/peers.

    ## Thesis & Recommendation
    *   **Signal**: [BUY / SELL / HOLD]
    *   **Price Target**: [12-month estimate]
    *   List key Bull Case drivers.
    *   List key Bear Case risks.
    
    News Data for Analysis:
    {news_text}

    OUTPUT FORMAT:
    Return the report in clean Markdown format. Do NOT wrap it in JSON. Do NOT use code blocks.
    """

    # Gemini REST API Payload
    payload = {
        "system_instruction": {
            "parts": [{"text": "You are a top-tier investment bank research analyst. Output full report in Markdown."}]
        },
        "contents": [
            {"role": "user", "parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            "temperature": 0.4
        }
    }
    
    # Smart Key Rotation + Model Fallback Implementation
    # 1. Shuffle keys
    available_keys = list(all_keys_data)
    random.shuffle(available_keys)
    
    # Models to try (Sequence: ONLY Flash 2.5)
    models = ['gemini-2.5-flash']

    for model_name in models:
        # Try all keys with Model A, then all keys with Model B
        for attempt, (api_key, key_name) in enumerate(available_keys):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            headers = {'Content-Type': 'application/json'}
            
            try:
                # Increased timeout to 45s to avoid premature failure on large reports
                response = requests.post(url, headers=headers, json=payload, timeout=45)
                
                # Debug log for response status
                # print(f"  [DEBUG] Gemini {key_name} Status: {response.status_code}")

                # If rate limited (too many requests), wait and retry
                # Gemini Free Tier is 15 RPM (1 req every 4s). If we hit this, wait 5s to clear bucket.
                if response.status_code == 429:
                    print(f"  ⚠ Quota (429) on {key_name}. Rotating...")
                    time.sleep(2) 
                    continue
                    
                # If model is overloaded (503), wait and retry
                if response.status_code == 503:
                    print(f"  ⚠ Model Overloaded (503) on {key_name}. Rotating...")
                    time.sleep(2)
                    continue

                if response.status_code == 200:
                    result = response.json()
                    candidates = result.get('candidates', [])
                    if candidates:
                        content_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                        if content_text:
                             print(f"  ✓ News Analysis Generated ({key_name})")
                             
                             # Simple cleaning
                             clean_text = content_text.replace('```markdown', '').replace('```', '').strip()
                             json_content = {
                                'executive_summary': clean_text,
                                'what_changed': '',
                                'analyst_earnings': '',
                                'last_week_updates': '',
                                'sources': sources_list
                             }
                             return json_content
                    
                    print(f"  ⚠ Empty Response from {key_name}. Rotating...")
                    continue
                else:
                    print(f"  ⚠ Error {response.status_code} on {key_name}. Rotating...")
                    continue
                    
            except requests.exceptions.Timeout:
                 print(f"  ⚠ Timeout on {key_name}. Rotating...")
                 continue
            except Exception as e:
                print(f"  ⚠ Connection Error on {key_name}: {e}")
                continue
        


    print(f"  ✗ FAILED to generate summary for {ticker} after trying {len(available_keys)} keys.")
    
    # Return Fallback instead of None to prevent crashes
    return {
        'executive_summary': '<ul><li><strong>Analysis Unavailable</strong>: We are experiencing high traffic with our AI provider. Please try again later.</li></ul>',
        'what_changed': 'N/A',
        'analyst_earnings': 'N/A',
        'last_week_updates': 'N/A',
        'sources': []
    }
            
def store_news_and_summary(ticker, news_articles, summary_data):
    """Store news articles and AI summary in database"""
    today = date.today()

    
    DB_LOCK.acquire()
    try:
        # Store individual news articles
        for article in news_articles:
            try:
                # Use upsert based on title/ticker/date composite if possible, or just insert and ignore dupes
                # For now, explicit insert with exception handling is fine for low volume
                supabase.table('news').insert({
                    'ticker': ticker,
                    'title': article['title'],
                    'summary': article.get('description', ''),
                    'original_url': article['url'],
                    'source': article['source'],
                    'published_at': article['published_at']
                }).execute()
            except Exception:
                pass # Silently skip duplicate articles
        
        # Store AI summary
        if summary_data:
            try:
                # Delete existing summary for today to allow overwrite (essential for retries)
                try:
                    supabase.table('ticker_summaries').delete().match({
                        'ticker': ticker, 
                        'summary_date': str(today)
                    }).execute()
                except Exception:
                    pass

                # Insert new summary
                supabase.table('ticker_summaries').insert({
                    'ticker': ticker,
                    'executive_summary': summary_data['executive_summary'],
                    'what_changed': summary_data['what_changed'],
                    'analyst_earnings': summary_data['analyst_earnings'],
                    'last_week_updates': summary_data['last_week_updates'],
                    'summary_date': str(today),
                    'created_at': datetime.now().isoformat()
                }).execute()
                print(f"  ✓ Stored summary for {ticker}")
            except Exception as e:
                print(f"  ✗ Error storing summary for {ticker}: {e}")
            
    except Exception as e:
        print(f"Error storing data for {ticker}: {e}")
    finally:
        DB_LOCK.release()

def process_single_ticker(ticker, all_keys_data):
    """Worker function to process a single ticker"""
    # all_keys_data is now a list of (key, name) tuples
    
    print(f"Processing {ticker} using {len(all_keys_data)} available keys...")
    try:
        news_articles = fetch_news_for_ticker(ticker)
        if news_articles:
            # Random sleep to prevent synchronized API hits and respect RPM
            # 6 keys * 15 req/min = 90 req/min total capacity. 
            # 4 workers ~ 20-30 req/min. This delay aligns usage.
            time.sleep(random.uniform(2.0, 4.0))
            
            summary_data = generate_ai_summary(ticker, news_articles, all_keys_data)
            if summary_data and "Unavailable" not in summary_data.get('executive_summary', ''):
                store_news_and_summary(ticker, news_articles, summary_data)
            else:
                 print(f"  ⚠ AI Unavailable/Failed. Saving fallback state to ensure timestamp update.")
                 # Create fallback summary so user sees "Updated" and knows WHY it's empty
                 fallback_summary = {
                    'executive_summary': '<ul><li><strong>analysis unavailable</strong>: content generation failed due to high load.</li><li>news articles are listed below for your review.</li><li>please try refreshing again in a few minutes.</li></ul>',
                    'what_changed': '<ul><li>n/a</li></ul>',
                    'analyst_earnings': '<ul><li>n/a</li></ul>',
                    'last_week_updates': '<ul><li>n/a</li></ul>'
                 }
                 store_news_and_summary(ticker, news_articles, fallback_summary)

            return summary_data
        else:
            print(f"  - No news found for {ticker}")
            # Store empty state
            empty_summary = {
                'executive_summary': '<ul><li>No significant news articles found for this ticker in the last 7 days.</li></ul>',
                'what_changed': '<ul><li>N/A</li></ul>',
                'analyst_earnings': '<ul><li>N/A</li></ul>',
                'last_week_updates': '<ul><li>N/A</li></ul>'
            }
            store_news_and_summary(ticker, [], empty_summary)
            return empty_summary
    except Exception as e:
        print(f"  ✗ Error processing {ticker}: {e}")
        # Return error state AND store it so frontend stops polling
        error_summary = {
            'executive_summary': f"<ul><li>Analysis failed due to a system error.</li><li>Error details: {str(e)[:200]}...</li><li>Please try again later.</li></ul>",
            'what_changed': '<ul><li>N/A</li></ul>',
            'analyst_earnings': '<ul><li>N/A</li></ul>',
            'last_week_updates': '<ul><li>N/A</li></ul>'
        }
        # Persist error to DB so polling clients see it
        store_news_and_summary(ticker, [], error_summary)
        return error_summary

def process_news_for_active_tickers(force=False, custom_tickers=None):
    """Process news for all active tickers in parallel
    Args:
        force (bool): Ignore daily run check
        custom_tickers (list): Optional list of tickers to process, overriding global ACTIVE_TICKERS
    """
    global IS_PROCESSING, ACTIVE_TICKERS
    
    if IS_PROCESSING:
        print("News processing already in progress.")
        return

    if not force and check_daily_run():
        print("Daily news fetch already completed today. Skipping...")
        return
    
    IS_PROCESSING = True
    target_list = custom_tickers if custom_tickers else ACTIVE_TICKERS
    print(f"Starting PARALLEL news fetch cycle for {len(target_list)} tickers...")
    
    try:
        if not custom_tickers:
            # Update tickers - Prioritize DISPLAY_TICKERS first
            # We now process ALL tickers, no longer limiting to top 30/volume
            # Sort logic: (False if in DISPLAY_TICKERS else True, ticker_name) -> Puts DISPLAY_TICKERS first
            
            sorted_universe = sorted(TICKER_UNIVERSE, key=lambda x: (x not in DISPLAY_TICKERS, x))
            ACTIVE_TICKERS = sorted_universe
            target_list = ACTIVE_TICKERS
        else:
             print(f"  ✓ Using custom ticker list ({len(custom_tickers)} symbols)")
             target_list = custom_tickers
        
        # Load balance across ALL available keys
        all_keys = []
        key_vars = ['GEMINI_API_CHECKER', 'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5', 'GEMINI_API_KEY_6']
        for var in key_vars:
            k = os.getenv(var)
            if k: all_keys.append((k, var)) # Store tuple (key, name)
            
        if not all_keys:
            print("CRITICAL: No Gemini API keys found in environment variables!")
            IS_PROCESSING = False
            return
            
        print(f"  ✓ Optimized Mode: Shared key pool of {len(all_keys)} Gemini keys distributed across threads.")

        tasks = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor: 
            for ticker in target_list:
                # Pass ALL keys to each thread. 
                # generate_ai_summary will shuffle them to ensure load balancing.
                tasks.append(executor.submit(process_single_ticker, ticker, all_keys))
            
            # Wait for completion
            concurrent.futures.wait(tasks)
            
        mark_daily_run()
        print("News fetch cycle completed successfully!")
    except Exception as e:
        print(f"Critical error in news processing cycle: {e}")
    finally:
        IS_PROCESSING = False

def run_background_refresh():
    """Run refresh in background thread"""
    thread = threading.Thread(target=process_news_for_active_tickers, args=(True,))
    thread.daemon = True
    thread.start()

@us_news_bp.route('/')
def index():
    """Render the main page"""
    # Fetch quotes for display tickers in parallel
    quotes = {}
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(DISPLAY_TICKERS))) as executor:
            future_to_ticker = {executor.submit(fetch_quote_data, t): t for t in DISPLAY_TICKERS}
            for future in concurrent.futures.as_completed(future_to_ticker):
                t = future_to_ticker[future]
                try:
                    data = future.result()
                    if data:
                        quotes[t] = data
                except Exception as exc:
                    print(f"Index Future Error: {exc}")
    except Exception as e:
        print(f"Index Batch Quote Error: {e}")

    # Persist the quotes we successfully fetched
    save_cache_to_disk()

    return render_template('us_news_index.html', 
                         tickers=DISPLAY_TICKERS,  # Only show Mag 7 on frontend 
                         quotes=quotes,
                         now=int(time.time()),
                         api_token=os.getenv('API_TOKEN', ''))

@us_news_bp.route('/api/refresh', methods=['POST'])
def refresh_news():
    """Trigger a manual refresh of all news"""
    # Check for authentication
    from flask import request
    
    auth_header = request.headers.get('Authorization')
    expected_token = os.getenv('API_TOKEN')
    
    # If API_TOKEN is set in env, enforce it
    if expected_token:
        if not auth_header or auth_header != f"Bearer {expected_token}":
             # Also allow if header is just the token
             if auth_header != expected_token:
                return jsonify({'error': 'Unauthorized', 'message': 'Invalid or missing API token'}), 401
    
    run_background_refresh()
    return jsonify({'status': 'started', 'message': 'News refresh started in background'})

@us_news_bp.route('/api/status', methods=['GET'])
def get_status():
    """Check processing status"""
    return jsonify({'is_processing': IS_PROCESSING})

@us_news_bp.route('/api/search', methods=['GET'])
def search_tickers():
    """Proxy request to Yahoo Finance for ticker search"""
    from flask import request
    query = request.args.get('q', '').strip()
    
    if not query:
        return jsonify({'quotes': []})
        
    try:
        # Use Yahoo Finance's public API
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        params = {
            'q': query,
            'quotesCount': 10,
            'newsCount': 0,
            'enableFuzzyQuery': 'false',
            'quotesQueryId': 'tss_match_phrase_query'
        }
        
        response = requests.get(url, headers=headers, params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return jsonify({'quotes': data.get('quotes', [])})
        else:
            print(f"Yahoo Search Error: {response.status_code}")
            return jsonify({'quotes': []})
            
    except Exception as e:
        print(f"Search Proxy Error: {e}")
        return jsonify({'error': str(e)}), 500

@us_news_bp.route('/api/ta/<ticker>', methods=['GET'])
def get_technical_analysis(ticker):
    """Calculate and return technical analysis data with interval support"""
    try:
        from flask import request
        interval = request.args.get('interval', '1d')
        cache_key = f"{ticker}_{interval}"
        current_time = time.time()
        
        # Check Cache Validity (Staleness: 4 hours for intraday, 12 hours for daily)
        # UPDATED: If source is 'alpha_vantage', use 24h TTL to conserve limited requests (25/day)
        is_stale = False
        cached_item = TA_CACHE.get(cache_key)
        
        if cached_item:
             age = current_time - cached_item['timestamp']
             source = cached_item.get('source', 'yahoo')
             
             if source == 'alpha_vantage':
                 ttl = 86400 # 24 Hours
             else:
                 ttl = 14400 if interval in ['1m','5m','15m','30m','60m','1h'] else 43200 
                 
             if age > ttl:
                 is_stale = True
        
        # If cache exists and is fresh, return it
        if cached_item and not is_stale:
             src_label = cached_item.get('source', 'yahoo')
             print(f"  ✓ Serving TA from Cache for {ticker} ({interval}) [Source: {src_label}]")
             return jsonify(cached_item['data'])

        # Dynamic Period selection based on Interval (YF constraints)
        period = "1y"
        if interval in ['1m', '2m', '5m', '15m', '30m']:
             period = "1mo" # Max 60d for <1h
             if interval == '1m': period = '5d' # Max 7d for 1m
        elif interval in ['60m', '1h']:
             period = "2y" # Max 730d for 1h. Using 2y to be safe and rich.
             
        elif interval == '1wk' or interval == '1mo':
             period = "5y"
             
        # Fetch data with Retry Logic (handled here to be granular)
        df = pd.DataFrame()
        data_source = 'yahoo'
        last_error = None
        
        for attempt in range(1, 4):
            try:
                session = get_yf_session()
                stock = yf.Ticker(ticker, session=session)
                df = stock.history(period=period, interval=interval)
                
                if df.empty:
                     pass 
                
                break # Success
            except Exception as e:
                error_msg = str(e)
                last_error = e
                if "429" in error_msg or "Too Many Requests" in error_msg or "Rate Limit" in error_msg:
                    wait = 2 ** attempt # 2, 4, 8
                    print(f"  ⚠ TA Rate Limit (429) for {ticker}. Retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                else:
                    # Non-retryable error?
                    print(f"  ✗ TA Fetch Error attempt {attempt}: {e}")
                    time.sleep(1) # small wait
        
        if df.empty:
             print(f"  ⚠ Yahoo Finance failed/empty for {ticker}. Attempting Alpha Vantage Fallback...")
             # fetch_av_data now returns tuple
             df, src = fetch_av_data(ticker, interval)
             if not df.empty:
                 print(f"  ✓ Fallback to Alpha Vantage successful for {ticker}")
                 data_source = src
             elif last_error:
                 print(f"  ✗ Alpha Vantage Fallback also failed.")
                 raise last_error
        
                
        # If fetch empty but we have stale cache, return stale
        if df.empty:
            if cached_item:
                 print(f"  ⚠ Fetch empty, serving STALE TA Cache for {ticker}")
                 return jsonify(cached_item['data'])
            return jsonify({'error': 'No data found'}), 404
            
        # --- Calculations ---
        # Assume df is valid here
        try:
            from .ta_utils import calculate_technical_indicators, get_fibonacci_levels, get_support_resistance, get_ta_summary
            
            # 1. Base Indicators
            df = calculate_technical_indicators(df)

            # 2. Fibonacci Retracement
            fib_levels = get_fibonacci_levels(df)

            # 3. Support & Resistance
            sr_data = get_support_resistance(df)
            supports = sr_data['supports']
            resistances = sr_data['resistances']

            # --- Prepare Response ---
            # Data for Charting (Last 200 points)
            chart_data = df.tail(200).reset_index()
            chart_json = []
            for _, row in chart_data.iterrows():
                # Handle Interval Date/Time
                date_val = row.get('Datetime', row.get('Date'))
                if pd.isna(date_val): date_val = row.name # Fallback if index
                
                # Format
                if interval in ['1d', '1wk', '1mo']:
                    if hasattr(date_val, 'strftime'):
                        date_str = date_val.strftime('%Y-%m-%d')
                    else:
                        date_str = str(date_val)
                else:
                     # Localize/Format for intraday
                     date_str = str(date_val)

                chart_json.append({
                    'date': date_str,
                    'open': row['Open'],
                    'high': row['High'],
                    'low': row['Low'],
                    'close': row['Close'],
                    'volume': row['Volume'],
                    'sma50': row.get('SMA_50', None) if not pd.isna(row.get('SMA_50', np.nan)) else None,
                    'sma200': row.get('SMA_200', None) if not pd.isna(row.get('SMA_200', np.nan)) else None,
                    'macd': row.get('MACD', None) if not pd.isna(row.get('MACD', np.nan)) else None,
                    'signal': row.get('MACD_Signal', None) if not pd.isna(row.get('MACD_Signal', np.nan)) else None,
                    'hist': row.get('MACD_Hist', None) if not pd.isna(row.get('MACD_Hist', np.nan)) else None
                })
                
            # 4. Summary & Analysis
            summary = get_ta_summary(df)

            result_json = {
                'ticker': ticker,
                'interval': interval,
                'fibonacci': fib_levels,
                'supports': supports,
                'resistances': resistances,
                'chart_data': chart_json,
                'summary': summary
            }

            # Update Cache (Using dynamic data_source)
            TA_CACHE[cache_key] = {
                'data': result_json,
                'timestamp': current_time,
                'source': data_source
            }
            # Save to disk async or immediately? Immediate for safety against restart storms
            save_cache_to_disk()

            return jsonify(result_json)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'error': f"Internal Calculation Error: {str(e)}"}), 500

    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "Rate Limit" in error_msg or "Too Many Requests" in error_msg:
             print(f"TA Rate Limit Error: {e}")
             # Cache Fallback
             cache_key = f"{ticker}_{request.args.get('interval', '1d')}"
             cached_item = TA_CACHE.get(cache_key)
             if cached_item:
                  print(f"  ⚠ Rate Limit hit, serving STALE TA Cache for {ticker}")
                  return jsonify(cached_item['data'])
                  
             return jsonify({'error': 'Rate limited by data provider. Please try again later.'}), 429
        
        print(f"TA Logic Error: {e}")
        return jsonify({'error': f"Request Error: {str(e)}"}), 500


def ai_queue_worker():
    """Background worker to process AI requests sequentially with rate limiting"""
    print("AI Queue Worker Started...")
    while True:
        try:
            # Get next task
            task = AI_QUEUE.get()
            ticker, keys = task
            
            print(f"  [QUEUE] Processing {ticker} (Queue Size: {AI_QUEUE.qsize()})")
            
            # Process
            try:
                process_single_ticker(ticker, keys)
            except Exception as e:
                print(f"  [QUEUE] Error processing {ticker}: {e}")
            
            # Rate Limit Delay (Prevent 429s)
            # 5 seconds = 12 requests per minute (Safe for Gemini Free Tier limit of 15 RPM)
            time.sleep(5) 
            
            AI_QUEUE.task_done()
        except Exception as e:
            print(f"AI Worker Error: {e}")
            time.sleep(1)

# Start Queue Worker
threading.Thread(target=ai_queue_worker, daemon=True).start()

def run_single(ticker, manual=False):
    """Trigger background analysis via Safe Queue"""
    # Load Keys (Dynamically to pick up environment changes if valid)
    all_keys = []
    key_vars = ['GEMINI_API_CHECKER', 'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5', 'GEMINI_API_KEY_6']
    for var in key_vars:
        k = os.getenv(var)
        if k: all_keys.append((k, var))
        
    if not all_keys:
        print("CRITICAL: No Gemini API keys found!")
        return "No keys"

    # Push to Queue instead of spawning uncapped threads
    print(f"  [QUEUE] Adding {ticker} to AI Queue")
    AI_QUEUE.put((ticker, all_keys))
    
    return f"Added {ticker} to AI Queue"

@us_news_bp.route('/api/generate/<ticker>', methods=['POST', 'GET'], strict_slashes=False)
def generate_ticker_summary(ticker):
    """Force generate summary for a specific ticker"""
    from flask import request
    print(f"DEBUG: Hit generate_ticker_summary for {ticker} with method {request.method}")

    # For POST requests (like the refresh button), use the main processing logic
    if request.method == 'POST':
        # Reuse existing logic via run_single or process_single_ticker logic
        # But here we want a direct response, so we call process_single_ticker synchronously
        # or we just trigger background and return "Processing"
        
        # Load Keys
        all_keys = []
        key_vars = ['GEMINI_API_CHECKER', 'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5', 'GEMINI_API_KEY_6']
        for var in key_vars:
            k = os.getenv(var)
            if k: all_keys.append((k, var))
            
        result_data = process_single_ticker(ticker, all_keys)
        if result_data:
             return jsonify(result_data)
        else:
             return jsonify({'error': 'Failed to generate summary'}), 500
    
    # Support GET for simple triggering (used by frontend)
    if request.method == 'GET':
        # Check auth
        auth_header = request.headers.get('Authorization')
        expected_token = os.getenv('API_TOKEN')
        if expected_token:
            token = auth_header.replace('Bearer ', '') if auth_header and auth_header.startswith('Bearer ') else auth_header
            if token != expected_token:
                return jsonify({'error': 'Unauthorized'}), 401

        print(f"DEBUG: Starting background run for {ticker} (GET)")
        
        # Clear existing summary to force frontend poll
        try:
            today = date.today()
            supabase.table('ticker_summaries').delete().eq('ticker', ticker).eq('summary_date', str(today)).execute()
        except Exception:
            pass

        msg = run_single(ticker)
        # Return target date (today) so frontend knows what to wait for
        target_date = date.today().isoformat()
        return jsonify({'status': 'triggered', 'message': msg, 'target_date': target_date})

    return jsonify({'status': 'method_not_allowed'}), 405



@us_news_bp.route('/api/financials/<ticker>', methods=['GET'])
def get_financial_analysis(ticker):
    """
    Fetch fundamental data + Generate AI Recommendation (Gemini).
    Includes Caching to prevent 429 Rate Limits.
    """
    global FUNDAMENTALS_CACHE
    
    # 1. Check Cache (Valid for 1 hour)
    current_time = time.time()
    if ticker in FUNDAMENTALS_CACHE:
        cached = FUNDAMENTALS_CACHE[ticker]
        if current_time - cached['timestamp'] < 3600:
             print(f"  [DEBUG] Served Fundamentals for {ticker} from Cache")
             return jsonify(cached['data'])

    print(f"DEBUG: Analyzing Financials for {ticker}")
    stock = None
    try:
        # 1. Fetch Fundamentals (yfinance)
        session = get_yf_session()
        stock = yf.Ticker(ticker, session=session)
        info = stock.info

        fundamentals = {
            'market_cap': info.get('marketCap'),
            'pe_ratio': info.get('trailingPE'),
            'peg_ratio': info.get('pegRatio'),
            'revenue_ttm': info.get('totalRevenue'),
            'net_income_ttm': info.get('netIncomeToCommon'),
            'eps': info.get('trailingEps'),
            'beta': info.get('beta'),
            'dividend_yield': info.get('dividendYield'),
            'profit_margins': info.get('profitMargins'),
            'operating_margins': info.get('operatingMargins'),
            # Extended Fundamentals
            'book_value': info.get('bookValue'),
            'price_to_book': info.get('priceToBook'),
            'debt_to_equity': info.get('debtToEquity'),
            'current_ratio': info.get('currentRatio'),
            'return_on_equity': info.get('returnOnEquity'),
            'ticker': ticker,
            # Growth & Efficiency
            'revenue_growth': info.get('revenueGrowth'),
            'earnings_growth': info.get('earningsGrowth'),
            'gross_margins': info.get('grossMargins'),
            'return_on_assets': info.get('returnOnAssets'),
            'operating_margins': info.get('operatingMargins')
        }
    except Exception as e:
        print(f"  ⚠ Yahoo Fundamentals Error for {ticker}: {e}")
        
        # --- FINNHUB FALLBACK ---
        finn_key = os.getenv('FINNHUB_API_KEY')
        fundamentals = None
        
        if finn_key:
            try:
                print(f"  Attempting Finnhub Fallback for {ticker} (Fundamentals)...")
                f_url = f"https://finnhub.io/api/v1/stock/metric?symbol={ticker}&metric=all&token={finn_key}"
                resp = requests.get(f_url, timeout=10)
                if resp.status_code == 200:
                    fdata = resp.json()
                    metric = fdata.get('metric', {})
                    
                    if metric:
                        print(f"  ✓ Finnhub Fundamentals Success")
                        # Map Finnhub metrics to our schema
                        # Finnhub keys are weird strings like 'peBasicExclExtraTTM'
                        
                        fundamentals = {
                            'market_cap': metric.get('marketCapitalization', 0) * 1000000 if metric.get('marketCapitalization') else None, # Finnhub is likely in Millions
                            'pe_ratio': metric.get('peTTM'),
                            'peg_ratio': None, # Need specific calc or search
                            'revenue_ttm': metric.get('revenueTTM'), 
                            'net_income_ttm': None, # Hard to find exact match sometimes
                            'eps': metric.get('epsTTM'),
                            'beta': metric.get('beta'),
                            'dividend_yield': (metric.get('dividendYieldIndicatedAnnual', 0) or 0) / 100, # Percent -> decimal
                            'profit_margins': (metric.get('netProfitMarginTTM', 0) or 0) / 100,
                            'operating_margins': (metric.get('operatingMarginTTM', 0) or 0) / 100,
                            # Extended
                            'book_value': metric.get('bookValuePerShareAnnual'),
                            'price_to_book': metric.get('pbAnnual'),
                            'debt_to_equity': metric.get('totalDebt/totalEquityAnnual'),
                            'current_ratio': metric.get('currentRatioAnnual'),
                            'return_on_equity': (metric.get('roeTTM', 0) or 0) / 100,
                            'ticker': ticker,
                            # Growth
                            'revenue_growth': (metric.get('revenueGrowthTTMYoy', 0) or 0) / 100,
                            'earnings_growth': (metric.get('epsGrowthTTMYoy', 0) or 0) / 100,
                            'gross_margins': (metric.get('grossMarginTTM', 0) or 0) / 100,
                            'return_on_assets': (metric.get('roaTTM', 0) or 0) / 100
                        }
            except Exception as fe:
                print(f"  ✗ Finnhub Fundamentals Failed: {fe}")
        
        if not fundamentals:
            # Check for stale cache
             if ticker in FUNDAMENTALS_CACHE:
                 print(f"  ⚠ Returning STALE Fundamentals cache for {ticker}")
                 return jsonify(FUNDAMENTALS_CACHE[ticker]['data'])
             
             # Return error if really nothing
             err_msg = str(e)
             if "Too Many Requests" in err_msg or "429" in err_msg:
                 return jsonify({'error': 'Rate limited by data provider. Please try again later.'}), 429
             return jsonify({'error': 'Fundamentals unavailable'}), 500

    # Continue with AI Analysis...
    try:

        # --- Professional Fair Value Calculation (Graham Number) ---
        # Graham Number = Sqrt(22.5 * EPS * Book Value Per Share)
        try:
            eps = fundamentals.get('eps')
            bvps = fundamentals.get('book_value')
            if eps and bvps and eps > 0 and bvps > 0:
                graham_number = (22.5 * eps * bvps) ** 0.5
                fundamentals['fair_value'] = round(graham_number, 2)
            else:
                fundamentals['fair_value'] = None
        except Exception as e:
            print(f"Fair Value Calc Error: {e}")
            fundamentals['fair_value'] = None

        # --- Manual Checks & Fallbacks ---
        
        # --- Manual Checks & Fallbacks ---
        
        # 1. PEG Ratio Fallback
        # Logic: PEG = (P/E) / (Annual EPS Growth Rate * 100)
        if fundamentals['peg_ratio'] is None and fundamentals['pe_ratio']:
            print(f"DEBUG: PEG Invalid ({fundamentals['peg_ratio']}), attempting calculation...")
            # Try 1: Use pre-fetched earningsGrowth from info
            if fundamentals['earnings_growth']:
                try:
                    g = fundamentals['earnings_growth'] * 100
                    if g > 0:
                        fundamentals['peg_ratio'] = round(fundamentals['pe_ratio'] / g, 2)
                        print(f"DEBUG: Calculated PEG from earnings_growth: {fundamentals['peg_ratio']}")
                except Exception:
                    pass

            # Try 2: Calculate from Financials (Historical) if still None
            if fundamentals['peg_ratio'] is None:
                try:
                    if stock:
                        fin = stock.financials
                        if not fin.empty and 'Basic EPS' in fin.index:
                            eps_series = fin.loc['Basic EPS']
                            # Ensure we have enough data points and filter out N/A
                            eps_valid = eps_series.dropna()
                            if len(eps_valid) >= 2:
                                eps_cur = eps_valid.iloc[0]
                                eps_prev = eps_valid.iloc[1]
                                
                                # Valid previous EPS needed for growth calc
                                if eps_prev and eps_prev != 0:
                                    growth_rate = ((eps_cur - eps_prev) / abs(eps_prev)) * 100
                                    print(f"DEBUG: Calculated EPS Growth: {growth_rate}% (Curr: {eps_cur}, Prev: {eps_prev})")
                                    
                                    # PEG only makes sense for positive growth
                                    if growth_rate > 0:
                                        fundamentals['peg_ratio'] = round(fundamentals['pe_ratio'] / growth_rate, 2)
                                        print(f"DEBUG: Calculated PEG from Hist EPS: {fundamentals['peg_ratio']}")
                except Exception as e:
                    print(f"Manual PEG Error: {e}")

        # 2. Dividend Yield Sanity Check
        # If yield is missing, check if it's a non-dividend payer (yield=0) or just missing data
        # Also normalize: yfinance can return 0.05 (5%) or sometimes 5.0 (5% - rare but possible in old versions)
        
        # Priority 1: Use provided dividend_yield if valid
        if fundamentals['dividend_yield'] is not None:
             # Sanity check for huge numbers (e.g. 5.1 vs 0.051)
             # Assumption: Yield > 1 (100%) is likely an error or raw percentage. 
             # Most div yields are 0.0-0.1.
             dy = fundamentals['dividend_yield']
             if dy > 0.5: # Treat > 50% as suspicious or needing validation, but strictly speaking checking > 1 is safer for "raw number vs decimal"
                 # If > 1, assume it's a percentage (e.g. 3.5 -> 0.035)
                 print(f"DEBUG: Normalizing Dividend Yield {dy} -> {dy/100}")
                 fundamentals['dividend_yield'] = dy / 100
        
        # Priority 2: Calculate if None
        else:
             div_rate = info.get('dividendRate')
             # If rate is present, calculate yield
             if div_rate and div_rate > 0:
                 price = info.get('currentPrice') or info.get('previousClose')
                 if price and price > 0:
                     fundamentals['dividend_yield'] = round(div_rate / price, 4)
                     print(f"DEBUG: Calculated Div Yield from Rate: {fundamentals['dividend_yield']}")
             else:
                 # If explicit 0 or None for rate, determine if it's a non-payer
                 # trailingAnnualDividendYield is another source
                 tay = info.get('trailingAnnualDividendYield')
                 if tay and tay > 0:
                     fundamentals['dividend_yield'] = tay
                     print(f"DEBUG: Using Trailing Div Yield: {fundamentals['dividend_yield']}")
                 elif div_rate == 0:
                     # Explicitly 0 means non-payer
                     fundamentals['dividend_yield'] = 0.0

        # Double check: If still None, set to 0.0 if it's a growth stock (optional, but safer to leave None for N/A)
        # But for 'N/A' to show properly on frontend, None is fine.
        
        # Upsert Fundamentals to Supabase (financial_data)
        try:
            supabase.table('financial_data').upsert(fundamentals).execute()
        except Exception as db_err:
            print(f"DB Error (Financials): {db_err}")
            # Continue even if DB fails, return live data

        # 2. Fetch Technicals (Internal Helper)
        # We need historical data for TA
        end_date = datetime.now()
        start_date = end_date - timedelta(days=400) # Need ~200 candles + buffer
        if not stock:
             return jsonify({'error': 'Price data unavailable (Data Source Failed)'}), 404

        df = stock.history(start=start_date, end=end_date)
        
        if df.empty:
            return jsonify({'error': 'No price data found'}), 404
            
        from US_News.ta_utils import calculate_technical_indicators, get_ta_summary
        df = calculate_technical_indicators(df)
        ta_summary = get_ta_summary(df) # {price, rsi, macd_action, sma_trend}

        # Extract specific indicators from the new structured summary
        oscillators = ta_summary.get('oscillators', [])
        mas = ta_summary.get('moving_averages', [])
        
        # Helpers to find values
        def find_val(lst, name_part):
            for x in lst:
                if name_part in x['name']: return x['value']
            return None
        
        def find_action(lst, name_part):
            for x in lst:
                if name_part in x['name']: return x['action']
            return "Neutral"

        rsi_val = find_val(oscillators, 'Relative Strength Index')
        macd_action = find_action(oscillators, 'MACD Level')
        
        # Simple Trend check: Price vs SMA 200
        price = ta_summary.get('price', 0)
        sma200_val = find_val(mas, 'Simple Moving Average (200)')
        sma_trend = "Bullish" if price > (sma200_val or 0) else "Bearish"

        # 3. Generate AI Recommendation (Gemini) with Robust Key Rotation
        
        # --- CACHE CHECK START ---
        ai_recommendation = "AI Analysis Unavailable"
        recommendation_signal = "UNKNOWN"
        used_cache = False

        try:
            # Check for recent analysis in DB (valid for 24 hours)
            # We use 'technical_signals' table which stores the last recommendation
            cache_res = supabase.table('technical_signals').select('*').eq('ticker', ticker).execute()
            
            if cache_res.data:
                cached = cache_res.data[0]
                last_updated = cached.get('last_updated')
                
                if last_updated:
                    # Parse timestamp
                    last_dt = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
                    # Naive check: if naive, assume local/utc match or just check days. 
                    # If timezone aware, compare distinct.
                    # Simplest: Check if date is today or yesterday.
                    # Let's use strict 24h window
                    if last_dt.tzinfo is None:
                        # If DB returns naive, assume it matches system time or is UTC
                        pass 
                    
                    # Compare
                    # To be safe against TZ issues, just check if it was updated "recently"
                    # If separate date field exists, use it. Here we use last_updated iso string.
                    # Let's just check if it's from today (local server time)
                    cache_date = last_dt.date() if last_dt else None
                    today_date = datetime.now().date()
                    
                    if cache_date == today_date:
                        print(f"  ✓ Using Cached AI Analysis for {ticker} (from {last_updated})")
                        ai_recommendation = cached.get('reasoning', "AI Analysis Unavailable")
                        recommendation_signal = cached.get('recommendation', "UNKNOWN")
                        used_cache = True
        except Exception as e:
            print(f"Cache Check Error: {e}")

        # --- CACHE CHECK END ---

        if not used_cache:
            # 1. Construct Prompt First (Needed for both)
            prompt = f"""
            You are a Senior Financial Analyst. Analyze {ticker} based on this data:
            
            FUNDAMENTALS:
            - Market Cap: {fundamentals['market_cap']}
            - P/E Ratio: {fundamentals['pe_ratio']}
            - PEG Ratio: {fundamentals['peg_ratio']}
            - Revenue (TTM): {fundamentals['revenue_ttm']}
            - Profit Margin: {fundamentals['profit_margins']}

            TECHNICALS:
            - Price: {price}
            - RSI (14): {rsi_val}
            - MACD Action: {macd_action}
            - Trend (vs SMA200): {sma_trend}
            
            TASK:
            1. Provide a clear "BUY", "SELL", or "HOLD" signal.
            2. Write a concise 3-4 sentence paragraph explaining WHY. Focus on the synthesis of fundamental valuation vs technical momentum.
            
            FORMAT:
            Signal: [BUY/SELL/HOLD]
            Reasoning: [Paragraph]
            """

            # 2. Try Groq (Llama 3.3) Priority
            groq_key = os.getenv('GROQ_API_KEY')
            groq_success = False

            if groq_key:
                try:
                    # print(f"DEBUG: Attempting Groq Financial Analysis for {ticker}...")
                    groq_url = "https://api.groq.com/openai/v1/chat/completions"
                    groq_headers = {
                        "Authorization": f"Bearer {groq_key}",
                        "Content-Type": "application/json"
                    }
                    groq_payload = {
                        "model": "llama-3.3-70b-versatile",
                        "messages": [
                            {"role": "system", "content": "You are a senior financial analyst."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.3
                    }
                    
                    resp = requests.post(groq_url, headers=groq_headers, json=groq_payload, timeout=45)
                    
                    if resp.status_code == 200:
                        g_data = resp.json()
                        content_text = g_data['choices'][0]['message']['content']
                        if content_text:
                            ai_recommendation = content_text
                            # Parse Signal
                            signal_match = re.search(r'Signal:\s*(BUY|SELL|HOLD)', content_text, re.IGNORECASE)
                            recommendation_signal = signal_match.group(1).upper() if signal_match else "NEUTRAL"
                            print(f"  ✓ Valid Groq Financial Analysis for {ticker}")
                            groq_success = True
                    else:
                        print(f"  ⚠ Groq Financial Error: {resp.status_code}")
                except Exception as e:
                    print(f"  ⚠ Groq Connection Error: {e}")

            # 3. Gemini Fallback
            if not groq_success:
                # Load all available keys
                all_keys = []
                key_vars = ['GEMINI_API_CHECKER', 'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5', 'GEMINI_API_KEY_6']
                for var in key_vars:
                    k = os.getenv(var)
                    if k: all_keys.append((k, var))
                    
                if all_keys:
                    # Shuffle for load balancing
                    random.shuffle(all_keys)
                    
                    # Gemini REST API Payload
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.3
                        }
                    }
                
                    # Retry Loop (Only if keys exist and Groq failed)
                    for attempt, (api_key, key_name) in enumerate(all_keys):
                        # UPDATED: Use 'gemini-2.5-flash' for all analysis
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
                        headers = {'Content-Type': 'application/json'}
                        
                        try:
                            # Increased timeout to 45s to match News Analysis
                            response = requests.post(url, headers=headers, json=payload, timeout=45)
                            
                            if response.status_code == 200:
                                result = response.json()
                                candidates = result.get('candidates', [])
                                if candidates:
                                    content_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                                    if content_text:
                                        ai_recommendation = content_text
                                        # Parse Signal
                                        signal_match = re.search(r'Signal:\s*(BUY|SELL|HOLD)', content_text, re.IGNORECASE)
                                        recommendation_signal = signal_match.group(1).upper() if signal_match else "NEUTRAL"
                                        print(f"  ✓ Valid AI analysis generated for {ticker} using {key_name}")
                                        break # Success
                            
                            elif response.status_code == 429:
                                print(f"  ⚠ Rate Limit (429) on {key_name}. Rotating...")
                                time.sleep(1)
                                continue
                            else:
                                print(f"  ⚠ AI Error {response.status_code} on {key_name}: {response.text[:100]}")
                                continue
                                
                        except Exception as e:
                            print(f"  ⚠ Connection Error on {key_name}: {e}")
                            continue
                    else:
                         print(f"  ✗ Failed to generate AI analysis for {ticker} after trying all keys.")
        
        # Upsert Signals to Supabase (technical_signals) ONLY IF generated new one
        if not used_cache and ai_recommendation != "AI Analysis Unavailable":
             signal_data = {
                'ticker': ticker,
                'recommendation': recommendation_signal,
                'reasoning': ai_recommendation,
                'rsi': rsi_val,
                'macd_signal': macd_action,
                'last_updated': datetime.now().isoformat()
            }
             try:
                supabase.table('technical_signals').upsert(signal_data).execute()
             except Exception as e:
                print(f"DB Error (Signals): {e}")

        response_data = {
            'fundamentals': fundamentals,
            'technicals': ta_summary,
            'ai_analysis': ai_recommendation
        }

        # Update Cache
        # Only cache if AI Analysis was successful (to prevent "Unavailable" from sticking)
        if ai_recommendation != "AI Analysis Unavailable":
            FUNDAMENTALS_CACHE[ticker] = {
                'data': response_data,
                'timestamp': current_time
            }
            # Persist immediately for heavy data
            save_cache_to_disk()
        else:
            print(f"  ⚠ Skipping FUNDAMENTALS cache update for {ticker} (AI Analysis Unavailable)")

        return jsonify(response_data)

    except Exception as e:
         print(f"Financials Error: {e}")
         
         # Fallback to Stale Cache
         if ticker in FUNDAMENTALS_CACHE:
             print(f"  ⚠ Returning STALE Fundamentals cache for {ticker}")
             return jsonify(FUNDAMENTALS_CACHE[ticker]['data'])
             
         err_msg = str(e)
         if "Too Many Requests" in err_msg or "429" in err_msg:
             return jsonify({'error': 'Rate limited by data provider. Please try again later.'}), 429

         return jsonify({'error': str(e)}), 500
    # Check auth



@us_news_bp.route('/api/quote/<ticker>', methods=['GET'])
def get_ticker_quote(ticker):
    """Fetch real-time quote (price/change) for a ticker"""
    data = fetch_quote_data(ticker)
    if data:
        return jsonify(data)
    else:
        return jsonify({'error': 'No data'}), 404

    
    return jsonify({'status': 'started', 'message': f'Generating summary for {ticker}'})

@us_news_bp.route('/api/summary/<ticker>')
def get_summary(ticker):
    """Get AI summary for a specific ticker (Latest available)"""
    try:
        # Check for min_date constraint (from frontend refresh)
        from flask import request
        min_date_str = request.args.get('min_date')
        
        query = supabase.table('ticker_summaries').select('*').eq('ticker', ticker)
        
        if min_date_str:
            # If min_date provided, strict filtering
            query = query.gte('summary_date', min_date_str)
            
        try:
            # Order by created_at if possible for precision, fallback to summary_date
            # We fetch 5 candidates to skip over recent "Unavailable" failures
            result = query.order('created_at', desc=True).limit(5).execute()
        except Exception as db_err:
            print(f"Supabase Read Error for {ticker}: {db_err}")
            # Identify if this is a Cloudflare/Connection issue
            if "JSON" in str(db_err) or "Expecting value" in str(db_err):
                 print(f"  ⚠ CRITICAL: Supabase returned non-JSON response (likely Cloudflare block or 503).")
            return jsonify({'status': 'not_found', 'message': 'Database unavailable'}), 200

        if result.data:
            # Smart Selection: Find first summary that isn't "Unavailable"
            summary = result.data[0] # Default to latest
            
            for candidate in result.data:
                exec_sum = candidate.get('executive_summary', '')
                if "Unavailable" not in exec_sum and "Analysis failed" not in exec_sum:
                    summary = candidate
                    # If we found a valid one that isn't the latest, detailed logs
                    if candidate != result.data[0]:
                        print(f"  ✓ Skipped 'Unavailable' summary for {ticker}, showing valid one from {candidate.get('summary_date')}")
                    break
            
            # If all are unavailable, we will return the latest (which is the fail state), which is correct behavior if nothing exists.
            
            # Get sources from news table linked to this summary date (or just latest)
            try:
                news_result = supabase.table('news').select('title, original_url, source').eq('ticker', ticker).order('published_at', desc=True).limit(10).execute()
                
                # Dedup sources by URL
                seen_urls = set()
                sources = []
                for n in news_result.data:
                    if n['original_url'] not in seen_urls:
                        sources.append({'title': n['title'], 'url': n['original_url'], 'source': n['source']})
                        seen_urls.add(n['original_url'])
            except Exception as news_err:
                print(f"News Fetch Error (Non-critical): {news_err}")
                sources = []
            
            return jsonify({
                'status': 'found',
                'ticker': ticker,
                'executive_summary': summary['executive_summary'],
                'what_changed': summary['what_changed'],
                'analyst_earnings': summary['analyst_earnings'],
                'last_week_updates': summary['last_week_updates'],
                'sources': sources,
                'date': summary['summary_date'],
                'updated_at': summary.get('created_at', summary['summary_date'])
            })
        else:
            # Return 200 with status=not_found to avoid console errors during polling
            return jsonify({'status': 'not_found', 'message': 'No summary available'})
            
    except Exception as e:
        print(f"Summary Endpoint Critical Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@us_news_bp.route('/api/tickers')
def get_tickers():
    """Get list of active tickers"""
    return jsonify({'tickers': DISPLAY_TICKERS})



@us_news_bp.route('/api/history/<ticker>', methods=['GET'])
def get_history(ticker):
    """Fetch historical data for the interactive chart"""
    global HISTORY_CACHE
    from flask import request
    period = request.args.get('period', '1y')
    interval = request.args.get('interval', '1d')
    
    # 1. Check Cache
    cache_key = f"{ticker}_{period}_{interval}"
    current_time = time.time()
    
    # Cache duration: 1 hour for daily data, 5 mins for intraday
    cache_duration = 3600 if interval in ['1d', '1wk', '1mo'] else 300
    
    if cache_key in HISTORY_CACHE:
        cached = HISTORY_CACHE[cache_key]
        if current_time - cached['timestamp'] < cache_duration:
             # print(f"  [DEBUG] Served History for {ticker} from Cache")
             data = cached['data']
             # Format Fix: If old cache is list, wrap it
             if isinstance(data, list):
                 return jsonify({'data': data})
             return jsonify(data)
    
    try:
        session = get_yf_session()
        stock = yf.Ticker(ticker, session=session)
        df = stock.history(period=period, interval=interval)
        
        # --- FALLBACK LOGIC START ---
        if df.empty:
             print(f"  ⚠ Yahoo History Empty for {ticker}, trying Fallback...")
             raise Exception("Empty Yahoo Data")
        # --- FALLBACK LOGIC END ---

    except Exception as e:
         print(f"  ⚠ Yahoo History Error: {e}")
         
         # --- POLYGON FALLBACK ---
         poly_key = os.getenv('POLYGON_API_KEY')
         if poly_key:
             try:
                 print(f"  Attempting Polygon Fallback for {ticker} (History)...")
                 # Map YF periods/intervals to Polygon query
                 
                 today_str = datetime.now().strftime('%Y-%m-%d')
                 start_dt = datetime.now() - timedelta(days=365) # Default 1y
                 
                 # Rough mapping request.args -> dates
                 if period == '1mo': start_dt = datetime.now() - timedelta(days=30)
                 elif period == '3mo': start_dt = datetime.now() - timedelta(days=90)
                 elif period == '6mo': start_dt = datetime.now() - timedelta(days=180)
                 elif period == '1y': start_dt = datetime.now() - timedelta(days=365)
                 elif period == '2y': start_dt = datetime.now() - timedelta(days=730)
                 elif period == '5y': start_dt = datetime.now() - timedelta(days=1825)
                 elif period == 'max': start_dt = datetime.now() - timedelta(days=365*10)
                 
                 from_date = start_dt.strftime('%Y-%m-%d')
                 
                 # Map interval
                 multiplier = 1
                 timespan = 'day'
                 if interval == '1d': timespan = 'day'
                 elif interval == '1wk': timespan = 'week'
                 elif interval == '1mo': timespan = 'month'
                 elif interval == '1h': timespan = 'hour'; multiplier = 1
                 elif interval == '60m': timespan = 'minute'; multiplier = 60
                 elif interval == '30m': timespan = 'minute'; multiplier = 30
                 elif interval == '15m': timespan = 'minute'; multiplier = 15
                 elif interval == '5m': timespan = 'minute'; multiplier = 5
                 elif interval == '2m': timespan = 'minute'; multiplier = 2
                 elif interval == '1m': timespan = 'minute'; multiplier = 1
                 
                 p_url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from_date}/{today_str}?adjusted=true&sort=asc&limit=50000&apiKey={poly_key}"
                 
                 resp = requests.get(p_url, timeout=10)
                 if resp.status_code == 200:
                     pdata = resp.json()
                     results = pdata.get('results', [])
                     
                     if results:
                         print(f"  ✓ Polygon History Success: {len(results)} candles")
                         formatted_data = []
                         # Polygon: t (unix ms), o, h, l, c, v
                         for r in results:
                             ts_sec = r['t'] / 1000
                             
                             if interval in ['1d', '1wk', '1mo']:
                                 # Convert to YYYY-MM-DD
                                 t_val = datetime.fromtimestamp(ts_sec).strftime('%Y-%m-%d')
                             else:
                                 # Intraday
                                 t_val = int(ts_sec)
                                 
                             formatted_data.append({
                                 'time': t_val,
                                 'open': r['o'],
                                 'high': r['h'],
                                 'low': r['l'],
                                 'close': r['c'],
                                 'volume': r['v']
                             })
                         
                         # Update Cache (Polygon data is good)
                         HISTORY_CACHE[cache_key] = {
                             'data': {'data': formatted_data},
                             'timestamp': current_time
                         }
                         return jsonify({'data': formatted_data})
             except Exception as pe:
                 print(f"  ✗ Polygon History Error: {pe}")

         # If Fallback fails or no key, check Stale Cache
         if cache_key in HISTORY_CACHE:
             print(f"  ⚠ Returning STALE History cache for {ticker}")
             # Cache stores {'data': {'data': [...]}} structure now to match
             val = HISTORY_CACHE[cache_key]['data']
             # If old cache (before fix) was list, handle it?
             if isinstance(val, list): return jsonify({'data': val})
             return jsonify(val)

         err_msg = str(e)
         if "Too Many Requests" in err_msg or "429" in err_msg:
             return jsonify({'error': 'Rate limited by data provider. Please try again later.'}), 429
         return jsonify({'error': 'History unavailable'}), 500

    # Success Path (Yahoo)
    if df.empty:
         return jsonify({'error': 'No history found'}), 404
         
    # Format for Lightweight Charts
    data = []
    df = df.reset_index()
    
    for _, row in df.iterrows():
        # Handle timestamps vs date strings
        col_name = 'Datetime' if 'Datetime' in df.columns else 'Date'
        d = row[col_name]
        
        # For daily data, Lightweight Charts expects 'YYYY-MM-DD' string format
        # For intraday, it expects Unix timestamp (seconds)
        if interval in ['1m', '2m', '5m', '15m', '30m', '60m', '1h']:
            # Intraday: Unix timestamp
            time_val = int(d.timestamp())
        else:
            # Daily: Convert to YYYY-MM-DD string
            # Handle timezone-aware datetime - convert to date only (no time component)
            if hasattr(d, 'date'):
                # Get just the date part, ignoring timezone
                time_val = d.date().strftime('%Y-%m-%d')
            elif hasattr(d, 'strftime'):
                # Pandas Timestamp - extract date
                time_val = d.strftime('%Y-%m-%d')
            else:
                # Fallback for string dates
                time_val = str(d)[:10]
        
        data.append({
            'time': time_val,
            'open': float(row['Open']),
            'high': float(row['High']),
            'low': float(row['Low']),
            'close': float(row['Close']),
            'volume': int(row['Volume'])
        })

    result_struct = {'data': data}
    HISTORY_CACHE[cache_key] = {
        'data': result_struct,
        'timestamp': current_time
    }
    # Persist
    save_cache_to_disk()

    return jsonify(result_struct)

@us_news_bp.route('/api/latest-price/<ticker>', methods=['GET'])
def get_latest_price(ticker):
    """Fetch latest price for real-time chart updates"""
    try:
        # Use robust session with rotation/proxies
        session = get_yf_session()
        stock = yf.Ticker(ticker, session=session)
        
        # Get today's 1-minute data 
        df = stock.history(period='1d', interval='1m')
        
        if df.empty:
            return jsonify({'error': 'No data available'}), 404
            
        # Get the last row (most recent candle)
        df = df.reset_index()
        latest = df.iloc[-1]
        d = latest['Datetime'] if 'Datetime' in df.columns else latest['Date']
        
        # Try to get previous close safely
        prev_close = None
        try:
            prev_close = stock.fast_info.previous_close
        except:
            pass
            
        return jsonify({
            'time': int(d.timestamp()),  # Unix timestamp for intraday
            'open': float(latest['Open']),
            'high': float(latest['High']),
            'low': float(latest['Low']),
            'close': float(latest['Close']),
            'volume': int(latest['Volume']),
            'previous_close': prev_close
        })
        
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "Rate Limit" in error_msg or "Too Many Requests" in error_msg:
             print(f"Price Poll Rate Limit Error for {ticker}: {e}")
             return jsonify({'error': 'Rate limited by data provider.'}), 429
             
        print(f"Latest Price Error for {ticker}: {e}")
        return jsonify({'error': str(e)}), 500
@us_news_bp.route('/api/quant-analysis/<ticker>', methods=['GET'])
def get_quant_analysis(ticker):
    """
    Generate Expert Quant Analysis using 1h and 1d data via chained AI prompts.
    Includes 1-hour in-memory cache.
    """
    # Global Cache for Quant Analysis
    # Structure: { 'TICKER': { 'timestamp': float, 'data': dict } }
    global QUANT_ANALYSIS_CACHE
    if 'QUANT_ANALYSIS_CACHE' not in globals():
        QUANT_ANALYSIS_CACHE = {}

    try:
        # --- Cache Check ---
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        current_time = time.time()
        
        if not force_refresh and ticker in QUANT_ANALYSIS_CACHE:
            cached_entry = QUANT_ANALYSIS_CACHE[ticker]
            # Check if cache is within 1 hour (3600 seconds)
            if (current_time - cached_entry['timestamp']) < 3600:
                print(f"  ✓ Serving Quant Analysis for {ticker} from Cache (< 1h old)")
                return jsonify(cached_entry['data'])
            else:
                print(f"  ↻ Cache expired for {ticker} (> 1h). Regenerating...")
        
        if force_refresh:
            print(f"  ↻ Force Refreshing Quant Analysis for {ticker}")

        from .ta_utils import calculate_technical_indicators, prepare_df_for_llm
        
        # 1. Fetch Data (1h and 1d)
        session = get_yf_session()
        stock = yf.Ticker(ticker, session=session)
        
        # 1h Data (Requires 2y for valid SMA-200 if possible, or at least enough for logic)
        df_1h = stock.history(period="2y", interval="1h")
        if df_1h.empty: return jsonify({'error': 'No 1h data found'}), 404
        
        # 1d Data (1y is standard)
        df_1d = stock.history(period="2y", interval="1d")
        if df_1d.empty: return jsonify({'error': 'No 1d data found'}), 404
        
        # 2. Calculate Indicators
        df_1h = calculate_technical_indicators(df_1h)
        df_1d = calculate_technical_indicators(df_1d)
        
        # 3. Serialize Data for Prompt
        # Limit to last 45 rows (was 100) to avoid Groq 413 Payload Too Large / Token Limits
        data_1h_str = prepare_df_for_llm(df_1h, last_n=45)
        data_1d_str = prepare_df_for_llm(df_1d, last_n=45)
        
        # 4. Construct Prompt 1 (The Expert Quant)
        prompt_1 = f"""
        Imagine you are top finance trader of a leading quant based hedge fund. You have deep expertise with algos, finance & math. 
        
        Here is the data for {ticker}:
        
        --- 1 HOUR INTERVAL DATA (Last 100 candles) ---
        {data_1h_str}
        
        --- 1 DAY INTERVAL DATA (Last 100 candles) ---
        {data_1d_str}
        
        Your task is to analyze the data, identify patterns, ranges, and probabilities of price movement over a week and a month. 
        Short term prediction is for one week for which, you would give a 80% priority to the hourly price and indicator data, and 20% to the daily data. 
        For medium term prediction you would give 80% priority to the daily data and 20% to the long term trend. 
        Focus should be primarily on price and quant based actions while ignoring fundamentals. 
        Clearly and explicitly state your assumptions and statistical calculations done.
        """
        
        # 5. Execute Prompt 1
        # Use load-balanced keys helper if available? 
        # app_US.py has `run_single` but that's background. We need synchronous or async-await here.
        # We'll stick to a simple synchronous call using one of the available keys for responsiveness.
        # Or better, iterate keys like `process_single_ticker` does.
        
        # 5. Execute AI Analysis (Prioritize CHECKER for 2.5-flash)
        api_keys = [
            os.getenv('GEMINI_API_CHECKER')
        ]
        # Allow fallback to Key 6 if needed, or keep exclusive if user wants specific model behavior
        # Adding Key 6 as backup but usually Checker is robust
        if os.getenv('GEMINI_API_KEY_6'):
            api_keys.append(os.getenv('GEMINI_API_KEY_6'))

        # Filter None
        api_keys = [k for k in api_keys if k]
        
        # Randomize order? No, user explicitly requested "use this".
        # We will try CHECKER first (preserved order)
        # random.shuffle(api_keys) 
        
        if not api_keys:
             print("Error: No AI keys (CHECKER or 6) found.")
             last_error = "No API Keys found in environment"
        
        # Debug: Print loaded keys count
        print(f"DEBUG: Loaded {len(api_keys)} keys for Quant Analysis.")

        analysis_raw = None
        summary_final = None
        last_error = "Unknown Error"
        
        # Combined Prompt to save 1 request cycle and reduce latency/errors
        combined_prompt = f"""
        Role: You are an expert financial trader at a quantitative hedge fund.
        
        Task: Analyze the following technical data for {ticker} (Last 100 1h and 1d candles) and provide a "Expert Quant Assessment".
        
        --- 1H DATA ---
        {data_1h_str}
        
        --- 1D DATA ---
        {data_1d_str}
        
        Instructions:
        1. Analyze price action, moving averages (SMA 20, 50, 200), RSI, and MACD.
        2. Determine the short-term (1 week) and medium-term (1 month) probability.
        3. IGNORE news/fundamentals. Focus purely on the math/charts.
        
        Output format (Markdown):
        ## Quant Analysis for {ticker}
        
        **Signal**: [BUY / SELL / NEUTRAL] (Choose one based on weight of evidence).
        **Confidence**: [0-100]%
        
        **Short-Term Outlook (1 Week)**: 2-3 sentences on immediate direction, supporting levels (Support/Resistance), and key indicators (e.g. "RSI at 75 suggests overbought").
        
        **Medium-Term Trend**: 1-2 sentences on the broader 1D trend (e.g. "Above SMA200, Bullish").
        
        **Key Levels to Watch**:
        *   Support: $...
        *   Resistance: $...
        
        **Strategy**: Concise actionable advice (e.g. "Buy dips to EMA20", "Wait for breakout above $X").
        """

        # Try AI Generation
        # 1. Try Groq (Llama 3.3) First
        groq_key = os.getenv('GROQ_API_KEY')
        groq_success = False
        
        if groq_key:
            try:
                print(f"DEBUG: Attempting Groq Analysis for {ticker}...")
                groq_url = "https://api.groq.com/openai/v1/chat/completions"
                groq_headers = {
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json"
                }
                groq_payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": "You are an expert quantitative trader."},
                        {"role": "user", "content": combined_prompt}
                    ],
                    "temperature": 0.3
                }
                
                resp = requests.post(groq_url, headers=groq_headers, json=groq_payload, timeout=45)
                
                if resp.status_code == 200:
                    g_data = resp.json()
                    content_text = g_data['choices'][0]['message']['content']
                    if content_text:
                        summary_final = content_text
                        analysis_raw = "Generated via Groq (llama-3.3-70b)"
                        groq_success = True
                        print(f"  ✓ Groq Analysis Successful for {ticker}")
                else:
                    print(f"  ⚠ Groq Error: {resp.status_code} - {resp.text[:100]}")
            except Exception as e:
                print(f"  ⚠ Groq Connection Error: {e}")

        # 2. Fallback to Gemini if Groq failed/missing
        if not groq_success and api_keys:
            # requests is imported at top level
            
            payload = {
                "contents": [{"parts": [{"text": combined_prompt}]}],
                "generationConfig": {
                    "temperature": 0.3
                }
            }

            for i, key in enumerate(api_keys):
                try:
                    # UPDATED: Users requested 2.5-flash
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
                    headers = {'Content-Type': 'application/json'}
                    
                    print(f"DEBUG: Attempting AI Call {i+1}/{len(api_keys)} with key ...{key[-4:]}")

                    # Increased timeout to 45s to prevent ReadTimeout
                    response = requests.post(url, headers=headers, json=payload, timeout=45)
                    
                    if response.status_code == 200:
                        result = response.json()
                        candidates = result.get('candidates', [])
                        if candidates:
                            content_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                            if content_text:
                                summary_final = content_text
                                analysis_raw = "Generated via REST API (gemini-2.5-flash)"
                                break # Success
                        else:
                             print(f"DEBUG: No candidates in response: {result}")
                             last_error = "Empty AI Response"
                             
                    elif response.status_code == 429:
                        print(f"  ⚠ 429 Rate Limit on key ending ...{key[-4:]}")
                        last_error = "Rate Limit (429)"
                        time.sleep(0.5) # Slight backoff
                        continue
                    else:
                        # Log FULL error for debugging
                        print(f"  ⚠ AI Error {response.status_code} on key ...{key[-4:]}: {response.text}")
                        last_error = f"API Error {response.status_code}: {response.text[:50]}"
                        continue

                except Exception as e:
                    print(f"  ⚠ Connection Error using key ...{key[-4:]}: {e}")
                    last_error = f"Connection Error: {str(e)}"
                    continue

        # --- FALLBACK MECHANISM ---
        # --- FALLBACK MECHANISM ---
        if not summary_final:
            print(f"  ⚠ All AI keys failed for {ticker} (Tried {len(api_keys)} keys). Generating Fallback Analysis.")
            
            # Simple algorithmic fallback using the data we already calculated
            # 1. Determine Trend
            last_close = df_1d['Close'].iloc[-1]
            sma200 = df_1d['SMA_200'].iloc[-1] if 'SMA_200' in df_1d else 0
            rsi = df_1d['RSI'].iloc[-1] if 'RSI' in df_1d else 50
            
            trend = "Bullish" if last_close > sma200 else "Bearish"
            signal = "NEUTRAL"
            confidence = 50
            
            if trend == "Bullish":
                if rsi < 30: 
                    signal = "STRONG BUY"
                    confidence = 85
                elif rsi < 45: 
                    signal = "BUY"
                    confidence = 70
                elif rsi > 70: 
                    signal = "SELL (Overbought)"
                    confidence = 65
                else:
                    signal = "HOLD / BULLISH"
                    confidence = 60
            else: # Bearish
                if rsi > 70: 
                    signal = "STRONG SELL"
                    confidence = 85
                elif rsi > 55: 
                    signal = "SELL"
                    confidence = 70
                elif rsi < 30: 
                    signal = "BUY (Oversold)"
                    confidence = 65
                else:
                    signal = "HOLD / BEARISH"
                    confidence = 60
            
            # Construct Fallback JSON structure matching the AI output
            summary_final = f"""## Quant Analysis for {ticker}
**Signal**: {signal}
**Confidence**: {confidence}%
**Short-Term Outlook (1 Week)**: Technical indicators suggest {signal.lower()} momentum. RSI is at {rsi:.1f}.
**Medium-Term Trend**: The broader trend is {trend} relative to the 200-day moving average.
**Strategy**: Watch for confirmation of the current trend before entering positions.
"""
            analysis_raw = "Algorithmic Fallback (AI Unavailable)"

        # Final Response Construction
        response_payload = {
            'ticker': ticker,
            'analysis': summary_final,
            'source': analysis_raw,
            'timestamp': current_time
        }
        
        # Update Cache
        QUANT_ANALYSIS_CACHE[ticker] = {
            'data': response_payload,
            'timestamp': current_time
        }
        # Persist immediately
        save_cache_to_disk()
        
        return jsonify(response_payload)

    except Exception as e:
        print(f"Quant Analysis Error for {ticker}: {e}")
        
        # FALLBACK: Try to serve stale cache
        if ticker in QUANT_ANALYSIS_CACHE:
             print(f"  ⚠ Returning STALE Quant Analysis cache for {ticker}")
             return jsonify(QUANT_ANALYSIS_CACHE[ticker]['data'])

        err_msg = str(e)
        if "Too Many Requests" in err_msg or "429" in err_msg:
             return jsonify({'error': 'Rate limited by data provider. Please try again later.'}), 429
        
        return jsonify({'error': str(e)}), 500



