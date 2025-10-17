from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime
import pandas as pd

@dataclass
class Transaction:
    symbol: str
    quantity: float
    price: float
    date: datetime
    transaction_type: str  # 'BUY', 'SELL'
    fees: float = 0.0

@dataclass
class TransactionPortfolio:
    transactions: List[Transaction]
    
    @classmethod
    def from_csv(cls, filepath: str) -> 'TransactionPortfolio':
        df = pd.read_csv(filepath)
        required_cols = ['symbol', 'quantity', 'price', 'date', 'transaction_type']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"CSV must contain columns: {required_cols}")
        
        df['date'] = pd.to_datetime(df['date'])
        df['fees'] = df.get('fees', 0.0)
        
        transactions = [
            Transaction(
                symbol=row.symbol,
                quantity=row.quantity,
                price=row.price,
                date=row.date,
                transaction_type=row.transaction_type,
                fees=row.fees
            ) for _, row in df.iterrows()
        ]
        return cls(transactions)
    
    def get_current_positions(self) -> Dict[str, float]:
        positions = {}
        for txn in self.transactions:
            if txn.symbol not in positions:
                positions[txn.symbol] = 0
            
            if txn.transaction_type == 'BUY':
                positions[txn.symbol] += txn.quantity
            elif txn.transaction_type == 'SELL':
                positions[txn.symbol] -= txn.quantity
        
        return {k: v for k, v in positions.items() if v > 0}
    
    def get_cost_basis(self) -> Dict[str, float]:
        cost_basis = {}
        quantities = {}
        
        for txn in self.transactions:
            if txn.symbol not in cost_basis:
                cost_basis[txn.symbol] = 0
                quantities[txn.symbol] = 0
            
            if txn.transaction_type == 'BUY':
                total_cost = cost_basis[txn.symbol] * quantities[txn.symbol]
                total_cost += txn.quantity * txn.price + txn.fees
                quantities[txn.symbol] += txn.quantity
                cost_basis[txn.symbol] = total_cost / quantities[txn.symbol] if quantities[txn.symbol] > 0 else 0
        
        return cost_basis