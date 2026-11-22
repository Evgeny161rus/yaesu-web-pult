"""
Сетевые утилиты для FTX-1 Пульт.
Функции для работы с сетевыми адресами, сертификатами и автозапуском.
"""
import datetime
import ipaddress
import logging
import os
import socket
import sys
from typing import List, Tuple, Optional

from constants import (
    CERT_VALIDITY_DAYS, RSA_KEY_SIZE, RSA_PUBLIC_EXPONENT,
    LOOPBACK_ADDRESSES
)

log = logging.getLogger("network")
IS_WIN = sys.platform == 'win32'


def local_ips() -> List[str]:
    """Получить список локальных IP-адресов (не loopback)."""
    ips = set()

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except Exception:
        pass

    return sorted(i for i in ips if not i.startswith(('127.', '169.254.')))


def ensure_cert(base_dir: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Создать самоподписанный сертификат для HTTPS, если его нет.

    Args:
        base_dir: Директория для сохранения сертификата

    Returns:
        Кортеж (путь к cert.pem, путь к key.pem) или (None, None) если не удалось
    """
    crt = os.path.join(base_dir, 'cert.pem')
    key = os.path.join(base_dir, 'key.pem')

    if os.path.exists(crt) and os.path.exists(key):
        return crt, key

    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
    except ImportError:
        log.warning(
            "Нет пакета cryptography — HTTPS выключен "
            "(микрофон с телефона работать не будет)"
        )
        return None, None

    # Генерация ключа
    k = rsa.generate_private_key(
        public_exponent=RSA_PUBLIC_EXPONENT,
        key_size=RSA_KEY_SIZE
    )

    # Создание сертификата
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'FTX-1 Remote')])

    # Альтернативные имена
    alt = [
        x509.DNSName('localhost'),
        x509.DNSName(socket.gethostname())
    ]
    for ip in local_ips() + ['127.0.0.1']:
        alt.append(x509.IPAddress(ipaddress.ip_address(ip)))

    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(k.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=CERT_VALIDITY_DAYS))
        .add_extension(x509.SubjectAlternativeName(alt), critical=False)
        .sign(k, hashes.SHA256())
    )

    # Сохранение
    with open(crt, 'wb') as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    with open(key, 'wb') as f:
        f.write(k.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption()
        ))

    return crt, key


def is_local_address(ip: str) -> bool:
    """Проверить, является ли IP-адрес локальным."""
    return ip in LOOPBACK_ADDRESSES


# Windows автозапуск
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"


def autostart_get() -> Optional[bool]:
    """
    Проверить статус автозапуска (только Windows).

    Returns:
        True если включен, False если выключен, None если не Windows
    """
    if not IS_WIN:
        return None

    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
            winreg.QueryValueEx(k, 'FTX1Pult')
            return True
    except OSError:
        return False


def autostart_set(on: bool, launch_cmd: str) -> Optional[bool]:
    """
    Установить автозапуск (только Windows).

    Args:
        on: Включить или выключить
        launch_cmd: Команда запуска

    Returns:
        Новый статус или None если не Windows
    """
    if not IS_WIN:
        return None

    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
        if on:
            winreg.SetValueEx(k, 'FTX1Pult', 0, winreg.REG_SZ, launch_cmd)
        else:
            try:
                winreg.DeleteValue(k, 'FTX1Pult')
            except OSError:
                pass

    return autostart_get()


def launch_command(base_dir: str, background: bool = True) -> str:
    """
    Получить команду для запуска программы.

    Args:
        base_dir: Базовая директория проекта
        background: Запускать в фоне

    Returns:
        Команда запуска
    """
    if getattr(sys, 'frozen', False):
        cmd = f'"{sys.executable}"'
    else:
        exe = sys.executable
        if IS_WIN and exe.lower().endswith('python.exe'):
            exe = exe[:-10] + 'pythonw.exe'
        pyw_file = os.path.join(base_dir, 'FTX1-Pult.pyw')
        cmd = f'"{exe}" "{pyw_file}"'

    return cmd + (' --background' if background else '')
