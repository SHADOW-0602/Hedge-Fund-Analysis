from flask import request, jsonify
import pandas as pd
import numpy as np

def register_return_attribution_routes(app, data_client):
    """Register return attribution routes"""
    
    @app.route('/api/return-attribution', methods=['POST'])
    def return_attribution_analysis():
        """Return Attribution Analysis"""
        try:
            from analytics.performance_attribution import PerformanceAttributor
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            # Get settings
            period = data.get('period', '1Y')
            benchmark_symbol = data.get('benchmark_symbol', 'SPY')
            
            # Calculate positions from transactions
            positions = {}
            for tx_data in transactions_data:
                symbol = tx_data.get('symbol', '')
                quantity = float(tx_data.get('quantity', 0))
                price = float(tx_data.get('price', 0))
                tx_type = tx_data.get('transaction_type', 'BUY')
                
                if symbol not in positions:
                    positions[symbol] = {'quantity': 0, 'avg_cost': 0}
                
                if tx_type.upper() == 'BUY':
                    old_total = positions[symbol]['quantity'] * positions[symbol]['avg_cost']
                    new_quantity = positions[symbol]['quantity'] + abs(quantity)
                    new_total = old_total + (abs(quantity) * price)
                    positions[symbol]['avg_cost'] = new_total / new_quantity if new_quantity > 0 else price
                    positions[symbol]['quantity'] = new_quantity
                elif tx_type.upper() == 'SELL':
                    positions[symbol]['quantity'] -= abs(quantity)
            
            # Get symbols with positions
            symbols = [s for s, p in positions.items() if p['quantity'] > 0]
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No positions found'}), 400
            
            # Calculate weights based on Invested Capital (Quantity * AvgCost)
            total_invested = 0.0
            symbol_invested = {}
            
            for s in symbols:
                qty = positions[s]['quantity']
                cost = positions[s]['avg_cost']
                invested = qty * cost
                symbol_invested[s] = invested
                total_invested += invested
            
            if total_invested > 0:
                weights = {s: val/total_invested for s, val in symbol_invested.items()}
            else:
                return jsonify({'success': False, 'error': 'Total invested capital is zero or negative, cannot calculate weights'}), 400
            
            # Get settings
            options = data.get('options', {})
            period = str(data.get('period', options.get('period', '1Y'))).lower()
            benchmark_symbol = data.get('benchmark_symbol', options.get('benchmark', 'SPY'))
            attribution_model = str(data.get('attribution_model', options.get('attribution_model', 'brinson'))).lower()
            currency = str(data.get('currency', options.get('currency', 'USD'))).upper()
            frequency = str(data.get('frequency', options.get('frequency', 'daily'))).lower()
            
            # Run attribution with actual market data
            attributor = PerformanceAttributor(data_client, benchmark_symbol)
            
            print(f"Calculating attribution for {len(symbols)} symbols using {attribution_model} model")
            print(f"Parameters: period={period}, benchmark={benchmark_symbol}, currency={currency}")
            
            # Calculate attribution using the robust PerformanceAttributor class
            attribution_result = attributor.factor_based_attribution(
                symbols=symbols,
                weights=weights,
                period=period,
                attribution_model=attribution_model,
                benchmark=benchmark_symbol,
                currency=currency,
                frequency=frequency
            )
            
            print(f"Attribution result: {attribution_result}")
            
            # Ensure all values are numbers, not None/NaN
            def safe_value(val, default=0.0):
                if val is None or np.isnan(val) or np.isinf(val):
                    return default
                return float(val)
            
            return jsonify({
                'success': True,
                'return_attribution': {
                    'portfolio_return': safe_value(attribution_result.get('portfolio_return')),
                    'benchmark_return': safe_value(attribution_result.get('benchmark_return')),
                    'active_return': safe_value(attribution_result.get('active_return')),
                    'asset_allocation': safe_value(attribution_result.get('asset_allocation')),
                    'security_selection': safe_value(attribution_result.get('security_selection')),
                    'market_timing': safe_value(attribution_result.get('market_timing')),
                    'interaction_effect': safe_value(attribution_result.get('interaction_effect')),
                    'alpha_generation': safe_value(attribution_result.get('security_selection')),
                    'beta_exposure': None,
                    'sector_rotation': safe_value(attribution_result.get('asset_allocation')),
                    'currency_effect': safe_value(attribution_result.get('currency_effect')),
                    'metadata': {
                        'period': period,
                        'benchmark_type': 'Index',
                        'frequency': 'Daily',
                        'currency': 'Local'
                    }
                }
            })
            
        except Exception as e:
            print(f"Return attribution error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500