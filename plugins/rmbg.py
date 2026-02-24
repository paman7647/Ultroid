# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Background Removal

import os
import aiohttp
from . import ultroid_cmd, eor, eod, udB

@ultroid_cmd(pattern="rmbg$", category="Tools")
async def rmbg_cmd(event):
    """Remove background from images using remove.bg API."""
    reply = await event.get_reply_message()

    if not reply or not reply.photo:
        return await eod(event, "❌ **Reply to an image to remove background.**")

    api_key = udB.get_key("REMOVE_BG_API")
    if not api_key:
        return await eod(event, "❌ **Set API key:** `.setdb REMOVE_BG_API <key>`\nGet free key at: https://www.remove.bg/api")

    await eor(event, "🎨 **Removing background...**")

    try:
        file = await event.client.download_media(reply)

        async with aiohttp.ClientSession() as session:
            with open(file, "rb") as f:
                data = aiohttp.FormData()
                data.add_field("image_file", f, filename="image.png")
                data.add_field("size", "auto")

                async with session.post(
                    "https://api.remove.bg/v1.0/removebg",
                    headers={"X-Api-Key": api_key},
                    data=data,
                ) as resp:
                    if resp.status == 200:
                        result = await resp.read()
                        output = "nobg.png"
                        with open(output, "wb") as out:
                            out.write(result)

                        await event.client.send_file(
                            event.chat_id,
                            output,
                            caption="✅ **Background removed!**",
                            reply_to=event.reply_to_msg_id,
                        )
                        await event.delete()
                        os.remove(output)
                    else:
                        error = await resp.json()
                        msg = error.get("errors", [{}])[0].get("title", "Unknown error")
                        await eor(event, f"❌ **remove.bg Error:** {msg}")

        os.remove(file)
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
