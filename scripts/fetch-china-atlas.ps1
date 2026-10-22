# Capture fixed public sources for the offline atlas; never overwrite an existing snapshot.
$ErrorActionPreference = 'Stop'
$atlasRoot = Split-Path -Parent $PSScriptRoot
$atlasInput = Get-Content -LiteralPath (Join-Path $atlasRoot 'content/geography/china-atlas-input-2026-10-22.json') -Raw | ConvertFrom-Json
$atlasDir = Join-Path $atlasRoot 'data/raw/china-atlas-2026-10-22'
New-Item -ItemType Directory -Force -Path $atlasDir | Out-Null
$atlasTargets = @($atlasInput.sources | ForEach-Object { [pscustomobject]@{url=$_.url;file=($_.id+'.html')} })
$atlasCodes = @('100000') + @($atlasInput.places | Where-Object { [int]$_.provinceCode -ne $_.cityCode } | ForEach-Object { $_.provinceCode } | Sort-Object -Unique)
$atlasTargets += $atlasCodes | ForEach-Object { [pscustomobject]@{url=('https://geo.datav.aliyun.com/areas_v3/bound/'+$_+'_full.json');file=($_+'_full.json')} }
foreach ($atlasTarget in $atlasTargets) {
  $atlasPath = Join-Path $atlasDir $atlasTarget.file
  if (Test-Path -LiteralPath $atlasPath) { Write-Output ('Preserved '+$atlasTarget.file); continue }
  $atlasResponse = Invoke-WebRequest -Uri $atlasTarget.url -TimeoutSec 30
  [System.IO.File]::WriteAllText($atlasPath,$atlasResponse.Content)
  @{url=$atlasTarget.url;status=[int]$atlasResponse.StatusCode;retrievedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath ($atlasPath+'.meta.json')
  Write-Output ('Captured '+$atlasTarget.file)
}
