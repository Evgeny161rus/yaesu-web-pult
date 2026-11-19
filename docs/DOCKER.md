# Docker развёртывание Yaesu Web Pult

## Быстрый старт

### Симулятор (без трансивера)

```bash
docker run -d \
  --name yaesu-web-pult \
  -p 8080:8080 \
  -p 8443:8443 \
  -e FTX_SIMULATE=true \
  yaesu-web-pult:3.2-preview
```

Откройте http://localhost:8080

### С реальным трансивером

1. Определите COM-порт трансивера:
```bash
# Linux
ls -l /dev/ttyUSB*

# Windows (в PowerShell)
Get-WmiObject Win32_SerialPort | Select Name,DeviceID
```

2. Запустите с docker-compose:
```bash
# Отредактируйте docker-compose.yml - укажите правильный device
docker-compose up -d
```

3. Откройте панель управления:
```
http://localhost:8080/panel.html
```

## Сборка образа

```bash
docker build -t yaesu-web-pult:3.2-preview .
```

Опции оптимизации:
```bash
# С кэшированием BuildKit
DOCKER_BUILDKIT=1 docker build -t ftx1-pult:3.2-preview .

# Multi-platform сборка (для Raspberry Pi)
docker buildx build --platform linux/amd64,linux/arm64 -t ftx1-pult:3.2-preview .
```

## Конфигурация

### Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `FTX_SIMULATE` | `false` | Режим симулятора |
| `FTX_BASE_DIR` | `/data` | Директория для данных |
| `FTX_HTTP_PORT` | `8080` | HTTP порт |
| `FTX_HTTPS_PORT` | `8443` | HTTPS порт |
| `TZ` | `UTC` | Часовой пояс |

### Тома

```bash
docker volume create ftx1-data
docker volume inspect ftx1-data
```

Структура `/data`:
```
/data/
├── config.json          # Конфигурация
├── cert.pem, key.pem    # SSL сертификаты
├── ftx1-pult.log        # Логи
├── records/             # Записи связей
├── sstv/                # SSTV изображения
├── fax/                 # Метеофакс
└── memory/              # Каналы памяти
```

### Доступ к USB устройствам

#### Linux

Без privileged (рекомендуется):
```yaml
devices:
  - /dev/ttyUSB0:/dev/ttyUSB0
group_add:
  - dialout  # или audio
```

С privileged (если не работает):
```yaml
privileged: true
volumes:
  - /dev:/dev
```

#### Windows + WSL2

1. Установите [usbipd-win](https://github.com/dorssel/usbipd-win)
2. Подключите USB к WSL:
```powershell
usbipd list
usbipd bind --busid 1-1
usbipd attach --wsl --busid 1-1
```

3. В WSL проверьте:
```bash
ls -l /dev/ttyUSB*
```

## Примеры использования

### Разработка с hot-reload

```bash
docker run -it --rm \
  --name ftx1-dev \
  -p 8080:8080 \
  -v $(pwd)/server:/app/server \
  -v $(pwd)/web:/app/web \
  -e FTX_SIMULATE=true \
  ftx1-pult:3.2-preview \
  python server/main.py --console
```

### Производственное развёртывание

```yaml
version: '3.8'
services:
  ftx1-pult:
    image: ftx1-pult:3.2-preview
    restart: always
    ports:
      - "8080:8080"
      - "8443:8443"
    volumes:
      - ftx1-data:/data
    environment:
      - TZ=Europe/Moscow
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/ping')"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### С reverse proxy (nginx)

```nginx
upstream ftx1 {
    server localhost:8080;
}

server {
    listen 443 ssl http2;
    server_name ftx1.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://ftx1;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Мониторинг

### Логи

```bash
# Просмотр логов
docker logs ftx1-pult

# Следить за логами
docker logs -f ftx1-pult

# Логи из volume
docker exec ftx1-pult tail -f /data/ftx1-pult.log
```

### Статус

```bash
# Проверка здоровья
docker inspect --format='{{.State.Health.Status}}' ftx1-pult

# Статистика ресурсов
docker stats ftx1-pult
```

### Prometheus метрики (опционально)

Добавить в `docker-compose.yml`:
```yaml
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
```

## Troubleshooting

### Нет доступа к COM-порту

```bash
# Проверка permissions
docker exec ftx1-pult ls -l /dev/ttyUSB0

# Добавление в группу dialout
docker exec -u root ftx1-pult usermod -a -G dialout ftx1

# Перезапуск
docker restart ftx1-pult
```

### Проблемы со звуком

```bash
# Проверка audio устройств
docker exec ftx1-pult python -c "import sounddevice as sd; print(sd.query_devices())"

# Запуск с host network (временно для диагностики)
docker run --rm --network host ftx1-pult:3.2-preview python server/main.py --list
```

### Отладка

```bash
# Интерактивная сессия
docker exec -it ftx1-pult /bin/bash

# Запуск с verbose логами
docker run -it --rm \
  -e PYTHONUNBUFFERED=1 \
  ftx1-pult:3.2-preview \
  python server/main.py --console --verbose
```

## Безопасность

### Рекомендации

1. **Не используйте privileged** без необходимости
2. **Ограничьте ресурсы** через deploy.resources
3. **Регулярно обновляйте** базовый образ Python
4. **Используйте secrets** для паролей:

```bash
echo "mypassword" | docker secret create ftx1_password -
```

```yaml
secrets:
  - ftx1_password

environment:
  - FTX_PASSWORD_FILE=/run/secrets/ftx1_password
```

### Сканирование уязвимостей

```bash
# Trivy
trivy image ftx1-pult:3.2-preview

# Docker Scout
docker scout cves ftx1-pult:3.2-preview
```

## Обновление

```bash
# Остановка
docker-compose down

# Обновление образа
docker pull ftx1-pult:latest  # если используете registry
# или
docker build -t ftx1-pult:3.2-preview .

# Запуск с сохранением данных
docker-compose up -d
```

## Multi-architecture

Для Raspberry Pi (ARM64):

```bash
# Настройка buildx
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap

# Сборка для ARM64
docker buildx build \
  --platform linux/arm64 \
  -t ftx1-pult:3.2-preview-arm64 \
  --load .

# Push в registry
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t yourregistry/ftx1-pult:3.2-preview \
  --push .
```
