@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py
  goto :end
)
echo Python 3.10+ nao encontrado. Instale Python pelo site oficial python.org.
pause
:end
endlocal
