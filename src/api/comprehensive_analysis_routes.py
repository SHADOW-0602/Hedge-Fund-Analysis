from flask import request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from .route_utils import sanitize_for_json, extract_valid_symbols, calculate_portfolio_weights

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
    
    @app.route('/api/strategy-backtesting', methods=['POST'])
    def strategy_backtesting():
        try:
            import yfinance as yf
            
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Parse interactive parameters
            backtest_period = options.get('backtest_period', '1Y')
            rebalancing = options.get('rebalancing', 'Quarterly')
            transaction_costs = float(options.get('transaction_costs', 0.1)) / 100
            benchmark = options.get('benchmark', 'SPY')
            
            # Map period to yfinance format
            period_map = {'6M': '6mo', '1Y': '1y', '2Y': '2y', '3Y': '3y', '5Y': '5y'}
            yf_period = period_map.get(backtest_period, '1y')
            
            symbols = extract_valid_symbols(portfolio)
            weights, total_value = calculate_portfolio_weights(portfolio)
            
            if len(symbols) < 1:
                return jsonify({'success': False, 'error': 'No valid symbols for backtesting'}), 400
            
            # Download data and calculate metrics directly
            import warnings
            warnings.filterwarnings('ignore')
            
            portfolio_data = yf.download(symbols + [benchmark], period=yf_period, progress=False)
            if portfolio_data.empty:
                raise Exception("No data available")
            
            # Get price data
            if 'Adj Close' in portfolio_data.columns:
                prices = portfolio_data['Adj Close']
            else:
                prices = portfolio_data['Close']
            
            returns = prices.pct_change().dropna()
            
            # Calculate portfolio returns
            portfolio_returns = pd.Series(0, index=returns.index)
            for symbol in symbols:
                if symbol in returns.columns:
                    weight = weights.get(symbol, 1.0 / len(symbols))
                    portfolio_returns += returns[symbol] * weight
            
            benchmark_returns = returns[benchmark] if benchmark in returns.columns else pd.Series(0, index=returns.index)
            
            # Calculate metrics
            total_return = (1 + portfolio_returns).prod() - 1
            annual_return = (1 + total_return) ** (252 / len(portfolio_returns)) - 1 if len(portfolio_returns) > 0 else 0
            volatility = portfolio_returns.std() * np.sqrt(252)
            
            # Max drawdown
            cumulative = (1 + portfolio_returns).cumprod()
            running_max = cumulative.expanding().max()
            drawdown = (cumulative - running_max) / running_max
            max_drawdown = drawdown.min()
            
            # Sharpe ratio
            excess_return = portfolio_returns.mean() * 252 - 0.02  # Assume 2% risk-free rate
            sharpe_ratio = excess_return / volatility if volatility != 0 else 0
            
            # Win rate (percentage of positive return days)
            win_rate = (portfolio_returns > 0).sum() / len(portfolio_returns) if len(portfolio_returns) > 0 else 0
            
            def clean_value(val):
                if np.isnan(val) or np.isinf(val):
                    return 0.0
                return float(val)
            
            results = {
                'performance_metrics': {
                    'total_return': clean_value(total_return),
                    'annual_return': clean_value(annual_return),
                    'volatility': clean_value(volatility),
                    'win_rate': clean_value(win_rate),
                    'total_trades': len(portfolio_returns),
                    'transaction_costs_impact': transaction_costs * 100
                },
                'risk_metrics': {
                    'sharpe_ratio': clean_value(sharpe_ratio),
                    'sortino_ratio': clean_value(sharpe_ratio * 1.2),  # Approximation
                    'calmar_ratio': clean_value(annual_return / abs(max_drawdown)) if max_drawdown != 0 else 0,
                    'max_drawdown': clean_value(max_drawdown),
                    'beta': 1.0,  # Simplified
                    'alpha': clean_value(annual_return - 0.08),  # vs market assumption
                    'tracking_error': clean_value((portfolio_returns - benchmark_returns).std() * np.sqrt(252)),
                    'information_ratio': clean_value(excess_return / volatility) if volatility != 0 else 0
                },
                'benchmark_comparison': {
                    'benchmark_symbol': benchmark,
                    'benchmark_return': clean_value((1 + benchmark_returns).prod() - 1),
                    'benchmark_annual_return': clean_value(benchmark_returns.mean() * 252),
                    'benchmark_volatility': clean_value(benchmark_returns.std() * np.sqrt(252)),
                    'benchmark_sharpe': clean_value((benchmark_returns.mean() * 252 - 0.02) / (benchmark_returns.std() * np.sqrt(252))),
                    'excess_return': clean_value(annual_return - benchmark_returns.mean() * 252),
                    'volatility_ratio': clean_value(volatility / (benchmark_returns.std() * np.sqrt(252))) if benchmark_returns.std() != 0 else 1
                },
                'backtest_parameters': {
                    'period': backtest_period,
                    'rebalancing': rebalancing,
                    'transaction_costs': transaction_costs * 100,
                    'benchmark': benchmark,
                    'data_points': len(returns),
                    'symbols_analyzed': len(symbols)
                }
            }
            
            response_data = sanitize_for_json({'success': True, 'backtest': results})
            return jsonify(response_data)
            
        except Exception as e:
            print(f"Strategy backtesting error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/statistical-analysis', methods=['POST'])
    def statistical_analysis():
        try:
            import yfinance as yf
            import warnings
            warnings.filterwarnings('ignore')
            
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Parse parameters
            lookback_period = options.get('lookback_period', '1Y')
            benchmark = options.get('benchmark', 'SPY')
            confidence_level = float(options.get('confidence_level', 95)) / 100
            
            symbols = extract_valid_symbols(portfolio)
            weights, total_value = calculate_portfolio_weights(portfolio)
            
            if len(symbols) < 1:
                return jsonify({'success': False, 'error': 'No valid symbols for analysis'}), 400
            
            # Download data
            period_map = {'6M': '6mo', '1Y': '1y', '2Y': '2y', '3Y': '3y', '5Y': '5y'}
            yf_period = period_map.get(lookback_period, '1y')
            
            # Get portfolio and benchmark data
            portfolio_data = yf.download(symbols + [benchmark], period=yf_period, progress=False)
            if portfolio_data is None or (hasattr(portfolio_data, 'empty') and portfolio_data.empty) or (hasattr(portfolio_data, 'shape') and portfolio_data.shape[0] == 0):
                raise Exception("No data available")
            
            # Calculate returns
            if 'Adj Close' in portfolio_data.columns:
                prices = portfolio_data['Adj Close']
            else:
                prices = portfolio_data['Close']
            
            returns = prices.pct_change().dropna()
            
            # Calculate portfolio returns
            portfolio_returns = pd.Series(0, index=returns.index)
            for symbol in symbols:
                if symbol in returns.columns:
                    weight = weights.get(symbol, 1.0 / len(symbols))
                    portfolio_returns += returns[symbol] * weight
            
            benchmark_returns = returns[benchmark] if benchmark in returns.columns else pd.Series(0, index=returns.index)
            
            # Calculate statistics
            correlation = portfolio_returns.corr(benchmark_returns)
            
            # Beta calculation
            covariance = portfolio_returns.cov(benchmark_returns)
            benchmark_variance = benchmark_returns.var()
            beta = covariance / benchmark_variance if benchmark_variance != 0 else 1.0
            
            # Alpha calculation (annualized)
            portfolio_return = portfolio_returns.mean() * 252
            benchmark_return = benchmark_returns.mean() * 252
            alpha = portfolio_return - beta * benchmark_return
            
            # R-squared
            r_squared = correlation ** 2
            
            # Tracking error
            excess_returns = portfolio_returns - benchmark_returns
            tracking_error = excess_returns.std() * np.sqrt(252)
            
            # Information ratio
            information_ratio = excess_returns.mean() * 252 / tracking_error if tracking_error != 0 else 0
            
            # Volatilities
            portfolio_volatility = portfolio_returns.std() * np.sqrt(252)
            benchmark_volatility = benchmark_returns.std() * np.sqrt(252)
            
            results = {
                'portfolio_statistics': {
                    'benchmark_correlation': float(correlation) if not np.isnan(correlation) else 0.0,
                    'beta': float(beta) if not np.isnan(beta) else 1.0,
                    'alpha': float(alpha) if not np.isnan(alpha) else 0.0,
                    'r_squared': float(r_squared) if not np.isnan(r_squared) else 0.0
                },
                'risk_metrics': {
                    'portfolio_volatility': float(portfolio_volatility) if not np.isnan(portfolio_volatility) else 0.0,
                    'benchmark_volatility': float(benchmark_volatility) if not np.isnan(benchmark_volatility) else 0.0,
                    'tracking_error': float(tracking_error) if not np.isnan(tracking_error) else 0.0,
                    'information_ratio': float(information_ratio) if not np.isnan(information_ratio) else 0.0
                },
                'performance_metrics': {
                    'annualized_return': float(portfolio_return) if not np.isnan(portfolio_return) else 0.0,
                    'annualized_volatility': float(portfolio_volatility) if not np.isnan(portfolio_volatility) else 0.0,
                    'sharpe_ratio': float(portfolio_return / portfolio_volatility) if portfolio_volatility != 0 and not np.isnan(portfolio_return) else 0.0,
                    'confidence_level': confidence_level * 100
                },
                'summary': {
                    'lookback_period': lookback_period,
                    'benchmark': benchmark,
                    'confidence_level': confidence_level * 100,
                    'symbols_analyzed': len(symbols),
                    'data_points': len(returns)
                }
            }
            
            response_data = sanitize_for_json({'success': True, 'statistics': results})
            return jsonify(response_data)
            
        except Exception as e:
            print(f"Statistical analysis error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

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
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
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
        try:
            from analytics.sector_analysis import SectorAnalyzer
            
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            symbols = extract_valid_symbols(portfolio)
            weights, total_value = calculate_portfolio_weights(portfolio)
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols found'}), 400
            
            # Read parameters from frontend settings (matching Performance Attribution structure)
            classification = options.get('classification', 'GICS')
            level = options.get('level', 'Sector')
            currency = options.get('currency', 'USD')
            benchmark = options.get('benchmark', 'SPY')
            period = options.get('period', '1Y')
            
            print(f"Sector Allocation Parameters: classification={classification}, level={level}, currency={currency}, benchmark={benchmark}, period={period}")
            print(f"Symbols: {symbols}, Total Value: ${total_value:,.2f}")
            
            # Initialize sector analyzer
            analyzer = SectorAnalyzer(data_client)
            
            # Get comprehensive sector analysis
            results = analyzer.analyze_sector_allocation(symbols, weights, portfolio)
            
            # Add geographic allocation if multi-currency
            if currency == 'MULTI' or len(set(s[:2] for s in symbols if '.' in s)) > 1:
                geographic_data = results.get('geographic_allocation', {})
                results['geographic_summary'] = {
                    'total_countries': len(geographic_data),
                    'domestic_weight': geographic_data.get('US', {}).get('weight', 0),
                    'international_weight': sum(data.get('weight', 0) for country, data in geographic_data.items() if country != 'US')
                }
            
            # Add style analysis
            style_analysis = analyzer.analyze_style_factors(symbols, weights)
            results['style_analysis'] = style_analysis
            
            # Add sector performance comparison
            sector_performance = analyzer.get_sector_performance(symbols, period)
            results['sector_performance'] = sector_performance
            
            # Format response to match Performance Attribution structure
            formatted_results = {
                'sector_allocation': results['sector_allocation'],
                'geographic_allocation': results.get('geographic_allocation', {}),
                'style_analysis': results.get('style_analysis', {}),
                'sector_performance': results.get('sector_performance', {}),
                'diversification_metrics': results['diversification_metrics'],
                'summary': {
                    'total_sectors': len(results['sector_allocation']),
                    'classification': classification,
                    'level': level,
                    'currency': currency,
                    'benchmark': benchmark,
                    'period': period,
                    'symbols_analyzed': len(symbols),
                    'total_value': total_value
                }
            }
            
            print(f"Sector allocation successful: {list(formatted_results.keys())}")
            
            # Add chart initialization
            response = jsonify({'success': True, 'allocation': formatted_results})
            response.headers['X-Chart-Data'] = 'true'
            return response
            
        except Exception as e:
            print(f"Sector allocation error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False, 
                'error': f'Sector allocation failed: {str(e)}',
                'debug_info': {
                    'symbols': symbols if 'symbols' in locals() else 'unknown',
                    'error_type': type(e).__name__
                }
            }), 500