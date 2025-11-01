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

# Health check endpoint for Northflank
@app.route('/health')
def health_check():
    return {'status': 'healthy', 'service': 'hedge-fund-analysis'}

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    host = '0.0.0.0' if os.environ.get('FLASK_ENV') == 'production' else '127.0.0.1'
    
    print("\n=== Portfolio & Options Analysis Engine ===")
    print(f"Starting server on {host}:{port}")
    print("Press Ctrl+C to stop\n")
    
    app.run(
        host=host,
        port=port,
        debug=False,
        threaded=True,
        use_reloader=False
    )
