import streamlit as st
from typing import Optional
from clients.snaptrade_client import snaptrade_client
from utils.logger import logger

class SnapTradeConnect:
    """SnapTrade brokerage connection component for Streamlit"""
    
    def __init__(self):
        self.client = snaptrade_client
    
    def render_connection_modal(self, user_id: str, brokerage_id: Optional[str] = None) -> bool:
        """
        Render SnapTrade connection modal
        Returns True if connection was successful
        """
        if not self.client:
            st.error("SnapTrade not configured")
            return False
        
        # Initialize session state
        if 'snaptrade_modal_open' not in st.session_state:
            st.session_state.snaptrade_modal_open = False
        
        # Connection button
        if st.button("🔗 Connect Brokerage", key="connect_brokerage_btn"):
            # Register user first
            registered = self.client.create_user(user_id)
            if registered:
                st.success("✅ User registered with SnapTrade")
            
            # Try to generate redirect link
            redirect_link = self.client.get_redirect_uri(user_id, brokerage_id)
            
            if redirect_link:
                st.session_state.snaptrade_redirect_link = redirect_link
                st.session_state.snaptrade_modal_open = True
            else:
                # Fallback to manual connection
                st.session_state.snaptrade_redirect_link = "https://dashboard.snaptrade.com/login"
                st.session_state.snaptrade_modal_open = True
                st.warning("Using manual connection flow")
        
        # Modal dialog
        if st.session_state.snaptrade_modal_open:
            return self._render_modal(user_id)
        
        return False
    
    def _render_modal(self, user_id: str) -> bool:
        """Render the connection modal"""
        with st.container():
            st.markdown("---")
            st.subheader("🏦 Connect Your Brokerage Account")
            
            col1, col2, col3 = st.columns([1, 2, 1])
            with col2:
                st.info("Connect your brokerage account through SnapTrade")
                
                if st.session_state.snaptrade_redirect_link:
                    if "dashboard.snaptrade.com" in st.session_state.snaptrade_redirect_link:
                        # Manual connection flow
                        st.markdown(f"""
                        <div style="text-align: center; padding: 20px;">
                            <a href="{st.session_state.snaptrade_redirect_link}" target="_blank" 
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                      color: white; padding: 15px 30px; text-decoration: none; 
                                      border-radius: 8px; font-weight: bold; display: inline-block;">
                                🔗 Open SnapTrade Dashboard
                            </a>
                        </div>
                        """, unsafe_allow_html=True)
                        
                        st.markdown("""
                        **Manual Steps:**
                        1. Click the link above to open SnapTrade
                        2. Sign up or log in to your account  
                        3. Connect your brokerage account
                        4. Return here and click 'Check Connection'
                        """)
                    else:
                        # Direct connection flow
                        st.markdown(f"""
                        <div style="text-align: center; padding: 20px;">
                            <a href="{st.session_state.snaptrade_redirect_link}" target="_blank" 
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                      color: white; padding: 15px 30px; text-decoration: none; 
                                      border-radius: 8px; font-weight: bold; display: inline-block;">
                                🔗 Connect Brokerage Account
                            </a>
                        </div>
                        """, unsafe_allow_html=True)
                        
                        st.write("After connecting, click 'Check Connection' below:")
                
                st.markdown("<br>", unsafe_allow_html=True)
                
                if st.button("✅ Check Connection", key="check_connection"):
                    # Check if we're in demo mode
                    if 'demo_holdings' in st.session_state:
                        # Demo mode - use fake accounts
                        accounts = st.session_state.get('snaptrade_accounts', [])
                    else:
                        # Real mode - call API
                        accounts = self.client.get_accounts(user_id)
                    
                    if accounts:
                        st.success(f"✅ Connected! Found {len(accounts)} accounts")
                        st.session_state.snaptrade_modal_open = False
                        st.session_state.snaptrade_accounts = accounts
                        st.rerun()
                        return True
                    else:
                        st.info("💡 Connection may take a few minutes to sync")
                
                if st.button("❌ Close", key="close_modal"):
                    st.session_state.snaptrade_modal_open = False
                    st.rerun()
            
            st.markdown("---")
        
        return False
    
    def render_demo_mode(self):
        """Render demo mode for testing without real connections"""
        st.info("🧪 **Demo Mode**: Simulating SnapTrade connection")
        
        if st.button("🎭 Simulate Connection"):
            # Simulate successful connection
            demo_accounts = [
                {"id": "demo_001", "name": "Demo Trading Account", "balance": 50000.00, "type": "Investment"},
                {"id": "demo_002", "name": "Demo Retirement Account", "balance": 125000.00, "type": "Retirement"}
            ]
            
            st.session_state.snaptrade_accounts = demo_accounts
            st.success("✅ Demo connection successful!")
            
            # Show demo holdings
            demo_holdings = {
                "symbol": ["AAPL", "MSFT", "GOOGL", "TSLA"],
                "quantity": [100, 50, 25, 30],
                "avg_cost": [150.00, 250.00, 2500.00, 800.00],
                "market_value": [17500.00, 13750.00, 67500.00, 24000.00]
            }
            
            import pandas as pd
            st.session_state.demo_holdings = pd.DataFrame(demo_holdings)
            st.dataframe(st.session_state.demo_holdings)
    
    def render_brokerage_selector(self) -> Optional[str]:
        """Render brokerage selection dropdown"""
        if not self.client:
            return None
        
        brokerages = self.client.get_brokerages()
        if not brokerages:
            st.error("No brokerages available")
            return None
        
        brokerage_options = {f"{b['name']} ({b['slug']})": b['id'] for b in brokerages}
        selected_brokerage = st.selectbox(
            "Select Brokerage", 
            options=list(brokerage_options.keys()),
            help="Choose your brokerage to connect"
        )
        
        return brokerage_options.get(selected_brokerage)
    
    def render_account_summary(self, user_id: str):
        """Render connected accounts summary"""
        if not self.client:
            return
        
        # Check if we're in demo mode
        if 'demo_holdings' in st.session_state:
            accounts = st.session_state.get('snaptrade_accounts', [])
        else:
            accounts = self.client.get_accounts(user_id)
            
        if not accounts:
            st.info("No connected accounts")
            return
        
        st.subheader("📊 Connected Accounts")
        
        for account in accounts:
            with st.expander(f"🏦 {account.get('name', 'Unknown Account')}"):
                col1, col2 = st.columns(2)
                with col1:
                    st.metric("Balance", f"${account.get('balance', 0):,.2f}")
                with col2:
                    st.metric("Account Type", account.get('type', 'Unknown'))
                
                # Get holdings for this account
                if st.button(f"Load Holdings", key=f"load_{account.get('id', 'unknown')}"):
                    holdings = self.client.get_holdings(user_id, account.get('id'))
                    if not holdings.empty:
                        st.dataframe(holdings)
                        st.session_state[f"holdings_{account.get('id')}"] = holdings
                    else:
                        st.info("No holdings found")

# Global instance
snaptrade_connect = SnapTradeConnect()