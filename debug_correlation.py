#!/usr/bin/env python3

import sys
import os
import pandas as pd
import yfinance as yf
import warnings
warnings.filterwarnings('ignore')

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from utils.symbol_parser import get_underlying_symbol

def debug_correlation_analysis():
    """Debug why correlation analysis only shows 5 symbols"""
    
    # Load Plaid transaction data
    df = pd.read_csv('plaid_transaction_data.csv')
    
    # Get all unique symbols from Plaid data
    plaid_symbols = df['symbol'].dropna().unique().tolist()
    
    print("=== CORRELATION ANALYSIS DEBUG ===")
    print(f"Original Plaid symbols: {len(plaid_symbols)}")
    print(f"Symbols: {sorted(plaid_symbols)}")
    print()
    
    # Extract underlying symbols (same logic as correlation route)
    underlying_symbols = []
    for symbol in plaid_symbols:
        if symbol and not symbol.startswith('CUR:'):
            underlying = get_underlying_symbol(symbol)
            if underlying and underlying not in underlying_symbols:
                underlying_symbols.append(underlying)
    
    print(f"Underlying symbols extracted: {len(underlying_symbols)}")
    print(f"Underlying symbols: {sorted(underlying_symbols)}")
    print()
    
    # Limit to 10 symbols (same as route)
    limited_symbols = underlying_symbols[:10]
    print(f"After limiting to 10: {len(limited_symbols)}")
    print(f"Limited symbols: {sorted(limited_symbols)}")
    print()
    
    # Try to download data for each symbol
    print("=== DATA AVAILABILITY CHECK ===")
    valid_symbols = []
    
    for symbol in limited_symbols:
        try:
            print(f"Checking {symbol}...")
            data = yf.download(symbol, period='1y', progress=False)
            
            if data is None or data.empty:
                print(f"  {symbol}: NO DATA")
                continue
            
            # Get price data
            if 'Adj Close' in data.columns:
                prices = data['Adj Close']
            else:
                prices = data['Close']
            
            returns = prices.pct_change().dropna()
            data_points = len(returns)
            
            if data_points >= 30:
                valid_symbols.append(symbol)
                print(f"  {symbol}: VALID ({data_points} data points)")
            else:
                print(f"  {symbol}: INSUFFICIENT DATA ({data_points} points, need 30+)")
                
        except Exception as e:
            print(f"  {symbol}: ERROR - {str(e)}")
    
    print()
    print(f"Final valid symbols for correlation: {len(valid_symbols)}")
    print(f"Valid symbols: {sorted(valid_symbols)}")
    
    if len(valid_symbols) >= 2:
        print()
        print("=== CORRELATION MATRIX PREVIEW ===")
        try:
            # Download data for valid symbols
            price_data = yf.download(valid_symbols, period='1y', progress=False)
            
            if 'Adj Close' in price_data.columns:
                prices = price_data['Adj Close']
            else:
                prices = price_data['Close']
            
            returns = prices.pct_change().dropna()
            correlation_matrix = returns.corr()
            
            print("Correlation Matrix:")
            print(correlation_matrix.round(2))
            
            # Calculate average correlation
            corr_values = []
            for s1 in valid_symbols:
                for s2 in valid_symbols:
                    if s1 != s2:
                        corr_val = correlation_matrix.loc[s1, s2]
                        if not pd.isna(corr_val):
                            corr_values.append(corr_val)
            
            if corr_values:
                avg_correlation = sum(corr_values) / len(corr_values)
                print(f"Average Correlation: {avg_correlation:.2f}")
            
        except Exception as e:
            print(f"Error creating correlation matrix: {e}")

if __name__ == "__main__":
    debug_correlation_analysis()