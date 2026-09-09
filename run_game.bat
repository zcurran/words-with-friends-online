@echo off
title Words with Friends Web Server
cd /d "%~dp0"

if not exist server\Server.exe (
    echo Compiling standalone server...
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe /out:server\Server.exe server\Server.cs
)

echo Starting Words with Friends Game Server...
start "" "http://localhost:8080/"
server\Server.exe 8080
