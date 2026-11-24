$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$log = Join-Path $root 'install.log'
function Write-Log([string]$text) {
    $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $text
    Write-Host $line
    Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}
Set-Content -LiteralPath $log -Value "Yaesu Web Pult driver installation" -Encoding UTF8
$pnputil = Join-Path $env:SystemRoot 'System32\pnputil.exe'
if (-not (Test-Path $pnputil)) {
    Write-Log 'pnputil.exe not found; drivers were not installed.'
    exit 0
}
$drivers = @(
    @{ Name = 'FTDI bus (FT4222/FTDI)'; Inf = Join-Path $root 'ftdi\ftdibus.inf' },
    @{ Name = 'FTDI serial port';       Inf = Join-Path $root 'ftdi\ftdiport.inf' },
    @{ Name = 'Silicon Labs CP210x';    Inf = Join-Path $root 'cp210x\silabser.inf' }
)
$failed = 0
foreach ($driver in $drivers) {
    if (-not (Test-Path $driver.Inf)) {
        Write-Log ("MISSING {0}: {1}" -f $driver.Name, $driver.Inf)
        $failed++
        continue
    }
    Write-Log ("Installing {0} from {1}" -f $driver.Name, $driver.Inf)
    $output = & $pnputil /add-driver $driver.Inf /install 2>&1
    $code = $LASTEXITCODE
    foreach ($line in $output) { Write-Log ([string]$line) }
    Write-Log ("{0}: exit code {1}" -f $driver.Name, $code)
    # 0 = added, 3010 = reboot required, 259 = already present on some builds
    if ($code -notin 0, 259, 3010) { $failed++ }
}
Write-Log 'Scanning for hardware changes.'
& $pnputil /scan-devices 2>&1 | ForEach-Object { Write-Log ([string]$_) }
if ($failed) {
    Write-Log ("Completed with {0} problem(s). See the log above." -f $failed)
} else {
    Write-Log 'All drivers are installed or already present.'
}
# Do not fail the installer: drivers may already be installed by Windows Update.
exit 0
