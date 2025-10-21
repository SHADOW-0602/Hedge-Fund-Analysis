import click
from core.portfolio import Portfolio
from clients.market_data_client import MarketDataClient
from analytics.risk_analytics import RiskAnalyzer
from analytics.options_analytics import OptionsAnalyzer

@click.group()
def cli():
    """Portfolio & Options Analysis Engine"""
    pass

@cli.command()
@click.argument('csv_file')
def analyze_portfolio(csv_file):
    """Analyze portfolio risk from CSV file"""
    portfolio = Portfolio.from_csv(csv_file)
    data_client = MarketDataClient()
    risk_analyzer = RiskAnalyzer(data_client)
    
    click.echo(f"Portfolio loaded: {len(portfolio.positions)} positions")
    click.echo(f"Total value: ${portfolio.total_value:,.2f}")
    
    weights = portfolio.get_weights()
    metrics = risk_analyzer.analyze_portfolio_risk(portfolio.symbols, weights)
    
    click.echo(f"\nRisk Metrics:")
    click.echo(f"Portfolio Volatility: {metrics['portfolio_volatility']:.2%}")
    click.echo(f"Average Correlation: {metrics['avg_correlation']:.3f}")

@cli.command()
@click.argument('csv_file')
def scan_options(csv_file):
    """Scan for covered call opportunities"""
    portfolio = Portfolio.from_csv(csv_file)
    data_client = MarketDataClient()
    options_analyzer = OptionsAnalyzer(data_client)
    
    click.echo("Scanning for covered call opportunities...")
    opportunities = options_analyzer.scan_covered_calls(portfolio.symbols)
    
    if not opportunities:
        click.echo("No opportunities found")
        return
    
    click.echo(f"\nTop 5 Opportunities:")
    for opp in opportunities[:5]:
        click.echo(f"{opp['symbol']}: {opp['annualized_return']:.1%} return, "
                  f"${opp['premium']:.2f} premium")

@cli.command()
@click.argument('csv_file')
def advanced_transactions(csv_file):
    """Advanced transaction processing with FIFO accounting and detailed analysis"""
    from core.transactions import TransactionPortfolio
    from analytics.transaction_processor import TransactionProcessor
    
    txn_portfolio = TransactionPortfolio.from_csv(csv_file)
    data_client = MarketDataClient()
    processor = TransactionProcessor(data_client)
    
    # FIFO P&L calculation
    pnl_analysis = processor.calculate_pnl(txn_portfolio)
    click.echo(f"Total P&L: ${pnl_analysis['total_pnl']:,.2f}")
    click.echo(f"Realized P&L: ${pnl_analysis['total_realized_pnl']:,.2f}")
    click.echo(f"Unrealized P&L: ${pnl_analysis['total_unrealized_pnl']:,.2f}")
    
    # Cost analysis
    cost_analysis = processor.cost_analysis(txn_portfolio.transactions)
    click.echo(f"\nTotal Fees: ${cost_analysis['total_fees']:,.2f}")
    click.echo(f"Fee Rate: {cost_analysis['overall_fee_rate']:.4%}")
    
    # Activity analysis
    activity = processor.activity_analysis(txn_portfolio.transactions)
    if activity:
        click.echo(f"\nTrading Activity:")
        click.echo(f"Total Trades: {activity['total_trades']}")
        click.echo(f"Trading Days: {activity['trading_days']}")
        click.echo(f"Avg Trades/Day: {activity['avg_trades_per_day']:.1f}")

@cli.command()
@click.argument('csv_file')
def analyze_transactions(csv_file):
    """Analyze transaction history and calculate advanced risk metrics"""
    from core.transactions import TransactionPortfolio
    
    txn_portfolio = TransactionPortfolio.from_csv(csv_file)
    positions = txn_portfolio.get_current_positions()
    cost_basis = txn_portfolio.get_cost_basis()
    
    click.echo(f"Current Positions: {len(positions)}")
    for symbol, qty in positions.items():
        avg_cost = cost_basis.get(symbol, 0)
        click.echo(f"{symbol}: {qty} shares @ ${avg_cost:.2f}")
    
    # Advanced risk analysis
    if positions:
        data_client = MarketDataClient()
        risk_analyzer = RiskAnalyzer(data_client)
        
        # Calculate weights based on current market value
        current_prices = data_client.get_current_prices(list(positions.keys()))
        total_value = sum(positions[s] * current_prices.get(s, cost_basis.get(s, 0)) 
                         for s in positions.keys())
        
        weights = {s: (positions[s] * current_prices.get(s, cost_basis.get(s, 0))) / total_value 
                  for s in positions.keys()}
        
        metrics = risk_analyzer.analyze_portfolio_risk(list(positions.keys()), weights)
        
        click.echo(f"\nAdvanced Risk Metrics:")
        click.echo(f"VaR (5%): {metrics['var_5']:.2%}")
        click.echo(f"CVaR (5%): {metrics['cvar_5']:.2%}")
        click.echo(f"Sharpe Ratio: {metrics['sharpe_ratio']:.2f}")
        click.echo(f"Sortino Ratio: {metrics['sortino_ratio']:.2f}")
        click.echo(f"Max Drawdown: {metrics['max_drawdown']:.2%}")
        click.echo(f"Beta: {metrics['beta']:.2f}")
        click.echo(f"Tracking Error: {metrics['tracking_error']:.2%}")

@cli.command()
@click.argument('csv_file')
def portfolio_analytics(csv_file):
    """Comprehensive portfolio analytics including positions, weights, and performance attribution"""
    from core.transactions import TransactionPortfolio
    from analytics.portfolio_analytics import PortfolioAnalyzer
    
    txn_portfolio = TransactionPortfolio.from_csv(csv_file)
    data_client = MarketDataClient()
    analyzer = PortfolioAnalyzer(data_client)
    
    # Position analysis
    position_analysis = analyzer.analyze_positions(txn_portfolio)
    click.echo(f"Portfolio Value: ${position_analysis['total_market_value']:,.2f}")
    click.echo(f"Total P&L: ${position_analysis['total_unrealized_pnl']:,.2f} ({position_analysis['total_return_pct']:.2%})")
    
    # Weight analysis
    weight_analysis = analyzer.analyze_weights(position_analysis)
    click.echo(f"\nConcentration Risk: {weight_analysis['concentration_risk']}")
    click.echo(f"Effective Positions: {weight_analysis['effective_positions']:.1f}")
    click.echo(f"Max Weight: {weight_analysis['max_weight']:.2%}")
    
    # Performance attribution
    attribution = analyzer.performance_attribution(txn_portfolio)
    if attribution:
        click.echo(f"\nTop Contributors (30d):")
        for symbol, data in attribution['top_contributors']:
            click.echo(f"{symbol}: {data['contribution']:.2%}")
    
    # Turnover analysis
    turnover = analyzer.turnover_analysis(txn_portfolio)
    click.echo(f"\nTurnover Analysis (90d):")
    click.echo(f"Trade Count: {turnover['trade_count']}")
    click.echo(f"Turnover Rate: {turnover['turnover_rate']:.2%}")
    click.echo(f"Total Fees: ${turnover['total_fees']:,.2f}")

@cli.command()
@click.argument('symbols', nargs=-1)
@click.option('--strategy', type=click.Choice(['momentum', 'volatility', 'mean_reversion', 'quality', 'breakout', 'pairs']), default='momentum')
def screen_stocks(symbols, strategy):
    """Quantitative stock screening with multiple strategies"""
    from analytics.screening_engine import QuantitativeScreener
    
    if not symbols:
        symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'NFLX', 'AMD', 'CRM']
    
    data_client = MarketDataClient()
    screener = QuantitativeScreener(data_client)
    
    click.echo(f"Running {strategy} screen on {len(symbols)} symbols...")
    
    if strategy == 'momentum':
        results = screener.momentum_screen(list(symbols))
        click.echo("\nTop Momentum Stocks:")
        for symbol, data in results['top_momentum']:
            click.echo(f"{symbol}: {data['momentum_score']:.2%}")
    
    elif strategy == 'volatility':
        results = screener.volatility_screen(list(symbols))
        click.echo("\nLow Volatility Stocks:")
        for symbol, data in results['low_volatility'][:5]:
            click.echo(f"{symbol}: {data['current_volatility']:.2%}")
    
    elif strategy == 'mean_reversion':
        results = screener.mean_reversion_screen(list(symbols))
        click.echo("\nMean Reversion Opportunities:")
        for symbol, data in results['ranked_opportunities'][:5]:
            click.echo(f"{symbol}: {data['signal']} (Z-Score: {data['z_score']:.2f})")
    
    elif strategy == 'quality':
        results = screener.quality_screen(list(symbols))
        click.echo("\nHigh Quality Stocks:")
        for symbol, data in results['high_quality']:
            click.echo(f"{symbol}: Quality Score {data['quality_score']:.3f}")
    
    elif strategy == 'breakout':
        results = screener.breakout_detection(list(symbols))
        click.echo("\nBreakout Candidates:")
        for symbol, data in results['breakout_candidates'].items():
            click.echo(f"{symbol}: {data['breakout_type']} breakout ({data['breakout_strength']:.2%})")
    
    elif strategy == 'pairs':
        results = screener.correlation_arbitrage(list(symbols))
        click.echo("\nPairs Trading Opportunities:")
        for pair_data in results['trading_opportunities'][:5]:
            pair = pair_data['pair']
            click.echo(f"{pair[0]}-{pair[1]}: Corr {pair_data['correlation']:.3f}, Z-Score {pair_data['z_score']:.2f}")

@cli.command()
@click.argument('symbols', nargs=-1)
def statistical_analysis(symbols):
    """Statistical analysis including correlation matrix and clustering"""
    from analytics.statistical_analysis import StatisticalAnalyzer
    
    if not symbols:
        symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']
    
    data_client = MarketDataClient()
    analyzer = StatisticalAnalyzer(data_client)
    
    # Correlation analysis
    corr_analysis = analyzer.correlation_analysis(list(symbols))
    click.echo(f"Average Correlation: {corr_analysis['avg_correlation']:.3f}")
    
    # High correlation pairs
    if corr_analysis['high_correlation_pairs']:
        click.echo("\nHigh Correlation Pairs:")
        for pair_info in corr_analysis['high_correlation_pairs'][:5]:
            pair = pair_info['pair']
            corr = pair_info['correlation']
            click.echo(f"{pair[0]}-{pair[1]}: {corr:.3f}")
    
    # Hierarchical clustering
    clustering = analyzer.hierarchical_clustering(list(symbols))
    click.echo(f"\nAsset Clusters:")
    for cluster_id, stats in clustering['cluster_stats'].items():
        click.echo(f"Cluster {cluster_id}: {stats['symbols']} (Avg Corr: {stats['avg_correlation']:.3f})")

@cli.command()
@click.argument('symbol')
def technical_analysis(symbol):
    """Comprehensive technical analysis for a symbol"""
    from analytics.technical_indicators import TechnicalIndicators
    
    data_client = MarketDataClient()
    tech = TechnicalIndicators(data_client)
    
    analysis = tech.comprehensive_analysis(symbol.upper())
    
    click.echo(f"Technical Analysis for {symbol.upper()}:")
    
    # Current price and moving averages
    ma = analysis['moving_averages']
    if ma:
        click.echo(f"Current Price: ${ma['current_price']:.2f}")
        for ma_name, ma_value in ma['moving_averages'].items():
            click.echo(f"{ma_name}: ${ma_value:.2f}")
    
    # RSI
    if analysis['rsi']:
        click.echo(f"RSI: {analysis['rsi']:.1f}")
    
    # MACD
    macd = analysis['macd']
    if macd:
        click.echo(f"MACD: {macd['macd']:.3f}, Signal: {macd['signal']:.3f}")
    
    # Overall signals
    if analysis['overall_signals']:
        click.echo(f"\nSignals: {', '.join(analysis['overall_signals'])}")
        click.echo(f"Bullish: {analysis['bullish_signals']}, Bearish: {analysis['bearish_signals']}")

@cli.command()
@click.argument('symbol')
def options_analysis(symbol):
    """Complete options analysis with Greeks and strategies"""
    from analytics.options_trading import OptionsTrader
    
    data_client = MarketDataClient()
    options_trader = OptionsTrader(data_client)
    
    # Analyze options chain
    analysis = options_trader.analyze_option_chain(symbol.upper())
    
    if not analysis:
        click.echo(f"No options data available for {symbol.upper()}")
        return
    
    click.echo(f"Options Analysis for {symbol.upper()}:")
    click.echo(f"Current Price: ${analysis['current_price']:.2f}")
    click.echo(f"ATM IV: {analysis['atm_iv']:.2%}")
    
    # Covered call opportunities
    covered_calls = options_trader.covered_call_strategy(symbol.upper(), 100)
    if covered_calls:
        click.echo("\nTop Covered Call Opportunities:")
        for i, opp in enumerate(covered_calls[:3]):
            click.echo(f"{i+1}. Strike ${opp['strike']:.2f}: {opp['annual_return']:.1%} annual return")

@cli.command()
@click.argument('symbols', nargs=-1)
def monte_carlo(symbols):
    """Monte Carlo portfolio simulation"""
    import sys
    sys.path.append('.')
    from monte_carlo_v3 import MonteCarloEngine
    
    if not symbols:
        symbols = ['AAPL', 'MSFT', 'GOOGL']
    
    # Equal weights
    weights = {symbol: 1.0/len(symbols) for symbol in symbols}
    
    data_client = MarketDataClient()
    mc_engine = MonteCarloEngine(data_client)
    
    click.echo(f"Running Monte Carlo simulation for {len(symbols)} assets...")
    results = mc_engine.portfolio_simulation(list(symbols), weights)
    
    click.echo(f"\nSimulation Results:")
    click.echo(f"Expected Return: {results['expected_return']:.2%}")
    click.echo(f"Volatility: {results['volatility']:.2%}")
    click.echo(f"Probability of Loss: {results['probability_loss']:.2%}")
    click.echo(f"95th Percentile: {results['percentiles']['95th']:.3f}")
    click.echo(f"5th Percentile: {results['percentiles']['5th']:.3f}")

@cli.command()
@click.argument('symbols', nargs=-1)
def fundamental_analysis(symbols):
    """Financial statement analysis"""
    import sys
    sys.path.append('.')
    from Pull_Financial_Statements import FinancialStatementAnalyzer
    
    if not symbols:
        symbols = ['AAPL', 'MSFT', 'GOOGL']
    
    analyzer = FinancialStatementAnalyzer()
    
    click.echo(f"Analyzing financial statements for {len(symbols)} companies...")
    comparison_df = analyzer.comparative_analysis(list(symbols))
    
    if not comparison_df.empty:
        click.echo("\nFinancial Comparison:")
        for _, row in comparison_df.iterrows():
            click.echo(f"{row['Symbol']}: ROE {row['ROE']:.2%}, P/B {row['P/B Ratio']:.2f}")
    else:
        click.echo("No financial data available")

@cli.command()
@click.argument('csv_file')
def performance_attribution(csv_file):
    """Comprehensive performance attribution analysis"""
    from core.transactions import TransactionPortfolio
    from analytics.performance_attribution import PerformanceAttributor
    
    txn_portfolio = TransactionPortfolio.from_csv(csv_file)
    positions = txn_portfolio.get_current_positions()
    
    if not positions:
        click.echo("No current positions found")
        return
    
    data_client = MarketDataClient()
    attributor = PerformanceAttributor(data_client)
    
    # Calculate weights
    current_prices = data_client.get_current_prices(list(positions.keys()))
    total_value = sum(positions[s] * current_prices.get(s, 0) for s in positions.keys())
    weights = {s: (positions[s] * current_prices.get(s, 0)) / total_value for s in positions.keys()}
    
    # Factor attribution
    attribution = attributor.factor_based_attribution(list(positions.keys()), weights)
    
    if attribution:
        click.echo(f"Portfolio Return: {attribution['portfolio_return']:.2%}")
        click.echo(f"Benchmark Return: {attribution['benchmark_return']:.2%}")
        click.echo(f"Active Return: {attribution['active_return']:.2%}")
        
        click.echo("\nTop Contributors:")
        for symbol, data in attribution['top_contributors']:
            click.echo(f"{symbol}: {data['total_contribution']:.2%}")
    
    # Transaction cost analysis
    cost_analysis = attributor.transaction_cost_analysis(txn_portfolio)
    click.echo(f"\nTransaction Costs: ${cost_analysis['total_transaction_costs']:,.2f}")
    click.echo(f"Cost Rate: {cost_analysis['overall_cost_rate']:.4%}")

@cli.command()
@click.argument('symbols', nargs=-1)
def factor_research(symbols):
    """Multi-factor model development and analysis"""
    from analytics.research_development import FactorResearcher
    
    if not symbols:
        symbols = ['AAPL', 'MSFT', 'GOOGL']
    
    factors = ['SPY', 'QQQ', 'IWM']  # Market factors
    
    data_client = MarketDataClient()
    researcher = FactorResearcher(data_client)
    
    click.echo(f"Developing multi-factor model for {len(symbols)} assets...")
    
    # Multi-factor model
    factor_model = researcher.multi_factor_model(list(symbols), factors)
    
    if factor_model:
        click.echo(f"\nModel Performance:")
        summary = factor_model['model_summary']
        click.echo(f"Average R²: {summary['average_r_squared']:.3f}")
        click.echo(f"Model Quality: {summary['model_quality']}")
        
        click.echo("\nFactor Importance:")
        for factor, importance in factor_model['factor_importance'].items():
            click.echo(f"{factor}: {importance:.3f}")
    
    # Factor timing model
    timing_model = researcher.factor_timing_model(list(symbols))
    
    if timing_model:
        click.echo(f"\nTiming Model R²: {timing_model['average_r_squared']:.3f}")
        click.echo("Top Features:")
        for feature in timing_model['top_features']:
            click.echo(f"  {feature}")

@cli.command()
@click.option('--username', prompt=True, help='Username')
@click.option('--email', prompt=True, help='Email address')
@click.option('--password', prompt=True, hide_input=True, help='Password')
@click.option('--role', default='viewer', help='User role')
def create_user(username, email, password, role):
    """Create new user account"""
    from enterprise.user_management import UserManager, UserRole
    
    try:
        user_manager = UserManager()
        user_role = UserRole(role)
        user_id = user_manager.create_user(username, email, password, user_role)
        click.echo(f"User created successfully: {user_id}")
    except Exception as e:
        click.echo(f"Error creating user: {e}")

@cli.command()
@click.option('--username', prompt=True, help='Username')
@click.option('--password', prompt=True, hide_input=True, help='Password')
def login(username, password):
    """Login and get authentication token"""
    from enterprise.user_management import UserManager
    
    user_manager = UserManager()
    user = user_manager.authenticate_user(username, password)
    
    if user:
        token = user_manager.generate_jwt_token(user)
        click.echo(f"Login successful!")
        click.echo(f"User: {user.username} ({user.role.value})")
        click.echo(f"Token: {token}")
    else:
        click.echo("Invalid credentials")

@cli.command()
def list_users():
    """List all users (admin only)"""
    from enterprise.user_management import UserManager
    
    user_manager = UserManager()
    users = user_manager.get_users()
    
    click.echo("\nUsers:")
    for user in users:
        last_login = user.last_login.strftime('%Y-%m-%d') if user.last_login else 'Never'
        click.echo(f"{user.username} ({user.role.value}) - Last login: {last_login}")

@cli.command()
@click.argument('csv_file')
def portfolio_breakdown(csv_file):
    """Analyze individual portfolios from transaction data"""
    from core.transactions import TransactionPortfolio
    from analytics.portfolio_manager import PortfolioManager
    from utils.currency_handler import CurrencyHandler
    
    txn_portfolio = TransactionPortfolio.from_csv(csv_file)
    
    # Portfolio summary
    summary = PortfolioManager.portfolio_summary(txn_portfolio)
    
    click.echo(f"Portfolio Analysis ({len(summary)} portfolios):")
    
    for name, data in summary.items():
        click.echo(f"\n{name}:")
        click.echo(f"  Positions: {data['positions']}")
        click.echo(f"  Symbols: {', '.join(data['symbols'])}")
        click.echo(f"  Trades: {data['trade_count']}")
        click.echo(f"  Total Fees: {CurrencyHandler.format_amount(data['total_fees'])}")
    
    # Individual portfolio positions
    portfolios = PortfolioManager.get_portfolios(txn_portfolio)
    data_client = MarketDataClient()
    
    for name, transactions in portfolios.items():
        positions = PortfolioManager.get_portfolio_positions(transactions)
        if positions:
            prices = data_client.get_current_prices(list(positions.keys()))
            total_value = sum(positions[s] * prices.get(s, 0) for s in positions.keys())
            
            click.echo(f"\n{name} Current Value: {CurrencyHandler.format_amount(total_value)}")
            for symbol, qty in positions.items():
                price = prices.get(symbol, 0)
                value = qty * price
                click.echo(f"  {symbol}: {qty} shares @ ${price:.2f} = ${value:,.2f}")
    
    # Portfolio comparison
    all_symbols = set()
    for transactions in portfolios.values():
        positions = PortfolioManager.get_portfolio_positions(transactions)
        all_symbols.update(positions.keys())
    
    if all_symbols:
        all_prices = data_client.get_current_prices(list(all_symbols))
        comparison = PortfolioManager.compare_portfolios(txn_portfolio, all_prices)
        
        click.echo(f"\nPortfolio Comparison:")
        for name, metrics in comparison.items():
            click.echo(f"{name}:")
            click.echo(f"  Value: {CurrencyHandler.format_amount(metrics['current_value'])}")
            click.echo(f"  Avg Position: {CurrencyHandler.format_amount(metrics['avg_position_size'])}")
            click.echo(f"  Fee Rate: {metrics['fee_rate']:.4%}")
            click.echo(f"  Positions: {metrics['positions_count']}")

@cli.command()
@click.argument('csv_file')
@click.option('--base-currency', default='USD', help='Base currency for valuation')
def multi_currency_analysis(csv_file, base_currency):
    """Multi-currency portfolio analysis with conversion"""
    from core.transactions import TransactionPortfolio
    from utils.currency_handler import CurrencyHandler
    
    txn_portfolio = TransactionPortfolio.from_csv(csv_file)
    positions = txn_portfolio.get_current_positions()
    
    if not positions:
        click.echo("No current positions found")
        return
    
    data_client = MarketDataClient()
    prices = data_client.get_current_prices(list(positions.keys()))
    
    # Get currencies from transactions
    position_currencies = {}
    for txn in txn_portfolio.transactions:
        if txn.symbol in positions:
            position_currencies[txn.symbol] = txn.currency or 'USD'
    
    # Multi-currency valuation
    valuation = CurrencyHandler.portfolio_valuation_multi_currency(
        positions, prices, position_currencies, base_currency
    )
    
    click.echo(f"Multi-Currency Portfolio Analysis:")
    click.echo(f"Base Currency: {base_currency}")
    click.echo(f"Total Value: {CurrencyHandler.format_amount(valuation['total_value'], base_currency)}")
    
    click.echo(f"\nCurrency Breakdown:")
    for currency, value in valuation['currency_breakdown'].items():
        pct = (value / valuation['total_value']) * 100
        click.echo(f"  {currency}: {CurrencyHandler.format_amount(value, base_currency)} ({pct:.1f}%)")
    
    click.echo(f"\nExchange Rates (vs {base_currency}):")
    for currency, rate in valuation['exchange_rates'].items():
        if currency != base_currency:
            click.echo(f"  1 {base_currency} = {rate:.4f} {currency}")

@cli.command()
def start_multi_user_server():
    """Start multi-user API server"""
    click.echo("Starting multi-user API server on port 5001...")
    click.echo("API endpoints:")
    click.echo("  POST /api/auth - Login/Register")
    click.echo("  GET /api/user/portfolios - User portfolios")
    click.echo("  GET /api/research/notes - Research notes")
    click.echo("  GET /api/workspaces - Team workspaces")
    
    import subprocess
    subprocess.run(['python', 'enterprise/multi_user_api.py'])

if __name__ == '__main__':
    cli()