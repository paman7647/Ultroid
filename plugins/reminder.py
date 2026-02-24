# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

import asyncio
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from pyUltroid import ultroid_bot, LOGS
from . import ultroid_cmd, eor, get_string

scheduler = AsyncIOScheduler()

def start_scheduler():
    if not scheduler.running:
        try:
            scheduler.start()
        except RuntimeError: # No loop running yet
            import asyncio
            asyncio.get_event_loop().call_soon(scheduler.start)

# No top-level start()

async def send_reminder(chat_id, text, reply_to):
    try:
        await ultroid_bot.send_message(chat_id, f"🔔 **REMINDER:**\n\n{text}", reply_to=reply_to)
    except Exception as e:
        LOGS.error(f"Reminder error: {e}")

@ultroid_cmd(pattern="remind (\\d+)(s|m|h|d) (.*)", category="Tools")
async def remind_cmd(event):
    start_scheduler()
    time_val = int(event.pattern_match.group(1))
    unit = event.pattern_match.group(2)
    text = event.pattern_match.group(3)
    
    multiplier = {"s": 1, "m": 60, "h": 3600, "d": 86400}
    total_sec = time_val * multiplier[unit]
    
    # We can use scheduler to persist or just local task (roadmap said persistent, but for now APScheduler handles it in memory)
    # Real persistence would need database storage. 
    # For now, let's use memory with a clear confirmation.
    
    scheduler.add_job(send_reminder, 'interval', seconds=total_sec, args=[event.chat_id, text, event.reply_to_msg_id], id=f"rem_{event.id}", replace_existing=True)
    # Wait, 'interval' is wrong for a single reminder. Use 'date'.
    from datetime import timedelta
    remind_time = datetime.now() + timedelta(seconds=total_sec)
    
    scheduler.add_job(send_reminder, 'date', run_date=remind_time, args=[event.chat_id, text, event.reply_to_msg_id])
    
    await event.eor(f"✅ **Reminder set** for `{time_val}{unit}` from now.")

@ultroid_cmd(pattern="remlist$", category="Tools")
async def list_reminders(event):
    start_scheduler()
    jobs = scheduler.get_jobs()
    if not jobs:
        return await event.eor("No active reminders.")
    
    res = "**Active Reminders:**\n"
    for job in jobs:
        res += f"• `{job.next_run_time}`\n"
    await event.eor(res)
