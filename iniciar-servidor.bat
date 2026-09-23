@echo off
rem Arranca el servidor de desarrollo local de tarkov.dev (http://localhost:3000)
rem Usa la carpeta donde esta este archivo, asi funciona aunque se mueva el repo.
cd /d "%~dp0"

if not exist ".env" (
    echo Creando .env a partir de .env.example...
    copy ".env.example" ".env" >nul
)

if not exist "node_modules" (
    echo Instalando dependencias...
    call pnpm install || goto error
)

call pnpm start || goto error
goto :eof

:error
echo.
echo Ha ocurrido un error al arrancar el servidor.
pause
