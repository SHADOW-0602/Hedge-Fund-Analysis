import numpy as np
from typing import Dict, List
from datetime import datetime
from collections import defaultdict
from clients.market_data_client import MarketDataClient
from core.transactions import Transaction

class TradingOperationsAnalyzer:
    """Specialized analyzer for trading operations and performance"""
    
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def analyze_trade_performance(self, txn_portfolio, period='3M', metric='P&L') -> Dict:
        """Analyze trade performance with comprehensive metrics"""
        return self.trade_performance_analysis(txn_portfolio.transactions)
    
    def trade_performance_analysis(self, transactions: List[Transaction]) -> Dict:
        """Enhanced trade performance analysis with detailed metrics"""
        trades = [t for t in transactions if t.transaction_type in ['BUY', 'SELL', 'Buy', 'Sell']]
        if not trades:
            return {'total_trades': 0, 'win_rate': 0, 'avg_trade_size': 0, 'best_trade': 0, 'worst_trade': 0}
        
        # Track all trades with P&L
        completed_trades = []
        positions = defaultdict(lambda: {'quantity': 0, 'avg_cost': 0, 'lots': []})
        
        for trade in sorted(trades, key=lambda x: x.date):
            symbol = trade.symbol
            
            if trade.transaction_type in ['BUY', 'Buy']:
                # Add to position
                old_value = positions[symbol]['quantity'] * positions[symbol]['avg_cost']
                new_value = abs(trade.quantity) * trade.price
                total_quantity = positions[symbol]['quantity'] + abs(trade.quantity)
                
                if total_quantity > 0:
                    positions[symbol]['avg_cost'] = (old_value + new_value) / total_quantity
                positions[symbol]['quantity'] = total_quantity
                
                # Track individual lots
                positions[symbol]['lots'].append({
                    'quantity': abs(trade.quantity),
                    'price': trade.price,
                    'date': trade.date,
                    'fees': trade.fees
                })
                
            elif trade.transaction_type in ['SELL', 'Sell'] and positions[symbol]['quantity'] > 0:
                # Calculate P&L for this trade
                sell_quantity = min(abs(trade.quantity), positions[symbol]['quantity'])
                pnl = (trade.price - positions[symbol]['avg_cost']) * sell_quantity - trade.fees
                
                completed_trades.append({
                    'symbol': symbol,
                    'pnl': pnl,
                    'trade_size': sell_quantity * trade.price,
                    'holding_period': (trade.date - positions[symbol]['lots'][0]['date']).days if positions[symbol]['lots'] else 0,
                    'entry_price': positions[symbol]['avg_cost'],
                    'exit_price': trade.price,
                    'quantity': sell_quantity
                })
                
                positions[symbol]['quantity'] -= sell_quantity
        
        if not completed_trades:
            return {'total_trades': 0, 'win_rate': 0, 'avg_trade_size': 0, 'best_trade': 0, 'worst_trade': 0}
        
        # Calculate performance metrics
        pnls = [t['pnl'] for t in completed_trades]
        trade_sizes = [t['trade_size'] for t in completed_trades]
        
        winning_trades = [p for p in pnls if p > 0]
        losing_trades = [p for p in pnls if p < 0]
        
        return {
            'total_trades': len(completed_trades),
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'win_rate': len(winning_trades) / len(completed_trades),
            'avg_win': np.mean(winning_trades) if winning_trades else 0,
            'avg_loss': np.mean([abs(p) for p in losing_trades]) if losing_trades else 0,
            'profit_factor': sum(winning_trades) / sum([abs(p) for p in losing_trades]) if losing_trades else 1.0,
            'avg_trade_size': np.mean(trade_sizes),
            'largest_trade': max(trade_sizes),
            'smallest_trade': min(trade_sizes),
            'best_trade': max(pnls),
            'worst_trade': min(pnls),
            'total_pnl': sum(pnls),
            'avg_holding_period': np.mean([t['holding_period'] for t in completed_trades])
        }