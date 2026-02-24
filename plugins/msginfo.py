# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Message JSON Inspector

import json
from . import ultroid_cmd, eor, eod

@ultroid_cmd(pattern="json$", category="Tools")
async def json_cmd(event):
    """Get the raw JSON representation of a Telegram message."""
    reply = await event.get_reply_message()

    if not reply:
        return await eod(event, "❌ **Reply to a message to see its JSON data.**")

    try:
        raw = reply.to_json()
        parsed = json.loads(raw)
        pretty = json.dumps(parsed, indent=2, ensure_ascii=False)

        if len(pretty) > 4000:
            with open("message.json", "w") as f:
                f.write(pretty)
            await event.client.send_file(
                event.chat_id,
                "message.json",
                caption="📄 **Message JSON** (too long for inline)",
                reply_to=event.reply_to_msg_id,
            )
            await event.delete()
            import os
            os.remove("message.json")
        else:
            await eor(event, f"```json\n{pretty}\n```")
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
