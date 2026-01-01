"""
Sector analysis API routes
"""

from flask import Blueprint, request, jsonify
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sector_mapper import SectorMapper
from sector_visualizer import SectorVisualizer
from utils.cache_manager import cache_manager
import json
import plotly
from werkzeug.utils import secure_filename

sector_bp = Blueprint('sector', __name__)
sector_mapper = SectorMapper()
sector_viz = SectorVisualizer()

@sector_bp.route('/api/sector/lookup/<symbol>')
def get_sector_info(symbol):
    """Get sector information for a single symbol"""
    try:
        symbol = symbol.upper()
        return jsonify({
            'symbol': symbol,
            'sector': sector_mapper.get_sector(symbol),
            'industry': sector_mapper.get_industry(symbol),
            'country': sector_mapper.get_country(symbol)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sector_bp.route('/api/sector/reload', methods=['POST'])
def reload_sector_data():
    """Reload sector data from the Excel file"""
    try:
        result = sector_mapper.reload_data()
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sector_bp.route('/api/sector/upload', methods=['POST'])
def upload_sector_data():
    """Upload a new sector data Excel file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if file and (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
            save_path = sector_mapper.xlsx_path
            print(f"Saving uploaded file to: {save_path}")
            
            # Backup existing file
            if os.path.exists(save_path):
                backup_path = save_path + '.bak'
                try:
                    import shutil
                    shutil.copy2(save_path, backup_path)
                    print(f"Backed up existing file to {backup_path}")
                except Exception as e:
                    print(f"Warning: Failed to backup file: {e}")
            
            file.save(save_path)
            
            # Reload data
            result = sector_mapper.reload_data()
            
            return jsonify({
                'success': True,
                'message': 'File uploaded and data reloaded successfully',
                'details': result
            })
        else:
            return jsonify({'error': 'Invalid file type. Please upload an Excel file (.xlsx)'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sector_bp.route('/api/sector/debug/<symbol>')
def debug_sector_lookup(symbol):
    """Debug sector lookup for a specific symbol"""
    try:
        symbol = symbol.upper()
        
        # Check direct lookup
        direct = symbol in sector_mapper.sector_data
        
        # Check variations
        variations = [
            symbol.replace('.', ''),
            symbol.replace('-', ''),
            symbol.split('.')[0],
            symbol.split('-')[0]
        ]
        variation_matches = {v: v in sector_mapper.sector_data for v in variations}
        
        return jsonify({
            'symbol': symbol,
            'in_database': direct,
            'sector': sector_mapper.get_sector(symbol),
            'industry': sector_mapper.get_industry(symbol),
            'variations_checked': variation_matches,
            'database_sample': list(sector_mapper.sector_data.keys())[:5],
            'total_symbols': len(sector_mapper.sector_data)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sector_bp.route('/api/sector/analyze', methods=['POST'])
def analyze_portfolio_sectors():
    """Analyze sector allocation for a portfolio"""
    try:
        data = request.get_json()
        portfolio_data = data.get('portfolio', [])
        
        if not portfolio_data:
            return jsonify({'error': 'No portfolio data provided'}), 400
        
        # Check cache
        cache_key = cache_manager.generate_key('sector-analysis', data)
        cached_result = cache_manager.get(cache_key)
        if cached_result:
            return jsonify(cached_result)

        analysis = sector_mapper.analyze_portfolio_sectors(portfolio_data)
        
        response_data = {
            'success': True,
            'analysis': analysis
        }
        cache_manager.set(cache_key, response_data)
        
        return jsonify(response_data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sector_bp.route('/api/sector/available')
def get_available_sectors():
    """Get all available sectors"""
    try:
        return jsonify({
            'sectors': sector_mapper.get_all_sectors(),
            'total_symbols': len(sector_mapper.sector_data)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sector_bp.route('/api/sector/symbols/<sector>')
def get_symbols_by_sector(sector):
    """Get all symbols in a specific sector"""
    try:
        symbols = sector_mapper.get_symbols_by_sector(sector)
        return jsonify({
            'sector': sector,
            'symbols': symbols[:100],
            'total_count': len(symbols)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sector_bp.route('/api/sector/visualize/<chart_type>', methods=['POST'])
def create_visualization(chart_type):
    """Create sector visualization charts"""
    try:
        data = request.get_json()
        portfolio_data = data.get('portfolio', [])
        
        if not portfolio_data:
            return jsonify({'error': 'No portfolio data provided'}), 400
        
        if chart_type == 'pie':
            fig = sector_viz.create_pie_chart(portfolio_data)
        elif chart_type == 'bar':
            fig = sector_viz.create_bar_chart(portfolio_data)
        elif chart_type == 'treemap':
            fig = sector_viz.create_treemap(portfolio_data)
        elif chart_type == 'dashboard':
            fig = sector_viz.create_dashboard(portfolio_data)
        else:
            return jsonify({'error': 'Invalid chart type'}), 400
        
        return jsonify({
            'success': True,
            'chart_data': json.loads(fig.to_json())
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sector_bp.route('/api/sector/benchmark-comparison', methods=['POST'])
def benchmark_comparison():
    """Compare portfolio against major benchmarks"""
    try:
        from clients.market_data_client import MarketDataClient
        import numpy as np
        
        data = request.get_json()
        portfolio_data = data.get('portfolio', [])
        
        if not portfolio_data:
            return jsonify({'error': 'No portfolio data provided'}), 400
        
        # Check cache
        cache_key = cache_manager.generate_key('sector-benchmark', data)
        cached_result = cache_manager.get(cache_key)
        if cached_result:
            return jsonify(cached_result)

        client = MarketDataClient()
        
        # Calculate portfolio metrics
        symbols = [p['symbol'] for p in portfolio_data]
        total_value = sum(p.get('market_value', 0) or p.get('quantity', 0) * p.get('price', 0) for p in portfolio_data)
        
        # Get current prices for portfolio and benchmarks
        benchmarks = {'S&P 500': 'SPY', 'Russell 3000': 'IWV', 'MSCI World': 'URTH'}
        all_symbols = symbols + list(benchmarks.values())
        prices = client.get_current_prices(all_symbols)
        
        # Portfolio analysis
        portfolio_analysis = sector_mapper.analyze_portfolio_sectors(portfolio_data)
        
        # Benchmark prices
        benchmark_prices = {name: prices.get(symbol, 0) for name, symbol in benchmarks.items()}
        
        response_data = {
            'success': True,
            'portfolio_value': total_value,
            'portfolio_analysis': portfolio_analysis,
            'benchmark_prices': benchmark_prices,
            'portfolio_prices': {symbol: prices.get(symbol, 0) for symbol in symbols}
        }
        cache_manager.set(cache_key, response_data)
        
        return jsonify(response_data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500