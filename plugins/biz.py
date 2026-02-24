# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

try:
    from telethon.tl.functions.account import GetBusinessChatLinksRequest
    from telethon.tl.functions.messages import GetQuickReplyShortcutsRequest
except ImportError:
    GetBusinessChatLinksRequest = GetQuickReplyShortcutsRequest = None

from . import ultroid_cmd, eor

@ultroid_cmd(pattern="bizinfo$", category="Tools")
async def biz_info(event):
    """View your Telegram Business chat links."""
    xx = await eor(event, "`Fetching business info...`")
    if not GetBusinessChatLinksRequest:
         return await xx.edit("❌ Business API is not available on this Telethon version.")
    try:
        res = await event.client(GetBusinessChatLinksRequest())
        if not res.links:
            return await xx.edit("You have no business chat links configured.")
        
        msg = "💼 **Telegram Business Links:**\n\n"
        for l in res.links:
             msg += f"• [Link]({l.link}) - `{l.message}`\n"
             if hasattr(l, 'views'):
                  msg += f"  (Views: `{l.views}`)\n"
        await xx.edit(msg, link_preview=False)
    except Exception as e:
        await xx.edit(f"❌ **Error:** `{e}`")

@ultroid_cmd(pattern="bizreplies$", category="Tools")
async def biz_replies(event):
    """View your business quick replies."""
    xx = await eor(event, "`Fetching quick replies...`")
    if not GetQuickReplyShortcutsRequest:
         return await xx.edit("❌ Quick Replies API is not available on this Telethon version.")
    try:
        res = await event.client(GetQuickReplyShortcutsRequest(hash=0))
        if not res.shortcuts:
            return await xx.edit("You have no business quick replies.")
        
        msg = "⚡️ **Business Quick Replies:**\n\n"
        for s in res.shortcuts:
             msg += f"• `/{s.shortcut}` (ID: `{s.shortcut_id}`)\n"
             if hasattr(s, 'count'):
                  msg += f"  - `{s.count}` messages\n"
        await xx.edit(msg)
    except Exception as e:
        await xx.edit(f"❌ **Error:** `{e}`")
