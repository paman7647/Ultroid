# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: Live Crypto Prices

import aiohttp
from . import ultroid_cmd, eor, eod

COINGECKO_API = "https://api.coingecko.com/api/v3"

@ultroid_cmd(pattern="crypto(?: |$)(.*)", category="Tools")
async def crypto_cmd(event):
    """Get live cryptocurrency prices from CoinGecko."""
    query = event.pattern_match.group(1).strip().lower()

    if not query:
        query = "bitcoin"

    await eor(event, f"📊 **Fetching price for `{query}`...**")

    try:
        async with aiohttp.ClientSession() as session:
            # Search for the coin
            url = f"{COINGECKO_API}/search?query={query}"
            async with session.get(url) as resp:
                data = await resp.json()
                coins = data.get("coins", [])

            if not coins:
                return await eor(event, f"❌ **Coin `{query}` not found.**")

            coin_id = coins[0]["id"]
            coin_name = coins[0]["name"]
            coin_symbol = coins[0]["symbol"].upper()

            # Get price data
            url = f"{COINGECKO_API}/simple/price?ids={coin_id}&vs_currencies=usd,inr,eur&include_24hr_change=true&include_market_cap=true"
            async with session.get(url) as resp:
                price_data = await resp.json()

            if coin_id not in price_data:
                return await eor(event, "❌ **Price data unavailable.**")

            d = price_data[coin_id]
            usd = d.get("usd", 0)
            inr = d.get("inr", 0)
            eur = d.get("eur", 0)
            change = d.get("usd_24h_change", 0)
            mcap = d.get("usd_market_cap", 0)

            arrow = "📈" if change >= 0 else "📉"
            change_str = f"+{change:.2f}%" if change >= 0 else f"{change:.2f}%"

            msg = (
                f"**{coin_name}** (`{coin_symbol}`) {arrow}\n\n"
                f"💵 **USD:** ${usd:,.2f}\n"
                f"💶 **EUR:** €{eur:,.2f}\n"
                f"🇮🇳 **INR:** ₹{inr:,.2f}\n\n"
                f"📊 **24h Change:** {change_str}\n"
                f"🏦 **Market Cap:** ${mcap:,.0f}"
            )
            await eor(event, msg)

    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
