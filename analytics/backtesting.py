import pandas as pd
import numpy as np
from typing import Dict, List, Callable, Optional
from datetime import datetime, timedelta
from clients.market_data_client import MarketDataClient

class Backtester:
    def __init__(self, data_client: MarketDataClient, initial_capital: float = 100000):
        self.data_client = data_client
        self.initial_capital = initial_capital
        self.reset()
    
    def reset(self):
        """Reset backtester state"""
        self.cash = self.initial_capital
        self.positions = {}
        self.trades = []
        self.portfolio_values = []
        self.current_date = None
    
    def add_strategy(self, strategy_func: Callable, symbols: List[str], start_date: str, end_date: str) -> Dict:
        """Backtest a trading strategy"""
        self.reset()
        
        # Get historical data
        price_data = self.data_client.get_price_data(symbols, "2y")
        price_data = price_data.loc[start_date:end_date]
        
        if price_data.empty:
            return {}
        
        # Run backtest
        for date, prices in price_data.iterrows():
            self.current_date = date
            
            # Calculate current portfolio value
            portfolio_value = self.cash
            for symbol, quantity in self.positions.items():
                if symbol in prices and not pd.isna(prices[symbol]):
                    portfolio_value += quantity * prices[symbol]
            
            self.portfolio_values.append({
                'date': date,
                'portfolio_value': portfolio_value,
                'cash': self.cash,
                'positions': self.positions.copy()
            })
            
            # Execute strategy
            signals = strategy_func(prices, date, self.positions, self.cash)
            
            # Process signals
            for signal in signals:
                self._execute_trade(signal, prices)
        
        return self._calculate_performance()
    
    def _execute_trade(self, signal: Dict, prices: pd.Series):
        """Execute a trade signal"""
        symbol = signal['symbol']
        action = signal['action']  # 'BUY' or 'SELL'
        quantity = signal.get('quantity', 0)
        
        if symbol not in prices or pd.isna(prices[symbol]):
            return
        
        price = prices[symbol]
        
        if action == 'BUY' and quantity > 0:
            cost = quantity * price
            if cost <= self.cash:
                self.cash -= cost
                self.positions[symbol] = self.positions.get(symbol, 0) + quantity
                
                self.trades.append({
                    'date': self.current_date,
                    'symbol': symbol,
                    'action': action,
                    'quantity': quantity,
                    'price': price,
                    'value': cost
                })
        
        elif action == 'SELL' and quantity > 0:
            current_position = self.positions.get(symbol, 0)
            quantity = min(quantity, current_position)
            
            if quantity > 0:
                proceeds = quantity * price
                self.cash += proceeds
                self.positions[symbol] -= quantity
                
                if self.positions[symbol] == 0:
                    del self.positions[symbol]
                
                self.trades.append({
                    'date': self.current_date,
                    'symbol': symbol,
                    'action': action,
                    'quantity': quantity,
                    'price': price,
                    'value': proceeds
                })
    
    def _calculate_performance(self) -> Dict:
        """Calculate backtest performance metrics"""
        if not self.portfolio_values:
            return {}
        
        df = pd.DataFrame(self.portfolio_values)
        df.set_index('date', inplace=True)
        
        # Calculate returns
        df['returns'] = df['portfolio_value'].pct_change()
        
        # Performance metrics
        total_return = (df['portfolio_value'].iloc[-1] - self.initial_capital) / self.initial_capital
        annual_return = (1 + total_return) ** (252 / len(df)) - 1
        volatility = df['returns'].std() * np.sqrt(252)
        sharpe_ratio = annual_return / volatility if volatility > 0 else 0
        
        # Drawdown analysis
        cumulative = df['portfolio_value']
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        max_drawdown = drawdown.min()
        
        # Win rate
        winning_trades = len([t for t in self.trades if t['action'] == 'SELL'])
        total_trades = len([t for t in self.trades if t['action'] == 'BUY'])
        
        return {
            'total_return': total_return,
            'annual_return': annual_return,
            'volatility': volatility,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown': max_drawdown,
            'total_trades': total_trades,
            'final_portfolio_value': df['portfolio_value'].iloc[-1],
            'portfolio_history': df,
            'trades': self.trades
        }

# Example strategies
def momentum_strategy(prices: pd.Series, date: datetime, positions: Dict, cash: float) -> List[Dict]:
    """Simple momentum strategy"""
    signals = []
    
    # This is a simplified example - real strategies would use more sophisticated logic
    for symbol in prices.index:
        if not pd.isna(prices[symbol]) and prices[symbol] > 0:
            # Simple momentum: buy if price > moving average (would need historical data)
            if symbol not in positions and cash > prices[symbol] * 100:
                signals.append({
                    'symbol': symbol,
                    'action': 'BUY',
                    'quantity': 100
                })
    
    return signals

def mean_reversion_strategy(prices: pd.Series, date: datetime, positions: Dict, cash: float) -> List[Dict]:
    """Simple mean reversion strategy"""
    signals = []
    
    # Simplified mean reversion logic
    for symbol in positions:
        if symbol in prices and not pd.isna(prices[symbol]):
            # Sell if we have a position (simplified)
            signals.append({
                'symbol': symbol,
                'action': 'SELL',
                'quantity': positions[symbol]
            })
    
    return signals