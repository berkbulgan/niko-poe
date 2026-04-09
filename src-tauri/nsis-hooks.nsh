; ABOUTME: Custom NSIS installer hooks for the N.I.K.O. Tauri app.
; ABOUTME: Shows GGG disclaimer before installation begins.

!macro NSIS_HOOK_PREINSTALL
  MessageBox MB_OKCANCEL|MB_ICONINFORMATION \
    "N.I.K.O. — Disclaimer$\r$\n$\r$\nThis product isn't affiliated with or endorsed by Grinding Gear Games in any way.$\r$\n$\r$\nPath of Exile is a registered trademark of Grinding Gear Games. All game assets, names, and related content are the property of their respective owners.$\r$\n$\r$\nN.I.K.O. is a fan-made tool that interacts with publicly available Path of Exile APIs. Use of this application is at your own risk.$\r$\n$\r$\nClick OK to continue installation or Cancel to abort." \
    IDOK +2
  Abort
!macroend
