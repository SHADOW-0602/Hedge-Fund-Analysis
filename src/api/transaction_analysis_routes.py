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
                    try:
                        date_str = tx_data.get('date', '')
                        date_obj = UniversalDateParser.parse_date(date_str)
                    except Exception as e:
                        print(f"[CASH-FLOW-ROUTE] Date parse warning: {e}, using now()")
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
    
    @app.route('/api/fifo-lifo-accounting', methods=['POST'])
    def fifo_lifo_accounting():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            from utils.date_parser import UniversalDateParser
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            print(f"[FIFO-LIFO] Received {len(transactions_data)} transactions, options: {options}")
            
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
                    print(f"[FIFO-LIFO] Failed to parse transaction: {e}")
                    continue
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Extract options with proper mapping
            accounting_method = options.get('accountingMethod', 'FIFO')
            accounting_period = options.get('accountingPeriod', '1Y')
            tax_impact = options.get('accountingTaxImpact', 'Current rates')
            comparison = options.get('accountingComparison', 'None')
            

            
            print(f"[FIFO-LIFO] Using method: {accounting_method}, period: {accounting_period}")
            print(f"[FIFO-LIFO] Processing {len(transactions)} transactions")
            
            analyzer = AdvancedTransactionAnalyzer(data_client)
            
            # Use the accounting method analysis
            analysis_options = {
                'method': accounting_method,
                'period': accounting_period,
                'tax_impact': tax_impact,
                'comparison': comparison
            }
            
            print(f"[FIFO-LIFO] Calling accounting_method_analysis with options: {analysis_options}")
            fifo_lifo_result = analyzer.accounting_method_analysis(transactions, analysis_options)
            print(f"[FIFO-LIFO] Analysis result keys: {list(fifo_lifo_result.keys()) if fifo_lifo_result else 'None'}")
            print(f"[FIFO-LIFO] Analysis result: {fifo_lifo_result}")
            
            # Check if result is empty or malformed
            if not fifo_lifo_result:
                print(f"[FIFO-LIFO] WARNING: Empty result from accounting_method_analysis")
                return jsonify({'success': False, 'error': 'No analysis data generated'}), 500
            
            # Ensure we have the expected structure
            if 'primary_method' not in fifo_lifo_result and 'comparison_summary' not in fifo_lifo_result:
                print(f"[FIFO-LIFO] WARNING: Unexpected result structure: {fifo_lifo_result}")
                # Try to wrap the result in primary_method if it looks like raw method data
                if 'method' in fifo_lifo_result or 'realized_pnl' in fifo_lifo_result:
                    fifo_lifo_result = {'primary_method': fifo_lifo_result}
                    print(f"[FIFO-LIFO] Wrapped result in primary_method: {fifo_lifo_result}")
            
            sanitized_result = sanitize_for_json(fifo_lifo_result)
            print(f"[FIFO-LIFO] Sanitized result: {sanitized_result}")
            
            return jsonify({
                'success': True,
                'fifo_lifo_analysis': sanitized_result
            })
            
        except Exception as e:
            print(f'[FIFO-LIFO] Analysis failed: {e}')
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/tax-optimization', methods=['POST'])
    def tax_optimization():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            from utils.date_parser import UniversalDateParser
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            
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
                    print(f"[TAX-OPT] Failed to parse transaction: {e}")
                    continue
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            analyzer = AdvancedTransactionAnalyzer(data_client)
            
            # Compare all methods to find optimal
            methods = ['FIFO', 'LIFO', 'SPECIFIC_ID', 'AVERAGE_COST']
            method_results = []
            
            for method in methods:
                result = analyzer.accounting_method_analysis(transactions, {
                    'method': method,
                    'period': 'ITD',
                    'tax_impact': 'Current rates',
                    'comparison': 'None'
                })
                
                primary = result.get('primary_method', {})
                method_results.append({
                    'method': method,
                    'tax_liability': primary.get('tax_liability', 0)
                })
            
            # Find optimal method (lowest tax)
            optimal = min(method_results, key=lambda x: x['tax_liability'])
            worst = max(method_results, key=lambda x: x['tax_liability'])
            
            potential_savings = worst['tax_liability'] - optimal['tax_liability']
            
            # Generate recommendations
            recommendations = [
                f"Switch to {optimal['method']} accounting method for optimal tax efficiency",
                "Consider harvesting tax losses before year-end",
                "Review holding periods to maximize long-term capital gains treatment"
            ]
            
            if potential_savings > 1000:
                recommendations.append(f"Potential tax savings of ${potential_savings:,.0f} available")
            
            return jsonify({
                'success': True,
                'tax_optimization': {
                    'optimal_method': optimal['method'],
                    'potential_savings': potential_savings,
                    'recommendations': recommendations,
                    'method_comparison': method_results
                }
            })
            
        except Exception as e:
            print(f'Tax optimization failed: {e}')
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

