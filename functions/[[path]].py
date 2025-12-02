"""
Cloudflare Pages Function for Hedge Fund Analysis Application
"""
import sys
import os
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / 'src'))

# Import the Flask app
from app import app

def on_request(context):
    """
    Cloudflare Pages Function handler
    """
    return app(context.request.environ, context.start_response)