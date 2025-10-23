#!/usr/bin/env python3
"""Plaid Handler for Streamlit Integration"""

import streamlit as st
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.logger import logger
from utils.user_secrets import user_secret_manager
from clients.plaid_client import plaid_client

class PlaidStreamlitHandler:
    def __init__(self):
        self.plaid_client = plaid_client
    
    def create_link_token(self, user_id: str) -> str:
        """Create Plaid Link token"""
        if not self.plaid_client:
            return ""
        
        try:
            link_token = self.plaid_client.create_link_token(user_id)
            if link_token:
                st.session_state[f'plaid_link_token_{user_id}'] = link_token
            return link_token
        except Exception as e:
            logger.error(f"Link token creation error: {e}")
            return ""
    
    def exchange_public_token(self, user_id: str, public_token: str) -> bool:
        """Exchange public token for access token"""
        if not self.plaid_client:
            return False
        
        try:
            access_token = self.plaid_client.exchange_public_token(public_token)
            if access_token:
                success = user_secret_manager.store_plaid_token(user_id, access_token)
                if success:
                    st.session_state[f'plaid_connected_{user_id}'] = True
                    logger.info(f"Plaid token stored for user {user_id}")
                    return True
            return False
        except Exception as e:
            logger.error(f"Token exchange error: {e}")
            return False
    
    def get_connection_status(self, user_id: str) -> dict:
        """Get Plaid connection status"""
        try:
            access_token = user_secret_manager.get_plaid_token(user_id)
            if access_token and self.plaid_client:
                accounts = self.plaid_client.get_accounts(user_id)
                return {
                    'connected': True,
                    'accounts_count': len(accounts),
                    'message': 'Plaid account connected'
                }
            else:
                return {
                    'connected': False,
                    'message': 'No Plaid account connected'
                }
        except Exception as e:
            logger.error(f"Status check error: {e}")
            return {'connected': False, 'error': str(e)}
    
    def disconnect_account(self, user_id: str) -> bool:
        """Disconnect Plaid account"""
        try:
            success = user_secret_manager.delete_plaid_token(user_id)
            if success:
                if f'plaid_connected_{user_id}' in st.session_state:
                    del st.session_state[f'plaid_connected_{user_id}']
                logger.info(f"Plaid account disconnected for user {user_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Disconnect error: {e}")
            return False
    
    def render_plaid_link_ui(self, user_id: str):
        """Render Plaid Link UI in Streamlit"""
        status = self.get_connection_status(user_id)
        
        if status['connected']:
            st.success(f"✅ Plaid Connected ({status.get('accounts_count', 0)} accounts)")
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("🔄 Refresh Data"):
                    with st.spinner("Refreshing Plaid data..."):
                        try:
                            holdings_df = self.plaid_client.get_holdings(user_id)
                            if not holdings_df.empty:
                                st.session_state.plaid_portfolio = holdings_df
                                st.success(f"✅ Refreshed {len(holdings_df)} holdings")
                            else:
                                st.warning("No holdings found")
                        except Exception as e:
                            st.error(f"Refresh failed: {str(e)}")
            
            with col2:
                if st.button("🗑️ Disconnect"):
                    if self.disconnect_account(user_id):
                        st.success("Account disconnected!")
                        st.rerun()
                    else:
                        st.error("Failed to disconnect")
        else:
            st.info("🏦 Connect your brokerage account")
            
            if st.button("🔗 Generate Plaid Link", type="primary"):
                with st.spinner("Creating connection link..."):
                    # Clear any existing link token to force new creation
                    if f'plaid_link_token_{user_id}' in st.session_state:
                        del st.session_state[f'plaid_link_token_{user_id}']
                    
                    link_token = self.create_link_token(user_id)
                    if link_token:
                        plaid_link_url = f"https://cdn.plaid.com/link/v2/stable/link.html?isWebview=true&token={link_token}"
                        st.markdown(f'**[🔗 Connect Your Account]({plaid_link_url})**')
                        st.success("Link generated successfully!")
                        st.session_state[f'show_token_input_{user_id}'] = True
                    else:
                        st.error("Failed to generate link")
            
            # Show token input only after link is generated
            if st.session_state.get(f'show_token_input_{user_id}', False):
                st.write("**After connecting, paste the public token:**")
                public_token = st.text_input("Public Token", key=f"public_token_{user_id}")
                
                if st.button("💾 Save Connection") and public_token:
                    with st.spinner("Connecting account..."):
                        if self.exchange_public_token(user_id, public_token):
                            st.success("✅ Account connected successfully!")
                            # Clear the token input flag
                            if f'show_token_input_{user_id}' in st.session_state:
                                del st.session_state[f'show_token_input_{user_id}']
                            st.rerun()
                        else:
                            st.error("❌ Failed to connect account")

# Global instance
plaid_handler = PlaidStreamlitHandler()