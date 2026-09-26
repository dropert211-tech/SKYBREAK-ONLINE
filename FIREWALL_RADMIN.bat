@echo off
echo Creating Windows Firewall rules for SKYBREAK...
netsh advfirewall firewall add rule name="SKYBREAK HTTP 8000" dir=in action=allow protocol=TCP localport=8000
netsh advfirewall firewall add rule name="SKYBREAK WebSocket 8001" dir=in action=allow protocol=TCP localport=8001
echo.
echo Done. Run this file as Administrator on the host PC.
pause
