@echo off
setlocal EnableDelayedExpansion

:: Image Manipulator - Electron Build Script
:: Builds standalone .exe for Windows

echo.
echo ========================================
echo   Image Manipulator - Build Installer
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

:: Check if Electron Builder is installed
if not exist "node_modules\electron-builder" (
    echo Installing Electron Builder...
    npm install electron-builder --save-dev
    if errorlevel 1 (
        echo ERROR: Failed to install Electron Builder
        pause
        exit /b 1
    )
)

:: Build the application
echo.
echo Building Windows executable...
echo This may take several minutes...
echo.

npm run build:win

if errorlevel 1 (
    echo.
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Build Complete!
echo ========================================
echo.
echo Your executable files are in the "dist" folder:
echo.
dir /b dist\*.exe 2>nul
echo.
echo Installation options:
echo   - NSIS Installer: dist\Image Rotator Setup *.exe
echo   - Portable: dist\Image Rotator *.exe
echo.
echo You can now distribute these files to users.
echo No installation required for portable version.
echo.

pause
exit /b 0
