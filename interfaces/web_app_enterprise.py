import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import sys
import os
from dotenv import load_dotenv
import hashlib
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

# Auto-start API server in background
import threading
import subprocess
import time

def start_api_server():
    """Start API server in background thread"""
    try:
        subprocess.Popen(["python", "enterprise/api_server.py"], 
                        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    except Exception as e:
        print(f"Failed to start API server: {e}")

# Start API server if not already running
if 'api_server_started' not in st.session_state:
    threading.Thread(target=start_api_server, daemon=True).start()
    st.session_state.api_server_started = True

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
    show_login()
    st.stop()

user = st.session_state.user

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
        
        if user_portfolios:
            portfolio_names = [p['portfolio_name'] for p in user_portfolios]
            selected_portfolio = st.selectbox("Load Portfolio", ["None"] + portfolio_names)
        
        if user_transactions:
            st.subheader("My Transactions")
            transaction_names = [t['transaction_set_name'] for t in user_transactions]
            selected_transactions = st.selectbox("Load Transactions", ["None"] + transaction_names)
            
            if selected_transactions != "None":
                transaction_data = next(t for t in user_transactions if t['transaction_set_name'] == selected_transactions)
                st.session_state.current_transactions = transaction_data
            
            if selected_portfolio != "None" and can_write_portfolio:
                if st.button("Delete", type="secondary"):
                    portfolio_to_delete = next(p for p in user_portfolios if p['portfolio_name'] == selected_portfolio)
                    if supabase_client and supabase_client.delete_portfolio(portfolio_to_delete['id'], user.user_id):
                        st.success(f"Portfolio '{selected_portfolio}' deleted!")
                        if 'current_portfolio' in st.session_state:
                            del st.session_state.current_portfolio
                        st.rerun()
                    else:
                        st.error("Failed to delete portfolio")
            
            if selected_portfolio != "None":
                portfolio_data = next(p for p in user_portfolios if p['portfolio_name'] == selected_portfolio)
                st.session_state.current_portfolio = portfolio_data
        
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
    if plaid_client:
        # Create link token for Plaid Link
        if 'plaid_link_token' not in st.session_state:
            link_token = plaid_client.create_link_token(user.user_id)
            if link_token:
                st.session_state.plaid_link_token = link_token
        
        if 'plaid_link_token' in st.session_state:
            # Link token is ready but don't display it
            
            # Instructions to get public token
            with st.expander("How to get Public Token"):
                st.write("**Step 1:** Go to Plaid Link Demo")
                st.markdown("[Open Plaid Link Demo](https://plaid.com/docs/link/web/)")
                
                st.write("**Step 2:** Scroll down to 'Try Link' section")
                st.write("**Step 3:** Click 'Open Link' button")
                st.write("**Step 4:** Select 'First Platypus Bank' (sandbox)")
                st.write("**Step 5:** Use credentials: user_good / pass_good")
                st.write("**Step 6:** Select accounts and continue")
                st.write("**Step 7:** Copy the public_token from console/result")
                st.write("**Step 8:** Paste it below")
                

            

        
        # Manual token input
        st.subheader("Import Portfolio Data")
        public_token = st.text_input("Public Token (from Plaid Link)")
        if st.button("Import Portfolio") and public_token:
            access_token = plaid_client.exchange_public_token(public_token)
            if access_token:
                # Get holdings
                holdings_df = plaid_client.get_holdings(access_token)
                if not holdings_df.empty:
                    st.success(f"Imported {len(holdings_df)} holdings!")
                    st.session_state.plaid_portfolio = holdings_df
                
                # Get transactions
                transactions_df = plaid_client.get_transactions(access_token, days=90)
                if not transactions_df.empty:
                    st.success(f"Imported {len(transactions_df)} transactions!")
                    st.session_state.plaid_transactions = transactions_df
                    
                    # Show transaction summary with pivot capabilities
                    with st.expander("📊 Transaction Analysis"):
                        try:
                            from st_aggrid import AgGrid, GridOptionsBuilder
                            
                            gb = GridOptionsBuilder.from_dataframe(transactions_df)
                            gb.configure_pagination(paginationAutoPageSize=True)
                            gb.configure_side_bar()
                            gb.configure_default_column(enablePivot=True, enableValue=True, enableRowGroup=True)
                            gb.configure_column('amount', type=['numericColumn'], precision=2)
                            gb.configure_column('date', type=['dateColumn'])
                            gridOptions = gb.build()
                            
                            AgGrid(
                                transactions_df,
                                gridOptions=gridOptions,
                                enable_enterprise_modules=True,
                                height=400
                            )
                            
                            st.info("💡 **Analysis Tips:** Group by 'transaction_type' in Row Groups, add 'amount' to Values for aggregation")
                            
                        except ImportError:
                            transaction_summary = transactions_df.groupby('transaction_type').agg({
                                'amount': ['count', 'sum']
                            }).round(2)
                            st.dataframe(transaction_summary)
                
                if holdings_df.empty and transactions_df.empty:
                    st.warning("No data found")
            else:
                st.error("Failed to exchange token")
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
            st.info("Setting up SnapTrade connection...")
            if st.button("Generate SnapTrade Secret"):
                user_secret = user_secret_manager.generate_snaptrade_secret(user.user_id)
                st.success("SnapTrade secret generated!")
                st.rerun()
        else:
            st.success("SnapTrade secret configured")
            
            # Brokerage selection
            selected_brokerage_id = snaptrade_connect.render_brokerage_selector()
            
            # Connection modal
            connection_success = snaptrade_connect.render_connection_modal(user.user_id, selected_brokerage_id)
            
            # Account summary
            snaptrade_connect.render_account_summary(user.user_id)
            
            # Secret management for admins
            if user.role == UserRole.ADMIN:
                with st.expander("Secret Management"):
                    if st.button("Regenerate Secret"):
                        user_secret_manager.delete_specific_secret(user.user_id, 'snaptrade_secret')
                        new_secret = user_secret_manager.generate_snaptrade_secret(user.user_id)
                        st.success("Secret regenerated!")
                        st.rerun()
    else:
        st.info("SnapTrade not configured - check Config.SNAPTRADE_CLIENT_ID")
    
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
            avg_cost = row['cost_basis'] / row['quantity'] if row['quantity'] > 0 else row['institution_price']
            portfolio_data.append({
                'symbol': row['symbol'],
                'quantity': row['quantity'],
                'avg_cost': avg_cost
            })
    
    if portfolio_data:
        df = pd.DataFrame(portfolio_data)
        plaid_portfolio = Portfolio.from_dataframe(df)

# Check if any portfolio/transaction data exists and set up upload section
has_portfolio = current_portfolio or plaid_portfolio or current_transactions
header_text = "Add New Data" if has_portfolio else "Upload Data"
st.header(header_text)

data_type = st.radio("Data Type", ["Portfolio Positions", "Transaction History"], horizontal=True)

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
    
    upload_text = "Add Transaction File" if has_portfolio else "Upload Transaction File"
    uploaded_file = st.file_uploader(
        upload_text, 
        type=['csv', 'xlsx', 'xls'],
        help="CSV with transaction history"
    )

# Show Plaid transactions if available
if 'plaid_transactions' in st.session_state:
    with st.sidebar:
        st.header("Account Activity")
        transactions_df = st.session_state.plaid_transactions
        
        # Transaction type filter
        transaction_types = transactions_df['transaction_type'].unique()
        selected_types = st.multiselect("Filter by Type", transaction_types, default=transaction_types)
        
        if selected_types:
            filtered_transactions = transactions_df[transactions_df['transaction_type'].isin(selected_types)]
            
            # Show summary metrics
            total_deposits = filtered_transactions[filtered_transactions['transaction_type'] == 'deposit']['amount'].sum()
            total_withdrawals = filtered_transactions[filtered_transactions['transaction_type'] == 'withdraw']['amount'].sum()
            total_dividends = filtered_transactions[filtered_transactions['transaction_type'] == 'dividend']['amount'].sum()
            
            st.metric("Total Deposits", f"${total_deposits:,.2f}")
            st.metric("Total Withdrawals", f"${total_withdrawals:,.2f}")
            st.metric("Total Dividends", f"${total_dividends:,.2f}")
        
        st.divider()

if uploaded_file or current_portfolio or plaid_portfolio or current_transactions:
    if uploaded_file and st.session_state.get('uploaded_file_processed') != uploaded_file.name:
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
                if st.button("Save Portfolio") and portfolio_name:
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
        
        if cached_metrics:
            st.info("Risk Analysis")
            metrics = cached_metrics
            st.metric("Portfolio Volatility", f"{metrics['portfolio_volatility']:.2%}")
            st.metric("Average Correlation", f"{metrics['avg_correlation']:.3f}")
            
            # Correlation heatmap
            corr_matrix = metrics['correlation_matrix']
            if hasattr(corr_matrix, 'values'):
                corr_data = corr_matrix.values
            else:
                corr_data = corr_matrix
            
            if hasattr(corr_data, 'size') and corr_data.size > 0:
                fig = px.imshow(corr_data, title="Correlation Matrix")
                st.plotly_chart(fig)
            else:
                try:
                    symbols = [s for s in list(portfolio.symbols)[:5] if s and s.strip()]
                    if symbols:
                        price_data = data_client.get_price_data(symbols, "1mo")
                    else:
                        raise Exception("No valid symbols")
                    returns = price_data.pct_change(fill_method=None).dropna()
                    real_corr = returns.corr()
                    fig = px.imshow(real_corr.values, x=real_corr.columns, y=real_corr.index, title="Correlation Matrix", color_continuous_scale='RdBu')
                    st.plotly_chart(fig)
                except:
                    st.info("Market data unavailable - correlation matrix not displayed")
            
            if st.button("Recalculate Risk Analysis"):
                cache_manager.invalidate_user_cache(user.user_id)
                st.rerun()
        else:
            if st.button("Calculate Risk Analysis"):
                with st.spinner("Calculating risk metrics..."):
                    weights = portfolio.get_weights()
                    
                    try:
                        from analytics.risk_analytics_polars import RiskAnalyzerPolars
                        risk_analyzer = RiskAnalyzerPolars(data_client)
                        metrics = risk_analyzer.analyze_portfolio_risk_ultra_fast(portfolio.symbols, weights)
                    except ImportError:
                        st.warning("Install polars: pip install polars")
                        risk_analyzer = RiskAnalyzer(data_client)
                        metrics = risk_analyzer.analyze_portfolio_risk_fast(portfolio.symbols, weights)
                    
                    # Cache results with prefix
                    cache_manager.set_portfolio_data(user.user_id, f"risk_{portfolio_hash}", metrics, expire_hours=24)
                    
                    # Check for risk alerts
                    if Config.ENABLE_RISK_ALERTS and email_service.enabled:
                        portfolio_volatility = metrics.get('portfolio_volatility', 0)
                        var_95 = metrics.get('var_95', 0)
                        
                        # Check thresholds
                        if var_95 > Config.RISK_THRESHOLD_CRITICAL:
                            threshold_type = "CRITICAL"
                            should_alert = True
                        elif var_95 > Config.RISK_THRESHOLD_HIGH:
                            threshold_type = "HIGH"
                            should_alert = True
                        else:
                            should_alert = False
                        
                        if should_alert:
                            # Send risk alert email
                            portfolio_name = st.session_state.get('current_portfolio', {}).get('portfolio_name', 'Current Portfolio')
                            email_sent = email_service.send_risk_alert(
                                [user.email], 
                                portfolio_name, 
                                metrics, 
                                threshold_type
                            )
                            
                            if email_sent:
                                st.warning(f"⚠️ {threshold_type} risk alert sent to {user.email}")
                            
                            # Log the alert
                            logger.warning(f"Risk alert triggered for user {user.username}: VaR {var_95:.2%} exceeds {threshold_type} threshold")
                    
                    st.rerun()
        
        with col2:
            if st.button("Download Portseido Template"):
                from clients.portseido_client import portseido_client
                template_bytes = portseido_client.generate_portseido_template()
                st.download_button(
                    label="Download Excel Template",
                    data=template_bytes,
                    file_name="portseido_template.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
                st.info("1. Download template\n2. Input your trades\n3. Upload below")
    
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
            from XIRR.xirr_calculator import XIRRCalculator
            
            if portfolio:
                try:
                    calculator = XIRRCalculator()
                    
                    # Get current prices automatically
                    symbols = list(portfolio.symbols)[:10]
                    current_prices = data_client.get_current_prices(symbols)
                    
                    if current_prices:
                        # Add sample transactions based on portfolio positions
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
                            st.metric("XIRR", f"{report['xirr']:.2%}")
                        with col2:
                            st.metric("Total Return", f"${report['total_return']:,.2f}")
                        with col3:
                            st.metric("Return %", f"{report['total_return_pct']:.2%}")
                    else:
                        st.warning("Unable to fetch current prices for XIRR calculation")
                        
                except Exception as e:
                    st.error(f"XIRR calculation error: {str(e)}")
            else:
                st.info("Upload portfolio to see XIRR analysis")
        
        with analytics_tab5:
            st.subheader("Monte Carlo Portfolio Simulation")
            from monte_carlo_v3 import MonteCarloEngine
            
            mc_engine = MonteCarloEngine(data_client)
            
            col1, col2, col3 = st.columns(3)
            with col1:
                time_horizon = st.slider("Time Horizon (Days)", 30, 1000, 252)
            with col2:
                num_simulations = st.slider("Simulations", 1000, 50000, 10000, 1000)
            with col3:
                confidence_level = st.selectbox("Confidence Level", [0.90, 0.95, 0.99], index=1)
            
            if st.button("Run Monte Carlo Simulation"):
                with st.spinner("Running Monte Carlo simulation..."):
                    try:
                        weights = portfolio.get_weights()
                        results = mc_engine.portfolio_simulation(
                            list(portfolio.symbols), weights, time_horizon, num_simulations
                        )
                        
                        # Display key metrics
                        col1, col2, col3, col4 = st.columns(4)
                        with col1:
                            st.metric("Expected Return", f"{results['expected_return']:.2%}")
                        with col2:
                            st.metric("Volatility", f"{results['volatility']:.2%}")
                        with col3:
                            st.metric("Probability of Loss", f"{results['probability_loss']:.2%}")
                        with col4:
                            st.metric("95th Percentile", f"{results['percentiles']['95th']:.3f}")
                        
                        # Percentiles chart
                        percentiles_df = pd.DataFrame([
                            {'Percentile': k, 'Value': v} 
                            for k, v in results['percentiles'].items()
                        ])
                        fig_percentiles = px.bar(percentiles_df, x='Percentile', y='Value',
                                               title="Portfolio Value Percentiles")
                        st.plotly_chart(fig_percentiles, use_container_width=True)
                        
                        # Final values distribution
                        final_values_df = pd.DataFrame({'Final Values': results['final_values']})
                        fig_dist = px.histogram(final_values_df, x='Final Values', nbins=50,
                                              title="Distribution of Final Portfolio Values")
                        fig_dist.add_vline(x=results['mean_final_value'], line_dash="dash", 
                                         annotation_text="Mean")
                        st.plotly_chart(fig_dist, use_container_width=True)
                        
                        # Risk analysis
                        risk_metrics = mc_engine.risk_modeling(list(portfolio.symbols), weights)
                        
                        st.subheader("Risk Metrics")
                        risk_col1, risk_col2, risk_col3 = st.columns(3)
                        with risk_col1:
                            st.metric("VaR (95%)", f"{risk_metrics.get('VaR_95', 0):.2%}")
                        with risk_col2:
                            st.metric("CVaR (95%)", f"{risk_metrics.get('CVaR_95', 0):.2%}")
                        with risk_col3:
                            st.metric("Max Drawdown", f"{risk_metrics.get('max_drawdown', 0):.2%}")
                        
                        # Scenario analysis
                        scenarios = {
                            'Bull Market': {'mean_return': 0.12, 'volatility': 0.15},
                            'Bear Market': {'mean_return': -0.05, 'volatility': 0.25},
                            'Normal Market': {'mean_return': 0.08, 'volatility': 0.18}
                        }
                        
                        scenario_results = mc_engine.scenario_analysis(list(portfolio.symbols), weights, scenarios)
                        
                        st.subheader("Scenario Analysis")
                        scenario_df = pd.DataFrame([
                            {
                                'Scenario': scenario,
                                'Mean Return': f"{data['mean_return']:.2%}",
                                'VaR (5%)': f"{data['var_5']:.2%}",
                                'Prob. Loss': f"{data['probability_loss']:.2%}"
                            }
                            for scenario, data in scenario_results.items()
                        ])
                        st.dataframe(scenario_df, use_container_width=True)
                        
                    except Exception as e:
                        st.error(f"Monte Carlo simulation error: {str(e)}")
        
        with analytics_tab6:
            st.subheader("News Sentiment Analysis")
            from pulling_news_v3 import NewsAnalyzer
            
            news_analyzer = NewsAnalyzer()
            
            col1, col2 = st.columns(2)
            with col1:
                days_back = st.slider("Days Back", 1, 30, 7)
            with col2:
                max_news = st.slider("Max News per Stock", 5, 50, 20)
            
            if st.button("Analyze Portfolio Sentiment"):
                with st.spinner("Analyzing news sentiment..."):
                    try:
                        portfolio_symbols = list(portfolio.symbols)[:10]  # Limit to first 10 symbols
                        sentiment_data = news_analyzer.get_portfolio_news_sentiment(portfolio_symbols, days_back)
                        
                        # Overall sentiment summary
                        st.subheader("Portfolio Sentiment Overview")
                        
                        sentiment_summary = []
                        for symbol, data in sentiment_data.items():
                            sentiment_summary.append({
                                'Symbol': symbol,
                                'Sentiment': data['sentiment_trend'],
                                'Score': f"{data['sentiment_score']:.3f}",
                                'News Count': data['news_count'],
                                'Positive': data['sentiment_distribution']['positive'],
                                'Negative': data['sentiment_distribution']['negative'],
                                'Neutral': data['sentiment_distribution']['neutral']
                            })
                        
                        sentiment_df = pd.DataFrame(sentiment_summary)
                        
                        # Color-code sentiment
                        def color_sentiment(val):
                            if val == 'BULLISH':
                                return 'background-color: lightgreen; color: black'
                            elif val == 'BEARISH':
                                return 'background-color: lightcoral; color: black'
                            else:
                                return 'background-color: lightgray; color: black'
                        
                        styled_df = sentiment_df.style.applymap(color_sentiment, subset=['Sentiment'])
                        st.dataframe(styled_df, use_container_width=True)
                        
                        # Sentiment distribution chart
                        sentiment_counts = sentiment_df['Sentiment'].value_counts()
                        fig_sentiment = px.pie(values=sentiment_counts.values, names=sentiment_counts.index,
                                             title="Portfolio Sentiment Distribution")
                        st.plotly_chart(fig_sentiment, use_container_width=True)
                        
                        # Individual stock news
                        st.subheader("Latest News by Stock")
                        
                        for symbol, data in sentiment_data.items():
                            if data['latest_news']:
                                with st.expander(f"📈 {symbol} - {data['sentiment_trend']} ({data['sentiment_score']:.3f})"):
                                    for news_item in data['latest_news'][:5]:
                                        sentiment_color = {
                                            'POSITIVE': '🟢',
                                            'NEGATIVE': '🔴',
                                            'NEUTRAL': '⚪'
                                        }.get(news_item['sentiment'], '⚪')
                                        
                                        st.write(f"{sentiment_color} **{news_item['title']}**")
                                        st.write(f"*{news_item['timestamp'].strftime('%Y-%m-%d %H:%M')} - Polarity: {news_item['polarity']:.3f}*")
                                        st.write(f"[Read more]({news_item['url']})")
                                        st.divider()
                        
                        # Market events detection
                        st.subheader("Market Events Detection")
                        events = news_analyzer.detect_market_events(portfolio_symbols)
                        
                        events_found = False
                        for symbol, symbol_events in events.items():
                            if symbol_events:
                                events_found = True
                                with st.expander(f"🎯 {symbol} Events ({len(symbol_events)})"):
                                    for event in symbol_events[:5]:
                                        event_icon = {
                                            'EARNINGS': '📊',
                                            'ANNOUNCEMENT': '📢',
                                            'REGULATORY': '⚖️'
                                        }.get(event['type'], '📰')
                                        
                                        st.write(f"{event_icon} **{event['type']}**: {event['title']}")
                                        st.write(f"*{event['timestamp'].strftime('%Y-%m-%d %H:%M')} - {event['sentiment']} (Impact: {event['impact_score']:.3f})*")
                                        st.divider()
                        
                        if not events_found:
                            st.info("No significant market events detected in the selected timeframe.")
                        
                        # Export functionality
                        if st.button("Export News Data"):
                            news_df = news_analyzer.export_news_data(portfolio_symbols)
                            csv = news_df.to_csv(index=False)
                            st.download_button(
                                label="📥 Download News CSV",
                                data=csv,
                                file_name=f"portfolio_news_{datetime.now().strftime('%Y%m%d')}.csv",
                                mime="text/csv"
                            )
                        
                    except Exception as e:
                        st.error(f"News analysis error: {str(e)}")
                        st.write("Note: This is a demo implementation. Real news data would require API keys.")
        
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
                
                # Check if models are already trained for current portfolio
                portfolio_hash = hashlib.md5(str(sorted([s for s in portfolio.symbols if s])).encode()).hexdigest()
                cached_ml_models = cache_manager.get_portfolio_data(user.user_id, f"ml_models_{portfolio_hash}")
                
                if cached_ml_models:
                    st.success(f"✅ ML models already trained for {len(cached_ml_models)} symbols")
                    
                    # Display cached training results
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
                    st.info("🤖 ML models will be automatically trained when you upload portfolio data")
                
                if st.button("Generate Predictions"):
                    with st.spinner("Generating predictions..."):
                        try:
                            # Try to load existing models first
                            if ml_predictor.load_models('ml_models.pkl'):
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
                                    
                                    st.dataframe(pred_df, use_container_width=True)
                                    
                                    # Visualization
                                    pred_values = [float(data['predicted_return']) for data in predictions.values()]
                                    symbols = list(predictions.keys())
                                    
                                    fig_pred = px.bar(x=symbols, y=pred_values, title="ML Return Predictions")
                                    fig_pred.update_layout(xaxis_title="Symbol", yaxis_title="Predicted Return")
                                    st.plotly_chart(fig_pred, use_container_width=True)
                                else:
                                    st.warning("No predictions available. Train models first.")
                            else:
                                st.warning("No trained models found. Please train models first.")
                        except Exception as e:
                            st.error(f"Prediction error: {str(e)}")
            
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

    # API Server Integration
    if user_manager.check_permission(user, Permission.READ_ANALYTICS):
        st.header("API Server Integration")
        
        api_tab1, api_tab2 = st.tabs(["Real-time Data", "API Analytics"])
        
        with api_tab1:
            st.subheader("Real-time Market Data Stream")
            
            # API server connection status
            import requests
            try:
                response = requests.get('http://localhost:5000/health', timeout=2)
                if response.status_code == 200:
                    st.success("API Server Connected")
                    
                    # Real-time data for portfolio symbols
                    if st.button("Get Real-time Data"):
                        try:
                            symbols_list = list(portfolio.symbols)[:5]
                            api_response = requests.get('http://localhost:5000/api/market-data', 
                                                      params={'symbols': symbols_list}, timeout=5)
                            
                            if api_response.status_code == 200:
                                market_data = api_response.json()
                                
                                # Display real-time data
                                realtime_df = pd.DataFrame([
                                    {
                                        'Symbol': symbol,
                                        'Price': f"${data['price']:.2f}",
                                        'Change': f"{data['change']:+.2f}",
                                        'Volume': f"{data['volume']:,}",
                                        'Timestamp': data['timestamp'][:19]
                                    }
                                    for symbol, data in market_data.items()
                                ])
                                
                                st.dataframe(realtime_df, use_container_width=True)
                                
                                # Price chart
                                prices = [data['price'] for data in market_data.values()]
                                symbols = list(market_data.keys())
                                
                                fig_prices = px.bar(x=symbols, y=prices, title="Real-time Prices")
                                st.plotly_chart(fig_prices, use_container_width=True)
                            else:
                                st.error("Failed to fetch real-time data")
                        except Exception as e:
                            st.error(f"Real-time data error: {str(e)}")
                else:
                    st.error("API Server Disconnected")
            except:
                st.warning("API Server Not Running")
                st.info("Start API server: `python enterprise/api_server.py`")
        
        with api_tab2:
            st.subheader("API Analytics Engine")
            
            try:
                # Portfolio analytics via API
                if st.button("Run API Analytics"):
                    symbols_list = list(portfolio.symbols)[:5]
                    
                    analytics_payload = {
                        'analysis_type': 'comprehensive',
                        'symbols': symbols_list
                    }
                    
                    api_response = requests.post('http://localhost:5000/api/analytics', 
                                               json=analytics_payload, timeout=10)
                    
                    if api_response.status_code == 200:
                        analytics_results = api_response.json()
                        
                        # Display analytics results
                        results_df = pd.DataFrame([
                            {
                                'Symbol': symbol,
                                'Momentum Score': f"{data['momentum_score']:.3f}",
                                'Volatility': f"{data['volatility']:.2%}",
                                'Technical Rating': data['technical_rating']
                            }
                            for symbol, data in analytics_results['results'].items()
                        ])
                        
                        st.dataframe(results_df, use_container_width=True)
                        
                        # Technical ratings chart
                        rating_counts = results_df['Technical Rating'].value_counts()
                        fig_ratings = px.pie(values=rating_counts.values, names=rating_counts.index,
                                           title="Technical Ratings Distribution")
                        st.plotly_chart(fig_ratings, use_container_width=True)
                    else:
                        st.error("Failed to run API analytics")
                
                # Risk metrics via API
                if st.button("Get API Risk Metrics"):
                    symbols_list = list(portfolio.symbols)[:5]
                    
                    risk_response = requests.get('http://localhost:5000/api/risk', 
                                               params={'symbols': symbols_list}, timeout=5)
                    
                    if risk_response.status_code == 200:
                        risk_data = risk_response.json()
                        
                        col1, col2, col3, col4 = st.columns(4)
                        with col1:
                            st.metric("Portfolio Volatility", f"{risk_data['portfolio_volatility']:.2%}")
                        with col2:
                            st.metric("VaR (5%)", f"{risk_data['var_5']:.2%}")
                        with col3:
                            st.metric("Sharpe Ratio", f"{risk_data['sharpe_ratio']:.2f}")
                        with col4:
                            st.metric("Max Drawdown", f"{risk_data['max_drawdown']:.2%}")
                    else:
                        st.error("Failed to get risk metrics")
            
            except Exception as e:
                st.error(f"API integration error: {str(e)}")
    
    # Multi-User API Integration
    if user_manager.check_permission(user, Permission.SHARE_RESEARCH):
        st.header("Multi-User API")
        
        try:
            # Get user token for API calls
            user_token = user_manager.generate_jwt_token(user)
            headers = {'Authorization': f'Bearer {user_token}'}
            
            multiuser_tab1, multiuser_tab2 = st.tabs(["API Portfolios", "API Research"])
            
            with multiuser_tab1:
                st.subheader("Portfolio Management via API")
                
                if st.button("Sync with Multi-User API"):
                    try:
                        # Get portfolios via API
                        api_response = requests.get('http://localhost:5001/api/user/portfolios', 
                                                  headers=headers, timeout=5)
                        
                        if api_response.status_code == 200:
                            api_portfolios = api_response.json()
                            
                            st.write(f"**User Portfolios:** {len(api_portfolios.get('user_portfolios', []))}")
                            st.write(f"**Shared Portfolios:** {len(api_portfolios.get('shared_portfolios', []))}")
                            
                            # Display portfolios
                            if api_portfolios.get('user_portfolios'):
                                portfolios_df = pd.DataFrame(api_portfolios['user_portfolios'])
                                st.dataframe(portfolios_df, use_container_width=True)
                        else:
                            st.error("Failed to sync with multi-user API")
                    except Exception as e:
                        st.error(f"Multi-user API sync error: {str(e)}")
                
                # Create portfolio via API
                with st.expander("Create Portfolio via API"):
                    api_portfolio_name = st.text_input("Portfolio Name (API)")
                    
                    if st.button("Create via API") and api_portfolio_name:
                        try:
                            portfolio_data = [{
                                'symbol': pos.symbol,
                                'quantity': pos.quantity,
                                'avg_cost': pos.avg_cost
                            } for pos in portfolio.positions]
                            
                            create_payload = {
                                'portfolio_name': api_portfolio_name,
                                'portfolio_data': portfolio_data
                            }
                            
                            api_response = requests.post('http://localhost:5001/api/user/portfolios',
                                                       json=create_payload, headers=headers, timeout=5)
                            
                            if api_response.status_code == 201:
                                st.success("Portfolio created via API!")
                            else:
                                st.error("Failed to create portfolio via API")
                        except Exception as e:
                            st.error(f"API portfolio creation error: {str(e)}")
            
            with multiuser_tab2:
                st.subheader("Research Notes via API")
                
                if st.button("Load API Research Notes"):
                    try:
                        api_response = requests.get('http://localhost:5001/api/research/notes',
                                                  headers=headers, timeout=5)
                        
                        if api_response.status_code == 200:
                            api_notes = api_response.json()
                            
                            if api_notes.get('notes'):
                                notes_df = pd.DataFrame(api_notes['notes'])
                                st.dataframe(notes_df, use_container_width=True)
                            else:
                                st.info("No research notes found")
                        else:
                            st.error("Failed to load research notes")
                    except Exception as e:
                        st.error(f"API research notes error: {str(e)}")
                
                # Create research note via API
                with st.expander("Create Research Note via API"):
                    api_note_title = st.text_input("Note Title (API)")
                    api_note_content = st.text_area("Note Content (API)")
                    api_note_public = st.checkbox("Make Public (API)")
                    
                    if st.button("Create Note via API") and api_note_title:
                        try:
                            note_payload = {
                                'title': api_note_title,
                                'content': api_note_content,
                                'is_public': api_note_public,
                                'tags': []
                            }
                            
                            api_response = requests.post('http://localhost:5001/api/research/notes',
                                                       json=note_payload, headers=headers, timeout=5)
                            
                            if api_response.status_code == 201:
                                st.success("Research note created via API!")
                            else:
                                st.error("Failed to create research note via API")
                        except Exception as e:
                            st.error(f"API note creation error: {str(e)}")
        
        except Exception as e:
            st.error(f"Multi-user API integration error: {str(e)}")
            st.info("Start multi-user API: `python enterprise/multi_user_api.py`")
        
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