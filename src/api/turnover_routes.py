from flask import request, jsonify
from datetime import datetime
from .route_utils import sanitize_for_json

def register_turnover_routes(app, data_client, smart_cache=None):
    """Register turnover analysis routes"""
    
    @app.route('/api/turnover-analysis', methods=['POST'])
    def turnover_analysis():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No data provided'}), 400
            
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            # Convert to Transaction objects
            transactions = []
            for tx_data in transactions_data:
                try:
                    date_str = tx_data.get('date', '')
                    if isinstance(date_str, str) and date_str.strip():
                        if 'GMT' in date_str:
                            date_obj = datetime.strptime(date_str, '%a, %d %b %Y %H:%M:%S GMT')
                        elif 'T' in date_str:
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
                except Exception as e:
                    print(f"Failed to process transaction: {e}")
                    continue
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Initialize analyzer
            analyzer = AdvancedTransactionAnalyzer(data_client)
            
            # Run turnover analysis with options
            result = analyzer.turnover_analysis(
                transactions=transactions,
                period=options.get('period', '1Y'),
                frequency=options.get('frequency', 'Daily'),
                benchmark=options.get('benchmark', 'Mutual Fund avg'),
                trend_window=options.get('trend', '30d'),
                calculation=options.get('calculation', 'Buy+Sell'),
                start_date=options.get('start_date'),
                end_date=options.get('end_date')
            )
            
            return jsonify({
                'success': True,
                'turnover_analysis': sanitize_for_json(result)
            })
            
        except Exception as e:
            print(f"Turnover Analysis error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500