#!/usr/bin/env python3
"""Plaid Direct Connect Component"""

import streamlit as st
import webbrowser
from clients.plaid_client import plaid_client
from clients.unified_broker_client import unified_client

class PlaidDirectConnect:
    def __init__(self):
        self.user_id = "744944b4-c861-4950-9cb1-a34ded460d36"
    
    def render_direct_connect(self):
        """Render direct Plaid connection with one-click button"""
        
        st.subheader("🏦 One-Click Brokerage Connection")
        
        # Main connect button
        if st.button("🔗 Connect My Brokerage", type="primary", key="plaid_connect"):
            link_token = plaid_client.create_link_token(self.user_id)
            
            if link_token:
                plaid_url = f"https://cdn.plaid.com/link/v2/stable/link.html?token={link_token}"
                
                # Open in new tab using JavaScript
                st.markdown(f"""
                <script>
                window.open('{plaid_url}', '_blank');
                </script>
                """, unsafe_allow_html=True)
                
                st.success("✅ Plaid Link opened! Complete connection and return here.")
                st.session_state.plaid_ready = True
                st.session_state.plaid_url = plaid_url
            else:
                st.error("❌ Failed to open Plaid Link")
        
        # Token input after connection attempt
        if st.session_state.get('plaid_ready'):
            st.divider()
            
            public_token = st.text_input(
                "Paste public token from Plaid:",
                placeholder="public-sandbox-...",
                key="plaid_token_input"
            )
            
            col1, col2 = st.columns(2)
            
            with col1:
                if public_token and st.button("📊 Load Portfolio", type="primary"):
                    return self._process_token(public_token)
            
            with col2:
                if st.button("🔗 Reopen Plaid Link"):
                    if 'plaid_url' in st.session_state:
                        st.markdown(f"""
                        <script>
                        window.open('{st.session_state.plaid_url}', '_blank');
                        </script>
                        """, unsafe_allow_html=True)
        
        return None
    
    def _process_token(self, public_token):
        """Process public token and return portfolio data"""
        with st.spinner("Loading your portfolio..."):
            # Exchange token
            success = plaid_client.exchange_public_token(self.user_id, public_token)
            
            if success:
                st.success("✅ Connected successfully!")
                
                # Get unified portfolio data
                portfolio_df = unified_client.get_all_holdings(self.user_id)
                
                if not portfolio_df.empty:
                    # Display summary
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric("Positions", len(portfolio_df))
                    with col2:
                        st.metric("Total Value", f"${portfolio_df['market_value'].sum():,.2f}")
                    with col3:
                        st.metric("Brokers", portfolio_df['broker'].nunique())
                    
                    # Show portfolio
                    st.dataframe(portfolio_df)
                    
                    # Save and download
                    portfolio_df.to_csv('data/connected_portfolio.csv', index=False)
                    
                    csv = portfolio_df.to_csv(index=False)
                    st.download_button(
                        "📥 Download Portfolio",
                        csv,
                        "my_portfolio.csv",
                        "text/csv"
                    )
                    
                    return portfolio_df
                else:
                    st.info("No holdings found. Try connecting a different account.")
            else:
                st.error("❌ Connection failed. Check your token.")
        
        return None

def integrate_plaid_direct():
    """Integration function for main app"""
    connector = PlaidDirectConnect()
    
    with st.expander("🏦 Connect Brokerage", expanded=True):
        portfolio_data = connector.render_direct_connect()
    
    return portfolio_data

if __name__ == "__main__":
    st.set_page_config(page_title="Plaid Direct Connect", layout="wide")
    integrate_plaid_direct()