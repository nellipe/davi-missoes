"""Backup online consistente; restauração somente com aplicação e proxy parados."""
import argparse
from contextlib import closing
import getpass
import os
from pathlib import Path
import secrets
import sqlite3
import time


def readonly(path):
    return sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)


def integrity(path):
    with closing(readonly(path)) as c:
        result = c.execute('PRAGMA integrity_check').fetchall()
    if result != [('ok',)]:
        raise ValueError('Falha de integridade; arquivo não será usado.')


def backup(source, directory, keep=14):
    source, directory = Path(source).resolve(), Path(directory).resolve()
    if not 1 <= keep <= 365:
        raise ValueError('Retenção deve estar entre 1 e 365.')
    integrity(source)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / (time.strftime('davi-%Y%m%d-%H%M%S-') + secrets.token_hex(4) + '.sqlite3')
    staging = target.with_suffix('.partial')
    try:
        with closing(readonly(source)) as src, closing(sqlite3.connect(staging)) as dst:
            src.backup(dst)
        integrity(staging)
        staging.replace(target)
        owned = sorted(directory.glob('davi-*.sqlite3'), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in owned[keep:]:
            if old.resolve() != source:
                old.unlink()
    finally:
        staging.unlink(missing_ok=True)
    return target


def restore(source, target, confirm_stopped=False):
    source, target = Path(source).resolve(), Path(target).resolve()
    if not confirm_stopped or source == target:
        raise ValueError('Confirme serviços parados e escolha arquivos diferentes.')
    if any(Path(str(target) + suffix).exists() for suffix in ('-wal', '-shm', '-journal')):
        raise ValueError('Há arquivos auxiliares SQLite. Não remova; investigue antes de restaurar.')
    integrity(source)
    if target.exists():
        backup(target, target.parent / 'antes-restauracao')
    staging = target.with_name('restore-' + secrets.token_hex(8) + '.partial')
    try:
        with closing(readonly(source)) as src, closing(sqlite3.connect(staging)) as dst:
            src.backup(dst)
        integrity(staging)
        os.replace(staging, target)
        # Sessões antigas não devem reabrir acesso depois de uma restauração.
        auth = target.parent / 'auth.sqlite3'
        if auth.exists():
            with closing(sqlite3.connect(auth)) as c, c:
                c.execute('DELETE FROM sessions')
                c.execute('DELETE FROM pairing')
    finally:
        staging.unlink(missing_ok=True)


def scheduled_backup(source, directory, stop):
    while not stop.is_set():
        try:
            backup(source, directory)
            print('Backup e integridade: OK.', flush=True)
        except Exception:
            print('Backup falhou; verifique armazenamento e permissões.', flush=True)
        stop.wait(86400)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['backup', 'integrity', 'restore', 'init-parent'])
    parser.add_argument('--database', type=Path, required=True)
    parser.add_argument('--directory', type=Path)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--keep', type=int, default=14)
    parser.add_argument('--confirm-stopped', action='store_true')
    args = parser.parse_args()
    if args.action == 'backup':
        if not args.directory: parser.error('--directory obrigatório')
        backup(args.database, args.directory, args.keep)
    elif args.action == 'integrity':
        integrity(args.database)
    elif args.action == 'restore':
        if not args.source: parser.error('--source obrigatório')
        restore(args.source, args.database, args.confirm_stopped)
    else:
        # Não aceita senha por linha de comando, env ou arquivo versionado.
        from server import hash_password
        integrity(args.database)
        password = getpass.getpass('Nova senha do responsável (10 a 256 caracteres): ')
        if not 10 <= len(password) <= 256 or password != getpass.getpass('Repita a senha: '):
            parser.error('Senha inválida ou confirmação diferente.')
        with closing(sqlite3.connect(args.database)) as c, c:
            if c.execute("SELECT 1 FROM settings WHERE key='password'").fetchone():
                parser.error('Já existe senha. Não sobrescrever; use o acesso existente.')
            c.execute("INSERT INTO settings VALUES('password',?)", (hash_password(password),))
    print('Operação concluída.')


if __name__ == '__main__':
    main()
