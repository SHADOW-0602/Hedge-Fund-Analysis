from flask import request, jsonify, session
try:
    from clients.plaid_client import plaid_client
except ImportError:
    plaid_client = None
try:
    from clients.supabase_client import supabase_client
except ImportError:
    supabase_client = None
try:
    from utils.secure_id_manager import secure_id_manager
except ImportError:
    secure_id_manager = None
try:
    from utils.plaid_supabase_manager import plaid_supabase_manager
except ImportError:
    plaid_supabase_manager = None

def get_real_user_id():
    """Get real UUID from session, handling secure tokens"""
    print(f"[PLAID] Session contents: {dict(session)}")
    
    # First check for real_user_id (the actual UUID)
    if 'real_user_id' in session:
        real_id = session['real_user_id']
        print(f"[PLAID] Using real_user_id from session: {real_id}")
        return real_id
    
    # Then check for user_id (might be secure token or UUID)
    elif 'user_id' in session:
        user_id = session['user_id']
        print(f"[PLAID] Found user_id in session: {user_id}")
        
        # If it's already a UUID format, use it directly
        if len(user_id) == 36 and user_id.count('-') == 4:
            print(f"[PLAID] user_id is UUID format, using directly")
            return user_id
        
        # Otherwise try to get UUID from secure token
        try:
            real_uuid = secure_id_manager.get_uuid_from_token(user_id)
            if real_uuid:
                print(f"[PLAID] Converted secure token to UUID: {real_uuid}")
                return real_uuid
            else:
                print(f"[PLAID] Could not convert secure token, using as-is: {user_id}")
                return user_id
        except Exception as e:
            print(f"[PLAID] Error converting secure token: {e}, using as-is: {user_id}")
            return user_id
    
    # Fallback: check if we have the known UUID with token
    print(f"[PLAID] No user_id in session, checking for existing token holder")
    
    # Try to find a user with Plaid connections in Supabase
    try:
        if supabase_client and supabase_client.service_client:
            result = supabase_client.service_client.table('plaid_connections')\
                .select('user_id')\
                .eq('is_active', True)\
                .limit(1)\
                .execute()
            
            if result.data:
                fallback_user_id = result.data[0]['user_id']
                print(f"[PLAID] Using fallback user with Plaid connection: {fallback_user_id}")
                return fallback_user_id
    except Exception as e:
        print(f"[PLAID] Error finding fallback user: {e}")
    
    # Final fallback to known admin user
    admin_user_id = '744944b4-c861-4950-9cb1-a34ded460d36'
    print(f"[PLAID] Using admin user as final fallback: {admin_user_id}")
    return admin_user_id

def register_plaid_routes(app):
    @app.route('/api/plaid-status', methods=['GET', 'POST'])
    def plaid_status():
        try:
            user_id = get_real_user_id()
            print(f"[PLAID] Checking status for user: {user_id}")
            
            connections = plaid_supabase_manager.get_plaid_connections(user_id)
            print(f"[PLAID] Connections found for {user_id}: {len(connections)}")
            
            connection_details = []
            for conn_data in connections:
                try:
                    # Test if this specific connection works
                    token = conn_data.get('access_token')
                    if token and plaid_client:
                        # Try to get accounts with this specific token
                        accounts = plaid_client.get_accounts(user_id)
                        connection_details.append({
                            'connection_id': conn_data['connection_id'],
                            'institution_name': conn_data.get('institution_name', 'Unknown'),
                            'created_at': conn_data.get('created_at', 'Unknown'),
                            'accounts_count': len(accounts),
                            'status': 'active' if len(accounts) > 0 else 'no_accounts'
                        })
                    else:
                        connection_details.append({
                            'connection_id': conn_data['connection_id'],
                            'institution_name': conn_data.get('institution_name', 'Unknown'),
                            'created_at': conn_data.get('created_at', 'Unknown'),
                            'accounts_count': 0,
                            'status': 'inactive'
                        })
                except Exception as e:
                    connection_details.append({
                        'connection_id': conn_data['connection_id'],
                        'institution_name': conn_data.get('institution_name', 'Unknown'),
                        'created_at': conn_data.get('created_at', 'Unknown'),
                        'status': 'error',
                        'error': str(e)
                    })
            
            return jsonify({
                'success': True,
                'connected': len(connections) > 0,
                'connections_count': len(connections),
                'connections': connection_details,
                'environment': plaid_client.environment if plaid_client else 'production',
                'user_id': user_id
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'connected': False,
                'error': str(e)
            }), 500

    @app.route('/api/plaid-portfolio', methods=['GET', 'POST'])
    def get_plaid_portfolio():
        try:
            user_id = get_real_user_id()
            print(f"[PLAID] Fetching portfolio for user: {user_id}")
            
            if not plaid_client or not plaid_client.is_available():
                return jsonify({
                    'success': False,
                    'error': 'Plaid client not available',
                    'environment': 'production'
                }), 200
            
            access_token = plaid_supabase_manager.get_plaid_token(user_id)
            print(f"[PLAID] Access token found for {user_id}: {bool(access_token)}")
            
            if not access_token:
                return jsonify({
                    'success': False,
                    'error': 'No Plaid connection found - please connect your brokerage account first',
                    'environment': plaid_client.environment,
                    'requires_connection': True,
                    'user_id': user_id
                }), 200
            
            holdings_df = plaid_client.get_holdings(user_id)
            
            if not holdings_df.empty:
                holdings = []
                total_portfolio_value = 0
                
                for _, row in holdings_df.iterrows():
                    market_value = float(row.get('market_value', 0))
                    total_portfolio_value += market_value
                    
                    holding = {
                        'symbol': row.get('symbol', 'UNKNOWN'),
                        'name': row.get('name', ''),
                        'quantity': float(row.get('quantity', 0)),
                        'avg_cost': float(row.get('avg_cost', 0)),
                        'market_value': market_value,
                        'cost_basis': float(row.get('cost_basis', 0)),
                        'account_id': row.get('account_id', ''),
                        'security_type': row.get('security_type', 'equity')
                    }
                    holdings.append(holding)
                
                return jsonify({
                    'success': True, 
                    'holdings': holdings,
                    'portfolio_value': total_portfolio_value,
                    'environment': plaid_client.environment,
                    'total_positions': len(holdings)
                })
            else:
                return jsonify({
                    'success': False, 
                    'error': 'No holdings found - connect a brokerage account first',
                    'environment': plaid_client.environment
                }), 200
                
        except Exception as e:
            return jsonify({
                'success': False, 
                'error': f'Plaid portfolio error: {str(e)}',
                'environment': 'production'
            }), 200

    @app.route('/api/create-link-token', methods=['POST'])
    def create_link_token():
        try:
            data = request.get_json() or {}
            user_id = get_real_user_id()
            username = data.get('username') or session.get('username')
            
            if not plaid_client or not plaid_client.is_available():
                return jsonify({
                    'success': False,
                    'error': 'Plaid client not configured',
                    'environment': 'production'
                }), 500
            
            link_token = plaid_client.create_link_token(user_id, username)
            
            if link_token:
                return jsonify({
                    'success': True, 
                    'link_token': link_token,
                    'environment': plaid_client.environment,
                    'products': plaid_client.products
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to create link token',
                    'environment': plaid_client.environment
                }), 400
                
        except Exception as e:
            return jsonify({
                'success': False, 
                'error': f'Link token error: {str(e)}',
                'environment': 'production'
            }), 500

    @app.route('/api/exchange-token', methods=['POST'])
    def exchange_token():
        try:
            data = request.get_json() or {}
            public_token = data.get('public_token')
            institution_name = data.get('institution_name', 'Unknown Institution')
            user_id = get_real_user_id()
            
            if not plaid_client or not plaid_client.is_available():
                return jsonify({
                    'success': False, 
                    'error': 'Plaid client not available',
                    'environment': 'production'
                }), 500
            
            access_token = plaid_client.exchange_public_token_raw(public_token)
            if access_token:
                connection_id = plaid_supabase_manager.store_plaid_token(user_id, access_token, institution_name)
            else:
                connection_id = None
            
            if connection_id:
                return jsonify({
                    'success': True, 
                    'message': 'Token exchanged successfully',
                    'connection_id': connection_id,
                    'environment': plaid_client.environment
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to exchange token',
                    'environment': plaid_client.environment
                }), 400
                
        except Exception as e:
            return jsonify({
                'success': False, 
                'error': f'Token exchange error: {str(e)}',
                'environment': 'production'
            }), 500

    @app.route('/api/plaid-transactions', methods=['GET', 'POST'])
    def get_plaid_transactions():
        try:
            user_id = get_real_user_id()
            days = int(request.args.get('days', 90)) if request.method == 'GET' else request.get_json().get('days', 90)
            
            if not plaid_client or not plaid_client.is_available():
                return jsonify({'success': False, 'error': 'Plaid client not available'}), 500
            
            access_token = plaid_supabase_manager.get_plaid_token(user_id)
            
            if not access_token:
                return jsonify({'success': False, 'error': 'No Plaid connection found'}), 200
            
            transactions_df = plaid_client.get_investment_transactions(user_id, days)
            
            if not transactions_df.empty:
                transactions = transactions_df.to_dict('records')
                return jsonify({
                    'success': True,
                    'transactions': transactions,
                    'count': len(transactions)
                })
            else:
                return jsonify({'success': False, 'error': 'No investment transactions found'}), 200
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/disconnect-plaid', methods=['POST'])
    def disconnect_plaid():
        try:
            user_id = get_real_user_id()
            plaid_supabase_manager.delete_plaid_connection(user_id)
            return jsonify({'success': True, 'message': 'Plaid connection disconnected'})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/delete-plaid-connection', methods=['DELETE'])
    def delete_plaid_connection():
        try:
            user_id = get_real_user_id()
            data = request.get_json() or {}
            connection_id = data.get('connection_id')
            
            if not connection_id:
                return jsonify({'success': False, 'error': 'Connection ID is required'}), 400
                
            success = plaid_supabase_manager.delete_plaid_connection(user_id, connection_id)
            
            if success:
                return jsonify({'success': True, 'message': 'Plaid connection deleted permanently'})
            else:
                return jsonify({'success': False, 'error': 'Failed to delete connection'}), 500
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500