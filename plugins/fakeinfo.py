# Ultroid - UserBot
# Copyright (C) 2021-2025 TeamUltroid

from faker import Faker
from . import ultroid_cmd, eor

fake = Faker()

@ultroid_cmd(pattern="fakeinfo$", category="Fun")
async def generate_fake(event):
    address = fake.address().replace('\n', ', ')
    info = f"""
🕵️ **Fake Identity**
**Name**: `{fake.name()}`
**Address**: `{address}`
**Email**: `{fake.email()}`
**Job**: `{fake.job()}`
**SSN**: `{fake.ssn()}`
**Credit Card**: `{fake.credit_card_number()}` ({fake.credit_card_provider()})
**Company**: `{fake.company()}`
"""
    await event.eor(info)

@ultroid_cmd(pattern="fakeuser$", category="Fun")
async def fake_user(event):
    p = fake.profile()
    res = "**Fake User Profile**\n\n"
    for k, v in p.items():
        if k == 'residency': continue
        res += f"**{k.capitalize()}**: `{v}`\n"
    await event.eor(res)

@ultroid_cmd(pattern="fakeaddr$", category="Fun")
async def fake_addr(event):
    await event.eor(f"📍 **Fake Address:** `{fake.address()}`")
