import pandas as pd
from typing import Dict, Callable

def parse_generic_csv(file_path: str) -> pd.DataFrame:
    """Parse generic CSV format: date,ticker,action,shares,price,commission"""
    df = pd.read_csv(file_path)
    return df

def parse_portfolio_csv(file_path: str) -> pd.DataFrame:
    """Parse portfolio CSV format: portfolio,date,action,ticker,price,currency,shares,commission"""
    df = pd.read_csv(file_path)
    
    # Map columns to standard format
    column_mapping = {
        'ticker': 'symbol',
        'shares': 'quantity',
        'action': 'transaction_type', 
        'commission': 'fees'
    }
    
    df = df.rename(columns=column_mapping)
    
    # Normalize transaction types
    df['transaction_type'] = df['transaction_type'].str.upper()
    
    # Handle cash transactions (no price for deposits/withdrawals)
    df['price'] = df['price'].fillna(0)
    
    return df

def parse_schwab_csv(file_path: str) -> pd.DataFrame:
    """Parse Schwab CSV format"""
    df = pd.read_csv(file_path)
    df = df[df['Action'].isin(['Buy', 'Sell'])]
    df['action'] = df['Action'].str.upper()
    return df.rename(columns={
        'Symbol': 'ticker', 'Quantity': 'shares', 'Price': 'price', 
        'Date': 'date', 'Fees & Comm': 'commission'
    })[['date', 'ticker', 'action', 'shares', 'price', 'commission']]

def parse_fidelity_csv(file_path: str) -> pd.DataFrame:
    """Parse Fidelity CSV format"""
    df = pd.read_csv(file_path)
    df = df[df['Action'].isin(['YOU BOUGHT', 'YOU SOLD'])]
    df['action'] = df['Action'].map({'YOU BOUGHT': 'BUY', 'YOU SOLD': 'SELL'})
    return df.rename(columns={
        'Symbol': 'ticker', 'Quantity': 'shares', 'Price ($)': 'price',
        'Run Date': 'date', 'Commission ($)': 'commission'
    })[['date', 'ticker', 'action', 'shares', 'price', 'commission']]

def parse_td_ameritrade_csv(file_path: str) -> pd.DataFrame:
    """Parse TD Ameritrade CSV format"""
    df = pd.read_csv(file_path)
    df = df[df['Type'].isin(['BUY', 'SELL'])]
    return df.rename(columns={
        'Symbol': 'ticker', 'Qty': 'shares', 'Price': 'price',
        'Date': 'date', 'Type': 'action', 'Commission': 'commission'
    })[['date', 'ticker', 'action', 'shares', 'price', 'commission']]

BROKER_PARSERS: Dict[str, Callable] = {
    'Generic': parse_generic_csv,
    'Portfolio Format': parse_portfolio_csv,
    'Charles Schwab': parse_schwab_csv,
    'Fidelity': parse_fidelity_csv,
    'TD Ameritrade': parse_td_ameritrade_csv,
}

def parse_broker_file(broker: str, file_path: str) -> pd.DataFrame:
    """Parse file based on selected broker"""
    parser = BROKER_PARSERS.get(broker)
    if not parser:
        raise ValueError(f"Unsupported broker: {broker}")
    
    df = parser(file_path)
    
    # For Generic format, return as-is (Portfolio class handles transaction format)
    if broker == 'Generic':
        return df
    
    # For other brokers, ensure standard transaction format
    required_cols = ['symbol', 'quantity', 'price', 'date', 'transaction_type', 'fees']
    if not all(col in df.columns for col in required_cols):
        raise ValueError(f"Parser for {broker} must return columns: {required_cols}")
    
    return df