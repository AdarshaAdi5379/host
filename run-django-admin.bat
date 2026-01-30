@echo off
REM Run Django as Administrator
REM This script activates the virtual environment and starts Django

cd /d "%~dp0backend"
call venv\Scripts\activate.bat
python manage.py runserver 8000
