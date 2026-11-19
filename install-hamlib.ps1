$ErrorActionPreference = 'Stop'
$release = '4.7.2'
$archive = Join-Path $PSScriptRoot 'tools/hamlib-w64-4.7.2.zip'
$destination = Join-Path $PSScriptRoot 'tools/hamlib'
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'tools') | Out-Null
Invoke-WebRequest "https://github.com/Hamlib/Hamlib/releases/download/$release/hamlib-w64-$release.zip" -OutFile $archive
$expected = '8553BC6C5C6032E8DEBF99C017E98F58FED7E07E7C25D04815DC3E8BBE3304C7'
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Hamlib SHA256 mismatch' }
Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
Write-Host 'Hamlib installed. Select Hamlib in the server panel, then refresh models.'
Write-Host (Join-Path $destination 'hamlib-w64-4.7.2/bin/rigctld.exe')
