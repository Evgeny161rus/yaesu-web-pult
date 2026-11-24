# AGENTS.md

Перед крупными изменениями прочитайте:

- [docs/AI-HANDOFF.md](docs/AI-HANDOFF.md) — актуальный контекст, состояние,
  архитектура и известные грабли;
- [README.md](README.md) и [CHANGELOG.md](CHANGELOG.md) — функции и история;
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) и
  [docs/RADIO-SUPPORT.md](docs/RADIO-SUPPORT.md) — технические детали.

Короткие правила:

- `main` защищён: изменения — через ветку и Pull Request, после зелёного CI.
- Перед push: `pytest tests -q` (сейчас 99 passed, 4 skipped).
- Секреты, пароли, ключи и реальные `config.json` в репозиторий не коммитить.
- Поддерживаемые способы установки: Windows `Yaesu-Web-Pult-Setup.exe` и
  Raspberry Pi `yaesu-web-pult-pi.tar.gz` + `deploy/install-rpi.sh`.
- Не добавлять альтернативные упаковки без реального теста USB-COM,
  USB-audio, `_ftx`, `cty.dat` и SDR.
- Релизы `windows-latest`/`pi-latest` собираются GitHub Actions; вручную
  теги не двигать.
