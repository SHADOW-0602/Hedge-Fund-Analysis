import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.main_app import app

# For Vercel deployment
app = app

if __name__ == '__main__':
    print("\n=== Portfolio & Options Analysis Engine ===")
    print("Starting server for transaction analysis...")
    print("Web Interface: http://127.0.0.1:8080")
    print("Transaction Analysis API: http://127.0.0.1:8080/api")
    print("Press Ctrl+C to stop\n")
    
    app.run(
        host='127.0.0.1',
        port=8080,
        debug=False,
        threaded=True,
        use_reloader=False
    )
