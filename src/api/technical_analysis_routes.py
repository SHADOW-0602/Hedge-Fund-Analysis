from flask import request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from .route_utils import sanitize_for_json, extract_valid_symbols, calculate_portfolio_weights
from utils.symbol_parser import get_underlying_symbol
from utils.cache_manager import cache_manager

def register_technical_analysis_routes(app, data_client, smart_cache=None):
    """Register technical analysis routes"""
    
    @app.route('/api/technical-analysis', methods=['GET', 'POST'])
    def technical_analysis():
        try:
            # Handle both GET and POST requests
            if request.method == 'GET':
                # Parse query parameters for GET request
                symbols_param = request.args.get('symbols', '')
                symbols = [s.strip() for s in symbols_param.split(',') if s.strip()]
                
                # Create portfolio data from symbols
                portfolio = [{'symbol': symbol, 'quantity': 100, 'avg_cost': 100} for symbol in symbols]
                
                # Parse options from query parameters
                options = {
                    'period': request.args.get('period', '1Y'),
                    'indicators': request.args.get('indicators', 'RSI,MACD,Bollinger,SMA,EMA').split(','),
                    'timeframe': request.args.get('timeframe', 'Daily'),
                    'rsi_period': int(request.args.get('rsi_period', 14)),
                    'rsi_oversold': int(request.args.get('rsi_oversold', 30)),
                    'rsi_overbought': int(request.args.get('rsi_overbought', 70)),
                    'macd_fast': int(request.args.get('macd_fast', 12)),
                    'macd_slow': int(request.args.get('macd_slow', 26)),
                    'macd_signal': int(request.args.get('macd_signal', 9)),
                    'bb_period': int(request.args.get('bb_period', 20)),
                    'bb_std': int(request.args.get('bb_std', 2)),
                    'signal_strength': request.args.get('signal_strength', 'Medium')
                }
            else:
                # Handle POST request as before
                data = request.get_json()
                portfolio = data.get('portfolio', [])
                options = data.get('options', {})
            
            if not portfolio:
                return jsonify({'success': False, 'error': 'No portfolio data provided'}), 400
            
            # Parse interactive parameters
            period = options.get('period', '1Y')
            indicators = options.get('indicators', ['RSI', 'MACD', 'Bollinger', 'SMA', 'EMA'])
            timeframe = options.get('timeframe', 'Daily')
            rsi_period = int(options.get('rsi_period', 14))
            rsi_oversold = int(options.get('rsi_oversold', 30))
            rsi_overbought = int(options.get('rsi_overbought', 70))
            macd_fast = int(options.get('macd_fast', 12))
            macd_slow = int(options.get('macd_slow', 26))
            macd_signal = int(options.get('macd_signal', 9))
            bb_period = int(options.get('bb_period', 20))
            bb_std = int(options.get('bb_std', 2))
            signal_strength = options.get('signal_strength', 'Medium')
            
            # Check cache
            # Create a consistent cache key from portfolio (symbols/weights) and options
            cache_data = {
                'portfolio_symbols': sorted([p.get('symbol', '') for p in portfolio]),
                'options': options
            }
            cache_key = cache_manager.generate_key('technical-analysis', cache_data)
            cached_result = cache_manager.get(cache_key)
            if cached_result:
                 return jsonify(cached_result)
            
            # Map period to data client format
            period_map = {'1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y'}
            data_period = period_map.get(period, '1y')
            
            # Extract symbols and weights using utility functions
            symbols = extract_valid_symbols(portfolio)
            weights, total_value = calculate_portfolio_weights(portfolio)
            
            if len(symbols) < 1:
                return jsonify({'success': False, 'error': 'No valid symbols for analysis'}), 400
            
            # Get REAL market data using data client - NO FALLBACK
            price_data = data_client.get_price_data(symbols, period=data_period)
            
            if price_data is None or price_data.empty:
                return jsonify({'success': False, 'error': 'No real market data available for technical analysis'}), 400
            
            # Resample based on timeframe
            original_length = len(price_data)
            if timeframe.lower() == 'weekly':
                price_data = price_data.resample('W-SUN').last().dropna()
                min_required = 10
            elif timeframe.lower() == 'monthly':
                price_data = price_data.resample('ME').last().dropna()
                min_required = 3
            else:
                min_required = 20
            
            if price_data.empty or len(price_data) < min_required:
                return jsonify({'success': False, 'error': f'Insufficient real market data for {timeframe.lower()} analysis. Need at least {min_required} data points, got {len(price_data)}'}), 400
            
            # Calculate technical indicators for each symbol
            results = {
                'individual_analysis': {},
                'portfolio_signals': {},
                'summary': {},
                'parameters': {
                    'period': period,
                    'indicators': indicators,
                    'timeframe': timeframe,
                    'rsi_parameters': {'period': rsi_period, 'oversold': rsi_oversold, 'overbought': rsi_overbought},
                    'macd_parameters': {'fast': macd_fast, 'slow': macd_slow, 'signal': macd_signal},
                    'bollinger_parameters': {'period': bb_period, 'std_dev': bb_std},
                    'signal_strength': signal_strength
                }
            }
            
            portfolio_signals = {'bullish': 0, 'bearish': 0, 'neutral': 0}
            
            for symbol in symbols:  # Process all symbols
                if symbol not in price_data.columns:
                    continue
                    
                prices = price_data[symbol].dropna()
                min_data_required = 10 if timeframe.lower() == 'weekly' else 3 if timeframe.lower() == 'monthly' else 20
                if len(prices) < min_data_required:
                    continue
                
                symbol_analysis = {'signals': {}, 'values': {}}
                symbol_signals = []
                
                # RSI Calculation
                if 'RSI' in indicators:
                    delta = prices.diff()
                    gain = (delta.where(delta > 0, 0)).rolling(window=rsi_period).mean()
                    loss = (-delta.where(delta < 0, 0)).rolling(window=rsi_period).mean()
                    rs = gain / loss.replace(0, 0.0001)
                    rsi = 100 - (100 / (1 + rs))
                    current_rsi = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0
                    
                    symbol_analysis['values']['rsi'] = current_rsi
                    if current_rsi < rsi_oversold:
                        symbol_analysis['signals']['rsi'] = 'Bullish (Oversold)'
                        symbol_signals.append('bullish')
                    elif current_rsi > rsi_overbought:
                        symbol_analysis['signals']['rsi'] = 'Bearish (Overbought)'
                        symbol_signals.append('bearish')
                    else:
                        symbol_analysis['signals']['rsi'] = 'Neutral'
                        symbol_signals.append('neutral')
                
                # MACD Calculation
                if 'MACD' in indicators:
                    ema_fast = prices.ewm(span=macd_fast).mean()
                    ema_slow = prices.ewm(span=macd_slow).mean()
                    macd_line = ema_fast - ema_slow
                    signal_line = macd_line.ewm(span=macd_signal).mean()
                    histogram = macd_line - signal_line
                    
                    current_macd = float(macd_line.iloc[-1]) if not pd.isna(macd_line.iloc[-1]) else 0.0
                    current_signal = float(signal_line.iloc[-1]) if not pd.isna(signal_line.iloc[-1]) else 0.0
                    current_histogram = float(histogram.iloc[-1]) if not pd.isna(histogram.iloc[-1]) else 0.0
                    
                    symbol_analysis['values']['macd'] = {
                        'macd': current_macd,
                        'signal': current_signal,
                        'histogram': current_histogram
                    }
                    
                    if current_macd > current_signal and current_histogram > 0:
                        symbol_analysis['signals']['macd'] = 'Bullish'
                        symbol_signals.append('bullish')
                    elif current_macd < current_signal and current_histogram < 0:
                        symbol_analysis['signals']['macd'] = 'Bearish'
                        symbol_signals.append('bearish')
                    else:
                        symbol_analysis['signals']['macd'] = 'Neutral'
                        symbol_signals.append('neutral')
                
                # Bollinger Bands Calculation
                if 'Bollinger' in indicators:
                    ma = prices.rolling(window=bb_period).mean()
                    std = prices.rolling(window=bb_period).std()
                    upper_band = ma + (std * bb_std)
                    lower_band = ma - (std * bb_std)
                    
                    current_price = float(prices.iloc[-1])
                    current_upper = float(upper_band.iloc[-1])
                    current_lower = float(lower_band.iloc[-1])
                    current_ma = float(ma.iloc[-1])
                    
                    # Validate all values are real
                    if pd.isna(current_upper) or pd.isna(current_lower) or pd.isna(current_ma):
                        continue  # Skip this symbol if calculations failed
                    
                    symbol_analysis['values']['bollinger'] = {
                        'upper': current_upper,
                        'middle': current_ma,
                        'lower': current_lower,
                        'current_price': current_price
                    }
                    
                    if current_price > current_upper:
                        symbol_analysis['signals']['bollinger'] = 'Bearish (Above Upper)'
                        symbol_signals.append('bearish')
                    elif current_price < current_lower:
                        symbol_analysis['signals']['bollinger'] = 'Bullish (Below Lower)'
                        symbol_signals.append('bullish')
                    else:
                        symbol_analysis['signals']['bollinger'] = 'Neutral'
                        symbol_signals.append('neutral')
                
                # SMA Calculation
                if 'SMA' in indicators:
                    sma_20 = prices.rolling(window=20).mean()
                    sma_50 = prices.rolling(window=50).mean() if len(prices) >= 50 else sma_20
                    
                    current_sma_20 = float(sma_20.iloc[-1])
                    current_sma_50 = float(sma_50.iloc[-1])
                    
                    # Validate all values are real
                    if pd.isna(current_sma_20) or pd.isna(current_sma_50):
                        continue  # Skip this symbol if calculations failed
                    
                    symbol_analysis['values']['sma'] = {
                        'sma_20': current_sma_20,
                        'sma_50': current_sma_50,
                        'current_price': current_price
                    }
                    
                    if current_price > current_sma_20 and current_sma_20 > current_sma_50:
                        symbol_analysis['signals']['sma'] = 'Bullish'
                        symbol_signals.append('bullish')
                    elif current_price < current_sma_20 and current_sma_20 < current_sma_50:
                        symbol_analysis['signals']['sma'] = 'Bearish'
                        symbol_signals.append('bearish')
                    else:
                        symbol_analysis['signals']['sma'] = 'Neutral'
                        symbol_signals.append('neutral')
                
                # EMA Calculation
                if 'EMA' in indicators:
                    ema_12 = prices.ewm(span=12).mean()
                    ema_26 = prices.ewm(span=26).mean()
                    
                    current_ema_12 = float(ema_12.iloc[-1])
                    current_ema_26 = float(ema_26.iloc[-1])
                    
                    # Validate all values are real
                    if pd.isna(current_ema_12) or pd.isna(current_ema_26):
                        continue  # Skip this symbol if calculations failed
                    
                    symbol_analysis['values']['ema'] = {
                        'ema_12': current_ema_12,
                        'ema_26': current_ema_26,
                        'current_price': current_price
                    }
                    
                    if current_price > current_ema_12 and current_ema_12 > current_ema_26:
                        symbol_analysis['signals']['ema'] = 'Bullish'
                        symbol_signals.append('bullish')
                    elif current_price < current_ema_12 and current_ema_12 < current_ema_26:
                        symbol_analysis['signals']['ema'] = 'Bearish'
                        symbol_signals.append('bearish')
                    else:
                        symbol_analysis['signals']['ema'] = 'Neutral'
                        symbol_signals.append('neutral')
                
                # Overall signal for this symbol
                bullish_count = symbol_signals.count('bullish')
                bearish_count = symbol_signals.count('bearish')
                neutral_count = symbol_signals.count('neutral')
                
                if bullish_count > bearish_count:
                    overall_signal = 'Bullish'
                    portfolio_signals['bullish'] += weights.get(symbol, 0)
                elif bearish_count > bullish_count:
                    overall_signal = 'Bearish'
                    portfolio_signals['bearish'] += weights.get(symbol, 0)
                else:
                    overall_signal = 'Neutral'
                    portfolio_signals['neutral'] += weights.get(symbol, 0)
                
                symbol_analysis['overall_signal'] = overall_signal
                symbol_analysis['signal_strength'] = _calculate_signal_strength(
                    bullish_count, bearish_count, neutral_count, signal_strength
                )
                
                results['individual_analysis'][symbol] = symbol_analysis
            
            # Portfolio-level signals
            total_weight = sum(portfolio_signals.values())
            if total_weight > 0:
                results['portfolio_signals'] = {
                    'bullish_weight': portfolio_signals['bullish'] / total_weight,
                    'bearish_weight': portfolio_signals['bearish'] / total_weight,
                    'neutral_weight': portfolio_signals['neutral'] / total_weight
                }
                
                # Overall portfolio signal
                if portfolio_signals['bullish'] > portfolio_signals['bearish']:
                    results['portfolio_signals']['overall'] = 'Bullish'
                elif portfolio_signals['bearish'] > portfolio_signals['bullish']:
                    results['portfolio_signals']['overall'] = 'Bearish'
                else:
                    results['portfolio_signals']['overall'] = 'Neutral'
            
            # Summary statistics
            results['summary'] = {
                'symbols_analyzed': len(results['individual_analysis']),
                'data_points': len(price_data),
                'period_analyzed': period,
                'indicators_used': indicators,
                'timeframe': timeframe
            }
            
            # Final sanitization before JSON response
            response_data = sanitize_for_json({'success': True, 'technical_analysis': results})
            cache_manager.set(cache_key, response_data)
            return jsonify(response_data)
            
        except Exception as e:
            print(f"Technical analysis error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

def _calculate_signal_strength(bullish_count, bearish_count, neutral_count, strength_filter):
    """Calculate signal strength based on indicator consensus"""
    total_signals = bullish_count + bearish_count + neutral_count
    if total_signals == 0:
        return 'Weak'
    
    dominant_count = max(bullish_count, bearish_count, neutral_count)
    consensus_ratio = dominant_count / total_signals
    
    if strength_filter == 'Strong':
        if consensus_ratio >= 0.8:
            return 'Strong'
        elif consensus_ratio >= 0.6:
            return 'Medium'
        else:
            return 'Weak'
    elif strength_filter == 'Medium':
        if consensus_ratio >= 0.6:
            return 'Medium'
        else:
            return 'Weak'
    else:  # Weak
        return 'Weak' if consensus_ratio < 0.4 else 'Medium' if consensus_ratio < 0.7 else 'Strong'