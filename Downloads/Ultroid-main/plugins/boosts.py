# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

try:
    from telethon.tl.functions.premium import GetBoostsStatusRequest, GetBoostsListRequest
except ImportError:
    GetBoostsStatusRequest = GetBoostsListRequest = None

from . import ultroid_cmd, eor

@ultroid_cmd(pattern="boosts(?: |$)(.*)", category="Admin")
async def boost_status(event):
    """View boost status of a channel."""
    chat = event.pattern_match.group(1).strip() or event.chat_id
    xx = await eor(event, "`Fetching boost status...`")
    if not GetBoostsStatusRequest:
         return await xx.edit("❌ Boosts API is not available on this Telethon version.")
    try:
        res = await event.client(GetBoostsStatusRequest(peer=chat))
        msg = f"🚀 **Boost Status for {chat}**\n\n"
        msg += f"• **Level:** `{res.level}`\n"
        msg += f"• **Boosts:** `{res.boosts}`\n"
        if hasattr(res, 'gift_boosts'):
             msg += f"• **Gifts:** `{res.gift_boosts}`\n"
        if hasattr(res, 'next_level_boosts') and res.next_level_boosts:
             msg += f"• **Next Level:** `{res.next_level_boosts}` boosts needed\n"
        await xx.edit(msg)
    except Exception as e:
        await xx.edit(f"❌ **Error:** `{e}`")

@ultroid_cmd(pattern="boosters(?: |$)(.*)", category="Admin")
async def list_boosters(event):
    """List users who boosted the channel."""
    chat = event.pattern_match.group(1).strip() or event.chat_id
    xx = await eor(event, "`Fetching boosters...`")
    if not GetBoostsListRequest:
         return await xx.edit("❌ Boosts List API is not available on this Telethon version.")
    try:
        res = await event.client(GetBoostsListRequest(peer=chat, offset='', limit=100))
        if not res.boosts:
            return await xx.edit("No active boosters found.")
        
        msg = f"🚀 **Active Boosters for {chat}**\n\n"
        for b in res.boosts:
             # Try to get user info if available in res.users
             user = next((u for u in res.users if u.id == b.user_id), None)
             name = f"@{user.username}" if user and user.username else f"`{b.user_id}`"
             expires = b.expires.strftime('%Y-%m-%d') if hasattr(b.expires, 'strftime') else str(b.expires)
             msg += f"• {name} - expires `{expires}`\n"
        await xx.edit(msg)
    except Exception as e:
        await xx.edit(f"❌ **Error:** `{e}`")
