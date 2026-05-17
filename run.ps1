$ErrorActionPreference = "Stop"
$errLog = "$env:TEMP\agent_err.log"
$proc = Start-Process -FilePath "node" -ArgumentList "agent.js" -WorkingDirectory "C:\Users\HP\Documents\GiithubREPOSITORIES\ATLAS - AGENT - CODE\OPENCODE\atlas-auth-agent" -PassThru -RedirectStandardError $errLog -NoNewWindow
Start-Sleep -Seconds 5
if (-not $proc.HasExited) {
    Write-Host "Agent running with PID: $($proc.Id)"
} else {
    Write-Host "Agent exited with code: $($proc.ExitCode)"
    if (Test-Path $errLog) {
        Write-Host "Error output:"
        Get-Content $errLog
    }
}