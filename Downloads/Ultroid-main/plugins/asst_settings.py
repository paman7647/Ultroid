# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey (https://github.com/paman7647)

from . import asst, udB, OWNER_NAME, ultroid_cmd, eor, get_string
from pyUltroid._misc._assistant import asst_cmd, callback
from telethon import Button

@ultroid_cmd(pattern="asstset$", category="Owner")
async def assistant_settings_cmd(event):
    await asst_settings_menu(event)

@callback("asst_set", owner=True)
async def asst_settings_menu(event):
    pm_logs = await udB.get_key("PM_LOGS")
    asst_mode = await udB.get_key("ASST_MODE") or "Enabled"
    
    pm_text = "✅ Enabled" if pm_logs else "❌ Disabled"
    asst_text = "✅ Enabled" if asst_mode == "Enabled" else "❌ Disabled"
    
    text = f"**Assistant Settings**\n\n"
    text += f"• **PM Logs**: {pm_text}\n"
    text += f"• **Assistant Status**: {asst_text}\n"
    
    buttons = [
        [Button.inline("Toggle PM Logs", data="toggle_pmlogs")],
        [Button.inline("Toggle Assistant", data="toggle_asst")],
        [Button.inline("Custom Start Message", data="set_start_msg")],
        [Button.inline("« Back", data="asst_mng") if hasattr(event, "data") else Button.inline("✘ Close", data="close")]
    ]
    if hasattr(event, "edit"):
        await event.edit(text, buttons=buttons)
    else:
        await event.reply(text, buttons=buttons)

@callback("toggle_pmlogs", owner=True)
async def toggle_pmlogs(event):
    curr = await udB.get_key("PM_LOGS")
    await udB.set_key("PM_LOGS", not curr)
    await event.answer(f"PM Logs {'Enabled' if not curr else 'Disabled'}")
    await asst_settings_menu(event)

@callback("toggle_asst", owner=True)
async def toggle_asst(event):
    curr = await udB.get_key("ASST_MODE") or "Enabled"
    new = "Disabled" if curr == "Enabled" else "Enabled"
    await udB.set_key("ASST_MODE", new)
    await event.answer(f"Assistant {new}")
    await asst_settings_menu(event)

@callback("set_start_msg", owner=True)
async def set_start_msg_info(event):
    await event.edit("**How to set Custom Start Message:**\n\nUse command:\n`.setdb ASST_START_MSG Your custom message here`", buttons=[[Button.inline("« Back", data="asst_set")]])
