# Installation portable ADI ONG — un clic, sans Inno Setup.
# Copie l'application dans %LOCALAPPDATA%\ADI-ONG, installe Node portable,
# crée les raccourcis, active le démarrage automatique et lance le serveur.
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dst = Join-Path $env:LOCALAPPDATA 'ADI-ONG'

Write-Host "Installation d'ADI ONG dans $dst …"

# Arrêter un serveur déjà installé (mise à jour)
$pidFile = Join-Path $dst 'server\data\server.pid'
if (Test-Path $pidFile) {
  $oldId = (Get-Content $pidFile -Raw).Trim()
  if ($oldId -match '^\d+$') { try { Stop-Process -Id ([int]$oldId) -Force } catch { } }
  Start-Sleep -Milliseconds 500
}

New-Item -ItemType Directory -Force -Path $dst | Out-Null
foreach ($item in @('client', 'server', 'launcher')) {
  Copy-Item -Recurse -Force (Join-Path $src $item) (Join-Path $dst $item)
}

# Node.js portable (téléchargé à la première installation si absent)
$nodeDir = Join-Path $dst 'node'
New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
if (-not (Test-Path (Join-Path $nodeDir 'node.exe'))) {
  $ver = 'v22.23.3'
  $zipPath = Join-Path $env:TEMP "node-$ver-win-x64.zip"
  $urls = @(
    "https://nodejs.org/dist/$ver/node-$ver-win-x64.zip",
    "https://cdn.npmmirror.com/binaries/node/$ver/node-$ver-win-x64.zip"
  )
  $ok = $false
  foreach ($u in $urls) {
    try {
      Write-Host "Téléchargement de Node.js ($ver, ~30 Mo) depuis $u …"
      Invoke-WebRequest -Uri $u -OutFile $zipPath -UseBasicParsing
      $ok = $true
      break
    } catch {
      Write-Host "  Source inaccessible : $u"
    }
  }
  if (-not $ok) {
    Write-Host "ERREUR : téléchargement de Node.js impossible."
    Write-Host "Téléchargez manuellement node-$ver-win-x64.zip sur nodejs.org,"
    Write-Host "décompressez son contenu dans $nodeDir, puis relancez le raccourci « ADI ONG »."
    exit 1
  }
  tar -xf $zipPath -C $nodeDir --strip-components=1
  Remove-Item $zipPath -ErrorAction SilentlyContinue
}
if (-not (Test-Path (Join-Path $nodeDir 'node.exe'))) {
  Write-Host "ERREUR : Node.js est absent ou incomplet dans $nodeDir."
  exit 1
}

# Raccourcis (menu Démarrer + Bureau)
$ws = New-Object -ComObject WScript.Shell
function New-Shortcut([string]$path, [string]$script, [string]$desc) {
  $s = $ws.CreateShortcut($path)
  $s.TargetPath = 'powershell.exe'
  $s.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
  $s.WorkingDirectory = $dst
  $s.Description = $desc
  $s.Save()
}
$menu = [Environment]::GetFolderPath('Programs')
New-Shortcut (Join-Path $menu 'ADI ONG.lnk') (Join-Path $dst 'launcher\start-adiong.ps1') 'Démarrer ADI ONG et ouvrir le site'
New-Shortcut (Join-Path $menu 'Arrêter ADI ONG.lnk') (Join-Path $dst 'launcher\stop-adiong.ps1') 'Arrêter le serveur local'
New-Shortcut (Join-Path ([Environment]::GetFolderPath('Desktop')) 'ADI ONG.lnk') (Join-Path $dst 'launcher\start-adiong.ps1') 'Démarrer ADI ONG et ouvrir le site'

# Démarrage automatique avec l'ordinateur
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
Set-ItemProperty -Path $runKey -Name 'ADI ONG' -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$dst\launcher\start-adiong.ps1`""

Write-Host "Installation terminée — démarrage du serveur…"
& (Join-Path $dst 'launcher\start-adiong.ps1')
