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
    from utils.date_parser import UniversalDateParser
    
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
            
            print(f"[MONTE CARLO API] Received request with {len(portfolio_data)} portfolio items")
            print(f"[MONTE CARLO API] Options: {options}")
            
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
            
            print(f"[MONTE CARLO API] Extracted {len(symbols)} symbols: {symbols}")
            print(f"[MONTE CARLO API] Weights: {weights}")
            
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
                forecast_period=forecast_period,
                initial_portfolio_value=total_value if total_value > 0 else 10000.0
            )
            
            print(f"[MONTE CARLO API] Simulation completed for {len(symbols)} symbols")
            print(f"[MONTE CARLO API] Results keys: {list(results.keys()) if results else 'None'}")
            
            if 'simulation_data' in results:
                sim_data = results['simulation_data']
                print(f"[MONTE CARLO API] Simulation data type: {type(sim_data)}")
                print(f"[MONTE CARLO API] Simulation data length: {len(sim_data) if hasattr(sim_data, '__len__') else 'N/A'}")
                if hasattr(sim_data, '__len__') and len(sim_data) > 0:
                    print(f"[MONTE CARLO API] First path type: {type(sim_data[0])}")
                    print(f"[MONTE CARLO API] First path length: {len(sim_data[0]) if hasattr(sim_data[0], '__len__') else 'N/A'}")
                    if hasattr(sim_data[0], '__len__') and len(sim_data[0]) > 0:
                        print(f"[MONTE CARLO API] First path sample: {sim_data[0][:5]}")
            
            sanitized_results = sanitize_for_json(results)
            print(f"[MONTE CARLO API] Sanitized results keys: {list(sanitized_results.keys()) if sanitized_results else 'None'}")
            
            return jsonify({'success': True, 'results': sanitized_results})
            
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
            print(f"Symbols: {symbols}, Total Value: ${total_value if 'total_value' in locals() else 'N/A'}")
            
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
            
            # Calculate current weights based on market value
            current_weights = {}
            total_value = 0.0
            
            if portfolio and len(portfolio) > 0:
                print(f"DEBUG: First portfolio item keys: {portfolio[0].keys()}")
                print(f"DEBUG: First portfolio item sample: {portfolio[0]}")
            
            for item in portfolio:
                if not isinstance(item, dict):
                    continue
                
                try:
                    # Debug keys if needed, commonly 'quantity' or 'qty', 'currentPrice' or 'price'
                    # Frontend uses avg_cost, so add that. Also check case variants.
                    qty = float(item.get('quantity', item.get('qty', item.get('Quantity', item.get('shares', 0)))))
                    
                    price_keys = ['currentPrice', 'current_price', 'price', 'Price', 'lastPrice', 'Last', 'avgCost', 'avg_cost', 'average_cost', 'cost_basis']
                    price = 0.0
                    for k in price_keys:
                        val = item.get(k)
                        if val is not None:
                            try:
                                price = float(val)
                                if price > 0:
                                    break
                            except:
                                continue
                                
                    market_val = qty * price
                    if market_val > 0:
                        total_value += market_val
                        symbol = item.get('symbol', '').strip().upper()
                        if symbol:
                            current_weights[symbol] = market_val
                except Exception as e:
                    print(f"DEBUG: Failed to process item {item.get('symbol')}: {e}")
                    continue
            
            # Normalize weights
            if total_value > 0:
                for sym in current_weights:
                    current_weights[sym] = current_weights[sym] / total_value
            
            print(f"Calculated Current Weights: {current_weights}")

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
                lookback_period=lookback_period,
                current_portfolio_weights=current_weights
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

            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/sector-allocation', methods=['POST'])
    def sector_allocation():
        try:
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            options = data.get('options', {})
            
            # Extract options with defaults
            level = options.get('level', 'Sector')  # Sector or Industry
            benchmark_symbol = options.get('benchmark', 'SPY')
            classification = options.get('classification', 'GICS')
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # --- 1. Calculate Portfolio Weights (Market Value) ---
            symbol_values = {}
            total_value = 0.0
            
            if len(portfolio) > 0:
                print(f"[DEBUG] First portfolio item keys: {list(portfolio[0].keys())}")
                print(f"[DEBUG] First portfolio item sample: {portfolio[0]}")

            
            for item in portfolio:
                try:
                    sym = item.get('symbol', '').strip().upper()
                    if not sym: continue
                    
                    # Strategy 1: Direct Market Value
                    market_val_keys = ['marketValue', 'MarketValue', 'Market Value', 'market_value', 'currentValue', 'CurrentValue', 'total_value', 'Total Value']
                    val = 0.0
                    for k in market_val_keys:
                        v = item.get(k)
                        if v is not None:
                             try:
                                 val = float(str(v).replace('$', '').replace(',', '').strip())
                                 if val > 0: 
                                     print(f"[DEBUG] Found Market Value via '{k}': {val}")
                                     break
                             except: continue

                    # Strategy 2: Quantity * Price
                    if val == 0:
                        qty_keys = ['quantity', 'qty', 'Quantity', 'shares', 'Shares', 'position', 'Position']
                        qty = 0.0
                        for k in qty_keys:
                            v = item.get(k)
                            if v is not None:
                                try:
                                    qty = float(str(v).replace(',', '').strip())
                                    if qty != 0: break
                                except: continue
                        
                        price_keys = ['currentPrice', 'current_price', 'price', 'Price', 'lastPrice', 'Last', 'avgCost', 'avg_cost', 'average_cost', 'close', 'Close']
                        price = 0.0
                        for k in price_keys:
                            v = item.get(k)
                            if v is not None:
                                try:
                                    price = float(str(v).replace('$', '').replace(',', '').strip())
                                    if price > 0: break
                                except: continue
                        
                        val = qty * price
                        if val > 0:
                             pass # print(f"[DEBUG] Calculated Value via Qty({qty}) * Price({price}): {val}")
                    
                    if val > 0:
                        symbol_values[sym] = symbol_values.get(sym, 0.0) + val
                        total_value += val
                    else:
                        print(f"[DEBUG] Item {sym} resulted in 0 value. Keys available: {list(item.keys())}")
                except Exception as e:
                    print(f"[ERROR] processing item {item}: {e}")
                    continue
            
            # --- 2. Fetch Classification Data (Parallelized) ---
            import yfinance as yf
            from concurrent.futures import ThreadPoolExecutor
            
            item_map = {} # sym -> classification (sector or industry)
            
            # Custom Classification: Try to use provided metadata first
            if classification == 'Custom':
                for item in portfolio:
                    try:
                        s = item.get('symbol', '').strip().upper()
                        if s and s in symbol_values:
                            # Use 'sector' or 'industry' from input if available
                            custom_val = item.get('sector') if level == 'Sector' else item.get('industry', item.get('sector'))
                            if custom_val:
                                item_map[s] = custom_val
                    except:
                        continue

            # --- Load Local Data (US Stocks_Basic Data.xlsx) ---
            # Use local Excel file as primary source to avoid API latency/failures
            try:
                import pandas as pd
                import os
                import re
                
                # Check probable locations
                possible_paths = ["US Stocks_Basic Data.xlsx", os.path.join(os.getcwd(), "US Stocks_Basic Data.xlsx")]
                excel_path = next((p for p in possible_paths if os.path.exists(p)), None)
                
                if excel_path:
                    # Cache this dataframe in a real app, but reading here for safety
                    df_local = pd.read_excel(excel_path)
                    if 'Ticker' in df_local.columns and ('Sector' in df_local.columns or 'Industry' in df_local.columns):
                        df_local['Ticker'] = df_local['Ticker'].astype(str).str.upper().str.strip()
                        
                        # Set index for faster lookup
                        df_local.set_index('Ticker', inplace=True)
                        
                        for sym in symbol_values.keys():
                            if sym not in item_map:
                                # Determine root symbol for options
                                target = sym
                                occ_match = re.match(r'^([A-Z]+)\d{6}[CP]\d{8}$', sym)
                                if occ_match:
                                    target = occ_match.group(1)
                                
                                # Skip Currencies/Cash here (handled in fetch_info or manually)
                                if any(x in sym for x in ['CUR:', 'USD', 'CASH']):
                                    continue

                                if target in df_local.index:
                                    row = df_local.loc[target]
                                    # Handle duplicate tickers if any (returns Series or DataFrame)
                                    if isinstance(row, pd.DataFrame):
                                        row = row.iloc[0]
                                        
                                    val = row['Sector'] if level == 'Sector' else row['Industry']
                                    
                                    # Fallback if industry is missing but sector exists
                                    if (not val or str(val).lower() == 'nan') and level != 'Sector':
                                         val = row['Sector']

                                    if val and str(val).lower() != 'nan':
                                        item_map[sym] = val
            except Exception as e:
                print(f"Error with local Excel lookup: {e}")
            
            def fetch_info(sym):
                try:
                    # Check for OCC Option Symbol (e.g. BTBT260220C0000400)
                    # Format: Root(1-6 chars) + Year(2) + Month(2) + Day(2) + Type(C/P) + Strike(8)
                    import re
                    occ_match = re.match(r'^([A-Z]+)\d{6}[CP]\d{8}$', sym)
                    
                    target_sym = sym
                    if occ_match:
                        target_sym = occ_match.group(1) # Extract Root e.g. BTBT
                    
                    # Skip Currencies/Cash
                    if any(x in sym for x in ['CUR:', 'USD', 'CASH']):
                        return sym, 'Cash'
                        
                    tick = yf.Ticker(target_sym)
                    info = tick.info
                    
                    # Determine key based on requested Level
                    if level == 'Industry' or level == 'Sub-industry':
                        # YFinance 'industry' is the most granular available (often matches GICS Industry/Sub-industry)
                        res = info.get('industry', info.get('sector', 'Unknown'))
                    else:
                        res = info.get('sector', 'Unknown')
                        
                    return sym, res
                except:
                    return sym, 'Unknown'

            with ThreadPoolExecutor(max_workers=10) as executor:
                # Fetch info only for symbols not already found in Custom map
                missing_syms = [s for s in symbol_values.keys() if s not in item_map]
                if missing_syms:
                    results = executor.map(fetch_info, missing_syms)
                    for sym, cls in results:
                        item_map[sym] = cls
            
            # --- 3. Aggregate Portfolio Weights ---
            portfolio_allocation = {}
            for sym, val in symbol_values.items():
                cls = item_map.get(sym, 'Unknown')
                portfolio_allocation[cls] = portfolio_allocation.get(cls, 0.0) + val
            
            # Normalize to percentages
            portfolio_pct = {}
            if total_value > 0:
                for cls, val in portfolio_allocation.items():
                    portfolio_pct[cls] = val / total_value

            # --- 4. Benchmark Comparison (Approximation) ---
            benchmark_pct = {}
            
            # Hardcoded approximate weights (Q4 2024 estimates)
            # Hardcoded approximate weights (Q4 2024 estimates)
            # Updated to match US Stocks_Basic Data.xlsx keys
            SPY_SECTORS = {
                'Technology': 0.31, 'Financial': 0.13, 'Healthcare': 0.12, 
                'Consumer Cyclical': 0.10, 'Communication Services': 0.09, 'Industrials': 0.08,
                'Consumer Defensive': 0.06, 'Energy': 0.04, 'Utilities': 0.02, 
                'Real Estate': 0.02, 'Basic Materials': 0.02, 'Cash': 0.00
            }
            SPY_INDUSTRIES = { # Top 5-10 for display purposes
                'Software - Infrastructure': 0.12, 'Semiconductors': 0.10, 'Consumer Electronics': 0.07,
                'Internet Content & Information': 0.06, 'Banks - Diversified': 0.04
            }
             
            IWM_SECTORS = { # Russell 3000 approximation
                'Industrials': 0.18, 'Financial': 0.16, 'Healthcare': 0.15,
                'Technology': 0.13, 'Consumer Cyclical': 0.11, 'Real Estate': 0.06,
                'Energy': 0.06, 'Basic Materials': 0.04, 'Utilities': 0.03, 'Cash': 0.00
            }

            MSCI_WORLD_SECTORS = { # MSCI World Index
                'Technology': 0.24, 'Financial': 0.15, 'Healthcare': 0.12,
                'Industrials': 0.11, 'Consumer Cyclical': 0.11, 'Communication Services': 0.07,
                'Consumer Defensive': 0.07, 'Energy': 0.05, 'Basic Materials': 0.04,
                'Utilities': 0.03, 'Real Estate': 0.02, 'Cash': 0.00
            }

            if benchmark_symbol == 'SPY' or benchmark_symbol == 'S&P 500':
                benchmark_pct = SPY_INDUSTRIES if level != 'Sector' else SPY_SECTORS
            elif benchmark_symbol == 'IWM' or benchmark_symbol == 'Russell 3000':
                benchmark_pct = IWM_SECTORS
            elif benchmark_symbol == 'URTH' or benchmark_symbol == 'MSCI World':
                benchmark_pct = MSCI_WORLD_SECTORS
            
            # Normalize benchmark keys to match yfinance/Excel output
            # (In production, this needs a fuzzy matcher or standardized taxonomy)
            
            # --- 5. Construct Response ---
            # Merge all keys
            all_keys = set(portfolio_pct.keys()) | set(benchmark_pct.keys())
            
            final_data = []
            for k in all_keys:
                # Normalization check for benchmark keys if needed
                # (Already handled by updating SPY_SECTORS keys above)
                
                final_data.append({
                    'name': k,
                    'portfolio': portfolio_pct.get(k, 0.0),
                    'benchmark': benchmark_pct.get(k, 0.0),
                    'active': portfolio_pct.get(k, 0.0) - benchmark_pct.get(k, 0.0)
                })
            
            # Sort by portfolio weight, then benchmark weight
            final_data.sort(key=lambda x: (x['portfolio'], x['benchmark']), reverse=True)

            return jsonify({
                'success': True,
                'allocation': final_data,
                'total_value': total_value,
                'level': level,
                'benchmark': benchmark_symbol
            })

        except Exception as e:
            print(f"Sector allocation error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/accounting-analysis', methods=['POST'])
    def accounting_analysis():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            transactions = _convert_transactions_data(transactions_data)
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Use the advanced transaction analyzer for accounting analysis
            analyzer = AdvancedTransactionAnalyzer(data_client)
            result = analyzer.accounting_method_analysis(transactions, options)
            
            return jsonify({
                'success': True,
                'accounting_analysis': sanitize_for_json(result)
            })
            
        except Exception as e:
            print(f"Accounting analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500





    @app.route('/api/cost-analysis', methods=['POST'])
    def cost_analysis():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            
            data = request.get_json()
            print(f"[COST-ANALYSIS] Raw request data: {data}")
            
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            print(f"[COST-ANALYSIS] Transactions count: {len(transactions_data)}")
            print(f"[COST-ANALYSIS] Options: {options}")
            
            if not transactions_data:
                print(f"[COST-ANALYSIS] ERROR: No transaction data provided")
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            # Convert to Transaction objects using the helper function
            transactions = _convert_transactions_data(transactions_data)
            
            for i, transaction in enumerate(transactions):
                print(f"[COST-ANALYSIS] Successfully created transaction {i+1}: {transaction.symbol} {transaction.quantity} {transaction.transaction_type} on {transaction.date}")
            
            print(f"[COST-ANALYSIS] Total valid transactions created: {len(transactions)}")
            
            if not transactions:
                print(f"[COST-ANALYSIS] ERROR: No valid transactions found after processing")
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Use the advanced transaction analyzer with options
            analyzer = AdvancedTransactionAnalyzer(data_client)
            
            period = options.get('period', '1Y')
            breakdown = options.get('breakdown', 'By Symbol')
            benchmark = options.get('benchmark', 'Industry average')
            view = options.get('view', 'Absolute $')
            
            print(f"[COST-ANALYSIS] Calling analyzer with: period={period}, breakdown={breakdown}, benchmark={benchmark}, view={view}")
            print(f"[COST-ANALYSIS] Sample transaction: {transactions[0].__dict__ if transactions else 'No transactions'}")
            
            cost_result = analyzer.cost_analysis(
                transactions,
                period=period,
                breakdown=breakdown,
                benchmark=benchmark,
                view=view
            )
            
            print(f"[COST-ANALYSIS] Total costs: {cost_result.get('total_costs', 'N/A')}, Commissions: {cost_result.get('total_commissions', 'N/A')}")
            print(f"[COST-ANALYSIS] Breakdown count: {len(cost_result.get('breakdown', []))}")
            
            return jsonify({
                'success': True,
                'cost_analysis': sanitize_for_json(cost_result)
            })
            
        except Exception as e:
            print(f"[COST-ANALYSIS] Exception occurred: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500


    @app.route('/api/cash-flow-analysis', methods=['POST'])
    def cash_flow_analysis():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            # Convert to Transaction objects using the helper function
            transactions = _convert_transactions_data(transactions_data)
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Read parameters from frontend settings
            period = options.get('period', '1Y')
            flow_type = options.get('flow_type', 'Net')
            frequency = options.get('frequency', 'Daily')
            smoothing = options.get('smoothing', 'None')
            benchmark = options.get('benchmark', 'Cash yield')
            
            print(f"Cash Flow Analysis Parameters: period={period}, flow_type={flow_type}, frequency={frequency}, smoothing={smoothing}, benchmark={benchmark}")
            
            # Use the advanced transaction analyzer
            analyzer = AdvancedTransactionAnalyzer(data_client)
            cash_flow_result = analyzer.cash_flow_analysis(
                transactions,
                period=period,
                flow_type=flow_type,
                frequency=frequency,
                smoothing=smoothing,
                benchmark=benchmark
            )
            
            return jsonify({
                'success': True,
                'cash_flow_analysis': sanitize_for_json(cash_flow_result)
            })
            
        except Exception as e:
            print(f"Cash flow analysis error: {e}")
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
            
            # Handle lookback_period parameter - accept both string periods and integer days
            if isinstance(lookback_days, str):
                # Frontend sends string periods like '3M', '6M', '1Y', '2Y', '3Y'
                lookback_period = lookback_days
            elif isinstance(lookback_days, int):
                # Convert integer days to period format
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

    @app.route('/api/correlation-analysis', methods=['POST'])
    def correlation_analysis():
        try:
            from analytics.statistical_analysis import StatisticalAnalyzer
            
            data = request.get_json()
            portfolio_data = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio_data:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            symbols = extract_valid_symbols(portfolio_data)
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols found'}), 400
            
            # Read correlation-specific parameters
            period = options.get('period', '1Y')
            frequency = options.get('frequency', 'Daily')
            method = options.get('method', 'pearson')
            rolling_window = options.get('rolling_window', '30d')
            
            print(f"Correlation Analysis Parameters: period={period}, frequency={frequency}, method={method}, rolling_window={rolling_window}")
            print(f"Symbols: {symbols}")
            
            # Initialize analyzer
            analyzer = StatisticalAnalyzer(data_client)
            
            # Convert period format for correlation analysis
            period_map = {'1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '2Y': '2y'}
            api_period = period_map.get(period, '1y')
            
            # Run correlation analysis
            correlation_results = analyzer.correlation_analysis(symbols, api_period)
            
            if 'error' in correlation_results:
                print(f"Correlation analysis error: {correlation_results['error']}")
                return jsonify({'success': False, 'error': correlation_results['error']}), 500
            
            # Format results for frontend display
            formatted_results = {
                'correlation_matrix': correlation_results.get('correlation_matrix', {}),
                'summary': {
                    'average_correlation': correlation_results.get('avg_correlation', 0),
                    'max_correlation': correlation_results.get('max_correlation', 0),
                    'min_correlation': correlation_results.get('min_correlation', 0),
                    'symbols_analyzed': correlation_results.get('symbols_analyzed', len(symbols)),
                    'data_points': correlation_results.get('data_points', 0),
                    'period': period,
                    'frequency': frequency,
                    'method': method
                },
                'high_correlation_pairs': correlation_results.get('high_correlation_pairs', [])
            }
            
            print(f"Correlation analysis completed for {len(symbols)} symbols")
            return jsonify({
                'success': True,
                'correlation_analysis': sanitize_for_json(formatted_results)
            })
            
        except Exception as e:
            print(f"Correlation analysis error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500


