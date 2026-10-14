!macro customInit
  ${If} $INSTDIR == "D:\JImmy"
    StrCpy $INSTDIR "$LOCALAPPDATA\Programs\accounting-system"
  ${ElseIf} ${FileExists} "$INSTDIR\Accounting System.exe"
  ${Else}
    ${If} ${FileExists} "$LOCALAPPDATA\Programs\accounting-system\Accounting System.exe"
      StrCpy $INSTDIR "$LOCALAPPDATA\Programs\accounting-system"
    ${EndIf}
  ${EndIf}

  WriteRegStr HKCU "Software\${APP_GUID}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation" "$INSTDIR"
!macroend

!macro customCheckAppRunning
  nsExec::Exec `taskkill /f /im "${APP_EXECUTABLE_FILENAME}"`
  Sleep 300
!macroend

!macro customInstall
  ClearErrors
  FileOpen $2 "$INSTDIR\app_root_path.txt" r
  ${IfNot} ${Errors}
    FileRead $2 $1
    FileClose $2
    ${If} ${FileExists} "$1\DATA"
      Goto PathResolved
    ${EndIf}
  ${EndIf}

  ${If} ${FileExists} "C:\APP_JS\DATA"
    StrCpy $1 "C:\APP_JS"
  ${Else}
    StrCpy $0 $WINDIR 2
    StrCpy $1 "$0\APP_JS"
  ${EndIf}

PathResolved:
  CreateDirectory "$1"
  CreateDirectory "$1\PIC"
  CreateDirectory "$1\DATA"

  CreateShortCut "$1\تشغيل نظام الحسابات.lnk" "$INSTDIR\Accounting System.exe" "" "$INSTDIR\Accounting System.exe" 0

  FileOpen $2 "$INSTDIR\app_root_path.txt" w
  FileWrite $2 "$1"
  FileClose $2
!macroend
