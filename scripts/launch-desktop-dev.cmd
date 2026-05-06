@echo off
setlocal EnableDelayedExpansion

set "ROOT_DIR=%~dp0.."
cd /d "%ROOT_DIR%"

set "ELECTRON_RUN_AS_NODE="
set "APP_DIR=%ROOT_DIR%\frontend-desktop"
set "ELECTRON_EXE=%APP_DIR%\node_modules\electron\dist\electron.exe"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "BACKEND_HEALTH_URL=http://localhost:4000/api/health"
set "BACKEND_WAIT_SECONDS=10"
set "BACKEND_LOG=%BACKEND_DIR%\\backend.log"

if not exist "%APP_DIR%\package.json" (
  echo [Launcher] frontend-desktop project not found.
  pause
  exit /b 1
)

if not exist "%BACKEND_DIR%\package.json" (
  echo [Launcher] backend project not found.
  pause
  exit /b 1
)

if not exist "%ELECTRON_EXE%" (
  echo [Launcher] Installing frontend-desktop dependencies...
  call npm --prefix "%APP_DIR%" install
  if errorlevel 1 (
    echo [Launcher] Frontend install failed.
    pause
    exit /b 1
  )
)

call :ensure_backend_running

if not exist "%ELECTRON_EXE%" (
  echo [Launcher] Electron executable is still missing after install.
  pause
  exit /b 1
)

"%ELECTRON_EXE%" "%APP_DIR%"
set "APP_EXIT_CODE=%ERRORLEVEL%"

if "%APP_EXIT_CODE%"=="0" (
  exit /b 0
)

echo.
echo [Launcher] App startup failed (exit code: %APP_EXIT_CODE%).
echo [Launcher] Rebuilding better-sqlite3 for Electron...

call npm --prefix "%APP_DIR%" run rebuild

if errorlevel 1 (
  echo [Launcher] Rebuild failed.
  pause
  exit /b 1
)

echo [Launcher] Rebuild completed. Starting app again...
"%ELECTRON_EXE%" "%APP_DIR%"
exit /b %ERRORLEVEL%

:ensure_backend_running
if not exist "%BACKEND_DIR%\package.json" (
  echo [Launcher] Backend project not found. Skipping backend startup.
  exit /b 0
)

call :check_backend_health
if "%ERRORLEVEL%"=="0" (
  echo [Launcher] Backend is already running.
  exit /b 0
)

if not exist "%BACKEND_DIR%\node_modules\better-sqlite3" (
  echo [Launcher] Installing backend dependencies...
  call npm --prefix "%BACKEND_DIR%" install
  if errorlevel 1 (
    echo [Launcher] Backend install failed. Continuing without backend.
    exit /b 0
  )
)

echo [Launcher] Starting backend server...
call :start_backend

call :wait_backend_health
if "%ERRORLEVEL%"=="0" (
  echo [Launcher] Backend started successfully.
  exit /b 0
)

echo [Launcher] Backend health check failed. Rebuilding sqlite module for Node...
call npm --prefix "%BACKEND_DIR%" rebuild better-sqlite3
if errorlevel 1 (
  echo [Launcher] Backend sqlite rebuild failed. Continuing without backend.
  exit /b 0
)

call :start_backend
call :wait_backend_health
if "%ERRORLEVEL%"=="0" (
  echo [Launcher] Backend started successfully after rebuild.
) else (
  echo [Launcher] Backend is still not reachable. Continuing to launch app.
  if exist "%BACKEND_LOG%" (
    echo [Launcher] Backend log (last 30 lines):
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path '%BACKEND_LOG%' -Tail 30"
  )
)
exit /b 0

:start_backend
if exist "%BACKEND_LOG%" del /f /q "%BACKEND_LOG%"
start "Accounting Backend" /min cmd /c "cd /d \"%BACKEND_DIR%\" && node src\server.js >> \"%BACKEND_LOG%\" 2>&1"
timeout /t 2 >nul
exit /b 0

:check_backend_health
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri '%BACKEND_HEALTH_URL%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { exit 0 } else { exit 1 } } catch { exit 1 }"
exit /b %ERRORLEVEL%

:wait_backend_health
for /l %%I in (1,1,%BACKEND_WAIT_SECONDS%) do (
  call :check_backend_health
  if "!ERRORLEVEL!"=="0" exit /b 0
  echo [Launcher] Waiting for backend... (%%I/%BACKEND_WAIT_SECONDS%)
  timeout /t 1 >nul
)
exit /b 1
