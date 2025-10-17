import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
from datetime import datetime
from collections import defaultdict, deque
from core.transactions import Transaction, TransactionPortfolio
from clients.market_data_client import MarketDataClient

class TransactionProcessor:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def fifo_position_tracking(self, transactions: List[Transaction]) -> Dict:
        """First-in-first-out lot accounting"""
        positions = defaultdict(lambda: {'lots': deque(), 'total_quantity': 0})
        realized_pnl = []
        
        for txn in sorted(transactions, key=lambda x: x.date):
            symbol = txn.symbol
            
            if txn.transaction_type == 'BUY':
                # Add new lot
                positions[symbol]['lots'].append({
                    'quantity': txn.quantity,
                    'price': txn.price,
                    'date': txn.date,
                    'fees': txn.fees
                })
                positions[symbol]['total_quantity'] += txn.quantity
            
            elif txn.transaction_type == 'SELL':
                remaining_to_sell = txn.quantity
                sell_proceeds = txn.quantity * txn.price - txn.fees
                cost_basis = 0
                
                # Sell from oldest lots first (FIFO)
                while remaining_to_sell > 0 and positions[symbol]['lots']:
                    oldest_lot = positions[symbol]['lots'][0]
                    
                    if oldest_lot['quantity'] <= remaining_to_sell:
                        # Sell entire lot
                        sold_quantity = oldest_lot['quantity']
                        cost_basis += sold_quantity * oldest_lot['price'] + oldest_lot['fees']
                        remaining_to_sell -= sold_quantity
                        positions[symbol]['lots'].popleft()
                    else:
                        # Partial lot sale
                        sold_quantity = remaining_to_sell
                        cost_basis += sold_quantity * oldest_lot['price']
                        oldest_lot['quantity'] -= sold_quantity
                        remaining_to_sell = 0
                
                # Calculate realized P&L
                if cost_basis > 0:
                    pnl = sell_proceeds - cost_basis
                    realized_pnl.append({
                        'symbol': symbol,
                        'date': txn.date,
                        'quantity': txn.quantity - remaining_to_sell,
                        'realized_pnl': pnl,
                        'sell_price': txn.price,
                        'avg_cost_basis': cost_basis / (txn.quantity - remaining_to_sell)
                    })
                
                positions[symbol]['total_quantity'] -= (txn.quantity - remaining_to_sell)
        
        return {
            'current_positions': {k: v for k, v in positions.items() if v['total_quantity'] > 0},
            'realized_pnl': realized_pnl
        }
    
    def calculate_pnl(self, txn_portfolio: TransactionPortfolio) -> Dict:
        """Real-time profit/loss tracking per position"""
        fifo_result = self.fifo_position_tracking(txn_portfolio.transactions)
        current_positions = fifo_result['current_positions']
        realized_pnl = fifo_result['realized_pnl']
        
        # Get current prices for unrealized P&L
        symbols = list(current_positions.keys())
        current_prices = self.data_client.get_current_prices(symbols) if symbols else {}
        
        position_pnl = {}
        total_unrealized = 0
        total_realized = sum(pnl['realized_pnl'] for pnl in realized_pnl)
        
        for symbol, position_data in current_positions.items():
            current_price = current_prices.get(symbol, 0)
            
            # Calculate weighted average cost basis
            total_cost = sum(lot['quantity'] * lot['price'] + lot['fees'] for lot in position_data['lots'])
            total_quantity = position_data['total_quantity']
            avg_cost = total_cost / total_quantity if total_quantity > 0 else 0
            
            # Unrealized P&L
            market_value = total_quantity * current_price
            cost_basis = total_cost
            unrealized_pnl = market_value - cost_basis
            total_unrealized += unrealized_pnl
            
            position_pnl[symbol] = {
                'quantity': total_quantity,
                'avg_cost': avg_cost,
                'current_price': current_price,
                'market_value': market_value,
                'cost_basis': cost_basis,
                'unrealized_pnl': unrealized_pnl,
                'unrealized_pnl_pct': unrealized_pnl / cost_basis if cost_basis > 0 else 0
            }
        
        return {
            'position_pnl': position_pnl,
            'total_unrealized_pnl': total_unrealized,
            'total_realized_pnl': total_realized,
            'total_pnl': total_unrealized + total_realized,
            'realized_trades': realized_pnl
        }
    
    def cost_analysis(self, transactions: List[Transaction]) -> Dict:
        """Transaction fees, slippage, and total cost of trading"""
        total_fees = sum(txn.fees for txn in transactions)
        total_volume = sum(abs(txn.quantity * txn.price) for txn in transactions)
        
        # Fee analysis by symbol
        fee_by_symbol = defaultdict(float)
        volume_by_symbol = defaultdict(float)
        
        for txn in transactions:
            fee_by_symbol[txn.symbol] += txn.fees
            volume_by_symbol[txn.symbol] += abs(txn.quantity * txn.price)
        
        # Calculate fee rates
        fee_rates = {symbol: fee_by_symbol[symbol] / volume_by_symbol[symbol] 
                    for symbol in fee_by_symbol if volume_by_symbol[symbol] > 0}
        
        return {
            'total_fees': total_fees,
            'total_volume': total_volume,
            'overall_fee_rate': total_fees / total_volume if total_volume > 0 else 0,
            'fee_by_symbol': dict(fee_by_symbol),
            'fee_rates_by_symbol': fee_rates,
            'avg_fee_per_trade': total_fees / len(transactions) if transactions else 0
        }
    
    def activity_analysis(self, transactions: List[Transaction]) -> Dict:
        """Trading frequency, volume, and pattern analysis"""
        if not transactions:
            return {}
        
        # Sort transactions by date
        sorted_txns = sorted(transactions, key=lambda x: x.date)
        
        # Trading frequency analysis
        dates = [txn.date.date() for txn in sorted_txns]
        unique_dates = list(set(dates))
        trading_days = len(unique_dates)
        
        # Volume analysis
        daily_volume = defaultdict(float)
        for txn in sorted_txns:
            daily_volume[txn.date.date()] += abs(txn.quantity * txn.price)
        
        volumes = list(daily_volume.values())
        
        # Pattern analysis
        buy_count = sum(1 for txn in sorted_txns if txn.transaction_type == 'BUY')
        sell_count = sum(1 for txn in sorted_txns if txn.transaction_type == 'SELL')
        
        # Time-based patterns
        hour_distribution = defaultdict(int)
        day_of_week_distribution = defaultdict(int)
        
        for txn in sorted_txns:
            hour_distribution[txn.date.hour] += 1
            day_of_week_distribution[txn.date.weekday()] += 1
        
        return {
            'total_trades': len(sorted_txns),
            'trading_days': trading_days,
            'avg_trades_per_day': len(sorted_txns) / trading_days if trading_days > 0 else 0,
            'buy_sell_ratio': buy_count / sell_count if sell_count > 0 else float('inf'),
            'avg_daily_volume': np.mean(volumes) if volumes else 0,
            'max_daily_volume': max(volumes) if volumes else 0,
            'volume_std': np.std(volumes) if volumes else 0,
            'hour_distribution': dict(hour_distribution),
            'day_of_week_distribution': dict(day_of_week_distribution),
            'most_active_hour': max(hour_distribution.items(), key=lambda x: x[1])[0] if hour_distribution else None,
            'most_active_day': max(day_of_week_distribution.items(), key=lambda x: x[1])[0] if day_of_week_distribution else None
        }
    
    def performance_attribution_detailed(self, txn_portfolio: TransactionPortfolio, period_days: int = 30) -> Dict:
        """Return attribution by transaction and time period"""
        transactions = txn_portfolio.transactions
        
        # Filter transactions by period
        cutoff_date = datetime.now() - pd.Timedelta(days=period_days)
        period_txns = [txn for txn in transactions if txn.date >= cutoff_date]
        
        if not period_txns:
            return {}
        
        # Get price data for attribution
        symbols = list(set(txn.symbol for txn in period_txns))
        price_data = self.data_client.get_price_data(symbols, f"{period_days + 10}d")
        
        attribution_by_trade = []
        
        for txn in period_txns:
            if txn.symbol in price_data.columns:
                # Find price at transaction date and current price
                txn_date = txn.date.date()
                symbol_prices = price_data[txn.symbol].dropna()
                
                # Get closest price to transaction date
                price_series = symbol_prices[symbol_prices.index.date >= txn_date]
                if not price_series.empty:
                    current_price = symbol_prices.iloc[-1]
                    
                    if txn.transaction_type == 'BUY':
                        pnl = txn.quantity * (current_price - txn.price) - txn.fees
                    else:  # SELL
                        pnl = txn.quantity * (txn.price - current_price) - txn.fees
                    
                    attribution_by_trade.append({
                        'symbol': txn.symbol,
                        'date': txn.date,
                        'type': txn.transaction_type,
                        'quantity': txn.quantity,
                        'price': txn.price,
                        'current_price': current_price,
                        'pnl_contribution': pnl,
                        'return_contribution': pnl / (txn.quantity * txn.price) if txn.quantity * txn.price > 0 else 0
                    })
        
        # Aggregate by symbol
        symbol_attribution = defaultdict(lambda: {'pnl': 0, 'trades': 0})
        for trade in attribution_by_trade:
            symbol_attribution[trade['symbol']]['pnl'] += trade['pnl_contribution']
            symbol_attribution[trade['symbol']]['trades'] += 1
        
        return {
            'period_days': period_days,
            'trade_attribution': attribution_by_trade,
            'symbol_attribution': dict(symbol_attribution),
            'total_attribution': sum(trade['pnl_contribution'] for trade in attribution_by_trade),
            'best_trades': sorted(attribution_by_trade, key=lambda x: x['pnl_contribution'], reverse=True)[:5],
            'worst_trades': sorted(attribution_by_trade, key=lambda x: x['pnl_contribution'])[:5]
        }