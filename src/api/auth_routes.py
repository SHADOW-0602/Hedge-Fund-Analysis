from flask import request, jsonify
from clients.supabase_client import supabase_client
from enterprise.user_management import UserManager, UserRole
from utils.email_service import email_service
from datetime import datetime
import traceback

user_manager = UserManager()

def register_auth_routes(app):
    @app.route('/api/login', methods=['POST'])
    def login():
        try:
            print(f"[AUTH] Login attempt started at {datetime.now()}")
            data = request.get_json()
            username = data.get('username')
            password = data.get('password')
            
            print(f"[AUTH] Login attempt for username: {username}")
            
            if not username or not password:
                print(f"[AUTH] Missing credentials - username: {bool(username)}, password: {bool(password)}")
                return jsonify({'success': False, 'error': 'Username and password required'}), 400
            
            if not supabase_client or not supabase_client.client:
                print(f"[AUTH] Database not available - supabase_client: {bool(supabase_client)}")
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            print(f"[AUTH] Attempting authentication for: {username}")
            user = user_manager.authenticate_user(username, password)
            
            if user:
                print(f"[AUTH] Authentication successful for: {username}, role: {user.role.value}")
                
                # Store user info in session for Plaid integration
                from flask import session
                from utils.secure_id_manager import secure_id_manager
                
                # Use secure token instead of UUID
                secure_token = secure_id_manager.get_secure_token(user.user_id)
                session['user_id'] = secure_token
                session['username'] = user.username
                session['real_user_id'] = user.user_id  # Keep for internal use
                
                return jsonify({
                    'success': True,
                    'user': {
                        'username': user.username,
                        'role': user.role.value,
                        'user_id': user.user_id,
                        'email': user.email,
                        'phone': user.phone
                    }
                })
            
            print(f"[AUTH] Authentication failed for: {username}")
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
        except Exception as e:
            print(f"[AUTH] Login error: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/register', methods=['POST'])
    def register():
        try:
            data = request.get_json()
            username = data.get('username')
            email = data.get('email')
            phone = data.get('phone')  # Optional field
            password = data.get('password')
            
            # Check required fields (phone is optional)
            if not all([username, email, password]):
                return jsonify({'success': False, 'error': 'Username, email, and password are required'}), 400
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            # Check field uniqueness
            if user_manager.username_exists(username):
                return jsonify({'success': False, 'error': 'Username already exists'}), 400
            
            if user_manager.email_exists(email):
                return jsonify({'success': False, 'error': 'Email already exists'}), 400
            
            if phone and user_manager.phone_exists(phone):
                return jsonify({'success': False, 'error': 'Phone number already exists'}), 400
            
            user_role = UserRole.USER
            user_id = user_manager.create_user(username, email, password, user_role, phone)
            
            if user_id:
                email_sent = email_service.send_welcome_email(email, username)
                role_counts = user_manager.get_role_counts()
                
                return jsonify({
                    'success': True,
                    'message': 'User created successfully',
                    'email_sent': email_sent,
                    'role_counts': role_counts,
                    'user_id': user_id
                })
            else:
                return jsonify({'success': False, 'error': 'Failed to create user'}), 500
                
        except ValueError as e:
            return jsonify({'success': False, 'error': str(e)}), 400
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/auth/debug', methods=['GET'])
    def auth_debug():
        try:
            debug_info = {
                'supabase_available': bool(supabase_client and supabase_client.client),
                'user_manager_initialized': bool(user_manager),
                'timestamp': datetime.now().isoformat()
            }
            
            if supabase_client and supabase_client.client:
                try:
                    # Check if admin user exists
                    result = supabase_client.client.table('app_users').select('username, role').eq('username', 'admin').execute()
                    debug_info['admin_user_exists'] = len(result.data) > 0
                    debug_info['admin_user_data'] = result.data[0] if result.data else None
                    
                    # Get total user count
                    all_users = supabase_client.client.table('app_users').select('username, role, is_active').execute()
                    debug_info['total_users'] = len(all_users.data)
                    debug_info['users'] = all_users.data
                except Exception as e:
                    debug_info['database_error'] = str(e)
            
            return jsonify(debug_info)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/auth/create-admin', methods=['POST'])
    def create_admin():
        try:
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            # Force create admin user
            admin_data = {
                'username': 'admin',
                'email': 'admin@hedgefund.com',
                'password_hash': user_manager._hash_password('admin123'),
                'role': 'admin',
                'is_active': True
            }
            
            result = supabase_client.client.table('app_users').upsert(admin_data).execute()
            
            return jsonify({
                'success': True,
                'message': 'Admin user created/updated',
                'data': result.data
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500