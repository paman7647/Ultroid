# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

import os
import time
import psutil
from telethon import Button
from pyUltroid import start_time, udB
from pyUltroid.dB._core import HELP
from . import callback, get_back_button, OWNER_NAME, ultroid_version

def get_readable_time(seconds: int) -> str:
    count = 0
    ping_time = ""
    time_list = []
    time_suffix_list = ["s", "m", "h", "days"]
    while count < 4:
        count += 1
        if count < 3:
            remainder, result = divmod(seconds, 60)
        else:
            remainder, result = divmod(seconds, 24)
        if seconds == 0 and remainder == 0:
            break
        time_list.append(int(result))
        seconds = int(remainder)
    for i in range(len(time_list)):
        time_list[i] = str(time_list[i]) + time_suffix_list[i]
    if len(time_list) == 4:
        ping_time += time_list.pop() + ", "
    time_list.reverse()
    ping_time += ":".join(time_list)
    return ping_time

@callback("stat", owner=True)
async def bot_dashboard(event):
    uptime = get_readable_time(int(time.time() - start_time))
    cpu = psutil.cpu_percent()
    mem = psutil.virtual_memory().percent
    disk = psutil.disk_usage('/').percent
    
    # Plugins count
    plugins_count = sum(len(v) for v in HELP.values() if isinstance(v, dict))
    db_type = udB.__class__.__name__.replace('UltroidDB', 'Sqlite') # Fallback if name is generic
    
    msg = f"""
**Ultroid v{ultroid_version} Dashboard** 📊

**Owner**: `{OWNER_NAME}`
**Uptime**: `{uptime}`
**Plugins**: `{plugins_count}` loaded
**Database**: `{db_type}`

**System Stats**:
• **CPU**: `{cpu}%`
• **RAM**: `{mem}%`
• **Disk**: `{disk}%`

**Bot Status**: `Running` ✅
"""
    await event.edit(msg, buttons=get_back_button("mainmenu"))
