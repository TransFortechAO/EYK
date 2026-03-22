@echo off
REM run_celery_redis.bat - inicia Redis, Celery worker e Celery beat em janelas separadas

SETLOCAL ENABLEDELAYEDEXPANSION

REM Diretório do script
SET SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM Caminho para o script de activação do venv (PowerShell)
SET VENV_ACTIVATE_PS=%CD%\EYK\venv\Scripts\Activate.ps1

IF NOT EXIST "%VENV_ACTIVATE_PS%" (
  echo ERRO: Activate.ps1 nao encontrado em "%VENV_ACTIVATE_PS%"
  echo Tenta activar manualmente no PowerShell: .\EYK\venv\Scripts\Activate.ps1
  pause
  exit /b 1
)

REM Criar pasta de logs se nao existir
IF NOT EXIST "%CD%\logs" (
  mkdir "%CD%\logs"
)

REM Iniciar Redis (assumindo que redis-server.exe está no PATH ou em C:\Redis)
start "Redis" cmd /c "redis-server.exe"

REM Iniciar Celery worker
start "Celery Worker" powershell -NoExit -Command "Set-Location -LiteralPath '%CD%\EYK'; & '%VENV_ACTIVATE_PS%'; celery -A EYK worker -l info *> '%CD%\logs\celery_worker.log'"

REM Iniciar Celery beat
start "Celery Beat" powershell -NoExit -Command "Set-Location -LiteralPath '%CD%\EYK'; & '%VENV_ACTIVATE_PS%'; celery -A EYK beat -l info *> '%CD%\logs\celery_beat.log'"

echo Servicos Redis, Celery Worker e Celery Beat iniciados. Verifica as janelas abertas e os logs em %CD%\logs\
ENDLOCAL
exit /b 0