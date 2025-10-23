#!/usr/bin/env python3
"""Transaction Management Component for Streamlit"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.logger import logger
from clients.plaid_client import plaid_client
from core.transactions import TransactionPortfolio, Transaction

class TransactionManager:
    def __init__(self):
        self.plaid_client = plaid_client
    
    def render_transaction_interface(self, user_id: str):
        """Render the main transaction management interface"""
        st.header("📊 Transaction Management")
        
        # Transaction data tabs
        tab1, tab2, tab3 = st.tabs(["📈 Live Data (Plaid)", "➕ Add Transactions", "📋 Transaction History"])
        
        with tab1:
            self._render_plaid_transactions(user_id)
        
        with tab2:
            self._render_add_transactions(user_id)
        
        with tab3:
            self._render_transaction_history(user_id)
    
    def _render_plaid_transactions(self, user_id: str):
        """Render Plaid live transaction data"""
        st.subheader("Live Portfolio Data (Plaid)")
        
        if not self.plaid_client or not self.plaid_client.is_available():
            st.warning("⚠️ Plaid not configured. Please set up Plaid integration to access live data.")
            return
        
        # Check connection status
        from utils.user_secrets import user_secret_manager
        access_token = user_secret_manager.get_plaid_token(user_id)
        
        if not access_token:
            st.info("🔗 Connect your brokerage account to access live transaction data")
            return
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.write("**Portfolio Positions**")
            if st.button("🔄 Refresh Holdings", key="refresh_holdings"):
                with st.spinner("Fetching latest holdings..."):
                    try:
                        holdings_df = self.plaid_client.get_holdings(user_id)
                        if not holdings_df.empty:
                            st.session_state.plaid_holdings = holdings_df
                            st.success(f"✅ Refreshed {len(holdings_df)} holdings")
                        else:
                            st.warning("No holdings found")
                    except Exception as e:
                        st.error(f"Failed to refresh holdings: {str(e)}")
        
        with col2:
            st.write("**Transaction History**")
            if st.button("🔄 Refresh Transactions", key="refresh_transactions"):
                with st.spinner("Fetching latest transactions..."):
                    try:
                        transactions_df = self.plaid_client.get_all_transactions(user_id, days=90)
                        if not transactions_df.empty:
                            st.session_state.plaid_transactions = transactions_df
                            st.success(f"✅ Refreshed {len(transactions_df)} transactions")
                        else:
                            st.info("No transactions found")
                    except Exception as e:
                        st.error(f"Failed to refresh transactions: {str(e)}")
        
        # Display holdings if available
        if 'plaid_holdings' in st.session_state:
            holdings_df = st.session_state.plaid_holdings
            st.subheader("Current Holdings")
            
            # Holdings summary
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Total Positions", len(holdings_df))
            with col2:
                total_value = (holdings_df['quantity'] * holdings_df['institution_price']).sum()
                st.metric("Total Value", f"${total_value:,.2f}")
            with col3:
                avg_position_size = total_value / len(holdings_df) if len(holdings_df) > 0 else 0
                st.metric("Avg Position", f"${avg_position_size:,.2f}")
            with col4:
                largest_position = holdings_df.loc[holdings_df['market_value'].idxmax()] if not holdings_df.empty else None
                if largest_position is not None:
                    st.metric("Largest Position", largest_position['symbol'])
            
            # Holdings table
            display_holdings = holdings_df[['symbol', 'quantity', 'avg_cost', 'institution_price', 'market_value']].copy()
            display_holdings['avg_cost'] = display_holdings['avg_cost'].apply(lambda x: f"${x:.2f}")
            display_holdings['institution_price'] = display_holdings['institution_price'].apply(lambda x: f"${x:.2f}")
            display_holdings['market_value'] = display_holdings['market_value'].apply(lambda x: f"${x:,.2f}")
            display_holdings.columns = ['Symbol', 'Quantity', 'Avg Cost', 'Current Price', 'Market Value']
            
            st.dataframe(display_holdings, use_container_width=True)
        
        # Display transactions if available
        if 'plaid_transactions' in st.session_state:
            transactions_df = st.session_state.plaid_transactions
            st.subheader("Recent Transactions")
            
            # Transaction summary
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Total Transactions", len(transactions_df))
            with col2:
                buy_count = len(transactions_df[transactions_df['transaction_type'] == 'BUY']) if 'transaction_type' in transactions_df.columns else 0
                st.metric("Buy Orders", buy_count)
            with col3:
                sell_count = len(transactions_df[transactions_df['transaction_type'] == 'SELL']) if 'transaction_type' in transactions_df.columns else 0
                st.metric("Sell Orders", sell_count)
            with col4:
                if 'source' in transactions_df.columns:
                    manual_count = len(transactions_df[transactions_df['source'] == 'manual'])
                    st.metric("Manual Entries", manual_count)
            
            # Transaction filters
            col1, col2, col3 = st.columns(3)
            with col1:
                if 'symbol' in transactions_df.columns:
                    symbols = ['All'] + sorted(transactions_df['symbol'].unique().tolist())
                    selected_symbol = st.selectbox("Filter by Symbol", symbols, key="plaid_symbol_filter")
                else:
                    selected_symbol = 'All'
            
            with col2:
                if 'transaction_type' in transactions_df.columns:
                    types = ['All'] + sorted(transactions_df['transaction_type'].unique().tolist())
                    selected_type = st.selectbox("Filter by Type", types, key="plaid_type_filter")
                else:
                    selected_type = 'All'
            
            with col3:
                days_back = st.selectbox("Time Period", [30, 60, 90, 180, 365], index=2, key="plaid_days_filter")
            
            # Apply filters
            filtered_df = transactions_df.copy()
            
            if selected_symbol != 'All' and 'symbol' in filtered_df.columns:
                filtered_df = filtered_df[filtered_df['symbol'] == selected_symbol]
            
            if selected_type != 'All' and 'transaction_type' in filtered_df.columns:
                filtered_df = filtered_df[filtered_df['transaction_type'] == selected_type]
            
            if 'date' in filtered_df.columns:
                cutoff_date = datetime.now() - timedelta(days=days_back)
                filtered_df['date'] = pd.to_datetime(filtered_df['date'])
                filtered_df = filtered_df[filtered_df['date'] >= cutoff_date]
            
            # Display filtered transactions
            if not filtered_df.empty:
                # Format for display
                display_df = filtered_df.copy()
                if 'date' in display_df.columns:
                    display_df['date'] = display_df['date'].dt.strftime('%Y-%m-%d')
                if 'price' in display_df.columns:
                    display_df['price'] = display_df['price'].apply(lambda x: f"${x:.2f}")
                if 'fees' in display_df.columns:
                    display_df['fees'] = display_df['fees'].apply(lambda x: f"${x:.2f}")
                
                st.dataframe(display_df, use_container_width=True)
                
                # Transaction visualization
                if len(filtered_df) > 1 and 'date' in filtered_df.columns and 'transaction_type' in filtered_df.columns:
                    fig = px.histogram(filtered_df, x='date', color='transaction_type', 
                                     title="Transaction Activity Over Time")
                    st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("No transactions match the selected filters")
    
    def _render_add_transactions(self, user_id: str):
        """Render manual transaction entry interface"""
        st.subheader("Add New Transactions")
        st.info("Add more transaction history with columns: symbol, quantity, price, date, transaction_type, fees (optional)")
        
        # Single transaction entry
        with st.expander("➕ Add Single Transaction", expanded=True):
            col1, col2 = st.columns(2)
            
            with col1:
                symbol = st.text_input("Symbol", placeholder="AAPL", key="single_symbol").upper()
                quantity = st.number_input("Quantity", min_value=0.01, value=100.0, step=1.0, key="single_quantity")
                price = st.number_input("Price ($)", min_value=0.01, value=150.0, step=0.01, key="single_price")
            
            with col2:
                transaction_type = st.selectbox("Transaction Type", ["BUY", "SELL"], key="single_type")
                transaction_date = st.date_input("Date", value=datetime.now().date(), key="single_date")
                fees = st.number_input("Fees ($)", min_value=0.0, value=0.0, step=0.01, key="single_fees")
            
            if st.button("💾 Add Transaction", type="primary"):
                if symbol and quantity > 0 and price > 0:
                    result = self.plaid_client.add_manual_transaction(
                        user_id, symbol, quantity, price, transaction_type, 
                        transaction_date.strftime('%Y-%m-%d'), fees
                    )
                    
                    if result['status'] == 'success':
                        st.success(f"✅ Added {transaction_type} {quantity} {symbol} @ ${price:.2f}")
                        # Clear the form
                        st.rerun()
                    else:
                        st.error(f"❌ {result['message']}")
                else:
                    st.error("Please fill in all required fields")
        
        # Bulk transaction entry
        with st.expander("📊 Bulk Transaction Upload"):
            st.write("Upload a CSV file with columns: symbol, quantity, price, date, transaction_type, fees")
            
            uploaded_file = st.file_uploader(
                "Choose CSV file", 
                type=['csv'], 
                help="CSV format: symbol,quantity,price,date,transaction_type,fees",
                key="bulk_upload"
            )
            
            if uploaded_file is not None:
                try:
                    df = pd.read_csv(uploaded_file)
                    
                    # Validate required columns
                    required_cols = ['symbol', 'quantity', 'price', 'date', 'transaction_type']
                    missing_cols = [col for col in required_cols if col not in df.columns]
                    
                    if missing_cols:
                        st.error(f"Missing required columns: {missing_cols}")
                    else:
                        # Add fees column if missing
                        if 'fees' not in df.columns:
                            df['fees'] = 0.0
                        
                        st.write("**Preview:**")
                        st.dataframe(df.head(), use_container_width=True)
                        
                        col1, col2 = st.columns(2)
                        with col1:
                            st.metric("Total Transactions", len(df))
                        with col2:
                            unique_symbols = df['symbol'].nunique()
                            st.metric("Unique Symbols", unique_symbols)
                        
                        if st.button("📥 Import All Transactions", type="primary"):
                            success_count = 0
                            error_count = 0
                            
                            progress_bar = st.progress(0)
                            status_text = st.empty()
                            
                            for idx, row in df.iterrows():
                                try:
                                    result = self.plaid_client.add_manual_transaction(
                                        user_id, 
                                        str(row['symbol']).upper(),
                                        float(row['quantity']),
                                        float(row['price']),
                                        str(row['transaction_type']).upper(),
                                        str(row['date']),
                                        float(row.get('fees', 0))
                                    )
                                    
                                    if result['status'] == 'success':
                                        success_count += 1
                                    else:
                                        error_count += 1
                                        logger.error(f"Failed to add transaction {idx}: {result['message']}")
                                
                                except Exception as e:
                                    error_count += 1
                                    logger.error(f"Error processing row {idx}: {str(e)}")
                                
                                # Update progress
                                progress = (idx + 1) / len(df)
                                progress_bar.progress(progress)
                                status_text.text(f"Processing transaction {idx + 1} of {len(df)}")
                            
                            progress_bar.empty()
                            status_text.empty()
                            
                            if success_count > 0:
                                st.success(f"✅ Successfully imported {success_count} transactions")
                            if error_count > 0:
                                st.warning(f"⚠️ {error_count} transactions failed to import")
                
                except Exception as e:
                    st.error(f"Error reading CSV file: {str(e)}")
        
        # Template download
        with st.expander("📄 Download CSV Template"):
            template_data = {
                'symbol': ['AAPL', 'MSFT', 'GOOGL'],
                'quantity': [100, 50, 25],
                'price': [150.00, 280.00, 2500.00],
                'date': ['2024-01-15', '2024-01-16', '2024-01-17'],
                'transaction_type': ['BUY', 'BUY', 'SELL'],
                'fees': [9.95, 9.95, 9.95]
            }
            
            template_df = pd.DataFrame(template_data)
            st.dataframe(template_df, use_container_width=True)
            
            csv_data = template_df.to_csv(index=False)
            st.download_button(
                label="📥 Download Template",
                data=csv_data,
                file_name="transaction_template.csv",
                mime="text/csv"
            )
    
    def _render_transaction_history(self, user_id: str):
        """Render complete transaction history"""
        st.subheader("Transaction History")
        
        # Load all transactions
        if st.button("🔄 Refresh All Data", key="refresh_all"):
            with st.spinner("Loading transaction history..."):
                try:
                    if self.plaid_client:
                        all_transactions = self.plaid_client.get_all_transactions(user_id, days=365)
                        st.session_state.all_transactions = all_transactions
                        
                        if not all_transactions.empty:
                            st.success(f"✅ Loaded {len(all_transactions)} transactions")
                        else:
                            st.info("No transactions found")
                    else:
                        st.warning("Plaid client not available")
                except Exception as e:
                    st.error(f"Failed to load transactions: {str(e)}")
        
        # Display transaction history
        if 'all_transactions' in st.session_state:
            transactions_df = st.session_state.all_transactions
            
            if not transactions_df.empty:
                # Summary metrics
                col1, col2, col3, col4 = st.columns(4)
                
                with col1:
                    st.metric("Total Transactions", len(transactions_df))
                
                with col2:
                    if 'symbol' in transactions_df.columns:
                        unique_symbols = transactions_df['symbol'].nunique()
                        st.metric("Unique Symbols", unique_symbols)
                
                with col3:
                    if 'transaction_type' in transactions_df.columns:
                        buy_count = len(transactions_df[transactions_df['transaction_type'] == 'BUY'])
                        st.metric("Buy Orders", buy_count)
                
                with col4:
                    if 'transaction_type' in transactions_df.columns:
                        sell_count = len(transactions_df[transactions_df['transaction_type'] == 'SELL'])
                        st.metric("Sell Orders", sell_count)
                
                # Advanced filters
                st.subheader("📊 Analysis & Filters")
                
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    # Symbol filter
                    if 'symbol' in transactions_df.columns:
                        symbols = ['All'] + sorted(transactions_df['symbol'].unique().tolist())
                        selected_symbols = st.multiselect("Symbols", symbols, default=['All'])
                        if 'All' not in selected_symbols and selected_symbols:
                            transactions_df = transactions_df[transactions_df['symbol'].isin(selected_symbols)]
                
                with col2:
                    # Date range filter
                    if 'date' in transactions_df.columns:
                        transactions_df['date'] = pd.to_datetime(transactions_df['date'])
                        min_date = transactions_df['date'].min().date()
                        max_date = transactions_df['date'].max().date()
                        
                        date_range = st.date_input(
                            "Date Range",
                            value=[min_date, max_date],
                            min_value=min_date,
                            max_value=max_date
                        )
                        
                        if len(date_range) == 2:
                            start_date, end_date = date_range
                            transactions_df = transactions_df[
                                (transactions_df['date'].dt.date >= start_date) & 
                                (transactions_df['date'].dt.date <= end_date)
                            ]
                
                with col3:
                    # Transaction type filter
                    if 'transaction_type' in transactions_df.columns:
                        types = ['All'] + sorted(transactions_df['transaction_type'].unique().tolist())
                        selected_types = st.multiselect("Transaction Types", types, default=['All'])
                        if 'All' not in selected_types and selected_types:
                            transactions_df = transactions_df[transactions_df['transaction_type'].isin(selected_types)]
                
                # Display filtered data
                if not transactions_df.empty:
                    # Format for display
                    display_df = transactions_df.copy()
                    if 'date' in display_df.columns:
                        display_df['date'] = display_df['date'].dt.strftime('%Y-%m-%d')
                    if 'price' in display_df.columns:
                        display_df['price'] = display_df['price'].apply(lambda x: f"${x:.2f}")
                    if 'fees' in display_df.columns:
                        display_df['fees'] = display_df['fees'].apply(lambda x: f"${x:.2f}")
                    
                    st.dataframe(display_df, use_container_width=True)
                    
                    # Analytics
                    if len(transactions_df) > 1:
                        st.subheader("📈 Transaction Analytics")
                        
                        # Transaction volume over time
                        if 'date' in transactions_df.columns and 'transaction_type' in transactions_df.columns:
                            daily_volume = transactions_df.groupby([
                                transactions_df['date'].dt.date, 'transaction_type'
                            ]).size().reset_index(name='count')
                            
                            fig_volume = px.bar(daily_volume, x='date', y='count', color='transaction_type',
                                              title="Daily Transaction Volume")
                            st.plotly_chart(fig_volume, use_container_width=True)
                        
                        # Symbol distribution
                        if 'symbol' in transactions_df.columns:
                            symbol_counts = transactions_df['symbol'].value_counts().head(10)
                            fig_symbols = px.bar(x=symbol_counts.index, y=symbol_counts.values,
                                               title="Top 10 Most Traded Symbols")
                            fig_symbols.update_layout(xaxis_title="Symbol", yaxis_title="Transaction Count")
                            st.plotly_chart(fig_symbols, use_container_width=True)
                
                else:
                    st.info("No transactions match the selected filters")
                
                # Management actions
                st.subheader("🛠️ Management Actions")
                
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    if st.button("📥 Export to CSV"):
                        csv_data = transactions_df.to_csv(index=False)
                        st.download_button(
                            label="📥 Download CSV",
                            data=csv_data,
                            file_name=f"transactions_{user_id}_{datetime.now().strftime('%Y%m%d')}.csv",
                            mime="text/csv"
                        )
                
                with col2:
                    if st.button("🗑️ Clear Manual Transactions", type="secondary"):
                        if st.button("⚠️ Confirm Clear", type="secondary"):
                            from clients.plaid_client import clear_manual_transactions
                            if clear_manual_transactions(user_id):
                                st.success("✅ Manual transactions cleared")
                                st.rerun()
                            else:
                                st.error("❌ Failed to clear transactions")
                
                with col3:
                    if st.button("🔄 Sync with Portfolio"):
                        # Convert transactions to current positions
                        try:
                            from core.transactions import TransactionPortfolio
                            
                            # Convert DataFrame to TransactionPortfolio
                            txn_portfolio = TransactionPortfolio.from_dataframe(transactions_df)
                            positions = txn_portfolio.get_current_positions()
                            cost_basis = txn_portfolio.get_cost_basis()
                            
                            st.success(f"✅ Portfolio sync: {len(positions)} current positions")
                            
                            # Show current positions
                            if positions:
                                positions_data = []
                                for symbol, qty in positions.items():
                                    avg_cost = cost_basis.get(symbol, 0)
                                    positions_data.append({
                                        'Symbol': symbol,
                                        'Quantity': qty,
                                        'Avg Cost': f"${avg_cost:.2f}",
                                        'Market Value': f"${qty * avg_cost:,.2f}"
                                    })
                                
                                positions_df = pd.DataFrame(positions_data)
                                st.dataframe(positions_df, use_container_width=True)
                        
                        except Exception as e:
                            st.error(f"Sync failed: {str(e)}")
            
            else:
                st.info("No transaction history available. Add transactions or connect your brokerage account.")
        
        else:
            st.info("Click 'Refresh All Data' to load your transaction history")

# Global instance
transaction_manager = TransactionManager()