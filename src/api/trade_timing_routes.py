from flask import request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from .route_utils import sanitize_for_json
from utils.cache_manager import cache_manager

def register_trade_timing_routes(app, data_client, smart_cache=None):
    """Register trade timing analysis routes"""
    
    @app.route('/api/trade-timing-analysis', methods=['POST'])
    def trade_timing_analysis_route():
        try:
            from analytics.trade_timing_analyzer import TradeTimingAnalyzer
            from core.transactions import Transaction
            from utils.date_parser import UniversalDateParser
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})

            # Check cache
            cache_key = cache_manager.generate_key('trade-timing', data)
            cached_result = cache_manager.get(cache_key)
            if cached_result:
                return jsonify(cached_result)
            
            print(f"[TRADE-TIMING] Received {len(transactions_data)} transactions, options: {options}")
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transactions provided'}), 400
            
            # Convert to Transaction objects
            transactions = []
            for tx_data in transactions_data:
                try:
                    date_obj = UniversalDateParser.parse_date(tx_data.get('date', ''))
                    
                    transaction = Transaction(
                        symbol=tx_data.get('symbol', ''),
                        quantity=float(tx_data.get('quantity', 0)),
                        price=float(tx_data.get('price', 0)),
                        date=date_obj,
                        transaction_type=tx_data.get('transaction_type', 'BUY'),
                        fees=float(tx_data.get('fees', 0))
                    )
                    transactions.append(transaction)
                except Exception as e:
                    print(f"[TRADE-TIMING] Failed to parse transaction: {e}")
                    continue
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Extract options
            period = options.get('period', '1Y')
            time_buckets = options.get('timeBuckets', 'All')
            day_analysis = options.get('dayAnalysis', 'All')
            market_conditions = options.get('marketConditions', 'All')
            performance_view = options.get('performanceView', 'Combined')
            
            print(f"[TRADE-TIMING] Analysis options: period={period}, buckets={time_buckets}, days={day_analysis}")
            
            analyzer = TradeTimingAnalyzer(data_client)
            timing_result = analyzer.analyze_trade_timing(
                transactions,
                period=period,
                time_buckets=time_buckets,
                day_analysis=day_analysis,
                market_conditions=market_conditions,
                performance_view=performance_view
            )
            
            print(f"[TRADE-TIMING] Analysis complete: {len(timing_result.get('time_bucket_performance', {}))} time buckets analyzed")
            
            response_data = {
                'success': True,
                'trade_timing_analysis': sanitize_for_json(timing_result)
            }
            cache_manager.set(cache_key, response_data)
            
            return jsonify(response_data)
            
        except Exception as e:
            print(f'Trade timing analysis failed: {e}')
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500