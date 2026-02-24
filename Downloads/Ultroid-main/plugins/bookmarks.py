# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

from pyUltroid import udB, ultroid_bot
from . import ultroid_cmd, eor, eod

@ultroid_cmd(pattern="save( (.*)|$)", category="Tools")
async def save_bookmark(event):
    name = event.pattern_match.group(2).strip() or "General"
    reply = await event.get_reply_message()
    if not reply:
        return await eod(event, "Reply to a message to bookmark it.")
    
    # Use database to store message links
    bookmarks = udB.get_key("BOOKMARKS") or {}
    if name not in bookmarks:
        bookmarks[name] = []
    
    link = reply.message_link
    if link not in bookmarks[name]:
        bookmarks[name].append(link)
        udB.set_key("BOOKMARKS", bookmarks)
        await eor(event, f"✅ **Bookmarked** in `{name}` category.")
    else:
        await eor(event, "Already bookmarked.")

@ultroid_cmd(pattern="bookmarks( (.*)|$)", category="Tools")
async def list_bookmarks(event):
    name = event.pattern_match.group(2).strip()
    bookmarks = udB.get_key("BOOKMARKS") or {}
    
    if not bookmarks:
        return await event.eor("No bookmarks found.")
    
    if name:
        if name in bookmarks:
            res = f"📑 **Bookmarks for {name}:**\n\n"
            for link in bookmarks[name]:
                res += f"• [Link]({link})\n"
            await event.eor(res)
        else:
            await event.eor(f"Category `{name}` not found.")
    else:
        res = "📑 **Bookmark Categories:**\n\n"
        for cat in bookmarks:
            res += f"• `{cat}` ({len(bookmarks[cat])})\n"
        res += "\nUse `.bookmarks <category>`"
        await event.eor(res)

@ultroid_cmd(pattern="rembookmark (.*) (.*)", category="Tools")
async def remove_bookmark(event):
    cat = event.pattern_match.group(1).strip()
    idx = int(event.pattern_match.group(2).strip()) - 1
    
    bookmarks = udB.get_key("BOOKMARKS") or {}
    if cat in bookmarks and 0 <= idx < len(bookmarks[cat]):
        bookmarks[cat].pop(idx)
        if not bookmarks[cat]:
            del bookmarks[cat]
        udB.set_key("BOOKMARKS", bookmarks)
        await event.eor("✅ Bookmark removed.")
    else:
        await event.eor("Invalid category or index.")
