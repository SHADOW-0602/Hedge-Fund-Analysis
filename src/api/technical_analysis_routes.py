from flask import request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from .route_utils import sanitize_for_json
from utils.symbol_parser import get_underlying_symbol

def register_technical_analysis_routes(app, data_client, smart_cache=None):
    """Register technical analysis routes"""
    
    @app.route('/api/technical-analysis', methods=['POST'])
    def technical_analysis():
        try:
            import yfinance as yf
            
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
            
            # Map period to yfinance format
            if timeframe.lower() == 'monthly':
                period_map = {'1M': '6mo', '3M': '1y', '6M': '2y', '1Y': '3y'}
            elif timeframe.lower() == 'weekly':
                period_map = {'1M': '3mo', '3M': '6mo', '6M': '1y', '1Y': '2y'}
            else:
                period_map = {'1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y'}
            yf_period = period_map.get(period, '1y')
            
            # Filter and process portfolio symbols
            symbols = []
            weights = {}
            total_value = 0
            
            for position in portfolio:
                symbol = get_underlying_symbol(position.get('symbol', ''))
                if symbol and not symbol.startswith('CUR:') and len(symbol) <= 10:
                    quantity = float(position.get('quantity', 0))
                    price = float(position.get('avg_cost', 0))
                    value = quantity * price
                    symbols.append(symbol)
                    total_value += value
            
            # Calculate normalized weights
            for position in portfolio:
                symbol = get_underlying_symbol(position.get('symbol', ''))
                if symbol in symbols:
                    quantity = float(position.get('quantity', 0))
                    price = float(position.get('avg_cost', 0))
                    value = quantity * price
                    weights[symbol] = value / total_value if total_value > 0 else 0
            
            if len(symbols) < 1:
                return jsonify({'success': False, 'error': 'No valid symbols for analysis'}), 400
            
            # Get market data
            price_data = yf.download(symbols, period=yf_period, progress=False)
            
            if isinstance(price_data.columns, pd.MultiIndex):
                if 'Adj Close' in price_data.columns.levels[0]:
                    price_data = price_data['Adj Close']
                elif 'Close' in price_data.columns.levels[0]:
                    price_data = price_data['Close']
            elif len(symbols) == 1:
                price_data = pd.DataFrame({symbols[0]: price_data['Adj Close'] if 'Adj Close' in price_data.columns else price_data['Close']})
            
            # Resample based on timeframe
            original_length = len(price_data)
            if timeframe.lower() == 'weekly':
                price_data = price_data.resample('W').last().dropna()
                min_required = 20
            elif timeframe.lower() == 'monthly':
                price_data = price_data.resample('M').last().dropna()
                min_required = 6
            else:
                min_required = 50
            
            if price_data.empty or len(price_data) < min_required:
                # Fallback to daily data if resampling fails
                if timeframe.lower() != 'daily':
                    price_data = yf.download(symbols, period=yf_period, progress=False)
                    if isinstance(price_data.columns, pd.MultiIndex):
                        if 'Adj Close' in price_data.columns.levels[0]:
                            price_data = price_data['Adj Close']
                        elif 'Close' in price_data.columns.levels[0]:
                            price_data = price_data['Close']
                    elif len(symbols) == 1:
                        price_data = pd.DataFrame({symbols[0]: price_data['Adj Close'] if 'Adj Close' in price_data.columns else price_data['Close']})
                    timeframe = 'Daily'
                    min_required = 50
                
                if price_data.empty or len(price_data) < min_required:
                    return jsonify({'success': False, 'error': f'Insufficient data for {timeframe.lower()} analysis. Need at least {min_required} data points, got {len(price_data)}'}), 400
            
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
                min_data_required = 20 if timeframe.lower() == 'weekly' else 6 if timeframe.lower() == 'monthly' else 50
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