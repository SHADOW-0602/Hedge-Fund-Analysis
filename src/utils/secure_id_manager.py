#!/usr/bin/env python3
"""Secure ID Manager - Maps UUIDs to secure tokens"""

import os
import json
import hashlib
import secrets
from cryptography.fernet import Fernet

class SecureIDManager:
    def __init__(self):
        self.mapping_file = "user_secrets/id_mapping.json"
        self.key_file = "user_secrets/id_encryption.key"
        
        # Load or create encryption key
        if os.path.exists(self.key_file):
            with open(self.key_file, 'rb') as f:
                self.key = f.read()
        else:
            self.key = Fernet.generate_key()
            os.makedirs(os.path.dirname(self.key_file), exist_ok=True)
            with open(self.key_file, 'wb') as f:
                f.write(self.key)
        
        self.cipher = Fernet(self.key)
        self.mappings = self._load_mappings()
    
    def _load_mappings(self):
        if os.path.exists(self.mapping_file):
            try:
                with open(self.mapping_file, 'r') as f:
                    encrypted_data = json.load(f)
                    decrypted = self.cipher.decrypt(encrypted_data['data'].encode()).decode()
                    return json.loads(decrypted)
            except:
                pass
        return {}
    
    def _save_mappings(self):
        os.makedirs(os.path.dirname(self.mapping_file), exist_ok=True)
        encrypted_data = self.cipher.encrypt(json.dumps(self.mappings).encode()).decode()
        with open(self.mapping_file, 'w') as f:
            json.dump({'data': encrypted_data}, f)
    
    def get_secure_token(self, uuid: str) -> str:
        """Get secure token for UUID, create if doesn't exist"""
        if uuid not in self.mappings:
            # Generate secure token
            token = hashlib.sha256(f"{uuid}{secrets.token_hex(16)}".encode()).hexdigest()[:16]
            self.mappings[uuid] = token
            self._save_mappings()
        return self.mappings[uuid]
    
    def get_uuid_from_token(self, token: str) -> str:
        """Get UUID from secure token"""
        for uuid, stored_token in self.mappings.items():
            if stored_token == token:
                return uuid
        return None

# Global instance
secure_id_manager = SecureIDManager()