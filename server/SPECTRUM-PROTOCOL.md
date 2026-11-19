# Spectrum v1 — incremental integration

The server owns acquisition and FFT. The browser renders the returned bins.
The contract and cache use Python's standard library, with no OS or device API.
Drivers for FT4222 and external SDR will publish `SpectrumFrame` on the server
event loop; worker threads must schedule publication via `call_soon_threadsafe`.
They are not implemented yet. No driver is loaded by this module.

After normal WebSocket authentication, send `{"t":"spectrum_get"}`. Wait for the
response before requesting again, at most 25 times/second. This pull protocol
does not create per-client background producer tasks. The acquisition cache
holds exactly one frame; consumers can skip sequence numbers. Existing audio
and binary waterfall messages are unchanged. The current browser still uses
that existing protocol; v1 is an opt-in integration endpoint.

Response fields: `t: spectrum`, `version: 1`, `sequence`, `status`, `frame`.
Status is `live`, `stale` (no new frame for one second), or `unavailable`.
Only `live` includes a frame. `age_ms` is server-monotonic elapsed time since
publication, not UTC capture time and not a measurement of network latency.
Stopping/restarting the radio clears the cache. Sequence increases across
source changes and resets when the server process is restarted.

Frame fields:

| Field | Meaning |
| --- | --- |
| source | Producer identifier, currently `audio` |
| domain | `audio` or `rf`; audio is not an RF tuning scale |
| first_hz | Centre frequency of bin 0 |
| bin_hz | Positive spacing between bin centres |
| levels | 2–8192 unsigned 8-bit integers |
| unit | `dBFS`, `dBm`, or `relative` |
| level_offset, level_step | Physical level = offset + byte × step |
| demo | True when supplied by simulation |

RF sources must provide absolute RF frequencies, after correcting for IF offset
and inversion. A driver must not label uncalibrated receiver levels as dBm.
Current audio adapter: first=0 Hz, spacing=48000/4096 Hz, offset=-130,
step=0.5, dBFS (FFT amplitude reference, not RF power). Byte values saturate at
0 and 255. A waterfall renderer should clear history when source, domain,
frequency geometry or units change, and stop adding rows when stale.

Before the browser switches to v1, implement request pacing, response timeout,
source-change handling and rendering tests. Keep the existing protocol until
those checks pass. No RF click-to-tune is enabled by this server endpoint.

## Raspberry Pi portability boundaries

Reusable: browser HTML/JS/CSS, WebSocket protocol, spectrum frames/cache,
CAT logic, settings and application behaviour. Platform-specific work:
FTDI/SDR native libraries for ARM64, USB permissions, stable serial/audio device
selection, Linux audio backend, FT8 extension compilation, headless service
startup/shutdown and installation. Current `--background` still attempts a tray
icon; it is not yet a complete systemd deployment mode. Windows Hamlib bundled
executable resolution also needs a Linux packaging path.

Validate on ARM64 before calling the Pi distribution supported: native builds,
USB unplug/replug, repeated stop/start, PTT/watchdog, audio latency, CPU/memory,
slow network clients and sustained spectrum rendering. Protocol compatibility
alone is not evidence of hardware compatibility.
