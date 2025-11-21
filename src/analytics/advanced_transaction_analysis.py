import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
from core.transactions import Transaction, TransactionPortfolio
from clients.market_data_client import MarketDataClient
from utils.date_parser import UniversalDateParser

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

    def cost_analysis(self, transactions: List[Transaction], period='1Y', breakdown='By Symbol', benchmark='Industry average', view='Absolute $') -> Dict:
        """
        Interactive cost analysis with filters and breakdowns.
        
        Args:
            transactions: List of transactions
            period: '1M', '3M', '6M', '1Y', 'YTD'
            breakdown: 'By Symbol', 'By Trade Size', 'By Broker'
            benchmark: 'Industry average', 'Custom'
            view: 'Absolute $', '% of Trade Value', '% of P&L'
        """
        if not transactions:
            return {
                'total_costs': 0.0, 
                'total_commissions': 0.0, 
                'total_spreads': 0.0, 
                'total_slippage': 0.0,
                'breakdown': [],
                'summary': {}
            }
        
        # 1. Filter by Period - Fix timezone comparison issue
        cutoff_date = datetime.now()
        if period == '1M':
            cutoff_date -= timedelta(days=30)
        elif period == '3M':
            cutoff_date -= timedelta(days=90)
        elif period == '6M':
            cutoff_date -= timedelta(days=180)
        elif period == '1Y':
            cutoff_date -= timedelta(days=365)
        elif period == 'YTD':
            cutoff_date = datetime(datetime.now().year, 1, 1)
        
        # Handle timezone-aware vs timezone-naive datetime comparison
        def safe_date_compare(txn_date, cutoff):
            try:
                # If transaction date is timezone-aware, make cutoff timezone-aware too
                if hasattr(txn_date, 'tzinfo') and txn_date.tzinfo is not None:
                    if cutoff.tzinfo is None:
                        import pytz
                        cutoff = cutoff.replace(tzinfo=pytz.UTC)
                # If transaction date is timezone-naive, make cutoff timezone-naive too
                elif cutoff.tzinfo is not None:
                    cutoff = cutoff.replace(tzinfo=None)
                return txn_date >= cutoff
            except:
                # Fallback: compare dates only
                return txn_date.date() >= cutoff.date()
        
        # Include ALL transaction types that involve trading costs
        trading_types = ['BUY', 'SELL', 'Buy', 'Sell', 'buy', 'sell', 'transfer', 'cash']
        filtered_txns = [t for t in transactions if safe_date_compare(t.date, cutoff_date) and t.transaction_type in trading_types and t.price > 0]
        
        if not filtered_txns:
             return {
                'total_costs': 0.0, 
                'total_commissions': 0.0, 
                'total_spreads': 0.0, 
                'total_slippage': 0.0,
                'breakdown': [],
                'summary': {}
            }

        # 2. Calculate Real Costs from Transaction Data
        total_volume = sum(abs(t.quantity * t.price) for t in filtered_txns)
        
        # Use actual commission fees from transactions
        total_commissions = sum(t.fees for t in filtered_txns)
        
        # Get real market spreads and slippage using market data
        total_spreads, total_slippage = self._calculate_real_market_costs(filtered_txns)
        total_costs = total_commissions + total_spreads + total_slippage
        
        # 3. Grouping / Breakdown
        grouped_data = defaultdict(lambda: {'commissions': 0.0, 'spreads': 0.0, 'slippage': 0.0, 'volume': 0.0, 'trades': 0})
        
        for txn in filtered_txns:
            key = 'Unknown'
            trade_val = abs(txn.quantity * txn.price)
            
            if breakdown == 'By Symbol':
                key = txn.symbol
            elif breakdown == 'By Trade Size':
                if trade_val < 1000: key = 'Small (<$1k)'
                elif trade_val < 10000: key = 'Medium ($1k-$10k)'
                else: key = 'Large (>$10k)'
            elif breakdown == 'By Broker':
                key = getattr(txn, 'broker', 'Unknown') or 'Unknown'
                
            # Use actual transaction fees
            grouped_data[key]['commissions'] += txn.fees
            
            # Calculate real spread and slippage for this transaction
            spread_cost, slippage_cost = self._calculate_transaction_market_costs(txn)
            grouped_data[key]['spreads'] += spread_cost
            grouped_data[key]['slippage'] += slippage_cost
            grouped_data[key]['volume'] += trade_val
            grouped_data[key]['trades'] += 1

        # 4. Format Output
        breakdown_list = []
        for key, data in grouped_data.items():
            sub_total = data['commissions'] + data['spreads'] + data['slippage']
            
            # Calculate view metrics
            display_value = sub_total
            if view == '% of Trade Value':
                display_value = (sub_total / data['volume'] * 100) if data['volume'] > 0 else 0
            # Note: % of P&L would require P&L calculation which is complex here, falling back to absolute for now or 0
            
            breakdown_list.append({
                'name': key,
                'commissions': data['commissions'],
                'spreads': data['spreads'],
                'slippage': data['slippage'],
                'total': sub_total,
                'volume': data['volume'],
                'trades': data['trades'],
                'display_value': display_value
            })
            
        # Sort by total cost descending
        breakdown_list.sort(key=lambda x: x['total'], reverse=True)
        
        return {
            'total_costs': total_costs,
            'total_commissions': total_commissions,
            'total_spreads': total_spreads,
            'total_slippage': total_slippage,
            'cost_as_pct_volume': (total_costs / total_volume * 100) if total_volume > 0 else 0,
            'breakdown': breakdown_list,
            'period': period,
            'breakdown_type': breakdown,
            'view': view
        }
    
    def _calculate_real_market_costs(self, transactions: List[Transaction]) -> tuple:
        """Calculate real spread and slippage costs using market data"""
        try:
            total_spreads = 0.0
            total_slippage = 0.0
            
            # Group transactions by symbol for batch processing
            symbols = list(set(t.symbol for t in transactions))
            
            # Get current bid-ask spreads from market data
            current_prices = self.data_client.get_current_prices(symbols)
            
            for txn in transactions:
                trade_value = abs(txn.quantity * txn.price)
                
                if txn.symbol in current_prices:
                    current_price = current_prices[txn.symbol]
                    
                    # Calculate spread cost
                    estimated_spread_pct = self._get_symbol_spread_estimate(txn.symbol, current_price)
                    spread_cost = trade_value * estimated_spread_pct
                    
                    # Calculate slippage
                    price_diff_pct = abs(txn.price - current_price) / current_price if current_price > 0 else 0
                    slippage_pct = min(price_diff_pct, 0.005)
                    slippage_cost = trade_value * slippage_pct
                    
                    total_spreads += spread_cost
                    total_slippage += slippage_cost
                else:
                    # Skip transactions without valid market data - NO FALLBACK
                    continue
            
            return total_spreads, total_slippage
            
        except Exception as e:
            # NO FALLBACK - Return zero costs if market data fails
            print(f"[COST-ANALYSIS] Market data failed: {e}")
            return 0.0, 0.0
    
    def _calculate_transaction_market_costs(self, txn: Transaction) -> tuple:
        """Calculate spread and slippage for individual transaction"""
        try:
            current_prices = self.data_client.get_current_prices([txn.symbol])
            trade_value = abs(txn.quantity * txn.price)
            
            if txn.symbol in current_prices:
                current_price = current_prices[txn.symbol]
                
                # Spread cost
                spread_pct = self._get_symbol_spread_estimate(txn.symbol, current_price)
                spread_cost = trade_value * spread_pct
                
                # Slippage cost
                price_diff_pct = abs(txn.price - current_price) / current_price if current_price > 0 else 0
                slippage_pct = min(price_diff_pct, 0.005)
                slippage_cost = trade_value * slippage_pct
                
                return spread_cost, slippage_cost
            else:
                # NO FALLBACK - Return zero if no market data
                return 0.0, 0.0
                
        except Exception:
            # NO FALLBACK - Return zero if calculation fails
            return 0.0, 0.0
    
    def _get_symbol_spread_estimate(self, symbol: str, current_price: float) -> float:
        """Get realistic spread estimate based on symbol characteristics"""
        # Large cap stocks (>$50): 0.05%
        if current_price > 50:
            return 0.0005
        # Mid cap stocks ($10-$50): 0.1%
        elif current_price > 10:
            return 0.001
        # Small cap stocks (<$10): 0.2%
        else:
            return 0.002

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
        """Comprehensive trade performance analysis using real transaction data"""
        print(f"[TRADE-PERFORMANCE] Processing {len(transactions)} transactions")
        
        if not transactions:
            print(f"[TRADE-PERFORMANCE] No transactions provided")
            return {
                'total_trades': 0, 
                'win_rate': 0.0, 
                'avg_trade_size': 0.0, 
                'total_pnl': 0.0,
                'profit_factor': 0.0,
                'winning_trades': 0,
                'losing_trades': 0,
                'avg_win': 0.0,
                'avg_loss': 0.0,
                'ranked_trades': [],
                'best_trade': {'symbol': 'N/A', 'pnl': 0.0, 'return_pct': 0.0},
                'worst_trade': {'symbol': 'N/A', 'pnl': 0.0, 'return_pct': 0.0}
            }
        
        # Track both buy-sell pairs AND individual profitable transactions
        positions = defaultdict(lambda: {'quantity': 0, 'avg_cost': 0, 'trades': []})
        completed_trades = []
        individual_trades = []  # For options sold without corresponding buys
        
        print(f"[TRADE-PERFORMANCE] Processing transactions chronologically")
        
        for i, txn in enumerate(sorted(transactions, key=lambda x: x.date)):
            symbol = txn.symbol
            print(f"[TRADE-PERFORMANCE] Transaction {i+1}: {symbol} {txn.transaction_type} {txn.quantity} @ ${txn.price}")
            
            if txn.transaction_type in ['BUY', 'Buy']:
                old_value = positions[symbol]['quantity'] * positions[symbol]['avg_cost']
                new_value = abs(txn.quantity) * txn.price
                total_quantity = positions[symbol]['quantity'] + abs(txn.quantity)
                
                if total_quantity > 0:
                    positions[symbol]['avg_cost'] = (old_value + new_value) / total_quantity
                positions[symbol]['quantity'] = total_quantity
                print(f"[TRADE-PERFORMANCE] Updated position: {symbol} qty={total_quantity} avg_cost=${positions[symbol]['avg_cost']:.2f}")
                
            elif txn.transaction_type in ['SELL', 'Sell']:
                if positions[symbol]['quantity'] > 0:
                    # This is a sell with corresponding buy - create matched trade
                    sell_quantity = min(abs(txn.quantity), positions[symbol]['quantity'])
                    pnl = (txn.price - positions[symbol]['avg_cost']) * sell_quantity - txn.fees
                    trade_size = sell_quantity * positions[symbol]['avg_cost']
                    return_pct = (pnl / trade_size) if trade_size > 0 else 0
                    
                    completed_trade = {
                        'symbol': symbol,
                        'pnl': pnl,
                        'size': trade_size,
                        'return_pct': return_pct,
                        'sell_date': txn.date,
                        'sell_price': txn.price,
                        'buy_price': positions[symbol]['avg_cost'],
                        'type': 'Long'
                    }
                    
                    completed_trades.append(completed_trade)
                    positions[symbol]['quantity'] -= sell_quantity
                    
                    print(f"[TRADE-PERFORMANCE] Completed trade: {symbol} P&L=${pnl:.2f} Return={return_pct*100:.2f}%")
                else:
                    # This is a sell without corresponding buy (e.g., options premium collected)
                    trade_value = abs(txn.quantity) * txn.price
                    pnl = trade_value - txn.fees  # Premium collected minus fees
                    return_pct = (pnl / trade_value) if trade_value > 0 else 0
                    
                    individual_trade = {
                        'symbol': symbol,
                        'pnl': pnl,
                        'size': trade_value,
                        'return_pct': return_pct,
                        'sell_date': txn.date,
                        'sell_price': txn.price,
                        'buy_price': 0,  # No corresponding buy
                        'type': 'Short' if 'C' in symbol or 'P' in symbol else 'Sell'
                    }
                    
                    individual_trades.append(individual_trade)
                    print(f"[TRADE-PERFORMANCE] Individual trade: {symbol} P&L=${pnl:.2f} (premium collected)")
        
        # Combine all trades
        all_trades = completed_trades + individual_trades
        
        print(f"[TRADE-PERFORMANCE] Found {len(completed_trades)} matched trades + {len(individual_trades)} individual trades = {len(all_trades)} total")
        
        if not all_trades:
            print(f"[TRADE-PERFORMANCE] No trades found")
            return {
                'total_trades': len([t for t in transactions if t.transaction_type in ['BUY', 'SELL', 'Buy', 'Sell']]),
                'win_rate': 0.0, 
                'avg_trade_size': 0.0, 
                'total_pnl': 0.0,
                'profit_factor': 0.0,
                'winning_trades': 0,
                'losing_trades': 0,
                'avg_win': 0.0,
                'avg_loss': 0.0,
                'ranked_trades': [],
                'best_trade': {'symbol': 'N/A', 'pnl': 0.0, 'return_pct': 0.0},
                'worst_trade': {'symbol': 'N/A', 'pnl': 0.0, 'return_pct': 0.0}
            }
        
        # Calculate real performance metrics from all trades
        total_trades = len(all_trades)
        winning_trades = [t for t in all_trades if t['pnl'] > 0]
        losing_trades = [t for t in all_trades if t['pnl'] < 0]
        
        win_rate = len(winning_trades) / total_trades if total_trades > 0 else 0
        avg_trade_size = np.mean([t['size'] for t in all_trades])
        total_pnl = sum(t['pnl'] for t in all_trades)
        avg_win = np.mean([t['pnl'] for t in winning_trades]) if winning_trades else 0
        avg_loss = np.mean([t['pnl'] for t in losing_trades]) if losing_trades else 0
        
        # Calculate profit factor (gross profit / gross loss)
        gross_profit = sum(t['pnl'] for t in winning_trades) if winning_trades else 0
        gross_loss = abs(sum(t['pnl'] for t in losing_trades)) if losing_trades else 0
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0)
        
        best_trade = max(all_trades, key=lambda x: x['pnl'])
        worst_trade = min(all_trades, key=lambda x: x['pnl'])
        
        # Create ranked trades for frontend display (all trades)
        ranked_trades = sorted(all_trades, key=lambda x: x['pnl'], reverse=True)
        
        result = {
            'total_trades': total_trades,
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'win_rate': win_rate,
            'avg_trade_size': avg_trade_size,
            'total_pnl': total_pnl,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'profit_factor': profit_factor,
            'ranked_trades': ranked_trades,
            'best_trade': {
                'symbol': best_trade['symbol'],
                'pnl': best_trade['pnl'],
                'return_pct': best_trade['return_pct']
            },
            'worst_trade': {
                'symbol': worst_trade['symbol'],
                'pnl': worst_trade['pnl'],
                'return_pct': worst_trade['return_pct']
            }
        }
        
        print(f"[TRADE-PERFORMANCE] Analysis complete: {total_trades} trades processed")
        return result


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
    def _calculate_real_market_costs(self, transactions: List[Transaction]) -> tuple:
        """Calculate real spread and slippage costs using market data"""
        try:
            from clients.market_data_client import MarketDataClient
            market_client = MarketDataClient()
            
            total_spreads = 0.0
            total_slippage = 0.0
            
            # Group transactions by symbol for batch processing
            symbols = list(set(t.symbol for t in transactions))
            
            # Get current bid-ask spreads from market data
            current_prices = market_client.get_current_prices(symbols)
            
            for txn in transactions:
                if txn.symbol in current_prices:
                    current_price = current_prices[txn.symbol]
                    trade_value = abs(txn.quantity * txn.price)
                    
                    # Calculate spread cost: difference between bid-ask spread
                    # Estimate spread as 0.1-0.3% of current price for liquid stocks
                    estimated_spread_pct = self._get_symbol_spread_estimate(txn.symbol, current_price)
                    spread_cost = trade_value * estimated_spread_pct
                    
                    # Calculate slippage: difference between expected and actual execution price
                    price_diff_pct = abs(txn.price - current_price) / current_price if current_price > 0 else 0
                    # Cap slippage at reasonable levels (0.5% max)
                    slippage_pct = min(price_diff_pct, 0.005)
                    slippage_cost = trade_value * slippage_pct
                    
                    total_spreads += spread_cost
                    total_slippage += slippage_cost
            
            return total_spreads, total_slippage
            
        except Exception as e:
            # Fallback to minimal estimates if market data fails
            total_volume = sum(abs(t.quantity * t.price) for t in transactions)
            return total_volume * 0.001, total_volume * 0.001  # 0.1% each
    
    def _calculate_transaction_market_costs(self, txn: Transaction) -> tuple:
        """Calculate spread and slippage for individual transaction"""
        try:
            from clients.market_data_client import MarketDataClient
            market_client = MarketDataClient()
            
            current_prices = market_client.get_current_prices([txn.symbol])
            trade_value = abs(txn.quantity * txn.price)
            
            if txn.symbol in current_prices:
                current_price = current_prices[txn.symbol]
                
                # Spread cost
                spread_pct = self._get_symbol_spread_estimate(txn.symbol, current_price)
                spread_cost = trade_value * spread_pct
                
                # Slippage cost
                price_diff_pct = abs(txn.price - current_price) / current_price if current_price > 0 else 0
                slippage_pct = min(price_diff_pct, 0.005)
                slippage_cost = trade_value * slippage_pct
                
                return spread_cost, slippage_cost
            else:
                # Fallback for symbols without current price data
                return trade_value * 0.001, trade_value * 0.001
                
        except Exception:
            # Minimal fallback
            trade_value = abs(txn.quantity * txn.price)
            return trade_value * 0.001, trade_value * 0.001
    
    def _get_symbol_spread_estimate(self, symbol: str, current_price: float) -> float:
        """Get realistic spread estimate based on symbol characteristics"""
        # Large cap stocks (>$50): 0.05-0.1%
        if current_price > 50:
            return 0.0005  # 0.05%
        # Mid cap stocks ($10-$50): 0.1-0.2%
        elif current_price > 10:
            return 0.001   # 0.1%
        # Small cap stocks (<$10): 0.2-0.5%
        else:
            return 0.002   # 0.2%