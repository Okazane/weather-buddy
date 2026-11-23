@echo off
chcp 65001 >nul
setlocal
set "CORNER=%~1"
set "SIZE=%~2"
set "GENDER=%~3"
if "%CORNER%"=="" set "CORNER=BottomRight"
if "%SIZE%"=="" set "SIZE=Standard"
if "%GENDER%"=="" set "GENDER=male"

powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Launch-Desktop-Widget.ps1" -Corner "%CORNER%" -Size "%SIZE%" -Gender "%GENDER%"
endlocal
