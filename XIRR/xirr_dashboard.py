import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from xirr_calculator import XIRRCalculator
from datetime import datetime

def main():
    st.set_page_config(page_title="XIRR Portfolio Performance", layout="wide")
    
    st.title("📊 XIRR Portfolio Performance Dashboard")
    st.markdown("**Extended Internal Rate of Return Calculator with FIFO Accounting**")
    
    # Sidebar
    st.sidebar.header("Portfolio Configuration")
    
    # Initialize calculator
    if 'calculator' not in st.session_state:
        st.session_state.calculator = XIRRCalculator()
    
    calculator = st.session_state.calculator
    
    # File upload
    uploaded_file = st.sidebar.file_uploader("Upload Transaction CSV", type=['csv'])
    
    if uploaded_file:
        calculator.load_from_csv(uploaded_file)
        st.sidebar.success(f"✅ Loaded {len(calculator.transactions)} transactions")
    
    # Manual transaction entry
    with st.sidebar.expander("Add Manual Transaction"):
        with st.form("add_transaction"):
            date = st.date_input("Date", datetime.now())
            symbol = st.text_input("Symbol", "AAPL")
            quantity = st.number_input("Quantity", min_value=0.0, value=100.0)
            price = st.number_input("Price", min_value=0.0, value=150.0)
            txn_type = st.selectbox("Type", ["BUY", "SELL"])
            fees = st.number_input("Fees", min_value=0.0, value=9.99)
            
            if st.form_submit_button("Add Transaction"):
                calculator.add_transaction(
                    datetime.combine(date, datetime.min.time()),
                    symbol, quantity, price, txn_type, fees
                )
                st.success("Transaction added!")
                st.experimental_rerun()
    
    # Main content
    if calculator.transactions:
        # Get current positions
        positions = calculator.calculate_fifo_positions()
        
        if positions:
            # Current prices input
            st.header("📈 Current Market Prices")
            
            cols = st.columns(min(len(positions), 4))
            current_prices = {}
            
            for i, symbol in enumerate(positions.keys()):
                with cols[i % 4]:
                    price = st.number_input(
                        f"{symbol} Price", 
                        min_value=0.0, 
                        value=100.0, 
                        key=f"price_{symbol}"
                    )
                    current_prices[symbol] = price
            
            # Calculate performance
            if st.button("🔄 Calculate Performance", type="primary"):
                report = calculator.generate_performance_report(current_prices)
                
                # Key metrics
                st.header("📊 Performance Summary")
                
                col1, col2, col3, col4 = st.columns(4)
                
                with col1:
                    st.metric(
                        "XIRR (Annualized)", 
                        f"{report['xirr']:.2%}",
                        delta=f"{report['xirr']:.2%}" if report['xirr'] > 0 else None
                    )
                
                with col2:
                    st.metric(
                        "Total Return", 
                        f"${report['total_return']:,.2f}",
                        delta=f"{report['total_return_pct']:.2%}"
                    )
                
                with col3:
                    st.metric(
                        "Current Value", 
                        f"${report['current_value']:,.2f}"
                    )
                
                with col4:
                    st.metric(
                        "Total Invested", 
                        f"${report['total_invested']:,.2f}"
                    )
                
                # Position analysis
                st.header("💼 Position Analysis")
                
                if report['positions']:
                    position_df = pd.DataFrame.from_dict(report['positions'], orient='index')
                    position_df = position_df.round(4)
                    
                    # Format columns
                    position_df['market_value'] = position_df['market_value'].apply(lambda x: f"${x:,.2f}")
                    position_df['unrealized_pnl'] = position_df['unrealized_pnl'].apply(lambda x: f"${x:,.2f}")
                    position_df['unrealized_pnl_pct'] = position_df['unrealized_pnl_pct'].apply(lambda x: f"{x:.2%}")
                    position_df['weight'] = position_df['weight'].apply(lambda x: f"{x:.2%}")
                    
                    st.dataframe(position_df, use_container_width=True)
                    
                    # Portfolio composition chart
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        # Pie chart of portfolio weights
                        weights_data = pd.DataFrame.from_dict(report['positions'], orient='index')
                        fig_pie = px.pie(
                            values=weights_data['market_value'], 
                            names=weights_data.index,
                            title="Portfolio Composition"
                        )
                        st.plotly_chart(fig_pie, use_container_width=True)
                    
                    with col2:
                        # P&L by position
                        pnl_data = weights_data['unrealized_pnl'].sort_values(ascending=True)
                        fig_bar = px.bar(
                            x=pnl_data.values,
                            y=pnl_data.index,
                            orientation='h',
                            title="Unrealized P&L by Position",
                            color=pnl_data.values,
                            color_continuous_scale='RdYlGn'
                        )
                        st.plotly_chart(fig_bar, use_container_width=True)
                
                # Transaction history
                st.header("📋 Transaction History")
                
                txn_df = pd.DataFrame(calculator.transactions)
                txn_df['date'] = pd.to_datetime(txn_df['date']).dt.date
                txn_df = txn_df.sort_values('date', ascending=False)
                
                st.dataframe(txn_df, use_container_width=True)
                
                # Performance over time (simplified)
                st.header("📈 Performance Timeline")
                
                # Create a simple timeline chart
                timeline_data = []
                cumulative_invested = 0
                
                for txn in sorted(calculator.transactions, key=lambda x: x['date']):
                    if txn['cash_flow'] < 0:  # Investment
                        cumulative_invested += abs(txn['cash_flow'])
                    
                    timeline_data.append({
                        'date': txn['date'],
                        'cumulative_invested': cumulative_invested,
                        'transaction_type': txn['type']
                    })
                
                if timeline_data:
                    timeline_df = pd.DataFrame(timeline_data)
                    
                    fig_timeline = px.line(
                        timeline_df, 
                        x='date', 
                        y='cumulative_invested',
                        title="Cumulative Investment Over Time"
                    )
                    
                    # Add current value point
                    fig_timeline.add_scatter(
                        x=[datetime.now()],
                        y=[report['current_value']],
                        mode='markers',
                        marker=dict(size=15, color='red'),
                        name='Current Value'
                    )
                    
                    st.plotly_chart(fig_timeline, use_container_width=True)
        
        else:
            st.warning("No current positions found. All positions may have been sold.")
    
    else:
        st.info("👆 Upload a transaction CSV file or add manual transactions to get started")
        
        # Sample CSV format
        st.subheader("📄 CSV Format Example")
        sample_data = {
            'date': ['2023-01-01', '2023-06-01', '2023-12-01'],
            'symbol': ['AAPL', 'AAPL', 'AAPL'],
            'quantity': [100, 50, 25],
            'price': [150.00, 180.00, 200.00],
            'transaction_type': ['BUY', 'BUY', 'SELL'],
            'fees': [9.99, 9.99, 9.99]
        }
        
        sample_df = pd.DataFrame(sample_data)
        st.dataframe(sample_df, use_container_width=True)
        
        # Download sample CSV
        csv = sample_df.to_csv(index=False)
        st.download_button(
            label="📥 Download Sample CSV",
            data=csv,
            file_name="sample_transactions.csv",
            mime="text/csv"
        )

if __name__ == "__main__":
    main()