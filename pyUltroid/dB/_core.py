# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid
#
# This file is a part of < https://github.com/TeamUltroid/Ultroid/ >
# PLease read the GNU Affero General Public License in
# <https://github.com/TeamUltroid/Ultroid/blob/main/LICENSE>.

PLUGINS = []
ADDONS = []
HELP = {}
LOADED = {}
LIST = {}
VC_HELP = {}

# Categories declared via @ultroid_cmd(category="...") decorator
PLUGIN_CATEGORIES = {}

# Auto-append emoji to plain category names
CATEGORY = {
    "admin": "👮‍♂️",
    "tools": "🛠",
    "media": "🎬",
    "fun": "🎮",
    "owner": "👑",
    "addons": "🧩",
    "extra": "🌀",
    "ai": "🤖",
    "social": "👥",
    "utils": "🔧",
    "privacy": "🔒",
    "dev": "⚡",
}

def get_category(plugin_name):
    """Get display category for a plugin. Checks decorator-declared first, 
    then defaults to 'Extra'. Auto-appends emoji."""
    raw = PLUGIN_CATEGORIES.get(plugin_name, "Extra")
    # Auto-append emoji from lookup
    emoji = CATEGORY.get(raw.lower(), "🌀")
    return f"{raw} {emoji}"
