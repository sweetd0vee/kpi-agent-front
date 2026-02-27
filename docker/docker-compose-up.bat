@echo off
setlocal

set "script_dir=%~dp0"
pushd "%script_dir%"
set "COMPOSE_PROJECT_NAME=sokol-fe"

docker-compose -f docker-compose.yml --env-file .env up -d

popd
if errorlevel 1 exit /b 1
endlocal