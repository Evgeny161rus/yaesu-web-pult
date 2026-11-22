param(
    [string]$Destination = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
$release = 'v0.9.0'
$url = "https://github.com/librtlsdr/librtlsdr/releases/download/$release/rtlsdr-bin-w64_dlldep.zip"
$tools = Join-Path $Destination 'tools'
$archive = Join-Path $tools 'rtlsdr-w64.zip'
$target = Join-Path $tools 'rtlsdr'

New-Item -ItemType Directory -Force -Path $tools | Out-Null
Write-Host "Downloading RTL-SDR from $url ..."
Invoke-WebRequest $url -OutFile $archive

$expected = '019618B69DCBD4E1153035743BE62F8C9F472DF64B0B832731DBDAF073221BE8'
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) {
    throw 'RTL-SDR SHA256 mismatch'
}

if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Expand-Archive -LiteralPath $archive -DestinationPath $target -Force
Remove-Item $archive -Force

$exe = Join-Path $target 'rtl_sdr.exe'
if (-not (Test-Path $exe)) { throw 'rtl_sdr.exe not found in archive' }

Write-Host 'RTL-SDR installed.'
Write-Host $exe
Write-Host 'Now select waterfall_source=rtlsdr (or sdr) in the panel.'
