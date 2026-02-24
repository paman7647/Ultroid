# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

from telethon import Button
from pyUltroid import udB, owner_and_sudos
from . import callback, get_back_button

@callback("user_mgr", owner=True)
async def user_mgr_menu(event):
    sudos = udB.get_key("SUDO_USERS") or []
    text = f"**👤 User Manager**\n\n**Sudo Users:** `{len(sudos)}`\n\nYou can add or remove sudo users from here."
    
    buttons = [
        [Button.inline("➕ Add Sudo", data="abs_add_sudo")],
        [Button.inline("➖ Remove Sudo", data="rem_sudo_list")],
        get_back_button("mainmenu"),
    ]
    await event.edit(text, buttons=buttons)

@callback("rem_sudo_list", owner=True)
async def rem_sudo_list(event):
    sudos = udB.get_key("SUDO_USERS") or []
    if not sudos:
        return await event.answer("No sudo users found.", alert=True)
    
    text = "**Select Sudo User to Remove:**"
    buttons = []
    for user_id in sudos:
        buttons.append([Button.inline(f"ID: {user_id}", data=f"rem_sudo_{user_id}")])
    buttons.append(get_back_button("user_mgr"))
    await event.edit(text, buttons=buttons)

# Logic for adding sudo via conversation is usually in callbackstuffs convo_handler
# but we need to register the pattern in _convo there.
