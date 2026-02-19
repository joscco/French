import csv
import os
import re
from pathlib import Path

# Projekt-Root (wo angular.json liegt) suchen

def find_project_root():
    current = Path(__file__).resolve().parent
    for _ in range(10):
        if (current / "angular.json").exists():
            return current
        parent = current.parent
        if parent == current:
            break
        current = parent
    return Path.cwd()

PROJECT_ROOT = find_project_root()
DATA_DIR = PROJECT_ROOT / "public/data"
SOUNDS_DIR = PROJECT_ROOT / "public/sounds"
SOUNDS_WAV_DIR = SOUNDS_DIR / "wav"
TERMS_CSV = DATA_DIR / "terms.csv"
SENTENCES_CSV = DATA_DIR / "sentences.csv"

# 1. IDs aus CSVs sammeln
def collect_existing_ids():
    term_ids = set()
    with open(TERMS_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            term_ids.add(row["id"])
    sentence_ids = set()
    with open(SENTENCES_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            sentence_ids.add(row["id"])
    return term_ids, sentence_ids

# 2. Audios löschen, die nicht mehr gebraucht werden
def cleanup_audio_files(term_ids, sentence_ids):
    deleted = []
    for folder in [SOUNDS_DIR, SOUNDS_WAV_DIR]:
        if not folder.exists():
            continue
        for file in folder.glob("*.mp3"):
            name = file.stem
            # Satz-Audio: fr123, de123
            m = re.match(r"^(fr|de)(\d+)$", name)
            if m:
                if m.group(2) not in sentence_ids:
                    file.unlink()
                    deleted.append(str(file))
                    continue
            # Term-Audio: term_fr123, term_de123
            m = re.match(r"^term_(fr|de)(\d+)$", name)
            if m:
                if m.group(2) not in term_ids:
                    file.unlink()
                    deleted.append(str(file))
                    continue
    return deleted

# 3. Tote Referenzen in Sätzen entfernen
def cleanup_sentence_refs(term_ids):
    changed = 0
    id_pattern = re.compile(r"\{([^}|]+)\|#(\d+)\}")
    rows = []
    with open(SENTENCES_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        fieldnames = reader.fieldnames
        for row in reader:
            for lang_col in ("fr", "de"):
                if lang_col in row and row[lang_col]:
                    def repl(m):
                        text, id_ = m.group(1), m.group(2)
                        if id_ not in term_ids:
                            nonlocal changed
                            changed += 1
                            return f"{{{text}}}"
                        return m.group(0)
                    row[lang_col] = id_pattern.sub(repl, row[lang_col])
            rows.append(row)
    # Schreibe zurück, falls geändert
    if changed:
        with open(SENTENCES_CSV, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";", lineterminator="\n")
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
    return changed

def main():
    print("[Cleanup] Sammle IDs aus CSVs...")
    term_ids, sentence_ids = collect_existing_ids()
    print(f"[Cleanup] {len(term_ids)} Term-IDs, {len(sentence_ids)} Satz-IDs gefunden.")
    print("[Cleanup] Lösche verwaiste Audios...")
    deleted = cleanup_audio_files(term_ids, sentence_ids)
    print(f"[Cleanup] {len(deleted)} Audios gelöscht.")
    print("[Cleanup] Entferne tote Referenzen in Sätzen...")
    changed = cleanup_sentence_refs(term_ids)
    print(f"[Cleanup] {changed} tote Referenzen entfernt/geändert.")
    print("[Cleanup] Fertig.")

if __name__ == "__main__":
    main()
