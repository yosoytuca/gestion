@echo off
chcp 65001 >nul
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js LTS con npm antes de continuar.
  pause
  exit /b 1
)
node "%~dp003-arrancar.mjs" %*
set "APP_EXIT=%ERRORLEVEL%"
pause
exit /b %APP_EXIT%
