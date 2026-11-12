; ABOUTME: Custom NSIS installer hooks for the N.I.K.O. Tauri app.
; ABOUTME: Shows GGG disclaimer before installation begins and names the shortcuts "N.I.K.O.".

!include LogicLib.nsh

; Tauri names shortcuts after productName ("niko"). productName stays "niko" because it also names the
; install folder and registry keys, so the shortcuts are renamed here instead.
!macro NIKO_RENAME_SHORTCUT DIR
  ${If} ${FileExists} "${DIR}\niko.lnk"
    Delete "${DIR}\N.I.K.O..lnk"
    Rename "${DIR}\niko.lnk" "${DIR}\N.I.K.O..lnk"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  MessageBox MB_OKCANCEL|MB_ICONINFORMATION \
    "N.I.K.O. — Disclaimer$\r$\n$\r$\nThis product isn't affiliated with or endorsed by Grinding Gear Games in any way.$\r$\n$\r$\nPath of Exile is a registered trademark of Grinding Gear Games. All game assets, names, and related content are the property of their respective owners.$\r$\n$\r$\nN.I.K.O. is a fan-made tool that interacts with publicly available Path of Exile APIs. Use of this application is at your own risk.$\r$\n$\r$\nClick OK to continue installation or Cancel to abort." \
    IDOK +2
  Abort
!macroend

; Start menu shortcut, plus the desktop one in passive/silent mode (updates).
!macro NSIS_HOOK_POSTINSTALL
  !insertmacro NIKO_RENAME_SHORTCUT "$SMPROGRAMS"
  !insertmacro NIKO_RENAME_SHORTCUT "$DESKTOP"
!macroend

; The interactive installer creates the desktop shortcut on its finish page, after POSTINSTALL.
Function .onGUIEnd
  !insertmacro NIKO_RENAME_SHORTCUT "$DESKTOP"
FunctionEnd

; Tauri's uninstaller only removes "niko.lnk". Updates run it too, with $UpdateMode set; keep the shortcuts then.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    Delete "$SMPROGRAMS\N.I.K.O..lnk"
    Delete "$DESKTOP\N.I.K.O..lnk"
  ${EndIf}
!macroend
