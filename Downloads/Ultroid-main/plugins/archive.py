# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Archive Tools (Zip/Unzip)

import os
import zipfile
import tarfile
from . import ultroid_cmd, eor, eod

@ultroid_cmd(pattern="zip(?: |$)(.*)", category="Tools")
async def zip_cmd(event):
    """Compress a replied file into a ZIP archive."""
    reply = await event.get_reply_message()

    if not reply or not reply.media:
        return await eod(event, "❌ **Reply to a file to compress it.**")

    name = event.pattern_match.group(1).strip() or "archive"
    await eor(event, "📦 **Compressing...**")

    try:
        file = await event.client.download_media(reply)
        zip_name = f"{name}.zip"

        with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(file, os.path.basename(file))

        await event.client.send_file(
            event.chat_id,
            zip_name,
            caption=f"📦 **Compressed:** `{os.path.basename(file)}`",
            reply_to=event.reply_to_msg_id,
        )
        await event.delete()
        os.remove(file)
        os.remove(zip_name)
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")


@ultroid_cmd(pattern="unzip$", category="Tools")
async def unzip_cmd(event):
    """Extract a replied ZIP/TAR archive."""
    reply = await event.get_reply_message()

    if not reply or not reply.media:
        return await eod(event, "❌ **Reply to a ZIP/TAR file to extract.**")

    await eor(event, "📂 **Extracting...**")

    try:
        file = await event.client.download_media(reply)
        extract_dir = "extracted_files"
        os.makedirs(extract_dir, exist_ok=True)

        if zipfile.is_zipfile(file):
            with zipfile.ZipFile(file, "r") as zf:
                zf.extractall(extract_dir)
                file_list = zf.namelist()
        elif tarfile.is_tarfile(file):
            with tarfile.open(file, "r:*") as tf:
                tf.extractall(extract_dir)
                file_list = tf.getnames()
        else:
            os.remove(file)
            return await eor(event, "❌ **Unsupported format. Only ZIP and TAR are supported.**")

        # Send extracted files
        count = 0
        for f in os.listdir(extract_dir):
            fpath = os.path.join(extract_dir, f)
            if os.path.isfile(fpath):
                await event.client.send_file(event.chat_id, fpath, reply_to=event.reply_to_msg_id)
                count += 1
                if count >= 10:  # Limit to prevent spam
                    break

        await eor(event, f"📂 **Extracted {len(file_list)} files** ({count} sent)")

        # Cleanup
        import shutil
        os.remove(file)
        shutil.rmtree(extract_dir, ignore_errors=True)
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
