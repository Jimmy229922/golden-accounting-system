!macro customInstall
  StrCpy $0 $EXEDIR 2
  StrCpy $1 "$0\APP_JS"

  CreateDirectory "$1"
  CreateDirectory "$1\PIC"
  CreateDirectory "$1\DATA"

  CreateShortCut "$1\تشغيل نظام الحسابات.lnk" "$INSTDIR\Accounting System.exe" "" "$INSTDIR\Accounting System.exe" 0

  FileOpen $2 "$INSTDIR\app_root_path.txt" w
  FileWrite $2 "$1"
  FileClose $2
!macroend
