from flask import request, jsonify
from analytics.performance_attribution import PerformanceAttributor
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
                'ITD': '5y'  # Use 5y as proxy for inception-to-date
            }
            yf_period = period_mapping.get(period, '1y')
            
            # Convert transactions
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
                    continue
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions'}), 400
            
            # Create portfolio and get positions
            portfolio = TransactionPortfolio(transactions)
            positions = portfolio.get_current_positions()
            
            if not positions:
                return jsonify({'success': False, 'error': 'No current positions'}), 400
            
            # Extract symbols and weights
            symbols = list(positions.keys())
            total_value = sum(pos.quantity * pos.avg_cost for pos in positions.values())
            weights = {symbol: (pos.quantity * pos.avg_cost) / total_value 
                      for symbol, pos in positions.items() if total_value > 0}
            
            # Map benchmark names using configurable mappings
            import os
            benchmark_mapping = {
                'Peer Group': os.getenv('PEER_GROUP_BENCHMARK', 'VT'),
                'Custom': os.getenv('CUSTOM_BENCHMARK', 'SPY'),
                'Index': os.getenv('INDEX_BENCHMARK', 'SPY'),
                'S&P 500': 'SPY',
                'NASDAQ': 'QQQ',
                'Russell 2000': 'IWM'
            }
            benchmark_symbol = benchmark_mapping.get(benchmark, benchmark)
            
            # Initialize attributor
            attributor = PerformanceAttributor(data_client, benchmark_symbol)
            
            # Log debug info
            print(f"Attribution calculation: period={yf_period}, symbols={symbols}, benchmark={benchmark_symbol}")
            
            # Calculate attribution
            attribution_result = attributor.factor_based_attribution(
                symbols=symbols,
                weights=weights,
                period=yf_period,
                attribution_model=attribution_model,
                benchmark=benchmark_symbol,
                currency=currency,
                frequency=frequency.lower(),
                attribution_types=attribution_types
            )
            
            print(f"Attribution result: {attribution_result}")
            
            # Format response with all requested features
            response = {
                'success': True,
                'return_attribution': {
                    'portfolio_return': attribution_result.get('portfolio_return', 0.0),
                    'benchmark_return': attribution_result.get('benchmark_return', 0.0),
                    'active_return': attribution_result.get('active_return', 0.0),
                    'attribution_effects': {
                        'asset_allocation': attribution_result.get('asset_allocation', 0.0),
                        'security_selection': attribution_result.get('security_selection', 0.0),
                        'timing_effect': attribution_result.get('market_timing', 0.0),
                        'currency_effect': attribution_result.get('currency_effect', 0.0),
                        'interaction_effect': attribution_result.get('interaction_effect', 0.0)
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