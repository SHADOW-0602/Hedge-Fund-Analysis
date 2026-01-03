from flask import request, jsonify
import pandas as pd
import polars as pl
from datetime import datetime
from clients.supabase_client import supabase_client
from .route_utils import normalize_portfolio_format, sanitize_for_json

def register_portfolio_management_routes(app, data_client, smart_cache=None):
    """Register portfolio management routes"""
    print("[DEBUG] Registering portfolio management routes")
    
    @app.route('/api/upload-portfolio', methods=['POST'])
    def upload_portfolio():
        try:
            print(f"hedge_fund_app - INFO - Received portfolio file upload request")
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
            elif file.filename.lower().endswith('.json'):
                import json
                json_content = json.load(file.stream)
                
                # Handle list or dict wrapper
                if isinstance(json_content, dict) and 'positions' in json_content:
                    data_list = json_content['positions']
                elif isinstance(json_content, dict) and 'holdings' in json_content: # Plaid Common
                    data_list = json_content['holdings']
                elif isinstance(json_content, list):
                    data_list = json_content
                else:
                    data_list = [json_content] if isinstance(json_content, dict) else []
                
                # Parse into DataFrame-friendly format with defaults
                clean_data = []
                for item in data_list:
                    if not isinstance(item, dict): continue
                    cleaned = {k.lower().strip(): v for k, v in item.items()}
                    
                    # Robust defaults
                    symbol = cleaned.get('symbol') or cleaned.get('ticker') or cleaned.get('security_id') or 'UNKNOWN'
                    qty = cleaned.get('quantity') or cleaned.get('shares')
                    cost = cleaned.get('avg_cost') or cleaned.get('cost_basis') or cleaned.get('price')
                    
                    if qty is None: qty = 0.0
                    try: qty = float(qty)
                    except: qty = 0.0
                    
                    if cost is None: cost = 0.0
                    try: cost = float(cost)
                    except: cost = 0.0
                    
                    clean_data.append({
                        'symbol': symbol,
                        'quantity': qty,
                        'avg_cost': cost
                    })
                
                df = pd.DataFrame(clean_data)
            else:
                return jsonify({'success': False, 'error': 'Unsupported file format'}), 400
            
            df = normalize_portfolio_format(df)
            portfolio_data = df.to_dict('records')
            
            print(f"hedge_fund_app - INFO - Portfolio file upload completed successfully")
            return jsonify({
                'success': True,
                'portfolio': portfolio_data,
                'filename': file.filename
            })
        except Exception as e:
            print(f"hedge_fund_app - ERROR - Portfolio upload failed: {str(e)}")
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
        print("[DEBUG] load_portfolios route called")
        try:
            user_id = request.args.get('user_id')
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': True, 'portfolios': []})
            
            if not user_id:
                return jsonify({'success': True, 'portfolios': []})
            
            try:
                result = supabase_client.client.table('portfolios').select('*').eq('user_id', user_id).execute()
                portfolios = result.data or []
                
                for portfolio in portfolios:
                    portfolio['has_analytics'] = bool(portfolio.get('analytics_data'))
                    
                return jsonify({'success': True, 'portfolios': portfolios})
                    
            except Exception as e:
                print(f"Portfolio load error: {e}")
                return jsonify({'success': True, 'portfolios': []})
            
        except Exception as e:
            print(f"Portfolio load outer error: {e}")
            return jsonify({'success': True, 'portfolios': []})

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

    @app.route('/api/delete-uploaded-file', methods=['DELETE'])
    def delete_uploaded_file():
        try:
            data = request.get_json()
            file_id = data.get('file_id')
            filename = data.get('filename')
            file_type = data.get('file_type')
            user_id = request.headers.get('X-User-ID')
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            if not user_id:
                return jsonify({'success': False, 'error': 'Missing user ID'}), 400

            if file_id:
                # Delete by ID
                result = supabase_client.client.table('uploaded_files').delete().eq('id', file_id).eq('user_id', user_id).execute()
            elif filename:
                # Delete by filename (and optionally file_type)
                query = supabase_client.client.table('uploaded_files').delete().eq('user_id', user_id).eq('filename', filename)
                if file_type:
                    query = query.eq('file_type', file_type)
                result = query.execute()
            else:
                return jsonify({'success': False, 'error': 'Missing file ID or filename'}), 400
            
            if result.data:
                return jsonify({'success': True, 'message': 'File deleted successfully'})
            else:
                # It's possible the file record doesn't exist even if the transaction record did
                # We shouldn't fail the whole operation if the "cleanup" part fails gracefully
                return jsonify({'success': True, 'message': 'File not found or already deleted'}), 200
                
        except Exception as e:
            print(f"Delete uploaded file error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/download-sample-portfolio', methods=['GET'])
    def download_sample_portfolio():
        try:
            # Create a sample portfolio dataframe
            data = {
                'Symbol': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
                'Quantity': [100, 50, 30, 40, 20],
                'Date': [datetime.now().strftime('%Y-%m-%d')] * 5,
                'Price': [150.0, 300.0, 2800.0, 3400.0, 700.0], # Approximate prices
                'Type': ['Buy', 'Buy', 'Buy', 'Buy', 'Buy']
            }
            df = pd.DataFrame(data)
            
            # Convert to CSV
            csv_data = df.to_csv(index=False)
            
            from flask import Response
            return Response(
                csv_data,
                mimetype="text/csv",
                headers={"Content-disposition": "attachment; filename=sample_portfolio.csv"}
            )
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500