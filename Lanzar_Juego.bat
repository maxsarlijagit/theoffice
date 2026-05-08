@echo off
title Lanzador The Office - TechArt
echo ==========================================
echo   Lanzando El Motor de The Office...
echo ==========================================
echo.
echo [1/3] Limpiando procesos antiguos...
taskkill /F /IM node.exe /T >nul 2>&1
echo [2/3] Verificando dependencias...
echo.
cmd /c "npm install"
echo.
echo [3/3] Iniciando Servidor y Cliente...
echo.
echo RECUERDA: Una vez que cargue, abre en tu navegador:
echo 👉 http://localhost:5173
echo.
cmd /c "npm run dev"
pause
