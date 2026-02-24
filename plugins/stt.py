# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Speech-to-Text

import os
from . import ultroid_cmd, eor, eod

@ultroid_cmd(pattern="stt$", category="Tools")
async def stt_cmd(event):
    """Transcribe voice messages to text using Google Speech Recognition."""
    reply = await event.get_reply_message()

    if not reply or not reply.voice:
        return await eod(event, "❌ **Reply to a voice message to transcribe.**")

    await eor(event, "📝 **Transcribing voice message...**")

    try:
        import speech_recognition as sr
        from pydub import AudioSegment

        # Download voice
        voice_file = await event.client.download_media(reply)

        # Convert OGG to WAV
        wav_file = voice_file.rsplit(".", 1)[0] + ".wav"
        audio = AudioSegment.from_file(voice_file)
        audio.export(wav_file, format="wav")

        # Recognize
        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_file) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)

        await eor(event, f"📝 **Transcription:**\n\n`{text}`")

        os.remove(voice_file)
        os.remove(wav_file)
    except ImportError:
        await eor(event, "❌ Missing deps. Run: `pip install SpeechRecognition pydub`")
    except sr.UnknownValueError:
        await eor(event, "❌ **Could not understand the audio.**")
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
