import os
import time
import random
import json
import threading
from datetime import datetime, date, timedelta
from flask import Blueprint, render_template, jsonify
from dotenv import load_dotenv
import requests
from supabase import create_client, Client
import google.generativeai as genai
import yfinance as yf

# Load environment variables
load_dotenv()

# Initialize Blueprint
us_news_bp = Blueprint('us_news', __name__, template_folder='templates', static_folder='static', url_prefix='/us-news')

# Initialize Supabase
supabase: Client = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_ANON_KEY')
)

# Initialize Gemini AI
genai.configure(api_key=os.getenv('GEMINI_API_KEY_5'))
model = genai.GenerativeModel('gemini-2.5-flash')

# Universe of popular stocks to monitor (Top US Companies by Market Cap + Popular Tech/Meme)
TICKER_UNIVERSE = [
    # Mag 7 / Big Tech
    'AAPL', 'MSFT', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA',
    # Chips / Semi
    'AMD', 'INTC', 'AVGO', 'QCOM', 'TXN', 'MU', 'ARM', 'TSM',
    # Software / Cloud / AI
    'ORCL', 'CRM', 'ADBE', 'PLTR', 'SNOW', 'SHOP', 'NOW', 'IBM', 'UBER', 'ABNB', 'PANW', 'CRWD',
    # Financials
    'JPM', 'BAC', 'V', 'MA', 'WFC', 'MS', 'GS', 'BLK', 'COIN', 'PYPL',
    # Retail / Consumer
    'WMT', 'COST', 'TGT', 'HD', 'MCD', 'SBUX', 'NKE', 'DIS', 'NFLX',
    # Pharma / Health
    'LLY', 'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'TMO',
    # Industrial / Energy / Auto
    'XOM', 'CVX', 'CAT', 'GE', 'BA', 'F', 'GM',
    # Others
    'VZ', 'T', 'KO', 'PEP'
]

# Global variable to store current active list
ACTIVE_TICKERS = TICKER_UNIVERSE[:50]  # Default to first 50
IS_PROCESSING = False  # Track if news processing is running

def get_dynamic_tickers():
    """Select Top 50 tickers based on market volume/activity"""
    print("Updating active ticker list based on market activity...")
    try:
        # For now, we'll use the defined universe. 
        # In a full production app, you could sort this list by real-time volume using yfinance
        # e.g., tickers_with_vol = [(t, yf.Ticker(t).info.get('volume', 0)) for t in TICKER_UNIVERSE]
        # But doing 60+ API calls synchronously takes too long for this demo.
        
        # We will cycle/refresh the list to ensure the core ones are always there
        # and limit to 50 for the UI
        return TICKER_UNIVERSE[:50]
    except Exception as e:
        print(f"Error updating tickers: {e}")
        return TICKER_UNIVERSE[:50]

# Initialize active tickers with default list first to avoid blocking import
ACTIVE_TICKERS = TICKER_UNIVERSE[:50]

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
    try:
        newsapi_key = os.getenv('NEWSAPI_KEY')
        if newsapi_key:
            url = f"https://newsapi.org/v2/everything?q={ticker}&apiKey={newsapi_key}&pageSize=5&sortBy=publishedAt"
            response = requests.get(url, timeout=5)
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
    except requests.exceptions.RequestException:
        pass  # Silently skip if network issues
    except Exception as e:
        print(f"  ✗ NewsAPI: {e}")
    
    # Primary 2: Try Finnhub
    try:
        finnhub_key = os.getenv('FINNHUB_API_KEY')
        if finnhub_key:
            today = date.today()
            week_ago = today - timedelta(days=7)
            url = f"https://finnhub.io/api/v1/company-news?symbol={ticker}&from={week_ago}&to={today}&token={finnhub_key}"
            response = requests.get(url, timeout=5)
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
    except requests.exceptions.RequestException:
        pass  # Silently skip if network issues
    except Exception as e:
        print(f"  ✗ Finnhub: {e}")
    
    # Fallback 1: Try Polygon
    try:
        polygon_key = os.getenv('POLYGON_API_KEY')
        if polygon_key:
            url = f"https://api.polygon.io/v2/reference/news?ticker={ticker}&limit=5&apiKey={polygon_key}"
            response = requests.get(url, timeout=5)
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
    except requests.exceptions.RequestException:
        pass  # Silently skip if network issues
    except Exception as e:
        print(f"  ✗ Polygon: {e}")
    
    # Fallback 2: Yahoo Finance (no API key needed, reliable fallback)
    try:
        stock = yf.Ticker(ticker)
        news = stock.news
        
        if news:
            for article in news[:10]:  # Get up to 10 articles
                all_news.append({
                    'title': article.get('title', ''),
                    'url': article.get('link', ''),
                    'source': article.get('publisher', 'Yahoo Finance'),
                    'published_at': datetime.fromtimestamp(article.get('providerPublishTime', 0)).isoformat(),
                    'description': article.get('title', '')  # Yahoo doesn't provide description
                })
            print(f"  ✓ Yahoo Finance: {len(news[:10])} articles")
    except Exception as e:
        print(f"  ✗ Yahoo Finance: {e}")
    
    print(f"  → Total articles fetched: {len(all_news)}")
    return all_news

def generate_ai_summary(ticker, news_articles):
    """Generate AI summary using Gemini 2.0 Flash"""
    if not news_articles:
        return None
    
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
    
    # Create prompt for Gemini
    prompt = f"""Analyze the following news articles about {ticker} stock and create a comprehensive summary in exactly 50-100 words for each section.

{news_text}

Please provide a JSON response with the following structure:
{{
    "executive_summary": "A 50-100 word overview of the main developments",
    "what_changed": "A 50-100 word explanation of what changed today for this stock",
    "analyst_earnings": "A 50-100 word summary of any analyst revisions or earnings announcements (or 'No major analyst revisions or earnings announcements were reported today.' if none)",
    "last_week_updates": "A 50-100 word summary of developments from the past week"
}}

Keep each section between 50-100 words. Be concise and factual."""
    
    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        summary_data = json.loads(response_text.strip())
        summary_data['sources'] = sources_list
        
        return summary_data
    except Exception as e:
        print(f"AI summary error for {ticker}: {e}")
        return None

def store_news_and_summary(ticker, news_articles, summary_data):
    """Store news articles and AI summary in database"""
    today = date.today()
    
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
                # First try to delete any existing summary for this ticker/date to avoid conflicts
                # This is cleaner than upsert race conditions
                supabase.table('ticker_summaries').delete().match({
                    'ticker': ticker, 
                    'summary_date': str(today)
                }).execute()
                
                # Then insert the new one
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

def process_news_for_active_tickers(force=False):
    """Process news for all active tickers"""
    global IS_PROCESSING
    
    if IS_PROCESSING:
        print("News processing already in progress via another thread/request.")
        return

    if not force and check_daily_run():
        print("Daily news fetch already completed today. Skipping...")
        return
    
    IS_PROCESSING = True
    print(f"Starting news fetch cycle for {len(ACTIVE_TICKERS)} tickers...")
    
    try:
        # Update tickers before running
        # ACTIVE_TICKERS = get_dynamic_tickers() # Keep using static list for stability
        
        count = 0
        for ticker in ACTIVE_TICKERS:
            count += 1
            print(f"[{count}/{len(ACTIVE_TICKERS)}] Processing {ticker}...")
            
            try:
                # Add delay to avoid hitting rate limits (2s + jitter)
                if count > 1:
                    sleep_time = 2.0 + random.uniform(0.1, 0.5)
                    time.sleep(sleep_time)

                # Fetch news
                news_articles = fetch_news_for_ticker(ticker)
                
                if news_articles:
                    # Generate AI summary
                    summary_data = generate_ai_summary(ticker, news_articles)
                    
                    # Store in database
                    store_news_and_summary(ticker, news_articles, summary_data)
                else:
                    print(f"  - No news found for {ticker}")
            except Exception as e:
                print(f"  ✗ Error processing {ticker}: {e}")
                # Continue to next ticker
            
        mark_daily_run()
        print("News fetch cycle completed successfully!")
    except Exception as e:
        print(f"Critial error in news processing cycle: {e}")
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
    return render_template('us_news_index.html', tickers=ACTIVE_TICKERS, now=int(time.time()))

@us_news_bp.route('/api/refresh', methods=['POST'])
def refresh_news():
    """Trigger a manual refresh of all news"""
    run_background_refresh()
    return jsonify({'status': 'started', 'message': 'News refresh started in background'})

@us_news_bp.route('/api/status', methods=['GET'])
def get_status():
    """Check processing status"""
    return jsonify({'is_processing': IS_PROCESSING})

@us_news_bp.route('/api/summary/<ticker>')
def get_summary(ticker):
    """Get AI summary for a specific ticker"""
    today = date.today()
    
    try:
        result = supabase.table('ticker_summaries').select('*').eq('ticker', ticker).eq('summary_date', str(today)).execute()
        
        if result.data:
            summary = result.data[0]
            
            # Get sources from news table
            news_result = supabase.table('news').select('title, original_url, source').eq('ticker', ticker).order('published_at', desc=True).limit(10).execute()
            
            sources = [{'title': n['title'], 'url': n['original_url'], 'source': n['source']} for n in news_result.data]
            
            return jsonify({
                'ticker': ticker,
                'executive_summary': summary['executive_summary'],
                'what_changed': summary['what_changed'],
                'analyst_earnings': summary['analyst_earnings'],
                'last_week_updates': summary['last_week_updates'],
                'sources': sources,
                'date': summary['summary_date']
            })
        else:
            return jsonify({'error': 'No summary available for today'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@us_news_bp.route('/api/tickers')
def get_tickers():
    """Get list of active tickers"""
    return jsonify({'tickers': ACTIVE_TICKERS})
