$ErrorActionPreference = 'Stop'

# Optional: set Gemini key in your shell before running this script.
# Example: $env:GEMINI_API_KEY = 'your_key_here'

$workspace = 'E:\nepHacks'
$backendPath = Join-Path $workspace 'backend'
$frontendPath = Join-Path $workspace 'frontend'
$mentalBertPath = Join-Path $workspace 'mentalbert_service'

$ports = 3000, 3001, 8001
foreach ($port in $ports) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($conn) {
    $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

Get-Job -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -in @('nephacks-mentalbert', 'nephacks-backend', 'nephacks-frontend')
} | Remove-Job -Force -ErrorAction SilentlyContinue

Start-Job -Name 'nephacks-mentalbert' -ScriptBlock {
  param($path)
  Set-Location $path
  .\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001
} -ArgumentList $mentalBertPath | Out-Null

Start-Job -Name 'nephacks-backend' -ScriptBlock {
  param($path)
  Set-Location $path
  npm run start
} -ArgumentList $backendPath | Out-Null

Start-Job -Name 'nephacks-frontend' -ScriptBlock {
  param($path)
  Set-Location $path
  npm run dev
} -ArgumentList $frontendPath | Out-Null

Start-Sleep -Seconds 10

try {
  $mentalHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:8001/health' -Method Get
  $backendHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health' -Method Get
  $frontend = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing

  Write-Host 'Services started successfully:'
  Write-Host ('- MentalBERT: ' + ($mentalHealth.status))
  Write-Host ('- Backend: ' + ($backendHealth.status))
  Write-Host ('- Frontend HTTP status: ' + $frontend.StatusCode)
} catch {
  Write-Host 'Services started, but one or more health checks failed:'
  Write-Host $_.Exception.Message
}

Write-Host ''
Write-Host 'Background jobs:'
Get-Job | Where-Object { $_.Name -in @('nephacks-mentalbert', 'nephacks-backend', 'nephacks-frontend') } |
  Select-Object Id, Name, State | Format-Table -AutoSize
