"""
Ultroid Session Generator
Run this file directly: python3 ssgen.py
"""

import sys
import asyncio

try:
    from telethon.sync import TelegramClient
    from telethon.sessions import StringSession
except ImportError:
    print("Telethon is required to generate a session.")
    print("Please install it running: pip3 install telethon")
    sys.exit(1)


print("╒════════════════════════════════════════════════════════════╕")
print("│               ULTROID session Generator                    │")
print("╘════════════════════════════════════════════════════════════╛\n")
import os

api_id = os.getenv("API_ID")
api_hash = os.getenv("API_HASH")

if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                key, val = line.strip().split("=", 1)
                if key == "API_ID" and not api_id:
                    api_id = val
                elif key == "API_HASH" and not api_hash:
                    api_hash = val

print("Get your API_ID and API_HASH from my.telegram.org\n")

if not api_id:
    api_id = input("Enter your API_ID: ")
else:
    print(f"Using API_ID from .env: {api_id}")

if not api_hash:
    api_hash = input("Enter your API_HASH: ")
else:
    print(f"Using API_HASH from .env: {'*' * len(api_hash)}")

phone = input("Enter your Phone Number (with country code): ")

async def gen():
    try:
        if not api_id.isdigit():
            print("\nAPI_ID must be an integer!")
            return
            
        client = TelegramClient(StringSession(), int(api_id), api_hash)
        await client.start(phone)
        
        session_string = client.session.save()
        print("\n\n✅ Your String Session has been successfully generated!\n")
        print("Here is your SESSION string:\n")
        print(session_string)
        print("\n⚠️ Keep this string safe! Do NOT share it with anyone!")
        print("Please copy it and add it to your .env file as SESSION=...")
        
        # Send it to Saved Messages for backup
        try:
            await client.send_message("me", f"**ULTROID SESSION**\n\n`{session_string}`\n\n⚠️ Keep this safe and do not share it!")
            print("👉 A backup of this session string has been sent to your Telegram 'Saved Messages'.")
        except Exception:
            pass
            
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(gen())
