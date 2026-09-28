# ADI ONG — installateur Windows (« serveur local »)

Fait fonctionner tout le site (admin + API + base SQLite) sur un PC Windows,
sans rien installer d'autre : Node.js portable est téléchargé à la
première installation (~30 Mo, une seule fois).

## Contenu de l'installation

```
%LOCALAPPDATA%\ADI-ONG\
├─ node\            Node.js portable (x64) — téléchargé par
│                    setup-portable.ps1 à la première installation
├─ client\dist\     le site (build de production)
├─ server\          l'API + la base de données
│  ├─ data\         base SQLite, secret JWT, journaux (créée au 1er lancement)
│  └─ uploads\seed\ images du site
└─ launcher\        scripts de démarrage / arrêt
```

Au premier lancement, la base est initialisée automatiquement avec le contenu
du site. **Compte super administrateur identique à la production :**
`admin@adiong.org` / `AdiOng2026!`.

## Installation

Deux voies : le `.exe` (voie 2 ci-dessous) ou, sans rien préparer,
dézipper l'archive portable et double-cliquer `setup-portable.bat`.

1. Lancer `ADI-ONG-Setup-<version>.exe` (généré par GitHub Actions, voir ci-dessous).
   Aucun compte administrateur n'est nécessaire (installation dans le dossier
   de l'utilisateur).
2. L'assistant propose deux options :
   - raccourci sur le Bureau ;
   - démarrage automatique à l'ouverture de session (coché par défaut).
3. À la fin, le serveur démarre et le navigateur ouvre
   **http://localhost:4000**.

Le serveur n'écoute que sur `127.0.0.1` : il n'est accessible que depuis le PC
lui-même. (Pour le tester depuis un téléphone sur le même réseau Wi-Fi,
lancer manuellement `node\server\index.js` avec `HOST=0.0.0.0`.)

## Démarrer / arrêter

- Menu Démarrer → **ADI ONG** (démarrer + ouvrir le site) ou **Arrêter ADI ONG**.
- Les journaux sont dans `server\data\server.log` et `server.err.log`.

## Mettre à jour

Réinstaller la nouvelle version par-dessus l'ancienne : la base de données et
les fichiers de l'utilisateur sont conservés (seul le code est remplacé).
L'installateur arrête le serveur avant l'installation.

## Migrer depuis / vers le site de production

Le site de production et la copie locale partagent le même format de
sauvegarde (Phase 1) :

1. **Prod → local** : sur adiong.org, *Réglages → Sauvegarde → Télécharger le
   ZIP*, puis sur la copie locale *Réglages → Sauvegarde → Restaurer*.
2. **Local → prod** : l'inverse.

## Désinstallation

Panneau de configuration → désinstaller « ADI ONG ». Le serveur est arrêté
automatiquement. **La base locale est supprimée avec l'installation** :
télécharger d'abord une sauvegarde ZIP si les données locales doivent être
conservées.

## Construire / distribuer l'installateur

**Voie 1 — ZIP portable (immédiat).** L'archive `dist/ADI-ONG-portable-<date>.zip`
est dans le dépôt (lien direct dans la release *windows-portable-<date>* ;
l'upload d'assets est bloqué depuis l'environnement de build, le ZIP est
donc versionné dans `dist/` le temps de la livraison). Contenu : app
buildée, dépendances, scripts de lancement. Aucun prérequis sur le PC :
dézipper et lancer `setup-portable.bat`, le script télécharge Node.js
portable puis démarre le serveur.

**Voie 2 — `.exe` via GitHub Actions (une seule action manuelle).**
Le token du bot Arena n'a pas le droit d'écrire dans `.github/workflows/`
(règle GitHub). Pour activer le build `.exe` automatisé :
1. copier le contenu de `installer/windows-installer.yml` dans
   `.github/workflows/windows-installer.yml` (GitHub → *Add file* →
   *Create new file*, ou git local) ;
2. pusher, puis Actions → *Installateur Windows* → *Run workflow* ;
3. télécharger le `.exe` dans les *Artifacts*.

**Manuel** (sur Windows, Inno Setup 6 installé) :

  ```powershell
  cd client;  npm ci; npm run build
  cd ..\server; npm ci
  # copier dans un dossier stage\ : node\ (Node portable x64 extrait),
  # client\dist, server\ (sans data), launcher\, setup.iss
  cd stage
  iscc setup.iss
  ```

## Fichiers

| Fichier | Rôle |
|---|---|
| `setup.iss` | script Inno Setup (installation, raccourcis, auto-start, arrêt au désinstall) |
| `windows-installer.yml` | workflow GitHub Actions (à placer dans `.github/workflows/`) |
| `setup-portable.ps1` / `.bat` | installation « un clic » du ZIP portable |
| `Lisez-moi.txt` | notice utilisateur du ZIP portable |
| `launcher/start-adiong.ps1` | démarre le serveur (127.0.0.1:4000), attend le port, ouvre le navigateur |
| `launcher/stop-adiong.ps1` | arrête le serveur (PID conservé dans `server\data\server.pid`) |
