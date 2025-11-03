from flask import request, jsonify
import numpy as np
from .route_utils import sanitize_for_json, extract_valid_symbols

def register_options_routes(app, data_client, smart_cache=None):
    """Register options analysis routes"""
    
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
            
            # Parse options parameters
            options_params = data.get('options', {})
            
            # Initialize options analyzer
            from analytics.options_analytics import OptionsAnalyzer
            options_analyzer = OptionsAnalyzer(data_client)
            
            opportunities = options_analyzer.scan_all_strategies(valid_symbols, options_params)
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
            
            # Final sanitization before JSON response
            response_data = sanitize_for_json({
                'success': True,
                'opportunities': opportunities,
                'summary': summary
            })
            
            print(f"2025-10-26 16:55:47,500 - hedge_fund_app - INFO - Options scan completed successfully")
            return jsonify(response_data)
        except Exception as e:
            print(f"2025-10-26 16:55:47,600 - hedge_fund_app - ERROR - Options scan failed: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500