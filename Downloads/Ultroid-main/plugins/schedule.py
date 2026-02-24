# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Scheduled Messages (Telethon native)

import re
from datetime import timedelta, datetime
from . import ultroid_cmd, eor, eod

def parse_time(time_str):
    """Parse time strings like '5m', '2h', '1d' into timedelta."""
    match = re.match(r"(\d+)\s*([smhd])", time_str.lower())
    if not match:
        return None
    value, unit = int(match.group(1)), match.group(2)
    units = {"s": "seconds", "m": "minutes", "h": "hours", "d": "days"}
    return timedelta(**{units[unit]: value})


@ultroid_cmd(pattern="schedule(?: |$)(.*)", category="Owner")
async def schedule_cmd(event):
    """Schedule a message to be sent later.
    
    Usage: .schedule <time> <message>
    Examples: .schedule 5m Hello!, .schedule 2h Reminder
    """
    args = event.pattern_match.group(1).strip()

    if not args:
        return await eod(event, (
            "❌ **Usage:** `.schedule <time> <message>`\n\n"
            "**Time formats:**\n"
            "• `30s` — 30 seconds\n"
            "• `5m` — 5 minutes\n"
            "• `2h` — 2 hours\n"
            "• `1d` — 1 day\n\n"
            "**Example:** `.schedule 5m Hello!`"
        ))

    # Parse time from args
    time_match = re.match(r"(\d+\s*[smhd])\s+(.*)", args, re.DOTALL)
    if not time_match:
        return await eod(event, "❌ **Invalid format.** Use: `.schedule 5m Hello!`")

    time_str = time_match.group(1)
    message = time_match.group(2)

    delay = parse_time(time_str)
    if not delay:
        return await eod(event, "❌ **Invalid time format.** Use: `s`, `m`, `h`, or `d`")

    try:
        scheduled_time = datetime.now() + delay
        await event.client.send_message(
            event.chat_id,
            message,
            schedule=scheduled_time,
        )
        await eor(event, f"⏰ **Message scheduled!**\n\n📅 Will send in **{time_str}**\n💬 `{message[:100]}`")
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")


@ultroid_cmd(pattern="schedules$", category="Owner")
async def schedules_list(event):
    """List all scheduled messages in this chat."""
    try:
        from telethon.tl.functions.messages import GetScheduledHistoryRequest

        result = await event.client(
            GetScheduledHistoryRequest(peer=event.chat_id, hash=0)
        )

        messages = result.messages
        if not messages:
            return await eor(event, "📭 **No scheduled messages in this chat.**")

        text = f"⏰ **Scheduled Messages** ({len(messages)}):\n\n"
        for i, msg in enumerate(messages[:10], 1):
            preview = msg.message[:50] if msg.message else "[media]"
            date = msg.date.strftime("%b %d, %H:%M") if msg.date else "?"
            text += f"**{i}.** `{preview}` — {date}\n"

        await eor(event, text)
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
