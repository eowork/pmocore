@echo off
rem Shim for Nuxt DevTools' "open in editor" so it reaches WebStorm.
rem
rem The launch-editor package (used by DevTools and the Vite overlay) emits
rem "--line N --column M <file>" for every JetBrains IDE. WebStorm 2026.2 rejects that
rem with "unrecognized option: --line" and exits 1, because its launcher grammar is
rem   [<project dir>|--temp-project] [--wait] [--line N] [--column M] <file>
rem so the positional options are only valid after a project directory.
rem
rem Because this script's basename matches none of launch-editor's known editors, it is
rem invoked through the generic LAUNCH_EDITOR path instead, which passes the arguments
rem positionally: %1 = file, %2 = line, %3 = column. We reorder them and insert the
rem project directory that WebStorm needs.
setlocal

rem Default to the repository root two levels up (the directory holding .idea), which is
rem the project WebStorm actually has open. Passing an already-open project reuses that
rem window instead of spawning a second one. Override with WEBSTORM_PROJECT_DIR if your
rem WebStorm project root is somewhere else.
for %%I in ("%~dp0..\..") do set "PROJECT_DIR=%%~fI"
if not "%WEBSTORM_PROJECT_DIR%"=="" set "PROJECT_DIR=%WEBSTORM_PROJECT_DIR%"

rem The overlay omits line/column for some matches; WebStorm needs concrete numbers.
set "LINE=%~2"
if "%LINE%"=="" set "LINE=1"
set "COLUMN=%~3"
if "%COLUMN%"=="" set "COLUMN=1"

rem Toolbox installs put a `webstorm.exe` shim on PATH; a standalone/bin-dir install
rem only gives you `webstorm.bat` in the IDE's own bin\ folder. Try both so the script
rem works regardless of how WebStorm was installed on this machine.
where webstorm.exe >nul 2>nul
if %ERRORLEVEL%==0 (
  webstorm.exe "%PROJECT_DIR%" --line %LINE% --column %COLUMN% "%~1"
) else (
  webstorm.bat "%PROJECT_DIR%" --line %LINE% --column %COLUMN% "%~1"
)
exit /b %ERRORLEVEL%
