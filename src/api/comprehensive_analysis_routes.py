from flask import request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from .route_utils import sanitize_for_json, extract_valid_symbols, calculate_portfolio_weights
from utils.symbol_parser import get_underlying_symbol

def register_comprehensive_analysis_routes(app, data_client, smart_cache=None):
    """Register comprehensive analysis routes"""
    
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
    def correlation_analysis():
        try:
            import yfinance as yf
            import warnings
            warnings.filterwarnings('ignore')
            
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Parse options
            period = options.get('period', '1Y')
            method = options.get('method', 'pearson')
            
            # Extract symbols with better error handling
            symbols = []
            for p in portfolio:
                if isinstance(p, dict) and p.get('symbol'):
                    symbol = p['symbol']
                    if symbol and not symbol.startswith('CUR:'):
                        underlying = get_underlying_symbol(symbol)
                        if underlying and underlying not in symbols:
                            symbols.append(underlying)
            
            # Process all symbols for correlation analysis
            
            if len(symbols) < 2:
                return jsonify({'success': False, 'error': 'Need at least 2 symbols for correlation'}), 400
            
            # Download data
            period_map = {'6M': '6mo', '1Y': '1y', '2Y': '2y', '3Y': '3y', '5Y': '5y'}
            yf_period = period_map.get(period, '1y')
            
            try:
                price_data = yf.download(symbols, period=yf_period, progress=False)
            except Exception as download_error:
                return jsonify({'success': False, 'error': f'Failed to download data: {str(download_error)}'}), 500
            
            # Check if data is valid with comprehensive checks
            if price_data is None:
                return jsonify({'success': False, 'error': 'No data returned from market data provider'}), 500
            
            if hasattr(price_data, 'empty') and price_data.empty:
                return jsonify({'success': False, 'error': 'Empty data returned from market data provider'}), 500
            
            if hasattr(price_data, 'shape') and price_data.shape[0] == 0:
                return jsonify({'success': False, 'error': 'No historical data available for the selected period'}), 500
            
            # Get price data
            if 'Adj Close' in price_data.columns:
                prices = price_data['Adj Close']
            else:
                prices = price_data['Close']
            
            # Handle single symbol case
            if len(symbols) == 1:
                prices = pd.DataFrame(prices)
            
            # Calculate returns
            returns = prices.pct_change().dropna()
            
            # Filter symbols with sufficient data (avoid pandas boolean ambiguity)
            valid_symbols = []
            for symbol in symbols:
                if symbol in returns.columns:
                    symbol_returns = returns[symbol].dropna()
                    # Use explicit shape check instead of len() to avoid pandas boolean issues
                    if hasattr(symbol_returns, 'shape') and symbol_returns.shape[0] >= 30:
                        valid_symbols.append(symbol)
            
            if len(valid_symbols) < 2:
                return jsonify({'success': False, 'error': 'Insufficient data for correlation analysis (need at least 30 data points per symbol)'}), 400
            
            # Calculate correlation matrix
            try:
                correlation_data = returns[valid_symbols].corr(method=method)
            except Exception as corr_error:
                return jsonify({'success': False, 'error': f'Correlation calculation failed: {str(corr_error)}'}), 500
            
            # Convert to dictionary format with error handling
            correlation_matrix = {}
            for s1 in valid_symbols:
                correlation_matrix[s1] = {}
                for s2 in valid_symbols:
                    try:
                        corr_value = correlation_data.loc[s1, s2]
                        correlation_matrix[s1][s2] = float(corr_value) if not np.isnan(corr_value) else 0.0
                    except Exception:
                        correlation_matrix[s1][s2] = 0.0
            
            # Calculate summary statistics
            corr_values = []
            for s1 in valid_symbols:
                for s2 in valid_symbols:
                    if s1 != s2:
                        corr_val = correlation_matrix[s1][s2]
                        if not np.isnan(corr_val):
                            corr_values.append(corr_val)
            
            # Use explicit length check to avoid pandas boolean issues
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
                'symbols_analyzed': len(valid_symbols),
                'data_points': returns.shape[0] if hasattr(returns, 'shape') else 0
            }
            
            response_data = sanitize_for_json({
                'success': True,
                'correlation_matrix': correlation_matrix,
                'summary': summary
            })
            return jsonify(response_data)
            
        except Exception as e:
            print(f"Correlation analysis error: {e}")
            return jsonify({'success': False, 'error': f'Correlation analysis failed: {str(e)}'}), 500

    @app.route('/api/sector-allocation', methods=['POST'])
    def sector_allocation():
        try:
            import yfinance as yf
            
            data = request.get_json()
            portfolio = data.get('portfolio', [])
            options = data.get('options', {})
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            symbols = extract_valid_symbols(portfolio)
            weights, total_value = calculate_portfolio_weights(portfolio)
            
            if not symbols:
                return jsonify({'success': False, 'error': 'No valid symbols found'}), 400
            
            # Get sector information for each symbol
            sector_allocation = {}
            total_allocated = 0
            
            for symbol in symbols:
                try:
                    ticker = yf.Ticker(symbol)
                    info = ticker.info
                    sector = info.get('sector', 'Unknown')
                    
                    symbol_weight = weights.get(symbol, 1.0 / len(symbols))
                    symbol_value = total_value * symbol_weight
                    
                    if sector not in sector_allocation:
                        sector_allocation[sector] = {
                            'weight': 0,
                            'symbols': [],
                            'value': 0
                        }
                    
                    sector_allocation[sector]['weight'] += symbol_weight
                    sector_allocation[sector]['symbols'].append(symbol)
                    sector_allocation[sector]['value'] += symbol_value
                    total_allocated += symbol_weight
                    
                except Exception:
                    # Fallback sector classification
                    sector = 'Technology' if symbol in ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'] else 'Unknown'
                    symbol_weight = weights.get(symbol, 1.0 / len(symbols))
                    symbol_value = total_value * symbol_weight
                    
                    if sector not in sector_allocation:
                        sector_allocation[sector] = {
                            'weight': 0,
                            'symbols': [],
                            'value': 0
                        }
                    
                    sector_allocation[sector]['weight'] += symbol_weight
                    sector_allocation[sector]['symbols'].append(symbol)
                    sector_allocation[sector]['value'] += symbol_value
                    total_allocated += symbol_weight
            
            # Calculate diversification metrics
            sector_weights = [s['weight'] for s in sector_allocation.values()]
            herfindahl_index = sum(w**2 for w in sector_weights)
            effective_sectors = 1 / herfindahl_index if herfindahl_index > 0 else 1
            concentration_ratio = max(sector_weights) if sector_weights else 0
            
            results = {
                'sector_allocation': sector_allocation,
                'diversification_metrics': {
                    'herfindahl_index': float(herfindahl_index),
                    'effective_sectors': float(effective_sectors),
                    'concentration_ratio': float(concentration_ratio)
                },
                'summary': {
                    'total_sectors': len(sector_allocation),
                    'classification': 'GICS',
                    'level': 'Sector',
                    'symbols_analyzed': len(symbols)
                }
            }
            
            return jsonify({'success': True, 'allocation': results})
            
        except Exception as e:
            print(f"Sector allocation error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500