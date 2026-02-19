from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse
from .config import OUTPUT_BASE, PROJECT_ROOT
from .csv_utils import load_rows, load_terms
from .tts_core import tts_client, synthesize, save_wav, convert_to_mp3, generate_single_sentence, generate_single_term
from .audio_utils import smart_trim_start

# Server für TTS-Requests (Flask/FastAPI)

def start_tts_server(config):
    # TODO: Implementiere Server-Start
    pass

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
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/sounds/"):
            filename = parsed.path[8:]
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

    def _serve_csv_file(self, filename: str):
        # Sicherheit: Nur erlaubte CSV-Dateien, keine Pfad-Traversal
        allowed_files = ["sentences.csv", "terms.csv", "term_links.csv", "units.csv", "groups.csv"]
        if ".." in filename or "/" in filename or filename not in allowed_files:
            self.send_response(400)
            self.end_headers()
            return
        file_path = PROJECT_ROOT / "public/data" / filename
        if not file_path.exists():
            self.send_response(404)
            self.end_headers()
            return
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            content_bytes = content.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Length", str(len(content_bytes)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content_bytes)
        except Exception as e:
            print(f"[CSV] ❌ Fehler beim Laden von {filename}: {e}")
            self.send_response(500)
            self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if parsed.path.startswith("/sounds/"):
            self._serve_sound_file(parsed.path[8:])
            return
        if parsed.path.startswith("/data/"):
            self._serve_csv_file(parsed.path[6:])
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
            return
        if parsed.path == "/generate/term":
            term_id = int(params.get("id", [0])[0])
            if term_id <= 0:
                self._send_json({"success": False, "error": "Invalid term ID"}, 400)
                return
            print(f"[Server] Generating term {term_id}...")
            result = generate_single_term(term_id)
            self._send_json(result)
            return
        if parsed.path == "/health":
            self._send_json({"status": "ok"})
            return
        self._send_json({"error": "Not found"}, 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/save/csv":
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                data = json.loads(body.decode('utf-8'))
                filename = data.get("filename", "")
                content = data.get("content", "")
                allowed_files = ["sentences.csv", "terms.csv", "term_links.csv", "units.csv", "groups.csv"]
                if filename not in allowed_files:
                    self._send_json({"success": False, "error": f"File not allowed: {filename}"}, 400)
                    return
                public_path = PROJECT_ROOT / "public/data" / filename
                # Backup erstellen
                backup_path = public_path.with_suffix(".csv.bak")
                if public_path.exists():
                    import shutil
                    shutil.copy(public_path, backup_path)
                    print(f"[Save] Backup erstellt: {backup_path}")
                # --- has_audio-Spalte setzen, falls terms.csv oder sentences.csv ---
                if filename == "terms.csv":
                    import io
                    import csv
                    f_in = io.StringIO(content)
                    reader = csv.DictReader(f_in, delimiter=";")
                    rows = list(reader)
                    fieldnames = list(reader.fieldnames) if reader.fieldnames else []
                    if "has_audio" not in fieldnames:
                        fieldnames.append("has_audio")
                    for row in rows:
                        lang = row.get("lang", "fr")
                        term_id = row.get("id", "")
                        audiofile = OUTPUT_BASE / f"term_{lang}{term_id}.mp3"
                        exists = audiofile.exists()
                        row["has_audio"] = "true" if exists else "false"
                        if not exists:
                            print(f"[Check] Kein Audio für Term: {audiofile} (lang={lang}, id={term_id})")
                    f_out = io.StringIO()
                    writer = csv.DictWriter(f_out, fieldnames=fieldnames, delimiter=";", lineterminator="\n")
                    writer.writeheader()
                    for row in rows:
                        writer.writerow(row)
                    content = f_out.getvalue()
                elif filename == "sentences.csv":
                    import io
                    import csv
                    f_in = io.StringIO(content)
                    reader = csv.DictReader(f_in, delimiter=";")
                    rows = list(reader)
                    fieldnames = list(reader.fieldnames) if reader.fieldnames else []
                    # Entferne alte has_audio, falls vorhanden
                    fieldnames = [f for f in fieldnames if f != "has_audio"]
                    if "has_audio_fr" not in fieldnames:
                        fieldnames.append("has_audio_fr")
                    if "has_audio_de" not in fieldnames:
                        fieldnames.append("has_audio_de")
                    for row in rows:
                        sentence_id = row.get("id", "")
                        audiofile_fr = OUTPUT_BASE / f"fr{sentence_id}.mp3"
                        audiofile_de = OUTPUT_BASE / f"de{sentence_id}.mp3"
                        exists_fr = audiofile_fr.exists()
                        exists_de = audiofile_de.exists()
                        row["has_audio_fr"] = "true" if exists_fr else "false"
                        row["has_audio_de"] = "true" if exists_de else "false"
                        if not exists_fr:
                            print(f"[Check] Kein französisches Audio für Satz: {audiofile_fr} (id={sentence_id})")
                        if not exists_de:
                            print(f"[Check] Kein deutsches Audio für Satz: {audiofile_de} (id={sentence_id})")
                        if "has_audio" in row:
                            del row["has_audio"]
                    f_out = io.StringIO()
                    writer = csv.DictWriter(f_out, fieldnames=fieldnames, delimiter=";", lineterminator="\n")
                    writer.writeheader()
                    for row in rows:
                        writer.writerow(row)
                    content = f_out.getvalue()
                # Direkt in public/data speichern
                with open(public_path, "w", encoding="utf-8", newline="") as f:
                    f.write(content)
                print(f"[Save] ✅ Gespeichert: {public_path}")
                self._send_json({"success": True, "path": str(public_path)})
            except Exception as e:
                print(f"[Save] ❌ Fehler: {e}")
                self._send_json({"success": False, "error": str(e)}, 500)
        else:
            self._send_json({"error": "Not found"}, 404)

    def log_message(self, format, *args):
        pass

def run_server(port: int = 3001):
    server = HTTPServer(("localhost", port), TTSHandler)
    print(f"TTS Server läuft auf http://localhost:{port}")
    print(f"Projekt-Root: {PROJECT_ROOT}")
    print(f"Output: {OUTPUT_BASE}")
    print()
    print("Endpoints:")
    print(f"  GET  /sounds/<filename>.mp3         (Audio-Dateien)")
    print(f"  GET  /data/<filename>.csv           (CSV-Dateien)")
    print(f"  GET  /generate/sentence?id=ID&lang=fr|de  (TTS für Satz)")
    print(f"  GET  /generate/term?id=ID           (TTS für Term)")
    print(f"  POST /save/csv                      (CSV speichern inkl. Audio-Status)")
    print(f"  GET  /health                        (Healthcheck)")
    print()
    print("Drücke Ctrl+C zum Beenden.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")
        server.shutdown()

# Optional: Startfunktion für CLI
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="TTS Server für Editor-Integration")
    parser.add_argument("--port", type=int, default=3001, help="Port (default: 3001)")
    args = parser.parse_args()
    run_server(args.port)
