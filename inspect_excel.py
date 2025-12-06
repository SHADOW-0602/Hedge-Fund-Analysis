import pandas as pd
import os

file_path = "US Stocks_Basic Data.xlsx"
try:
    df = pd.read_excel(file_path, nrows=1)
    for col in df.columns:
        print(col)
except Exception as e:
    print(f"Error: {e}")
