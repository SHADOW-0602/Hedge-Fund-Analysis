import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
from scipy.optimize import newton, brentq
import streamlit as st
from dataclasses import dataclass

@dataclass
class XIRRMetrics:
    xirr: float
    twr: float
    mwr: float
    total_return: float
    total_return_pct: float
    annualized_return: float
    volatility: float
    sharpe_ratio: float
    max_drawdown: float
    calmar_ratio: float
    sortino_ratio: float
    win_rate: float
    profit_factor: float
    average_win: float
    average_loss: float
    largest_win: float
    largest_loss: float
    holding_period_days: int
    total_invested: float
    current_value: float

class DetailedXIRRAnalyzer:
    def __init__(self, data_client=None):
        self.data_client = data_client
        self.transactions = []
        self.positions = {}
        self.cash_flows = []
        self.portfolio_history = pd.DataFrame()
    
    def load_transactions(self, transactions_data):
        """Load transactions from various formats"""
        self.transactions = []
        
        if isinstance(transactions_data, pd.DataFrame):
            for _, row in transactions_data.iterrows():
                self.add_transaction(
                    date=pd.to_datetime(row['date']),
                    symbol=row['symbol'],
                    quantity=float(row['quantity']),
                    price=float(row['price']),
                    transaction_type=row['transaction_type'],
                    fees=float(row.get('fees', 0))
                )
        elif hasattr(transactions_data, 'transactions'):
            # TransactionPortfolio object
            for txn in transactions_data.transactions:
                if hasattr(txn, 'symbol'):
                    # Transaction object
                    self.add_transaction(
                        date=txn.date,
                        symbol=txn.symbol,
                        quantity=txn.quantity,
                        price=txn.price,
                        transaction_type=txn.transaction_type,
                        fees=getattr(txn, 'fees', 0)
                    )
                else:
                    # Dictionary format
                    self.add_transaction(
                        date=pd.to_datetime(txn['date']),
                        symbol=txn['symbol'],
                        quantity=float(txn['quantity']),
                        price=float(txn['price']),
                        transaction_type=txn['transaction_type'],
                        fees=float(txn.get('fees', 0))
                    )
        elif isinstance(transactions_data, list):
            # List of dictionaries
            for txn in transactions_data:
                self.add_transaction(
                    date=pd.to_datetime(txn['date']),
                    symbol=txn['symbol'],
                    quantity=float(txn['quantity']),
                    price=float(txn['price']),
                    transaction_type=txn['transaction_type'],
                    fees=float(txn.get('fees', 0))
                )
    
    def add_transaction(self, date: datetime, symbol: str, quantity: float, 
                       price: float, transaction_type: str, fees: float = 0):
        """Add a transaction with enhanced tracking"""
        cash_flow = -quantity * price - fees if transaction_type.upper() == 'BUY' else quantity * price - fees
        
        transaction = {
            'date': date,
            'symbol': symbol,
            'quantity': quantity,
            'price': price,
            'type': transaction_type.upper(),
            'fees': fees,
            'cash_flow': cash_flow,
            'notional': abs(quantity * price),
            'net_cash_flow': cash_flow
        }
        
        self.transactions.append(transaction)
        self.transactions.sort(key=lambda x: x['date'])
    
    def calculate_detailed_xirr(self, current_prices: Dict[str, float], 
                               end_date: Optional[datetime] = None) -> XIRRMetrics:
        """Calculate comprehensive XIRR metrics"""
        if end_date is None:
            end_date = datetime.now()
        
        # Basic XIRR calculation
        xirr = self._calculate_xirr_core(current_prices, end_date)
        
        # Time-weighted return
        twr = self._calculate_time_weighted_return(current_prices)
        
        # Money-weighted return (same as XIRR for most cases)
        mwr = xirr
        
        # Portfolio values and returns
        portfolio_history = self._build_portfolio_history(current_prices)
        
        # Calculate additional metrics
        positions = self._calculate_current_positions()
        total_invested = sum(abs(txn['cash_flow']) for txn in self.transactions if txn['cash_flow'] < 0)
        current_value = sum(pos['quantity'] * current_prices.get(symbol, 0) 
                          for symbol, pos in positions.items())
        
        total_return = current_value - total_invested
        total_return_pct = total_return / total_invested if total_invested > 0 else 0
        
        # Annualized return
        holding_period_days = (end_date - min(pd.to_datetime(txn['date']) for txn in self.transactions)).days if self.transactions else 0
        holding_period_years = holding_period_days / 365.25
        annualized_return = ((1 + total_return_pct) ** (1 / holding_period_years) - 1) if holding_period_years > 0 else 0
        
        # Risk metrics
        if not portfolio_history.empty and 'daily_return' in portfolio_history.columns:
            returns = portfolio_history['daily_return'].dropna()
            volatility = returns.std() * np.sqrt(252) if len(returns) > 1 else 0
            
            # Sharpe ratio (assuming 2% risk-free rate)
            risk_free_rate = 0.02
            sharpe_ratio = (annualized_return - risk_free_rate) / volatility if volatility > 0 else 0
            
            # Maximum drawdown
            cumulative_returns = (1 + returns).cumprod()
            rolling_max = cumulative_returns.expanding().max()
            drawdowns = (cumulative_returns - rolling_max) / rolling_max
            max_drawdown = drawdowns.min()
            
            # Calmar ratio
            calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown < 0 else 0
            
            # Sortino ratio
            negative_returns = returns[returns < 0]
            downside_deviation = negative_returns.std() * np.sqrt(252) if len(negative_returns) > 0 else 0
            sortino_ratio = (annualized_return - risk_free_rate) / downside_deviation if downside_deviation > 0 else 0
        else:
            volatility = 0
            sharpe_ratio = 0
            max_drawdown = 0
            calmar_ratio = 0
            sortino_ratio = 0
        
        # Trading metrics
        realized_trades = self._get_realized_trades()
        win_rate = len([t for t in realized_trades if t['pnl'] > 0]) / len(realized_trades) if realized_trades else 0
        
        winning_trades = [t['pnl'] for t in realized_trades if t['pnl'] > 0]
        losing_trades = [t['pnl'] for t in realized_trades if t['pnl'] < 0]
        
        average_win = np.mean(winning_trades) if winning_trades else 0
        average_loss = np.mean(losing_trades) if losing_trades else 0
        largest_win = max(winning_trades) if winning_trades else 0
        largest_loss = min(losing_trades) if losing_trades else 0
        
        total_wins = sum(winning_trades) if winning_trades else 0
        total_losses = abs(sum(losing_trades)) if losing_trades else 0
        profit_factor = total_wins / total_losses if total_losses > 0 else 0
        
        return XIRRMetrics(
            xirr=xirr,
            twr=twr,
            mwr=mwr,
            total_return=total_return,
            total_return_pct=total_return_pct,
            annualized_return=annualized_return,
            volatility=volatility,
            sharpe_ratio=sharpe_ratio,
            max_drawdown=max_drawdown,
            calmar_ratio=calmar_ratio,
            sortino_ratio=sortino_ratio,
            win_rate=win_rate,
            profit_factor=profit_factor,
            average_win=average_win,
            average_loss=average_loss,
            largest_win=largest_win,
            largest_loss=largest_loss,
            holding_period_days=holding_period_days,
            total_invested=total_invested,
            current_value=current_value
        )
    
    def _calculate_xirr_core(self, current_prices: Dict[str, float], end_date: datetime) -> float:
        """Core XIRR calculation with multiple methods"""
        cash_flows = []
        dates = []
        
        # Add transaction cash flows
        for txn in self.transactions:
            cash_flows.append(txn['cash_flow'])
            dates.append(txn['date'])
        
        # Add current portfolio value
        positions = self._calculate_current_positions()
        current_value = sum(pos['quantity'] * current_prices.get(symbol, 0) 
                          for symbol, pos in positions.items())
        
        if current_value > 0:
            cash_flows.append(current_value)
            dates.append(end_date)
        
        if len(cash_flows) < 2:
            return 0.0
        
        # Convert to years from start
        start_date = min(dates)
        years = [(date - start_date).days / 365.25 for date in dates]
        
        def npv(rate):
            return sum(cf / (1 + rate) ** year for cf, year in zip(cash_flows, years))
        
        try:
            # Try Newton's method first
            xirr = newton(npv, 0.1, maxiter=100)
            return xirr
        except:
            try:
                # Fallback to Brent's method
                xirr = brentq(npv, -0.99, 10.0, maxiter=100)
                return xirr
            except:
                # Simple approximation
                total_invested = sum(cf for cf in cash_flows[:-1] if cf < 0)
                if total_invested < 0:
                    total_return = (current_value + total_invested) / abs(total_invested)
                    time_period = (end_date - start_date).days / 365.25
                    return (total_return ** (1 / time_period)) - 1 if time_period > 0 else 0
                return 0.0
    
    def _calculate_time_weighted_return(self, current_prices: Dict[str, float]) -> float:
        """Calculate time-weighted return"""
        if not self.transactions:
            return 0.0
        
        # Get unique transaction dates
        transaction_dates = sorted(set(pd.to_datetime(txn['date']).date() for txn in self.transactions))
        
        if len(transaction_dates) < 2:
            return 0.0
        
        period_returns = []
        
        for i in range(len(transaction_dates) - 1):
            start_date = transaction_dates[i]
            end_date = transaction_dates[i + 1]
            
            # Portfolio value at start and end of period
            start_positions = self._get_positions_at_date(start_date)
            end_positions = self._get_positions_at_date(end_date)
            
            # Calculate values (simplified - would need historical prices for accuracy)
            start_value = sum(qty * current_prices.get(symbol, 0) for symbol, qty in start_positions.items())
            end_value = sum(qty * current_prices.get(symbol, 0) for symbol, qty in end_positions.items())
            
            # Cash flows during period
            period_cash_flows = sum(txn['cash_flow'] for txn in self.transactions 
                                  if start_date < pd.to_datetime(txn['date']).date() <= end_date)
            
            if start_value > 0:
                period_return = (end_value - start_value - period_cash_flows) / start_value
                period_returns.append(period_return)
        
        # Compound returns
        if period_returns:
            twr = np.prod([1 + r for r in period_returns]) - 1
            return twr
        
        return 0.0
    
    def _calculate_current_positions(self) -> Dict:
        """Calculate current positions using FIFO"""
        positions = {}
        
        for txn in sorted(self.transactions, key=lambda x: x['date']):
            symbol = txn['symbol']
            
            if symbol not in positions:
                positions[symbol] = {'lots': [], 'quantity': 0}
            
            if txn['type'] == 'BUY':
                positions[symbol]['lots'].append({
                    'quantity': txn['quantity'],
                    'price': txn['price'],
                    'date': txn['date'],
                    'fees': txn['fees']
                })
                positions[symbol]['quantity'] += txn['quantity']
            
            elif txn['type'] == 'SELL':
                remaining = txn['quantity']
                
                while remaining > 0 and positions[symbol]['lots']:
                    lot = positions[symbol]['lots'][0]
                    
                    if lot['quantity'] <= remaining:
                        remaining -= lot['quantity']
                        positions[symbol]['quantity'] -= lot['quantity']
                        positions[symbol]['lots'].pop(0)
                    else:
                        lot['quantity'] -= remaining
                        positions[symbol]['quantity'] -= remaining
                        remaining = 0
        
        return {k: v for k, v in positions.items() if v['quantity'] > 0}
    
    def _get_positions_at_date(self, target_date) -> Dict[str, float]:
        """Get positions at specific date"""
        positions = {}
        
        # Convert target_date to datetime if it's a date
        if hasattr(target_date, 'date'):
            target_date = target_date
        else:
            target_date = pd.to_datetime(target_date)
        
        for txn in self.transactions:
            txn_date = pd.to_datetime(txn['date'])
            if txn_date.date() <= target_date.date():
                symbol = txn['symbol']
                if symbol not in positions:
                    positions[symbol] = 0
                
                if txn['type'] == 'BUY':
                    positions[symbol] += txn['quantity']
                elif txn['type'] == 'SELL':
                    positions[symbol] -= txn['quantity']
        
        return {k: v for k, v in positions.items() if v > 0}
    
    def _build_portfolio_history(self, current_prices: Dict[str, float]) -> pd.DataFrame:
        """Build daily portfolio value history"""
        if not self.transactions:
            return pd.DataFrame()
        
        start_date = min(pd.to_datetime(txn['date']) for txn in self.transactions).date()
        end_date = datetime.now().date()
        
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        portfolio_values = []
        
        for date in date_range:
            positions = self._get_positions_at_date(date)
            portfolio_value = sum(qty * current_prices.get(symbol, 0) 
                                for symbol, qty in positions.items())
            portfolio_values.append(portfolio_value)
        
        df = pd.DataFrame({
            'date': date_range,
            'portfolio_value': portfolio_values
        })
        
        df['daily_return'] = df['portfolio_value'].pct_change()
        return df
    
    def _get_realized_trades(self) -> List[Dict]:
        """Get realized P&L from completed trades"""
        realized_trades = []
        positions = {}
        
        for txn in sorted(self.transactions, key=lambda x: x['date']):
            symbol = txn['symbol']
            
            if symbol not in positions:
                positions[symbol] = []
            
            if txn['type'] == 'BUY':
                positions[symbol].append({
                    'quantity': txn['quantity'],
                    'price': txn['price'],
                    'date': txn['date'],
                    'fees': txn['fees']
                })
            
            elif txn['type'] == 'SELL':
                remaining = txn['quantity']
                
                while remaining > 0 and positions[symbol]:
                    lot = positions[symbol][0]
                    
                    if lot['quantity'] <= remaining:
                        # Full lot sold
                        pnl = (txn['price'] - lot['price']) * lot['quantity'] - lot['fees'] - (txn['fees'] * lot['quantity'] / txn['quantity'])
                        
                        realized_trades.append({
                            'symbol': symbol,
                            'buy_date': lot['date'],
                            'sell_date': txn['date'],
                            'quantity': lot['quantity'],
                            'buy_price': lot['price'],
                            'sell_price': txn['price'],
                            'pnl': pnl,
                            'holding_days': (txn['date'] - lot['date']).days
                        })
                        
                        remaining -= lot['quantity']
                        positions[symbol].pop(0)
                    else:
                        # Partial lot sold
                        pnl = (txn['price'] - lot['price']) * remaining - (lot['fees'] * remaining / lot['quantity']) - (txn['fees'] * remaining / txn['quantity'])
                        
                        realized_trades.append({
                            'symbol': symbol,
                            'buy_date': lot['date'],
                            'sell_date': txn['date'],
                            'quantity': remaining,
                            'buy_price': lot['price'],
                            'sell_price': txn['price'],
                            'pnl': pnl,
                            'holding_days': (txn['date'] - lot['date']).days
                        })
                        
                        lot['quantity'] -= remaining
                        lot['fees'] *= (lot['quantity'] / (lot['quantity'] + remaining))
                        remaining = 0
        
        return realized_trades
    
    def generate_detailed_report(self, current_prices: Dict[str, float]) -> Dict:
        """Generate comprehensive XIRR analysis report"""
        metrics = self.calculate_detailed_xirr(current_prices)
        positions = self._calculate_current_positions()
        realized_trades = self._get_realized_trades()
        
        # Position analysis
        position_analysis = {}
        for symbol, pos_data in positions.items():
            current_price = current_prices.get(symbol, 0)
            
            # Calculate weighted average cost
            total_cost = sum(lot['quantity'] * lot['price'] + lot['fees'] for lot in pos_data['lots'])
            avg_cost = total_cost / pos_data['quantity'] if pos_data['quantity'] > 0 else 0
            
            market_value = pos_data['quantity'] * current_price
            unrealized_pnl = market_value - total_cost
            
            position_analysis[symbol] = {
                'quantity': pos_data['quantity'],
                'avg_cost': avg_cost,
                'current_price': current_price,
                'market_value': market_value,
                'unrealized_pnl': unrealized_pnl,
                'unrealized_pnl_pct': unrealized_pnl / total_cost if total_cost > 0 else 0,
                'weight': market_value / metrics.current_value if metrics.current_value > 0 else 0,
                'lots_count': len(pos_data['lots']),
                'oldest_lot_date': min(lot['date'] for lot in pos_data['lots']) if pos_data['lots'] else None
            }
        
        # Monthly performance breakdown
        monthly_performance = self._calculate_monthly_performance(current_prices)
        
        # Risk attribution
        risk_attribution = self._calculate_risk_attribution(position_analysis)
        
        return {
            'metrics': metrics,
            'positions': position_analysis,
            'realized_trades': realized_trades,
            'monthly_performance': monthly_performance,
            'risk_attribution': risk_attribution,
            'transaction_summary': {
                'total_transactions': len(self.transactions),
                'buy_transactions': len([t for t in self.transactions if t['type'] == 'BUY']),
                'sell_transactions': len([t for t in self.transactions if t['type'] == 'SELL']),
                'total_fees': sum(t['fees'] for t in self.transactions),
                'average_trade_size': np.mean([t['notional'] for t in self.transactions]) if self.transactions else 0
            }
        }
    
    def _calculate_monthly_performance(self, current_prices: Dict[str, float]) -> List[Dict]:
        """Calculate month-by-month performance"""
        if not self.transactions:
            return []
        
        start_date = min(txn['date'] for txn in self.transactions)
        end_date = datetime.now()
        
        monthly_data = []
        current_date = start_date.replace(day=1)
        
        while current_date <= end_date:
            month_end = (current_date.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
            
            # Portfolio value at month start and end
            start_positions = self._get_positions_at_date(current_date.date())
            end_positions = self._get_positions_at_date(month_end.date())
            
            start_value = sum(qty * current_prices.get(symbol, 0) for symbol, qty in start_positions.items())
            end_value = sum(qty * current_prices.get(symbol, 0) for symbol, qty in end_positions.items())
            
            # Cash flows during month
            month_cash_flows = sum(txn['cash_flow'] for txn in self.transactions 
                                 if current_date <= pd.to_datetime(txn['date']) <= month_end)
            
            # Monthly return
            if start_value > 0:
                monthly_return = (end_value - start_value - month_cash_flows) / start_value
            else:
                monthly_return = 0
            
            monthly_data.append({
                'month': current_date.strftime('%Y-%m'),
                'start_value': start_value,
                'end_value': end_value,
                'cash_flows': month_cash_flows,
                'monthly_return': monthly_return,
                'transactions_count': len([t for t in self.transactions if current_date <= t['date'] <= month_end])
            })
            
            # Move to next month
            current_date = month_end + timedelta(days=1)
        
        return monthly_data
    
    def _calculate_risk_attribution(self, position_analysis: Dict) -> Dict:
        """Calculate risk attribution by position"""
        total_value = sum(pos['market_value'] for pos in position_analysis.values())
        
        risk_attribution = {}
        for symbol, pos in position_analysis.items():
            weight = pos['weight']
            
            # Simplified risk contribution (would need correlation matrix for full attribution)
            risk_contribution = weight * abs(pos['unrealized_pnl_pct'])
            
            risk_attribution[symbol] = {
                'weight': weight,
                'risk_contribution': risk_contribution,
                'risk_adjusted_return': pos['unrealized_pnl_pct'] / max(0.01, abs(pos['unrealized_pnl_pct'])) if pos['unrealized_pnl_pct'] != 0 else 0
            }
        
        return risk_attribution
    
    def create_performance_charts(self, current_prices: Dict[str, float]):
        """Create comprehensive performance visualization charts"""
        report = self.generate_detailed_report(current_prices)
        charts = {}
        
        # 1. Portfolio Value Over Time
        portfolio_history = self._build_portfolio_history(current_prices)
        if not portfolio_history.empty:
            fig_value = px.line(portfolio_history, x='date', y='portfolio_value',
                               title='Portfolio Value Over Time')
            fig_value.update_layout(xaxis_title='Date', yaxis_title='Portfolio Value ($)')
            charts['portfolio_value'] = fig_value
        
        # 2. Monthly Returns Heatmap
        monthly_perf = report['monthly_performance']
        if monthly_perf:
            monthly_df = pd.DataFrame(monthly_perf)
            monthly_df['year'] = pd.to_datetime(monthly_df['month']).dt.year
            monthly_df['month_name'] = pd.to_datetime(monthly_df['month']).dt.strftime('%b')
            
            pivot_df = monthly_df.pivot(index='year', columns='month_name', values='monthly_return')
            
            fig_heatmap = px.imshow(pivot_df.values, 
                                   x=pivot_df.columns, 
                                   y=pivot_df.index,
                                   color_continuous_scale='RdYlGn',
                                   title='Monthly Returns Heatmap')
            charts['monthly_heatmap'] = fig_heatmap
        
        # 3. Position Performance
        positions_data = []
        for symbol, pos in report['positions'].items():
            positions_data.append({
                'Symbol': symbol,
                'Unrealized P&L': pos['unrealized_pnl'],
                'Unrealized P&L %': pos['unrealized_pnl_pct'],
                'Market Value': pos['market_value']
            })
        
        if positions_data:
            pos_df = pd.DataFrame(positions_data)
            
            fig_pos = px.scatter(pos_df, x='Market Value', y='Unrealized P&L %',
                               size='Market Value', hover_name='Symbol',
                               title='Position Performance vs Size',
                               color='Unrealized P&L %',
                               color_continuous_scale='RdYlGn')
            charts['position_performance'] = fig_pos
        
        # 4. Realized vs Unrealized P&L
        realized_pnl = sum(trade['pnl'] for trade in report['realized_trades'])
        unrealized_pnl = sum(pos['unrealized_pnl'] for pos in report['positions'].values())
        
        pnl_data = pd.DataFrame({
            'Type': ['Realized P&L', 'Unrealized P&L'],
            'Amount': [realized_pnl, unrealized_pnl]
        })
        
        fig_pnl = px.bar(pnl_data, x='Type', y='Amount',
                        title='Realized vs Unrealized P&L',
                        color='Amount',
                        color_continuous_scale='RdYlGn')
        charts['pnl_breakdown'] = fig_pnl
        
        # 5. Trade Analysis
        if report['realized_trades']:
            trades_df = pd.DataFrame(report['realized_trades'])
            
            fig_trades = px.scatter(trades_df, x='holding_days', y='pnl',
                                  size='quantity', hover_name='symbol',
                                  title='Trade Performance vs Holding Period',
                                  color='pnl',
                                  color_continuous_scale='RdYlGn')
            charts['trade_analysis'] = fig_trades
        
        return charts