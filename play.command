#!/bin/bash
# Double-click this to play. Serves the game on loopback only and opens it.
cd "$(dirname "$0")" || exit 1
PORT=8731
# reuse the port if a server is already up, otherwise start one
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html"; then
  python3 tools/serve.py "$PORT" >/dev/null 2>&1 &
  sleep 1
fi
open "http://127.0.0.1:$PORT/index.html"
echo "VEEFRIENDS: THE HOUSE is running at http://127.0.0.1:$PORT/"
echo "Close this window when you're done playing."
