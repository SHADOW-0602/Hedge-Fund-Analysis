#!/usr/bin/env python3
"""Plaid Streamlit Component"""

import streamlit as st
import pandas as pd
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.plaid_handler import plaid_handler

def render_plaid_integration(user_id: str):
    """Render Plaid integration UI"""
    st.header("Connect Brokerage")
    
    # Show supported institutions
    with st.expander("🏦 Supported Brokerages"):
        st.write("**Major Brokerages Supported:**")
        st.write("• Charles Schwab • Fidelity • TD Ameritrade • E*TRADE")
        st.write("• Interactive Brokers • Robinhood • Vanguard • Merrill Lynch")
        st.write("• And 11,000+ other financial institutions")
        st.info("🔒 All connections are secured with bank-level encryption")
    
    # Render Plaid UI
    plaid_handler.render_plaid_link_ui(user_id)
    
    # Sample data option
    if st.button("📊 Use Sample Data", help="Load sample data for testing"):
        try:
            demo_holdings = pd.DataFrame([
                {'symbol': 'AAPL', 'quantity': 100, 'avg_cost': 150.0, 'cost_basis': 15000, 'market_value': 17500, 'institution_price': 175.0},
                {'symbol': 'MSFT', 'quantity': 50, 'avg_cost': 280.0, 'cost_basis': 14000, 'market_value': 16000, 'institution_price': 320.0},
                {'symbol': 'GOOGL', 'quantity': 25, 'avg_cost': 2500.0, 'cost_basis': 62500, 'market_value': 65000, 'institution_price': 2600.0},
                {'symbol': 'TSLA', 'quantity': 75, 'avg_cost': 200.0, 'cost_basis': 15000, 'market_value': 18750, 'institution_price': 250.0}
            ])
            st.success(f"✅ Sample Data Loaded! {len(demo_holdings)} holdings")
            st.session_state.plaid_portfolio = demo_holdings
            
            demo_transactions = pd.DataFrame([
                {'date': '2024-01-15', 'description': 'Portfolio Deposit', 'transaction_type': 'deposit', 'amount': 50000},
                {'date': '2024-01-20', 'description': 'Dividend Payment', 'transaction_type': 'dividend', 'amount': 250},
                {'date': '2024-01-25', 'description': 'Portfolio Withdrawal', 'transaction_type': 'withdraw', 'amount': 5000}
            ])
            st.success(f"✅ Imported {len(demo_transactions)} sample transactions")
            st.session_state.plaid_transactions = demo_transactions
            
            st.rerun()
        except Exception as e:
            st.error(f"Sample data error: {str(e)}")
    
    st.write("**Supported Investment Accounts:**")
    st.write("• Charles Schwab • Fidelity • TD Ameritrade • E*TRADE • Interactive Brokers • Vanguard • 401(k)/IRA accounts")