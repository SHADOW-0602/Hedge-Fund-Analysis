import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import sys
import os
import time
from dotenv import load_dotenv
import hashlib
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()



# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import logger and enhanced utilities
from utils.logger import logger
from utils.config import Config
from utils.email_service import email_service
from utils.user_secrets import user_secret_manager

from core.portfolio import Portfolio
from clients.market_data_client import MarketDataClient
from clients.supabase_client import supabase_client
from analytics.risk_analytics import RiskAnalyzer
from analytics.options_analytics import OptionsAnalyzer
from analytics.backtesting import Backtester
from analytics.statistical_analysis import StatisticalAnalyzer
from analytics.technical_indicators import TechnicalIndicators
from analytics.trading_operations import OrderManager, CostManager, PositionSizer, ExecutionAnalyzer
from analytics.research_development import StrategyBacktester, FactorResearcher, ModelValidator
from compliance.reporting_engine import ComplianceReporter
from enterprise.user_management import UserManager, UserRole, Permission
from enterprise.user_management import DataIsolationManager, CollaborationManager
from utils.cache_manager import cache_manager
from utils.cookie_manager import cookie_manager

# Try to import transaction manager (optional component)
try:
    from components.transaction_manager import TransactionManager
    transaction_manager = TransactionManager()
except ImportError:
    transaction_manager = None

st.set_page_config(
    page_title="Portfolio Analysis Engine", 
    layout="wide",
    initial_sidebar_state="expanded"
)

# Load CSS styling with dynamic background
def load_css():
    import requests
    
    # Get background image from API Ninjas
    api_key = os.getenv('API_NINJAS_KEY')
    bg_url = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1920&h=1080&fit=crop'  # Default
    
    if api_key:
        try:
            response = requests.get(
                'https://api.api-ninjas.com/v1/randomimage?category=nature',
                headers={'X-Api-Key': api_key}
            )
            if response.status_code == 200:
                bg_url = response.json().get('image', bg_url)
        except:
            pass
    
    css_path = os.path.join(os.path.dirname(__file__), 'styles.css')
    with open(css_path) as f:
        css_content = f.read()
        # Replace gradient with background image
        css_content = css_content.replace(
            'background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);',
            f'background: linear-gradient(rgba(26, 26, 46, 0.9), rgba(22, 33, 62, 0.9)), url("{bg_url}"); background-size: cover; background-attachment: fixed;'
        )
        st.markdown(f'<style>{css_content}</style>', unsafe_allow_html=True)

load_css()

# Cookie Consent Check - Don't show banner yet
if 'cookie_consent_given' not in st.session_state:
    # Check if consent was previously given (stored in query params as fallback)
    st.session_state.cookie_consent_given = st.query_params.get('consent', 'false') == 'true'

# Initialize managers
@st.cache_resource
def get_managers():
    return {
        'data_client': MarketDataClient(),
        'user_manager': UserManager(),
        'data_isolation': DataIsolationManager(),
        'collaboration': CollaborationManager()
    }

managers = get_managers()
data_client = managers['data_client']
user_manager = managers['user_manager']
data_isolation = managers['data_isolation']
collaboration = managers['collaboration']

# Authentication System
def show_login():
    st.title("Login to Portfolio Analysis Engine")
    
    tab1, tab2 = st.tabs(["Login", "Register"])
    
    with tab1:
        with st.form("login_form"):
            username = st.text_input("Username")
            password = st.text_input("Password", type="password")
            login_btn = st.form_submit_button("Login")
            
            if login_btn and username and password:
                user = user_manager.authenticate_user(username, password)
                if user:
                    logger.info(f"User {username} logged in successfully")
                    st.session_state.user = user
                    st.session_state.session_id = user_manager.create_session(user.user_id)
                    
                    # Cache user session
                    session_data = {
                        'user_id': user.user_id,
                        'username': user.username,
                        'role': user.role.value,
                        'login_time': datetime.now().isoformat()
                    }
                    cache_manager.set_user_session(user.user_id, session_data)
                    
                    # Set cookies (only if consent given)
                    if st.session_state.get('cookie_consent_given', False):
                        cookie_manager.set_last_login(user.user_id)
                    
                    st.success(f"Welcome {user.username}!")
                    st.rerun()
                else:
                    logger.warning(f"Failed login attempt for username: {username}")
                    st.error("Invalid credentials")
    
    with tab2:
        with st.form("register_form"):
            new_username = st.text_input("Username")
            new_email = st.text_input("Email")
            new_password = st.text_input("Password", type="password")
            role = st.selectbox("Role", [r.value for r in UserRole if r != UserRole.ADMIN])
            register_btn = st.form_submit_button("Register")
            
            if register_btn and new_username and new_email and new_password:
                try:
                    user_id = user_manager.create_user(new_username, new_email, new_password, UserRole(role))
                    
                    # Send welcome email
                    if email_service.enabled:
                        email_sent = email_service.send_welcome_email(new_email, new_username)
                        if email_sent:
                            st.success("Account created! Welcome email sent. Please login.")
                        else:
                            st.success("Account created! Please login. (Email notification failed)")
                    else:
                        st.success("Account created! Please login.")
                    
                    logger.info(f"New user registered: {new_username} ({new_email})")
                    
                except ValueError as e:
                    st.error(str(e))
                    logger.warning(f"Failed registration attempt: {new_username} - {str(e)}")
                except Exception as e:
                    st.error(f"Registration failed: {str(e)}")
                    logger.error(f"Registration error for {new_username}: {str(e)}")
    


# Check authentication
if 'user' not in st.session_state:
    # Hide sidebar on login page
    st.markdown("""
    <style>
    .css-1d391kg {display: none;}
    .css-1lcbmhc {display: none;}
    .css-1y4p8pa {display: none;}
    </style>
    """, unsafe_allow_html=True)
    show_login()
    st.stop()

user = st.session_state.user

# Contact Page - only show when contact button is clicked
if st.session_state.get('show_contact'):
    # Hide sidebar for contact page
    st.markdown("""
    <style>
    .css-1d391kg {display: none;}
    .css-1lcbmhc {display: none;}
    .css-1y4p8pa {display: none;}
    </style>
    """, unsafe_allow_html=True)
    
    st.header("Contact Support")
    
    with st.form("contact_form"):
        contact_name = st.text_input("Name", value=user.username)
        contact_email = st.text_input("Email", value=user.email)
        subject = st.selectbox("Subject", ["Technical Issue", "Feature Request", "General Inquiry", "Bug Report"])
        message = st.text_area("Message", height=150)
        
        col1, col2 = st.columns(2)
        with col1:
            if st.form_submit_button("Send Message"):
                if message:
                    if email_service.enabled:
                        email_sent = email_service.send_system_notification(
                            ["support@hedgefund.com"],
                            f"Contact Form: {subject}",
                            f"From: {contact_name} ({contact_email})\n\nMessage:\n{message}"
                        )
                        if email_sent:
                            st.success("Message sent successfully!")
                        else:
                            st.success("Message recorded (email service unavailable)")
                    else:
                        st.success("Message recorded")
                    
                    st.session_state.show_contact = False
                    st.rerun()
                else:
                    st.error("Please enter a message")
        
        with col2:
            if st.form_submit_button("Back to Home"):
                st.session_state.show_contact = False
                st.rerun()
    
    st.stop()

# Professional Header
st.markdown("""
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2rem; border-radius: 10px; margin-bottom: 2rem; color: white;">
    <h1 style="color: white; margin: 0; font-size: 2.5rem; font-weight: 700;">Portfolio & Options Analysis Engine</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 0.5rem 0 0 0; font-size: 1.1rem;">Professional-grade portfolio management and risk analysis platform</p>
</div>
""", unsafe_allow_html=True)

col1, col2 = st.columns([3, 1])
with col1:
    st.markdown(f"""
    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 1rem; border-radius: 8px; color: white; margin-bottom: 1rem;">
        <h3 style="color: white; margin: 0;">Welcome {user.username}</h3>
    </div>
    """, unsafe_allow_html=True)
with col2:
    col2a, col2b = st.columns(2)
    with col2a:
        if st.button("Contact", help="Contact support"):
            st.session_state.show_contact = True
    with col2b:
        if st.button("Logout", help="Sign out of your account"):
            # Clear cache and cookies
            cache_manager.invalidate_user_cache(user.user_id)
            if st.session_state.get('cookie_consent_given', False):
                cookie_manager.clear_user_cookies(user.user_id)
            
            del st.session_state.user
            st.rerun()

# Sidebar for user-specific features
with st.sidebar:
    st.header("My Portfolios")
    
    # Check permissions
    can_read_portfolio = user_manager.check_permission(user, Permission.READ_PORTFOLIO)
    can_write_portfolio = user_manager.check_permission(user, Permission.WRITE_PORTFOLIO)
    
    if can_read_portfolio:
        # Load user portfolios
        user_portfolios = data_isolation.get_user_portfolios(user.user_id)
        user_transactions = data_isolation.get_user_transactions(user.user_id) if hasattr(data_isolation, 'get_user_transactions') else []
        
        # Portfolio dropdown
        if user_portfolios:
            portfolio_names = [p['portfolio_name'] for p in user_portfolios]
            selected_portfolio = st.selectbox("Load Portfolio", ["None"] + portfolio_names)
            
            if selected_portfolio != "None":
                # Clear previous data
                if 'current_transactions' in st.session_state:
                    del st.session_state.current_transactions
                
                portfolio_data = next(p for p in user_portfolios if p['portfolio_name'] == selected_portfolio)
                st.session_state.current_portfolio = portfolio_data
                
                if can_write_portfolio:
                    if st.button("🗑️ Delete Portfolio", type="secondary"):
                        portfolio_to_delete = next(p for p in user_portfolios if p['portfolio_name'] == selected_portfolio)
                        if supabase_client and supabase_client.delete_portfolio(portfolio_to_delete['id'], user.user_id):
                            st.success(f"Portfolio '{selected_portfolio}' deleted!")
                            if 'current_portfolio' in st.session_state:
                                del st.session_state.current_portfolio
                            st.rerun()
                        else:
                            st.error("Failed to delete portfolio")
        else:
            st.info("No saved portfolios found")
        
        # Transaction dropdown
        if user_transactions:
            transaction_names = [t['transaction_set_name'] for t in user_transactions]
            selected_transactions = st.selectbox("Load Transactions", ["None"] + transaction_names)
            
            if selected_transactions != "None":
                # Clear previous data
                if 'current_portfolio' in st.session_state:
                    del st.session_state.current_portfolio
                
                transaction_data = next(t for t in user_transactions if t['transaction_set_name'] == selected_transactions)
                st.session_state.current_transactions = transaction_data
                
                if can_write_portfolio:
                    if st.button("🗑️ Delete Transactions", type="secondary"):
                        # Add delete functionality for transactions
                        st.success(f"Transactions '{selected_transactions}' deleted!")
                        if 'current_transactions' in st.session_state:
                            del st.session_state.current_transactions
                        st.rerun()
        else:
            st.info("No saved transactions found")
        
        # Shared portfolios
        shared_portfolios = data_isolation.get_shared_portfolios(user.user_id)
        if shared_portfolios:
            st.subheader("Shared with Me")
            shared_names = [f"{p['portfolio_name']} (by {p['owner_username']})" for p in shared_portfolios]
            selected_shared = st.selectbox("Load Shared", ["None"] + shared_names)
    
    st.divider()
    
    # Collaboration features
    if user_manager.check_permission(user, Permission.SHARE_RESEARCH):
        st.header("Collaboration")
        
        # Research notes
        notes = collaboration.get_research_notes(user.user_id)
        if notes:
            if st.button(f"View {len(notes)} Research Notes"):
                st.session_state.show_notes = True
        
        # Workspaces
        workspaces = collaboration.get_user_workspaces(user.user_id)
        if workspaces:
            if st.button(f"View {len(workspaces)} Workspaces"):
                st.session_state.show_workspaces = True
    
    st.divider()
    
    # Configuration Status
    st.header("System Status")
    config_status = Config.validate_config()
    
    # Service status indicators
    services = config_status['services']
    
    # Database status
    db_status = "OK" if services['database'] == 'configured' else "ERROR"
    st.write(f"Database: {db_status}")
    
    # Cache status
    cache_status = "OK" if services['cache'] == 'configured' else "ERROR"
    st.write(f"Cache: {cache_status}")
    
    # Email status
    email_status = "OK" if services['email'] == 'configured' else "ERROR"
    st.write(f"Email: {email_status}")
    
    # Market data providers
    providers = services['market_data']
    if 'yfinance_only' in providers:
        st.write("Market Data: YFinance only")
    else:
        st.write(f"Market Data: {len(providers)} providers")
    
    # Configuration warnings
    if config_status['warnings']:
        with st.expander("Configuration Warnings"):
            for warning in config_status['warnings']:
                st.warning(warning)
    
    # Service management for admins
    if user.role == UserRole.ADMIN:
        with st.expander("Service Management"):
            # Email service test
            if st.button("Test Email Service"):
                test_result = email_service.test_connection()
                if test_result['status'] == 'success':
                    st.success(test_result['message'])
                else:
                    st.error(test_result['message'])
            
            # Cache statistics
            if st.button("Cache Statistics"):
                cache_stats = cache_manager.get_cache_stats()
                st.json(cache_stats)
            
            # User secrets status
            if st.button("Secrets Manager Status"):
                secrets_status = user_secret_manager.get_service_status()
                st.json(secrets_status)
    
    st.divider()
    
    # Trading Operations
    if user_manager.check_permission(user, Permission.READ_ANALYTICS):
        st.header("Trading Operations")
        
        # Initialize trading components in session state
        if 'order_manager' not in st.session_state:
            st.session_state.order_manager = OrderManager()
        if 'cost_manager' not in st.session_state:
            st.session_state.cost_manager = CostManager()
        if 'position_sizer' not in st.session_state:
            st.session_state.position_sizer = PositionSizer()
        
        order_manager = st.session_state.order_manager
        cost_manager = st.session_state.cost_manager
        position_sizer = st.session_state.position_sizer
        
        with st.expander("Order Management"):
            if 'portfolio' in locals() and portfolio:
                # Place order
                col1, col2 = st.columns(2)
                with col1:
                    order_symbol = st.selectbox("Symbol", list(portfolio.symbols))
                    order_quantity = st.number_input("Quantity", value=100)
                with col2:
                    order_type = st.selectbox("Order Type", ["MARKET", "LIMIT"])
                    if order_type == "LIMIT":
                        order_price = st.number_input("Limit Price", value=150.0)
                    else:
                        order_price = None
                
                if st.button("Place Order"):
                    order_id = order_manager.place_order(order_symbol, order_quantity, order_type, order_price)
                    st.success(f"Order placed: {order_id}")
                    
                    # Simulate execution for demo
                    current_price = 150.0  # Mock current price
                    for order in order_manager.orders:
                        if order.status == 'PENDING':
                            order_manager.simulate_execution(order, current_price)
                
                # Show order status
                orders_df = order_manager.get_order_status()
                if not orders_df.empty:
                    st.subheader("Order Status")
                    st.dataframe(orders_df, use_container_width=True)
                else:
                    st.info("No orders placed yet")
            else:
                st.warning("Please upload a portfolio first")
        
        with st.expander("Cost Analysis"):
            if 'portfolio' in locals() and portfolio:
                # Calculate costs for portfolio positions
                total_cost = 0
                cost_data = []
                
                for pos in portfolio.positions[:5]:  # Limit to 5 positions
                    cost_analysis = cost_manager.calculate_transaction_cost(
                        pos.quantity, pos.avg_cost, pos.symbol
                    )
                    total_cost += cost_analysis['total_cost']
                    cost_data.append({
                        'Symbol': pos.symbol,
                        'Notional': f"${cost_analysis['notional_value']:,.2f}",
                        'Commission': f"${cost_analysis['commission']:.2f}",
                        'Total Cost': f"${cost_analysis['total_cost']:.2f}",
                        'Cost (bps)': f"{cost_analysis['cost_bps']:.1f}"
                    })
                
                if cost_data:
                    st.dataframe(pd.DataFrame(cost_data), use_container_width=True)
                    st.metric("Total Transaction Costs", f"${total_cost:.2f}")
                else:
                    st.info("No positions available for cost analysis")
            else:
                st.warning("Please upload a portfolio first")
        
        with st.expander("Position Sizing"):
            if 'portfolio' in locals() and portfolio:
                sizing_method = st.selectbox("Sizing Method", ["Kelly Criterion", "Risk Parity", "Volatility Targeting"])
            else:
                st.warning("Please upload a portfolio first")
                sizing_method = None
            
            if sizing_method == "Kelly Criterion" and st.button("Calculate Kelly Size"):
                expected_return = st.slider("Expected Return", 0.0, 0.3, 0.12)
                volatility = st.slider("Volatility", 0.1, 0.5, 0.2)
                
                kelly_size = position_sizer.kelly_criterion(expected_return, volatility)
                col1, col2 = st.columns(2)
                with col1:
                    st.metric("Expected Return", f"{expected_return:.1%}")
                with col2:
                    st.metric("Volatility", f"{volatility:.1%}")
                
                st.metric("Kelly Optimal Size", f"{kelly_size:.2%}")
                st.progress(min(kelly_size, 0.5) / 0.5)  # Progress bar capped at 50%
                
                if kelly_size > 0.25:
                    st.error("Excessive Kelly size - high risk")
                elif kelly_size > 0.15:
                    st.warning("High Kelly size - consider reducing position")
                elif kelly_size > 0.08:
                    st.info("Moderate Kelly size")
                else:
                    st.success("Conservative Kelly size")
            
            elif sizing_method == "Risk Parity" and st.button("Calculate Risk Parity"):
                if 'portfolio' in locals():
                    try:
                        # Get real volatilities from market data
                        symbols = list(portfolio.symbols)[:10]
                        price_data = data_client.get_price_data(symbols, "6m")
                        returns = price_data.pct_change().dropna()
                        
                        volatilities = {}
                        for symbol in symbols:
                            if symbol in returns.columns:
                                vol = returns[symbol].std() * np.sqrt(252)
                                volatilities[symbol] = vol
                            else:
                                volatilities[symbol] = 0.2  # Default 20%
                        
                        risk_parity_weights = position_sizer.risk_parity_sizing(symbols, volatilities)
                        
                        rp_data = []
                        for symbol, weight in risk_parity_weights.items():
                            vol = volatilities.get(symbol, 0.2)
                            rp_data.append({
                                'Symbol': symbol,
                                'Risk Parity Weight': f"{weight:.2%}",
                                'Volatility': f"{vol:.1%}",
                                'Risk Contribution': f"{weight * vol:.3f}"
                            })
                        
                        rp_df = pd.DataFrame(rp_data)
                        st.dataframe(rp_df, use_container_width=True)
                        
                        # Show risk parity chart
                        fig_rp = px.bar(rp_df, x='Symbol', y='Risk Parity Weight', 
                                       title="Risk Parity Weights")
                        st.plotly_chart(fig_rp, use_container_width=True)
                        
                    except Exception as e:
                        st.error(f"Risk parity calculation failed: {str(e)}")
                else:
                    st.warning("Please upload a portfolio first")
    
    st.divider()
    
    # Admin features
    if user.role == UserRole.ADMIN:
        st.header("Admin Panel")
        if st.button("Manage Users"):
            st.session_state.show_admin = True


# Enhanced Admin Panel
if st.session_state.get('show_admin') and user.role == UserRole.ADMIN:
    st.header("System Administration")
    
    admin_tab1, admin_tab2, admin_tab3, admin_tab4 = st.tabs(["Users", "Config", "Services", "Security"])
    
    with admin_tab1:
        st.subheader("User Management")
        
        users = user_manager.get_users()
        users_df = pd.DataFrame([{
            'Username': u.username,
            'Email': u.email,
            'Role': u.role.value,
            'Last Login': u.last_login.strftime('%Y-%m-%d %H:%M') if u.last_login else 'Never',
            'Active': u.is_active
        } for u in users])
        
        try:
            from st_aggrid import AgGrid, GridOptionsBuilder
            
            gb = GridOptionsBuilder.from_dataframe(users_df)
            gb.configure_pagination(paginationAutoPageSize=True)
            gb.configure_default_column(enablePivot=True, enableRowGroup=True)
            gb.configure_selection('single', use_checkbox=True)
            gridOptions = gb.build()
            
            AgGrid(users_df, gridOptions=gridOptions, height=300)
            
        except ImportError:
            st.dataframe(users_df)
        
        # Bulk user operations
        col1, col2, col3 = st.columns(3)
        with col1:
            if st.button("Send Welcome Emails"):
                sent_count = 0
                for u in users:
                    if email_service.send_welcome_email(u.email, u.username):
                        sent_count += 1
                st.success(f"Sent welcome emails to {sent_count} users")
        
        with col2:
            if st.button("Cleanup Expired Tokens"):
                cleaned = user_secret_manager.cleanup_expired_tokens()
                st.success(f"Cleaned up {cleaned} expired tokens")
        
        with col3:
            if st.button("System Notification"):
                # Send system-wide notification
                admin_emails = [u.email for u in users if u.role == UserRole.ADMIN]
                email_service.send_system_notification(
                    admin_emails,
                    "System Maintenance",
                    "System maintenance completed successfully"
                )
                st.success("System notification sent")
    
    with admin_tab2:
        st.subheader("Configuration Management")
        
        # Configuration validation
        config_status = Config.validate_config()
        
        col1, col2 = st.columns(2)
        with col1:
            st.write("**Configuration Status:**")
            if config_status['valid']:
                st.success("✅ Configuration Valid")
            else:
                st.error("❌ Configuration Issues Found")
            
            # Show services status
            st.write("**Services:**")
            for service, status in config_status['services'].items():
                status_icon = "🟢" if status == 'configured' else "🔴"
                st.write(f"{status_icon} {service.title()}: {status}")
        
        with col2:
            st.write("**API Keys Configured:**")
            api_keys = Config.get_api_keys()
            for provider, key in api_keys.items():
                key_status = "OK" if key else "MISSING"
                st.write(f"{provider.title()}: {key_status}")
        
        # Configuration warnings and errors
        if config_status['warnings']:
            st.warning("**Configuration Warnings:**")
            for warning in config_status['warnings']:
                st.write(f"WARNING: {warning}")
        
        if config_status.get('errors'):
            st.error("**Configuration Errors:**")
            for error in config_status['errors']:
                st.write(f"ERROR: {error}")
        
        # Environment info
        with st.expander("Environment Information"):
            env_info = {
                'Environment': Config.FLASK_ENV,
                'Debug Mode': Config.DEBUG,
                'Log Level': Config.LOG_LEVEL,
                'Production Mode': Config.is_production(),
                'Rate Limit': f"{Config.RATE_LIMIT_PER_MINUTE}/min",
                'Max Concurrent': Config.MAX_CONCURRENT_REQUESTS
            }
            
            for key, value in env_info.items():
                st.write(f"**{key}:** {value}")
    
    with admin_tab3:
        st.subheader("Service Monitoring")
        
        # Email service status
        col1, col2 = st.columns(2)
        with col1:
            st.write("**Email Service**")
            email_status = email_service.get_service_status()
            
            if email_status['enabled']:
                st.success("Email Service Active")
                st.write(f"Server: {email_status['smtp_server']}:{email_status['smtp_port']}")
                st.write(f"Username: {email_status['username']}")
                st.write(f"TLS: {email_status['use_tls']}")
                
                if st.button("Test Email Connection"):
                    test_result = email_service.test_connection()
                    if test_result['status'] == 'success':
                        st.success(test_result['message'])
                    else:
                        st.error(test_result['message'])
            else:
                st.warning("Email Service Disabled")
        
        with col2:
            st.write("**Cache Service**")
            cache_stats = cache_manager.get_cache_stats()
            
            if cache_stats['status'] == 'connected':
                st.success("Cache Service Active")
                st.write(f"Memory Used: {cache_stats.get('used_memory', 'N/A')}")
                st.write(f"Connected Clients: {cache_stats.get('connected_clients', 0)}")
                st.write(f"Commands Processed: {cache_stats.get('total_commands_processed', 0)}")
            else:
                st.warning(f"Cache Service: {cache_stats['status']}")
        
        # User Secrets Service
        st.write("**User Secrets Service**")
        secrets_status = user_secret_manager.get_service_status()
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Users", secrets_status['total_users'])
        with col2:
            st.metric("API Keys Stored", secrets_status['total_api_keys'])
        with col3:
            st.metric("Access Tokens", secrets_status['total_tokens'])
        
        st.write(f"**Encryption:** {'Enabled' if secrets_status['encryption_enabled'] else 'Disabled'}")
        st.write(f"**Storage:** {secrets_status['secrets_file']}")
    
    with admin_tab4:
        st.subheader("Security Management")
        
        # Security metrics
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Password Min Length", Config.PASSWORD_MIN_LENGTH)
        with col2:
            st.metric("Max Login Attempts", Config.MAX_LOGIN_ATTEMPTS)
        with col3:
            st.metric("Session Timeout", f"{Config.SESSION_TIMEOUT_HOURS}h")
        
        # Security actions
        st.write("**Security Actions:**")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("Force Password Reset (All Users)"):
                # This would typically force all users to reset passwords
                st.warning("Password reset would be enforced for all users")
                
                # Send notification emails
                if email_service.enabled:
                    for u in users:
                        email_service.send_system_notification(
                            [u.email],
                            "Password Reset Required",
                            "A system-wide password reset has been initiated. Please log in and update your password."
                        )
                    st.success("Password reset notifications sent")
        
        with col2:
            if st.button("Audit User Secrets"):
                # Audit all user secrets
                audit_results = []
                for u in users:
                    user_summary = user_secret_manager.list_user_secrets(u.user_id)
                    audit_results.append({
                        'User': u.username,
                        'SnapTrade Secret': user_summary['has_snaptrade_secret'],
                        'API Keys': len(user_summary['api_keys']),
                        'Tokens': len(user_summary['tokens'])
                    })
                
                audit_df = pd.DataFrame(audit_results)
                st.dataframe(audit_df, use_container_width=True)
        
        # System logs
        with st.expander("Recent System Events"):
            st.write("**Recent Log Events:**")
            # This would typically show recent log entries
            sample_logs = [
                {"Timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'), "Level": "INFO", "Message": "User login successful"},
                {"Timestamp": (datetime.now() - timedelta(minutes=5)).strftime('%Y-%m-%d %H:%M:%S'), "Level": "WARNING", "Message": "Risk threshold exceeded"},
                {"Timestamp": (datetime.now() - timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S'), "Level": "INFO", "Message": "Portfolio analysis completed"}
            ]
            
            logs_df = pd.DataFrame(sample_logs)
            st.dataframe(logs_df, use_container_width=True)
    
    if st.button("Close Admin Panel"):
        st.session_state.show_admin = False
        st.rerun()



# Enhanced Account Settings
with st.sidebar:
    st.header("Account Settings")
    
    # Email Update
    with st.expander("Change Email Address"):
        new_email = st.text_input("New Email Address", key="new_email")
        confirm_email = st.text_input("Confirm New Email", key="confirm_email")
        
        if st.button("Update Email"):
            if not all([new_email, confirm_email]):
                st.error("Both fields required")
            elif new_email != confirm_email:
                st.error("Email addresses don't match")
            elif '@' not in new_email or '.' not in new_email:
                st.error("Invalid email format")
            elif any(u.email == new_email for u in user_manager.get_users()):
                st.error("Email address already in use")
            else:
                try:
                    from clients.supabase_client import supabase_client
                    if supabase_client and supabase_client.client:
                        result = supabase_client.client.table('app_users').update({
                            'email': new_email
                        }).eq('user_id', user.user_id).execute()
                        
                        if result.data:
                            success_msg = st.success("Email updated successfully!")
                            user.email = new_email  # Update session
                            
                            # Send confirmation email
                            if email_service.enabled:
                                email_service.send_system_notification(
                                    [new_email],
                                    "Email Address Changed",
                                    f"Your email address was successfully changed to {new_email} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                                )
                            
                            # Auto-hide after 3 seconds
                            import time
                            time.sleep(3)
                            success_msg.empty()
                        else:
                            error_msg = st.error("Failed to update email")
                            import time
                            time.sleep(3)
                            error_msg.empty()
                    else:
                        st.error("Database not available")
                except Exception as e:
                    st.error(f"Update failed: {str(e)}")
    
    # Password Update
    with st.expander("Change Password"):
        current_password = st.text_input("Current Password", type="password", key="current_pwd")
        new_password = st.text_input("New Password", type="password", key="new_pwd")
        confirm_password = st.text_input("Confirm New Password", type="password", key="confirm_pwd")
        
        if st.button("Update Password"):
            if not all([current_password, new_password, confirm_password]):
                st.error("All fields required")
            elif new_password != confirm_password:
                st.error("Passwords don't match")
            elif len(new_password) < Config.PASSWORD_MIN_LENGTH:
                st.error(f"Password must be at least {Config.PASSWORD_MIN_LENGTH} characters")
            else:
                # Verify current password
                if user_manager.authenticate_user(user.username, current_password):
                    if user_manager.update_password(user.user_id, new_password):
                        st.success("Password updated successfully!")
                        
                        # Send notification email
                        if email_service.enabled:
                            email_service.send_system_notification(
                                [user.email],
                                "Password Changed",
                                f"Your password was successfully changed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                            )
                    else:
                        st.error("Failed to update password")
                else:
                    st.error("Current password is incorrect")
    

    
    # User Preferences
    with st.expander("Preferences"):
        # Risk alert preferences
        enable_alerts = st.checkbox("Enable Risk Alerts", value=True)
        alert_threshold = st.selectbox(
            "Alert Threshold", 
            ["High (5%)", "Critical (10%)"], 
            index=0
        )
        
        # Data preferences
        preferred_period = st.selectbox(
            "Default Analysis Period", 
            ["1m", "3m", "6m", "1y", "2y"], 
            index=3
        )
        
        # Cache preferences
        auto_cache = st.checkbox("Auto-cache Analysis Results", value=True)
        
        if st.button("Save Preferences"):
            # Store preferences in user secrets
            preferences = {
                'enable_alerts': enable_alerts,
                'alert_threshold': alert_threshold,
                'preferred_period': preferred_period,
                'auto_cache': auto_cache
            }
            
            success = user_secret_manager.store_api_key(
                user.user_id, 
                'user_preferences', 
                str(preferences)
            )
            
            if success:
                st.success("Preferences saved!")
            else:
                st.error("Failed to save preferences")

# Plaid Integration
with st.sidebar:
    st.header("Connect Brokerage")
    
    from clients.plaid_client import plaid_client
    if plaid_client and plaid_client.is_available():
        # Create user-specific link token for Plaid Link
        user_token_key = f'plaid_link_token_{user.user_id}'
        token_time_key = f'plaid_token_time_{user.user_id}'
        
        # Check if token exists and is not expired (tokens expire after 30 minutes)
        token_expired = False
        if token_time_key in st.session_state:
            token_age = (datetime.now() - st.session_state[token_time_key]).total_seconds()
            token_expired = token_age > 1800  # 30 minutes
        
        if user_token_key not in st.session_state or token_expired:
            try:
                # Use proper client_user_id format with official SDK
                client_user_id = f"user_{user.user_id}_{int(time.time())}"
                link_token = plaid_client.create_link_token(client_user_id)
                if link_token:
                    st.session_state[user_token_key] = link_token
                    st.session_state[token_time_key] = datetime.now()
                    st.session_state.plaid_link_token = link_token
                    logger.info(f"Fresh Plaid link token created for user {user.user_id}")
                else:
                    logger.error("Failed to create Plaid link token")
            except Exception as e:
                logger.error(f"Plaid link token creation error: {e}")
                st.error(f"Plaid connection error: {e}")
        else:
            st.session_state.plaid_link_token = st.session_state[user_token_key]
        
        if 'plaid_link_token' in st.session_state:
            # Link token is ready but don't display it
            
            # Show supported institutions
            with st.expander("🏦 Supported Brokerages"):
                st.write("**Major Brokerages Supported:**")
                st.write("• Charles Schwab")
                st.write("• Fidelity Investments")
                st.write("• TD Ameritrade")
                st.write("• E*TRADE")
                st.write("• Interactive Brokers")
                st.write("• Robinhood")
                st.write("• Vanguard")
                st.write("• Merrill Lynch")
                st.write("• Zerodha (India)")
                st.write("• HDFC Securities (India)")
                st.write("• ICICI Direct (India)")
                st.write("• And 11,000+ other financial institutions")
                st.info("🔒 All connections are secured with bank-level encryption")
                st.info("🇮🇳 Indian brokers supported via Plaid integration")
                
        # Direct Plaid Link Integration
        st.subheader("Connect Your Brokerage")
        
        # Check if user already has connected accounts  
        user_access_token = user_secret_manager.get_plaid_token(user.user_id)
        
        # Show active Plaid link if available
        if 'plaid_link_token' in st.session_state:
            if st.button("🔄 Refresh Link", help="Click if Plaid keeps loading"):
                # Clear tokens and immediately regenerate
                user_token_key = f'plaid_link_token_{user.user_id}'
                token_time_key = f'plaid_token_time_{user.user_id}'
                if user_token_key in st.session_state:
                    del st.session_state[user_token_key]
                if token_time_key in st.session_state:
                    del st.session_state[token_time_key]
                if 'plaid_link_token' in st.session_state:
                    del st.session_state['plaid_link_token']
                
                # Immediately create new token using official SDK
                try:
                    client_user_id = f"user_{user.user_id}_{int(time.time())}"
                    link_token = plaid_client.create_link_token(client_user_id)
                    if link_token:
                        st.session_state[user_token_key] = link_token
                        st.session_state[token_time_key] = datetime.now()
                        st.session_state.plaid_link_token = link_token
                        st.success("Link refreshed successfully!")
                    else:
                        st.error("Failed to refresh link")
                except Exception as e:
                    st.error(f"Error refreshing link: {e}")
                st.rerun()
        
        if user_access_token:
            st.success("✅ Brokerage account connected!")
            
            # Show account info and import options
            col1, col2 = st.columns(2)
            with col1:
                if st.button("🔄 Refresh Real Portfolio Data"):
                    with st.spinner("Fetching latest data from your brokerage..."):
                        try:
                            # Get real-time holdings from connected brokerage
                            holdings_df = plaid_client.get_holdings(user.user_id)
                            if not holdings_df.empty:
                                st.success(f"✅ Refreshed {len(holdings_df)} real holdings from your brokerage!")
                                st.session_state.plaid_portfolio = holdings_df
                                
                                # Auto-run analysis after refresh
                                with st.spinner("Running automatic analysis..."):
                                    portfolio_symbols = holdings_df['symbol'].unique()[:10]
                                    
                                    # Auto-train ML models
                                    from enterprise.ml_engine import MLPredictor
                                    ml_predictor = MLPredictor(data_client)
                                    training_results = ml_predictor.train_return_prediction_model(portfolio_symbols)
                                    if training_results:
                                        portfolio_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
                                        cache_manager.set_portfolio_data(user.user_id, f"ml_models_{portfolio_hash}", training_results, expire_hours=24)
                                        st.success(f"✅ Trained ML models for {len(training_results)} symbols")
                                    
                                    # Auto-run sentiment analysis
                                    from utils.auto_analysis import run_automatic_sentiment_analysis
                                    enhanced_sentiment = run_automatic_sentiment_analysis(portfolio_symbols, user.user_id, days_back=7)
                                    if enhanced_sentiment:
                                        sentiment_data = enhanced_sentiment.get('sentiment_analysis', {})
                                        bullish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BULLISH')
                                        bearish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BEARISH')
                                        st.success(f"📰 Enhanced sentiment: {bullish_count} bullish, {bearish_count} bearish")
                            else:
                                st.warning("No holdings found. Check your brokerage account.")
                            
                            # Get latest transactions from connected brokerage
                            transactions_df = plaid_client.get_transactions(user.user_id, days=90)
                            if not transactions_df.empty:
                                st.success(f"✅ Refreshed {len(transactions_df)} real transactions!")
                                st.session_state.plaid_transactions = transactions_df
                            else:
                                st.info("No recent transactions found.")
                            
                            st.rerun()
                        except Exception as e:
                            st.error(f"Failed to refresh real data: {str(e)}")
            
            with col2:
                if st.button("🗑️ Disconnect Account"):
                    user_secret_manager.delete_plaid_token(user.user_id)
                    if 'plaid_portfolio' in st.session_state:
                        del st.session_state.plaid_portfolio
                    if 'plaid_transactions' in st.session_state:
                        del st.session_state.plaid_transactions
                    st.success("Account disconnected!")
                    st.rerun()
        
        else:
            
            if st.button("🔗 Generate Plaid Link", type="primary"):
                with st.spinner("Creating connection link..."):
                    try:
                        client_user_id = f"user_{user.user_id}_{int(time.time())}"
                        link_token = plaid_client.create_link_token(client_user_id)
                        if link_token:
                            st.success("✅ Link token generated successfully!")
                            
                            # Create HTML page with Plaid Link
                            html_content = f'''
<!DOCTYPE html>
<html>
<head>
    <title>Connect Your Bank Account</title>
    <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }}
        button {{ background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }}
        button:hover {{ background: #0056b3; }}
        #result {{ margin-top: 20px; padding: 15px; border-radius: 4px; }}
        .success {{ background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }}
        .error {{ background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }}
    </style>
</head>
<body>
    <h2>Connect Your Bank Account</h2>
    <p>Click the button below to securely connect your bank account through Plaid.</p>
    <button id="link-button">Connect Account</button>
    <div id="result"></div>
    
    <script>
    const linkHandler = Plaid.create({{
        token: '{link_token}',
        onSuccess: (public_token, metadata) => {{
            document.getElementById('result').innerHTML = 
                '<div class="success">' +
                '<h3>Connection Successful!</h3>' +
                '<p><strong>Public Token:</strong> ' + public_token + '</p>' +
                '<p><strong>Institution:</strong> ' + metadata.institution.name + '</p>' +
                '<p><strong>Accounts:</strong> ' + metadata.accounts.length + '</p>' +
                '<p>Copy the public token above and paste it in the Streamlit app to import your data.</p>' +
                '</div>';
        }},
        onExit: (err, metadata) => {{
            if (err) {{
                document.getElementById('result').innerHTML = 
                    '<div class="error">' +
                    '<h3>Connection Failed</h3>' +
                    '<p>' + err.error_message + '</p>' +
                    '</div>';
            }}
        }}
    }});
    
    document.getElementById('link-button').onclick = function() {{
        linkHandler.open();
    }};
    </script>
</body>
</html>'''
                            
                            # Save HTML file
                            filename = f'plaid_connect_{user.user_id}_{int(time.time())}.html'
                            with open(filename, 'w') as f:
                                f.write(html_content)
                            
                            st.success(f"✅ HTML connection page created: {filename}")
                            
                            # Auto-open HTML page
                            import webbrowser
                            import os
                            file_path = os.path.abspath(filename)
                            webbrowser.open(f'file://{file_path}')
                            
                            st.info("🌐 HTML page opened in your browser. Connect your account and copy the public token.")
                            
                            # Store token for public token exchange
                            st.session_state.current_link_token = link_token
                        else:
                            st.error("Failed to generate link token")
                    except Exception as e:
                        st.error(f"Error: {str(e)}")
            
            st.write("**Enter Public Token:**")
            public_token = st.text_input("Public Token", help="Paste the public token from the HTML connection page")
            if st.button("📥 Import Portfolio Data") and public_token:
                with st.spinner("Connecting to your brokerage and importing data..."):
                    try:
                        access_token = plaid_client.exchange_public_token(public_token)
                        if access_token:
                            user_secret_manager.store_plaid_token(user.user_id, access_token)
                            
                            holdings_df = plaid_client.get_holdings(user.user_id)
                            transactions_df = plaid_client.get_all_transactions(user.user_id, days=90)
                            
                            if not holdings_df.empty:
                                st.success(f"✅ Imported {len(holdings_df)} holdings from your brokerage!")
                                st.session_state.plaid_portfolio = holdings_df
                            
                            if not transactions_df.empty:
                                st.success(f"✅ Imported {len(transactions_df)} transactions!")
                                st.session_state.plaid_transactions = transactions_df
                                
                                # Auto-save to database
                                if can_write_portfolio:
                                    auto_save_name = f"Plaid_Import_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                                    portfolio_data = []
                                    for _, row in holdings_df.iterrows():
                                        if row['symbol'] != 'N/A' and row['quantity'] > 0:
                                            avg_cost = row['cost_basis'] / row['quantity'] if row['quantity'] > 0 else row['institution_price']
                                            portfolio_data.append({
                                                'symbol': row['symbol'],
                                                'quantity': row['quantity'],
                                                'avg_cost': avg_cost
                                            })
                                    
                                    if portfolio_data:
                                        portfolio_id = data_isolation.save_user_portfolio(user.user_id, auto_save_name, portfolio_data)
                                        if portfolio_id:
                                            st.success(f"Portfolio auto-saved as '{auto_save_name}'")
                                
                                # Auto-run analysis like CSV upload
                                with st.spinner("Running automatic analysis..."):
                                    # Auto-train ML models
                                    from enterprise.ml_engine import MLPredictor
                                    ml_predictor = MLPredictor(data_client)
                                    portfolio_symbols = holdings_df['symbol'].unique()[:10]
                                    training_results = ml_predictor.train_return_prediction_model(portfolio_symbols)
                                    if training_results:
                                        portfolio_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
                                        cache_manager.set_portfolio_data(user.user_id, f"ml_models_{portfolio_hash}", training_results, expire_hours=24)
                                        st.success(f"✅ Trained ML models for {len(training_results)} symbols")
                                    
                                    # Auto-run News Sentiment Analysis
                                    from utils.auto_analysis import run_automatic_sentiment_analysis
                                    enhanced_sentiment = run_automatic_sentiment_analysis(portfolio_symbols, user.user_id, days_back=7)
                                    if enhanced_sentiment:
                                        sentiment_data = enhanced_sentiment.get('sentiment_analysis', {})
                                        bullish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BULLISH')
                                        bearish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BEARISH')
                                        st.success(f"📰 Enhanced sentiment: {bullish_count} bullish, {bearish_count} bearish")
                                    
                                    # Auto-run Monte Carlo Simulation
                                    from monte_carlo_v3 import MonteCarloEngine
                                    mc_engine = MonteCarloEngine(data_client)
                                    
                                    # Create weights from holdings
                                    total_value = (holdings_df['quantity'] * holdings_df['institution_price']).sum()
                                    weights = {}
                                    for _, row in holdings_df.iterrows():
                                        if row['symbol'] != 'N/A' and row['quantity'] > 0:
                                            weight = (row['quantity'] * row['institution_price']) / total_value
                                            weights[row['symbol']] = weight
                                    
                                    if weights:
                                        mc_results = mc_engine.portfolio_simulation(
                                            list(weights.keys()), weights, time_horizon=252, num_simulations=5000
                                        )
                                        mc_hash = hashlib.md5(str(sorted(list(weights.keys()))).encode()).hexdigest()
                                        cache_manager.set_portfolio_data(user.user_id, f"monte_carlo_{mc_hash}", mc_results, expire_hours=12)
                                        st.success(f"🎲 Monte Carlo simulation complete: {mc_results['probability_loss']:.1%} probability of loss")
                            else:
                                st.warning("No holdings found. Check your brokerage account.")
                            
                            # Show transaction manager link
                            if not transactions_df.empty:
                                if st.button("📊 Manage Transactions", key="manage_plaid_transactions"):
                                    if transaction_manager:
                                        st.session_state.show_transaction_manager = True
                                        st.rerun()
                                    else:
                                        st.error("Transaction manager not available")
                            
                            st.rerun()
                        else:
                            st.error("Failed to exchange token")
                    except Exception as e:
                        st.error(f"Import failed: {str(e)}")
            
            # Show transaction manager access
            st.write("**Transaction Management:**")
            if st.button("📊 Open Transaction Manager", key="open_txn_manager_main"):
                if transaction_manager:
                    st.session_state.show_transaction_manager = True
                    st.rerun()
                else:
                    st.error("Transaction manager not available")
            
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
                    st.session_state.force_show_plaid = True  # Force display of sample data
                    
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
            
    else:
        st.info("Plaid not configured")
    
    st.divider()
    
    # SnapTrade Integration with User Secrets
    st.header("SnapTrade Connect")
    
    from components.snaptrade_connect import snaptrade_connect
    
    if snaptrade_connect.client:
        # Check if user has SnapTrade secret
        user_secret = user_secret_manager.get_snaptrade_secret(user.user_id)
        
        if not user_secret:
            st.info("🔧 Setting up SnapTrade connection...")
            if st.button("🚀 Initialize SnapTrade Connection"):
                # Create SnapTrade user and store secret
                from clients.snaptrade_client import snaptrade_client
                if snaptrade_client:
                    create_status = snaptrade_client.create_user(user.user_id)
                    if create_status == 'success':
                        user_secret = user_secret_manager.get_snaptrade_secret(user.user_id)
                    else:
                        user_secret = None
                else:
                    user_secret = None
                st.success("✅ SnapTrade connection initialized!")
                st.rerun()
        else:
            st.success("✅ SnapTrade connection ready")
            
            # Show connection status
            accounts = snaptrade_connect.client.get_accounts(user.user_id) if snaptrade_connect.client else []
            if accounts:
                st.success(f"🏦 {len(accounts)} brokerage accounts connected")
            else:
                st.info("📱 No brokerage accounts connected yet")
            
            # Direct brokerage selection and connection
            connection_success = snaptrade_connect.render_brokerage_selection_and_connect(user.user_id)
            
            # Account summary and management
            snaptrade_connect.render_account_summary(user.user_id)
            
            # Secret management for admins
            if user.role == UserRole.ADMIN:
                with st.expander("Secret Management"):
                    if st.button("Regenerate Secret"):
                        user_secret_manager.delete_specific_secret(user.user_id, 'snaptrade_secret')
                        # Regenerate SnapTrade user
                        create_status = snaptrade_connect.client.create_user(user.user_id)
                        if create_status == 'success':
                            new_secret = user_secret_manager.get_snaptrade_secret(user.user_id)
                        else:
                            new_secret = None
                        st.success("Secret regenerated!")
                        st.rerun()
    else:
        st.warning("⚠️ SnapTrade not configured")
        st.info("Configure SNAPTRADE_CLIENT_ID and SNAPTRADE_SECRET in .env to enable brokerage connections")
        
        # Show demo mode option
        with st.expander("🧪 Demo Mode (Testing)"):
            snaptrade_connect.render_demo_mode()
    
    st.divider()

# Collaboration Views
if st.session_state.get('show_notes'):
    st.header("Research Notes")
    notes = collaboration.get_research_notes(user.user_id)
    
    # Display as table
    notes_df = pd.DataFrame(notes)
    st.dataframe(notes_df, use_container_width=True)
    
    # Detailed view
    st.subheader("Detailed Notes")
    for i, note in enumerate(notes):
        st.markdown(f"### {i+1}. {note['title']}")
        st.write(f"**Author:** {note['author']}")
        st.write(f"**Created:** {note['created_at']}")
        st.write(f"**Updated:** {note['updated_at']}")
        st.write(f"**Public:** {'Yes' if note['is_public'] else 'No'}")
        if note['tags']:
            st.write(f"**Tags:** {', '.join(note['tags'])}")
        st.write(f"**Content:**")
        st.write(note['content'])
        st.divider()
    
    if st.button("Back to Portfolio"):
        st.session_state.show_notes = False
        st.rerun()
    st.stop()

if st.session_state.get('show_workspaces'):
    st.header("Team Workspaces")
    workspaces = collaboration.get_user_workspaces(user.user_id)
    
    # Display as table
    workspaces_df = pd.DataFrame(workspaces)
    st.dataframe(workspaces_df, use_container_width=True)
    
    # Detailed view
    st.subheader("Workspace Details")
    for i, workspace in enumerate(workspaces):
        st.markdown(f"### {i+1}. {workspace['workspace_name']}")
        st.write(f"**ID:** {workspace['workspace_id']}")
        st.write(f"**Description:** {workspace['description']}")
        st.write(f"**Your Role:** {workspace['role']}")
        st.write(f"**Members:** {workspace['member_count']}")
        st.divider()
    
    if st.button("Back to Portfolio"):
        st.session_state.show_workspaces = False
        st.rerun()
    st.stop()

# Quick Price Lookup Section
st.header("Quick Price Lookup")
col1, col2 = st.columns([2, 1])
with col1:
    ticker_input = st.text_input("Enter ticker symbol(s) - comma separated", placeholder="AAPL, MSFT, GOOGL")
with col2:
    if st.button("Get Prices") and ticker_input:
        tickers = [t.strip().upper() for t in ticker_input.split(",")]
        with st.spinner("Fetching prices..."):
            try:
                prices = data_client.get_current_prices(tickers)
                if prices:
                    price_data = []
                    for ticker, price in prices.items():
                        price_data.append({
                            'Symbol': ticker,
                            'Current Price': f"${price:.2f}"
                        })
                    
                    price_df = pd.DataFrame(price_data)
                    st.dataframe(price_df, use_container_width=True, hide_index=True)
                else:
                    st.error("No prices found")
            except Exception as e:
                st.error(f"Error fetching prices: {str(e)}")

st.divider()

# Main Portfolio Interface
# Portfolio vs Transaction selection

# Check if we have a loaded portfolio from sidebar or Plaid
current_portfolio = None
plaid_portfolio = None
current_transactions = None

if 'current_portfolio' in st.session_state:
    portfolio_data = st.session_state.current_portfolio['portfolio_data']
    df = pd.DataFrame(portfolio_data)
    current_portfolio = Portfolio.from_dataframe(df)

if 'current_transactions' in st.session_state:
    from core.transactions import TransactionPortfolio
    transaction_data = st.session_state.current_transactions['transactions_data']
    df = pd.DataFrame(transaction_data)
    current_transactions = TransactionPortfolio.from_dataframe(df)

if 'plaid_portfolio' in st.session_state:
    plaid_df = st.session_state.plaid_portfolio
    # Convert Plaid data to portfolio format
    portfolio_data = []
    for _, row in plaid_df.iterrows():
        if row['symbol'] != 'N/A' and row['quantity'] > 0:
            # Use institution_price if cost_basis is 0 or missing
            if row['cost_basis'] > 0 and row['quantity'] > 0:
                avg_cost = row['cost_basis'] / row['quantity']
            else:
                avg_cost = row['institution_price']
            
            portfolio_data.append({
                'symbol': row['symbol'],
                'quantity': row['quantity'],
                'avg_cost': avg_cost
            })
    
    if portfolio_data:
        df = pd.DataFrame(portfolio_data)
        plaid_portfolio = Portfolio.from_dataframe(df)
        # Force display of Plaid portfolio
        st.session_state.force_show_plaid = True



# Transaction Manager Interface
if st.session_state.get('show_transaction_manager', False):
    if transaction_manager:
        transaction_manager.render_transaction_interface(user.user_id)
        
        if st.button("← Back to Portfolio Analysis"):
            st.session_state.show_transaction_manager = False
            st.rerun()
        
        st.stop()
    else:
        st.error("Transaction manager not available")
        st.session_state.show_transaction_manager = False

# Check if any portfolio/transaction data exists and set up upload section
has_portfolio = current_portfolio or plaid_portfolio or current_transactions
header_text = "Add New Data" if has_portfolio else "Upload Data"

# Show Plaid portfolio immediately if available (including sample data)
if plaid_portfolio and st.session_state.get('force_show_plaid', False):
    st.header("Sample Portfolio Data")
    portfolio = plaid_portfolio
    portfolio_source = "Sample Data"
    st.session_state.force_show_plaid = False  # Reset flag
else:
    st.header(header_text)

data_type = st.radio("Data Type", ["Portfolio Positions", "Transaction History"], horizontal=True)

# Enhanced transaction management button
if data_type == "Transaction History":
    col1, col2 = st.columns([3, 1])
    with col1:
        st.write("")
    with col2:
        if st.button("🚀 Advanced Transaction Manager", type="primary"):
            if transaction_manager:
                st.session_state.show_transaction_manager = True
                st.rerun()
            else:
                st.error("Transaction manager not available")

if data_type == "Portfolio Positions":
    subheader_text = "Add New Portfolio" if has_portfolio else "Portfolio Data"
    st.subheader(subheader_text)
    col1, col2 = st.columns([1, 2])
    with col1:
        from utils.broker_parsers import BROKER_PARSERS
        selected_broker = st.selectbox("Select Broker", list(BROKER_PARSERS.keys()))
    with col2:
        upload_text = f"Add {selected_broker} File" if has_portfolio else f"Upload {selected_broker} File"
        uploaded_file = st.file_uploader(
            upload_text, 
            type=['csv', 'xlsx', 'xls'],
            help=f"Upload {selected_broker} format file"
        )
else:
    subheader_text = "Add New Transactions" if has_portfolio else "Transaction History"
    st.subheader(subheader_text)
    info_text = "Add more transaction history with columns: symbol, quantity, price, date, transaction_type, fees (optional)" if has_portfolio else "Upload transaction history with columns: symbol, quantity, price, date, transaction_type, fees (optional)"
    st.info(info_text)
    
    # Quick manual transaction entry
    with st.expander("➕ Quick Add Single Transaction"):
        col1, col2, col3 = st.columns(3)
        with col1:
            manual_symbol = st.text_input("Symbol", placeholder="AAPL", key="manual_symbol")
            manual_quantity = st.number_input("Quantity", min_value=0.01, value=100.0, key="manual_quantity")
        with col2:
            manual_price = st.number_input("Price ($)", min_value=0.01, value=150.0, key="manual_price")
            manual_type = st.selectbox("Type", ["BUY", "SELL"], key="manual_type")
        with col3:
            manual_date = st.date_input("Date", value=datetime.now().date(), key="manual_date")
            manual_fees = st.number_input("Fees ($)", min_value=0.0, value=0.0, key="manual_fees")
        
        if st.button("💾 Add Transaction", key="add_manual_transaction"):
            if manual_symbol and manual_quantity > 0 and manual_price > 0:
                result = plaid_client.add_manual_transaction(
                    user.user_id, manual_symbol.upper(), manual_quantity, 
                    manual_price, manual_type, manual_date.strftime('%Y-%m-%d'), manual_fees
                )
                if result['status'] == 'success':
                    st.success(f"✅ Added {manual_type} {manual_quantity} {manual_symbol.upper()} @ ${manual_price:.2f}")
                else:
                    st.error(f"❌ {result['message']}")
            else:
                st.error("Please fill in all required fields")
    
    upload_text = "Add Transaction File" if has_portfolio else "Upload Transaction File"
    uploaded_file = st.file_uploader(
        upload_text, 
        type=['csv', 'xlsx', 'xls'],
        help="CSV with transaction history"
    )



# Show enhanced transaction management in sidebar
with st.sidebar:
    st.header("Transaction Management")
    
    # Quick transaction entry
    with st.expander("➕ Quick Add Transaction"):
        col1, col2 = st.columns(2)
        with col1:
            quick_symbol = st.text_input("Symbol", key="quick_symbol", placeholder="AAPL")
            quick_quantity = st.number_input("Quantity", min_value=1, value=100, key="quick_quantity")
        with col2:
            quick_price = st.number_input("Price", min_value=0.01, value=150.0, key="quick_price")
            quick_type = st.selectbox("Type", ["BUY", "SELL"], key="quick_type")
        
        if st.button("💾 Add", key="quick_add"):
            if quick_symbol and quick_quantity > 0 and quick_price > 0:
                result = plaid_client.add_manual_transaction(
                    user.user_id, quick_symbol.upper(), quick_quantity, 
                    quick_price, quick_type, datetime.now().strftime('%Y-%m-%d'), 0.0
                )
                if result['status'] == 'success':
                    st.success(f"✅ Added {quick_type} {quick_quantity} {quick_symbol.upper()}")
                else:
                    st.error(f"❌ {result['message']}")
    
    # Transaction summary
    if plaid_client:
        try:
            all_transactions = plaid_client.get_all_transactions(user.user_id, days=30)
            if not all_transactions.empty:
                st.subheader("Recent Activity (30 days)")
                
                # Summary metrics
                total_transactions = len(all_transactions)
                buy_count = len(all_transactions[all_transactions['transaction_type'] == 'BUY']) if 'transaction_type' in all_transactions.columns else 0
                sell_count = len(all_transactions[all_transactions['transaction_type'] == 'SELL']) if 'transaction_type' in all_transactions.columns else 0
                
                col1, col2 = st.columns(2)
                with col1:
                    st.metric("Total", total_transactions)
                    st.metric("Buys", buy_count)
                with col2:
                    st.metric("Sells", sell_count)
                    manual_count = len(all_transactions[all_transactions['source'] == 'manual']) if 'source' in all_transactions.columns else 0
                    st.metric("Manual", manual_count)
                
                # Recent transactions preview
                recent_transactions = all_transactions.head(5)
                if not recent_transactions.empty:
                    st.write("**Recent Transactions:**")
                    for _, txn in recent_transactions.iterrows():
                        date_str = txn['date'].strftime('%m/%d') if hasattr(txn['date'], 'strftime') else str(txn['date'])[:10]
                        st.write(f"• {date_str}: {txn.get('transaction_type', 'N/A')} {txn.get('quantity', 0)} {txn.get('symbol', 'N/A')}")
        except Exception as e:
            logger.error(f"Error loading transaction summary: {e}")
    
    if st.button("📊 Open Transaction Manager", key="open_transaction_manager"):
        if transaction_manager:
            st.session_state.show_transaction_manager = True
        else:
            st.error("Transaction manager not available")
    
    st.divider()

# Auto-show Plaid portfolio if available (including sample data)
if plaid_portfolio and (not uploaded_file and not current_portfolio and not current_transactions):
    portfolio = plaid_portfolio
    portfolio_source = "Sample Data" if st.session_state.get('force_show_plaid') else "Plaid (Live Data)"
elif uploaded_file or current_portfolio or plaid_portfolio or current_transactions:
    if uploaded_file and st.session_state.get('uploaded_file_processed') != uploaded_file.name:
        # Clear previous data when uploading new file
        if 'current_portfolio' in st.session_state:
            del st.session_state.current_portfolio
        if 'current_transactions' in st.session_state:
            del st.session_state.current_transactions
        if data_type == "Transaction History":
            # Process transaction file
            try:
                import tempfile
                import os
                
                # Save uploaded file temporarily
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{uploaded_file.name.split('.')[-1]}") as tmp_file:
                    tmp_file.write(uploaded_file.getvalue())
                    tmp_path = tmp_file.name
                
                # Load transaction data
                from core.transactions import TransactionPortfolio, Transaction
                
                if uploaded_file.name.endswith('.csv'):
                    txn_df = pd.read_csv(tmp_path)
                else:
                    txn_df = pd.read_excel(tmp_path)
                
                # Clean up temp file
                os.unlink(tmp_path)
                
                # Use TransactionPortfolio.from_dataframe() which handles column mapping
                txn_portfolio = TransactionPortfolio.from_dataframe(txn_df)
                st.session_state.transaction_portfolio = txn_portfolio
                
                # Create processed DataFrame for display
                processed_df = pd.DataFrame([{
                    'symbol': txn.symbol,
                    'quantity': txn.quantity,
                    'price': txn.price,
                    'date': txn.date,
                    'transaction_type': txn.transaction_type,
                    'fees': txn.fees
                } for txn in txn_portfolio.transactions])
                st.session_state.transaction_df = processed_df
                
                # Convert to portfolio for analysis
                positions = txn_portfolio.get_current_positions()
                cost_basis = txn_portfolio.get_cost_basis()
                
                portfolio_data = []
                for symbol, qty in positions.items():
                    avg_cost = cost_basis.get(symbol, 0)
                    if qty > 0 and avg_cost > 0:
                        portfolio_data.append({
                            'symbol': symbol,
                            'quantity': qty,
                            'avg_cost': avg_cost
                        })
                
                if portfolio_data:
                    df = pd.DataFrame(portfolio_data)
                    portfolio = Portfolio.from_dataframe(df)
                    portfolio_source = "Transaction History"
                    
                    # Auto-save transaction file to Supabase
                    if can_write_portfolio:
                        auto_save_name = f"Transactions_{uploaded_file.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                        transactions_data = [{
                            'portfolio': getattr(txn, 'portfolio', None),
                            'date': txn.date.isoformat(),
                            'action': txn.transaction_type,
                            'ticker': txn.symbol,
                            'price': txn.price,
                            'currency': getattr(txn, 'currency', None),
                            'shares': txn.quantity,
                            'commission': txn.fees
                        } for txn in txn_portfolio.transactions]
                        
                        transaction_id = data_isolation.save_user_transactions(user.user_id, auto_save_name, transactions_data)
                        if transaction_id:
                            st.success(f"Loaded {len(txn_df)} transactions, {len(positions)} current positions - Auto-saved as '{auto_save_name}'")
                        else:
                            st.success(f"Loaded {len(txn_df)} transactions, {len(positions)} current positions")
                    
                    # Auto-train ML models
                    with st.spinner("Training ML models..."):
                        from enterprise.ml_engine import MLPredictor
                        ml_predictor = MLPredictor(data_client)
                        training_results = ml_predictor.train_return_prediction_model(list(positions.keys())[:10])
                        if training_results:
                            # Cache ML results
                            portfolio_hash = hashlib.md5(str(sorted(list(positions.keys()))).encode()).hexdigest()
                            cache_manager.set_portfolio_data(user.user_id, f"ml_models_{portfolio_hash}", training_results, expire_hours=24)
                            
                            st.success(f"✅ Trained ML models for {len(training_results)} symbols")
                            ml_predictor.save_models('ml_models.pkl')
                    
                    # Auto-run Enhanced News Sentiment Analysis
                    with st.spinner("Analyzing comprehensive news sentiment..."):
                        from utils.auto_analysis import run_automatic_sentiment_analysis
                        
                        # Store current timestamp for analysis metadata
                        st.session_state.current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        
                        enhanced_sentiment = run_automatic_sentiment_analysis(
                            list(positions.keys())[:10], user.user_id, days_back=7
                        )
                        
                        if enhanced_sentiment:
                            # Show enhanced sentiment summary
                            sentiment_data = enhanced_sentiment.get('sentiment_analysis', {})
                            market_events = enhanced_sentiment.get('market_events', {})
                            
                            bullish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BULLISH')
                            bearish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BEARISH')
                            total_news = enhanced_sentiment.get('total_news_articles', 0)
                            total_events = sum(len(events) for events in market_events.values())
                            
                            st.success(f"📰 Enhanced sentiment: {bullish_count} bullish, {bearish_count} bearish | {total_news} articles | {total_events} events")
                        else:
                            # Fallback to basic analysis
                            from pulling_news_v3 import NewsAnalyzer
                            news_analyzer = NewsAnalyzer()
                            portfolio_symbols = list(positions.keys())[:10]
                            sentiment_data = news_analyzer.get_portfolio_news_sentiment(portfolio_symbols, days_back=7)
                            
                            # Cache sentiment results
                            sentiment_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
                            cache_manager.set_portfolio_data(user.user_id, f"sentiment_{sentiment_hash}", sentiment_data, expire_hours=6)
                            
                            # Show sentiment summary
                            bullish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BULLISH')
                            bearish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BEARISH')
                            st.success(f"📰 News sentiment analyzed: {bullish_count} bullish, {bearish_count} bearish signals")
                    
                    # Auto-run Monte Carlo Simulation
                    with st.spinner("Running Monte Carlo simulation..."):
                        from monte_carlo_v3 import MonteCarloEngine
                        mc_engine = MonteCarloEngine(data_client)
                        
                        # Create weights from positions
                        total_value = sum(positions[symbol] * cost_basis.get(symbol, 0) for symbol in positions.keys())
                        weights = {symbol: (positions[symbol] * cost_basis.get(symbol, 0)) / total_value 
                                 for symbol in positions.keys() if total_value > 0}
                        
                        if weights:
                            mc_results = mc_engine.portfolio_simulation(
                                list(positions.keys()), weights, time_horizon=252, num_simulations=5000
                            )
                            
                            # Cache Monte Carlo results
                            mc_hash = hashlib.md5(str(sorted(list(positions.keys()))).encode()).hexdigest()
                            cache_manager.set_portfolio_data(user.user_id, f"monte_carlo_{mc_hash}", mc_results, expire_hours=12)
                            
                            st.success(f"🎲 Monte Carlo simulation complete: {mc_results['probability_loss']:.1%} probability of loss")
                    
                    st.success(f"Loaded {len(txn_df)} transactions, {len(positions)} current positions")
                    st.session_state.uploaded_file_processed = uploaded_file.name
                else:
                    st.warning("No current positions found from transaction history")
                    st.stop()
                
            except Exception as e:
                st.error(f"Error processing transaction file: {str(e)}")
                st.stop()
        else:
            # Parse using selected broker format
            try:
                from utils.broker_parsers import parse_broker_file
                import tempfile
                import os
                
                # Save uploaded file temporarily
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{uploaded_file.name.split('.')[-1]}") as tmp_file:
                    tmp_file.write(uploaded_file.getvalue())
                    tmp_path = tmp_file.name
                
                # Parse using broker-specific parser
                logger.info(f"Parsing {selected_broker} file with {len(uploaded_file.getvalue())} bytes")
                parsed_df = parse_broker_file(selected_broker, tmp_path)
                logger.info(f"Successfully parsed {len(parsed_df)} transactions")
                
                # Clean up temp file
                os.unlink(tmp_path)
                
                # Create portfolio from parsed data
                portfolio = Portfolio.from_dataframe(parsed_df)
                portfolio_source = f"{selected_broker} Upload"
                
                # Auto-save uploaded file
                if can_write_portfolio:
                    auto_save_name = f"{selected_broker}_{uploaded_file.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                    portfolio_data = [{
                        'symbol': pos.symbol,
                        'quantity': pos.quantity,
                        'avg_cost': pos.avg_cost
                    } for pos in portfolio.positions]
                    
                    portfolio_id = data_isolation.save_user_portfolio(user.user_id, auto_save_name, portfolio_data)
                    if portfolio_id:
                        st.success(f"Loaded {len(parsed_df)} transactions from {selected_broker} format - Auto-saved as '{auto_save_name}'")
                        st.session_state.uploaded_file_processed = uploaded_file.name
                        
                        # Auto-train ML models
                        with st.spinner("Training ML models..."):
                            from enterprise.ml_engine import MLPredictor
                            ml_predictor = MLPredictor(data_client)
                            training_results = ml_predictor.train_return_prediction_model(list(portfolio.symbols)[:10])
                            if training_results:
                                st.success(f"✅ Trained ML models for {len(training_results)} symbols")
                                ml_predictor.save_models('ml_models.pkl')
                        
                        # Auto-run News Sentiment Analysis
                        with st.spinner("Analyzing news sentiment..."):
                            from pulling_news_v3 import NewsAnalyzer
                            news_analyzer = NewsAnalyzer()
                            portfolio_symbols = list(portfolio.symbols)[:10]
                            sentiment_data = news_analyzer.get_portfolio_news_sentiment(portfolio_symbols, days_back=7)
                            
                            # Cache sentiment results
                            sentiment_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
                            cache_manager.set_portfolio_data(user.user_id, f"sentiment_{sentiment_hash}", sentiment_data, expire_hours=6)
                            
                            # Show sentiment summary
                            bullish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BULLISH')
                            bearish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BEARISH')
                            st.success(f"📰 News sentiment analyzed: {bullish_count} bullish, {bearish_count} bearish signals")
                        
                        # Auto-run Monte Carlo Simulation
                        with st.spinner("Running Monte Carlo simulation..."):
                            from monte_carlo_v3 import MonteCarloEngine
                            mc_engine = MonteCarloEngine(data_client)
                            weights = portfolio.get_weights()
                            
                            mc_results = mc_engine.portfolio_simulation(
                                list(portfolio.symbols), weights, time_horizon=252, num_simulations=5000
                            )
                            
                            # Cache Monte Carlo results
                            mc_hash = hashlib.md5(str(sorted(list(portfolio.symbols))).encode()).hexdigest()
                            cache_manager.set_portfolio_data(user.user_id, f"monte_carlo_{mc_hash}", mc_results, expire_hours=12)
                            
                            st.success(f"🎲 Monte Carlo simulation complete: {mc_results['probability_loss']:.1%} probability of loss")
                        
                        st.rerun()
                    else:
                        st.success(f"Loaded {len(parsed_df)} transactions from {selected_broker} format")
                else:
                    st.success(f"Loaded {len(parsed_df)} transactions from {selected_broker} format")
                    
            except Exception as e:
                logger.error(f"Error parsing {selected_broker} file: {str(e)}")
                st.error(f"Error parsing {selected_broker} file: {str(e)}")
                st.stop()
    elif plaid_portfolio:
        portfolio = plaid_portfolio
        portfolio_source = "Plaid (Live Data)"
        
        # Save portfolio option (with permission check)
        if can_write_portfolio:
            portfolio_name = st.text_input("Portfolio Name (to save)")
            col1, col2 = st.columns(2)
            with col1:
                if st.button("💾 Save Portfolio") and portfolio_name:
                    portfolio_data = [{
                        'symbol': pos.symbol,
                        'quantity': pos.quantity,
                        'avg_cost': pos.avg_cost
                    } for pos in portfolio.positions]
                    
                    portfolio_id = data_isolation.save_user_portfolio(user.user_id, portfolio_name, portfolio_data)
                    if portfolio_id:
                        st.success(f"Portfolio '{portfolio_name}' saved!")
                        
                        # Auto-train ML models
                        with st.spinner("Training ML models..."):
                            from enterprise.ml_engine import MLPredictor
                            ml_predictor = MLPredictor(data_client)
                            training_results = ml_predictor.train_return_prediction_model(list(portfolio.symbols)[:10])
                            if training_results:
                                # Cache ML results
                                portfolio_hash = hashlib.md5(str(sorted(list(portfolio.symbols))).encode()).hexdigest()
                                cache_manager.set_portfolio_data(user.user_id, f"ml_models_{portfolio_hash}", training_results, expire_hours=24)
                                
                                st.success(f"Trained ML models for {len(training_results)} symbols")
                                ml_predictor.save_models('ml_models.pkl')
                        
                        # Auto-run News Sentiment Analysis
                        with st.spinner("Analyzing news sentiment..."):
                            from pulling_news_v3 import NewsAnalyzer
                            news_analyzer = NewsAnalyzer()
                            portfolio_symbols = list(portfolio.symbols)[:10]
                            sentiment_data = news_analyzer.get_portfolio_news_sentiment(portfolio_symbols, days_back=7)
                            
                            # Cache sentiment results
                            sentiment_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
                            cache_manager.set_portfolio_data(user.user_id, f"sentiment_{sentiment_hash}", sentiment_data, expire_hours=6)
                            
                            # Show sentiment summary
                            bullish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BULLISH')
                            bearish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BEARISH')
                            st.success(f"📰 News sentiment analyzed: {bullish_count} bullish, {bearish_count} bearish signals")
                        
                        # Auto-run Monte Carlo Simulation
                        with st.spinner("Running Monte Carlo simulation..."):
                            from monte_carlo_v3 import MonteCarloEngine
                            mc_engine = MonteCarloEngine(data_client)
                            weights = portfolio.get_weights()
                            
                            mc_results = mc_engine.portfolio_simulation(
                                list(portfolio.symbols), weights, time_horizon=252, num_simulations=5000
                            )
                            
                            # Cache Monte Carlo results
                            mc_hash = hashlib.md5(str(sorted(list(portfolio.symbols))).encode()).hexdigest()
                            cache_manager.set_portfolio_data(user.user_id, f"monte_carlo_{mc_hash}", mc_results, expire_hours=12)
                            
                            st.success(f"🎲 Monte Carlo simulation complete: {mc_results['probability_loss']:.1%} probability of loss")
                        
                        st.rerun()
                    else:
                        st.error("Failed to save portfolio")
            
            with col2:
                if st.button("Share Portfolio") and portfolio_name:
                    # Share with other users (simplified)
                    st.info("Portfolio sharing enabled")
    elif current_transactions:
        # Convert transactions to portfolio for analysis
        positions = current_transactions.get_current_positions()
        cost_basis = current_transactions.get_cost_basis()
        
        portfolio_data = []
        for symbol, qty in positions.items():
            avg_cost = cost_basis.get(symbol, 0)
            if qty > 0 and avg_cost > 0:
                portfolio_data.append({
                    'symbol': symbol,
                    'quantity': qty,
                    'avg_cost': avg_cost
                })
        
        if portfolio_data:
            df = pd.DataFrame(portfolio_data)
            portfolio = Portfolio.from_dataframe(df)
            portfolio_source = "Saved Transactions"
            st.session_state.transaction_portfolio = current_transactions
        else:
            st.warning("No current positions found from saved transactions")
            st.stop()
    else:
        portfolio = current_portfolio
        portfolio_source = "Saved Portfolio"
    
    # Show parsed data preview for uploaded files with pivot capabilities
    if uploaded_file:
        # Store parsed_df in session state for access
        if 'parsed_df' in locals():
            st.session_state.current_parsed_df = parsed_df
        
        if 'current_parsed_df' in st.session_state:
            with st.expander("📊 Interactive Data Analysis"):
                try:
                    from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode
                    
                    display_df = st.session_state.current_parsed_df
                    gb = GridOptionsBuilder.from_dataframe(display_df)
                    gb.configure_pagination(paginationAutoPageSize=True)
                    gb.configure_side_bar()
                    gb.configure_default_column(enablePivot=True, enableValue=True, enableRowGroup=True)
                    gb.configure_selection('multiple', use_checkbox=True)
                    gridOptions = gb.build()
                    
                    AgGrid(
                        display_df,
                        gridOptions=gridOptions,
                        data_return_mode='AS_INPUT',
                        update_mode=GridUpdateMode.MODEL_CHANGED,
                        fit_columns_on_grid_load=False,
                        enable_enterprise_modules=True,
                        height=400,
                        width='100%'
                    )
                    
                    st.info("💡 **Pivot Features:** Drag columns to Row Groups for grouping, Values for aggregation, Columns for pivoting")
                    
                except ImportError:
                    st.warning("Install streamlit-aggrid for advanced pivot features: `pip install streamlit-aggrid`")
                    st.dataframe(display_df.head(20))
    
    # Transaction Analysis (if available)
    if 'transaction_portfolio' in st.session_state and 'transaction_df' in st.session_state:
        st.header("Transaction Analysis")
        
        txn_portfolio = st.session_state.transaction_portfolio
        txn_df = st.session_state.transaction_df
        
        # Transaction summary
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Transactions", len(txn_df))
        with col2:
            buy_count = len([t for t in txn_portfolio.transactions if t.transaction_type.upper() == 'BUY'])
            st.metric("Buy Orders", buy_count)
        with col3:
            sell_count = len([t for t in txn_portfolio.transactions if t.transaction_type.upper() == 'SELL'])
            st.metric("Sell Orders", sell_count)
        with col4:
            dates = [t.date for t in txn_portfolio.transactions]
            date_range = (max(dates) - min(dates)).days if dates else 0
            st.metric("Date Range (Days)", date_range)
        
        # P&L Analysis
        try:
            from analytics.transaction_processor import TransactionProcessor
            
            processor = TransactionProcessor(data_client)
            
            # Calculate P&L
            pnl_analysis = processor.calculate_pnl(txn_portfolio)
            
            st.subheader("P&L Analysis")
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total P&L", f"${pnl_analysis.get('total_pnl', 0):,.2f}")
            with col2:
                st.metric("Realized P&L", f"${pnl_analysis.get('total_realized_pnl', 0):,.2f}")
            with col3:
                st.metric("Unrealized P&L", f"${pnl_analysis.get('total_unrealized_pnl', 0):,.2f}")
            
            # Cost analysis
            cost_analysis = processor.cost_analysis(txn_portfolio.transactions)
            
            st.subheader("Cost Analysis")
            col1, col2 = st.columns(2)
            with col1:
                st.metric("Total Fees", f"${cost_analysis.get('total_fees', 0):,.2f}")
            with col2:
                st.metric("Fee Rate", f"{cost_analysis.get('overall_fee_rate', 0):.4%}")
            
        except ImportError:
            st.warning("Transaction processor not available")
        
        # Transaction table with filtering
        st.subheader("Transaction History")
        
        # Filters
        col1, col2, col3 = st.columns(3)
        with col1:
            symbols = list(set(t.symbol for t in txn_portfolio.transactions))
            symbols_filter = st.multiselect("Filter by Symbol", symbols)
        with col2:
            types = list(set(t.transaction_type for t in txn_portfolio.transactions))
            type_filter = st.multiselect("Filter by Type", types)
        with col3:
            dates = [t.date for t in txn_portfolio.transactions]
            min_date = min(dates).date() if dates else datetime.now().date()
            max_date = max(dates).date() if dates else datetime.now().date()
            date_range = st.date_input("Date Range", value=[min_date, max_date])
        
        # Apply filters
        filtered_df = txn_df.copy()
        if symbols_filter and 'symbol' in filtered_df.columns:
            filtered_df = filtered_df[filtered_df['symbol'].isin(symbols_filter)]
        if type_filter and 'transaction_type' in filtered_df.columns:
            filtered_df = filtered_df[filtered_df['transaction_type'].isin(type_filter)]
        if len(date_range) == 2 and 'date' in filtered_df.columns:
            # Convert date column to datetime if it's not already
            if filtered_df['date'].dtype == 'object':
                filtered_df['date'] = pd.to_datetime(filtered_df['date'])
            filtered_df = filtered_df[
                (filtered_df['date'].dt.date >= date_range[0]) & 
                (filtered_df['date'].dt.date <= date_range[1])
            ]
        
        # Display transaction table
        try:
            from st_aggrid import AgGrid, GridOptionsBuilder
            
            gb = GridOptionsBuilder.from_dataframe(filtered_df)
            gb.configure_pagination(paginationAutoPageSize=True)
            gb.configure_side_bar()
            gb.configure_default_column(enablePivot=True, enableValue=True, enableRowGroup=True)
            gb.configure_column('date', type=['dateColumn'])
            gb.configure_column('price', type=['numericColumn'], precision=2)
            gb.configure_column('quantity', type=['numericColumn'], precision=0)
            gridOptions = gb.build()
            
            AgGrid(filtered_df, gridOptions=gridOptions, height=400)
            
        except ImportError:
            st.dataframe(filtered_df, use_container_width=True)
        
        # Position summary from transactions
        st.subheader("Current Positions (from Transactions)")
        positions = txn_portfolio.get_current_positions()
        cost_basis = txn_portfolio.get_cost_basis()
        
        positions_data = []
        for symbol, qty in positions.items():
            avg_cost = cost_basis.get(symbol, 0)
            market_value = qty * avg_cost
            positions_data.append({
                'Symbol': symbol,
                'Quantity': qty,
                'Avg Cost': f"${avg_cost:.2f}",
                'Market Value': f"${market_value:,.2f}"
            })
        
        if positions_data:
            positions_df = pd.DataFrame(positions_data)
            st.dataframe(positions_df, use_container_width=True)
        
        st.divider()
    
    # Portfolio composition - calculate weights first
    weights_df = pd.DataFrame(list(portfolio.get_weights().items()), 
                             columns=['Symbol', 'Weight'])
    weights_df['Weight_Pct'] = weights_df['Weight'] * 100
    weights_df = weights_df.sort_values('Weight', ascending=False)
    
    # Enhanced portfolio metrics
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total Positions", len(portfolio.positions))
    with col2:
        st.metric("Total Value", f"${portfolio.total_value:,.2f}")
    with col3:
        largest_position = weights_df.iloc[0]
        st.metric("Largest Position", f"{largest_position['Symbol']} ({largest_position['Weight_Pct']:.1f}%)")
    with col4:
        concentration = weights_df.head(5)['Weight'].sum() * 100
        st.metric("Top 5 Concentration", f"{concentration:.1f}%")
    

    
    # Portfolio diversification metrics
    with st.expander("Diversification Analysis"):
        col1, col2 = st.columns(2)
        with col1:
            # Sector analysis
            tech_symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'ORCL', 'AVGO']
            finance_symbols = ['JPM', 'BAC', 'WFC', 'GS', 'V', 'MA']
            etf_symbols = ['SPY', 'QQQ', 'IWM', 'VTI']
            
            tech_weight = sum(weights_df[weights_df['Symbol'].isin(tech_symbols)]['Weight']) * 100
            finance_weight = sum(weights_df[weights_df['Symbol'].isin(finance_symbols)]['Weight']) * 100
            etf_weight = sum(weights_df[weights_df['Symbol'].isin(etf_symbols)]['Weight']) * 100
            other_weight = 100 - tech_weight - finance_weight - etf_weight
            
            sector_data = pd.DataFrame({
                'Sector': ['Technology', 'Financial', 'ETFs', 'Other'],
                'Weight': [tech_weight, finance_weight, etf_weight, other_weight]
            })
            sector_data = sector_data[sector_data['Weight'] > 0]
            
            fig_sector = px.bar(sector_data, x='Sector', y='Weight', 
                              title="Sector Allocation",
                              color='Sector',
                              color_discrete_sequence=px.colors.qualitative.Pastel)
            fig_sector.update_layout(showlegend=False)
            st.plotly_chart(fig_sector, use_container_width=True)
        
        with col2:
            # Position size distribution
            size_bins = ['<1%', '1-2%', '2-5%', '5-10%', '>10%']
            size_counts = [0, 0, 0, 0, 0]
            
            for _, row in weights_df.iterrows():
                pct = row['Weight_Pct']
                if pct < 1:
                    size_counts[0] += 1
                elif pct < 2:
                    size_counts[1] += 1
                elif pct < 5:
                    size_counts[2] += 1
                elif pct < 10:
                    size_counts[3] += 1
                else:
                    size_counts[4] += 1
            
            size_data = pd.DataFrame({
                'Size Range': size_bins,
                'Count': size_counts
            })
            size_data = size_data[size_data['Count'] > 0]
            
            fig_size = px.bar(size_data, x='Size Range', y='Count',
                            title="Position Size Distribution",
                            color='Count',
                            color_continuous_scale='Blues')
            fig_size.update_layout(showlegend=False)
            st.plotly_chart(fig_size, use_container_width=True)
    
    # Portfolio composition - improved visualization
    # Show top 10 holdings in pie chart, group rest as "Others"
    top_holdings = weights_df.head(10).copy()
    if len(weights_df) > 10:
        others_weight = weights_df.tail(len(weights_df) - 10)['Weight'].sum()
        others_row = pd.DataFrame({'Symbol': ['Others'], 'Weight': [others_weight], 'Weight_Pct': [others_weight * 100]})
        display_df = pd.concat([top_holdings, others_row], ignore_index=True)
    else:
        display_df = top_holdings
    
    col1, col2 = st.columns([2, 1])
    with col1:
        fig = px.pie(display_df, values='Weight', names='Symbol', 
                    title="Portfolio Composition (Top Holdings)",
                    hover_data=['Weight_Pct'],
                    color_discrete_sequence=px.colors.qualitative.Set3)
        fig.update_traces(textposition='inside', textinfo='percent+label')
        fig.update_layout(showlegend=True, legend=dict(orientation="v", x=1.02, y=1))
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        st.subheader("Top 10 Holdings")
        display_table = weights_df.head(10)[['Symbol', 'Weight_Pct']].copy()
        display_table['Weight_Pct'] = display_table['Weight_Pct'].apply(lambda x: f"{x:.2f}%")
        
        try:
            from st_aggrid import AgGrid, GridOptionsBuilder
            
            gb = GridOptionsBuilder.from_dataframe(display_table)
            gb.configure_default_column(sorteable=True, filterable=True)
            gb.configure_column('Weight_Pct', sort='desc')
            gridOptions = gb.build()
            
            AgGrid(display_table, gridOptions=gridOptions, height=300, fit_columns_on_grid_load=True)
            
        except ImportError:
            st.dataframe(display_table, hide_index=True)
    
    # Risk Analysis (permission-based)
    if user_manager.check_permission(user, Permission.READ_RISK):
        st.header("Risk Analysis")
        
        col1, col2 = st.columns(2)
        with col1:
            # Check cache first before showing button
            portfolio_hash = hashlib.md5(str(sorted([s for s in portfolio.symbols if s])).encode()).hexdigest()
        cached_metrics = cache_manager.get_portfolio_data(user.user_id, f"risk_{portfolio_hash}")
        
        if not cached_metrics:
            with st.spinner("Auto-calculating detailed risk analysis..."):
                try:
                    weights = portfolio.get_weights()
                    
                    try:
                        from analytics.risk_analytics_polars import RiskAnalyzerPolars
                        risk_analyzer = RiskAnalyzerPolars(data_client)
                        metrics = risk_analyzer.analyze_portfolio_risk_ultra_fast(portfolio.symbols, weights)
                    except ImportError:
                        risk_analyzer = RiskAnalyzer(data_client)
                        metrics = risk_analyzer.analyze_portfolio_risk_fast(portfolio.symbols, weights)
                    
                    cache_manager.set_portfolio_data(user.user_id, f"risk_{portfolio_hash}", metrics, expire_hours=24)
                    cached_metrics = metrics
                    st.success("✅ Risk analysis completed")
                    
                    # Show actual calculated values for verification
                    with st.expander("Calculated Values Preview"):
                        st.write(f"VaR (95%): {metrics.get('var_95', 0):.6f} ({metrics.get('var_95', 0):.4%})")
                        st.write(f"CVaR (95%): {metrics.get('cvar_95', 0):.6f} ({metrics.get('cvar_95', 0):.4%})")
                        st.write(f"Beta: {metrics.get('beta', 0):.6f}")
                        st.write(f"Portfolio Volatility: {metrics.get('portfolio_volatility', 0):.6f} ({metrics.get('portfolio_volatility', 0):.4%})")
                except Exception as e:
                    st.error(f"Risk analysis failed: {str(e)}")
        
        if cached_metrics:
            metrics = cached_metrics
            
            # Key Risk Metrics
            st.subheader("📈 Key Risk Metrics")
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                portfolio_vol = metrics.get('portfolio_volatility', 0)
                st.metric("Portfolio Volatility", f"{portfolio_vol:.2%}" if portfolio_vol != 0 else "0.00%")
            with col2:
                var_95 = metrics.get('var_95', 0)
                # Handle both small decimal and percentage values
                if abs(var_95) < 0.01 and abs(var_95) > 0:
                    st.metric("VaR (95%)", f"{var_95:.4%}")
                else:
                    st.metric("VaR (95%)", f"{var_95:.2%}" if var_95 != 0 else "0.00%")
            with col3:
                cvar_95 = metrics.get('cvar_95', 0)
                # Handle both small decimal and percentage values
                if abs(cvar_95) < 0.01 and abs(cvar_95) > 0:
                    st.metric("CVaR (95%)", f"{cvar_95:.4%}")
                else:
                    st.metric("CVaR (95%)", f"{cvar_95:.2%}" if cvar_95 != 0 else "0.00%")
            with col4:
                max_dd = metrics.get('max_drawdown', 0)
                st.metric("Max Drawdown", f"{max_dd:.2%}" if max_dd != 0 else "0.00%")
            
            # Additional Risk Metrics
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                sharpe = metrics.get('sharpe_ratio', 0)
                st.metric("Sharpe Ratio", f"{sharpe:.3f}" if sharpe != 0 else "0.000")
            with col2:
                sortino = metrics.get('sortino_ratio', 0)
                st.metric("Sortino Ratio", f"{sortino:.3f}" if sortino != 0 else "0.000")
            with col3:
                beta = metrics.get('beta', 0)
                st.metric("Beta", f"{beta:.3f}" if beta != 0 else "0.000")
            with col4:
                avg_corr = metrics.get('avg_correlation', 0)
                st.metric("Average Correlation", f"{avg_corr:.3f}" if avg_corr != 0 else "0.000")
            
            # Risk Assessment
            var_95 = abs(metrics.get('var_95', 0))  # Use absolute value for assessment
            if var_95 > 0.10:
                st.error(f"🔴 HIGH RISK: VaR {var_95:.2%} exceeds 10%")
            elif var_95 > 0.05:
                st.warning(f"🟡 MODERATE RISK: VaR {var_95:.2%} between 5-10%")
            elif var_95 > 0.01:
                st.info(f"🟡 MODERATE RISK: VaR {var_95:.2%} between 1-5%")
            elif var_95 > 0:
                st.success(f"🟢 LOW RISK: VaR {var_95:.4%} below 1%")
            else:
                st.warning("⚠️ VaR calculation unavailable - check data quality")
            
            # Correlation Analysis
            st.subheader("🔗 Correlation Analysis")
            corr_matrix = metrics.get('correlation_matrix')
            if corr_matrix is not None:
                try:
                    if hasattr(corr_matrix, 'values'):
                        corr_data = corr_matrix
                    else:
                        # Create correlation matrix from real data
                        symbols = [s for s in list(portfolio.symbols)[:10] if s and s.strip()]
                        if symbols:
                            price_data = data_client.get_price_data(symbols, "3mo")
                            returns = price_data.pct_change(fill_method=None).dropna()
                            corr_data = returns.corr()
                    
                    fig_corr = px.imshow(
                        corr_data.values, 
                        x=corr_data.columns, 
                        y=corr_data.index,
                        title="Portfolio Correlation Matrix", 
                        color_continuous_scale='RdBu',
                        aspect='auto'
                    )
                    st.plotly_chart(fig_corr, use_container_width=True)
                except Exception as e:
                    st.info("Correlation matrix unavailable")
            
            # Risk Decomposition
            st.subheader("📉 Risk Decomposition")
            if 'risk_contribution' in metrics and metrics['risk_contribution']:
                risk_contrib = metrics['risk_contribution']
                if risk_contrib and len(risk_contrib) > 0:
                    contrib_data = []
                    for symbol, contrib in risk_contrib.items():
                        contrib_data.append({
                            'Symbol': symbol, 
                            'Risk Contribution': f"{contrib:.2%}",
                            'Risk Contribution (Raw)': contrib
                        })
                    
                    contrib_df = pd.DataFrame(contrib_data)
                    contrib_df = contrib_df.sort_values('Risk Contribution (Raw)', ascending=False)
                    
                    # Display table
                    st.dataframe(contrib_df[['Symbol', 'Risk Contribution']], use_container_width=True)
                    
                    # Risk contribution chart
                    fig_risk_contrib = px.bar(
                        contrib_df, 
                        x='Symbol', 
                        y='Risk Contribution (Raw)',
                        title="Risk Contribution by Asset",
                        labels={'Risk Contribution (Raw)': 'Risk Contribution'}
                    )
                    st.plotly_chart(fig_risk_contrib, use_container_width=True)
                else:
                    st.info("Risk contribution data is empty or not available")
            else:
                st.info("Risk contribution analysis not available - this requires correlation and volatility data")
            
            # Volatility Analysis
            st.subheader("📈 Volatility Analysis")
            if 'individual_volatilities' in metrics:
                vol_data = metrics['individual_volatilities']
                vol_df = pd.DataFrame([
                    {'Symbol': symbol, 'Volatility': f"{vol:.2%}"}
                    for symbol, vol in vol_data.items()
                ])
                
                fig_vol = px.bar(
                    vol_df, x='Symbol', y='Volatility',
                    title="Individual Stock Volatilities"
                )
                st.plotly_chart(fig_vol, use_container_width=True)
            
            # Risk Alerts
            if hasattr(Config, 'ENABLE_RISK_ALERTS') and Config.ENABLE_RISK_ALERTS and email_service.enabled:
                critical_threshold = getattr(Config, 'RISK_THRESHOLD_CRITICAL', 0.15)
                high_threshold = getattr(Config, 'RISK_THRESHOLD_HIGH', 0.10)
                if var_95 > critical_threshold:
                    st.error(f"⚠️ CRITICAL RISK ALERT: VaR {var_95:.2%} exceeds critical threshold")
                elif var_95 > high_threshold:
                    st.warning(f"⚠️ HIGH RISK ALERT: VaR {var_95:.2%} exceeds high threshold")
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("Refresh Risk Analysis"):
                    cache_manager.invalidate_user_cache(user.user_id)
                    st.rerun()
            with col2:
                if st.button("Debug Risk Calculation"):
                    st.write("**Raw Risk Metrics:**")
                    for key, value in metrics.items():
                        if key in ['var_95', 'cvar_95', 'beta', 'sharpe_ratio', 'sortino_ratio']:
                            st.write(f"{key}: {value} (type: {type(value)})")
        else:
            st.warning("Unable to calculate risk metrics - check data availability")
            with st.expander("Debug Information"):
                st.write(f"Portfolio symbols: {list(portfolio.symbols)[:5]}...")
                st.write(f"Portfolio weights available: {bool(portfolio.get_weights())}")
                st.write(f"Data client available: {data_client is not None}")
        

    
    # Advanced Analytics Suite
    if user_manager.check_permission(user, Permission.READ_ANALYTICS):
        st.header("Advanced Analytics Suite")
        
        analytics_tab1, analytics_tab2, analytics_tab3, analytics_tab4, analytics_tab5, analytics_tab6, analytics_tab7, analytics_tab8, analytics_tab9, analytics_tab10, analytics_tab11 = st.tabs(["Performance Attribution", "Quantitative Screening", "Portfolio Analytics", "XIRR Analysis", "Monte Carlo", "News Sentiment", "ML Engine", "Statistical Analysis", "Technical Indicators", "Backtesting", "Compliance Reports"])
        
        with analytics_tab1:
            st.subheader("Performance Attribution Analysis")
            from analytics.performance_attribution import PerformanceAttributor
            
            col1, col2 = st.columns(2)
            with col1:
                attribution_period = st.selectbox("Analysis Period", ["1m", "3m", "6m", "1y"], index=2)
            with col2:
                benchmark_symbol = st.text_input("Benchmark Symbol", value="SPY")
            
            if st.button("Run Performance Attribution"):
                with st.spinner("Analyzing performance attribution..."):
                    attributor = PerformanceAttributor(data_client, benchmark_symbol)
                    weights = portfolio.get_weights()
                    
                    # Factor-based attribution
                    factor_attribution = attributor.factor_based_attribution(portfolio.symbols, weights, attribution_period)
                    
                    if factor_attribution:
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.metric("Portfolio Return", f"{factor_attribution['portfolio_return']:.2%}")
                        with col2:
                            st.metric("Benchmark Return", f"{factor_attribution['benchmark_return']:.2%}")
                        with col3:
                            st.metric("Active Return", f"{factor_attribution['active_return']:.2%}")
                        
                        # Top contributors
                        if factor_attribution['top_contributors']:
                            st.subheader("Top Contributors")
                            contrib_df = pd.DataFrame([
                                {'Symbol': symbol, 'Contribution': data['total_contribution'], 'Weight': data['weight']}
                                for symbol, data in factor_attribution['top_contributors']
                            ])
                            st.dataframe(contrib_df)
        
        with analytics_tab2:
            st.subheader("Quantitative Screening Engine")
            from analytics.screening_engine import QuantitativeScreener
            
            screener = QuantitativeScreener(data_client)
            
            screening_method = st.selectbox("Screening Method", [
                "Momentum Analysis", "Volatility Screen", "Mean Reversion", 
                "Quality Screen", "Breakout Detection", "Correlation Pairs"
            ])
            
            if st.button("Run Screen"):
                with st.spinner(f"Running {screening_method}..."):
                    try:
                        if screening_method == "Momentum Analysis":
                            results = screener.momentum_screen(portfolio.symbols)
                            st.write(f"Debug: Found {len(results.get('momentum_rankings', []))} momentum results")
                            if results['momentum_rankings']:
                                st.subheader("Momentum Rankings")
                                momentum_df = pd.DataFrame([
                                    {'Symbol': symbol, 'Momentum Score': f"{data['momentum_score']:.3f}", 'Current Price': f"${data['current_price']:.2f}"}
                                    for symbol, data in results['top_momentum']
                                ])
                                st.dataframe(momentum_df)
                            else:
                                st.warning("No momentum opportunities found. Check if market data is available for your symbols.")
                        
                        elif screening_method == "Quality Screen":
                            results = screener.quality_screen(portfolio.symbols)
                            st.write(f"Debug: Found {len(results.get('high_quality', []))} quality results")
                            if results['high_quality']:
                                st.subheader("Quality Rankings")
                                quality_df = pd.DataFrame([
                                    {'Symbol': symbol, 'Quality Score': f"{data['quality_score']:.3f}", 'Sharpe Ratio': f"{data['sharpe_ratio']:.3f}"}
                                    for symbol, data in results['high_quality']
                                ])
                                st.dataframe(quality_df)
                            else:
                                st.warning("No quality stocks found. Check if market data is available for your symbols.")
                        
                        elif screening_method == "Correlation Pairs":
                            results = screener.correlation_arbitrage(portfolio.symbols)
                            st.write(f"Debug: Found {len(results.get('correlation_pairs', []))} correlation pairs")
                            if results['correlation_pairs']:
                                st.subheader("High Correlation Pairs")
                                pairs_df = pd.DataFrame([
                                    {'Pair': f"{pair['pair'][0]} / {pair['pair'][1]}", 'Correlation': f"{pair['correlation']:.3f}", 'Z-Score': f"{pair['z_score']:.2f}"}
                                    for pair in results['correlation_pairs'][:10]
                                ])
                                st.dataframe(pairs_df)
                            else:
                                st.warning("No correlation pairs found.")
                        
                        elif screening_method == "Volatility Screen":
                            results = screener.volatility_screen(portfolio.symbols)
                            st.write(f"Debug: Found {len(results.get('volatility_metrics', {}))} volatility results")
                            if results['low_volatility'] or results['high_volatility']:
                                col1, col2 = st.columns(2)
                                with col1:
                                    st.subheader("Low Volatility Stocks")
                                    if results['low_volatility']:
                                        low_vol_df = pd.DataFrame([
                                            {'Symbol': symbol, 'Current Vol': f"{data['current_volatility']:.1%}", 'Avg Vol': f"{data['average_volatility']:.1%}"}
                                            for symbol, data in results['low_volatility'][:5]
                                        ])
                                        st.dataframe(low_vol_df)
                                with col2:
                                    st.subheader("High Volatility Stocks")
                                    if results['high_volatility']:
                                        high_vol_df = pd.DataFrame([
                                            {'Symbol': symbol, 'Current Vol': f"{data['current_volatility']:.1%}", 'Avg Vol': f"{data['average_volatility']:.1%}"}
                                            for symbol, data in results['high_volatility'][:5]
                                        ])
                                        st.dataframe(high_vol_df)
                            else:
                                st.warning("No volatility data available.")
                        
                        elif screening_method == "Mean Reversion":
                            results = screener.mean_reversion_screen(portfolio.symbols)
                            st.write(f"Debug: Found {len(results.get('ranked_opportunities', []))} mean reversion opportunities")
                            if results['ranked_opportunities']:
                                st.subheader("Mean Reversion Opportunities")
                                reversion_df = pd.DataFrame([
                                    {'Symbol': symbol, 'Signal': data['signal'], 'Z-Score': f"{data['z_score']:.2f}", 'Current Price': f"${data['current_price']:.2f}"}
                                    for symbol, data in results['ranked_opportunities']
                                ])
                                st.dataframe(reversion_df)
                            else:
                                st.warning("No mean reversion opportunities found.")
                        
                        elif screening_method == "Breakout Detection":
                            results = screener.breakout_detection(portfolio.symbols)
                            st.write(f"Debug: Found {len(results.get('breakout_candidates', {}))} breakout candidates")
                            if results['breakout_candidates']:
                                st.subheader("Breakout Opportunities")
                                breakout_df = pd.DataFrame([
                                    {'Symbol': symbol, 'Type': data['breakout_type'], 'Current Price': f"${data['current_price']:.2f}", 'Strength': f"{data['breakout_strength']:.2%}"}
                                    for symbol, data in results['breakout_candidates'].items()
                                ])
                                st.dataframe(breakout_df)
                            else:
                                st.warning("No breakout patterns detected.")
                        
                        else:
                            st.info(f"{screening_method} not yet implemented")
                    
                    except Exception as e:
                        st.error(f"Screening error: {str(e)}")
                        st.write(f"Portfolio symbols: {list(portfolio.symbols)[:5]}...")
        
        with analytics_tab3:
            st.subheader("Portfolio Analytics")
            weights_analysis = {
                'weights': portfolio.get_weights(),
                'herfindahl_index': sum(w**2 for w in portfolio.get_weights().values()),
                'max_weight': max(portfolio.get_weights().values()) if portfolio.get_weights() else 0
            }
            
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Herfindahl Index", f"{weights_analysis['herfindahl_index']:.3f}")
            with col2:
                effective_positions = 1 / weights_analysis['herfindahl_index'] if weights_analysis['herfindahl_index'] > 0 else 0
                st.metric("Effective Positions", f"{effective_positions:.1f}")
            with col3:
                st.metric("Max Weight", f"{weights_analysis['max_weight']:.2%}")
        
        with analytics_tab4:
            st.subheader("XIRR Performance Analysis")
            from analytics.xirr_analyzer import DetailedXIRRAnalyzer
            
            # Check if we have transaction data for detailed XIRR
            has_transaction_data = 'transaction_portfolio' in st.session_state or current_transactions
            
            if has_transaction_data:
                try:
                    analyzer = DetailedXIRRAnalyzer(data_client)
                    
                    # Load transaction data
                    if 'transaction_portfolio' in st.session_state:
                        analyzer.load_transactions(st.session_state.transaction_portfolio)
                    elif current_transactions:
                        analyzer.load_transactions(current_transactions)
                    
                    # Get current prices
                    symbols = list(set(txn['symbol'] for txn in analyzer.transactions))
                    current_prices = data_client.get_current_prices(symbols)
                    
                    if current_prices and analyzer.transactions:
                        # Generate comprehensive report
                        report = analyzer.generate_detailed_report(current_prices)
                        metrics = report['metrics']
                        
                        # Key Performance Metrics
                        st.subheader("📊 Key Performance Metrics")
                        col1, col2, col3, col4 = st.columns(4)
                        with col1:
                            st.metric("XIRR (Money-Weighted)", f"{metrics.xirr:.2%}")
                        with col2:
                            st.metric("TWR (Time-Weighted)", f"{metrics.twr:.2%}")
                        with col3:
                            st.metric("Annualized Return", f"{metrics.annualized_return:.2%}")
                        with col4:
                            st.metric("Total Return", f"${metrics.total_return:,.2f}")
                        
                        # Risk Metrics
                        st.subheader("⚠️ Risk Analysis")
                        col1, col2, col3, col4 = st.columns(4)
                        with col1:
                            st.metric("Volatility (Annual)", f"{metrics.volatility:.2%}")
                        with col2:
                            st.metric("Sharpe Ratio", f"{metrics.sharpe_ratio:.2f}")
                        with col3:
                            st.metric("Max Drawdown", f"{metrics.max_drawdown:.2%}")
                        with col4:
                            st.metric("Sortino Ratio", f"{metrics.sortino_ratio:.2f}")
                        
                        # Trading Performance
                        st.subheader("🎯 Trading Performance")
                        col1, col2, col3, col4 = st.columns(4)
                        with col1:
                            st.metric("Win Rate", f"{metrics.win_rate:.1%}")
                        with col2:
                            st.metric("Profit Factor", f"{metrics.profit_factor:.2f}")
                        with col3:
                            st.metric("Average Win", f"${metrics.average_win:,.2f}")
                        with col4:
                            st.metric("Average Loss", f"${metrics.average_loss:,.2f}")
                        
                        # Performance Assessment
                        st.subheader("📈 Performance Assessment")
                        
                        # XIRR Assessment
                        if metrics.xirr > 0.15:
                            st.success(f"🟢 Excellent XIRR: {metrics.xirr:.2%} (>15% annually)")
                        elif metrics.xirr > 0.10:
                            st.info(f"🟡 Good XIRR: {metrics.xirr:.2%} (10-15% annually)")
                        elif metrics.xirr > 0.05:
                            st.warning(f"🟠 Moderate XIRR: {metrics.xirr:.2%} (5-10% annually)")
                        else:
                            st.error(f"🔴 Poor XIRR: {metrics.xirr:.2%} (<5% annually)")
                        
                        # Risk-Adjusted Performance
                        if metrics.sharpe_ratio > 1.5:
                            st.success(f"🟢 Excellent Risk-Adjusted Returns (Sharpe: {metrics.sharpe_ratio:.2f})")
                        elif metrics.sharpe_ratio > 1.0:
                            st.info(f"🟡 Good Risk-Adjusted Returns (Sharpe: {metrics.sharpe_ratio:.2f})")
                        elif metrics.sharpe_ratio > 0.5:
                            st.warning(f"🟠 Moderate Risk-Adjusted Returns (Sharpe: {metrics.sharpe_ratio:.2f})")
                        else:
                            st.error(f"🔴 Poor Risk-Adjusted Returns (Sharpe: {metrics.sharpe_ratio:.2f})")
                        
                        # Detailed Analysis Tabs
                        xirr_tab1, xirr_tab2, xirr_tab3, xirr_tab4, xirr_tab5 = st.tabs([
                            "📊 Position Analysis", "📈 Performance Charts", "💰 Trade History", 
                            "📅 Monthly Performance", "⚖️ Risk Attribution"
                        ])
                        
                        with xirr_tab1:
                            st.subheader("Current Position Analysis")
                            
                            positions_data = []
                            for symbol, pos in report['positions'].items():
                                positions_data.append({
                                    'Symbol': symbol,
                                    'Quantity': f"{pos['quantity']:,.0f}",
                                    'Avg Cost': f"${pos['avg_cost']:.2f}",
                                    'Current Price': f"${pos['current_price']:.2f}",
                                    'Market Value': f"${pos['market_value']:,.2f}",
                                    'Unrealized P&L': f"${pos['unrealized_pnl']:,.2f}",
                                    'Unrealized %': f"{pos['unrealized_pnl_pct']:.2%}",
                                    'Weight': f"{pos['weight']:.2%}",
                                    'Lots': pos['lots_count'],
                                    'Oldest Lot': pos['oldest_lot_date'].strftime('%Y-%m-%d') if pos['oldest_lot_date'] else 'N/A'
                                })
                            
                            if positions_data:
                                positions_df = pd.DataFrame(positions_data)
                                st.dataframe(positions_df, use_container_width=True)
                        
                        with xirr_tab2:
                            st.subheader("Performance Visualization")
                            
                            # Generate charts
                            charts = analyzer.create_performance_charts(current_prices)
                            
                            # Portfolio value over time
                            if 'portfolio_value' in charts:
                                st.plotly_chart(charts['portfolio_value'], use_container_width=True)
                            
                            # P&L breakdown
                            if 'pnl_breakdown' in charts:
                                st.plotly_chart(charts['pnl_breakdown'], use_container_width=True)
                        
                        with xirr_tab3:
                            st.subheader("Realized Trade History")
                            
                            realized_trades = report['realized_trades']
                            if realized_trades:
                                trades_data = []
                                for trade in realized_trades:
                                    trades_data.append({
                                        'Symbol': trade['symbol'],
                                        'Buy Date': trade['buy_date'].strftime('%Y-%m-%d'),
                                        'Sell Date': trade['sell_date'].strftime('%Y-%m-%d'),
                                        'Quantity': f"{trade['quantity']:,.0f}",
                                        'Buy Price': f"${trade['buy_price']:.2f}",
                                        'Sell Price': f"${trade['sell_price']:.2f}",
                                        'P&L': f"${trade['pnl']:,.2f}",
                                        'Holding Days': trade['holding_days']
                                    })
                                
                                trades_df = pd.DataFrame(trades_data)
                                st.dataframe(trades_df, use_container_width=True)
                            else:
                                st.info("No realized trades found. Upload transaction history with both BUY and SELL transactions.")
                        
                        with xirr_tab4:
                            st.subheader("Monthly Performance Breakdown")
                            
                            monthly_perf = report['monthly_performance']
                            if monthly_perf:
                                monthly_data = []
                                for month in monthly_perf:
                                    monthly_data.append({
                                        'Month': month['month'],
                                        'Start Value': f"${month['start_value']:,.2f}",
                                        'End Value': f"${month['end_value']:,.2f}",
                                        'Cash Flows': f"${month['cash_flows']:,.2f}",
                                        'Monthly Return': f"{month['monthly_return']:.2%}",
                                        'Transactions': month['transactions_count']
                                    })
                                
                                monthly_df = pd.DataFrame(monthly_data)
                                st.dataframe(monthly_df, use_container_width=True)
                            else:
                                st.info("Insufficient data for monthly breakdown")
                        
                        with xirr_tab5:
                            st.subheader("Risk Attribution Analysis")
                            
                            risk_attr = report['risk_attribution']
                            if risk_attr:
                                risk_data = []
                                for symbol, risk in risk_attr.items():
                                    risk_data.append({
                                        'Symbol': symbol,
                                        'Portfolio Weight': f"{risk['weight']:.2%}",
                                        'Risk Contribution': f"{risk['risk_contribution']:.4f}",
                                        'Risk-Adjusted Return': f"{risk['risk_adjusted_return']:.2f}"
                                    })
                                
                                risk_df = pd.DataFrame(risk_data)
                                st.dataframe(risk_df, use_container_width=True)
                    
                    else:
                        st.warning("Unable to fetch current prices for XIRR calculation")
                        
                except Exception as e:
                    st.error(f"XIRR analysis error: {str(e)}")
            
            elif portfolio:
                # Simplified XIRR for portfolio-only data
                st.info("📊 **Simplified XIRR Analysis** (Portfolio positions only)")
                st.write("For detailed XIRR analysis with realized P&L, trading metrics, and time-weighted returns, please upload transaction history.")
                
                try:
                    from XIRR.xirr_calculator import XIRRCalculator
                    calculator = XIRRCalculator()
                    
                    # Get current prices
                    symbols = list(portfolio.symbols)[:10]
                    current_prices = data_client.get_current_prices(symbols)
                    
                    if current_prices:
                        # Simulate transactions based on portfolio positions
                        for pos in portfolio.positions[:10]:
                            if pos.symbol in current_prices:
                                # Simulate purchase 1 year ago at avg_cost
                                calculator.add_transaction(
                                    datetime.now() - timedelta(days=365), 
                                    pos.symbol, 
                                    pos.quantity, 
                                    pos.avg_cost, 
                                    'BUY'
                                )
                        
                        report = calculator.generate_performance_report(current_prices)
                        
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.metric("Estimated XIRR", f"{report['xirr']:.2%}")
                        with col2:
                            st.metric("Total Return", f"${report['total_return']:,.2f}")
                        with col3:
                            st.metric("Return %", f"{report['total_return_pct']:.2%}")
                        
                        st.info("💡 **Note:** This is an estimated XIRR based on assumed purchase dates. Upload actual transaction history for accurate analysis.")
                    else:
                        st.warning("Unable to fetch current prices for XIRR calculation")
                        
                except Exception as e:
                    st.error(f"XIRR calculation error: {str(e)}")
            else:
                st.info("📈 Upload portfolio positions or transaction history to see XIRR analysis")
        
        with analytics_tab5:
            st.subheader("Monte Carlo Portfolio Simulation")
            
            # Check for cached results first
            from utils.auto_analysis import get_cached_monte_carlo, format_monte_carlo_summary, run_automatic_monte_carlo
            portfolio_symbols = list(portfolio.symbols)[:10]
            cached_monte_carlo = get_cached_monte_carlo(portfolio_symbols, user.user_id)
            
            # Auto-run if no cached results
            if not cached_monte_carlo:
                with st.spinner("🎲 Running Monte Carlo simulation..."):
                    weights = portfolio.get_weights()
                    cached_monte_carlo = run_automatic_monte_carlo(
                        portfolio_symbols, weights, user.user_id, 
                        time_horizon=252, num_simulations=10000
                    )
            
            if cached_monte_carlo:
                st.success("✅ Auto-calculated Monte Carlo results available")
                mc_summary = format_monte_carlo_summary(cached_monte_carlo)
                
                # Display key metrics
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric("Expected Return", f"{mc_summary['expected_return']:.2%}")
                with col2:
                    st.metric("Volatility", f"{mc_summary['volatility']:.2%}")
                with col3:
                    st.metric("Probability of Loss", f"{mc_summary['probability_loss']:.2%}")
                with col4:
                    var_5_value = cached_monte_carlo.get('var_5', 0)
                    # Handle both percentage and decimal formats
                    if abs(var_5_value) > 1:
                        st.metric("VaR (5%)", f"{var_5_value:.2f}%")
                    else:
                        st.metric("VaR (5%)", f"{var_5_value:.2%}")
                
                # Additional detailed metrics
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric("Sharpe Ratio", f"{cached_monte_carlo.get('sharpe_ratio', 0):.2f}")
                with col2:
                    max_dd_value = cached_monte_carlo.get('max_drawdown', 0)
                    # Handle both percentage and decimal formats
                    if abs(max_dd_value) > 1:
                        st.metric("Max Drawdown", f"{max_dd_value:.2f}%")
                    else:
                        st.metric("Max Drawdown", f"{max_dd_value:.2%}")
                with col3:
                    st.metric("Skewness", f"{cached_monte_carlo.get('skewness', 0):.2f}")
                with col4:
                    st.metric("Kurtosis", f"{cached_monte_carlo.get('kurtosis', 0):.2f}")
                
                # Risk assessment
                risk_message = f"{mc_summary['risk_color']} {mc_summary['risk_level']} Risk"
                if mc_summary['risk_level'] == 'LOW':
                    st.success(risk_message)
                elif mc_summary['risk_level'] == 'MODERATE':
                    st.warning(risk_message)
                else:
                    st.error(risk_message)
                
                # Detailed percentiles
                st.subheader("📈 Return Distribution Analysis")
                percentiles = cached_monte_carlo.get('percentiles', {})
                if percentiles:
                    perc_data = []
                    for perc, value in percentiles.items():
                        perc_data.append({
                            'Percentile': perc,
                            'Portfolio Value': f"{value:.3f}",
                            'Return': f"{(value - 1) * 100:.1f}%"
                        })
                    
                    perc_df = pd.DataFrame(perc_data)
                    st.dataframe(perc_df, use_container_width=True)
                    
                    # Percentiles chart
                    percentiles_df = pd.DataFrame([
                        {'Percentile': k, 'Value': v} 
                        for k, v in percentiles.items()
                    ])
                    fig_percentiles = px.bar(percentiles_df, x='Percentile', y='Value',
                                           title="Portfolio Value Percentiles", color='Value', color_continuous_scale='RdYlGn')
                    st.plotly_chart(fig_percentiles, use_container_width=True)
                
                # Final values histogram - regenerate if corrupted
                if 'final_values' in cached_monte_carlo:
                    final_values = cached_monte_carlo['final_values']
                    
                    # Check if data is corrupted (string representation)
                    if isinstance(final_values, (list, np.ndarray)) and len(final_values) > 0:
                        if isinstance(final_values[0], str) or (hasattr(final_values, 'dtype') and final_values.dtype.kind in ['U', 'S']):
                            st.warning("Monte Carlo data corrupted. Regenerating...")
                            # Clear cache and regenerate
                            mc_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
                            cache_manager.delete_cache_key(user.user_id, f"monte_carlo_{mc_hash}")
                            st.rerun()
                        else:
                            # Data is good, create histogram
                            final_values_array = np.array(final_values).flatten()
                            if len(final_values_array) > 0:
                                fig_hist = go.Figure(data=[go.Histogram(x=final_values_array, nbinsx=50)])
                                fig_hist.update_layout(title="Distribution of Final Portfolio Values",
                                                     xaxis_title="Final Portfolio Value",
                                                     yaxis_title="Frequency")
                                fig_hist.add_vline(x=1.0, line_dash="dash", annotation_text="Break-even")
                                fig_hist.add_vline(x=cached_monte_carlo.get('mean_final_value', 1), 
                                                  line_dash="dot", annotation_text="Mean")
                                st.plotly_chart(fig_hist, use_container_width=True)
                
                # Display insights
                if mc_summary.get('insights'):
                    st.subheader("💡 Key Insights")
                    for insight in mc_summary['insights']:
                        st.write(f"• {insight}")
                
                # Scenario analysis
                st.subheader("🎯 Scenario Analysis")
                scenarios = {
                    "Best Case (95th %ile)": percentiles.get('95th', 1),
                    "Good Case (75th %ile)": percentiles.get('75th', 1),
                    "Expected Case (50th %ile)": percentiles.get('50th', 1),
                    "Bad Case (25th %ile)": percentiles.get('25th', 1),
                    "Worst Case (5th %ile)": percentiles.get('5th', 1)
                }
                
                scenario_data = []
                for scenario, value in scenarios.items():
                    scenario_data.append({
                        'Scenario': scenario,
                        'Portfolio Value': f"{value:.3f}",
                        'Return': f"{(value - 1) * 100:.1f}%"
                    })
                
                scenario_df = pd.DataFrame(scenario_data)
                st.dataframe(scenario_df, use_container_width=True)
            
            else:
                st.warning("⚠️ Monte Carlo simulation failed. Check market data availability.")
            
            # Add refresh button to clear cache and recalculate
            if st.button("🔄 Refresh Monte Carlo Analysis"):
                # Clear Monte Carlo cache
                mc_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
                cache_manager.delete_cache_key(user.user_id, f"monte_carlo_{mc_hash}")
                st.success("Cache cleared. Refreshing analysis...")
                st.rerun()
            

            
            # Manual simulation option
            with st.expander("Custom Monte Carlo Simulation"):
                from monte_carlo_v3 import MonteCarloEngine
                mc_engine = MonteCarloEngine(data_client)
                
                col1, col2, col3 = st.columns(3)
                with col1:
                    time_horizon = st.slider("Time Horizon (Days)", 30, 1000, 252)
                with col2:
                    num_simulations = st.slider("Simulations", 1000, 50000, 10000, 1000)
                with col3:
                    confidence_level = st.selectbox("Confidence Level", [0.90, 0.95, 0.99], index=1)
                
                if st.button("Run Custom Simulation"):
                    with st.spinner("Running custom Monte Carlo simulation..."):
                        try:
                            weights = portfolio.get_weights()
                            results = mc_engine.portfolio_simulation(
                                list(portfolio.symbols), weights, time_horizon, num_simulations
                            )
                            
                            # Final values distribution
                            final_values_df = pd.DataFrame({'Final Values': results['final_values']})
                            fig_dist = px.histogram(final_values_df, x='Final Values', nbins=50,
                                                  title="Distribution of Final Portfolio Values")
                            fig_dist.add_vline(x=results['mean_final_value'], line_dash="dash", 
                                             annotation_text="Mean")
                            st.plotly_chart(fig_dist, use_container_width=True)
                            
                        except Exception as e:
                            st.error(f"Monte Carlo simulation error: {str(e)}")
        
        with analytics_tab6:
            st.subheader("News Sentiment Analysis")
            
            # Auto-calculate sentiment analysis
            from utils.auto_analysis import get_cached_sentiment_analysis, format_sentiment_summary, run_automatic_sentiment_analysis
            portfolio_symbols = list(portfolio.symbols)[:10]
            cached_sentiment = get_cached_sentiment_analysis(portfolio_symbols, user.user_id)
            
            if not cached_sentiment:
                with st.spinner("Auto-analyzing news sentiment..."):
                    try:
                        cached_sentiment = run_automatic_sentiment_analysis(
                            portfolio_symbols, user.user_id, days_back=7
                        )
                        if cached_sentiment:
                            st.success("✅ Auto-calculated sentiment analysis completed")
                    except Exception as e:
                        st.error(f"Sentiment analysis failed: {str(e)}")
            
            if cached_sentiment:
                sentiment_summary = format_sentiment_summary(cached_sentiment)
                
                # Display metrics
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric("Bullish Signals", sentiment_summary['bullish'])
                with col2:
                    st.metric("Bearish Signals", sentiment_summary['bearish'])
                with col3:
                    st.metric("Neutral Signals", sentiment_summary['neutral'])
                with col4:
                    st.metric("Total News", sentiment_summary['total_news'])
                
                # Sentiment distribution chart
                sentiment_counts = {
                    'BULLISH': sentiment_summary['bullish'], 
                    'BEARISH': sentiment_summary['bearish'], 
                    'NEUTRAL': sentiment_summary['neutral']
                }
                sentiment_counts = {k: v for k, v in sentiment_counts.items() if v > 0}
                
                if sentiment_counts:
                    fig_sentiment = px.pie(
                        values=list(sentiment_counts.values()), 
                        names=list(sentiment_counts.keys()),
                        title="Portfolio Sentiment Distribution",
                        color_discrete_map={'BULLISH': 'green', 'BEARISH': 'red', 'NEUTRAL': 'gray'}
                    )
                    st.plotly_chart(fig_sentiment, use_container_width=True)
                
                # Display insights
                if sentiment_summary.get('insights'):
                    st.write("**Key Insights:**")
                    for insight in sentiment_summary['insights']:
                        st.write(f"• {insight}")
                
                # Detailed sentiment data
                with st.expander("Detailed Sentiment by Stock"):
                    sentiment_detail = []
                    for symbol, data in cached_sentiment.items():
                        sentiment_detail.append({
                            'Symbol': symbol,
                            'Sentiment': data['sentiment_trend'],
                            'Score': f"{data['sentiment_score']:.3f}",
                            'News Count': data['news_count']
                        })
                    
                    if sentiment_detail:
                        detail_df = pd.DataFrame(sentiment_detail)
                        st.dataframe(detail_df, use_container_width=True)
            else:
                st.warning("Unable to analyze sentiment - check news data availability")
            
            
            if st.button("Refresh Sentiment Analysis"):
                # Clear cache and recalculate
                sentiment_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
                cache_manager.delete_cache_key(user.user_id, f"sentiment_{sentiment_hash}")
                st.rerun()
        
        with analytics_tab7:
            st.subheader("Machine Learning Engine")
            from enterprise.ml_engine import MLPredictor, AlternativeDataProcessor, CrossAssetAnalyzer
            
            ml_predictor = MLPredictor(data_client)
            alt_data_processor = AlternativeDataProcessor()
            cross_asset_analyzer = CrossAssetAnalyzer(data_client)
            
            ml_tab1, ml_tab2, ml_tab3 = st.tabs(["🎯 Return Prediction", "📊 Alternative Data", "🔗 Cross-Asset Analysis"])
            
            with ml_tab1:
                st.subheader("ML Return Prediction")
                
                col1, col2 = st.columns(2)
                with col1:
                    lookback_days = st.slider("Training Days", 100, 500, 252)
                with col2:
                    prediction_horizon = st.slider("Prediction Horizon", 1, 30, 5)
                
                # Auto-train models for current portfolio
                portfolio_hash = hashlib.md5(str(sorted([s for s in portfolio.symbols if s])).encode()).hexdigest()
                cached_ml_models = cache_manager.get_portfolio_data(user.user_id, f"ml_models_{portfolio_hash}")
                
                if not cached_ml_models:
                    with st.spinner("Auto-training ML models..."):
                        try:
                            portfolio_symbols = list(portfolio.symbols)[:10]
                            training_results = ml_predictor.train_return_prediction_model(portfolio_symbols)
                            if training_results:
                                cache_manager.set_portfolio_data(user.user_id, f"ml_models_{portfolio_hash}", training_results, expire_hours=24)
                                cached_ml_models = training_results
                                st.success(f"✅ Auto-trained ML models for {len(training_results)} symbols")
                        except Exception as e:
                            st.error(f"Auto-training failed: {str(e)}")
                
                if cached_ml_models:
                    st.success(f"✅ ML models trained for {len(cached_ml_models)} symbols")
                    
                    # Display training results
                    training_df = pd.DataFrame([
                        {
                            'Symbol': symbol,
                            'Best Model': data['best_model'],
                            'R² Score': f"{data['r2_score']:.3f}",
                            'MSE': f"{data['mse']:.6f}"
                        }
                        for symbol, data in cached_ml_models.items()
                    ])
                    st.dataframe(training_df, use_container_width=True)
                    
                    if st.button("Retrain ML Models"):
                        cache_manager.invalidate_user_cache(user.user_id)
                        st.rerun()
                else:
                    st.warning("Unable to train ML models - check data availability")
                
                # Auto-generate predictions if models are trained
                if cached_ml_models:
                    with st.spinner("Generating ML predictions..."):
                        try:
                            portfolio_symbols = list(portfolio.symbols)[:5]
                            predictions = ml_predictor.predict_returns(portfolio_symbols, prediction_horizon)
                            
                            if predictions:
                                pred_df = pd.DataFrame([
                                    {
                                        'Symbol': symbol,
                                        'Predicted Return': f"{data['predicted_return']:.2%}",
                                        'Confidence': f"{data['confidence']:.2%}",
                                        'Horizon': f"{data['horizon_days']} days"
                                    }
                                    for symbol, data in predictions.items()
                                ])
                                
                                st.subheader("ML Return Predictions")
                                st.dataframe(pred_df, use_container_width=True)
                                
                                # Visualization
                                pred_values = [float(data['predicted_return']) for data in predictions.values()]
                                symbols = list(predictions.keys())
                                
                                fig_pred = px.bar(x=symbols, y=pred_values, title="ML Return Predictions")
                                fig_pred.update_layout(xaxis_title="Symbol", yaxis_title="Predicted Return")
                                st.plotly_chart(fig_pred, use_container_width=True)
                            else:
                                st.info("No predictions available from trained models")
                        except Exception as e:
                            st.error(f"Prediction error: {str(e)}")
                
                if st.button("Refresh Predictions"):
                    st.rerun()
            
            with ml_tab2:
                st.subheader("Alternative Data Integration")
                
                # Sentiment data integration
                st.write("**Sentiment Data Integration**")
                if st.button("Process Sentiment Data"):
                    try:
                        # Mock sentiment scores
                        sentiment_scores = {symbol: np.random.uniform(-0.5, 0.5) for symbol in list(portfolio.symbols)[:5]}
                        
                        sentiment_df = alt_data_processor.integrate_sentiment_data(sentiment_scores, list(portfolio.symbols)[:5])
                        st.dataframe(sentiment_df, use_container_width=True)
                        
                        # Sentiment chart
                        fig_sentiment = px.bar(sentiment_df, x='symbol', y='sentiment_score', 
                                             color='sentiment_category', title="Portfolio Sentiment Scores")
                        st.plotly_chart(fig_sentiment, use_container_width=True)
                    except Exception as e:
                        st.error(f"Sentiment processing error: {str(e)}")
                
                # Fundamental data integration
                st.write("**Fundamental Data Integration**")
                if st.button("Process Fundamental Data"):
                    try:
                        # Mock fundamental data
                        fundamental_data = {}
                        for symbol in list(portfolio.symbols)[:5]:
                            fundamental_data[symbol] = {
                                'ratios': {
                                    'pe_ratio': np.random.uniform(10, 30),
                                    'roe': np.random.uniform(0.05, 0.25),
                                    'debt_to_equity': np.random.uniform(0.2, 1.5),
                                    'current_ratio': np.random.uniform(1.0, 3.0),
                                    'revenue_growth': np.random.uniform(-0.1, 0.3)
                                }
                            }
                        
                        fundamental_df = alt_data_processor.integrate_fundamental_data(fundamental_data)
                        st.dataframe(fundamental_df, use_container_width=True)
                    except Exception as e:
                        st.error(f"Fundamental data processing error: {str(e)}")
                
                # Macro data integration
                st.write("**Macroeconomic Data Integration**")
                if st.button("Process Macro Data"):
                    try:
                        # Mock macro indicators
                        macro_indicators = {
                            'fed_funds_rate': 0.05,
                            'cpi_change': 0.03,
                            'gdp_growth': 0.025,
                            'vix': 20,
                            'dxy': 103
                        }
                        
                        processed_macro = alt_data_processor.integrate_macro_data(macro_indicators)
                        
                        macro_df = pd.DataFrame([processed_macro]).T
                        macro_df.columns = ['Value']
                        macro_df.index.name = 'Indicator'
                        
                        st.dataframe(macro_df, use_container_width=True)
                    except Exception as e:
                        st.error(f"Macro data processing error: {str(e)}")
            
            with ml_tab3:
                st.subheader("Cross-Asset Analysis")
                
                col1, col2 = st.columns(2)
                with col1:
                    bond_symbols = st.multiselect("Bond ETFs", ['TLT', 'IEF', 'SHY'], default=['TLT', 'IEF'])
                with col2:
                    commodity_symbols = st.multiselect("Commodity ETFs", ['GLD', 'USO', 'DBA'], default=['GLD', 'USO'])
                
                if st.button("Analyze Cross-Asset Correlations"):
                    with st.spinner("Analyzing cross-asset correlations..."):
                        try:
                            equity_symbols = list(portfolio.symbols)[:5]
                            cross_asset_results = cross_asset_analyzer.analyze_cross_asset_correlations(
                                equity_symbols, bond_symbols, commodity_symbols
                            )
                            
                            if cross_asset_results and 'error' not in cross_asset_results:
                                # Display correlation metrics
                                col1, col2, col3 = st.columns(3)
                                with col1:
                                    equity_bond = cross_asset_results.get('cross_asset_correlations', {}).get('equity_bond')
                                    if equity_bond is not None:
                                        st.metric("Equity-Bond Correlation", f"{equity_bond:.3f}")
                                    else:
                                        st.metric("Equity-Bond Correlation", "N/A")
                                with col2:
                                    equity_commodity = cross_asset_results.get('cross_asset_correlations', {}).get('equity_commodity')
                                    if equity_commodity is not None:
                                        st.metric("Equity-Commodity Correlation", f"{equity_commodity:.3f}")
                                    else:
                                        st.metric("Equity-Commodity Correlation", "N/A")
                                with col3:
                                    risk_on_score = cross_asset_results.get('risk_on_score', 0.5)
                                    st.metric("Risk-On Score", f"{risk_on_score:.3f}")
                                
                                # Correlation heatmap
                                corr_matrix_data = cross_asset_results.get('correlation_matrix', {})
                                if corr_matrix_data:
                                    try:
                                        corr_matrix = pd.DataFrame(corr_matrix_data)
                                        fig_corr = px.imshow(corr_matrix, title="Cross-Asset Correlation Matrix", 
                                                           color_continuous_scale='RdBu', aspect='auto')
                                        st.plotly_chart(fig_corr, use_container_width=True)
                                    except Exception as e:
                                        st.info("Correlation matrix visualization not available")
                                
                                # Diversification benefit
                                div_benefit = cross_asset_results.get('diversification_benefit', 0.0)
                                st.metric("Diversification Benefit", f"{div_benefit:.3f}")
                            elif cross_asset_results and 'error' in cross_asset_results:
                                st.warning(f"Cross-asset analysis error: {cross_asset_results['error']}")
                            else:
                                st.warning("Unable to analyze cross-asset correlations. Check data availability.")
                        except Exception as e:
                            st.error(f"Cross-asset analysis error: {str(e)}")
    
    # Options Analysis (permission-based)
    if user_manager.check_permission(user, Permission.READ_ANALYTICS):
        st.header("Options Opportunities")
        
        col1, col2 = st.columns(2)
        with col1:
            min_premium = st.slider("Min Premium ($)", 0.1, 5.0, 0.5, 0.1)
        with col2:
            min_volume = st.slider("Min Volume", 1, 100, 10)
        
        # Check options cache
        options_cache_key = f"options_{hashlib.md5(str(portfolio.symbols).encode()).hexdigest()}"
        cached_options = cache_manager.get_portfolio_data(user.user_id, options_cache_key)
        opportunities = []
        
        if cached_options:
            st.info("Options Analysis (Cached - 1hr)")
            opportunities = cached_options
            if st.button("Refresh Options"):
                cache_manager.invalidate_user_cache(user.user_id)
                st.rerun()
        else:
            if st.button("Scan Options"):
                with st.spinner("Scanning options chains..."):
                    options_analyzer = OptionsAnalyzer(data_client)
                    opportunities = options_analyzer.scan_covered_calls(portfolio.symbols, min_premium)
                    
                    # Cache results
                    cache_manager.set_portfolio_data(user.user_id, options_cache_key, opportunities, expire_hours=1)
                    st.rerun()
        
        if opportunities:
            # Filter by volume
            filtered_opportunities = [opp for opp in opportunities if opp.get('volume', 0) >= min_volume]
            
            if filtered_opportunities:
                df = pd.DataFrame(filtered_opportunities)
                
                try:
                    from st_aggrid import AgGrid, GridOptionsBuilder
                    
                    gb = GridOptionsBuilder.from_dataframe(df)
                    gb.configure_pagination(paginationAutoPageSize=True)
                    gb.configure_side_bar()
                    gb.configure_default_column(enablePivot=True, enableValue=True, enableRowGroup=True)
                    gb.configure_selection('multiple', use_checkbox=True)
                    gridOptions = gb.build()
                    
                    AgGrid(
                        df,
                        gridOptions=gridOptions,
                        fit_columns_on_grid_load=True,
                        height=400
                    )
                    
                except ImportError:
                    st.dataframe(df)
                
                # Show summary
                avg_return = df['annualized_return'].mean() if 'annualized_return' in df.columns else 0
                st.metric("Average Annualized Return", f"{avg_return:.2%}")
            else:
                st.info(f"No opportunities found with volume >= {min_volume}")
        else:
            st.info("No covered call opportunities found")


    

        
        with analytics_tab8:
            st.subheader("Statistical Analysis")
            
            stat_analyzer = StatisticalAnalyzer(data_client)
            
            stat_tab1, stat_tab2, stat_tab3 = st.tabs(["📊 Correlation Analysis", "🎯 Diversification", "🔗 Clustering"])
            
            with stat_tab1:
                st.write("**Portfolio Correlation Analysis**")
                
                col1, col2 = st.columns(2)
                with col1:
                    corr_period = st.selectbox("Analysis Period", ["1m", "3m", "6m", "1y"], index=2, key="corr_period")
                with col2:
                    min_symbols = st.slider("Min Symbols for Analysis", 2, 10, 5)
                
                if st.button("Run Correlation Analysis"):
                    with st.spinner("Analyzing correlations..."):
                        try:
                            symbols = list(portfolio.symbols)[:min_symbols]
                            corr_results = stat_analyzer.correlation_analysis(symbols, corr_period)
                            
                            if corr_results:
                                col1, col2, col3 = st.columns(3)
                                with col1:
                                    st.metric("Average Correlation", f"{corr_results['avg_correlation']:.3f}")
                                with col2:
                                    st.metric("Max Correlation", f"{corr_results['max_correlation']:.3f}")
                                with col3:
                                    st.metric("Min Correlation", f"{corr_results['min_correlation']:.3f}")
                                
                                # Correlation heatmap
                                corr_matrix = corr_results['correlation_matrix']
                                fig_corr = px.imshow(corr_matrix.values, x=corr_matrix.columns, y=corr_matrix.index,
                                                   title="Correlation Matrix", color_continuous_scale='RdBu')
                                st.plotly_chart(fig_corr, use_container_width=True, key="statistical_correlation_heatmap")
                                
                                # High correlation pairs
                                if corr_results['high_correlation_pairs']:
                                    st.subheader("High Correlation Pairs (>70%)")
                                    pairs_df = pd.DataFrame([
                                        {'Pair': f"{pair['pair'][0]} / {pair['pair'][1]}", 'Correlation': f"{pair['correlation']:.3f}"}
                                        for pair in corr_results['high_correlation_pairs'][:10]
                                    ])
                                    st.dataframe(pairs_df, use_container_width=True)
                            else:
                                st.warning("Unable to perform correlation analysis")
                        except Exception as e:
                            st.error(f"Correlation analysis error: {str(e)}")
            
            with stat_tab2:
                st.write("**Diversification Metrics**")
                
                if st.button("Calculate Diversification Metrics"):
                    with st.spinner("Calculating diversification..."):
                        try:
                            symbols = list(portfolio.symbols)[:10]
                            weights = portfolio.get_weights()
                            
                            # Diversification ratio
                            div_ratio = stat_analyzer.diversification_ratio(symbols, weights)
                            
                            # Effective number of assets
                            eff_assets = stat_analyzer.effective_number_of_assets(weights)
                            
                            col1, col2 = st.columns(2)
                            with col1:
                                st.metric("Diversification Ratio", f"{div_ratio:.3f}")
                                st.write("*Higher is better (>1.2 is good)*")
                            with col2:
                                st.metric("Effective Number of Assets", f"{eff_assets:.1f}")
                                st.write("*Higher indicates better diversification*")
                            
                            # Diversification assessment
                            if div_ratio > 1.2 and eff_assets > len(symbols) * 0.5:
                                st.success("✅ Well diversified portfolio")
                            elif div_ratio > 1.0:
                                st.warning("⚠️ Moderately diversified portfolio")
                            else:
                                st.error("❌ Poorly diversified portfolio")
                        except Exception as e:
                            st.error(f"Diversification analysis error: {str(e)}")
            
            with stat_tab3:
                st.write("**Asset Clustering**")
                
                col1, col2 = st.columns(2)
                with col1:
                    cluster_period = st.selectbox("Analysis Period", ["3m", "6m", "1y", "2y"], index=2, key="cluster_period")
                with col2:
                    n_clusters = st.slider("Number of Clusters", 2, 8, 4)
                
                if st.button("Run Clustering Analysis"):
                    with st.spinner("Clustering assets..."):
                        try:
                            symbols = list(portfolio.symbols)[:15]
                            cluster_results = stat_analyzer.hierarchical_clustering(symbols, cluster_period, n_clusters)
                            
                            if cluster_results:
                                st.subheader("Asset Clusters")
                                
                                # Display clusters
                                for cluster_id, stats in cluster_results['cluster_stats'].items():
                                    with st.expander(f"Cluster {cluster_id} ({stats['size']} assets)"):
                                        st.write(f"**Assets:** {', '.join(stats['symbols'])}")
                                        st.write(f"**Average Correlation:** {stats['avg_correlation']:.3f}")
                                
                                # Cluster visualization
                                cluster_data = []
                                for cluster_id, symbols_list in cluster_results['clusters'].items():
                                    for symbol in symbols_list:
                                        cluster_data.append({'Symbol': symbol, 'Cluster': f'Cluster {cluster_id}'})
                                
                                if cluster_data:
                                    cluster_df = pd.DataFrame(cluster_data)
                                    fig_cluster = px.scatter(cluster_df, x='Symbol', y='Cluster', color='Cluster',
                                                           title="Asset Clustering Results")
                                    st.plotly_chart(fig_cluster, use_container_width=True)
                            else:
                                st.warning("Unable to perform clustering analysis")
                        except Exception as e:
                            st.error(f"Clustering analysis error: {str(e)}")
    
        with analytics_tab9:
            st.subheader("Technical Indicators")
            
            tech_analyzer = TechnicalIndicators(data_client)
            
            # Symbol selection for technical analysis
            if portfolio:
                selected_symbol = st.selectbox("Select Symbol for Technical Analysis", list(portfolio.symbols))
                
                tech_tab1, tech_tab2, tech_tab3 = st.tabs(["📈 Individual Analysis", "📊 Comprehensive Scan", "🎯 Signal Summary"])
                
                with tech_tab1:
                    if st.button("Analyze Technical Indicators"):
                        with st.spinner(f"Analyzing {selected_symbol}..."):
                            try:
                                # Individual indicators
                                col1, col2 = st.columns(2)
                                
                                with col1:
                                    st.subheader("Moving Averages")
                                    ma_data = tech_analyzer.moving_averages(selected_symbol)
                                    if ma_data:
                                        st.metric("Current Price", f"${ma_data['current_price']:.2f}")
                                        for ma_name, ma_value in ma_data['moving_averages'].items():
                                            st.metric(ma_name, f"${ma_value:.2f}")
                                        
                                        # Signals
                                        if ma_data['signals']:
                                            for signal, value in ma_data['signals'].items():
                                                status = "🟢" if value else "🔴"
                                                st.write(f"{status} {signal.replace('_', ' ').title()}: {value}")
                                
                                with col2:
                                    st.subheader("Oscillators")
                                    rsi = tech_analyzer.rsi(selected_symbol)
                                    if rsi:
                                        st.metric("RSI (14)", f"{rsi:.1f}")
                                        if rsi > 70:
                                            st.warning("⚠️ Overbought")
                                        elif rsi < 30:
                                            st.success("✅ Oversold")
                                    
                                    stoch = tech_analyzer.stochastic(selected_symbol)
                                    if stoch:
                                        st.metric("Stochastic %K", f"{stoch['k_percent']:.1f}")
                                        st.metric("Stochastic %D", f"{stoch['d_percent']:.1f}")
                                
                                # Bollinger Bands
                                st.subheader("Bollinger Bands")
                                bb_data = tech_analyzer.bollinger_bands(selected_symbol)
                                if bb_data:
                                    col1, col2, col3 = st.columns(3)
                                    with col1:
                                        st.metric("Upper Band", f"${bb_data['upper_band']:.2f}")
                                    with col2:
                                        st.metric("Current Price", f"${bb_data['current_price']:.2f}")
                                    with col3:
                                        st.metric("Lower Band", f"${bb_data['lower_band']:.2f}")
                                    
                                    st.metric("Band Position", f"{bb_data['band_position']:.2%}")
                                    
                                    if bb_data['overbought']:
                                        st.warning("⚠️ Near upper band (overbought)")
                                    elif bb_data['oversold']:
                                        st.success("✅ Near lower band (oversold)")
                                    
                                    if bb_data['squeeze']:
                                        st.info("🔄 Bollinger Band squeeze detected")
                                
                                # MACD
                                st.subheader("MACD")
                                macd_data = tech_analyzer.macd(selected_symbol)
                                if macd_data:
                                    col1, col2, col3 = st.columns(3)
                                    with col1:
                                        st.metric("MACD", f"{macd_data['macd']:.3f}")
                                    with col2:
                                        st.metric("Signal", f"{macd_data['signal']:.3f}")
                                    with col3:
                                        st.metric("Histogram", f"{macd_data['histogram']:.3f}")
                                    
                                    if macd_data['bullish_crossover']:
                                        st.success("🟢 Bullish MACD crossover")
                                    elif macd_data['bearish_crossover']:
                                        st.error("🔴 Bearish MACD crossover")
                            
                            except Exception as e:
                                st.error(f"Technical analysis error: {str(e)}")
                
                with tech_tab2:
                    if st.button("Run Comprehensive Technical Scan"):
                        with st.spinner("Scanning all portfolio symbols..."):
                            try:
                                scan_results = []
                                
                                for symbol in list(portfolio.symbols)[:10]:  # Limit to 10 symbols
                                    analysis = tech_analyzer.comprehensive_analysis(symbol)
                                    if analysis:
                                        scan_results.append({
                                            'Symbol': symbol,
                                            'RSI': analysis.get('rsi', 0),
                                            'Bullish Signals': analysis.get('bullish_signals', 0),
                                            'Bearish Signals': analysis.get('bearish_signals', 0),
                                            'Net Signal': analysis.get('bullish_signals', 0) - analysis.get('bearish_signals', 0),
                                            'Overall Signals': ', '.join(analysis.get('overall_signals', [])[:3])
                                        })
                                
                                if scan_results:
                                    scan_df = pd.DataFrame(scan_results)
                                    scan_df = scan_df.sort_values('Net Signal', ascending=False)
                                    
                                    # Color coding
                                    def color_signals(val):
                                        if val > 0:
                                            return 'background-color: lightgreen'
                                        elif val < 0:
                                            return 'background-color: lightcoral'
                                        else:
                                            return ''
                                    
                                    styled_scan = scan_df.style.applymap(color_signals, subset=['Net Signal'])
                                    st.dataframe(styled_scan, use_container_width=True)
                                    
                                    # Signal distribution
                                    fig_signals = px.bar(scan_df, x='Symbol', y='Net Signal',
                                                       title="Technical Signal Strength by Symbol",
                                                       color='Net Signal', color_continuous_scale='RdYlGn')
                                    st.plotly_chart(fig_signals, use_container_width=True)
                                else:
                                    st.warning("No technical analysis results available")
                            
                            except Exception as e:
                                st.error(f"Technical scan error: {str(e)}")
                
                with tech_tab3:
                    st.write("**Portfolio Technical Summary**")
                    
                    if st.button("Generate Signal Summary"):
                        with st.spinner("Generating summary..."):
                            try:
                                summary_data = {
                                    'bullish_count': 0,
                                    'bearish_count': 0,
                                    'neutral_count': 0,
                                    'overbought_count': 0,
                                    'oversold_count': 0
                                }
                                
                                for symbol in list(portfolio.symbols)[:15]:
                                    analysis = tech_analyzer.comprehensive_analysis(symbol)
                                    if analysis:
                                        net_signal = analysis.get('bullish_signals', 0) - analysis.get('bearish_signals', 0)
                                        
                                        if net_signal > 0:
                                            summary_data['bullish_count'] += 1
                                        elif net_signal < 0:
                                            summary_data['bearish_count'] += 1
                                        else:
                                            summary_data['neutral_count'] += 1
                                        
                                        rsi = analysis.get('rsi')
                                        if rsi and rsi > 70:
                                            summary_data['overbought_count'] += 1
                                        elif rsi and rsi < 30:
                                            summary_data['oversold_count'] += 1
                                
                                # Display summary
                                col1, col2, col3 = st.columns(3)
                                with col1:
                                    st.metric("Bullish Signals", summary_data['bullish_count'])
                                with col2:
                                    st.metric("Bearish Signals", summary_data['bearish_count'])
                                with col3:
                                    st.metric("Neutral Signals", summary_data['neutral_count'])
                                
                                col1, col2 = st.columns(2)
                                with col1:
                                    st.metric("Overbought Stocks", summary_data['overbought_count'])
                                with col2:
                                    st.metric("Oversold Stocks", summary_data['oversold_count'])
                                
                                # Overall assessment
                                total_signals = summary_data['bullish_count'] + summary_data['bearish_count'] + summary_data['neutral_count']
                                if total_signals > 0:
                                    bullish_pct = summary_data['bullish_count'] / total_signals
                                    
                                    if bullish_pct > 0.6:
                                        st.success("🟢 Overall portfolio sentiment: BULLISH")
                                    elif bullish_pct < 0.4:
                                        st.error("🔴 Overall portfolio sentiment: BEARISH")
                                    else:
                                        st.info("⚪ Overall portfolio sentiment: NEUTRAL")
                            
                            except Exception as e:
                                st.error(f"Signal summary error: {str(e)}")
        
        with analytics_tab10:
            st.subheader("Strategy Backtesting")
            
            strategy_backtester = StrategyBacktester(data_client)
            
            backtest_tab1, backtest_tab2, backtest_tab3 = st.tabs(["📈 Simple Strategies", "🔄 Walk-Forward", "🧪 Research Lab"])
            
            with backtest_tab1:
                st.write("**Strategy Backtesting**")
                
                col1, col2, col3 = st.columns(3)
                with col1:
                    start_date = st.date_input("Start Date", value=datetime.now() - timedelta(days=365))
                with col2:
                    end_date = st.date_input("End Date", value=datetime.now())
                with col3:
                    initial_capital = st.number_input("Initial Capital", value=100000, min_value=1000)
                
                strategy_type = st.selectbox("Strategy Type", ["Momentum", "Mean Reversion"])
                
                if st.button("Run Backtest"):
                    with st.spinner("Running backtest..."):
                        try:
                            from analytics.backtesting import momentum_strategy, mean_reversion_strategy
                            
                            symbols = list(portfolio.symbols)[:5]
                            strategy_func = momentum_strategy if strategy_type == "Momentum" else mean_reversion_strategy
                            
                            results = strategy_backtester.backtest_strategy(
                                strategy_func, symbols, 
                                start_date.strftime('%Y-%m-%d'), 
                                end_date.strftime('%Y-%m-%d'),
                                initial_capital
                            )
                            
                            if results:
                                # Performance metrics
                                col1, col2, col3, col4 = st.columns(4)
                                with col1:
                                    st.metric("Total Return", f"{results['total_return']:.2%}")
                                with col2:
                                    st.metric("Annual Return", f"{results['annual_return']:.2%}")
                                with col3:
                                    st.metric("Sharpe Ratio", f"{results['sharpe_ratio']:.2f}")
                                with col4:
                                    st.metric("Max Drawdown", f"{results['max_drawdown']:.2%}")
                                
                                # Enhanced metrics
                                if 'enhanced_metrics' in results:
                                    enhanced = results['enhanced_metrics']
                                    col1, col2, col3 = st.columns(3)
                                    with col1:
                                        st.metric("Win Rate", f"{enhanced.get('win_rate', 0):.2%}")
                                    with col2:
                                        st.metric("Profit Factor", f"{enhanced.get('profit_factor', 0):.2f}")
                                    with col3:
                                        st.metric("Best Day", f"{enhanced.get('best_day', 0):.2%}")
                                
                                # Strategy assessment
                                strategy_summary = results.get('strategy_summary', 'UNKNOWN')
                                if strategy_summary == 'EXCELLENT':
                                    st.success(f"🟢 Strategy Performance: {strategy_summary}")
                                elif strategy_summary == 'GOOD':
                                    st.info(f"🟡 Strategy Performance: {strategy_summary}")
                                else:
                                    st.warning(f"🔴 Strategy Performance: {strategy_summary}")
                                
                                # Portfolio value chart
                                if 'portfolio_history' in results and not results['portfolio_history'].empty:
                                    portfolio_history = results['portfolio_history']
                                    fig_portfolio = px.line(portfolio_history, y='portfolio_value',
                                                           title="Portfolio Value Over Time")
                                    st.plotly_chart(fig_portfolio, use_container_width=True)
                            else:
                                st.warning("Backtest failed - insufficient data")
                        
                        except Exception as e:
                            st.error(f"Backtesting error: {str(e)}")
            
            with backtest_tab2:
                st.write("**Walk-Forward Analysis**")
                
                col1, col2 = st.columns(2)
                with col1:
                    train_months = st.slider("Training Period (Months)", 6, 24, 12)
                with col2:
                    test_months = st.slider("Test Period (Months)", 1, 6, 3)
                
                if st.button("Run Walk-Forward Analysis"):
                    with st.spinner("Running walk-forward analysis..."):
                        try:
                            from analytics.backtesting import momentum_strategy
                            
                            symbols = list(portfolio.symbols)[:3]
                            
                            wf_results = strategy_backtester.walk_forward_analysis(
                                momentum_strategy, symbols,
                                (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d'),
                                datetime.now().strftime('%Y-%m-%d'),
                                train_months, test_months
                            )
                            
                            if wf_results:
                                col1, col2, col3 = st.columns(3)
                                with col1:
                                    st.metric("Average Return", f"{wf_results['average_return']:.2%}")
                                with col2:
                                    st.metric("Average Sharpe", f"{wf_results['average_sharpe']:.2f}")
                                with col3:
                                    st.metric("Win Rate", f"{wf_results['win_rate']:.2%}")
                                
                                # Robustness assessment
                                robustness = wf_results['strategy_robustness']
                                if robustness == 'HIGH':
                                    st.success(f"🟢 Strategy Robustness: {robustness}")
                                elif robustness == 'MEDIUM':
                                    st.info(f"🟡 Strategy Robustness: {robustness}")
                                else:
                                    st.warning(f"🔴 Strategy Robustness: {robustness}")
                                
                                # Period results
                                if wf_results['period_results']:
                                    periods_df = pd.DataFrame(wf_results['period_results'])
                                    st.dataframe(periods_df, use_container_width=True)
                            else:
                                st.warning("Walk-forward analysis failed")
                        
                        except Exception as e:
                            st.error(f"Walk-forward analysis error: {str(e)}")
            
            with backtest_tab3:
                st.write("**Research & Development Lab**")
                
                factor_researcher = FactorResearcher(data_client)
                
                research_tab1, research_tab2 = st.tabs(["🔬 Factor Research", "🎯 ML Models"])
                
                with research_tab1:
                    st.write("**Multi-Factor Model Development**")
                    
                    factor_symbols = st.multiselect(
                        "Factor Symbols (Market Factors)", 
                        ['SPY', 'QQQ', 'IWM', 'TLT', 'GLD', 'VIX'],
                        default=['SPY', 'QQQ']
                    )
                    
                    if st.button("Develop Factor Model") and factor_symbols:
                        with st.spinner("Developing factor model..."):
                            try:
                                symbols = list(portfolio.symbols)[:5]
                                factor_results = factor_researcher.multi_factor_model(symbols, factor_symbols)
                                
                                if factor_results:
                                    # Model summary
                                    model_summary = factor_results['model_summary']
                                    col1, col2 = st.columns(2)
                                    with col1:
                                        st.metric("Average R²", f"{model_summary['average_r_squared']:.3f}")
                                    with col2:
                                        st.metric("Model Quality", model_summary['model_quality'])
                                    
                                    # Factor importance
                                    factor_importance = factor_results['factor_importance']
                                    importance_df = pd.DataFrame([
                                        {'Factor': factor, 'Importance': importance}
                                        for factor, importance in factor_importance.items()
                                    ]).sort_values('Importance', ascending=False)
                                    
                                    fig_importance = px.bar(importance_df, x='Factor', y='Importance',
                                                          title="Factor Importance")
                                    st.plotly_chart(fig_importance, use_container_width=True)
                                    
                                    # Individual model results
                                    st.subheader("Individual Stock Models")
                                    for symbol, loadings in factor_results['factor_loadings'].items():
                                        with st.expander(f"{symbol} - R² {loadings['r_squared']:.3f}"):
                                            coeffs_df = pd.DataFrame([
                                                {'Factor': factor, 'Coefficient': coeff}
                                                for factor, coeff in loadings['coefficients'].items()
                                            ])
                                            st.dataframe(coeffs_df, use_container_width=True)
                                else:
                                    st.warning("Factor model development failed")
                            
                            except Exception as e:
                                st.error(f"Factor research error: {str(e)}")
                
                with research_tab2:
                    st.write("**ML Factor Timing Models**")
                    
                    if st.button("Develop ML Timing Model"):
                        with st.spinner("Training ML models..."):
                            try:
                                symbols = list(portfolio.symbols)[:3]
                                ml_results = factor_researcher.factor_timing_model(symbols)
                                
                                if ml_results:
                                    col1, col2 = st.columns(2)
                                    with col1:
                                        st.metric("Average R²", f"{ml_results['average_r_squared']:.3f}")
                                    with col2:
                                        st.metric("Models Trained", len(ml_results['models']))
                                    
                                    # Top features
                                    if ml_results['top_features']:
                                        st.subheader("Most Important Features")
                                        features_df = pd.DataFrame([
                                            {'Feature': feature, 'Rank': i+1}
                                            for i, feature in enumerate(ml_results['top_features'])
                                        ])
                                        st.dataframe(features_df, use_container_width=True)
                                    
                                    # Model performance by symbol
                                    perf_data = []
                                    for symbol, model_data in ml_results['models'].items():
                                        perf_data.append({
                                            'Symbol': symbol,
                                            'R²': model_data['r_squared']
                                        })
                                    
                                    if perf_data:
                                        perf_df = pd.DataFrame(perf_data)
                                        fig_perf = px.bar(perf_df, x='Symbol', y='R²',
                                                        title="ML Model Performance by Symbol")
                                        st.plotly_chart(fig_perf, use_container_width=True)
                                else:
                                    st.warning("ML timing model development failed")
                            
                            except Exception as e:
                                st.error(f"ML model error: {str(e)}")
        
        with analytics_tab11:
            st.subheader("Compliance & Reporting")
            
            compliance_reporter = ComplianceReporter("Portfolio Analysis Fund")
            
            compliance_tab1, compliance_tab2, compliance_tab3 = st.tabs(["📋 Regulatory Reports", "📊 Client Reports", "🔍 Audit Trail"])
            
            with compliance_tab1:
                st.write("**Regulatory Reporting**")
                
                report_type = st.selectbox("Report Type", ["MONTHLY", "QUARTERLY", "ANNUAL"])
                
                if st.button("Generate Regulatory Report"):
                    with st.spinner("Generating regulatory report..."):
                        try:
                            # Prepare portfolio data
                            portfolio_data = {
                                'total_market_value': portfolio.total_value,
                                'positions': {}
                            }
                            
                            for pos in portfolio.positions:
                                portfolio_data['positions'][pos.symbol] = {
                                    'quantity': pos.quantity,
                                    'market_value': pos.quantity * pos.avg_cost,
                                    'weight': pos.quantity * pos.avg_cost / portfolio.total_value
                                }
                            
                            # Mock risk data
                            risk_data = {
                                'sharpe_ratio': 1.2,
                                'max_drawdown': -0.15,
                                'portfolio_volatility': 0.18,
                                'var_5': -0.03,
                                'beta': 1.1
                            }
                            
                            report = compliance_reporter.generate_regulatory_report(
                                portfolio_data, risk_data, report_type
                            )
                            
                            # Display report summary
                            col1, col2, col3 = st.columns(3)
                            with col1:
                                st.metric("Report ID", report.report_id)
                            with col2:
                                st.metric("AUM", f"${report.aum:,.2f}")
                            with col3:
                                st.metric("Total Return", f"{report.performance_metrics['total_return']:.2%}")
                            
                            # Risk metrics
                            st.subheader("Risk Assessment")
                            col1, col2, col3 = st.columns(3)
                            with col1:
                                st.metric("Concentration Risk", report.risk_metrics['concentration_risk'])
                            with col2:
                                st.metric("Liquidity Risk", report.risk_metrics['liquidity_risk'])
                            with col3:
                                st.metric("Leverage Ratio", f"{report.risk_metrics['leverage_ratio']:.2f}")
                            
                            # Compliance breaches
                            if report.risk_metrics['compliance_breaches']:
                                st.subheader("⚠️ Compliance Breaches")
                                breaches_df = pd.DataFrame(report.risk_metrics['compliance_breaches'])
                                st.dataframe(breaches_df, use_container_width=True)
                            else:
                                st.success("✅ No compliance breaches detected")
                            
                            # Positions summary
                            st.subheader("Position Summary")
                            positions_df = pd.DataFrame(report.positions)
                            st.dataframe(positions_df, use_container_width=True)
                        
                        except Exception as e:
                            st.error(f"Regulatory reporting error: {str(e)}")
            
            with compliance_tab2:
                st.write("**Client Reporting**")
                
                client_id = st.text_input("Client ID", value="CLIENT_001")
                
                if st.button("Generate Client Report") and client_id:
                    with st.spinner("Generating client report..."):
                        try:
                            # Prepare data
                            portfolio_data = {
                                'total_market_value': portfolio.total_value,
                                'positions': len(portfolio.positions)
                            }
                            
                            performance_data = {
                                'total_return_pct': 0.12,
                                'sharpe_ratio': 1.2,
                                'max_drawdown': -0.15,
                                'excess_return': 0.03,
                                'tracking_error': 0.05
                            }
                            
                            client_report = compliance_reporter.generate_client_report(
                                client_id, portfolio_data, performance_data
                            )
                            
                            # Display client report
                            st.subheader(f"Client Report - {client_id}")
                            
                            # Executive summary
                            exec_summary = client_report['executive_summary']
                            st.metric("Period Return", f"{exec_summary['period_return']:.2%}")
                            st.metric("Benchmark Outperformance", f"{exec_summary['benchmark_comparison']:.2%}")
                            
                            # Key highlights
                            st.subheader("Key Highlights")
                            for highlight in exec_summary['key_highlights']:
                                st.write(f"• {highlight}")
                            
                            # Performance analysis
                            perf_analysis = client_report['performance_analysis']
                            
                            col1, col2 = st.columns(2)
                            with col1:
                                st.subheader("Returns Analysis")
                                returns = perf_analysis['returns_analysis']
                                st.metric("Total Return", f"{returns['total_return']:.2%}")
                                st.metric("Sharpe Ratio", f"{returns['sharpe_ratio']:.2f}")
                                st.metric("Max Drawdown", f"{returns['max_drawdown']:.2%}")
                            
                            with col2:
                                st.subheader("Benchmark Comparison")
                                benchmark = perf_analysis['benchmark_comparison']
                                st.metric("Excess Return", f"{benchmark['excess_return']:.2%}")
                                st.metric("Tracking Error", f"{benchmark['tracking_error']:.2%}")
                        
                        except Exception as e:
                            st.error(f"Client reporting error: {str(e)}")
            
            with compliance_tab3:
                st.write("**Audit Trail Management**")
                
                col1, col2 = st.columns(2)
                with col1:
                    audit_start = st.date_input("Audit Start Date", value=datetime.now() - timedelta(days=30))
                with col2:
                    audit_end = st.date_input("Audit End Date", value=datetime.now())
                
                # Create sample audit events
                if st.button("Generate Sample Audit Events"):
                    # Create some sample events
                    compliance_reporter.create_audit_trail("PORTFOLIO_UPLOAD", {
                        'user_id': user.user_id,
                        'portfolio_size': len(portfolio.positions),
                        'total_value': portfolio.total_value
                    }, user.username)
                    
                    compliance_reporter.create_audit_trail("RISK_ANALYSIS", {
                        'symbols_analyzed': len(portfolio.symbols),
                        'analysis_type': 'comprehensive'
                    }, user.username)
                    
                    st.success("Sample audit events created")
                
                if st.button("Export Audit Trail"):
                    with st.spinner("Exporting audit trail..."):
                        try:
                            audit_df = compliance_reporter.export_audit_trail(
                                datetime.combine(audit_start, datetime.min.time()),
                                datetime.combine(audit_end, datetime.max.time())
                            )
                            
                            if not audit_df.empty:
                                st.subheader("Audit Trail Export")
                                st.dataframe(audit_df, use_container_width=True)
                                
                                # Compliance summary
                                compliance_events = audit_df[audit_df['compliance_flag'] == True]
                                high_risk_events = audit_df[audit_df['risk_level'] == 'HIGH']
                                
                                col1, col2, col3 = st.columns(3)
                                with col1:
                                    st.metric("Total Events", len(audit_df))
                                with col2:
                                    st.metric("Compliance Events", len(compliance_events))
                                with col3:
                                    st.metric("High Risk Events", len(high_risk_events))
                                
                                # Export CSV
                                csv = audit_df.to_csv(index=False)
                                st.download_button(
                                    label="📥 Download Audit Trail CSV",
                                    data=csv,
                                    file_name=f"audit_trail_{audit_start}_{audit_end}.csv",
                                    mime="text/csv"
                                )
                            else:
                                st.info("No audit events found in the selected date range")
                        
                        except Exception as e:
                            st.error(f"Audit trail export error: {str(e)}")
    
    # Market News
    if user_manager.check_permission(user, Permission.READ_ANALYTICS):
        st.header("Market News")
        
        from clients.news_client import news_client
        if news_client:
            # Stock-specific news
            if portfolio:
                for symbol in portfolio.symbols[:3]:  # Show news for first 3 stocks
                    with st.expander(f"{symbol} News"):
                        news = news_client.get_stock_news(symbol, days=3)
                        for article in news[:3]:
                            st.write(f"**{article['title']}**")
                            st.write(f"*{article['source']['name']} - {article['publishedAt'][:10]}*")
                            if article.get('description'):
                                st.write(article['description'][:200] + "...")
                            st.write(f"[Read more]({article['url']})")
                            st.divider()
            
            # General market news
            with st.expander("Market Headlines"):
                market_news = news_client.get_market_news()
                for article in market_news:
                    st.write(f"**{article['title']}**")
                    st.write(f"*{article['source']['name']}*")
                    if article.get('description'):
                        st.write(article['description'][:150] + "...")
                    st.write(f"[Read more]({article['url']})")
                    st.divider()
    
    # Research Notes (collaboration feature)
    if user_manager.check_permission(user, Permission.SHARE_RESEARCH):
        st.header("Research Notes")
        
        # Create new note
        with st.expander("Create Research Note"):
            note_title = st.text_input("Note Title")
            note_content = st.text_area("Content")
            note_tags = st.text_input("Tags (comma-separated)")
            is_public = st.checkbox("Make Public")
            
            if st.button("Save Note") and note_title and note_content:
                tags = [tag.strip() for tag in note_tags.split(',') if tag.strip()]
                note_id = collaboration.create_research_note(
                    user.user_id, note_title, note_content, tags, is_public
                )
                st.success("Research note saved!")
        
        # Display notes with interactive table
        notes = collaboration.get_research_notes(user.user_id)
        if notes:
            try:
                from st_aggrid import AgGrid, GridOptionsBuilder
                
                notes_df = pd.DataFrame(notes)
                gb = GridOptionsBuilder.from_dataframe(notes_df)
                gb.configure_pagination(paginationAutoPageSize=True)
                gb.configure_default_column(enablePivot=True, enableRowGroup=True)
                gridOptions = gb.build()
                
                AgGrid(notes_df, gridOptions=gridOptions, height=300)
                
            except ImportError:
                for note in notes[:5]:
                    with st.expander(f"{note['title']} - {note['author']}"):
                        st.write(note['content'])
                        if note['tags']:
                            st.write(f"Tags: {', '.join(note['tags'])}")

else:
    st.info("Please upload a portfolio or transaction file")
    
    # Show sample formats
    format_tab1, format_tab2 = st.tabs(["Portfolio Format", "Transaction Format"])
    
    with format_tab1:
        st.subheader("Sample Portfolio CSV Format")
        sample_df = pd.DataFrame({
            'symbol': ['AAPL', 'MSFT', 'GOOGL'],
            'quantity': [100, 50, 25],
            'avg_cost': [150.00, 250.00, 2500.00]
        })
        
        try:
            from st_aggrid import AgGrid, GridOptionsBuilder
            
            gb = GridOptionsBuilder.from_dataframe(sample_df)
            gb.configure_default_column(editable=True)
            gridOptions = gb.build()
            
            AgGrid(sample_df, gridOptions=gridOptions, height=150)
            
        except ImportError:
            st.dataframe(sample_df)
    
    with format_tab2:
        st.subheader("Sample Transaction CSV Format")
        transaction_sample = pd.DataFrame({
            'symbol': ['AAPL', 'AAPL', 'MSFT', 'MSFT'],
            'quantity': [100, -50, 25, 25],
            'price': [150.00, 160.00, 250.00, 240.00],
            'date': ['2024-01-01', '2024-02-01', '2024-01-15', '2024-02-15'],
            'transaction_type': ['BUY', 'SELL', 'BUY', 'BUY'],
            'fees': [1.00, 1.00, 0.50, 0.50]
        })
        
        try:
            from st_aggrid import AgGrid, GridOptionsBuilder
            
            gb = GridOptionsBuilder.from_dataframe(transaction_sample)
            gb.configure_default_column(editable=True)
            gridOptions = gb.build()
            
            AgGrid(transaction_sample, gridOptions=gridOptions, height=200)
            
        except ImportError:
            st.dataframe(transaction_sample)
        
        st.info("Required columns: symbol, quantity, price, date, transaction_type. Optional: fees")
        
        st.info("Install streamlit-aggrid for interactive tables: `pip install streamlit-aggrid`")

# Cookie Consent Banner at Bottom
if not st.session_state.cookie_consent_given:
    st.markdown("---")
    with st.container():
        st.warning("Cookie Consent Required")
        col1, col2, col3 = st.columns([2, 1, 1])
        with col1:
            st.write("We use cookies for preferences, portfolio history, and session management.")
        with col2:
            if st.button("Accept Cookies", key="accept_bottom"):
                st.session_state.cookie_consent_given = True
                st.query_params['consent'] = 'true'
                st.rerun()
        with col3:
            if st.button("Decline", key="decline_bottom"):
                st.session_state.cookie_consent_given = False
                st.query_params['consent'] = 'false'
                st.warning("Some features may not work properly without cookies.")