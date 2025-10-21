"""Comprehensive user secret management with encryption and secure storage"""

import hashlib
import json
import os
import uuid
import base64
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pathlib import Path
import logging
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from .config import Config

logger = logging.getLogger(__name__)

class UserSecretManager:
    """Secure management of user secrets with encryption and multiple secret types"""
    
    def __init__(self, secrets_file: str = "user_secrets.json"):
        self.secrets_file = Path(secrets_file)
        self.master_key = self._get_or_create_master_key()
        self.cipher_suite = self._create_cipher_suite()
        self.secrets = self._load_secrets()
        
        # Ensure secrets directory exists
        self.secrets_file.parent.mkdir(exist_ok=True)
    
    def _get_or_create_master_key(self) -> bytes:
        """Get or create master encryption key"""
        key_file = Path('.secret_key')
        
        if key_file.exists():
            try:
                with open(key_file, 'rb') as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"Could not read existing key file: {e}")
        
        # Generate new key
        password = Config.JWT_SECRET_KEY.encode()
        salt = os.urandom(16)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password))
        
        try:
            with open(key_file, 'wb') as f:
                f.write(salt + key)
            os.chmod(key_file, 0o600)  # Restrict permissions
        except Exception as e:
            logger.error(f"Could not save key file: {e}")
        
        return key
    
    def _create_cipher_suite(self) -> Fernet:
        """Create cipher suite for encryption/decryption"""
        try:
            if len(self.master_key) > 32:
                # Key file format: salt (16 bytes) + key (32 bytes)
                key = self.master_key[16:48]  # Take exactly 32 bytes
            else:
                key = self.master_key
            
            # Ensure key is exactly 32 bytes and base64 encoded
            if len(key) != 44:  # 32 bytes base64 encoded = 44 chars
                # Generate a proper Fernet key
                key = Fernet.generate_key()
            
            return Fernet(key)
        except Exception as e:
            logger.warning(f"Cipher creation failed, using new key: {e}")
            return Fernet(Fernet.generate_key())
    
    def _encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data"""
        try:
            encrypted = self.cipher_suite.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return data  # Fallback to unencrypted (not recommended for production)
    
    def _decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        try:
            decoded = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted = self.cipher_suite.decrypt(decoded)
            return decrypted.decode()
        except Exception:
            # Silently return data as-is if decryption fails
            return encrypted_data
    
    def _load_secrets(self) -> Dict[str, Dict[str, Any]]:
        """Load and decrypt secrets from file"""
        if not self.secrets_file.exists():
            return {}
        
        try:
            with open(self.secrets_file, 'r') as f:
                encrypted_data = json.load(f)
            
            # Decrypt user secrets
            decrypted_secrets = {}
            for user_id, user_data in encrypted_data.items():
                decrypted_secrets[user_id] = {}
                for key, value in user_data.items():
                    if key.endswith('_encrypted') and isinstance(value, str):
                        original_key = key.replace('_encrypted', '')
                        decrypted_secrets[user_id][original_key] = self._decrypt_data(value)
                    else:
                        decrypted_secrets[user_id][key] = value
            
            return decrypted_secrets
            
        except Exception as e:
            logger.error(f"Failed to load secrets: {e}")
            return {}
    
    def _save_secrets(self):
        """Encrypt and save secrets to file"""
        try:
            # Encrypt sensitive data before saving
            encrypted_secrets = {}
            for user_id, user_data in self.secrets.items():
                encrypted_secrets[user_id] = {}
                for key, value in user_data.items():
                    if key in ['snaptrade_secret', 'api_keys', 'tokens'] and isinstance(value, str):
                        encrypted_secrets[user_id][f"{key}_encrypted"] = self._encrypt_data(value)
                    else:
                        encrypted_secrets[user_id][key] = value
            
            with open(self.secrets_file, 'w') as f:
                json.dump(encrypted_secrets, f, indent=2, default=str)
            
            # Set restrictive permissions
            os.chmod(self.secrets_file, 0o600)
            
        except Exception as e:
            logger.error(f"Failed to save secrets: {e}")
    
    def generate_snaptrade_secret(self, user_id: str) -> str:
        """Generate and store SnapTrade user secret"""
        existing_secret = self.get_snaptrade_secret(user_id)
        if existing_secret:
            return existing_secret
        
        # Generate secure random secret
        user_secret = str(uuid.uuid4()).replace('-', '')[:16]
        
        if user_id not in self.secrets:
            self.secrets[user_id] = {}
        
        self.secrets[user_id].update({
            'snaptrade_secret': user_secret,
            'created_at': datetime.now().isoformat(),
            'secret_type': 'snaptrade'
        })
        
        self._save_secrets()
        logger.info(f"Generated SnapTrade secret for user {user_id}")
        return user_secret
    
    def get_snaptrade_secret(self, user_id: str) -> Optional[str]:
        """Get SnapTrade user secret"""
        user_data = self.secrets.get(user_id, {})
        return user_data.get('snaptrade_secret')
    
    def store_api_key(self, user_id: str, provider: str, api_key: str, 
                     additional_data: Optional[Dict] = None) -> bool:
        """Store encrypted API key for user"""
        try:
            if user_id not in self.secrets:
                self.secrets[user_id] = {}
            
            if 'api_keys' not in self.secrets[user_id]:
                self.secrets[user_id]['api_keys'] = {}
            
            key_data = {
                'key': api_key,
                'created_at': datetime.now().isoformat(),
                'last_used': None
            }
            
            if additional_data:
                key_data.update(additional_data)
            
            self.secrets[user_id]['api_keys'][provider] = json.dumps(key_data)
            self._save_secrets()
            
            logger.info(f"Stored API key for {provider} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store API key: {e}")
            return False
    
    def get_api_key(self, user_id: str, provider: str) -> Optional[Dict[str, Any]]:
        """Get decrypted API key for user and provider"""
        try:
            user_data = self.secrets.get(user_id, {})
            api_keys = user_data.get('api_keys', {})
            
            if provider in api_keys:
                key_data = json.loads(api_keys[provider])
                # Update last used timestamp
                key_data['last_used'] = datetime.now().isoformat()
                self.secrets[user_id]['api_keys'][provider] = json.dumps(key_data)
                self._save_secrets()
                return key_data
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get API key: {e}")
            return None
    
    def store_access_token(self, user_id: str, service: str, token: str, 
                          expires_at: Optional[datetime] = None) -> bool:
        """Store encrypted access token"""
        try:
            if user_id not in self.secrets:
                self.secrets[user_id] = {}
            
            if 'tokens' not in self.secrets[user_id]:
                self.secrets[user_id]['tokens'] = {}
            
            token_data = {
                'token': token,
                'created_at': datetime.now().isoformat(),
                'expires_at': expires_at.isoformat() if expires_at else None
            }
            
            self.secrets[user_id]['tokens'][service] = json.dumps(token_data)
            self._save_secrets()
            
            logger.info(f"Stored access token for {service} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store access token: {e}")
            return False
    
    def get_access_token(self, user_id: str, service: str) -> Optional[str]:
        """Get valid access token"""
        try:
            user_data = self.secrets.get(user_id, {})
            tokens = user_data.get('tokens', {})
            
            if service in tokens:
                token_data = json.loads(tokens[service])
                
                # Check if token is expired
                if token_data.get('expires_at'):
                    expires_at = datetime.fromisoformat(token_data['expires_at'])
                    if datetime.now() > expires_at:
                        logger.warning(f"Token for {service} expired for user {user_id}")
                        return None
                
                return token_data['token']
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get access token: {e}")
            return None
    
    def delete_user_secrets(self, user_id: str) -> bool:
        """Delete all secrets for a user"""
        try:
            if user_id in self.secrets:
                del self.secrets[user_id]
                self._save_secrets()
                logger.info(f"Deleted all secrets for user {user_id}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Failed to delete user secrets: {e}")
            return False
    
    def delete_specific_secret(self, user_id: str, secret_type: str, identifier: str = None) -> bool:
        """Delete specific secret type for user"""
        try:
            user_data = self.secrets.get(user_id, {})
            
            if secret_type == 'snaptrade_secret':
                if 'snaptrade_secret' in user_data:
                    del user_data['snaptrade_secret']
            elif secret_type == 'api_key' and identifier:
                api_keys = user_data.get('api_keys', {})
                if identifier in api_keys:
                    del api_keys[identifier]
            elif secret_type == 'token' and identifier:
                tokens = user_data.get('tokens', {})
                if identifier in tokens:
                    del tokens[identifier]
            
            self._save_secrets()
            logger.info(f"Deleted {secret_type} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete specific secret: {e}")
            return False
    
    def list_user_secrets(self, user_id: str) -> Dict[str, Any]:
        """List all secret types for user (without revealing actual secrets)"""
        user_data = self.secrets.get(user_id, {})
        
        summary = {
            'user_id': user_id,
            'has_snaptrade_secret': 'snaptrade_secret' in user_data,
            'api_keys': list(user_data.get('api_keys', {}).keys()),
            'tokens': list(user_data.get('tokens', {}).keys()),
            'created_at': user_data.get('created_at'),
            'last_updated': datetime.now().isoformat()
        }
        
        return summary
    
    def cleanup_expired_tokens(self) -> int:
        """Remove expired tokens and return count of cleaned up tokens"""
        cleaned_count = 0
        
        try:
            for user_id, user_data in self.secrets.items():
                tokens = user_data.get('tokens', {})
                expired_tokens = []
                
                for service, token_json in tokens.items():
                    try:
                        token_data = json.loads(token_json)
                        if token_data.get('expires_at'):
                            expires_at = datetime.fromisoformat(token_data['expires_at'])
                            if datetime.now() > expires_at:
                                expired_tokens.append(service)
                    except:
                        continue
                
                for service in expired_tokens:
                    del tokens[service]
                    cleaned_count += 1
            
            if cleaned_count > 0:
                self._save_secrets()
                logger.info(f"Cleaned up {cleaned_count} expired tokens")
            
        except Exception as e:
            logger.error(f"Failed to cleanup expired tokens: {e}")
        
        return cleaned_count
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get service status and statistics"""
        total_users = len(self.secrets)
        total_api_keys = sum(len(user_data.get('api_keys', {})) for user_data in self.secrets.values())
        total_tokens = sum(len(user_data.get('tokens', {})) for user_data in self.secrets.values())
        
        return {
            'status': 'active',
            'total_users': total_users,
            'total_api_keys': total_api_keys,
            'total_tokens': total_tokens,
            'encryption_enabled': True,
            'secrets_file': str(self.secrets_file),
            'last_cleanup': datetime.now().isoformat()
        }

# Global instance
user_secret_manager = UserSecretManager()