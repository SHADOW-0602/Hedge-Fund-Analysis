from flask import request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from .route_utils import sanitize_for_json, extract_valid_symbols, calculate_portfolio_weights
from utils.fed_rate import get_risk_free_rate
from utils.symbol_parser import get_underlying_symbol

def _convert_transactions_data(transactions_data):
    """Helper function to convert transaction data to Transaction objects"""
    from core.transactions import Transaction
    
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
    return transactions

def register_analytics_routes(app, data_client, smart_cache=None):
    """Register analytics routes"""
    
    @app.route('/api/analyze-risk', methods=['POST'])
    def analyze_risk():
        try:
            from analytics.risk_analytics import RiskAnalyzer
            
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
            
            portfolio_data = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio_data or not isinstance(portfolio_data, list):
                return jsonify({'success': False, 'error': 'Invalid portfolio data'}), 400
            
            symbols = extract_valid_symbols(portfolio_data)
            weights, total_value = calculate_portfolio_weights(portfolio_data)
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols found'}), 400
            
            # Read parameters from frontend settings
            period = options.get('period', '1Y')
            var_confidence = float(options.get('var_confidence', 0.95))
            risk_model = options.get('risk_model', 'historical')
            benchmark = options.get('benchmark', 'SPY')
            rolling_window = int(options.get('rolling_window', 252))
            
            print(f"Risk Analysis Parameters: period={period}, confidence={var_confidence}, model={risk_model}, benchmark={benchmark}, window={rolling_window}")
            
            # Initialize risk analyzer
            analyzer = RiskAnalyzer(data_client, benchmark)
            
            # Get comprehensive risk metrics
            risk_metrics = analyzer.analyze_portfolio_risk_fast(
                symbols, weights, period, None, var_confidence, 
                risk_model, benchmark, rolling_window
            )
            
            # Add portfolio summary
            risk_metrics.update({
                'portfolio_value': total_value,
                'num_positions': len(symbols),
                'symbols_analyzed': symbols
            })
            
            print(f"Risk analysis successful for {len(symbols)} symbols, portfolio value: ${total_value:,.2f}")
            return jsonify({'success': True, 'risk_metrics': sanitize_for_json(risk_metrics)})
            
        except Exception as e:
            print(f"Risk analysis error: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/monte-carlo', methods=['POST'])
    def monte_carlo():
        try:
            from monte_carlo_v3 import MonteCarloEngine
            
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No JSON data provided'}), 400
                
            portfolio_data = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio_data or not isinstance(portfolio_data, list):
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Read parameters from frontend settings
            forecast_period = options.get('forecast_period', '3M')
            num_simulations = int(options.get('simulations', 10000))
            confidence_level = float(options.get('confidence_intervals', 0.95))
            market_regime = options.get('market_regime', 'normal')
            volatility_adjustment = float(options.get('volatility_adjustment', 0.0))
            
            # Convert confidence level to intervals list
            confidence_intervals = [confidence_level]
            
            print(f"Monte Carlo Parameters: period={forecast_period}, sims={num_simulations}, confidence={confidence_level}, regime={market_regime}, vol_adj={volatility_adjustment}")
            
            symbols = extract_valid_symbols(portfolio_data)
            weights, total_value = calculate_portfolio_weights(portfolio_data)
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols for simulation'}), 400
            
            # Run actual Monte Carlo simulation
            mc_engine = MonteCarloEngine(data_client)
            results = mc_engine.portfolio_simulation(
                symbols, weights, 
                num_simulations=num_simulations,
                confidence_intervals=confidence_intervals,
                market_regime=market_regime,
                volatility_adjustment=volatility_adjustment,
                forecast_period=forecast_period
            )
            
            print(f"Monte Carlo simulation completed for {len(symbols)} symbols")
            return jsonify({'success': True, 'results': sanitize_for_json(results)})
            
        except Exception as e:
            print(f"Monte Carlo error: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/performance-attribution', methods=['POST'])
    def performance_attribution():
        try:
            from analytics.performance_attribution import PerformanceAttributor
            data = request.get_json()
            portfolio_data = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio_data:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            symbols = extract_valid_symbols(portfolio_data)
            weights, total_value = calculate_portfolio_weights(portfolio_data)
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols found'}), 400
            
            # Read parameters from frontend settings
            period = options.get('period', '1Y')
            attribution_model = options.get('attribution_model', 'brinson')
            benchmark = options.get('benchmark', 'SPY')
            currency = options.get('currency', 'USD')
            frequency = options.get('frequency', 'daily')
            
            print(f"Performance Attribution Parameters: period={period}, model={attribution_model}, benchmark={benchmark}, currency={currency}, frequency={frequency}")
            print(f"Symbols: {symbols}, Total Value: ${total_value:,.2f}")
            
            # Initialize attributor and calculate results
            attributor = PerformanceAttributor(data_client, benchmark)
            
            # Process all symbols for performance attribution
            limited_symbols = symbols
            
            results = attributor.factor_based_attribution(
                limited_symbols, weights, period, 
                attribution_model, benchmark, currency, frequency
            )
            
            # Check if results are empty and provide better error message
            if not results or all(v == 0.0 for v in results.values()):
                print(f"Performance attribution returned empty results for symbols: {symbols}")
                return jsonify({
                    'success': False, 
                    'error': 'Unable to calculate performance attribution. This may be due to market data provider issues or insufficient historical data.',
                    'debug_info': {
                        'symbols': symbols,
                        'period': period,
                        'benchmark': benchmark,
                        'results': results
                    }
                }), 500
            
            print(f"Performance attribution successful: {list(results.keys())}")
            return jsonify({'success': True, 'attribution': results})
            
        except Exception as e:
            print(f"Performance attribution error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False, 
                'error': f'Performance attribution failed: {str(e)}',
                'debug_info': {
                    'symbols': symbols if 'symbols' in locals() else 'unknown',
                    'error_type': type(e).__name__
                }
            }), 500

    @app.route('/api/portfolio-optimization', methods=['POST'])
    def portfolio_optimization():
        try:
            from analytics.portfolio_optimization import PortfolioOptimizer
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Read parameters from frontend settings
            objective = options.get('objective', 'max_sharpe')
            constraint = options.get('constraint', 'long_only')
            rebalancing = options.get('rebalancing', 'monthly')
            risk_budget = options.get('risk_budget', 'equal')
            lookback_period = options.get('lookback_period', '1y')
            
            symbols = extract_valid_symbols(portfolio)
            
            print(f"Portfolio Optimization Parameters: objective={objective}, constraint={constraint}, rebalancing={rebalancing}, risk_budget={risk_budget}, lookback={lookback_period}")
            print(f"Full options received: {options}")
            print(f"Symbols to optimize: {symbols}")
            
            if len(symbols) < 1:
                return jsonify({'success': False, 'error': 'Need at least 1 symbol for optimization'}), 400
            
            # Initialize optimizer
            optimizer = PortfolioOptimizer(data_client)
            
            # Perform optimization with enhanced parameters
            optimization_results = optimizer.optimize_portfolio(
                symbols,
                period=lookback_period.lower(),
                objective=objective,
                constraint=constraint,
                rebalancing=rebalancing,
                risk_budget=risk_budget,
                lookback_period=lookback_period
            )
            
            print(f"Optimization completed successfully with results keys: {list(optimization_results.keys()) if optimization_results else 'None'}")
            return jsonify({
                'success': True,
                'optimization': optimization_results
            })
            
        except Exception as e:
            print(f"Portfolio optimization error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/options-strategies', methods=['POST'])
    def options_strategies():
        try:
            from analytics.options_analytics import OptionsAnalyzer
            
            data = request.get_json()
            portfolio_data = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio_data:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            symbols = extract_valid_symbols(portfolio_data)
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols found'}), 400
            
            print(f"Options Strategies - Portfolio data count: {len(portfolio_data)}")
            print(f"Options Strategies - Extracted symbols: {symbols}")
            
            # Read parameters from frontend settings
            expiration = options.get('expiration', '3M')
            moneyness = options.get('moneyness', 'All')
            min_premium = options.get('min_premium', '0.50')
            delta_range = options.get('delta_range', 'All')
            
            print(f"Options Parameters: expiration={expiration}, moneyness={moneyness}, min_premium={min_premium}, delta_range={delta_range}")
            
            # Initialize options analyzer
            analyzer = OptionsAnalyzer(data_client)
            
            print(f"Calling scan_all_strategies with {len(symbols)} symbols: {symbols}")
            
            # Get opportunities with settings
            opportunities = analyzer.scan_all_strategies(symbols, {
                'expiration': expiration,
                'moneyness': moneyness,
                'min_premium': min_premium,
                'delta_range': delta_range
            })
            
            print(f"scan_all_strategies returned {len(opportunities)} opportunities")
            
            # Don't filter out zero premium - keep all opportunities
            print(f"Total opportunities found: {len(opportunities)}")
            
            # Group by symbol for debugging
            symbol_counts = {}
            for opp in opportunities:
                symbol = opp.get('symbol', 'Unknown')
                if symbol not in symbol_counts:
                    symbol_counts[symbol] = 0
                symbol_counts[symbol] += 1
            print(f"Opportunities per symbol: {symbol_counts}")
            
            # Calculate summary from all opportunities
            summary = {
                'covered_calls': {'total_premium': 0, 'count': 0},
                'protective_puts': {'total_cost': 0, 'count': 0},
                'iron_condors': {'total_premium': 0, 'count': 0}
            }
            
            for opp in opportunities:
                strategy = opp.get('strategy', 'covered_calls')
                premium = opp.get('premium', 0)
                
                if strategy == 'covered_calls':
                    summary['covered_calls']['total_premium'] += premium * 100
                    summary['covered_calls']['count'] += 1
                elif strategy == 'protective_puts':
                    summary['protective_puts']['total_cost'] += premium * 100
                    summary['protective_puts']['count'] += 1
                elif strategy == 'iron_condors':
                    summary['iron_condors']['total_premium'] += premium * 100
                    summary['iron_condors']['count'] += 1
            
            print(f"Final result: {len(opportunities)} opportunities")
            print(f"Sample opportunities: {opportunities[:3] if opportunities else 'None'}")
            print(f"Summary: {summary}")
            
            result = {
                'success': True, 
                'opportunities': opportunities, 
                'summary': summary
            }
            print(f"Returning {len(opportunities)} opportunities to frontend")
            return jsonify(result)
            
        except Exception as e:
            print(f"Options strategies error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/fifo-lifo-accounting', methods=['POST'])
    def fifo_lifo_accounting():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            transactions = _convert_transactions_data(transactions_data)
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Use the advanced transaction analyzer for tax analysis (includes FIFO)
            analyzer = AdvancedTransactionAnalyzer(data_client)
            tax_result = analyzer.tax_analysis(transactions)
            
            return jsonify({
                'success': True,
                'fifo_lifo_analysis': sanitize_for_json(tax_result)
            })
            
        except Exception as e:
            print(f"FIFO/LIFO analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500





    @app.route('/api/cost-analysis', methods=['POST'])
    def cost_analysis():
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
            
            # Use the advanced transaction analyzer
            analyzer = AdvancedTransactionAnalyzer(data_client)
            cost_result = analyzer.cost_analysis(transactions)
            
            return jsonify({
                'success': True,
                'cost_analysis': sanitize_for_json(cost_result)
            })
            
        except Exception as e:
            print(f"Cost analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/cash-flow-analysis', methods=['POST'])
    def cash_flow_analysis():
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
            
            # Use the advanced transaction analyzer
            analyzer = AdvancedTransactionAnalyzer(data_client)
            cash_flow_result = analyzer.cash_flow_analysis(transactions)
            
            return jsonify({
                'success': True,
                'cash_flow_analysis': sanitize_for_json(cash_flow_result)
            })
            
        except Exception as e:
            print(f"Cash flow analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/turnover-analysis', methods=['POST'])
    def turnover_analysis():
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
            
            # Use the advanced transaction analyzer
            analyzer = AdvancedTransactionAnalyzer(data_client)
            turnover_result = analyzer.turnover_analysis(transactions)
            
            return jsonify({
                'success': True,
                'turnover_analysis': sanitize_for_json(turnover_result)
            })
            
        except Exception as e:
            print(f"Turnover analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/trade-timing-analysis', methods=['POST'])
    def trade_timing_analysis():
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
            
            # Use the advanced transaction analyzer
            analyzer = AdvancedTransactionAnalyzer(data_client)
            timing_result = analyzer.trade_timing_analysis(transactions)
            
            return jsonify({
                'success': True,
                'trade_timing_analysis': sanitize_for_json(timing_result)
            })
            
        except Exception as e:
            print(f"Trade timing analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/statistical-analysis', methods=['GET', 'POST'])
    def statistical_analysis():
        try:
            from analytics.statistical_analysis import StatisticalAnalyzer
            
            # Handle both GET and POST requests
            if request.method == 'GET':
                # Parse query parameters for GET request
                symbols_param = request.args.get('symbols', '')
                symbols = [s.strip() for s in symbols_param.split(',') if s.strip()]
                
                # Create portfolio data from symbols
                portfolio_data = [{'symbol': symbol, 'quantity': 100, 'avg_cost': 100} for symbol in symbols]
                
                # Parse options from query parameters
                options = {
                    'lookback_period': int(request.args.get('lookback', 252)),
                    'frequency': request.args.get('frequency', 'daily'),
                    'benchmark': request.args.get('benchmark', 'SPY'),
                    'confidence_level': float(request.args.get('confidence', 0.95))
                }
            else:
                # Handle POST request as before
                data = request.get_json()
                portfolio_data = data.get('portfolio', [])
                options = data.get('options', {})
            
            if not portfolio_data:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            symbols = extract_valid_symbols(portfolio_data)
            weights, total_value = calculate_portfolio_weights(portfolio_data)
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols found'}), 400
            
            # Read parameters from frontend
            lookback_days = options.get('lookback_period', 252)
            frequency = options.get('frequency', 'daily')
            benchmark = options.get('benchmark', 'SPY')
            confidence_level = float(options.get('confidence_level', 0.95))
            
            # Convert lookback days to period format
            if isinstance(lookback_days, int):
                if lookback_days <= 63:
                    lookback_period = '3M'
                elif lookback_days <= 126:
                    lookback_period = '6M'
                elif lookback_days <= 252:
                    lookback_period = '1Y'
                elif lookback_days <= 504:
                    lookback_period = '2Y'
                else:
                    lookback_period = '3Y'
            else:
                lookback_period = str(lookback_days)
            
            # Capitalize frequency for backend
            frequency = frequency.capitalize()
            
            print(f"Statistical Analysis Parameters: lookback_days={lookback_days}, period={lookback_period}, frequency={frequency}, benchmark={benchmark}, confidence={confidence_level}")
            print(f"Input symbols: {symbols}")
            print(f"Weights: {weights}")
            
            # Initialize analyzer
            analyzer = StatisticalAnalyzer(data_client)
            
            # Run advanced statistical analysis with converted parameters
            results = analyzer.advanced_statistical_analysis(
                symbols, weights, lookback_period, frequency, benchmark, confidence_level
            )
            
            # Add original parameters to results for frontend display
            if 'parameters' in results:
                results['parameters']['original_lookback_days'] = lookback_days
                results['parameters']['converted_period'] = lookback_period
            
            print(f"Analysis results keys: {list(results.keys()) if results else 'None'}")
            if 'performance_metrics' in results:
                print(f"Symbols in performance_metrics: {list(results['performance_metrics'].keys())}")
            if 'risk_metrics' in results:
                print(f"Symbols in risk_metrics: {list(results['risk_metrics'].keys())}")
            
            if 'error' in results:
                print(f"Statistical analysis error: {results['error']}")
                return jsonify({'success': False, 'error': results['error']}), 500
            
            # Count actual symbols processed
            symbols_processed = 0
            if 'performance_metrics' in results:
                symbols_processed = len(results['performance_metrics'])
            elif 'risk_metrics' in results:
                symbols_processed = len(results['risk_metrics'])
            
            print(f"Statistical analysis completed: {symbols_processed}/{len(symbols)} symbols processed")
            return jsonify({
                'success': True,
                'statistical_analysis': sanitize_for_json(results)
            })
            
        except Exception as e:
            print(f"Statistical analysis error: {e}")
            print(f"Symbols attempted: {symbols if 'symbols' in locals() else 'unknown'}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500