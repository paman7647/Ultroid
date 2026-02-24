try:
    from telethon.tl.functions.payments import GetStarGiftsRequest, GetSavedStarGiftsRequest
except ImportError:
    GetStarGiftsRequest = GetSavedStarGiftsRequest = None

from . import ultroid_cmd, eor

@ultroid_cmd(pattern="gifts$", category="Tools")
async def gifts_cmd(event):
    """View available star gifts."""
    xx = await eor(event, "`Fetching available gifts...`")
    if not GetStarGiftsRequest:
         return await xx.edit("❌ Gifts API is not available on this Telethon version.")
    try:
        res = await event.client(GetStarGiftsRequest(hash=0))
        if not res.gifts:
            return await xx.edit("No gifts available at the moment.")
        
        msg = "**Available Star Gifts:**\n\n"
        for gift in res.gifts:
             msg += f"🎁 **{gift.name}** - `{gift.stars}` Stars\n"
        await xx.edit(msg)
    except Exception as e:
        await xx.edit(f"❌ **Error:** `{e}`")

@ultroid_cmd(pattern="savedgifts$", category="Tools")
async def saved_gifts(event):
    """View your own saved star gifts."""
    xx = await eor(event, "`Fetching your saved gifts...`")
    if not GetSavedStarGiftsRequest:
         return await xx.edit("❌ Saved Gifts API is not available on this Telethon version.")
    try:
        res = await event.client(GetSavedStarGiftsRequest(peer='me', offset='', limit=100))
        if not res.gifts:
            return await xx.edit("You have no saved gifts.")
        
        msg = "**Your Saved gifts:**\n\n"
        for g in res.gifts:
             # Depending on type, g might have gift attribute or be the gift itself
             gift = getattr(g, 'gift', g)
             name = getattr(gift, 'name', 'Unknown Gift')
             msg += f"🎁 **{name}**\n"
        await xx.edit(msg)
    except Exception as e:
        await xx.edit(f"❌ **Error:** `{e}`")
