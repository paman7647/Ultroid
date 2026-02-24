# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: URL/File Scanner (VirusTotal)

import aiohttp
from . import ultroid_cmd, eor, eod, udB

@ultroid_cmd(pattern="scan(?: |$)(.*)", category="Tools")
async def scan_cmd(event):
    """Scan URLs for malware using VirusTotal."""
    url = event.pattern_match.group(1).strip()

    if not url:
        reply = await event.get_reply_message()
        if reply and reply.raw_text:
            # Extract first URL from message
            import re
            urls = re.findall(r'https?://\S+', reply.raw_text)
            url = urls[0] if urls else None

    if not url:
        return await eod(event, "❌ **Usage:** `.scan <url>` or reply to a message with URL")

    api_key = udB.get_key("VT_API_KEY")
    if not api_key:
        return await eod(event, "❌ **Set VirusTotal API key:** `.setdb VT_API_KEY <key>`")

    await eor(event, f"🔍 **Scanning URL...**\n`{url}`")

    try:
        headers = {"x-apikey": api_key}
        async with aiohttp.ClientSession(headers=headers) as session:
            # Submit URL for scanning
            async with session.post(
                "https://www.virustotal.com/api/v3/urls",
                data={"url": url},
            ) as resp:
                data = await resp.json()
                analysis_id = data["data"]["id"]

            # Get results
            async with session.get(
                f"https://www.virustotal.com/api/v3/analyses/{analysis_id}"
            ) as resp:
                result = await resp.json()

            stats = result["data"]["attributes"]["stats"]
            total = sum(stats.values())
            malicious = stats.get("malicious", 0)
            suspicious = stats.get("suspicious", 0)
            clean = stats.get("harmless", 0) + stats.get("undetected", 0)

            if malicious > 0:
                icon = "🔴"
                status = "MALICIOUS"
            elif suspicious > 0:
                icon = "🟡"
                status = "SUSPICIOUS"
            else:
                icon = "🟢"
                status = "CLEAN"

            msg = (
                f"{icon} **VirusTotal Scan Results**\n\n"
                f"🔗 `{url}`\n\n"
                f"**Status:** {status}\n"
                f"🔴 Malicious: {malicious}/{total}\n"
                f"🟡 Suspicious: {suspicious}/{total}\n"
                f"🟢 Clean: {clean}/{total}"
            )
            await eor(event, msg)

    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
