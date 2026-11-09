@echo off
chcp 65001 >nul
cd /d "%~dp0"
title NEXO CLOUD - Installation et lancement
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 ou plus recent est necessaire.
  echo Telecharge-le sur https://nodejs.org/
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo.
  echo Le fichier .env vient d'etre cree.
  echo Ouvre-le et remplace ADMIN_PASSWORD par ton mot de passe.
  echo Puis relance ce fichier .bat.
  pause
  exit /b 0
)
if not exist node_modules (
  echo Installation des dependances...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo.
echo Demarrage de NEXO CLOUD...
echo Ouvre http://localhost:3000 dans ton navigateur.
echo Pour arreter le serveur, ferme cette fenetre.
echo.
call npm start
pause
