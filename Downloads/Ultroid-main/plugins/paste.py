# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Paste to Spacebin/Nekobin

import aiohttp
from . import ultroid_cmd, eor, eod

PASTE_APIS = [
    ("https://spaceb.in/api/v1/documents", "payload", "id", "https://spaceb.in/{}"),
    ("https://nekobin.com/api/documents", "content", "key", "https://nekobin.com/{}"),
]

@ultroid_cmd(pattern="paste(?: |$)(.*)", category="Tools")
async def paste_cmd(event):
    """Paste text to Spacebin/Nekobin and get a sharable link."""
    reply = await event.get_reply_message()
    text = event.pattern_match.group(1)

    if not text and reply:
        if reply.document:
            try:
                text = (await event.client.download_media(reply, bytes)).decode("utf-8")
            except Exception:
                text = reply.raw_text
        else:
            text = reply.raw_text

    if not text:
        return await eod(event, "❌ **Usage:** `.paste <text>` or reply to a message/file")

    await eor(event, "📋 **Pasting...**")

    async with aiohttp.ClientSession() as session:
        for api_url, key_name, resp_key, url_fmt in PASTE_APIS:
            try:
                payload = {key_name: text}
                if "spaceb.in" in api_url:
                    payload["extension"] = "txt"
                async with session.post(api_url, json=payload) as resp:
                    if resp.status in (200, 201):
                        data = await resp.json()
                        result = data.get("result", data)
                        paste_id = result.get(resp_key, result.get("id"))
                        url = url_fmt.format(paste_id)
                        return await eor(event, f"📋 **Pasted!**\n\n🔗 {url}")
            except Exception:
                continue

    await eor(event, "❌ **All paste services are down. Try again later.**")
