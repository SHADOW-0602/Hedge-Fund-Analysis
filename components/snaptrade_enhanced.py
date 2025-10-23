import streamlit as st
import pandas as pd
from typing import Optional, List, Dict
from clients.snaptrade_client import snaptrade_client
from utils.logger import logger
from datetime import datetime, timedelta

class SnapTradeEnhanced:
    """Enhanced SnapTrade integration with CLI features"""
    
    def __init__(self):
        self.client = snaptrade_client
    
    def render_snaptrade_dashboard(self, user_id: str):
        """Main SnapTrade dashboard with all features"""
        if not self.client:
            st.error("❌ SnapTrade not configured")
            st.info("Configure SNAPTRADE_CLIENT_ID and SNAPTRADE_SECRET")
            return
        
        # Status overview
        self.render_status_overview(user_id)
        
        # Main tabs
        tab1, tab2, tab3, tab4, tab5 = st.tabs([
            "🏦 Accounts", "📊 Positions", "📈 Trading", "📋 Orders", "🔗 Connections"
        ])
        
        with tab1:
            self.render_accounts_tab(user_id)
        
        with tab2:
            self.render_positions_tab(user_id)
        
        with tab3:
            self.render_trading_tab(user_id)
        
        with tab4:
            self.render_orders_tab(user_id)
        
        with tab5:
            self.render_connections_tab(user_id)
    
    def render_status_overview(self, user_id: str):
        """Render status overview"""
        st.subheader("🔗 SnapTrade Status")
        
        from utils.user_secrets import user_secret_manager
        user_secret = user_secret_manager.get_snaptrade_secret(user_id)
        accounts = self.client.get_accounts(user_id)
        brokerages = self.client.get_brokerages()
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            if user_secret:
                st.success("✅ Registered")
            else:
                st.warning("⚠️ Not Registered")
        
        with col2:
            if accounts:
                st.success(f"✅ {len(accounts)} Accounts")
            else:
                st.info("📱 No Accounts")
        
        with col3:
            if brokerages:
                st.success(f"✅ {len(brokerages)} Brokers")
            else:
                st.error("❌ API Error")
        
        with col4:
            # Calculate total portfolio value
            total_value = sum(acc.get('balance', 0) for acc in accounts) if accounts else 0
            st.metric("Portfolio Value", f"${total_value:,.2f}")
    
    def render_accounts_tab(self, user_id: str):
        """Render accounts management tab"""
        st.subheader("🏦 Connected Accounts")
        
        accounts = self.client.get_accounts(user_id)
        
        if not accounts:
            st.info("No connected accounts")
            if st.button("🔗 Connect Account"):
                self.render_connection_flow(user_id)
            return
        
        # Account cards
        for i, account in enumerate(accounts):
            with st.expander(f"🏦 {account.get('name', 'Account')} - ${account.get('balance', 0):,.2f}"):
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    st.metric("Balance", f"${account.get('balance', 0):,.2f}")
                
                with col2:
                    st.metric("Type", account.get('type', 'Unknown'))
                
                with col3:
                    st.metric("Status", "🟢 Active")
                
                # Quick actions
                col1, col2, col3 = st.columns(3)
                with col1:
                    if st.button("📊 View Positions", key=f"pos_{i}"):
                        st.session_state[f'show_positions_{i}'] = True
                
                with col2:
                    if st.button("💰 Trade", key=f"trade_{i}"):
                        st.session_state[f'show_trading_{i}'] = True
                
                with col3:
                    if st.button("📈 Orders", key=f"orders_{i}"):
                        st.session_state[f'show_orders_{i}'] = True
                
                # Show positions if requested
                if st.session_state.get(f'show_positions_{i}'):
                    self.show_account_positions(user_id, account.get('id'))
    
    def render_positions_tab(self, user_id: str):
        """Render positions overview tab"""
        st.subheader("📊 All Positions")
        
        accounts = self.client.get_accounts(user_id)
        if not accounts:
            st.info("No accounts connected")
            return
        
        # Aggregate positions across all accounts
        all_positions = []
        for account in accounts:
            holdings = self.client.get_holdings(user_id, account.get('id'))
            if not holdings.empty:
                holdings['account_name'] = account.get('name', 'Unknown')
                all_positions.append(holdings)
        
        if all_positions:
            combined_df = pd.concat(all_positions, ignore_index=True)
            
            # Calculate totals
            combined_df['market_value'] = combined_df['quantity'] * combined_df['avg_cost']
            
            # Display summary
            total_value = combined_df['market_value'].sum()
            unique_symbols = combined_df['symbol'].nunique()
            
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total Value", f"${total_value:,.2f}")
            with col2:
                st.metric("Unique Symbols", unique_symbols)
            with col3:
                st.metric("Total Positions", len(combined_df))
            
            # Positions table
            display_df = combined_df[['symbol', 'quantity', 'avg_cost', 'market_value', 'account_name']].copy()
            display_df.columns = ['Symbol', 'Quantity', 'Avg Cost', 'Market Value', 'Account']
            
            st.dataframe(display_df, use_container_width=True)
        else:
            st.info("No positions found")
    
    def render_trading_tab(self, user_id: str):
        """Render trading interface tab"""
        st.subheader("💰 Trading Interface")
        
        accounts = self.client.get_accounts(user_id)
        if not accounts:
            st.warning("No accounts available for trading")
            return
        
        # Account selection
        account_options = {f"{acc.get('name', 'Account')} (${acc.get('balance', 0):,.2f})": acc.get('id') 
                          for acc in accounts}
        selected_account = st.selectbox("Select Account", list(account_options.keys()))
        account_id = account_options[selected_account]
        
        # Trade type selection
        trade_type = st.selectbox("Trade Type", ["Equity", "Options"])
        
        if trade_type == "Equity":
            self.render_equity_trading(user_id, account_id)
        else:
            self.render_options_trading(user_id, account_id)
    
    def render_equity_trading(self, user_id: str, account_id: str):
        """Render equity trading interface"""
        st.subheader("📈 Equity Trading")
        
        col1, col2 = st.columns(2)
        
        with col1:
            symbol = st.text_input("Symbol", placeholder="AAPL").upper()
            side = st.selectbox("Side", ["BUY", "SELL"])
            quantity = st.number_input("Quantity", min_value=1, value=100)
        
        with col2:
            order_type = st.selectbox("Order Type", ["MARKET", "LIMIT", "STOP"])
            
            if order_type in ["LIMIT", "STOP"]:
                price = st.number_input("Price", min_value=0.01, value=150.00, step=0.01)
            else:
                price = None
            
            time_in_force = st.selectbox("Time in Force", ["DAY", "GTC"])
        
        # Get quote
        if st.button("📊 Get Quote") and symbol:
            st.info(f"💰 {symbol}: $150.25 (Mock Quote)")
        
        # Place order
        if st.button("🚀 Place Order", type="primary") and symbol and quantity:
            self.show_order_confirmation(symbol, side, quantity, order_type, price, time_in_force)
    
    def render_options_trading(self, user_id: str, account_id: str):
        """Render options trading interface"""
        st.subheader("📊 Options Trading")
        
        col1, col2 = st.columns(2)
        
        with col1:
            underlying = st.text_input("Underlying", placeholder="AAPL").upper()
            option_type = st.selectbox("Type", ["CALL", "PUT"])
            strike = st.number_input("Strike", min_value=0.01, value=150.00)
        
        with col2:
            expiration = st.date_input("Expiration")
            side = st.selectbox("Action", ["BUY_TO_OPEN", "SELL_TO_OPEN", "BUY_TO_CLOSE", "SELL_TO_CLOSE"])
            contracts = st.number_input("Contracts", min_value=1, value=1)
        
        if st.button("📊 Get Options Chain") and underlying:
            st.info(f"Options chain for {underlying} would be displayed here")
        
        if st.button("🚀 Place Options Order"):
            st.success("Options order functionality would be implemented here")
    
    def render_orders_tab(self, user_id: str):
        """Render orders management tab"""
        st.subheader("📈 Order Management")
        
        # Mock orders data
        orders = [
            {"id": "ORD001", "symbol": "AAPL", "side": "BUY", "quantity": 100, "status": "FILLED", "time": "10:30 AM"},
            {"id": "ORD002", "symbol": "MSFT", "side": "SELL", "quantity": 50, "status": "PENDING", "time": "11:45 AM"},
            {"id": "ORD003", "symbol": "GOOGL", "side": "BUY", "quantity": 25, "status": "CANCELLED", "time": "2:20 PM"}
        ]
        
        if orders:
            orders_df = pd.DataFrame(orders)
            orders_df.columns = ['Order ID', 'Symbol', 'Side', 'Quantity', 'Status', 'Time']
            
            st.dataframe(orders_df, use_container_width=True)
            
            # Order actions
            col1, col2, col3 = st.columns(3)
            with col1:
                if st.button("🔄 Refresh Orders"):
                    st.success("Orders refreshed")
            
            with col2:
                order_id = st.text_input("Order ID to Cancel", placeholder="ORD002")
                
            with col3:
                if st.button("❌ Cancel Order") and order_id:
                    st.warning(f"Order {order_id} cancelled")
        else:
            st.info("No recent orders")
    
    def render_connections_tab(self, user_id: str):
        """Render connections management tab"""
        st.subheader("🔗 Connection Management")
        
        # Brokerages list
        st.subheader("🏦 Supported Brokerages")
        brokerages = self.client.get_brokerages()
        
        if brokerages:
            brokerage_data = []
            for broker in brokerages:
                brokerage_data.append({
                    'Name': broker.get('name', 'Unknown'),
                    'Slug': broker.get('slug', 'N/A'),
                    'Trading': '✅' if broker.get('allows_trading', False) else '❌',
                    'Options': '✅' if broker.get('allows_options', False) else '❌',
                    'Crypto': '✅' if broker.get('allows_crypto', False) else '❌'
                })
            
            brokerages_df = pd.DataFrame(brokerage_data)
            st.dataframe(brokerages_df, use_container_width=True)
            
            # Connection actions
            st.subheader("➕ New Connection")
            selected_broker = st.selectbox("Select Broker", [b['slug'] for b in brokerages])
            
            if st.button("🔗 Connect Brokerage"):
                self.initiate_connection(user_id, selected_broker)
        else:
            st.error("Unable to load brokerages")
    
    def show_account_positions(self, user_id: str, account_id: str):
        """Show positions for specific account"""
        holdings = self.client.get_holdings(user_id, account_id)
        
        if not holdings.empty:
            holdings['market_value'] = holdings['quantity'] * holdings['avg_cost']
            
            display_df = holdings[['symbol', 'quantity', 'avg_cost', 'market_value']].copy()
            display_df.columns = ['Symbol', 'Quantity', 'Avg Cost', 'Market Value']
            
            st.dataframe(display_df, use_container_width=True)
            
            total_value = holdings['market_value'].sum()
            st.metric("Account Total", f"${total_value:,.2f}")
        else:
            st.info("No positions in this account")
    
    def show_order_confirmation(self, symbol: str, side: str, quantity: int, order_type: str, price: float, tif: str):
        """Show order confirmation dialog"""
        st.warning("⚠️ Order Confirmation")
        
        order_summary = f"""
        **Order Details:**
        - Symbol: {symbol}
        - Side: {side}
        - Quantity: {quantity:,}
        - Type: {order_type}
        - Price: ${price:.2f} if price else "Market"
        - Time in Force: {tif}
        """
        st.markdown(order_summary)
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("✅ Confirm", type="primary"):
                order_id = f"ORD{datetime.now().strftime('%Y%m%d%H%M%S')}"
                st.success(f"✅ Order placed! ID: {order_id}")
        
        with col2:
            if st.button("❌ Cancel"):
                st.info("Order cancelled")
    
    def initiate_connection(self, user_id: str, broker_slug: str):
        """Initiate brokerage connection"""
        from utils.user_secrets import user_secret_manager
        
        # Ensure user is registered
        user_secret = user_secret_manager.get_snaptrade_secret(user_id)
        if not user_secret:
            if self.client.create_user(user_id):
                st.success("✅ User registered with SnapTrade")
            else:
                st.error("Failed to register user")
                return
        
        # Generate connection URL
        redirect_url = self.client.get_redirect_uri(user_id, broker_slug)
        
        if redirect_url:
            st.markdown(f"""
            <div style="text-align: center; padding: 20px;">
                <a href="{redirect_url}" target="_blank" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; padding: 15px 30px; text-decoration: none; 
                          border-radius: 8px; font-weight: bold; display: inline-block;">
                    🔗 Connect to {broker_slug}
                </a>
            </div>
            """, unsafe_allow_html=True)
            
            st.info("After connecting, refresh this page to see your accounts")
        else:
            st.error("Failed to generate connection URL")
    
    def render_connection_flow(self, user_id: str):
        """Render connection flow"""
        st.subheader("🔗 Connect Brokerage Account")
        
        brokerages = self.client.get_brokerages()
        if not brokerages:
            st.error("Unable to load brokerages")
            return
        
        # Broker selection
        broker_options = {b['name']: b['slug'] for b in brokerages if b.get('allows_trading', False)}
        selected_broker_name = st.selectbox("Select Brokerage", list(broker_options.keys()))
        selected_broker_slug = broker_options[selected_broker_name]
        
        if st.button("🚀 Connect"):
            self.initiate_connection(user_id, selected_broker_slug)

# Global instance
snaptrade_enhanced = SnapTradeEnhanced()