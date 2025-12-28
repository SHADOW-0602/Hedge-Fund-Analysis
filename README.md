# Portfolio & Options Analysis Engine

Enterprise-grade portfolio risk analysis and options scanning platform with advanced analytics, multi-user support, and comprehensive market data integration.

## 🚀 **Core Features**

### 📊 **Unified Data Management**
- **Hybrid Data Processing**: Seamlessly merges data from **Manual File Uploads** and **Live Plaid Connections** into a single analysis view.
- **Smart Data Enrichment**:
  - **Bidirectional Gap-Filling**: Intelligently auto-fills missing data (e.g., Cost Basis, Sector, Custom Tags) by cross-referencing all available sources for each ticker.
  - **Regex Normalization**: Advanced column matching handles 20+ variations of headers (e.g., "Price Paid", "Unit Cost", "Avg Price") automatically.
  - **Schema Flexibility**: Preserves **ALL** input columns (20+ columns supported), allowing rich metadata (Notes, Strategies) to persist alongside core analytical data.
- **Conflict Prevention**: Distinct storage and intelligent merging logic prevent data loss or accidental overwrites.
- **Manual Uploads**: Supports CSV/Excel files with smart auto-detection.
- **Plaid Integration**: 
  - **Multi-Account**: Connects multiple brokerage accounts simultaneously.
  - **Optimized Caching**: Smart 30s caching prevents API rate limits and redundant reloads.
  - **Unified View**: Automatically combines assets from the active manual file and all connected Plaid accounts.
- **Transaction Analysis**: Complete P&L tracking with realized/unrealized gains, FIFO/LIFO accounting, and XIRR calculations.
- **Multi-Currency Support**: Currency conversion and valuation.

### 📈 **Analytics & Risk**
- **Advanced Risk Metrics**: VaR, CVaR, Sharpe, Sortino, Maximum Drawdown, Beta analysis.
- **Options Analysis**: Covered call opportunities, Greeks calculation, volatility analysis.
- **Strategy Backtesting**: Test trading strategies with historical data.
- **Financial Analysis**: P&L Attribution, Trade Performance, Tax Analysis, Cash Flow Analysis, Trade Timing, and Drawdown Analysis.
- **Market Data**: Multi-provider API integration (Polygon, Finnhub, Alpha Vantage, YFinance).
- **Performance Attribution**: Factor-based attribution with real-time calculations.
- **Technical Analysis**: 50+ indicators, pattern recognition, momentum strategies.
- **Statistical Analysis**: Correlation analysis with D3.js visualization, hierarchical clustering.
- **Monte Carlo Simulation**: Portfolio risk modeling and scenario analysis.
- **Portfolio Optimization**: Efficient frontier and risk-return optimization.
- **XIRR Analysis**: Internal Rate of Return calculations for both portfolios and individual transactions.

### 📰 **US Stock News with AI (Deep Research Engine)**
- **Advanced Analyst Persona**:
  - **Engine**: `Gemini Flash 2.0` configured as a senior Wall St analyst with 20 years of experience.
  - **Output**: Generates comprehensive 1,500+ word investment reports including specific Buy/Sell signals, price targets, and deep competitive analysis.
- **Premium User Experience**:
  - **Real-Time Data**: Instant integration of live price, change, and "Previous Close" data.
  - **Markdown Rendering**: Client-side rendering via `marked.js` for beautiful, bulleted reports.
  - **Dynamic Sources**: Interactive "Sources" modal to view original news links without cluttering the report.
- **Enterprise-Grade Reliability**:
  - **Key Rotation**: Automatic rotation across 6+ Gemini API keys to ensure zero downtime.
  - **Smart Caching**: Fallback to cached reports with client-side "clean-up" for legacy data formats.

- **Smart Image Loading**: Backend proxy for Pexels API to bypass ad-blockers and CORS issues (`/api/pexels-image`).
- **Multi-Source News**: Aggregated news from NewsAPI, Finnhub, Polygon, and Yahoo Finance.
- **Automated Refresh**: Automated daily news fetching and processing via GitHub Actions.
- **Smart Caching**: Efficient database caching with Supabase for fast load times.

### 🏢 **Enterprise Features**
- **Multi-User System**: Role-based access control with JWT authentication
- **Data Security**: AES-256 encrypted secrets management
- **Email Service**: SMTP integration with professional templates
- **System Monitoring**: Real-time status dashboard
- **Cookie Management**: GDPR-compliant user preferences
- **Audit Logging**: Comprehensive activity tracking

### 🔗 **Integrations**
- **Database**: Supabase PostgreSQL with real-time sync
- **Brokerage APIs**: Plaid Production Mode for live account data
- **Market Data**: Multi-provider fallback system for reliability
- **Visualization**: D3.js for interactive correlation matrices
- **Configuration**: Environment-based configuration management

## ⚡ **Quick Start**

### 1. **Installation**
```bash
# Clone repository
git clone <repository-url>
cd Hedge-Fund-Analysis

# Install dependencies
pip install -r requirements.txt

# Optional: Install with advanced ML features
pip install -e ".[advanced]"

# Setup environment
cp .env.example .env  # Edit with your API keys
```

### 2. **Configuration**
Edit `.env` file with your API keys and database credentials:
```bash
# Database (Optional - for multi-user features)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Market Data APIs (Primary providers)
POLYGON_API_KEY=your_polygon_key
FINNHUB_API_KEY=your_finnhub_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
TWELVE_DATA_API_KEY=your_twelve_data_key



# Email Service (Optional)
EMAIL_SMTP_SERVER=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_USERNAME=your_email
EMAIL_PASSWORD=your_app_password

# US News & AI Integration (Hybrid Groq + Gemini)
# Groq (Primary Engine - Speed & Analysis)
GROQ_API_KEY=your_primary_groq_key
GROQ_API_KEY_2=backup_key_2
GROQ_API_KEY_6=backup_key_6

# Gemini (Checker Engine - Verification)
# Note: Maker keys (GEMINI_API_KEY) are deprecated but kept for fallback/legacy support
GEMINI_API_KEY=legacy_maker_key
GEMINI_API_CHECKER=dedicated_checker_key_flash
NEWSAPI_KEY=your_newsapi_key

# Brokerage Integration (Production Ready)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENVIRONMENT=production
```

### 3. **Launch Application**
```bash
# Main application (recommended)
python app.py

# Alternative: Use startup script
python scripts/start_web.py

# Then open http://127.0.0.1:8080 in your browser
```

## 👤 **User Management**

### **Role-Based Access Control**
- **Admin**: Full system access, user management, admin portal access
- **User**: Full portfolio analysis features, risk management, analytics tools

### **Data Upload Options**
- **CSV Format**: `symbol, quantity, avg_cost`
- **Broker Files**: Schwab, Fidelity, TD Ameritrade, E*TRADE, Interactive Brokers
- **Excel Templates**: Download from application
- **Live Data**: Plaid brokerage connections
- **Transaction History**: Complete P&L tracking with cost basis

## 💻 **CLI Commands**

### **Portfolio Analysis**
```bash
# Basic portfolio analysis from CSV
python main.py analyze-portfolio sample_portfolio.csv

# Transaction-based analysis with P&L
python main.py analyze-transactions sample_transactions.csv

# Advanced transaction processing with FIFO
python main.py advanced-transactions sample_transactions.csv

# Comprehensive portfolio analytics
python main.py portfolio-analytics sample_transactions.csv

# Performance attribution analysis
python main.py performance-attribution sample_transactions.csv

# Multi-portfolio breakdown
python main.py portfolio-breakdown sample_transactions.csv

# Multi-currency analysis
python main.py multi-currency-analysis sample_transactions.csv --base-currency USD
```

### **Options & Risk Analysis**
```bash
# Options scanning for covered calls
python main.py scan-options sample_portfolio.csv

# Complete options analysis with Greeks
python main.py options-analysis AAPL

# Monte Carlo portfolio simulation
python main.py monte-carlo AAPL MSFT GOOGL
```

### **Quantitative Analysis**
```bash
# Momentum screening
python main.py screen-stocks --strategy momentum AAPL MSFT GOOGL

# Pairs trading analysis
python main.py screen-stocks --strategy pairs AAPL MSFT GOOGL TSLA

# Statistical analysis
python main.py statistical-analysis AAPL MSFT GOOGL TSLA NVDA

# Technical analysis
python main.py technical-analysis AAPL

# Fundamental analysis
python main.py fundamental-analysis AAPL MSFT GOOGL

# Multi-factor research
python main.py factor-research AAPL MSFT GOOGL TSLA NVDA
```

### **User Management**
```bash
# Create new user (all new users get 'user' role automatically)
python main.py create-user --username user1 --email user@firm.com

# User login
python main.py login --username user1

# List all users (admin only)
python main.py list-users
```

## 🔧 **Enterprise Configuration**

### **Required Infrastructure**

#### **1. Database Setup (Supabase)**
```bash
# 1. Create project at supabase.com
# 2. Run supabase_setup.sql in SQL Editor
# 3. Add to .env:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```



### **Enhanced Integrations**

#### **Email Service (Production Recommended)**
```bash
# SMTP Configuration
EMAIL_SMTP_SERVER=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_USERNAME=your_email@domain.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM_NAME="Portfolio Analytics"
EMAIL_REPLY_TO=support@domain.com
```

#### **Market Data APIs (Free Tiers Available)**
```bash
# Primary providers
FINNHUB_API_KEY=your_finnhub_key
POLYGON_API_KEY=your_polygon_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
TWELVE_DATA_API_KEY=your_twelve_data_key

# News & Sentiment
NEWS_API_KEY=your_newsapi_key
```

#### **Brokerage Integration (Production Ready)**
```bash
# Plaid Production Mode
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENVIRONMENT=production
PLAID_PRODUCTS=investments,transactions,auth
PLAID_COUNTRY_CODES=US,CA
```

### **Security Configuration**
```bash
# Encryption keys (auto-generated if not provided)
SECRET_KEY=your_32_character_secret_key
ENCRYPTION_KEY=your_encryption_key_for_secrets

# Session management
SESSION_TIMEOUT_MINUTES=60
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15
```

## 📁 **File Formats**

### **Portfolio CSV Format**
```csv
symbol,quantity,avg_cost
AAPL,100,150.50
MSFT,50,280.75
GOOGL,25,2500.00
```

### **Transaction CSV Format**
```csv
symbol,quantity,price,date,transaction_type,fees,currency,portfolio
AAPL,100,150.50,2024-01-15,BUY,9.95,USD,Main
MSFT,-25,285.00,2024-01-20,SELL,9.95,USD,Main
TSLA,50,200.00,2024-01-25,BUY,9.95,USD,Growth
```

### **Required Fields**
- **symbol**: Stock ticker symbol
- **quantity**: Number of shares (negative for sells)
- **price**: Price per share
- **date**: Transaction date (YYYY-MM-DD)
- **transaction_type**: BUY, SELL, DIVIDEND, etc.

### **Optional Fields**
- **fees**: Transaction fees (default: 0)
- **currency**: Currency code (default: USD)
- **portfolio**: Portfolio name for multi-portfolio analysis

### **Supported Data Sources**
- **CSV Files**: Custom format with flexible field mapping
- **Plaid Integration**: Live brokerage account connections
- **Manual Entry**: Web interface for direct data input
- **Excel Files**: Automatic conversion to CSV format

## 🏗️ **Architecture**

### **Core Modules**
- **`core/`**: Data models (Portfolio, Position, Transaction)
- **`clients/`**: Market data clients with intelligent fallback
- **`analytics/`**: Risk analysis, options scanning, performance attribution
- **`interfaces/`**: Web app and CLI interfaces
- **`enterprise/`**: User management and ML engine
- **`compliance/`**: Reporting and audit functionality

### **Analytics Modules**
- **`analytics/risk_analytics.py`**: VaR, CVaR, Sharpe, Sortino calculations
- **`analytics/options_analytics.py`**: Options strategies and Greeks
- **`analytics/technical_indicators.py`**: 50+ technical indicators
- **`analytics/statistical_analysis.py`**: Correlation and clustering
- **`analytics/performance_attribution.py`**: Factor-based attribution
- **`analytics/screening_engine.py`**: Quantitative stock screening
- **`analytics/backtesting.py`**: Strategy backtesting framework

### **Utility Modules**
- **`utils/config.py`**: Environment-based configuration
- **`utils/email_service.py`**: SMTP integration with templates
- **`utils/user_secrets.py`**: AES-256 encrypted secrets storage
- **`utils/logger.py`**: Structured logging with rotation
- **`utils/cookie_manager.py`**: GDPR-compliant cookie management

### **Integration Components**
- **`components/plaid_direct_connect.py`**: Plaid brokerage integration

- **`components/transaction_manager.py`**: Transaction processing
- **`components/multi_broker_connect.py`**: Unified broker interface

## 🔒 **Security Features**

- **AES-256 Encryption**: All sensitive data encrypted at rest
- **PBKDF2 Key Derivation**: Secure password hashing
- **Session Management**: Configurable timeouts and lockouts
- **Data Isolation**: Complete user data separation
- **Audit Logging**: Full activity tracking for compliance
- **GDPR Compliance**: Cookie consent and data management

## 📊 **System Status**

The application includes a real-time system status dashboard showing:
- **Database connectivity** and performance
- **Market data APIs** availability and rate limits
- **Plaid integration** status and connection health
- **User session** statistics and security metrics
- **Analytics performance** and calculation times

## 🚀 **Getting Started Examples**

### **Basic Portfolio Analysis**
```bash
# Create sample portfolio CSV
echo "symbol,quantity,avg_cost" > portfolio.csv
echo "AAPL,100,150.00" >> portfolio.csv
echo "MSFT,50,280.00" >> portfolio.csv

# Analyze portfolio
python main.py analyze-portfolio portfolio.csv
```

### **Transaction Analysis**
```bash
# Create sample transaction CSV
echo "symbol,quantity,price,date,transaction_type" > transactions.csv
echo "AAPL,100,150.00,2024-01-15,BUY" >> transactions.csv
echo "AAPL,-50,160.00,2024-02-15,SELL" >> transactions.csv

# Analyze with P&L
python main.py analyze-transactions transactions.csv
```

### **Advanced Features**
```bash
# Technical analysis
python main.py technical-analysis AAPL

# Options analysis
python main.py options-analysis AAPL

# Multi-factor research
python main.py factor-research AAPL MSFT GOOGL

# Statistical analysis
python main.py statistical-analysis AAPL MSFT GOOGL TSLA NVDA
```

## 📊 **Web Interface**

Access the web application at http://127.0.0.1:8080 after running `python app.py`

Features include:
- **Unified Dashboard**: View manual portfolios and Plaid connections side-by-side.
- **Smart Data Handling**: Auto-detection and merging of multiple data sources without manual intervention.
- **Interactive Analytics**: Click-through analysis for Risk, Options, and Performance Attribution.
- **Real-time Risk Metrics**: VaR, Sharpe ratio, Beta, Maximum Drawdown calculated on the fly.
- **Options Strategies**: Scanner for Covered Calls, Protective Puts, and Iron Condors.
- **Monte Carlo Simulation**: Interactive risk modeling with customizable scenarios.
- **D3.js Visualizations**: Dynamic correlation matrices and interactive charts.
- **Live Brokerage Connections**: Secure Plaid integration with auto-refresh.

### **Enhanced Web Experience**
- **Clean UI**: Streamlined interface with collapsible sidebar and unified data controls.
- **Dedicated Landing Pages**: Comprehensive 'Features' and 'About Us' pages.
- **Dynamic Visuals**: Integrated Pexels API for high-quality background images.
- **Responsive Design**: Optimized for desktop and mobile viewing with unified navigation.

---

**Built for professional portfolio management with institutional-grade analytics and security.**