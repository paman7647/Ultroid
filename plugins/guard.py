# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

import time
from telethon import events, types
from pyUltroid import udB, ultroid_bot
from . import ultroid_cmd, eor, LOGS

# Raid tracking
_raid_db = {} # {chat_id: [timestamp, count]}

@ultroid_bot.on(events.ChatAction())
async def raid_guard(event):
    if not event.user_joined:
        return
    
    if not udB.get_key("ANTIRAID"):
        return
    
    chat_id = event.chat_id
    now = time.time()
    
    if chat_id not in _raid_db:
        _raid_db[chat_id] = [now, 1]
    else:
        last_time, count = _raid_db[chat_id]
        if now - last_time < 60: # Within 1 minute
            _raid_db[chat_id][1] += 1
        else:
            _raid_db[chat_id] = [now, 1]
            
    # If more than 10 people joined in 1 minute, lock the group
    if _raid_db[chat_id][1] > 10:
        try:
            await event.client.edit_permissions(chat_id, send_messages=False)
            await event.respond("⚠️ **RAID DETECTED!** ⚠️\nGroup has been locked temporarily to prevent mass-join spam.")
            _raid_db[chat_id] = [now, 0] # Reset
        except Exception as e:
            LOGS.error(f"Raid Guard error: {e}")

@ultroid_bot.on(events.NewMessage(incoming=True))
async def guard_logic(event):
    if not event.is_group:
        return
    
    # 1. Anti-Channel
    if udB.get_key("ANTICHANNEL") and event.sender_id < 0:
        # Check if it's a channel (not a group)
        if isinstance(event.sender, types.Channel):
            try:
                await event.delete()
                # Optionally ban the channel
                await event.client.edit_permissions(event.chat_id, event.sender_id, view_messages=False)
            except Exception:
                pass

    # 2. Anti-Forward
    if udB.get_key("ANTIFORWARD") and event.forward:
        try:
            await event.delete()
        except Exception:
            pass

@ultroid_cmd(pattern="antiraid( |$)(on|off)", category="Admin")
async def toggle_raid(event):
    mode = event.pattern_match.group(2).strip().lower()
    udB.set_key("ANTIRAID", mode == "on")
    await event.eor(f"Anti-Raid turned {mode}.")

@ultroid_cmd(pattern="antichannel( |$)(on|off)", category="Admin")
async def toggle_channel(event):
    mode = event.pattern_match.group(2).strip().lower()
    udB.set_key("ANTICHANNEL", mode == "on")
    await event.eor(f"Anti-Channel turned {mode}.")

@ultroid_cmd(pattern="antiforward( |$)(on|off)", category="Admin")
async def toggle_forward(event):
    mode = event.pattern_match.group(2).strip().lower()
    udB.set_key("ANTIFORWARD", mode == "on")
    await event.eor(f"Anti-Forward turned {mode}.")
