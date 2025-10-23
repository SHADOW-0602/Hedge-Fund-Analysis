#!/usr/bin/env python3
"""Multi-Broker Connection Component"""

import streamlit as st
from clients.unified_broker_client import unified_client
from clients.plaid_client import plaid_client
from clients.snaptrade_client import snaptrade_client

class MultiBrokerConnect:
    def __init__(self):
        self.user_id = "744944b4-c861-4950-9cb1-a34ded460d36"
    
    def render_connection_status(self):
        """Show connection status for all brokers"""
        st.subheader("🏦 Multi-Broker Connections")
        
        status = unified_client.get_connection_status(self.user_id)
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.write("**SnapTrade**")
            if status.get('snaptrade', False):
                st.success("✅ Connected")
                accounts = snaptrade_client.get_accounts(self.user_id) if snaptrade_client else []
                st.info(f"{len(accounts)} accounts")
            else:
                st.error("❌ Not Connected")
                if st.button("Connect SnapTrade", key="connect_snaptrade"):
                    st.info("Use the SnapTrade connection section above")
        
        with col2:
            st.write("**Plaid**")
            if status.get('plaid', False):
                st.success("✅ Connected")
                accounts = plaid_client.get_accounts(self.user_id) if plaid_client else []
                st.info(f"{len(accounts)} accounts")
            else:
                st.error("❌ Not Connected")
                if st.button("Connect Plaid", key="connect_plaid"):
                    self.render_plaid_connection()
    
    def render_plaid_connection(self):
        """Render Plaid connection interface"""
        if not plaid_client:
            st.error("Plaid not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env")
            st.code("""
# Add to .env file:
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret_key
PLAID_ENVIRONMENT=sandbox  # or production
            """)
            return
        
        st.subheader("🔗 Connect with Plaid")
        st.info("Plaid connects to 11,000+ financial institutions including all major brokers")
        
        # Generate link token
        if st.button("🚀 Start Plaid Connection"):
            with st.spinner("Generating connection link..."):
                link_token = plaid_client.create_link_token(self.user_id)
                
                if link_token:
                    st.success("✅ Connection link generated!")
                    st.info("In a real app, this would open Plaid Link widget")
                    st.code(f"Link Token: {link_token[:20]}...")
                    
                    # Simulate token exchange (in real app, this comes from frontend)
                    st.write("**Next Steps:**")
                    st.write("1. User selects their bank/broker")
                    st.write("2. User enters credentials")
                    st.write("3. Plaid returns public token")
                    st.write("4. Exchange public token for access token")
                    
                    # Demo token exchange
                    demo_public_token = st.text_input("Demo: Enter public token (from Plaid Link)")
                    if demo_public_token and st.button("Exchange Token"):
                        success = plaid_client.exchange_public_token(self.user_id, demo_public_token)
                        if success:
                            st.success("✅ Plaid connected successfully!")
                            st.rerun()
                        else:
                            st.error("❌ Token exchange failed")
                else:
                    st.error("❌ Failed to generate link token")
    
    def render_unified_data(self):
        """Show unified data from all brokers"""
        st.subheader("📊 Unified Portfolio Data")
        
        # Get all holdings
        holdings_df = unified_client.get_all_holdings(self.user_id)
        
        if not holdings_df.empty:
            st.write(f"**Holdings from {holdings_df['broker'].nunique()} broker(s):**")
            
            # Group by broker
            for broker in holdings_df['broker'].unique():
                broker_holdings = holdings_df[holdings_df['broker'] == broker]
                
                with st.expander(f"{broker.title()} - {len(broker_holdings)} positions"):
                    st.dataframe(broker_holdings[['symbol', 'quantity', 'market_value']])
            
            # Combined summary
            st.write("**Portfolio Summary:**")
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("Total Positions", len(holdings_df))
            with col2:
                st.metric("Total Value", f"${holdings_df['market_value'].sum():,.2f}")
            with col3:
                st.metric("Unique Symbols", holdings_df['symbol'].nunique())
            
            # Save combined data
            if st.button("💾 Save Combined Portfolio"):
                holdings_df.to_csv('data/unified_portfolio.csv', index=False)
                st.success("✅ Saved to data/unified_portfolio.csv")
        else:
            st.info("No portfolio data found. Connect your brokers first.")
    
    def render_multi_broker_interface(self):
        """Main interface for multi-broker connections"""
        self.render_connection_status()
        
        st.divider()
        
        self.render_unified_data()

# Global instance
multi_broker_connect = MultiBrokerConnect()

def integrate_multi_broker():
    """Integration function for main app"""
    with st.expander("🏦 Multi-Broker Integration", expanded=False):
        multi_broker_connect.render_multi_broker_interface()
    
    # Return unified data for analysis
    return unified_client.get_all_holdings(multi_broker_connect.user_id)

if __name__ == "__main__":
    st.set_page_config(page_title="Multi-Broker Connect", layout="wide")
    integrate_multi_broker()