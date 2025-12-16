import sys
import os
import json
import random
import time
import requests
import textwrap
from datetime import datetime
from dotenv import load_dotenv

# Add root directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load env before importing app modules
load_dotenv()

try:
    from US_News.app_US import fetch_news_for_ticker
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def get_groq_keys():
    keys = []
    # Check GROQ_API_KEY (1) to (6)
    key_vars = ['GROQ_API_KEY'] + [f'GROQ_API_KEY_{i}' for i in range(2, 7)]
    for var in key_vars:
        k = os.getenv(var)
        if k: keys.append((k, var))
    return keys

def generate_custom_summary(ticker, news_articles, all_keys_data):
    if not news_articles or not all_keys_data:
        return "No news data available."

    # Prepare news content
    news_text = f"Stock Ticker: {ticker}\n\n"
    for idx, article in enumerate(news_articles[:10], 1):
        news_text += f"{idx}. {article['title']}\n"
        news_text += f"   Source: {article['source']}\n"
        news_text += f"   {article['description']}\n\n"

    # CUSTOM PROMPT: Optimized to ONLY ask for executive_summary
    prompt = f"""Analyze the following news articles about {ticker} stock.

{news_text}

Please provide a JSON response with the following structure:
{{
    "executive_summary": "An executive summary of exactly 60-70 words describing the main developments."
}}

IMPORTANT: 
1. Return ONLY valid JSON.
2. Generate ONLY the 'executive_summary' field. Do not generate other fields.
3. The summary MUST be exactly 100-120 words long. 
4. Be concise and factual."""

    headers = {'Content-Type': 'application/json', 'Authorization': ''}
    payload = {
        "messages": [
            {"role": "system", "content": "You are a financial analyst AI. You summarize stock news concisely in JSON format."},
            {"role": "user", "content": prompt}
        ],
        "model": "llama-3.3-70b-versatile",
        "response_format": {"type": "json_object"},
        "temperature": 0.3
    }
    
    available_keys = list(all_keys_data)
    random.shuffle(available_keys)
    
    for attempt, (api_key, key_name) in enumerate(available_keys):
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers['Authorization'] = f"Bearer {api_key}"
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            if response.status_code == 429:
                time.sleep(1)
                continue
            if response.status_code == 503:
                time.sleep(2)
                continue
            if response.status_code != 200:
                continue

            data = response.json()
            if 'choices' not in data or not data['choices']:
                 continue

            response_text = data['choices'][0]['message']['content']
            
            # Clean markdown
            if response_text.startswith('```json'): response_text = response_text[7:]
            if response_text.startswith('```'): response_text = response_text[3:]
            if response_text.endswith('```'): response_text = response_text[:-3]
            
            summary_data = json.loads(response_text.strip())
            return summary_data.get('executive_summary', 'Error: Field missing')
            
        except Exception as e:
            print(f"Error on {key_name}: {e}")
            continue

    return "Failed to generate summary (All keys exhausted)"

def main():
    tickers = ['AAPL', 'GOOG', 'TSLA']
    keys = get_groq_keys()
    
    if not keys:
        print("No Groq keys found.")
        return

    # Generate timestamped filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"executive_summaries_{timestamp}.txt"
    
    # Create new file
    with open(output_file, "w", encoding="utf-8") as f:
        pass  

    total_start = time.time()
    for ticker in tickers:
        print(f"Processing {ticker}...")
        news = fetch_news_for_ticker(ticker)
        summary_text = generate_custom_summary(ticker, news, keys)
        
        word_count = len(summary_text.split())
        print(f"  > Summary length: {word_count} words")
        
        with open(output_file, "a", encoding="utf-8") as f:
            f.write(f"{ticker} Executive Summary ({word_count} words):\n")
            f.write(textwrap.fill(summary_text, width=80) + "\n")
            f.write("-" * 40 + "\n\n")
            
    print(f"\nDone! Results saved to {output_file} in {time.time() - total_start:.2f}s")

if __name__ == "__main__":
    main()
