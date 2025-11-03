from flask import request, jsonify
import pandas as pd
import polars as pl
from datetime import datetime
from clients.supabase_client import supabase_client
from .route_utils import normalize_portfolio_format, sanitize_for_json

def register_portfolio_management_routes(app, data_client, smart_cache=None):
    """Register portfolio management routes"""
    
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