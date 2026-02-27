#!/bin/bash


export COMPOSE_PROJECT_NAME=ai-kpi-fe

docker-compose -f docker-compose.yaml --env-file .env.docker down