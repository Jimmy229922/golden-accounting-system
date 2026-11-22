' Start the backend server completely hidden (no console window).
' Usage: wscript start-backend-hidden.vbs "backendDir" "logFile"
Option Explicit

Dim fso, shell, backendDir, logFile, cmd

Set fso   = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

If WScript.Arguments.Count < 2 Then
    WScript.Quit 1
End If

backendDir = WScript.Arguments(0)
logFile    = WScript.Arguments(1)

If Not fso.FolderExists(backendDir) Then
    WScript.Quit 1
End If

cmd = "cmd /c cd /d """ & backendDir & """ && node src\server.js >> """ & logFile & """ 2>&1"

' Run completely hidden (window style 0), don't wait (False)
shell.Run cmd, 0, False

Set fso   = Nothing
Set shell = Nothing
