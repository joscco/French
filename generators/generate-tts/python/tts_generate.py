from array import array
import argparse
import csv
import os
import subprocess
from pathlib import Path
import wave
from dotenv import load_dotenv
from google.cloud import texttospeech
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse

load_dotenv()

# Finde das Projekt-Root-Verzeichnis (enthält angular.json)
def find_project_root():
  """Findet das Projekt-Root-Verzeichnis durch Suche nach angular.json"""
  current = Path(__file__).resolve().parent
  for _ in range(10):  # Maximal 10 Ebenen nach oben
    if (current / "angular.json").exists():
      return current
    parent = current.parent
    if parent == current:
      break
    current = parent
  # Fallback: aktuelles Arbeitsverzeichnis
  return Path.cwd()

PROJECT_ROOT = find_project_root()
SENTENCES_CSV_PATH = PROJECT_ROOT / "public/data/sentences.csv"
TERMS_CSV_PATH = PROJECT_ROOT / "public/data/terms.csv"
OUTPUT_BASE = PROJECT_ROOT / "public/sounds"

# Voice configurations
TTS_VOICES = {
  "fr": os.getenv("TTS_VOICE_FR", "fr-FR-Chirp3-HD-Enceladus"),
  "de": os.getenv("TTS_VOICE_DE", "de-DE-Chirp3-HD-Enceladus"),
}
TTS_SAMPLE_RATE = int(os.getenv("TTS_SAMPLE_RATE", "24000"))

BRACKETS_RE = re.compile(r"\[([^\]]+)\]")
BRACES_CONTENT_RE = re.compile(r"\{([^}|]+)(?:\|[^}]*)?\}")
WS_RE = re.compile(r"\s+")


def parse_id_range(value: str):
  """
  Erlaubt:
    "1-10"
    "1,3,7"
    "1,3-6,10"
  """
  ids = set()
  parts = value.split(",")
  for part in parts:
    part = part.strip()
    if not part:
      continue

    if "-" in part:
      start, end = part.split("-")
      ids.update(range(int(start), int(end) + 1))
    else:
      ids.add(int(part))

  return sorted(ids)


# Platzhalter-Ersetzungen für TTS
PLACEHOLDER_REPLACEMENTS = {
  # Französisch
  "qc.": "quelque chose",
  "qn.": "quelqu'un",
  # Deutsch
  "etw.": "etwas",
  "jdn.": "jemanden",
  "jdm.": "jemandem",
  "jds.": "jemandes",
  "jmd.": "jemand",
  "jmdn.": "jemanden",
  "jmdm.": "jemandem",
  "jmds.": "jemandes",
}


def replace_placeholders_for_tts(text: str) -> str:
  """Ersetzt Abkürzungen/Platzhalter durch ihre Langformen für TTS."""
  for short, long in PLACEHOLDER_REPLACEMENTS.items():
    # Case-insensitive Ersetzung
    text = re.sub(re.escape(short), long, text, flags=re.IGNORECASE)
  return text


def strip_markup_for_tts(text: str) -> str:
  """
  Wandelt Markup in sprechbaren Text um:
  - [alt1|alt2|...] -> alt1 (erster Repräsentant)
  - {text} -> text (ohne Klammern)
  - {text|#id} -> text (ohne Referenz)
  - Platzhalter werden durch Langformen ersetzt
  """

  # Schritt 1: [alt1|alt2|...] -> alt1 (erster Repräsentant)
  def replace_brackets(match):
    content = match.group(1)
    # Nimm den ersten Teil vor dem ersten "|"
    first_alternative = content.split("|")[0]
    return first_alternative

  text = BRACKETS_RE.sub(replace_brackets, text)

  # Schritt 2: {text|#id} oder {text} -> text
  text = BRACES_CONTENT_RE.sub(r"\1", text)

  # Schritt 3: Restliche geschweifte Klammern entfernen (falls noch welche da sind)
  text = re.sub(r"[{}]", "", text)

  # Schritt 4: Platzhalter ersetzen
  text = replace_placeholders_for_tts(text)

  # Schritt 5: Whitespace normalisieren
  text = WS_RE.sub(" ", text).strip()

  return text


def load_rows(ids: list[int] | None):
  """Load sentences from CSV."""
  rows = []
  with SENTENCES_CSV_PATH.open(newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
      row_id = int(row["id"])
      if ids is not None and row_id not in ids:
        continue
      rows.append(row)
  return rows


def load_terms(ids: list[int] | None, lang: str | None = None):
  """Load terms from CSV, optionally filtered by language."""
  rows = []
  with TERMS_CSV_PATH.open(newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
      row_id = int(row["id"])
      if ids is not None and row_id not in ids:
        continue
      if lang is not None and row.get("lang") != lang:
        continue
      rows.append(row)
  return rows


def get_article_for_term(term: dict) -> str:
  """
  Gibt den Artikel für ein Nomen zurück.
  Berücksichtigt Sprache, Genus und ob ein Vokal-Artikel benötigt wird.
  """
  category = term.get("category", "")
  if category != "noun":
    return ""

  lang = term.get("lang", "")
  genus = term.get("genus", "")
  needs_vowel = term.get("needs_vowel_article", "").lower() in ("true", "1", "yes")

  # Französische Artikel
  if lang == "fr":
    if needs_vowel:
      return "l'"
    if genus == "m":
      return "le"
    if genus == "f":
      return "la"
    if genus in ("mpl", "fpl", "pl"):
      return "les"
    return ""

  # Deutsche Artikel
  if lang == "de":
    if genus == "m":
      return "der"
    if genus == "f":
      return "die"
    if genus == "n":
      return "das"
    if genus in ("mpl", "fpl", "pl", "npl"):
      return "die"
    return ""

  return ""


def tts_client():
  return texttospeech.TextToSpeechClient()


def synthesize(text: str, lang: str, client):
  """Synthesize text to speech for given language (fr or de)."""
  input_text = texttospeech.SynthesisInput(text=text)

  lang_code = "fr-FR" if lang == "fr" else "de-DE"
  voice_name = TTS_VOICES.get(lang, TTS_VOICES["fr"])

  voice = texttospeech.VoiceSelectionParams(
    language_code=lang_code,
    name=voice_name,
  )
  audio_config = texttospeech.AudioConfig(
    audio_encoding=texttospeech.AudioEncoding.LINEAR16,
    sample_rate_hertz=TTS_SAMPLE_RATE,
  )

  response = client.synthesize_speech(
    input=input_text,
    voice=voice,
    audio_config=audio_config,
  )

  return response.audio_content


def save_wav(pcm_data: bytes, wav_path: Path):
  wav_path.parent.mkdir(parents=True, exist_ok=True)
  with wave.open(str(wav_path), "wb") as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)  # 16 bit
    wf.setframerate(TTS_SAMPLE_RATE)
    wf.writeframes(pcm_data)


def convert_to_mp3(wav_path: Path, mp3_path: Path, bitrate="96k"):
  subprocess.run([
    "ffmpeg", "-y",
    "-i", str(wav_path),
    "-b:a", bitrate,
    str(mp3_path)
  ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def find_speech_start_sample(
  pcm_data: bytes,
  sample_rate: int,
  silence_threshold: int = 500,
  min_speech_ms: int = 20,
  search_ms: int = 200,
) -> int:
  """
  Sucht im ersten search_ms-Fenster nach dem Beginn „echter“ Sprache.
  Sprache = in einem min_speech_ms-Fenster sind überwiegend Samples
  über silence_threshold.
  Gibt den Sample-Index zurück, ab dem wir schneiden können.
  """
  samples = array("h")
  samples.frombytes(pcm_data)

  total_samples = len(samples)
  max_search_samples = min(int(sample_rate * search_ms / 1000), total_samples)
  min_speech_samples = max(1, int(sample_rate * min_speech_ms / 1000))

  for i in range(0, max_search_samples):
    window_end = min(i + min_speech_samples, max_search_samples)
    window = samples[i:window_end]
    if not window:
      break

    non_silent = sum(1 for s in window if abs(s) > silence_threshold)
    ratio = non_silent / len(window)

    # z.B. > 60% der Samples in diesem Fenster sind „laut genug“
    if ratio > 0.6:
      return i

  # Falls nichts gefunden wird, lieber gar nicht trimmen
  return 0


def smart_trim_start(pcm_data: bytes) -> bytes:
  sample_index = find_speech_start_sample(
    pcm_data,
    sample_rate=TTS_SAMPLE_RATE,
    silence_threshold=500,  # 500 ist ein guter Wert für 16-bit PCM
    min_speech_ms=20, # mindestens 20ms „Sprache“ nötig
    search_ms=1500, # Suche in den ersten 1,5 Sekunden
  )
  bytes_per_sample = 2  # 16-bit PCM
  byte_offset = sample_index * bytes_per_sample
  return pcm_data[byte_offset:]

def generate_for_rows(rows, lang: str = "fr"):
  """Generate TTS for sentences in the specified language."""
  client = tts_client()

  for row in rows:
    row_id = int(row["id"])
    sentence = (row.get(lang) or "").strip()
    sentence = strip_markup_for_tts(sentence)

    if not sentence:
      print(f"Überspringe Satz ID {row_id} ({lang}) – kein Text")
      continue

    print(f"Generiere Audio für Satz ID {row_id} ({lang})…")

    pcm = synthesize(sentence, lang, client)
    pcm = smart_trim_start(pcm)

    base = f"{lang}{row_id}"
    wav_path = OUTPUT_BASE / f"wav/{base}.wav"
    mp3_path = OUTPUT_BASE / f"{base}.mp3"

    save_wav(pcm, wav_path)
    convert_to_mp3(wav_path, mp3_path)

    print(f" → gespeichert: {mp3_path}")


def generate_for_terms(terms):
  """Generate TTS for terms (each term has its own language)."""
  client = tts_client()

  for term in terms:
    term_id = int(term["id"])
    lang = term.get("lang", "fr")
    term_text = (term.get("term_text") or "").strip()
    term_text = strip_markup_for_tts(term_text)

    if not term_text:
      print(f"Überspringe Term ID {term_id} ({lang}) – kein Text")
      continue

    # Bei Nomen: Artikel voranstellen
    article = get_article_for_term(term)
    if article:
      # Bei l' kein Leerzeichen
      if article.endswith("'"):
        term_text = f"{article}{term_text}"
      else:
        term_text = f"{article} {term_text}"

    print(f"Generiere Audio für Term ID {term_id} ({lang}): {term_text}")

    pcm = synthesize(term_text, lang, client)
    pcm = smart_trim_start(pcm)

    base = f"term_{lang}{term_id}"
    wav_path = OUTPUT_BASE / f"wav/{base}.wav"
    mp3_path = OUTPUT_BASE / f"{base}.mp3"

    save_wav(pcm, wav_path)
    convert_to_mp3(wav_path, mp3_path)

    print(f" → gespeichert: {mp3_path}")


def generate_single_sentence(sentence_id: int, lang: str) -> dict:
  """Generate TTS for a single sentence. Returns status dict."""
  print(f"[TTS] Lade Satz {sentence_id} ({lang})...")

  rows = load_rows([sentence_id])
  if not rows:
    print(f"[TTS] ❌ Satz {sentence_id} nicht gefunden")
    return {"success": False, "error": f"Sentence {sentence_id} not found"}

  row = rows[0]
  sentence = (row.get(lang) or "").strip()
  sentence = strip_markup_for_tts(sentence)

  if not sentence:
    print(f"[TTS] ❌ Kein {lang}-Text für Satz {sentence_id}")
    return {"success": False, "error": f"No {lang} text for sentence {sentence_id}"}

  print(f"[TTS] Text: \"{sentence}\"")

  try:
    print(f"[TTS] Synthesiere Audio...")
    client = tts_client()
    pcm = synthesize(sentence, lang, client)
    pcm = smart_trim_start(pcm)

    base = f"{lang}{sentence_id}"
    wav_path = OUTPUT_BASE / f"wav/{base}.wav"
    mp3_path = OUTPUT_BASE / f"{base}.mp3"

    save_wav(pcm, wav_path)
    convert_to_mp3(wav_path, mp3_path)

    print(f"[TTS] ✅ Fertig: {mp3_path}")
    return {"success": True, "path": str(mp3_path)}
  except Exception as e:
    print(f"[TTS] ❌ Fehler: {e}")
    return {"success": False, "error": str(e)}


def generate_single_term(term_id: int) -> dict:
  """Generate TTS for a single term. Returns status dict."""
  print(f"[TTS] Lade Term {term_id}...")

  terms = load_terms([term_id])
  if not terms:
    print(f"[TTS] ❌ Term {term_id} nicht gefunden")
    return {"success": False, "error": f"Term {term_id} not found"}

  term = terms[0]
  lang = term.get("lang", "fr")
  term_text = (term.get("term_text") or "").strip()
  term_text = strip_markup_for_tts(term_text)

  if not term_text:
    print(f"[TTS] ❌ Kein Text für Term {term_id}")
    return {"success": False, "error": f"No text for term {term_id}"}

  # Bei Nomen: Artikel voranstellen
  article = get_article_for_term(term)
  if article:
    # Bei l' kein Leerzeichen
    if article.endswith("'"):
      term_text = f"{article}{term_text}"
    else:
      term_text = f"{article} {term_text}"

  print(f"[TTS] Text ({lang}): \"{term_text}\"")

  try:
    print(f"[TTS] Synthesiere Audio...")
    client = tts_client()
    pcm = synthesize(term_text, lang, client)
    pcm = smart_trim_start(pcm)

    base = f"term_{lang}{term_id}"
    wav_path = OUTPUT_BASE / f"wav/{base}.wav"
    mp3_path = OUTPUT_BASE / f"{base}.mp3"

    save_wav(pcm, wav_path)
    convert_to_mp3(wav_path, mp3_path)

    print(f"[TTS] ✅ Fertig: {mp3_path}")
    return {"success": True, "path": str(mp3_path)}
  except Exception as e:
    print(f"[TTS] ❌ Fehler: {e}")
    return {"success": False, "error": str(e)}


class TTSHandler(BaseHTTPRequestHandler):
  """HTTP handler for TTS generation requests from the editor."""

  def _send_json(self, data: dict, status: int = 200):
    self.send_response(status)
    self.send_header("Content-Type", "application/json")
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    self.send_header("Access-Control-Allow-Headers", "Content-Type")
    self.end_headers()
    self.wfile.write(json.dumps(data).encode())

  def do_OPTIONS(self):
    self._send_json({})

  def do_HEAD(self):
    """Handle HEAD requests for sound files (used to check if file exists)."""
    parsed = urllib.parse.urlparse(self.path)

    if parsed.path.startswith("/sounds/"):
      filename = parsed.path[8:]  # Remove "/sounds/" prefix

      # Sicherheit: Nur .mp3 Dateien erlauben, keine Pfad-Traversal
      if ".." in filename or "/" in filename or not filename.endswith(".mp3"):
        self.send_response(400)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        return

      file_path = OUTPUT_BASE / filename

      if file_path.exists():
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(file_path.stat().st_size))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
      else:
        self.send_response(404)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
    else:
      self.send_response(404)
      self.send_header("Access-Control-Allow-Origin", "*")
      self.end_headers()

  def _serve_sound_file(self, filename: str):
    """Serve a sound file from the sounds directory."""
    # Sicherheit: Nur .mp3 Dateien erlauben, keine Pfad-Traversal
    if ".." in filename or "/" in filename or not filename.endswith(".mp3"):
      self.send_response(400)
      self.end_headers()
      return

    file_path = OUTPUT_BASE / filename

    if not file_path.exists():
      self.send_response(404)
      self.end_headers()
      return

    try:
      with open(file_path, "rb") as f:
        content = f.read()

      self.send_response(200)
      self.send_header("Content-Type", "audio/mpeg")
      self.send_header("Content-Length", str(len(content)))
      self.send_header("Access-Control-Allow-Origin", "*")
      self.send_header("Cache-Control", "no-cache")
      self.end_headers()
      self.wfile.write(content)
    except Exception as e:
      print(f"[Sound] ❌ Fehler beim Laden von {filename}: {e}")
      self.send_response(500)
      self.end_headers()

  def do_POST(self):
    parsed = urllib.parse.urlparse(self.path)

    if parsed.path == "/save/csv":
      try:
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        data = json.loads(body.decode('utf-8'))

        filename = data.get("filename", "")
        content = data.get("content", "")

        # Nur erlaubte Dateien
        allowed_files = {
          "sentences.csv": PROJECT_ROOT / "public/data/sentences.csv",
          "terms.csv": PROJECT_ROOT / "public/data/terms.csv",
          "term_links.csv": PROJECT_ROOT / "public/data/term_links.csv",
          "units.csv": PROJECT_ROOT / "public/data/units.csv",
          "groups.csv": PROJECT_ROOT / "public/data/groups.csv",
        }

        if filename not in allowed_files:
          self._send_json({"success": False, "error": f"File not allowed: {filename}"}, 400)
          return

        file_path = allowed_files[filename]

        # Backup erstellen
        backup_path = file_path.with_suffix(".csv.bak")
        if file_path.exists():
          import shutil
          shutil.copy(file_path, backup_path)
          print(f"[Save] Backup erstellt: {backup_path}")

        # Datei speichern
        with open(file_path, "w", encoding="utf-8", newline="") as f:
          f.write(content)

        print(f"[Save] ✅ Gespeichert: {file_path}")
        self._send_json({"success": True, "path": str(file_path)})

      except Exception as e:
        print(f"[Save] ❌ Fehler: {e}")
        self._send_json({"success": False, "error": str(e)}, 500)
    else:
      self._send_json({"error": "Not found"}, 404)

  def do_GET(self):
    parsed = urllib.parse.urlparse(self.path)
    params = urllib.parse.parse_qs(parsed.query)

    # Serve sound files directly to avoid Angular reload
    if parsed.path.startswith("/sounds/"):
      self._serve_sound_file(parsed.path[8:])  # Remove "/sounds/" prefix
      return

    if parsed.path == "/generate/sentence":
      sentence_id = int(params.get("id", [0])[0])
      lang = params.get("lang", ["fr"])[0]

      if sentence_id <= 0:
        self._send_json({"success": False, "error": "Invalid sentence ID"}, 400)
        return

      print(f"[Server] Generating sentence {sentence_id} ({lang})...")
      result = generate_single_sentence(sentence_id, lang)
      self._send_json(result)

    elif parsed.path == "/generate/term":
      term_id = int(params.get("id", [0])[0])

      if term_id <= 0:
        self._send_json({"success": False, "error": "Invalid term ID"}, 400)
        return

      print(f"[Server] Generating term {term_id}...")
      result = generate_single_term(term_id)
      self._send_json(result)

    elif parsed.path == "/health":
      self._send_json({"status": "ok"})

    else:
      self._send_json({"error": "Not found"}, 404)

  def log_message(self, format, *args):
    # Suppress default logging
    pass


def run_server(port: int = 3001):
  """Run the TTS HTTP server."""
  server = HTTPServer(("localhost", port), TTSHandler)
  print(f"TTS Server läuft auf http://localhost:{port}")
  print(f"Projekt-Root: {PROJECT_ROOT}")
  print(f"Sentences CSV: {SENTENCES_CSV_PATH}")
  print(f"Terms CSV: {TERMS_CSV_PATH}")
  print(f"Output: {OUTPUT_BASE}")
  print()
  print("Endpoints:")
  print(f"  GET  /generate/sentence?id=123&lang=fr")
  print(f"  GET  /generate/sentence?id=123&lang=de")
  print(f"  GET  /generate/term?id=123")
  print(f"  GET  /sounds/<filename>.mp3  (Audio-Dateien)")
  print(f"  GET  /health")
  print(f"  POST /save/csv  (body: {{filename, content}})")
  print()
  print("Drücke Ctrl+C zum Beenden.")

  try:
    server.serve_forever()
  except KeyboardInterrupt:
    print("\nServer beendet.")
    server.shutdown()


def main():
  parser = argparse.ArgumentParser(
    description="Generate TTS files from vocab CSV via Google Cloud TTS"
  )

  subparsers = parser.add_subparsers(dest="command", help="Available commands")

  # Server command
  server_parser = subparsers.add_parser("server", help="Start HTTP server for editor integration")
  server_parser.add_argument("--port", type=int, default=3001, help="Port to listen on (default: 3001)")

  # Sentences command
  sentences_parser = subparsers.add_parser("sentences", help="Generate TTS for sentences")
  sentences_parser.add_argument(
    "--ids",
    type=str,
    required=True,
    help="IDs oder Bereiche, z. B. '1-10' oder '1,3-5,10'",
  )
  sentences_parser.add_argument(
    "--lang",
    type=str,
    choices=["fr", "de", "both"],
    default="fr",
    help="Language to generate (fr, de, or both)",
  )

  # Terms command
  terms_parser = subparsers.add_parser("terms", help="Generate TTS for terms")
  terms_parser.add_argument(
    "--ids",
    type=str,
    required=True,
    help="IDs oder Bereiche, z. B. '1-10' oder '1,3-5,10'",
  )
  terms_parser.add_argument(
    "--lang",
    type=str,
    choices=["fr", "de"],
    default=None,
    help="Filter by language (optional, otherwise uses term's own language)",
  )

  args = parser.parse_args()

  if args.command == "server":
    run_server(args.port)

  elif args.command == "sentences":
    ids = parse_id_range(args.ids)
    rows = load_rows(ids)

    if not rows:
      print("Keine passenden Sätze gefunden.")
      return

    if args.lang in ["fr", "both"]:
      print(f"\n=== Generiere französische Sätze ===")
      generate_for_rows(rows, "fr")

    if args.lang in ["de", "both"]:
      print(f"\n=== Generiere deutsche Sätze ===")
      generate_for_rows(rows, "de")

  elif args.command == "terms":
    ids = parse_id_range(args.ids)
    terms = load_terms(ids, args.lang)

    if not terms:
      print("Keine passenden Terme gefunden.")
      return

    generate_for_terms(terms)

  else:
    parser.print_help()


if __name__ == "__main__":
  main()
