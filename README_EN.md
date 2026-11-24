# Yaesu Web Pult — Modern Web Control for Yaesu Transceivers

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)

Full-featured web interface for Yaesu transceivers (FTX-1, FT-710, FTDX10/101, FT-991, and more) via USB: CAT control, audio streaming, waterfall display, and complete transceiver control from any device.

```
 Transceiver ──USB──► PC with Server (CAT + USB Audio) ──Wi-Fi/LAN──► Web Browser
                      │                                              ├─ Same PC
                      └ http://localhost:8080                        ├─ Other PC
                                                                     ├─ Tablet
                                                                     └─ Android/iOS (PWA)
```

[🇷🇺 Русская версия](README.md) | **English**

## ✨ Key Features

### 🎨 Modern Interface
- **7 Professional Themes**: Modern Dark, Studio, Daylight, Radio Night, Heritage, Field, Tactical
- **Fully Responsive**: Adapts to desktop, tablet, and mobile screens
- **PWA Support**: Install as standalone app on mobile devices
- **Real-time Updates**: WebSocket-based instant feedback

### 📻 Transceiver Support
- **FTX-1**: Full native support with extended features
- **FT-710, FTDX10, FTDX101**: CAT via Hamlib + scope waterfall
- **FT-991/A, FT-891, FT-450, FT-950**: CAT via Hamlib
- **Other Yaesu Models**: Basic support via Hamlib

### 📊 Waterfall & Spectrum
- **Sources**: Audio DSP (all models), FT4222 USB-scope (FT-710/FTDX10/FTDX101, experimental), external **RTL-SDR** (`rtl_sdr`) around current VFO
- **Auto/Manual Span**: Auto (by filter width) or 3-24 kHz for audio; RTL-SDR uses configurable sample rate (default ~1.024 MHz)
- **Click/Double-click Tuning**: Click on signal to tune (RF mode) / double-click in audio mode
- **Filter Display**: Visual representation of bandwidth, IF SHIFT, notch

### 📡 Digital Modes
- **CW**: Decoder with template-based auto-reply
- **FT8/FT4**: Full automatic QSO handling, ADIF logging, PSK Reporter
- **RTTY**: TX/RX with multiple baud rates and shifts
- **PSK31**: TX/RX with auto-tune
- **NAVTEX**: Maritime weather/warnings decoder
- **SSTV**: Multiple modes (Martin, Scottie, Robot, PD)
- **WEFAX**: Weather fax reception

### 🎛️ Complete Control
- **All Receiver Controls**: AF, RF, SQL, AGC, IPO/AMP, ATT, NB, DNR, DNF, WIDTH, IF SHIFT, CLAR
- **Transmitter Settings**: Power, MIC GAIN, PROC, AMC, VOX, CTCSS/DCS, tuner
- **VFO Operations**: A↔B, SPLIT, MAIN/SUB, memory channels, scan, lock
- **Memory Editor**: Full-screen channel editor with import/export

### 📡 DX Cluster
- **Receive-only DXSpider feed**: configurable host/port and your call sign
- **Filters**: band (incl. current VFO), mode from the comment, age, call/country search, new DXCC/band only
- **One-click tuning**: double-click a spot to set the RX VFO; mode, split and PTT are never changed
- **Worked tags**: worked / new country / new band from the FT8 log and imported QSOs
- **Spectrum labels and DX workspace**: spot calls over the RF waterfall, spot list docked next to the spectrum

## 🚀 Quick Start

### Windows

1. Download **`Yaesu-Web-Pult-Setup.exe`** from
   [Releases → windows-latest](https://github.com/Evgeny161rus/yaesu-web-pult/releases/tag/windows-latest)
   and run it (the installer requests elevation). It installs to `C:\Program Files\Yaesu Web Pult`
   and bundles Hamlib, RTL-SDR, FTDI and CP210x drivers.
   Settings, certificates and recordings are stored in `%LOCALAPPDATA%\Yaesu Web Pult`.
   The application runs without elevation. On upgrade, legacy data is copied from
   the install directory once, preserving originals and existing user settings.
2. Connect the transceiver by USB and open the panel shortcut.
3. Unsigned build: accept the SmartScreen prompt («More info» → «Run anyway»).

Portable alternatives from the same release: `Yaesu-Web-Pult.exe` (single file)
or `Yaesu-Web-Pult-folder.zip`. The folder ZIP includes Hamlib and RTL-SDR;
the single-file EXE needs the bundled PowerShell scripts to add them. Portable
data stays beside the EXE.

### From source

1. Install **Yaesu Virtual COM Port driver** for your transceiver
2. Clone the repository:
   ```bash
   git clone https://github.com/Evgeny161rus/yaesu-web-pult.git
   cd yaesu-web-pult
   ```
3. Install Python 3.11+ and dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the server:
   ```bash
   python server/main.py --console
   ```
5. Open browser: `http://localhost:8080`

### Linux / Raspberry Pi

```bash
git clone https://github.com/Evgeny161rus/yaesu-web-pult.git
cd yaesu-web-pult
pip3 install -r requirements.txt
python3 server/main.py --console
```

### Docker

```bash
docker-compose up -d
```

See [DOCKER.md](docs/DOCKER.md) for details.

## 📚 Documentation

- [Quick Start Guide](START-HERE-RU.md) (Russian)
- [Theme Gallery](docs/THEMES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [WebSocket Protocol](docs/WEBSOCKET_PROTOCOL.md)
- [Docker Guide](docs/DOCKER.md)
- [Contributing](CONTRIBUTING.md)

## 🎨 Themes Preview

The interface includes 7 professionally designed themes:

- **Modern Dark**: Clean dark theme with blue accents
- **Studio**: Professional broadcast studio aesthetic
- **Daylight**: Bright theme for well-lit environments
- **Radio Night**: Traditional radio equipment look
- **Heritage**: Classic amateur radio styling
- **Field**: Rugged outdoor operations theme
- **Tactical**: Military-inspired low-light interface

See [THEMES.md](docs/THEMES.md) for screenshots and details.

## 🔧 System Requirements

### Minimum
- **OS**: Windows 10/11, Linux, macOS
- **Python**: 3.11 or later
- **RAM**: 1 GB
- **USB**: One available USB port for transceiver

### Recommended
- **RAM**: 2 GB
- **CPU**: Multi-core for smooth waterfall
- **Network**: Wi-Fi or LAN for remote access

### Raspberry Pi
- **Model**: Raspberry Pi 3 or later
- **RAM**: 1 GB minimum
- **OS**: Raspberry Pi OS (Debian-based)

## 📖 Usage Examples

### Remote Operation
Access your transceiver from anywhere on your network:
```
PC with transceiver → Server → Network → Tablet/Phone/PC
```

### Field Operations
Run server on Raspberry Pi, control from phone via hotspot.

### Contest Station
Multiple operators can monitor (read-only mode available).

### Digital Modes
Built-in FT8/FT4 decoder eliminates need for WSJT-X on remote device.

## 🔐 Security

- **Password Protection**: Optional authentication
- **HTTPS Support**: Automatic self-signed certificates
- **Local Network**: Designed for trusted network operation
- **Read-only Mode**: Monitor without control

## 🛠️ Development

### Build from Source
```bash
git clone https://github.com/Evgeny161rus/yaesu-web-pult.git
cd yaesu-web-pult
pip install -r requirements.txt
python -m pytest tests/
```

### Run Tests
```bash
pytest tests/ -v
```

### Build Windows EXE
```bash
python -m PyInstaller Yaesu-Web-Pult.pyw --onefile --noconsole
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

### Areas for Contribution
- Additional transceiver models
- New themes
- Translations
- Documentation improvements
- Bug fixes

## 📝 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **ft8_lib** by Karlis Goba - FT8/FT4 decoder/encoder
- **Hamlib** project - Multi-radio support
- **wfview** - FT-710 scope protocol reference
- Amateur radio community for testing and feedback

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Evgeny161rus/yaesu-web-pult/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Evgeny161rus/yaesu-web-pult/discussions)
- **Author**: R6AAF

## 🗺️ Roadmap

- [ ] Additional transceiver models
- [ ] Mobile app (React Native)
- [ ] Cloud sync for settings
- [ ] Multi-language interface
- [ ] Advanced logging features

## 📸 Screenshots

*Coming soon - see [THEMES.md](docs/THEMES.md) for theme previews*

## ⚡ Performance

- **Waterfall**: 10-20 FPS typical
- **Latency**: <100ms on local network
- **CPU Usage**: 5-15% on modern hardware
- **Memory**: ~100-200 MB typical

## 🌐 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

## 📊 Statistics

```
Lines of Code:    ~35,000
Languages:        Python, JavaScript, CSS
Tests:            48 unit tests
Supported TRX:    10+ models
Themes:           7 professional
Documentation:    Comprehensive
```

---

**73!** 📻

Made with ❤️ by the amateur radio community
