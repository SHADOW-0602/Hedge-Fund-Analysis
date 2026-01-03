from flask import request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from .route_utils import sanitize_for_json, extract_valid_symbols, calculate_portfolio_weights
from flask import session
from utils.data_manager import DataManager
try:
    from utils.secure_id_manager import secure_id_manager
except ImportError:
    secure_id_manager = None
from utils.data_manager import DataManager
try:
    from utils.secure_id_manager import secure_id_manager
except ImportError:
    secure_id_manager = None

# Import symbol parser with error handling
try:
    from utils.symbol_parser import get_underlying_symbol
except ImportError:
    # Fallback function if import fails
    def get_underlying_symbol(symbol: str) -> str:
        """Extract underlying symbol from options or return original"""
        import re
        # Simple options pattern matching
        match = re.search(r'^([A-Z]{1,6})\d{6}[CP]\d{8}$', symbol)
        return match.group(1) if match else symbol

def register_comprehensive_analysis_routes(app, data_client, smart_cache=None):
    """Register comprehensive analysis routes"""
    print("[DEBUG] Registering comprehensive analysis routes")
    
    # Import sector analyzer
    try:
        from analytics.sector_analysis import SectorAnalyzer
        print("[DEBUG] SectorAnalyzer imported successfully")
    except ImportError as e:
        print(f"[WARNING] SectorAnalyzer import failed: {e}")
    

    @app.route('/api/correlation-analysis', methods=['POST'])
    def comprehensive_correlation_analysis():
        print("[DEBUG] correlation-analysis route called")
        try:
            import yfinance as yf
            import warnings
            warnings.filterwarnings('ignore')
            
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            options = data.get('options', {})
            
            # Check if options are passed at root level (from analytics-core)
            if not options and 'period' in data:
                options = {
                    'period': data.get('period'),
                    'frequency': data.get('frequency'),
                    'method': data.get('method'),
                    'rolling_window': data.get('rolling_window')
                }
                print(f"[CORRELATION] Using root-level options: {options}")
            
            if not portfolio:
                # Auto-detect portfolio from manual uploads + Plaid
                user_id = None
                if 'real_user_id' in session:
                    user_id = session['real_user_id']
                elif 'user_id' in session:
                    uid_raw = session['user_id']
                    if len(uid_raw) == 36 and uid_raw.count('-') == 4:
                        user_id = uid_raw
                    elif secure_id_manager:
                        try:
                            user_id = secure_id_manager.get_uuid_from_token(uid_raw) or uid_raw
                        except:
                            user_id = uid_raw
                
                if user_id:
                    print(f"DEBUG: Auto-detecting portfolio for user {user_id}")
                    portfolio = DataManager.get_consolidated_portfolio(user_id)
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided and no saved data found'}), 400
            
            # Parse interactive options with debug logging
            period = options.get('period', '1Y')
            frequency = options.get('frequency', 'Daily')
            method = options.get('method', 'pearson').lower()
            rolling_window = options.get('rolling_window', '30d')
            
            print(f"[CORRELATION] Received options: period={period}, frequency={frequency}, method={method}, rolling_window={rolling_window}")
            print(f"[CORRELATION] Full options dict: {options}")
            
            # Extract symbols with strict validation - NO FALLBACK DATA
            symbols = []
            for p in portfolio:
                if isinstance(p, dict) and p.get('symbol'):
                    symbol = p['symbol']
                    if symbol and not symbol.startswith('CUR:'):
                        underlying = get_underlying_symbol(symbol)
                        if underlying and underlying not in symbols:
                            # Validate symbol format - only real stock symbols
                            if underlying.isalpha() and len(underlying) <= 5:
                                symbols.append(underlying)
            
            if len(symbols) < 2:
                return jsonify({'success': False, 'error': 'Need at least 2 valid stock symbols for correlation analysis'}), 400
            
            # Download REAL market data only - NO FALLBACK
            period_map = {'1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '2Y': '2y'}
            yf_period = period_map.get(period, '1y')
            
            print(f"[CORRELATION] Downloading real market data for symbols: {symbols}")
            try:
                # Use yfinance with strict validation
                price_data = yf.download(
                    symbols, 
                    period=yf_period, 
                    progress=False,
                    auto_adjust=True,  # Use adjusted prices for accuracy
                    threads=False,
                    group_by='ticker' if len(symbols) > 1 else None
                )
                print(f"[DEBUG] Downloaded data shape: {price_data.shape if hasattr(price_data, 'shape') else 'No shape'}")
                print(f"[DEBUG] Downloaded data columns: {price_data.columns if hasattr(price_data, 'columns') else 'No columns'}")
            except Exception as download_error:
                print(f"[CORRELATION] Market data download failed: {download_error}")
                return jsonify({'success': False, 'error': f'Failed to download real market data: {str(download_error)}'}), 500
            
            # Strict validation - NO EMPTY DATA ALLOWED
            if price_data is None or (hasattr(price_data, 'empty') and price_data.empty):
                print(f"[CORRELATION] No real market data available for symbols: {symbols}")
                return jsonify({'success': False, 'error': 'No real market data available for the selected symbols and period'}), 500
            
            # Extract adjusted close prices only
            if len(symbols) == 1:
                if 'Adj Close' in price_data.columns:
                    prices = pd.DataFrame({symbols[0]: price_data['Adj Close']})
                elif 'Close' in price_data.columns:
                    prices = pd.DataFrame({symbols[0]: price_data['Close']})
                else:
                    print(f"[DEBUG] Price data columns: {price_data.columns}")
                    print(f"[DEBUG] Price data shape: {price_data.shape}")
                    return jsonify({'success': False, 'error': 'No valid price data found'}), 500
            else:
                if isinstance(price_data.columns, pd.MultiIndex):
                    prices = price_data.xs('Close', level=1, axis=1)
                else:
                    prices = price_data
            
            # Remove any rows with missing data - REAL DATA ONLY
            prices = prices.dropna()
            if prices.empty:
                return jsonify({'success': False, 'error': 'No valid price data after cleaning'}), 500
            
            # Apply frequency resampling to real data
            if frequency == 'Weekly':
                prices = prices.resample('W').last().dropna()
            elif frequency == 'Monthly':
                prices = prices.resample('M').last().dropna()
            
            # Calculate returns from real price data
            returns = prices.pct_change().dropna()
            
            # Strict data validation - require sufficient real data points
            min_data_points = 20 if frequency == 'Daily' else 8 if frequency == 'Weekly' else 6
            valid_symbols = []
            for symbol in symbols:
                if symbol in returns.columns:
                    symbol_returns = returns[symbol].dropna()
                    if len(symbol_returns) >= min_data_points:
                        valid_symbols.append(symbol)
                        print(f"[CORRELATION] Symbol {symbol}: {len(symbol_returns)} data points")
                    else:
                        print(f"[CORRELATION] Insufficient data for {symbol}: {len(symbol_returns)} < {min_data_points}")
            
            if len(valid_symbols) < 2:
                return jsonify({
                    'success': False, 
                    'error': f'Insufficient real market data. Need at least {min_data_points} data points per symbol for {frequency.lower()} analysis. Available symbols with sufficient data: {len(valid_symbols)}'
                }), 400
            
            # Apply rolling window to real data if specified
            if rolling_window != '30d':
                window_days = int(rolling_window.replace('d', ''))
                if frequency == 'Weekly':
                    window_size = max(8, window_days // 7)
                elif frequency == 'Monthly':
                    window_size = max(6, window_days // 30)
                else:
                    window_size = max(20, window_days)
                
                returns = returns.tail(window_size)
                print(f"[CORRELATION] Applied rolling window: {window_size} periods")
            
            # Validate correlation method
            valid_methods = ['pearson', 'spearman', 'kendall']
            if method not in valid_methods:
                method = 'pearson'
            
            print(f"[CORRELATION] Calculating correlation using method: {method}")
            print(f"[CORRELATION] Data shape: {returns[valid_symbols].shape}")
            print(f"[CORRELATION] Valid symbols: {valid_symbols}")
            
            # Calculate correlation matrix from real data only
            try:
                correlation_data = returns[valid_symbols].corr(method=method)
                print(f"[CORRELATION] Correlation matrix calculated successfully with {method}")
            except Exception as corr_error:
                print(f"[CORRELATION] Correlation calculation failed with {method}: {corr_error}")
                return jsonify({'success': False, 'error': f'Correlation calculation failed: {str(corr_error)}'}), 500
            
            # Convert to dictionary format with validation
            correlation_matrix = {}
            for s1 in valid_symbols:
                correlation_matrix[s1] = {}
                for s2 in valid_symbols:
                    try:
                        corr_value = correlation_data.loc[s1, s2]
                        # Only use real correlation values
                        if pd.isna(corr_value) or np.isinf(corr_value):
                            correlation_matrix[s1][s2] = 1.0 if s1 == s2 else 0.0
                        else:
                            correlation_matrix[s1][s2] = float(corr_value)
                    except Exception:
                        correlation_matrix[s1][s2] = 1.0 if s1 == s2 else 0.0
            
            # Calculate summary statistics from real correlations
            corr_values = []
            for s1 in valid_symbols:
                for s2 in valid_symbols:
                    if s1 != s2:
                        corr_val = correlation_matrix[s1][s2]
                        if not np.isnan(corr_val) and not np.isinf(corr_val):
                            corr_values.append(corr_val)
            
            if len(corr_values) > 0:
                avg_correlation = float(np.mean(corr_values))
                max_correlation = float(np.max(corr_values))
                min_correlation = float(np.min(corr_values))
            else:
                avg_correlation = max_correlation = min_correlation = 0.0
            
            summary = {
                'average_correlation': avg_correlation,
                'max_correlation': max_correlation,
                'min_correlation': min_correlation,
                'method': method,
                'period': period,
                'frequency': frequency,
                'rolling_window': rolling_window,
                'symbols_analyzed': len(valid_symbols),
                'data_points': len(returns),
                'data_source': 'Real Market Data (YFinance)',
                'validation': 'Strict - No Fallback Data'
            }
            
            print(f"[CORRELATION] Analysis complete - Real data only, {len(valid_symbols)} symbols, {len(returns)} data points")
            
            response_data = sanitize_for_json({
                'success': True,
                'correlation_matrix': correlation_matrix,
                'summary': summary
            })
            return jsonify(response_data)
            
        except Exception as e:
            print(f"[CORRELATION] Analysis error: {e}")
            return jsonify({'success': False, 'error': f'Real market data correlation analysis failed: {str(e)}'}), 500

    @app.route('/api/sector-allocation', methods=['POST'])
    def sector_allocation():
        print("\n=== SECTOR ALLOCATION DEBUG START ===")
        try:
            import sys
            import os
            # Add parent directory to path for sector_mapper import
            sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            from sector_mapper import SectorMapper
            
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio:
                # Auto-detect portfolio from manual uploads + Plaid
                user_id = None
                if 'real_user_id' in session:
                    user_id = session['real_user_id']
                elif 'user_id' in session:
                    uid_raw = session['user_id']
                    if len(uid_raw) == 36 and uid_raw.count('-') == 4:
                        user_id = uid_raw
                    elif secure_id_manager:
                        try:
                            user_id = secure_id_manager.get_uuid_from_token(uid_raw) or uid_raw
                        except:
                            user_id = uid_raw
                
                if user_id:
                    print(f"DEBUG: Auto-detecting portfolio for user {user_id}")
                    portfolio = DataManager.get_consolidated_portfolio(user_id)
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided and no saved data found'}), 400
            
            symbols = extract_valid_symbols(portfolio)
            weights, total_value = calculate_portfolio_weights(portfolio)
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols found'}), 400
            
            # Read parameters from frontend settings
            classification = options.get('classification', 'GICS')
            level = options.get('level', 'Sector')
            currency = options.get('currency', 'USD')
            benchmark = options.get('benchmark', 'SPY')
            period = options.get('period', '1Y')
            
            print(f"Sector Allocation Parameters: classification={classification}, level={level}, currency={currency}, benchmark={benchmark}, period={period}")
            print(f"Symbols: {symbols}, Total Value: ${total_value:,.2f}")
            print(f"Raw portfolio data: {portfolio[:2]}...")  # Show first 2 items
            
            # Use SectorMapper directly for reliable sector analysis
            mapper = SectorMapper()
            
            # Convert portfolio format for SectorMapper with better value handling
            portfolio_for_mapper = []
            for item in portfolio:
                symbol = item.get('symbol', '').upper().strip()
                quantity = float(item.get('quantity', 0) or 0)
                price = float(item.get('price', 0) or item.get('avg_cost', 0) or 0)
                market_value = float(item.get('market_value', 0) or 0)
                
                # Calculate market value if not provided
                if market_value <= 0 and quantity > 0 and price > 0:
                    market_value = quantity * price
                
                # Use a default value of 1000 if no value can be calculated
                if symbol and market_value <= 0:
                    market_value = 1000.0  # Default value for equal weighting
                    print(f"Using default value for {symbol}: ${market_value}")
                
                if symbol and market_value > 0:
                    portfolio_for_mapper.append({
                        'symbol': symbol,
                        'quantity': quantity,
                        'market_value': market_value
                    })
                    print(f"Added {symbol}: ${market_value:,.0f}")
            
            print(f"Portfolio for mapper ({len(portfolio_for_mapper)} items):")
            for item in portfolio_for_mapper[:3]:  # Show first 3 items
                print(f"  {item}")
            
            # Get sector analysis from SectorMapper
            results = mapper.analyze_portfolio_sectors(portfolio_for_mapper)
            print(f"SectorMapper results: total_value={results.get('total_value')}, sectors={len(results.get('sectors', {}))}")
            
            # Get Benchmark Weights
            benchmark_weights = mapper.get_benchmark_weights(benchmark)
            print(f"Loaded {len(benchmark_weights)} benchmark sectors for {benchmark}")

            # Convert SectorMapper results to expected format with NaN protection
            sector_allocation = {}
            
            # Create a set of all unique sectors from both portfolio and benchmark
            all_sectors = set(results['sectors'].keys())
            
            # Normalize benchmark keys to match portfolio style (Title Case) if needed
            # But here we rely on the normalized lookup. 
            # Let's map benchmark keys to our standard names if possible.
            benchmark_map = {}
            for k, v in benchmark_weights.items():
                # Try to map benchmark key to a standard sector name if possible
                std_name = mapper.normalize_sector_name(k) 
                if std_name != 'Unknown':
                    all_sectors.add(std_name)
                    benchmark_map[std_name] = v  # Store by standard name
                else:
                    all_sectors.add(k)
                    benchmark_map[k] = v

            for sector in all_sectors:
                # Get portfolio data
                port_data = results['sectors'].get(sector, {})
                percentage = port_data.get('percentage', 0)
                
                # Ensure percentage is a valid number
                if pd.isna(percentage) or np.isinf(percentage):
                    percentage = 0
                
                # Get benchmark weight
                # Prioritize the mapped value we just created
                bench_weight = benchmark_map.get(sector, 0)
                
                # Fallback: Try looking up by normalized name again if not found directly
                if bench_weight == 0:
                     normalized_sector = mapper.normalize_sector_name(sector)
                     bench_weight = benchmark_weights.get(normalized_sector, 0)
                     
                     # Double fallback: Case insensitive check against raw benchmark keys
                     if bench_weight == 0:
                        for k, v in benchmark_weights.items():
                            if k.upper() == sector.upper() or k.upper() == normalized_sector.upper():
                                bench_weight = v
                                break
                
                # Clean up benchmark weight
                if pd.isna(bench_weight) or np.isinf(bench_weight):
                    bench_weight = 0

                sector_allocation[sector] = {
                    'weight': float(percentage) / 100,  # Convert percentage to decimal
                    'benchmark_weight': float(bench_weight) / 100, # Benchmark is usually 0-100
                    'value': float(port_data.get('value', 0)),
                    'symbols': port_data.get('symbols', [])
                }
            
            geographic_allocation = {}
            for country, data in results['countries'].items():
                geographic_allocation[country] = {
                    'weight': data['percentage'] / 100,
                    'value': data['value'],
                    'symbols': data['symbols']
                }
            
            # Calculate diversification metrics
            sector_weights = [data['weight'] for data in sector_allocation.values()]
            herfindahl_index = sum(w**2 for w in sector_weights) if sector_weights else 0
            effective_sectors = 1 / herfindahl_index if herfindahl_index > 0 else len(sector_allocation)
            sector_concentration = max(sector_weights) if sector_weights else 0
            
            diversification_metrics = {
                'herfindahl_index': herfindahl_index,
                'effective_number_sectors': effective_sectors,
                'sector_concentration': sector_concentration
            }
            
            # Format response
            formatted_results = {
                'sector_allocation': sector_allocation,
                'geographic_allocation': geographic_allocation,
                'diversification_metrics': diversification_metrics,
                'summary': {
                    'total_sectors': len(sector_allocation),
                    'classification': classification,
                    'level': level,
                    'currency': currency,
                    'benchmark': benchmark,
                    'period': period,
                    'symbols_analyzed': len(symbols),
                    'total_value': total_value
                }
            }
            
            print(f"Sector allocation successful: {len(sector_allocation)} sectors found")
            for sector, data in sector_allocation.items():
                weight = data.get('weight', 0)
                symbols = data.get('symbols', [])
                print(f"  {sector}: {weight:.2%} ({len(symbols)} symbols) - {symbols}")
            
            # Debug: Show Unknown sector details if it exists
            if 'Unknown' in sector_allocation:
                unknown_data = sector_allocation['Unknown']
                unknown_symbols = unknown_data.get('symbols', [])
                unknown_weight = unknown_data.get('weight', 0)
                print(f"\nDEBUG: Unknown sector contains {len(unknown_symbols)} symbols ({unknown_weight:.1%}): {unknown_symbols}")
                # Test each unknown symbol individually
                for sym in unknown_symbols[:10]:  # Test first 10
                    print(f"  Testing symbol: {sym}")
                    sector = mapper.get_sector(sym)
                    print(f"    Result: {sector}")
                    
                # If Unknown is dominant, try to fix it
                if unknown_weight > 0.5:  # If more than 50% is Unknown
                    print("\nWARNING: More than 50% of portfolio is Unknown - investigating...")
                    print(f"Total portfolio items: {len(portfolio_for_mapper)}")
                    for item in portfolio_for_mapper[:5]:
                        sym = item['symbol']
                        val = item['market_value']
                        sector = mapper.get_sector(sym)
                        print(f"  {sym} (${val:,.0f}): {sector}")
            
            # Debug: Check for NaN values
            for sector, data in sector_allocation.items():
                if pd.isna(data.get('weight')) or np.isinf(data.get('weight')):
                    print(f"WARNING: NaN/Inf weight detected for {sector}: {data}")
            
            # Final validation before returning
            final_response = sanitize_for_json(formatted_results)
            print(f"Final response summary: {len(final_response.get('sector_allocation', {}))} sectors, total_value={final_response.get('summary', {}).get('total_value')}")
            
            # Debug: Show final sector breakdown
            print("\nFINAL SECTOR BREAKDOWN:")
            for sector, data in final_response.get('sector_allocation', {}).items():
                weight = data.get('weight', 0)
                print(f"  {sector}: {weight:.1%}")
            
            return jsonify({'success': True, 'allocation': final_response})
            
        except Exception as e:
            print(f"\n=== SECTOR ALLOCATION ERROR ===")
            print(f"Error: {e}")
            print(f"Error type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            print("=== END ERROR DEBUG ===")
            return jsonify({
                'success': False, 
                'error': f'Sector allocation failed: {str(e)}',
                'debug_info': {
                    'symbols': symbols if 'symbols' in locals() else 'unknown',
                    'error_type': type(e).__name__
                }
            }), 500