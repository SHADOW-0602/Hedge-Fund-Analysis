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

    @app.route('/api/transaction-xirr', methods=['POST'])
    def transaction_xirr():
        """Calculate XIRR for transaction history with stock/options breakdown"""
        try:
            from analytics.xirr_analyzer import DetailedXIRRAnalyzer
            from core.transactions import Transaction
            from utils.date_parser import UniversalDateParser
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            portfolio_data = data.get('portfolio', [])
            options = data.get('options', {})
            
            print(f"[TRANSACTION-XIRR] Received {len(transactions_data)} transactions, {len(portfolio_data)} portfolio items")
            
            # Helper to cleanly parse floats
            def safe_float(val, default=0.0):
                if val is None:
                    return default
                if isinstance(val, (int, float)):
                    return float(val)
                if isinstance(val, str):
                    try:
                        clean_val = val.replace('$', '').replace(',', '').strip()
                        if clean_val == '' or clean_val.lower() == 'n/a':
                            return default
                        return float(clean_val)
                    except ValueError:
                        return default
                return default

            # Helper to parse dates
            def safe_parse_date(date_val, default=None):
                if not default:
                    default = datetime.now()
                try:
                    return UniversalDateParser.parse_date(date_val)
                except:
                    return default

            transactions = []

            # Track which tickers we have transactions for
            seen_tickers = set()
            warnings = []

            # CASE 1: Process Transactions if available
            if transactions_data:
                print(f"[TRANSACTION-XIRR] Processing {len(transactions_data)} transactions")
                for i, tx_data in enumerate(transactions_data):
                    try:
                        date_obj = safe_parse_date(tx_data.get('date', ''))
                        symbol = tx_data.get('symbol', 'Unknown')
                        
                        raw_qty = tx_data.get('quantity', 0)
                        raw_price = tx_data.get('price', 0)
                        raw_fees = tx_data.get('fees', 0)
                        
                        transaction = Transaction(
                            symbol=symbol,
                            quantity=safe_float(raw_qty),
                            price=safe_float(raw_price),
                            date=date_obj,
                            transaction_type=tx_data.get('transaction_type', '').upper(),
                            fees=safe_float(raw_fees)
                        )
                        transactions.append(transaction)
                        seen_tickers.add(symbol)
                    except Exception as e:
                        print(f"[TRANSACTION-XIRR] Failed to parse transaction {i}: {e}")
                        continue
            
            # CASE 2: Process Portfolio to fill gaps (Hybrid Mode)
            # Smart Logic: Reconcile Transactions with Current Portfolio
            # If we have transactions (e.g. last 90 days), we might calculate:
            # Current_Qty = Initial_Qty + Net_Tx_Change
            # Initial_Qty = Current_Qty - Net_Tx_Change
            # If Initial_Qty > 0, we imply a "Starting Position" that needs a Proxy Buy
            
            if portfolio_data:
                print(f"[TRANSACTION-XIRR] Checking {len(portfolio_data)} portfolio items for gap filling...")
                
                # Pre-calculate transaction metrics per symbol
                tx_metrics = {}
                for tx in transactions:
                    sym = tx.symbol
                    if sym not in tx_metrics:
                        tx_metrics[sym] = {'net_qty': 0.0, 'min_date': None}
                    
                    # Update net quantity
                    q = tx.quantity
                    if tx.transaction_type == 'SELL':
                        q = -q
                    tx_metrics[sym]['net_qty'] += q
                    
                    # Update min date
                    if tx_metrics[sym]['min_date'] is None or tx.date < tx_metrics[sym]['min_date']:
                        tx_metrics[sym]['min_date'] = tx.date

                # Default to 1 year ago if no purchase date found
                default_purchase_date = datetime.now() - timedelta(days=365)
                
                for i, pos_data in enumerate(portfolio_data):
                    try:
                        symbol = pos_data.get('symbol', 'Unknown')
                        current_qty = safe_float(pos_data.get('quantity', 0))
                        
                        # Get transaction history impact
                        tx_metric = tx_metrics.get(symbol, {'net_qty': 0.0, 'min_date': None})
                        tx_net_qty = tx_metric['net_qty']
                        
                        # Calculate hidden initial quantity (what we must have started with)
                        # Current = Initial + Net_Change  =>  Initial = Current - Net_Change
                        initial_qty = current_qty - tx_net_qty
                        
                        # If we essentially cover the whole position with transactions, skip
                        # (allowing for small float errors)
                        if initial_qty <= 0.0001:
                            continue

                        # Determine Proxy Date (before first transaction overlap, or default)
                        if tx_metric['min_date']:
                            proxy_date = tx_metric['min_date'] - timedelta(days=1)
                        else:
                            proxy_date = safe_parse_date(pos_data.get('purchase_date'), default=default_purchase_date)
                            
                        # Determine Proxy Price
                        # Using avg_cost is the best heuristic for the "base" position
                        avg_cost = safe_float(pos_data.get('avg_cost', 0))
                        cost_basis = safe_float(pos_data.get('cost_basis', 0))
                        current_price = safe_float(pos_data.get('current_price', 0))
                        
                        price = 0.0
                        is_fallback_price = False

                        if avg_cost > 0:
                            price = avg_cost
                        elif current_qty > 0 and cost_basis > 0:
                            price = cost_basis / current_qty
                        elif current_price > 0:
                            price = current_price # Fallback to current price if no cost data
                            is_fallback_price = True
                            
                        # Create Proxy Transaction for the "Initial Blob"
                        if initial_qty > 0 and price > 0:
                            if is_fallback_price:
                                print(f"[TRANSACTION-XIRR] Warning: Using current price as cost basis for {symbol} (No cost data)")
                                warnings.append(f"Missing cost basis for {symbol} - assuming 0% return")

                            proxy_tx = Transaction(
                                symbol=symbol,
                                quantity=initial_qty,
                                price=price,
                                date=proxy_date,
                                transaction_type='BUY',
                                fees=0.0
                            )
                            transactions.append(proxy_tx)
                            # print(f"[PROXY-TX] Gap-fill buy for {symbol}: {initial_qty} @ {price} (Date: {proxy_date})")
                            
                    except Exception as e:
                        print(f"[TRANSACTION-XIRR] Failed to create proxy transaction for item {i}: {e}")
                        continue
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions or portfolio data found'}), 400
            
            # Initialize XIRR analyzer
            analyzer = DetailedXIRRAnalyzer(data_client)
            analyzer.load_transactions(transactions)
            
            # Fetch real current prices
            all_symbols = list(set([tx.symbol for tx in transactions]))
            try:
                print(f"[TRANSACTION-XIRR] Fetching prices for {len(all_symbols)} symbols...")
                current_prices = data_client.get_current_prices(all_symbols)
                print(f"[TRANSACTION-XIRR] Successfully fetched {len(current_prices)} prices")
            except Exception as e:
                print(f"[TRANSACTION-XIRR] Failed to fetch prices: {e}")
                current_prices = {}

            # Fallback: fill missing prices with last transaction price
            for tx in reversed(transactions):
                if tx.symbol not in current_prices or current_prices[tx.symbol] == 0:
                    current_prices[tx.symbol] = tx.price
            
            # Calculate portfolio-level XIRR using detailed report
            print(f"[TRANSACTION-XIRR] Generating detailed report...")
            detailed_report = analyzer.generate_detailed_report(current_prices)
            portfolio_metrics = detailed_report['metrics']
            position_analysis = detailed_report['positions']
            
            # Detect base tickers (stocks) and extract underlyings from options
            base_tickers = set()
            import re
            
            for tx in transactions:
                from analytics.xirr_analyzer import is_option_symbol
                if not is_option_symbol(tx.symbol):
                    base_tickers.add(tx.symbol)
                else:
                    # Extract underlying from option symbol (e.g., NVDA230120C... -> NVDA)
                    # Assumes standard format where ticker is followed by date digits
                    match = re.match(r"^([A-Z]+)\d", tx.symbol)
                    if match:
                        base_tickers.add(match.group(1))
                    else:
                        # Fallback for non-standard or just ignore
                        pass
            
            # Calculate per-ticker XIRR
            ticker_breakdown = []
            for ticker in sorted(base_tickers):
                ticker_metrics = analyzer.calculate_ticker_xirr(ticker, current_prices)
                
                # Get position data if available
                pos_data = position_analysis.get(ticker, {})
                
                ticker_breakdown.append({
                    'ticker': ticker,
                    'stock_xirr': ticker_metrics['stock_xirr'],
                    'combined_xirr': ticker_metrics['combined_xirr'],
                    'options_impact': ticker_metrics['options_impact'],
                    'has_options': abs(ticker_metrics['options_impact']) > 0.0001,
                    # Add position metrics
                    'quantity': pos_data.get('quantity', 0),
                    'market_value': pos_data.get('market_value', 0),
                    'avg_cost': pos_data.get('avg_cost', 0),
                    'unrealized_pnl': pos_data.get('unrealized_pnl', 0),
                    'unrealized_pnl_pct': pos_data.get('unrealized_pnl_pct', 0),
                    'weight': pos_data.get('weight', 0)
                })
            
            # Calculate metadata
            start_date = min(tx.date for tx in transactions)
            end_date = max(tx.date for tx in transactions)
            
            result = {
                'portfolio_xirr': portfolio_metrics.xirr,
                'portfolio_metrics': {
                    'xirr': portfolio_metrics.xirr,
                    'twr': portfolio_metrics.twr,
                    'total_return': portfolio_metrics.total_return,
                    'total_return_pct': portfolio_metrics.total_return_pct,
                    'annualized_return': portfolio_metrics.annualized_return,
                    'volatility': portfolio_metrics.volatility,
                    'sharpe_ratio': portfolio_metrics.sharpe_ratio,
                    'max_drawdown': portfolio_metrics.max_drawdown,
                    'current_value': portfolio_metrics.current_value,
                    'total_invested': portfolio_metrics.total_invested
                },
                'ticker_breakdown': ticker_breakdown,
                'warnings': warnings,
                'metadata': {
                    'transaction_count': len(transactions),
                    'ticker_count': len(base_tickers),
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d'),
                    'holding_period_days': portfolio_metrics.holding_period_days,
                    'period': options.get('period', 'ITD'),
                    'view': options.get('view', 'Combined')
                }
            }
            
            print(f"[TRANSACTION-XIRR] Portfolio XIRR: {portfolio_metrics.xirr:.2%}")
            print(f"[TRANSACTION-XIRR] Analyzed {len(ticker_breakdown)} tickers")
            
            return jsonify({
                'success': True,
                'transaction_xirr': sanitize_for_json(result)
            })
            
        except Exception as e:
            print(f'Transaction XIRR failed: {e}')
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500
