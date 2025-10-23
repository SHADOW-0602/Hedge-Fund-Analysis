# Portfolio & Options Analysis Engine

Enterprise-grade portfolio risk analysis and options scanning platform with advanced analytics, multi-user support, and comprehensive market data integration.

## 🚀 **Core Features**

### 📊 **Portfolio Management**
- **Multi-Format Upload**: CSV transaction files with FIFO cost basis calculation
- **Live Data Integration**: Plaid and SnapTrade brokerage connections
- **Transaction Analysis**: Complete P&L tracking with realized/unrealized gains
- **Portfolio Optimization**: Risk-adjusted allocation with Monte Carlo simulation
- **Multi-Currency Support**: Currency conversion and valuation
- **Multi-Portfolio Analysis**: Compare and analyze multiple portfolios

### 📈 **Analytics & Risk**
- **Advanced Risk Metrics**: VaR, CVaR, Sharpe, Sortino, Maximum Drawdown, Beta analysis
- **Options Analysis**: Covered call opportunities, Greeks calculation, volatility analysis
- **Market Data**: YFinance with intelligent fallback and caching
- **Performance Attribution**: Factor-based attribution and benchmark comparison
- **Technical Analysis**: 50+ indicators, pattern recognition, momentum strategies
- **Statistical Analysis**: Correlation analysis, hierarchical clustering

### 🏢 **Enterprise Features**
- **Multi-User System**: Role-based access control with JWT authentication
- **Data Security**: AES-256 encrypted secrets management
- **Email Service**: SMTP integration with professional templates
- **System Monitoring**: Real-time status dashboard
- **Cookie Management**: GDPR-compliant user preferences
- **Audit Logging**: Comprehensive activity tracking

### 🔗 **Integrations**
- **Database**: Supabase PostgreSQL with real-time sync
- **Cache**: Redis with intelligent TTL management
- **Brokerage APIs**: Plaid, SnapTrade for live account data
- **News & Sentiment**: Real-time market news integration
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

# Cache (Optional - for performance)
REDIS_URL=your_redis_url

# Market Data APIs (Optional - for enhanced data)
FINNHUB_API_KEY=your_finnhub_key
POLYGON_API_KEY=your_polygon_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key

# Email Service (Optional)
EMAIL_SMTP_SERVER=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_USERNAME=your_email
EMAIL_PASSWORD=your_app_password

# Brokerage Integration (Optional)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
SNAPTRADE_CLIENT_ID=your_snaptrade_client_id
```

### 3. **Launch Application**
```bash
# Web interface
streamlit run interfaces/web_app_enterprise.py

# CLI interface
python main.py --help

# View all available commands
python main.py --help
```

## 👤 **User Management**

### **Role-Based Access Control**
- **Admin**: Full system access, user management, system configuration
- **Portfolio Manager**: Portfolio CRUD, risk management, optimization
- **Analyst**: Analytics tools, research, technical analysis
- **Risk Manager**: Risk metrics, compliance reports, monitoring
- **Compliance**: Read-only access, audit trails, regulatory reports
- **Viewer**: Basic portfolio viewing, limited analytics

### **Data Upload Options**
- **CSV Format**: `symbol, quantity, avg_cost`
- **Broker Files**: Schwab, Fidelity, TD Ameritrade, E*TRADE, Interactive Brokers
- **Excel Templates**: Download from application
- **Live Data**: Plaid/SnapTrade brokerage connections
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
# Create new user
python main.py create-user --username analyst1 --email analyst@firm.com --role analyst

# User login
python main.py login --username analyst1

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

#### **2. Cache Setup (Upstash Redis)**
```bash
# 1. Create database at upstash.com
# 2. Add to .env:
REDIS_URL=redis://default:password@host:port
REDIS_PASSWORD=your_password
REDIS_HOST=your_host
REDIS_PORT=6379
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

#### **Brokerage Integration**
```bash
# Plaid (Sandbox/Production)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENVIRONMENT=sandbox  # or production

# SnapTrade (Alternative)
SNAPTRADE_CLIENT_ID=your_snaptrade_client_id
SNAPTRADE_CONSUMER_KEY=your_consumer_key
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
- **SnapTrade Integration**: Multi-broker API access
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
- **`utils/cache_manager.py`**: Redis caching with TTL
- **`utils/logger.py`**: Structured logging with rotation
- **`utils/cookie_manager.py`**: GDPR-compliant cookie management

### **Integration Components**
- **`components/plaid_direct_connect.py`**: Plaid brokerage integration
- **`components/snaptrade_connect.py`**: SnapTrade API integration
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
- **Cache service** health and hit rates
- **Email service** configuration and delivery status
- **Market data APIs** availability and rate limits
- **User session** statistics and security metrics

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

Launch the Streamlit web application for interactive analysis:
```bash
streamlit run interfaces/web_app_enterprise.py
```

Features include:
- Interactive portfolio upload and analysis
- Real-time risk metrics dashboard
- Options scanning and analysis
- Multi-user authentication
- Live brokerage connections
- Comprehensive reporting

---

**Built for professional portfolio management with institutional-grade analytics and security.**