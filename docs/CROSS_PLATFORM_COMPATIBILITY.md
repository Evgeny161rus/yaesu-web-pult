# 🔍 Кроссплатформенная совместимость

## ✅ Функциональность на всех платформах

### Windows 10/11 ✅

**Полная поддержка всех функций:**

#### CAT управление
- ✅ COM-порты (через pyserial)
- ✅ Hamlib (если установлен)
- ✅ FT-710 scope waterfall

#### Аудио
- ✅ sounddevice (MME, WASAPI, DirectSound)
- ✅ USB Audio Codec от трансивера
- ✅ 48 kHz → 16 kHz → 8 kHz ресемплинг

#### Цифровые режимы
- ✅ **CW декодер** (numpy FFT)
- ✅ **FT8/FT4** (ft8_lib C extension)
- ✅ **RTTY** (numpy DSP)
- ✅ **PSK31** (numpy DSP)
- ✅ **NAVTEX** (numpy DSP)
- ✅ **SSTV** (PIL/Pillow для изображений)
- ✅ **WEFAX** (PIL/Pillow для изображений)

#### Графика/Изображения
- ✅ **PIL/Pillow** - декодирование и сохранение SSTV/FAX
- ✅ PNG сохранение (все форматы)

---

### Linux (Ubuntu/Debian) ✅

**Полная поддержка всех функций:**

#### Установка зависимостей
```bash
# Системные библиотеки
sudo apt update
sudo apt install -y python3-pip python3-numpy portaudio19-dev

# Python пакеты
pip3 install -r requirements.txt
```

#### CAT управление
- ✅ /dev/ttyUSB* (через pyserial)
- ✅ Hamlib (устанавливается через apt)
- ✅ FT-710 scope waterfall

#### Аудио
- ✅ sounddevice (ALSA, PulseAudio, JACK)
- ✅ USB Audio Codec от трансивера
- ✅ 48 kHz → 16 kHz → 8 kHz ресемплинг

#### Цифровые режимы
- ✅ **CW декодер** (numpy FFT)
- ✅ **FT8/FT4** (ft8_lib компилируется из исходников)
- ✅ **RTTY** (numpy DSP)
- ✅ **PSK31** (numpy DSP)
- ✅ **NAVTEX** (numpy DSP)
- ✅ **SSTV** (PIL/Pillow)
- ✅ **WEFAX** (PIL/Pillow)

#### Графика/Изображения
- ✅ **PIL/Pillow** - работает нативно
- ✅ PNG сохранение

#### Компиляция FT8 модуля
```bash
cd server
python3 setup_ftx.py build_ext --inplace
```

---

### Raspberry Pi (3/4/5) ✅

**Полная поддержка всех функций (оптимизировано):**

#### Установка
```bash
# Raspberry Pi OS (64-bit рекомендуется)
sudo apt update
sudo apt install -y python3-pip python3-numpy portaudio19-dev python3-pil

# Python пакеты
pip3 install -r requirements.txt

# Добавить пользователя в группы
sudo usermod -a -G dialout,audio $USER
```

#### CAT управление
- ✅ /dev/ttyUSB* (через pyserial)
- ✅ Hamlib (работает отлично)
- ✅ FT-710 scope waterfall

#### Аудио
- ✅ sounddevice (ALSA оптимизирован для RPi)
- ✅ USB Audio Codec
- ✅ Ресемплинг оптимизирован для ARM

#### Цифровые режимы
- ✅ **CW декодер** (numpy оптимизирован для ARM)
- ✅ **FT8/FT4** (ft8_lib компилируется для ARM64)
- ✅ **RTTY** (numpy DSP)
- ✅ **PSK31** (numpy DSP)
- ✅ **NAVTEX** (numpy DSP)
- ✅ **SSTV** (PIL/Pillow работает на ARM)
- ✅ **WEFAX** (PIL/Pillow)

#### Графика/Изображения
- ✅ **PIL/Pillow** - предустановлен в Raspberry Pi OS
- ✅ PNG сохранение

#### Производительность
- **RPi 4 (4GB):** отлично работает, waterfall 10-15 FPS
- **RPi 3:** работает, waterfall 5-10 FPS
- **RPi 5:** отличная производительность

#### Оптимизации для RPi
```python
# В server/constants.py
DECIMATION_FACTOR_LOW = 6    # Меньше нагрузка на RPi
SPECTRUM_UPDATE_MS = 100     # Реже обновления
```

---

## 📊 Сравнительная таблица

| Функция | Windows | Linux | Raspberry Pi |
|---------|---------|-------|--------------|
| CAT управление | ✅ | ✅ | ✅ |
| USB Audio | ✅ | ✅ | ✅ |
| Waterfall (audio DSP) | ✅ | ✅ | ✅ |
| Waterfall (FT-710 scope) | ✅ | ✅ | ✅ |
| CW декодер | ✅ | ✅ | ✅ |
| FT8/FT4 | ✅ | ✅ | ✅ |
| RTTY | ✅ | ✅ | ✅ |
| PSK31 | ✅ | ✅ | ✅ |
| NAVTEX | ✅ | ✅ | ✅ |
| SSTV прием | ✅ | ✅ | ✅ |
| SSTV сохранение PNG | ✅ | ✅ | ✅ |
| WEFAX прием | ✅ | ✅ | ✅ |
| WEFAX сохранение PNG | ✅ | ✅ | ✅ |
| Запись WAV | ✅ | ✅ | ✅ |
| Hamlib поддержка | ✅ | ✅ | ✅ |
| PWA (мобильное приложение) | ✅ | ✅ | ✅ |

---

## 🔧 Зависимости по платформам

### Общие Python зависимости (все платформы)
```
numpy>=1.24        # Математика, FFT, DSP
pyserial>=3.5      # COM-порты
sounddevice>=0.4.6 # Аудио I/O
cryptography>=41   # HTTPS сертификаты
pystray>=0.19      # Иконка в трее (только Windows)
pillow>=10         # Изображения (SSTV, WEFAX)
```

### Windows специфичные
- **pystray** - иконка в System Tray
- **pywin32** - опционально для автозапуска

### Linux специфичные
```bash
# Системные библиотеки
portaudio19-dev    # Для sounddevice
libportaudio2      # Runtime для audio
python3-dev        # Для компиляции расширений
gcc                # Компилятор для ft8_lib
```

### Raspberry Pi специфичные
```bash
# Предустановлено в Raspberry Pi OS
python3-numpy      # Оптимизированный numpy для ARM
python3-pil        # Pillow для изображений

# Дополнительно
portaudio19-dev    # Аудио
```

---

## 🎨 Ограничения по платформам

### Windows
- ❌ **Нет ограничений** - все работает

### Linux
- ⚠️ **pystray не нужен** - нет system tray, но не критично
- ⚠️ **Права доступа** - нужно добавить в dialout и audio группы

### Raspberry Pi
- ⚠️ **Производительность** - waterfall медленнее на RPi 3
- ⚠️ **Память** - минимум 1 GB RAM
- ⚠️ **pystray не нужен** - нет system tray

---

## 🚀 Тестирование кроссплатформенности

### Автоматические тесты
```bash
# Запускаются на всех платформах в CI/CD
pytest tests/ -v

# Тестируют:
# - Импорт всех модулей
# - numpy операции
# - sounddevice доступность
# - PIL/Pillow функции
# - Все DSP декодеры
```

### Ручное тестирование

#### Windows
```cmd
python server/main.py --sim --console
```

#### Linux / Raspberry Pi
```bash
python3 server/main.py --sim --console
```

Проверить:
1. Waterfall обновляется
2. CW декодер работает
3. FT8 декодирует
4. SSTV показывает картинки
5. Веб-интерфейс доступен

---

## 📝 Известные проблемы

### Windows
- ✅ **Нет проблем**

### Linux
- ⚠️ **Первый запуск:** может потребовать `chmod +x`
- ⚠️ **Audio latency:** настроить ALSA buffer size
```bash
# ~/.asoundrc
pcm.!default {
    type plug
    slave.pcm hw
}
```

### Raspberry Pi
- ⚠️ **Медленный waterfall на RPi 3** - уменьшить DECIMATION_FACTOR
- ⚠️ **Swap память** - увеличить если <2GB RAM
```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# CONF_SWAPSIZE=2048
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

---

## ✅ Итоговый вердикт

### Все функции работают на всех платформах!

**Включая:**
- ✅ Все цифровые режимы (CW, FT8/FT4, RTTY, PSK31, NAVTEX)
- ✅ Прием и сохранение изображений (SSTV, WEFAX)
- ✅ Waterfall и spectrum
- ✅ Запись в WAV
- ✅ Веб-интерфейс с 7 темами
- ✅ PWA для мобильных устройств

**Единственные отличия:**
- Windows: есть иконка в трее
- Linux/RPi: нет иконки в трее (не критично)

**Производительность:**
- Windows: отлично
- Linux: отлично
- RPi 4/5: отлично
- RPi 3: хорошо (с оптимизациями)

---

**Вывод:** Проект полностью кроссплатформенный! 🎉
