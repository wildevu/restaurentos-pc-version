; ==============================================================================
; Inno Setup 6 Script for RestaurantOS Local Hub
; Generates RestaurantOS-Setup-1.0.0.exe
; Targets: Windows 10, Windows 11, Windows Server 2016+ (64-bit)
; ==============================================================================

#define MyAppName "RestaurantOS Local Hub"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "RestaurantOS"
#define MyAppURL "http://localhost:3000"
#define MyAppExeName "launch-hub.bat"

[Setup]
; App Identity
AppId={{D814FA7F-32C9-4C2E-B763-71829D4EAA91}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Destination Directories
DefaultDirName={autopf}\RestaurantOS
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Output Executable
OutputDir=..\..\dist\installer
OutputBaseFilename=RestaurantOS-Setup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

; System & Architecture Requirements
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Data Safety on Uninstall
UninstallDisplayName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "autostart"; Description: "Start RestaurantOS Local Hub automatically when Windows boots"; GroupDescription: "System Services:"
Name: "firewall"; Description: "Configure Windows Firewall rule for waiter & kitchen LAN devices (Port 3000)"; GroupDescription: "Network Configuration:"

[Files]
; Application binaries and static PWA assets go to {app} (C:\Program Files\RestaurantOS)
Source: "..\..\dist\windows-package\RestaurantOS\server.cjs"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\dist\windows-package\RestaurantOS\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\windows-package\RestaurantOS\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\windows-package\RestaurantOS\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\windows-package\RestaurantOS\migrations\*"; DestDir: "{app}\migrations"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\windows-package\RestaurantOS\src\db\migrations\*"; DestDir: "{app}\src\db\migrations"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\windows-package\RestaurantOS\public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\windows-package\RestaurantOS\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\dist\windows-package\RestaurantOS\restaurantos.env.template"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\launcher\launch-hub.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\firewall\*"; DestDir: "{app}\windows\firewall"; Flags: ignoreversion recursesubdirs
Source: "..\service\*"; DestDir: "{app}\windows\service"; Flags: ignoreversion recursesubdirs
Source: "..\installer\*"; DestDir: "{app}\windows\installer"; Flags: ignoreversion recursesubdirs

; NOTE ON DATA DIRECTORY ({commonappdata}\RestaurantOS):
; We deliberately DO NOT package any default database file here.
; When RestaurantOS Local Hub runs for the first time, it safely creates and migrates
; {commonappdata}\RestaurantOS\data\restaurantos.db, preserving all existing records across updates!

[Dirs]
Name: "{commonappdata}\RestaurantOS"; Permissions: users-modify
Name: "{commonappdata}\RestaurantOS\data"; Permissions: users-modify
Name: "{commonappdata}\RestaurantOS\backups"; Permissions: users-modify
Name: "{commonappdata}\RestaurantOS\logs"; Permissions: users-modify
Name: "{commonappdata}\RestaurantOS\config"; Permissions: users-modify

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\launch-hub.bat"
Name: "{group}\Open Local Hub Status"; Filename: "http://localhost:3000/hub"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "http://localhost:3000/hub"; Tasks: desktopicon

[Run]
; Firewall Rule Registration
Filename: "{app}\windows\firewall\add-firewall-rule.bat"; Flags: runhidden; Tasks: firewall

; Auto-Start Task Registration
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\windows\service\install-service.ps1"" -AppDir ""{app}"""; Flags: runhidden; Tasks: autostart

; Launch App after Installation
Filename: "{app}\launch-hub.bat"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: postinstall nowait skipifsilent

[UninstallRun]
; Unregister Windows Service & Firewall rules before removing files
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\windows\service\uninstall-service.ps1"""; Flags: runhidden
Filename: "{app}\windows\firewall\remove-firewall-rule.bat"; Flags: runhidden

[Code]
// Custom Inno Setup Pascal Script to inform user that their data in ProgramData was preserved
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    MsgBox('RestaurantOS Local Hub has been uninstalled.' + #13#10 + #13#10 +
           'DATA SAFETY NOTICE:' + #13#10 +
           'Your database, menu items, and backups in C:\ProgramData\RestaurantOS were safely preserved.' + #13#10 +
           'They will be restored automatically if you ever reinstall RestaurantOS.', mbInformation, MB_OK);
  end;
end;
