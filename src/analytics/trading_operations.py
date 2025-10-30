import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from core.transactions import Transaction, TransactionPortfolio

@dataclass
class Order:
    symbol: str
    quantity: float
    order_type: str  # 'MARKET', 'LIMIT', 'STOP'
    price: Optional[float] = None
    timestamp: datetime = None
    status: str = 'PENDING'  # 'PENDING', 'FILLED', 'CANCELLED'
    fill_price: Optional[float] = None
    fill_quantity: float = 0

class OrderManager:
    def __init__(self):
        self.orders = []
        self.executions = []
    
    def place_order(self, symbol: str, quantity: float, order_type: str, 
                   price: Optional[float] = None) -> str:
        """Place a new order"""
        order = Order(
            symbol=symbol,
            quantity=quantity,
            order_type=order_type,
            price=price,
            timestamp=datetime.now()
        )
        
        self.orders.append(order)
        order_id = f"{symbol}_{len(self.orders)}_{int(datetime.now().timestamp())}"
        
        return order_id
    
    def simulate_execution(self, order: Order, market_price: float) -> bool:
        """Simulate order execution based on market conditions"""
        
        if order.status != 'PENDING':
            return False
        
        executed = False
        
        if order.order_type == 'MARKET':
            # Market orders execute immediately
            order.fill_price = market_price
            order.fill_quantity = order.quantity
            executed = True
            
        elif order.order_type == 'LIMIT':
            # Limit orders execute if price condition is met
            if order.quantity > 0 and market_price <= order.price:  # Buy limit
                order.fill_price = order.price
                order.fill_quantity = order.quantity
                executed = True
            elif order.quantity < 0 and market_price >= order.price:  # Sell limit
                order.fill_price = order.price
                order.fill_quantity = order.quantity
                executed = True
        
        if executed:
            order.status = 'FILLED'
            self.executions.append({
                'symbol': order.symbol,
                'quantity': order.fill_quantity,
                'price': order.fill_price,
                'timestamp': datetime.now(),
                'order_type': order.order_type
            })
        
        return executed
    
    def get_order_status(self) -> pd.DataFrame:
        """Get status of all orders"""
        order_data = []
        for order in self.orders:
            order_data.append({
                'symbol': order.symbol,
                'quantity': order.quantity,
                'order_type': order.order_type,
                'price': order.price,
                'status': order.status,
                'fill_price': order.fill_price,
                'timestamp': order.timestamp
            })
        
        return pd.DataFrame(order_data)

class CostManager:
    def __init__(self):
        self.fee_schedule = {
            'stock_fee': 0.005,  # $0.005 per share
            'min_fee': 1.0,      # $1 minimum
            'max_fee': 10.0      # $10 maximum
        }
    
    def calculate_transaction_cost(self, quantity: float, price: float, 
                                 symbol: str = None) -> Dict:
        """Calculate total transaction costs including fees and slippage"""
        
        notional_value = abs(quantity * price)
        
        # Commission calculation
        commission = max(
            min(abs(quantity) * self.fee_schedule['stock_fee'], self.fee_schedule['max_fee']),
            self.fee_schedule['min_fee']
        )
        
        # Estimated slippage (simplified model)
        slippage_bps = self._estimate_slippage(notional_value, symbol)
        slippage_cost = notional_value * (slippage_bps / 10000)
        
        # Market impact (for large orders)
        market_impact = self._estimate_market_impact(quantity, price, symbol)
        
        total_cost = commission + slippage_cost + market_impact
        
        return {
            'commission': commission,
            'slippage_cost': slippage_cost,
            'market_impact': market_impact,
            'total_cost': total_cost,
            'cost_bps': (total_cost / notional_value) * 10000,
            'notional_value': notional_value
        }
    
    def _estimate_slippage(self, notional_value: float, symbol: str = None) -> float:
        """Estimate slippage in basis points"""
        # Simplified slippage model based on trade size
        if notional_value < 10000:
            return 1.0  # 1 bp
        elif notional_value < 100000:
            return 2.0  # 2 bps
        else:
            return 5.0  # 5 bps
    
    def _estimate_market_impact(self, quantity: float, price: float, symbol: str = None) -> float:
        """Estimate market impact cost"""
        notional_value = abs(quantity * price)
        
        # Simplified market impact model
        if notional_value > 1000000:  # Large orders
            return notional_value * 0.0005  # 5 bps impact
        else:
            return 0.0
    
    def optimize_execution(self, target_quantity: float, symbol: str, 
                          max_order_size: float = 10000) -> List[Dict]:
        """Optimize order execution to minimize costs"""
        
        orders = []
        remaining_quantity = abs(target_quantity)
        side = 1 if target_quantity > 0 else -1
        
        while remaining_quantity > 0:
            order_size = min(remaining_quantity, max_order_size)
            
            orders.append({
                'quantity': order_size * side,
                'symbol': symbol,
                'order_type': 'LIMIT',  # Use limit orders to control costs
                'estimated_cost': self.calculate_transaction_cost(order_size, 100, symbol)  # Placeholder price
            })
            
            remaining_quantity -= order_size
        
        return orders

class PositionSizer:
    def __init__(self, risk_free_rate: float = 0.02):
        self.risk_free_rate = risk_free_rate
    
    def kelly_criterion(self, expected_return: float, volatility: float, 
                       win_rate: float = 0.6) -> float:
        """Calculate Kelly optimal position size"""
        
        if volatility <= 0:
            return 0
        
        # Simplified Kelly formula
        edge = expected_return - self.risk_free_rate
        kelly_fraction = edge / (volatility ** 2)
        
        # Cap at 25% for risk management
        return min(max(kelly_fraction, 0), 0.25)
    
    def risk_parity_sizing(self, symbols: List[str], volatilities: Dict[str, float], 
                          target_risk: float = 0.15) -> Dict[str, float]:
        """Risk parity position sizing"""
        
        # Inverse volatility weights
        inv_vol_weights = {}
        total_inv_vol = 0
        
        for symbol in symbols:
            vol = volatilities.get(symbol, 0.2)  # Default 20% vol
            if vol > 0:
                inv_vol_weights[symbol] = 1 / vol
                total_inv_vol += inv_vol_weights[symbol]
        
        # Normalize weights
        normalized_weights = {}
        for symbol in symbols:
            if symbol in inv_vol_weights:
                normalized_weights[symbol] = inv_vol_weights[symbol] / total_inv_vol
            else:
                normalized_weights[symbol] = 0
        
        return normalized_weights
    
    def volatility_targeting(self, current_volatility: float, target_volatility: float, 
                           current_weight: float) -> float:
        """Adjust position size to target volatility"""
        
        if current_volatility <= 0:
            return current_weight
        
        vol_scalar = target_volatility / current_volatility
        return current_weight * vol_scalar
    
    def max_drawdown_sizing(self, expected_return: float, max_drawdown: float, 
                           max_acceptable_loss: float = 0.02) -> float:
        """Position sizing based on maximum drawdown constraint"""
        
        if max_drawdown <= 0:
            return 0
        
        # Size position so max loss doesn't exceed acceptable level
        position_size = max_acceptable_loss / abs(max_drawdown)
        
        return min(position_size, 1.0)  # Cap at 100%

class ExecutionAnalyzer:
    def __init__(self):
        pass
    
    def analyze_execution_quality(self, executions: List[Dict], 
                                benchmark_prices: Dict[str, float]) -> Dict:
        """Analyze trade execution quality"""
        
        execution_metrics = {}
        
        for execution in executions:
            symbol = execution['symbol']
            fill_price = execution['price']
            benchmark_price = benchmark_prices.get(symbol, fill_price)
            
            # Calculate slippage
            if execution['quantity'] > 0:  # Buy order
                slippage = (fill_price - benchmark_price) / benchmark_price
            else:  # Sell order
                slippage = (benchmark_price - fill_price) / benchmark_price
            
            execution_metrics[f"{symbol}_{execution['timestamp']}"] = {
                'symbol': symbol,
                'fill_price': fill_price,
                'benchmark_price': benchmark_price,
                'slippage_bps': slippage * 10000,
                'quantity': execution['quantity'],
                'notional': abs(execution['quantity'] * fill_price),
                'execution_quality': self._grade_execution(slippage * 10000)
            }
        
        # Aggregate metrics
        total_slippage = sum(metrics['slippage_bps'] * metrics['notional'] 
                           for metrics in execution_metrics.values())
        total_notional = sum(metrics['notional'] for metrics in execution_metrics.values())
        
        avg_slippage = total_slippage / total_notional if total_notional > 0 else 0
        
        return {
            'execution_details': execution_metrics,
            'average_slippage_bps': avg_slippage,
            'total_cost_impact': total_slippage,
            'execution_score': self._calculate_execution_score(execution_metrics),
            'best_executions': self._get_best_executions(execution_metrics),
            'worst_executions': self._get_worst_executions(execution_metrics)
        }
    
    def _grade_execution(self, slippage_bps: float) -> str:
        """Grade execution quality based on slippage"""
        if abs(slippage_bps) < 2:
            return 'EXCELLENT'
        elif abs(slippage_bps) < 5:
            return 'GOOD'
        elif abs(slippage_bps) < 10:
            return 'FAIR'
        else:
            return 'POOR'
    
    def _calculate_execution_score(self, execution_metrics: Dict) -> float:
        """Calculate overall execution score (0-100)"""
        if not execution_metrics:
            return 0
        
        scores = []
        for metrics in execution_metrics.values():
            slippage = abs(metrics['slippage_bps'])
            # Score inversely related to slippage
            score = max(0, 100 - slippage * 2)  # 2 points per bp of slippage
            scores.append(score)
        
        return np.mean(scores)
    
    def _get_best_executions(self, execution_metrics: Dict, n: int = 5) -> List[Dict]:
        """Get best executions by slippage"""
        sorted_executions = sorted(
            execution_metrics.items(),
            key=lambda x: abs(x[1]['slippage_bps'])
        )
        return [exec_data[1] for exec_data in sorted_executions[:n]]
    
    def _get_worst_executions(self, execution_metrics: Dict, n: int = 5) -> List[Dict]:
        """Get worst executions by slippage"""
        sorted_executions = sorted(
            execution_metrics.items(),
            key=lambda x: abs(x[1]['slippage_bps']),
            reverse=True
        )
        return [exec_data[1] for exec_data in sorted_executions[:n]]