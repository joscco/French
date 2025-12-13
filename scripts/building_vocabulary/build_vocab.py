#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import csv
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple

from build_config import (
  ANNOTATED_SENTENCES,
  FRENCH_TERMS,
  GERMAN_TERMS,
  TRANSLATION_LINKS,
  GENERATED_DIR,
  DRAFTS_DIR,
)

# Matches: [surface]{lemma#A} or [surface]{lemma} or [surface]{#A} or [surface]
ANNOT_RE = re.compile(
  r"""
  \[
    (?P<surface>[^\]]+)
  \]
  (?:
    \{
      (?P<brace>[^}]+)
    \}
  )?
  """,
  re.VERBOSE,
)


# ---------------------------
# helpers
# ---------------------------

def norm(s: str) -> str:
  return (s or "").replace("’", "'").strip()


def make_key(term: str, ref: str | None) -> str:
  t = norm(term)
  r = norm(ref or "")
  return f"{t}@{r}" if r else t


def guess_needs_vowel_article(fr_term: str) -> bool:
  t = norm(fr_term).lower()
  if not t:
    return False
  return t[0] in "aeiouyh"


def guess_category(term: str) -> str:
  t = norm(term)
  tl = t.lower()
  if " qc" in tl or " qn" in tl or tl.startswith("se ") or tl.startswith("s'"):
    return "verbe"
  if " + " in tl or " " in tl or tl.startswith(("au ", "à ", "de ", "d'", "en ", "dans ")):
    return "expression"
  return "nom"


def _parse_bool(s: str) -> Optional[bool]:
  v = norm(s).lower()
  if v in ("true", "1", "yes", "y"):
    return True
  if v in ("false", "0", "no", "n"):
    return False
  return None


# ---------------------------
# parsing annotated sentences
# ---------------------------

@dataclass(frozen=True)
class Annotation:
  surface: str
  lemma: str              # may include @ref (aka key)
  group: Optional[str]


@dataclass
class ParsedSide:
  plain: str
  anns: List[Annotation]


def parse_side(text: str) -> ParsedSide:
  out_parts: List[str] = []
  anns: List[Annotation] = []
  idx = 0

  for m in ANNOT_RE.finditer(text):
    start, end = m.span()
    out_parts.append(text[idx:start])

    surface_raw = m.group("surface")
    surface = norm(surface_raw)

    brace_raw = m.group("brace")
    group: Optional[str] = None

    if brace_raw is None:
      lemma = surface
    else:
      brace = norm(brace_raw)
      if brace.startswith("#"):
        group = brace[1:]
        lemma = ""  # resolve later
      else:
        if "#" in brace:
          lemma_part, group_part = brace.split("#", 1)
          lemma = norm(lemma_part)
          group = norm(group_part)
        else:
          lemma = norm(brace)

    anns.append(Annotation(surface=surface, lemma=lemma, group=group))
    out_parts.append(surface_raw)  # keep original surface in plain
    idx = end

  out_parts.append(text[idx:])
  plain = "".join(out_parts).replace("’", "'").strip()
  return ParsedSide(plain=plain, anns=anns)


def resolve_groups(anns: List[Annotation], sid: str, lang: str) -> List[Annotation]:
  group_to_lemma: Dict[str, str] = {}

  for a in anns:
    if a.group and a.lemma:
      if a.group in group_to_lemma and group_to_lemma[a.group] != a.lemma:
        raise ValueError(
          f"Conflicting lemma for group #{a.group} in {sid} ({lang}): "
          f"{group_to_lemma[a.group]} vs {a.lemma}"
        )
      group_to_lemma[a.group] = a.lemma

  resolved: List[Annotation] = []
  for a in anns:
    if a.group and not a.lemma:
      if a.group not in group_to_lemma:
        raise ValueError(f"Group reference {{#{a.group}}} without definition in {sid} ({lang})")
      resolved.append(Annotation(surface=a.surface, lemma=group_to_lemma[a.group], group=a.group))
    else:
      resolved.append(a)

  return resolved


def group_phrase_map(anns: List[Annotation]) -> Dict[Tuple[str, str], str]:
  """
  For split refs (grouped #A), build 'surface1 … surface2' once.
  Key: (lemma, group) -> phrase
  """
  parts: Dict[Tuple[str, str], List[str]] = defaultdict(list)
  for a in anns:
    if a.group:
      parts[(a.lemma, a.group)].append(a.surface)

  return {(lemma, group): " … ".join(surfaces) for (lemma, group), surfaces in parts.items()}


def collect_refs(anns: List[Annotation], gmap: Dict[Tuple[str, str], str]) -> List[Tuple[str, str]]:
  """
  Emit refs as (lemma_or_key, phrase).
  - split groups emitted once with combined phrase
  - normal refs emitted per occurrence
  """
  emitted_groups: Set[Tuple[str, str]] = set()
  refs: List[Tuple[str, str]] = []

  for a in anns:
    lemma = norm(a.lemma)
    if not lemma:
      continue

    if a.group:
      key = (lemma, a.group)
      if key in emitted_groups:
        continue
      emitted_groups.add(key)
      phrase = gmap.get(key) or a.surface
      refs.append((lemma, phrase))
    else:
      refs.append((lemma, a.surface))

  return refs


# ---------------------------
# loading terms (keys-only)
# ---------------------------

@dataclass(frozen=True)
class TermRow:
  key: str          # term or term@ref
  term: str
  ref: Optional[str]
  category: str
  genus: str
  needs_vowel_article: Optional[bool]  # only for FR


@dataclass
class TermIndex:
  key_to_row: Dict[str, TermRow]               # exact key -> row
  lemma_to_keys: Dict[str, List[str]]          # lemma -> [keys]
  duplicates_by_key: List[str]                 # same key appears multiple times
  ambiguous_lemmas: List[str]                  # lemma used by >1 distinct key


def _load_terms_common(
  path: Path,
  is_french: bool,
) -> TermIndex:
  if not path.exists():
    raise FileNotFoundError(f"Missing terms file: {path}")

  key_to_rows: Dict[str, List[TermRow]] = defaultdict(list)
  lemma_to_keys: Dict[str, List[str]] = defaultdict(list)

  with path.open("r", encoding="utf-8", newline="") as f:
    r = csv.DictReader(f, delimiter=";")
    if not r.fieldnames or "term" not in r.fieldnames:
      raise ValueError(f"{path} must contain at least column: term (optional: ref, category, genus, needs_vowel_article)")

    for row in r:
      term = norm(row.get("term", ""))
      if not term:
        continue

      ref = norm(row.get("ref", "")) or None
      key = make_key(term, ref)

      category = norm(row.get("category", "")) or guess_category(term)
      genus = norm(row.get("genus", ""))

      needs = _parse_bool(row.get("needs_vowel_article", "")) if is_french else None

      tr = TermRow(
        key=key,
        term=term,
        ref=ref,
        category=category,
        genus=genus,
        needs_vowel_article=needs,
      )

      key_to_rows[key].append(tr)
      lemma_to_keys[term].append(key)

  duplicates_by_key = sorted([k for k, rows in key_to_rows.items() if len(rows) > 1])

  # Pick one row per key (if duplicates exist, we'll fail later anyway)
  key_to_row: Dict[str, TermRow] = {k: rows[0] for k, rows in key_to_rows.items()}

  lemma_to_keys_norm = {lemma: sorted(set(keys)) for lemma, keys in lemma_to_keys.items()}
  ambiguous_lemmas = sorted([lemma for lemma, keys in lemma_to_keys_norm.items() if len(keys) > 1])

  return TermIndex(
    key_to_row=dict(sorted(key_to_row.items(), key=lambda kv: kv[0])),
    lemma_to_keys=lemma_to_keys_norm,
    duplicates_by_key=duplicates_by_key,
    ambiguous_lemmas=ambiguous_lemmas,
  )


def load_terms_fr(path: Path) -> TermIndex:
  return _load_terms_common(path, is_french=True)


def load_terms_de(path: Path) -> TermIndex:
  return _load_terms_common(path, is_french=False)


# ---------------------------
# translation links use KEYS now
# ---------------------------

def load_translation_links(path: Path) -> Set[Tuple[str, str]]:
  if not path.exists():
    raise FileNotFoundError(f"Missing translation links file: {path}")

  pairs: Set[Tuple[str, str]] = set()
  with path.open("r", encoding="utf-8", newline="") as f:
    r = csv.DictReader(f, delimiter=";")
    if not r.fieldnames or "fr" not in r.fieldnames or "de" not in r.fieldnames:
      raise ValueError(f"{path} must contain columns: fr;de (priority optional). Values are keys: term or term@ref")

    for row in r:
      fr = norm(row.get("fr", ""))
      de = norm(row.get("de", ""))
      if fr and de:
        pairs.add((fr, de))

  return pairs


# ---------------------------
# io
# ---------------------------

def write_csv(path: Path, header: List[str], rows: Iterable[List[str]]) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  with path.open("w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(header)
    for row in rows:
      w.writerow(row)


def require_files(*paths: Path) -> List[str]:
  return [str(p) for p in paths if not p.exists()]


# ---------------------------
# build
# ---------------------------

def main() -> int:
  missing = require_files(ANNOTATED_SENTENCES, FRENCH_TERMS, GERMAN_TERMS, TRANSLATION_LINKS)
  if missing:
    print("BUILD FAILED: Missing required files:", file=sys.stderr)
    for p in missing:
      print(f"- {p}", file=sys.stderr)
    return 1

  fr_idx = load_terms_fr(FRENCH_TERMS)
  de_idx = load_terms_de(GERMAN_TERMS)
  links = load_translation_links(TRANSLATION_LINKS)

  errors: List[str] = []

  if fr_idx.duplicates_by_key:
    errors.append(
      "Duplicate French term keys (same key appears multiple times): "
      + ", ".join(fr_idx.duplicates_by_key[:30])
      + (" ..." if len(fr_idx.duplicates_by_key) > 30 else "")
    )
  if de_idx.duplicates_by_key:
    errors.append(
      "Duplicate German term keys (same key appears multiple times): "
      + ", ".join(de_idx.duplicates_by_key[:30])
      + (" ..." if len(de_idx.duplicates_by_key) > 30 else "")
    )

  # Read annotated sentences
  with ANNOTATED_SENTENCES.open("r", encoding="utf-8-sig", newline="") as f:
    r = csv.DictReader(f, delimiter=";")
    need = {"lesson", "sid", "fr", "de"}
    if not r.fieldnames or not need.issubset(set(r.fieldnames)):
      raise ValueError(f"{ANNOTATED_SENTENCES} must contain header: lesson;sid;fr;de")
    src_rows = list(r)

  # outputs (only written on success)
  sentences_out: List[List[str]] = []   # lesson,id,fr_plain,de_plain  (id = sid)
  keys_out: List[List[str]] = []        # lesson,id,sid
  refs_out: List[List[str]] = []        # sentence_id,term_language,term_key,phrase

  # drafts (always written)
  missing_fr_terms: Counter[str] = Counter()
  missing_de_terms: Counter[str] = Counter()
  missing_fr_examples: Dict[str, List[str]] = defaultdict(list)
  missing_de_examples: Dict[str, List[str]] = defaultdict(list)

  ambiguous_fr_lemmas: Counter[str] = Counter()
  ambiguous_de_lemmas: Counter[str] = Counter()
  ambiguous_fr_examples: Dict[str, List[str]] = defaultdict(list)
  ambiguous_de_examples: Dict[str, List[str]] = defaultdict(list)

  missing_link_pairs: Dict[Tuple[str, str], List[str]] = defaultdict(list)

  # --- helpers for resolving annotation lemma -> key ---
  def resolve_annotation_to_key(lang: str, lemma_or_key: str) -> Optional[str]:
    raw = norm(lemma_or_key)
    if not raw:
      return None

    # if annotation contains '@', treat as exact key
    if "@" in raw:
      return raw

    idx = fr_idx if lang == "fr" else de_idx
    keys = idx.lemma_to_keys.get(raw, [])
    if not keys:
      return None
    if len(keys) == 1:
      return keys[0]
    return "__AMBIGUOUS__"

  def key_exists(lang: str, key: str) -> bool:
    idx = fr_idx if lang == "fr" else de_idx
    return key in idx.key_to_row

  # Process sentences
  for row in src_rows:
    lesson_s = norm(row.get("lesson", ""))
    sid = norm(row.get("sid", ""))
    fr_text = row.get("fr", "") or ""
    de_text = row.get("de", "") or ""

    if not lesson_s or not sid:
      errors.append(f"Missing lesson or sid in row: {row}")
      continue

    try:
      lesson = int(lesson_s)
    except ValueError:
      errors.append(f"Invalid lesson '{lesson_s}' for sid={sid}")
      continue

    # sentence_id must be stable for audio -> use sid (must be int)
    try:
      sentence_id = int(sid)
    except ValueError:
      errors.append(f"sid must be numeric (for stable audio IDs). Got sid='{sid}'")
      continue

    fr_parsed = parse_side(fr_text)
    de_parsed = parse_side(de_text)

    try:
      fr_anns = resolve_groups(fr_parsed.anns, sid, "fr")
      de_anns = resolve_groups(de_parsed.anns, sid, "de")
    except ValueError as e:
      errors.append(str(e))
      continue

    sentences_out.append([str(lesson), str(sentence_id), sid, fr_parsed.plain, de_parsed.plain])
    keys_out.append([str(lesson), str(sentence_id), sid])

    fr_gmap = group_phrase_map(fr_anns)
    de_gmap = group_phrase_map(de_anns)
    fr_refs = collect_refs(fr_anns, fr_gmap)  # (lemma_or_key, phrase)
    de_refs = collect_refs(de_anns, de_gmap)

    # validate terms + emit refs_out
    def validate_and_emit(lang: str, refs: List[Tuple[str, str]]) -> None:
      for lemma_or_key, phrase in refs:
        resolved_key = resolve_annotation_to_key(lang, lemma_or_key)

        if resolved_key is None:
          # missing lemma/key
          if lang == "fr":
            missing_fr_terms[lemma_or_key] += 1
            if len(missing_fr_examples[lemma_or_key]) < 5:
              missing_fr_examples[lemma_or_key].append(sid)
          else:
            missing_de_terms[lemma_or_key] += 1
            if len(missing_de_examples[lemma_or_key]) < 5:
              missing_de_examples[lemma_or_key].append(sid)
          continue

        if resolved_key == "__AMBIGUOUS__":
          if lang == "fr":
            ambiguous_fr_lemmas[lemma_or_key] += 1
            if len(ambiguous_fr_examples[lemma_or_key]) < 5:
              ambiguous_fr_examples[lemma_or_key].append(sid)
          else:
            ambiguous_de_lemmas[lemma_or_key] += 1
            if len(ambiguous_de_examples[lemma_or_key]) < 5:
              ambiguous_de_examples[lemma_or_key].append(sid)
          continue

        # exact key must exist
        if not key_exists(lang, resolved_key):
          if lang == "fr":
            missing_fr_terms[resolved_key] += 1
            if len(missing_fr_examples[resolved_key]) < 5:
              missing_fr_examples[resolved_key].append(sid)
          else:
            missing_de_terms[resolved_key] += 1
            if len(missing_de_examples[resolved_key]) < 5:
              missing_de_examples[resolved_key].append(sid)
          continue

        refs_out.append([str(sentence_id), lang, resolved_key, phrase])

    validate_and_emit("fr", fr_refs)
    validate_and_emit("de", de_refs)

    # derive missing translation links:
    # We do NOT pair by position. We only require that each key has at least one translation.
    fr_keys_in_sentence: Set[str] = set()
    de_keys_in_sentence: Set[str] = set()

    for fr_lemma_or_key, _ in fr_refs:
      k = resolve_annotation_to_key("fr", fr_lemma_or_key)
      if k and k != "__AMBIGUOUS__":
        fr_keys_in_sentence.add(k)

    for de_lemma_or_key, _ in de_refs:
      k = resolve_annotation_to_key("de", de_lemma_or_key)
      if k and k != "__AMBIGUOUS__":
        de_keys_in_sentence.add(k)

    # Build quick lookup maps once (move outside loop if you want)
    # fr_key -> has any de?
    fr_has_any = {fr for (fr, _) in links}
    # de_key -> has any fr?
    de_has_any = {de for (_, de) in links}

    # Missing: FR key has no translation at all
    for fr_key in sorted(fr_keys_in_sentence):
      if fr_key not in fr_has_any:
        # We can't guess the correct DE. Emit a placeholder row.
        if len(missing_link_pairs[(fr_key, "")]) < 5:
          missing_link_pairs[(fr_key, "")].append(sid)

    # Missing: DE key has no translation at all
    for de_key in sorted(de_keys_in_sentence):
      if de_key not in de_has_any:
        if len(missing_link_pairs[("", de_key)]) < 5:
          missing_link_pairs[("", de_key)].append(sid)

  # --- write drafts always ---
  write_csv(
    DRAFTS_DIR / "draft-missing-terms-fr.csv",
    ["suggested_category", "term_or_key","genus","suggested_needs_vowel_article", "ref"],
    (
      [
        guess_category(term.split("@", 1)[0]),
        term,
        "",
        str(guess_needs_vowel_article(term.split("@", 1)[0])).lower(),
        ""
      ]
      for term in sorted(missing_fr_terms.keys())
    ),
    )

  write_csv(
    DRAFTS_DIR / "draft-missing-terms-de.csv",
    ["suggested_category", "term_or_key", "genus", "ref"],
    (
      [
        guess_category(term.split("@", 1)[0]),
        term,
        "",
        ""
      ]
      for term in sorted(missing_de_terms.keys())
    ),
    )

  write_csv(
    DRAFTS_DIR / "draft-ambiguous-terms-fr.csv",
    ["lemma", "count", "example_sids", "available_keys"],
    (
      [
        lemma,
        str(ambiguous_fr_lemmas[lemma]),
        ",".join(ambiguous_fr_examples[lemma]),
        ",".join(fr_idx.lemma_to_keys.get(lemma, [])),
      ]
      for lemma in sorted(ambiguous_fr_lemmas.keys())
    ),
    )

  write_csv(
    DRAFTS_DIR / "draft-ambiguous-terms-de.csv",
    ["lemma", "count", "example_sids", "available_keys"],
    (
      [
        lemma,
        str(ambiguous_de_lemmas[lemma]),
        ",".join(ambiguous_de_examples[lemma]),
        ",".join(de_idx.lemma_to_keys.get(lemma, [])),
      ]
      for lemma in sorted(ambiguous_de_lemmas.keys())
    ),
    )

  write_csv(
    DRAFTS_DIR / "draft-missing-translation-links.csv",
    ["fr", "de", "priority"],
    (
      [fr, de, "1"]
      for (fr, de), _ in sorted(missing_link_pairs.items(), key=lambda x: (x[0][0], x[0][1]))
    ),
    )

  # --- fail conditions ---
  if missing_fr_terms:
    errors.append(f"Missing French terms: {len(missing_fr_terms)} (see {DRAFTS_DIR / 'draft-missing-terms-fr.csv'})")
  if missing_de_terms:
    errors.append(f"Missing German terms: {len(missing_de_terms)} (see {DRAFTS_DIR / 'draft-missing-terms-de.csv'})")
  if ambiguous_fr_lemmas:
    errors.append(
      f"Ambiguous French lemmas used without @ref: {len(ambiguous_fr_lemmas)} (see {DRAFTS_DIR / 'draft-ambiguous-terms-fr.csv'})"
    )
  if ambiguous_de_lemmas:
    errors.append(
      f"Ambiguous German lemmas used without @ref: {len(ambiguous_de_lemmas)} (see {DRAFTS_DIR / 'draft-ambiguous-terms-de.csv'})"
    )
  if missing_link_pairs:
    errors.append(
      f"Missing translation links: {len(missing_link_pairs)} (see {DRAFTS_DIR / 'draft-missing-translation-links.csv'})"
    )

  if errors:
    print("\nBUILD FAILED:\n", file=sys.stderr)
    for e in errors:
      print(f"- {e}", file=sys.stderr)
    return 1

  # --- write generated outputs only on success ---
  write_csv(GENERATED_DIR / "sentences.csv", ["lesson", "id", "sid", "fr", "de"], sentences_out)
  write_csv(GENERATED_DIR / "sentence-keys.csv", ["lesson", "id", "sid"], keys_out)
  write_csv(GENERATED_DIR / "sentence-refs.csv", ["sentence_id", "term_language", "term_key", "phrase"], refs_out)

  # export terms (keys-only)
  write_csv(
    GENERATED_DIR / "terms-fr.csv",
    ["key", "category", "term", "genus", "needs_vowel_article", "ref"],
    (
      [
        tr.key,
        tr.category,
        tr.term,
        tr.genus,
        "" if tr.needs_vowel_article is None else str(tr.needs_vowel_article).lower(),
        tr.ref or "",
        ]
      for tr in sorted(fr_idx.key_to_row.values(), key=lambda x: x.key)
    ),
    )

  write_csv(
    GENERATED_DIR / "terms-de.csv",
    ["key", "category", "term", "genus", "ref"],
    (
      [
        tr.key,
        tr.category,
        tr.term,
        tr.genus,
        tr.ref or "",
        ]
      for tr in sorted(de_idx.key_to_row.values(), key=lambda x: x.key)
    ),
    )

  print("Build OK.", file=sys.stderr)
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
