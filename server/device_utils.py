"""
Утилиты для работы с COM-портами и звуковыми устройствами.
"""
import logging
from typing import List, Dict

log = logging.getLogger("devices")


def list_ports() -> List[Dict[str, any]]:
    """
    Получить список доступных COM-портов.

    Returns:
        Список словарей с информацией о портах
    """
    try:
        from serial.tools import list_ports as lp
    except ImportError:
        log.warning("pyserial не установлен - список портов недоступен")
        return []

    result = []
    for p in sorted(lp.comports(), key=lambda x: x.device):
        desc = p.description or ''
        desc_lower = desc.lower()

        result.append({
            'device': p.device,
            'desc': desc,
            'kind': (
                'enhanced' if 'enhanced' in desc_lower else
                'standard' if 'standard' in desc_lower else
                ''
            ),
            'cp210x': (
                'cp210' in desc_lower or
                'silicon labs' in desc_lower or
                (p.vid == 0x10C4)
            )
        })

    return result


def list_audio(refresh: bool = False) -> List[Dict[str, any]]:
    """
    Получить список звуковых устройств.

    Args:
        refresh: Обновить список устройств

    Returns:
        Список словарей с информацией об устройствах
    """
    try:
        from audio import list_devices
        return list_devices(refresh)
    except Exception as e:
        log.warning("Звуковые устройства недоступны: %s", e)
        return []


def detect_ftx1(ports: List[Dict], audio: List[Dict]) -> Dict[str, str]:
    """
    Автоопределение настроек для FTX-1.

    Ищет Enhanced-порт для CAT, Standard для PTT и USB Audio CODEC.

    Args:
        ports: Список COM-портов
        audio: Список звуковых устройств

    Returns:
        Словарь с предложенными настройками
    """
    out = {}

    # CAT порт: Enhanced или CP210x
    enh = [p for p in ports if p['kind'] == 'enhanced']
    if enh:
        out['cat_port'] = enh[0]['device']
    elif any(p['cp210x'] for p in ports):
        out['cat_port'] = [p for p in ports if p['cp210x']][0]['device']

    # PTT порт: Standard
    std = [p for p in ports if p['kind'] == 'standard']
    if std:
        out['ptt_port'] = std[0]['device']

    # Аудио устройства
    from audio import guess_codec
    di, do = guess_codec(audio)
    if di and do:
        out['audio_in_name'] = di['name']
        out['audio_out_name'] = do['name']
        out['audio_api'] = ''

    return out


def format_port_info(port: Dict) -> str:
    """
    Форматировать информацию о порте для вывода.

    Args:
        port: Словарь с информацией о порте

    Returns:
        Отформатированная строка
    """
    return f"{port['device']:8s} {port['desc']}"


def format_audio_info(device: Dict) -> str:
    """
    Форматировать информацию об аудио устройстве.

    Args:
        device: Словарь с информацией об устройстве

    Returns:
        Отформатированная строка
    """
    return (
        f"[{device['index']:2d}] {device['name']:45s} "
        f"{device['api']:20s} in={device['in']} out={device['out']}"
    )
