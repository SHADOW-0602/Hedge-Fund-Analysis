from flask import request, jsonify
import pandas as pd
import polars as pl
import numpy as np
from datetime import datetime
from clients.supabase_client import supabase_client
from core.portfolio import Portfolio
from analytics.risk_analytics import RiskAnalyzer
from analytics.options_analytics import OptionsAnalyzer
from monte_carlo_v3 import MonteCarloEngine
import numpy as np

def normalize_portfolio_format(df):
    if isinstance(df, pd.DataFrame):
        df_pl = pl.from_pandas(df)
    else:
        df_pl = df
    
    df_pl = df_pl.rename({col: col.lower().strip() for col in df_pl.columns})
    cols = df_pl.columns
    
    if 'symbol' in cols and 'quantity' in cols and 'price' in cols:
        df_pl = df_pl.select([
            pl.col('symbol'),
            pl.col('quantity').cast(pl.Float64),
            pl.col('price').alias('avg_cost').cast(pl.Float64)
        ])
    elif 'ticker' in cols:
        df_pl = df_pl.with_columns([pl.col('ticker').alias('symbol')])
        if 'shares' in cols:
            df_pl = df_pl.with_columns([pl.col('shares').alias('quantity').cast(pl.Float64)])
        if 'cost_basis' in cols:
            df_pl = df_pl.with_columns([pl.col('cost_basis').alias('avg_cost').cast(pl.Float64)])
        elif 'price' in cols:
            df_pl = df_pl.with_columns([pl.col('price').alias('avg_cost').cast(pl.Float64)])
    
    if 'symbol' not in df_pl.columns:
        df_pl = df_pl.with_columns([pl.col(df_pl.columns[0]).alias('symbol')])
    if 'quantity' not in df_pl.columns:
        df_pl = df_pl.with_columns([pl.lit(100.0).alias('quantity')])
    if 'avg_cost' not in df_pl.columns:
        df_pl = df_pl.with_columns([pl.lit(100.0).alias('avg_cost')])
    
    result = df_pl.select(['symbol', 'quantity', 'avg_cost']).to_pandas()
    return result

def register_portfolio_routes(app, data_client, smart_cache=None):
    # Register portfolio optimization route
    @app.route('/api/portfolio-optimization', methods=['POST'])
    def portfolio_optimization():
        try:
            from analytics.portfolio_optimization import PortfolioOptimizer
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Extract symbols
            symbols = []
            for position in portfolio:
                symbol = position.get('symbol')
                if symbol and not symbol.startswith('CUR:') and not symbol.startswith('CASH'):
                    symbols.append(symbol)
            
            if len(symbols) < 2:
                return jsonify({'success': False, 'error': 'Need at least 2 symbols for optimization'}), 400
            
            # Initialize optimizer
            optimizer = PortfolioOptimizer(data_client)
            
            # Perform optimization
            optimization_results = optimizer.optimize_portfolio(symbols[:10])  # Limit symbols
            
            return jsonify({
                'success': True,
                'optimization': optimization_results
            })
            
        except Exception as e:
            print(f"Portfolio optimization error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500
    
    risk_analyzer = RiskAnalyzer(data_client)
    options_analyzer = OptionsAnalyzer(data_client)
    mc_engine = MonteCarloEngine(data_client)
    
    @app.route('/api/test-optimization', methods=['GET'])
    def test_optimization():
        return jsonify({'success': True, 'message': 'Optimization route registered'})
    
    @app.route('/api/portfolio-optimization-full', methods=['POST'])
    def portfolio_optimization_full():
        try:
            print(f"Portfolio optimization endpoint called")
            from analytics.portfolio_optimization import PortfolioOptimizer
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            print(f"Received portfolio data: {portfolio}")
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Extract symbols
            symbols = []
            for position in portfolio:
                symbol = position.get('symbol')
                if symbol and not symbol.startswith('CUR:') and not symbol.startswith('CASH'):
                    symbols.append(symbol)
            
            print(f"Extracted symbols: {symbols}")
            if len(symbols) < 2:
                return jsonify({'success': False, 'error': 'Need at least 2 symbols for optimization'}), 400
            
            # Initialize optimizer
            optimizer = PortfolioOptimizer(data_client)
            print(f"Optimizer initialized")
            
            # Perform optimization
            optimization_results = optimizer.optimize_portfolio(symbols)
            print(f"Optimization completed: {optimization_results}")
            
            return jsonify({
                'success': True,
                'optimization': optimization_results
            })
            
        except Exception as e:
            print(f"Portfolio optimization error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/upload-portfolio', methods=['POST'])
    def upload_portfolio():
        try:
            print(f"2025-10-26 16:55:43,000 - hedge_fund_app - INFO - Received portfolio file upload request")
            if 'file' not in request.files:
                return jsonify({'success': False, 'error': 'No file uploaded'}), 400
            
            file = request.files['file']
            if not file.filename:
                return jsonify({'success': False, 'error': 'No file selected'}), 400
            
            user_id = request.form.get('user_id', 'default')
            
            if supabase_client and supabase_client.client:
                try:
                    file_content = file.stream.read()
                    supabase_client.client.table('uploaded_files').insert({
                        'user_id': user_id,
                        'filename': file.filename,
                        'file_content': file_content.decode('utf-8') if file.filename.lower().endswith('.csv') else str(file_content),
                        'file_type': 'portfolio',
                        'created_at': datetime.now().isoformat()
                    }).execute()
                    file.stream.seek(0)
                except Exception as e:
                    print(f"File save error: {e}")
            
            if file.filename.lower().endswith('.csv'):
                df = pd.read_csv(file.stream)
            elif file.filename.lower().endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file.stream)
            else:
                return jsonify({'success': False, 'error': 'Unsupported file format'}), 400
            
            df = normalize_portfolio_format(df)
            portfolio_data = df.to_dict('records')
            
            print(f"2025-10-26 16:55:43,500 - hedge_fund_app - INFO - Portfolio file upload completed successfully")
            return jsonify({
                'success': True,
                'portfolio': portfolio_data,
                'filename': file.filename
            })
        except Exception as e:
            print(f"2025-10-26 16:55:43,600 - hedge_fund_app - ERROR - Portfolio upload failed: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/analyze-risk', methods=['POST'])
    def analyze_risk():
        try:
            print(f"2025-10-26 16:55:44,800 - hedge_fund_app - INFO - Received risk analysis request")
            data = request.get_json()
            portfolio_data = data.get('portfolio', [])
            user_role = data.get('user_role', 'user')  # Default to 'user' instead of 'viewer'
            print(f"2025-10-26 16:55:44,801 - hedge_fund_app - INFO - Portfolio has {len(portfolio_data)} positions")
            
            # Allow all requests - remove permission check
            # if user_role.lower() not in ['admin', 'user']:
            #     return jsonify({'success': False, 'error': 'Insufficient permissions'}), 403
            
            if not portfolio_data:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Clean and filter symbols
            symbols = []
            for p in portfolio_data:
                if isinstance(p, dict) and 'symbol' in p:
                    symbol = p.get('symbol', '').strip()
                    # Filter out invalid symbols
                    if symbol and not symbol.startswith('CUR:') and not symbol.startswith('CASH') and len(symbol) <= 10:
                        symbols.append(symbol)
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols found'}), 400
            
            # Filter out invalid symbols from portfolio_data
            filtered_portfolio_data = []
            for position in portfolio_data:
                symbol = position.get('symbol', '').strip()
                if symbol and not symbol.startswith('CUR:') and not symbol.startswith('CASH') and len(symbol) <= 10:
                    filtered_portfolio_data.append(position)
            
            if not filtered_portfolio_data:
                return jsonify({'success': False, 'error': 'No valid positions found after filtering'}), 400
            
            # Update symbols list with filtered data
            symbols = [p.get('symbol', '') for p in filtered_portfolio_data]
            
            # Calculate portfolio value with current prices
            print(f"2025-10-26 16:55:44,802 - hedge_fund_app - INFO - Fetching current prices for portfolio valuation")
            current_prices = data_client.get_current_prices(symbols)
            total_value = 0
            
            for position in filtered_portfolio_data:
                symbol = position.get('symbol', '')
                quantity = float(position.get('quantity', 0))
                current_price = current_prices.get(symbol, 0)
                total_value += quantity * current_price
            
            print(f"2025-10-26 16:55:44,803 - hedge_fund_app - INFO - Portfolio total value calculated: ${total_value:,.2f}")
                
            # Calculate fresh risk metrics without caching
            
            df = pd.DataFrame(filtered_portfolio_data)
            portfolio = Portfolio.from_dataframe(df)
            weights = portfolio.get_weights()
            metrics = risk_analyzer.analyze_portfolio_risk_fast(list(portfolio.symbols), weights)
            
            if not isinstance(metrics, dict):
                metrics = risk_analyzer._empty_risk_metrics()
            
            # Add portfolio value to metrics
            metrics['portfolio_value'] = total_value
            metrics['current_prices'] = current_prices
            
            # No caching - return fresh calculated metrics
            
            def convert_numpy(obj):
                if isinstance(obj, np.ndarray):
                    return obj.item() if obj.size == 1 else obj.tolist()
                elif isinstance(obj, (np.integer, np.floating)):
                    val = float(obj)
                    # Handle NaN and infinity values
                    if np.isnan(val) or np.isinf(val):
                        return 0.0
                    return val
                elif isinstance(obj, dict):
                    return {k: convert_numpy(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_numpy(v) for v in obj]
                elif hasattr(obj, 'item'):  # Handle numpy scalars
                    val = float(obj.item())
                    if np.isnan(val) or np.isinf(val):
                        return 0.0
                    return val
                elif isinstance(obj, float):
                    if np.isnan(obj) or np.isinf(obj):
                        return 0.0
                    return obj
                return obj
            
            metrics = convert_numpy(metrics)
            
            # Final cleanup - ensure all values are JSON serializable
            def clean_value(val):
                if isinstance(val, (int, float)):
                    if np.isnan(val) or np.isinf(val):
                        return 0.0
                    return val
                elif isinstance(val, dict):
                    return {k: clean_value(v) for k, v in val.items()}
                elif isinstance(val, list):
                    return [clean_value(v) for v in val]
                return val
            
            metrics = clean_value(metrics)
            print(f"2025-10-26 16:55:48,500 - hedge_fund_app - INFO - Risk analysis API response sent successfully")
            return jsonify({'success': True, 'risk_metrics': metrics})
        except Exception as e:
            print(f"2025-10-26 16:55:48,600 - hedge_fund_app - ERROR - Risk analysis failed: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/scan-options', methods=['POST'])
    def scan_options():
        try:
            print(f"2025-10-26 16:55:46,000 - hedge_fund_app - INFO - Received options scan request")
            data = request.get_json()
            
            # Handle both 'symbols' array and 'portfolio' array
            symbols = data.get('symbols', [])
            if not symbols and 'portfolio' in data:
                symbols = [p.get('symbol') for p in data['portfolio'] if p.get('symbol')]
            
            print(f"2025-10-26 16:55:46,001 - hedge_fund_app - INFO - Scanning options for {len(symbols)} symbols: {symbols}")
            
            # More lenient symbol filtering
            valid_symbols = []
            for symbol in symbols:
                if symbol and isinstance(symbol, str) and len(symbol) <= 10:
                    # Remove common prefixes and clean symbol
                    clean_symbol = symbol.strip().upper()
                    if not clean_symbol.startswith('CUR:') and not clean_symbol.startswith('CASH'):
                        valid_symbols.append(clean_symbol)
                else:
                    print(f"Options: Filtering out {symbol} (not valid for options)")
            
            print(f"Options: Valid symbols for scanning: {valid_symbols}")
            if not valid_symbols:
                # Return success with empty results instead of error
                return jsonify({
                    'success': True,
                    'opportunities': [],
                    'summary': {
                        'covered_calls': {'count': 0, 'total_premium': 0},
                        'protective_puts': {'count': 0, 'total_cost': 0},
                        'iron_condors': {'count': 0, 'total_premium': 0}
                    }
                })
            
            opportunities = options_analyzer.scan_all_strategies(valid_symbols)
            summary = options_analyzer.get_strategy_summary(valid_symbols)
            
            # Convert numpy types to JSON serializable
            def convert_numpy(obj):
                if isinstance(obj, np.ndarray):
                    return obj.item() if obj.size == 1 else obj.tolist()
                elif isinstance(obj, (np.integer, np.floating)):
                    val = float(obj)
                    if np.isnan(val) or np.isinf(val):
                        return 0.0
                    return val
                elif isinstance(obj, dict):
                    return {k: convert_numpy(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_numpy(v) for v in obj]
                elif hasattr(obj, 'item'):  # Handle numpy scalars
                    val = float(obj.item())
                    if np.isnan(val) or np.isinf(val):
                        return 0.0
                    return val
                elif isinstance(obj, float):
                    if np.isnan(obj) or np.isinf(obj):
                        return 0.0
                    return obj
                return obj
            
            opportunities = convert_numpy(opportunities)
            summary = convert_numpy(summary)
            
            print(f"2025-10-26 16:55:47,500 - hedge_fund_app - INFO - Options scan completed successfully")
            return jsonify({
                'success': True,
                'opportunities': opportunities,
                'summary': summary
            })
        except Exception as e:
            print(f"2025-10-26 16:55:47,600 - hedge_fund_app - ERROR - Options scan failed: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/monte-carlo', methods=['POST'])
    def monte_carlo():
        try:
            data = request.get_json()
            portfolio_data = data.get('portfolio', [])
            user_role = data.get('user_role', 'user')  # Default to 'user'
            
            # Remove permission check - allow all requests
            # if user_role.lower() not in ['admin', 'user']:
            #     return jsonify({'success': False, 'error': 'Insufficient permissions'}), 403
            
            if not portfolio_data:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Filter out invalid symbols (options contracts, currency, etc.)
            filtered_portfolio_data = []
            for position in portfolio_data:
                symbol = position.get('symbol', '').strip()
                # Only filter out obvious non-tradeable symbols
                is_valid = (symbol and 
                           not symbol.startswith('CUR:') and 
                           not symbol.startswith('CASH'))
                if is_valid:
                    filtered_portfolio_data.append(position)
                else:
                    print(f"Monte Carlo: Filtering out {symbol} (invalid for simulation)")
            
            if not filtered_portfolio_data:
                return jsonify({'success': False, 'error': 'No valid symbols for Monte Carlo simulation'}), 400
            
            df = pd.DataFrame(filtered_portfolio_data)
            portfolio = Portfolio.from_dataframe(df)
            weights = portfolio.get_weights()
            symbols = list(portfolio.symbols)[:10]
            
            results = mc_engine.portfolio_simulation(
                symbols, weights, time_horizon=63, num_simulations=1000
            )
            
            print(f"Monte Carlo simulation completed successfully")
            return jsonify({'success': True, 'results': results})
        except Exception as e:
            print(f"Monte Carlo error: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/save-portfolio', methods=['POST'])
    def save_portfolio():
        try:
            data = request.get_json()
            user_id = data.get('user_id')
            portfolio_name = data.get('portfolio_name')
            portfolio_data = data.get('portfolio_data')
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            if not user_id or not portfolio_name or not portfolio_data:
                return jsonify({'success': False, 'error': 'Missing required fields'}), 400
            
            result = supabase_client.client.table('portfolios').insert({
                'user_id': user_id,
                'portfolio_name': portfolio_name,
                'portfolio_data': portfolio_data,
                'created_at': datetime.now().isoformat()
            }).execute()
            
            if result.data:
                return jsonify({'success': True, 'portfolio_id': result.data[0]['id']})
            else:
                return jsonify({'success': False, 'error': 'Failed to save portfolio'}), 500
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/load-portfolios', methods=['GET'])
    def load_portfolios():
        try:
            user_id = request.args.get('user_id')
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': True, 'portfolios': []})
            
            try:
                result = supabase_client.client.table('portfolios').select('*').eq('user_id', user_id).execute()
                portfolios = result.data or []
                
                for portfolio in portfolios:
                    portfolio['has_analytics'] = bool(portfolio.get('analytics_data'))
                    
            except Exception:
                return jsonify({'success': True, 'portfolios': []})
            
            return jsonify({'success': True, 'portfolios': portfolios})
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/delete-portfolio', methods=['DELETE'])
    def delete_portfolio():
        try:
            data = request.get_json()
            portfolio_id = data.get('portfolio_id')
            user_id = request.headers.get('X-User-ID')
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            if not portfolio_id or not user_id:
                return jsonify({'success': False, 'error': 'Missing portfolio ID or user ID'}), 400
            
            result = supabase_client.client.table('portfolios').delete().eq('id', portfolio_id).eq('user_id', user_id).execute()
            
            if result.data:
                return jsonify({'success': True, 'message': 'Portfolio deleted successfully'})
            else:
                return jsonify({'success': False, 'error': 'Portfolio not found or access denied'}), 404
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    

    
    @app.route('/api/performance-attribution', methods=['POST'])
    def performance_attribution():
        try:
            from analytics.performance_attribution import PerformanceAttributor
            data = request.get_json()
            portfolio_data = data.get('portfolio', [])
            if not portfolio_data:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            symbols = [p.get('symbol') for p in portfolio_data]
            weights = {p.get('symbol'): p.get('quantity', 0) * p.get('avg_cost', 0) for p in portfolio_data}
            total_value = sum(weights.values())
            if total_value <= 0:
                return jsonify({'success': False, 'error': 'Invalid portfolio weights'}), 400
            weights = {k: v/total_value for k, v in weights.items()}
            
            attributor = PerformanceAttributor(data_client)
            results = attributor.factor_based_attribution(symbols[:10], weights)  # Increased limit
            return jsonify({'success': True, 'results': results})
        except Exception as e:
            print(f"Performance attribution error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/technical-analysis', methods=['POST'])
    def technical_analysis():
        try:
            from analytics.technical_indicators import TechnicalAnalyzer
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            symbols = []
            weights = {}
            total_value = 0
            
            # Filter out options contracts and invalid symbols
            def is_valid_stock_symbol(symbol):
                if not symbol or not isinstance(symbol, str):
                    return False
                symbol = symbol.strip().upper()
                # Filter out options contracts (contain dates/strikes), currency, cash
                if (symbol.startswith('CUR:') or symbol.startswith('CASH') or 
                    len(symbol) > 10 or any(char.isdigit() for char in symbol[-8:])):
                    return False
                return True
            
            for position in portfolio:
                symbol = position.get('symbol', '').strip().upper()
                quantity = float(position.get('quantity', 0))
                price = float(position.get('avg_cost') or position.get('price', 0))
                
                if is_valid_stock_symbol(symbol) and quantity != 0 and price != 0:
                    symbols.append(symbol)
                    value = quantity * price
                    total_value += value
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid stock symbols for technical analysis'}), 400
            
            for position in portfolio:
                symbol = position.get('symbol', '').strip().upper()
                quantity = float(position.get('quantity', 0))
                price = float(position.get('avg_cost') or position.get('price', 0))
                
                if is_valid_stock_symbol(symbol) and quantity != 0 and price != 0:
                    value = quantity * price
                    weights[symbol] = value / total_value if total_value > 0 else 0
            
            technical_analyzer = TechnicalAnalyzer(data_client)
            technical_metrics = technical_analyzer.analyze_portfolio_technical(symbols, weights)
            
            return jsonify({
                'success': True,
                'technical_metrics': technical_metrics
            })
            
        except Exception as e:
            print(f"Technical analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/backtest-portfolio', methods=['POST'])
    def backtest_portfolio():
        try:
            from analytics.backtesting_engine import BacktestingEngine
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Extract symbols and weights, filtering out invalid symbols
            symbols = []
            weights = {}
            total_value = 0
            
            for position in portfolio:
                symbol = position.get('symbol', '').strip()
                quantity = float(position.get('quantity', 0))
                price = float(position.get('avg_cost') or position.get('price', 0))
                
                # Filter out options contracts, currency symbols, etc.
                if (symbol and quantity != 0 and price != 0 and 
                    not symbol.startswith('CUR:') and not symbol.startswith('CASH') and 
                    len(symbol) <= 10):
                    symbols.append(symbol)
                    value = quantity * price
                    total_value += value
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols for backtesting'}), 400
            
            # Calculate weights
            for position in portfolio:
                symbol = position.get('symbol', '').strip()
                quantity = float(position.get('quantity', 0))
                price = float(position.get('avg_cost') or position.get('price', 0))
                
                if (symbol and quantity != 0 and price != 0 and 
                    not symbol.startswith('CUR:') and not symbol.startswith('CASH') and 
                    len(symbol) <= 10):
                    value = quantity * price
                    weights[symbol] = value / total_value if total_value > 0 else 0
            
            # Initialize backtesting engine
            backtesting_engine = BacktestingEngine(data_client)
            
            # Perform backtesting
            backtest_results = backtesting_engine.calculate_portfolio_backtest(symbols, weights)
            
            return jsonify({
                'success': True,
                'backtest_results': backtest_results
            })
            
        except Exception as e:
            print(f"Backtesting error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/statistical-analysis', methods=['POST'])
    def statistical_analysis():
        try:
            import yfinance as yf
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Extract symbols and calculate weights
            symbols = []
            weights = []
            total_value = 0
            
            for position in portfolio:
                symbol = position.get('symbol')
                quantity = float(position.get('quantity', 0))
                price = float(position.get('avg_cost') or position.get('price', 0))
                
                if symbol and quantity != 0 and price != 0:
                    symbols.append(symbol)
                    value = quantity * price
                    total_value += value
            
            # Calculate normalized weights
            for position in portfolio:
                symbol = position.get('symbol')
                quantity = float(position.get('quantity', 0))
                price = float(position.get('avg_cost') or position.get('price', 0))
                
                if symbol and quantity != 0 and price != 0:
                    value = quantity * price
                    weight = value / total_value if total_value > 0 else 0
                    weights.append(weight)
            
            if len(symbols) < 2:
                return jsonify({'success': False, 'error': 'Need at least 2 symbols for statistical analysis'}), 400
            
            # Get historical data and calculate correlations
            price_data = {}
            for symbol in symbols[:10]:  # Limit API calls
                try:
                    ticker = yf.Ticker(symbol)
                    hist = ticker.history(period='1y')
                    if not hist.empty and len(hist) > 30:
                        returns = hist['Close'].pct_change().dropna()
                        if len(returns) > 30:
                            price_data[symbol] = returns
                except:
                    continue
            
            if len(price_data) < 2:
                return jsonify({'success': False, 'error': 'Insufficient price data'}), 400
            
            # Calculate correlation matrix
            df = pd.DataFrame(price_data).dropna()
            correlation_matrix = df.corr()
            
            # Calculate average correlation (excluding diagonal)
            mask = np.triu(np.ones_like(correlation_matrix, dtype=bool), k=1)
            avg_correlation = correlation_matrix.where(mask).stack().mean()
            
            # Calculate diversification ratio
            portfolio_weights = np.array(weights[:len(df.columns)])
            portfolio_weights = portfolio_weights / portfolio_weights.sum()  # Normalize
            
            individual_vols = df.std() * np.sqrt(252)
            weighted_avg_vol = np.sum(portfolio_weights * individual_vols)
            
            cov_matrix = df.cov() * 252
            portfolio_vol = np.sqrt(np.dot(portfolio_weights.T, np.dot(cov_matrix, portfolio_weights)))
            
            diversification_ratio = weighted_avg_vol / portfolio_vol if portfolio_vol > 0 else 1.0
            
            # Calculate concentration (Herfindahl index)
            concentration = np.sum(portfolio_weights ** 2)
            if concentration > 0.25:
                concentration_level = 'High'
            elif concentration > 0.15:
                concentration_level = 'Moderate'
            else:
                concentration_level = 'Low'
            
            results = {
                'avg_correlation': float(avg_correlation) if not np.isnan(avg_correlation) else None,
                'diversification_ratio': float(diversification_ratio) if not np.isnan(diversification_ratio) else None,
                'concentration_level': concentration_level,
                'concentration_index': float(concentration)
            }
            
            return jsonify({'success': True, 'results': results})
            
        except Exception as e:
            print(f"Statistical analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/sector-analysis', methods=['POST'])
    def sector_analysis():
        try:
            from analytics.sector_analysis import SectorAnalyzer
            data = request.get_json()
            portfolio_data = data.get('portfolio', [])
            if not portfolio_data:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            symbols = [p.get('symbol') for p in portfolio_data]
            weights = {p.get('symbol'): p.get('quantity', 0) * p.get('avg_cost', 0) for p in portfolio_data}
            total_value = sum(weights.values())
            if total_value <= 0:
                return jsonify({'success': False, 'error': 'Invalid portfolio weights'}), 400
            weights = {k: v/total_value for k, v in weights.items()}
            
            analyzer = SectorAnalyzer(data_client)
            results = analyzer.analyze_sector_allocation(symbols, weights)
            return jsonify({'success': True, 'results': results})
        except Exception as e:
            print(f"Sector analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/sector-data', methods=['POST'])
    def get_sector_data():
        try:
            import yfinance as yf
            data = request.get_json()
            symbols = data.get('symbols', [])
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No symbols provided'}), 400
            
            sector_data = {}
            
            for symbol in symbols[:20]:  # Limit to prevent API overload
                try:
                    ticker = yf.Ticker(symbol)
                    info = ticker.info
                    
                    # Get comprehensive info from Yahoo Finance
                    sector = info.get('sector', '')
                    industry = info.get('industry', '')
                    business_summary = info.get('longBusinessSummary', '')
                    
                    # Only use Yahoo Finance sector data, no fallback mappings
                    mapped_sector = None
                    
                    # Enhanced sector mapping with better coverage
                    if sector and sector != 'N/A':
                        sector_lower = sector.lower()
                        if any(x in sector_lower for x in ['technology', 'software', 'internet', 'computer', 'semiconductor', 'electronic']):
                            mapped_sector = 'Technology'
                        elif any(x in sector_lower for x in ['communication', 'media', 'entertainment', 'telecom']):
                            mapped_sector = 'Communication Services'
                        elif any(x in sector_lower for x in ['consumer discretionary', 'consumer cyclical', 'retail', 'automotive']):
                            mapped_sector = 'Consumer Discretionary'
                        elif any(x in sector_lower for x in ['consumer staples', 'consumer defensive']):
                            mapped_sector = 'Consumer Staples'
                        elif any(x in sector_lower for x in ['healthcare', 'biotechnology', 'medical', 'pharmaceutical', 'drug']):
                            mapped_sector = 'Healthcare'
                        elif any(x in sector_lower for x in ['financial', 'bank', 'insurance', 'capital markets', 'credit']):
                            mapped_sector = 'Financials'
                        elif any(x in sector_lower for x in ['energy', 'oil', 'gas', 'petroleum']):
                            mapped_sector = 'Energy'
                        elif any(x in sector_lower for x in ['industrial', 'manufacturing', 'aerospace', 'defense', 'machinery']):
                            mapped_sector = 'Industrials'
                        elif any(x in sector_lower for x in ['materials', 'chemical', 'mining', 'metals', 'paper']):
                            mapped_sector = 'Materials'
                        elif any(x in sector_lower for x in ['utilities', 'electric', 'water', 'gas utilities']):
                            mapped_sector = 'Utilities'
                        elif any(x in sector_lower for x in ['real estate', 'reit']):
                            mapped_sector = 'Real Estate'
                    
                    # Enhanced industry mapping as fallback
                    if not mapped_sector and industry and industry != 'N/A':
                        industry_lower = industry.lower()
                        if any(x in industry_lower for x in ['software', 'technology', 'internet', 'computer', 'semiconductor', 'electronic', 'information technology']):
                            mapped_sector = 'Technology'
                        elif any(x in industry_lower for x in ['bank', 'financial', 'insurance', 'investment', 'capital markets', 'credit', 'mortgage']):
                            mapped_sector = 'Financials'
                        elif any(x in industry_lower for x in ['retail', 'consumer', 'restaurant', 'auto', 'footwear', 'apparel', 'leisure']):
                            mapped_sector = 'Consumer Discretionary'
                        elif any(x in industry_lower for x in ['healthcare', 'pharmaceutical', 'biotechnology', 'medical', 'drug', 'hospital']):
                            mapped_sector = 'Healthcare'
                        elif any(x in industry_lower for x in ['oil', 'gas', 'energy', 'petroleum', 'renewable']):
                            mapped_sector = 'Energy'
                        elif any(x in industry_lower for x in ['manufacturing', 'industrial', 'aerospace', 'defense', 'machinery', 'transportation']):
                            mapped_sector = 'Industrials'
                        elif any(x in industry_lower for x in ['chemical', 'materials', 'mining', 'metals', 'steel', 'aluminum']):
                            mapped_sector = 'Materials'
                        elif any(x in industry_lower for x in ['utilities', 'electric', 'water', 'gas distribution']):
                            mapped_sector = 'Utilities'
                        elif any(x in industry_lower for x in ['real estate', 'reit', 'property']):
                            mapped_sector = 'Real Estate'
                        elif any(x in industry_lower for x in ['media', 'entertainment', 'broadcasting', 'telecom', 'wireless']):
                            mapped_sector = 'Communication Services'
                        elif any(x in industry_lower for x in ['food', 'beverage', 'tobacco', 'household', 'personal products']):
                            mapped_sector = 'Consumer Staples'
                    
                    sector_data[symbol] = mapped_sector
                    print(f"Mapped {symbol}: sector='{sector}', industry='{industry}' -> {mapped_sector}")
                        
                except Exception as e:
                    print(f"Error fetching sector for {symbol}: {e}")
                    sector_data[symbol] = None
            
            return jsonify({
                'success': True,
                'sector_data': sector_data
            })
            
        except Exception as e:
            print(f"Sector data API error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    

    
    @app.route('/api/correlation-data', methods=['POST'])
    def get_correlation_data():
        try:
            import yfinance as yf
            import pandas as pd
            import numpy as np
            
            data = request.get_json()
            symbols = data.get('symbols', [])
            
            if not symbols or len(symbols) < 2:
                return jsonify({'success': False, 'error': 'Need at least 2 symbols for correlation'}), 400
            
            symbols = symbols[:10]  # Limit to prevent API overload
            
            # Filter out invalid symbols first
            valid_symbols = [s for s in symbols if s and not s.startswith('CUR:') and not s.startswith('CASH') and len(s) <= 10]
            
            if len(valid_symbols) < 2:
                return jsonify({'success': False, 'error': 'Need at least 2 valid symbols'}), 400
            
            # Fetch historical price data with multiple attempts
            price_data = {}
            for symbol in valid_symbols:
                try:
                    ticker = yf.Ticker(symbol)
                    # Try different periods if 1y fails
                    for period in ['1y', '6mo', '3mo']:
                        try:
                            hist = ticker.history(period=period)
                            if not hist.empty and len(hist) > 30:
                                returns = hist['Close'].pct_change().dropna()
                                if len(returns) > 30:
                                    price_data[symbol] = returns
                                    print(f"Successfully fetched {len(returns)} data points for {symbol}")
                                    break
                        except:
                            continue
                    
                    if symbol not in price_data:
                        print(f"No sufficient data found for {symbol}")
                        
                except Exception as e:
                    print(f"Error fetching data for {symbol}: {e}")
            
            if len(price_data) < 2:
                return jsonify({'success': False, 'error': 'Insufficient price data for correlation'}), 400
            
            # Align data to common dates and calculate correlation matrix
            df = pd.DataFrame(price_data)
            df = df.dropna()  # Remove rows with any NaN values
            
            if df.empty or len(df) < 30:
                return jsonify({'success': False, 'error': 'Insufficient overlapping price data'}), 400
            
            correlation_matrix = df.corr()
            
            # Convert to dictionary format, ensuring valid correlations
            corr_dict = {}
            for symbol1 in correlation_matrix.index:
                corr_dict[symbol1] = {}
                for symbol2 in correlation_matrix.columns:
                    corr_value = correlation_matrix.loc[symbol1, symbol2]
                    if np.isnan(corr_value):
                        corr_dict[symbol1][symbol2] = 1.0 if symbol1 == symbol2 else 0.0
                    else:
                        corr_dict[symbol1][symbol2] = float(corr_value)
            
            # Calculate average correlation (excluding diagonal)
            mask = np.triu(np.ones_like(correlation_matrix, dtype=bool), k=1)
            avg_correlation = correlation_matrix.where(mask).stack().mean()
            avg_correlation = float(avg_correlation) if not np.isnan(avg_correlation) else 0.0
            
            return jsonify({
                'success': True,
                'correlation_matrix': corr_dict,
                'average_correlation': avg_correlation
            })
            
        except Exception as e:
            print(f"Correlation data API error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500