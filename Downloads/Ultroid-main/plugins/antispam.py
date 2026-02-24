# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

import random
import asyncio
from telethon import events, Button
from pyUltroid import udB, ultroid_bot, asst
from pyUltroid.fns.tools import async_searcher
from pyUltroid.fns.helper import inline_mention
from . import callback, LOGS, get_string

# Math Captcha Storage
_captcha_db = {}

@ultroid_bot.on(events.ChatAction())
async def antispam_handler(event):
    if not (event.user_joined or event.user_added):
        return
    
    user = await event.get_user()
    chat = await event.get_chat()
    
    if user.bot:
        return

    # 1. CAS Check
    if udB.get_key("CAS_CHECK"):
        try:
            res = await async_searcher(f"https://api.cas.chat/check?user_id={user.id}", re_json=True)
            if res and res.get("ok"):
                await event.client.edit_permissions(chat.id, user.id, view_messages=False)
                return await event.respond(f"**CAS Ban Detected!**\nUser: {inline_mention(user)}\nReason: `{res.get('result', {}).get('offenses', 0)} offenses found on Combot.`")
        except Exception as e:
            LOGS.error(f"CAS Error: {e}")

    # 2. CAPTCHA
    if udB.get_key("CAPTCHA") and not udB.get_key(f"CAPTCHA_WHITELIST_{chat.id}"):
        try:
            # Restrict the user
            await event.client.edit_permissions(chat.id, user.id, send_messages=False)
            
            # Generate Math Question
            a, b = random.randint(1, 10), random.randint(1, 10)
            ans = a + b
            
            _captcha_db[f"{chat.id}_{user.id}"] = ans
            
            buttons = [
                [Button.inline(str(ans if i == 0 else random.randint(1, 20)), data=f"cp_{ans if i == 0 else random.randint(1, 20)}_{user.id}")]
                for i in range(3)
            ]
            random.shuffle(buttons)
            
            msg = f"Welcome {inline_mention(user)}!\nTo speak here, please solve this: **{a} + {b} = ?**"
            sent = await event.respond(msg, buttons=buttons)
            
            # Auto-kick if not solved in 2 mins
            await asyncio.sleep(120)
            if f"{chat.id}_{user.id}" in _captcha_db:
                await event.client.kick_participant(chat.id, user.id)
                await sent.edit(f"{inline_mention(user)} failed to solve CAPTCHA and was kicked.")
                del _captcha_db[f"{chat.id}_{user.id}"]
                
        except Exception as e:
            LOGS.error(f"Captcha Error: {e}")

@callback(pattern=r"cp_(.*)_(.*)", owner=False)
async def captcha_callback(event):
    provided_ans = int(event.data_match.group(1).decode())
    user_id = int(event.data_match.group(2).decode())
    
    if event.sender_id != user_id:
        return await event.answer("This is not for you!", alert=True)
    
    key = f"{event.chat_id}_{user_id}"
    if key not in _captcha_db:
        return await event.answer("CAPTCHA expired or already solved.", alert=True)
    
    correct_ans = _captcha_db[key]
    
    if provided_ans == correct_ans:
        try:
            await event.client.edit_permissions(event.chat_id, user_id, send_messages=True)
            await event.edit(f"CAPTCHA Solved! Welcome {inline_mention(await event.get_sender())}.")
            del _captcha_db[key]
            await asyncio.sleep(5)
            await event.delete()
        except Exception as e:
            await event.answer(f"Error: {e}", alert=True)
    else:
        await event.answer("Wrong answer! Try again.", alert=True)
