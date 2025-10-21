from dataclasses import dataclass
from typing import List, Dict
import pandas as pd
from utils.logger import logger

@dataclass
class Position:
    symbol: str
    quantity: float
    avg_cost: float
    
    @property
    def market_value(self) -> float:
        return self.quantity * self.avg_cost

@dataclass
class Portfolio:
    positions: List[Position]
    
    @classmethod
    def from_csv(cls, filepath: str) -> 'Portfolio':
        df = pd.read_csv(filepath)
        return cls.from_dataframe(df)
    
    @classmethod
    def from_dataframe(cls, df: pd.DataFrame) -> 'Portfolio':
        logger.debug(f"Creating portfolio from DataFrame with {len(df)} rows and columns: {list(df.columns)}")
        # Check for transaction format: date, ticker, action
        df_cols_lower = [c.lower() for c in df.columns]
        transaction_cols = ['date', 'ticker', 'action']
        portfolio_cols = ['symbol', 'quantity', 'avg_cost']
        
        if all(col in df_cols_lower for col in transaction_cols):
            logger.info("Detected transaction format, converting to portfolio positions")
            # Convert transaction format to portfolio format
            return cls._from_transactions(df)
        elif all(col in df.columns for col in portfolio_cols):
            logger.info("Detected standard portfolio format")
            # Standard portfolio format with symbol validation
            positions = []
            for _, row in df.iterrows():
                if cls._is_valid_symbol(row.symbol):
                    positions.append(Position(row.symbol, row.quantity, row.avg_cost))
                else:
                    logger.warning(f"Skipping invalid symbol: {row.symbol}")
            return cls(positions)
        else:
            raise ValueError(f"DataFrame must contain either {portfolio_cols} or {transaction_cols}")
    
    @classmethod
    def _from_transactions(cls, df: pd.DataFrame) -> 'Portfolio':
        """Convert transaction history to portfolio positions"""
        # Normalize column names
        df_norm = df.copy()
        df_norm.columns = [col.lower() for col in df_norm.columns]
        
        # Group by ticker and calculate positions
        positions = []
        cash_balance = 0  # Track cash from non-equity transactions
        
        for ticker in df_norm['ticker'].unique():
            ticker_transactions = df_norm[df_norm['ticker'] == ticker].copy()
            
            total_shares = 0
            total_cost = 0
            
            for _, txn in ticker_transactions.iterrows():
                shares = float(txn.get('shares', 0))
                price = float(txn.get('price', 0))
                commission = float(txn.get('commission', 0))
                action = str(txn['action']).upper()
                
                if action in ['BUY', 'B']:
                    total_shares += shares
                    total_cost += (shares * price) + commission
                elif action in ['SELL', 'S']:
                    total_shares -= shares
                    if total_shares > 0:
                        total_cost = total_cost * (total_shares / (total_shares + shares))
                elif action in ['DIVIDEND', 'DIV']:
                    # Dividends reduce cost basis
                    dividend_amount = shares * price if shares > 0 else price
                    if total_shares > 0:
                        total_cost -= dividend_amount
                elif action in ['DEPOSIT', 'WITHDRAW', 'TAXES', 'FEES', 'INTEREST_INCOME', 'INTEREST_EXPENSE']:
                    # Cash transactions - track separately
                    amount = shares * price if shares > 0 else price
                    if action in ['DEPOSIT', 'INTEREST_INCOME']:
                        cash_balance += amount
                    elif action in ['WITHDRAW', 'TAXES', 'FEES', 'INTEREST_EXPENSE']:
                        cash_balance -= amount
            
            # Only add positions with shares > 0 and valid symbols
            if total_shares > 0 and cls._is_valid_symbol(ticker):
                avg_cost = max(0.01, total_cost / total_shares)  # Prevent negative cost
                positions.append(Position(ticker, total_shares, avg_cost))
            elif total_shares > 0:
                logger.warning(f"Skipping invalid symbol: {ticker}")
        
        # Add cash as a position if significant
        if abs(cash_balance) > 0.01:
            positions.append(Position('CASH', cash_balance, 1.0))
        
        return cls(positions)
    
    @classmethod
    def from_snaptrade(cls, user_id: str, account_id: str = None) -> 'Portfolio':
        """Create portfolio from SnapTrade brokerage data"""
        from clients.snaptrade_client import snaptrade_client
        
        if not snaptrade_client:
            raise ValueError("SnapTrade client not configured")
        
        holdings_df = snaptrade_client.get_holdings(user_id, account_id)
        
        if holdings_df.empty:
            return cls([])
        
        # Convert SnapTrade format to portfolio positions
        positions = []
        for _, holding in holdings_df.iterrows():
            if cls._is_valid_symbol(holding['symbol']) and holding['quantity'] > 0:
                avg_cost = holding['avg_cost'] if holding['avg_cost'] > 0 else holding['market_value'] / holding['quantity']
                positions.append(Position(holding['symbol'], holding['quantity'], avg_cost))
        
        return cls(positions)
    
    @property
    def symbols(self) -> List[str]:
        return [pos.symbol for pos in self.positions]
    
    @property
    def total_value(self) -> float:
        return sum(pos.market_value for pos in self.positions)
    
    def get_weights(self) -> Dict[str, float]:
        total = self.total_value
        return {pos.symbol: pos.market_value / total for pos in self.positions}
    
    @staticmethod
    def _is_valid_symbol(symbol: str) -> bool:
        """Check if symbol is valid for market data lookup"""
        if not symbol or not isinstance(symbol, str):
            return False
        
        symbol = symbol.strip().upper()
        
        # Skip options contracts (contain C00 or P00)
        if any(x in symbol for x in ['C00', 'P00']):
            return False
        
        # Skip known delisted/problematic symbols
        delisted = ['ACHN', 'CASH']
        if symbol in delisted:
            return False
        
        # Basic symbol format check (letters, numbers, dots, hyphens)
        import re
        if not re.match(r'^[A-Z0-9.-]+$', symbol):
            return False
        
        return True