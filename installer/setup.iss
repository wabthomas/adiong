; Installateur ADI ONG — « serveur local » façon Laragon
; Compilation : iscc setup.iss  (Inno Setup 6)
; Le dossier à compiler (stage\) contient : node\  client\  server\  launcher\

#define MyAppName "ADI ONG"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "ADI ONG"

[Setup]
AppId={{8A6F3C21-4D5E-4B7A-9C1F-2E6D8A0B4C5E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\ADI-ONG
DisableDirPage=no
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
OutputDir=Output
OutputBaseFilename=ADI-ONG-Setup-{#MyAppVersion}
UninstallDisplayIcon={app}\node\node.exe
Compression=lzma2/max
SolidCompression=yes

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; GroupDescription: "Raccourcis :"
Name: "autostart"; Description: "Démarrer ADI ONG automatiquement au démarrage de l'ordinateur"; Flags: checked; GroupDescription: "Démarrage :"

[Files]
Source: "node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs
Source: "client\*"; DestDir: "{app}\client"; Flags: ignoreversion recursesubdirs
Source: "server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs
Source: "launcher\*"; DestDir: "{app}\launcher"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\ADI ONG"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launcher\start-adiong.ps1"""; Comment: "Démarrer le serveur local et ouvrir le site"
Name: "{autoprograms}\Arrêter ADI ONG"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launcher\stop-adiong.ps1"""; Comment: "Arrêter le serveur local"
Name: "{autodesktop}\ADI ONG"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launcher\start-adiong.ps1"""; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "ADI ONG"; ValueData: "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\launcher\start-adiong.ps1"""; Flags: uninsdeletevalue; Tasks: autostart

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launcher\start-adiong.ps1"""; Description: "Démarrer ADI ONG maintenant"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launcher\stop-adiong.ps1"""; RunOnceId: "stopserver"; Flags: runhidden

[Code]
function CurPageChanged(CurPageID: Integer): Boolean;
begin
  if CurPageID = wpSelectComponents then
    WizardForm.StatusLabel.Caption := 'ADI ONG s'installe sans compte administrateur (dossier de l'utilisateur).';
  Result := True;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  PidFile: String;
  IdStr: String;
begin
  Result := '';
  PidFile := ExpandConstant('{app}\server\data\server.pid');
  if FileExists(PidFile) then
  begin
    IdStr := Trim(StrToFile(PidFile));
    if (IdStr <> '') and (StrToIntDef(IdStr, 0) > 0) then
    begin
      TerminateProcess(StrToIntDef(IdStr, 0), True);
      Sleep(500);
    end;
    DeleteFile(PidFile);
  end;
end;
