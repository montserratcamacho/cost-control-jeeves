@echo off
echo ==========================================
echo   Iniciando Jeeves Cost Control
echo ==========================================
echo.
echo [1/2] Iniciando Backend en puerto 3001...
start "Jeeves Backend" cmd /k "cd Jeeves-expenses\backend && npm run dev"
echo.
echo [2/2] Iniciando Frontend en puerto 3000...
start "Jeeves Frontend" cmd /k "cd Jeeves-expenses\frontend && npm run dev"
echo.
echo ==========================================
echo Servidores en marcha!
echo Accede a: http://localhost:3000
echo ==========================================
pause
