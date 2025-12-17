import os
import time
import random
import json
import re
import threading
from datetime import datetime, date, timedelta
from flask import Blueprint, render_template, jsonify
from dotenv import load_dotenv
import requests
from supabase import create_client, Client
import google.generativeai as genai
import yfinance as yf

# Global Lock for Database Operations
DB_LOCK = threading.Lock()

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

def fetch_quote_data(ticker):
    """Helper to fetch real-time quote data using yfinance"""
    try:
        stock = yf.Ticker(ticker)
        info = stock.fast_info
        
        last_price = info.last_price
        prev_close = info.previous_close
        
        if prev_close and prev_close > 0:
            change = last_price - prev_close
            change_percent = (change / prev_close) * 100
            return {
                'ticker': ticker,
                'price': round(last_price, 2),
                'previous_close': round(prev_close, 2) if prev_close else None,
                'change': round(change, 2),
                'change_percent': round(change_percent, 2)
            }
    except Exception as e:
        print(f"Error fetching quote for {ticker}: {e}")
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
        stock = yf.Ticker(ticker)
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
    
    for idx, article in enumerate(news_articles[:10], 1):
        news_text += f"{idx}. {article['title']}\n"
        news_text += f"   Source: {article['source']}\n"
        news_text += f"   {article['description']}\n\n"
        sources_list.append({
            'title': article['title'],
            'url': article['url'],
            'source': article['source']
        })
    
    # A/B Testing Strategies
    strategies = ["Detailed", "Crisp", "PriceContext"]
    selected_strategy = random.choice(strategies)
    print(f"  🎲 Selected Prompt Strategy: {selected_strategy}")

    if selected_strategy == "PriceContext":
        # Fetch price data for context
        quote_data = fetch_quote_data(ticker)
        change_str = "N/A"
        if quote_data:
            sign = "+" if quote_data['change_percent'] >= 0 else ""
            change_str = f"{sign}{quote_data['change_percent']}%"
        
        content_instruction = f"Today's Price change of {ticker} is {change_str}. Prioritize the most recent news articles and give a crisp, relevant accurate summary that can partly explain the price changes."
        
    elif selected_strategy == "Crisp":
        content_instruction = f"Give a crisp, relevant and accurate summary of the latest developments for {ticker} with a clear what, why and how."
        
    else: # Detailed (Original)
        content_instruction = f"Analyze the following news articles about {ticker} stock and create a **detailed and comprehensive** summary."

    prompt = f"""{content_instruction}
    
    IMPORTANT: Format each section as a **list of bullet points** using HTML <ul> and <li> tags. Do not use plain paragraphs.

{news_text}

Please provide a JSON response with the following structure:
{{
    "executive_summary": "<ul><li>Key point 1...</li><li>Key point 2...</li><li>Key point 3...</li></ul> (80-120 words total)",
    "what_changed": "<ul><li>Change 1...</li><li>Change 2...</li></ul> (80-120 words total)",
    "analyst_earnings": "<ul><li>Analyst note 1...</li><li>Earnings detail...</li></ul> (80-120 words total)",
    "last_week_updates": "<ul><li>Update 1...</li><li>Update 2...</li></ul> (80-120 words total)"
}}

Output Requirements:
1. **Use HTML bullet points (<ul>, <li>)** for ALL sections.
2. Provide at least 3-5 substantial bullet points per section.
3. **Use SIMPLE, CLEAR English.** Explain complex financial concepts so that **anyone** can understand them.
4. Avoid jargon. If a technical term is necessary, explain what it means in simple terms.
5. Elaborate on the details, but keep the language accessible and easy to read.
6. Total length per section should still be substantial (80-120 words)."""

    # Gemini REST API Payload
    # Using gemini-2.5-flash which supports system_instruction and JSON mode
    payload = {
        "system_instruction": {
            "parts": [{"text": "You are a financial analyst AI. You provide detailed stock news summaries in structured JSON format with HTML content."}]
        },
        "contents": [
            {"role": "user", "parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.3
        }
    }
    
    # Smart Key Rotation Implementation
    # Shuffle keys to load balance distribution across requests
    # But ensure we try ALL keys before failing
    available_keys = list(all_keys_data) # Copy list
    random.shuffle(available_keys)
    
    for attempt, (api_key, key_name) in enumerate(available_keys):
        # Gemini REST URL
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            # Short timeout to fail fast and rotate
            response = requests.post(url, headers=headers, json=payload, timeout=25)
            
            # If rate limited (too many requests), wait and retry
            # Gemini Free Tier is 15 RPM (1 req every 4s). If we hit this, wait 5s to clear bucket.
            if response.status_code == 429:
                print(f"  ⚠ Rate limited (429) on {key_name}. Waiting 5s before rotating...")
                time.sleep(5) 
                continue
                
            # If model is overloaded (503), wait and retry
            if response.status_code == 503:
                print(f"  ⚠ Model overloaded (503) on {key_name}. Waiting 5s before rotating...")
                time.sleep(5)
                continue
            
            # If Error (400)
            if response.status_code == 400:
                 print(f"  ⚠ Bad Request (400) on {key_name}: {response.text[:100]}...")
                 continue

            if response.status_code == 200:
                result = response.json()
                try:
                    candidates = result.get('candidates', [])
                    if not candidates:
                        print(f"  ⚠ No candidates returned from Gemini on {key_name}.")
                        continue
                        
                    content_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                    
                    if not content_text:
                        print(f"  ⚠ Empty text from Gemini on {key_name}.")
                        continue

                    try:
                        # Clean markdown naming if present
                        clean_text = content_text.replace('```json', '').replace('```', '').strip()
                        json_content = json.loads(clean_text)
                    except json.JSONDecodeError:
                         # Retry parsing or just log
                         print(f"  ⚠ JSON Decode Error on {key_name}. Content: {clean_text[:50]}...")
                         continue

                    print(f"  ✓ Summary generated successfully for {ticker} using {key_name}")
                    json_content['sources'] = sources_list
                    return json_content
                    
                except Exception as e:
                    print(f"  ⚠ Analysis Error on {key_name}: {e}")
                    continue
        
        except requests.exceptions.Timeout:
             print(f"  ⚠ Timeout on {key_name}. Rotating...")
             continue
        except Exception as e:
            print(f"  ⚠ Connection Error on {key_name}: {e}")
            continue

    print(f"  ✗ FAILED to generate summary for {ticker} after trying {len(available_keys)} keys.")
    return None
            
def store_news_and_summary(ticker, news_articles, summary_data):
    """Store news articles and AI summary in database"""
    today = date.today()
    print(f"DEBUG: store_news_and_summary called for {ticker} on date {today} with {len(news_articles)} articles")
    
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
                    'summary_date': str(today)
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
            if summary_data:
                store_news_and_summary(ticker, news_articles, summary_data)
            else:
                # Fallback
                print(f"  ⚠ AI generation failed for {ticker} (All keys exhausted), storing fallback.")
                fallback_summary = {
                    'executive_summary': '<ul><li>Brief analysis unavailable at this moment due to high demand.</li><li>Please try refreshing in a few seconds.</li></ul>',
                    'what_changed': '<ul><li>Refer to news sources below.</li></ul>',
                    'analyst_earnings': '<ul><li>N/A</li></ul>',
                    'last_week_updates': '<ul><li>N/A</li></ul>'
                }
                store_news_and_summary(ticker, news_articles, fallback_summary)
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
    except Exception as e:
        print(f"  ✗ Error processing {ticker}: {e}")
        # Store error state so frontend knows it failed
        error_summary = {
            'executive_summary': f"<ul><li>Analysis failed due to a system error.</li><li>Error details: {str(e)[:100]}...</li></ul>",
            'what_changed': '<ul><li>N/A</li></ul>',
            'analyst_earnings': '<ul><li>N/A</li></ul>',
            'last_week_updates': '<ul><li>N/A</li></ul>'
        }
        store_news_and_summary(ticker, [], error_summary)

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
        key_vars = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5', 'GEMINI_API_KEY_6']
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
                except Exception:
                    pass
    except Exception as e:
        print(f"Index Batch Quote Error: {e}")

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

def run_single(ticker, manual=False):
    """Helper to trigger single ticker processing in background"""
    # Load balance across all available keys in .env
    raw_keys = [
        (os.getenv('GROQ_API_KEY'), 'GROQ_API_KEY'),
        (os.getenv('GROQ_API_KEY_2'), 'GROQ_API_KEY_2'),
        (os.getenv('GROQ_API_KEY_3'), 'GROQ_API_KEY_3'),
        (os.getenv('GROQ_API_KEY_4'), 'GROQ_API_KEY_4'),
        (os.getenv('GROQ_API_KEY_5'), 'GROQ_API_KEY_5'),
        (os.getenv('GROQ_API_KEY_6'), 'GROQ_API_KEY_6')
    ]
    # Filter None
    keys = [k for k in raw_keys if k[0]]
    
    if not keys:
        print("No Groq keys available!")
        return "No keys"

    # Run in background to avoid timeout
    def worker():
        process_single_ticker(ticker, keys)
        
    thread = threading.Thread(target=worker)
    thread.start()
    return "Background process started"

@us_news_bp.route('/api/generate/<ticker>', methods=['POST', 'GET'], strict_slashes=False)
def generate_ticker_summary(ticker):
    """Force generate summary for a specific ticker"""
    from flask import request
    print(f"DEBUG: Hit generate_ticker_summary for {ticker} with method {request.method}")
    # Check auth
    auth_header = request.headers.get('Authorization')
    expected_token = os.getenv('API_TOKEN')
    if expected_token:
        # Allow Bearer token or direct token
        token = auth_header.replace('Bearer ', '') if auth_header and auth_header.startswith('Bearer ') else auth_header
        if token != expected_token:
            return jsonify({'error': 'Unauthorized'}), 401

    print(f"DEBUG: Starting single run for {ticker}")
    
    # CLEAR EXISTING SUMMARY FOR TODAY so logic waits for new one
    try:
        today = date.today()
        supabase.table('ticker_summaries').delete().eq('ticker', ticker).eq('summary_date', str(today)).execute()
        print(f"Cleared existing summary for {ticker} to force spinner wait.")
    except Exception as e:
        print(f"Error clearing previous summary: {e}")

    result = run_single(ticker, manual=True)
    return jsonify({'status': 'triggered', 'result': result})

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
    """Get AI summary for a specific ticker"""
    today = date.today()
    
    try:
        print(f"DEBUG: get_summary checking for {ticker} on date {today}")
        result = supabase.table('ticker_summaries').select('*').eq('ticker', ticker).eq('summary_date', str(today)).execute()
        
        if result.data:
            print(f"DEBUG: Found summary for {ticker}")
            summary = result.data[0]
            
            # Get sources from news table
            news_result = supabase.table('news').select('title, original_url, source').eq('ticker', ticker).order('published_at', desc=True).limit(10).execute()
            
            # Dedup sources by URL
            seen_urls = set()
            sources = []
            for n in news_result.data:
                if n['original_url'] not in seen_urls:
                    sources.append({'title': n['title'], 'url': n['original_url'], 'source': n['source']})
                    seen_urls.add(n['original_url'])
            
            return jsonify({
                'status': 'found',
                'ticker': ticker,
                'executive_summary': summary['executive_summary'],
                'what_changed': summary['what_changed'],
                'analyst_earnings': summary['analyst_earnings'],
                'last_week_updates': summary['last_week_updates'],
                'sources': sources,
                'date': summary['summary_date']
            })
        else:
            print(f"DEBUG: No summary found for {ticker} on date {today}")
            # Return 200 with status=not_found to avoid console errors during polling
            return jsonify({'status': 'not_found', 'message': 'No summary available for today'})
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@us_news_bp.route('/api/tickers')
def get_tickers():
    """Get list of active tickers"""
    return jsonify({'tickers': DISPLAY_TICKERS})
