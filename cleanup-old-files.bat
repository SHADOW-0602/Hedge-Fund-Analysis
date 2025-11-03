@echo off
echo Cleaning up old complex JavaScript files...

REM Remove old complex integration files
if exist "web\js\analytics-integration.js" del "web\js\analytics-integration.js"
if exist "web\js\analytics-loader.js" del "web\js\analytics-loader.js"
if exist "web\js\sidebar-integration.js" del "web\js\sidebar-integration.js"
if exist "web\js\dependency-checker.js" del "web\js\dependency-checker.js"
if exist "web\js\fix-api-references.js" del "web\js\fix-api-references.js"
if exist "web\js\missing-functions.js" del "web\js\missing-functions.js"
if exist "web\js\visibility-control.js" del "web\js\visibility-control.js"
if exist "web\force-refresh.js" del "web\force-refresh.js"

REM Remove old complex analytics files
if exist "web\js\portfolio\risk-metrics.js" del "web\js\portfolio\risk-metrics.js"
if exist "web\js\portfolio\monte-carlo.js" del "web\js\portfolio\monte-carlo.js"
if exist "web\js\transaction\return-attribution.js" del "web\js\transaction\return-attribution.js"
if exist "web\js\transaction\trade-timing-analysis.js" del "web\js\transaction\trade-timing-analysis.js"

REM Remove old CSS
if exist "web\css\analytics-styles.css" del "web\css\analytics-styles.css"

echo Cleanup complete! Old complex files removed.
echo The system now uses simplified, unified analytics modules.
pause