#!/usr/bin/env python3
"""Create link token and update HTML page"""

from clients.plaid_client import plaid_client
import time

def create_link_token_for_html():
    if not plaid_client or not plaid_client.is_available():
        print("❌ Plaid client not available")
        return
    
    user_id = f"user_{int(time.time())}"
    link_token = plaid_client.create_link_token(user_id)
    
    if not link_token:
        print("❌ Failed to create link token")
        return
    
    # Read and update the simple HTML file
    with open('simple_plaid_connect.html', 'r') as f:
        html_content = f.read()
    
    # Replace the token placeholder
    updated_html = html_content.replace('link-sandbox-TOKEN_HERE', link_token)
    
    # Write updated file
    filename = f'plaid_connect_{user_id}.html'
    with open(filename, 'w') as f:
        f.write(updated_html)
    
    print(f"✅ HTML file created: {filename}")
    print(f"👤 User ID: {user_id}")
    print(f"🔗 Link Token: {link_token}")
    print(f"🌐 Open {filename} in your browser")

if __name__ == "__main__":
    create_link_token_for_html()