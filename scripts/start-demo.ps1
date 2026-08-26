$ErrorActionPreference = "Stop"

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$webCache = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "apps/web/.next"))

function Get-ProjectNodeProcesses {
  Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "node.exe" -and
    $_.CommandLine -and
    $_.CommandLine.IndexOf($projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  }
}

Get-ProjectNodeProcesses | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

if ($webCache.IndexOf($projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -eq 0 -and (Test-Path -LiteralPath $webCache)) {
  Remove-Item -LiteralPath $webCache -Recurse -Force
}

$corepack = Get-Command corepack.cmd -ErrorAction SilentlyContinue
if (-not $corepack -and (Test-Path -LiteralPath "E:\EDA\corepack.cmd")) {
  $corepackPath = "E:\EDA\corepack.cmd"
} elseif ($corepack) {
  $corepackPath = $corepack.Source
} else {
  throw "corepack.cmd was not found. Install Node.js 20+ or add Corepack to PATH."
}

$server = Start-Process -FilePath $corepackPath `
  -ArgumentList @("pnpm", "run", "dev") `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -PassThru

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  Start-Sleep -Milliseconds 500
  try {
    $response = Invoke-WebRequest -UseBasicParsing "http://localhost:3000/api/health" -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    # The development server is still compiling.
  }
}

if (-not $ready) {
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  throw "GlobeChain Demo did not start within 15 seconds."
}

Start-Process "http://localhost:3000/"
Write-Host "GlobeChain Demo is ready: http://localhost:3000/"
Write-Host "Double-click stop-demo.cmd to stop it."
