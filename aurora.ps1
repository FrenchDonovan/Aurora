param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AuroraArguments)
$ErrorActionPreference = 'Stop'
$auroraNodeCandidates = @(
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'),
    (Join-Path $env:ProgramFiles 'nodejs\node.exe')
)
$auroraNodeExecutable = $null
foreach ($candidate in $auroraNodeCandidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $auroraNodeExecutable = $candidate; break }
}
if (-not $auroraNodeExecutable) {
    $auroraNodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($auroraNodeCommand) { $auroraNodeExecutable = $auroraNodeCommand.Source }
}
if (-not $auroraNodeExecutable) { throw 'Install Node.js 20+ or use the bundled Codex runtime.' }
Push-Location -LiteralPath $PSScriptRoot
try {
    $auroraAction = if ($AuroraArguments.Count) { $AuroraArguments[0] } else { 'start' }
    switch ($auroraAction) {
        'build' { & $auroraNodeExecutable scripts/build.mjs }
        'test' { & $auroraNodeExecutable scripts/test.mjs }
        'validate' { & $auroraNodeExecutable scripts/validate-corpus.mjs }
        'start' {
            & $auroraNodeExecutable scripts/build.mjs
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            & $auroraNodeExecutable scripts/serve.mjs
        }
        default { throw 'Use .\aurora.ps1 start, build, test, or validate.' }
    }
    $auroraCode = $LASTEXITCODE
} finally { Pop-Location }
exit $auroraCode
