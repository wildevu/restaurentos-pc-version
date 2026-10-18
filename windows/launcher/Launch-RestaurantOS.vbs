' RestaurantOS Local Hub - Silent Launcher
' Starts the persistent PowerShell hub supervisor. The supervisor owns Node's
' output redirection, logging, and restart lifecycle independently of this script.
Dim WshShell, fso, appDir, dataDir, logDir, supervisorScript, commandLine

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)

dataDir = WshShell.ExpandEnvironmentStrings("%RESTAURANTOS_DATA_DIR%")
If dataDir = "%RESTAURANTOS_DATA_DIR%" Or Len(dataDir) = 0 Then
    dataDir = WshShell.ExpandEnvironmentStrings("%ProgramData%") & "\RestaurantOS"
    If InStr(dataDir, "%") > 0 Then dataDir = "C:\ProgramData\RestaurantOS"
End If

logDir = dataDir & "\logs"
If Not fso.FolderExists(dataDir) Then fso.CreateFolder(dataDir)
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)

supervisorScript = appDir & "\windows\service\run-hub-supervisor.ps1"
If Not fso.FileExists(supervisorScript) Then
    MsgBox "The RestaurantOS hub supervisor is missing. Please reinstall RestaurantOS." & vbCrLf & supervisorScript, vbCritical, "RestaurantOS Local Hub"
    WScript.Quit 1
End If

commandLine = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File """ & supervisorScript & """ -AppDir """ & appDir & """ -DataDir """ & dataDir & """"
WshShell.Run commandLine, 0, False
