#!/usr/bin/env python3
"""Enhanced User Secrets Manager with Plaid Support"""

import os
import json
from datetime import datetime
from typing import Optional, Dict, List
from cryptography.fernet import Fernet
from utils.logger import logger

class UserSecretManager:
    def __init__(self):
        self.secrets_dir = "user_secrets"
        os.makedirs(self.secrets_dir, exist_ok=True)
        
        # Generate or load encryption key
        key_file = os.path.join(self.secrets_dir, "encryption.key")
        
        # Priority 1: Environment variable (for production/Northflank)
        env_key = os.getenv('ENCRYPTION_KEY')
        if env_key:
            # Handle both raw string and bytes
            self.key = env_key.encode() if isinstance(env_key, str) else env_key
            logger.info("UserSecretManager: Using encryption key from environment variable")
        
        # Priority 2: File-based key (for local development)
        elif os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                self.key = f.read()
            logger.info("UserSecretManager: Using encryption key from file")
            
        # Priority 3: Generate new key (first run local)
        else:
            self.key = Fernet.generate_key()
            try:
                with open(key_file, 'wb') as f:
                    f.write(self.key)
                logger.info("UserSecretManager: Generated and saved new encryption key")
            except Exception as e:
                logger.error(f"UserSecretManager: Failed to save key file: {e}")
        
        try:
            self.cipher = Fernet(self.key)
        except Exception as e:
            logger.error(f"UserSecretManager: Failed to initialize Fernet cipher: {e}")
            raise
    
    def _encrypt_data(self, data: str) -> bytes:
        """Encrypt sensitive data"""
        return self.cipher.encrypt(data.encode())
    
    def _decrypt_data(self, encrypted_data: bytes) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(encrypted_data).decode()
    
    def _get_user_file(self, user_id: str) -> str:
        """Get user secrets file path"""
        return os.path.join(self.secrets_dir, f"{user_id}.json")
    
    def _load_user_data(self, user_id: str) -> Dict:
        """Load user data from file"""
        file_path = self._get_user_file(user_id)
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load user data: {e}")
        return {}
    
    def _save_user_data(self, user_id: str, data: Dict):
        """Save user data to file"""
        file_path = self._get_user_file(user_id)
        try:
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save user data: {e}")
    
    # SnapTrade methods
    def store_snaptrade_secret(self, user_id: str, user_secret: str):
        """Store SnapTrade user secret"""
        data = self._load_user_data(user_id)
        data['snaptrade_secret'] = self._encrypt_data(user_secret).decode('latin-1')
        data['snaptrade_created'] = datetime.now().isoformat()
        self._save_user_data(user_id, data)
        logger.info(f"Stored SnapTrade secret for user {user_id}")
    
    def get_snaptrade_secret(self, user_id: str) -> Optional[str]:
        """Get SnapTrade user secret"""
        data = self._load_user_data(user_id)
        encrypted_secret = data.get('snaptrade_secret')
        if encrypted_secret:
            try:
                return self._decrypt_data(encrypted_secret.encode('latin-1'))
            except Exception as e:
                logger.error(f"Failed to decrypt SnapTrade secret: {e}")
        return None
    
    def store_snaptrade_user_id(self, user_id: str, snaptrade_user_id: str):
        """Store SnapTrade user ID"""
        data = self._load_user_data(user_id)
        data['snaptrade_user_id'] = snaptrade_user_id
        self._save_user_data(user_id, data)
        logger.info(f"Stored SnapTrade user ID for user {user_id}")
    
    def get_snaptrade_user_id(self, user_id: str) -> Optional[str]:
        """Get SnapTrade user ID"""
        data = self._load_user_data(user_id)
        return data.get('snaptrade_user_id')
    
    def delete_snaptrade_secret(self, user_id: str):
        """Delete SnapTrade secret"""
        data = self._load_user_data(user_id)
        if 'snaptrade_secret' in data:
            del data['snaptrade_secret']
            self._save_user_data(user_id, data)
            logger.info(f"Deleted SnapTrade secret for user {user_id}")
    
    def delete_snaptrade_user_id(self, user_id: str):
        """Delete SnapTrade user ID"""
        data = self._load_user_data(user_id)
        if 'snaptrade_user_id' in data:
            del data['snaptrade_user_id']
            self._save_user_data(user_id, data)
            logger.info(f"Deleted SnapTrade user ID for user {user_id}")
    
    # Plaid methods
    def store_plaid_token(self, user_id: str, access_token: str, institution_name: str = None) -> str:
        """Store Plaid access token - supports multiple connections per user"""
        data = self._load_user_data(user_id)
        
        # Initialize plaid_connections if not exists
        if 'plaid_connections' not in data:
            data['plaid_connections'] = {}
        
        # Generate connection ID
        connection_id = f"conn_{len(data['plaid_connections']) + 1}_{int(datetime.now().timestamp())}"
        
        # Store connection
        data['plaid_connections'][connection_id] = {
            'access_token': self._encrypt_data(access_token).decode('latin-1'),
            'institution_name': institution_name or 'Unknown Institution',
            'created_at': datetime.now().isoformat(),
            'is_active': True
        }
        
        self._save_user_data(user_id, data)
        logger.info(f"Stored Plaid connection {connection_id} for user {user_id}")
        return connection_id
    
    def get_plaid_connections(self, user_id: str) -> Dict[str, Dict]:
        """Get all Plaid connections for user"""
        data = self._load_user_data(user_id)
        connections = data.get('plaid_connections', {})
        
        # Decrypt tokens
        decrypted_connections = {}
        for conn_id, conn_data in connections.items():
            if conn_data.get('is_active', True):
                try:
                    decrypted_data = conn_data.copy()
                    decrypted_data['access_token'] = self._decrypt_data(conn_data['access_token'].encode('latin-1'))
                    decrypted_connections[conn_id] = decrypted_data
                except Exception as e:
                    logger.error(f"Failed to decrypt connection {conn_id}: {e}")
        
        return decrypted_connections
    
    def get_plaid_token(self, user_id: str, connection_id: str = None) -> Optional[str]:
        """Get Plaid access token - returns first active if no connection_id specified"""
        connections = self.get_plaid_connections(user_id)
        
        if connection_id and connection_id in connections:
            return connections[connection_id]['access_token']
        
        # Return first active connection if no specific ID
        for conn_data in connections.values():
            if conn_data.get('is_active', True):
                return conn_data['access_token']
        
        return None
    
    def delete_plaid_connection(self, user_id: str, connection_id: str = None):
        """Delete specific Plaid connection or all if no ID specified"""
        data = self._load_user_data(user_id)
        
        if connection_id:
            # Delete specific connection
            if 'plaid_connections' in data and connection_id in data['plaid_connections']:
                del data['plaid_connections'][connection_id]
                logger.info(f"Deleted Plaid connection {connection_id} for user {user_id}")
        else:
            # Delete all connections (legacy support)
            if 'plaid_connections' in data:
                data['plaid_connections'] = {}
            if 'plaid_token' in data:  # Legacy cleanup
                del data['plaid_token']
            logger.info(f"Deleted all Plaid connections for user {user_id}")
        
        self._save_user_data(user_id, data)
    
    def delete_plaid_token(self, user_id: str):
        """Legacy method - delete all connections"""
        self.delete_plaid_connection(user_id)
    
    # Utility methods
    def list_all_snaptrade_users(self) -> List[Dict]:
        """List all SnapTrade users"""
        users = []
        for filename in os.listdir(self.secrets_dir):
            if filename.endswith('.json'):
                user_id = filename[:-5]  # Remove .json
                data = self._load_user_data(user_id)
                if 'snaptrade_user_id' in data:
                    users.append({
                        'app_user_id': user_id,
                        'snaptrade_user_id': data['snaptrade_user_id'],
                        'created_at': data.get('snaptrade_created', 'Unknown')
                    })
        return users
    
    def get_connection_summary(self, user_id: str) -> Dict:
        """Get summary of all connections for a user"""
        data = self._load_user_data(user_id)
        return {
            'snaptrade_connected': 'snaptrade_secret' in data,
            'plaid_connected': 'plaid_token' in data,
            'snaptrade_user_id': data.get('snaptrade_user_id'),
            'plaid_created': data.get('plaid_created'),
            'connections_count': sum([
                'snaptrade_secret' in data,
                'plaid_token' in data
            ])
        }
    
    def list_all_plaid_users(self) -> List[Dict]:
        """List all users with Plaid connections"""
        users = []
        for filename in os.listdir(self.secrets_dir):
            if filename.endswith('.json') and filename != 'encryption.key':
                user_id = filename[:-5]  # Remove .json
                data = self._load_user_data(user_id)
                if 'plaid_token' in data:
                    users.append({
                        'user_id': user_id,
                        'plaid_created': data.get('plaid_created', 'Unknown'),
                        'has_token': True
                    })
        return users
    
    def _find_user_with_token(self, access_token: str) -> Optional[str]:
        """Find user who already has this token by decrypting and comparing"""
        try:
            for filename in os.listdir(self.secrets_dir):
                if filename.endswith('.json') and filename != 'encryption.key':
                    user_id = filename[:-5]
                    data = self._load_user_data(user_id)
                    stored_encrypted = data.get('plaid_token')
                    if stored_encrypted:
                        try:
                            stored_token = self._decrypt_data(stored_encrypted.encode('latin-1'))
                            if stored_token == access_token:
                                return user_id
                        except Exception:
                            continue  # Skip corrupted tokens
        except Exception as e:
            logger.error(f"Error finding user with token: {e}")
        return None
    
    def cleanup_duplicate_tokens(self) -> Dict:
        """Clean up duplicate Plaid tokens across users"""
        token_map = {}
        duplicates = []
        
        # Find all tokens and their users
        for filename in os.listdir(self.secrets_dir):
            if filename.endswith('.json') and filename != 'encryption.key':
                user_id = filename[:-5]
                data = self._load_user_data(user_id)
                if 'plaid_token' in data:
                    token = data['plaid_token']
                    if token in token_map:
                        duplicates.append({
                            'token': token[:20] + '...',
                            'users': [token_map[token], user_id]
                        })
                    else:
                        token_map[token] = user_id
        
        return {
            'total_tokens': len(token_map),
            'duplicate_groups': len(duplicates),
            'duplicates': duplicates
        }

# Global instance
user_secret_manager = UserSecretManager()

def get_plaid_connection_debug_info() -> Dict:
    """Get debug information about Plaid connections"""
    return {
        'all_plaid_users': user_secret_manager.list_all_plaid_users(),
        'duplicate_analysis': user_secret_manager.cleanup_duplicate_tokens()
    }