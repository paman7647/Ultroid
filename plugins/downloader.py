# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey (https://github.com/paman7647)
#
# This file is a part of < https://github.com/TeamUltroid/Ultroid/ >
# PLease read the GNU Affero General Public License in
# <https://www.github.com/TeamUltroid/Ultroid/blob/main/LICENSE/>.
"""
✘ Commands Available -

• `{i}yta <(youtube/any) link>`
   Download audio from the link.

• `{i}ytv <(youtube/any) link>`
   Download video  from the link.

• `{i}ytsa <(youtube) search query>`
   Search and download audio from youtube.

• `{i}ytsv <(youtube) search query>`
   Search and download video from youtube.

• `{i}ig <(instagram) link>`
   Download video/reel from instagram.

• `{i}sc <(soundcloud) link>`
   Download audio from soundcloud.
"""
import asyncio
import glob
import os
import time

from pyUltroid import LOGS
from pyUltroid.fns.ytdl import get_yt_link, download_yt
from pyUltroid.fns.helper import humanbytes, run_async
from pyUltroid.fns.tools import set_attributes
from yt_dlp import YoutubeDL
from . import ultroid_cmd


# ---------- YouTube Downloader ----------

async def yt_dler(event, url, mode="video"):
    xx = await event.eor("`Processing...`")
    ytd = {
        "prefer_ffmpeg": True,
        "addmetadata": True,
        "geo-bypass": True,
        "nocheckcertificate": True,
    }
    if mode == "audio":
        ytd["format"] = "bestaudio/best"
        ytd["outtmpl"] = {"default": "%(id)s.m4a"}
    else:
        ytd["format"] = "bestvideo+bestaudio/best"
        ytd["outtmpl"] = {"default": "%(id)s.mp4"}
        ytd["postprocessors"] = [{"key": "FFmpegMetadata"}]

    await download_yt(xx, url, ytd)


# ---------- Instagram / Other Platform Downloader ----------

@run_async
def _ig_download(url, opts):
    try:
        return YoutubeDL(opts).extract_info(url=url, download=True)
    except Exception as ex:
        LOGS.error(f"Instagram download error: {ex}")
        return None


async def ig_dler(event, url):
    xx = await event.eor("`Downloading from Instagram...`")
    reply_to = event.reply_to_msg_id or event
    opts = {
        "quiet": True,
        "prefer_ffmpeg": True,
        "geo-bypass": True,
        "nocheckcertificate": True,
        "format": "best",
        "outtmpl": "%(id)s.%(ext)s",
    }
    try:
        info = await _ig_download(url, opts)
        if not info:
            return await xx.edit("`Failed to download from Instagram.`")

        title = info.get("title", "Instagram Video")
        if len(title) > 20:
            title = title[:17] + "..."
        id_ = info["id"]

        # Find downloaded file
        filepath = None
        for x in glob.glob(f"{id_}*"):
            if not x.endswith("jpg"):
                filepath = x
                break

        if not filepath:
            return await xx.edit("`Download completed but file not found.`")

        if filepath.endswith(".part"):
            os.remove(filepath)
            return await xx.edit("`Download was incomplete.`")

        # Rename to proper title
        ext = "." + filepath.split(".")[-1]
        final_name = title + ext
        try:
            os.rename(filepath, final_name)
        except FileNotFoundError:
            final_name = filepath

        attributes = await set_attributes(final_name)
        res, _ = await event.client.fast_uploader(
            final_name, show_progress=True, event=xx, to_delete=True
        )
        caption = f"`{info.get('title', 'Instagram Media')}`"
        await event.client.send_file(
            event.chat_id,
            file=res,
            caption=caption,
            attributes=attributes,
            supports_streaming=True,
            reply_to=reply_to,
        )
        try:
            await xx.delete()
        except BaseException:
            pass
    except Exception as e:
        LOGS.error(f"Instagram handler error: {e}")
        await xx.edit(f"`Error: {type(e).__name__}: {str(e)[:200]}`")


# ---------- SoundCloud Downloader ----------

async def sc_dler(event, url):
    xx = await event.eor("`Downloading from SoundCloud...`")
    opts = {
        "quiet": True,
        "prefer_ffmpeg": True,
        "format": "bestaudio",
        "outtmpl": {"default": "%(id)s.mp3"},
    }
    await download_yt(xx, url, opts)


# ---------- Command Handler ----------

@ultroid_cmd(category="Media", 
    pattern="(yta|ytv|ytsa|ytsv|ig|sc) ?(.*)",
)
async def download_from_multi_platforms(event):
    cmd = event.pattern_match.group(1).strip()
    url = event.pattern_match.group(2).strip()

    if cmd in ["ig", "sc"] and not url:
        return await event.eor(f"`Please provide a {cmd.upper()} link.`")

    if cmd == "yta":
        if not url:
            return await event.eor("`Please provide a link.`")
        await yt_dler(event, url, mode="audio")

    elif cmd == "ytv":
        if not url:
            return await event.eor("`Please provide a link.`")
        await yt_dler(event, url, mode="video")

    elif cmd in ["ytsa", "ytsv"]:
        if not url:
            return await event.eor("`Please provide a search query.`")
        xx = await event.eor("`Searching...`")
        url = get_yt_link(url)
        if not url:
            return await xx.edit("`No results found.`")
        mode = "audio" if cmd == "ytsa" else "video"
        await yt_dler(xx, url, mode=mode)

    elif cmd == "ig":
        await ig_dler(event, url)

    elif cmd == "sc":
        if not url:
            return await event.eor("`Please provide a SoundCloud link.`")
        await sc_dler(event, url)
