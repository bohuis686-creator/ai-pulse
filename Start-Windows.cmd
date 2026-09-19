@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "PULSE_NODE_EXE="
set "PULSE_CHECK_ONLY="
set "PULSE_START_SCRIPT=%~dp0src\start-windows.js"
if /i "%~1"=="--check" set "PULSE_CHECK_ONLY=1"
if /i "%~2"=="--check" set "PULSE_CHECK_ONLY=1"
if not exist "%PULSE_START_SCRIPT%" goto incomplete_project

rem Optional first argument: the full path to a portable/custom node.exe.
if not "%~1"=="" if /i not "%~1"=="--check" set "PULSE_NODE_EXE=%~f1"
if defined PULSE_NODE_EXE if not exist "%PULSE_NODE_EXE%" goto node_failed
if defined PULSE_NODE_EXE goto check_node

rem Prefer PATH, then common installation folders. Never change system PATH.
for /f "delims=" %%N in ('"%SystemRoot%\System32\where.exe" node.exe 2^>nul') do if not defined PULSE_NODE_EXE set "PULSE_NODE_EXE=%%N"
if defined PULSE_NODE_EXE goto check_node
if defined ProgramFiles if exist "%ProgramFiles%\nodejs\node.exe" set "PULSE_NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if defined PULSE_NODE_EXE goto check_node
if defined ProgramFiles(x86) if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PULSE_NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if defined PULSE_NODE_EXE goto check_node
if defined LOCALAPPDATA if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PULSE_NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if defined PULSE_NODE_EXE goto check_node
if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" set "PULSE_NODE_EXE=%NVM_SYMLINK%\node.exe"
if defined PULSE_NODE_EXE goto check_node
if defined PULSE_CHECK_ONLY goto node_not_found

rem A portable Node installation may be anywhere; let the user select it.
rem Keep the selected Unicode path inside PowerShell, without a text round-trip.
echo Node.js was not found automatically. Please select your node.exe in the window.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -Command ^
  "$ErrorActionPreference = 'Stop'; try {" ^
  "Add-Type -AssemblyName System.Windows.Forms;" ^
  "$picker = New-Object System.Windows.Forms.OpenFileDialog;" ^
  "$picker.Title = 'AI Pulse - Select the node.exe you installed';" ^
  "$picker.Filter = 'Node.js executable (node.exe)|node.exe';" ^
  "$picker.CheckFileExists = $true;" ^
  "if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { $picker.Dispose(); Write-Host 'Cancelled. No settings were changed.'; exit 2 };" ^
  "$nodeFile = $picker.FileName; $picker.Dispose();" ^
  "if ([System.IO.Path]::GetFileName($nodeFile) -ine 'node.exe') { throw 'Please select the node.exe file from your Node.js installation.' };" ^
  "Write-Host ('Using Node.js: ' + $nodeFile);" ^
  "& $nodeFile --version; if ($LASTEXITCODE -ne 0) { throw 'Node.js could not start.' };" ^
  "& $nodeFile -e 'process.exit(Number(process.versions.node.split(String.fromCharCode(46))[0]) >= 20 ? 0 : 1)';" ^
  "if ($LASTEXITCODE -ne 0) { throw 'AI Pulse requires Node.js 20 or newer.' };" ^
  "& $nodeFile $env:PULSE_START_SCRIPT; exit $LASTEXITCODE" ^
  "} catch { Write-Host ('AI Pulse: ' + $_.Exception.Message); exit 1 }"
set "PULSE_EXIT_CODE=%ERRORLEVEL%"
goto finish

:check_node
echo Using Node.js: "%PULSE_NODE_EXE%"
"%PULSE_NODE_EXE%" --version
if errorlevel 1 goto node_failed
"%PULSE_NODE_EXE%" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 goto node_too_old
if defined PULSE_CHECK_ONLY exit /b 0

rem Resolve the app relative to this launcher, never the terminal's directory.
"%PULSE_NODE_EXE%" "%PULSE_START_SCRIPT%"
set "PULSE_EXIT_CODE=%ERRORLEVEL%"
goto finish

:node_not_found
echo Node.js was not found in PATH or common installation folders.
echo Double-click this launcher to select your portable node.exe, or pass its full path as an argument.
echo Installer: https://nodejs.org
set "PULSE_EXIT_CODE=1"
goto finish

:node_too_old
echo This Node.js version is too old. AI Pulse requires Node.js 20 or newer.
set "PULSE_EXIT_CODE=1"
goto finish

:node_failed
echo Node.js could not start at: "%PULSE_NODE_EXE%"
echo Check that this path points to the node.exe file, not its folder or ZIP.
set "PULSE_EXIT_CODE=1"
goto finish

:incomplete_project
echo AI Pulse project files are missing. Extract the entire repository ZIP first.
echo Keep Start-Windows.cmd together with the src and web folders.
set "PULSE_EXIT_CODE=1"

:finish
if not defined PULSE_CHECK_ONLY pause
exit /b %PULSE_EXIT_CODE%
