@echo off
setlocal

set "script_dir=%~dp0"
set "repo_root=%script_dir%.."
for %%I in ("%repo_root%") do set "repo_root=%%~fI"

docker build -t sber/sokol-fe:master -f "%repo_root%\docker\Dockerfile" "%repo_root%"

if errorlevel 1 exit /b 1
endlocal
