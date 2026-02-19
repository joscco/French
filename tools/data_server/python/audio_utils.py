# Audio-Bearbeitung (Trimmen, Normalisieren, etc.)
from array import array

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

def smart_trim_start(pcm_data: bytes, sample_rate: int = 24000) -> bytes:
    sample_index = find_speech_start_sample(
        pcm_data,
        sample_rate=sample_rate,
        silence_threshold=500,  # 500 ist ein guter Wert für 16-bit PCM
        min_speech_ms=20, # mindestens 20ms „Sprache“ nötig
        search_ms=1500, # Suche in den ersten 1,5 Sekunden
    )
    bytes_per_sample = 2  # 16-bit PCM
    byte_offset = sample_index * bytes_per_sample
    return pcm_data[byte_offset:]

def trim_audio(input_path, output_path, start_sec=0.0, end_sec=None):
    # TODO: Implementiere Trimmen
    pass
