@echo off
cd /d "%~dp0"
echo Starting Udyam Digital prototype on http://localhost:8000 ...
echo (keep this window open while you use the app; close it to stop)
start "" cmd /c "timeout /t 2 > NUL & start http://localhost:8000"
where python > NUL 2> NUL
if %errorlevel%==0 (python server.py) else (py server.py)
pause
