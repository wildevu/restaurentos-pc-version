' RestaurantOS Local Hub - Silent VBS Launcher
' Launches the bundled background service without flashing any console window
Dim WshShell, fso, appDir, nodeExe, serverScript, dataDir, logDir

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)

dataDir = WshShell.ExpandEnvironmentStrings("%ProgramData%") & "\RestaurantOS"
If InStr(dataDir, "%") > 0 Then dataDir = "C:\ProgramData\RestaurantOS"

logDir = dataDir & "\logs"
If Not fso.FolderExists(dataDir) Then fso.CreateFolder(dataDir)
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)

nodeExe = appDir & "\runtime\node.exe"
If Not fso.FileExists(nodeExe) Then nodeExe = appDir & "\node.exe"
If Not fso.FileExists(nodeExe) Then nodeExe = "node.exe"

serverScript = appDir & "\server.cjs"

WshShell.Environment("PROCESS")("NODE_ENV") = "production"
WshShell.Environment("PROCESS")("PORT") = "3000"
WshShell.Environment("PROCESS")("RESTAURANTOS_DATA_DIR") = dataDir

' Launch silently with 0 (hidden window)
WshShell.CurrentDirectory = appDir
WshShell.Run """" & nodeExe & """ """ & serverScript & """", 0, False
