@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title Accounting System - Launcher

:: ─────────────────────────────────────────────
::  Accounting System - Unified Launcher
::  Double-click this file to start the app
:: ─────────────────────────────────────────────

set "ROOT_DIR=%~dp0.."
cd /d "%ROOT_DIR%"

set "ELECTRON_RUN_AS_NODE="
set "APP_DIR=%ROOT_DIR%\frontend-desktop"
set "ELECTRON_EXE=%APP_DIR%\node_modules\electron\dist\electron.exe"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "BACKEND_HEALTH_URL=http://localhost:4000/api/health"
set "LOG_FILE=%ROOT_DIR%\scripts\launcher.log"
set "HIDDEN_STARTER=%ROOT_DIR%\scripts\start-backend-hidden.vbs"

:: Clear old log
echo [%date% %time%] Launcher started > "%LOG_FILE%"

:: ── Check project structure ──
if not exist "%APP_DIR%\package.json" (
  call :fail "frontend-desktop project not found at: %APP_DIR%"
  exit /b 1
)

if not exist "%BACKEND_DIR%\package.json" (
  call :fail "backend project not found at: %BACKEND_DIR%"
  exit /b 1
)

:: ── Install dependencies if needed ──
if not exist "%ELECTRON_EXE%" (
  echo [Launcher] Electron not found. Installing frontend dependencies...
  echo [Launcher] This may take a few minutes on first run...
  call :log "Installing frontend-desktop dependencies"
  call npm --prefix "%APP_DIR%" install
  if errorlevel 1 (
    call :fail "Failed to install frontend-desktop dependencies."
    exit /b 1
  )
)

if not exist "%ELECTRON_EXE%" (
  call :fail "Electron executable not found after install: %ELECTRON_EXE%"
  exit /b 1
)

:: ── Start Backend (non-blocking) ──
call :start_backend_if_needed
call :log "Backend launch initiated"

:: ── Launch Electron App (immediately, don't wait for backend) ──
echo [Launcher] Starting Accounting System...
call :log "Starting Electron app"

"%ELECTRON_EXE%" "%APP_DIR%"
set "APP_EXIT=%ERRORLEVEL%"

if "%APP_EXIT%"=="0" (
  call :log "App exited normally"
  exit /b 0
)

:: ── First launch failed - try rebuild ──
echo.
echo [Launcher] App startup failed (exit code: %APP_EXIT%).
echo [Launcher] Attempting to rebuild native modules...
call :log "App failed with code %APP_EXIT%, rebuilding"

call npm --prefix "%APP_DIR%" run rebuild
if errorlevel 1 (
  call :fail "Failed to rebuild native modules."
  exit /b 1
)

echo [Launcher] Rebuild done. Retrying...
"%ELECTRON_EXE%" "%APP_DIR%"
set "APP_EXIT2=%ERRORLEVEL%"

if "%APP_EXIT2%"=="0" (
  call :log "App started successfully after rebuild"
  exit /b 0
)

call :fail "App still failing after rebuild (exit code: %APP_EXIT2%)."
exit /b 1

:: ═══════════════════════════════════════════
::  Subroutines
:: ═══════════════════════════════════════════

:start_backend_if_needed
:: Quick check if backend is already running (skip if yes)
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri '%BACKEND_HEALTH_URL%' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { exit 0 } else { exit 1 } } catch { exit 1 }"
if "%ERRORLEVEL%"=="0" (
  echo [Launcher] Backend already running.
  exit /b 0
)

if not exist "%BACKEND_DIR%\node_modules\better-sqlite3" (
  echo [Launcher] Installing backend dependencies...
  call :log "Installing backend dependencies"
  call npm --prefix "%BACKEND_DIR%" install
  if errorlevel 1 (
    echo [Launcher] Backend install failed. Continuing without backend.
    call :log "Backend install failed"
    exit /b 0
  )
)

:: Start backend hidden - don't wait for health, Electron will connect when ready
echo [Launcher] Starting backend server...
call :log "Starting backend server"
wscript "%HIDDEN_STARTER%" "%BACKEND_DIR%" "%LOG_FILE%"
exit /b 0

:log
echo [%date% %time%] %~1 >> "%LOG_FILE%"
exit /b 0

:fail
echo.
echo ══════════════════════════════════════════
echo   ERROR: %~1
echo ══════════════════════════════════════════
echo.
echo   Check the log file for details:
echo   %LOG_FILE%
echo.
call :log "FAIL: %~1"
pause
exit /b 0
