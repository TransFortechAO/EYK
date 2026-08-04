#!/bin/sh

set -e

until python manage.py inspectdb > /dev/null 2>&1; do
  >&2 echo "Banco de dados ainda não está disponível - aguardando..."
  sleep 1
done

>&2 echo "Banco de dados está disponível!"
exec "$@"