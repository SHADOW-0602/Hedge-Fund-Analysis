from flask import request, jsonify, url_for, redirect
from datetime import datetime
import traceback
import sys
import os

# Add src directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clients.supabase_client import supabase_client
from enterprise.user_management import UserManager, UserRole
from utils.email_service import email_service

from authlib.integrations.flask_client import OAuth

user_manager = UserManager()

def register_auth_routes(app):
    # Initialize OAuth
    oauth = OAuth(app)
    # Configure Google OAuth
    google = oauth.register(
        name='google',
        client_id=os.getenv('GOOGLE_CLIENT_ID'),
        client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )

    @app.route('/api/auth/google/login')
    def google_login():
        """
        Google OAuth Login
        ---
        tags:
          - Auth
        summary: Initiate Google OAuth login flow
        description: Redirects user to Google OAuth consent page
        responses:
          302:
            description: Redirect to Google OAuth
        """
        redirect_uri = url_for('google_callback', _external=True)
        # Ensure HTTPS in production if behind proxy
        if 'localhost' not in redirect_uri and '127.0.0.1' not in redirect_uri:
            redirect_uri = redirect_uri.replace('http:', 'https:')
        return google.authorize_redirect(redirect_uri)

    @app.route('/api/auth/google/callback')
    def google_callback():
        """
        Google OAuth Callback
        ---
        tags:
          - Auth
        summary: Handle Google OAuth callback
        description: Processes Google OAuth response and creates/logs in user
        parameters:
          - name: code
            in: query
            type: string
            required: true
            description: OAuth authorization code from Google
        responses:
          302:
            description: Redirect to app dashboard
          400:
            description: Failed to get email from Google
          500:
            description: Failed to create user
        """
        try:
            token = google.authorize_access_token()
            user_info = token.get('userinfo')
            
            if not user_info:
                # Fallback to fetching userinfo manually if not in token
                user_info = google.get('https://www.googleapis.com/oauth2/v3/userinfo').json()
                
            email = user_info.get('email')
            name = user_info.get('name', email.split('@')[0])
            
            if not email:
                return jsonify({'success': False, 'error': 'Failed to get email from Google'}), 400
                
            # Get or create local user
            user = user_manager.get_or_create_oauth_user(email, name)
            
            # Login user (set session)
            if user:
                from flask import session, make_response
                from utils.secure_id_manager import secure_id_manager
                import json
                
                # Make session permanent
                session.permanent = True
                
                secure_token = secure_id_manager.get_secure_token(user.user_id)
                session['user_id'] = secure_token
                session['username'] = user.username
                session['real_user_id'] = user.user_id
                
                # Create response with redirect
                response = make_response(redirect('/app'))
                
                # Set currentUser cookie for frontend SessionManager
                user_data = {
                    'username': user.username,
                    'role': user.role.value,
                    'user_id': user.user_id,
                    'email': user.email,
                    'phone': user.phone,
                    'loginTime': int(datetime.now().timestamp() * 1000)
                }
                
                # Set cookie manually to match frontend CookieManager.set behavior
                import urllib.parse
                cookie_value = urllib.parse.quote(json.dumps(user_data, separators=(',', ':')))
                # Note: Flask's set_cookie handles quoting, but frontend might expect specific format.
                # However, standard set_cookie should be compatible with JSON.parse on frontend.
                # IMPORTANT: httponly=False is required for frontend JS to read it!
                response.set_cookie('currentUser', cookie_value, max_age=30*24*60*60, path='/', httponly=False, samesite='Lax')
                
                return response
            else:
                return jsonify({'success': False, 'error': 'Failed to create user'}), 500
                
        except Exception as e:
            print(f"[AUTH] Google callback error: {e}")
            return redirect('/auth.html?error=Google login failed')

    @app.route('/api/login', methods=['POST'])
    def login():
        """
        User Login
        ---
        tags:
          - Auth
        summary: Authenticate user with username and password
        description: Validates credentials and creates session
        consumes:
          - application/json
        parameters:
          - name: body
            in: body
            required: true
            schema:
              type: object
              required:
                - username
                - password
              properties:
                username:
                  type: string
                  example: "admin"
                  description: User's username
                password:
                  type: string
                  format: password
                  example: "admin123"
                  description: User's password
        responses:
          200:
            description: Login successful
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                user:
                  type: object
                  properties:
                    username:
                      type: string
                    role:
                      type: string
                    user_id:
                      type: string
                    email:
                      type: string
                    phone:
                      type: string
          400:
            description: Missing credentials
          401:
            description: Invalid credentials
          500:
            description: Database not available
        """
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
        """
        User Registration
        ---
        tags:
          - Auth
        summary: Register a new user account
        description: Creates a new user with username, email, and password
        consumes:
          - application/json
        parameters:
          - name: body
            in: body
            required: true
            schema:
              type: object
              required:
                - username
                - email
                - password
              properties:
                username:
                  type: string
                  example: "newuser"
                  description: Desired username (must be unique)
                email:
                  type: string
                  format: email
                  example: "user@example.com"
                  description: User email (must be unique)
                phone:
                  type: string
                  example: "+1234567890"
                  description: User phone number (optional)
                password:
                  type: string
                  format: password
                  example: "SecurePass123"
                  description: User password
        responses:
          200:
            description: User created successfully
            schema:
              type: object
              properties:
                success:
                  type: boolean
                message:
                  type: string
                email_sent:
                  type: boolean
                role_counts:
                  type: object
                user_id:
                  type: string
          400:
            description: Missing fields or duplicate username/email/phone
          500:
            description: Failed to create user or database unavailable
        """
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
        """
        Authentication Debug Info
        ---
        tags:
          - Auth
        summary: Get authentication system status
        description: Returns debug information about auth system and database
        responses:
          200:
            description: Debug information retrieved
            schema:
              type: object
              properties:
                supabase_available:
                  type: boolean
                user_manager_initialized:
                  type: boolean
                timestamp:
                  type: string
                admin_user_exists:
                  type: boolean
                total_users:
                  type: integer
          500:
            description: Error retrieving debug info
        """
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
        """
        Create Admin User
        ---
        tags:
          - Auth
        summary: Create or update default admin user
        description: Creates admin user with default credentials (username:admin, password:admin123)
        responses:
          200:
            description: Admin user created/updated
            schema:
              type: object
              properties:
                success:
                  type: boolean
                message:
                  type: string
                data:
                  type: object
          500:
            description: Database unavailable or creation failed
        """
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

    # In-memory OTP cache for MVP: {email: {'otp': code, 'timestamp': datetime}}
    OTP_CACHE = {}
    
    import random
    import string
    
    def generate_otp():
        return ''.join(random.choices(string.digits, k=6))
    
    @app.route('/api/auth/reset-password-request', methods=['POST'])
    def reset_password_request():
        """
        Request Password Reset
        ---
        tags:
          - Auth
        summary: Request password reset OTP
        description: Sends a 6-digit OTP to user's email for password reset
        consumes:
          - application/json
        parameters:
          - name: body
            in: body
            required: true
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                  example: "user@example.com"
                  description: User email
                username:
                  type: string
                  example: "myusername"
                  description: Username (alternative to email)
        responses:
          200:
            description: OTP sent (or user not found - response same for security)
            schema:
              type: object
              properties:
                success:
                  type: boolean
                message:
                  type: string
          400:
            description: Email or username required
          500:
            description: Failed to send email
        """
        try:
            data = request.get_json()
            identifier = data.get('email') or data.get('username')
            
            if not identifier:
                return jsonify({'success': False, 'error': 'Email or Username is required'}), 400
            
            # Determine if input is email or username
            user = None
            email_to_use = None
            
            if '@' in identifier:
                user = user_manager.get_user_by_email(identifier)
                email_to_use = identifier
            else:
                user = user_manager.get_user_by_username(identifier)
                if user:
                    email_to_use = user.email
            
            # If user not found or no email associated
            if not user or not email_to_use:
                # Return success for security (prevent enumeration)
                return jsonify({'success': True, 'message': 'If an account exists, a code has been sent'})
            
            # Generate and store OTP
            otp = generate_otp()
            OTP_CACHE[email_to_use] = {
                'otp': otp,
                'timestamp': datetime.now()
            }
            
            # Send email
            if email_service.send_otp_email(email_to_use, user.username, otp):
                return jsonify({'success': True, 'message': f'Verification code sent to email associated with {user.username}'})
            else:
                return jsonify({'success': False, 'error': 'Failed to send email'}), 500
                
        except Exception as e:
            print(f"[AUTH] Reset request error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/auth/reset-password-confirm', methods=['POST'])
    def reset_password_confirm():
        """
        Confirm Password Reset
        ---
        tags:
          - Auth
        summary: Reset password with OTP
        description: Validates OTP and updates user password
        consumes:
          - application/json
        parameters:
          - name: body
            in: body
            required: true
            schema:
              type: object
              required:
                - email
                - otp
                - new_password
              properties:
                email:
                  type: string
                  format: email
                  example: "user@example.com"
                  description: User email
                otp:
                  type: string
                  example: "123456"
                  description: 6-digit OTP received via email
                new_password:
                  type: string
                  format: password
                  example: "NewSecurePass123"
                  description: New password
        responses:
          200:
            description: Password updated successfully
            schema:
              type: object
              properties:
                success:
                  type: boolean
                message:
                  type: string
          400:
            description: Invalid/expired OTP or missing fields
          500:
            description: Failed to update password
        """
        try:
            data = request.get_json()
            email = data.get('email')
            otp = data.get('otp')
            new_password = data.get('new_password')
            
            if not all([email, otp, new_password]):
                return jsonify({'success': False, 'error': 'All fields are required'}), 400
            
            # Verify OTP
            cached_data = OTP_CACHE.get(email)
            if not cached_data:
                return jsonify({'success': False, 'error': 'Invalid or expired code'}), 400
            
            # Check expiration (10 minutes)
            if (datetime.now() - cached_data['timestamp']).total_seconds() > 600:
                del OTP_CACHE[email]
                return jsonify({'success': False, 'error': 'Code expired'}), 400
            
            if cached_data['otp'] != otp:
                return jsonify({'success': False, 'error': 'Invalid code'}), 400
            
            # Update password
            user = user_manager.get_user_by_email(email)
            if user:
                if user_manager.update_password(user.user_id, new_password):
                    del OTP_CACHE[email] # Clear used OTP
                    return jsonify({'success': True, 'message': 'Password updated successfully'})
                else:
                    return jsonify({'success': False, 'error': 'Failed to update password'}), 500
            else:
                return jsonify({'success': False, 'error': 'User not found'}), 400
                
        except Exception as e:
            print(f"[AUTH] Reset confirm error: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500