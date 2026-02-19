import csv
from .config import SENTENCES_CSV_PATH, TERMS_CSV_PATH

# CSV-Handling (Lesen, Schreiben, Status-Update)

def read_terms_csv(path):
    # TODO: Implementiere CSV-Lesen
    pass

def update_audio_status(csv_path, audio_dir):
    # TODO: Implementiere Status-Update
    pass

def load_rows(ids: list[int] | None):
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
