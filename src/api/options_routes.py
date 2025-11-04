from flask import request, jsonify
import numpy as np
from .route_utils import sanitize_for_json, extract_valid_symbols

def register_options_routes(app, data_client, smart_cache=None):
    """Register options analysis routes"""
    
    @app.route('/api/scan-options', methods=['POST'])
    def scan_options():
        try:
            print(f"hedge_fund_app - INFO - Received options scan request")
            data = request.get_json()
            
            # Handle both 'symbols' array and 'portfolio' array
            symbols = data.get('symbols', [])
            if not symbols and 'portfolio' in data:
                symbols = [p.get('symbol') for p in data['portfolio'] if p.get('symbol')]
            
            print(f"hedge_fund_app - INFO - Raw symbols received: {symbols}")
            print(f"hedge_fund_app - INFO - Scanning options for {len(symbols)} symbols: {symbols}")
            
            # More lenient symbol filtering
            valid_symbols = []
            for symbol in symbols:
                if symbol and isinstance(symbol, str) and len(symbol) <= 10:
                    # Remove common prefixes and clean symbol
                    clean_symbol = symbol.strip().upper()
                    if not clean_symbol.startswith('CUR:') and not clean_symbol.startswith('CASH'):
                        valid_symbols.append(clean_symbol)
                        print(f"Options: Added valid symbol: {clean_symbol}")
                    else:
                        print(f"Options: Filtering out {symbol} (currency/cash symbol)")
                else:
                    print(f"Options: Filtering out {symbol} (not valid for options - invalid format)")
            
            print(f"Options: Valid symbols for scanning ({len(valid_symbols)}): {valid_symbols}")
            if not valid_symbols:
                # Return success with empty results instead of error
                return jsonify({
                    'success': True,
                    'opportunities': [],
                    'summary': {
                        'covered_calls': {'count': 0, 'total_premium': 0},
                        'protective_puts': {'count': 0, 'total_cost': 0},
                        'iron_condors': {'count': 0, 'total_premium': 0}
                    },
                    'debug_info': {
                        'symbols_received': len(symbols),
                        'valid_symbols': len(valid_symbols),
                        'filtered_symbols': [s for s in symbols if s not in valid_symbols]
                    }
                })
            
            # Parse options parameters with validation
            options_params = data.get('options', {})
            
            # Validate and clean options parameters
            expiration = options_params.get('expiration', '3M')
            moneyness = options_params.get('moneyness', 'All')
            strategy = options_params.get('strategy', 'All')
            min_premium = float(options_params.get('min_premium', 0.50))
            delta_range = options_params.get('delta_range', 'All')
            
            # Clean options dict
            options_params = {
                'expiration': expiration,
                'moneyness': moneyness,
                'strategy': strategy,
                'min_premium': min_premium,
                'delta_range': delta_range
            }
            
            print(f"Options: Parsed parameters: {options_params}")
            
            # Initialize options analyzer
            from analytics.options_analytics import OptionsAnalyzer
            options_analyzer = OptionsAnalyzer(data_client)
            
            print(f"Options: Starting analysis with {len(valid_symbols)} symbols")
            opportunities = options_analyzer.scan_all_strategies(valid_symbols, options_params)
            print(f"Options: Analysis completed, found {len(opportunities)} opportunities")
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
            
            # Remove duplicates based on symbol and strategy
            unique_opportunities = []
            seen = set()
            for opp in opportunities:
                key = (opp.get('symbol'), opp.get('strategy'), opp.get('strike'))
                if key not in seen:
                    seen.add(key)
                    unique_opportunities.append(opp)
            
            print(f"Options: Removed {len(opportunities) - len(unique_opportunities)} duplicate opportunities")
            
            # Final sanitization before JSON response
            response_data = sanitize_for_json({
                'success': True,
                'opportunities': unique_opportunities,
                'summary': summary,
                'debug_info': {
                    'symbols_processed': len(valid_symbols),
                    'total_opportunities': len(unique_opportunities),
                    'duplicates_removed': len(opportunities) - len(unique_opportunities)
                }
            })
            
            print(f"hedge_fund_app - INFO - Options scan completed successfully")
            return jsonify(response_data)
        except Exception as e:
            print(f"hedge_fund_app - ERROR - Options scan failed: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500