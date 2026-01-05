from flask import request, jsonify
import redis
import pickle
from enterprise.user_management import UserManager, UserRole

user_manager = UserManager()

def register_admin_routes(app, redis_client):
    @app.route('/api/admin/clear-cache', methods=['POST'])
    def clear_redis_cache():
        try:
            user_role = request.headers.get('X-User-Role', '')
            if user_role.lower() != 'admin':
                return jsonify({'success': False, 'error': 'Admin access required'}), 403
            
            if not redis_client:
                return jsonify({'success': False, 'error': 'Redis not available'}), 503
            
            redis_client.flushall()
            
            return jsonify({
                'success': True,
                'message': 'Redis cache cleared successfully'
            })
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/admin/server-mode', methods=['POST'])
    def set_server_mode():
        try:
            user_role = request.headers.get('X-User-Role', '')
            if user_role.lower() != 'admin':
                return jsonify({'success': False, 'error': 'Admin access required'}), 403
            
            data = request.get_json()
            server_mode = data.get('server_mode', True)
            
            if redis_client:
                redis_client.set('server_mode', 'true' if server_mode else 'false')
            
            return jsonify({
                'success': True,
                'server_mode': server_mode,
                'message': f'Server mode set to: {"enabled" if server_mode else "disabled"}'
            })
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/server-mode', methods=['GET'])
    def get_server_mode():
        try:
            if redis_client:
                mode = redis_client.get('server_mode')
                if mode:
                    server_mode = mode.decode('utf-8') == 'true'
                else:
                    server_mode = True
            else:
                server_mode = True
            
            return jsonify({'success': True, 'server_mode': server_mode})
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/admin/users', methods=['GET'])
    def get_all_users():
        try:
            user_role = request.headers.get('X-User-Role', '')
            if user_role.lower() != 'admin':
                return jsonify({'success': False, 'error': 'Admin access required'}), 403
            
            users = user_manager.get_users()
            user_list = []
            for user in users:
                user_list.append({
                    'user_id': user.user_id,
                    'username': user.username,
                    'email': user.email,
                    'role': user.role.value,
                    'created_at': user.created_at.isoformat() if user.created_at else None,
                    'last_login': user.last_login.isoformat() if user.last_login else None,
                    'is_active': user.is_active,
                    'phone': user.phone
                })
            
            return jsonify({'success': True, 'users': user_list})
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/roles', methods=['GET'])
    def get_available_roles():
        try:
            roles = [{
                'value': role.value,
                'name': role.value.title(),
                'description': 'Administrator with full system access' if role == UserRole.ADMIN else 'Standard user with portfolio analysis access'
            } for role in UserRole]
            
            role_counts = user_manager.get_role_counts() if hasattr(user_manager, 'get_role_counts') else {}
            
            return jsonify({
                'success': True,
                'roles': roles,
                'role_counts': role_counts,
                'total_roles': len(roles)
            })
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500