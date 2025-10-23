import streamlit as st
import pandas as pd
from typing import Optional, List, Dict
from clients.snaptrade_client import snaptrade_client
from utils.logger import logger
from utils.user_secrets import user_secret_manager
from datetime import datetime, timedelta
from components.connected_accounts_manager import connected_accounts_manager

class SnapTradeConnectEnhanced:
    """Enhanced SnapTrade brokerage connection component with account management"""
    
    def __init__(self):
        self.client = snaptrade_client
    
    def render_brokerage_selection_and_connect(self, user_id: str) -> bool:
        """Simple SnapTrade connection without brokerage selection"""
        if not self.client:
            st.error("SnapTrade not configured")
            st.info("Add SNAPTRADE_CLIENT_ID and SNAPTRADE_SECRET to .env file")
            return False
        
        # Check if client has proper configuration
        if not self.client.client_id or not self.client.secret:
            st.error("SnapTrade credentials incomplete")
            st.info("Ensure both SNAPTRADE_CLIENT_ID and SNAPTRADE_SECRET are set in .env file")
            return False
        
        # Validate existing connection by checking accounts
        if st.session_state.get('snaptrade_connected'):
            # Verify connection is still valid
            accounts = self.client.get_accounts(user_id)
            if accounts:
                st.session_state.snaptrade_accounts = accounts
                st.success(f"✅ SnapTrade Connected! Found {len(accounts)} account(s)")
                for account in accounts:
                    st.info(f"**{account.get('name', 'Account')}** - {account.get('type', 'Unknown Type')}")
                
                col1, col2 = st.columns(2)
                with col1:
                    if st.button("🔄 Connect Another Account", type="secondary"):
                        st.session_state.snaptrade_connected = False
                        st.rerun()
                with col2:
                    if st.button("📋 View Account Details", type="secondary"):
                        st.info("Account details and holdings will be displayed below")
                return True
            else:
                # Connection is invalid, reset state
                st.session_state.snaptrade_connected = False
                if 'snaptrade_accounts' in st.session_state:
                    del st.session_state.snaptrade_accounts
                st.warning("⚠️ Previous connection is no longer valid. Please reconnect.")
        
        st.subheader("🏦 Connect Your Brokerage")
        st.info("Connect your brokerage account through SnapTrade's secure portal")
        
        # Connection management info
        connections = user_secret_manager.list_all_snaptrade_users()
        if connections:
            st.info(f"ℹ️ Found {len(connections)} existing connection(s) in local storage")
        
        # Single connect button
        if st.button("🔗 Connect with SnapTrade", type="primary"):
            return self._connect_to_snaptrade(user_id)
        
        # Show connection management if there are existing connections
        if connections:
            with st.expander("🔧 Manage Existing Connections"):
                self._show_connection_management()
        
        return False
    
    def _connect_to_snaptrade(self, user_id: str) -> bool:
        """Connect to SnapTrade portal with connection limit handling"""
        try:
            with st.spinner("Setting up SnapTrade connection..."):
                # Check for connection limit first
                create_status = self.client.create_user(user_id)
                
                if create_status == 'limit_reached':
                    st.error("🚫 **Connection Limit Reached**")
                    st.warning("SnapTrade has reached the maximum number of connections allowed.")
                    
                    # Show connection management options
                    self._show_connection_management()
                    return False
                
                elif create_status == 'error':
                    st.error("❌ Failed to create SnapTrade user")
                    return False
                
                # Get redirect URI
                redirect_uri = self.client.get_redirect_uri(user_id)
                
                if redirect_uri == "CONNECTION_LIMIT_REACHED":
                    st.error("🚫 **Connection Limit Reached**")
                    st.warning("SnapTrade has reached the maximum number of connections allowed.")
                    self._show_connection_management()
                    return False
                
                elif redirect_uri:
                    st.success("✅ Connection link generated successfully!")
                    
                    st.markdown(f"""
                    <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #333; margin-bottom: 15px;">Ready to Connect</h3>
                        <a href="{redirect_uri}" target="_blank" 
                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; padding: 15px 30px; text-decoration: none; 
                                  border-radius: 8px; font-weight: bold; display: inline-block;
                                  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                            🔗 Open SnapTrade Portal
                        </a>
                        <p style="color: #666; margin-top: 15px; font-size: 14px;">
                            This will open the official SnapTrade portal where you can select and connect your brokerage
                        </p>
                    </div>
                    """, unsafe_allow_html=True)
                    
                    st.info("📋 **Next Steps:**\\n1. Click the button above to open SnapTrade\\n2. Select your brokerage from the list\\n3. Follow the connection process\\n4. Return here and click 'Check Connection' when done")
                    
                    if st.button("✅ Check Connection Status", key="check_connection", type="primary"):
                        self._check_connection_status(user_id)
                    
                    return True
                else:
                    st.error("❌ Failed to generate connection link")
                    return False
        
        except Exception as e:
            error_msg = str(e)
            if "Connection Limit Reached" in error_msg or "maximum number of connections" in error_msg:
                st.error("🚫 **Connection Limit Reached**")
                st.warning("SnapTrade has reached the maximum number of connections allowed.")
                self._show_connection_management()
            else:
                st.error(f"❌ SnapTrade connection error: {error_msg}")
            return False
    
    def _check_connection_status(self, user_id: str):
        """Check SnapTrade connection status"""
        with st.spinner("Checking connection..."):
            try:
                accounts = self.client.get_accounts(user_id)
                
                if accounts:
                    st.session_state.snaptrade_connected = True
                    st.session_state.snaptrade_accounts = accounts
                    st.success(f"🎉 Successfully connected! Found {len(accounts)} account(s)")
                    for account in accounts:
                        st.info(f"**{account.get('name', 'Account')}** - {account.get('type', 'Unknown Type')}")
                    st.rerun()
                else:
                    # Check if credentials were cleared due to invalid auth
                    user_secret = user_secret_manager.get_snaptrade_secret(user_id)
                    if not user_secret:
                        st.error("❌ Invalid connection credentials detected and cleared.")
                        st.info("🔄 Please try connecting again with a fresh connection.")
                        if st.button("🔗 Start New Connection", type="primary"):
                            st.rerun()
                    else:
                        st.warning("⏳ Connection not detected yet. Please complete the process in the SnapTrade window and try again.")
            except Exception as e:
                st.error(f"Error checking connection: {str(e)}")
                st.info("This is normal if you haven't completed the connection process yet.")
    
    def _show_connection_management(self):
        """Show connection management interface"""
        st.subheader("🔧 Connection Management")
        st.info("To connect a new account, you need to disconnect an existing connection first.")
        
        # Get all SnapTrade connections
        connections = user_secret_manager.list_all_snaptrade_users()
        
        if not connections:
            st.warning("No existing connections found in local storage.")
            st.info("The connection limit might be from previous sessions. Try again in a few minutes.")
            return
        
        st.write(f"**Found {len(connections)} existing connection(s):**")
        
        for i, conn in enumerate(connections):
            with st.expander(f"Connection {i+1}: {conn['snaptrade_user_id']}"):
                col1, col2 = st.columns([2, 1])
                
                with col1:
                    st.write(f"**App User ID:** {conn['app_user_id']}")
                    st.write(f"**SnapTrade User ID:** {conn['snaptrade_user_id']}")
                    st.write(f"**Created:** {conn['created_at']}")
                
                with col2:
                    if st.button(f"🗑️ Disconnect", key=f"disconnect_{i}", type="secondary"):
                        if self._disconnect_user(conn['app_user_id'], conn['snaptrade_user_id']):
                            st.success(f"✅ Disconnected {conn['snaptrade_user_id']}")
                            st.info("You can now try connecting again.")
                            st.rerun()
                        else:
                            st.error("❌ Failed to disconnect user")
        
        if st.button("🔄 Clear All Local Connections", type="secondary"):
            self._clear_all_connections()
            st.success("✅ Cleared all local connection data")
            st.info("You can now try connecting again.")
            st.rerun()
    
    def _disconnect_user(self, app_user_id: str, snaptrade_user_id: str) -> bool:
        """Disconnect a SnapTrade user"""
        try:
            # Try to delete from SnapTrade
            success = self.client.delete_user(app_user_id)
            
            # Always clear local storage regardless of API success
            user_secret_manager.delete_snaptrade_secret(app_user_id)
            user_secret_manager.delete_snaptrade_user_id(app_user_id)
            
            # Clear session state if this is the current user
            if 'snaptrade_connected' in st.session_state:
                st.session_state.snaptrade_connected = False
            if 'snaptrade_accounts' in st.session_state:
                del st.session_state.snaptrade_accounts
            
            logger.info(f"Disconnected SnapTrade user: {snaptrade_user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting user: {e}")
            # Still clear local storage
            user_secret_manager.delete_snaptrade_secret(app_user_id)
            user_secret_manager.delete_snaptrade_user_id(app_user_id)
            return True
    
    def _clear_all_connections(self):
        """Clear all local SnapTrade connections"""
        connections = user_secret_manager.list_all_snaptrade_users()
        for conn in connections:
            user_secret_manager.delete_snaptrade_secret(conn['app_user_id'])
            user_secret_manager.delete_snaptrade_user_id(conn['app_user_id'])
        
        # Clear session state
        if 'snaptrade_connected' in st.session_state:
            del st.session_state.snaptrade_connected
        if 'snaptrade_accounts' in st.session_state:
            del st.session_state.snaptrade_accounts
        if 'snaptrade_user_id' in st.session_state:
            del st.session_state.snaptrade_user_id
        if 'snaptrade_user_secret' in st.session_state:
            del st.session_state.snaptrade_user_secret
    
    def render_demo_mode(self):
        """Render demo mode for testing without real connections"""
        st.info("🧪 **Demo Mode**: Simulating SnapTrade connection for testing")
        
        if st.button("🎭 Simulate SnapTrade Connection"):
            # Simulate successful connection with realistic demo data
            demo_accounts = [
                {"id": "demo_001", "name": "Demo Brokerage Account", "balance": 75000.00, "type": "Investment", "brokerage": "Demo Broker"},
                {"id": "demo_002", "name": "Demo IRA Account", "balance": 150000.00, "type": "Retirement", "brokerage": "Demo Broker"}
            ]
            
            st.session_state.snaptrade_accounts = demo_accounts
            st.success("✅ Demo SnapTrade connection successful!")
            
            # Show demo holdings with more realistic data
            demo_holdings = {
                "symbol": ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "AMZN"],
                "quantity": [100, 75, 25, 50, 30, 20],
                "avg_cost": [175.50, 285.75, 2650.00, 245.30, 450.25, 3200.00],
                "market_value": [17550.00, 21431.25, 66250.00, 12265.00, 13507.50, 64000.00]
            }
            
            import pandas as pd
            st.session_state.demo_holdings = pd.DataFrame(demo_holdings)
            
            # Display demo portfolio summary
            total_value = sum(demo_holdings["market_value"])
            st.metric("Demo Portfolio Value", f"${total_value:,.2f}")
            st.dataframe(st.session_state.demo_holdings)
    
    def render_account_summary(self, user_id: str):
        """Render connected accounts summary with comprehensive management"""
        # Show current session accounts if connected
        if st.session_state.get('snaptrade_connected'):
            accounts = st.session_state.get('snaptrade_accounts', [])
            
            if accounts:
                st.subheader("📊 Current Session Accounts")
                for account in accounts:
                    with st.expander(f"🏦 {account.get('name', 'Unknown Account')}"):
                        col1, col2 = st.columns(2)
                        with col1:
                            st.metric("Balance", f"${account.get('balance', 0):,.2f}")
                        with col2:
                            st.metric("Account Type", account.get('type', 'Unknown'))
                        
                        st.info("Holdings data available after successful connection")
        
        elif 'demo_holdings' in st.session_state:
            accounts = st.session_state.get('snaptrade_accounts', [])
            if accounts:
                st.subheader("🧪 Demo Accounts")
                for account in accounts:
                    with st.expander(f"🏦 {account.get('name', 'Demo Account')}"):
                        col1, col2 = st.columns(2)
                        with col1:
                            st.metric("Balance", f"${account.get('balance', 0):,.2f}")
                        with col2:
                            st.metric("Account Type", account.get('type', 'Demo'))
        
        # Always show the comprehensive connected accounts manager
        st.divider()
        connected_accounts_manager.render_connected_accounts(user_id)
        
        # Show quick actions
        st.divider()
        connected_accounts_manager.render_quick_actions()

# Global instance
snaptrade_connect_enhanced = SnapTradeConnectEnhanced()