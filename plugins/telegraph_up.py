# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Telegraph Upload

from . import ultroid_cmd, eor, eod

@ultroid_cmd(pattern="telegraph(?: |$)(.*)", category="Media")
async def telegraph_cmd(event):
    """Upload images/videos to Telegraph and get a direct URL."""
    reply = await event.get_reply_message()

    if not reply or not reply.media:
        return await eod(event, "❌ **Reply to an image or video to upload to Telegraph.**")

    await eor(event, "📤 **Uploading to Telegraph...**")

    try:
        from telegraph import upload_file

        file = await event.client.download_media(reply)
        urls = upload_file(file)
        url = f"https://telegra.ph{urls[0]}"

        await eor(event, f"✅ **Uploaded to Telegraph!**\n\n🔗 {url}")

        import os
        os.remove(file)
    except ImportError:
        await eor(event, "❌ `telegraph` package not installed. Run: `pip install telegraph`")
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
