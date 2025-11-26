from flask import request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from .route_utils import sanitize_for_json

def register_transaction_analysis_routes(app, data_client, smart_cache=None):
    """Register transaction analysis routes"""
    
    @app.route('/api/cash-flow-analysis', methods=['POST'])
    def cash_flow_analysis_route():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            from utils.date_parser import UniversalDateParser
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            print(f"[CASH-FLOW-ROUTE] Received {len(transactions_data)} transactions, options: {options}")
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transactions provided'}), 400
            
            # Convert to Transaction objects
            transactions = []
            for i, tx_data in enumerate(transactions_data):
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
                        transaction_type=tx_data.get('transaction_type', '').upper(),
                        fees=float(tx_data.get('fees', 0))
                    )
                    transactions.append(transaction)
                    print(f"[CASH-FLOW-ROUTE] Transaction {i+1}: {transaction.symbol} {transaction.transaction_type} {transaction.quantity} @ ${transaction.price} on {transaction.date}")
                except Exception as e:
                    print(f"[CASH-FLOW-ROUTE] Failed to parse transaction {i+1}: {e}")
                    continue
            
            print(f"[CASH-FLOW-ROUTE] Successfully parsed {len(transactions)} transactions")
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Run cash flow analysis with options
            analyzer = AdvancedTransactionAnalyzer(data_client)
            cash_flow_data = analyzer.cash_flow_analysis(
                transactions,
                period=options.get('period', '1Y'),
                flow_type=options.get('flow_type', 'Net'),
                frequency=options.get('frequency', 'Daily'),
                smoothing=options.get('smoothing', 'None'),
                benchmark=options.get('benchmark', 'Cash yield')
            )
            
            print(f"[CASH-FLOW-ROUTE] Analysis complete, returning data with {len(cash_flow_data.get('chart_data', []))} chart points")
            
            return jsonify({
                'success': True,
                'cash_flow_analysis': sanitize_for_json(cash_flow_data)
            })
            
        except Exception as e:
            print(f'Cash flow analysis failed: {e}')
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500
    
    # /api/return-attribution removed - superseded by /api/pnl-attribution in pnl_attribution_routes.py
    @app.route('/api/trade-performance', methods=['POST'])
    def trade_performance():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            from utils.date_parser import UniversalDateParser
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            print(f"[TRADE-PERFORMANCE] Received {len(transactions_data)} transactions")
            if transactions_data:
                print(f"[TRADE-PERFORMANCE] Sample transaction: {transactions_data[0]}")
                print(f"[TRADE-PERFORMANCE] All symbols: {list(set([t.get('symbol', 'N/A') for t in transactions_data]))}")
                print(f"[TRADE-PERFORMANCE] Transaction types: {list(set([t.get('transaction_type', 'N/A') for t in transactions_data]))}")
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            # Convert to Transaction objects for AdvancedTransactionAnalyzer
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
                    print(f"[TRADE-PERFORMANCE] Error converting transaction: {e}")
                    continue
            
            print(f"[TRADE-PERFORMANCE] Converted {len(transactions)} valid transactions")
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Use AdvancedTransactionAnalyzer for real data processing
            analyzer = AdvancedTransactionAnalyzer(data_client)
            performance_result = analyzer.trade_performance_analysis(transactions)
            
            print(f"[TRADE-PERFORMANCE] Analysis complete: {performance_result.get('total_trades', 0)} trades processed")
            
            return jsonify({
                'success': True,
                'trade_performance': sanitize_for_json(performance_result)
            })
            
            # Options are handled by the analyzer internally
            
        except Exception as e:
            print(f'Trade Performance error: {e}')
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500
    

