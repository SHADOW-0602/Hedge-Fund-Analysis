#!/usr/bin/env python3

import sys
import os
import requests
import json

# Test the live API endpoint
def test_live_attribution():
    """Test the live performance attribution API"""
    
    # Load Plaid data to simulate frontend request
    import pandas as pd
    df = pd.read_csv('plaid_transaction_data.csv')
    
    # Create portfolio data like frontend would send
    portfolio_data = []
    for _, row in df.iterrows():
        portfolio_data.append({
            'symbol': row['symbol'],
            'quantity': float(row['quantity']) if pd.notna(row['quantity']) else 1.0,
            'price': float(row['price']) if pd.notna(row['price']) else 100.0
        })
    
    # Remove duplicates by symbol
    seen_symbols = set()
    unique_portfolio = []
    for item in portfolio_data:
        if item['symbol'] not in seen_symbols:
            unique_portfolio.append(item)
            seen_symbols.add(item['symbol'])
    
    print("=== LIVE API TEST ===")
    print(f"Testing with {len(unique_portfolio)} portfolio items")
    
    # Test the API endpoint
    url = "http://127.0.0.1:8080/api/performance-attribution"
    payload = {
        "portfolio": unique_portfolio,
        "options": {
            "period": "1Y",
            "benchmark": "SPY"
        }
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("Response received:")
            print(json.dumps(result, indent=2))
            
            if result.get('success'):
                attribution = result.get('attribution', {})
                print("\n=== ATTRIBUTION VALUES ===")
                print(f"Portfolio Return: {attribution.get('portfolio_return', 0):.2f}%")
                print(f"Benchmark Return: {attribution.get('benchmark_return', 0):.2f}%")
                print(f"Active Return: {attribution.get('active_return', 0):.2f}%")
                print(f"Asset Allocation: {attribution.get('asset_allocation', 0):.2f}%")
                print(f"Security Selection: {attribution.get('security_selection', 0):.2f}%")
                print(f"Interaction Effect: {attribution.get('interaction_effect', 0):.2f}%")
            else:
                print(f"API Error: {result.get('error', 'Unknown error')}")
        else:
            print(f"HTTP Error: {response.text}")
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_live_attribution()