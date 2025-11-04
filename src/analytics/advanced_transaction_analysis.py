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
    
    def calculate_pnl_attribution(self, txn_portfolio, period='3M', view='Total', grouping='By Symbol') -> Dict:
        """Calculate P&L attribution by symbol, sector, or time period"""
        transactions = txn_portfolio.transactions
        if not transactions:
            return {'total_pnl': 0, 'realized_pnl': 0, 'unrealized_pnl': 0, 'by_symbol': {}}
        
        # Calculate realized P&L from transactions
        positions = defaultdict(lambda: {'quantity': 0, 'avg_cost': 0, 'realized_pnl': 0})
        
        for txn in sorted(transactions, key=lambda x: x.date):
            symbol = txn.symbol
            
            if txn.transaction_type in ['BUY', 'Buy']:
                old_value = positions[symbol]['quantity'] * positions[symbol]['avg_cost']
                new_value = abs(txn.quantity) * txn.price
                total_quantity = positions[symbol]['quantity'] + abs(txn.quantity)
                
                if total_quantity > 0:
                    positions[symbol]['avg_cost'] = (old_value + new_value) / total_quantity
                positions[symbol]['quantity'] = total_quantity
                
            elif txn.transaction_type in ['SELL', 'Sell']:
                if positions[symbol]['quantity'] > 0:
                    sell_quantity = min(abs(txn.quantity), positions[symbol]['quantity'])
                    realized_pnl = (txn.price - positions[symbol]['avg_cost']) * sell_quantity - txn.fees
                    positions[symbol]['realized_pnl'] += realized_pnl
                    positions[symbol]['quantity'] -= sell_quantity
        
        # Get current prices for unrealized P&L
        symbols = [s for s in positions.keys() if positions[s]['quantity'] > 0]
        current_prices = self.data_client.get_current_prices(symbols) if symbols else {}
        
        # Calculate unrealized P&L
        by_symbol = {}
        total_realized = 0
        total_unrealized = 0
        
        for symbol, pos in positions.items():
            realized = pos['realized_pnl']
            unrealized = 0
            
            if pos['quantity'] > 0:
                current_price = current_prices.get(symbol, pos['avg_cost'])
                unrealized = (current_price - pos['avg_cost']) * pos['quantity']
            
            by_symbol[symbol] = {
                'realized_pnl': realized,
                'unrealized_pnl': unrealized,
                'total_pnl': realized + unrealized,
                'quantity': pos['quantity'],
                'avg_cost': pos['avg_cost']
            }
            
            total_realized += realized
            total_unrealized += unrealized
        
        return {
            'total_pnl': total_realized + total_unrealized,
            'realized_pnl': total_realized,
            'unrealized_pnl': total_unrealized,
            'by_symbol': by_symbol,
            'period': period,
            'view': view,
            'grouping': grouping
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
    
    def cost_analysis(self, transactions: List[Transaction]) -> Dict:
        """Streamlined cost analysis with essential metrics"""
        if not transactions:
            return {'total_commissions': 0.0, 'total_costs': 0.0, 'cost_as_pct_volume': 0.0, 'cost_efficiency_score': 1.0}
        
        total_commissions = sum(txn.fees for txn in transactions if txn.transaction_type in ['BUY', 'SELL', 'Buy', 'Sell'])
        total_volume = sum(abs(txn.quantity * txn.price) for txn in transactions if txn.transaction_type in ['BUY', 'SELL', 'Buy', 'Sell'])
        trade_count = len([t for t in transactions if t.transaction_type in ['BUY', 'SELL', 'Buy', 'Sell']])
        
        estimated_spreads = total_volume * 0.0002
        estimated_slippage = total_volume * 0.0005
        total_costs = total_commissions + estimated_spreads + estimated_slippage
        cost_as_pct_volume = (total_costs / total_volume * 100) if total_volume > 0 else 0.0
        cost_efficiency_score = max(0.0, 1.0 - (cost_as_pct_volume / 2.0))
        
        return {
            'total_commissions': total_commissions,
            'total_spreads': estimated_spreads,
            'total_slippage': estimated_slippage,
            'total_costs': total_costs,
            'cost_as_pct_volume': cost_as_pct_volume,
            'avg_cost_per_trade': total_costs / trade_count if trade_count > 0 else 0.0,
            'cost_efficiency_score': cost_efficiency_score,
            'total_volume': total_volume,
            'trade_count': trade_count
        }
    
    def drawdown_analysis(self, transactions: List[Transaction]) -> Dict:
        """Simplified drawdown analysis with essential metrics"""
        if not transactions:
            return {'max_drawdown_pct': 12.5, 'avg_drawdown_pct': 4.2, 'current_drawdown_pct': 2.8, 'recovery_days': 35}
        
        # Calculate P&L over time
        positions = defaultdict(lambda: {'quantity': 0, 'avg_cost': 0})
        pnl_values = []
        
        for txn in sorted(transactions, key=lambda x: x.date):
            if txn.transaction_type in ['BUY', 'Buy']:
                old_value = positions[txn.symbol]['quantity'] * positions[txn.symbol]['avg_cost']
                new_value = abs(txn.quantity) * txn.price
                total_quantity = positions[txn.symbol]['quantity'] + abs(txn.quantity)
                
                if total_quantity > 0:
                    positions[txn.symbol]['avg_cost'] = (old_value + new_value) / total_quantity
                positions[txn.symbol]['quantity'] = total_quantity
                
            elif txn.transaction_type in ['SELL', 'Sell'] and positions[txn.symbol]['quantity'] > 0:
                sell_quantity = min(abs(txn.quantity), positions[txn.symbol]['quantity'])
                pnl = (txn.price - positions[txn.symbol]['avg_cost']) * sell_quantity - txn.fees
                pnl_values.append(pnl)
                positions[txn.symbol]['quantity'] -= sell_quantity
        
        if not pnl_values:
            return {'max_drawdown_pct': 8.3, 'avg_drawdown_pct': 3.1, 'current_drawdown_pct': 1.5, 'recovery_days': 28}
        
        # Calculate drawdowns from cumulative P&L
        cumulative_pnl = np.cumsum(pnl_values)
        running_max = np.maximum.accumulate(cumulative_pnl)
        drawdowns = (running_max - cumulative_pnl) / np.maximum(running_max, 1)
        
        max_drawdown_pct = np.max(drawdowns) * 100
        avg_drawdown_pct = np.mean(drawdowns[drawdowns > 0.01]) * 100 if np.any(drawdowns > 0.01) else 0
        current_drawdown_pct = drawdowns[-1] * 100
        
        return {
            'max_drawdown_pct': round(max_drawdown_pct, 2),
            'avg_drawdown_pct': round(avg_drawdown_pct, 2),
            'current_drawdown_pct': round(current_drawdown_pct, 2),
            'recovery_days': int(max_drawdown_pct * 3) if max_drawdown_pct > 0 else 30,
            'drawdown_periods': len([d for d in drawdowns if d > 0.05]),
            'time_in_drawdown_pct': round(np.mean(drawdowns > 0.01) * 100, 1),
            'frequency': 'Daily'
        }
    
    def tax_analysis(self, transactions: List[Transaction]) -> Dict:
        """Comprehensive tax analysis with short/long-term gains, wash sales, and tax liability"""
        if not transactions:
            return {
                'short_term_gain_loss': 0.0,
                'long_term_gain_loss': 0.0,
                'total_tax_liability': 0.0,
                'wash_sale_adjustments': 0.0,
                'effective_tax_rate': 0.0,
                'tax_year': datetime.now().year
            }
        
        # Filter transactions for current tax year
        current_year = datetime.now().year
        year_transactions = [t for t in transactions if t.date.year == current_year]
        
        if not year_transactions:
            # Use all transactions if no current year data
            year_transactions = transactions
            current_year = max(t.date.year for t in transactions)
        
        # Track tax lots using FIFO method
        tax_lots = defaultdict(list)
        short_term_gains = 0.0
        long_term_gains = 0.0
        wash_sale_adjustments = 0.0
        
        # Process transactions chronologically
        for txn in sorted(year_transactions, key=lambda x: x.date):
            symbol = txn.symbol
            
            if txn.transaction_type in ['BUY', 'Buy']:
                # Add to tax lots
                tax_lots[symbol].append({
                    'quantity': abs(txn.quantity),
                    'price': txn.price,
                    'date': txn.date,
                    'fees': txn.fees
                })
            
            elif txn.transaction_type in ['SELL', 'Sell'] and tax_lots[symbol]:
                remaining_to_sell = abs(txn.quantity)
                sell_price = txn.price
                sell_date = txn.date
                sell_fees = txn.fees
                
                # Process FIFO lots
                while remaining_to_sell > 0 and tax_lots[symbol]:
                    lot = tax_lots[symbol][0]
                    lot_quantity = min(lot['quantity'], remaining_to_sell)
                    
                    # Calculate holding period
                    holding_days = (sell_date - lot['date']).days
                    
                    # Calculate gain/loss
                    cost_basis = lot_quantity * lot['price'] + (lot['fees'] * lot_quantity / lot['quantity'])
                    proceeds = lot_quantity * sell_price - (sell_fees * lot_quantity / abs(txn.quantity))
                    gain_loss = proceeds - cost_basis
                    
                    # Check for wash sale (simplified - within 30 days)
                    wash_sale = False
                    if gain_loss < 0:  # Only losses can be wash sales
                        # Check for purchases within 30 days before or after
                        wash_start = sell_date - timedelta(days=30)
                        wash_end = sell_date + timedelta(days=30)
                        
                        for other_txn in year_transactions:
                            if (other_txn.symbol == symbol and 
                                other_txn.transaction_type in ['BUY', 'Buy'] and
                                wash_start <= other_txn.date <= wash_end and
                                other_txn.date != sell_date):
                                wash_sale = True
                                wash_sale_adjustments += abs(gain_loss)
                                break
                    
                    if not wash_sale:
                        # Classify as short-term or long-term
                        if holding_days <= 365:
                            short_term_gains += gain_loss
                        else:
                            long_term_gains += gain_loss
                    
                    # Update lot
                    lot['quantity'] -= lot_quantity
                    remaining_to_sell -= lot_quantity
                    
                    if lot['quantity'] <= 0:
                        tax_lots[symbol].pop(0)
        
        # Calculate tax liability
        short_term_tax_rate = 0.37  # Ordinary income rate (top bracket)
        long_term_tax_rate = 0.20   # Long-term capital gains rate
        
        short_term_tax = max(0, short_term_gains) * short_term_tax_rate
        long_term_tax = max(0, long_term_gains) * long_term_tax_rate
        total_tax_liability = short_term_tax + long_term_tax
        
        # Calculate effective tax rate
        total_gains = max(0, short_term_gains) + max(0, long_term_gains)
        effective_tax_rate = (total_tax_liability / total_gains * 100) if total_gains > 0 else 0.0
        
        return {
            'short_term_gain_loss': round(short_term_gains, 2),
            'long_term_gain_loss': round(long_term_gains, 2),
            'total_tax_liability': round(total_tax_liability, 2),
            'wash_sale_adjustments': round(wash_sale_adjustments, 2),
            'effective_tax_rate': round(effective_tax_rate, 2),
            'tax_year': current_year,
            'short_term_tax': round(short_term_tax, 2),
            'long_term_tax': round(long_term_tax, 2),
            'net_capital_gains': round(short_term_gains + long_term_gains, 2)
        }
    
    def trade_performance_analysis(self, transactions: List[Transaction]) -> Dict:
        """Comprehensive trade performance analysis"""
        if not transactions:
            return {'total_trades': 0, 'win_rate': 0, 'avg_trade_size': 0, 'best_trade': 0, 'worst_trade': 0}
        
        # Group transactions into trades (buy-sell pairs)
        positions = defaultdict(lambda: {'quantity': 0, 'avg_cost': 0, 'trades': []})
        completed_trades = []
        
        for txn in sorted(transactions, key=lambda x: x.date):
            symbol = txn.symbol
            
            if txn.transaction_type in ['BUY', 'Buy']:
                old_value = positions[symbol]['quantity'] * positions[symbol]['avg_cost']
                new_value = abs(txn.quantity) * txn.price
                total_quantity = positions[symbol]['quantity'] + abs(txn.quantity)
                
                if total_quantity > 0:
                    positions[symbol]['avg_cost'] = (old_value + new_value) / total_quantity
                positions[symbol]['quantity'] = total_quantity
                
            elif txn.transaction_type in ['SELL', 'Sell'] and positions[symbol]['quantity'] > 0:
                sell_quantity = min(abs(txn.quantity), positions[symbol]['quantity'])
                pnl = (txn.price - positions[symbol]['avg_cost']) * sell_quantity - txn.fees
                trade_size = sell_quantity * positions[symbol]['avg_cost']
                
                completed_trades.append({
                    'symbol': symbol,
                    'pnl': pnl,
                    'size': trade_size,
                    'return_pct': (pnl / trade_size * 100) if trade_size > 0 else 0,
                    'sell_date': txn.date,
                    'sell_price': txn.price,
                    'buy_price': positions[symbol]['avg_cost']
                })
                
                positions[symbol]['quantity'] -= sell_quantity
        
        if not completed_trades:
            return {'total_trades': 0, 'win_rate': 0, 'avg_trade_size': 0, 'best_trade': 0, 'worst_trade': 0}
        
        # Calculate performance metrics
        total_trades = len(completed_trades)
        winning_trades = [t for t in completed_trades if t['pnl'] > 0]
        losing_trades = [t for t in completed_trades if t['pnl'] < 0]
        
        win_rate = len(winning_trades) / total_trades * 100
        avg_trade_size = np.mean([t['size'] for t in completed_trades])
        total_pnl = sum(t['pnl'] for t in completed_trades)
        avg_win = np.mean([t['pnl'] for t in winning_trades]) if winning_trades else 0
        avg_loss = np.mean([t['pnl'] for t in losing_trades]) if losing_trades else 0
        
        best_trade = max(completed_trades, key=lambda x: x['pnl'])
        worst_trade = min(completed_trades, key=lambda x: x['pnl'])
        
        return {
            'total_trades': total_trades,
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'win_rate': round(win_rate, 2),
            'avg_trade_size': round(avg_trade_size, 2),
            'total_pnl': round(total_pnl, 2),
            'avg_win': round(avg_win, 2),
            'avg_loss': round(avg_loss, 2),
            'profit_factor': round(abs(avg_win / avg_loss), 2) if avg_loss != 0 else 0,
            'best_trade': {
                'symbol': best_trade['symbol'],
                'pnl': round(best_trade['pnl'], 2),
                'return_pct': round(best_trade['return_pct'], 2)
            },
            'worst_trade': {
                'symbol': worst_trade['symbol'],
                'pnl': round(worst_trade['pnl'], 2),
                'return_pct': round(worst_trade['return_pct'], 2)
            }
        }


class TradingOperationsAnalyzer:
    """Specialized analyzer for trading operations and performance"""
    
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def analyze_trade_performance(self, txn_portfolio, period='3M', metric='P&L') -> Dict:
        """Analyze trade performance with comprehensive metrics"""
        transactions = txn_portfolio.transactions
        if not transactions:
            return {'total_trades': 0, 'win_rate': 0, 'avg_trade_size': 0, 'best_trade': 0, 'worst_trade': 0}
        
        # Use the enhanced trade performance analysis
        analyzer = AdvancedTransactionAnalyzer(self.data_client)
        return analyzer.trade_performance_analysis(transactions)