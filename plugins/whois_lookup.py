# Ultroid - UserBot
# Copyright (C) 2021-2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey
#
# v3.0 Plugin: WHOIS Domain Lookup

from . import ultroid_cmd, eor, eod

@ultroid_cmd(pattern="whois(?: |$)(.*)", category="Tools")
async def whois_cmd(event):
    """Look up WHOIS information for a domain."""
    domain = event.pattern_match.group(1).strip()

    if not domain:
        return await eod(event, "❌ **Usage:** `.whois <domain>`\nExample: `.whois google.com`")

    # Clean up domain
    domain = domain.replace("https://", "").replace("http://", "").split("/")[0]

    await eor(event, f"🔍 **Looking up `{domain}`...**")

    try:
        import whois

        w = whois.whois(domain)

        name = w.domain_name
        if isinstance(name, list):
            name = name[0]

        registrar = w.registrar or "N/A"
        creation = w.creation_date
        if isinstance(creation, list):
            creation = creation[0]
        expiry = w.expiration_date
        if isinstance(expiry, list):
            expiry = expiry[0]

        ns = w.name_servers
        if isinstance(ns, list):
            ns = ", ".join(ns[:4])

        org = w.org or "N/A"
        country = w.country or "N/A"

        msg = (
            f"🌐 **WHOIS — `{name}`**\n\n"
            f"🏢 **Registrar:** {registrar}\n"
            f"🏛️ **Organization:** {org}\n"
            f"🌍 **Country:** {country}\n"
            f"📅 **Created:** {creation}\n"
            f"⏳ **Expires:** {expiry}\n"
            f"🖥️ **Nameservers:** {ns}"
        )
        await eor(event, msg)
    except ImportError:
        await eor(event, "❌ `python-whois` not installed. Run: `pip install python-whois`")
    except Exception as e:
        await eor(event, f"❌ **Error:** `{e}`")
