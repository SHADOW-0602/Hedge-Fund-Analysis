from flask import request, jsonify
from clients.plaid_client import plaid_client

def register_plaid_routes(app):
    @app.route('/api/create-link-token', methods=['POST'])
    def create_link_token():
        try:
            print(f"[PLAID] Creating link token for PRODUCTION mode")
            data = request.get_json()
            user_id = data.get('user_id', 'default_user')
            print(f"[PLAID] Link token request for user: {user_id}")
            
            if not plaid_client or not plaid_client.is_available():
                return jsonify({
                    'success': False,
                    'error': 'Plaid client not configured. Check PLAID_CLIENT_ID and PLAID_SECRET in .env',
                    'environment': 'production'
                }), 500
            
            link_token = plaid_client.create_link_token(user_id)
            
            if link_token:
                print(f"[PLAID] PRODUCTION link token created successfully")
                return jsonify({
                    'success': True, 
                    'link_token': link_token,
                    'environment': plaid_client.environment,
                    'products': plaid_client.products
                })
            else:
                print(f"[PLAID] Failed to create PRODUCTION link token")
                return jsonify({
                    'success': False,
                    'error': 'Failed to create link token - check Plaid credentials',
                    'environment': plaid_client.environment
                }), 400
                
        except Exception as e:
            print(f"[PLAID] PRODUCTION link token error: {str(e)}")
            return jsonify({
                'success': False, 
                'error': f'Link token error: {str(e)}',
                'environment': 'production'
            }), 500

    @app.route('/api/exchange-token', methods=['POST'])
    def exchange_token():
        try:
            print(f"[PLAID] Exchanging public token for PRODUCTION access")
            data = request.get_json()
            public_token = data.get('public_token')
            user_id = data.get('user_id', 'default_user')
            
            if not plaid_client or not plaid_client.is_available():
                return jsonify({
                    'success': False, 
                    'error': 'Plaid client not available',
                    'environment': 'production'
                }), 500
            
            access_token = plaid_client.exchange_public_token(public_token, user_id)
            
            if access_token:
                print(f"[PLAID] PRODUCTION token exchanged successfully for user: {user_id}")
                return jsonify({
                    'success': True, 
                    'message': 'Production token exchanged successfully',
                    'environment': plaid_client.environment
                })
            else:
                print(f"[PLAID] Failed to exchange PRODUCTION token")
                return jsonify({
                    'success': False,
                    'error': 'Failed to exchange token - check Plaid configuration',
                    'environment': plaid_client.environment
                }), 400
                
        except Exception as e:
            print(f"[PLAID] PRODUCTION token exchange error: {str(e)}")
            return jsonify({
                'success': False, 
                'error': f'Token exchange error: {str(e)}',
                'environment': 'production'
            }), 500

    @app.route('/api/plaid-portfolio', methods=['GET'])
    def get_plaid_portfolio():
        try:
            print(f"[PLAID] Fetching PRODUCTION portfolio data")
            user_id = request.args.get('user_id', 'default_user')
            print(f"[PLAID] User ID: {user_id}")
            
            # Check if Plaid is available
            if not plaid_client:
                print(f"[PLAID] Plaid client is None")
                return jsonify({
                    'success': False,
                    'error': 'Plaid client not initialized - check PLAID_CLIENT_ID and PLAID_SECRET',
                    'environment': 'production'
                }), 200
            
            if not plaid_client.is_available():
                print(f"[PLAID] Plaid client not available")
                return jsonify({
                    'success': False,
                    'error': 'Plaid client not configured properly',
                    'environment': 'production'
                }), 200
            
            # Check if user has access token
            from utils.user_secrets import user_secret_manager
            access_token = user_secret_manager.get_plaid_token(user_id)
            if not access_token:
                print(f"[PLAID] No access token found for user: {user_id}")
                return jsonify({
                    'success': False,
                    'error': 'No Plaid connection found - please connect your brokerage account first',
                    'environment': plaid_client.environment
                }), 200
            
            print(f"[PLAID] Getting holdings for user: {user_id}")
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
                
                print(f"[PLAID] Retrieved {len(holdings)} PRODUCTION holdings, Total Value: ${total_portfolio_value:,.2f}")
                return jsonify({
                    'success': True, 
                    'holdings': holdings,
                    'portfolio_value': total_portfolio_value,
                    'environment': plaid_client.environment,
                    'total_positions': len(holdings)
                })
            else:
                print(f"[PLAID] No PRODUCTION holdings found for user: {user_id}")
                return jsonify({
                    'success': False, 
                    'error': 'No holdings found - connect a brokerage account first',
                    'environment': plaid_client.environment if plaid_client else 'production'
                }), 200
                
        except Exception as e:
            print(f"[PLAID] PRODUCTION portfolio error: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False, 
                'error': f'Plaid portfolio error: {str(e)}',
                'environment': 'production'
            }), 200
    
    @app.route('/api/plaid/webhook', methods=['POST'])
    def plaid_webhook():
        """Handle Plaid webhooks for production"""
        try:
            data = request.get_json()
            webhook_type = data.get('webhook_type')
            webhook_code = data.get('webhook_code')
            
            print(f"[PLAID] PRODUCTION webhook received: {webhook_type}.{webhook_code}")
            
            # Handle different webhook types
            if webhook_type == 'INVESTMENTS':
                print(f"[PLAID] Investment data updated for production account")
            elif webhook_type == 'TRANSACTIONS':
                print(f"[PLAID] Transaction data updated for production account")
            
            return jsonify({'success': True}), 200
            
        except Exception as e:
            print(f"[PLAID] PRODUCTION webhook error: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/plaid-transactions', methods=['GET', 'POST'])
    def get_plaid_transactions():
        try:
            if request.method == 'GET':
                user_id = request.args.get('user_id', 'admin')
                days = int(request.args.get('days', 90))
            else:
                data = request.get_json()
                user_id = data.get('user_id', 'admin')
                days = data.get('days', 90)
            
            if not plaid_client or not plaid_client.is_available():
                return jsonify({'success': False, 'error': 'Plaid client not available'}), 500
            
            # Get investment transactions instead of regular transactions
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
    
    @app.route('/api/plaid-investment-transactions', methods=['POST'])
    def get_plaid_investment_transactions():
        try:
            data = request.get_json()
            user_id = data.get('user_id', 'demo_user')
            days = data.get('days', 90)
            
            if not plaid_client or not plaid_client.is_available():
                return jsonify({'success': False, 'error': 'Plaid client not available'}), 500
            
            transactions_df = plaid_client.get_investment_transactions(user_id, days)
            
            if not transactions_df.empty:
                transactions = transactions_df.to_dict('records')
                return jsonify({
                    'success': True,
                    'transactions': transactions,
                    'count': len(transactions)
                })
            else:
                return jsonify({'success': False, 'error': 'No investment transactions found'}), 404
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/plaid-accounts', methods=['POST'])
    def get_plaid_accounts():
        try:
            data = request.get_json()
            user_id = data.get('user_id', 'demo_user')
            
            if not plaid_client or not plaid_client.is_available():
                return jsonify({'success': False, 'error': 'Plaid client not available'}), 500
            
            accounts = plaid_client.get_accounts(user_id)
            
            if accounts:
                return jsonify({
                    'success': True,
                    'accounts': accounts,
                    'count': len(accounts)
                })
            else:
                return jsonify({'success': False, 'error': 'No accounts found'}), 404
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/disconnect-plaid', methods=['POST'])
    def disconnect_plaid():
        try:
            data = request.get_json()
            user_id = data.get('user_id', 'default_user')
            print(f"[PLAID] Disconnecting user: {user_id}")
            
            from utils.user_secrets import user_secret_manager
            user_secret_manager.delete_plaid_token(user_id)
            
            print(f"[PLAID] Successfully disconnected user: {user_id}")
            return jsonify({
                'success': True,
                'message': 'Plaid connection removed successfully'
            })
            
        except Exception as e:
            print(f"[PLAID] Disconnect error: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Disconnect error: {str(e)}'
            }), 500
    
    @app.route('/plaid/callback')
    def plaid_callback():
        """Handle Plaid OAuth callback"""
        return "<h1>Plaid Connection Successful</h1><p>You can close this window and return to the app.</p>"