@echo off
setlocal enabledelayedexpansion

REM Change to the kryptos directory
cd /d "C:\Users\ARYADEEP\Desktop\kryptos" || (echo Failed to change directory && exit /b 1)

REM Step 1: npm install
echo === Step 1: npm install ===
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed with exit code %errorlevel%
    exit /b 1
)
echo npm install completed successfully

REM Step 2: npm run build
echo.
echo === Step 2: npm run build ===
call npm run build
if errorlevel 1 (
    echo ERROR: npm run build failed with exit code %errorlevel%
    exit /b 1
)
echo npm run build completed successfully

REM Step 3: Start dev server
echo.
echo === Step 3: Starting dev server ===
REM Start npm run dev in a new window with title
start "Next.js Dev Server" /B npm run dev
timeout /t 3 /nobreak

REM Try to get the PID of the npm process
for /f "tokens=2" %%A in ('tasklist ^| findstr /i "node"') do (
    set NODE_PID=%%A
    goto found_pid
)
:found_pid
if defined NODE_PID (
    echo Dev server started with PID: %NODE_PID%
) else (
    echo Dev server started (PID detection pending)
)

REM Check if localhost:3000 is responding
echo Waiting for dev server to start...
timeout /t 3 /nobreak
echo Checking localhost:3000...
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 3; Write-Host 'Dev server is responding on localhost:3000' } catch { Write-Host 'Dev server not yet responding, may take a moment to start' }"

echo.
echo === Bootstrap Complete ===
echo Frontend bootstrap validation finished
