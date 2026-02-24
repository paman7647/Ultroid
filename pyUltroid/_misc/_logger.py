# -----------------------------------------------------------
# Ultroid - UserBot
# Copyright (C) 2026 TeamUltroid
# Redeveloped and Maintained by Aman Kumar Pandey (https://github.com/paman7647)
# -----------------------------------------------------------

import logging
import os
import sys
from datetime import datetime

# Premium ANSI Color Palette
class Colors:
    MAGENTA = "\033[38;5;213m"
    CYAN = "\033[38;5;159m"
    GOLD = "\033[38;5;220m"
    GREEN = "\033[38;5;120m"
    RED = "\033[38;5;203m"
    BLUE = "\033[38;5;117m"
    BOLD = "\033[1m"
    GRAY = "\033[38;5;245m"
    END = "\033[0m"

class UltroidFormatter(logging.Formatter):
    """
    Advanced, high-aesthetic logging formatter for Ultroid.
    """
    LEVEL_MAP = {
        logging.DEBUG: (Colors.GRAY, "DEBUG", "◈"),
        logging.INFO: (Colors.CYAN, "INFO ", "🚀"),
        logging.WARNING: (Colors.GOLD, "WARN ", "⚠️"),
        logging.ERROR: (Colors.RED, "ERROR", "❌"),
        logging.CRITICAL: (Colors.BOLD + Colors.RED, "FATAL", "🚨")
    }

    def format(self, record):
        color, level_name, icon = self.LEVEL_MAP.get(record.levelno, (Colors.END, "LVL  ", "»"))
        
        # Time Formatting
        time_str = f"{Colors.GRAY}{datetime.now().strftime('%H:%M:%S')}{Colors.END}"
        
        # Component Formatting
        name_parts = record.name.split('.')
        component = name_parts[-1].upper() if len(name_parts) > 1 else record.name.upper()
        if len(component) > 10:
            component = component[:7] + ".."
        
        comp_color = Colors.MAGENTA if "PLUGINS" in record.name.upper() else Colors.BLUE
        if "DB" in record.name.upper(): comp_color = Colors.GOLD
        if "TELETHON" in record.name.upper(): comp_color = Colors.GREEN

        comp_part = f"{comp_color}{component:>10}{Colors.END}"
        
        # Structure Builders
        prefix = f"{time_str} {Colors.GRAY}│{Colors.END} {color}{icon} {level_name}{Colors.END} {Colors.GRAY}│{Colors.END} {comp_part} {Colors.GRAY}»{Colors.END}"
        
        message = record.getMessage()
        if record.levelno >= logging.ERROR:
            message = f"{color}{message}{Colors.END}"
            
        return f"{prefix} {message}"

def setup_logging(name="pyUltroid"):
    """Initializes the high-aesthetic logging system."""
    
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(UltroidFormatter())

    root_log = logging.getLogger(name)
    root_log.setLevel(logging.DEBUG)
    
    for h in root_log.handlers[:]:
        root_log.removeHandler(h)
        
    root_log.addHandler(console_handler)

    # Designer Startup Header
    border = f"{Colors.GRAY}╒{'═'*60}╕{Colors.END}"
    footer = f"{Colors.GRAY}╘{'═'*60}╛{Colors.END}"
    
    print(f"\n{border}")
    print(f"{Colors.GRAY}│{Colors.END}{Colors.BOLD}{Colors.MAGENTA}{' ULTROID BOT FRAMEWORK ':^60}{Colors.END}{Colors.GRAY}│{Colors.END}")
    print(f"{Colors.GRAY}│{Colors.END}{Colors.GRAY}{' Rewritten by Aman Kumar Pandey ':^60}{Colors.END}{Colors.GRAY}│{Colors.END}")
    print(f"{footer}\n")

    # Dependency Logger Tuning
    for logger_name in ["telethon", "asyncio", "urllib3", "pydantic"]:
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.WARNING)
        for h in logger.handlers[:]:
            logger.removeHandler(h)
        logger.addHandler(console_handler)

    return root_log
