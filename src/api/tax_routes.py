from flask import request, jsonify
from datetime import datetime
from .route_utils import sanitize_for_json

def register_tax_routes(app, data_client, smart_cache=None):
    """Register tax analysis routes"""
    
    @app.route('/api/tax-analysis', methods=['POST'])
    def comprehensive_tax_analysis():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            
            data = request.get_json()
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
            
            # Use the advanced transaction analyzer
            analyzer = AdvancedTransactionAnalyzer(data_client)
            tax_result = analyzer.tax_analysis(transactions)
            
            # Also get tax loss harvesting data for additional insights
            tax_harvesting = analyzer.tax_loss_harvesting_analysis(transactions)
            
            # Combine results for comprehensive tax analysis
            comprehensive_result = {
                **tax_result,
                'harvestable_losses': tax_harvesting.get('harvestable_losses', 0),
                'harvest_opportunities': tax_harvesting.get('harvest_opportunities', []),
                'tax_efficiency_ratio': tax_harvesting.get('tax_efficiency_ratio', 0)
            }
            
            return jsonify({
                'success': True,
                'tax_analysis': sanitize_for_json(comprehensive_result)
            })
            
        except Exception as e:
            print(f"Tax analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/wash-sale-analysis', methods=['POST'])
    def wash_sale_analysis():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            
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
            tax_result = analyzer.tax_analysis(transactions)
            
            # Extract wash sale specific data
            wash_sale_result = {
                'wash_sale_adjustments': tax_result.get('wash_sale_adjustments', 0),
                'affected_transactions': [],  # Could be enhanced to show specific transactions
                'tax_impact': tax_result.get('wash_sale_adjustments', 0) * 0.37,  # Estimated tax impact
                'recommendations': []
            }
            
            # Add recommendations if wash sales detected
            if tax_result.get('wash_sale_adjustments', 0) > 0:
                wash_sale_result['recommendations'].append({
                    'type': 'warning',
                    'message': f'Wash sale adjustments of ${tax_result.get("wash_sale_adjustments", 0):,.2f} detected',
                    'suggestion': 'Consider waiting 31 days before repurchasing to avoid wash sale rules'
                })
            
            return jsonify({
                'success': True,
                'wash_sale_analysis': sanitize_for_json(wash_sale_result)
            })
            
        except Exception as e:
            print(f"Wash sale analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/tax-loss-harvesting', methods=['POST'])
    def tax_loss_harvesting():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            
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
            harvesting_result = analyzer.tax_loss_harvesting_analysis(transactions)
            
            return jsonify({
                'success': True,
                'tax_loss_harvesting': sanitize_for_json(harvesting_result)
            })
            
        except Exception as e:
            print(f"Tax loss harvesting error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500