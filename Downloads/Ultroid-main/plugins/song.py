# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

import os
import subprocess
from telethon import types
from pyUltroid import udB
from . import ultroid_cmd, eor, eod, LOGS

@ultroid_cmd(pattern="song (.*)", category="Media")
async def song_cmd(event):
    query = event.pattern_match.group(1).strip()
    if not query:
        return await eod(event, "Give a song name to search.")
    
    xx = await eor(event, f"📥 **Searching for** `{query}`...")
    
    try:
        # Search using yt-dlp
        cmd = f'yt-dlp "ytsearch1:{query}" --get-filename -o "song_%(id)s.%(ext)s"'
        filename = subprocess.check_output(cmd, shell=True).decode().strip()
        
        # Download as MP3
        await xx.edit(f"📥 **Downloading...**")
        download_cmd = f'yt-dlp "ytsearch1:{query}" -x --audio-format mp3 -o "song_%(id)s.%(ext)s"'
        subprocess.run(download_cmd, shell=True)
        
        # The filename might change due to -x --audio-format mp3
        final_file = filename.rsplit(".", 1)[0] + ".mp3"
        
        if os.path.exists(final_file):
            await xx.edit("📤 **Uploading...**")
            await event.client.send_file(
                event.chat_id,
                final_file,
                caption=f"🎵 **Song:** `{query}`",
                attributes=[types.DocumentAttributeAudio(title=query, performer="Ultroid Bot")],
                reply_to=event.reply_to_msg_id
            )
            await xx.delete()
            os.remove(final_file)
        else:
            await xx.edit("❌ **Failed to download song.**")
    except Exception as e:
        await xx.edit(f"❌ **Error:** `{e}`")

@ultroid_cmd(pattern="lyrics (.*)", category="Media")
async def lyrics_cmd(event):
    query = event.pattern_match.group(1).strip()
    if not query:
        return await eod(event, "Give a song name for lyrics.")
    
    token = udB.get_key("GENIUS_API_KEY")
    if not token:
        return await eod(event, "Set Genius token: `.setdb GENIUS_API_KEY <key>`\nGet from: https://genius.com/api-clients")
    
    await eor(event, "🔍 **Searching lyrics...**")
    try:
        from lyricsgenius import Genius
        genius = Genius(token)
        song = genius.search_song(query)
        if song:
            res = f"🎵 **Lyrics for {song.title}**\n\n{song.lyrics}"
            if len(res) > 4090:
                with open("lyrics.txt", "w") as f: f.write(song.lyrics)
                await event.client.send_file(event.chat_id, "lyrics.txt", caption=f"🎵 **Lyrics:** {song.title}")
                os.remove("lyrics.txt")
                await event.delete()
            else:
                await event.eor(res)
        else:
            await event.eor("❌ **Lyrics not found.**")
    except Exception as e:
        await event.eor(f"❌ **Error:** `{e}`")
