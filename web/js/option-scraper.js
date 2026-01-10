
// Option OHLC Scraper Frontend Logic

async function runOptionScraper() {
    const symbolsInput = document.getElementById('scraperSymbols').value;
    const expirationsInput = document.getElementById('scraperExpirations').value;
    const strikesInput = document.getElementById('scraperStrikes').value;

    // UI Elements
    const statusDiv = document.getElementById('scraperStatus');
    const runBtn = document.querySelector('button[onclick="runOptionScraper()"]');
    const resultsDiv = document.getElementById('scraperResults');
    const resultText = document.getElementById('scraperResultText');
    const downloadLink = document.getElementById('scraperDownloadLink');

    // Reset UI
    resultsDiv.classList.add('hidden');
    statusDiv.classList.add('hidden');

    // Validation
    if (!symbolsInput || !expirationsInput || !strikesInput) {
        alert('Please fill in all fields (Symbols, Expirations, Strikes)');
        return;
    }

    // Parse Inputs
    const symbols = symbolsInput.split(/[,\n]+/).map(s => s.trim()).filter(s => s);
    const expirations = expirationsInput.split(/[,\n]+/).map(s => s.trim()).filter(s => s);
    const strikes = strikesInput.split(/[,\n]+/).map(s => s.trim()).filter(s => s); // Keep as strings initially for validation

    if (symbols.length === 0 || expirations.length === 0 || strikes.length === 0) {
        alert('Please provide valid comma-separated lists.');
        return;
    }

    // Set Loading State
    statusDiv.classList.remove('hidden');
    runBtn.disabled = true;
    runBtn.classList.add('opacity-50', 'cursor-not-allowed');
    runBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Processing...
    `;

    try {
        const payload = {
            symbols: symbols,
            expirations: expirations,
            strikes: strikes
        };

        const response = await fetch('/api/options/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Scraping failed');
        }

        // Success
        statusDiv.classList.add('hidden');
        resultsDiv.classList.remove('hidden');

        resultText.textContent = `Generated ${data.count} records.`;

        if (data.is_r2) {
            // R2 Download logic (if public or signed url is implemented later)
            // For now, if it returns an R2 path, we might show a message or just link to it if we had a cloudflare worker.
            // But our current implementation returns just the path "r2://...".
            // Let's assume for now we cannot direct download R2 without a worker, 
            // BUT option_ohlc_scraper.py ALSO returns local path if R2 fails? 
            // Wait, implementation returns ONE path.

            // If it is R2, we need a way to view it. 
            // Since we don't have a presigned URL generator yet, let's just display the path.
            downloadLink.href = "#";
            downloadLink.onclick = (e) => {
                e.preventDefault();
                alert(`File uploaded to Cloudflare R2: ${data.output_path}\n(Direct download not yet configured for R2 paths)`);
            };
            downloadLink.innerHTML = `
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Uploaded to Cloudflare
            `;
        } else {
            // Local Download
            downloadLink.onclick = null;
            // The API returns an absolute path, we need to proxy it or move it to static.
            // Actually, the api/options/download endpoint handles the absolute path.
            const encodedPath = encodeURIComponent(data.output_path);
            downloadLink.href = `/api/options/download?path=${encodedPath}`;
            downloadLink.innerHTML = `
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Download CSV
            `;
        }

    } catch (error) {
        alert(`Error: ${error.message}`);
        statusDiv.classList.add('hidden');
    } finally {
        // Reset Button
        runBtn.disabled = false;
        runBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        runBtn.innerHTML = `
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Run Scraper
        `;
    }
}

// Navigation Handler
function initializeOptionScraperNav() {
    const navButtons = document.querySelectorAll('[data-analysis="option-scraper"]');
    const scraperSection = document.getElementById('optionScraperSection');

    const symbolsDataset = document.getElementById('scraperSymbols');
    if (symbolsDataset) {
        symbolsDataset.addEventListener('input', function () {
            this.value = this.value.toUpperCase();
        });
    }

    if (!scraperSection) return;

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();

            // Hide all other sections
            document.querySelectorAll('.analysis-card, [id$="Analysis"], [id$="Settings"]').forEach(el => {
                if (el.id !== 'optionScraperSection') {
                    el.classList.add('hidden');
                    el.style.display = 'none'; // Ensure inline styles are overridden
                }
            });

            // Show Scraper Section
            scraperSection.classList.remove('hidden');
            scraperSection.style.display = 'block';

            // Update Active State
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('bg-gray-50', 'dark:bg-gray-700/50', 'text-indigo-600', 'dark:text-indigo-400'));
            btn.classList.add('bg-gray-50', 'dark:bg-gray-700/50', 'text-indigo-600', 'dark:text-indigo-400');

            // Close mobile menu if open
            if (window.innerWidth < 768) {
                // Assuming there's a closeSidebar function or similar, trying generic approach
                const sidebar = document.getElementById('sidebar');
                if (sidebar && !sidebar.classList.contains('hidden')) {
                    // sidebar.classList.add('hidden'); // Leave sidebar logic to main script
                }
            }
        });
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initializeOptionScraperNav);
