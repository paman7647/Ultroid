# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey (https://github.com/paman7647)

from . import asst, udB, OWNER_NAME, ultroid_version, ultroid_cmd, eor, get_string
from pyUltroid._misc._assistant import asst_cmd, callback, MSG as ASST_MSG, IN_BTTS as ASST_BTNS
from telethon import Button
import time

async def get_asst_msg():
    return ASST_MSG

async def get_asst_buttons():
    return [row[:] for row in ASST_BTNS]

async def asst_broadcast(msg):
    users = await udB.get_key("ASST_USERS") or []
    s = f = 0
    for u in users:
        try:
            await asst.send_message(int(u), msg)
            s += 1
        except Exception:
            f += 1
    return s, f

@asst_cmd("start")
async def assistant_start(event):
    if event.is_group:
        return await event.reply("Greetings! I am the Assistant of {}.".format(OWNER_NAME))
    
    # User Tracking
    users = udB.get_key("ASST_USERS") or []
    if event.sender_id not in users:
        users.append(event.sender_id)
        udB.set_key("ASST_USERS", users)
    
    msg = await get_asst_msg()
    btns = await get_asst_buttons()
    
    # If owner, show management button
    from pyUltroid._misc import owner_and_sudos
    if event.sender_id in owner_and_sudos():
        if not any(isinstance(b, Button) and b.data == "asst_mng" for row in btns for b in row):
            btns.append([Button.inline("⚙️ Management", data="asst_mng")])
            
    await event.reply(msg, buttons=btns, link_preview=False)

@callback("asst_mng", owner=True)
async def assistant_management(event):
    users = await udB.get_key("ASST_USERS") or []
    text = f"**Assistant Management**\n\n**Total Users**: `{len(users)}`"
    
    buttons = [
        [Button.inline("📢 Broadcast", data="asst_bc"), Button.inline("📊 Stats", data="asst_st")],
        [Button.inline("⚙️ Settings", data="asst_set")],
        [Button.inline("« Back", data="asst_start")]
    ]
    await event.edit(text, buttons=buttons)

@callback("asst_start")
async def asst_start_call(event):
    msg = await get_asst_msg()
    btns = await get_asst_buttons()
    from pyUltroid._misc import owner_and_sudos
    if event.sender_id in owner_and_sudos():
         btns.append([Button.inline("⚙️ Management", data="asst_mng")])
    await event.edit(msg, buttons=btns, link_preview=False)

@callback("asst_bc", owner=True)
async def asst_bc_menu(event):
    await event.edit("**Broadcast Type**\nChoose how you want to broadcast.", buttons=[
        [Button.inline("📝 Text only", data="bc_text")],
        [Button.inline("« Back", data="asst_mng")]
    ])

@asst_cmd("abcast", owner=True)
async def manual_abcast(event):
    if not event.reply_to_msg_id:
        return await event.reply("Reply to a message to broadcast it.")
    msg = await event.get_reply_message()
    x = await event.reply("`Broadcasting...`")
    s, f = await asst_broadcast(msg)
    await x.edit(f"**Broadcast Complete**\n\n**Success**: `{s}`\n**Failed**: `{f}`")

@asst_cmd("astats", owner=True)
async def asst_stats(event):
    users = await udB.get_key("ASST_USERS") or []
    await event.reply(f"**Assistant Stats**\n\n**Total Unique Users**: `{len(users)}`")
