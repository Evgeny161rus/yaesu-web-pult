"""
Константы приложения FTX-1 Пульт.
Централизованное хранение всех магических чисел и конфигурационных значений.
"""

# Версия приложения
VERSION = "3.2-preview"
APP_NAME = "Yaesu Web Pult"

# Аудио параметры
SAMPLE_RATE = 48000  # Частота дискретизации USB-кодека FTX-1
AUDIO_RATES = {
    'HIGH': 48000,    # Без пересчёта, для локального ПК
    'MEDIUM': 16000,  # Оптимально для Wi-Fi
    'LOW': 8000       # Для мобильного интернета
}
DECIMATION_FACTORS = {
    48000: 1,
    16000: 3,
    8000: 6
}

# Конверсия аудио
PCM_INT16_MAX = 32767  # Максимальное значение для 16-битного PCM
PCM_FLOAT_RANGE = 32768.0  # Диапазон для нормализации float->int16

# Сетевые параметры
DEFAULT_HTTP_PORT = 8080
DEFAULT_HTTPS_PORT = 8443
LOOPBACK_ADDRESSES = ('127.0.0.1', '::1', '::ffff:127.0.0.1')

# Защита передачи
DEFAULT_MAX_TX_SECONDS = 180  # Максимальная длительность передачи
PTT_ALIVE_TIMEOUT = 1.5  # Таймаут подтверждения PTT от клиента (секунды)
PTT_WATCHDOG_INTERVAL = 0.25  # Интервал проверки watchdog (секунды)

# WebSocket
WS_BINARY_AUDIO_RX = b'\x01'  # Маркер аудио приёма
WS_BINARY_WATERFALL = b'\x02'  # Маркер данных водопада
WS_BINARY_AUDIO_TX = b'\x03'  # Маркер аудио передачи

# CAT протокол
DEFAULT_CAT_BAUD = 38400  # Скорость CAT по умолчанию
CAT_COMMAND_MAX_LENGTH = 64  # Максимальная длина CAT-команды

# Логирование
LOG_MAX_LINES = 500  # Максимум строк в буфере лога
LOG_FILE_MAX_BYTES = 1_000_000  # Максимальный размер лог-файла
LOG_BACKUP_COUNT = 1  # Количество резервных копий лога

# Водопад и спектр
WATERFALL_MAX_HZ = 24000  # Максимальная ширина водопада
WATERFALL_MIN_HZ = 500  # Минимальная ширина водопада
WATERFALL_DEFAULT_HZ = 4000  # Ширина по умолчанию
SPECTRUM_STALE_TIMEOUT = 1.0  # Таймаут устаревания данных спектра (секунды)

# dBFS параметры
DBFS_OFFSET = -130  # Смещение для dBFS
DBFS_STEP = 0.5  # Шаг уровня в dB

# Безопасность
PASSWORD_FAIL_DELAY_BASE = 0.7  # Базовая задержка при неверном пароле
PASSWORD_FAIL_DELAY_MAX = 5  # Максимальная задержка

# Сертификаты
CERT_VALIDITY_DAYS = 3650  # Срок действия самоподписанного сертификата
RSA_KEY_SIZE = 2048  # Размер RSA ключа
RSA_PUBLIC_EXPONENT = 65537  # Публичная экспонента RSA

# Память и каналы
MEMORY_CHANNEL_MIN = 1
MEMORY_CHANNEL_MAX = 999
MEMORY_NAME_MAX_LENGTH = 12  # Максимальная длина имени канала

# CW параметры
CW_WPM_MIN = 5  # Минимальная скорость в словах/минуту
CW_WPM_MAX = 45  # Максимальная скорость
CW_MEMORY_SLOTS = 5  # Количество ячеек памяти CW
CW_MEMORY_MAX_LENGTH = 50  # Максимум знаков в ячейке

# FT8/FT4 параметры
FT8_SLOT_DURATION = 15.0  # Длительность слота FT8 (секунды)
FT4_SLOT_DURATION = 7.5  # Длительность слота FT4 (секунды)
FT8_TIME_TOLERANCE = 0.5  # Допустимое отклонение времени (секунды)
FT8_PSK_REPORTER_INTERVAL = 300  # Интервал отправки на PSK Reporter (секунды)

# RTTY параметры
RTTY_BAUD_RATES = [45.45, 50, 75, 100]  # Поддерживаемые скорости
RTTY_SHIFT_MIN = 170  # Минимальный сдвиг (Гц)
RTTY_SHIFT_MAX = 850  # Максимальный сдвиг (Гц)

# Метеофакс
WEFAX_LPM = 120  # Строк в минуту
WEFAX_IOC = 576  # Index of Cooperation

# SSTV режимы
SSTV_MODES = {
    'MARTIN_M1': 'Martin M1',
    'MARTIN_M2': 'Martin M2',
    'SCOTTIE_S1': 'Scottie S1',
    'SCOTTIE_S2': 'Scottie S2',
    'ROBOT_36': 'Robot 36',
    'PD_90': 'PD 90',
    'PD_120': 'PD 120',
    'PD_180': 'PD 180'
}

# HTTP коды статуса
HTTP_OK = 200
HTTP_NOT_FOUND = 404
HTTP_FORBIDDEN = 403
HTTP_INTERNAL_ERROR = 500

# Таймауты
PROBE_TIMEOUT = 5.0  # Таймаут определения модели трансивера
AUDIO_START_TIMEOUT = 2.0  # Таймаут запуска аудио
HAMLIB_START_TIMEOUT = 10.0  # Таймаут запуска rigctld

# Windows специфичные
WINDOWS_CREATE_NO_WINDOW = 0x08000000  # Флаг CREATE_NO_WINDOW для subprocess

# Пути и файлы
CONFIG_FILENAME = 'config.json'
LOG_FILENAME = 'ftx1-pult.log'
CERT_FILENAME = 'cert.pem'
KEY_FILENAME = 'key.pem'
MENU_FILENAME = 'menu_ftx1.json'
FT8_LOG_FILENAME = 'ft8_log.adi'
CTY_FILENAME = 'cty.dat'

# Директории данных
DIR_FAX = 'fax'
DIR_VOICE = 'voice'
DIR_RECORDS = 'records'
DIR_SSTV = 'sstv'
DIR_MEMORY = 'memory'
DIR_WEB = 'web'

# AI/LM Studio - DEPRECATED (удалено для совместимости с Raspberry Pi)
# DEFAULT_AI_URL = 'http://localhost:1234/v1'
# AI_REQUEST_TIMEOUT = 30.0
