#!/usr/bin/env python3
import argparse
import wave
from pathlib import Path
from array import array
import math


def analyze_start(
  wav_path: Path,
  window_ms: float = 5.0,
  total_ms: float = 300.0,
  thresholds=(300, 500, 800, 1000),
):
  print(f"Analysiere Datei: {wav_path}")
  with wave.open(str(wav_path), "rb") as wf:
    n_channels = wf.getnchannels()
    sample_width = wf.getsampwidth()
    framerate = wf.getframerate()
    n_frames = wf.getnframes()
    duration_sec = n_frames / framerate

    print("=== WAV-Infos ===")
    print(f"Kanäle       : {n_channels}")
    print(f"Sample width : {sample_width * 8} bit")
    print(f"Samplerate   : {framerate} Hz")
    print(f"Frames       : {n_frames}")
    print(f"Dauer        : {duration_sec:.3f}s")
    print()

    if n_channels != 1:
      print("WARNUNG: Datei ist nicht mono – Analyse ist darauf ausgelegt.")
    if sample_width != 2:
      print("WARNUNG: Datei ist nicht 16-bit – Analyse ist darauf ausgelegt.")

    # Nur die ersten total_ms einlesen
    max_samples = int(framerate * (total_ms / 1000.0))
    frames = wf.readframes(max_samples)
    samples = array("h")
    samples.frombytes(frames)

  total_samples = len(samples)
  print(f"Analysiere erste {total_ms}ms → {total_samples} Samples")
  print()

  window_samples = int(framerate * (window_ms / 1000.0))
  if window_samples <= 0:
    window_samples = 1

  print(
    "t_start_ms | t_end_ms | max_amp | rms_amp | "
    + " ".join(f"> {thr}" for thr in thresholds)
  )
  print("-" * 80)

  # Kandidaten für "Sprache startet hier"
  # Wir merken uns für jeden threshold den ersten Fensterindex,
  # der "laut genug" ist.
  candidates = {thr: None for thr in thresholds}

  for start in range(0, total_samples, window_samples):
    end = min(start + window_samples, total_samples)
    window = samples[start:end]
    if not window:
      break

    max_amp = max(abs(s) for s in window)
    rms = math.sqrt(sum(s * s for s in window) / len(window))

    counts = []
    for thr in thresholds:
      non_silent = sum(1 for s in window if abs(s) > thr)
      ratio = non_silent / len(window)
      counts.append((non_silent, ratio))

      # falls noch kein Kandidat gesetzt und dieses Fenster
      # z. B. >60% "laut" ist:
      if candidates[thr] is None and ratio > 0.6:
        candidates[thr] = start  # Sample-Index

    t_start_ms = start / framerate * 1000.0
    t_end_ms = end / framerate * 1000.0

    counts_str = " ".join(
      f"{c[0]}({c[1]*100:4.1f}%)" for c in counts
    )

    print(
      f"{t_start_ms:8.1f} | {t_end_ms:7.1f} | "
      f"{max_amp:7d} | {rms:7.1f} | {counts_str}"
    )

  print("\n=== Kandidaten für Sprachbeginn (pro Schwelle) ===")
  for thr, sample_idx in candidates.items():
    if sample_idx is None:
      print(f"> {thr}: kein klarer Sprachbeginn im ersten {total_ms}ms gefunden")
    else:
      t_ms = sample_idx / framerate * 1000.0
      print(f"> {thr}: ~{t_ms:.1f}ms (Sample {sample_idx})")

  print("\nTipp:")
  print("- Wenn der Kratzer nur in den allerersten Fenstern auftaucht,")
  print("  kannst du 'silence_threshold' so wählen, dass erst spätere Fenster")
  print("  als 'Sprache' erkannt werden.")
  print("- 'min_speech_ms' kann an die Fenstergröße angepasst werden, z. B.")
  print("  ein Vielfaches von window_ms.")


def main():
  parser = argparse.ArgumentParser(
    description="Analyse des Startbereichs eines WAV-Files für TTS-Trim-Tuning"
  )
  parser.add_argument("wav_path", type=str, help="Pfad zur WAV-Datei")
  parser.add_argument(
    "--window-ms", type=float, default=5.0, help="Fenstergröße in Millisekunden"
  )
  parser.add_argument(
    "--total-ms",
    type=float,
    default=1000.0,
    help="Wie viele Millisekunden ab Start analysiert werden sollen",
  )
  args = parser.parse_args()

  analyze_start(Path(args.wav_path), window_ms=args.window_ms, total_ms=args.total_ms)


if __name__ == "__main__":
  main()
