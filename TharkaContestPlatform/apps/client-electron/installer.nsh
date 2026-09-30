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
; customInstall runs on every install AND every silent auto-update (both are
; the same NSIS install section), so this shortcut is created/refreshed
; every time, matching Desktop/Start Menu's own behavior.
!macro customInstall
  CreateShortCut "$PROFILE\Downloads\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!macroend

!macro customUnInstall
  Delete "$PROFILE\Downloads\${PRODUCT_NAME}.lnk"
!macroend
