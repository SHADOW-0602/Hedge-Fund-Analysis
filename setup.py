from setuptools import setup, find_packages

setup(
    name="hedge-fund-analysis",
    version="1.0.0",
    description="Enterprise-grade portfolio risk analysis and options scanning platform",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "streamlit>=1.28.0",
        "pandas>=1.5.0",
        "numpy>=1.21.0",
        "plotly>=5.0.0",
        "yfinance>=0.2.0",
        "requests>=2.28.0",
        "python-dotenv>=0.19.0",
        "supabase>=1.0.0",
        "redis>=4.0.0",
        "flask>=2.0.0",
        "flask-restful>=0.3.9",
        "flask-socketio>=5.0.0",
        "scikit-learn>=1.0.0",
        "scipy>=1.9.0"
    ],
    extras_require={
        "advanced": [
            "xgboost>=1.6.0",
            "lightgbm>=3.3.0",
            "catboost>=1.1.0",
            "pycaret>=3.0.0",
            "streamlit-aggrid>=0.3.0",
            "polars>=0.18.0"
        ]
    }
)