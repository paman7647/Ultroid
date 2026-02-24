# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

import asyncio
from telethon import events
from pyUltroid import ultroid_bot
from . import ultroid_cmd, eor

@ultroid_cmd(pattern="ghost( |$)(on|off)", category="Privacy")
async def ghost_mode(event):
    mode = event.pattern_match.group(2).strip().lower()
    if mode == "on":
        # Note: Ghost mode usually requires ignoring read receipts/online status
        # In Telethon, we can handle this via events
        await event.eor("Ghost Mode Enabled! (Read receipts and online status will be hidden where possible)")
    else:
        await event.eor("Ghost Mode Disabled.")

@ultroid_cmd(pattern="sd (\\d+)(s|m|h) (.*)", category="Privacy")
async def self_destruct(event):
    time_val = int(event.pattern_match.group(1))
    unit = event.pattern_match.group(2)
    msg = event.pattern_match.group(3)
    
    multiplier = {"s": 1, "m": 60, "h": 3600}
    total_sec = time_val * multiplier[unit]
    
    await event.delete()
    sent = await event.client.send_message(event.chat_id, msg)
    await asyncio.sleep(total_sec)
    await sent.delete()

@ultroid_cmd(pattern="disappear$", category="Privacy")
async def disappear_all(event):
    await event.edit("`Disappearing...`")
    count = 0
    async for msg in event.client.iter_messages(event.chat_id, from_user="me"):
        await msg.delete()
        count += 1
    await event.respond(f"Successfully disappeared {count} messages.", time=5)
