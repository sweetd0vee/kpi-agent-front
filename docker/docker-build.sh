#!/usr/bin/env bash

set -e

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

docker build -t sber/ai-kpi-fe:master -f "$repo_root/docker/Dockerfile" "$repo_root"