@echo off
title Kush Quest Server
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org  then run this again. & pause & exit /b)
start "" http://localhost:3000
node server.js
pause
