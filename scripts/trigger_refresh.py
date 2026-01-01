import os
import sys
import time
import datetime

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    print("Initializing Trigger System...")
    # Import the updated functions
    from US_News.app_US import (
        process_news_for_active_tickers, 
        process_quant_for_active_tickers, 
        get_last_fundamental_run,
        set_last_fundamental_run,
        TICKER_UNIVERSE
    )
except ImportError as e:
    print(f"Error importing US_News app: {e}")
    sys.exit(1)

def run_scheduled_refresh():
    print("Starting scheduled refresh execution...")
    start_time = time.time()
    
    # 1. Always Run: News Analysis (Daily)
    print("\n--- STEP 1: Daily News Analysis ---")
    try:
        process_news_for_active_tickers(force=True, report_type='news')
    except Exception as e:
        print(f"Error in News Analysis: {e}")

    # 2. Always Run: Quant Analysis (Daily)
    print("\n--- STEP 2: Daily Quant Analysis ---")
    try:
        process_quant_for_active_tickers(force=True)
    except Exception as e:
        print(f"Error in Quant Analysis: {e}")

    # 3. Conditional Run: Fundamental Analysis (Every 2 Days)
    print("\n--- STEP 3: Checking Fundamental Analysis Schedule ---")
    
    # Use Supabase Persistence
    last_run_str = get_last_fundamental_run()
    run_fundamental = False
    
    if not last_run_str:
        run_fundamental = True
        print("  > First run (or no persistent state) detected. Triggering Fundamental Analysis.")
    else:
        try:
            last_run = datetime.datetime.fromisoformat(last_run_str)
            days_diff = (datetime.datetime.now() - last_run).days
            if days_diff >= 2:
                run_fundamental = True
                print(f"  > Last run was {days_diff} days ago ({last_run_str}). Triggering Fundamental Analysis.")
            else:
                print(f"  > Last run was {days_diff} days ago ({last_run_str}). Skipping (Next run in {2 - days_diff} days).")
        except ValueError:
            print("  > Error parsing last run date. Triggering safety run.")
            run_fundamental = True

    if run_fundamental:
        try:
             process_news_for_active_tickers(force=True, report_type='fundamental')
             # Update State in Supabase
             set_last_fundamental_run()
        except Exception as e:
             print(f"Error in Fundamental Analysis: {e}")

    duration = time.time() - start_time
    print(f"\nAll refresh tasks completed in {duration:.2f} seconds.")

if __name__ == "__main__":
    run_scheduled_refresh()
