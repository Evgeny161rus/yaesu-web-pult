param(
    [string]$AppDir = "distdir\Yaesu-Web-Pult",
    [string]$OutDir = "dist",
    [string]$Version = "",
    [switch]$SkipTools
)

$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
if (-not (Test-Path $AppDir)) {
    throw "Не найдена папка приложения: $AppDir. Соберите onedir-версию (distdir\Yaesu-Web-Pult)."
}
$AppDir = (Resolve-Path $AppDir).Path
if (-not $OutDir) { $OutDir = "dist" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path

if (-not $Version) {
    $m = Select-String -Path "server\main.py" -Pattern '^VERSION\s*=\s*"(.+)"'
    $Version = if ($m) { $m.Matches[0].Groups[1].Value } else { "3.2-preview" }
}

if (-not $SkipTools) {
    $hamlib = Join-Path $AppDir "tools\hamlib\hamlib-w64-4.7.2\bin\rigctld.exe"
    if (-not (Test-Path $hamlib)) {
        Write-Host "Hamlib не найден, скачиваю..."
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "install-hamlib.ps1") -Destination $AppDir
        if ($LASTEXITCODE -ne 0) { throw "install-hamlib.ps1 failed" }
    }
    $rtl = Join-Path $AppDir "tools\rtlsdr\rtl_sdr.exe"
    if (-not (Test-Path $rtl)) {
        Write-Host "RTL-SDR не найден, скачиваю..."
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "install-rtlsdr.ps1") -Destination $AppDir
        if ($LASTEXITCODE -ne 0) { throw "install-rtlsdr.ps1 failed" }
    }
}

$isccCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
    (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe")
)
$iscc = $isccCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $iscc) {
    $cmd = Get-Command iscc -ErrorAction SilentlyContinue
    if ($cmd) { $iscc = $cmd.Source }
}
if (-not $iscc) {
    throw "Inno Setup 6 не найден. Установите: winget install JRSoftware.InnoSetup"
}

$script = Join-Path $root "deploy\windows\Yaesu-Web-Pult.iss"
Write-Host "Inno Setup: $iscc"
Write-Host "App: $AppDir"
Write-Host "Version: $Version"
Write-Host "Output: $OutDir"
& $iscc $script "/DAppSource=$AppDir" "/DMyAppVersion=$Version" "/O$OutDir"
if ($LASTEXITCODE -ne 0) { throw "ISCC failed: $LASTEXITCODE" }
$setup = Join-Path $OutDir "Yaesu-Web-Pult-Setup.exe"
if (-not (Test-Path $setup)) { throw "Setup exe not found: $setup" }
$hash = (Get-FileHash $setup -Algorithm SHA256).Hash
Write-Host "OK: $setup"
Write-Host "SHA256: $hash"
