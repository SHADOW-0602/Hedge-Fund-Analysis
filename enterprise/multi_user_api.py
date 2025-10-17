from flask import Flask, request, jsonify, session
from flask_restful import Api, Resource
from functools import wraps
import json
from enterprise.user_management import UserManager, DataIsolationManager, CollaborationManager, UserRole, Permission

app = Flask(__name__)
app.secret_key = 'hedge_fund_multi_user_secret_2024'
api = Api(app)

# Initialize managers
user_manager = UserManager()
data_manager = DataIsolationManager()
collaboration_manager = CollaborationManager()

def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'No authorization header'}, 401
        
        try:
            token = auth_header.split(' ')[1]  # Bearer <token>
            payload = user_manager.validate_jwt_token(token)
            if not payload:
                return {'error': 'Invalid token'}, 401
            
            request.current_user_id = payload['user_id']
            request.current_user_role = UserRole(payload['role'])
            return f(*args, **kwargs)
        except:
            return {'error': 'Invalid authorization'}, 401
    
    return decorated_function

def require_permission(permission: Permission):
    """Decorator to require specific permission"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(request, 'current_user_role'):
                return {'error': 'Authentication required'}, 401
            
            if not user_manager.permission_manager.has_permission(request.current_user_role, permission):
                return {'error': 'Insufficient permissions'}, 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

class AuthAPI(Resource):
    def post(self):
        """User authentication"""
        data = request.get_json()
        
        if 'action' not in data:
            return {'error': 'Action required'}, 400
        
        if data['action'] == 'login':
            username = data.get('username')
            password = data.get('password')
            
            if not username or not password:
                return {'error': 'Username and password required'}, 400
            
            user = user_manager.authenticate_user(username, password)
            if user:
                token = user_manager.generate_jwt_token(user)
                session_id = user_manager.create_session(user.user_id)
                
                return {
                    'token': token,
                    'session_id': session_id,
                    'user': {
                        'user_id': user.user_id,
                        'username': user.username,
                        'email': user.email,
                        'role': user.role.value
                    }
                }
            else:
                return {'error': 'Invalid credentials'}, 401
        
        elif data['action'] == 'register':
            username = data.get('username')
            email = data.get('email')
            password = data.get('password')
            role = data.get('role', 'viewer')
            
            if not all([username, email, password]):
                return {'error': 'Username, email, and password required'}, 400
            
            try:
                user_role = UserRole(role)
                user_id = user_manager.create_user(username, email, password, user_role)
                return {'user_id': user_id, 'message': 'User created successfully'}, 201
            except ValueError as e:
                return {'error': str(e)}, 400
        
        return {'error': 'Invalid action'}, 400

class UserPortfolioAPI(Resource):
    @require_auth
    @require_permission(Permission.READ_PORTFOLIO)
    def get(self):
        """Get user's portfolios"""
        user_portfolios = data_manager.get_user_portfolios(request.current_user_id)
        shared_portfolios = data_manager.get_shared_portfolios(request.current_user_id)
        
        return {
            'user_portfolios': user_portfolios,
            'shared_portfolios': shared_portfolios
        }
    
    @require_auth
    @require_permission(Permission.WRITE_PORTFOLIO)
    def post(self):
        """Create or update user portfolio"""
        data = request.get_json()
        
        portfolio_name = data.get('portfolio_name')
        portfolio_data = data.get('portfolio_data', {})
        
        if not portfolio_name:
            return {'error': 'Portfolio name required'}, 400
        
        portfolio_id = data_manager.save_user_portfolio(
            request.current_user_id, 
            portfolio_name, 
            portfolio_data
        )
        
        return {'portfolio_id': portfolio_id, 'message': 'Portfolio saved'}, 201

class SharePortfolioAPI(Resource):
    @require_auth
    @require_permission(Permission.SHARE_RESEARCH)
    def post(self):
        """Share portfolio with another user"""
        data = request.get_json()
        
        portfolio_id = data.get('portfolio_id')
        shared_with_username = data.get('shared_with_username')
        permission_level = data.get('permission_level', 'read')
        
        if not all([portfolio_id, shared_with_username]):
            return {'error': 'Portfolio ID and username required'}, 400
        
        # Find user by username
        users = user_manager.get_users()
        shared_with_user = next((u for u in users if u.username == shared_with_username), None)
        
        if not shared_with_user:
            return {'error': 'User not found'}, 404
        
        share_id = data_manager.share_portfolio(
            portfolio_id, 
            request.current_user_id, 
            shared_with_user.user_id, 
            permission_level
        )
        
        return {'share_id': share_id, 'message': 'Portfolio shared successfully'}, 201

class ResearchNotesAPI(Resource):
    @require_auth
    def get(self):
        """Get research notes"""
        include_public = request.args.get('include_public', 'true').lower() == 'true'
        notes = collaboration_manager.get_research_notes(request.current_user_id, include_public)
        
        return {'notes': notes}
    
    @require_auth
    @require_permission(Permission.WRITE_ANALYTICS)
    def post(self):
        """Create research note"""
        data = request.get_json()
        
        title = data.get('title')
        content = data.get('content', '')
        tags = data.get('tags', [])
        is_public = data.get('is_public', False)
        
        if not title:
            return {'error': 'Title required'}, 400
        
        note_id = collaboration_manager.create_research_note(
            request.current_user_id, 
            title, 
            content, 
            tags, 
            is_public
        )
        
        return {'note_id': note_id, 'message': 'Research note created'}, 201

class ResearchCommentsAPI(Resource):
    @require_auth
    def get(self, note_id):
        """Get comments for research note"""
        comments = collaboration_manager.get_comments(note_id)
        return {'comments': comments}
    
    @require_auth
    def post(self, note_id):
        """Add comment to research note"""
        data = request.get_json()
        comment = data.get('comment')
        
        if not comment:
            return {'error': 'Comment required'}, 400
        
        comment_id = collaboration_manager.add_comment(note_id, request.current_user_id, comment)
        
        return {'comment_id': comment_id, 'message': 'Comment added'}, 201

class WorkspaceAPI(Resource):
    @require_auth
    def get(self):
        """Get user's workspaces"""
        workspaces = collaboration_manager.get_user_workspaces(request.current_user_id)
        return {'workspaces': workspaces}
    
    @require_auth
    def post(self):
        """Create new workspace"""
        data = request.get_json()
        
        workspace_name = data.get('workspace_name')
        description = data.get('description', '')
        
        if not workspace_name:
            return {'error': 'Workspace name required'}, 400
        
        workspace_id = collaboration_manager.create_workspace(
            workspace_name, 
            description, 
            request.current_user_id
        )
        
        return {'workspace_id': workspace_id, 'message': 'Workspace created'}, 201

class WorkspaceMembersAPI(Resource):
    @require_auth
    def post(self, workspace_id):
        """Add member to workspace"""
        data = request.get_json()
        
        username = data.get('username')
        role = data.get('role', 'member')
        
        if not username:
            return {'error': 'Username required'}, 400
        
        # Find user by username
        users = user_manager.get_users()
        user = next((u for u in users if u.username == username), None)
        
        if not user:
            return {'error': 'User not found'}, 404
        
        collaboration_manager.add_workspace_member(workspace_id, user.user_id, role)
        
        return {'message': 'Member added to workspace'}, 201

class UserManagementAPI(Resource):
    @require_auth
    @require_permission(Permission.MANAGE_USERS)
    def get(self):
        """Get all users (admin only)"""
        users = user_manager.get_users()
        
        user_list = []
        for user in users:
            user_list.append({
                'user_id': user.user_id,
                'username': user.username,
                'email': user.email,
                'role': user.role.value,
                'created_at': user.created_at.isoformat(),
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'is_active': user.is_active
            })
        
        return {'users': user_list}
    
    @require_auth
    @require_permission(Permission.MANAGE_USERS)
    def post(self):
        """Create new user (admin only)"""
        data = request.get_json()
        
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'viewer')
        
        if not all([username, email, password]):
            return {'error': 'Username, email, and password required'}, 400
        
        try:
            user_role = UserRole(role)
            user_id = user_manager.create_user(username, email, password, user_role)
            return {'user_id': user_id, 'message': 'User created successfully'}, 201
        except ValueError as e:
            return {'error': str(e)}, 400

class UserPermissionsAPI(Resource):
    @require_auth
    def get(self):
        """Get current user's permissions"""
        permissions = user_manager.permission_manager.get_permissions(request.current_user_role)
        
        return {
            'role': request.current_user_role.value,
            'permissions': [p.value for p in permissions]
        }

# Register API endpoints
api.add_resource(AuthAPI, '/api/auth')
api.add_resource(UserPortfolioAPI, '/api/user/portfolios')
api.add_resource(SharePortfolioAPI, '/api/user/share-portfolio')
api.add_resource(ResearchNotesAPI, '/api/research/notes')
api.add_resource(ResearchCommentsAPI, '/api/research/notes/<note_id>/comments')
api.add_resource(WorkspaceAPI, '/api/workspaces')
api.add_resource(WorkspaceMembersAPI, '/api/workspaces/<workspace_id>/members')
api.add_resource(UserManagementAPI, '/api/admin/users')
api.add_resource(UserPermissionsAPI, '/api/user/permissions')

# Health check with user info
@app.route('/api/user/profile')
@require_auth
def user_profile():
    # Get user details
    users = user_manager.get_users()
    current_user = next((u for u in users if u.user_id == request.current_user_id), None)
    
    if current_user:
        return jsonify({
            'user_id': current_user.user_id,
            'username': current_user.username,
            'email': current_user.email,
            'role': current_user.role.value,
            'created_at': current_user.created_at.isoformat(),
            'last_login': current_user.last_login.isoformat() if current_user.last_login else None
        })
    
    return jsonify({'error': 'User not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)