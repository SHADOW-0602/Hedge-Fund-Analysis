import hashlib
import jwt
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
from enum import Enum
import uuid
from clients.supabase_client import supabase_client

class UserRole(Enum):
    ADMIN = "admin"
    PORTFOLIO_MANAGER = "portfolio_manager"
    ANALYST = "analyst"
    RISK_MANAGER = "risk_manager"
    COMPLIANCE = "compliance"
    VIEWER = "viewer"

class Permission(Enum):
    READ_PORTFOLIO = "read_portfolio"
    WRITE_PORTFOLIO = "write_portfolio"
    READ_RISK = "read_risk"
    WRITE_RISK = "write_risk"
    READ_ANALYTICS = "read_analytics"
    WRITE_ANALYTICS = "write_analytics"
    READ_COMPLIANCE = "read_compliance"
    WRITE_COMPLIANCE = "write_compliance"
    MANAGE_USERS = "manage_users"
    SHARE_RESEARCH = "share_research"

@dataclass
class User:
    user_id: str
    username: str
    email: str
    role: UserRole
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool = True

class RolePermissionManager:
    def __init__(self):
        self.role_permissions = {
            UserRole.ADMIN: set(Permission),
            UserRole.PORTFOLIO_MANAGER: {
                Permission.READ_PORTFOLIO, Permission.WRITE_PORTFOLIO,
                Permission.READ_RISK, Permission.READ_ANALYTICS,
                Permission.WRITE_ANALYTICS, Permission.SHARE_RESEARCH
            },
            UserRole.ANALYST: {
                Permission.READ_PORTFOLIO, Permission.READ_ANALYTICS,
                Permission.WRITE_ANALYTICS, Permission.SHARE_RESEARCH
            },
            UserRole.RISK_MANAGER: {
                Permission.READ_PORTFOLIO, Permission.READ_RISK,
                Permission.WRITE_RISK, Permission.READ_ANALYTICS
            },
            UserRole.COMPLIANCE: {
                Permission.READ_PORTFOLIO, Permission.READ_RISK,
                Permission.READ_COMPLIANCE, Permission.WRITE_COMPLIANCE
            },
            UserRole.VIEWER: {
                Permission.READ_PORTFOLIO, Permission.READ_RISK,
                Permission.READ_ANALYTICS, Permission.READ_COMPLIANCE
            }
        }
    
    def has_permission(self, role: UserRole, permission: Permission) -> bool:
        return permission in self.role_permissions.get(role, set())
    
    def get_permissions(self, role: UserRole) -> Set[Permission]:
        return self.role_permissions.get(role, set())

class UserManager:
    def __init__(self):
        self.permission_manager = RolePermissionManager()
        self.secret_key = "hedge_fund_secret_key_2024"
        self.supabase = supabase_client.client if supabase_client else None
        if self.supabase:
            self._create_default_admin()
    
    def _create_default_admin(self):
        if not self.supabase:
            return
        try:
            # Check if admin exists
            result = self.supabase.table('app_users').select('*').eq('username', 'admin').execute()
            if not result.data:
                # Create admin user
                admin_data = {
                    'username': 'admin',
                    'email': 'admin@hedgefund.com',
                    'password_hash': self._hash_password('admin123'),
                    'role': 'admin'
                }
                self.supabase.table('app_users').insert(admin_data).execute()
        except:
            pass
    

    
    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()
    
    def create_user(self, username: str, email: str, password: str, role: UserRole) -> str:
        if not self.supabase:
            raise ValueError("Database not available")
        
        user_data = {
            'username': username,
            'email': email,
            'password_hash': self._hash_password(password),
            'role': role.value
        }
        
        try:
            result = self.supabase.table('app_users').insert(user_data).execute()
            return result.data[0]['user_id'] if result.data else None
        except Exception as e:
            raise ValueError("Username or email already exists")
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        if not self.supabase:
            return None
        
        password_hash = self._hash_password(password)
        
        result = self.supabase.table('app_users').select('*').eq('username', username).eq('password_hash', password_hash).eq('is_active', True).execute()
        
        if result.data:
            row = result.data[0]
            user = User(
                user_id=row['user_id'],
                username=row['username'],
                email=row['email'],
                role=UserRole(row['role']),
                created_at=datetime.fromisoformat(row['created_at']),
                last_login=datetime.fromisoformat(row['last_login']) if row['last_login'] else None,
                is_active=row['is_active']
            )
            
            self._update_last_login(user.user_id)
            return user
        
        return None
    
    def create_session(self, user_id: str) -> str:
        if not self.supabase:
            return str(uuid.uuid4())
        
        session_data = {
            'user_id': user_id,
            'expires_at': (datetime.now() + timedelta(hours=24)).isoformat()
        }
        
        result = self.supabase.table('user_sessions').insert(session_data).execute()
        return result.data[0]['session_id'] if result.data else str(uuid.uuid4())
    
    def validate_session(self, session_id: str) -> Optional[User]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT u.user_id, u.username, u.email, u.role, u.created_at, u.last_login, u.is_active
            FROM users u
            JOIN user_sessions s ON u.user_id = s.user_id
            WHERE s.session_id = ? AND s.expires_at > ? AND s.is_active = 1 AND u.is_active = 1
        ''', (session_id, datetime.now().isoformat()))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return User(
                user_id=row[0],
                username=row[1],
                email=row[2],
                role=UserRole(row[3]),
                created_at=datetime.fromisoformat(row[4]),
                last_login=datetime.fromisoformat(row[5]) if row[5] else None,
                is_active=bool(row[6])
            )
        
        return None
    
    def generate_jwt_token(self, user: User) -> str:
        payload = {
            'user_id': user.user_id,
            'username': user.username,
            'role': user.role.value,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }
        
        return jwt.encode(payload, self.secret_key, algorithm='HS256')
    
    def validate_jwt_token(self, token: str) -> Optional[Dict]:
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def check_permission(self, user: User, permission: Permission) -> bool:
        return self.permission_manager.has_permission(user.role, permission)
    
    def get_users(self) -> List[User]:
        if not self.supabase:
            return []
        
        result = self.supabase.table('app_users').select('*').eq('is_active', True).execute()
        
        users = []
        for row in result.data:
            users.append(User(
                user_id=row['user_id'],
                username=row['username'],
                email=row['email'],
                role=UserRole(row['role']),
                created_at=datetime.fromisoformat(row['created_at']),
                last_login=datetime.fromisoformat(row['last_login']) if row['last_login'] else None,
                is_active=row['is_active']
            ))
        
        return users
    
    def _update_last_login(self, user_id: str):
        if not self.supabase:
            return
        
        self.supabase.table('app_users').update({
            'last_login': datetime.now().isoformat()
        }).eq('user_id', user_id).execute()
    
    def update_password(self, user_id: str, new_password: str) -> bool:
        """Update user password"""
        if not self.supabase:
            return False
        
        try:
            password_hash = self._hash_password(new_password)
            result = self.supabase.table('app_users').update({
                'password_hash': password_hash
            }).eq('user_id', user_id).execute()
            return len(result.data) > 0
        except:
            return False
    
    def email_exists(self, email: str) -> bool:
        """Check if email already exists"""
        if not self.supabase:
            return False
        
        try:
            result = self.supabase.table('app_users').select('user_id').eq('email', email).execute()
            return len(result.data) > 0
        except:
            return False
    
    def update_user_email(self, user_id: str, new_email: str) -> bool:
        """Update user email address"""
        if not self.supabase:
            return False
        
        try:
            result = self.supabase.table('app_users').update({
                'email': new_email
            }).eq('user_id', user_id).execute()
            return len(result.data) > 0
        except:
            return False

class DataIsolationManager:
    def __init__(self):
        self.supabase = supabase_client.client if supabase_client else None
    

    
    def save_user_portfolio(self, user_id: str, portfolio_name: str, portfolio_data: Dict) -> str:
        if not self.supabase:
            return None
        
        return supabase_client.save_portfolio(user_id, portfolio_name, portfolio_data)
    
    def get_user_portfolios(self, user_id: str) -> List[Dict]:
        if not self.supabase:
            return []
        
        return supabase_client.get_user_portfolios(user_id)
    
    def share_portfolio(self, portfolio_id: str, owner_user_id: str, 
                       shared_with_user_id: str, permission_level: str = "read") -> str:
        share_id = str(uuid.uuid4())
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO shared_access (share_id, resource_type, resource_id, owner_user_id, 
                                     shared_with_user_id, permission_level, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (share_id, "portfolio", portfolio_id, owner_user_id, 
              shared_with_user_id, permission_level, datetime.now().isoformat()))
        
        # Mark portfolio as shared
        cursor.execute('''
            UPDATE user_portfolios SET is_shared = 1 WHERE portfolio_id = ?
        ''', (portfolio_id,))
        
        conn.commit()
        conn.close()
        
        return share_id
    
    def get_shared_portfolios(self, user_id: str) -> List[Dict]:
        if not self.supabase:
            return []
        
        # Simplified - return empty for now
        return []
    
    def get_user_transactions(self, user_id: str) -> List[Dict]:
        """Get all transaction sets for a user"""
        if not self.supabase:
            return []
        
        return supabase_client.get_user_transactions(user_id)
    
    def save_user_transactions(self, user_id: str, transaction_set_name: str, transactions_data: List[Dict]) -> str:
        """Save transaction set for user"""
        if not self.supabase:
            return None
        
        return supabase_client.save_transactions(user_id, transaction_set_name, transactions_data)

class CollaborationManager:
    def __init__(self):
        self.supabase = supabase_client.client if supabase_client else None
    

    
    def create_research_note(self, user_id: str, title: str, content: str, 
                           tags: List[str] = None, is_public: bool = False) -> str:
        if not self.supabase:
            return str(uuid.uuid4())
        
        note_data = {
            'user_id': user_id,
            'title': title,
            'content': content,
            'tags': tags or [],
            'is_public': is_public
        }
        
        result = self.supabase.table('research_notes').insert(note_data).execute()
        return result.data[0]['note_id'] if result.data else str(uuid.uuid4())
    
    def get_research_notes(self, user_id: str, include_public: bool = True) -> List[Dict]:
        if not self.supabase:
            return []
        
        try:
            if include_public:
                result = self.supabase.table('research_notes').select('*').or_(f'user_id.eq.{user_id},is_public.eq.true').order('updated_at', desc=True).execute()
            else:
                result = self.supabase.table('research_notes').select('*').eq('user_id', user_id).order('updated_at', desc=True).execute()
            
            notes = []
            for row in result.data:
                notes.append({
                    'note_id': row['note_id'],
                    'title': row['title'],
                    'content': row['content'],
                    'tags': row['tags'] or [],
                    'created_at': row['created_at'],
                    'updated_at': row['updated_at'],
                    'is_public': row['is_public'],
                    'author': 'user'
                })
            
            return notes
        except:
            return []
    
    def add_comment(self, note_id: str, user_id: str, comment: str) -> str:
        comment_id = str(uuid.uuid4())
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO research_comments (comment_id, note_id, user_id, comment, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (comment_id, note_id, user_id, comment, datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        return comment_id
    
    def get_comments(self, note_id: str) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT c.comment_id, c.comment, c.created_at, 'user' as username
            FROM research_comments c
            WHERE c.note_id = ?
            ORDER BY c.created_at ASC
        ''', (note_id,))
        
        comments = []
        for row in cursor.fetchall():
            comments.append({
                'comment_id': row[0],
                'comment': row[1],
                'created_at': row[2],
                'author': row[3]
            })
        
        conn.close()
        return comments
    
    def create_workspace(self, workspace_name: str, description: str, created_by: str) -> str:
        workspace_id = str(uuid.uuid4())
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO team_workspaces (workspace_id, workspace_name, description, created_by, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (workspace_id, workspace_name, description, created_by, datetime.now().isoformat()))
        
        # Add creator as admin
        cursor.execute('''
            INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
            VALUES (?, ?, ?, ?)
        ''', (workspace_id, created_by, "admin", datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        return workspace_id
    
    def add_workspace_member(self, workspace_id: str, user_id: str, role: str = "member"):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, role, joined_at)
            VALUES (?, ?, ?, ?)
        ''', (workspace_id, user_id, role, datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
    
    def get_user_workspaces(self, user_id: str) -> List[Dict]:
        if not self.supabase:
            return []
        
        # Database implementation would go here
        return []