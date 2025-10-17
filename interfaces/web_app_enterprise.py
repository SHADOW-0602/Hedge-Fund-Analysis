import streamlit as st
import pandas as pd
import plotly.express as px
import sys
import os
from dotenv import load_dotenv
import hashlib
from datetime import datetime

# Load environment variables
load_dotenv()

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import logger
from utils.logger import logger

from core.portfolio import Portfolio
from clients.market_data_client import MarketDataClient
from clients.supabase_client import supabase_client
from analytics.risk_analytics import RiskAnalyzer
from analytics.options_analytics import OptionsAnalyzer
from enterprise.user_management import UserManager, UserRole, Permission
from enterprise.user_management import DataIsolationManager, CollaborationManager
from utils.cache_manager import cache_manager
from utils.cookie_manager import cookie_manager

st.set_page_config(
    page_title="Portfolio Analysis Engine", 
    layout="wide",
    initial_sidebar_state="expanded",
    page_icon="📊"
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
    st.title("🔐 Login to Portfolio Analysis Engine")
    
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
                    st.success("Account created! Please login.")
                except ValueError as e:
                    st.error(str(e))

# Check authentication
if 'user' not in st.session_state:
    show_login()
    st.stop()

user = st.session_state.user

# Professional Header
st.markdown("""
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2rem; border-radius: 10px; margin-bottom: 2rem; color: white;">
    <h1 style="color: white; margin: 0; font-size: 2.5rem; font-weight: 700;">📊 Portfolio & Options Analysis Engine</h1>
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
    if st.button("🚪 Logout", help="Sign out of your account"):
        # Clear cache and cookies
        cache_manager.invalidate_user_cache(user.user_id)
        if st.session_state.get('cookie_consent_given', False):
            cookie_manager.clear_user_cookies(user.user_id)
        
        del st.session_state.user
        st.rerun()

# Sidebar for user-specific features
with st.sidebar:
    st.header("📁 My Portfolios")
    
    # Check permissions
    can_read_portfolio = user_manager.check_permission(user, Permission.READ_PORTFOLIO)
    can_write_portfolio = user_manager.check_permission(user, Permission.WRITE_PORTFOLIO)
    
    if can_read_portfolio:
        # Load user portfolios
        user_portfolios = data_isolation.get_user_portfolios(user.user_id)
        if user_portfolios:
            portfolio_names = [p['portfolio_name'] for p in user_portfolios]
            selected_portfolio = st.selectbox("Load Portfolio", ["None"] + portfolio_names)
            
            if selected_portfolio != "None":
                portfolio_data = next(p for p in user_portfolios if p['portfolio_name'] == selected_portfolio)
                st.session_state.current_portfolio = portfolio_data
        
        # Shared portfolios
        shared_portfolios = data_isolation.get_shared_portfolios(user.user_id)
        if shared_portfolios:
            st.subheader("📤 Shared with Me")
            shared_names = [f"{p['portfolio_name']} (by {p['owner_username']})" for p in shared_portfolios]
            selected_shared = st.selectbox("Load Shared", ["None"] + shared_names)
    
    st.divider()
    
    # Collaboration features
    if user_manager.check_permission(user, Permission.SHARE_RESEARCH):
        st.header("🤝 Collaboration")
        
        # Research notes
        notes = collaboration.get_research_notes(user.user_id)
        if notes:
            st.write(f"📝 {len(notes)} Research Notes")
        
        # Workspaces
        workspaces = collaboration.get_user_workspaces(user.user_id)
        if workspaces:
            st.write(f"👥 {len(workspaces)} Workspaces")
    
    st.divider()
    
    # Admin features
    if user.role == UserRole.ADMIN:
        st.header("⚙️ Admin")
        if st.button("Manage Users"):
            st.session_state.show_admin = True

# Admin Panel
if st.session_state.get('show_admin') and user.role == UserRole.ADMIN:
    st.header("👥 User Management")
    
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
    
    if st.button("Close Admin Panel"):
        st.session_state.show_admin = False
        st.rerun()

# Password Update Feature
with st.sidebar:
    st.header("🔐 Account Settings")
    with st.expander("Change Password"):
        current_password = st.text_input("Current Password", type="password", key="current_pwd")
        new_password = st.text_input("New Password", type="password", key="new_pwd")
        confirm_password = st.text_input("Confirm New Password", type="password", key="confirm_pwd")
        
        if st.button("Update Password"):
            if not all([current_password, new_password, confirm_password]):
                st.error("All fields required")
            elif new_password != confirm_password:
                st.error("Passwords don't match")
            elif len(new_password) < 6:
                st.error("Password must be at least 6 characters")
            else:
                # Verify current password
                if user_manager.authenticate_user(user.username, current_password):
                    if user_manager.update_password(user.user_id, new_password):
                        st.success("Password updated successfully!")
                    else:
                        st.error("Failed to update password")
                else:
                    st.error("Current password is incorrect")

# Plaid Integration
with st.sidebar:
    st.header("🏦 Connect Brokerage")
    
    from clients.plaid_client import plaid_client
    if plaid_client:
        # Create link token for Plaid Link
        if 'plaid_link_token' not in st.session_state:
            link_token = plaid_client.create_link_token(user.user_id)
            if link_token:
                st.session_state.plaid_link_token = link_token
        
        if 'plaid_link_token' in st.session_state:
            st.success(f"Link Token Ready: {st.session_state.plaid_link_token[:20]}...")
            
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
                
                st.warning("Alternative: Use a test token like 'public-sandbox-test-token' for demo")
            
            st.info("For testing, use Plaid's sandbox with the credentials above.")
        
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

# Main Portfolio Interface
# Broker selection and file upload
st.header("📁 Upload Portfolio Data")
col1, col2 = st.columns([1, 2])
with col1:
    from utils.broker_parsers import BROKER_PARSERS
    selected_broker = st.selectbox("Select Broker", list(BROKER_PARSERS.keys()))
with col2:
    uploaded_file = st.file_uploader(
        f"Upload {selected_broker} File", 
        type=['csv', 'xlsx', 'xls'],
        help=f"Upload {selected_broker} format file"
    )

# Check if we have a loaded portfolio from sidebar or Plaid
current_portfolio = None
plaid_portfolio = None

if 'current_portfolio' in st.session_state:
    portfolio_data = st.session_state.current_portfolio['portfolio_data']
    df = pd.DataFrame(portfolio_data)
    current_portfolio = Portfolio.from_dataframe(df)

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

# Show Plaid transactions if available
if 'plaid_transactions' in st.session_state:
    with st.sidebar:
        st.header("💰 Account Activity")
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

if uploaded_file or current_portfolio or plaid_portfolio:
    if uploaded_file:
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
                        st.rerun()
                    else:
                        st.error("Failed to save portfolio")
            
            with col2:
                if st.button("Share Portfolio") and portfolio_name:
                    # Share with other users (simplified)
                    st.info("Portfolio sharing enabled")
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
    with st.expander("📊 Diversification Analysis"):
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
        st.header("📈 Risk Analysis")
        
        col1, col2 = st.columns(2)
        with col1:
            # Speed options
            speed_method = st.selectbox("Analysis Speed", ["Ultra Fast (Polars)", "JIT Compiled (Numba)", "Standard"])
            
            # Check cache first before showing button
            portfolio_hash = hashlib.md5(str(sorted(portfolio.symbols)).encode()).hexdigest()
        cached_metrics = cache_manager.get_portfolio_data(user.user_id, f"risk_{portfolio_hash}")
        
        if cached_metrics:
            st.info("📊 Risk Analysis (Cached)")
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
                st.info("No correlation data available")
            
            if st.button("Recalculate Risk Analysis"):
                cache_manager.invalidate_user_cache(user.user_id)
                st.rerun()
        else:
            if st.button("Calculate Risk Analysis"):
                with st.spinner("Calculating risk metrics..."):
                    weights = portfolio.get_weights()
                    
                    if speed_method == "Ultra Fast (Polars)":
                        try:
                            from analytics.risk_analytics_polars import RiskAnalyzerPolars
                            risk_analyzer = RiskAnalyzerPolars(data_client)
                            metrics = risk_analyzer.analyze_portfolio_risk_ultra_fast(portfolio.symbols, weights)
                        except ImportError:
                            st.warning("Install polars: pip install polars")
                            risk_analyzer = RiskAnalyzer(data_client)
                            metrics = risk_analyzer.analyze_portfolio_risk_fast(portfolio.symbols, weights)
                    elif speed_method == "JIT Compiled (Numba)":
                        try:
                            from analytics.risk_analytics_numba import RiskAnalyzerNumba
                            risk_analyzer = RiskAnalyzerNumba(data_client)
                            metrics = risk_analyzer.analyze_portfolio_risk_jit(portfolio.symbols, weights)
                        except ImportError:
                            st.warning("Install numba: pip install numba")
                            risk_analyzer = RiskAnalyzer(data_client)
                            metrics = risk_analyzer.analyze_portfolio_risk_fast(portfolio.symbols, weights)
                    else:
                        risk_analyzer = RiskAnalyzer(data_client)
                        metrics = risk_analyzer.analyze_portfolio_risk_fast(portfolio.symbols, weights)
                    
                    # Cache results with prefix
                    cache_manager.set_portfolio_data(user.user_id, f"risk_{portfolio_hash}", metrics, expire_hours=24)
                    st.rerun()
        
        with col2:
            if st.button("Download Portseido Template"):
                from clients.portseido_client import portseido_client
                template_bytes = portseido_client.generate_portseido_template()
                st.download_button(
                    label="📥 Download Excel Template",
                    data=template_bytes,
                    file_name="portseido_template.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
                st.info("1. Download template\n2. Input your trades\n3. Upload below")
    
    # Advanced Analytics Suite
    if user_manager.check_permission(user, Permission.READ_ANALYTICS):
        st.header("📊 Advanced Analytics Suite")
        
        analytics_tab1, analytics_tab2, analytics_tab3, analytics_tab4 = st.tabs(["📈 Performance Attribution", "🔍 Quantitative Screening", "📊 Portfolio Analytics", "💰 XIRR Analysis"])
        
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
                    if screening_method == "Momentum Analysis":
                        results = screener.momentum_screen(portfolio.symbols)
                        if results['momentum_rankings']:
                            st.subheader("Momentum Rankings")
                            momentum_df = pd.DataFrame([
                                {'Symbol': symbol, 'Momentum Score': data['momentum_score'], 'Current Price': data['current_price']}
                                for symbol, data in results['top_momentum']
                            ])
                            st.dataframe(momentum_df)
                    
                    elif screening_method == "Quality Screen":
                        results = screener.quality_screen(portfolio.symbols)
                        if results['high_quality']:
                            st.subheader("Quality Rankings")
                            quality_df = pd.DataFrame([
                                {'Symbol': symbol, 'Quality Score': f"{data['quality_score']:.3f}", 'Sharpe Ratio': f"{data['sharpe_ratio']:.3f}"}
                                for symbol, data in results['high_quality']
                            ])
                            st.dataframe(quality_df)
        
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
            
            with st.expander("Manual XIRR Calculation"):
                calculator = XIRRCalculator()
                
                if portfolio:
                    current_prices = {}
                    for symbol in portfolio.symbols[:3]:  # Limit to first 3 for demo
                        current_prices[symbol] = st.number_input(f"Current price for {symbol}", value=150.0, key=f"xirr_{symbol}")
                    
                    if st.button("Calculate XIRR") and current_prices:
                        try:
                            # Add sample transactions for demo
                            for symbol, price in current_prices.items():
                                calculator.add_transaction(datetime(2023, 1, 1), symbol, 100, price * 0.8, 'BUY')
                            
                            report = calculator.generate_performance_report(current_prices)
                            
                            col1, col2, col3 = st.columns(3)
                            with col1:
                                st.metric("XIRR", f"{report['xirr']:.2%}")
                            with col2:
                                st.metric("Total Return", f"${report['total_return']:,.2f}")
                            with col3:
                                st.metric("Return %", f"{report['total_return_pct']:.2%}")
                        except Exception as e:
                            st.error(f"XIRR calculation error: {str(e)}")
    
    # Options Analysis (permission-based)
    if user_manager.check_permission(user, Permission.READ_ANALYTICS):
        st.header("🎯 Options Opportunities")
        
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
            st.info("🎯 Options Analysis (Cached - 1hr)")
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

    # Market News
    if user_manager.check_permission(user, Permission.READ_ANALYTICS):
        st.header("📰 Market News")
        
        from clients.news_client import news_client
        if news_client:
            # Stock-specific news
            if portfolio:
                for symbol in portfolio.symbols[:3]:  # Show news for first 3 stocks
                    with st.expander(f"📈 {symbol} News"):
                        news = news_client.get_stock_news(symbol, days=3)
                        for article in news[:3]:
                            st.write(f"**{article['title']}**")
                            st.write(f"*{article['source']['name']} - {article['publishedAt'][:10]}*")
                            if article.get('description'):
                                st.write(article['description'][:200] + "...")
                            st.write(f"[Read more]({article['url']})")
                            st.divider()
            
            # General market news
            with st.expander("🏢 Market Headlines"):
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
        st.header("📝 Research Notes")
        
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
                    with st.expander(f"📄 {note['title']} - {note['author']}"):
                        st.write(note['content'])
                        if note['tags']:
                            st.write(f"Tags: {', '.join(note['tags'])}")

else:
    st.info("Please upload a CSV file with columns: symbol, quantity, avg_cost")
    
    # Show sample format with interactive capabilities
    st.subheader("Sample CSV Format")
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
        st.info("Install streamlit-aggrid for interactive tables: `pip install streamlit-aggrid`")

# Cookie Consent Banner at Bottom
if not st.session_state.cookie_consent_given:
    st.markdown("---")
    with st.container():
        st.warning("🍪 **Cookie Consent Required**")
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