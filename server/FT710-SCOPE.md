# FT-710 USB spectrum: experimental decoder

Implemented: pure Python decoder for one aligned 4096-byte SPI packet. It uses
only the standard library and the common SpectrumFrame contract. It performs
no USB access, CAT commands, transmission or automatic device selection.
It is not enabled in the live server yet.

Protocol facts were checked against wfview commit
`a14d5e8c7688c5554d3cf6df00e2ee69caa6d900`:

- https://github.com/wf-group/wfview/blob/a14d5e8c7688c5554d3cf6df00e2ee69caa6d900/include/packettypes.h
- https://github.com/wf-group/wfview/blob/a14d5e8c7688c5554d3cf6df00e2ee69caa6d900/src/radio/yaesucommander.cpp
- https://github.com/wf-group/wfview/blob/a14d5e8c7688c5554d3cf6df00e2ee69caa6d900/rigs/FT-710.rig

This implementation is newly written Python, not copied C++ source. The reference
project is GPL-3.0; no third-party code or binary is bundled by this change.

Main spectrum occupies bytes 0..849, with inverted unsigned levels. Metadata
starts at byte 2900; relative offsets 32, 52, 64 and 89 give span code,
geometry and two five-byte packed-BCD frequencies. The final four bytes are
FF 01 EE 01. This marker is not a checksum; a packet passing validation is not
proof that every byte is correct. Input must already be aligned by transport.

Only Center produces SpectrumFrame. Cursor/Fixed decode metadata but explicitly
reject frequency conversion. Levels remain relative, not dBm. The endpoint
frequency convention (span across 849 intervals) is provisional and must be
checked against captured signals before enabling click-to-tune. No second
receiver is inferred from unused packet fields.

Tests use synthetic packets, not captured hardware data. They cover inversion,
BCD, all ten spans, bounds, truncation, alignment and unsupported geometry.
Real captures are still required to verify firmware variants and alignment.

Transport is now implemented in `ft4222_transport.py`, with explicit interface
serial selection, absolute library paths, requested 100 ms FTDI timeouts,
short-read handling and cleanup on setup/read failure. It is synchronous and
must run in one dedicated worker. A native driver hang cannot be forcibly
interrupted by a Python timeout; process isolation remains a deployment option.
There is no automatic reopen, SPI INIT write, CAT write or device scanning.

ABI declarations were checked against FTDI's AN_329 and vendor headers:
- https://ftdichip.com/wp-content/uploads/2024/03/AN_329_User_Guide_for_LibFT4222-v1.8.pdf
- https://github.com/Bridgetek/EveApps/blob/master/common/eve_hal/Hdr/LibFT4222.h
- https://github.com/Bridgetek/EveApps/blob/master/common/eve_hal/Hdr/WinTypes.h
- https://github.com/Bridgetek/EveApps/blob/master/common/eve_hal/Hdr/ftd2xx.h

LibFT4222 uses cdecl; Windows D2XX uses WINAPI. DWORD/ULONG/BOOL are declared
32-bit, counts 16-bit, handles pointer-sized. Native library execution on
Windows/Linux/ARM64 has not yet been tested. No vendor DLL/SO is bundled.

Diagnostic raw capture (from source checkout; paths/serial are placeholders):

```powershell
python server/capture_ft710.py --serial YOUR_SPI_SERIAL --libft4222 C:/FTDI/LibFT4222.dll --d2xx C:/FTDI/ftd2xx.dll --out capture.jsonl --reads 50
```

On Linux give an absolute path to libft4222.so; --d2xx may be omitted if that
library exports the D2XX API. Select the SPI interface serial, not the CAT port.
SCU-LAN10 spectrum output must be enabled in the radio menu per wfview's setup
guide. Close any other application using this SPI interface first.
The diagnostic tool initializes the SPI interface and reads it; it does not
send CAT/PTT commands. JSONL records preserve every read boundary and elapsed
time, including empty reads. Existing files are never overwritten. An aborted
capture may remain as a partial file. Up to 10000 reads are allowed.

23 tests pass, including fake-library failures at every setup stage, read
failure, short/empty reads, cleanup, reopening, ABI widths and capture output.
These are not hardware certification. Next: raw capture replay, alignment,
hardware validation, then worker integration. Do not publish this experimental
transport as a working live FT-710 source until those steps pass.
