@echo off
setlocal DisableDelayedExpansion
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer.ps1" -Action uninstall
set "themeResult=%errorlevel%"
if not "%themeResult%"=="0" echo Operation did not complete. Please read the message above.
pause
exit /b %themeResult%
