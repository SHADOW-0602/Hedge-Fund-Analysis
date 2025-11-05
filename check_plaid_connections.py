#!/usr/bin/env python3
"""Check Plaid Connections"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from utils.user_secrets import user_secret_manager

def check_plaid_connections():
    print("=== Plaid Connection Status ===\n")
    
    # Get all Plaid users
    plaid_users = user_secret_manager.list_all_plaid_users()
    
    print(f"Total Plaid Connections: {len(plaid_users)}")
    print("-" * 40)
    
    if plaid_users:
        for i, user in enumerate(plaid_users, 1):
            print(f"{i}. User ID: {user['user_id']}")
            print(f"   Connected: {user['plaid_created']}")
            print(f"   Has Token: {user['has_token']}")
            print()
    else:
        print("No Plaid connections found.")
    
    # Check for duplicates
    print("\n=== Duplicate Analysis ===")
    duplicate_info = user_secret_manager.cleanup_duplicate_tokens()
    print(f"Total Unique Tokens: {duplicate_info['total_tokens']}")
    print(f"Duplicate Groups: {duplicate_info['duplicate_groups']}")
    
    if duplicate_info['duplicates']:
        print("\nDuplicate Tokens Found:")
        for dup in duplicate_info['duplicates']:
            print(f"  Token: {dup['token']}")
            print(f"  Users: {', '.join(dup['users'])}")

if __name__ == "__main__":
    check_plaid_connections()