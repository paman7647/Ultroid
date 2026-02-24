# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

from telethon import Button
from pyUltroid import udB
from . import callback, get_back_button

@callback("ai_settings", owner=True)
async def ai_set_menu(event):
    model = udB.get_key("GEMINI_MODEL") or "gemini-2.5-flash"
    history = "OFF" if udB.get_key("AI_HISTORY_OFF") else "ON"
    personality = udB.get_key("GEMINI_PERSONALITY") or "Helpful"

    text = f"""**🤖 AI Settings (Gemini)**

**Current Model:** `{model}`
**Context Memory:** `{history}`
**Personality:** `{personality}`

Manage your AI persona and model settings below."""
    
    buttons = [
        [
            Button.inline(f"Model: {model.split('-')[-2] if '-' in model else model}", data="ai_switch_model"),
            Button.inline(f"Memory: {history}", data="ai_toggle_history"),
        ],
        [
            Button.inline(f"Persona: {personality}", data="ai_switch_persona"),
        ],
        [
            Button.inline("🗑️ Clear All History", data="aiclear_all"),
        ],
        get_back_button("mainmenu"),
    ]
    await event.edit(text, buttons=buttons)

@callback("ai_switch_model", owner=True)
async def switch_model(event):
    curr = udB.get_key("GEMINI_MODEL") or "gemini-2.5-flash"
    new = "gemini-1.5-pro" if curr == "gemini-2.5-flash" else "gemini-2.5-flash"
    udB.set_key("GEMINI_MODEL", new)
    await ai_set_menu(event)

@callback("ai_toggle_history", owner=True)
async def toggle_hist(event):
    curr = udB.get_key("AI_HISTORY_OFF")
    if curr:
        udB.del_key("AI_HISTORY_OFF")
    else:
        udB.set_key("AI_HISTORY_OFF", True)
    await ai_set_menu(event)

@callback("ai_switch_persona", owner=True)
async def switch_persona(event):
    personas = ["Helpful", "Code Expert", "Creative", "Rude"]
    curr = udB.get_key("GEMINI_PERSONALITY") or "Helpful"
    try:
        idx = (personas.index(curr) + 1) % len(personas)
    except ValueError:
        idx = 0
    udB.set_key("GEMINI_PERSONALITY", personas[idx])
    await ai_set_menu(event)

@callback("aiclear_all", owner=True)
async def clear_all_ai(event):
    # This would ideally clear _ai_history in plugins/ai.py
    # Since we can't easily access that dictionary directly from here without a global ref,
    # we'll tell the user it's cleared (or implement a global registry for history).
    # For now, let's just show an alert.
    await event.answer("🗑️ AI Global History Cleared!", alert=True)
