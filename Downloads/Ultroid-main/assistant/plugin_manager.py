# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

import os
from telethon import Button
from pyUltroid import LOGS
from pyUltroid.startup.loader import Loader
from . import callback, get_back_button

@callback("plug_mgr", owner=True)
async def plugin_mgr_menu(event):
    from plugins import HELP
    total = len(HELP)
    text = f"**🔌 Plugin Manager**\n\nTotal Categories: `{total}`\nLoaded Modules: `{len(Loader.loaded_modules)}`"
    
    buttons = [
        [Button.inline("📜 List All Plugins", data="list_plugs")],
        [Button.inline("🔄 Restart Bot", data="re_bot")],
        get_back_button("setter"),
    ]
    await event.edit(text, buttons=buttons)

@callback("list_plugs", owner=True)
async def list_plugins_callback(event):
    from plugins import HELP
    text = "**Loaded Categories:**\n"
    buttons = []
    row = []
    for cat in list(HELP.keys())[:20]: # Limit for UI
        row.append(Button.inline(cat, data=f"view_cat_{cat}"))
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row: buttons.append(row)
    buttons.append(get_back_button("plug_mgr"))
    await event.edit(text, buttons=buttons)

@callback("re_bot", owner=True)
async def restart_bot_callback(event):
    await event.edit("🔄 **Restarting Ultroid...**\nThis may take a few seconds.")
    # The actual restart logic is in callbackstuffs.py usually, but we can trigger it
    import sys
    from os import execl
    execl(sys.executable, sys.executable, "-m", "pyUltroid")
