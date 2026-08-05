@echo off
title Neptune Water Intelligence Platform
echo.
echo  ======================================================
echo   Neptune Water Intelligence Platform
echo   Blue Circle Water Solutions
echo  ======================================================
echo.
:: Move to the folder containing this batch file
cd /d "%~dp0"
:: Suppress Streamlit onboarding / usage-stats prompt
set "STREAMLIT_BROWSER_GATHER_USAGE_STATS=false"
set "STREAMLIT_EMAIL="
:: Streamlit executable (C:\Python\Python313 install)
set "STREAMLIT=C:\Python\Python313\Scripts\streamlit.exe"
if not exist "%STREAMLIT%" (
    echo ERROR: streamlit.exe not found.
    echo Run this command to install:
    echo   C:\Python\Python313\python.exe -m pip install streamlit plotly pandas numpy openpyxl xlsxwriter
    echo Then re-launch this file.
    pause
    exit /b 1
)
echo  Starting server on http://localhost:8502 ...
echo  Keep this window open while using the app.
echo  Press Ctrl+C to stop.
echo.
:: Open browser after 5-second delay (background)
start /b cmd /c "ping 127.0.0.1 -n 6 >nul && start http://localhost:8502"
:: Launch streamlit (blocks until Ctrl+C)
"%STREAMLIT%" run Home.py --server.port 8502 --browser.gatherUsageStats false
pause
