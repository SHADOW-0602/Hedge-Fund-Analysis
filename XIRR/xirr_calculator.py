import pandas as pd
import numpy as np
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
from scipy.optimize import newton
import streamlit as st

class XIRRCalculator:
    def __init__(self):
        self.transactions = []
        self.positions = {}
    
    def add_transaction(self, date: datetime, symbol: str, quantity: float, 
                       price: float, transaction_type: str, fees: float = 0):
        """Add a transaction to the portfolio"""
        cash_flow = -quantity * price - fees if transaction_type == 'BUY' else quantity * price - fees
        
        self.transactions.append({
            'date': date,
            'symbol': symbol,
            'quantity': quantity,
            'price': price,
            'type': transaction_type,
            'fees': fees,
            'cash_flow': cash_flow
        })
    
    def load_from_csv(self, filepath: str):
        """Load transactions from CSV file"""
        df = pd.read_csv(filepath)
        df['date'] = pd.to_datetime(df['date'])
        
        for _, row in df.iterrows():
            self.add_transaction(
                date=row['date'],
                symbol=row['symbol'],
                quantity=row['quantity'],
                price=row['price'],
                transaction_type=row['transaction_type'],
                fees=row.get('fees', 0)
            )
    
    def calculate_fifo_positions(self) -> Dict:
        """Calculate current positions using FIFO accounting"""
        positions = {}
        
        for txn in sorted(self.transactions, key=lambda x: x['date']):
            symbol = txn['symbol']
            
            if symbol not in positions:
                positions[symbol] = {'lots': [], 'total_quantity': 0}
            
            if txn['type'] == 'BUY':
                positions[symbol]['lots'].append({
                    'quantity': txn['quantity'],
                    'price': txn['price'],
                    'date': txn['date'],
                    'fees': txn['fees']
                })
                positions[symbol]['total_quantity'] += txn['quantity']
            
            elif txn['type'] == 'SELL':
                remaining_to_sell = txn['quantity']
                
                while remaining_to_sell > 0 and positions[symbol]['lots']:
                    oldest_lot = positions[symbol]['lots'][0]
                    
                    if oldest_lot['quantity'] <= remaining_to_sell:
                        remaining_to_sell -= oldest_lot['quantity']
                        positions[symbol]['total_quantity'] -= oldest_lot['quantity']
                        positions[symbol]['lots'].pop(0)
                    else:
                        oldest_lot['quantity'] -= remaining_to_sell
                        positions[symbol]['total_quantity'] -= remaining_to_sell
                        remaining_to_sell = 0
        
        # Remove positions with zero quantity
        return {k: v for k, v in positions.items() if v['total_quantity'] > 0}
    
    def calculate_xirr(self, current_prices: Dict[str, float], end_date: Optional[datetime] = None) -> float:
        """Calculate Extended Internal Rate of Return"""
        if end_date is None:
            end_date = datetime.now()
        
        # Prepare cash flows
        cash_flows = []
        dates = []
        
        # Add all transaction cash flows
        for txn in self.transactions:
            cash_flows.append(txn['cash_flow'])
            dates.append(txn['date'])
        
        # Add current portfolio value as final cash flow
        positions = self.calculate_fifo_positions()
        current_value = 0
        
        for symbol, position_data in positions.items():
            current_price = current_prices.get(symbol, 0)
            current_value += position_data['total_quantity'] * current_price
        
        if current_value > 0:
            cash_flows.append(current_value)
            dates.append(end_date)
        
        if len(cash_flows) < 2:
            return 0.0
        
        # Convert dates to years from first transaction
        start_date = min(dates)
        years = [(date - start_date).days / 365.25 for date in dates]
        
        # XIRR calculation using Newton's method
        def npv(rate):
            return sum(cf / (1 + rate) ** year for cf, year in zip(cash_flows, years))
        
        def npv_derivative(rate):
            return sum(-year * cf / (1 + rate) ** (year + 1) for cf, year in zip(cash_flows, years))
        
        try:
            # Initial guess
            guess = 0.1
            xirr = newton(npv, guess, fprime=npv_derivative, maxiter=100)
            return xirr
        except:
            # Fallback to simple approximation
            total_invested = sum(cf for cf in cash_flows[:-1] if cf < 0)
            if total_invested < 0:
                total_return = (current_value + total_invested) / abs(total_invested)
                time_period = (end_date - start_date).days / 365.25
                return (total_return ** (1 / time_period)) - 1 if time_period > 0 else 0
            return 0.0
    
    def calculate_time_weighted_return(self, price_history: Dict[str, pd.Series]) -> float:
        """Calculate time-weighted return"""
        # Simplified TWR calculation
        portfolio_values = []
        dates = []
        
        # Get all transaction dates
        transaction_dates = sorted(set(txn['date'].date() for txn in self.transactions))
        
        for date in transaction_dates:
            # Calculate portfolio value at each transaction date
            positions_at_date = self._get_positions_at_date(date)
            
            portfolio_value = 0
            for symbol, quantity in positions_at_date.items():
                if symbol in price_history:
                    price_series = price_history[symbol]
                    # Get price closest to date
                    closest_price = price_series[price_series.index.date <= date]
                    if not closest_price.empty:
                        portfolio_value += quantity * closest_price.iloc[-1]
            
            portfolio_values.append(portfolio_value)
            dates.append(date)
        
        if len(portfolio_values) < 2:
            return 0.0
        
        # Calculate period returns
        period_returns = []
        for i in range(1, len(portfolio_values)):
            if portfolio_values[i-1] > 0:
                period_return = (portfolio_values[i] - portfolio_values[i-1]) / portfolio_values[i-1]
                period_returns.append(period_return)
        
        # Compound returns
        if period_returns:
            twr = np.prod([1 + r for r in period_returns]) - 1
            return twr
        
        return 0.0
    
    def _get_positions_at_date(self, target_date) -> Dict[str, float]:
        """Get portfolio positions at a specific date"""
        positions = {}
        
        for txn in self.transactions:
            if txn['date'].date() <= target_date:
                symbol = txn['symbol']
                if symbol not in positions:
                    positions[symbol] = 0
                
                if txn['type'] == 'BUY':
                    positions[symbol] += txn['quantity']
                elif txn['type'] == 'SELL':
                    positions[symbol] -= txn['quantity']
        
        return {k: v for k, v in positions.items() if v > 0}
    
    def generate_performance_report(self, current_prices: Dict[str, float]) -> Dict:
        """Generate comprehensive performance report"""
        positions = self.calculate_fifo_positions()
        xirr = self.calculate_xirr(current_prices)
        
        # Calculate total invested and current value
        total_invested = sum(abs(txn['cash_flow']) for txn in self.transactions if txn['cash_flow'] < 0)
        current_value = sum(pos['total_quantity'] * current_prices.get(symbol, 0) 
                          for symbol, pos in positions.items())
        
        # Position-level analysis
        position_analysis = {}
        for symbol, position_data in positions.items():
            current_price = current_prices.get(symbol, 0)
            
            # Calculate average cost basis
            total_cost = sum(lot['quantity'] * lot['price'] + lot['fees'] for lot in position_data['lots'])
            avg_cost = total_cost / position_data['total_quantity'] if position_data['total_quantity'] > 0 else 0
            
            market_value = position_data['total_quantity'] * current_price
            unrealized_pnl = market_value - total_cost
            
            position_analysis[symbol] = {
                'quantity': position_data['total_quantity'],
                'avg_cost': avg_cost,
                'current_price': current_price,
                'market_value': market_value,
                'unrealized_pnl': unrealized_pnl,
                'unrealized_pnl_pct': unrealized_pnl / total_cost if total_cost > 0 else 0,
                'weight': market_value / current_value if current_value > 0 else 0
            }
        
        return {
            'xirr': xirr,
            'total_invested': total_invested,
            'current_value': current_value,
            'total_return': current_value - total_invested,
            'total_return_pct': (current_value - total_invested) / total_invested if total_invested > 0 else 0,
            'positions': position_analysis,
            'transaction_count': len(self.transactions),
            'holding_period_days': (datetime.now() - min(txn['date'] for txn in self.transactions)).days if self.transactions else 0
        }

def create_streamlit_dashboard():
    """Create Streamlit web interface for XIRR calculation"""
    st.title("XIRR Portfolio Performance Calculator")
    st.write("Upload your transaction data to calculate Extended Internal Rate of Return")
    
    # File upload
    uploaded_file = st.file_uploader("Upload Transaction CSV", type=['csv'])
    
    if uploaded_file:
        calculator = XIRRCalculator()
        calculator.load_from_csv(uploaded_file)
        
        st.success(f"Loaded {len(calculator.transactions)} transactions")
        
        # Display transactions
        if st.checkbox("Show Transactions"):
            df = pd.DataFrame(calculator.transactions)
            st.dataframe(df)
        
        # Current prices input
        st.subheader("Current Prices")
        positions = calculator.calculate_fifo_positions()
        current_prices = {}
        
        for symbol in positions.keys():
            price = st.number_input(f"Current price for {symbol}", min_value=0.0, value=100.0, key=symbol)
            current_prices[symbol] = price
        
        if st.button("Calculate Performance"):
            report = calculator.generate_performance_report(current_prices)
            
            # Display results
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("XIRR", f"{report['xirr']:.2%}")
            with col2:
                st.metric("Total Return", f"${report['total_return']:,.2f}")
            with col3:
                st.metric("Return %", f"{report['total_return_pct']:.2%}")
            
            # Position details
            st.subheader("Position Analysis")
            position_df = pd.DataFrame.from_dict(report['positions'], orient='index')
            st.dataframe(position_df)

if __name__ == "__main__":
    # Example usage
    calculator = XIRRCalculator()
    
    # Add sample transactions
    calculator.add_transaction(datetime(2023, 1, 1), 'AAPL', 100, 150, 'BUY', 9.99)
    calculator.add_transaction(datetime(2023, 6, 1), 'AAPL', 50, 180, 'BUY', 9.99)
    calculator.add_transaction(datetime(2023, 12, 1), 'AAPL', 25, 200, 'SELL', 9.99)
    
    # Calculate performance
    current_prices = {'AAPL': 190}
    report = calculator.generate_performance_report(current_prices)
    
    print(f"XIRR: {report['xirr']:.2%}")
    print(f"Total Return: ${report['total_return']:,.2f}")
    print(f"Return %: {report['total_return_pct']:.2%}")