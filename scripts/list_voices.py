from dotenv import load_dotenv

load_dotenv()

from google.cloud import texttospeech

client = texttospeech.TextToSpeechClient()

response = client.list_voices(language_code="fr-FR")

for v in response.voices:
  print(
    v.name,
    "| sample rate:",
    v.natural_sample_rate_hertz,
    "| gender:",
    texttospeech.SsmlVoiceGender(v.ssml_gender).name,
  )
