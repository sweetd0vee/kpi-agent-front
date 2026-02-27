#!/bin/bash


export COMPOSE_PROJECT_NAME=sokol-fe

docker-compose -f docker-compose.yaml --env-file .env.docker down