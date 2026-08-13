#!/usr/bin/env python3
"""Loopback-only dev server that never lets the browser cache anything, and
keeps the leaderboard.

Plain `python3 -m http.server` happily serves stale JS and media out of the
browser cache, which makes edits look like they did nothing. This sends
no-store on everything instead.

Scores live in scores.json next to the game, so they survive a browser data
wipe and are shared by every browser on this machine. Bound to 127.0.0.1 only.
"""
import http.server
import json
import os
import socketserver
import sys
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8731
PROD = bool(os.environ.get("RENDER"))  # Render sets this; local dev stays no-store
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCORES = os.path.join(ROOT, "scores.json")
LOCK = threading.Lock()
KEEP = 25

# With DATABASE_URL set (production) the board lives in Postgres; without it
# (local dev) it stays in scores.json and nothing needs installing.
DB_URL = os.environ.get("DATABASE_URL")
if DB_URL:
    import psycopg2


def _db():
    return psycopg2.connect(DB_URL)


def _init_db():
    with _db() as c, c.cursor() as cur:
        cur.execute("""CREATE TABLE IF NOT EXISTS scores (
            id serial PRIMARY KEY,
            name text NOT NULL,
            t real NOT NULL,
            kills int NOT NULL,
            splits jsonb NOT NULL,
            whn text NOT NULL)""")


def load():
    if DB_URL:
        try:
            with _db() as c, c.cursor() as cur:
                cur.execute(
                    "SELECT name, t, kills, splits, whn FROM scores"
                    " ORDER BY t LIMIT %s", (KEEP,))
                return [{"name": n, "time": t, "kills": k, "splits": s, "when": w}
                        for n, t, k, s, w in cur.fetchall()]
        except Exception:
            return []
    try:
        with open(SCORES) as f:
            return json.load(f)
    except Exception:
        return []


def store(rows):
    tmp = SCORES + ".tmp"
    with open(tmp, "w") as f:
        json.dump(rows, f, indent=1)
    os.replace(tmp, SCORES)          # never leave a half-written board behind


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        if self.path.split("?")[0].startswith("/api/"):
            # the board is public and the game may be served from another origin
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if PROD and not self.path.split("?")[0].startswith("/api/"):
            # in production let browsers cache the big static payloads
            self.send_header("Cache-Control", "public, max-age=3600")
        else:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        # CORS preflight for the JSON POST
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _json(self, payload, code=200):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/scores":
            self._json(load())
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/scores":
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n > 8192:
                raise ValueError("too big")
            rec = json.loads(self.rfile.read(n) or b"{}")
            row = {
                "name": str(rec.get("name", "ANON"))[:14].upper() or "ANON",
                "time": round(float(rec["time"]), 2),
                "kills": int(rec.get("kills", 0)),
                "splits": [round(float(s), 2) for s in rec.get("splits", [])][:10],
                "when": str(rec.get("when", ""))[:16],
            }
            if not (0 < row["time"] < 100000):
                raise ValueError("bad time")
        except Exception as e:
            self._json({"error": str(e)}, 400)
            return
        with LOCK:
            if DB_URL:
                try:
                    with _db() as c, c.cursor() as cur:
                        cur.execute(
                            "INSERT INTO scores (name, t, kills, splits, whn)"
                            " VALUES (%s, %s, %s, %s, %s)",
                            (row["name"], row["time"], row["kills"],
                             json.dumps(row["splits"]), row["when"]))
                        # keep only the top KEEP so the table never grows
                        cur.execute(
                            "DELETE FROM scores WHERE id NOT IN"
                            " (SELECT id FROM scores ORDER BY t LIMIT %s)", (KEEP,))
                    rows = load()
                except Exception:
                    self._json({"error": "db unavailable"}, 500)
                    return
            else:
                rows = load()
                rows.append(row)
                rows.sort(key=lambda r: r["time"])
                rows = rows[:KEEP]
                store(rows)
        self._json(rows)

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


if DB_URL:
    _init_db()

with Server(("0.0.0.0", PORT), Handler) as httpd:
    where = "postgres" if DB_URL else SCORES
    print(f"serving {ROOT} on http://0.0.0.0:{PORT}/  (scores -> {where})")
    httpd.serve_forever()
