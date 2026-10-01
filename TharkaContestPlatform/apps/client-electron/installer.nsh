; electron-builder NSIS customization (see package.json's build.nsis.include).
; electron-builder's built-in createDesktopShortcut/createStartMenuShortcut
; options cover Desktop and Start Menu, but nothing places a shortcut in the
; user's Downloads folder - there's no such built-in option, and NSIS itself
; has no $DOWNLOADS constant (Downloads is a post-XP "known folder", unlike
; $DESKTOP/$SMPROGRAMS which predate it). $PROFILE\Downloads is used instead
; of resolving the real known-folder path via the registry - simpler, and
; correct for every lab machine here since none has moved its Downloads
; folder off the default location.
;
; customInstall runs once per install, so these shortcuts are created/
; refreshed every time, matching Desktop/Start Menu's own behavior.
;
; Taskbar pinning: electron-builder has no built-in "pin to taskbar" option
; (Windows itself has no supported API for it - the Shell.Application "Pin to
; taskbar" verb is deliberately unavailable to installers on Win10/11). The
; one thing that does work is dropping the .lnk straight into the shell's own
; "user pinned" folder - the taskbar reads that folder, so the item shows up
; pinned without needing the blocked verb. Written unconditionally rather
; than behind an opt-in checkbox page: this is a lab deployment on one known
; set of machines, and an extra interactive page is one more thing that can
; break a silent/one-click install. `ie4uinit.exe -show` is the standard
; no-reboot nudge that makes the shell re-read that folder immediately
; instead of at next logon; it's fire-and-forget (Exec, not ExecWait) so a
; machine without it can't stall or fail the install.
!macro customInstall
  CreateShortCut "$PROFILE\Downloads\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"

  CreateDirectory "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
  CreateShortCut "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  Exec '"$SYSDIR\ie4uinit.exe" -show'
!macroend

!macro customUnInstall
  Delete "$PROFILE\Downloads\${PRODUCT_NAME}.lnk"
  Delete "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${PRODUCT_NAME}.lnk"
!macroend
