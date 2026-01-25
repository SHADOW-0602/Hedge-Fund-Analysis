import sys
import os
from dotenv import load_dotenv

# Load environment variab
# les
# Trigger Reload
load_dotenv()

# Add src directory to Python path
src_path = os.path.join(os.path.dirname(__file__), 'src')
sys.path.insert(0, src_path)
sys.path.insert(0, os.path.dirname(__file__))

from src.main_app import app
import logging

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)
app.logger.setLevel(logging.DEBUG)

# Add error handler
@app.errorhandler(Exception)
def handle_exception(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return e
    app.logger.error(f"Unhandled exception: {e}")
    import traceback
    traceback.print_exc()
    return {'error': str(e)}, 500

# Configure template and static folders
app.template_folder = os.path.join(os.path.dirname(__file__), 'News', 'templates')
app.static_folder = os.path.join(os.path.dirname(__file__), 'web')
app.static_url_path = ''

# Define config route globally to ensure availability
@app.route('/api/config', methods=['GET'])
def get_config():
    from flask import jsonify
    return jsonify({
        'pexels_api_key': os.getenv('PEXELS_API_KEY', '')
    })

# Import and integrate News app routes directly
try:
    news_path = os.path.join(os.path.dirname(__file__), 'News')
    sys.path.insert(0, news_path)
    
    # Import News app functions
    from News.app_News import (
        get_stock_metrics, get_price_data, get_chart_data_detailed,
        get_news_articles, get_financial_statements, get_trade_ideas,
        get_summary, stock_analysis, get_chart_data, get_market_status,
        get_alpaca_news, debug_apis, cache_status, debug_gemini,
        get_gemini_rotation_status, force_gemini_rotation, debug_chart_apis,
        get_tickers, add_ticker, remove_ticker, get_pexels_image_endpoint,
        get_company_logo, refresh_ticker, get_yahoo_financials,
        collect_financial_data, subscribe_email, unsubscribe_email,
        get_subscriptions
    )
    # Helper to wrap News view functions so they always return a Response-like value
    def _ensure_response(fn):
        def _wrapped(*args, **kwargs):
            try:
                result = fn(*args, **kwargs)
                if result is None:
                    from flask import jsonify
                    return jsonify({'error': 'No response from handler'}), 500
                return result
            except Exception as e:
                from flask import jsonify
                return jsonify({'error': str(e)}), 500
        _wrapped.__name__ = getattr(fn, '__name__', 'wrapped_view')
        return _wrapped
    
    # Register News app routes (avoiding duplicates with main_app.py)
    app.add_url_rule('/api/stock-metrics/<ticker>', 'news_stock_metrics', _ensure_response(get_stock_metrics), methods=['GET'])
    # Swagger documentation for stock-metrics endpoint
    get_stock_metrics.__doc__ = """
    Get Stock Metrics
    ---
    tags:
      - Market Data
    summary: Get comprehensive stock metrics
    description: Retrieves real-time metrics including price, volume, market cap, and technical indicators
    parameters:
      - name: ticker
        in: path
        type: string
        required: true
        description: Stock ticker symbol
    responses:
      200:
        description: Stock metrics retrieved
        schema:
          type: object
      500:
        description: Failed to retrieve metrics
    """
    
    app.add_url_rule('/api/price/<ticker>', 'news_price_data', _ensure_response(get_price_data), methods=['GET'])
    get_price_data.__doc__ = """
    Get Stock Price
    ---
    tags:
      - Market Data
    summary: Get current stock price
    description: Retrieves real-time stock price information
    parameters:
      - name: ticker
        in: path
        type: string
        required: true
        description: Stock ticker symbol
    responses:
      200:
        description: Price data retrieved
      500:
        description: Failed to retrieve price
    """
    
    app.add_url_rule('/api/chart-data/<ticker>', 'news_chart_data', get_chart_data_detailed, methods=['GET'])
    get_chart_data_detailed.__doc__ = """
    Get Chart Data
    ---
    tags:
      - Market Data
    summary: Get detailed chart data for stock
    description: Retrieves historical price data with technical indicators for charting
    parameters:
      - name: ticker
        in: path
        type: string
        required: true
        description: Stock ticker symbol
      - name: period
        in: query
        type: string
        required: false
        default: "1y"
        description: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
    responses:
      200:
        description: Chart data retrieved
        schema:
          type: object
      500:
        description: Failed to retrieve chart data
    """
    
    app.add_url_rule('/api/news/<ticker>', 'news_articles', get_news_articles, methods=['GET'])
    get_news_articles.__doc__ = """
    Get News Articles
    ---
    tags:
      - News
    summary: Get news articles for stock
    description: Retrieves latest news articles and analysis for a specific stock
    parameters:
      - name: ticker
        in: path
        type: string
        required: true
        description: Stock ticker symbol
    responses:
      200:
        description: News articles retrieved
        schema:
          type: array
          items:
            type: object
      500:
        description: Failed to retrieve news
    """
    
    app.add_url_rule('/api/financials/<ticker>', 'news_financials', get_financial_statements, methods=['GET'])
    get_financial_statements.__doc__ = """
    Get Financial Statements
    ---
    tags:
      - Market Data
    summary: Get company financial statements
    description: Retrieves income statement, balance sheet, and cash flow data
    parameters:
      - name: ticker
        in: path
        type: string
        required: true
        description: Stock ticker symbol
    responses:
      200:
        description: Financial statements retrieved
        schema:
          type: object
      500:
        description: Failed to retrieve financials
    """
    
    app.add_url_rule('/api/trade-ideas/<ticker>', 'news_trade_ideas', get_trade_ideas, methods=['GET'])
    get_trade_ideas.__doc__ = """
    Get Trade Ideas
    ---
    tags:
      - News
    summary: Get AI-generated trade ideas
    description: Retrieves AI analysis with trading suggestions and market insights
    parameters:
      - name: ticker
        in: path
        type: string
        required: true
        description: Stock ticker symbol
    responses:
      200:
        description: Trade ideas retrieved
        schema:
          type: object
      500:
        description: Failed to generate trade ideas
    """
    
    app.add_url_rule('/api/summary/<ticker>', 'news_summary', get_summary, methods=['GET'])
    get_summary.__doc__ = """
    Get Stock Summary
    ---
    tags:
      - News
    summary: Get comprehensive stock analysis summary
    description: Retrieves AI-generated comprehensive summary of stock analysis
    parameters:
      - name: ticker
        in: path
        type: string
        required: true
        description: Stock ticker symbol
    responses:
      200:
        description: Summary retrieved
        schema:
          type: object
          properties:
            summary:
              type: string
            date:
              type: string
      500:
        description: Failed to retrieve summary
    """
    
    app.add_url_rule('/stock/<ticker>', 'news_stock_analysis', stock_analysis, methods=['GET'])
    
    # Additional News routes (non-duplicates)
    app.add_url_rule('/api/chart/<ticker>', 'news_chart', get_chart_data, methods=['GET'])
    app.add_url_rule('/api/chart/<ticker>/<period>', 'news_chart_period', get_chart_data, methods=['GET'])
    app.add_url_rule('/api/market-status', 'news_market_status', get_market_status, methods=['GET'])
    app.add_url_rule('/api/alpaca-news/<ticker>', 'news_alpaca_news', get_alpaca_news, methods=['GET'])
    app.add_url_rule('/api/debug/apis', 'news_debug_apis', debug_apis, methods=['GET'])
    app.add_url_rule('/api/debug/gemini', 'news_debug_gemini', debug_gemini, methods=['GET'])
    app.add_url_rule('/api/gemini-rotation-status', 'news_gemini_rotation', get_gemini_rotation_status, methods=['GET'])
    app.add_url_rule('/api/force-gemini-rotation', 'news_force_rotation', force_gemini_rotation, methods=['POST'])
    app.add_url_rule('/api/debug/chart-apis/<ticker>', 'news_debug_chart', debug_chart_apis, methods=['GET'])
    app.add_url_rule('/api/pexels-image', 'news_pexels_image', get_pexels_image_endpoint, methods=['GET'])
    app.add_url_rule('/api/refresh/<ticker>', 'news_refresh', refresh_ticker, methods=['GET', 'POST'])
    app.add_url_rule('/api/yahoo-financials/<ticker>', 'news_yahoo_financials', _ensure_response(get_yahoo_financials), methods=['GET'])
    app.add_url_rule('/api/financials/<ticker>/collect', 'news_collect_financials', collect_financial_data, methods=['GET'])
    app.add_url_rule('/api/unsubscribe', 'news_unsubscribe', unsubscribe_email, methods=['POST'])
    app.add_url_rule('/api/subscriptions', 'news_subscriptions', get_subscriptions, methods=['GET'])
    
    # Add back routes that were removed from main_app.py
    app.add_url_rule('/api/tickers', 'news_tickers_get', get_tickers, methods=['GET'])
    get_tickers.__doc__ = """
    Get Tracked Tickers
    ---
    tags:
      - Market Data
    summary: Get list of tracked tickers
    description: Retrieves all tickers being tracked for analysis
    responses:
      200:
        description: Tickers retrieved
        schema:
          type: array
          items:
            type: string
    """
    
    app.add_url_rule('/api/tickers', 'news_tickers_post', add_ticker, methods=['POST'])
    add_ticker.__doc__ = """
    Add Ticker
    ---
    tags:
      - Market Data
    summary: Add ticker to tracking list
    description: Adds a new ticker symbol for monitoring and analysis
    consumes:
      - application/json
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - ticker
          properties:
            ticker:
              type: string
              example: "AAPL"
    responses:
      200:
        description: Ticker added
      400:
        description: Invalid ticker
    """
    
    app.add_url_rule('/api/tickers/<ticker>', 'news_tickers_delete', remove_ticker, methods=['DELETE'])
    remove_ticker.__doc__ = """
    Remove Ticker
    ---
    tags:
      - Market Data
    summary: Remove ticker from tracking list
    description: Removes a ticker from monitoring
    parameters:
      - name: ticker
        in: path
        type: string
        required: true
        description: Stock ticker to remove
    responses:
      200:
        description: Ticker removed
      404:
        description: Ticker not found
    """
    
    app.add_url_rule('/api/logo/<ticker>', 'news_logo', get_company_logo, methods=['GET'])
    app.add_url_rule('/api/subscribe', 'news_subscribe', subscribe_email, methods=['POST'])
    app.add_url_rule('/api/cache-status', 'news_cache_status', cache_status, methods=['GET'])
    
    # Add missing routes
    @app.route('/api/fetch-logos', methods=['POST'])
    def fetch_missing_logos():
        from flask import jsonify
        try:
            from News.database import db as news_db
            tickers = news_db.get_tickers() or []
            return jsonify({
                'success': True,
                'message': f'Found {len(tickers)} tickers'
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    print("[SUCCESS] News app routes integrated (duplicates avoided)")
except Exception as e:
    import traceback
    print(f"[CRITICAL WARNING] News app integration failed: {e}")
    traceback.print_exc()

# Ensure News templates are accessible
from jinja2 import ChoiceLoader, FileSystemLoader
news_templates = os.path.join(os.path.dirname(__file__), 'News', 'templates')
us_news_templates = os.path.join(os.path.dirname(__file__), 'US_News', 'templates')
web_templates = os.path.join(os.path.dirname(__file__), 'web')

# Register US News Blueprint
try:
    from US_News.app_US import us_news_bp
    app.register_blueprint(us_news_bp)
    print("[SUCCESS] US News Blueprint registered")
except Exception as e:
    print(f"[ERROR] Failed to register US News Blueprint: {e}")
    import traceback
    traceback.print_exc()

# Explicit route for US News static files to avoid routing conflicts
@app.route('/us-news/static/<path:filename>')
def us_news_static_proxy(filename):
    try:
        us_news_static_path = os.path.join(os.path.dirname(__file__), 'US_News', 'static')
        return send_from_directory(us_news_static_path, filename)
    except Exception as e:
        print(f"[ERROR] US News static file error: {e}")
        return '', 404


# Combine the existing loader (if present) with our additional template paths
existing_loader = getattr(app, 'jinja_loader', None)
if existing_loader:
    app.jinja_env.loader = ChoiceLoader([existing_loader, FileSystemLoader([news_templates, us_news_templates, web_templates])])
else:
    app.jinja_env.loader = FileSystemLoader([news_templates, us_news_templates, web_templates])

# Export app for deployment
app = app

# Health check endpoint for Northflank
@app.route('/health')
def health_check():
    """
    System Health Check
    ---
    tags:
      - Health
    summary: Check system health status
    description: Returns system health status for monitoring
    responses:
      200:
        description: System is healthy
        schema:
          type: object
          properties:
            status:
              type: string
              example: "healthy"
            service:
              type: string
              example: "hedge-fund-analysis"
    """
    return {'status': 'healthy', 'service': 'hedge-fund-analysis'}

# Global Security Headers
@app.after_request
def add_security_headers(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response

# Cloudflare Pages compatibility
def application(environ, start_response):
    """WSGI application for Cloudflare Pages"""
    return app(environ, start_response)

if __name__ == '__main__':
    # Flush cache on startup
    try:
        from utils.cache_manager import cache_manager
        print("[STARTUP] Clearing analysis cache...")
        if cache_manager.clear_all():
             print("[STARTUP] Analysis cache cleared successfully")
        else:
             print("[STARTUP] Warning: Failed to clear analysis cache")
    except Exception as e:
        print(f"[STARTUP] Error clearing cache: {e}")

    app.logger.info("Starting Portfolio & Options Analysis Engine")
    port = int(os.environ.get('PORT', 5000))
    # Use 127.0.0.1 for local development (avoids Windows socket permission issues)
    host = '127.0.0.1'
    
    print("\nStarting Portfolio & Options Analysis Engine")
    print(f"Web Interface: http://{host}:{port}")
    print(f"Swagger UI: http://{host}:{port}/docs")
    print(f"API Endpoints: http://{host}:{port}/api")
    print("Press Ctrl+C to stop\n")
    
    app.logger.info(f"Flask app starting on {host}:{port}")
    app.run(
        host=host,
        port=port,
        debug=False,
        threaded=True,
        use_reloader=False
    )
