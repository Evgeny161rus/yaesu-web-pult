"""Optional backend boundary: native startup never imports Hamlib."""
import importlib
import sys


def _hamlib():
    try:
        return importlib.import_module('hamlib_backend')
    except ModuleNotFoundError as exc:
        if exc.name != 'hamlib_backend':
            raise
        raise RuntimeError('Модуль Hamlib не включён в эту сборку. Выберите штатный драйвер или полную сборку.') from exc


def create_hamlib(cfg, on_change):
    return _hamlib().HamlibRig(cfg, on_change)


def list_hamlib_models(executable):
    return _hamlib().list_models(executable)


def is_hamlib(rig):
    module = sys.modules.get('hamlib_backend')
    return module is not None and isinstance(rig, module.HamlibRig)
