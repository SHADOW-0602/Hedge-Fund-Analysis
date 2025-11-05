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
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                self.key = f.read()
        else:
            self.key = Fernet.generate_key()
            with open(key_file, 'wb') as f:
                f.write(self.key)
        
        self.cipher = Fernet(self.key)
    
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
    def store_plaid_token(self, user_id: str, access_token: str):
        """Store Plaid access token with duplicate prevention"""
        # Check if token already exists for another user
        existing_user = self._find_user_with_token(access_token)
        if existing_user and existing_user != user_id:
            logger.error(f"Token already exists for user {existing_user}, cannot assign to {user_id}")
            raise ValueError(f"This Plaid connection is already linked to another user")
        
        data = self._load_user_data(user_id)
        data['plaid_token'] = self._encrypt_data(access_token).decode('latin-1')
        data['plaid_created'] = datetime.now().isoformat()
        self._save_user_data(user_id, data)
        logger.info(f"Stored Plaid token for user {user_id}")
    
    def get_plaid_token(self, user_id: str) -> Optional[str]:
        """Get Plaid access token for specific user only"""
        data = self._load_user_data(user_id)
        encrypted_token = data.get('plaid_token')
        
        if encrypted_token:
            try:
                return self._decrypt_data(encrypted_token.encode('latin-1'))
            except Exception as e:
                logger.error(f"Failed to decrypt Plaid token for user {user_id}: {e}")
        return None
    
    def delete_plaid_token(self, user_id: str):
        """Delete Plaid token"""
        data = self._load_user_data(user_id)
        if 'plaid_token' in data:
            del data['plaid_token']
            self._save_user_data(user_id, data)
            logger.info(f"Deleted Plaid token for user {user_id}")
    
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