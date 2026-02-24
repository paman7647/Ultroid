# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Message Effects & Reactions (Telethon 1.41+)

from telethon.tl.functions.messages import SendReactionRequest
from telethon.tl.types import ReactionEmoji
from . import ultroid_cmd, eor, eod

@ultroid_cmd(pattern="react(?: |$)(.*)", category="Social")
async def react_cmd(event):
    """React to a replied message with an emoji."""
    reply = await event.get_reply_message()

    if not reply:
        return await eod(event, "❌ **Reply to a message to react.**")

    emoji = event.pattern_match.group(1).strip()
    if not emoji:
        emoji = "👍"

    try:
        await event.client(
            SendReactionRequest(
                peer=event.chat_id,
                msg_id=reply.id,
                reaction=[ReactionEmoji(emoticon=emoji)],
            )
        )
        await event.delete()
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")


@ultroid_cmd(pattern="unreact$", category="Social")
async def unreact_cmd(event):
    """Remove your reaction from a replied message."""
    reply = await event.get_reply_message()

    if not reply:
        return await eod(event, "❌ **Reply to a message to remove reaction.**")

    try:
        await event.client(
            SendReactionRequest(
                peer=event.chat_id,
                msg_id=reply.id,
                reaction=[],
            )
        )
        await event.delete()
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
