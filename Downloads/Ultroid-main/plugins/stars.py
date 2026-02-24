# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

from telethon.tl.functions.payments import (
    GetStarsStatusRequest, 
    GetStarsTransactionsRequest,
    GetStarsSubscriptionsRequest
)
from . import ultroid_cmd, eor, LOGS

@ultroid_cmd(pattern="stars$", category="Tools")
async def stars_cmd(event):
    """Check your Telegram Stars balance."""
    xx = await eor(event, "`Checking Stars balance...`")
    try:
        res = await event.client(GetStarsStatusRequest(peer="me"))
        balance = res.balance
        msg = f"✨ **Telegram Stars Balance:** `{balance}`\n"
        if hasattr(res, 'subscriptions_next_offset') and res.subscriptions_next_offset:
             msg += "Use `.starsub` to view active subscriptions."
        await xx.edit(msg)
    except Exception as e:
        await xx.edit(f"❌ **Error:** `{e}`")

@ultroid_cmd(pattern="startx$", category="Tools")
async def stars_transactions(event):
    """View recent Stars transactions."""
    xx = await eor(event, "`Fetching transactions...`")
    try:
        res = await event.client(GetStarsTransactionsRequest(peer="me", offset=""))
        if not res.transactions:
            return await xx.edit("No Stars transactions found.")
        
        msg = "**Recent Stars Transactions:**\n\n"
        for tx in res.transactions[:10]:
            type_lbl = "📥 Income" if tx.amount > 0 else "📤 Outcome"
            msg += f"• `{tx.amount}` Stars | {type_lbl} | Date: `{tx.date}`\n"
        await xx.edit(msg)
    except Exception as e:
        await xx.edit(f"❌ **Error:** `{e}`")

@ultroid_cmd(pattern="starsub$", category="Tools")
async def star_subs(event):
    """View your active Stars subscriptions."""
    xx = await eor(event, "`Fetching subscriptions...`")
    try:
        res = await event.client(GetStarsSubscriptionsRequest(peer="me", offset=""))
        if not res.subscriptions:
            return await xx.edit("No active Stars subscriptions found.")
        
        msg = "💎 **Active Stars Subscriptions:**\n\n"
        for sub in res.subscriptions:
             msg += f"• `{sub.pricing.amount}` Stars/mo | Expires: `{sub.valid_until}`\n"
        await xx.edit(msg)
    except Exception as e:
        await xx.edit(f"❌ **Error:** `{e}`")
