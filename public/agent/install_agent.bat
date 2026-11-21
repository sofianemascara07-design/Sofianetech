@echo off
setlocal EnableExtensions EnableDelayedExpansion
title AutoPro Flash & Diagnostic Hub - Installateur Agent PC J2534 Securise

:: ============================================================================
:: 1. ELEVATION AUTOMATIQUE ADMINISTRATEUR (UAC)
:: ============================================================================
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [AutoPro] Demande d'elevation Administrateur (UAC) pour configurer le Pare-feu Windows...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

cd /d "%~dp0"
echo ============================================================================
echo   AUTOPRO FLASH & DIAGNOSTIC HUB - INSTALLATION AGENT PC J2534 (PORT 38450)
echo ============================================================================
echo.

:: ============================================================================
:: 2. VERIFICATION PYTHON 3
:: ============================================================================
where python >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERREUR] Python 3 est introuvable dans le PATH Windows.
    echo Veuillez installer Python 3.10+ depuis https://www.python.org/downloads/
    echo Cochez "Add python.exe to PATH" lors de l'installation.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PY_VER=%%i
echo [OK] %PY_VER% detecte.

:: ============================================================================
:: 3. INSTALLATION DES DEPENDANCES PYTHON
:: ============================================================================
echo [AutoPro] Installation des paquets Python (fastapi, uvicorn, pywin32, requests)...
python -m pip install --upgrade pip >nul 2>&1
python -m pip install --upgrade fastapi uvicorn pywin32 requests
if %errorLevel% neq 0 (
    echo [ERREUR] Echec installation des dependances pip. Verifiez votre connexion Internet.
    pause
    exit /b 1
)
echo [OK] Dependances Python installees.

:: ============================================================================
:: 4. REPERTOIRE DE SAUVEGARDE OBLIGATOIRE ANTI-BRICKING
:: ============================================================================
if not exist "C:\AutoPro_Backups" (
    mkdir "C:\AutoPro_Backups"
)
echo [OK] Dossier Auto-Backup verifie : C:\AutoPro_Backups

:: ============================================================================
:: 5. CONFIGURATION PARE-FEU WINDOWS STRICT (PORT 38450 LOCALHOST UNIQUEMENT)
:: ============================================================================
echo [AutoPro] Configuration des regles Pare-feu Windows (netsh advfirewall)...
netsh advfirewall firewall delete rule name="AutoPro Agent 38450 Block Public" >nul 2>&1
netsh advfirewall firewall delete rule name="AutoPro Agent 38450 Allow Loopback" >nul 2>&1

:: Bloque toute connexion entrante provenant d'un reseau public ou externe sur TCP 38450
netsh advfirewall firewall add rule name="AutoPro Agent 38450 Block Public" dir=in action=block protocol=TCP localport=38450 remoteip=any profile=public,private,domain enable=yes >nul
:: Autorise uniquement le trafic local loopback (127.0.0.1)
netsh advfirewall firewall add rule name="AutoPro Agent 38450 Allow Loopback" dir=in action=allow protocol=TCP localip=127.0.0.1 localport=38450 remoteip=127.0.0.1 enable=yes >nul
echo [OK] Pare-feu configure : trafic externe/public bloque sur TCP 38450, loopback 127.0.0.1 autorise.

:: ============================================================================
:: 6. GENERATION OU LECTURE DES CLES DE SESSION (AUCUN SECRET CODE EN DUR)
:: ============================================================================
if "%AUTOPRO_TOKEN%"=="" (
    for /f "delims=" %%t in ('powershell -NoProfile -Command "$b = New-Object byte[] 24; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b) -replace '\+','-' -replace '/','_' -replace '=',''"') do set "AUTOPRO_TOKEN=%%t"
)
if "%AUTOPRO_HMAC_SECRET%"=="" (
    for /f "delims=" %%h in ('powershell -NoProfile -Command "$b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''"') do set "AUTOPRO_HMAC_SECRET=%%h"
)
if "%AUTOPRO_CLOUD_API_URL%"=="" (
    set "AUTOPRO_CLOUD_API_URL=https://autoprodz-a7071.web.app"
)

if not exist "%~dp0agent_server.py" (
    echo [AutoPro] Telechargement de agent_server.py depuis %AUTOPRO_CLOUD_API_URL%...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri '%AUTOPRO_CLOUD_API_URL%/agent/agent_server.py' -OutFile '%~dp0agent_server.py'"
)

echo.
echo ============================================================================
echo   JETON D'APPAIRAGE & SECRET HMAC (A COPIER DANS VOTRE SESSION WEB)
echo   AUTOPRO_TOKEN       = %AUTOPRO_TOKEN%
echo   AUTOPRO_HMAC_SECRET = %AUTOPRO_HMAC_SECRET%
echo ============================================================================
echo.

:: ============================================================================
:: 7. LANCEMENT EN ARRIERE-PLAN SUR 127.0.0.1:38450
:: ============================================================================
echo [AutoPro] Demarrage de l'Agent FastAPI J2534 sur http://127.0.0.1:38450 ...
start "AutoPro J2534 Agent" /MIN cmd /c "python "%~dp0agent_server.py""
timeout /t 2 /nobreak >nul
echo [OK] Agent lance en arriere-plan. Vous pouvez revenir sur AutoPro Flash Hub.
pause
