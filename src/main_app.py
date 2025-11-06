#!/usr/bin/env python3
"""Main Flask Application"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
import pandas as pd
import numpy as np
import requests

# Load environment variables
load_dotenv()

# Import redis conditionally for Vercel compatibility
try:
    import redis
except ImportError:
    redis = None

# Setup logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add src directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import route modules
from api.auth_routes import register_auth_routes
from api.portfolio_routes import register_portfolio_routes
from api.transaction_routes import register_transaction_routes
from api.admin_routes import register_admin_routes
from api.cache_routes import register_cache_routes

# Add News system to path for integration
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'News'))


# Import clients and utilities
try:
    from clients.market_data_client import MarketDataClient
except ImportError:
    class MarketDataClient:
        def get_current_prices(self, symbols):
            return {symbol: 100.0 for symbol in symbols}
        def get_price_data(self, symbols, period):
            import pandas as pd
            return pd.DataFrame()

from clients.supabase_client import supabase_client
# Removed smart_cache import - using direct API calls

# Check required services first
def check_services():
    logger.info("Starting service checks...")
    print("Checking required services...")
    
    # Check Supabase (non-blocking)
    if not supabase_client or not supabase_client.client:
        logger.warning("Supabase connection failed - missing client or configuration")
        print("[WARNING] Supabase connection failed - some features may be limited")
    else:
        try:
            # Test Supabase connection
            result = supabase_client.client.table('users').select('id').limit(1).execute()
            logger.info("Supabase connection test successful")
            print("[OK] Supabase connected successfully")
        except Exception as e:
            logger.warning(f"Supabase connection test failed: {e}")
            print("[WARNING] Supabase connection test failed - some features may be limited")
    
    # Check Redis (non-blocking)
    redis_client = None
    if redis:
        try:
            redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
            redis_client.ping()
            logger.info("Redis connection successful")
            print("[OK] Redis connected successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            print("[WARNING] Redis connection failed - caching disabled")
            redis_client = None
    else:
        logger.warning("Redis not available - caching disabled")
        print("[WARNING] Redis not available - caching disabled")
    
    return redis_client

# Check services before starting app
logger.info("Initializing application services...")
redis_client = check_services()
logger.info("Application services initialized")

# Get the parent directory (project root)
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
web_folder = os.path.join(project_root, 'web')

app = Flask(__name__, static_folder=web_folder, static_url_path='')
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production-12345')
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
CORS(app, supports_credentials=True)

# Initialize data client
try:
    logger.info("Initializing market data client...")
    data_client = MarketDataClient()
    logger.info("Market data client initialized successfully")
except Exception as e:
    logger.warning(f"Using fallback market data client: {e}")
    print(f"Warning: Using fallback market data client: {e}")
    data_client = MarketDataClient()

# Static routes
@app.route('/')
def index():
    return app.send_static_file('landing.html')

@app.route('/app')
def main_app():
    return app.send_static_file('index.html')

@app.route('/admin')
def admin_portal():
    return app.send_static_file('admin.html')

@app.route('/test-analytics')
def test_analytics():
    return app.send_static_file('test-analytics.html')

# News endpoint using News folder system only
@app.route('/api/news', methods=['GET'])
def get_market_news():
    try:
        # Import News system
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'News'))
        from database import db as news_db
        
        # Get summaries from News database
        tickers = news_db.get_tickers()[:6]
        articles = []
        
        for ticker in tickers:
            summary_data = news_db.get_summary(ticker)
            if summary_data and summary_data.get('summary'):
                articles.append({
                    "title": f"{ticker} Analysis Update",
                    "description": summary_data['summary'][:200] + '...',
                    "source": {"name": "AI Analysis"},
                    "publishedAt": summary_data.get('date', datetime.now().isoformat()) + 'Z',
                    "url": f"/stock/{ticker}"
                })
        
        return {'success': True, 'articles': articles}
        
    except Exception as e:
        logger.error(f"News API error: {e}")
        return {'success': False, 'articles': []}, 500

# Test endpoint to verify API is working
@app.route('/api/test', methods=['GET'])
def test_api():
    return jsonify({'success': True, 'message': 'API is working'})





# Endpoint to serve Pexels API key
@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify({
        'pexels_api_key': os.getenv('PEXELS_API_KEY', '')
    })





# Register all route modules
register_auth_routes(app)
try:
    register_portfolio_routes(app, data_client)
    logger.info("Portfolio routes registered successfully")
except Exception as e:
    logger.error(f"Failed to register portfolio routes: {e}")
    import traceback
    traceback.print_exc()
register_transaction_routes(app)
if redis_client:
    register_admin_routes(app, redis_client)
    register_cache_routes(app, redis_client)
else:
    logger.warning("Redis not available - admin and cache routes disabled")
# Use secure Plaid routes
from api.plaid_routes_secure import register_plaid_routes as register_secure_plaid_routes
register_secure_plaid_routes(app)

if __name__ == '__main__':
    logger.info("Starting Portfolio & Options Analysis Engine")
    print("\nStarting Portfolio & Options Analysis Engine")
    print("Web Interface: http://127.0.0.1:8080")
    print("API Endpoints: http://127.0.0.1:8080/api")
    print("Press Ctrl+C to stop\n")
    
    logger.info("Flask app starting on 127.0.0.1:8080")
    app.run(
        host='127.0.0.1',
        port=8080,
        debug=False,
        threaded=True,
        use_reloader=False
    )