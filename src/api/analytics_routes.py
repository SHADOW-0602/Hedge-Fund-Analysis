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
            
            # Initialize attributor and calculate results
            attributor = PerformanceAttributor(data_client, benchmark)
            
            # Limit symbols to prevent API overload
            limited_symbols = symbols[:10] if len(symbols) > 10 else symbols
            
            results = attributor.factor_based_attribution(
                limited_symbols, weights, period, 
                attribution_model, benchmark, currency, frequency
            )
            
            return jsonify({'success': True, 'attribution': results})
            
        except Exception as e:
            print(f"Performance attribution error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/portfolio-optimization', methods=['POST'])
    def portfolio_optimization():
        try:
            from analytics.portfolio_optimization import PortfolioOptimizer
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Use default values for optimization
            objective = options.get('objective', 'max_sharpe')
            constraint = options.get('constraint', 'long_only')
            rebalancing = options.get('rebalancing', 'monthly')
            risk_budget = options.get('risk_budget', '0.15')
            lookback_period = options.get('lookback_period', '1y')
            
            symbols = extract_valid_symbols(portfolio)
            
            if len(symbols) < 1:
                return jsonify({'success': False, 'error': 'Need at least 1 symbol for optimization'}), 400
            
            # Initialize optimizer
            optimizer = PortfolioOptimizer(data_client)
            
            # Limit symbols to prevent API overload
            limited_symbols = symbols[:10] if len(symbols) > 10 else symbols
            
            # Perform optimization with enhanced parameters
            optimization_results = optimizer.optimize_portfolio(
                limited_symbols,
                period=lookback_period.lower(),
                objective=objective,
                constraint=constraint,
                rebalancing=rebalancing,
                risk_budget=risk_budget,
                lookback_period=lookback_period
            )
            
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
            
            # Read parameters from frontend settings
            expiration = options.get('expiration', '3M')
            moneyness = options.get('moneyness', 'All')
            min_premium = options.get('min_premium', '0.50')
            delta_range = options.get('delta_range', 'All')
            
            print(f"Options Parameters: expiration={expiration}, moneyness={moneyness}, min_premium={min_premium}, delta_range={delta_range}")
            
            # Initialize options analyzer
            analyzer = OptionsAnalyzer(data_client)
            
            # Get opportunities with settings
            opportunities = analyzer.scan_all_strategies(symbols, {
                'expiration': expiration,
                'moneyness': moneyness,
                'min_premium': min_premium,
                'delta_range': delta_range
            })
            
            # Filter out opportunities with no premium data
            opportunities = [opp for opp in opportunities if opp.get('premium', 0) > 0]
            
            # Calculate summary from all opportunities
            summary = {
                'covered_calls': {'total_premium': 0, 'count': 0},
                'protective_puts': {'total_cost': 0, 'count': 0},
                'iron_condors': {'total_premium': 0, 'count': 0}
            }
            
            for opp in opportunities:
                strategy = opp.get('strategy', 'covered_calls')
                premium = opp.get('premium', 0)
                
                if strategy == 'covered_calls' and premium > 0:
                    summary['covered_calls']['total_premium'] += premium * 100
                    summary['covered_calls']['count'] += 1
                elif strategy == 'protective_puts' and premium > 0:
                    summary['protective_puts']['total_cost'] += premium * 100
                    summary['protective_puts']['count'] += 1
                elif strategy == 'iron_condors' and premium > 0:
                    summary['iron_condors']['total_premium'] += premium * 100
                    summary['iron_condors']['count'] += 1
            
            return jsonify({
                'success': True, 
                'opportunities': opportunities, 
                'summary': summary
            })
            
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

    @app.route('/api/pnl-attribution', methods=['POST'])
    def pnl_attribution():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import TransactionPortfolio
            
            data = request.get_json()
            transactions = data.get('transactions', [])
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            # Create transaction portfolio
            df = pd.DataFrame(transactions)
            txn_portfolio = TransactionPortfolio.from_dataframe(df)
            
            # Analyze P&L attribution
            analyzer = AdvancedTransactionAnalyzer(data_client)
            results = analyzer.calculate_pnl_attribution(txn_portfolio)
            
            return jsonify({
                'success': True,
                'pnl_attribution': results
            })
            
        except Exception as e:
            print(f"P&L attribution error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/trade-performance', methods=['POST'])
    def trade_performance():
        try:
            from analytics.trading_operations_analyzer import TradingOperationsAnalyzer
            from core.transactions import TransactionPortfolio
            
            data = request.get_json()
            transactions = data.get('transactions', [])
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Create transaction portfolio
            df = pd.DataFrame(transactions)
            txn_portfolio = TransactionPortfolio.from_dataframe(df)
            
            # Analyze trade performance
            analyzer = TradingOperationsAnalyzer(data_client)
            results = analyzer.analyze_trade_performance(txn_portfolio)
            
            return jsonify({
                'success': True,
                'trade_performance': results
            })
            
        except Exception as e:
            print(f"Trade performance error: {e}")
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