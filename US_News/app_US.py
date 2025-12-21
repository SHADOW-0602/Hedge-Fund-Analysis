import os
import time
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
    """Helper to fetch real-time quote data using yfinance (incl. Pre/Post Market)"""
    try:
        stock = yf.Ticker(ticker)
        # fast_info often misses pre-market. Use history for latest tick.
        # caching: yfinance might cache history calls, but creating a new Ticker usually avoids instance cache.
        # Yahoo API itself has 1-min delay usually.
        df = stock.history(period='1d', interval='1m', prepost=True)
        
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
            
            return {
                'ticker': ticker,
                'price': round(last_price, 2),
                'previous_close': round(prev_close, 2) if prev_close else None,
                'change': round(change, 2),
                'change_percent': round(change_percent, 2)
            }
        
        # Fallback to fast_info if history is empty (e.g., weekend or no data)
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
    # Using gemini-flash-latest which is the stable high-speed model
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
        # Gemini REST URL (using stable flash-latest)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
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

@us_news_bp.route('/api/ta/<ticker>', methods=['GET'])
def get_technical_analysis(ticker):
    """Calculate and return technical analysis data"""
    try:
        # Fetch 1 year of daily data
        stock = yf.Ticker(ticker)
        df = stock.history(period="1y")
        
        if df.empty:
            return jsonify({'error': 'No data found'}), 404
            
        # --- Calculations ---
        
        # --- Calculations ---
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
        # Data for Charting (Last 200 days approx to keep payload small)
        chart_data = df.tail(200).reset_index()
        chart_json = []
        for _, row in chart_data.iterrows():
            chart_json.append({
                'date': row['Date'].strftime('%Y-%m-%d'),
                'open': row['Open'],
                'high': row['High'],
                'low': row['Low'],
                'close': row['Close'],
                'volume': row['Volume'],
                'sma50': row['SMA_50'] if not pd.isna(row['SMA_50']) else None,
                'sma200': row['SMA_200'] if not pd.isna(row['SMA_200']) else None,
                'macd': row['MACD'] if not pd.isna(row['MACD']) else None,
                'signal': row['MACD_Signal'] if not pd.isna(row['MACD_Signal']) else None,
                'hist': row['MACD_Hist'] if not pd.isna(row['MACD_Hist']) else None,
            })
            
        latest = df.iloc[-1]
        summary = get_ta_summary(df)

        return jsonify({
            'chart_data': chart_json,
            'fibonacci': fib_levels,
            'supports': sorted(list(set([round(x, 2) for x in supports]))),
            'resistances': sorted(list(set([round(x, 2) for x in resistances])), reverse=True),
            'summary': summary
        })

    except Exception as e:
        print(f"TA Error for {ticker}: {e}")
        return jsonify({'error': str(e)}), 500

def run_single(ticker, manual=False):
    """Helper to trigger single ticker processing in background"""
    # Load balance across ALL available Gemini keys
    all_keys = []
    key_vars = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5', 'GEMINI_API_KEY_6']
    for var in key_vars:
        k = os.getenv(var)
        if k: all_keys.append((k, var))
        
    if not all_keys:
        print("CRITICAL: No Gemini API keys found!")
        return "No keys"

    # Run in background to avoid timeout
    def worker():
        process_single_ticker(ticker, all_keys)
        
    thread = threading.Thread(target=worker)
    thread.start()
    return "Background process started"

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
        key_vars = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5', 'GEMINI_API_KEY_6']
        for var in key_vars:
            k = os.getenv(var)
            if k: all_keys.append((k, var))
            
        success = process_single_ticker(ticker, all_keys)
        if success:
            # Fetch updated data from DB
            try:
                result = supabase.table('ticker_summaries').select('*').eq('ticker', ticker).execute()
                if result.data:
                    return jsonify(result.data[0])
            except Exception as e:
                return jsonify({'error': str(e)}), 500
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
        return jsonify({'status': 'triggered', 'message': msg})

    return jsonify({'status': 'method_not_allowed'}), 405

@us_news_bp.route('/api/financials/<ticker>', methods=['GET'])
def get_financial_analysis(ticker):
    """
    Fetch fundamental data + Generate AI Recommendation (Gemini).
    """
    print(f"DEBUG: Analyzing Financials for {ticker}")
    try:
        # 1. Fetch Fundamentals (yfinance)
        stock = yf.Ticker(ticker)
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
            'ticker': ticker
        }

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
        
        # 1. PEG Ratio Fallback
        if fundamentals['peg_ratio'] is None and fundamentals['pe_ratio']:
            try:
                # Fetch Annual Financials to calculate EPS Growth
                fin = stock.financials
                if not fin.empty and 'Basic EPS' in fin.index:
                    eps_series = fin.loc['Basic EPS']
                    if len(eps_series) >= 2:
                        eps_cur = eps_series.iloc[0]
                        eps_prev = eps_series.iloc[1]
                        if eps_prev and eps_prev != 0:
                            growth_rate = ((eps_cur - eps_prev) / abs(eps_prev)) * 100
                            if growth_rate > 0:
                                fundamentals['peg_ratio'] = round(fundamentals['pe_ratio'] / growth_rate, 2)
            except Exception as e:
                print(f"Manual PEG Error: {e}")

        # 2. Dividend Yield Sanity Check
        # User reported anomaly (e.g. 38%). Calculate from Rate/Price if possible to verify.
        try:
            div_rate = info.get('dividendRate')
            price = info.get('currentPrice') or info.get('previousClose')
            if div_rate and price and price > 0:
                calc_yield = div_rate / price
                raw_yield = fundamentals['dividend_yield']
                
                # If raw yield is missing, or huge discrepancy (e.g. > 10% diff), use calculated
                # Example: If raw is 0.38 (38%) but calc is 0.0038 (0.38%), use calc.
                if raw_yield is None or abs(raw_yield - calc_yield) > 0.05:
                    print(f"DEBUG: Replacing suspicious yield {raw_yield} with calculated {calc_yield}")
                    fundamentals['dividend_yield'] = calc_yield
        except Exception as e:
            print(f"Yield Check Error: {e}")
        
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
        df = stock.history(start=start_date, end=end_date)
        
        if df.empty:
            return jsonify({'error': 'No price data found'}), 404
            
        from US_News.ta_utils import calculate_technical_indicators, get_ta_summary
        df = calculate_technical_indicators(df)
        ta_summary = get_ta_summary(df) # {price, rsi, macd_action, sma_trend}

        # 3. Generate AI Recommendation (Gemini) with Robust Key Rotation
        # Load all available keys
        all_keys = []
        key_vars = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5', 'GEMINI_API_KEY_6']
        for var in key_vars:
            k = os.getenv(var)
            if k: all_keys.append((k, var))
            
        ai_recommendation = "AI Analysis Unavailable"
        recommendation_signal = "UNKNOWN"
        
        if all_keys:
            # Shuffle for load balancing
            random.shuffle(all_keys)
            
            prompt = f"""
            You are a Senior Financial Analyst. Analyze {ticker} based on this data:
            
            FUNDAMENTALS:
            - Market Cap: {fundamentals['market_cap']}
            - P/E Ratio: {fundamentals['pe_ratio']}
            - PEG Ratio: {fundamentals['peg_ratio']}
            - Revenue (TTM): {fundamentals['revenue_ttm']}
            - Profit Margin: {fundamentals['profit_margins']}
            
            TECHNICALS:
            - Price: {ta_summary['price']}
            - RSI (14): {ta_summary['rsi']}
            - MACD Action: {ta_summary['macd_action']}
            - Trend (vs SMA200): {ta_summary['sma_trend']}
            
            TASK:
            1. Provide a clear "BUY", "SELL", or "HOLD" signal.
            2. Write a concise 3-4 sentence paragraph explaining WHY. Focus on the synthesis of fundamental valuation vs technical momentum.
            
            FORMAT:
            Signal: [BUY/SELL/HOLD]
            Reasoning: [Paragraph]
            """

            # Gemini REST API Payload
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.3
                }
            }
            
            # Retry Loop
            for attempt, (api_key, key_name) in enumerate(all_keys):
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
                headers = {'Content-Type': 'application/json'}
                
                try:
                    # Short timeout for fast failover
                    response = requests.post(url, headers=headers, json=payload, timeout=10)
                    
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
        
        # Upsert Signals to Supabase (technical_signals) even if AI failed (keep old or set error)
        if ai_recommendation != "AI Analysis Unavailable":
             signal_data = {
                'ticker': ticker,
                'recommendation': recommendation_signal,
                'reasoning': ai_recommendation,
                'rsi': ta_summary['rsi'],
                'macd_signal': ta_summary['macd_action'],
                'last_updated': datetime.now().isoformat()
            }
             try:
                supabase.table('technical_signals').upsert(signal_data).execute()
             except Exception as e:
                print(f"DB Error (Signals): {e}")

        return jsonify({
            'fundamentals': fundamentals,
            'technicals': ta_summary,
            'ai_analysis': ai_recommendation
        })

    except Exception as e:
         print(f"Financials Error: {e}")
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
        # Fetch the MOST RECENT summary, regardless of date
        print(f"DEBUG: get_summary fetching latest for {ticker}")
        result = supabase.table('ticker_summaries').select('*').eq('ticker', ticker).order('summary_date', desc=True).limit(1).execute()
        
        if result.data:
            summary = result.data[0]
            print(f"DEBUG: Found summary for {ticker} from {summary['summary_date']}")
            
            # Get sources from news table linked to this summary date (or just latest)
            # Logic: just get latest news for content context
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
            print(f"DEBUG: No summary found for {ticker} (history is empty)")
            # Return 200 with status=not_found to avoid console errors during polling
            return jsonify({'status': 'not_found', 'message': 'No summary available'})
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@us_news_bp.route('/api/tickers')
def get_tickers():
    """Get list of active tickers"""
    return jsonify({'tickers': DISPLAY_TICKERS})

@us_news_bp.route('/api/history/<ticker>', methods=['GET'])
def get_history(ticker):
    """Fetch historical data for the interactive chart"""
    from flask import request
    period = request.args.get('period', '1y')
    interval = request.args.get('interval', '1d')
    
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period=period, interval=interval)
        
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
            
        return jsonify({'data': data})

    except Exception as e:
        print(f"History Error for {ticker}: {e}")
        return jsonify({'error': str(e)}), 500

@us_news_bp.route('/api/latest-price/<ticker>', methods=['GET'])
def get_latest_price(ticker):
    """Fetch latest price for real-time chart updates"""
    try:
        stock = yf.Ticker(ticker)
        # Get today's 1-minute data for most recent price
        df = stock.history(period='1d', interval='1m')
        
        if df.empty:
            return jsonify({'error': 'No data available'}), 404
            
        # Get the last row (most recent candle)
        df = df.reset_index()
        latest = df.iloc[-1]
        d = latest['Datetime'] if 'Datetime' in df.columns else latest['Date']
        
        return jsonify({
            'time': int(d.timestamp()),  # Unix timestamp for intraday
            'open': float(latest['Open']),
            'high': float(latest['High']),
            'low': float(latest['Low']),
            'close': float(latest['Close']),
            'volume': int(latest['Volume'])
        })
        
    except Exception as e:
        print(f"Latest Price Error for {ticker}: {e}")
        return jsonify({'error': str(e)}), 500
