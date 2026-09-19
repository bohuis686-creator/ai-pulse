@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "PULSE_NODE_EXE="

rem Optional first argument: full path to a portable/custom node.exe.
if not "%~1"=="" if /i not "%~1"=="--check" set "PULSE_NODE_EXE=%~f1"
if defined PULSE_NODE_EXE if not exist "%PULSE_NODE_EXE%" goto node_failed
if defined PULSE_NODE_EXE goto check_node

rem Prefer the Node executable selected by the user's current PATH.
for /f "delims=" %%N in ('"%SystemRoot%\System32\where.exe" node.exe 2^>nul') do if not defined PULSE_NODE_EXE set "PULSE_NODE_EXE=%%N"
if defined PULSE_NODE_EXE goto check_node

rem An installer may not have refreshed Explorer's PATH yet.
if defined ProgramFiles if exist "%ProgramFiles%\nodejs\node.exe" set "PULSE_NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if defined PULSE_NODE_EXE goto check_node
if defined ProgramFiles(x86) if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PULSE_NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if defined PULSE_NODE_EXE goto check_node
if defined LOCALAPPDATA if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PULSE_NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if defined PULSE_NODE_EXE goto check_node
if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" set "PULSE_NODE_EXE=%NVM_SYMLINK%\node.exe"
if defined PULSE_NODE_EXE goto check_node

echo Node.js was not found in PATH or common installation folders.
echo If you just installed Node.js, open a new terminal and run: node --version
echo If you only downloaded the installer, run it to finish installation.
echo For a custom installation, add its folder to PATH and reopen this launcher.
echo Or pass the full path as the first argument to Start-Windows.cmd.
echo Installer: https://nodejs.org
if /i not "%~1"=="--check" pause
exit /b 1

:check_node
echo Using Node.js: "%PULSE_NODE_EXE%"
"%PULSE_NODE_EXE%" --version
if errorlevel 1 goto node_failed
"%PULSE_NODE_EXE%" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 goto node_too_old
if /i "%~1"=="--check" exit /b 0
if /i "%~2"=="--check" exit /b 0

rem This helper validates PORT and opens the browser after the server starts.
"%PULSE_NODE_EXE%" src/start-windows.js
set "PULSE_EXIT_CODE=%ERRORLEVEL%"
pause
exit /b %PULSE_EXIT_CODE%

:node_too_old
echo This Node.js version is too old. AI Pulse requires Node.js 20 or newer.
if /i not "%~1"=="--check" pause
exit /b 1

:node_failed
echo Node.js was found but could not start. Check the installation shown above.
if /i not "%~1"=="--check" pause
exit /b 1
