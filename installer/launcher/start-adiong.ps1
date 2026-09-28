$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = 4000
$dataDir = Join-Path $root 'server\data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$pidFile = Join-Path $dataDir 'server.pid'

function Test-PortBusy([int]$p) {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', $p)
    $c.Close()
    return $true
  } catch {
    return $false
  }
}

# Le serveur est déjà en cours d'exécution ?
if (Test-PortBusy $port) {
  Write-Host "ADI ONG tourne déjà — ouverture du site…"
  Start-Process "http://localhost:$port"
  exit 0
}

# Arrêter un éventuel ancien processus (fichier PID)
if (Test-Path $pidFile) {
  $oldId = (Get-Content $pidFile -Raw).Trim()
  if ($oldId -match '^\d+$') {
    try { Stop-Process -Id ([int]$oldId) -Force -ErrorAction Stop; Start-Sleep -Milliseconds 400 } catch { }
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
}

$nodeExe = Join-Path $root 'node\node.exe'
$serverDir = Join-Path $root 'server'
if (-not (Test-Path $nodeExe)) {
  Write-Host "ERREUR : node\node.exe introuvable — l'installation est incomplète."
  exit 1
}

$env:HOST = '127.0.0.1'
$env:PORT = "$port"
$proc = Start-Process -FilePath $nodeExe -ArgumentList 'index.js' -WorkingDirectory $serverDir -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $dataDir 'server.log') -RedirectStandardError (Join-Path $dataDir 'server.err.log')
Set-Content -Path $pidFile -Value $proc.Id

$ok = $false
for ($i = 0; $i -lt 24; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-PortBusy $port) { $ok = $true; break }
}
if ($ok) {
  Write-Host "ADI ONG est en cours d'exécution : http://localhost:$port"
  Start-Process "http://localhost:$port"
} else {
  Write-Host "Le serveur n'a pas démarré à temps — consultez server\data\server.err.log"
}
