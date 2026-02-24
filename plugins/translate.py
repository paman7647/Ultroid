# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

from deep_translator import GoogleTranslator
from telethon import events
from pyUltroid import udB, ultroid_bot
from . import ultroid_cmd, eor, get_string

# List of common language codes
LANGUAGES = {
    'en': 'english', 'hi': 'hindi', 'es': 'spanish', 'fr': 'french',
    'de': 'german', 'ru': 'russian', 'ja': 'japanese', 'ko': 'korean',
    'zh-CN': 'chinese (simplified)', 'ar': 'arabic', 'pt': 'portuguese',
    'it': 'italian', 'tr': 'turkish', 'ml': 'malayalam', 'ta': 'tamil',
    'te': 'telugu', 'kn': 'kannada', 'gu': 'gujarati', 'mr': 'marathi',
    'pa': 'punjabi', 'bn': 'bengali'
}

@ultroid_cmd(pattern="tr (.*)", category="Tools")
async def translate_cmd(event):
    input_text = event.pattern_match.group(1).strip()
    if not input_text:
        if event.is_reply:
            reply = await event.get_reply_message()
            input_text = reply.text
        else:
            return await event.eor("`Reply to message or give text to translate.`", time=5)
    
    parts = input_text.split(" ", 1)
    target_lang = "en"
    text = input_text
    
    if len(parts) > 1 and parts[0] in LANGUAGES:
        target_lang = parts[0]
        text = parts[1]
    elif parts[0] in LANGUAGES:
        target_lang = parts[0]
        if event.is_reply:
             reply = await event.get_reply_message()
             text = reply.text
    
    try:
        translated = GoogleTranslator(source='auto', target=target_lang).translate(text)
        msg = f"**Translated to {LANGUAGES.get(target_lang, target_lang).capitalize()}**\n\n`{translated}`"
        await event.eor(msg)
    except Exception as e:
        await event.eor(f"Error: {e}")

@ultroid_cmd(pattern="atr( |$)(.*)", category="Tools")
async def auto_translate(event):
    mode = event.pattern_match.group(2).strip().lower()
    if not mode or mode == "off":
        udB.set_key(f"ATR_{event.chat_id}", None)
        return await event.eor("Auto-Translate Disabled.")
    
    if mode in LANGUAGES:
        udB.set_key(f"ATR_{event.chat_id}", mode)
        await event.eor(f"Auto-Translate Enabled for this chat: **{LANGUAGES[mode].capitalize()}**")
    else:
        await event.eor(f"Invalid language code. Use `.langs` to see all.")

@ultroid_cmd(pattern="langs$", category="Tools")
async def list_langs(event):
    msg = "**Supported Languages:**\n\n"
    for code, name in list(LANGUAGES.items()):
        msg += f"`{code}`: {name}\n"
    msg += "\nUse `.tr <lang> <text>`"
    await event.eor(msg)

# Auto-Translate Listener
@ultroid_bot.on(events.NewMessage(incoming=True))
async def atr_listener(event):
    if not event.is_group:
        return
    
    target_lang = udB.get_key(f"ATR_{event.chat_id}")
    if target_lang and event.text:
        try:
            # We don't have src detection in deep-translator easily without another call
            # but we can just translate and see if it changes
            translated = GoogleTranslator(source='auto', target=target_lang).translate(event.text)
            if translated.lower().strip() != event.text.lower().strip():
                await event.reply(f"**Auto-TR** ({target_lang}):\n`{translated}`")
        except Exception:
            pass
