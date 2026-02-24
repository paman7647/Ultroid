# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: OCR (Image to Text)

import os
from . import ultroid_cmd, eor, eod

@ultroid_cmd(pattern="ocr$", category="Tools")
async def ocr_cmd(event):
    """Extract text from images using Tesseract OCR."""
    reply = await event.get_reply_message()

    if not reply or not reply.photo:
        return await eod(event, "❌ **Reply to an image to extract text.**")

    await eor(event, "🔍 **Running OCR...**")

    try:
        import pytesseract
        from PIL import Image

        file = await event.client.download_media(reply)
        img = Image.open(file)
        text = pytesseract.image_to_string(img)

        if text.strip():
            if len(text) > 4000:
                text = text[:4000] + "\n\n... (truncated)"
            await eor(event, f"📝 **Extracted Text:**\n\n```\n{text.strip()}\n```")
        else:
            await eor(event, "❌ **No text found in the image.**")

        os.remove(file)
    except ImportError:
        await eor(event, "❌ Missing deps. Run: `pip install pytesseract Pillow`\nAlso install Tesseract: `brew install tesseract`")
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
