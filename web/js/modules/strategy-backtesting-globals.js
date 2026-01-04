// Global functions for Strategy Backtesting in Analytics Manager





// Options settings toggle
window.toggleOptionsSettings = function () {
    const settingsPanel = document.getElementById('optionsSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
};

// Update options analysis function
window.updateOptionsAnalysis = function () {
    const expiration = document.getElementById('optionsExpiration')?.value || '3M';
    const moneyness = document.getElementById('optionsMoneyness')?.value || 'All';
    const minPremium = document.getElementById('optionsMinPremium')?.value || '0.50';
    const deltaRange = document.getElementById('optionsDeltaRange')?.value || 'All';

    if (window.analyticsCore) {
        window.analyticsCore.optionsSettings = {
            expiration: expiration,
            moneyness: moneyness,
            min_premium: parseFloat(minPremium),
            delta_range: deltaRange
        };
    }

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('options-strategies');
    }
};

// Monte Carlo settings toggle
window.toggleMonteCarloSettings = function () {
    const settingsPanel = document.getElementById('monteCarloSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
};

// Update Monte Carlo analysis function
window.updateMonteCarloAnalysis = function () {
    const forecastPeriod = document.getElementById('mcForecastPeriod')?.value || '1Y';
    const simulations = document.getElementById('mcSimulations')?.value || '1000';
    const confidenceIntervals = document.getElementById('mcConfidenceIntervals')?.value || '0.95';
    const marketRegime = document.getElementById('mcMarketRegime')?.value || 'normal';
    const volatilityAdjustment = document.getElementById('mcVolatilityAdjustment')?.value || '1.0';

    if (window.analyticsCore) {
        window.analyticsCore.monteCarloSettings = {
            forecast_period: forecastPeriod,
            simulations: parseInt(simulations),
            confidence_intervals: parseFloat(confidenceIntervals),
            market_regime: marketRegime,
            volatility_adjustment: parseFloat(volatilityAdjustment)
        };
    }

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('monte-carlo');
    }
};

// Portfolio optimization settings toggle
window.toggleOptimizationSettings = function () {
    const settingsPanel = document.getElementById('optimizationSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
};

// Update portfolio optimization function
// Update portfolio optimization function moved to analytics-manager.js

// Sector allocation settings toggle
window.toggleSectorSettings = function () {
    const settingsPanel = document.getElementById('sectorSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
};

// Update sector allocation function
window.updateSectorAllocation = function () {
    const classification = document.getElementById('sectorClassification')?.value || 'GICS';
    const level = document.getElementById('sectorLevel')?.value || 'Sector';
    const currency = document.getElementById('sectorCurrency')?.value || 'USD';
    const benchmark = document.getElementById('sectorBenchmark')?.value || 'SPY';
    const period = document.getElementById('sectorPeriod')?.value || '1Y';

    if (window.analyticsCore) {
        window.analyticsCore.sectorSettings = {
            classification: classification,
            level: level,
            currency: currency,
            benchmark: benchmark,
            period: period
        };
    }

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('sector-allocation');
    }
};

/*
// Statistical analysis settings toggle
window.toggleStatisticalSettings = function () {
    const settingsPanel = document.getElementById('statisticalSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
};

// Update statistical analysis function
window.updateStatisticalAnalysis = function () {
    const lookback = document.getElementById('statisticalLookback')?.value || '252';
    const frequency = document.getElementById('statisticalFrequency')?.value || 'daily';
    const benchmark = document.getElementById('statisticalBenchmark')?.value || 'SPY';
    const confidence = document.getElementById('statisticalConfidence')?.value || '0.95';

    if (window.analyticsCore) {
        window.analyticsCore.statisticalSettings = {
            lookback_period: parseInt(lookback),
            frequency: frequency,
            benchmark: benchmark,
            confidence_level: parseFloat(confidence)
        };
    }

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('statistical-analysis');
    }
};
*/

// Technical analysis settings toggle
window.toggleTechnicalSettings = function () {
    const settingsPanel = document.getElementById('technicalSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
};

// Update technical analysis function
window.updateTechnicalAnalysis = function () {
    const period = document.getElementById('technicalPeriod')?.value || '6M';
    const timeframe = document.getElementById('technicalTimeframe')?.value || 'Daily';
    const rsiPeriod = document.getElementById('technicalRsiPeriod')?.value || '14';
    const macdFast = document.getElementById('technicalMacdFast')?.value || '12';
    const signalStrength = document.getElementById('technicalSignalStrength')?.value || 'Medium';

    if (window.analyticsCore) {
        window.analyticsCore.technicalSettings = {
            period: period,
            timeframe: timeframe,
            rsi_period: parseInt(rsiPeriod),
            macd_fast: parseInt(macdFast),
            signal_strength: signalStrength
        };
    }

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('technical-indicators');
    }
};


// Return attribution settings toggle
window.toggleReturnAttributionSettings = function () {
    const settingsPanel = document.getElementById('returnAttributionSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
};

// Update return attribution function
window.updateReturnAttribution = function () {
    const period = document.getElementById('returnPeriod')?.value || '1Y';
    const model = document.getElementById('returnModel')?.value || 'brinson';
    const benchmark = document.getElementById('returnBenchmark')?.value || 'SPY';
    const currency = document.getElementById('returnCurrency')?.value || 'USD';
    const frequency = document.getElementById('returnFrequency')?.value || 'daily';

    if (window.analyticsCore) {
        window.analyticsCore.returnAttributionSettings = {
            period: period,
            attribution_model: model,
            benchmark: benchmark,
            currency: currency,
            frequency: frequency
        };
    }

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('return-attribution');
    }
};

// Performance attribution settings toggle
window.togglePerformanceSettings = function () {
    const settingsPanel = document.getElementById('performanceSettings');
    if (settingsPanel) {
        settingsPanel.classList.toggle('hidden');
    }
};

// Update performance attribution function
window.updatePerformanceAttribution = function () {
    const period = document.getElementById('performancePeriod')?.value || '1Y';
    const model = document.getElementById('performanceModel')?.value || 'brinson';
    const benchmark = document.getElementById('performanceBenchmark')?.value || 'SPY';
    const currency = document.getElementById('performanceCurrency')?.value || 'USD';
    const frequency = document.getElementById('performanceFrequency')?.value || 'daily';

    if (window.analyticsCore) {
        window.analyticsCore.performanceAttributionSettings = {
            period: period,
            attribution_model: model,
            benchmark: benchmark,
            currency: currency,
            frequency: frequency
        };
    }

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('performance-attribution');
    }
};

console.log('[STRATEGY BACKTESTING GLOBALS] All global functions loaded');