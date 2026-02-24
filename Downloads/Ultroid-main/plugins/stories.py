# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Telegram Stories (Telethon 1.41+)

from telethon.tl.functions.stories import (
    GetPeerStoriesRequest,
    ReadStoriesRequest,
)
from telethon.tl import types
from . import ultroid_cmd, eor, eod, LOGS

@ultroid_cmd(pattern="viewstory(?: |$)(.*)", category="Social")
async def viewstory_cmd(event):
    """View someone's Telegram stories."""
    target = event.pattern_match.group(1).strip()

    if not target:
        return await eod(event, "❌ **Usage:** `.viewstory @username`")

    await eor(event, f"👁️ **Fetching stories for `{target}`...**")

    try:
        entity = await event.client.get_entity(target)

        result = await event.client(GetPeerStoriesRequest(peer=entity))
        stories = result.stories.stories if hasattr(result.stories, 'stories') else []

        if not stories:
            return await eor(event, f"📭 **No active stories for `{target}`.**")

        # Mark as read
        story_ids = [s.id for s in stories]
        try:
            await event.client(ReadStoriesRequest(peer=entity, max_id=max(story_ids)))
        except Exception:
            pass

        await eor(event, f"📖 **Found {len(stories)} stories for `{target}`. Forwarding...**")

        count = 0
        for story in stories[:5]:  # Limit to 5
            try:
                if hasattr(story, 'media') and story.media:
                    caption = f"📖 **Story {count+1}** from `{target}`"
                    if hasattr(story, 'caption') and story.caption:
                        caption += f"\n\n{story.caption}"
                    await event.client.send_message(
                        event.chat_id,
                        caption,
                    )
                    count += 1
            except Exception as e:
                LOGS.warning(f"Story forward error: {e}")
                continue

        if count == 0:
            await eor(event, f"📖 **{len(stories)} stories found but couldn't forward media.**")

    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")