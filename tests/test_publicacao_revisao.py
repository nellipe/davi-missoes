"""Tests of the revised publication gate using only synthetic fixtures."""

from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from publicacao_revisao import (DATABASES, MODULES, OriginProbe, ProbeFailure,
                                snapshot, snapshot_entries, stable_origin)

SHA = "a" * 40


class SnapshotTests(unittest.TestCase):
    def test_both_sqlite_and_wals_are_independent_copies(self):
        with tempfile.TemporaryDirectory(prefix="publicacao-synthetic-") as area:
            root = Path(area) / "install"
            saved = Path(area) / "backup"
            (root / "dados").mkdir(parents=True)
            (root / "publicacao").mkdir()
            (root / "publicacao" / "config.json").write_text('{"test": true}')
            saved.mkdir()
            for number, name in enumerate(DATABASES):
                database = root / "dados" / name
                with closing(sqlite3.connect(database)) as conn:
                    conn.execute("PRAGMA journal_mode=WAL")
                    conn.setconfig(sqlite3.SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE, True)
                    conn.execute("CREATE TABLE fixture(value)")
                    conn.execute("INSERT INTO fixture VALUES (?)", (number,))
                    conn.commit()
                self.assertTrue(database.with_name(name + "-wal").is_file())
            before = snapshot_entries(root)
            snapshot(root, saved)
            self.assertEqual(snapshot_entries(saved), before)
            self.assertEqual(snapshot_entries(root), before)
            for number, name in enumerate(DATABASES):
                with closing(sqlite3.connect(saved / "dados" / name)) as conn:
                    self.assertEqual(conn.execute("SELECT value FROM fixture").fetchone(), (number,))


class GateTests(unittest.TestCase):
    def setUp(self):
        self.probe = OriginProbe("example.test", "127.0.0.1", 443, Path("test-ca"))

    def fixture(self, path):
        if path == "/":
            return b'<main id="content">fixture</main>', "text/html", ""
        if path in MODULES:
            return b'export default 1;', "text/javascript", ""
        payload = {
            "/api/me": {"authorized": True},
            "/api/build": {"commit": SHA},
            "/api/forest/map": {key: {} for key in ("position", "layout", "economy", "collision")},
        }
        return json.dumps(payload[path]).encode(), "application/json", "davi_session=fake"

    def test_requires_html_modules_map_and_exact_sha(self):
        with patch.object(self.probe, "get", side_effect=self.fixture) as get:
            result = stable_origin(self.probe, SHA, 0)
            self.assertEqual(set(args[0] for args, _ in get.call_args_list),
                             {"/api/me", "/", "/api/build", "/api/forest/map", *MODULES})
            self.assertEqual(result["requests"], 3 + len(MODULES))
            with self.assertRaisesRegex(ProbeFailure, "/api/build conteúdo inesperado"):
                stable_origin(self.probe, "b" * 40, 0)

    def test_one_upstream_502_fails_the_gate_without_retry(self):
        failures = []

        def bad(path):
            if path == "/assets/forest/sight.mjs":
                failures.append(path)
                raise ProbeFailure(path + " HTTP 502")
            return self.fixture(path)

        with patch.object(self.probe, "get", side_effect=bad):
            with self.assertRaisesRegex(ProbeFailure, "sight.mjs HTTP 502"):
                stable_origin(self.probe, SHA, 12)
        self.assertEqual(len(failures), 1)
