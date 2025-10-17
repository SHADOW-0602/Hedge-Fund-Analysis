import streamlit as st
import pandas as pd
import plotly.express as px
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.portfolio import Portfolio
from clients.market_data_client import MarketDataClient
from clients.supabase_client import supabase_client
from analytics.risk_analytics import RiskAnalyzer
from analytics.options_analytics import OptionsAnalyzer
from enterprise.user_management import UserManager, UserRole, Permission
from enterprise.user_management import DataIsolationManager, CollaborationManager

st.set_page_config(page_title="Portfolio Analysis Engine", layout="wide")
st.title("Portfolio & Options Analysis Engine")

# Initialize clients
@st.cache_resource
def get_data_client():
    return MarketDataClient()

data_client = get_data_client()

# Simple user selection (no authentication)
with st.sidebar:
    st.header("User Selection")
    username = st.text_input("Enter Username", value=st.session_state.get('username', 'demo_user'))
    if st.button("Switch User") or 'username' not in st.session_state:
        st.session_state.username = username
        st.session_state.user_id = f"user_{username}"
        st.rerun()
    
    st.write(f"Current User: **{st.session_state.username}**")
    st.divider()

user_id = st.session_state.user_id

# Sidebar for portfolio management
with st.sidebar:
    st.header("Portfolio Management")
    
    # Load saved portfolios
    if supabase_client:
        saved_portfolios = supabase_client.get_user_portfolios(user_id)
        if saved_portfolios:
            portfolio_names = [p['portfolio_name'] for p in saved_portfolios]
            selected_portfolio = st.selectbox("Load Saved Portfolio", ["None"] + portfolio_names)
            
            if selected_portfolio != "None":
                portfolio_data = next(p for p in saved_portfolios if p['portfolio_name'] == selected_portfolio)
                st.session_state.current_portfolio = portfolio_data
    
    st.divider()

uploaded_file = st.file_uploader("Upload Portfolio CSV", type=['csv'])

# Check if we have a loaded portfolio from sidebar
current_portfolio = None
if 'current_portfolio' in st.session_state:
    portfolio_data = st.session_state.current_portfolio['portfolio_data']
    df = pd.DataFrame(portfolio_data)
    current_portfolio = Portfolio.from_dataframe(df)

if uploaded_file or current_portfolio:
    if uploaded_file:
        portfolio = Portfolio.from_csv(uploaded_file)
        
        # Save portfolio option
        if supabase_client:
            portfolio_name = st.text_input("Portfolio Name (to save)")
            if st.button("Save Portfolio") and portfolio_name:
                portfolio_data = [{
                    'symbol': pos.symbol,
                    'quantity': pos.quantity,
                    'avg_cost': pos.avg_cost
                } for pos in portfolio.positions]
                
                portfolio_id = supabase_client.save_portfolio(user_id, portfolio_name, portfolio_data)
                if portfolio_id:
                    st.success(f"Portfolio '{portfolio_name}' saved!")
                else:
                    st.error("Failed to save portfolio")
    else:
        portfolio = current_portfolio
    
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Total Positions", len(portfolio.positions))
        st.metric("Total Value", f"${portfolio.total_value:,.2f}")
    
    # Portfolio composition
    weights_df = pd.DataFrame(list(portfolio.get_weights().items()), 
                             columns=['Symbol', 'Weight'])
    fig = px.pie(weights_df, values='Weight', names='Symbol', 
                title="Portfolio Composition")
    st.plotly_chart(fig)
    
    # Risk Analysis
    st.header("Risk Analysis")
    if st.button("Analyze Risk"):
        with st.spinner("Calculating risk metrics..."):
            risk_analyzer = RiskAnalyzer(data_client)
            weights = portfolio.get_weights()
            metrics = risk_analyzer.analyze_portfolio_risk(portfolio.symbols, weights)
            
            col1, col2 = st.columns(2)
            with col1:
                st.metric("Portfolio Volatility", f"{metrics['portfolio_volatility']:.2%}")
            with col2:
                st.metric("Average Correlation", f"{metrics['avg_correlation']:.3f}")
            
            # Correlation heatmap
            fig = px.imshow(metrics['correlation_matrix'], title="Correlation Matrix")
            st.plotly_chart(fig)
    
    # Options Analysis
    st.header("Options Opportunities")
    if st.button("Scan Options"):
        with st.spinner("Scanning options chains..."):
            options_analyzer = OptionsAnalyzer(data_client)
            opportunities = options_analyzer.scan_covered_calls(portfolio.symbols)
            
            if opportunities:
                df = pd.DataFrame(opportunities)
                st.dataframe(df)
            else:
                st.info("No covered call opportunities found")

else:
    st.info("Please upload a CSV file with columns: symbol, quantity, avg_cost")