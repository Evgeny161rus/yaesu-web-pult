# Руководство по участию в разработке Yaesu Web Pult

Спасибо за интерес к проекту! Мы рады любому вкладу: от исправления опечаток до добавления новых функций.

## Быстрый старт

1. **Fork и клонирование:**
```bash
git clone https://github.com/YOUR_USERNAME/yaesu-web-pult.git
cd yaesu-web-pult
```

2. **Установка зависимостей:**
```bash
python -m pip install -r requirements.txt
```

3. **Запуск в режиме разработки:**
```bash
python server/main.py --console --sim
```

4. **Запуск тестов:**
```bash
python -m unittest discover -s tests -v
```

## Структура проекта

```
yaesu-web-pult/
├── server/              # Серверная часть (Python)
│   ├── constants.py     # Константы приложения
│   ├── station.py       # Управление станцией
│   ├── cat.py          # CAT протокол
│   ├── audio.py        # Обработка звука
│   ├── network_utils.py # Сетевые утилиты
│   ├── device_utils.py  # Работа с устройствами
│   ├── cw.py           # CW режим
│   ├── ft8.py          # FT8/FT4
│   └── ...
├── web/                 # Веб-интерфейс (HTML/CSS/JS)
│   ├── index.html
│   ├── app.js
│   └── ...
├── tests/               # Тесты
├── docs/                # Документация
└── .github/workflows/   # CI/CD
```

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Стиль кода

### Python

- **PEP 8** с максимальной длиной строки 127 символов
- Используйте type hints где возможно
- Docstrings в формате Google/NumPy
- Константы из `constants.py` вместо магических чисел

**Проверка стиля:**
```bash
flake8 server --max-line-length=127
```

**Пример:**
```python
from constants import DEFAULT_CAT_BAUD, PCM_INT16_MAX

def process_audio(samples: np.ndarray, rate: int = 48000) -> bytes:
    """
    Конвертация аудио сэмплов в PCM int16.
    
    Args:
        samples: Массив float32 [-1.0, 1.0]
        rate: Частота дискретизации в Гц
    
    Returns:
        Байты PCM signed int16 little-endian
    """
    clipped = np.clip(samples, -1.0, 1.0)
    return (clipped * PCM_INT16_MAX).astype('<i2').tobytes()
```

### JavaScript

- **ES6+** синтаксис
- camelCase для переменных и функций
- 2 пробела для отступов
- JSDoc комментарии для публичных функций

### Коммиты

Используйте [Conventional Commits](https://www.conventionalcommits.org/ru/):

```
feat: добавлена поддержка режима PSK31
fix: исправлено залипание PTT при потере связи
docs: обновлена документация WebSocket протокола
test: добавлены тесты для network_utils
refactor: выделен модуль station.py из main.py
```

## Процесс разработки

### 1. Создание ветки

```bash
git checkout -b feature/psk31-mode
# или
git checkout -b fix/ptt-timeout
```

### 2. Разработка

- Пишите код небольшими логическими частями
- Делайте коммиты часто
- Следите за соответствием стилю проекта
- Добавляйте тесты для новой функциональности

### 3. Тестирование

```bash
# Запуск всех тестов
python -m unittest discover -s tests -v

# Конкретный тест
python -m unittest tests.test_network_utils -v

# С Hamlib (если установлен)
$env:HAMLIB_TEST_EXE = "путь\к\rigctld.exe"
python -m unittest discover -s tests -v
```

### 4. Pull Request

1. Убедитесь, что все тесты проходят
2. Обновите документацию при необходимости
3. Создайте PR с описанием изменений
4. Ответьте на комментарии ревьюеров

**Шаблон описания PR:**
```markdown
## Что сделано

Кратко опишите изменения.

## Мотивация

Зачем это нужно? Какую проблему решает?

## Как протестировано

- [ ] Юнит-тесты прошли
- [ ] Протестировано с реальным трансивером
- [ ] Протестировано в симуляторе

## Скриншоты (если применимо)

## Чеклист

- [ ] Код соответствует стилю проекта
- [ ] Добавлены/обновлены тесты
- [ ] Обновлена документация
- [ ] Нет breaking changes (или они задокументированы)
```

## Добавление новой функции

### Пример: новый цифровой режим

1. **Создайте модуль декодера** (`server/newfmode.py`):
```python
"""Декодер режима NewMode."""
import numpy as np
from constants import SAMPLE_RATE

class NewModeDecoder:
    def __init__(self, callback):
        self.callback = callback
        self.enabled = False
    
    def configure(self, **kwargs):
        self.enabled = kwargs.get('enabled', False)
    
    def process(self, samples: np.ndarray):
        if not self.enabled:
            return
        # Ваша логика декодирования
        pass
```

2. **Интегрируйте в DigiDesk** (`server/digidesk.py`):
```python
from newfmode import NewModeDecoder

class DigiDesk:
    def __init__(self, station, base_dir):
        # ...
        self.newfmode = NewModeDecoder(self._on_newfmode)
    
    def _on_newfmode(self, event):
        # Обработка события
        pass
```

3. **Добавьте WebSocket обработчик** (`server/main.py`):
```python
async def _on_msg(self, c, m):
    # ...
    if t.startswith('nf_'):
        await self.digi.on_newfmode_msg(c, m)
        return
```

4. **Обновите веб-интерфейс** (`web/app.js`):
```javascript
function initNewMode() {
    // UI логика
}
```

5. **Добавьте тесты** (`tests/test_newfmode.py`):
```python
import unittest
from server.newfmode import NewModeDecoder

class TestNewMode(unittest.TestCase):
    def test_decode(self):
        # Ваши тесты
        pass
```

6. **Обновите документацию**:
   - `README.md` - описание функции
   - `docs/WEBSOCKET_PROTOCOL.md` - протокол
   - `docs/ARCHITECTURE.md` - архитектура

## Добавление поддержки трансивера

### Через Hamlib (рекомендуется)

Если трансивер уже поддерживается Hamlib, он должен работать сразу:

1. Выберите "Yaesu / Hamlib" в панели управления
2. Нажмите "Обновить модели"
3. Выберите вашу модель
4. Протестируйте базовые функции

Если что-то не работает - создайте issue с подробностями.

### Нативный драйвер

Для полной поддержки специфических функций:

1. Изучите CAT протокол в документации трансивера
2. Расширьте `cat.py` или создайте отдельный модуль
3. Добавьте определение в `yaesu_detect.py`
4. Создайте `menu_YOURMODEL.json` для меню EX
5. Протестируйте все функции
6. Документируйте особенности

## Отчёты об ошибках

**Используйте шаблон:**

```markdown
**Описание**
Что происходит и что ожидалось.

**Воспроизведение**
1. Шаги для воспроизведения
2. ...

**Окружение**
- Версия Yaesu Web Pult: 3.2-preview
- ОС: Windows 11 / Ubuntu 22.04 / Raspberry Pi OS
- Python: 3.11.5
- Трансивер: FTX-1 / FT-710 / FTDX10 / FT-991 / Hamlib Dummy
- Backend: Native / Hamlib

**Логи**
```
Вставьте релевантные части ftx1-pult.log
```

**Скриншоты**
Если применимо.
```

## Вопросы и поддержка

- **GitHub Issues** - баги и feature requests
- **GitHub Discussions** - вопросы и обсуждения
- **Pull Requests** - код ревью

## Лицензия

Участвуя в проекте, вы соглашаетесь с условиями лицензии проекта.

## Благодарности

Спасибо всем участникам проекта! Ваши PR, issue reports, тестирование и обратная связь делают проект лучше.

---

**Важно:** Тестируйте изменения на эквиваленте нагрузки или в режиме симулятора перед проверкой с реальным трансивером!
