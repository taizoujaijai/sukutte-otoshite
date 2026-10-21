@echo off
cd /d "%~dp0prototypes"
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5181/prototypes/"
python serve.py 5181
