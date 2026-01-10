from flask import Blueprint, request, jsonify, send_file
import logging
from analytics.option_ohlc_scraper import OptionOHLCScraper
import os

option_scraper_bp = Blueprint('option_scraper', __name__)
logger = logging.getLogger(__name__)

@option_scraper_bp.route('/options/scrape', methods=['POST'])
def scrape_options():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No input data provided'}), 400
            
        symbols = data.get('symbols', [])
        expirations = data.get('expirations', [])
        strikes = data.get('strikes', [])
        
        # Simple validation
        if not symbols or not expirations or not strikes:
             return jsonify({'error': 'Missing required fields: symbols, expirations, strikes'}), 400
             
        if isinstance(symbols, str): symbols = [s.strip() for s in symbols.split(',')]
        if isinstance(expirations, str): expirations = [e.strip() for e in expirations.split(',')]
        if isinstance(strikes, str): strikes = [float(s.strip()) for s in strikes.split(',')]
        
        # Instantiate Scraper
        scraper = OptionOHLCScraper()
        
        # Run Job
        df = scraper.run_scraper(symbols, expirations, strikes)
        
        if df.empty:
             return jsonify({
                 'success': False, 
                 'message': 'No data found for the given combinations.',
                 'count': 0
             }), 200
             
        # Generate CSV / Upload to R2
        output_path = scraper.generate_csv(df)
        
        result = {
            'success': True,
            'message': 'Scraping completed successfully.',
            'count': len(df),
            'output_path': output_path,
            'is_r2': output_path.startswith('r2://') if output_path else False
        }
        
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Option scraping failed: {e}")
        return jsonify({'error': str(e)}), 500

@option_scraper_bp.route('/options/download', methods=['GET'])
def download_csv():
    try:
        filepath = request.args.get('path')
        if not filepath:
            return jsonify({'error': 'No file path specified'}), 400
            
        if filepath.startswith('r2://'):
             return jsonify({'error': 'R2 files cannot be downloaded directly via this endpoint yet.'}), 400

        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
            
        return send_file(filepath, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
