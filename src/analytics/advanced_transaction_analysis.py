import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
from core.transactions import Transaction, TransactionPortfolio
from clients.market_data_client import MarketDataClient

class AdvancedTransactionAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def trade_performance_analysis(self, transactions: List[Transaction]) -> Dict:
        """Win/loss ratios, average trade size, success metrics"""
        trades = [t for t in transactions if t.transaction_type in ['BUY', 'SELL']]
        if not trades:
            return {}
        
        # Group buy/sell pairs
        positions = defaultdict(list)
        for trade in sorted(trades, key=lambda x: x.date):
            positions[trade.symbol].append(trade)
        
        winning_trades = 0
        losing_trades = 0
        total_profit = 0
        total_loss = 0
        trade_sizes = []
        
        for symbol, symbol_trades in positions.items():
            current_position = 0
            avg_cost = 0
            
            for trade in symbol_trades:
                if trade.transaction_type == 'BUY':
                    if current_position == 0:
                        avg_cost = trade.price
                    else:
                        avg_cost = ((current_position * avg_cost) + (trade.quantity * trade.price)) / (current_position + trade.quantity)
                    current_position += trade.quantity
                    trade_sizes.append(trade.quantity * trade.price)
                
                elif trade.transaction_type == 'SELL' and current_position > 0:
                    pnl = (trade.price - avg_cost) * trade.quantity - trade.fees
                    if pnl > 0:
                        winning_trades += 1
                        total_profit += pnl
                    else:
                        losing_trades += 1
                        total_loss += abs(pnl)
                    
                    current_position -= trade.quantity
                    trade_sizes.append(trade.quantity * trade.price)
        
        total_trades = winning_trades + losing_trades
        
        return {
            'total_trades': total_trades,
            'winning_trades': winning_trades,
            'losing_trades': losing_trades,
            'win_rate': winning_trades / total_trades if total_trades > 0 else 0,
            'avg_win': total_profit / winning_trades if winning_trades > 0 else 0,
            'avg_loss': total_loss / losing_trades if losing_trades > 0 else 0,
            'profit_factor': total_profit / total_loss if total_loss > 0 else 1.0,
            'avg_trade_size': np.mean(trade_sizes) if trade_sizes else 0,
            'largest_trade': max(trade_sizes) if trade_sizes else 0,
            'smallest_trade': min(trade_sizes) if trade_sizes else 0
        }
    
    def turnover_analysis(self, transactions: List[Transaction]) -> Dict:
        """Portfolio turnover rates and trading frequency"""
        if not transactions:
            return {}
        
        # Calculate portfolio value over time
        dates = sorted(set(t.date.date() for t in transactions))
        daily_values = {}
        daily_turnover = {}
        
        for date in dates:
            day_transactions = [t for t in transactions if t.date.date() == date]
            
            # Calculate total portfolio value and turnover for the day
            total_value = 0
            turnover_value = 0
            
            for txn in day_transactions:
                trade_value = abs(txn.quantity * txn.price)
                total_value += trade_value
                
                if txn.transaction_type in ['BUY', 'SELL']:
                    turnover_value += trade_value
            
            daily_values[date] = total_value
            daily_turnover[date] = turnover_value
        
        # Calculate annualized turnover
        total_period_days = (max(dates) - min(dates)).days if len(dates) > 1 else 1
        avg_portfolio_value = np.mean(list(daily_values.values()))
        total_turnover = sum(daily_turnover.values())
        
        annualized_turnover = (total_turnover / avg_portfolio_value) * (365 / total_period_days) if avg_portfolio_value > 0 and total_period_days > 0 else 0
        
        return {
            'annualized_turnover_rate': annualized_turnover,
            'avg_daily_turnover': np.mean(list(daily_turnover.values())),
            'max_daily_turnover': max(daily_turnover.values()) if daily_turnover else 0,
            'trading_days': len([v for v in daily_turnover.values() if v > 0]),
            'total_period_days': total_period_days,
            'turnover_frequency': len([v for v in daily_turnover.values() if v > 0]) / total_period_days if total_period_days > 0 else 0
        }
    
    def tax_loss_harvesting_analysis(self, transactions: List[Transaction]) -> Dict:
        """Tax-loss harvesting opportunities and tax efficiency"""
        # Use all transactions, not just current year
        year_transactions = transactions
        
        # Track positions and unrealized losses
        positions = defaultdict(lambda: {'quantity': 0, 'avg_cost': 0, 'lots': []})
        realized_gains = 0
        realized_losses = 0
        
        for txn in sorted(year_transactions, key=lambda x: x.date):
            symbol = txn.symbol
            
            if txn.transaction_type in ['BUY', 'Buy']:
                # Add to position
                old_value = positions[symbol]['quantity'] * positions[symbol]['avg_cost']
                new_value = abs(txn.quantity) * txn.price
                total_quantity = positions[symbol]['quantity'] + abs(txn.quantity)
                
                if total_quantity > 0:
                    positions[symbol]['avg_cost'] = (old_value + new_value) / total_quantity
                positions[symbol]['quantity'] = total_quantity
                positions[symbol]['lots'].append({
                    'quantity': abs(txn.quantity),
                    'price': txn.price,
                    'date': txn.date
                })
            
            elif txn.transaction_type in ['SELL', 'Sell']:
                # Calculate realized P&L
                if positions[symbol]['quantity'] > 0:
                    sell_quantity = abs(txn.quantity)
                    pnl = (txn.price - positions[symbol]['avg_cost']) * sell_quantity - txn.fees
                    if pnl > 0:
                        realized_gains += pnl
                    else:
                        realized_losses += abs(pnl)
                    
                    positions[symbol]['quantity'] -= sell_quantity
        
        # Calculate unrealized losses for harvesting
        current_prices = self.data_client.get_current_prices(list(positions.keys()))
        harvestable_losses = 0
        harvest_opportunities = []
        
        for symbol, position in positions.items():
            if position['quantity'] > 0:
                current_price = current_prices.get(symbol, position['avg_cost'])
                unrealized_pnl = (current_price - position['avg_cost']) * position['quantity']
                
                if unrealized_pnl < 0:  # Loss position
                    harvestable_losses += abs(unrealized_pnl)
                    harvest_opportunities.append({
                        'symbol': symbol,
                        'quantity': position['quantity'],
                        'avg_cost': position['avg_cost'],
                        'current_price': current_price,
                        'unrealized_loss': abs(unrealized_pnl),
                        'loss_percentage': (unrealized_pnl / (position['avg_cost'] * position['quantity'])) * 100
                    })
        
        # Calculate tax liability estimates
        short_term_gains = 0
        long_term_gains = 0
        
        # Estimate tax rates (simplified)
        short_term_tax_rate = 0.37  # Ordinary income rate
        long_term_tax_rate = 0.20   # Capital gains rate
        
        # Calculate short-term vs long-term gains based on holding period
        # For now, assume all gains are short-term (< 1 year holding period)
        net_gains = realized_gains - realized_losses
        if net_gains > 0:
            short_term_gains = net_gains  # Simplified: assume all short-term
            long_term_gains = 0
        else:
            short_term_gains = 0
            long_term_gains = 0
        
        estimated_tax_liability = (short_term_gains * short_term_tax_rate) + (long_term_gains * long_term_tax_rate)
        
        return {
            'realized_gains': realized_gains,
            'realized_losses': realized_losses,
            'net_realized_pnl': realized_gains - realized_losses,
            'short_term_gains': short_term_gains,
            'long_term_gains': long_term_gains,
            'estimated_tax_liability': estimated_tax_liability,
            'harvestable_losses': harvestable_losses,
            'harvest_opportunities': sorted(harvest_opportunities, key=lambda x: x['unrealized_loss'], reverse=True),
            'tax_efficiency_ratio': realized_losses / realized_gains if realized_gains > 0 else 0
        }
    
    def cash_flow_analysis(self, transactions: List[Transaction]) -> Dict:
        """Deposits, withdrawals, dividends, and cash flow patterns"""
        cash_flows = {
            'deposits': [],
            'withdrawals': [],
            'dividends': [],
            'interest': [],
            'fees': []
        }
        
        # Calculate cash inflows and outflows from BUY/SELL transactions
        total_inflows = 0  # Money coming in (from sells)
        total_outflows = 0  # Money going out (from buys)
        
        for txn in transactions:
            # Handle explicit cash flow transaction types
            if txn.transaction_type in ['DEPOSIT', 'Deposit', 'CASH_DEPOSIT']:
                amount = abs(txn.quantity * txn.price)
                cash_flows['deposits'].append({
                    'date': txn.date,
                    'amount': amount,
                    'symbol': txn.symbol
                })
                total_inflows += amount
                
            elif txn.transaction_type in ['WITHDRAW', 'Withdrawal', 'CASH_WITHDRAWAL', 'Withdraw']:
                amount = abs(txn.quantity * txn.price)
                cash_flows['withdrawals'].append({
                    'date': txn.date,
                    'amount': amount,
                    'symbol': txn.symbol
                })
                total_outflows += amount
                
            elif txn.transaction_type in ['DIVIDEND', 'Dividend', 'DIV']:
                amount = abs(txn.quantity * txn.price)
                cash_flows['dividends'].append({
                    'date': txn.date,
                    'amount': amount,
                    'symbol': txn.symbol
                })
                total_inflows += amount
                
            elif txn.transaction_type in ['INTEREST', 'Interest', 'INT']:
                amount = abs(txn.quantity * txn.price)
                cash_flows['interest'].append({
                    'date': txn.date,
                    'amount': amount,
                    'symbol': txn.symbol
                })
                total_inflows += amount
                
            # Handle BUY/SELL transactions as cash flows
            elif txn.transaction_type in ['BUY', 'Buy']:
                amount = abs(txn.quantity * txn.price) + txn.fees
                total_outflows += amount
                
            elif txn.transaction_type in ['SELL', 'Sell']:
                amount = abs(txn.quantity * txn.price) - txn.fees
                total_inflows += amount
            
            # Track fees separately
            if txn.fees > 0:
                cash_flows['fees'].append({
                    'date': txn.date,
                    'amount': txn.fees,
                    'symbol': txn.symbol
                })
        
        # Calculate totals
        total_deposits = sum(cf['amount'] for cf in cash_flows['deposits'])
        total_withdrawals = sum(cf['amount'] for cf in cash_flows['withdrawals'])
        total_dividends = sum(cf['amount'] for cf in cash_flows['dividends'])
        total_interest = sum(cf['amount'] for cf in cash_flows['interest'])
        total_fees = sum(cf['amount'] for cf in cash_flows['fees'])
        
        # If no explicit deposits/withdrawals, use buy/sell flows
        if total_deposits == 0 and total_withdrawals == 0:
            total_deposits = total_inflows
            total_withdrawals = total_outflows
        
        net_cash_flow = total_deposits - total_withdrawals
        
        return {
            'total_deposits': total_deposits,
            'total_withdrawals': total_withdrawals,
            'total_dividends': total_dividends,
            'total_interest': total_interest,
            'total_fees': total_fees,
            'net_cash_flow': net_cash_flow,
            'cash_inflows': total_inflows,
            'cash_outflows': total_outflows,
            'cash_flow_details': cash_flows,
            'dividend_yield_estimate': total_dividends / total_deposits if total_deposits > 0 else 0
        }
    
    def trade_timing_analysis(self, transactions: List[Transaction]) -> Dict:
        """Entry/exit timing effectiveness analysis"""
        symbols = list(set(t.symbol for t in transactions if t.transaction_type in ['BUY', 'SELL']))
        timing_analysis = {}
        
        for symbol in symbols:
            symbol_trades = [t for t in transactions if t.symbol == symbol and t.transaction_type in ['BUY', 'SELL']]
            if len(symbol_trades) < 2:
                continue
            
            # Get price data for the symbol
            try:
                price_data = self.data_client.get_price_data([symbol], '1y')
                if symbol not in price_data.columns:
                    continue
                
                symbol_prices = price_data[symbol].dropna()
                
                buy_timing_scores = []
                sell_timing_scores = []
                
                for trade in symbol_trades:
                    trade_date = trade.date.date()
                    
                    # Find prices around trade date (±30 days)
                    start_date = trade_date - timedelta(days=30)
                    end_date = trade_date + timedelta(days=30)
                    
                    period_prices = symbol_prices[
                        (symbol_prices.index.date >= start_date) & 
                        (symbol_prices.index.date <= end_date)
                    ]
                    
                    if len(period_prices) > 0:
                        min_price = period_prices.min()
                        max_price = period_prices.max()
                        trade_price = trade.price
                        
                        if trade.transaction_type == 'BUY':
                            # Good buy timing = buying closer to period low
                            timing_score = (max_price - trade_price) / (max_price - min_price) if max_price != min_price else 0.5
                            buy_timing_scores.append(timing_score)
                        
                        elif trade.transaction_type == 'SELL':
                            # Good sell timing = selling closer to period high
                            timing_score = (trade_price - min_price) / (max_price - min_price) if max_price != min_price else 0.5
                            sell_timing_scores.append(timing_score)
                
                timing_analysis[symbol] = {
                    'avg_buy_timing': np.mean(buy_timing_scores) if buy_timing_scores else 0,
                    'avg_sell_timing': np.mean(sell_timing_scores) if sell_timing_scores else 0,
                    'buy_trades': len(buy_timing_scores),
                    'sell_trades': len(sell_timing_scores)
                }
            
            except Exception:
                continue
        
        # Overall timing metrics
        all_buy_scores = [analysis['avg_buy_timing'] for analysis in timing_analysis.values() if analysis['buy_trades'] > 0]
        all_sell_scores = [analysis['avg_sell_timing'] for analysis in timing_analysis.values() if analysis['sell_trades'] > 0]
        
        return {
            'symbol_timing': timing_analysis,
            'overall_buy_timing': np.mean(all_buy_scores) if all_buy_scores else 0,
            'overall_sell_timing': np.mean(all_sell_scores) if all_sell_scores else 0,
            'timing_consistency': np.std(all_buy_scores + all_sell_scores) if (all_buy_scores + all_sell_scores) else 0
        }
    
    def drawdown_analysis(self, transactions: List[Transaction]) -> Dict:
        """Maximum loss periods and drawdown analysis"""
        if not transactions:
            return {}
        
        # Calculate daily portfolio values
        sorted_transactions = sorted(transactions, key=lambda x: x.date)
        start_date = sorted_transactions[0].date.date()
        end_date = sorted_transactions[-1].date.date()
        
        # Create daily portfolio value series
        current_date = start_date
        daily_values = {}
        portfolio_positions = defaultdict(lambda: {'quantity': 0, 'avg_cost': 0})
        
        while current_date <= end_date:
            # Process transactions for this date
            day_transactions = [t for t in sorted_transactions if t.date.date() == current_date]
            
            for txn in day_transactions:
                if txn.transaction_type == 'BUY':
                    old_value = portfolio_positions[txn.symbol]['quantity'] * portfolio_positions[txn.symbol]['avg_cost']
                    new_value = txn.quantity * txn.price
                    total_quantity = portfolio_positions[txn.symbol]['quantity'] + txn.quantity
                    
                    if total_quantity > 0:
                        portfolio_positions[txn.symbol]['avg_cost'] = (old_value + new_value) / total_quantity
                    portfolio_positions[txn.symbol]['quantity'] = total_quantity
                
                elif txn.transaction_type == 'SELL':
                    portfolio_positions[txn.symbol]['quantity'] -= txn.quantity
            
            # Calculate portfolio value (simplified - using avg cost as proxy)
            total_value = sum(pos['quantity'] * pos['avg_cost'] for pos in portfolio_positions.values() if pos['quantity'] > 0)
            daily_values[current_date] = total_value
            
            current_date += timedelta(days=1)
        
        # Calculate drawdowns
        values = list(daily_values.values())
        if not values:
            return {}
        
        peak = values[0]
        max_drawdown = 0
        current_drawdown = 0
        drawdown_periods = []
        drawdown_start = None
        
        for i, value in enumerate(values):
            if value > peak:
                # New peak - end any current drawdown
                if drawdown_start is not None:
                    drawdown_periods.append({
                        'start_date': list(daily_values.keys())[drawdown_start],
                        'end_date': list(daily_values.keys())[i-1],
                        'duration_days': i - drawdown_start,
                        'drawdown_pct': current_drawdown
                    })
                    drawdown_start = None
                
                peak = value
                current_drawdown = 0
            else:
                # Potential drawdown
                current_drawdown = (peak - value) / peak
                if current_drawdown > max_drawdown:
                    max_drawdown = current_drawdown
                
                if drawdown_start is None and current_drawdown > 0.01:  # Start tracking at 1% drawdown
                    drawdown_start = i
        
        # Handle ongoing drawdown
        if drawdown_start is not None:
            drawdown_periods.append({
                'start_date': list(daily_values.keys())[drawdown_start],
                'end_date': list(daily_values.keys())[-1],
                'duration_days': len(values) - drawdown_start,
                'drawdown_pct': current_drawdown,
                'ongoing': True
            })
        
        return {
            'max_drawdown_pct': max_drawdown * 100,
            'drawdown_periods': drawdown_periods,
            'avg_drawdown_duration': np.mean([dd['duration_days'] for dd in drawdown_periods]) if drawdown_periods else 0,
            'longest_drawdown_days': max([dd['duration_days'] for dd in drawdown_periods]) if drawdown_periods else 0,
            'recovery_periods': len([dd for dd in drawdown_periods if not dd.get('ongoing', False)])
        }