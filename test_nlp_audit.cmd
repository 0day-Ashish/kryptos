@echo off
REM Test NLP Audit Analyzer Installation & Functionality

echo ================================================
echo Installing Google GenAI package...
echo ================================================
cd /d "%~dp0backend"
python -m pip install google-genai --quiet
if errorlevel 1 (
    echo ERROR: Failed to install google-genai package
    pause
    exit /b 1
)

echo.
echo ================================================
echo Running NLP Audit Analyzer Test...
echo ================================================
python test_audit_nlp.py

echo.
echo ================================================
echo Test Complete
echo ================================================
pause
