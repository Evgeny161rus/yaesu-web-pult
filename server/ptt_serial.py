"""Serial RTS/DTR PTT helper shared by the native CAT and Hamlib backends.

Many radios and interfaces (SignaLink, RigBlaster, Yaesu Standard COM port)
switch TX with an RTS or DTR line instead of a CAT command.  Keep the logic in
one small module so both backends behave the same way.
"""


class SerialPtt:
    """PTT via an RTS/DTR line of a (usually separate) serial port."""

    def __init__(self, port, line='RTS'):
        if not port:
            raise ValueError('PTT: не выбран COM-порт для линии RTS/DTR')
        import serial  # pyserial
        self.port = port
        self.line = str(line or 'RTS').upper()
        if self.line not in ('RTS', 'DTR'):
            self.line = 'RTS'
        self.ser = serial.Serial(port, 9600, timeout=0)
        # Do not key the transmitter while opening the port.
        self.ser.rts = False
        self.ser.dtr = False

    def set(self, on):
        if not self.ser:
            return
        value = bool(on)
        if self.line == 'DTR':
            self.ser.dtr = value
        else:
            self.ser.rts = value

    def close(self):
        if not self.ser:
            return
        try:
            self.set(False)
        finally:
            try:
                self.ser.close()
            finally:
                self.ser = None
