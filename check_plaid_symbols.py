#!/usr/bin/env python3

import sys
import os
import pandas as pd
from collections import Counter

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.clients.market_data_client import MarketDataClient

def analyze_plaid_symbols():
    """Analyze how many Plaid symbols are used after filtering"""
    
    # Load Plaid transaction data
    df = pd.read_csv('plaid_transaction_data.csv')
    
    # Get all unique symbols from Plaid data
    plaid_symbols = df['symbol'].dropna().unique().tolist()
    
    print("=== PLAID SYMBOL ANALYSIS ===")
    print(f"Total unique symbols in Plaid data: {len(plaid_symbols)}")
    print(f"Symbols: {sorted(plaid_symbols)}")
    print()
    
    # Initialize market data client
    client = MarketDataClient()
    
    # Filter symbols using the same logic as the system
    filtered_symbols = client._filter_valid_symbols(plaid_symbols)
    
    print(f"Symbols after filtering: {len(filtered_symbols)}")
    print(f"Filtered symbols: {sorted(filtered_symbols)}")
    print()
    
    # Show which symbols were filtered out
    filtered_out = set(plaid_symbols) - set(filtered_symbols)
    print(f"Symbols filtered out: {len(filtered_out)}")
    print(f"Filtered out: {sorted(filtered_out)}")
    print()
    
    # Categorize symbols
    stocks = []
    options = []
    other = []
    
    for symbol in plaid_symbols:
        if client._is_valid_stock_symbol(symbol):
            stocks.append(symbol)
        elif client._is_valid_options_contract(symbol):
            options.append(symbol)
        else:
            other.append(symbol)
    
    print("=== SYMBOL BREAKDOWN ===")
    print(f"Valid stocks: {len(stocks)} - {sorted(stocks)}")
    print(f"Valid options: {len(options)} - {sorted(options)}")
    print(f"Other/Invalid: {len(other)} - {sorted(other)}")
    print()
    
    # Calculate usage percentage
    usage_percentage = (len(filtered_symbols) / len(plaid_symbols)) * 100
    print(f"Usage percentage: {usage_percentage:.1f}% of Plaid symbols are used in analysis")
    
    # Show transaction counts
    symbol_counts = Counter(df['symbol'].dropna())
    print("\n=== TRANSACTION COUNTS ===")
    for symbol in sorted(symbol_counts.keys()):
        status = "USED" if symbol in filtered_symbols else "FILTERED"
        print(f"{symbol}: {symbol_counts[symbol]} transactions - {status}")

if __name__ == "__main__":
    analyze_plaid_symbols()