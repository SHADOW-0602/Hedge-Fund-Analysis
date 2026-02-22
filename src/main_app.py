"""Main Flask Application"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flasgger import Swagger
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

# Keep original portfolio database for main app
# News database will be handled separately in News module

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
from api.sector_routes import sector_bp
from api.backtesting_routes import register_backtesting_routes
from api.chat_routes import chat_bp

# Add News system to path for integration
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'News'))

# Import Flask render_template for News templates
from flask import render_template, send_from_directory


# Import clients and utilities - NO FALLBACK IMPLEMENTATIONS
try:
    from clients.market_data_client import MarketDataClient
except ImportError as e:
    print(f"CRITICAL ERROR: MarketDataClient import failed: {e}")
    print("Application requires real market data client - no fallback available")
    raise ImportError("MarketDataClient is required for real market data analysis") from e

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

# CORS configuration - allow old and new frontend
frontend_url = os.getenv('FRONTEND_URL', '')
allowed_origins = [
    'https://shmventures.org',  # Old frontend
    'http://127.0.0.1:8080',
    'http://localhost:8080',
]
if frontend_url:
    allowed_origins.append(frontend_url)  # New frontend

CORS(app, supports_credentials=True, origins=allowed_origins, allow_headers=['Content-Type', 'Authorization'])

# Configure Swagger/OpenAPI Documentation
swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "Hedge Fund Analysis API",
        "description": "API for portfolio management, analytics, options trading, and financial market analysis",
        "version": "1.0.0",
        "contact": {
            "name": "API Support",
            "email": "support@hedgefundanalysis.com"
        }
    },
    "host": os.getenv("API_HOST", "127.0.0.1:8080"),
    "basePath": "/",
    "schemes": ["http", "https"],
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT token authentication. Format: Bearer {token}"
        },
        "SessionAuth": {
            "type": "apiKey",
            "name": "session",
            "in": "cookie",
            "description": "Session cookie authentication"
        }
    },
    "tags": [
        {"name": "Auth", "description": "Authentication and user management"},
        {"name": "Portfolio", "description": "Portfolio management and analysis"},
        {"name": "Transactions", "description": "Transaction tracking and analysis"},
        {"name": "Analytics", "description": "Advanced analytics and risk analysis"},
        {"name": "Options", "description": "Options trading and analysis"},
        {"name": "News", "description": "Market news and stock analysis"},
        {"name": "Market Data", "description": "Real-time market data and charts"},
        {"name": "Admin", "description": "Administrative operations"},
        {"name": "Cache", "description": "Cache management"},
        {"name": "Sector", "description": "Sector analysis and visualization"},
        {"name": "Backtesting", "description": "Strategy backtesting"},
        {"name": "Health", "description": "System health and monitoring"}
    ]
}

swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": False,  # Disable built-in UI, use custom HTML
    "specs_route": None
}

# Initialize Swagger - only for spec generation, not UI
swagger = Swagger(app, template=swagger_template, config=swagger_config)

# Custom Swagger UI routes using static HTML
@app.route('/docs')
def swagger_ui():
    return app.send_static_file('swagger-ui.html')

# Also make swagger available at /swagger and /redoc for convenience
@app.route('/swagger')
def swagger_redirect():
    from flask import redirect
    return redirect('/docs')

@app.route('/redoc')
def redoc_redirect():
    from flask import redirect
    return redirect('/docs')

# News static files route - MUST be first
@app.route('/static/<path:filename>')
def news_static(filename):
    try:
        news_static_path = os.path.join(os.path.dirname(__file__), '..', 'News', 'static')
        news_file_path = os.path.join(news_static_path, filename)
        
        # Check if file exists in News static folder first
        if os.path.exists(news_file_path):
            return send_from_directory(news_static_path, filename)
        
        # Fallback to main app static files
        return app.send_static_file(filename)
        
    except Exception as e:
        logger.error(f"Static file error: {e}")
        # Final fallback to main app static
        try:
            return app.send_static_file(filename)
        except:
            return '', 404

# News/static route for direct access
@app.route('/News/static/<path:filename>')
def news_static_direct(filename):
    try:
        news_static_path = os.path.join(os.path.dirname(__file__), '..', 'News', 'static')
        return send_from_directory(news_static_path, filename)
    except Exception as e:
        logger.error(f"News static file error: {e}")
        return '', 404

# Initialize data client - REAL DATA ONLY
try:
    logger.info("Initializing real market data client...")
    data_client = MarketDataClient()
    
    # Validate that the client has at least one working provider
    if not data_client.providers:
        raise Exception("No market data providers available")
    
    logger.info(f"Market data client initialized with {len(data_client.providers)} real data providers")
    print(f"[SUCCESS] Real market data client ready with {len(data_client.providers)} providers")
    
except Exception as e:
    logger.error(f"CRITICAL: Market data client initialization failed: {e}")
    print(f"[ERROR] Market data client initialization failed: {e}")
    print("[ERROR] Application requires real market data - no fallback available")
    raise RuntimeError(f"Real market data client required: {e}") from e

# Root route - Landing Page
@app.route('/')
def landing():
    return app.send_static_file('landing.html')

@app.route('/app')
def main_app():
    return app.send_static_file('index.html')

@app.route('/dashboard')
def dashboard():
    return app.send_static_file('index.html')

@app.route('/admin')
def admin_portal():
    return app.send_static_file('admin.html')

@app.route('/learn-more.html')
def learn_more():
    return app.send_static_file('learn-more.html')

@app.route('/features.html')
def features():
    return app.send_static_file('features.html')

@app.route('/about.html')
def about():
    return app.send_static_file('about.html')

@app.route('/favicon.ico')
def favicon():
    return app.send_static_file('favicon.png')

# News endpoint using News database
@app.route('/api/news', methods=['GET'])
def get_market_news():
    """
    Get Market News
    ---
    tags:
      - News
    summary: Get market news summaries
    description: Retrieves AI-generated market analysis summaries for tracked tickers
    responses:
      200:
        description: News articles retrieved
        schema:
          type: object
          properties:
            success:
              type: boolean
            articles:
              type: array
              items:
                type: object
                properties:
                  title:
                    type: string
                  description:
                    type: string
                  source:
                    type: object
                  publishedAt:
                    type: string
                  url:
                    type: string
      500:
        description: Failed to retrieve news
    """
    try:
        from News.database import db as news_db
        
        tickers = news_db.get_tickers()[:6]
        logger.info(f"Found {len(tickers)} tickers: {tickers}")
        articles = []
        
        for ticker in tickers:
            summary_data = news_db.get_summary(ticker)
            logger.info(f"Summary for {ticker}: {bool(summary_data)}")
            if summary_data and summary_data.get('summary'):
                articles.append({
                    "title": f"{ticker} Analysis Update",
                    "description": summary_data['summary'][:200] + '...',
                    "source": {"name": "AI Analysis"},
                    "publishedAt": summary_data.get('date', datetime.now().isoformat()) + 'Z',
                    "url": f"/stock/{ticker}"
                })
        
        logger.info(f"Returning {len(articles)} articles")
        return {'success': True, 'articles': articles}
        
    except Exception as e:
        logger.error(f"News API error: {e}")
        return {'success': False, 'articles': [], 'error': str(e)}, 500

# Test endpoint to verify API is working
@app.route('/api/test', methods=['GET'])
def test_api():
    """
    API Health Test
    ---
    tags:
      - Health
    summary: Test API connectivity
    description: Simple endpoint to verify API is running
    responses:
      200:
        description: API is working
        schema:
          type: object
          properties:
            success:
              type: boolean
            message:
              type: string
    """
    return jsonify({'success': True, 'message': 'API is working'})

# Register all route modules
register_auth_routes(app)  # Re-enabled for portfolio database
try:
    register_portfolio_routes(app, data_client, None)
    logger.info("Portfolio routes registered successfully")
    print("[DEBUG] Portfolio routes registered - checking tax routes...")
except Exception as e:
    logger.error(f"Failed to register portfolio routes: {e}")
    print(f"[ERROR] Portfolio routes failed: {e}")
    import traceback
    traceback.print_exc()
try:
    register_transaction_routes(app)
    logger.info("Transaction routes registered successfully")
except Exception as e:
    logger.error(f"Failed to register transaction routes: {e}")
    import traceback
    traceback.print_exc()
# Register admin routes (handles missing redis internally)
register_admin_routes(app, redis_client)

if redis_client:
    register_cache_routes(app, redis_client)
else:
    logger.warning("Redis not available - cache routes disabled")
# Use secure Plaid routes
from api.plaid_routes_secure import register_plaid_routes as register_secure_plaid_routes
register_secure_plaid_routes(app)

# Register sector analysis routes
app.register_blueprint(sector_bp)
app.register_blueprint(chat_bp)

# Register backtesting routes
try:
    register_backtesting_routes(app, data_client, None)
    logger.info("Backtesting routes registered successfully")
except Exception as e:
    logger.error(f"Failed to register backtesting routes: {e}")
    import traceback
    traceback.print_exc()

# Register Option Scraper Routes
try:
    from api.option_scraper_routes import option_scraper_bp
    app.register_blueprint(option_scraper_bp, url_prefix='/api')
    logger.info("Option Scraper routes registered successfully")
except Exception as e:
    logger.error(f"Failed to register option scraper routes: {e}")
    traceback.print_exc()

# Analytics routes are already registered via portfolio_routes.py

# Note: Tax, analytics, options, technical analysis, transaction analysis, 
# drawdown, comprehensive analysis, and portfolio management routes are 
# already registered via portfolio_routes.py to avoid duplicates

# Register P&L attribution routes
try:
    from api.pnl_attribution_routes import register_pnl_attribution_routes
    register_pnl_attribution_routes(app, data_client, None)
    logger.info("Enhanced P&L Attribution routes registered successfully")
except Exception as e:
    logger.error(f"Failed to register enhanced P&L attribution routes: {e}")
    import traceback
    traceback.print_exc()

# Register return attribution routes
try:
    from api.return_attribution_routes import register_return_attribution_routes
    register_return_attribution_routes(app, data_client)
    logger.info("Return Attribution routes registered successfully")
except Exception as e:
    logger.error(f"Failed to register return attribution routes: {e}")
    import traceback
    traceback.print_exc()

# Register turnover analysis routes
try:
    from api.turnover_routes import register_turnover_routes
    register_turnover_routes(app, data_client, None)
    logger.info("Turnover Analysis routes registered successfully")
except Exception as e:
    logger.error(f"Failed to register turnover analysis routes: {e}")
    import traceback
    traceback.print_exc()

# Transaction analysis routes are registered via portfolio_routes.py

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