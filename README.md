# Portfolio & Options Analysis Engine

Enterprise-grade portfolio risk analysis and options scanning platform with advanced security, multi-user support, and comprehensive integrations.

## 🚀 **Core Features**

### 📊 **Portfolio Management**
- **Multi-Format Upload**: CSV, Excel, Broker-specific formats (Schwab, Fidelity, TD Ameritrade, E*TRADE, Interactive Brokers)
- **Live Data Integration**: Plaid brokerage connections with real-time sync
- **Transaction Analysis**: Complete P&L tracking, deposits, withdrawals, dividends, fees, taxes
- **Portfolio Optimization**: Risk-adjusted allocation with Monte Carlo simulation
- **Broker File Parsing**: Automated parsing of major brokerage statements

### 📈 **Analytics & Risk**
- **Advanced Risk Metrics**: VaR, CVaR, Sharpe, Sortino, Maximum Drawdown, Beta analysis
- **Options Analysis**: Covered call opportunities, Greeks calculation, volatility analysis
- **Market Data**: 5+ providers with intelligent fallback (YFinance, Finnhub, Polygon, Alpha Vantage, Twelve Data)
- **Performance Attribution**: Multi-factor analysis, sector attribution, benchmark comparison
- **Technical Analysis**: 50+ indicators, pattern recognition, momentum strategies

### 🏢 **Enterprise Security & Management**
- **Multi-User System**: 6 role-based access levels with granular permissions
- **Data Isolation**: Complete user data separation with encrypted storage
- **Secrets Management**: AES-256 encrypted API keys and sensitive data
- **Email Notifications**: Professional HTML templates for alerts and reports
- **System Monitoring**: Real-time status dashboard with service health checks
- **Cookie Consent**: GDPR-compliant user preferences and data management

### 🔗 **Enterprise Integrations**
- **Database**: Supabase PostgreSQL with real-time sync and backup
- **Cache**: Upstash Redis with intelligent cache management and TTL
- **Email Service**: SMTP integration with HTML templates and attachments
- **News & Sentiment**: Real-time market news with AI sentiment analysis
- **Brokerage APIs**: Plaid, SnapTrade integration for live account data
- **Configuration Management**: 80+ environment variables with validation

## ⚡ **Quick Start**

### 1. **Installation**
```bash
# Clone repository
git clone <repository-url>
cd Hedge-Fund-Analysis

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
```

### 2. **Configuration**
Edit `.env` file with your API keys and database credentials:
```bash
# Required: Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# Required: Cache
REDIS_URL=your_redis_url

# Optional: Enhanced features
EMAIL_SMTP_SERVER=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_USERNAME=your_email
EMAIL_PASSWORD=your_app_password
```

### 3. **Launch Application**
```bash
# Enterprise web interface
streamlit run interfaces/web_app_enterprise.py

# CLI interface
python main.py --help
```

## 👤 **User Management**

### **Default Admin Login**
- Username: `admin`
- Password: `admin123`
- **⚠️ Change default password immediately in production**

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
# Basic portfolio analysis
python main.py analyze-portfolio sample_portfolio.csv

# Advanced transaction analysis with P&L
python main.py analyze-transactions sample_transactions.csv

# Comprehensive portfolio analytics
python main.py portfolio-analytics sample_transactions.csv

# Performance attribution analysis
python main.py performance-attribution sample_transactions.csv
```

### **Options & Risk Analysis**
```bash
# Options scanning with Greeks
python main.py scan-options sample_portfolio.csv

# Options analysis with volatility
python main.py options-analysis AAPL

# Monte Carlo risk simulation
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

# Start multi-user server
python main.py start-multi-user-server
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
symbol,quantity,price,date,transaction_type,fees
AAPL,100,150.50,2024-01-15,BUY,9.95
MSFT,-25,285.00,2024-01-20,SELL,9.95
```

### **Supported Broker Formats**
- **Charles Schwab**: Position and transaction exports
- **Fidelity**: Portfolio and activity statements
- **TD Ameritrade**: Position and transaction files
- **E*TRADE**: Portfolio downloads
- **Interactive Brokers**: Flex queries and statements

## 🏗️ **Architecture**

### **Core Modules**
- **`core/`**: Data models (Portfolio, Position, Transaction)
- **`clients/`**: Multi-source market data with intelligent fallback
- **`analytics/`**: Risk analysis, options scanning, performance attribution
- **`interfaces/`**: Enterprise web app and CLI interfaces

### **Utility Modules**
- **`utils/config.py`**: Centralized configuration with 80+ environment variables
- **`utils/email_service.py`**: Professional email templates and SMTP integration
- **`utils/user_secrets.py`**: AES-256 encrypted secrets management
- **`utils/cache_manager.py`**: Redis caching with intelligent TTL
- **`utils/logger.py`**: Structured logging with rotation
- **`utils/cookie_manager.py`**: GDPR-compliant cookie management
- **`utils/broker_parsers.py`**: Multi-broker file parsing

### **Enterprise Features**
- **Multi-tenant architecture** with complete data isolation
- **Role-based access control** with 6 permission levels
- **Real-time system monitoring** with health checks
- **Encrypted secrets storage** for API keys and tokens
- **Professional email notifications** with HTML templates
- **Comprehensive audit logging** for compliance

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

## 🚀 **Production Deployment**

### **Environment Setup**
1. Set `ENVIRONMENT=production` in `.env`
2. Configure all required services (database, cache, email)
3. Set strong encryption keys and passwords
4. Enable SSL/TLS for all connections
5. Configure backup and monitoring

### **Scaling Considerations**
- **Database**: Supabase auto-scaling with connection pooling
- **Cache**: Redis clustering for high availability
- **Compute**: Horizontal scaling with load balancers
- **Storage**: Encrypted file storage for user data

---

**Built for enterprise portfolio management with institutional-grade security and scalability.**