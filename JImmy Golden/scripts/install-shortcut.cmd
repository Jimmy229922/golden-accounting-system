@echo off
chcp 65001 >nul 2>&1
title Create Desktop Shortcut - Accounting System
echo.
echo  ══════════════════════════════════════════
echo   Accounting System - Create Desktop Shortcut
echo  ══════════════════════════════════════════
echo.

set "ROOT_DIR=%~dp0.."
set "SCRIPTS_DIR=%~dp0"
set "VBS_LAUNCHER=%SCRIPTS_DIR%launch-app.vbs"

:: Verify launcher exists
if not exist "%VBS_LAUNCHER%" (
  echo  [ERROR] launch-app.vbs not found in scripts folder!
  echo  Path: %VBS_LAUNCHER%
  pause
  exit /b 1
)

:: Find an icon to use
set "ICON_PATH="
if exist "%LOCALAPPDATA%\Programs\accounting-system\Accounting System.exe" (
  set "ICON_PATH=%LOCALAPPDATA%\Programs\accounting-system\Accounting System.exe"
) else if exist "%ROOT_DIR%\frontend-desktop\dist\win-unpacked\Accounting System.exe" (
  set "ICON_PATH=%ROOT_DIR%\frontend-desktop\dist\win-unpacked\Accounting System.exe"
) else if exist "%ROOT_DIR%\frontend-desktop\node_modules\electron\dist\electron.exe" (
  set "ICON_PATH=%ROOT_DIR%\frontend-desktop\node_modules\electron\dist\electron.exe"
)

:: Use PowerShell inline to create the shortcut (avoids execution policy issues)
echo  Creating shortcut on Desktop...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktopPath = [Environment]::GetFolderPath('Desktop');" ^
  "$shortcutPath = Join-Path $desktopPath 'Accounting System.lnk';" ^
  "$wshShell = New-Object -ComObject WScript.Shell;" ^
  "$shortcut = $wshShell.CreateShortcut($shortcutPath);" ^
  "$shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe';" ^
  "$shortcut.Arguments = '\"' + '%VBS_LAUNCHER%' + '\"';" ^
  "$shortcut.WorkingDirectory = '%ROOT_DIR%';" ^
  "$shortcut.Description = 'Accounting System';" ^
  "$iconPath = '%ICON_PATH%';" ^
  "if ($iconPath -and (Test-Path $iconPath)) { $shortcut.IconLocation = \"$iconPath,0\" };" ^
  "$shortcut.Save();" ^
  "Write-Host '  Done! Shortcut created at:' $shortcutPath;"

if errorlevel 1 (
  echo.
  echo  [ERROR] Failed to create shortcut.
  pause
  exit /b 1
)

:: Remove old legacy shortcuts
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop');" ^
  "$old = Join-Path $desktop 'Accounting System (Dev).lnk';" ^
  "if (Test-Path $old) { Remove-Item $old -Force; Write-Host '  Removed old shortcut: Accounting System (Dev)' }"

echo.
echo  ══════════════════════════════════════════
echo   Shortcut created successfully!
echo   You can now close this window and
echo   double-click the shortcut on your Desktop.
echo  ══════════════════════════════════════════
echo.
pause
