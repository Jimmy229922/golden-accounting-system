$ErrorActionPreference = 'Stop'
Set-Location -Path "d:\JS\accounting-system\frontend-desktop"

Write-Host "Building Application..."
npm run build

if ($?) {
    Write-Host "Build finished. Creating APP_JS folder..."
    $distPath = Join-Path (Get-Location) "dist"
    
    # Ensure clean directory
    if (Test-Path "$distPath\APP_JS") {
        Remove-Item -Recurse -Force "$distPath\APP_JS"
    }
    if (Test-Path "$distPath\APP_JS.zip") {
        Remove-Item -Force "$distPath\APP_JS.zip"
    }

    New-Item -ItemType Directory -Force -Path "$distPath\APP_JS" | Out-Null
    
    Write-Host "Copying Setup executable..."
    # Copy only the latest installer executable.
    $latestSetup = Get-ChildItem -Path $distPath -Filter "*.exe" -File |
        Where-Object { $_.Name -like "*Setup*.exe" } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $latestSetup) {
        throw "No setup executable found in dist folder."
    }

    Copy-Item -Path $latestSetup.FullName -Destination "$distPath\APP_JS\" -Force
    Write-Host "Included installer: $($latestSetup.Name)"

    Write-Host "Compressing to APP_JS.zip..."
    Compress-Archive -Path "$distPath\APP_JS" -DestinationPath "$distPath\APP_JS.zip" -Force
    
    Write-Host "`n✅ Build Packaged Successfully! You can find it at: frontend-desktop\dist\APP_JS.zip"
} else {
    Write-Host "`n❌ Build Failed!"
}
