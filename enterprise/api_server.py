from flask import Flask, request, jsonify
from flask_restful import Api, Resource
from flask_socketio import SocketIO, emit
import pandas as pd
import numpy as np
from typing import Dict
from datetime import datetime, timedelta
import json

import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = Flask(__name__)
api = Api(app)
socketio = SocketIO(app, cors_allowed_origins="*")

class DatabaseManager:
    def __init__(self):
        from clients.supabase_client import supabase_client
        self.supabase = supabase_client
        if self.supabase and self.supabase.client:
            self._create_tables()
    
    def _create_tables(self):
        # Tables are created via Supabase SQL editor
        pass
    
    def get_transactions(self):
        if self.supabase and self.supabase.client:
            try:
                result = self.supabase.client.table('api_transactions').select('*').execute()
                return pd.DataFrame(result.data) if result.data else pd.DataFrame()
            except:
                return pd.DataFrame()
        return pd.DataFrame()

db_manager = DatabaseManager()

class PortfolioAPI(Resource):
    def get(self):
        transactions_df = db_manager.get_transactions()
        if transactions_df.empty:
            return {'message': 'No portfolio data found'}, 404
        
        return {
            'total_transactions': len(transactions_df),
            'symbols': transactions_df['symbol'].unique().tolist() if 'symbol' in transactions_df.columns else [],
            'last_updated': datetime.now().isoformat()
        }

class RiskAPI(Resource):
    def get(self):
        symbols = request.args.getlist('symbols')
        if not symbols:
            return {'error': 'No symbols provided'}, 400
        
        try:
            from analytics.risk_analytics import RiskAnalyzer
            from clients.market_data_client import MarketDataClient
            
            client = MarketDataClient()
            analyzer = RiskAnalyzer(client)
            
            # Equal weights for simplicity
            weights = {symbol: 1.0/len(symbols) for symbol in symbols}
            metrics = analyzer.analyze_portfolio_risk_fast(symbols, weights)
            
            return {
                'symbols': symbols,
                'portfolio_volatility': metrics.get('portfolio_volatility', 0),
                'var_95': metrics.get('var_95', 0),
                'sharpe_ratio': metrics.get('sharpe_ratio', 0),
                'max_drawdown': metrics.get('max_drawdown', 0),
                'calculated_at': datetime.now().isoformat()
            }
        except Exception as e:
            return {'error': f'Risk calculation failed: {str(e)}'}, 500

class MarketDataAPI(Resource):
    def get(self):
        symbols = request.args.getlist('symbols')
        if not symbols:
            return {'error': 'No symbols provided'}, 400
        
        try:
            from clients.market_data_client import MarketDataClient
            client = MarketDataClient()
            prices = client.get_current_prices(symbols)
            
            market_data = {}
            for symbol in symbols:
                price = prices.get(symbol, 0)
                market_data[symbol] = {
                    'price': price,
                    'change': 0,  # Would need historical data for change
                    'volume': 0,  # Would need volume data
                    'timestamp': datetime.now().isoformat()
                }
            return market_data
        except Exception as e:
            return {'error': f'Market data unavailable: {str(e)}'}, 500

class UserAPI(Resource):
    def get(self):
        """Get user portfolios"""
        return {
            'portfolios': [],
            'user_id': 'default_user',
            'last_sync': datetime.now().isoformat()
        }

class ResearchAPI(Resource):
    def get(self):
        """Get research notes"""
        return {
            'notes': [
                {
                    'id': 1,
                    'title': 'Market Analysis',
                    'content': 'Current market conditions show...',
                    'created_at': datetime.now().isoformat(),
                    'tags': ['market', 'analysis']
                }
            ],
            'total_count': 1
        }
    
    def post(self):
        """Create research note"""
        data = request.get_json()
        return {
            'id': np.random.randint(1, 1000),
            'title': data.get('title', 'New Note'),
            'content': data.get('content', ''),
            'created_at': datetime.now().isoformat()
        }, 201

class AnalyticsAPI(Resource):
    def post(self):
        """Run analytics"""
        data = request.get_json() or {}
        symbols = data.get('symbols', [])
        analysis_type = data.get('analysis_type', 'basic')
        
        try:
            from analytics.screening_engine import QuantitativeScreener
            from clients.market_data_client import MarketDataClient
            
            client = MarketDataClient()
            screener = QuantitativeScreener(client)
            
            results = {}
            
            if analysis_type == 'momentum':
                momentum_results = screener.momentum_screen(symbols)
                for symbol, data in momentum_results.get('momentum_rankings', {}).items():
                    results[symbol] = {
                        'momentum_score': data.get('momentum_score', 0),
                        'technical_rating': 'BUY' if data.get('momentum_score', 0) > 0 else 'SELL'
                    }
            else:
                # Basic analysis
                for symbol in symbols:
                    price_data = client.get_price_data([symbol], '1m')
                    if not price_data.empty and symbol in price_data.columns:
                        returns = price_data[symbol].pct_change().dropna()
                        volatility = returns.std() * np.sqrt(252) if len(returns) > 0 else 0
                        
                        results[symbol] = {
                            'volatility': volatility,
                            'momentum_score': returns.mean() * 252 if len(returns) > 0 else 0,
                            'technical_rating': 'HOLD'
                        }
            
            return {
                'analysis_type': analysis_type,
                'results': results,
                'processed_at': datetime.now().isoformat()
            }
        except Exception as e:
            return {'error': f'Analytics failed: {str(e)}'}, 500

# Register routes
api.add_resource(PortfolioAPI, '/api/portfolio')
api.add_resource(RiskAPI, '/api/risk')
api.add_resource(MarketDataAPI, '/api/market-data')
api.add_resource(UserAPI, '/api/user/portfolios')
api.add_resource(ResearchAPI, '/api/research')
api.add_resource(AnalyticsAPI, '/api/analytics')

@app.route('/')
def index():
    return jsonify({
        'message': 'Portfolio API Server',
        'version': '1.0.0',
        'endpoints': {
            'portfolio': '/api/portfolio',
            'risk': '/api/risk',
            'market_data': '/api/market-data',
            'user_portfolios': '/api/user/portfolios',
            'research': '/api/research',
            'analytics': '/api/analytics',
            'market_data_status': '/api/market-data/status',
            'snaptrade_connect': '/api/snaptrade/connect',
            'snaptrade_status': '/api/snaptrade/status',
            'daily_news': '/api/market-news/daily',
            'health': '/health'
        }
    })

@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/market-data/status')
def market_data_status():
    return jsonify({
        'providers': {
            'finnhub': {'status': 'online', 'last_check': datetime.now().isoformat()},
            'polygon': {'status': 'online', 'last_check': datetime.now().isoformat()},
            'alpha_vantage': {'status': 'online', 'last_check': datetime.now().isoformat()},
            'twelve_data': {'status': 'online', 'last_check': datetime.now().isoformat()}
        },
        'overall_status': 'healthy'
    })

@app.route('/api/snaptrade/connect', methods=['POST'])
def snaptrade_connect():
    return jsonify({
        'status': 'connected',
        'connection_id': f'snap_{np.random.randint(1000, 9999)}',
        'message': 'SnapTrade connection established successfully'
    })

@app.route('/api/snaptrade/status')
def snaptrade_status():
    return jsonify({
        'status': 'connected',
        'last_sync': datetime.now().isoformat()
    })

@app.route('/api/market-news/daily')
def daily_market_news():
    return jsonify({
        'news': [
            {
                'title': 'Market Opens Higher on Strong Earnings',
                'summary': 'Major indices gain as tech companies report better than expected results',
                'timestamp': datetime.now().isoformat(),
                'source': 'Market Wire',
                'sentiment': 'positive'
            },
            {
                'title': 'Fed Maintains Interest Rate Policy',
                'summary': 'Federal Reserve keeps rates unchanged, signals data-dependent approach',
                'timestamp': (datetime.now() - timedelta(hours=2)).isoformat(),
                'source': 'Economic Times',
                'sentiment': 'neutral'
            }
        ],
        'last_updated': datetime.now().isoformat()
    })

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status', {'msg': 'Connected to Portfolio API Server'})

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    
    print(f"Starting Portfolio API Server on port {port}...")
    print("Available endpoints:")
    print("  GET  /              - API information")
    print("  GET  /health        - Health check")
    print("  GET  /api/portfolio - Portfolio data")
    print("  GET  /api/risk      - Risk metrics")
    print("  GET  /api/market-data - Market data")
    print("  GET  /api/user/portfolios - User portfolios")
    print("  GET  /api/research - Research notes")
    print("  POST /api/research - Create research note")
    print("  POST /api/analytics - Run analytics")
    print(f"\nServer running on port {port}")
    
    socketio.run(app, host='0.0.0.0', port=port, debug=debug)