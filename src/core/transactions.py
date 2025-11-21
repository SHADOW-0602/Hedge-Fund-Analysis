from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime
import pandas as pd
import logging

# Setup module logger
logger = logging.getLogger(__name__)

@dataclass
class Transaction:
    symbol: str
    quantity: float
    price: float
    date: datetime
    transaction_type: str  # 'BUY', 'SELL', 'Buy', 'Sell', 'Deposit', 'Withdraw'
    fees: float = 0.0
    portfolio: Optional[str] = None
    currency: Optional[str] = None
    broker: Optional[str] = None

@dataclass
class TransactionPortfolio:
    transactions: List[Transaction]
    
    @classmethod
    def from_csv(cls, filepath: str) -> 'TransactionPortfolio':
        """Load transactions from CSV file"""
        df = pd.read_csv(filepath)
        return cls.from_dataframe(df)
    
    @classmethod
    def from_dataframe(cls, df: pd.DataFrame) -> 'TransactionPortfolio':
        """Create TransactionPortfolio from DataFrame"""
        logger.info(f"Creating TransactionPortfolio from DataFrame with {len(df)} rows")
        # Handle different CSV formats
        column_mapping = {
            'ticker': 'symbol',
            'shares': 'quantity', 
            'action': 'transaction_type',
            'commission': 'fees',
            'brokerage': 'broker',
            'platform': 'broker'
        }
        
        # Apply column mapping
        df = df.rename(columns=column_mapping)
        
        # Check required columns after mapping
        required_cols = ['symbol', 'quantity', 'price', 'date', 'transaction_type']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            original_cols = list(df.columns)
            logger.error(f"Missing required columns: {missing_cols}. Available: {original_cols}")
            raise ValueError(f"After column mapping, missing required columns: {missing_cols}. Available columns: {original_cols}")
        
        df['date'] = pd.to_datetime(df['date'])
        df['fees'] = df.get('fees', 0.0)
        
        # Handle empty price values for cash transactions (only if price column exists)
        if 'price' in df.columns:
            df['price'] = pd.to_numeric(df['price'], errors='coerce').fillna(0.0)
        else:
            df['price'] = 0.0
        df['portfolio'] = df.get('portfolio', None)
        df['currency'] = df.get('currency', None)
        df['broker'] = df.get('broker', None)
        
        # Normalize transaction types
        df['transaction_type'] = df['transaction_type'].str.upper()
        
        transactions = [
            Transaction(
                symbol=row['symbol'],
                quantity=row['quantity'],
                price=row['price'],
                date=row['date'],
                transaction_type=row['transaction_type'],
                fees=row['fees'],
                portfolio=row.get('portfolio', None),
                currency=row.get('currency', None),
                broker=row.get('broker', row.get('portfolio', 'Unknown'))
            ) for _, row in df.iterrows()
        ]
        logger.info(f"Successfully created {len(transactions)} transactions")
        return cls(transactions)
    
    def to_csv(self, filepath: str) -> None:
        """Save transactions to CSV file"""
        data = []
        for txn in self.transactions:
            data.append({
                'portfolio': txn.portfolio,
                'date': txn.date.strftime('%Y-%m-%d'),
                'action': txn.transaction_type,
                'ticker': txn.symbol,
                'price': txn.price,
                'currency': txn.currency,
                'shares': txn.quantity,
                'commission': txn.fees,
                'broker': txn.broker
            })
        
        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False)
    
    def to_supabase(self, user_id: str, transaction_set_name: str) -> str:
        """Save transactions to Supabase"""
        from clients.supabase_client import supabase_client
        
        logger.info(f"Saving {len(self.transactions)} transactions to Supabase for user {user_id}")
        if not supabase_client:
            logger.error("Supabase client not configured")
            raise ValueError("Supabase client not configured")
        
        # Convert transactions to dict format
        transactions_data = []
        for txn in self.transactions:
            transactions_data.append({
                'portfolio': txn.portfolio,
                'date': txn.date.isoformat(),
                'action': txn.transaction_type,
                'ticker': txn.symbol,
                'price': txn.price,
                'currency': txn.currency,
                'shares': txn.quantity,
                'commission': txn.fees,
                'broker': txn.broker
            })
        
        result = supabase_client.save_transactions(user_id, transaction_set_name, transactions_data)
        logger.info(f"Successfully saved transactions to Supabase with ID: {result}")
        return result
    
    @classmethod
    def from_supabase(cls, user_id: str, transaction_id: str) -> 'TransactionPortfolio':
        """Load transactions from Supabase"""
        from clients.supabase_client import supabase_client
        
        if not supabase_client:
            raise ValueError("Supabase client not configured")
        
        transaction_set = supabase_client.get_transactions(transaction_id, user_id)
        if not transaction_set:
            raise ValueError(f"Transaction set {transaction_id} not found")
        
        # Convert to DataFrame and use existing from_dataframe method
        df = pd.DataFrame(transaction_set['transactions_data'])
        return cls.from_dataframe(df)
    
    @classmethod
    def from_broker_file(cls, filepath: str, broker: str) -> 'TransactionPortfolio':
        """Load transactions from broker-specific file format"""
        from utils.broker_parsers import parse_broker_file
        df = parse_broker_file(broker, filepath)
        return cls.from_dataframe(df)
    
    @classmethod
    def from_plaid(cls, user_id: str, account_id: str = None) -> 'TransactionPortfolio':
        """Load transactions from Plaid brokerage connection"""
        from clients.plaid_client import plaid_client
        
        if not plaid_client:
            raise ValueError("Plaid client not configured")
        
        transactions_df = plaid_client.get_transactions(user_id, account_id)
        return cls.from_dataframe(transactions_df)
    

    
    def get_current_positions(self) -> Dict[str, float]:
        positions = {}
        for txn in self.transactions:
            # Skip cash transactions
            if txn.symbol == 'CASH':
                continue
                
            if txn.symbol not in positions:
                positions[txn.symbol] = 0
            
            if txn.transaction_type in ['BUY', 'Buy']:
                positions[txn.symbol] += txn.quantity
            elif txn.transaction_type in ['SELL', 'Sell']:
                positions[txn.symbol] -= txn.quantity
        
        return {k: v for k, v in positions.items() if v > 0}
    
    def get_cost_basis(self) -> Dict[str, float]:
        cost_basis = {}
        quantities = {}
        
        for txn in self.transactions:
            # Skip cash transactions
            if txn.symbol == 'CASH':
                continue
                
            if txn.symbol not in cost_basis:
                cost_basis[txn.symbol] = 0
                quantities[txn.symbol] = 0
            
            if txn.transaction_type in ['BUY', 'Buy']:
                total_cost = cost_basis[txn.symbol] * quantities[txn.symbol]
                total_cost += txn.quantity * txn.price + txn.fees
                quantities[txn.symbol] += txn.quantity
                cost_basis[txn.symbol] = total_cost / quantities[txn.symbol] if quantities[txn.symbol] > 0 else 0
        
        return cost_basis