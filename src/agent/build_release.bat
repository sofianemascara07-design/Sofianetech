@echo off
setlocal enabledelayedexpansion
title AutoPro DZ Agent — Compilation Executable Windows (.exe)
color 0B

echo ============================================================================
echo   AUTOPRO DZ AGENT ^& CLOUD — PACKAGING WINDOWS AUTONOME (PYINSTALLER)
echo ============================================================================
echo.

REM 1. Verification de Python 3.10+
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python n'est pas installe ou absent du PATH Windows.
    pause
    exit /b 1
)

REM 2. Verification des binaires ADB obligatoires (adb.exe + DLLs)
if not exist "adb_tools\adb.exe" (
    echo [ERREUR] Fichier manquant : adb_tools\adb.exe
    echo Placez adb.exe, AdbWinApi.dll et AdbWinUsbApi.dll dans le dossier adb_tools\
    pause
    exit /b 1
)
if not exist "adb_tools\AdbWinApi.dll" (
    echo [ERREUR] Fichier manquant : adb_tools\AdbWinApi.dll
    pause
    exit /b 1
)
if not exist "adb_tools\AdbWinUsbApi.dll" (
    echo [ERREUR] Fichier manquant : adb_tools\AdbWinUsbApi.dll
    pause
    exit /b 1
)

REM 3. Creation environnement virtuel isole et installation des dependances
if not exist ".venv_build" (
    echo [1/4] Creation de l'environnement virtuel .venv_build...
    python -m venv .venv_build
)
call .venv_build\Scripts\activate.bat

echo [2/4] Mise a jour de pip et installation de requirements.txt...
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERREUR] Echec installation des dependances Python.
    pause
    exit /b 1
)

REM 4. Nettoyage anciens artefacts et compilation PyInstaller --onefile --noconsole
echo [3/4] Nettoyage anciens builds...
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"
if exist "AutoPro_DZ_Agent.spec" del /q "AutoPro_DZ_Agent.spec"

echo [4/4] Compilation de AutoPro_DZ_Agent.exe (avec ADB embarque)...
pyinstaller ^
  --noconfirm ^
  --clean ^
  --onefile ^
  --noconsole ^
  --name "AutoPro_DZ_Agent" ^
  --add-binary "adb_tools\adb.exe;." ^
  --add-binary "adb_tools\AdbWinApi.dll;." ^
  --add-binary "adb_tools\AdbWinUsbApi.dll;." ^
  --hidden-import "websockets" ^
  --hidden-import "cryptography.hazmat.primitives.ciphers.aead" ^
  --hidden-import "serial.tools.list_ports" ^
  --hidden-import "psutil" ^
  autopro_agent.py

if errorlevel 1 (
    echo [ERREUR] La compilation PyInstaller a echoue.
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo   SUCCES ! Executable autonome pret : dist\AutoPro_DZ_Agent.exe
echo   Aucune installation Python ni ADB requise sur le PC du garagiste.
echo ============================================================================
pause
