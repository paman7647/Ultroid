# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Carbon Code Screenshots

import aiohttp
from . import ultroid_cmd, eor, eod, LOGS

@ultroid_cmd(pattern="carbon(?: |$)(.*)", category="Tools")
async def carbon_cmd(event):
    """Generate beautiful code screenshots via carbon.now.sh"""
    reply = await event.get_reply_message()
    code = event.pattern_match.group(1)

    if not code and reply:
        code = reply.raw_text
    if not code:
        return await eod(event, "❌ **Usage:** `.carbon <code>` or reply to a message")

    await eor(event, "🎨 **Generating carbon screenshot...**")

    carbon_url = "https://carbonara.solopov.dev/api/cook"
    payload = {
        "code": code,
        "language": "auto",
        "theme": "one-dark",
        "fontFamily": "JetBrains Mono",
        "fontSize": "14px",
        "padding": "32px",
        "lineNumbers": True,
        "watermark": False,
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(carbon_url, json=payload) as resp:
                if resp.status == 200:
                    image_data = await resp.read()
                    with open("carbon.png", "wb") as f:
                        f.write(image_data)
                    await event.client.send_file(
                        event.chat_id,
                        "carbon.png",
                        caption="✨ **Generated with Carbon**",
                        reply_to=event.reply_to_msg_id,
                    )
                    await event.delete()
                    import os
                    os.remove("carbon.png")
                else:
                    await eor(event, f"❌ **Carbon API Error:** {resp.status}")
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
