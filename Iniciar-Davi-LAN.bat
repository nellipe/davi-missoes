@echo off
setlocal
cd /d "%~dp0"
rem Opt-in explicito; nao instala nem configura nada no Windows.
set "DAVI_LAN_SIMPLE=1"
set "DAVI_HOST=192.168.2.10"
set "DAVI_PORT=8765"
set "DAVI_LAN_CIDR=192.168.2.0/24"
set "DAVI_ORIGINS=http://192.168.2.10:8765"
set "DAVI_PROXY_KEY="
rem Usa sempre os dados existentes ao lado deste inicializador.
set "DAVI_DATA_DIR=%~dp0dados"
call "%~dp0Iniciar-Davi.bat"
if errorlevel 1 (
  echo Nao foi possivel iniciar. Confira o IP 192.168.2.10 e se a porta 8765 esta livre.
  pause
)
endlocal
