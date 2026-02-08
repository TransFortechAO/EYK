#!/usr/bin/env bash
set -e

# entrypoint.sh - usado por Docker para preparar o container
cd /app

# Espera pelo serviço de rede (opcional): pode-se adicionar wait-for-it se necessário

# Ativa o ambiente virtual de sistema (não necessário no container)

# Executa migrations (silencioso) e coleta static se necessário
python EYK/manage.py migrate --noinput || true
python EYK/manage.py collectstatic --noinput || true

# Executa o comando do container
exec "$@"
