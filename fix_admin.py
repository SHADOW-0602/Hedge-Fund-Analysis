import sys
import os
from dotenv import load_dotenv
import hashlib

load_dotenv()
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from clients.supabase_client import supabase_client

def fix_admin_password():
    if not supabase_client:
        print("Supabase not connected")
        return
    
    # Hash the password the same way as UserManager
    password_hash = hashlib.sha256("admin123".encode()).hexdigest()
    print(f"Correct hash for 'admin123': {password_hash}")
    
    # Check current admin
    result = supabase_client.client.table('app_users').select('*').eq('username', 'admin').execute()
    if result.data:
        current_hash = result.data[0]['password_hash']
        print(f"Current hash in DB: {current_hash}")
        
        if current_hash != password_hash:
            print("Updating admin password hash...")
            supabase_client.client.table('app_users').update({
                'password_hash': password_hash
            }).eq('username', 'admin').execute()
            print("Admin password fixed!")
        else:
            print("Password hash is correct")
    else:
        print("Admin user not found")

if __name__ == "__main__":
    fix_admin_password()