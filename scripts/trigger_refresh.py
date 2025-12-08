import os
import sys
import requests
import time
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

def trigger_refresh():
    token = os.environ.get('API_TOKEN')
    if not token:
        print("Error: API_TOKEN not found in environment")
        sys.exit(1)

    url = "https://shmventures.org/us-news/api/refresh"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://shmventures.org",
        "Referer": "https://shmventures.org/us-news/",
        "Content-Type": "application/json"
    }

    print(f"Triggering refresh at {url}...")
    
    try:
        response = requests.post(url, headers=headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("Success! Refresh triggered.")
            print("Response:", response.json())
        else:
            print("Failed to trigger refresh.")
            print("Response Body (First 500 chars):")
            print(response.text[:500])
            sys.exit(1)
            
    except Exception as e:
        print(f"Exception occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    trigger_refresh()
