# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Text-to-Speech

import os
from . import ultroid_cmd, eor, eod

@ultroid_cmd(pattern="tts(?: |$)(.*)", category="Tools")
async def tts_cmd(event):
    """Convert text to speech and send as voice message."""
    reply = await event.get_reply_message()
    text = event.pattern_match.group(1)

    if not text and reply:
        text = reply.raw_text

    if not text:
        return await eod(event, "❌ **Usage:** `.tts <text>` or reply to a message")

    await eor(event, "🔊 **Converting to speech...**")

    try:
        from gtts import gTTS

        tts = gTTS(text=text, lang="en")
        filename = "tts_output.mp3"
        tts.save(filename)

        await event.client.send_file(
            event.chat_id,
            filename,
            voice_note=True,
            reply_to=event.reply_to_msg_id,
        )
        await event.delete()
        os.remove(filename)
    except ImportError:
        await eor(event, "❌ `gTTS` not installed. Run: `pip install gTTS`")
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
