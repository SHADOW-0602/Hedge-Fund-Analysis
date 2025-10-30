from flask import request, jsonify
from clients.supabase_client import supabase_client
from enterprise.user_management import UserManager, UserRole
from utils.email_service import email_service

user_manager = UserManager()

def register_auth_routes(app):
    @app.route('/api/login', methods=['POST'])
    def login():
        try:
            data = request.get_json()
            username = data.get('username')
            password = data.get('password')
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            user = user_manager.authenticate_user(username, password)
            if user:
                return jsonify({
                    'success': True,
                    'user': {
                        'username': user.username,
                        'role': user.role.value,
                        'user_id': user.user_id,
                        'email': user.email
                    }
                })
            
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/register', methods=['POST'])
    def register():
        try:
            data = request.get_json()
            username = data.get('username')
            email = data.get('email')
            phone = data.get('phone')
            password = data.get('password')
            
            if not all([username, email, phone, password]):
                return jsonify({'success': False, 'error': 'All fields are required'}), 400
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            user_role = UserRole.USER
            user_id = user_manager.create_user(username, email, password, user_role)
            
            if user_id:
                email_sent = email_service.send_welcome_email(email, username)
                role_counts = user_manager.get_role_counts()
                
                return jsonify({
                    'success': True,
                    'message': 'User created successfully',
                    'email_sent': email_sent,
                    'role_counts': role_counts
                })
            else:
                return jsonify({'success': False, 'error': 'Failed to create user'}), 500
                
        except ValueError as e:
            return jsonify({'success': False, 'error': str(e)}), 400
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500