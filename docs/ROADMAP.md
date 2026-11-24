# 🗺️ Yaesu Web Pult - Roadmap

> ⚠️ Ранний план. Часть пунктов уже реализована (native CAT, RTL-SDR, Raspberry Pi,
> DX-споты), часть сделана иначе; Hamlib сохранён как основа поддержки разных
> трансиверов. Актуальное состояние и функции — README.md и CHANGELOG.md.

## Версия 3.3.0 - Native CAT + RTL-SDR (Приоритет: Высокий)

**Цель:** Убрать зависимость от Hamlib, добавить RTL-SDR для водопада

**Сроки:** 1-2 месяца

### 1. Уход от Hamlib → Native CAT протоколы

**Проблема:**
- Hamlib требует установки (rigctld на Linux/RPi)
- Дополнительный процесс, сложность настройки
- Задержки в передаче команд

**Решение:**
```
server/cat/
├── ftx1.py          # FTX-1 нативный протокол (уже есть)
├── ft710.py         # FT-710 CAT протокол
├── ftdx10.py        # FTDX10 CAT протокол
├── ft991.py         # FT-991/A CAT протокол
├── ft891.py         # FT-891 CAT протокол
├── ft450.py         # FT-450 CAT протокол
└── base.py          # Базовый класс для всех протоколов
```

**Задачи:**
- [ ] Изучить CAT протоколы для каждой модели (мануалы Yaesu)
- [ ] Создать базовый класс `YaesuCAT` с общими методами
- [ ] Реализовать протокол FT-710 (приоритет #1)
- [ ] Реализовать протокол FTDX10 (аналогичен FT-710)
- [ ] Реализовать протокол FT-991/A
- [ ] Реализовать протокол FT-891
- [ ] Миграция с Hamlib на native в `station.py`
- [ ] Тесты для каждого протокола

**Преимущества:**
- ✅ Не нужно ничего устанавливать дополнительно
- ✅ Прямая работа через COM-порт
- ✅ Быстрее отклик
- ✅ Меньше зависимостей

---

### 2. Поддержка RTL-SDR для водопада

**Цель:** Широкий водопад (±1.2 MHz) для моделей без USB scope

**Реализация:**
```python
# server/sdr/rtlsdr.py

import numpy as np
from rtlsdr import RtlSdr

class RtlSdrWaterfall:
    """RTL-SDR водопад с автонастройкой на частоту ТРХ"""
    
    def __init__(self, config):
        self.sdr = RtlSdr()
        self.sdr.sample_rate = config.get('sample_rate', 2.4e6)
        self.sdr.center_freq = 14.2e6  # Начальная частота
        self.sdr.gain = config.get('gain', 'auto')
        self.enabled = False
        
    def set_frequency(self, freq_hz):
        """Следовать за частотой трансивера"""
        if self.enabled:
            self.sdr.center_freq = freq_hz
    
    def get_spectrum(self):
        """Получить FFT спектр"""
        samples = self.sdr.read_samples(256 * 1024)
        fft_data = np.fft.fftshift(np.fft.fft(samples))
        spectrum = 20 * np.log10(np.abs(fft_data) + 1e-12)
        return spectrum[::256]  # Децимация до 1024 точек
```

**Задачи:**
- [ ] Добавить `pyrtlsdr` в requirements.txt
- [ ] Создать модуль `server/sdr/rtlsdr.py`
- [ ] Интеграция в `station.py` (выбор источника waterfall)
- [ ] UI в `web/panel.html` для настройки SDR
- [ ] Автоматическое следование за частотой ТРХ
- [ ] Тесты на Windows/Linux/RPi
- [ ] Документация по подключению RTL-SDR

**Конфигурация:**
```json
{
  "waterfall_source": "auto",  // auto, audio, scope, sdr
  "sdr": {
    "enabled": true,
    "type": "rtlsdr",
    "device_index": 0,
    "sample_rate": 2400000,
    "gain": "auto",
    "ppm_correction": 0,
    "follow_trx": true
  }
}
```

---

### 3. Тестирование на Raspberry Pi

**Цель:** Проверить работу на реальном железе RPi

**Платформы:**
- Raspberry Pi 3 (1GB RAM)
- Raspberry Pi 4 (4GB RAM)
- Raspberry Pi 5 (8GB RAM)

**Тесты:**
- [ ] Установка зависимостей
- [ ] CAT управление (USB Serial)
- [ ] USB Audio работа
- [ ] Waterfall производительность
- [ ] FT8 декодирование
- [ ] SSTV прием
- [ ] RTL-SDR водопад
- [ ] Нагрузка CPU/RAM
- [ ] Автозапуск (systemd service)

**Документация:**
```markdown
# docs/RASPBERRY_PI_SETUP.md

## Установка на Raspberry Pi

### Требования
- Raspberry Pi 3/4/5
- Raspberry Pi OS (64-bit рекомендуется)
- 1GB+ RAM

### Установка
```bash
# Системные пакеты
sudo apt update
sudo apt install -y python3-pip python3-numpy portaudio19-dev

# Python зависимости
pip3 install -r requirements.txt

# Права доступа
sudo usermod -a -G dialout,audio $USER

# Автозапуск
sudo cp yaesu-web-pult.service /etc/systemd/system/
sudo systemctl enable yaesu-web-pult
sudo systemctl start yaesu-web-pult
```
```

---

### 4. Docker контейнер

**Цель:** Простой запуск в контейнере

**Файлы:**
```dockerfile
# Dockerfile (уже есть, но нужно обновить)

FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    portaudio19-dev \
    libusb-1.0-0-dev \
    rtl-sdr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Компиляция FT8 модуля
RUN cd server && python setup_ftx.py build_ext --inplace

EXPOSE 8080 8443

CMD ["python3", "server/main.py", "--console"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  yaesu-web-pult:
    build: .
    container_name: yaesu-web-pult
    ports:
      - "8080:8080"
      - "8443:8443"
    devices:
      - /dev/ttyUSB0:/dev/ttyUSB0  # CAT порт
      - /dev/bus/usb:/dev/bus/usb  # USB Audio + RTL-SDR
    volumes:
      - ./config.json:/app/config.json
      - ./records:/app/records
      - ./sstv:/app/sstv
      - ./fax:/app/fax
    restart: unless-stopped
    privileged: true  # Для USB устройств
```

**Задачи:**
- [ ] Обновить Dockerfile
- [ ] Тесты в Docker на Windows/Linux
- [ ] USB Audio passthrough
- [ ] RTL-SDR passthrough
- [ ] Документация Docker запуска

---

## Версия 3.4.0 - Дополнительные SDR (Средний приоритет)

**Сроки:** 2-3 месяца после v3.3.0

### Поддерживаемые SDR:

#### 1. SDRPlay RSP1A/RSPdx (~$100)
```python
# server/sdr/sdrplay.py
import sdrplay
```

#### 2. HackRF One (~$300)
```python
# server/sdr/hackrf.py
import hackrf
```

#### 3. AirSpy / AirSpy HF+ (~$200)
```python
# server/sdr/airspy.py
import airspy
```

**Задачи:**
- [ ] Модули для каждого SDR
- [ ] Автоопределение подключенного SDR
- [ ] Выбор между несколькими SDR
- [ ] Настройки gain/sample rate в UI

---

## Версия 3.5.0 - Расширенные функции (Низкий приоритет)

**Сроки:** 3-4 месяца после v3.4.0

### Функции:

1. **Zoom водопада**
   - Приближение участка спектра
   - Центрирование на сигнале

2. **Запись IQ данных**
   - Сохранение raw IQ с SDR
   - Воспроизведение IQ файлов

3. **Множественные водопады**
   - Audio + SDR одновременно
   - Разные диапазоны

4. **Маркеры сигналов**
   - Автоопределение CW/SSB/FM
   - Пики на водопаде

5. **Clustering для FT8**
   - DXCluster интеграция
   - PSK Reporter карта

---

## Текущие приоритеты разработки

### Высокий приоритет (v3.3.0)
1. ✅ Уход от Hamlib
2. ✅ RTL-SDR поддержка
3. ✅ Тесты на RPi
4. ✅ Docker образ

### Средний приоритет (v3.4.0)
5. ⏳ SDRPlay поддержка
6. ⏳ HackRF поддержка
7. ⏳ AirSpy поддержка

### Низкий приоритет (v3.5.0)
8. ⏳ Zoom водопада
9. ⏳ IQ запись
10. ⏳ Множественные водопады

---

## Архитектура после рефакторинга

```
yaesu-web-pult/
├── server/
│   ├── cat/                    # Нативные CAT протоколы
│   │   ├── base.py            # Базовый класс
│   │   ├── ftx1.py            # FTX-1 (готово)
│   │   ├── ft710.py           # FT-710 (TODO)
│   │   ├── ftdx10.py          # FTDX10 (TODO)
│   │   ├── ft991.py           # FT-991 (TODO)
│   │   └── ft891.py           # FT-891 (TODO)
│   │
│   ├── sdr/                    # SDR модули
│   │   ├── base.py            # Базовый класс
│   │   ├── rtlsdr.py          # RTL-SDR (v3.3.0)
│   │   ├── sdrplay.py         # SDRPlay (v3.4.0)
│   │   ├── hackrf.py          # HackRF (v3.4.0)
│   │   └── airspy.py          # AirSpy (v3.4.0)
│   │
│   ├── waterfall/              # Источники водопада
│   │   ├── audio.py           # Audio DSP (готово)
│   │   ├── ft710_scope.py     # FT-710 scope (готово)
│   │   └── sdr.py             # Внешний SDR (TODO)
│   │
│   └── ... (остальное без изменений)
│
├── docs/
│   ├── CAT_PROTOCOLS.md       # Документация CAT
│   ├── SDR_SETUP.md           # Настройка SDR
│   ├── RASPBERRY_PI_SETUP.md  # Установка на RPi
│   └── DOCKER.md              # Docker инструкции
│
└── tests/
    ├── test_cat_ft710.py      # Тесты FT-710 CAT
    ├── test_sdr_rtlsdr.py     # Тесты RTL-SDR
    └── test_rpi_integration.py # Интеграция RPi
```

---

## Зависимости по версиям

### v3.3.0
```
# requirements.txt
numpy>=1.24
pyserial>=3.5
sounddevice>=0.4.6
cryptography>=41
pystray>=0.19
pillow>=10
pyrtlsdr>=0.2.92        # NEW: RTL-SDR
```

### v3.4.0
```
# requirements.txt (дополнительно)
sdrplay>=0.1            # NEW: SDRPlay
hackrf>=0.1             # NEW: HackRF
airspy>=0.1             # NEW: AirSpy
```

---

## Тестирование

### Платформы для тестов:
- [x] Windows 10/11
- [ ] Ubuntu 22.04/24.04
- [ ] Debian 12
- [ ] Raspberry Pi OS (64-bit)
- [ ] Docker (alpine/debian)

### Трансиверы для тестов:
- [x] FTX-1 (симулятор)
- [ ] FT-710 (нативный CAT)
- [ ] FTDX10 (нативный CAT)
- [ ] FT-991A (нативный CAT)
- [ ] FT-891 (нативный CAT)

### SDR для тестов:
- [ ] RTL-SDR Blog V3
- [ ] NooElec NESDR SMArt
- [ ] SDRPlay RSP1A
- [ ] HackRF One
- [ ] AirSpy HF+

---

## Миграция с Hamlib на Native CAT

### Этап 1: Параллельная поддержка
```python
# server/station.py

class Station:
    def connect_cat(self):
        if self.cfg.get('use_native_cat', True):
            # Новый путь: Native CAT
            if self.model == 'FTX-1':
                from cat.ftx1 import FTX1CAT
                self.rig = FTX1CAT(port, baud)
            elif self.model == 'FT-710':
                from cat.ft710 import FT710CAT
                self.rig = FT710CAT(port, baud)
            # ... и т.д.
        else:
            # Старый путь: Hamlib (deprecated)
            self.rig = create_hamlib(...)
```

### Этап 2: Deprecation Hamlib (v3.3.0)
- Показывать warning при использовании Hamlib
- Рекомендовать переключиться на native

### Этап 3: Удаление Hamlib (v3.4.0)
- Полное удаление `hamlib_backend.py`
- Только native CAT протоколы

---

## Документация для контрибьюторов

### Как добавить новую модель ТРХ:

1. Создать `server/cat/modelname.py`:
```python
from cat.base import YaesuCAT

class ModelNameCAT(YaesuCAT):
    def __init__(self, port, baud):
        super().__init__(port, baud)
        self.model = 'MODEL-NAME'
    
    def get_frequency(self):
        """Получить частоту VFO-A"""
        response = self.send_command('FA;')
        return int(response[2:11])
    
    # ... другие команды
```

2. Добавить в `server/station.py`:
```python
elif self.model == 'MODEL-NAME':
    from cat.modelname import ModelNameCAT
    self.rig = ModelNameCAT(port, baud)
```

3. Создать тесты `tests/test_cat_modelname.py`

4. Обновить документацию `docs/CAT_PROTOCOLS.md`

### Как добавить новый SDR:

Аналогично, создать `server/sdr/sdrname.py` с базовым классом.

---

## Метрики успеха

### v3.3.0
- [ ] Все модели работают без Hamlib
- [ ] RTL-SDR работает на 3 платформах
- [ ] RPi тесты проходят
- [ ] Docker образ собирается

### v3.4.0
- [ ] 3+ SDR поддерживаются
- [ ] Автоопределение SDR работает

### v3.5.0
- [ ] Zoom водопада реализован
- [ ] IQ запись работает

---

## Контакты и обратная связь

**GitHub:** https://github.com/Evgeny161rus/yaesu-web-pult

**Issues:** https://github.com/Evgeny161rus/yaesu-web-pult/issues

**Discussions:** https://github.com/Evgeny161rus/yaesu-web-pult/discussions

**Email:** R6AAF (через QRZ.com)

---

**73!** 📻

Roadmap обновляется по мере развития проекта.
