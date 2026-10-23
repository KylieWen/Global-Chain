param([switch]$Build, [ValidateRange(1024,65535)][int]$Port = 3000, [switch]$NoBrowser)
$ErrorActionPreference = "Stop"
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$webRoot = Join-Path $projectRoot "apps/web"
$stateRoot = Join-Path $projectRoot ".local/demo"
$statePath = Join-Path $stateRoot "server-$Port.json"
$url = "http://127.0.0.1:$Port"
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw "Node.js was not found. Add a supported Node.js LTS installation to PATH." }
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
function Test-DemoReady {
  try { $health = Invoke-RestMethod "$url/api/health" -TimeoutSec 2; return $health.service -eq "web" }
  catch { return $false }
}
if (Test-DemoReady) {
  if ($Build) { throw "A service already uses port $Port. Stop the known local demo before building; no process was killed." }
  $homeResponse = Invoke-WebRequest -UseBasicParsing "$url/" -TimeoutSec 30
  if ($homeResponse.Content -notmatch 'Global Chain|GlobeChain') { throw "Port $Port belongs to another site; no process was changed." }
  Write-Host "The local site is already running: $url/"
  if (-not $NoBrowser) { Start-Process "$url/" }
  return
}
if ($Build) {
  $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  $corepack = Get-Command corepack.cmd -ErrorAction SilentlyContinue
  Push-Location $projectRoot
  try {
    if ($pnpm) { & $pnpm.Source run build }
    elseif ($corepack) { & $corepack.Source pnpm run build }
    else { throw "pnpm 11.19.0 or Corepack was not found. Add it to PATH before preparing the demo." }
    if ($LASTEXITCODE -ne 0) { throw "Production build failed; the demo was not started." }
  } finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath (Join-Path $webRoot ".next/BUILD_ID"))) { throw "Prepare the production build first: powershell -File scripts/start-demo.ps1 -Build" }
$server = Start-Process -FilePath $node.Source -ArgumentList @("node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "$Port") -WorkingDirectory $webRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateRoot "stdout-$Port.log") -RedirectStandardError (Join-Path $stateRoot "stderr-$Port.log")
$started = (Get-Process -Id $server.Id).StartTime.ToUniversalTime().ToString("o")
@{ pid=$server.Id; startedAt=$started; executable=$node.Source; projectRoot=$projectRoot; port=$Port } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
try {
  $deadline = [DateTime]::UtcNow.AddSeconds(120)
  while (-not (Test-DemoReady)) {
    if ($server.HasExited) { throw "The local server exited. See .local/demo/stderr-$Port.log." }
    if ([DateTime]::UtcNow -gt $deadline) { throw "The local server did not become ready within 120 seconds." }
    Start-Sleep -Milliseconds 250
  }
  $config = Get-Content -LiteralPath (Join-Path $projectRoot "content/demo-navigation.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($path in $config.warmupPaths) {
    if (-not $path.StartsWith("/") -or $path.StartsWith("//")) { throw "Invalid local warmup path." }
    $response = Invoke-WebRequest -UseBasicParsing "$url$path" -TimeoutSec 60
    if ($response.StatusCode -ne 200) { throw "Warmup failed: $path" }
  }
} catch { & (Join-Path $PSScriptRoot "stop-demo.ps1") -Port $Port; throw }
if (-not $NoBrowser) { Start-Process "$url/" }
Write-Host "Global Chain production demo is ready: $url/"
Write-Host "Use stop-demo.cmd to stop only this demo. No build cache was removed."
