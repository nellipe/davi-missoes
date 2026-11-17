"""Entrada do serviço; carrega configuração local antes de importar a aplicação."""
import json
import os
from pathlib import Path
import sys

if __name__ == '__main__':
    config = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    if not Path(config['DAVI_DATA_DIR'], 'agenda.sqlite3').is_file():
        raise SystemExit('Banco existente ausente. Serviço não criará uma agenda vazia.')
    for key, value in config.items():
        if not key.startswith('DAVI_') or not isinstance(value, str):
            raise ValueError('Configuração inválida.')
        os.environ[key] = value
    import server
    server.main()
