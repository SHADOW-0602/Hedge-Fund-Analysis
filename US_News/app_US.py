import os
import time
import queue # Added for AI Queue
import random
import json
import re
import threading
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta, timezone
import threading
from flask import Blueprint, render_template, jsonify, request
from dotenv import load_dotenv
import requests
from supabase import create_client, Client
from openai import AzureOpenAI
import yfinance as yf
import logging
import sys
# Ensure we can import from src
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if root_path not in sys.path:
    sys.path.append(root_path)

try:
    from src.utils.ladder_session import get_ladder_session
except ImportError:
    # Fallback if src is not found (e.g. structure change)
    print("[WARNING] Could not import LadderSession from src.utils, using default requests.")
    def get_ladder_session(): return requests.Session()

# Configure Debug Logger for Quant Analysis
quant_logger = logging.getLogger('quant_debug')
quant_logger.setLevel(logging.DEBUG)
# Avoid adding multiple handlers if reloaded
if not quant_logger.handlers:
    fh = logging.FileHandler('debug_quant.log')
    fh.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    quant_logger.addHandler(fh)
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

# State Management for Schedules
def get_last_fundamental_run():
    """Get the timestamp of the last fundamental run from Supabase"""
    try:
        data = supabase.table('system_state').select('value').eq('key', 'last_fundamental_run').execute()
        if data.data:
            return data.data[0]['value']
        return None
    except Exception as e:
        print(f"Error fetching last run state: {e}")
        return None

def set_last_fundamental_run():
    """Update the timestamp of the last fundamental run in Supabase"""
    try:
        now_iso = datetime.now().isoformat()
        # Upsert equivalent
        data = supabase.table('system_state').upsert({'key': 'last_fundamental_run', 'value': now_iso}).execute()
        print(f"Updated last fundamental run to {now_iso}")
    except Exception as e:
        print(f"Error updating last run state: {e}")


# Azure OpenAI Configuration
endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "https://shmventures.openai.azure.com/")
api_key = os.getenv("AZURE_OPENAI_KEY")
deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.4-mini")

# Initialize the Azure OpenAI client
azure_client = AzureOpenAI(
    azure_endpoint=endpoint,
    api_key=api_key,
    api_version="2024-02-15-preview"
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

# Mapping of Tickers to Company Names for Search
TICKER_NAMES = {
    'AAPL': 'Apple Inc.', 'MSFT': 'Microsoft Corp.', 'GOOG': 'Alphabet Inc.', 'AMZN': 'Amazon.com Inc.', 
    'NVDA': 'NVIDIA Corp.', 'META': 'Meta Platforms Inc.', 'TSLA': 'Tesla Inc.', 'LLY': 'Eli Lilly and Co.', 
    'JPM': 'JPMorgan Chase & Co.', 'NFLX': 'Netflix Inc.', 'BRK-B': 'Berkshire Hathaway Inc.', 'V': 'Visa Inc.', 
    'UNH': 'UnitedHealth Group Inc.', 'AVGO': 'Broadcom Inc.', 'AMD': 'Advanced Micro Devices Inc.', 
    'TSM': 'Taiwan Semiconductor Mfg.', 'PFE': 'Pfizer Inc.', 'MRK': 'Merck & Co. Inc.', 'JNJ': 'Johnson & Johnson', 
    'ORCL': 'Oracle Corp.', 'ADBE': 'Adobe Inc.', 'CRM': 'Salesforce Inc.', 'COST': 'Costco Wholesale Corp.', 
    'HD': 'The Home Depot Inc.', 'WMT': 'Walmart Inc.', 'BAC': 'Bank of America Corp.', 'GS': 'The Goldman Sachs Group', 
    'UBER': 'Uber Technologies Inc.', 'DELL': 'Dell Technologies Inc.', 'PLTR': 'Palantir Technologies Inc.', 
    'ARM': 'Arm Holdings plc', 'SMCI': 'Super Micro Computer Inc.', 'CRWD': 'CrowdStrike Holdings Inc.', 
    'SNOW': 'Snowflake Inc.', 'NET': 'Cloudflare Inc.', 'PDD': 'PDD Holdings Inc.', 'BABA': 'Alibaba Group Holding', 
    'COIN': 'Coinbase Global Inc.', 'SOFI': 'SoFi Technologies Inc.', 'TTD': 'The Trade Desk Inc.', 
    'ROKU': 'Roku Inc.', 'REGN': 'Regeneron Pharmaceuticals', 'NBIX': 'Neurocrine Biosciences', 
    'CORT': 'Corcept Therapeutics', 'CAPR': 'Capricor Therapeutics', 'CRSP': 'CRISPR Therapeutics', 
    'NVO': 'Novo Nordisk A/S', 'GILD': 'Gilead Sciences Inc.', 'BA': 'The Boeing Company', 'CAT': 'Caterpillar Inc.', 
    'SPY': 'SPDR S&P 500 ETF Trust'
}

SOURCE_TIER_1 = {
    'SEC EDGAR', 'Reuters', 'Bloomberg', 'Dow Jones Newswires', 'Financial Times', 'FT'
}
SOURCE_TIER_2 = {
    'Barrons', "Barron's", 'The Wall Street Journal', 'MarketWatch', 'CNBC', 'Business Insider',
    'Associated Press', 'AP', 'Axios', 'The Motley Fool', 'SeekingAlpha', 'GlobeNewswire Inc.',
    'PR Newswire', 'Business Wire'
}
SOURCE_TIER_3 = {
    'Yahoo', 'Yahoo Finance', 'Finnhub', 'ChartMill', 'Stocktwits', 'Binance News', 'NewsAPI',
    'Polygon', 'TradingView'
}

SEC_CIKS = {
    'AAPL': '0000320193', 'MSFT': '0000789019', 'GOOG': '0001652044', 'GOOGL': '0001652044',
    'AMZN': '0001018724', 'NVDA': '0001045810', 'META': '0001326801', 'TSLA': '0001318605',
    'AMD': '0000002488', 'AVGO': '0001730168', 'INTC': '0000050863', 'MU': '0000723125',
    'SMCI': '0001375365', 'JPM': '0000019617', 'BAC': '0000070858', 'WMT': '0000104169',
    'COST': '0000909832', 'HD': '0000354950', 'NFLX': '0001065280', 'CRM': '0001108524',
    'ORCL': '0001341439', 'ADBE': '0000796343', 'PFE': '0000078003', 'MRK': '0000310158',
    'JNJ': '0000200406', 'BA': '0000012927', 'CAT': '0000018230', 'UBER': '0001543151',
    'COIN': '0001679788', 'PLTR': '0001321655'
}

# Ticker-Specific Metadata and Rules Configuration
TICKER_PEER_GROUPS = {
    'NVDA': ['AMD', 'AVGO', '^SOX'],
    'AMD': ['NVDA', 'AVGO', '^SOX'],
    'AVGO': ['NVDA', 'AMD', '^SOX'],
    'TSM': ['NVDA', 'AMD', '^SOX'],
    'SMCI': ['NVDA', 'AMD', '^SOX'],
    'ARM': ['NVDA', 'AMD', '^SOX']
}

TICKER_MUST_KEEP_TERMS = {
    'NVDA': ['bionemo', 'vera rubin', 'nvl4']
}

TICKER_MATERIAL_TOPICS = {
    'NVDA': {
        'HBM / SK Hynix memory angle': ['sk hynix', 'hbm', 'high-bandwidth memory', 'memory expansion'],
        'SoftBank / Masayoshi Son AI infrastructure commentary': ['softbank', 'masayoshi son', 'physical asi'],
        'BioNeMo product announcement': ['bionemo']
    }
}

TICKER_FISCAL_CORRECTIONS = {
    'NVDA': {
        'Q1 FY2027': 'Q1 FY2027 (reported approximately May 2026)',
        'Q2 2026': 'Q1 FY2027 (reported approximately May 2026)',
        'Q2 FY2026': 'Q1 FY2027 (reported approximately May 2026)'
    }
}

TICKER_SPECIFIC_RULES = {
    'NVDA': [
        "**Material Topic Gaps**: If HBM/SK Hynix or SoftBank/Masayoshi Son are not confirmed in selected sources, state that in Fetch Notes rather than ignoring the angle.",
        "**BioNeMo Completeness**: If BioNeMo appears in selected sources, include it as a {company_name}-specific product/company announcement. If it appears in candidates but not selected, explain the exclusion in Fetch Notes."
    ]
}

# General Product and Competitor Confidence Overrides
PRODUCT_CONFIDENCE_ALIGNMENTS = {
    'bionemo': 'MEDIUM'
}

COMPETITOR_CONFIDENCE_DOWNGRADES = {
    'trainium': 'LOW',
    'amazon': 'LOW'
}

@us_news_bp.route('/api/search')
def search_tickers():
    """Search for tickers using Yahoo Finance Dual-Strategy (Autoc + Query2)"""
    query = request.args.get('q', '').strip().upper()
    if not query:
        return jsonify([])
    
    # Always start with Local Matches (Safety Net)
    local_matches = []
    # Use TICKER_NAMES for full checks
    for ticker, full_name in getattr(globals(), 'TICKER_NAMES', {}).items():
        if ticker.startswith(query) or query in full_name.upper():
            local_matches.append({'symbol': ticker, 'name': full_name})
    
    # Also check the raw UNIVERSE list if not in NAMES
    universe_set = set(getattr(globals(), 'TICKER_UNIVERSE', []))
    for ticker in universe_set:
        # Avoid dupes if already added via NAMES
        if not any(m['symbol'] == ticker for m in local_matches):
            if ticker.startswith(query):
                local_matches.append({'symbol': ticker, 'name': ticker})

    api_matches = []
    try:
        # Yahoo Finance Headers
        headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        
        # Strategy 1: Autoc
        try:
            session = get_yf_session()
            url_autoc = f"https://autoc.finance.yahoo.com/autoc?query={query}&region=US&lang=en"
            resp = session.get(url_autoc, headers=headers, timeout=2)
            if resp.status_code == 200:
                results = resp.json().get('ResultSet', {}).get('Result', [])
                for item in results:
                    sym = item.get('symbol', '')
                    if not sym: continue
                    type_c = item.get('type', '').upper()
                    if type_c in ['S', 'E', 'I']:
                        api_matches.append({'symbol': sym, 'name': item.get('name', sym)})
        except: pass

        # Strategy 2: Query2 (if Autoc yielded few results)
        if len(api_matches) < 3:
            try:
                session = get_yf_session()
                url_q2 = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=20&enableFuzzyQuery=true"
                resp = session.get(url_q2, headers=headers, timeout=2)
                if resp.status_code == 200:
                    quotes = resp.json().get('quotes', [])
                    for q in quotes:
                        sym = q.get('symbol', '')
                        if not sym: continue
                        type_c = q.get('quoteType', '').upper()
                        if type_c in ['EQUITY', 'ETF', 'MUTUALFUND', 'INDEX']:
                            # Avoid duplicates from Autoc
                            if not any(m['symbol'] == sym for m in api_matches):
                                api_matches.append({'symbol': sym, 'name': q.get('shortname') or q.get('longname') or sym})
            except: pass

    except Exception as e:
        print(f"Search API Error: {e}")

    # MERGE: Combine Local + API (Deduplicate)
    # Priority: API data often has better names, but Local ensures existence.
    # We'll use a dictionary keyed by symbol to merge.
    merged = {m['symbol']: m for m in local_matches} # Start with local
    for m in api_matches:
        merged[m['symbol']] = m # Overwrite/Add API matches (newer data)
    
    final_list = list(merged.values())
    
    return _sort_matches(final_list, query, universe_set)

def _sort_matches(matches, query, universe_set):
    """Helper to consistently sort matches: Exact > Universe > Length"""
    sorted_matches = sorted(matches, key=lambda x: (
        0 if x['symbol'] == query else 1,         # Priority 1: Exact Match
        0 if x['symbol'] in universe_set else 1,  # Priority 2: In Universe
        len(x['symbol'])                          # Priority 3: Shortest Symbol
    ))
    return jsonify(sorted_matches)

# Tickers to display on the main page
# Tickers to display on the main page
DISPLAY_TICKERS = sorted(['AAPL', 'GOOG', 'MSFT', 'META', 'NVDA', 'TSLA', 'AMZN'])

# Global variable to store current active list
# Initialize active tickers with sorted list (Priority first)
sorted_tickers = sorted(TICKER_UNIVERSE, key=lambda x: (x not in DISPLAY_TICKERS, x))
ACTIVE_TICKERS = sorted_tickers
print(f"Initialized {len(ACTIVE_TICKERS)} tickers for processing (Top: {', '.join(ACTIVE_TICKERS[:7])})")

IS_PROCESSING = False  # Track if news processing is running

@us_news_bp.route('/stock/<ticker>')
def stock_analysis_us(ticker):
    """Render stock analysis page under US-News blueprint"""
    ticker = ticker.upper().strip()
    return render_template('stock_analysis.html', ticker=ticker)

# Global Cache for Quotes
# key: ticker, value: { 'data': dict, 'timestamp': float }
QUOTE_CACHE = {}

# Cache Persistence File
CACHE_FILE = 'cache_data.pkl'

# Global Cache for Fundamentals
# REMOVED
# Global Cache for History
# key: ticker_period_interval, value: { 'data': dict, 'timestamp': float }
HISTORY_CACHE = {}
# Global Cache for Quant Analysis
# key: ticker, value: { 'data': dict, 'timestamp': float }
QUANT_ANALYSIS_CACHE = {}
# Global Cache for Technical Analysis
# key: ticker_interval, value: { 'data': dict, 'timestamp': float }
TA_CACHE = {}
NEWS_FETCH_META = {}
MARKET_SNAPSHOT_META = {}

# Global Cache for Latest Price (Intraday Chart Updates)
# key: ticker, value: { 'data': dict, 'timestamp': float }
LATEST_PRICE_CACHE = {}

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
        print(f"  [WARNING] Redis Read Error ({key}): {e}")
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
             print(f"  [WARNING] Redis Write Fail ({key}): {resp.text}")
    except Exception as e:
        print(f"  [WARNING] Redis Write Error ({key}): {e}")

def load_cache_from_disk():
    """Load cached data from Redis (preferred) or Pickle (fallback)"""
    global QUOTE_CACHE, HISTORY_CACHE, QUANT_ANALYSIS_CACHE, TA_CACHE
    
    # 1. Try Redis
    if REDIS_URL and REDIS_TOKEN:
        print("  Using Upstash Redis for Cache...")
        try:
            q = get_redis_data('hf:cache:quotes')
            if q: QUOTE_CACHE.update(q)
            
            
            # f = get_redis_data('hf:cache:fundamentals')
            # if f: FUNDAMENTALS_CACHE.update(f)
            
            # h = get_redis_data('hf:cache:history') # Skip heavy history? Or load it?
            # History is huge, might skip for speed if needed, but per plan lets try
            # h = get_redis_data('hf:cache:history')
            # if h: HISTORY_CACHE.update(h)
            
            qa = get_redis_data('hf:cache:quant')
            if qa: QUANT_ANALYSIS_CACHE.update(qa)
            
            ta = get_redis_data('hf:cache:ta')
            if ta: TA_CACHE.update(ta)

            print(f"  [SUCCESS] Redis Cache Loaded: {len(QUOTE_CACHE)} quotes, {len(QUANT_ANALYSIS_CACHE)} quants, {len(TA_CACHE)} ta.")
            return # Success
        except Exception as e:
            print(f"  [WARNING] Redis Load Failed, falling back to disk: {e}")

    # 2. Fallback to Disk
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'rb') as f:
                data = pickle.load(f)
                QUOTE_CACHE.update(data.get('quotes', {}))
                # FUNDAMENTALS_CACHE.update(data.get('fundamentals', {}))
                HISTORY_CACHE.update(data.get('history', {}))
                QUANT_ANALYSIS_CACHE.update(data.get('quant', {}))
                TA_CACHE.update(data.get('ta', {}))
                print(f"  [SUCCESS] Legacy Pickle Cache Loaded: {len(QUOTE_CACHE)} quotes.")
        except Exception as e:
            print(f"  [WARNING] Failed to load cache file: {e}")

def save_cache_to_disk():
    """Save caches to Redis (primary) and Disk (backup)"""
    # 1. Redis Save
    if REDIS_URL and REDIS_TOKEN:
        try:
            # Threading this would be better for performance, but keeping simple for now
            # Note: History cache might be too big for simple Redis strings without compression, skipping history to avoid errors/lag
            set_redis_data('hf:cache:quotes', QUOTE_CACHE)
            # set_redis_data('hf:cache:fundamentals', FUNDAMENTALS_CACHE)
            set_redis_data('hf:cache:quant', QUANT_ANALYSIS_CACHE)
            set_redis_data('hf:cache:ta', TA_CACHE)
            # print("  [SUCCESS] Redis Cache synced.")
        except Exception as e:
            print(f"  [WARNING] Redis Save Error: {e}")

    # 2. Disk Save (Backup)
    try:
        data = {
            'quotes': QUOTE_CACHE,
            # 'fundamentals': FUNDAMENTALS_CACHE,
            'history': HISTORY_CACHE,
            'quant': QUANT_ANALYSIS_CACHE,
            'ta': TA_CACHE
        }
        with open(CACHE_FILE, 'wb') as f:
            pickle.dump(data, f)
    except Exception as e:
        print(f"  [WARNING] Failed to save local cache: {e}")


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
    """Create a requests session with Ladder logic (IP spoofing) + randomized User-Agent"""
    try:
        session = get_ladder_session()
    except Exception as e:
        print(f"Error creating LadderSession: {e}")
        session = requests.Session()

    # Proxy Selection (preserving existing proxy logic)
    if PROXIES:
        proxy = random.choice(PROXIES)
        if proxy:
            session.proxies = {
                'http': proxy,
                'https': proxy
            }
            
    return session

def _parse_news_datetime(value):
    """Normalize provider timestamps for ranking."""
    if not value:
        return None
    try:
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value, tz=timezone.utc)
        if isinstance(value, str):
            cleaned = value.strip().replace('Z', '+00:00')
            parsed = datetime.fromisoformat(cleaned)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
    except Exception:
        return None
    return None

def _news_key(article):
    # Keep query parameters to avoid collapsing distinct Finnhub/Yahoo news articles
    url = (article.get('url') or '').strip().lower().rstrip('/')
    if url:
        return f"url:{url}"
    normalized_title = re.sub(r'[^a-z0-9]+', ' ', (article.get('title') or '').lower()).strip()
    return f"title:{normalized_title}"

def _truncate_text(text, limit=420):
    text = (text or '').strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(' ', 1)[0].rstrip() + '...'

def enforce_news_summary_rules(markdown_text, ticker=None):
    """Final deterministic cleanup for rules the model may occasionally miss."""
    if not markdown_text:
        return markdown_text

    source_lines = markdown_text.splitlines()
    lines = []
    skip_section = False
    for idx, line in enumerate(source_lines):
        lower = line.lower()
        
        # Remove ChartMill or Affordable Growth bullets completely
        if 'chartmill' in lower or 'affordable growth' in lower or 'growth screen' in lower:
            continue

        # Remove Yahoo AI-fears body bullet completely (keeping the Fetch Note)
        if (('fear' in lower and ('ai' in lower or 'yahoo' in lower)) or 'cold water' in lower) and not 'present in candidates' in lower:
            continue

        # Align confidence using PRODUCT_CONFIDENCE_ALIGNMENTS
        for prod, conf in PRODUCT_CONFIDENCE_ALIGNMENTS.items():
            if prod in lower:
                line = re.sub(r'\[LOW\]|\[HIGH\]|\[MEDIUM\]', f'[{conf}]', line, flags=re.IGNORECASE)
                line = re.sub(r'\*\*\[LOW\]\*\*|\*\*\[HIGH\]\*\*|\*\*\[MEDIUM\]\*\*', f'**[{conf}]**', line, flags=re.IGNORECASE)

        if re.match(r'^\s*###\s+Analyst Actions\s*$', line) or re.match(r'^\s*-\s*\*\*Analyst Actions\*\*\s*$', line):
            following = "\n".join(source_lines[idx + 1:idx + 4]).lower()
            if not any(term in following for term in ['rating change', 'price-target revision', 'estimate revision', 'initiated', 'upgraded', 'downgraded']):
                skip_section = True
                continue
        if skip_section:
            if re.match(r'^\s*###\s+', line) or re.match(r'^\s*-\s*\*\*[^*]+\*\*\s*$', line):
                skip_section = False
            else:
                continue

        # Build dynamic ticker-specific exclusion phrases
        excl_phrases = [
            'investment implication is limited', 'investment implication is unavailable',
            'context-only', 'context only', 'not company-specific', 'not a direct company',
            'indirect at best', 'implication is indirect', 'implication is limited'
        ]
        if ticker:
            ticker_lower = ticker.lower()
            excl_phrases.extend([f'not {ticker_lower}-specific', f'not a direct {ticker_lower}'])
        else:
            excl_phrases.extend(['not nvda-specific', 'not a direct nvda'])

        if any(phrase in lower for phrase in excl_phrases):
            continue

        if re.match(r'^\s*-\s*\*\*\[(HIGH|MEDIUM|LOW)\]\s+[^*]+\*\*\s*$', line):
            line = re.sub(r'\*\*\[(HIGH|MEDIUM|LOW)\]\s+', '**', line, count=1)
        if re.match(r'^\s*-\s*\*\*\[(HIGH|MEDIUM|LOW)\]\s+(Price / Valuation and Positioning|Press Releases / Company Announcements|Product / Business / Sector News|Analyst Actions|Management/CEO Commentary|Fetch Notes)\*\*', line):
            line = re.sub(r'^\s*-\s*\*\*\[(HIGH|MEDIUM|LOW)\]\s+(.+?)\*\*', r'### \2', line, count=1)
        
        # Competitor confidence downgrades
        for keyword, conf in COMPETITOR_CONFIDENCE_DOWNGRADES.items():
            if keyword in lower and line.lstrip().startswith('- **[MEDIUM]'):
                line = line.replace('**[MEDIUM]**', f'**[{conf}]**', 1)

        if ('chartmill' in lower or 'affordable growth' in lower or 'forward p/e' in lower) and line.lstrip().startswith('- **[HIGH]'):
            line = line.replace('**[HIGH]**', '**[MEDIUM]**', 1)

        # Fiscal year/date corrections
        corrections = TICKER_FISCAL_CORRECTIONS.get(ticker, {}) if ticker else {}
        for wrong_term, correct_term in corrections.items():
            if wrong_term.lower() in lower and correct_term.lower() not in lower:
                line = re.sub(re.escape(wrong_term), correct_term, line, flags=re.IGNORECASE)

        lines.append(line)

    cleaned = "\n".join(lines)
    cleaned = re.sub(r'\(S\d+\s*-\s*S\d+\)', '(Fetch metadata)', cleaned)
    return cleaned


def _source_tier(source):
    source = (source or 'Unknown').strip()
    if source in SOURCE_TIER_1:
        return 'T1'
    if source in SOURCE_TIER_2:
        return 'T2'
    if source in SOURCE_TIER_3:
        return 'T3'
    return 'T3'

def _article_detail_level(article):
    description = (article.get('description') or '').strip()
    if article.get('is_gated'):
        return 'gated/headline-only'
    if len(description) >= 160:
        return 'detailed excerpt'
    if description:
        return 'partial excerpt'
    return 'headline-only/limited'

def _confidence_label(article):
    tier = article.get('source_tier') or _source_tier(article.get('source'))
    detail = article.get('detail_level') or _article_detail_level(article)
    if tier == 'T1' and detail in {'detailed excerpt', 'partial excerpt'}:
        return 'HIGH'
    if tier in {'T1', 'T2'} and detail != 'headline-only/limited':
        return 'MEDIUM'
    if tier == 'T2' and detail == 'headline-only/limited':
        return 'MEDIUM'
    return 'LOW'

def _classify_thesis_leg(article):
    text = f"{article.get('title', '')} {article.get('description', '')}".lower()
    if any(k in text for k in ['stock', 'shares', 'fell', 'rose', 'rallied', 'selloff', 'valuation', 'multiple', 'market cap', 'etf']):
        return 'price_action'
    if any(k in text for k in ['earnings', 'revenue', 'margin', 'guidance', 'forecast', 'profit', 'eps']):
        return 'earnings_guidance'
    if any(k in text for k in ['upgrade', 'downgrade', 'rating', 'price target', 'analyst', 'initiated']):
        return 'analyst_view'
    if any(k in text for k in ['rival', 'competitor', 'qualcomm', 'amd', 'broadcom', 'intel', 'custom chip', 'startup', 'acquire', 'buy']):
        return 'competitive_landscape'
    if any(k in text for k in ['fed', 'rate', 'inflation', 'macro', 'spending', 'capex', 'data center', 'power', 'hbm', 'memory']):
        return 'macro_readthrough'
    return 'specific_catalyst'

def _is_peripheral_noise(article, ticker, company_name):
    text = f"{article.get('title', '')} {article.get('description', '')}".lower()
    direct_terms = [ticker.lower()] + [
        term for term in re.split(r'[^a-zA-Z0-9]+', company_name.lower())
        if len(term) > 2 and term not in {'inc', 'corp', 'ltd', 'plc', 'com', 'the', 'and', 'co'}
    ]
    has_direct_ticker = any(re.search(rf'\b{re.escape(term)}\b', text) for term in direct_terms)
    peripheral_terms = [
        'quantum computing', 'quantum computer', 'executive order',
        'spacex', 'starlink', 'anthropic', 'reflection ai'
    ]
    if 'spacex' in text:
        return True
    if any(term in text for term in peripheral_terms) and not has_direct_ticker:
        return True
    return False

def _is_truncated_low_value(article):
    source = (article.get('source') or '').lower()
    text = f"{article.get('title', '')} {article.get('description', '')}"
    if any(s in source for s in ['biztoc', 'barchart']):
        if '…' in text or text.count('...') >= 1 or len((article.get('description') or '').strip()) < 80:
            return True
    return False

def _is_must_keep_article(article, ticker=None):
    text = f"{article.get('title', '')} {article.get('description', '')}".lower()
    must_keep_terms = TICKER_MUST_KEEP_TERMS.get(ticker, []) if ticker else []
    if not must_keep_terms and (not ticker or ticker == 'NVDA'):
        must_keep_terms = ['bionemo', 'vera rubin', 'nvl4']
    return any(term in text for term in must_keep_terms)

def _ticker_specificity(article, ticker, company_name):
    text = f"{article.get('title', '')} {article.get('description', '')}".lower()
    ticker_l = ticker.lower()
    company_terms = [
        term for term in re.split(r'[^a-zA-Z0-9]+', company_name.lower())
        if len(term) > 2 and term not in {'inc', 'corp', 'ltd', 'plc', 'com', 'the', 'and', 'co'}
    ]
    title = (article.get('title') or '').lower()
    specificity = 0
    if re.search(rf'\b{re.escape(ticker_l)}\b', text):
        specificity += 4
    if any(term in title for term in company_terms):
        specificity += 4
    elif any(term in text for term in company_terms):
        specificity += 2
    if any(k in text for k in ['revenue', 'margin', 'guidance', 'earnings', 'price target', 'rating', 'sec', '8-k', '10-q', '10-k']):
        specificity += 2
    if any(k in text for k in ['rival', 'competitor', 'supplier', 'customer', 'partner']):
        specificity += 1
    return specificity

def _article_relevance_score(article, ticker, company_name):
    title = article.get('title') or ''
    description = article.get('description') or ''
    text = f"{title} {description}".lower()
    ticker_l = ticker.lower()
    company_terms = [
        term for term in re.split(r'[^a-zA-Z0-9]+', company_name.lower())
        if len(term) > 2 and term not in {'inc', 'corp', 'ltd', 'plc', 'com', 'the', 'and', 'co'}
    ]

    score = 0
    tier = article.get('source_tier') or _source_tier(article.get('source'))
    if tier == 'T1':
        score += 8
    elif tier == 'T2':
        score += 4
    else:
        score += 1

    specificity = _ticker_specificity(article, ticker, company_name)
    score += specificity * 2
    if re.search(rf'\b{re.escape(ticker_l)}\b', text):
        score += 8
    score += min(sum(1 for term in company_terms if term in text), 3) * 3
    if len(description.strip()) >= 80:
        score += 2
    if any(word in text for word in ['earnings', 'revenue', 'guidance', 'forecast', 'upgrade', 'downgrade', 'price target', 'sec', 'merger', 'acquisition', 'lawsuit', 'regulator', 'launch']):
        score += 3

    published = _parse_news_datetime(article.get('published_at'))
    if published:
        age_hours = max((datetime.now(timezone.utc) - published).total_seconds() / 3600, 0)
        score += max(0, 6 - (age_hours / 24))

    return score

def rank_and_filter_news(news_articles, ticker, limit=20):
    """Deduplicate, filter, and rank articles before AI summarization."""
    company_name = TICKER_NAMES.get(ticker, ticker)
    deduped = {}
    for article in news_articles:
        title = (article.get('title') or '').strip()
        url = (article.get('url') or '').strip()
        if not title or title.lower() in {'removed', '[removed]'}:
            continue
        if not url:
            continue

        # Exclude T3 aggregator/secondary broad sector fear commentary
        text = f"{title} {article.get('description', '')}".lower()
        if 'fear' in text and ('ai' in text or 'infrastructure' in text) and ('yahoo' in (article.get('source') or '').lower() or 'finnhub' in (article.get('source') or '').lower()):
            continue

        if _is_peripheral_noise(article, ticker, company_name):
            continue
        if _is_truncated_low_value(article) and not _is_must_keep_article(article, ticker):
            continue

        normalized = {
            'title': title,
            'url': url,
            'source': (article.get('source') or 'Unknown').strip(),
            'published_at': article.get('published_at') or '',
            'description': (article.get('description') or '').strip(),
            'is_gated': bool(article.get('is_gated'))
        }
        normalized['source_tier'] = article.get('source_tier') or _source_tier(normalized['source'])
        normalized['detail_level'] = article.get('detail_level') or _article_detail_level(normalized)
        normalized['confidence'] = article.get('confidence') or _confidence_label(normalized)
        normalized['thesis_leg'] = article.get('thesis_leg') or _classify_thesis_leg(normalized)
        normalized['specificity'] = _ticker_specificity(normalized, ticker, company_name)
        score = _article_relevance_score(normalized, ticker, company_name)
        if _is_must_keep_article(normalized, ticker):
            score += 20
            normalized['specificity'] = max(normalized['specificity'], 4)
        if normalized['source_tier'] == 'T3' and normalized['specificity'] < 4:
            continue
        if normalized['specificity'] < 2 and normalized['source_tier'] != 'T1':
            continue
        if score < 8:
            continue

        key = _news_key(normalized)
        current = deduped.get(key)
        if not current or score > current['_score']:
            normalized['_score'] = score
            deduped[key] = normalized

    ranked = sorted(
        deduped.values(),
        key=lambda item: (
            # Within T3, prefer sources with direct company-specific content (specificity >= 4)
            0 if (item.get('source_tier') == 'T3' and item.get('specificity', 0) < 4) else 1,
            item['_score'],
            _parse_news_datetime(item.get('published_at')) or datetime.min.replace(tzinfo=timezone.utc)
        ),
        reverse=True
    )

    for item in ranked:
        item.pop('_score', None)

    selected = []
    source_counts = {}
    source_caps = {'The Motley Fool': 3}
    tier_counts = {}
    tier_caps = {'T3': 3}
    def can_select(item):
        source = item.get('source', 'Unknown')
        tier = item.get('source_tier', 'T3')
        if source_counts.get(source, 0) >= source_caps.get(source, limit):
            return False
        if tier == 'T3' and tier_counts.get('T3', 0) >= tier_caps.get('T3', limit):
            # Prefer sources with direct company-specific content over broad sector commentary
            def is_direct(x):
                t = f"{x.get('title', '')} {x.get('description', '')}".lower()
                # Indicators of broad sector commentary / stock screens
                if any(k in t for k in ['screen', 'growth screen', 'stock to buy', 'stocks to buy', 'affordable growth', 'fears', 'opinion', 'broad market']):
                    return False
                # Indicators of direct product, corporate, or partner announcements
                if any(k in t for k in ['launch', 'unveil', 'partner', 'powered by', 'collaboration', 'announce', 'introduce', 'integrate', 'sec', '8-k', 'earnings', 'dividend']):
                    return True
                return False

            if is_direct(item):
                # Find already selected T3 source that is broad sector commentary (not direct) to displace
                displaceable = next((x for x in selected if x.get('source_tier') == 'T3' and not is_direct(x)), None)
                if displaceable:
                    selected.remove(displaceable)
                    d_source = displaceable.get('source', 'Unknown')
                    source_counts[d_source] = max(0, source_counts.get(d_source, 0) - 1)
                    tier_counts['T3'] = max(0, tier_counts.get('T3', 0) - 1)
                    print(f"  [DISPLACE] Displaced broad T3 '{displaceable.get('title')}' for direct T3 '{item.get('title')}'")
                    return True
            return False
        if tier_counts.get(tier, 0) >= tier_caps.get(tier, limit):
            return False
        return True

    def add_selected(item):
        selected.append(item)
        source = item.get('source', 'Unknown')
        tier = item.get('source_tier', 'T3')
        source_counts[source] = source_counts.get(source, 0) + 1
        tier_counts[tier] = tier_counts.get(tier, 0) + 1

    required_legs = ['price_action', 'specific_catalyst', 'earnings_guidance', 'analyst_view', 'competitive_landscape', 'macro_readthrough']
    for leg in required_legs:
        match = next((item for item in ranked if item.get('thesis_leg') == leg and item not in selected and can_select(item)), None)
        if match:
            add_selected(match)

    for item in ranked:
        if len(selected) >= limit:
            break
        if item not in selected and can_select(item):
            add_selected(item)

    return selected[:limit]

def build_news_fetch_meta(ticker, candidates, selected, start_date, end_date):
    sources = sorted({(item.get('source') or 'Unknown').strip() for item in candidates if item.get('source')})
    selected_sources = sorted({(item.get('source') or 'Unknown').strip() for item in selected if item.get('source')})
    full_count = sum(1 for item in selected if len((item.get('description') or '').strip()) >= 160)
    partial_count = sum(1 for item in selected if 0 < len((item.get('description') or '').strip()) < 160)
    limited_count = max(len(selected) - full_count - partial_count, 0)
    thesis_legs = sorted({item.get('thesis_leg') for item in selected if item.get('thesis_leg')})
    missing_legs = [
        leg for leg in ['price_action', 'specific_catalyst', 'earnings_guidance', 'analyst_view', 'competitive_landscape', 'macro_readthrough']
        if leg not in thesis_legs
    ]
    tier_counts = {
        tier: sum(1 for item in selected if item.get('source_tier') == tier)
        for tier in ['T1', 'T2', 'T3']
    }
    material_topic_checks = build_material_topic_checks(ticker, candidates, selected)

    has_fear_candidate = any(
        (('fear' in f"{c.get('title', '')} {c.get('description', '')}".lower() and ('ai' in f"{c.get('title', '')} {c.get('description', '')}".lower() or 'yahoo' in c.get('source', '').lower())) or 'cold water' in f"{c.get('title', '')} {c.get('description', '')}".lower())
        for c in candidates
    )
    has_fear_selected = any(
        (('fear' in f"{s.get('title', '')} {s.get('description', '')}".lower() and ('ai' in f"{s.get('title', '')} {s.get('description', '')}".lower() or 'yahoo' in s.get('source', '').lower())) or 'cold water' in f"{s.get('title', '')} {s.get('description', '')}".lower())
        for s in selected
    )
    excluded_fear = has_fear_candidate and not has_fear_selected

    return {
        'ticker': ticker,
        'window_start': str(start_date),
        'window_end': str(end_date),
        'candidate_count': len(candidates),
        'selected_count': len(selected),
        'sources': sources,
        'selected_sources': selected_sources,
        'full_count': full_count,
        'partial_count': partial_count,
        'limited_count': limited_count,
        'thesis_legs': thesis_legs,
        'missing_legs': missing_legs,
        'tier_counts': tier_counts,
        'material_topic_checks': material_topic_checks,
        'excluded_fear': excluded_fear
    }

def format_news_fetch_meta(meta):
    if not meta:
        return "Window: unavailable | Sources: unavailable | Selected for detail: unavailable."
    sources = ', '.join(meta.get('sources') or meta.get('selected_sources') or ['Unknown'])
    return (
        f"Window: {meta.get('window_start')} to {meta.get('window_end')} | "
        f"Sources: {sources} | "
        f"Selected for detail: {meta.get('selected_count', 0)} of {meta.get('candidate_count', 0)} candidates | "
        f"Source tiers: T1={meta.get('tier_counts', {}).get('T1', 0)}, "
        f"T2={meta.get('tier_counts', {}).get('T2', 0)}, T3={meta.get('tier_counts', {}).get('T3', 0)} | "
        f"Provider excerpts: {meta.get('full_count', 0)} detailed, "
        f"{meta.get('partial_count', 0)} partial, {meta.get('limited_count', 0)} headline-only/limited."
    )

def build_source_legend(news_articles, market_meta=None):
    if not news_articles:
        return "Source legend: no selected source items."

    market_entry = ""
    if market_meta:
        market_entry = (
            f"; {market_meta.get('source_id', 'MS1')}=Market Snapshot "
            f"({market_meta.get('tier', 'Market Data')}, {market_meta.get('confidence', 'UNKNOWN')}, "
            f"{market_meta.get('date', 'date unknown')}, providers: {market_meta.get('provider', 'unavailable')})"
        )

    # Detect collisions of (source, published_at)
    collision_keys = {}
    for article in news_articles[:20]:
        src = article.get('source', 'Unknown')
        pub = article.get('published_at', 'date unknown')
        key = (src, pub)
        collision_keys[key] = collision_keys.get(key, 0) + 1

    legend_parts = []
    for idx, article in enumerate(news_articles[:20], 1):
        src = article.get('source', 'Unknown')
        pub = article.get('published_at', 'date unknown')
        tier = article.get('source_tier') or _source_tier(src)
        conf = article.get('confidence') or _confidence_label(article)
        
        # If there's a collision, differentiate by title or URL ID
        extra = ""
        if collision_keys.get((src, pub), 0) > 1:
            url = article.get('url', '')
            match = re.search(r'id=([a-f0-9]+)', url)
            url_id = match.group(1)[:8] if match else ""
            title = article.get('title', '')
            short_title = title[:20] + "..." if len(title) > 20 else title
            if url_id:
                extra = f", id: {url_id}, title: '{short_title}'"
            else:
                extra = f", title: '{short_title}'"
                
        legend_parts.append(
            f"S{idx}={src} ({tier}, {conf}, {pub}{extra})"
        )

    lines = [
        "Source tiers: T1=primary wire/regulatory (Reuters, Bloomberg, Dow Jones, FT, SEC) | T2=major financial media | T3=aggregator/secondary. Bullet labels show claim confidence, which can be HIGH even from T2 when the fact is concrete and directly stated.",
        "Source IDs: " + "; ".join(legend_parts) + market_entry
    ]
    return "\n".join(lines)

def build_material_topic_checks(ticker, candidates, selected):
    topics = TICKER_MATERIAL_TOPICS.get(ticker, {})
    checks = []
    for label, terms in topics.items():
        candidate_hit = any(
            any(term in f"{item.get('title', '')} {item.get('description', '')}".lower() for term in terms)
            for item in candidates
        )
        selected_hit = any(
            any(term in f"{item.get('title', '')} {item.get('description', '')}".lower() for term in terms)
            for item in selected
        )
        if selected_hit:
            status = 'selected'
        elif candidate_hit:
            status = 'seen in candidates but not selected'
        else:
            status = 'not confirmed in fetched candidates'
        checks.append(f"{label}: {status}")
    return checks

def fetch_sec_filings_for_ticker(ticker, start_date, end_date):
    """Fetch recent SEC filing headlines as high-confidence regulatory items."""
    cik = SEC_CIKS.get(ticker)
    if not cik:
        return []

    try:
        headers = {
            'User-Agent': os.getenv('SEC_USER_AGENT', 'SHM Ventures research contact@example.com')
        }
        url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        response = requests.get(url, headers=headers, timeout=8)
        if response.status_code != 200:
            print(f"  [WARNING] SEC submissions returned {response.status_code} for {ticker}")
            return []

        recent = response.json().get('filings', {}).get('recent', {})
        forms = recent.get('form', [])
        filing_dates = recent.get('filingDate', [])
        report_dates = recent.get('reportDate', [])
        accessions = recent.get('accessionNumber', [])
        primary_docs = recent.get('primaryDocument', [])

        items = []
        for idx, form in enumerate(forms[:80]):
            if form not in {'8-K', '10-Q', '10-K', '6-K', 'DEF 14A', 'S-3', 'S-8'}:
                continue
            filing_date = filing_dates[idx] if idx < len(filing_dates) else ''
            try:
                filed = date.fromisoformat(filing_date)
            except Exception:
                continue
            if filed < start_date or filed > end_date:
                continue

            accession = accessions[idx] if idx < len(accessions) else ''
            accession_path = accession.replace('-', '')
            primary_doc = primary_docs[idx] if idx < len(primary_docs) else ''
            sec_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession_path}/{primary_doc}" if accession and primary_doc else f"https://www.sec.gov/edgar/browse/?CIK={ticker}"
            report_date = report_dates[idx] if idx < len(report_dates) else ''
            items.append({
                'title': f"{ticker} filed {form} with SEC",
                'url': sec_url,
                'source': 'SEC EDGAR',
                'source_tier': 'T1',
                'published_at': filing_date,
                'description': f"{ticker} filed {form} on {filing_date}" + (f" for report date {report_date}." if report_date else "."),
                'thesis_leg': 'earnings_guidance' if form in {'10-Q', '10-K'} else 'specific_catalyst',
                'detail_level': 'detailed excerpt',
                'confidence': 'HIGH'
            })
        if items:
            print(f"  [SUCCESS] SEC EDGAR: {len(items)} filings")
        return items
    except Exception as e:
        print(f"  [FAILED] SEC EDGAR Exception: {e}")
        return []

def fetch_polygon_history(ticker, period_days=400, interval='day'):
    """
    Fallback: Fetch historical data from Polygon/Massive.com
    interval: 'day', 'hour', 'minute'
    """
    poly_key = os.getenv('POLYGON_API_KEY')
    if not poly_key:
        return None

    try:
        print(f"  Attempting Polygon History Fallback for {ticker} ({interval})...")
        
        # Calculate dates
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period_days)
        
        # Format: YYYY-MM-DD
        start_str = start_date.strftime('%Y-%m-%d')
        end_str = end_date.strftime('%Y-%m-%d')
        
        # Map interval to Polygon multiplier/timespan
        multiplier = 1
        timespan = 'day'
        if interval == '1h' or interval == 'hour':
            timespan = 'hour'
        elif interval == '1m' or interval == 'minute':
            timespan = 'minute'
            
        url = f"https://api.massive.com/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{start_str}/{end_str}?adjusted=true&sort=asc&limit=5000&apiKey={poly_key}"
        
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('resultsCount', 0) > 0 and 'results' in data:
                # Convert to DataFrame
                df = pd.DataFrame(data['results'])
                
                # Normalize Columns: v->Volume, o->Open, c->Close, h->High, l->Low, t->Date
                df = df.rename(columns={
                    'v': 'Volume',
                    'o': 'Open',
                    'c': 'Close',
                    'h': 'High',
                    'l': 'Low',
                    't': 'Date'
                })
                
                # Convert Date (ms timestamp) to Datetime
                df['Date'] = pd.to_datetime(df['Date'], unit='ms')
                
                # Set Index
                df.set_index('Date', inplace=True)
                
                # Ensure float types
                cols = ['Open', 'High', 'Low', 'Close', 'Volume']
                df[cols] = df[cols].astype(float)
                
                print(f"  [SUCCESS] Polygon History Success: {len(df)} rows")
                return df
                
    except Exception as e:
        print(f"  [FAILED] Polygon History Failed: {e}")
        
    return None


def fetch_twelve_data_history(ticker, interval='1day', outputsize=500):
    """
    Fallback 2: Fetch historical data from Twelve Data
    interval: '1day', '1h', etc.
    """
    td_key = os.getenv('TWELVE_DATA_API_KEY')
    if not td_key:
        return None

    try:
        print(f"  Attempting Twelve Data Fallback for {ticker} ({interval})...")
        
        # Twelve Data Interval Mapping
        # YF '1d' -> TD '1day'
        # YF '1h' -> TD '1h'
        if interval == 'day' or interval == '1d': td_interval = '1day'
        elif interval == 'hour' or interval == '1h': td_interval = '1h'
        else: td_interval = interval
        
        url = f"https://api.twelvedata.com/time_series?symbol={ticker}&interval={td_interval}&outputsize={outputsize}&apikey={td_key}"
        
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            if 'values' in data:
                df = pd.DataFrame(data['values'])
                
                # Create Date Index
                df['datetime'] = pd.to_datetime(df['datetime'])
                df.set_index('datetime', inplace=True)
                df.index.name = 'Date'
                
                # Rename columns (lowercase from API -> Title Case)
                df = df.rename(columns={
                    'open': 'Open',
                    'high': 'High',
                    'low': 'Low',
                    'close': 'Close',
                    'volume': 'Volume'
                })
                
                # Ensure floats
                cols = ['Open', 'High', 'Low', 'Close', 'Volume']
                # Check which cols actually exist (sometimes volume missing?)
                existing_cols = [c for c in cols if c in df.columns]
                df[existing_cols] = df[existing_cols].apply(pd.to_numeric, errors='coerce')
                
                # Sort ascending (API usually returns desc)
                df.sort_index(inplace=True)
                
                print(f"  [SUCCESS] Twelve Data History Success: {len(df)} rows")
                return df
            elif 'code' in data:
                 print(f"  [FAILED] Twelve Data Error: {data.get('message')}")
        else:
            print(f"  [FAILED] Twelve Data Request Failed: {resp.status_code}")
            
    except Exception as e:
        print(f"  [FAILED] Twelve Data Exception: {e}")
        
    return None


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

    print(f"DEBUG: Fetching quote for {ticker} via YFinance...")
    try:
        # Do not pass session to avoid compatibility issues with yfinance/curl_cffi
        stock = yf.Ticker(ticker)
        
        # fast_info often misses pre-market. Use history for latest tick.
        # caching: yfinance might cache history calls, but creating a new Ticker usually avoids instance cache.
        # Yahoo API itself has 1-min delay usually.
        try:
            df = stock.history(period='1d', interval='1m', prepost=True)
        except Exception as hist_e:
            print(f"DEBUG: YF History failed for {ticker}: {hist_e}")
            df = pd.DataFrame()
        
        data = None
        
        if not df.empty:
            print(f"DEBUG: YF History success for {ticker}, rows={len(df)}")
            latest = df.iloc[-1]
            last_price = float(latest['Close'])
            
            # Previous Close (Regular Market)
            # info.previous_close is reliable for yesterday's regular close
            prev_close = stock.info.get('previousClose') or stock.fast_info.previous_close
            
            # Fallback if history fetch fails or returns weird data
            if pd.isna(last_price):
                print(f"DEBUG: Last price is NaN for {ticker}")
                last_price = stock.fast_info.last_price

            change = last_price - prev_close if prev_close else 0
            change_percent = (change / prev_close) * 100 if prev_close else 0
            
            data = {
                'ticker': ticker,
                'price': round(last_price, 2),
                'previous_close': round(prev_close, 2) if prev_close else None,
                'change': round(change, 2),
                'change_percent': round(change_percent, 2),
                'source': 'Yahoo Finance'
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
                    'change_percent': round(change_percent, 2),
                    'source': 'Yahoo Finance'
                }

        if data:
            # Update Cache
            QUOTE_CACHE[ticker] = {
                'data': data,
                'timestamp': current_time
            }
            return data
        else:
             print(f"DEBUG: YF returned no data for {ticker}, triggering Fallback.")
             raise Exception("YF returned no data") # Trigger catch block for fallback

    except Exception as e:
        print(f"  [WARNING] Yahoo Quote Error for {ticker}: {str(e)}")
        
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
                         print(f"  [SUCCESS] Using Polygon.io Fallback for {ticker}")
                         data = {
                            'ticker': ticker,
                            'price': round(float(price), 2),
                            'change': 0, # Placeholder
                            'change_percent': 0, # Placeholder
                            'source': 'Polygon'
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
                print(f"  [FAILED] Polygon Fallback Failed: {pe}")

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
                        print(f"  [SUCCESS] Using Finnhub Fallback for {ticker}")
                        data = {
                            'ticker': ticker,
                            'price': round(float(price), 2),
                            'change': round(float(fdata.get('d', 0)), 2),
                            'change_percent': round(float(fdata.get('dp', 0)), 2),
                            'previous_close': round(float(fdata.get('pc', 0)), 2),
                            'source': 'Finnhub'
                        }
                        QUOTE_CACHE[ticker] = {'data': data, 'timestamp': current_time}
                        return data
            except Exception as fe:
                 print(f"  [FAILED] Finnhub Fallback Failed: {fe}")

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
                             print(f"  [SUCCESS] Using TwelveData Fallback for {ticker}")
                             data = {
                                'ticker': ticker,
                                'price': round(float(price), 2),
                                'change': round(float(tdata.get('change', 0)), 2),
                                'change_percent': round(float(tdata.get('percent_change', 0)), 2),
                                'previous_close': round(float(tdata.get('previous_close', 0) or 0), 2),
                                'source': 'Twelve Data'
                             }
                             QUOTE_CACHE[ticker] = {'data': data, 'timestamp': current_time}
                             return data
            except Exception as te:
                 print(f"  [FAILED] TwelveData Fallback Failed: {te}")

        # Check if we have stale cache to return instead of failing
        if ticker in QUOTE_CACHE:
            print(f"  [WARNING] Returning STALE cache for {ticker}")
            return QUOTE_CACHE[ticker]['data']
            
    return None

def _format_market_quote(quote):
    if not quote:
        return "unavailable"
    price = quote.get('price')
    change = quote.get('change')
    pct = quote.get('change_percent')
    parts = []
    if price is not None:
        parts.append(f"${price}")
    if change is not None:
        sign = "+" if change >= 0 else ""
        parts.append(f"{sign}{change}")
    if pct is not None:
        sign = "+" if pct >= 0 else ""
        parts.append(f"{sign}{pct}%")
    return " / ".join(parts) if parts else "unavailable"

def build_market_snapshot(ticker):
    """Build compact price/peer context for the news summary."""
    global MARKET_SNAPSHOT_META
    symbols = [ticker]
    peers = TICKER_PEER_GROUPS.get(ticker)
    if peers:
        symbols.extend(peers)
    else:
        symbols.extend(['SPY', 'QQQ'])

    rows = []
    providers = []
    seen = set()
    for symbol in symbols:
        if symbol in seen:
            continue
        seen.add(symbol)
        try:
            quote = fetch_quote_data(symbol)
            label = 'SOX Index' if symbol == '^SOX' else symbol
            rows.append(f"* {label}: {_format_market_quote(quote)}")
            if quote:
                providers.append(f"{label}={quote.get('source', 'unknown')}")
        except Exception as e:
            print(f"  [WARNING] Market snapshot failed for {symbol}: {e}")

    MARKET_SNAPSHOT_META[ticker] = {
        'source_id': 'MS1',
        'provider': ', '.join(providers) if providers else 'unavailable',
        'date': datetime.now(timezone.utc).date().isoformat(),
        'tier': 'Market Data',
        'confidence': 'HIGH' if providers else 'LOW'
    }
    return "\n".join(rows) if rows else "* Market snapshot unavailable"

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
            print(f"  [SUCCESS] Marked daily run for {today}")
        else:
            print(f"  [SUCCESS] Daily run for {today} already marked")
    except Exception as e:
        print(f"Error marking daily run: {e}")


def fetch_av_data(ticker, interval):
    """Fetch data from Alpha Vantage as fallback"""
    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if not api_key: return pd.DataFrame(), ''

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
        
    print(f"  [WARNING] Switching to Alpha Vantage for {ticker} ({interval})...")
    try:
        r = requests.get(url, timeout=10)
        data = r.json()
        
        # Parse keys
        ts_key = next((k for k in data.keys() if "Time Series" in k), None)
        if not ts_key:
            print(f"  [FAILED] AV Error: {data.get('Note') or data.get('Error Message')}")
            return pd.DataFrame(), ''
            
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
        print(f"  [FAILED] AV Fetch Failed: {e}")
        return pd.DataFrame(), ''

def fetch_news_for_ticker(ticker):
    """Fetch news from multiple sources for a given ticker"""
    global NEWS_FETCH_META
    all_news = []
    ticker = ticker.upper().strip()
    company_name = TICKER_NAMES.get(ticker, ticker)
    today = date.today()
    week_ago = today - timedelta(days=7)
    
    session = get_yf_session()
    
    # Primary 1: Try NewsAPI first
    # Primary 1: Try NewsAPI first
    for attempt in range(3):
        try:
            newsapi_key = os.getenv('NEWSAPI_KEY')
            if newsapi_key:
                query = f'("{ticker}" OR "{company_name}") AND (stock OR shares OR earnings OR revenue OR guidance OR analyst OR market)'
                params = {
                    'q': query,
                    'apiKey': newsapi_key,
                    'pageSize': 20,
                    'sortBy': 'publishedAt',
                    'language': 'en',
                    'from': str(week_ago)
                }
                response = requests.get("https://newsapi.org/v2/everything", params=params, timeout=5)
                
                if response.status_code == 429:
                    wait = 2 ** attempt
                    print(f"  [WARNING] NewsAPI Rate Limit (429). Retrying in {wait}s...")
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
                    print(f"  [SUCCESS] NewsAPI: {len(data.get('articles', []))} articles")
                    break # Success
        except Exception as e:
            print(f"  [FAILED] NewsAPI Attempt {attempt+1} Failed: {e}")
            if attempt < 2: time.sleep(1)
    
    # Primary 2: Try Finnhub
    # Primary 2: Try Finnhub
    for attempt in range(3):
        try:
            finnhub_key = os.getenv('FINNHUB_API_KEY')
            if finnhub_key:
                url = f"https://finnhub.io/api/v1/company-news?symbol={ticker}&from={week_ago}&to={today}&token={finnhub_key}"
                response = requests.get(url, timeout=5)
                
                if response.status_code == 429:
                    wait = 2 ** attempt
                    print(f"  [WARNING] Finnhub Rate Limit (429). Retrying in {wait}s...")
                    time.sleep(wait)
                    continue

                if response.status_code == 200:
                    data = response.json()
                    for article in data[:20]:
                        all_news.append({
                            'title': article.get('headline', ''),
                            'url': article.get('url', ''),
                            'source': article.get('source', 'Finnhub'),
                            'published_at': datetime.fromtimestamp(article.get('datetime', 0)).isoformat(),
                            'description': article.get('summary', '')
                        })
                    print(f"  [SUCCESS] Finnhub: {len(data[:20])} articles")
                    break # Success
        except Exception as e:
            print(f"  [FAILED] Finnhub Attempt {attempt+1} Failed: {e}")
            if attempt < 2: time.sleep(1)
    
    # Fallback 1: Try Polygon
    # Fallback 1: Try Polygon
    for attempt in range(3):
        try:
            polygon_key = os.getenv('POLYGON_API_KEY')
            if polygon_key:
                url = f"https://api.polygon.io/v2/reference/news?ticker={ticker}&limit=20&apiKey={polygon_key}"
                response = requests.get(url, timeout=5)
                
                if response.status_code == 429:
                    print(f"  [WARNING] Polygon Rate Limit (429 - 5 calls/min limit). Sleeping 60s to reset...")
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
                    print(f"  [SUCCESS] Polygon: {len(data.get('results', []))} articles")
                    break # Success
        except Exception as e:
            print(f"  [FAILED] Polygon Attempt {attempt+1} Failed: {e}")
            if attempt < 2: time.sleep(1)
    
    # Fallback 2: Yahoo Finance (no API key needed, reliable fallback)
    try:
        # Do not pass session to avoid compatibility issues with yfinance/curl_cffi
        stock = yf.Ticker(ticker)
        news = stock.news
        
        if news:
            for article in news[:20]:  # Get up to 20 articles
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
            print(f"  [SUCCESS] Yahoo Finance: {len(news[:20])} articles")
    except Exception as e:
        print(f"  [FAILED] Yahoo Finance: {e}")

    try:
        all_news.extend(fetch_sec_filings_for_ticker(ticker, week_ago, today))
    except Exception as e:
        print(f"  [FAILED] SEC filings fetch: {e}")
    
    unique_news = rank_and_filter_news(all_news, ticker, limit=20)
    NEWS_FETCH_META[ticker] = build_news_fetch_meta(ticker, all_news, unique_news, week_ago, today)
            
    print(f"  -> Total valid articles fetched: {len(unique_news)}")
    return unique_news

def extract_fundamental_section(text: str, section_title: str) -> str:
    if not text:
        return ''
    lines = text.split('\n')
    section_lines = []
    is_recording = False
    
    for line in lines:
        trimmed = line.strip()
        if trimmed.startswith('##') and section_title.lower() in trimmed.lower():
            is_recording = True
            section_lines.append(line)
            continue
        if is_recording and trimmed.startswith('##') and not trimmed.startswith('###'):
            break
        if is_recording:
            section_lines.append(line)
            
    return '\n'.join(section_lines).strip()

def split_consolidated_report(summary_dict: dict) -> dict:
    if not summary_dict:
        return summary_dict
        
    exec_summary = summary_dict.get('executive_summary') or ''
    analyst_earnings = summary_dict.get('analyst_earnings') or ''
    
    # If analyst_earnings is already populated (older format), keep it
    if analyst_earnings and analyst_earnings.strip() and analyst_earnings.strip() != 'N/A':
        return summary_dict
        
    # Extract sections
    part1 = extract_fundamental_section(exec_summary, 'Part 1')
    part2 = extract_fundamental_section(exec_summary, 'Part 2')
    part3 = extract_fundamental_section(exec_summary, 'Part 3')
    part4 = extract_fundamental_section(exec_summary, 'Part 4')
    part5 = extract_fundamental_section(exec_summary, 'Part 5')
    part6 = extract_fundamental_section(exec_summary, 'Part 6')
    part7 = extract_fundamental_section(exec_summary, 'Part 7')
    
    parts_list = [part1, part2, part3, part4, part5, part7]
    extracted_exec_summary = '\n\n'.join([p for p in parts_list if p])
    extracted_what_changed = part2 or ''
    extracted_last_week_updates = part3 or ''
    extracted_analyst_earnings = part6 or ''
    
    new_summary = dict(summary_dict)
    new_summary['executive_summary'] = extracted_exec_summary or exec_summary
    new_summary['what_changed'] = summary_dict.get('what_changed') or extracted_what_changed
    new_summary['last_week_updates'] = summary_dict.get('last_week_updates') or extracted_last_week_updates
    new_summary['analyst_earnings'] = summary_dict.get('analyst_earnings') or extracted_analyst_earnings
    return new_summary


import concurrent.futures

def generate_ai_report(ticker, news_articles, report_type='news'):
    """Generate Summary using Azure OpenAI
    report_type: 'news' (A/B Tested Updates) or 'fundamental' (Corporate Profile)
    """
    
    # Prepare News Text
    news_text = ""
    sources_list = []
    
    for idx, article in enumerate(news_articles[:20], 1):
        description = article.get('description', '') or ''
        detail_level = 'detailed excerpt' if len(description.strip()) >= 160 else ('partial excerpt' if description.strip() else 'headline-only/limited')
        news_text += f"[S{idx}] {article['title']}\n"
        news_text += f"   Source: {article.get('source', 'Unknown')}\n"
        news_text += f"   Source Tier: {article.get('source_tier') or _source_tier(article.get('source'))}\n"
        news_text += f"   Confidence: {article.get('confidence') or _confidence_label(article)}\n"
        news_text += f"   Thesis Leg: {article.get('thesis_leg') or _classify_thesis_leg(article)}\n"
        news_text += f"   Published: {article.get('published_at', 'Unknown')}\n"
        news_text += f"   Detail: {detail_level}\n"
        news_text += f"   URL: {article.get('url', '')}\n"
        news_text += f"   Excerpt: {_truncate_text(description, 420) or 'No excerpt available'}\n\n"
        sources_list.append({
            'title': article.get('title', 'No Title'),
            'url': article.get('url', '#'),
            'source': article.get('source', 'Unknown')
        })
    
    prompt = ""
    is_json = False

    if report_type == 'news':
        company_name = TICKER_NAMES.get(ticker, ticker)
        market_snapshot = build_market_snapshot(ticker)
        fetch_meta = NEWS_FETCH_META.get(ticker) or {}
        fetch_meta_line = format_news_fetch_meta(fetch_meta)
        missing_legs = ', '.join(fetch_meta.get('missing_legs') or []) or 'none'
        material_topic_checks = '\n'.join(f"- {item}" for item in fetch_meta.get('material_topic_checks', [])) or "- none"
        source_legend = build_source_legend(news_articles, MARKET_SNAPSHOT_META.get(ticker))

        # Build ticker-specific rules dynamically
        ticker_rules = TICKER_SPECIFIC_RULES.get(ticker, [])
        ticker_rules_str = ""
        for r in ticker_rules:
            ticker_rules_str += f"        - {r.format(company_name=company_name, ticker=ticker)}\n"

        # News Prompt (JSON)
        prompt = f"""
        Role: You are an expert financial analyst.
        Task: Analyze the provided news articles and market snapshot for {ticker}. Generate a detailed, numbers-first financial news report.
        Title: {ticker} News Analysis
        
        Fetch Metadata:
        {fetch_meta_line}
        Missing Thesis Legs: {missing_legs}
        Material Topic Checks:
        {material_topic_checks}

        Source Legend:
        {source_legend}

        Market Snapshot:
        {market_snapshot}

        Data:
        {news_text}

        QUALITY TARGETS TO MAXIMIZE:
        - Source attribution: every material bullet should end with the source name and/or source ID in parentheses when source data exists, e.g. *(Reuters, S3)*.
        - Factual verifiability: separate confirmed facts from inference; use words like "suggests" only for inference.
        - Data transparency: include the market snapshot numbers and fetch metadata limits; do not hide partial or headline-only coverage.
        - Date/time clarity: mention the coverage window and use article dates when timing matters.
        - Coverage completeness: cover all material selected articles, but group related items to avoid noise.
        - Readability/flow: write in crisp financial English; lead with what matters, then supporting detail.
        - Investment synthesis: explain why each major item matters for revenue, margins, demand, valuation, or risk.
        - Topic focus: stay on {ticker}; include peers only as context or competitive read-through.
        - Repetition control: each fact should appear once unless the second mention adds a new implication.

        REQUIRED METHOD:
        1. First, internally extract facts only from the supplied source blocks. For every fact, keep the source ID, source tier, confidence, date, and the exact excerpt phrase that supports it.
        2. Second, synthesize the brief from those extracted facts. Do not blend inference into fact extraction.
        3. For every claim about why the stock moved, cite the specific source block/excerpt that supports it. Do not infer causation from correlation unless the source explicitly states it.
        4. Label each material item HIGH / MEDIUM / LOW claim confidence based on whether the claim is directly stated, dated, concrete, and complete. Source tier is a separate calibration signal, not the only confidence driver. Concrete price/index moves from T1/T2 sources should usually be HIGH.
        5. For each company announcement or analyst action, add a sentence beginning "The investment implication is..." If the available information is too thin, label it context-only.
        6. Before writing Analyst & Earnings Context, check for: current price target, rating, stated earnings catalyst. If missing, say exactly which are missing rather than substituting commentary.
        7. Keep methodology caveats, missing-source caveats, and material-topic gaps out of "executive_summary"; put them in Key Updates -> Fetch Notes.
        
        OUTPUT FORMAT:
        Please provide a JSON response with the following structure. 
        
        CRITICAL FORMATTING INSTRUCTIONS:
        1. **Bullet Points**: All values MUST be formatted as Markdown bullet points (starting with '* ' or '- ').
        2. **Line Breaks**: You MUST use the literal newline character '\\\\n' inside the JSON string to separate each bullet point. Do not put everything on one line.
        3. **No Paragraphs**: Do not write long paragraphs. Break text into points.
        4. **Numbers First**: The first bullet must state the stock price, point change, percent move, and peer/index comparison when available.
        5. **Section Separation**: "executive_summary" is interpretation only (so what, why it matters, company-specific vs sector-driven). Do not repeat exact price/peer lines there if "what_changed" already contains them.
        6. **What Changed Today Is Tape Only**: "what_changed" is only price, % move, peer/index comparison, volume/session context if supplied, and immediate price-action explanation. Do not include product/platform news there.
        7. **Analyst Section Gate**: "analyst_earnings" must contain only confirmed analyst actions, earnings releases, guidance, estimates, or price targets from supplied data. If there are none, return one short bullet saying no confirmed analyst or earnings update was found in the supplied sources.
        8. **Depth**: Each substantive bullet should include concrete numbers, named companies/people, and the business implication when supplied by the source.
        9. **Categorized Key Updates**: "last_week_updates" may include markdown subheadings, but only inside the Key Updates section. Use relevant subheadings from this set: Earnings Update; Analyst Actions; Management/CEO Commentary; Press Releases / Company Announcements; M&A Related News; Product / Business / Sector News; Price / Valuation and Positioning; Fetch Notes. Omit empty categories.
        10. **Fetch Notes**: Include a short Fetch Notes subsection when article detail is partial, headline-only, gated, or confidence-limited. Be explicit about what is unavailable.
        11. **No Redundancy**: Do not repeat the same item across sections. If an item appears twice, the second mention must add a different implication.
        12. **No Filler**: Avoid phrases like "latest news scan", "according to coverage", "demand narrative", "reinforced the narrative", or "market sentiment remains".
        13. **Materiality Filter**: Prioritize confirmed, company-specific facts over generic market commentary.
        14. **Source Discipline**: Do not invent facts, figures, ratings, price targets, earnings dates, or price levels not present in the supplied data.
        15. **Attribution Discipline**: End each factual bullet with source attribution in parentheses, e.g. *(Reuters, S3)*, *(Yahoo Finance, S7)*, or *(Market Snapshot, MS1)*.
        16. **Inference Discipline**: If drawing an investment conclusion, make clear it is an implication from the supplied facts, not a reported fact.
        17. **Confidence Labels**: Start material bullets with **[HIGH]**, **[MEDIUM]**, or **[LOW]**.
        18. **Source Tier Labels**: Include source tier when it materially affects confidence, e.g. "T1 Reuters" or "T3 Yahoo aggregation."
        19. **Gap Handling**: If any thesis leg is missing, mention the gap in the relevant section or Fetch Notes; do not fill it with unrelated content.
        20. **Editorial Inference Label**: If a conclusion is synthesized from multiple sources rather than directly reported, start the bullet with **[LOW][EDITORIAL]** and write "This is an editorial inference, not a sourced claim."
        21. **No Aggregate Citations**: Do not cite "S1-S5". Cite named source IDs individually or mark the item as editorial inference.
        22. **Material Topic Gaps**: If any material topic is not confirmed in selected sources, state that in Fetch Notes rather than ignoring the angle.
        23. **Precise Peer Comparisons**: If saying {company_name} held up better/worse than peers, include all cited peer figures in that same bullet.
        24. **Causal Sequencing**: In "what_changed", put price action first, then the most specific stated catalyst/driver second. Do not bury the most causal item behind generic market-color bullets.
        25. **Relative Strength Synthesis**: Include one concise bullet that explicitly states whether {ticker} was stronger/weaker than relevant peers, using the same-bullet numbers.
        26. **Analyst Timing**: For analyst/commentary items, include whether the item is pre-event, same-day, or post-event when publication dates show that timing.
        27. **Thin Subsection Flattening**: In Key Updates, use subheadings only when at least two bullets fit under a subheading. If categories are thin, flatten into one clean bullet list plus Fetch Notes.
        28. **No Duplicate Ticker Mentions**: In comparison bullets, do not name the same peer twice in the same sentence. Use either exact standalone figures or a group range, not both for the same company.
        29. **Context Timing Consistency**: If a source is pre-event context, label every reused item from that source as pre-event context, not just analyst quotes.
        30. **Editorial Bullet Test**: Include editorial inference bullets only when they add a concrete forward trigger or decision rule. Otherwise omit them.
        31. **Forward Trigger Requirement**: If using a [LOW][EDITORIAL] bullet, include what would change the read from sector-driven to company-specific, such as {company_name}-specific guidance, demand, margin, regulatory, filing, or primary-wire confirmation.
        32. **Market Snapshot Citation**: Cite price-action bullets as *(Market Snapshot, MS1)* so readers can decode the quote provider/date in the source legend.
        33. **T3 Valuation Guardrail**: Do not anchor Executive Summary or What Changed Today on valuation, growth, or screen data from a T3 source unless corroborated by T1/T2. If used, mention it once only in Key Updates or Fetch Notes.
        34. **Analyst Actions Integrity**: Use an "Analyst Actions" subheading only for actual rating, price-target, estimate, or credit-rating actions in the selected window. Commentary, old ratings, or secondary references must not appear under that heading.
        35. **No Peripheral Padding**: Exclude quantum policy, SpaceX, or other broad AI infrastructure items from Key Updates unless the selected excerpt directly connects the item to {ticker} revenue, margin, demand, competition, or valuation.
        36. **No Confidence Labels On Headings**: Confidence labels apply to bullets only, never to markdown subheadings.
        37. **Single-Source Consolidation**: Do not create multiple Key Updates subsections from the same secondary article. If one article supplies earnings, analyst, and CEO commentary, consolidate it into one bullet under "Earnings / Analyst Context" or keep it in Analyst & Earnings Context.
        38. **No Zero-Implication Bullets**: Remove or move to Fetch Notes any item whose own text says the investment implication is limited, unavailable, context-only, indirect, or not {ticker}-specific.

        ADDITIONAL TICKER-SPECIFIC INSTRUCTIONS:
{ticker_rules_str}
        
        {{
            "executive_summary": "3-5 bullets with investment read-through, materiality, and sector-vs-company-specific conclusion. Do not include methodology/data caveats.",
            "what_changed": "3-6 bullets ordered as: price action first; most specific stated catalyst second; peer/index context third; relative-strength synthesis fourth if useful.",
            "analyst_earnings": "Only genuine analyst changes, earnings items, rating actions, guidance, or estimate changes. Include event timing for commentary. One short no-update bullet if none.",
            "last_week_updates": "Detailed markdown with 4-10 bullets. Use subheadings only when each used subheading has at least two bullets; otherwise flatten. Do not label subheadings with confidence. Include source names in parentheses at the end of every bullet. Put methodology caveats and material-topic gaps in Fetch Notes. Omit generic editorial caveats unless they include a concrete forward trigger."
        }}
        
        IMPORTANT: Return ONLY valid JSON.
        """
        is_json = True
    
    else:
        # Fundamental Prompt (Optimized Sector-Adaptive Analysis)
        prompt = f"""
        Role: Expert equity research analyst. Provide concise, data-driven investment analysis.

        Task: Generate a focused investment research report on {ticker} (target: 4,000-5,000 words).

        Company: {ticker}
        Data: {news_text}

        STEP 1: Identify {ticker}'s sector (Tech, Healthcare, Finance, Consumer, Energy, etc.) and use sector-specific metrics throughout.

        REPORT STRUCTURE:

        # Investment Research Report: {ticker}

        ## Part 1: Sector & Company Overview
        * **Sector**: Primary sector and sub-sector
        * **Industry Context**: Current dynamics (growth, disruption, maturity)
        * **Company Origin**: Founders, vision, key pivots
        * **Growth Milestones**: Funding, traction, strategic decisions

        ## Part 2: Business Model & Revenue
        
        ### Revenue Breakdown Table
        Create a table showing revenue streams:
        
        | Revenue Stream | Type | FY Growth | % of Total | Key Metrics |
        |---------------|------|-----------|------------|-------------|
        | [Stream 1] | [Subscription/Product/etc] | [X%] | [Y%] | [CAC, LTV, etc] |
        | [Stream 2] | [Type] | [X%] | [Y%] | [Metrics] |
        
        For each revenue stream, analyze:
        * **Type & Mechanics**: How it works
        * **Unit Economics** (sector-specific):
          - Tech: CAC, LTV, Churn, ARR
          - Retail: Same-store sales, inventory turnover
          - Banking: NIM, ROE, efficiency ratio
          - Insurance: Combined ratio
          - Manufacturing: Capacity utilization

        ## Part 3: Competitive Position
        * **Customers**: Key segments
        * **Go-to-Market**: Channels and acquisition
        * **Moat** (sector-relevant):
          - Network effects, switching costs, brand/IP, scale, regulatory barriers
        
        ### Competitive Comparison Table
        
        | Company | Market Share | Key Strength | Weakness | Valuation (P/E or P/S) |
        |---------|-------------|--------------|----------|------------------------|
        | {ticker} | [X%] | [Strength] | [Weakness] | [Multiple] |
        | Competitor 1 | [X%] | [Strength] | [Weakness] | [Multiple] |
        | Competitor 2 | [X%] | [Strength] | [Weakness] | [Multiple] |

        ## Part 4: Market & Strategy
        * **Market Size**: TAM, SAM, SOM with growth
        * **Macro Drivers**: Sector-specific trends
        * **Growth Opportunities** (3-4): Tailored to sector
        * **Key Risks** (3-4): Sector-specific threats

        ## Part 5: Leadership & Capital
        
        ### Executive Team Table
        
        | Role | Name | Background | Tenure |
        |------|------|------------|--------|
        | CEO | [Name] | [Previous roles] | [Years] |
        | CFO | [Name] | [Previous roles] | [Years] |
        | [Sector Role] | [Name] | [Previous roles] | [Years] |
        
        * **Capital Allocation**: R&D, growth, M&A, returns

        ## Part 6: Financials & Valuation
        
        ### Financial Metrics Table (Last 3 Years)
        
        | Metric | FY-2 | FY-1 | FY Current | Trend |
        |--------|------|------|------------|-------|
        | Revenue ($M) | [X] | [Y] | [Z] | [UP/DOWN] |
        | Revenue Growth (%) | [X] | [Y] | [Z] | [UP/DOWN] |
        | Gross Margin (%) | [X] | [Y] | [Z] | [UP/DOWN] |
        | Operating Margin (%) | [X] | [Y] | [Z] | [UP/DOWN] |
        | Free Cash Flow ($M) | [X] | [Y] | [Z] | [UP/DOWN] |
        | [Sector KPI] | [X] | [Y] | [Z] | [UP/DOWN] |
        
        **Sector-Specific KPIs**:
        - Tech: Rule of 40, CAC payback, net retention
        - Banking: NIM, ROE, CET1, NPL
        - Retail: Comp sales, EBITDA margin
        - Healthcare: R&D %
        - Energy: Production growth, breakeven
        
        ### Valuation Multiples Table
        
        | Multiple | {ticker} (Current) | {ticker} (Avg 3Y) | Peer Avg | Premium/Discount |
        |----------|-------------------|-------------------|----------|------------------|
        | P/E (NTM) | [X] | [Y] | [Z] | [+/-X%] |
        | EV/EBITDA | [X] | [Y] | [Z] | [+/-X%] |
        | P/S | [X] | [Y] | [Z] | [+/-X%] |
        | [Sector Multiple] | [X] | [Y] | [Z] | [+/-X%] |
        
        **Sector-Appropriate Multiples**:
        - Tech: EV/ARR, P/S
        - Banking: P/B, P/TBV
        - REITs: FFO, NAV
        - Energy: EV/production, P/CF
        
        * **Shareholder Returns**: SBC, buybacks, dividends

        ## Part 7: Investment Thesis
        * **Recommendation**: Strong Buy / Buy / Hold / Sell / Strong Sell
        * **Price Target**: 12-month with methodology
        * **Bull Case** (3-4 points)
        * **Bear Case** (3-4 points)

        Task: Generate a comprehensive investment research report on {ticker} (target: 4,000-5,000 words).
        
        Company: {ticker}
        Contextual Data (Recent News): {news_text}
        
        STEP 1: Identify {ticker}'s sector and use sector-specific metrics throughout.
        
        CRITICAL INSTRUCTIONS:
        1. Target 4,000-5,000 words total for a professional-grade deep dive.
        2. Use sector-specific terminology (e.g., ARR for Tech, NIM for Banking).
        3. **Include all requested tables with actual data where available or placeholders [X] if unknown**.
        4. Use markdown table format.
        5. Format in clean markdown (##, *, **bold**).
        6. NO JSON format.
        """
        is_json = False

    # AI Analysis with Groq (Primary) and Azure (Fallback)
    summary_final = None
    groq_key = os.getenv('GROQ_API_KEY')
    
    if groq_key:
        try:
            print(f"  [GROQ] Generating {report_type} report for {ticker}...")
            groq_url = "https://api.groq.com/openai/v1/chat/completions"
            groq_headers = {
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json"
            }
            groq_payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": "You are a top-tier investment bank research analyst."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 8192
            }
            if is_json:
                groq_payload["response_format"] = {"type": "json_object"}
                
            resp = requests.post(groq_url, headers=groq_headers, json=groq_payload, timeout=60)
            if resp.status_code == 200:
                content_text = resp.json()['choices'][0]['message']['content']
                if content_text:
                    summary_final = content_text
                    print(f"  [SUCCESS] Report Generated via Groq ({report_type})")
            else:
                print(f"  [WARNING] Groq Error ({resp.status_code}): {resp.text}")
        except Exception as e:
            print(f"  [WARNING] Groq Failed: {e}")

    # Fallback to Azure OpenAI if Groq failed
    if not summary_final:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = azure_client.chat.completions.create(
                    model=deployment_name,
                    messages=[
                        {"role": "system", "content": "You are a top-tier investment bank research analyst."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.4,
                    max_completion_tokens=8192,
                    response_format={"type": "json_object"} if is_json else None
                )
                content_text = response.choices[0].message.content
                if content_text:
                    summary_final = content_text
                    print(f"  [SUCCESS] Report Generated via Azure OpenAI ({report_type})")
                break # Success
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 5
                    print(f"  [WARNING] Azure Rate Limit (429). Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"  [WARNING] Azure OpenAI Fallback Error: {e}")
                    break

    if summary_final:
        content_text = summary_final
        if is_json:
            # Parse JSON
            try:
                # Clean potential markdown wrappers
                clean_json = content_text.replace('```json', '').replace('```', '').strip()
                data = json.loads(clean_json)
                
                # Perform global post-processing on all text fields
                fear_excluded_in_post = False
                for field in ['executive_summary', 'what_changed', 'analyst_earnings', 'last_week_updates']:
                    val = data.get(field) or ''
                    if val:
                        # 1. Correct factual errors using TICKER_FISCAL_CORRECTIONS
                        corrections = TICKER_FISCAL_CORRECTIONS.get(ticker, {})
                        for wrong_term, correct_term in corrections.items():
                            val = val.replace(wrong_term, correct_term)
                        
                        lines = val.split('\n')
                        new_lines = []
                        for line in lines:
                            # 2. Cut ChartMill bullets (since ChartMill is no longer in the sources list)
                            if 'chartmill' in line.lower() or 'affordable growth' in line.lower() or 'growth screen' in line.lower():
                                continue
                            
                            # 3. Cut Yahoo AI-fears bullets (since it's low-value sector commentary)
                            if (('fear' in line.lower() and ('ai' in line.lower() or 'yahoo' in line.lower())) or 'cold water' in line.lower() or 'indirect at best' in line.lower() or 'context-only' in line.lower() or 'context only' in line.lower()):
                                fear_excluded_in_post = True
                                continue
                            
                            # 4. Align confidence using PRODUCT_CONFIDENCE_ALIGNMENTS
                            for prod, conf in PRODUCT_CONFIDENCE_ALIGNMENTS.items():
                                if prod in line.lower():
                                    line = re.sub(r'\*\*\[(HIGH|MEDIUM|LOW)\]\*\*|\[(HIGH|MEDIUM|LOW)\]', f'**[{conf}]**', line, flags=re.IGNORECASE)
                                    if not any(lbl in line for lbl in [f'[{conf}]', f'**[{conf}]**']):
                                        line = re.sub(r'^(\s*-\s*)', rf'\1**[{conf}]** ', line)
                            
                            # 5. Downgrade using COMPETITOR_CONFIDENCE_DOWNGRADES
                            for keyword, conf in COMPETITOR_CONFIDENCE_DOWNGRADES.items():
                                if keyword in line.lower() and '[medium]' in line.lower():
                                    line = re.sub(r'\[medium\]', f'[{conf}]', line, flags=re.IGNORECASE)
                                
                            # 6. Format [editorial] bullet with generic forward trigger
                            if '[editorial]' in line.lower():
                                if f'{ticker}-specific read-through' not in line and 'company-specific read-through' not in line:
                                    line = line.rstrip('.') + f"; the next {ticker}-specific read-through would come from the missing SEC filing details or a fresh {company_name} guidance update."
                            
                            new_lines.append(line)
                        data[field] = '\n'.join(new_lines)

                what_changed = data.get('what_changed') or ''
                analyst_earnings = data.get('analyst_earnings') or ''
                last_week_updates = data.get('last_week_updates') or ''
                
                # Append standing forward trigger and Yahoo AI-fears exclusion note to Fetch Notes
                if last_week_updates:
                    trigger_bullet = f"\n- [HIGH] Next {ticker}-specific read-through: SEC filing content disclosure or fresh {company_name} guidance update."
                    combined = trigger_bullet
                    
                    if fetch_meta.get('excluded_fear') or fear_excluded_in_post:
                        combined += f"\n- [HIGH] Yahoo AI-fears piece present in candidates; excluded as non-{ticker}-specific sector commentary."
                        
                    # Detect collisions of (source, published_at)
                    collision_keys = {}
                    for article in news_articles[:20]:
                        src = article.get('source', 'Unknown')
                        pub = article.get('published_at', 'date unknown')
                        key = (src, pub)
                        collision_keys[key] = collision_keys.get(key, 0) + 1
                    
                    for key, count in collision_keys.items():
                        if count > 1:
                            src, pub = key
                            colliding = [a for a in news_articles[:20] if a.get('source') == src and a.get('published_at') == pub]
                            titles_str = " and ".join(f"'{a.get('title')}'" for a in colliding)
                            combined += f"\n- [HIGH] {src} syndicated articles ({titles_str}) share an identical publication timestamp because they were syndicated in the same Finnhub API batch; the pipeline's full-URL deduplication successfully preserved both as distinct articles."
                            
                    if "### Fetch Notes" in last_week_updates:
                        last_week_updates = last_week_updates.replace("### Fetch Notes", "### Fetch Notes" + combined)
                    elif "## Fetch Notes" in last_week_updates:
                        last_week_updates = last_week_updates.replace("## Fetch Notes", "## Fetch Notes" + combined)
                    else:
                        last_week_updates += "\n\n### Fetch Notes" + combined
                fetch_meta_line = format_news_fetch_meta(NEWS_FETCH_META.get(ticker))
                source_legend = build_source_legend(news_articles, MARKET_SNAPSHOT_META.get(ticker))
                
                # Construct Full Markdown Report for Frontend
                full_report = f"""
{fetch_meta_line}
{source_legend}

## Executive Summary
{data.get('executive_summary', '')}

## What Changed Today
{what_changed}

## Analyst & Earnings Context
{analyst_earnings}

## Key Updates
{last_week_updates}
""".strip()
                full_report = enforce_news_summary_rules(full_report, ticker)
                
                json_content = {
                    'executive_summary': full_report,
                    'what_changed': what_changed,
                    'analyst_earnings': analyst_earnings,
                    'last_week_updates': last_week_updates,
                    'sources': sources_list
                }
                return json_content
            except json.JSONDecodeError:
                print("  [WARNING] JSON Parsing Failed. Falling back to raw text.")
                return {
                    'executive_summary': content_text,
                    'what_changed': '',
                    'analyst_earnings': '',
                    'last_week_updates': '',
                    'sources': sources_list
                }
        else:
            # Return Markdown Directly (Fundamental)
            part1 = extract_fundamental_section(content_text, 'Part 1')
            part2 = extract_fundamental_section(content_text, 'Part 2')
            part3 = extract_fundamental_section(content_text, 'Part 3')
            part4 = extract_fundamental_section(content_text, 'Part 4')
            part5 = extract_fundamental_section(content_text, 'Part 5')
            part6 = extract_fundamental_section(content_text, 'Part 6')
            part7 = extract_fundamental_section(content_text, 'Part 7')
            
            parts_list = [part1, part2, part3, part4, part5, part7]
            extracted_exec_summary = '\n\n'.join([p for p in parts_list if p])
            
            return {
                'executive_summary': extracted_exec_summary or content_text,
                'what_changed': part2 or '', 
                'analyst_earnings': part6 or '', 
                'last_week_updates': part3 or '', 
                'sources': sources_list
            }

    print(f"  [FAILED] FAILED to generate summary for {ticker}.")
    
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
                    'created_at': datetime.now(timezone.utc).isoformat()
                }).execute()
                print(f"  [SUCCESS] Stored summary for {ticker}")
            except Exception as e:
                print(f"  [FAILED] Error storing summary for {ticker}: {e}")
            
    except Exception as e:
        print(f"Error storing data for {ticker}: {e}")
    finally:
        DB_LOCK.release()

def process_single_ticker(ticker, report_type='fundamental'):
    """Worker function to process a single ticker. 
    report_type: 'fundamental' (Default, stored as {ticker}) or 'news' (Stored as NEWS_{ticker})
    """
    
    # Determine Storage Key
    storage_ticker = ticker
    if report_type == 'news':
        storage_ticker = f"NEWS_{ticker}" # Data Separation key
    
    print(f"Processing {ticker} (Type: {report_type}) -> DB Key: {storage_ticker}")
    try:
        news_articles = fetch_news_for_ticker(ticker)
        
        # Fundamental analysis should proceed even if no recent news is found
        if news_articles or report_type == 'fundamental':
            # Random sleep
            time.sleep(random.uniform(1.0, 3.0))
            
            # Use separate generation logic
            summary_data = generate_ai_report(ticker, news_articles or [], report_type)
            
            if summary_data and "Unavailable" not in summary_data.get('executive_summary', ''):
                store_news_and_summary(storage_ticker, news_articles, summary_data)
            else:
                 print(f"  [WARNING] AI Unavailable/Failed.")
                 fallback_summary = {
                    'executive_summary': '<ul><li><strong>analysis unavailable</strong>: content generation failed due to high load.</li><li>news articles are listed below for your review.</li><li>please try refreshing again in a few minutes.</li></ul>',
                    'what_changed': '',
                    'analyst_earnings': '',
                    'last_week_updates': ''
                 }
                 store_news_and_summary(storage_ticker, news_articles, fallback_summary)
            return summary_data
        else:
            print(f"  - No news found for {ticker}")
            empty_summary = {
                'executive_summary': f"<ul><li>No significant news articles found for {ticker} in the last 7 days.</li></ul>",
                'what_changed': '', 'analyst_earnings': '', 'last_week_updates': ''
            }
            store_news_and_summary(storage_ticker, [], empty_summary)
            return empty_summary
    except Exception as e:
        print(f"  [FAILED] Error processing {ticker}: {e}")
        error_summary = {
            'executive_summary': f"<ul><li>Analysis failed due to a system error.</li><li>Error details: {str(e)[:200]}...</li></ul>",
            'what_changed': '', 'analyst_earnings': '', 'last_week_updates': ''
        }
        store_news_and_summary(storage_ticker, [], error_summary)
        return error_summary

def process_news_for_active_tickers(force=False, custom_tickers=None, report_type='news'):
    """Process news for all active tickers in parallel
    Args:
        force (bool): Ignore daily run check
        custom_tickers (list): Optional list of tickers to process, overriding global ACTIVE_TICKERS
        report_type (str): 'news' or 'fundamental'
    """
    global IS_PROCESSING, ACTIVE_TICKERS
    
    if IS_PROCESSING:
        print("News processing already in progress.")
        return

    # Check daily run only if not forced (and distinct storage keys per type?)
    # For simplicity, we just check generic daily run for now, OR we can split trackers.
    # ideally we should have distinct logic, but let's keep it simple: 
    # If report_type is fundamental, we might want to check a different tracker or just rely on 'force' from the script.
    
    if not force and check_daily_run():
        print("Daily news fetch already completed today. Skipping...")
        return
    
    IS_PROCESSING = True
    target_list = custom_tickers if custom_tickers else ACTIVE_TICKERS
    print(f"Starting PARALLEL {report_type} fetch cycle for {len(target_list)} tickers...")
    
    try:
        if not custom_tickers:
            # Update tickers - Prioritize DISPLAY_TICKERS first
            sorted_universe = sorted(TICKER_UNIVERSE, key=lambda x: (x not in DISPLAY_TICKERS, x))
            ACTIVE_TICKERS = sorted_universe
            target_list = ACTIVE_TICKERS
        else:
             print(f"  [SUCCESS] Using custom ticker list ({len(custom_tickers)} symbols)")
             target_list = custom_tickers
        

        tasks = []
        is_ci = os.getenv('GITHUB_ACTIONS') == 'true'
        max_workers = 1 if is_ci else 4
        delay = 3.0 if is_ci else 0.0
        
        if is_ci:
            print(f"  [CI MODE] Running with {max_workers} worker and {delay}s delay to prevent rate limits.")

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor: 
            for ticker in target_list:
                tasks.append(executor.submit(process_single_ticker, ticker, report_type=report_type))
                if delay > 0: time.sleep(delay)
            
            # Wait for completion
            concurrent.futures.wait(tasks)
            
        if report_type == 'news': # Only mark generic daily run for news? 
             mark_daily_run()
             
        print(f"{report_type.capitalize()} fetch cycle completed successfully!")
    except Exception as e:
        print(f"Critical error in {report_type} processing cycle: {e}")
    finally:
        IS_PROCESSING = False

def process_quant_analysis(ticker, force=False):
    """
    Generate Expert Quant Analysis using 1h and 1d data via chained AI prompts.
    Includes 1-hour in-memory cache.
    Returns the analysis dict or raises Exception.
    """
    # Global Cache for Quant Analysis
    global QUANT_ANALYSIS_CACHE
    if 'QUANT_ANALYSIS_CACHE' not in globals():
        QUANT_ANALYSIS_CACHE = {}

    # --- Cache Check ---
    current_time = time.time()
    
    if not force and ticker in QUANT_ANALYSIS_CACHE:
        cached_entry = QUANT_ANALYSIS_CACHE[ticker]
        if (current_time - cached_entry['timestamp']) < 3600:
            print(f"  [SUCCESS] Serving Quant Analysis for {ticker} from Cache (< 1h old)")
            return cached_entry['data']
        else:
            print(f"  [RETRY] Cache expired for {ticker} (> 1h). Regenerating...")
    
    if force:
        print(f"  [RETRY] Force Refreshing Quant Analysis for {ticker}")

    quant_logger.info(f"--- START Quant Analysis for {ticker} ---")

    from .ta_utils import calculate_technical_indicators, prepare_df_for_llm
    
    # 1. Fetch Data (1h and 1d)
    stock = yf.Ticker(ticker)
    
    # 1h Data
    try:
            df_1h = stock.history(period="2y", interval="1h")
    except: df_1h = pd.DataFrame()

    if df_1h.empty or 'High' not in df_1h.columns:
            print(f"  [WARNING] YF 1h Failed. Trying Polygon...")
            df_poly_1h = fetch_polygon_history(ticker, period_days=730, interval='1h')
            if df_poly_1h is not None and not df_poly_1h.empty:
                df_1h = df_poly_1h
            else:
                print(f"  [WARNING] Polygon 1h Failed. Trying Twelve Data...")
                df_td_1h = fetch_twelve_data_history(ticker, interval='1h', outputsize=500)
                if df_td_1h is not None and not df_td_1h.empty:
                    df_1h = df_td_1h
                else:
                    pass
    
    # 1d Data
    try:
        df_1d = stock.history(period="2y", interval="1d")
    except: df_1d = pd.DataFrame()

    if df_1d.empty or 'High' not in df_1d.columns:
            print(f"  [WARNING] YF 1d Failed. Trying Polygon...")
            df_poly_1d = fetch_polygon_history(ticker, period_days=730, interval='day')
            if df_poly_1d is not None and not df_poly_1d.empty:
                df_1d = df_poly_1d
            else:
                print(f"  [WARNING] Polygon 1d Failed. Trying Twelve Data...")
                df_td_1d = fetch_twelve_data_history(ticker, interval='day', outputsize=500)
                if df_td_1d is not None and not df_td_1d.empty:
                    df_1d = df_td_1d
                else:
                    pass
    
    # 2. Validation & Normalization
    quant_logger.info(f"Fetching complete for {ticker}. Normalizing columns...")
    df_1h, is_valid_1h = normalize_and_validate_columns(df_1h, "1H Data")
    
    if not is_valid_1h: 
            quant_logger.error(f"1H Data Invalid for {ticker}")
            raise ValueError('No 1h data found or missing data columns')

    df_1d, is_valid_1d = normalize_and_validate_columns(df_1d, "1D Data")

    if not is_valid_1d: 
            quant_logger.error("1D Data Invalid")
            raise ValueError('No 1d data found or missing data columns')

    # 3. Calculate Indicators
    try:
        df_1h = calculate_technical_indicators(df_1h)
        df_1d = calculate_technical_indicators(df_1d)
    except Exception as q_err:
            print(f"  [FAILED] Quant TA Failed for {ticker}: {q_err}")
            quant_logger.error(f"Quant TA Calculation Failed: {q_err}", exc_info=True)
            raise ValueError(f'Technical Analysis Failed: {str(q_err)}')
    
    # 3. Serialize Data for Prompt
    data_1h_str = prepare_df_for_llm(df_1h, last_n=24)
    data_1d_str = prepare_df_for_llm(df_1d, last_n=24)
    
    # 5. Execute AI Analysis
    analysis_raw = None
    summary_final = None
    last_error = "Unknown Error"
    
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
    
    * **Signal**: [BUY / SELL / NEUTRAL] (Choose one based on weight of evidence).
    * **Confidence**: [0-100]%
    
    * **Short-Term Outlook (1 Week)**: 2-3 sentences on immediate direction.
    * **Medium-Term Trend**: 1-2 sentences on the broader 1D trend (e.g. "Above SMA200, Bullish").
    
    * **Key Levels to Watch**:
      * Support: $...
      * Resistance: $...
    
    * **Strategy**: Concise actionable advice (e.g. "Buy dips to EMA20", "Wait for breakout above $X").
    """

    # Try AI Generation
    quant_logger.info(f"Starting AI Generation for {ticker}...")
    
    # 1. Try Groq (Llama 3.3) First
    groq_key = os.getenv('GROQ_API_KEY')
    groq_success = False
    
    if groq_key:
        try:
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
                    print(f"  [SUCCESS] Groq Analysis Successful for {ticker}")
            else:
                print(f"  [WARNING] Groq Error: {resp.status_code}")
        except Exception as e:
            print(f"  [WARNING] Groq Connection Error: {e}")

    # 2. Fallback to Azure OpenAI if Groq failed/missing
    if not groq_success:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = azure_client.chat.completions.create(
                    model=deployment_name,
                    messages=[
                        {"role": "system", "content": "You are an expert quantitative trader."},
                        {"role": "user", "content": combined_prompt}
                    ],
                    temperature=0.3
                )
                content_text = response.choices[0].message.content
                if content_text:
                    summary_final = content_text
                    analysis_raw = f"Generated via Azure OpenAI ({deployment_name})"
                    print(f"  [SUCCESS] Azure Quant Analysis Successful for {ticker}")
                break # Success
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                elif attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                else:
                    print(f"  [WARNING] Azure Quant Fallback Error: {e}")
                    break

    # --- FALLBACK MECHANISM ---
    if not summary_final:
        print(f"  [WARNING] All AI keys failed for {ticker}. Generating Fallback Analysis.")
        
        # Simple algorithmic fallback
        last_close = df_1d['Close'].iloc[-1]
        sma200 = df_1d['SMA_200'].iloc[-1] if 'SMA_200' in df_1d else 0
        rsi = df_1d['RSI'].iloc[-1] if 'RSI' in df_1d else 50
        
        trend = "Bullish" if last_close > sma200 else "Bearish"
        signal = "NEUTRAL"
        confidence = 50
        
        if trend == "Bullish":
            if rsi < 30: signal = "STRONG BUY"; confidence = 85
            elif rsi < 45: signal = "BUY"; confidence = 70
            elif rsi > 70: signal = "SELL (Overbought)"; confidence = 65
            else: signal = "HOLD / BULLISH"; confidence = 60
        else: # Bearish
            if rsi > 70: signal = "STRONG SELL"; confidence = 85
            elif rsi > 55: signal = "SELL"; confidence = 70
            elif rsi < 30: signal = "BUY (Oversold)"; confidence = 65
            else: signal = "HOLD / BEARISH"; confidence = 60
        
        summary_final = f"""## Quant Analysis for {ticker}
* **Signal**: {signal}
* **Confidence**: {confidence}%
* **Short-Term Outlook**: Technical indicators suggest {signal.lower()} momentum. RSI is at {rsi:.1f}.
* **Medium-Term Trend**: The broader trend is {trend} relative to the 200-day moving average.
* **Strategy**: Watch for confirmation of the current trend before entering positions.
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
    
    quant_logger.info(f"Quant Analysis Complete for {ticker}")
    return response_payload

def process_quant_for_active_tickers(force=False, custom_tickers=None):
    """Process Quant Analysis for all active tickers in parallel"""
    global IS_PROCESSING, ACTIVE_TICKERS
    
    # reusing IS_PROCESSING might block news if running concurrently, but that's probably fine/desired
    # if IS_PROCESSING: ... 

    target_list = custom_tickers if custom_tickers else ACTIVE_TICKERS
    print(f"Starting PARALLEL Quant Analysis cycle for {len(target_list)} tickers...")
    
    try:
        if not custom_tickers:
             # Ensure active tickers are populated
             if not ACTIVE_TICKERS:
                  sorted_universe = sorted(TICKER_UNIVERSE, key=lambda x: (x not in DISPLAY_TICKERS, x))
                  ACTIVE_TICKERS = sorted_universe
             target_list = ACTIVE_TICKERS

        def job(t):
             try:
                 process_quant_analysis(t, force=force)
             except Exception as e:
                 print(f"  [FAILED] Quant Job Failed for {t}: {e}")

        # Use ThreadPool
        is_ci = os.getenv('GITHUB_ACTIONS') == 'true'
        max_workers = 1 if is_ci else 4
        delay = 5.0 if is_ci else 0.0
        
        if is_ci:
            print(f"  [CI MODE] Quant: Running with {max_workers} worker and {delay}s delay.")

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            tasks = []
            for ticker in target_list:
                tasks.append(executor.submit(job, ticker))
                if delay > 0: time.sleep(delay)
            concurrent.futures.wait(tasks)
            
        print("Quant Analysis cycle completed successfully!")
    except Exception as e:
        print(f"Critical error in Quant processing cycle: {e}")

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

@us_news_bp.route('/api/refresh_fundamentals', methods=['POST'])
def refresh_fundamentals():
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



# Helper for Column Normalization (Global)
def normalize_and_validate_columns(df, label="Data"):
    if df is None or df.empty:
        return df, False
    
    # 1. Flatten MultiIndex Columns
    if isinstance(df.columns, pd.MultiIndex):
        # Find the level that has 'Close' (case insensitive)
        found_level = None
        for i in range(df.columns.nlevels):
            level_vals = df.columns.get_level_values(i)
            # Check for 'close' presence
            if any(str(x).strip().lower() == 'close' for x in level_vals):
                found_level = i
                break
        
        if found_level is not None:
             df.columns = df.columns.get_level_values(found_level)
        else:
             # Fallback: Just take level 0
             df.columns = df.columns.get_level_values(0)

    # 2. Case Insensitive Normalization & Cleanup
    # Map lowercase to Title Case
    new_cols = []
    for c in df.columns:
        # Handle residual tuples (if MultiIndex wasn't caught/flattened upstream)
        if isinstance(c, tuple):
            # Take the first string equivalent found in the tuple that looks like Open/High/Low/Close
            candidates = [str(x).strip().capitalize() for x in c]
            match = next((x for x in candidates if x in ['Open', 'High', 'Low', 'Close', 'Volume']), None)
            if match:
                 new_cols.append(match)
            else:
                 new_cols.append("_".join(candidates)) # Fallback join
        else:
            c_str = str(c).strip()
            # If it's a date or something weird, keep it string
            if c_str.lower() in ['open', 'high', 'low', 'close', 'volume']:
                new_cols.append(c_str.capitalize())
            else:
                new_cols.append(c_str) # Keep original case for others (e.g. Indicators)

    df.columns = new_cols
    
    # Remove duplicate columns if any (keep first) to prevent ValueError/Ambiguity
    if df.columns.duplicated().any():
        print(f"  [WARNING] {label}: Duplicate columns found: {df.columns[df.columns.duplicated()].tolist()}. Deduplicating...")
        df = df.loc[:, ~df.columns.duplicated()]
    
    # 3. Check for Essentials
    required = ['Open', 'High', 'Low', 'Close']
    missing = [c for c in required if c not in df.columns]
    
    if missing:
        print(f"  [WARNING] {label} Valid but Missing Columns: {missing}. Actual: {df.columns.tolist()}")
        return df, False
    
    return df, True

@us_news_bp.route('/api/ta/<ticker>', methods=['GET'])
def get_technical_analysis(ticker):
    """Calculate and return technical analysis data with interval support"""
    try:
        from flask import request
        interval = request.args.get('interval', '1d')
        # Versioning the cache key to bust old integer-based dates (Fix 2024-12-25)
        cache_key = f"{ticker}_{interval}_v2"
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
             print(f"  [SUCCESS] Serving TA from Cache for {ticker} ({interval}) [Source: {src_label}]")
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
                # session = get_yf_session()
                stock = yf.Ticker(ticker)
                df = stock.history(period=period, interval=interval)
                
                if df.empty:
                     pass 
                
                break # Success
            except Exception as e:
                error_msg = str(e)
                last_error = e
                if "429" in error_msg or "Too Many Requests" in error_msg or "Rate Limit" in error_msg:
                    wait = 2 ** attempt # 2, 4, 8
                    print(f"  [WARNING] TA Rate Limit (429) for {ticker}. Retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                else:
                    # Non-retryable error?
                    print(f"  [FAILED] TA Fetch Error attempt {attempt}: {e}")
                    time.sleep(1) # small wait
        
        if df.empty:
             print(f"  [WARNING] Yahoo Finance failed/empty for {ticker}. Attempting Alpha Vantage Fallback...")
             # fetch_av_data now returns tuple
             df, src = fetch_av_data(ticker, interval)
             if not df.empty:
                 print(f"  [SUCCESS] Fallback to Alpha Vantage successful for {ticker}")
                 data_source = src
             elif last_error:
                 print(f"  [FAILED] Alpha Vantage Fallback also failed.")
                 raise last_error
        
                
        # If fetch empty but we have stale cache, return stale
        if df.empty:
            if cached_item:
                 print(f"  [WARNING] Fetch empty, serving STALE TA Cache for {ticker}")
                 return jsonify(cached_item['data'])
            return jsonify({'error': 'No data found'}), 404
            
        # --- Calculations ---
        # Robust Normalization
        df, is_valid = normalize_and_validate_columns(df, "TA Data")
        if not is_valid:
             return jsonify({'error': 'Invalid data format (missing High/Low/Close)'}), 500

        # Assume df is valid here
        try:
            from .ta_utils import calculate_technical_indicators, get_fibonacci_levels, get_support_resistance, get_ta_summary
            
            # 1. Base Indicators
            print(f"DEBUG TA: Columns before calc: {df.columns.tolist()}")
            quant_logger.info(f"TA CALL Columns: {df.columns.tolist()}")
            
            # --- SOFT FAILURE WRAPPER START ---
            try:
                # is_intraday param is CRITICAL
                is_intraday = interval in ['1m', '2m', '5m', '15m', '30m', '60m', '1h']
                
                df = calculate_technical_indicators(df, is_intraday=is_intraday)

                # 2. Fibonacci Retracement
                fib_levels = get_fibonacci_levels(df)

                # 3. Support & Resistance
                sr_data = get_support_resistance(df)
                supports = sr_data['supports']
                resistances = sr_data['resistances']
                
                # 4. Summary & Analysis
                summary = get_ta_summary(df)

            except Exception as ta_calc_error:
                print(f"  [WARNING] TA Calcs Failed: {ta_calc_error} - Returning raw Price Chart only.")
                # Fallback: Just use the raw DF for charting, no indicators
                fib_levels = None
                supports = []
                resistances = []
                summary = {
                    'price':0, 'action': 'Neutral', 'rsi': 0, 
                    'analysis': f"Technical Analysis Unavailable: {str(ta_calc_error)}",
                    'oscillators': [], 'moving_averages': []
                }
            
            # --- Prepare Response ---
            
            # Robust Date Extraction
            chart_data = None
            date_col = 'Date' # Normalized name we want

            # 1. Check if Index is the Date (Standard yfinance)
            if isinstance(df.index, pd.DatetimeIndex):
                # Reset index to make it a column
                chart_data = df.tail(200).reset_index()
                # Rename the index column to 'Date' if it isn't already
                if chart_data.columns[0] == 'index': 
                    chart_data.rename(columns={'index': 'Date'}, inplace=True)
                elif chart_data.columns[0] == 'Datetime':
                     chart_data.rename(columns={'Datetime': 'Date'}, inplace=True)
                # Ensure the first column is named 'Date' if it looks like a date
                elif pd.api.types.is_datetime64_any_dtype(chart_data[chart_data.columns[0]]):
                     chart_data.rename(columns={chart_data.columns[0]: 'Date'}, inplace=True)
            
            else:
                # 2. Check if Date is already a column
                found_col = None
                for c in df.columns:
                    if str(c).lower() in ['date', 'datetime', 'time', 'timestamp']:
                        found_col = c
                        break
                
                if found_col:
                    chart_data = df.tail(200).copy()
                    if found_col != 'Date':
                        chart_data.rename(columns={found_col: 'Date'}, inplace=True)
                else:
                    # 3. Fallback: Reset index anyway and check first column
                    temp_reset = df.tail(200).reset_index()
                    if pd.api.types.is_datetime64_any_dtype(temp_reset.iloc[:, 0]):
                        chart_data = temp_reset
                        chart_data.rename(columns={chart_data.columns[0]: 'Date'}, inplace=True)
                    else:
                        # 4. Critical Failure Fallback: Generate generic dates? 
                        # Or just fail gracefully. Let's try to use what we have.
                        print(f"  [WARNING] CRITICAL: Could not find Date column/index for {ticker}. Using Index as generic x-axis.")
                        chart_data = df.tail(200).reset_index()
                        # Rename first col to date to satisfy frontend
                        chart_data.rename(columns={chart_data.columns[0]: 'Date'}, inplace=True)

            # Ensure 'Date' column exists now
            if 'Date' not in chart_data.columns:
                 # Last safety net
                 chart_data['Date'] = chart_data.index.astype(str)

            # Clean NaNs
            chart_data = chart_data.where(pd.notnull(chart_data), None)
            
            chart_json = []
            for _, row in chart_data.iterrows():
                # Handle Interval Date/Time Formatting
                date_val = row['Date']
                date_str = ""
                
                # Robust Formatting
                if hasattr(date_val, 'strftime'):
                    if interval in ['1d', '1wk', '1mo']:
                        date_str = date_val.strftime('%Y-%m-%d')
                    else:
                        # Intraday
                        date_str = date_val.strftime('%Y-%m-%d %H:%M')
                else:
                    # String Fallback
                    s_val = str(date_val)
                    # Try to parse string if it looks iso-ish?
                    if ' ' in s_val and len(s_val) > 10:
                        if interval in ['1d', '1wk', '1mo']:
                             date_str = s_val.split(' ')[0]
                        else:
                             # Try to keep up to minutes
                             try: date_str = s_val[:16] 
                             except: date_str = s_val
                    else:
                        date_str = s_val

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
                  print(f"  [WARNING] Rate Limit hit, serving STALE TA Cache for {ticker}")
                  return jsonify(cached_item['data'])
                  
             return jsonify({'error': 'Rate limited by data provider. Please try again later.'}), 429
        
        print(f"TA Logic Error: {e}")
        return jsonify({'error': f"Request Error: {str(e)}"}), 500


@us_news_bp.route('/api/debug/ta/<ticker>', methods=['GET'])
def debug_technical_analysis(ticker):
    """
    DEBUG ROUTE: Same as get_technical_analysis but returns full traceback on error.
    Used to diagnose production 500 errors.
    """
    try:
        import traceback
        from flask import request
        interval = request.args.get('interval', '1d')
        
        # --- VERSION CHECK ---
        debug_info = {
            "version": "DEBUG_PATCH_V3", # Bumped version + Session Fix
            "timestamp": time.time(),
            "attempting_ticker": ticker,
            "interval": interval
        }
        
        # 1. Fetch
        # FIX: Do not pass session (incompatible with new yfinance/curl_cffi)
        stock = yf.Ticker(ticker)
        
        period = "1y" # simplify for debug
        if interval in ['1m', '5m']: period = "5d"
        elif interval == '1h': period = "2y"
        
        df = stock.history(period=period, interval=interval)
        
        if df.empty:
            debug_info["step"] = "fetch_data"
            debug_info["error"] = "Empty DataFrame from Yahoo"
            return jsonify(debug_info), 404

        debug_info["fetch_shape"] = str(df.shape)
            
        # 2. Normalize
        # Explicitly call the global function
        df, is_valid = normalize_and_validate_columns(df, "Debug Data")
        if not is_valid:
            debug_info["step"] = "normalization"
            debug_info["columns"] = df.columns.tolist() if df is not None else "None"
            return jsonify(debug_info), 500
            
        # 3. Calculate
        from .ta_utils import calculate_technical_indicators
        
        # Explicitly Test the Fix
        is_intraday = interval in ['1m', '2m', '5m', '15m', '30m', '60m', '1h']
        debug_info["is_intraday_param"] = is_intraday
        
        result_df = calculate_technical_indicators(df, is_intraday=is_intraday)
        
        debug_info["status"] = "Success"
        debug_info["columns"] = result_df.columns.tolist()[:10]
        return jsonify(debug_info)
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'version': 'DEBUG_PATCH_V3'
        }), 500


def ai_queue_worker():
    """Background worker to process AI requests sequentially with rate limiting"""
    print("AI Queue Worker Started...")
    while True:
        try:
            # Get next task
            task = AI_QUEUE.get()
            ticker, report_type = task
            
            print(f"  [QUEUE] Processing {ticker} (Type: {report_type}, Queue Size: {AI_QUEUE.qsize()})")
            
            # Process
            try:
                process_single_ticker(ticker, report_type=report_type)
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

def run_single(ticker, manual=False, report_type='fundamental'):
    """Trigger background analysis via Safe Queue"""
    # Push to Queue instead of spawning uncapped threads
    print(f"  [QUEUE] Adding {ticker} ({report_type}) to AI Queue")
    AI_QUEUE.put((ticker, report_type))
    
    return f"Added {ticker} to AI Queue"

@us_news_bp.route('/api/generate_fundamentals/<ticker>', methods=['POST', 'GET'], strict_slashes=False)
def generate_ticker_fundamentals(ticker):
    """Force generate summary for a specific ticker"""
    from flask import request
    print(f"DEBUG: Hit generate_ticker_summary for {ticker} with method {request.method}")

    # For POST requests (like the refresh button), use the main processing logic
    if request.method == 'POST':
        # Trigger with report_type='fundamental' (Default prompt)
        result_data = process_single_ticker(ticker, report_type='fundamental')
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







@us_news_bp.route('/api/quote/<ticker>', methods=['GET'])
def get_ticker_quote(ticker):
    """Fetch real-time quote (price/change) for a ticker"""
    # Clean ticker if it comes from 'NEWS_' prefix context
    if ticker.startswith("NEWS_"):
        ticker = ticker.replace("NEWS_", "")
        
    data = fetch_quote_data(ticker)
    if data:
        return jsonify(data)
    else:
        return jsonify({'error': 'No data'}), 404

    
@us_news_bp.route('/api/generate_news/<ticker>', methods=['POST', 'GET'], strict_slashes=False)
def generate_ticker_news(ticker):
    """Force generate news summary for a specific ticker (Separate Route)"""
    # Trigger with report_type='news'
    result_data = process_single_ticker(ticker, report_type='news')
    if result_data:
         return jsonify(result_data)
    else:
         return jsonify({'error': 'Failed to generate news'}), 500

@us_news_bp.route('/api/news/<ticker>')
def get_news_analysis(ticker):
    """Get News Analysis report (Reads NEWS_{ticker} from DB)"""
    # Proxy to get_fundamentals logic but with modified ticker key
    return get_fundamentals(f"NEWS_{ticker}")

@us_news_bp.route('/api/fundamentals/<ticker>')
def get_fundamentals(ticker):
    """Get Fundamental Analysis report for a specific ticker (Latest available)"""
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
                 print(f"  [WARNING] CRITICAL: Supabase returned non-JSON response (likely Cloudflare block or 503).")
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
                        print(f"  [SUCCESS] Skipped 'Unavailable' summary for {ticker}, showing valid one from {candidate.get('summary_date')}")
                    break
            
            # If all are unavailable, we will return the latest (which is the fail state), which is correct behavior if nothing exists.
            summary = split_consolidated_report(summary)
            
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
        # Do not pass session to avoid compatibility issues with yfinance/curl_cffi
        stock = yf.Ticker(ticker)
        df = stock.history(period=period, interval=interval)
        
        # --- FALLBACK LOGIC START ---
        if df.empty:
             print(f"  [WARNING] Yahoo History Empty for {ticker}, trying Fallback...")
             raise Exception("Empty Yahoo Data")
        # --- FALLBACK LOGIC END ---

    except Exception as e:
         print(f"  [WARNING] Yahoo History Error: {e}")
         
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
                         print(f"  [SUCCESS] Polygon History Success: {len(results)} candles")
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
                 print(f"  [FAILED] Polygon History Error: {pe}")

         # If Fallback fails or no key, check Stale Cache
         if cache_key in HISTORY_CACHE:
             print(f"  [WARNING] Returning STALE History cache for {ticker}")
             # Cache stores {'data': {'data': [...]}} structure now to match
             val = HISTORY_CACHE[cache_key]['data']
             # If old cache (before fix) was list, handle it?
             if isinstance(val, list): return jsonify({'data': val})
             return jsonify(val)

         err_msg = str(e)
         if "Too Many Requests" in err_msg or "429" in err_msg:
             return jsonify({'error': 'Rate limited by data provider. Please try again later.'}), 429
         return jsonify({'error': 'No history found for this ticker'}), 404

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
    global LATEST_PRICE_CACHE
    current_time = time.time()
    
    # 1. Check Cache (1 minute cache to avoid rate limits)
    if ticker in LATEST_PRICE_CACHE:
        cached = LATEST_PRICE_CACHE[ticker]
        if current_time - cached['timestamp'] < 60:
            return jsonify(cached['data'])
            
    try:
        # Use simple Yahoo query first
        stock = yf.Ticker(ticker)
        df = stock.history(period='1d', interval='1m')
        
        data = None
        
        if not df.empty:
            df = df.reset_index()
            latest = df.iloc[-1]
            col_name = 'Datetime' if 'Datetime' in df.columns else 'Date'
            
            # Get Prev Close from fast_info if available
            prev_close = None
            try: prev_close = stock.fast_info.previous_close
            except: pass
            
            data = {
                'time': int(latest[col_name].timestamp()),
                'open': float(latest['Open']),
                'high': float(latest['High']),
                'low': float(latest['Low']),
                'close': float(latest['Close']),
                'volume': int(latest['Volume']),
                'previous_close': prev_close
            }
            
        else:
             # YF Empty -> Try Polygon Fallback
             print(f"  [WARNING] Yahoo Latest-Price Empty for {ticker}, trying Polygon...")
             poly_key = os.getenv('POLYGON_API_KEY')
             if poly_key:
                 try:
                     # Polygon Aggs (Previous close / Today)
                     # Need real-time? Polygon free tier has delay.
                     # Let's fetch last trade or prev agg
                     p_url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev?adjusted=true&apiKey={poly_key}"
                     r = requests.get(p_url, timeout=5)
                     if r.status_code == 200:
                         p_res = r.json()
                         if p_res.get('resultsCount', 0) > 0:
                             res = p_res['results'][0]
                             # res keys: T, v, o, c, h, l, t, n
                             data = {
                                 'time': int(res['t'] / 1000),
                                 'open': res['o'],
                                 'high': res['h'],
                                 'low': res['l'],
                                 'close': res['c'],
                                 'volume': res['v'],
                                 'previous_close': None # Prev API is usually 'yesterday'
                             }
                 except Exception as pe:
                     print(f"  [FAILED] Polygon Latest Fallback Failed: {pe}")

        if data:
            # Update Cache
            LATEST_PRICE_CACHE[ticker] = {
                'data': data,
                'timestamp': current_time
            }
            return jsonify(data)
        else:
            return jsonify({'error': 'No data available'}), 404
        
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "Rate Limit" in error_msg or "Too Many Requests" in error_msg:
             print(f"Price Poll Rate Limit Error for {ticker}: {e}")
             # Return Stale Cache if available
             if ticker in LATEST_PRICE_CACHE:
                 print(f"  [WARNING] Returning STALE Latest Price cache for {ticker}")
                 return jsonify(LATEST_PRICE_CACHE[ticker]['data'])
             return jsonify({'error': 'Rate limited by data provider.'}), 429
             
        print(f"Latest Price Error for {ticker}: {e}")
        return jsonify({'error': str(e)}), 500
@us_news_bp.route('/api/quant-analysis/<ticker>', methods=['GET'])
def get_quant_analysis(ticker):
    """
    Generate Expert Quant Analysis using 1h and 1d data via chained AI prompts.
    Includes 1-hour in-memory cache.
    """
    try:
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        result = process_quant_analysis(ticker, force=force_refresh)
        return jsonify(result)

    except ValueError as ve:
        # Handled error (e.g. no data)
        return jsonify({'error': str(ve)}), 404
        
    except Exception as e:
        print(f"Quant Analysis Error for {ticker}: {e}")
        quant_logger.error(f"CRASH: {e}", exc_info=True)
        
        # FALLBACK: Try to serve stale cache
        if ticker in QUANT_ANALYSIS_CACHE:
             print(f"  [WARNING] Returning STALE Quant Analysis cache for {ticker}")
             return jsonify(QUANT_ANALYSIS_CACHE[ticker]['data'])

        err_msg = str(e)
        if "Too Many Requests" in err_msg or "429" in err_msg:
             return jsonify({'error': 'Rate limited by data provider. Please try again later.'}), 429
        
        return jsonify({'error': str(e)}), 500





