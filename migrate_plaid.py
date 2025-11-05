#!/usr/bin/env python3
"""Migrate Plaid connection from username to UUID"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from utils.user_secrets import user_secret_manager
from clients.supabase_client import supabase_client

def migrate_plaid_connection():
    # Get admin user UUID from database
    if not supabase_client or not supabase_client.client:
        print("Database not available")
        return
    
    result = supabase_client.client.table('app_users').select('user_id, username').eq('username', 'admin').execute()
    
    if not result.data:
        print("Admin user not found in database")
        return
    
    admin_uuid = result.data[0]['user_id']
    print(f"Admin UUID: {admin_uuid}")
    
    # Get existing token for 'admin' username
    admin_token = user_secret_manager.get_plaid_token('admin')
    
    if not admin_token:
        print("No Plaid token found for admin username")
        return
    
    print("Found Plaid token for admin username")
    
    # Store token under UUID
    user_secret_manager.store_plaid_token(admin_uuid, admin_token)
    print(f"Migrated Plaid token to UUID: {admin_uuid}")
    
    # Verify migration
    uuid_token = user_secret_manager.get_plaid_token(admin_uuid)
    if uuid_token:
        print("Migration successful - token accessible via UUID")
        
        # Optionally remove old username token
        user_secret_manager.delete_plaid_token('admin')
        print("Removed old username token")
    else:
        print("Migration failed")

if __name__ == "__main__":
    migrate_plaid_connection()