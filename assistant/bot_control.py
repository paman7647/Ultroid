# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

import os
import time
import shutil
import psutil
from telethon import Button
from pyUltroid import LOGS, udB
from . import callback, get_back_button

@callback("bot_control", owner=True)
async def bot_ctrl_menu(event):
    text = "**⚙️ Bot Control**\n\nAdvanced server and maintenance tools."
    buttons = [
        [
            Button.inline("📝 View Logs", data="view_logs"),
            Button.inline("🧹 Clear Cache", data="clear_cache"),
        ],
        [
            Button.inline("📡 Ping / Speed", data="sh_ping"),
            Button.inline("🌍 Env Vars", data="view_env"),
        ],
        get_back_button("mainmenu"),
    ]
    await event.edit(text, buttons=buttons)

@callback("view_logs", owner=True)
async def s_logs(event):
    await event.answer("Sending logs...", alert=False)
    if os.path.exists("ultroid.log"):
        await event.client.send_file(event.chat_id, "ultroid.log", caption="📄 **Bot Logs**")
    else:
        await event.answer("Log file not found!", alert=True)

@callback("clear_cache", owner=True)
async def s_cache(event):
    paths = ["downloads", ".thumb", "temp"]
    cleared = []
    for p in paths:
        if os.path.exists(p):
            shutil.rmtree(p)
            os.makedirs(p)
            cleared.append(p)
    await event.answer(f"Cleared: {', '.join(cleared)}", alert=True)

@callback("sh_ping", owner=True)
async def s_ping(event):
    start = time.time()
    await event.answer("Pinging...")
    end = time.time()
    ms = round((end - start) * 1000, 2)
    await event.answer(f"🏓 Pong!\nLatency: {ms}ms", alert=True)

@callback("view_env", owner=True)
async def s_env(event):
    # Masked sensitive vars
    text = "**Environment Variables:**\n\n"
    show = ["API_ID", "API_HASH", "REDIS_URI", "MONGO_URI", "GEMINI_API_KEY"]
    for s in show:
        val = udB.get_key(s) or os.getenv(s)
        if val:
            text += f"**{s}**: `{val[:4]}****{val[-4:]}`\n"
        else:
            text += f"**{s}**: `Not Set`\n"
    await event.edit(text, buttons=get_back_button("bot_control"))
