import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
from datetime import datetime, timedelta
from clients.market_data_client import MarketDataClient
from core.transactions import TransactionPortfolio

class PortfolioAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def analyze_positions(self, txn_portfolio: TransactionPortfolio) -> Dict:
        """Real-time holdings, cost basis, market value calculations"""
        positions = txn_portfolio.get_current_positions()
        cost_basis = txn_portfolio.get_cost_basis()
        current_prices = self.data_client.get_current_prices(list(positions.keys()))
        
        position_analysis = {}
        total_market_value = 0
        total_cost_basis = 0
        
        for symbol in positions:
            qty = positions[symbol]
            avg_cost = cost_basis.get(symbol, 0)
            current_price = current_prices.get(symbol, avg_cost)
            
            market_value = qty * current_price
            cost_value = qty * avg_cost
            unrealized_pnl = market_value - cost_value
            
            position_analysis[symbol] = {
                'quantity': qty,
                'avg_cost': avg_cost,
                'current_price': current_price,
                'market_value': market_value,
                'cost_basis': cost_value,
                'unrealized_pnl': unrealized_pnl,
                'unrealized_pnl_pct': unrealized_pnl / cost_value if cost_value > 0 else 0
            }
            
            total_market_value += market_value
            total_cost_basis += cost_value
        
        return {
            'positions': position_analysis,
            'total_market_value': total_market_value,
            'total_cost_basis': total_cost_basis,
            'total_unrealized_pnl': total_market_value - total_cost_basis,
            'total_return_pct': (total_market_value - total_cost_basis) / total_cost_basis if total_cost_basis > 0 else 0
        }
    
    def analyze_weights(self, position_analysis: Dict) -> Dict:
        """Portfolio concentration and diversification metrics"""
        positions = position_analysis['positions']
        total_value = position_analysis['total_market_value']
        
        weights = {symbol: pos['market_value'] / total_value 
                  for symbol, pos in positions.items()}
        
        # Concentration metrics
        herfindahl_index = sum(w**2 for w in weights.values())
        effective_positions = 1 / herfindahl_index if herfindahl_index > 0 else 0
        max_weight = max(weights.values()) if weights else 0
        
        # Weight distribution
        weight_std = np.std(list(weights.values()))
        
        return {
            'weights': weights,
            'herfindahl_index': herfindahl_index,
            'effective_positions': effective_positions,
            'max_weight': max_weight,
            'weight_std': weight_std,
            'concentration_risk': 'High' if max_weight > 0.2 else 'Medium' if max_weight > 0.1 else 'Low'
        }
    
    def performance_attribution(self, txn_portfolio: TransactionPortfolio, period_days: int = 30) -> Dict:
        """Return decomposition by position and time period"""
        positions = txn_portfolio.get_current_positions()
        symbols = list(positions.keys())
        
        if not symbols:
            return {}
        
        # Get price data for attribution period
        price_data = self.data_client.get_price_data(symbols, f"{period_days}d")
        returns = price_data.pct_change().dropna()
        
        if returns.empty:
            return {}
        
        # Calculate position contributions
        current_prices = self.data_client.get_current_prices(symbols)
        total_value = sum(positions[s] * current_prices.get(s, 0) for s in symbols)
        
        attribution = {}
        for symbol in symbols:
            weight = (positions[symbol] * current_prices.get(symbol, 0)) / total_value
            symbol_return = returns[symbol].sum() if symbol in returns.columns else 0
            contribution = weight * symbol_return
            
            attribution[symbol] = {
                'weight': weight,
                'return': symbol_return,
                'contribution': contribution
            }
        
        total_attribution = sum(attr['contribution'] for attr in attribution.values())
        
        return {
            'period_days': period_days,
            'attribution_by_position': attribution,
            'total_portfolio_return': total_attribution,
            'top_contributors': sorted(attribution.items(), 
                                     key=lambda x: x[1]['contribution'], reverse=True)[:3],
            'bottom_contributors': sorted(attribution.items(), 
                                        key=lambda x: x[1]['contribution'])[:3]
        }
    
    def turnover_analysis(self, txn_portfolio: TransactionPortfolio, period_days: int = 90) -> Dict:
        """Trading activity and portfolio churn metrics"""
        transactions = txn_portfolio.transactions
        
        # Filter transactions by period
        cutoff_date = datetime.now() - timedelta(days=period_days)
        recent_txns = [txn for txn in transactions if txn.date >= cutoff_date]
        
        if not recent_txns:
            return {'period_days': period_days, 'turnover_rate': 0, 'trade_count': 0}
        
        # Calculate turnover metrics
        total_traded_value = sum(abs(txn.quantity * txn.price) for txn in recent_txns)
        total_fees = sum(txn.fees for txn in recent_txns)
        
        # Current portfolio value for turnover rate calculation
        positions = txn_portfolio.get_current_positions()
        current_prices = self.data_client.get_current_prices(list(positions.keys()))
        portfolio_value = sum(positions[s] * current_prices.get(s, 0) for s in positions)
        
        turnover_rate = total_traded_value / portfolio_value if portfolio_value > 0 else 0
        
        return {
            'period_days': period_days,
            'trade_count': len(recent_txns),
            'total_traded_value': total_traded_value,
            'total_fees': total_fees,
            'turnover_rate': turnover_rate,
            'avg_trade_size': total_traded_value / len(recent_txns) if recent_txns else 0,
            'fee_rate': total_fees / total_traded_value if total_traded_value > 0 else 0
        }