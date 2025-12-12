#!/usr/bin/env bash
set -euo pipefail

# -------- config --------
VENV_DIR=".venv"
PYTHON_BIN="python3"
PYTHON_SCRIPT="scripts/building_vocabulary/build_vocab.py"
REQUIREMENTS_FILE="requirements.txt"
# ------------------------

echo "▶ Vocabulary data build"

if [ ! -d "$VENV_DIR" ]; then
  echo "ℹ️  No virtualenv found. Creating one at $VENV_DIR..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

echo "▶ Using Python: $(python --version)"

#if [ -f "$REQUIREMENTS_FILE" ]; then
#  echo "▶ Installing dependencies..."
#  pip install --quiet --upgrade pip
#  pip install --quiet -r "$REQUIREMENTS_FILE"
#fi

echo "▶ Running vocabulary build..."
python "$PYTHON_SCRIPT"

deactivate || true

echo "✅ Build finished"
