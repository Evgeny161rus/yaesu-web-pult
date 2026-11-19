"""Read-only ID probe for modern ASCII CAT Yaesu, on the selected port/rate.
IDs: Hamlib 4.7.2 rigs/yaesu/newcat.c nc_rigid_t. Never probe legacy binary CAT.
"""
import re
import time

IDS = {241: (1027, 'FT-450'), 244: (1046, 'FT-450D'), 310: (1028, 'FT-950'),
       135: (1036, 'FT-891'), 570: (1035, 'FT-991'), 670: (1035, 'FT-991A'),
       251: (1029, 'FT-2000'), 252: (1029, 'FT-2000D'), 583: (1034, 'FTDX-1200'),
       761: (1042, 'FTDX10'), 362: (1032, 'FTDX-5000'), 460: (1037, 'FTDX-3000'),
       462: (1037, 'FTDX-3000DM'), 681: (1040, 'FTDX101D'), 682: (1044, 'FTDX101MP'),
       800: (1049, 'FT-710'), 840: (1051, 'FTX-1')}
MODERN_MODELS = {x[0] for x in IDS.values()}


def parse_id(data):
    match = re.search(rb'(?:^|;)ID(\d{4});', data)
    if not match: return None
    ident = int(match[1])
    if ident not in IDS: raise ValueError(f'Неизвестный Yaesu ID {ident:04d}; выберите модель вручную')
    model, name = IDS[ident]
    return {'id': model, 'name': name, 'cat_id': f'{ident:04d}'}


def probe(port, baud):
    import serial
    if not port: raise ValueError('Сначала выберите CAT-порт')
    ser = serial.Serial(port=None, baudrate=int(baud), timeout=.1, write_timeout=.5)
    try:
        ser.rts = False
        ser.dtr = False
        ser.port = port
        ser.open()
        ser.reset_input_buffer()
        ser.write(b'ID;')
        data = b''
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline:
            data = (data + ser.read(128))[-2048:]
            result = parse_id(data)
            if result: return result
    finally:
        ser.close()
    raise ValueError('Нет ответа ID: проверьте порт и CAT RATE; старую модель выберите вручную')
