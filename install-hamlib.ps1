param(
    [string]$Destination = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
$release = '4.7.2'
$tools = Join-Path $Destination 'tools'
$archive = Join-Path $tools 'hamlib-w64-4.7.2.zip'
$target = Join-Path $tools 'hamlib'
New-Item -ItemType Directory -Force -Path $tools | Out-Null
Write-Host "Downloading Hamlib $release ..."
Invoke-WebRequest "https://github.com/Hamlib/Hamlib/releases/download/$release/hamlib-w64-$release.zip" -OutFile $archive
$expected = '8553BC6C5C6032E8DEBF99C017E98F58FED7E07E7C25D04815DC3E8BBE3304C7'
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Hamlib SHA256 mismatch' }
Expand-Archive -LiteralPath $archive -DestinationPath $target -Force
Remove-Item $archive -Force
Write-Host 'Hamlib installed. Select Hamlib in the server panel, then refresh models.'
Write-Host (Join-Path $target 'hamlib-w64-4.7.2/bin/rigctld.exe')
