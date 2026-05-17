@echo off
cd /d "%~dp0"
start /b node agent.js > agent.log 2>&1
echo Agent started