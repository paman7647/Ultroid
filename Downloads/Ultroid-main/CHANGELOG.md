# Changelog — Ultroid (Redeveloped Fork)

This file tracks all major updates and changes made to this fork of Ultroid.

**Maintained by:** [paman7647](https://github.com/paman7647)  
**Latest Version:** 3.0.0 (Feb 2026)

---

## v3.0.0 — The Stability Update

This is an overhaul of the bot, focusing on making it stable for 2026 and adding modern features like AI and enhanced group security.

### 🏗️ Core & Architecture
- **Stability Fixes**: Fixed the annoying "no running event loop" errors on newer Python versions. Also added a proper shutdown handler so the database doesn't get corrupted when you stop the bot.
- **Fast Transfers**: Optimized file uploads using the latest `isal` compression.
- **Improved Startup**: Fixed critical `ImportError` issues and unawaited coroutine warnings that caused crashes on startup.

### 🤖 Assistant Bot v2
- **New Management Panel**: The `/start` menu in the assistant is now categorized. You can manage settings, see a live dashboard, and control sudo users from one place.
- **Organized Help Categories**: Rebuilt the help menu to group commands into logical categories like Security, AI, Admin, and Tools for better navigation.
- **Live Dashboard**: Added a real-time view of server stats like RAM, CPU, and Uptime.
- **Plugin Manager**: You can now see what's loaded and restart the bot directly from Telegram buttons.

### 🔒 Security & Privacy
- **Anti-Spam Suite**: Added CAS (Combot Anti-Spam) integration to automatically keep known spammers out of your groups.
- **CAPTCHA**: Groups can now require new members to solve a math problem before they can chat.
- **Raid Protection**: The bot can now detect mass-joins and automatically lock the group or enable slow-mode to prevent raids.
- **Privacy Tools**: Added `.sd` (self-destruct) for timed messages and `.disappear` to clean up your chat history.

### 🤖 AI Integration
- **Gemini v2.5**: Powered by the latest Gemini model. It handles text, code, and images.
- **AI Settings**: You can change the bot's "personality" and clear history via the Assistant menu.
- **Quick Summarize**: Use `.aisum` on any long message or forwarded post to get a quick summary.

### 🛠️ Plugins & Features
- **Working Gifts**: Fixed the Gifts plugin for Layer 216. You can see available gifts and your own collection again.
- **Star Tracking**: Full support for Telegram Stars, including revenue viewing and subscription management.
- **New Multi-Downloader**: A single plugin for YouTube, Instagram, and SoundCloud. It's faster and handles YouTube's latest bot-detection efforts.
- **Channel Boosts**: Track who's boosting your channel and see your current level status.
- **Telegram Business**: Integrated support for business quick replies and chat links.

### 📦 Technical & Deps
- **Updated requirements**: Switched to `deep-translator` for unlimited free translations and updated `yt-dlp` for better media handling.
- **Telethon Layer 216**: All plugins and core logic have been updated to support the latest Telegram layer features.
- **Deno Integration**: Added Deno support to solve complex YouTube/JS challenges automatically.

---
