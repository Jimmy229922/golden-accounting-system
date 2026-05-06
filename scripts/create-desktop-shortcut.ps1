$ErrorActionPreference = "Stop"

$root = Split-Path -Path $PSScriptRoot -Parent
$launcherPath = Join-Path $root "scripts\launch-desktop-full.cmd"
$powershellPath = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "JS App.lnk"
$legacyShortcutPath = Join-Path $desktopPath "Accounting System.lnk"
$legacyDevShortcutPath = Join-Path $desktopPath "Accounting System (Dev).lnk"

if (-not (Test-Path $launcherPath)) {
    throw "Launcher not found at: $launcherPath"
}

$iconInstalled = Join-Path $env:LOCALAPPDATA "Programs\accounting-system\Accounting System.exe"
$iconPrimary = Join-Path $root "frontend-desktop\dist\win-unpacked\Accounting System.exe"
$iconSecondary = Join-Path $root "frontend-desktop\node_modules\electron\dist\electron.exe"
$iconFallback = Join-Path $root "node_modules\electron\dist\electron.exe"
$iconPath = if (Test-Path $iconInstalled) { $iconInstalled } elseif (Test-Path $iconPrimary) { $iconPrimary } elseif (Test-Path $iconSecondary) { $iconSecondary } elseif (Test-Path $iconFallback) { $iconFallback } else { "" }

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"Start-Process -FilePath '$launcherPath' -WindowStyle Hidden`""
$shortcut.WorkingDirectory = $root
$shortcut.Description = "Run Accounting System (auto-updated launcher)"
$shortcut.WindowStyle = 7 # Start minimized

if ($iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}

$shortcut.Save()
if (Test-Path $legacyShortcutPath) {
    Remove-Item -Path $legacyShortcutPath -Force
}
if (Test-Path $legacyDevShortcutPath) {
    Remove-Item -Path $legacyDevShortcutPath -Force
}
Write-Output "Shortcut created: $shortcutPath"
