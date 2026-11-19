# Multi-stage build для минимизации размера
FROM python:3.11-slim as builder

# Установка системных зависимостей для сборки
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    libportaudio2 \
    portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

# Создание виртуального окружения
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Копирование и установка зависимостей
COPY requirements.txt requirements.lock /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.lock

# Финальный образ
FROM python:3.11-slim

# Метаданные
LABEL maintainer="R6AAF"
LABEL description="Yaesu Web Pult - Remote control for Yaesu transceivers"
LABEL version="3.2-preview"

# Установка runtime зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends \
    libportaudio2 \
    && rm -rf /var/lib/apt/lists/*

# Копирование виртуального окружения из builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Создание пользователя приложения
RUN useradd -m -u 1000 ftx1 && \
    mkdir -p /app /data && \
    chown -R ftx1:ftx1 /app /data

# Рабочая директория
WORKDIR /app

# Копирование кода приложения
COPY --chown=ftx1:ftx1 server/ ./server/
COPY --chown=ftx1:ftx1 web/ ./web/
COPY --chown=ftx1:ftx1 requirements.txt version_info.txt ./

# Переключение на непривилегированного пользователя
USER ftx1

# Том для данных (конфиг, записи, логи)
VOLUME ["/data"]

# Порты
EXPOSE 8080 8443

# Переменные окружения
ENV PYTHONUNBUFFERED=1 \
    FTX_BASE_DIR=/data \
    FTX_SIMULATE=false

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/ping').read()"

# Запуск
CMD ["python", "server/main.py", "--console"]
