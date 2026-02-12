@echo off
setlocal enabledelayedexpansion

REM AI CLI Assistant Installation Script for Windows
REM This script installs the ai-cli-assistant globally and sets up shell integration

echo 🤖 Installing AI CLI Assistant...

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js 16+ first.
    echo Visit: https://nodejs.org/
    exit /b 1
)

echo ✓ Node.js version check passed

REM Install the package globally
echo Installing ai-cli-assistant globally...
npm install -g ai-cli-assistant

if %ERRORLEVEL% neq 0 (
    echo Error: Global installation failed
    exit /b 1
)

echo ✓ Global installation completed

REM Create batch file wrapper
echo Creating Windows batch file wrapper...
set AI_CMD_PATH=where ai
for /f "tokens=*" %%i in ('where ai') do set AI_CMD_PATH=%%i

set WRAPPER_DIR=%USERPROFILE%\.ai-cli\bin
if not exist "%WRAPPER_DIR%" mkdir "%WRAPPER_DIR%"

(
echo @echo off
echo node "%AI_CMD_PATH%" %%*
) > "%WRAPPER_DIR%\ai.bat"

echo ✓ Windows wrapper created

REM Add to PATH if not already there
echo %PATH% | findstr /C:"%WRAPPER_DIR%" >nul
if %ERRORLEVEL% neq 0 (
    echo Adding %WRAPPER_DIR% to PATH...
    setx PATH "%PATH%;%WRAPPER_DIR%"
    echo ✓ Added to PATH
)

REM Set up PowerShell integration
echo Setting up PowerShell integration...
ai install --shell powershell

if %ERRORLEVEL% neq 0 (
    echo Warning: PowerShell integration failed. You can run 'ai install --shell powershell' manually.
) else (
    echo ✓ PowerShell integration completed
)

REM Verify installation
echo Verifying installation...
ai --version

if %ERRORLEVEL% neq 0 (
    echo Error: Installation verification failed
    exit /b 1
)

echo.
echo 🎉 AI CLI Assistant installed successfully!
echo.
echo Quick Start:
echo   ai suggest "list all files in current directory"
echo   ai vault list
echo   ai debug
echo.
echo Configuration:
echo   • Commands are stored in: %USERPROFILE%\.ai-cli\
echo   • Configure AI key: set OPENAI_API_KEY=your_key
echo   • For help: ai --help
echo.
echo Note: You may need to restart your terminal for PATH changes to take effect.