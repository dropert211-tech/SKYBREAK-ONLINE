@echo off
cd /d "%~dp0server"
py -m pip install -r requirements.txt
echo.
echo SKYBREAK ZONE NETWORK
echo HTTP + WS: http://127.0.0.1:8000
echo WebSocket: ws://127.0.0.1:8000/ws
echo.
echo For internet hosting, upload this project to GitHub and deploy it with render.yaml.
echo.
py server.py
pause
