// Navigation Manager - Handles proper section visibility and navigation
class NavigationManager {
    constructor() {
        this.currentView = 'default';
        this.allSections = [
            'defaultUploadSection',
            'portfolioAnalysis',
            'transactionAnalysis',
            'analysisContainer',
            'analysisContent',
            'dataPreview',
            'loadingSection',
            'optionScraperSection'
        ];
        this.init();
    }

    init() {
        // Ensure showDefaultUpload is available globally
        window.showDefaultUpload = () => this.showDefaultUpload();

        // Add event listeners for navigation
        this.addNavigationListeners();

        // Initialize with default view
        this.showDefaultUpload();
    }

    addNavigationListeners() {
        // Header logo click
        // Header logo listener removed - Logic swapped with Home link and handled via inline onclick in index.html
        /*
        const headerLogo = document.querySelector('.cursor-pointer');
        if (headerLogo) {
            headerLogo.addEventListener('click', (e) => {
                e.preventDefault();
                this.showDefaultUpload();
            });
        }
        */

        // Back button clicks in analysis views
        document.addEventListener('click', (e) => {
            if (e.target.closest('[onclick*="showDefaultUpload"]')) {
                e.preventDefault();
                this.showDefaultUpload();
            }
        });
    }

    showDefaultUpload() {
        console.log('NavigationManager: Showing default upload');

        // Hide all analysis sections
        this.hideAllSections();

        // Show default upload section
        const defaultSection = document.getElementById('defaultUploadSection');
        if (defaultSection) {
            defaultSection.classList.remove('hidden');
            defaultSection.style.display = '';
        }

        // Clear any loading spinners
        this.clearAllLoadingSpinners();

        // Update current view
        this.currentView = 'default';

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        console.log('NavigationManager: Default upload view activated');
    }

    hideAllSections() {
        this.allSections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.add('hidden');
                section.style.display = 'none';
            }
        });
    }

    clearAllLoadingSpinners() {
        // Clear loading spinners from all containers
        const loadingContainers = [
            'riskResults', 'optionsResults', 'performanceAttribution', 'monteCarloResults',
            'optimizationChart', 'correlationMatrix', 'sectorAllocation', 'statisticalAnalysis',
            'technicalAnalysis', 'strategyBacktesting', 'pnlAttribution', 'tradePerformance',
            'costAnalysis', 'turnoverAnalysis', 'taxAnalysis', 'cashFlowAnalysis',
            'fifoLifoAnalysis', 'tradeTimingAnalysis', 'drawdownAnalysis', 'returnAttribution'
        ];

        loadingContainers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                // Remove loading spinners but keep existing content
                const loadingElements = container.querySelectorAll('.animate-spin, .loading-spinner');
                loadingElements.forEach(el => el.remove());

                // Remove loading text
                if (container.textContent && container.textContent.includes('Loading')) {
                    container.innerHTML = '';
                }
            }
        });

        // Also clear main loading section
        const loadingSection = document.getElementById('loadingSection');
        if (loadingSection) {
            loadingSection.classList.add('hidden');
        }
    }

    showAnalysisView(analysisType) {
        this.hideAllSections();

        const analysisContainer = document.getElementById('analysisContainer');
        if (analysisContainer) {
            analysisContainer.classList.remove('hidden');
        }

        this.currentView = analysisType;
    }

    getCurrentView() {
        return this.currentView;
    }

    // Utility method to ensure proper section visibility
    ensureProperVisibility() {
        // Force hide all sections that should be hidden
        this.allSections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section && section.classList.contains('hidden')) {
                section.style.display = 'none';
            }
        });
    }
}

// Create global instance
window.navigationManager = new NavigationManager();

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    if (!window.navigationManager) {
        window.navigationManager = new NavigationManager();
    }
});

// Export for modules
window.NavigationManager = NavigationManager;