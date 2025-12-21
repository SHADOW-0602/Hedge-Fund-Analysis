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
    from US_News.app_US import process_news_for_active_tickers, TICKER_UNIVERSE
except ImportError as e:
    print(f"Error importing US_News app: {e}")
    sys.exit(1)

def run_direct_refresh():
    print("Starting direct news refresh execution...")
    start_time = time.time()
    
    # Use the central definition of tickers from app_US.py
    custom_tickers = TICKER_UNIVERSE
    
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
