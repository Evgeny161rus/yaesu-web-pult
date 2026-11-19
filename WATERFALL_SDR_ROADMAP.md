# 🌊 Водопад и поддержка SDR - Текущее состояние и планы

## 📊 Текущая реализация водопада

### 1. FT-710, FTDX10, FTDX101 - Нативный USB Scope ✅

**Статус:** Полностью реализовано в `server/ft710_scope.py`

**Как работает:**
```python
# FT-710 передает scope данные через USB
# Команда: 0xBC 0x00 (READ SCOPE DATA)
# Формат: 4096 байт бинарных данных
# Содержит: 475 точек спектра, частоты VFO A/B, span

# Декодирование:
def decode_ft710_scope(packet):
    # Синхронизация: 0xFF 0x01 0xEE 0x01
    # Данные: offset 2900, 475 точек
    # Частоты: BCD формат
    # Span: 1k, 2k, 5k, 10k, 20k, 50k, 100k, 200k, 500k, 1M
```

**Поддерживаемые модели:**
- ✅ FT-710 (проверено на практике)
- ✅ FTDX10 (тот же протокол)
- ✅ FTDX101D/MP (тот же протокол)

**Преимущества:**
- Реальная панорама диапазона (до 1 МГц!)
- Быстрое обновление (~10-20 FPS)
- Не зависит от полосы аудио
- Данные калиброваны трансивером

**Ограничения:**
- Только для моделей с USB scope
- Требует USB подключения (не работает через Hamlib по сети)

---

### 2. Все остальные модели - Audio DSP Waterfall ✅

**Статус:** Работает на всех моделях

**Как работает:**
```python
# server/audio.py
# Звук 48 kHz → FFT → waterfall
# Обзор: по ширине фильтра (SSB ~3.5 kHz, FM ~9 kHz)
# Обновление: 10-20 раз в секунду

# Преимущества:
# - Работает на ЛЮБОМ трансивере с USB Audio
# - Не требует специальных команд CAT
# - Показывает реальные сигналы в полосе приёма
```

**Поддерживаемые модели:**
- ✅ FTX-1 (USB Audio 48 kHz)
- ✅ FT-991/A (USB Audio)
- ✅ FT-891 (USB Audio)
- ✅ FT-450 (USB Audio)
- ✅ FT-950 (через внешнюю звуковуху)
- ✅ Любой Yaesu с USB Audio

**Ограничения:**
- Узкая полоса (по ширине фильтра приёмника)
- Не показывает сигналы вне полосы приёмника
- Зависит от качества USB Audio

---

## 🚀 Планы расширения

### 1. Дополнительные модели с нативным scope

#### IC-7300, IC-7610 (Icom) - Возможно добавить
**Протокол:** CI-V команды 0x27 (Spectrum Scope)
**Формат:** Отличается от Yaesu, но документирован
**Сложность:** Средняя
**Статус:** Запланировано в будущих версиях

#### IC-705 (Icom) - Возможно добавить
**Протокол:** Аналогичен IC-7300
**Статус:** Запланировано

#### Kenwood TS-890S - Сложно
**Протокол:** Проприетарный, плохо документирован
**Статус:** Низкий приоритет

---

### 2. Внешние SDR - ПЛАНИРУЕТСЯ! 🎯

Это отличная идея для моделей без USB scope!

#### Вариант A: RTL-SDR (RTL2832U) 📻

**Преимущества:**
- Дешёвый (~$25)
- Широкий обзор (до 2.4 МГц)
- Работает везде (Windows/Linux/RPi)

**Реализация:**
```python
# Новый модуль: server/sdr_rtlsdr.py

import numpy as np
from rtlsdr import RtlSdr

class RtlSdrWaterfall:
    def __init__(self):
        self.sdr = RtlSdr()
        self.sdr.sample_rate = 2.4e6  # 2.4 MHz
        self.sdr.center_freq = 14.2e6  # 20m band
        self.sdr.gain = 'auto'
    
    def get_spectrum(self, trx_freq):
        # Настроить SDR на частоту трансивера
        self.sdr.center_freq = trx_freq
        
        # Получить IQ данные
        samples = self.sdr.read_samples(256*1024)
        
        # FFT → spectrum
        fft_data = np.fft.fft(samples)
        spectrum = 20 * np.log10(np.abs(fft_data))
        
        # Вернуть 1024 точки, ±1.2 MHz от центра
        return spectrum[::256]  # Децимация
```

**Зависимости:**
```
pyrtlsdr>=0.2.92  # RTL-SDR Python wrapper
```

**Установка:**
```bash
# Windows
pip install pyrtlsdr

# Linux
sudo apt install rtl-sdr librtlsdr-dev
pip install pyrtlsdr

# Raspberry Pi
sudo apt install rtl-sdr
pip install pyrtlsdr
```

**Интеграция:**
- Опция в config: `"sdr_type": "rtlsdr"`
- Автоматическое переключение на частоту трансивера
- Независимый waterfall (не мешает аудио)
- Обзор ±1 MHz вокруг частоты работы

---

#### Вариант B: SDRPlay RSP (RSP1A, RSPdx, RSPduo) 📡

**Преимущества:**
- Лучше чем RTL-SDR
- Широкий диапазон (1 kHz - 2 GHz)
- Обзор до 10 MHz
- Хорошая чувствительность

**Реализация:**
```python
# server/sdr_sdrplay.py

import sdrplay

class SdrPlayWaterfall:
    def __init__(self):
        self.sdr = sdrplay.SDRPlay()
        self.sdr.sample_rate = 2e6
        self.sdr.if_gain_reduction = 40
        self.sdr.rf_gain_reduction = 0
    
    def get_spectrum(self, trx_freq):
        # Аналогично RTL-SDR, но лучшее качество
        pass
```

**Зависимости:**
```
sdrplay>=0.1  # SDRPlay API wrapper
```

---

#### Вариант C: HackRF One 🔧

**Преимущества:**
- TX + RX (может передавать!)
- Широкий диапазон (1 MHz - 6 GHz)
- Обзор до 20 MHz
- Open source hardware

**Реализация:**
```python
# server/sdr_hackrf.py

import hackrf

class HackRfWaterfall:
    def __init__(self):
        self.sdr = hackrf.HackRF()
        self.sdr.sample_rate = 10e6  # 10 MHz
        self.sdr.center_freq = 14.2e6
    
    def get_spectrum(self, trx_freq):
        # Аналогично, но ширина до 20 MHz
        pass
```

---

#### Вариант D: AirSpy, AirSpy HF+ 📶

**Преимущества:**
- Отличное качество
- HF+ специально для КВ
- Хорошая чувствительность

**Реализация:**
```python
# server/sdr_airspy.py

import airspy

class AirspyWaterfall:
    def __init__(self):
        self.sdr = airspy.Airspy()
```

---

### 3. Архитектура SDR поддержки

#### Конфигурация
```json
// config.json
{
  "waterfall_source": "auto",  // auto, audio, scope, sdr
  "sdr": {
    "enabled": true,
    "type": "rtlsdr",  // rtlsdr, sdrplay, hackrf, airspy
    "device_index": 0,
    "sample_rate": 2400000,  // 2.4 MHz
    "gain": "auto",
    "offset": 0,  // Frequency offset (PPM correction)
    "follow_trx": true  // Автоматически следовать за частотой ТРХ
  }
}
```

#### Выбор источника waterfall
```python
# server/station.py

class Station:
    def select_waterfall_source(self):
        if self.config.get('waterfall_source') == 'auto':
            # Приоритет:
            # 1. FT-710 scope (если поддерживается)
            if self.model in ['FT-710', 'FTDX10', 'FTDX101']:
                return 'scope'
            
            # 2. Внешний SDR (если настроен)
            elif self.config['sdr']['enabled']:
                return 'sdr'
            
            # 3. Audio DSP (всегда работает)
            else:
                return 'audio'
        else:
            return self.config['waterfall_source']
```

#### Панель управления
```html
<!-- web/panel.html -->
<section class="panel card">
  <h3>🌊 Waterfall Source</h3>
  
  <label class="field">
    <span>Source</span>
    <select id="waterfall_source">
      <option value="auto">Auto (best available)</option>
      <option value="audio">Audio DSP (all models)</option>
      <option value="scope">USB Scope (FT-710/FTDX10)</option>
      <option value="sdr">External SDR</option>
    </select>
  </label>
  
  <details id="sdrSettings" class="hidden">
    <summary>SDR Settings</summary>
    
    <label class="chk">
      <input type="checkbox" id="sdr_enabled"> Enable External SDR
    </label>
    
    <label class="field">
      <span>SDR Type</span>
      <select id="sdr_type">
        <option value="rtlsdr">RTL-SDR (RTL2832U)</option>
        <option value="sdrplay">SDRPlay (RSP1A/RSPdx)</option>
        <option value="hackrf">HackRF One</option>
        <option value="airspy">AirSpy / AirSpy HF+</option>
      </select>
    </label>
    
    <label class="field">
      <span>Device Index</span>
      <input type="number" id="sdr_device" min="0" max="9" value="0">
    </label>
    
    <label class="field">
      <span>Sample Rate (MHz)</span>
      <select id="sdr_sample_rate">
        <option value="1000000">1.0</option>
        <option value="2400000" selected>2.4</option>
        <option value="3200000">3.2</option>
      </select>
    </label>
    
    <label class="field">
      <span>Gain</span>
      <select id="sdr_gain">
        <option value="auto" selected>Auto</option>
        <option value="0">0 dB</option>
        <option value="10">10 dB</option>
        <option value="20">20 dB</option>
        <option value="30">30 dB</option>
        <option value="40">40 dB</option>
      </select>
    </label>
    
    <label class="chk">
      <input type="checkbox" id="sdr_follow_trx" checked>
      Follow transceiver frequency
    </label>
    
    <button class="btn" id="sdr_test">Test SDR Connection</button>
  </details>
</section>
```

---

## 📋 План реализации

### Phase 1: Базовая поддержка RTL-SDR (v3.3.0)

**Приоритет:** Высокий  
**Сложность:** Средняя  
**Время:** 1-2 недели

**Задачи:**
- [ ] Добавить `pyrtlsdr` в requirements
- [ ] Создать `server/sdr_rtlsdr.py`
- [ ] Интегрировать в `server/station.py`
- [ ] Добавить UI в `web/panel.html`
- [ ] Тестирование на Windows/Linux/RPi
- [ ] Документация

**Результат:**
- RTL-SDR показывает ±1 MHz вокруг частоты работы
- Автоматическое переключение при смене частоты
- Работает параллельно с audio waterfall

---

### Phase 2: Множественные SDR (v3.4.0)

**Приоритет:** Средний  
**Сложность:** Средняя  
**Время:** 2-3 недели

**Задачи:**
- [ ] SDRPlay поддержка
- [ ] HackRF поддержка
- [ ] AirSpy поддержка
- [ ] Автоопределение SDR
- [ ] Выбор между несколькими SDR

---

### Phase 3: Расширенные функции (v3.5.0)

**Приоритет:** Низкий  
**Сложность:** Высокая  
**Время:** 3-4 недели

**Задачи:**
- [ ] Запись IQ данных
- [ ] Воспроизведение IQ файлов
- [ ] Несколько waterfall одновременно
- [ ] Zoom waterfall
- [ ] Маркеры сигналов (auto-detect CW/SSB/FM)

---

## 💡 Рекомендации

### Для пользователей без USB scope:

#### Бюджетный вариант: RTL-SDR (~$25)
```
✅ Хорошо для начала
✅ Обзор ±1 MHz
✅ Работает везде
⚠️ Чувствительность средняя
```

**Купить:**
- RTL-SDR Blog V3 (~$30)
- NooElec NESDR SMArt (~$25)

#### Средний вариант: SDRPlay RSP1A (~$100)
```
✅ Отличное качество
✅ Обзор до ±5 MHz
✅ Хорошая чувствительность
✅ Поддержка всех диапазонов
```

#### Продвинутый: AirSpy HF+ (~$200)
```
✅ Лучшее качество для КВ
✅ Специально для 0-31 MHz
✅ Отличная чувствительность
✅ Профессиональный уровень
```

---

## 🔧 Временное решение (сейчас)

Пока SDR поддержка не реализована, можно использовать:

### Вариант 1: Отдельный SDR софт
```
GQRX (Linux/Mac) → WebSocket → Yaesu Web Pult
SDR# (Windows)   → WebSocket → Yaesu Web Pult
```

### Вариант 2: Audio waterfall оптимизация
```python
# Увеличить обзор audio waterfall
# server/constants.py

WATERFALL_WIDTH_OPTIONS = [3000, 6000, 12000, 24000]  # Hz
# Использовать максимальную ширину фильтра
```

---

## 📊 Сравнительная таблица

| Источник | Обзор | Качество | Поддержка | Стоимость |
|----------|-------|----------|-----------|-----------|
| **Audio DSP** | ±2-12 kHz | ⭐⭐⭐ | Все ТРХ | Встроено |
| **FT-710 Scope** | ±500 kHz | ⭐⭐⭐⭐⭐ | FT-710/FTDX10 | Встроено |
| **RTL-SDR** | ±1.2 MHz | ⭐⭐⭐ | Все ТРХ | $25 |
| **SDRPlay** | ±5 MHz | ⭐⭐⭐⭐ | Все ТРХ | $100 |
| **AirSpy HF+** | ±10 MHz | ⭐⭐⭐⭐⭐ | Все ТРХ | $200 |

---

## ✅ Итоговый ответ

### 1. Полноценный waterfall по USB для поддерживаемых ТРХ?

**Ответ: ДА, УЖЕ РЕАЛИЗОВАНО! ✅**

- ✅ **FT-710, FTDX10, FTDX101** - нативный USB scope (до 1 MHz обзор!)
- ✅ Декодирование бинарных данных
- ✅ Работает прямо сейчас

### 2. Поддержка внешних SDR?

**Ответ: ПЛАНИРУЕТСЯ В v3.3.0! 🎯**

**Что будет:**
- ✅ RTL-SDR поддержка (приоритет)
- ✅ SDRPlay, HackRF, AirSpy (позже)
- ✅ Автоматическое следование за частотой ТРХ
- ✅ Работает параллельно с audio waterfall
- ✅ Кроссплатформенно (Windows/Linux/RPi)

**Когда:** Следующий мажорный релиз (1-2 месяца)

---

**Хотите помочь с реализацией SDR?** Контрибьюции приветствуются! 🤝

**73!** 📻
