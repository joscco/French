#!/usr/bin/env bash
set -euo pipefail

# -------- config --------
VENV_DIR=".venv-tts"
PYTHON_BIN="python3"
PY_SCRIPT="generators/generate-tts/python/tts_generate.py"
REQ_FILE="generators/generate-tts/requirements-tts.txt"
ENV_FILE=".env"
PORT="${1:-3001}"
# ------------------------

echo "▶ TTS Server starten"

# Check Google credentials
if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  if [ -f "keys/google-tts-service-account.json" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS="keys/google-tts-service-account.json"
    echo "ℹ️  GOOGLE_APPLICATION_CREDENTIALS automatisch gesetzt"
  else
    echo "⚠️  GOOGLE_APPLICATION_CREDENTIALS nicht gesetzt und keys/google-tts-service-account.json nicht gefunden"
    echo "   Setze die Variable oder lege die Datei an."
  fi
fi

# Check ffmpeg (required for mp3 conversion)
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "❌ ffmpeg not found."
  echo "   macOS:  brew install ffmpeg"
  echo "   Debian/Ubuntu: sudo apt-get install ffmpeg"
  exit 1
fi

# Create venv if needed
if [ ! -d "$VENV_DIR" ]; then
  echo "ℹ️  No venv found at $VENV_DIR — creating..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

# Activate venv
# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

echo "▶ Python: $(python --version)"

# Install deps (only if requirements file exists)
if [ -f "$REQ_FILE" ]; then
  echo "▶ Installing dependencies from $REQ_FILE..."
  pip install --quiet --upgrade pip
  pip install --quiet -r "$REQ_FILE"
else
  echo "⚠️  $REQ_FILE not found — skipping pip install"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  TTS Server läuft auf http://localhost:$PORT"
echo "  Drücke Ctrl+C zum Beenden"
echo "════════════════════════════════════════════════════════════"
echo ""

python "$PY_SCRIPT" server --port "$PORT"

deactivate || true

