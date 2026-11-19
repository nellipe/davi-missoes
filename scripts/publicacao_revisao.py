"""Cópia fechada e verificações HTTPS para a publicação manual."""

import argparse
import hashlib
import http.client
import json
from pathlib import Path
import re
import shutil
import socket
import sqlite3
import ssl
import stat
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import closing
from datetime import datetime, timezone
from http.cookies import SimpleCookie


DATABASES = ("agenda.sqlite3", "auth.sqlite3")
SIDECARS = ("", "-wal", "-shm", "-journal")


class ResolvedHTTPS(http.client.HTTPSConnection):
    def __init__(self, hostname, address, port, ca):
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.load_verify_locations(cafile=str(ca))
        super().__init__(hostname, port, timeout=5, context=context)
        self.address = address
        self.context = context

    def connect(self):
        raw = socket.create_connection((self.address, self.port), self.timeout)
        try:
            self.sock = self.context.wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


def served_build(hostname, address, port, ca):
    with closing(ResolvedHTTPS(hostname, address, port, ca)) as connection:
        connection.request("GET", "/api/build", headers={"Cache-Control": "no-cache"})
        with connection.getresponse() as response:
            if response.status != 200:
                raise ValueError(f"Resposta HTTPS inesperada: HTTP {response.status}.")
            build = json.loads(response.read(4096))
    if not isinstance(build, dict) or not re.fullmatch("[0-9a-f]{40}", str(build.get("commit", ""))):
        raise ValueError("SHA efetivamente servido ausente ou invalido.")
    if not isinstance(build.get("version"), str) or not build["version"]:
        raise ValueError("Versao efetivamente servida ausente.")
    return {key: build[key] for key in ("commit", "version")}


MODULES = (
    "/app.js", "/forest.js", "/assets/forest/chibi.mjs", "/assets/forest/sight.mjs",
    "/assets/forest/companion.mjs", "/assets/forest/navigation.mjs",
    "/assets/forest/trail.mjs", "/assets/forest/map-2d.mjs",
    "/vendor/three/three.module.min.js",
)


class ProbeFailure(ValueError):
    """An error that contains only the probe's own route and status."""


class OriginProbe:
    def __init__(self, hostname, address, port, ca):
        self.destination = (hostname, address, port, ca)
        self.cookie = ""

    def get(self, path):
        try:
            with closing(ResolvedHTTPS(*self.destination)) as client:
                headers = {"Cache-Control": "no-cache"}
                if self.cookie:
                    headers["Cookie"] = self.cookie
                client.request("GET", path, headers=headers)
                with client.getresponse() as response:
                    if response.status != 200:
                        raise ProbeFailure(f"{path} HTTP {response.status}")
                    body = response.read()
                    if not body:
                        raise ProbeFailure(f"{path} resposta vazia")
                    return (body, response.headers.get_content_type(),
                            response.headers.get("Set-Cookie", ""))
        except (OSError, http.client.HTTPException) as error:
            code = getattr(error, 'winerror', None) or getattr(error, 'errno', None)
            raise ProbeFailure(f"{path} {type(error).__name__} código {code}") from None

    def check(self, path, expected):
        body, media_type, _ = self.get(path)
        if path == "/":
            if media_type != "text/html" or b'id="content"' not in body:
                raise ProbeFailure("/ HTML da aplicação não identificado")
            return
        if path in MODULES:
            if media_type != "text/javascript":
                raise ProbeFailure(f"{path} tipo JavaScript inesperado")
            return
        try:
            data = json.loads(body)
            if path == "/api/build" and data.get("commit") == expected:
                return
            if path == "/api/forest/map" and all(isinstance(data.get(field), dict) for field in
                                                 ("position", "layout", "economy", "collision")):
                return
        except (ValueError, AttributeError):
            pass
        raise ProbeFailure(f"{path} conteúdo inesperado")


def stable_origin(probe, expected, seconds, session_file=None):
    if session_file:
        probe.cookie = json.loads(session_file.read_text(encoding='utf-8'))["cookie"]
    raw, _, cookie_header = probe.get("/api/me")
    if json.loads(raw).get("authorized") is not True:
        raise ProbeFailure("/api/me sessão infantil indisponível")
    if not probe.cookie:
        cookies = SimpleCookie(cookie_header)
        if "davi_session" not in cookies:
            raise ProbeFailure("/api/me sessão ausente")
        probe.cookie = "davi_session=" + cookies["davi_session"].value

    paths = ("/", "/api/build", "/api/forest/map", *MODULES)
    started = time.monotonic()
    rounds = 0
    with ThreadPoolExecutor(max_workers=len(paths)) as workers:
        while True:
            jobs = [workers.submit(probe.check, path, expected) for path in paths]
            for future in as_completed(jobs):
                future.result()
            rounds += 1
            elapsed = time.monotonic() - started
            if elapsed >= seconds:
                return {"rounds": rounds, "requests": rounds * len(paths), "seconds": round(elapsed, 2)}
            time.sleep(.6)


def snapshot_entries(directory):
    """Hash files and enumerate empty directories without traversing reparse points."""
    result = {}
    pending = [directory]
    while pending:
        entry = pending.pop()
        info = entry.lstat()
        if stat.S_ISLNK(info.st_mode) or (
            getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT
        ):
            raise ValueError("Link ou ponto de redirecionamento na arvore de backup.")
        relative = entry.relative_to(directory).as_posix()
        if stat.S_ISDIR(info.st_mode):
            pending.extend(entry.iterdir())
            result[relative] = None
        elif stat.S_ISREG(info.st_mode):
            with entry.open("rb") as handle:
                result[relative] = hashlib.file_digest(handle, "sha256").hexdigest()
        else:
            raise ValueError("Tipo de arquivo inesperado na arvore de backup.")
    return result


def check_snapshot(directory, private_parent):
    with tempfile.TemporaryDirectory(prefix="integridade-", dir=private_parent) as work:
        for name in DATABASES:
            saved = directory / name
            if not saved.is_file():
                raise ValueError(f"Banco ausente na copia: {name}.")
            for suffix in SIDECARS:
                source = directory / (name + suffix)
                if source.exists():
                    shutil.copy2(source, work)
            # Recovery can update WAL/SHM or apply a hot journal on the scratch copy.
            scratch = Path(work) / name
            with closing(sqlite3.connect(scratch.as_uri() + "?mode=rw", uri=True)) as conn:
                if conn.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
                    raise ValueError(f"Falha SQLite na copia de {name}.")


def snapshot(root, destination):
    root, destination = root.resolve(), destination.resolve()
    if destination.is_relative_to(root) or not destination.is_dir():
        raise ValueError("O destino privado deve existir fora da instalacao.")
    for folder in ("dados", "publicacao"):
        source, target = root / folder, destination / folder
        before = snapshot_entries(source)
        shutil.copytree(source, target)
        if snapshot_entries(target) != before or snapshot_entries(source) != before:
            raise ValueError(f"Origem ou copia divergente: {folder}.")
    check_snapshot(destination / "dados", destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    tls = commands.add_parser("https")
    tls.add_argument("hostname")
    tls.add_argument("address")
    tls.add_argument("port", type=int)
    tls.add_argument("ca", type=Path)
    backup = commands.add_parser("snapshot")
    backup.add_argument("root", type=Path)
    backup.add_argument("destination", type=Path)
    stable = commands.add_parser("stable")
    stable.add_argument("hostname")
    stable.add_argument("address")
    stable.add_argument("port", type=int)
    stable.add_argument("ca", type=Path)
    stable.add_argument("expected")
    stable.add_argument("--seconds", type=int, choices=range(5, 61), default=12, metavar="5..60")
    stable.add_argument("--session-file", type=Path, help="Somente para credenciais sintéticas locais")
    args = parser.parse_args()
    try:
        if args.action == "https":
            print(json.dumps(served_build(args.hostname, args.address, args.port, args.ca)))
        elif args.action == "stable":
            probe = OriginProbe(args.hostname, args.address, args.port, args.ca)
            print(json.dumps(stable_origin(probe, args.expected, args.seconds, args.session_file)))
        else:
            snapshot(args.root, args.destination)
    except ProbeFailure as error:
        detail = {"utc": datetime.now(timezone.utc).isoformat(), "phase": "HTTPS", "error": str(error)}
        print(json.dumps(detail, ensure_ascii=True))
        parser.exit(1)
    except (OSError, ValueError, sqlite3.Error, http.client.HTTPException) as error:
        if args.action == "stable":
            detail = {"utc": datetime.now(timezone.utc).isoformat(), "phase": "HTTPS",
                      "error": type(error).__name__}
            print(json.dumps(detail))
            parser.exit(1)
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
