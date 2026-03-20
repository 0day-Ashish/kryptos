@echo off
cd /d "C:\Users\ARYADEEP\Desktop\kryptos"
echo === Step 1: npm install ===
call npm install
if errorlevel 1 (
    echo npm install failed
    exit /b 1
)
echo.
echo === Step 2: npm run build ===
call npm run build
if errorlevel 1 (
    echo npm run build failed
    exit /b 1
)
echo.
echo === Step 3: Starting dev server ===
start "Next.js Dev Server" npm run dev
echo Dev server started in background
timeout /t 5 /nobreak
echo Checking localhost:3000...
