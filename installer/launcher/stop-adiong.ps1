$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root 'server\data\server.pid'

if (Test-Path $pidFile) {
  $id = (Get-Content $pidFile -Raw).Trim()
  if ($id -match '^\d+$') {
    try {
      Stop-Process -Id ([int]$id) -Force -ErrorAction Stop
      Write-Host "ADI ONG est arrêté."
    } catch {
      Write-Host "Le processus n'était plus en cours d'exécution."
    }
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
} else {
  Write-Host "Aucun server.pid trouvé — le serveur ne tourne probablement pas."
}
