param(
    [switch]$InstallMissing
)

$ErrorActionPreference = 'Stop'
$PythonPackage = 'Python.Python.3.13'
$PythonVersion = '3.13.14'
$BootstrapPython = Join-Path $PSScriptRoot 'bootstrap.py'

function Add-Candidate([System.Collections.Generic.List[string]]$Candidates, [string]$Value) {
    if ($Value -and (Test-Path -LiteralPath $Value -PathType Leaf) -and -not $Candidates.Contains($Value)) {
        $Candidates.Add($Value)
    }
}

function Find-UsablePython {
    $candidates = [System.Collections.Generic.List[string]]::new()
    foreach ($directory in @($env:Path -split ';')) {
        $expanded = [Environment]::ExpandEnvironmentVariables($directory.Trim().Trim('"'))
        if (-not $expanded) { continue }
        foreach ($name in @('python3.exe', 'python.exe')) {
            Add-Candidate $candidates (Join-Path $expanded $name)
        }
    }
    Add-Candidate $candidates (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe')
    foreach ($pattern in @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python*\python.exe'),
        (Join-Path $env:ProgramFiles 'Python*\python.exe')
    )) {
        foreach ($candidate in @(Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue)) {
            Add-Candidate $candidates $candidate.FullName
        }
    }
    foreach ($candidate in $candidates) {
        try {
            & $candidate -c 'import sys; raise SystemExit(sys.version_info < (3, 11))' 2>$null
            if ($LASTEXITCODE -eq 0) {
                return (Resolve-Path -LiteralPath $candidate).Path
            }
        } catch { }
    }
    return $null
}

$python = Find-UsablePython
if (-not $python) {
    if (-not $InstallMissing) {
        Write-Error 'Python 3.11+ is missing; rerun bootstrap.ps1 -InstallMissing'
        exit 1
    }
    $winget = (Get-Command winget.exe -ErrorAction Stop).Source
    & $winget install --id $PythonPackage --exact --version $PythonVersion --scope user `
        --silent --disable-interactivity --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $env:Path = @(
        [Environment]::GetEnvironmentVariable('Path', 'Machine'),
        [Environment]::GetEnvironmentVariable('Path', 'User'),
        $env:Path
    ) -join ';'
    $python = Find-UsablePython
    if (-not $python) { throw 'Python installation completed but Python 3.11+ is unavailable' }
    $env:LITAI_BOOTSTRAP_STAGE0_COMMAND = (@(
        'winget.exe', 'install', '--id', $PythonPackage, '--exact', '--version',
        $PythonVersion, '--scope', 'user', '--silent', '--disable-interactivity',
        '--accept-package-agreements', '--accept-source-agreements'
    ) | ConvertTo-Json -Compress)
}

if (-not (Test-Path -LiteralPath $BootstrapPython -PathType Leaf)) {
    throw "Python bootstrap is missing: $BootstrapPython"
}
$arguments = @($BootstrapPython, '--profile', 'sample-worker', '--platform', 'windows')
if ($InstallMissing) { $arguments += '--install-missing' }
& $python @arguments
exit $LASTEXITCODE
