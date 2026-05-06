' ─────────────────────────────────────────────
'  Accounting System - Silent Launcher
'  Runs the app without showing a console window.
'  If launch fails, shows an error message box.
' ─────────────────────────────────────────────
Option Explicit

Dim fso, shell, scriptDir, rootDir, launcherPath, logFile
Dim exitCode

Set fso   = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir   = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir     = fso.GetParentFolderName(scriptDir)
launcherPath = fso.BuildPath(scriptDir, "launch-app.cmd")
logFile      = fso.BuildPath(scriptDir, "launcher.log")

' Verify the CMD launcher exists
If Not fso.FileExists(launcherPath) Then
    MsgBox "Launcher not found:" & vbCrLf & vbCrLf & launcherPath & vbCrLf & vbCrLf & _
           "Make sure the project folder is intact.", _
           vbCritical + vbOKOnly, "Accounting System"
    WScript.Quit 1
End If

' Run the CMD launcher minimized (style 7) and wait for it to finish
' Style 0 = hidden, 7 = minimized, True = wait
exitCode = shell.Run(Chr(34) & launcherPath & Chr(34), 0, True)

' If the launcher failed, show a helpful error
If exitCode <> 0 Then
    Dim msg
    msg = "The application could not start." & vbCrLf & vbCrLf

    If fso.FileExists(logFile) Then
        msg = msg & "Check the log file for details:" & vbCrLf & logFile
    Else
        msg = msg & "No log file found."
    End If

    MsgBox msg, vbExclamation + vbOKOnly, "Accounting System"
End If

Set fso   = Nothing
Set shell = Nothing
