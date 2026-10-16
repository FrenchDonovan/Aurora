# Run from a source checkout without installing any Python packages.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AuroraArguments)
$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$pythonCandidates = @(
    (Join-Path $projectDirectory '.venv\Scripts\python.exe'),
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe')
)
$pythonExecutable = $null
foreach ($candidate in $pythonCandidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        $pythonExecutable = $candidate
        break
    }
}
if (-not $pythonExecutable) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand -and $pythonCommand.Source -notlike '*Microsoft\WindowsApps*') {
        $pythonExecutable = $pythonCommand.Source
    }
}
if (-not $pythonExecutable) {
    throw 'Python 3.11+ was not found. Install Python, reopen PowerShell, and run this script again.'
}
Push-Location -LiteralPath $projectDirectory
try {
    if (-not $AuroraArguments) { $AuroraArguments = @('--help') }
    & $pythonExecutable -m aurora @AuroraArguments
    $auroraExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $auroraExitCode
