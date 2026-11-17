"""Entrada do serviço; carrega configuração local antes de importar a aplicação."""
import json
import os
from pathlib import Path
import sys

if __name__ == '__main__':
    config = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    if not Path(config['DAVI_DATA_DIR'], 'agenda.sqlite3').is_file():
        raise SystemExit('Banco existente ausente. Serviço não criará uma agenda vazia.')
    # Configuração do serviço é independente de variáveis herdadas de execução manual.
    for key in list(os.environ):
        if key.startswith('DAVI_'):
            del os.environ[key]
    for key, value in config.items():
        if not key.startswith('DAVI_') or not isinstance(value, str):
            raise ValueError('Configuração inválida.')
        os.environ[key] = value
    import server
    if server.CONFIG.auto_child:
        from maintenance import readonly
        from contextlib import closing
        with closing(readonly(server.DB)) as connection:
            password = connection.execute("SELECT value FROM settings WHERE key='password'").fetchone()
            if not password or not password[0]:
                raise SystemExit('Senha administrativa existente ausente. Publicação cancelada.')
    server.main()
