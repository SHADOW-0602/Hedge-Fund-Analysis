from flask import request, jsonify
from .route_utils import sanitize_for_json, extract_valid_symbols, calculate_portfolio_weights

def register_backtesting_routes(app, data_client, smart_cache=None):
    """Register strategy backtesting routes"""
    
    @app.route('/api/strategy-backtesting', methods=['GET', 'POST'])
    def strategy_backtesting():
        try:
            from analytics.strategy_backtesting import StrategyBacktester
            
            # Handle both GET and POST requests
            if request.method == 'GET':
                # Return available parameters for GET request
                return jsonify({
                    'success': True,
                    'parameters': {
                        'backtest_periods': ['6M', '1Y', '2Y', '3Y', '5Y'],
                        'rebalancing_options': ['Monthly', 'Quarterly', 'Semi-annual'],
                        'transaction_costs': ['0%', '0.1%', '0.25%', '0.5%'],
                        'benchmarks': ['SPY', 'QQQ', 'IWM', 'VTI', 'VXUS'],
                        'risk_metrics': ['Sortino', 'Calmar', 'Max Drawdown', 'VaR', 'CVaR']
                    },
                    'available_symbols': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META']
                })
            
            # Handle POST request
            data = request.get_json(force=True) if request.is_json else request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
            
            portfolio_data = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio_data:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Extract symbols and weights
            symbols = extract_valid_symbols(portfolio_data)
            weights, total_value = calculate_portfolio_weights(portfolio_data)
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols found'}), 400
            
            # Parse parameters
            backtest_period = options.get('backtest_period', '1Y')
            rebalancing = options.get('rebalancing', 'Quarterly')
            transaction_costs_str = options.get('transaction_costs', '0.1%')
            # Handle both string and numeric transaction costs
            if isinstance(transaction_costs_str, str):
                transaction_costs = float(transaction_costs_str.replace('%', ''))
            else:
                transaction_costs = float(transaction_costs_str)
            benchmark = options.get('benchmark', 'SPY')
            
            print(f"Backtesting Parameters: period={backtest_period}, rebalancing={rebalancing}, costs={transaction_costs}%, benchmark={benchmark}")
            print(f"Portfolio: {len(symbols)} symbols, total value: ${total_value:,.2f}")
            
            # Initialize backtester
            backtester = StrategyBacktester(data_client)
            
            # Run backtest
            results = backtester.backtest_strategy(
                symbols, weights, backtest_period, rebalancing, 
                transaction_costs, benchmark
            )
            
            if 'error' in results:
                print(f"Backtesting error: {results['error']}")
                return jsonify({'success': False, 'error': results['error']}), 500
            
            print(f"Backtesting completed successfully")
            print(f"Total return: {results['performance_metrics']['total_return']:.2%}")
            print(f"Sortino ratio: {results['risk_metrics']['sortino_ratio']:.3f}")
            print(f"Sharpe ratio: {results['performance_metrics']['sharpe_ratio']:.3f}")
            print(f"Max drawdown: {results['risk_metrics']['max_drawdown']:.2%}")
            
            return jsonify({
                'success': True,
                'backtesting_results': sanitize_for_json(results)
            })
            
        except Exception as e:
            print(f"Strategy backtesting error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500