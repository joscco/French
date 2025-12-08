import argparse
import csv
import os
import subprocess
from pathlib import Path
import wave

from dotenv import load_dotenv
from google.cloud import texttospeech

load_dotenv()

CSV_PATH = Path("public/words.csv")
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

def trim_start(pcm_data: bytes, milliseconds: int = 100) -> bytes:
  """
  Schneidet die ersten Millisekunden des PCM-Signals ab,
  um Knackser am Anfang zu eliminieren.
  """
  bytes_per_sample = 2  # 16 bit
  num_samples = int(TTS_SAMPLE_RATE * (milliseconds / 1000.0))
  byte_offset = num_samples * bytes_per_sample
  return pcm_data[byte_offset:]

def generate_for_rows(rows):
  client = tts_client()

  for row in rows:
    row_id = int(row["id"])
    fr_sentence = (row.get("fr_sentence") or "").strip()

    if not fr_sentence:
      print(f"Überspringe ID {row_id} – kein fr_sentence")
      continue

    print(f"Generiere Audio für ID {row_id}…")

    pcm = synthesize_fr(fr_sentence, client)
    pcm = trim_start(pcm, milliseconds=100)

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
