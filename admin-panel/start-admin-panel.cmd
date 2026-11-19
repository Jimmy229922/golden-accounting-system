@echo off
title Golden Accounting - Admin Control Panel
cd /d "%~dp0"
start "" "http://127.0.0.1:5588"
node server.js
pause
