# Run only on a disposable GitHub Windows runner, never on the user's PC.
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or -not $env:RUNNER_TEMP) {
    throw 'This installation smoke test is restricted to GitHub Actions.'
}
$installDir = Join-Path $env:ProgramFiles 'Yaesu Web Pult CI Test'
if (Test-Path -LiteralPath $installDir) { throw 'Test directory already exists' }
New-Item -ItemType Directory -Path (Join-Path $installDir 'records') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $installDir 'config.json') -Value '{"cat_port":"COM99","password":"migration-test"}' -Encoding utf8
Set-Content -LiteralPath (Join-Path $installDir 'records\legacy.wav') -Value 'legacy-recording'
# Reproduce the permissions granted by the old installer.
& icacls.exe $installDir /grant '*S-1-5-32-545:(OI)(CI)M' /T /Q
if ($LASTEXITCODE -ne 0) { throw 'Could not set up legacy permissions' }
$setup = (Resolve-Path 'dist\Yaesu-Web-Pult-Setup.exe').Path
$p = Start-Process -FilePath $setup -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /TASKS=`"`" /DIR=`"$installDir`"" -WindowStyle Hidden -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "Installer failed: $($p.ExitCode)" }
$exe = Join-Path $installDir 'Yaesu-Web-Pult.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Installed EXE missing' }
if (-not (Test-Path -LiteralPath (Join-Path $installDir 'installed-mode.txt'))) { throw 'Installed-mode marker missing' }
if (Test-Path -LiteralPath (Join-Path $installDir 'drivers\install.log')) { throw 'Driver installation must not run in this test' }
$users = 'S-1-5-32-545'
$writeMask = [System.Security.AccessControl.FileSystemRights]::Write -bor [System.Security.AccessControl.FileSystemRights]::Delete
foreach ($path in @($installDir, $exe, (Join-Path $installDir 'drivers\install-drivers.ps1'))) {
    foreach ($rule in (Get-Acl -LiteralPath $path).GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
        if ($rule.IdentityReference.Value -eq $users -and
            $rule.AccessControlType -eq 'Allow' -and ($rule.FileSystemRights -band $writeMask)) {
            throw "Users can still modify $path"
        }
    }
}
# Isolate the per-user directory from the runner's other jobs.
$savedLocal = $env:LOCALAPPDATA
try {
    $env:LOCALAPPDATA = Join-Path $env:RUNNER_TEMP 'yaesu-user-data'
    $report = Join-Path $env:RUNNER_TEMP 'installed-selftest.txt'
    $p = Start-Process -FilePath $exe -ArgumentList "--selftest `"$report`"" -WindowStyle Hidden -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "Installed selftest failed: $($p.ExitCode)" }
    $text = Get-Content -LiteralPath $report -Raw
    $text | Write-Host
    $data = Join-Path $env:LOCALAPPDATA 'Yaesu Web Pult'
    if (-not $text.Contains("DATA_DIR $data")) { throw 'Installed app used the wrong data directory' }
    if ((Get-Content -LiteralPath (Join-Path $data 'config.json') -Raw | ConvertFrom-Json).cat_port -ne 'COM99') {
        throw 'Legacy config was not migrated'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $data 'records\legacy.wav'))) { throw 'Recording was not migrated' }
    if (-not (Test-Path -LiteralPath (Join-Path $installDir 'records\legacy.wav'))) { throw 'Legacy recording was removed' }
    foreach ($tool in @('tools\hamlib\hamlib-w64-4.7.2\bin\rigctld.exe', 'tools\rtlsdr\rtl_sdr.exe')) {
        if (-not (Test-Path -LiteralPath (Join-Path $installDir $tool))) { throw "Bundled tool missing: $tool" }
    }
} finally {
    $env:LOCALAPPDATA = $savedLocal
}
# The driver installer writes its log after setup; uninstall must remove it.
$driverLog = Join-Path $installDir 'drivers\install.log'
Set-Content -LiteralPath $driverLog -Value 'uninstall-test' -Encoding utf8
$uninst = Join-Path $installDir 'unins000.exe'
if (-not (Test-Path -LiteralPath $uninst)) { throw 'Uninstaller missing' }
$p = Start-Process -FilePath $uninst -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART' -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "Uninstaller failed: $($p.ExitCode)" }
Start-Sleep -Seconds 2
if (Test-Path -LiteralPath $driverLog) { throw 'Driver log was not removed on uninstall' }
if (Test-Path -LiteralPath (Join-Path $installDir 'drivers')) { throw 'Empty drivers folder left after uninstall' }
# Legacy config/records stay by design; remove the disposable test tree.
Remove-Item -LiteralPath $installDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'Installer permissions, data migration, installed selftest and uninstall: OK'
