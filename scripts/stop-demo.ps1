param([ValidateRange(1024,65535)][int]$Port = 3000)
$ErrorActionPreference = "Stop"
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$statePath = Join-Path $projectRoot ".local/demo/server-$Port.json"
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host "No demo started by this launcher is recorded on port $Port."; return }
$state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($state.projectRoot -ne $projectRoot -or $state.port -ne $Port) { throw "Demo ownership record does not match; no process was stopped." }
$server = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
if ($server) {
  $started = $server.StartTime.ToUniversalTime().ToString("o")
  $expectedStart = ([DateTime]$state.startedAt).ToUniversalTime().ToString("o")
  if ($server.ProcessName -ne "node" -or $started -ne $expectedStart -or [IO.Path]::GetFullPath($server.Path) -ne [IO.Path]::GetFullPath($state.executable)) { throw "The recorded process has changed; no process was stopped." }
  Stop-Process -Id $server.Id
}
Remove-Item -LiteralPath $statePath
Write-Host "Global Chain demo on port $Port has stopped."
