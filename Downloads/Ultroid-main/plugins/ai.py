# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: AI Chat (Google Gemini via google-genai SDK)

from . import ultroid_cmd, eor, eod, udB, LOGS

# In-memory chat history per user
_ai_history = {}

@ultroid_cmd(pattern=r"ai(?: |$)([\s\S]*)", category="AI")
async def ai_cmd(event):
    """Chat with AI using Google Gemini.
    
    Usage: .ai <prompt>
    Reply: .ai (to image or text)
    Modes: .ai -code <prompt> | .ai -creative <prompt>
    """
    input_str = event.pattern_match.group(1).strip()
    
    mode = "chat"
    prompt = input_str
    if input_str.startswith("-code"):
        mode = "code"
        prompt = input_str[5:].strip()
    elif input_str.startswith("-creative"):
        mode = "creative"
        prompt = input_str[9:].strip()

    reply = await event.get_reply_message()
    image = None
    if reply:
        if not prompt:
            prompt = reply.raw_text
        if reply.photo or (reply.document and reply.document.mime_type.startswith("image/")):
            image = await reply.download_media()
    
    if not prompt and not image:
        return await eod(event, "🤖 **Usage:** `.ai <prompt>` or reply to something.")

    api_key = udB.get_key("GEMINI_API_KEY")
    if not api_key:
        return await eod(event, "❌ Set key: `.setdb GEMINI_API_KEY <key>`")

    await eor(event, "🤖 **Thinking...**")

    try:
        from google import genai
        from google.genai import types as gtypes
        
        client = genai.Client(api_key=api_key)
        
        system_instructions = {
            "chat": "You are a helpful assistant. Keep responses clear and concise.",
            "code": "You are an expert programmer. Provide only high-quality code and minimal explanation.",
            "creative": "You are a creative writer. Use rich language and be expressive."
        }

        # Handle Image + Text
        contents = []
        if image:
            with open(image, 'rb') as f:
                img_data = f.read()
            contents.append(gtypes.Part.from_bytes(data=img_data, mime_type='image/jpeg'))
            if prompt:
                contents.append(gtypes.Part.from_text(text=prompt))
            else:
                contents.append(gtypes.Part.from_text(text="Describe this image in detail."))
        else:
            # Multi-turn Chat
            uid = event.sender_id
            if uid not in _ai_history:
                _ai_history[uid] = []
            _ai_history[uid].append({"role": "user", "parts": [{"text": prompt}]})
            if len(_ai_history[uid]) > 20:
                _ai_history[uid] = _ai_history[uid][-20:]
            contents = _ai_history[uid]

        model = udB.get_key("GEMINI_MODEL") or "gemini-2.5-flash"
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=gtypes.GenerateContentConfig(
                system_instruction=system_instructions.get(mode),
                temperature=0.7 if mode == "creative" else 0.2
            )
        )

        answer = response.text
        if not image:
            _ai_history[uid].append({"role": "model", "parts": [{"text": answer}]})

        if len(answer) > 4000:
            import os
            with open("ai_response.md", "w") as f: f.write(answer)
            await event.client.send_file(event.chat_id, "ai_response.md", caption="🤖 **AI Result**", reply_to=event.reply_to_msg_id)
            await event.delete()
            os.remove("ai_response.md")
        else:
            await eor(event, f"🤖 **Gemini ({mode}):**\n\n{answer}")

        if image and os.path.exists(image):
            os.remove(image)

    except Exception as e:
        await eor(event, f"❌ **AI Error:** `{str(e)[:200]}`")

@ultroid_cmd(pattern="aisum$", category="AI")
async def ai_summarize(event):
    """Summarize a replied message or article."""
    reply = await event.get_reply_message()
    if not reply or not reply.text:
        return await eod(event, "Reply to a long message to summarize.")
    
    api_key = udB.get_key("GEMINI_API_KEY")
    if not api_key: return await eod(event, "❌ Set key: `.setdb GEMINI_API_KEY <key>`")
    
    await eor(event, "📝 **Summarizing...**")
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        model = udB.get_key("GEMINI_MODEL") or "gemini-2.5-flash"
        response = client.models.generate_content(
            model=model,
            contents=f"Summarize this text concisely in bullet points:\n\n{reply.text}",
        )
        await eor(event, f"📝 **Summary:**\n\n{response.text}")
    except Exception as e:
        await eor(event, f"❌ Error: `{str(e)[:200]}`")

@ultroid_cmd(pattern="aiclear$", category="AI")
async def aiclear_cmd(event):
    """Clear your AI chat history."""
    user_id = event.sender_id
    if user_id in _ai_history:
        del _ai_history[user_id]
    await eor(event, "🗑️ **AI chat history cleared!**")
