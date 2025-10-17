# Portfolio & Options Analysis Engine

Foundational engine for portfolio risk analysis and options scanning.

## Features

### 📊 **Portfolio Management**
- **Multi-Format Upload**: CSV, Excel, Portseido templates
- **Live Data Integration**: Plaid brokerage connections
- **Transaction Analysis**: Deposits, withdrawals, dividends, fees, taxes
- **Portfolio Optimization**: Risk-adjusted allocation suggestions

### 📈 **Analytics & Risk**
- **Advanced Risk Metrics**: VaR, CVaR, Sharpe, Sortino ratios
- **Options Analysis**: Covered call opportunities with filtering
- **Market Data**: 5 providers (YFinance, Finnhub, Polygon, Alpha Vantage, Twelve Data)
- **Performance Attribution**: Factor analysis and benchmarking

### 🏢 **Enterprise Features**
- **Multi-User System**: 6 role-based access levels
- **Data Isolation**: User-specific portfolios and analysis
- **Collaboration Tools**: Research notes and team workspaces
- **Professional Caching**: Redis with intelligent cache management
- **Cookie Consent**: GDPR-compliant user preferences

### 🔗 **Integrations**
- **Database**: Supabase PostgreSQL with real-time sync
- **Cache**: Upstash Redis for performance
- **News**: Real-time market news with sentiment analysis
- **Brokerage**: Plaid integration for live account data

## Quick Start

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run enterprise web interface:
```bash
streamlit run interfaces/web_app_enterprise.py
```

## 🚀 **Quick Start**

### **Upload Portfolio Data**
- **CSV Format**: symbol, quantity, avg_cost
- **Excel/Portseido**: Download template from app
- **Live Data**: Connect brokerage via Plaid

### **Default Admin Login**
- Username: `admin`
- Password: `admin123`

### **User Roles Available**
- **Admin**: Full system access
- **Portfolio Manager**: Portfolio + risk management
- **Analyst**: Analytics + research tools
- **Risk Manager**: Risk analysis focus
- **Compliance**: Read-only compliance view
- **Viewer**: Basic read-only access

3. Use CLI:
```bash
# Basic portfolio analysis
python main.py analyze-portfolio sample_portfolio.csv

# Advanced transaction analysis with risk metrics
python main.py analyze-transactions sample_transactions.csv

# Comprehensive portfolio analytics
python main.py portfolio-analytics sample_transactions.csv

# Options scanning
python main.py scan-options sample_portfolio.csv

# Quantitative screening
python main.py screen-stocks --strategy momentum AAPL MSFT GOOGL
python main.py screen-stocks --strategy pairs AAPL MSFT GOOGL TSLA

# Statistical analysis
python main.py statistical-analysis AAPL MSFT GOOGL TSLA NVDA

# Advanced transaction processing
python main.py advanced-transactions sample_transactions.csv

# Technical analysis
python main.py technical-analysis AAPL

# Options analysis with Greeks
python main.py options-analysis AAPL

# Monte Carlo simulation
python main.py monte-carlo AAPL MSFT GOOGL

# Fundamental analysis
python main.py fundamental-analysis AAPL MSFT GOOGL

# Performance attribution analysis
python main.py performance-attribution sample_transactions.csv

# Multi-factor model research
python main.py factor-research AAPL MSFT GOOGL TSLA NVDA

# Multi-user system
python main.py create-user --username analyst1 --email analyst@firm.com --role analyst
python main.py login --username analyst1
python main.py start-multi-user-server
```

## Setup

## 🔧 **Configuration**

### **Required Setup**
1. **Copy environment file**: `cp .env.example .env`
2. **Database (Supabase)**:
   - Create project at [supabase.com](https://supabase.com)
   - Run `supabase_setup.sql` in SQL Editor
   - Add SUPABASE_URL and SUPABASE_ANON_KEY to `.env`
3. **Cache (Upstash Redis)**:
   - Create database at [upstash.com](https://upstash.com)
   - Add REDIS_URL to `.env`

### **Optional Integrations**
- **Market Data**: API keys for enhanced data (all have free tiers)
- **News**: NewsAPI key for market news
- **Brokerage**: Plaid credentials for live account data
- **Email**: SMTP settings for notifications (optional)

### CSV Format

Portfolio CSV must contain:
- `symbol`: Stock ticker
- `quantity`: Number of shares
- `avg_cost`: Average cost per share

## Architecture

- `core/`: Core data models (Portfolio, Position)
- `clients/`: Multi-source market data client with fallback
- `analytics/`: Risk and options analysis modules
- `interfaces/`: CLI and web interfaces
- `utils/`: Configuration and utilities
- `main.py`: Application entry point