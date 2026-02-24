# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey (https://github.com/paman7647)
#
# This file is a part of < https://github.com/TeamUltroid/Ultroid/ >
# PLease read the GNU Affero General Public License in
# <https://github.com/TeamUltroid/Ultroid/blob/main/LICENSE>.

import logging
from pyUltroid import udB

LOGS = logging.getLogger("pyUltroid.Cache")

class EntityCache:
    """Ultroid 3.0 Entity Cache - Stores peer info to avoid repetitive API calls."""
    
    def __init__(self):
        self._cache = {}

    async def set_peer(self, peer_id, username=None, title=None):
        """Cache peer information."""
        data = {"id": peer_id}
        if username:
            data["username"] = username
        if title:
            data["title"] = title
        
        # Save to Async DB for persistence across restarts
        await udB.set_key(f"PEER_{peer_id}", data)
        # Update in-memory cache
        self._cache[peer_id] = data

    async def get_peer(self, peer_id):
        """Retrieve peer information from cache or DB."""
        if peer_id in self._cache:
            return self._cache[peer_id]
        
        data = await udB.get_key(f"PEER_{peer_id}")
        if data:
            self._cache[peer_id] = data
            return data
        return None

    async def get_id_by_username(self, username):
        """Find peer ID by cached username (approximate)."""
        username = username.lstrip("@").lower()
        # This is expensive in key-value DB, but we can index it if needed
        # For now, we assume simple peer_id lookup is primary
        return None

cache = EntityCache()

async def get_cached_peer(peer_id):
    return await cache.get_peer(peer_id)

async def set_cached_peer(peer_id, username=None, title=None):
    await cache.set_peer(peer_id, username, title)
