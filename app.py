import sys
import os
from dotenv import load_dotenv

# Load environment variables
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
    app.add_url_rule('/api/price/<ticker>', 'news_price_data', _ensure_response(get_price_data), methods=['GET'])
    app.add_url_rule('/api/chart-data/<ticker>', 'news_chart_data', get_chart_data_detailed, methods=['GET'])
    app.add_url_rule('/api/news/<ticker>', 'news_articles', get_news_articles, methods=['GET'])
    app.add_url_rule('/api/financials/<ticker>', 'news_financials', get_financial_statements, methods=['GET'])
    app.add_url_rule('/api/trade-ideas/<ticker>', 'news_trade_ideas', get_trade_ideas, methods=['GET'])
    app.add_url_rule('/api/summary/<ticker>', 'news_summary', get_summary, methods=['GET'])
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
    app.add_url_rule('/api/tickers', 'news_tickers_post', add_ticker, methods=['POST'])
    app.add_url_rule('/api/tickers/<ticker>', 'news_tickers_delete', remove_ticker, methods=['DELETE'])
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
web_templates = os.path.join(os.path.dirname(__file__), 'web')
# Combine the existing loader (if present) with our additional template paths
existing_loader = getattr(app, 'jinja_loader', None)
if existing_loader:
    app.jinja_env.loader = ChoiceLoader([existing_loader, FileSystemLoader([news_templates, web_templates])])
else:
    app.jinja_env.loader = FileSystemLoader([news_templates, web_templates])

# Export app for deployment
app = app

# Root route - remove override, let main_app.py handle it

# Health check endpoint for Northflank
@app.route('/health')
def health_check():
    return {'status': 'healthy', 'service': 'hedge-fund-analysis'}

# Cloudflare Pages compatibility
def application(environ, start_response):
    """WSGI application for Cloudflare Pages"""
    return app(environ, start_response)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    host = '0.0.0.0' if os.environ.get('FLASK_ENV') == 'production' else '127.0.0.1'
    
    print("\n=== Portfolio & Options Analysis Engine ===")
    print(f"Starting server on {host}:{port}")
    print("Press Ctrl+C to stop\n")
    
    app.run(
        host=host,
        port=port,
        debug=True,
        threaded=True,
        use_reloader=False
    )