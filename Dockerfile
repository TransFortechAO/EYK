FROM python:3.11-slim

# Definir diretório de trabalho
WORKDIR /app

# Variáveis de ambiente para evitar pycache e buffers
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
  && rm -rf /var/lib/apt/lists/*

# Copiar ficheiros de requisitos e instalar
COPY EYK/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip setuptools wheel
RUN if [ -s /app/requirements.txt ]; then pip install -r /app/requirements.txt; fi

# Copiar aplicação
COPY . /app

# Criar diretório para logs
RUN mkdir -p /app/logs

# Entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

CMD ["/entrypoint.sh"]
