@echo off
REM run_services.bat - ativa o virtualenv e inicia Django, Celery worker e Celery beat em janelas PowerShell separadas, com logs

SETLOCAL ENABLEDELAYEDEXPANSION

REM Diretório do script (sem a parte final) e muda para esse diretório
SET SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM Caminho para o script de activação do venv (PowerShell)
SET VENV_ACTIVATE_PS=%CD%\env\Scripts\Activate.ps1

IF NOT EXIST "%VENV_ACTIVATE_PS%" (
  echo ERRO: Activate.ps1 nao encontrado em "%VENV_ACTIVATE_PS%"
  echo Tenta activar manualmente no PowerShell: .\env\Scripts\Activate.ps1
  pause
  exit /b 1
)

REM Criar pasta de logs se nao existir
IF NOT EXIST "%CD%\logs" (
  mkdir "%CD%\logs"
)

REM Iniciar o servidor de desenvolvimento Django (PowerShell, com log)
start "Django" powershell -NoExit -Command "Set-Location -LiteralPath '%CD%'; & '%VENV_ACTIVATE_PS%'; python EYK\manage.py runserver 0.0.0.0:8000 *> '%CD%\logs\django.log'"

REM Iniciar Celery worker (PowerShell, com -P solo para compatibilidade no Windows) e log
start "Celery Worker" powershell -NoExit -Command "Set-Location -LiteralPath '%CD%'; & '%VENV_ACTIVATE_PS%'; celery -A EYK worker -l info -P solo *> '%CD%\logs\celery_worker.log'"

REM Iniciar Celery beat (PowerShell, com log)
start "Celery Beat" powershell -NoExit -Command "Set-Location -LiteralPath '%CD%'; & '%VENV_ACTIVATE_PS%'; celery -A EYK beat -l info *> '%CD%\logs\celery_beat.log'"

echo Servicos iniciados. Verifica as janelas PowerShell abertas e os logs em %CD%\logs\
ENDLOCAL
exit /b 0
