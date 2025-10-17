from flask import Flask, request, jsonify
from flask_restful import Api, Resource
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime
import json
import sqlite3
import redis
from concurrent.futures import ThreadPoolExecutor
import asyncio

app = Flask(__name__)
api = Api(app)

class DatabaseManager:
    def __init__(self, db_type: str = "sqlite"):
        self.db_type = db_type
        self.connection = None
        self._initialize_connection()
    
    def _initialize_connection(self):
        """Initialize database connection"""
        if self.db_type == "sqlite":
            self.connection = sqlite3.connect('hedge_fund.db', check_same_thread=False)
            self._create_tables()
        # Add support for PostgreSQL, MySQL, etc.
    
    def _create_tables(self):
        """Create necessary database tables"""
        cursor = self.connection.cursor()
        
        # Transactions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY,
                symbol TEXT,
                quantity REAL,
                price REAL,
                date TEXT,
                transaction_type TEXT,
                fees REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Portfolio snapshots table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id INTEGER PRIMARY KEY,
                snapshot_date TEXT,
                portfolio_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Audit trail table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_trail (
                id INTEGER PRIMARY KEY,
                timestamp TEXT,
                event_type TEXT,
                user_id TEXT,
                details TEXT,
                ip_address TEXT,
                session_id TEXT
            )
        ''')
        
        self.connection.commit()
    
    def insert_transaction(self, transaction_data: Dict):
        """Insert transaction into database"""
        cursor = self.connection.cursor()
        cursor.execute('''
            INSERT INTO transactions (symbol, quantity, price, date, transaction_type, fees)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            transaction_data['symbol'],
            transaction_data['quantity'],
            transaction_data['price'],
            transaction_data['date'],
            transaction_data['transaction_type'],
            transaction_data['fees']
        ))
        self.connection.commit()
        return cursor.lastrowid
    
    def get_transactions(self, symbol: str = None, start_date: str = None, end_date: str = None) -> pd.DataFrame:
        """Retrieve transactions with optional filters"""
        query = "SELECT * FROM transactions WHERE 1=1"
        params = []
        
        if symbol:
            query += " AND symbol = ?"
            params.append(symbol)
        
        if start_date:
            query += " AND date >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND date <= ?"
            params.append(end_date)
        
        return pd.read_sql_query(query, self.connection, params=params)

class CacheManager:
    def __init__(self, cache_type: str = "memory"):
        self.cache_type = cache_type
        self.memory_cache = {}
        
        if cache_type == "redis":
            try:
                self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
            except:
                self.cache_type = "memory"  # Fallback to memory cache
    
    def get(self, key: str):
        """Get value from cache"""
        if self.cache_type == "redis":
            try:
                value = self.redis_client.get(key)
                return json.loads(value) if value else None
            except:
                pass
        
        return self.memory_cache.get(key)
    
    def set(self, key: str, value, expiry: int = 300):
        """Set value in cache with expiry"""
        if self.cache_type == "redis":
            try:
                self.redis_client.setex(key, expiry, json.dumps(value, default=str))
                return
            except:
                pass
        
        self.memory_cache[key] = value
    
    def delete(self, key: str):
        """Delete value from cache"""
        if self.cache_type == "redis":
            try:
                self.redis_client.delete(key)
                return
            except:
                pass
        
        self.memory_cache.pop(key, None)

# Initialize managers
db_manager = DatabaseManager()
cache_manager = CacheManager()

class PortfolioAPI(Resource):
    def get(self):
        """Get portfolio data"""
        # Check cache first
        cached_data = cache_manager.get("portfolio_data")
        if cached_data:
            return cached_data
        
        # Fetch from database
        transactions_df = db_manager.get_transactions()
        
        if transactions_df.empty:
            return {'message': 'No portfolio data found'}, 404
        
        # Calculate portfolio metrics (simplified)
        portfolio_data = {
            'total_transactions': len(transactions_df),
            'symbols': transactions_df['symbol'].unique().tolist(),
            'total_volume': transactions_df['quantity'].sum(),
            'last_updated': datetime.now().isoformat()
        }
        
        # Cache the result
        cache_manager.set("portfolio_data", portfolio_data)
        
        return portfolio_data
    
    def post(self):
        """Add new transaction"""
        data = request.get_json()
        
        required_fields = ['symbol', 'quantity', 'price', 'date', 'transaction_type']
        if not all(field in data for field in required_fields):
            return {'error': 'Missing required fields'}, 400
        
        # Insert transaction
        transaction_id = db_manager.insert_transaction(data)
        
        # Clear cache
        cache_manager.delete("portfolio_data")
        
        return {'transaction_id': transaction_id, 'status': 'success'}, 201

class RiskAPI(Resource):
    def get(self):
        """Get risk metrics"""
        symbols = request.args.getlist('symbols')
        
        if not symbols:
            return {'error': 'No symbols provided'}, 400
        
        # Check cache
        cache_key = f"risk_metrics_{'-'.join(symbols)}"
        cached_data = cache_manager.get(cache_key)
        if cached_data:
            return cached_data
        
        # Calculate risk metrics (simplified)
        risk_data = {
            'symbols': symbols,
            'portfolio_volatility': 0.15,  # Placeholder
            'var_5': -0.025,
            'sharpe_ratio': 1.2,
            'max_drawdown': -0.08,
            'calculated_at': datetime.now().isoformat()
        }
        
        # Cache the result
        cache_manager.set(cache_key, risk_data)
        
        return risk_data

class MarketDataAPI(Resource):
    def get(self):
        """Get real-time market data"""
        symbols = request.args.getlist('symbols')
        
        if not symbols:
            return {'error': 'No symbols provided'}, 400
        
        # Simulate real-time data (would integrate with actual data providers)
        market_data = {}
        
        for symbol in symbols:
            market_data[symbol] = {
                'price': np.random.uniform(100, 200),
                'change': np.random.uniform(-5, 5),
                'volume': np.random.randint(1000000, 10000000),
                'timestamp': datetime.now().isoformat()
            }
        
        return market_data

class AnalyticsAPI(Resource):
    def post(self):
        """Run analytics on portfolio"""
        data = request.get_json()
        analysis_type = data.get('analysis_type', 'basic')
        symbols = data.get('symbols', [])
        
        if not symbols:
            return {'error': 'No symbols provided'}, 400
        
        # Run analysis asynchronously for large portfolios
        if len(symbols) > 10:
            # Use thread pool for concurrent processing
            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = [executor.submit(self._analyze_symbol, symbol) for symbol in symbols]
                results = [future.result() for future in futures]
        else:
            results = [self._analyze_symbol(symbol) for symbol in symbols]
        
        return {
            'analysis_type': analysis_type,
            'results': dict(zip(symbols, results)),
            'processed_at': datetime.now().isoformat()
        }
    
    def _analyze_symbol(self, symbol: str) -> Dict:
        """Analyze individual symbol"""
        # Simulate analysis (would use actual analytics modules)
        return {
            'momentum_score': np.random.uniform(-1, 1),
            'volatility': np.random.uniform(0.1, 0.5),
            'technical_rating': np.random.choice(['BUY', 'HOLD', 'SELL'])
        }

class ComplianceAPI(Resource):
    def get(self):
        """Get compliance status"""
        # Check compliance breaches
        compliance_status = {
            'status': 'COMPLIANT',
            'breaches': [],
            'last_check': datetime.now().isoformat(),
            'next_report_due': (datetime.now() + pd.Timedelta(days=30)).isoformat()
        }
        
        return compliance_status
    
    def post(self):
        """Generate compliance report"""
        data = request.get_json()
        report_type = data.get('report_type', 'MONTHLY')
        
        # Generate report (would use compliance module)
        report = {
            'report_id': f"RPT_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            'report_type': report_type,
            'status': 'GENERATED',
            'generated_at': datetime.now().isoformat()
        }
        
        return report, 201

# Register API endpoints
api.add_resource(PortfolioAPI, '/api/portfolio')
api.add_resource(RiskAPI, '/api/risk')
api.add_resource(MarketDataAPI, '/api/market-data')
api.add_resource(AnalyticsAPI, '/api/analytics')
api.add_resource(ComplianceAPI, '/api/compliance')

# Health check endpoint
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

# WebSocket support for real-time data
from flask_socketio import SocketIO, emit
import threading
import time

socketio = SocketIO(app, cors_allowed_origins="*")

class RealTimeDataStreamer:
    def __init__(self):
        self.active_subscriptions = set()
        self.streaming = False
    
    def start_streaming(self):
        """Start real-time data streaming"""
        if not self.streaming:
            self.streaming = True
            thread = threading.Thread(target=self._stream_data)
            thread.daemon = True
            thread.start()
    
    def _stream_data(self):
        """Stream real-time market data"""
        while self.streaming:
            if self.active_subscriptions:
                # Generate mock real-time data
                for symbol in self.active_subscriptions:
                    data = {
                        'symbol': symbol,
                        'price': np.random.uniform(100, 200),
                        'change': np.random.uniform(-2, 2),
                        'timestamp': datetime.now().isoformat()
                    }
                    socketio.emit('market_data', data)
            
            time.sleep(1)  # Update every second
    
    def subscribe(self, symbol: str):
        """Subscribe to real-time data for symbol"""
        self.active_subscriptions.add(symbol)
        if not self.streaming:
            self.start_streaming()
    
    def unsubscribe(self, symbol: str):
        """Unsubscribe from real-time data"""
        self.active_subscriptions.discard(symbol)

streamer = RealTimeDataStreamer()

@socketio.on('subscribe')
def handle_subscribe(data):
    """Handle real-time data subscription"""
    symbol = data.get('symbol')
    if symbol:
        streamer.subscribe(symbol)
        emit('subscribed', {'symbol': symbol})

@socketio.on('unsubscribe')
def handle_unsubscribe(data):
    """Handle real-time data unsubscription"""
    symbol = data.get('symbol')
    if symbol:
        streamer.unsubscribe(symbol)
        emit('unsubscribed', {'symbol': symbol})

if __name__ == '__main__':
    # Run the API server
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)