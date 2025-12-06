import pandas as pd
import os

try:
    file_path = "US Stocks_Basic Data.xlsx"
    if os.path.exists(file_path):
        df = pd.read_excel(file_path)
        print("--- SECTORS ---")
        for s in sorted(df['Sector'].dropna().unique()):
            print(s)
        
        # Also print top 20 Industries to check naming style
        print("\n--- INDUSTRIES (Sample) ---") 
        for i in sorted(df['Industry'].dropna().unique())[:20]:
            print(i)
    else:
        print("File not found")
except Exception as e:
    print(f"Error: {e}")
