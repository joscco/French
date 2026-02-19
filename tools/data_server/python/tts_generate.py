import argparse
from .server import run_server
from .csv_utils import load_rows, load_terms
from .tts_core import tts_client, synthesize, save_wav, convert_to_mp3
from .audio_utils import smart_trim_start
from .config import OUTPUT_BASE

# --- CLI-Entrypoint ---
def parse_id_range(value: str):
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

def main():
    parser = argparse.ArgumentParser(description="Generate TTS files from vocab CSV via Google Cloud TTS")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    server_parser = subparsers.add_parser("server", help="Start HTTP server for editor integration")
    server_parser.add_argument("--port", type=int, default=3001, help="Port to listen on (default: 3001)")
    sentences_parser = subparsers.add_parser("sentences", help="Generate TTS for sentences")
    sentences_parser.add_argument("--ids", type=str, required=True, help="IDs oder Bereiche, z. B. '1-10' oder '1,3-5,10'")
    sentences_parser.add_argument("--lang", type=str, choices=["fr", "de", "both"], default="fr", help="Language to generate (fr, de, or both)")
    terms_parser = subparsers.add_parser("terms", help="Generate TTS for terms")
    terms_parser.add_argument("--ids", type=str, required=True, help="IDs oder Bereiche, z. B. '1-10' oder '1,3-5,10'")
    terms_parser.add_argument("--lang", type=str, choices=["fr", "de"], default=None, help="Filter by language (optional, otherwise uses term's own language)")
    args = parser.parse_args()

    if args.command == "server":
        run_server(args.port)
    elif args.command == "sentences":
        ids = parse_id_range(args.ids)
        rows = load_rows(ids)
        if not rows:
            print("Keine passenden Sätze gefunden.")
            return
        from .tts_core import generate_for_rows
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
        from .tts_core import generate_for_terms
        generate_for_terms(terms)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
