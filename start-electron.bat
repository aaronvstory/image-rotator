@echo off
setlocal EnableDelayedExpansion

:: Image Manipulator - Electron Desktop Launch Script
:: Launches the application in Electron desktop mode

echo.
echo ========================================
echo   Image Manipulator - Electron Mode
echo ========================================
echo.

:: Change to the correct directory
cd /d "%~dp0"
echo Working directory: %CD%

:: Check if Node.js is available
echo Checking Node.js availability...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if dependencies are installed
echo Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Check if Electron is installed
if not exist "node_modules\electron" (
    echo Installing Electron...
    npm install electron --save-dev
    if errorlevel 1 (
        echo ERROR: Failed to install Electron
        pause
        exit /b 1
    )
)

:: Launch Electron
echo.
echo Starting Image Manipulator in desktop mode...
echo.

npm start

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start Electron application
    pause
    exit /b 1
)

exit /b 0
