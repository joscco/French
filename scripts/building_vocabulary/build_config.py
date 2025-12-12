from pathlib import Path

# build_config.py lives in scripts/build_vocabulary/
# → repo root is two levels up
PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = PROJECT_ROOT / "public" / "data"
GENERATED_DIR = DATA_DIR / "generated"
DRAFTS_DIR = DATA_DIR / "drafts"

ANNOTATED_SENTENCES = DATA_DIR / "annotated-sentences.csv"
FRENCH_TERMS = DATA_DIR / "french-terms.csv"
GERMAN_TERMS = DATA_DIR / "german-terms.csv"
TRANSLATION_LINKS = DATA_DIR / "translation-links.csv"
