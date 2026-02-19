# Kernfunktionen für TTS (Google API, Synthese, etc.)
from google.cloud import texttospeech
import wave
import subprocess
from pathlib import Path
from .csv_utils import load_rows, load_terms
from .config import OUTPUT_BASE, TTS_VOICES, TTS_SAMPLE_RATE
from .audio_utils import smart_trim_start
import re

def tts_client():
    return texttospeech.TextToSpeechClient()

def synthesize(text: str, lang: str, client, tts_voices, tts_sample_rate):
    """Synthesize text to speech for given language (fr or de)."""
    input_text = texttospeech.SynthesisInput(text=text)
    lang_code = "fr-FR" if lang == "fr" else "de-DE"
    voice_name = tts_voices.get(lang, tts_voices["fr"])
    voice = texttospeech.VoiceSelectionParams(
        language_code=lang_code,
        name=voice_name,
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=tts_sample_rate,
    )
    response = client.synthesize_speech(
        input=input_text,
        voice=voice,
        audio_config=audio_config,
    )
    return response.audio_content

def save_wav(pcm_data: bytes, wav_path: Path, sample_rate: int):
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16 bit
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)

def convert_to_mp3(wav_path: Path, mp3_path: Path, bitrate="96k"):
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(wav_path),
        "-b:a", bitrate,
        str(mp3_path)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Markup-Parsing und Platzhalter für TTS
BRACKETS_RE = re.compile(r"\[([^\]]+)\]")
BRACES_CONTENT_RE = re.compile(r"\{([^}|]+)(?:\|[^}]*)?\}")
WS_RE = re.compile(r"\s+")

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
    for short, long in PLACEHOLDER_REPLACEMENTS.items():
        text = re.sub(re.escape(short), long, text, flags=re.IGNORECASE)
    return text

def strip_markup_for_tts(text: str) -> str:
    def replace_brackets(match):
        content = match.group(1)
        first_alternative = content.split("|")[0]
        return first_alternative
    text = BRACKETS_RE.sub(replace_brackets, text)
    text = BRACES_CONTENT_RE.sub(r"\1", text)
    text = re.sub(r"[{}]", "", text)
    text = replace_placeholders_for_tts(text)
    text = WS_RE.sub(" ", text).strip()
    return text

def _generate_tts(text: str, lang: str, wav_path: Path, mp3_path: Path) -> dict:
    try:
        client = tts_client()
        pcm = synthesize(text, lang, client, TTS_VOICES, TTS_SAMPLE_RATE)
        pcm = smart_trim_start(pcm, sample_rate=TTS_SAMPLE_RATE)
        save_wav(pcm, wav_path, TTS_SAMPLE_RATE)
        convert_to_mp3(wav_path, mp3_path)
        return {"success": True, "path": str(mp3_path)}
    except Exception as e:
        return {"success": False, "error": str(e)}

def generate_single_sentence(sentence_id: int, lang: str) -> dict:
    rows = load_rows([sentence_id])
    if not rows:
        return {"success": False, "error": f"Sentence {sentence_id} not found"}
    row = rows[0]
    sentence = (row.get(lang) or "").strip()
    sentence = strip_markup_for_tts(sentence)
    if not sentence:
        return {"success": False, "error": f"No {lang} text for sentence {sentence_id}"}
    base = f"{lang}{sentence_id}"
    wav_path = OUTPUT_BASE / f"wav/{base}.wav"
    mp3_path = OUTPUT_BASE / f"{base}.mp3"
    return _generate_tts(sentence, lang, wav_path, mp3_path)

def get_article_for_term(term: dict) -> str:
    category = term.get("category", "")
    if category != "noun":
        return ""
    lang = term.get("lang", "")
    genus = term.get("genus", "")
    needs_vowel = term.get("needs_vowel_article", "").lower() in ("true", "1", "yes")
    # Französisch
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
    # Deutsch
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

def generate_single_term(term_id: int) -> dict:
    terms = load_terms([term_id])
    if not terms:
        return {"success": False, "error": f"Term {term_id} not found"}
    term = terms[0]
    lang = term.get("lang", "fr")
    term_text = (term.get("term_text") or "").strip()
    term_text = strip_markup_for_tts(term_text)
    # Artikel voranstellen, falls Nomen
    article = get_article_for_term(term)
    if article:
        if article.endswith("'"):
            term_text = f"{article}{term_text}"
        else:
            term_text = f"{article} {term_text}"
    if not term_text:
        return {"success": False, "error": f"No text for term {term_id}"}
    base = f"term_{lang}{term_id}"
    wav_path = OUTPUT_BASE / f"wav/{base}.wav"
    mp3_path = OUTPUT_BASE / f"{base}.mp3"
    return _generate_tts(term_text, lang, wav_path, mp3_path)
