# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

from telethon import Button
from pyUltroid import udB
from . import callback, get_back_button

@callback("security", owner=True)
async def security_menu(event):
    # Get current states
    spam = udB.get_key("ANTISPAM") or False
    pm = udB.get_key("PMPERMIT") or False
    captcha = udB.get_key("CAPTCHA") or False
    
    buttons = [
        [
            Button.inline(f"Anti-Spam: {'✅' if spam else '❌'}", data="sec_spam"),
            Button.inline(f"PM Permit: {'✅' if pm else '❌'}", data="sec_pm"),
        ],
        [
            Button.inline(f"Captcha: {'✅' if captcha else '❌'}", data="sec_captcha"),
        ],
        get_back_button("mainmenu")[0]
    ]
    
    await event.edit("**Security & Privacy Settings** 🔒\n\nConfigure your bot's protection layers below.", buttons=buttons)

@callback(pattern=r"sec_(.*)", owner=True)
async def toggle_security(event):
    key_map = {
        "spam": "ANTISPAM",
        "pm": "PMPERMIT",
        "captcha": "CAPTCHA"
    }
    target = event.data_match.group(1).decode()
    db_key = key_map.get(target)
    
    if db_key:
        curr = udB.get_key(db_key) or False
        udB.set_key(db_key, not curr)
        await security_menu(event)
