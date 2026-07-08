$ErrorActionPreference = 'Stop'
$rootPath = Split-Path -Parent $PSScriptRoot
Set-Location -Path $rootPath
node .\scripts\prepare-release.js --with-build
