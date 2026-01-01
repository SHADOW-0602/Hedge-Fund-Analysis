from flask import request, jsonify
from datetime import datetime
from .route_utils import sanitize_for_json
from utils.cache_manager import cache_manager

def register_drawdown_routes(app, data_client, smart_cache=None):
    """Register drawdown analysis routes"""
    
    @app.route('/api/drawdown-analysis', methods=['POST'])
    def comprehensive_drawdown_analysis():
        try:
            print("[DEBUG] Drawdown analysis route called")
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            from utils.date_parser import UniversalDateParser
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            # Check cache
            cache_key = cache_manager.generate_key('drawdown-analysis', data)
            cached_result = cache_manager.get(cache_key)
            if cached_result:
                return jsonify(cached_result)

            print(f"[DEBUG] Received {len(transactions_data)} transactions, options: {options}")
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
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
                except Exception:
                    continue
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Extract options
            period = options.get('period', '1Y')
            frequency = options.get('frequency', 'Daily')
            severity_filter = options.get('severity_filter', options.get('severity', 'All'))
            comparison = options.get('comparison', 'None')
            
            # Use the advanced transaction analyzer
            print(f"[DEBUG] Creating analyzer with {len(transactions)} transactions")
            analyzer = AdvancedTransactionAnalyzer(data_client)
            print(f"[DEBUG] Running drawdown analysis with period={period}, frequency={frequency}")
            drawdown_result = analyzer.drawdown_analysis(
                transactions, period=period, frequency=frequency, 
                severity_filter=severity_filter, comparison=comparison
            )
            print(f"[DEBUG] Drawdown analysis complete, result keys: {list(drawdown_result.keys()) if drawdown_result else 'None'}")
            
            sanitized_result = sanitize_for_json(drawdown_result)
            print(f"[DEBUG] Returning sanitized result with keys: {list(sanitized_result.keys()) if sanitized_result else 'None'}")
            
            response_data = {
                'success': True,
                'drawdown_analysis': sanitized_result
            }
            cache_manager.set(cache_key, response_data)

            return jsonify(response_data)
            
        except Exception as e:
            print(f"Drawdown analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/portfolio-drawdown', methods=['POST'])
    def portfolio_drawdown():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            
            # Check cache
            cache_key = cache_manager.generate_key('portfolio-drawdown', data)
            cached_result = cache_manager.get(cache_key)
            if cached_result:
                return jsonify(cached_result)
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            # Convert to Transaction objects
            transactions = []
            for tx_data in transactions_data:
                try:
                    date_str = tx_data.get('date', '')
                    if isinstance(date_str, str) and date_str.strip():
                        if 'T' in date_str:
                            date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        else:
                            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                    else:
                        date_obj = datetime.now()
                    
                    transaction = Transaction(
                        symbol=tx_data.get('symbol', ''),
                        quantity=float(tx_data.get('quantity', 0)),
                        price=float(tx_data.get('price', 0)),
                        date=date_obj,
                        transaction_type=tx_data.get('transaction_type', 'BUY'),
                        fees=float(tx_data.get('fees', 0))
                    )
                    transactions.append(transaction)
                except Exception:
                    continue
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            analyzer = AdvancedTransactionAnalyzer(data_client)
            drawdown_result = analyzer.drawdown_analysis(transactions)
            
            # Format for portfolio drawdown display
            portfolio_drawdown = {
                'max_drawdown_pct': drawdown_result.get('max_drawdown_pct', 0),
                'avg_drawdown_pct': drawdown_result.get('avg_drawdown_pct', 0),
                'current_drawdown_pct': drawdown_result.get('current_drawdown_pct', 0),
                'recovery_days': drawdown_result.get('recovery_days', 0),
                'drawdown_periods': drawdown_result.get('drawdown_periods', 0),
                'time_in_drawdown_pct': drawdown_result.get('time_in_drawdown_pct', 0),
                'frequency': drawdown_result.get('frequency', 'Daily')
            }
            
            response_data = {
                'success': True,
                'portfolio_drawdown': sanitize_for_json(portfolio_drawdown)
            }
            cache_manager.set(cache_key, response_data)
            
            return jsonify(response_data)
            
        except Exception as e:
            print(f"Portfolio drawdown error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500