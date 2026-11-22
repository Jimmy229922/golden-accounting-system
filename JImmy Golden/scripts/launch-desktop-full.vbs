Option Explicit

Dim fso, shell
Dim scriptDir, rootDir, launcherPath

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
launcherPath = fso.BuildPath(rootDir, "scripts\launch-desktop-full.cmd")

If Not fso.FileExists(launcherPath) Then
    MsgBox "Launcher not found at:" & vbCrLf & launcherPath, vbCritical + vbOKOnly, "Accounting System"
    WScript.Quit 1
End If

' Run launcher hidden so no console window is shown to end users.
shell.Run Chr(34) & launcherPath & Chr(34), 0, False
