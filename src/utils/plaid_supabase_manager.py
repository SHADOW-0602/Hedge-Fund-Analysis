#!/usr/bin/env python3
"""Supabase Plaid Token Manager"""

import os
from datetime import datetime
from typing import Optional, Dict, List
from cryptography.fernet import Fernet
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from clients.supabase_client import supabase_client
except ImportError:
    supabase_client = None
    
try:
    from utils.logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

class PlaidSupabaseManager:
    def __init__(self):
        # Use same encryption key as user_secrets for consistency
        key_file = os.path.join("user_secrets", "encryption.key")
        os.makedirs("user_secrets", exist_ok=True)
        
        try:
            # Priority 1: Environment variable (for production/Northflank)
            env_key = os.getenv('ENCRYPTION_KEY')
            if env_key:
                # Handle both raw string and bytes
                self.key = env_key.encode() if isinstance(env_key, str) else env_key
                logger.info("Using encryption key from environment variable")
            
            # Priority 2: File-based key (for local development)
            elif os.path.exists(key_file):
                with open(key_file, 'rb') as f:
                    self.key = f.read()
                logger.info("Using encryption key from file")
            
            # Priority 3: Generate new key (first run local)
            else:
                self.key = Fernet.generate_key()
                try:
                    with open(key_file, 'wb') as f:
                        f.write(self.key)
                    logger.info("Generated and saved new encryption key")
                except (IOError, OSError) as e:
                    logger.error(f"Failed to write encryption key file: {e}")
                    # In production without env var, this is critical but we proceed with ephemeral key
                    logger.warning("Using ephemeral encryption key - data will be unreadable after restart!")
                    
        except Exception as e:
            logger.error(f"Failed to initialize encryption key: {e}")
            raise
        
        try:
            self.cipher = Fernet(self.key)
        except Exception as e:
            logger.error(f"Failed to initialize Fernet cipher: {e}")
            raise
    
    def _encrypt_token(self, token: str) -> str:
        """Encrypt access token"""
        try:
            return self.cipher.encrypt(token.encode()).decode()
        except Exception as e:
            logger.error(f"Failed to encrypt token: {e}")
            raise
    
    def _decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt access token"""
        try:
            return self.cipher.decrypt(encrypted_token.encode()).decode()
        except Exception as e:
            logger.error(f"Failed to decrypt token: {e}")
            raise
    
    def store_plaid_token(self, user_id: str, access_token: str, institution_name: str = None) -> str:
        """Store Plaid token in Supabase"""
        try:
            if not supabase_client or not supabase_client.service_client:
                logger.error("Supabase client not available for token storage")
                return None
            
            connection_id = f"conn_{int(datetime.now().timestamp())}"
            encrypted_token = self._encrypt_token(access_token)
            
            # Use service role client to bypass RLS for admin operations
            result = supabase_client.service_client.table('plaid_connections').insert({
                'user_id': user_id,
                'connection_id': connection_id,
                'encrypted_access_token': encrypted_token,
                'institution_name': institution_name or 'Unknown Institution'
            }).execute()
            
            logger.info(f"Stored Plaid connection {connection_id} for user {user_id}")
            return connection_id
            
        except Exception as e:
            logger.error(f"Failed to store Plaid token for user {user_id}: {str(e)} (Type: {type(e).__name__})")
            return None
    
    def get_plaid_token(self, user_id: str, connection_id: str = None) -> Optional[str]:
        """Get Plaid token, optionally for specific connection"""
        try:
            # DEBUG LOGGING (Temporary)
            try:
                debug_log_path = os.path.join(os.getcwd(), 'debug_api.log')
                with open(debug_log_path, "a") as f:
                    f.write(f"\n[{datetime.now()}] get_plaid_token called\n")
                    f.write(f"  User ID: {user_id}\n")
                    f.write(f"  Connection ID: {repr(connection_id)}\n")
            except: pass

            if not supabase_client or not supabase_client.service_client:
                logger.error("Supabase client not available for token retrieval")
                return None
            
            query = supabase_client.service_client.table('plaid_connections')\
                .select('encrypted_access_token')\
                .eq('user_id', user_id)\
                .eq('is_active', True)
            
            if connection_id:
                query = query.eq('connection_id', connection_id)
            
            result = query.limit(1).execute() # order by removed? No, it was order('created_at', desc=True)

            # Re-add ordering
            result = query.order('created_at', desc=True).limit(1).execute()
            
            # DEBUG LOGGING result
            try:
                with open("c:/Apps/Contributions/Hedge-Fund-Analysis/debug_api.log", "a") as f:
                    count = len(result.data) if result.data else 0
                    f.write(f"  Query Result Count: {count}\n")
            except: pass

            logger.info(f"Token query result for user {user_id} (conn={connection_id}): {len(result.data) if result.data else 0} tokens found")
            
            if result.data:
                encrypted_token = result.data[0]['encrypted_access_token']
                return self._decrypt_token(encrypted_token)
            
            return None
            
        except Exception as e:
            # Log exact error to file
            try:
                with open("c:/Apps/Contributions/Hedge-Fund-Analysis/debug_api.log", "a") as f:
                     f.write(f"  [EXCEPTION] {str(e)}\n")
            except: pass

            logger.error(f"Failed to get Plaid token for user {user_id}: {str(e)} (Type: {type(e).__name__})")
            return None
    
    def get_plaid_connections(self, user_id: str) -> List[Dict]:
        """Get all Plaid connections for user"""
        try:
            if not supabase_client or not supabase_client.service_client:
                logger.error("Supabase client not available")
                return []
            
            result = supabase_client.service_client.table('plaid_connections')\
                .select('*')\
                .eq('user_id', user_id)\
                .eq('is_active', True)\
                .order('created_at', desc=True)\
                .execute()
            
            logger.info(f"Supabase query result for user {user_id}: {len(result.data) if result.data else 0} connections")
            
            connections = []
            for conn in result.data:
                try:
                    decrypted_token = self._decrypt_token(conn['encrypted_access_token'])
                    connections.append({
                        'connection_id': conn['connection_id'],
                        'institution_name': conn['institution_name'],
                        'created_at': conn['created_at'],
                        'access_token': decrypted_token
                    })
                except Exception as e:
                    logger.error(f"Failed to decrypt token for connection {conn['connection_id']}: {e}")
                    continue
            
            return connections
            
        except Exception as e:
            logger.error(f"Failed to get Plaid connections for user {user_id}: {str(e)} (Type: {type(e).__name__})")
            return []
    
    def update_connection_name(self, user_id: str, connection_id: str, new_name: str):
        """Update connection institution name"""
        try:
            if not supabase_client or not supabase_client.service_client:
                logger.error("Supabase client not available for connection update")
                return False
            
            result = supabase_client.service_client.table('plaid_connections')\
                .update({'institution_name': new_name})\
                .eq('user_id', user_id)\
                .eq('connection_id', connection_id)\
                .execute()
            
            logger.info(f"Updated connection {connection_id} name to {new_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update connection name for {connection_id}: {str(e)} (Type: {type(e).__name__})")
            return False
    
    def delete_plaid_connection(self, user_id: str, connection_id: str = None):
        """Delete Plaid connection(s)"""
        try:
            if not supabase_client or not supabase_client.service_client:
                logger.error("Supabase client not available for connection deletion")
                return False
            
            # FIX: Require connection_id to prevent accidental deletion of all connections
            if connection_id is None:
                logger.error("connection_id is required for deletion")
                return False
            
            result = supabase_client.service_client.table('plaid_connections')\
                .delete()\
                .eq('user_id', user_id)\
                .eq('connection_id', connection_id)\
                .execute()
            
            logger.info(f"Deleted Plaid connection {connection_id} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete Plaid connection for user {user_id}: {str(e)} (Type: {type(e).__name__})")
            return False

# Global instance
plaid_supabase_manager = PlaidSupabaseManager()