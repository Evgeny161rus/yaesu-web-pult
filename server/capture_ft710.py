"""Explicit diagnostic capture; not part of automatic server startup."""
import argparse
import json
import time

from ft4222_transport import Ft4222Transport, load_api


def capture(transport, output, reads, clock=time.monotonic):
    if type(reads) is not int or not 1 <= reads <= 10000:
        raise ValueError('Read count must be 1..10000')
    # Exclusive creation preserves any previous capture. Each record retains
    # read boundaries; concatenation would hide short reads and sync failures.
    with open(output, 'x', encoding='utf-8') as stream:
        stream.write(json.dumps({'format': 'ft710-spi-capture', 'version': 1,
                                 'read_size': 4096}) + '\n')
        with transport:
            started = clock()
            for index in range(reads):
                data = transport.read(4096)
                stream.write(json.dumps({'index': index,
                                         'elapsed_ms': round((clock() - started) * 1000),
                                         'hex': data.hex()}) + '\n')


def main():
    parser = argparse.ArgumentParser(description='Experimental FT-710 SPI capture; no CAT commands')
    parser.add_argument('--serial', required=True, help='Serial of the FT4222 SPI interface, not CAT COM port')
    parser.add_argument('--libft4222', required=True, help='Absolute FT4222 library path')
    parser.add_argument('--d2xx', help='Absolute D2XX library path (required on Windows)')
    parser.add_argument('--out', required=True, help='New JSONL file; existing files are never overwritten')
    parser.add_argument('--reads', type=int, default=50)
    args = parser.parse_args()
    if not 1 <= args.reads <= 10000:
        parser.error('--reads must be 1..10000')
    spi, d2xx = load_api(args.libft4222, args.d2xx)
    capture(Ft4222Transport(spi, d2xx, args.serial), args.out, args.reads)
    print('Raw capture saved. This does not confirm packet alignment or spectrum validity.')


if __name__ == '__main__':
    main()
