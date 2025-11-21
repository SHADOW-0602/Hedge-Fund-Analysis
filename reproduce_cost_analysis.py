import sys
import os
from datetime import datetime, timedelta
import pandas as pd

# Add src to path
sys.path.append(os.path.join(os.getcwd(), 'src'))

from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
from core.transactions import Transaction
from clients.market_data_client import MarketDataClient

# Mock Data Client
class MockDataClient(MarketDataClient):
    def __init__(self):
        pass
    def get_current_prices(self, symbols):
        return {s: 150.0 for s in symbols}

def test_cost_analysis():
    print("Testing Cost Analysis Logic...")
    
    # Setup
    client = MockDataClient()
    analyzer = AdvancedTransactionAnalyzer(client)
    
    # Test Case 1: Standard Transaction (Recent)
    t1 = Transaction(
        symbol="AAPL",
        quantity=10,
        price=150.0,
        date=datetime.now() - timedelta(days=5),
        transaction_type="BUY",
        fees=1.0
    )
    
    # Test Case 2: Old Transaction (> 1 year)
    t2 = Transaction(
        symbol="GOOGL",
        quantity=5,
        price=2000.0,
        date=datetime.now() - timedelta(days=400),
        transaction_type="BUY",
        fees=5.0
    )
    
    # Test Case 3: Small Transaction
    t3 = Transaction(
        symbol="MSFT",
        quantity=1,
        price=10.0,
        date=datetime.now() - timedelta(days=10),
        transaction_type="SELL",
        fees=0.0
    )
    
    # Test Case 4: Different Case Transaction Type
    t4 = Transaction(
        symbol="TSLA",
        quantity=10,
        price=200.0,
        date=datetime.now() - timedelta(days=2),
        transaction_type="buy", # lowercase
        fees=2.0
    )

    transactions = [t1, t2, t3, t4]
    
    print(f"\nTotal Transactions: {len(transactions)}")
    
    # Run Analysis - 1Y Period
    print("\n--- Analysis (Period: 1Y) ---")
    result = analyzer.cost_analysis(transactions, period='1Y')
    
    print(f"Total Costs: ${result['total_costs']:.2f}")
    print(f"Commissions: ${result['total_commissions']:.2f}")
    print(f"Spreads: ${result['total_spreads']:.2f}")
    print(f"Slippage: ${result['total_slippage']:.2f}")
    print(f"Volume: ${sum(t['volume'] for t in result['breakdown']):.2f}")
    
    print("\nBreakdown:")
    for item in result['breakdown']:
        print(f"  {item['name']}: Total=${item['total']:.2f} (Comm=${item['commissions']:.2f}, Vol=${item['volume']:.2f})")

    # Check if t4 (lowercase 'buy') was included
    included_symbols = [item['name'] for item in result['breakdown']]
    if "TSLA" not in included_symbols:
        print("\n[ISSUE] 'buy' (lowercase) transaction was excluded!")
    else:
        print("\n[OK] 'buy' (lowercase) transaction was included.")

    # Check if t2 (old) was excluded
    if "GOOGL" in included_symbols:
        print("[ISSUE] Old transaction was included!")
    else:
        print("[OK] Old transaction was correctly excluded.")

if __name__ == "__main__":
    test_cost_analysis()
