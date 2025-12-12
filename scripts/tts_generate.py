from array import array
import argparse
import csv
import os
import subprocess
from pathlib import Path
import wave

from dotenv import load_dotenv
from google.cloud import texttospeech

load_dotenv()

CSV_PATH = Path("public/data/sentences.csv")
OUTPUT_BASE = Path("public/sounds")

TTS_VOICE = os.getenv("TTS_VOICE", "fr-FR-Chirp3-HD-Enceladus")
TTS_SAMPLE_RATE = int(os.getenv("TTS_SAMPLE_RATE", "24000"))


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


def load_rows(ids: list[int] | None):
  rows = []
  with CSV_PATH.open(newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
      row_id = int(row["id"])
      if ids is not None and row_id not in ids:
        continue
      rows.append(row)
  return rows


def tts_client():
  return texttospeech.TextToSpeechClient()


def synthesize_fr(text: str, client):
  input_text = texttospeech.SynthesisInput(text=text)
  voice = texttospeech.VoiceSelectionParams(
    language_code="fr-FR",
    name=TTS_VOICE,
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

def generate_for_rows(rows):
  client = tts_client()

  for row in rows:
    row_id = int(row["id"])
    fr_sentence = (row.get("fr") or "").strip()

    if not fr_sentence:
      print(f"Überspringe ID {row_id} – kein fr")
      continue

    print(f"Generiere Audio für ID {row_id}…")

    pcm = synthesize_fr(fr_sentence, client)
    pcm = smart_trim_start(pcm)

    base = f"fr{row_id}"
    wav_path = OUTPUT_BASE / f"wav/{base}.wav"
    mp3_path = OUTPUT_BASE / f"{base}.mp3"

    save_wav(pcm, wav_path)
    convert_to_mp3(wav_path, mp3_path)

    print(f" → gespeichert: {wav_path} und {mp3_path}")


def main():
  parser = argparse.ArgumentParser(
    description="Generate TTS files from vocab CSV via Google Cloud TTS"
  )
  parser.add_argument(
    "--ids",
    type=str,
    required=True,
    help="IDs oder Bereiche, z. B. '1-10' oder '1,3-5,10'",
  )

  args = parser.parse_args()
  ids = parse_id_range(args.ids)

  rows = load_rows(ids)

  if not rows:
    print("Keine passenden Zeilen gefunden.")
    return

  generate_for_rows(rows)


if __name__ == "__main__":
  main()
