// Control visibility of analysis sections based on data availability
document.addEventListener('DOMContentLoaded', function() {
    // Initially hide portfolio analysis until data is loaded
    const portfolioAnalysis = document.getElementById('portfolioAnalysis');
    if (portfolioAnalysis && !window.portfolioData && !window.currentPortfolioData) {
        portfolioAnalysis.style.display = 'none';
    }
    
    // Also ensure enhanced analytics sections are visible when they have content
    const enhancedSections = [
        'correlation-analysis',
        'sector-analysis', 
        'statistical-analysis',
        'technical-indicators',
        'strategy-backtesting',
        'monte-carlo-simulation',
        'portfolio-optimization'
    ];
    
    enhancedSections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            // Make sure the section and its parent container are visible
            section.style.display = 'block';
            section.classList.remove('hidden');
            const parent = section.closest('.bg-white');
            if (parent) {
                parent.style.display = 'block';
                parent.classList.remove('hidden');
            }
        }
    });
    
    // Show portfolio analysis when data is loaded
    document.addEventListener('portfolioLoaded', function(event) {
        if (portfolioAnalysis) {
            portfolioAnalysis.style.display = 'block';
            portfolioAnalysis.classList.remove('hidden');
        }
        
        // Also show enhanced analytics sections
        enhancedSections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'block';
                section.classList.remove('hidden');
                const parent = section.closest('.bg-white');
                if (parent) {
                    parent.style.display = 'block';
                    parent.classList.remove('hidden');
                }
            }
        });
    });
    
    // Also listen for enhanced analytics updates
    document.addEventListener('enhancedAnalyticsUpdate', function(event) {
        console.log('Enhanced analytics update - showing sections');
        enhancedSections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'block';
                section.classList.remove('hidden');
                const parent = section.closest('.bg-white');
                if (parent) {
                    parent.style.display = 'block';
                    parent.classList.remove('hidden');
                }
            }
        });
    });
    
    // Hide when no data
    window.hidePortfolioAnalysis = function() {
        if (portfolioAnalysis) {
            portfolioAnalysis.style.display = 'none';
        }
    };
    
    // Show when data available
    window.showPortfolioAnalysis = function() {
        if (portfolioAnalysis) {
            portfolioAnalysis.style.display = 'block';
            portfolioAnalysis.classList.remove('hidden');
        }
        
        // Also show enhanced analytics sections
        enhancedSections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'block';
                section.classList.remove('hidden');
                const parent = section.closest('.bg-white');
                if (parent) {
                    parent.style.display = 'block';
                    parent.classList.remove('hidden');
                }
            }
        });
    };
});