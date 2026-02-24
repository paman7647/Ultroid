import os
import glob

def mass_replace(directory, target, replacement):
    count = 0
    for file_path in glob.glob(os.path.join(directory, "**/*.py"), recursive=True):
        if not os.path.isfile(file_path):
            continue
            
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if target in content:
            new_content = content.replace(target, replacement)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated: {file_path}")
            count += 1
            
    print(f"Total files updated: {count}")

if __name__ == "__main__":
    TARGET = "Redeveloped and Maintained by"
    REPLACEMENT = "Redeveloped and Maintained by"
    DIR = "/Users/paman7647/Downloads/Ultroid-main"
    
    mass_replace(DIR, TARGET, REPLACEMENT)
