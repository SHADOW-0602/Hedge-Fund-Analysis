from flask import request, jsonify
from analytics.return_attribution import ReturnAttributor
from core.transactions import Transaction, TransactionPortfolio
from datetime import datetime, timedelta
from .route_utils import sanitize_for_json

def register_return_attribution_routes(app, data_client, smart_cache=None):
    """Register Return Attribution API routes"""
    
    @app.route('/api/return-attribution', methods=['POST'])
    def return_attribution():
        try:
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No data provided'}), 400
            
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transactions provided'}), 400
            
            # Parse options with all supported parameters
            period = options.get('period', '1Y')
            attribution_types = options.get('attribution', ['Asset Allocation', 'Security Selection', 'Timing'])
            benchmark = options.get('benchmark', 'Index')
            frequency = options.get('frequency', 'Daily')
            currency = options.get('currency', 'Local')
            attribution_model = options.get('attribution_model', 'brinson')
            
            # Map period to YFinance format
            period_mapping = {
                '1M': '1mo',
                '3M': '3mo', 
                '6M': '6mo',
                '1Y': '1y',
                'YTD': 'ytd',
                'ITD': 'max'  # Use max for inception-to-date
            }
            yf_period = period_mapping.get(period, '1y')
            
            # Convert transactions
            transactions = []
            print(f"Processing {len(transactions_data)} transactions for return attribution")
            
            for i, tx_data in enumerate(transactions_data):
                try:
                    print(f"Processing transaction {i+1}: {tx_data}")
                    
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
                    print(f"Successfully created transaction: {transaction.symbol} {transaction.quantity} @ {transaction.price}")
                except Exception as e:
                    print(f"Error processing transaction {i+1}: {e}")
                    continue
            
            if not transactions:
                print(f"No valid transactions created from {len(transactions_data)} input transactions")
                return jsonify({'success': False, 'error': 'No valid transactions'}), 400
            
            print(f"Successfully created {len(transactions)} valid transactions from {len(transactions_data)} input transactions")
            
            # Create portfolio and get positions
            portfolio = TransactionPortfolio(transactions)
            positions = portfolio.get_current_positions()
            cost_basis = portfolio.get_cost_basis()
            
            print(f"Portfolio analysis: {len(transactions)} transactions -> {len(positions)} positions")
            print(f"Current positions: {positions}")
            print(f"Cost basis: {cost_basis}")
            
            if not positions:
                print("No current positions found - this may be why return attribution shows no data")
                return jsonify({'success': False, 'error': 'No current positions'}), 400
            
            # Extract symbols and weights
            symbols = list(positions.keys())
            total_value = sum(positions[symbol] * cost_basis.get(symbol, 0) for symbol in symbols)
            weights = {symbol: (positions[symbol] * cost_basis.get(symbol, 0)) / total_value 
                      for symbol in symbols if total_value > 0}
            
            print(f"Symbols for analysis: {symbols}")
            print(f"Total portfolio value: {total_value}")
            print(f"Position weights: {weights}")
            
            # Direct benchmark symbol mapping
            benchmark_symbol = benchmark if benchmark in ['SPY', 'QQQ', 'IWM', 'VTI'] else 'SPY'
            
            # Initialize return attributor
            attributor = ReturnAttributor(data_client, benchmark_symbol)
            
            # Log debug info
            print(f"Return attribution calculation: period={yf_period}, symbols={symbols}, benchmark={benchmark_symbol}")
            print(f"Attribution parameters: model={attribution_model}, currency={currency}, frequency={frequency}")
            
            # Calculate return attribution
            attribution_result = attributor.transaction_based_attribution(
                symbols=symbols,
                weights=weights,
                period=yf_period,
                attribution_model=attribution_model,
                benchmark=benchmark_symbol,
                currency=currency,
                frequency=frequency.lower(),
                attribution_types=attribution_types
            )
            
            print(f"Attribution calculation completed. Result: {attribution_result}")
            
            # Format response with all requested features
            response = {
                'success': True,
                'return_attribution': {
                    'portfolio_return': attribution_result.get('portfolio_return'),
                    'benchmark_return': attribution_result.get('benchmark_return'),
                    'active_return': attribution_result.get('active_return'),
                    'market_timing': attribution_result.get('market_timing'),
                    'attribution_effects': {
                        'asset_allocation': attribution_result.get('asset_allocation'),
                        'security_selection': attribution_result.get('security_selection'),
                        'timing_effect': attribution_result.get('market_timing'),
                        'currency_effect': attribution_result.get('currency_effect'),
                        'interaction_effect': attribution_result.get('interaction_effect')
                    },
                    'settings': {
                        'period': period,
                        'attribution_types': attribution_types,
                        'benchmark': benchmark,
                        'frequency': frequency,
                        'currency': currency
                    },
                    'metadata': {
                        'symbols_count': len(symbols),
                        'benchmark_symbol': benchmark_symbol,
                        'calculation_date': datetime.now().isoformat()
                    }
                }
            }
            
            return jsonify(sanitize_for_json(response))
            
        except Exception as e:
            print(f"Return Attribution error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500