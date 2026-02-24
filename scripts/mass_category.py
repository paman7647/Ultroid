#!/usr/bin/env python3
"""
Final Category Propagation — handles ALL decorator formats:
  @ultroid_cmd(pattern="...", category="X")       ← single-line (done)
  @ultroid_cmd(\n    pattern="...", category="X")  ← multi-line with pattern on next line
  @ultroid_cmd(\n    pattern=r"...",\n)             ← multi-line raw string, no category
  @ultroid_cmd("...", category="X")               ← positional string
  @ultroid_cmd(\n    pattern="...",\n    fullsudo=True,\n)  ← multi-line with extra kwargs
"""

import re
import os
import glob

PLUGIN_DIR = os.path.join(os.path.dirname(__file__), "..", "plugins")


def get_file_category(content):
    match = re.search(r'category="([^"]*)"', content)
    return match.group(1) if match else None


def fix_file(filepath):
    with open(filepath) as f:
        content = f.read()
    
    category = get_file_category(content)
    if not category:
        return 0
    
    lines = content.split('\n')
    fixed = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Skip if already has category
        if 'category=' in line:
            i += 1
            continue
        
        # Match: @ultroid_cmd( at end of line (multi-line start)
        if re.match(r'\s*@ultroid_cmd\(\s*$', line):
            # Look ahead for the pattern= line (could be next line or a few lines down)
            for j in range(i + 1, min(i + 5, len(lines))):
                if 'category=' in lines[j]:
                    break  # already has it
                # Find pattern= line and inject category
                pat_match = re.search(r'(pattern\s*=\s*(?:r)?["\'][^"\']*["\'])', lines[j])
                if pat_match:
                    old = pat_match.group(1)
                    lines[j] = lines[j].replace(old, f'{old}, category="{category}"', 1)
                    fixed += 1
                    break
            i += 1
            continue
        
        # Match: @ultroid_cmd(pattern=... without category on same line
        pat_match = re.match(r'(\s*@ultroid_cmd\(.*?pattern\s*=\s*(?:r)?["\'][^"\']*["\'])', line)
        if pat_match and 'category=' not in line:
            old = pat_match.group(1)
            lines[i] = line.replace(old, f'{old}, category="{category}"', 1)
            fixed += 1
            i += 1
            continue
        
        # Match: @ultroid_cmd("..." without category — positional string
        pat_match = re.match(r'(\s*@ultroid_cmd\(["\'][^"\']*["\'])', line)
        if pat_match and 'category=' not in line:
            old = pat_match.group(1)
            lines[i] = line.replace(old, f'{old}, category="{category}"', 1)
            fixed += 1
            i += 1
            continue
        
        i += 1
    
    if fixed:
        with open(filepath, 'w') as f:
            f.write('\n'.join(lines))
    
    return fixed


def main():
    total_fixed = 0
    for filepath in sorted(glob.glob(os.path.join(PLUGIN_DIR, "*.py"))):
        name = os.path.basename(filepath)
        if name.startswith("_"):
            continue
        
        fixed = fix_file(filepath)
        if fixed:
            with open(filepath) as f:
                cat = get_file_category(f.read())
            print(f"  ✅ {name} → «{cat}» ({fixed} fixed)")
            total_fixed += fixed
    
    print(f"\n{'='*55}")
    print(f"Total fixed: {total_fixed}")
    
    # Final count
    missing = 0
    for filepath in sorted(glob.glob(os.path.join(PLUGIN_DIR, "*.py"))):
        name = os.path.basename(filepath)
        if name.startswith("_"):
            continue
        with open(filepath) as f:
            content = f.read()
        cmds = len(re.findall(r'@ultroid_cmd\(', content))
        cats = len(re.findall(r'category=', content))
        if cmds > cats:
            missing += cmds - cats
            print(f"  ⚠️  STILL MISSING: {name} ({cmds - cats})")
    print(f"Remaining: {missing}")


if __name__ == "__main__":
    main()
