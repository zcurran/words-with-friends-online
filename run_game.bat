@echo off
title Words with Friends Web Server (Node.js & Socket.io)
cd /d "%~dp0"

echo Starting Words with Friends Game Server (Node.js + Socket.io)...
start "" "http://localhost:8080/"

where node >nul 2>nul
if %errorlevel% equ 0 (
    node server\server.js
    goto :eof
)

if exist "C:\Users\zcurr\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64\node.exe" (
    "C:\Users\zcurr\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64\node.exe" server\server.js
    goto :eof
)

echo Node.js not found in PATH, launching standalone fallback...
server\Server.exe 8080
