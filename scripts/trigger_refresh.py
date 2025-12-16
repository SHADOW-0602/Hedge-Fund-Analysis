import os
import sys
import time

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    print("Initializing US News system...")
    from US_News.app_US import process_news_for_active_tickers
except ImportError as e:
    print(f"Error importing US_News app: {e}")
    sys.exit(1)

def run_direct_refresh():
    print("Starting direct news refresh execution...")
    start_time = time.time()
    
    # Full Custom List of 50 Tickers
    custom_tickers = [
        'AAPL', 'MSFT', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA',
        'LLY', 'JPM', 'NFLX', 'BRK-B', 'V', 'UNH', 'AVGO', 'AMD', 'TSM', 'PFE', 'MRK', 'JNJ', 'ORCL',
        'ADBE', 'CRM', 'COST', 'HD', 'WMT', 'BAC', 'GS', 'UBER', 'DELL', 'PLTR', 'ARM', 'SMCI', 'CRWD',
        'SNOW', 'NET', 'PDD', 'BABA', 'COIN', 'SOFI', 'TTD', 'ROKU', 'REGN', 'NBIX', 'CORT', 'CAPR',
        'CRSP', 'NVO', 'GILD', 'BA', 'CAT', 'SPY'
    ]
    
    try:
        print(f"Triggering refresh for {len(custom_tickers)} symbols...")
        process_news_for_active_tickers(force=True, custom_tickers=custom_tickers)
        
        duration = time.time() - start_time
        print(f"\nRefresh completed in {duration:.2f} seconds.")
        
    except Exception as e:
        print(f"\nCRITICAL ERROR during refresh: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_direct_refresh()
