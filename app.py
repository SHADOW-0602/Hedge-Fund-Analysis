#!/usr/bin/env python3
"""
Streamlit deployment entry point for Portfolio Analysis Engine
"""
import subprocess
import sys
import os
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Set environment variables for production
os.environ.setdefault('STREAMLIT_SERVER_HEADLESS', 'true')
os.environ.setdefault('STREAMLIT_SERVER_ENABLE_CORS', 'false')

if __name__ == "__main__":
    # Run the main Streamlit app
    subprocess.run([
        sys.executable, "-m", "streamlit", "run", 
        "interfaces/web_app_enterprise.py",
        "--server.headless=true",
        "--server.enableCORS=false"
    ])