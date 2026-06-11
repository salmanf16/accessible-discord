# -*- coding: utf-8 -*-
import os
import shutil
import zipfile
from buildVars import addon_info

SRC_DIR = r"d:\accessible_discord"
INSTALL_DIR = r"C:\Users\salma\AppData\Roaming\nvda\addons\accessibleDiscord"
OUTPUT_ADDON = r"d:\accessible_discord.nvda-addon"

EXCLUDE_DIRS = {"__pycache__", ".git", "addon"}
EXCLUDE_EXTS = {".pyc", ".whl", ".zip", ".nvda-addon", ".gitattributes", ".gitignore"}


def clean_pycache(directory):
    if not os.path.exists(directory):
        return
    for root, dirs, files in os.walk(directory):
        for d in list(dirs):
            if d == "__pycache__":
                path = os.path.join(root, d)
                try:
                    shutil.rmtree(path)
                    dirs.remove(d)
                except Exception:
                    pass


def should_exclude(f, relative_path):
    f_lower = f.lower()
    if f_lower == "manifest.ini":
        return False
    ext = os.path.splitext(f)[1].lower()
    if ext in EXCLUDE_EXTS or ext in (".ini", ".json", ".log", ".txt", ".md"):
        return True
    if relative_path == "." and ext == ".py":
        return True
    return False


def generate_manifest():
    manifest_tpl_path = os.path.join(SRC_DIR, "manifest.ini.tpl")
    manifest_out_path = os.path.join(SRC_DIR, "manifest.ini")
    
    if not os.path.exists(manifest_tpl_path):
        print("ERROR: manifest.ini.tpl not found!")
        return False
        
    try:
        with open(manifest_tpl_path, "r", encoding="utf-8") as f:
            template_content = f.read()
            
        # Replace placeholders
        for key, val in addon_info.items():
            placeholder = f"%{key}%"
            template_content = template_content.replace(placeholder, str(val))
            
        with open(manifest_out_path, "w", encoding="utf-8") as f:
            f.write(template_content)
        print("Generated manifest.ini from template successfully.")
        return True
    except Exception as e:
        print(f"Failed to generate manifest.ini: {e}")
        return False


def copy_to_installed():
    clean_pycache(SRC_DIR)
    clean_pycache(INSTALL_DIR)
    print("Copying project files to installed NVDA addon folder...")
    
    # Create the directory if it doesn't exist to make it easier for fresh installations
    if not os.path.exists(INSTALL_DIR):
        try:
            os.makedirs(INSTALL_DIR, exist_ok=True)
            print(f"Created new installed directory: {INSTALL_DIR}")
        except Exception as e:
            print(f"Error: Could not create directory {INSTALL_DIR}: {e}")
            return False

    copied_count = 0
    for root, dirs, files in os.walk(SRC_DIR):
        # Modify dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        relative_path = os.path.relpath(root, SRC_DIR)
        if relative_path == ".":
            target_root = INSTALL_DIR
        else:
            target_root = os.path.join(INSTALL_DIR, relative_path)

        os.makedirs(target_root, exist_ok=True)

        for f in files:
            if should_exclude(f, relative_path):
                continue

            src_file = os.path.join(root, f)
            dst_file = os.path.join(target_root, f)
            
            try:
                shutil.copy2(src_file, dst_file)
                copied_count += 1
            except Exception as e:
                print(f"Warning: Failed to copy {f}: {e}")

    print(f"Successfully copied {copied_count} files to NVDA installation.")
    return True


def package_addon():
    clean_pycache(SRC_DIR)
    print(f"Packaging addon into {OUTPUT_ADDON}...")
    
    try:
        if os.path.exists(OUTPUT_ADDON):
            os.remove(OUTPUT_ADDON)
    except Exception as e:
        print(f"Error removing old addon file: {e}")
        return False

    packed_count = 0
    try:
        with zipfile.ZipFile(OUTPUT_ADDON, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(SRC_DIR):
                dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
                
                relative_path = os.path.relpath(root, SRC_DIR)
                
                for f in files:
                    if should_exclude(f, relative_path):
                        continue

                    file_path = os.path.join(root, f)
                    
                    if relative_path == ".":
                        arcname = f
                    else:
                        arcname = os.path.join(relative_path, f)
                        
                    zf.write(file_path, arcname)
                    packed_count += 1
        print(f"Successfully packaged {packed_count} files into {OUTPUT_ADDON}.")
        return True
    except Exception as e:
        print(f"Packaging failed: {e}")
        return False


if __name__ == "__main__":
    print("--- NVDA Accessible Discord Addon Deploy & Package ---")
    manifest_success = generate_manifest()
    
    if manifest_success:
        copy_success = copy_to_installed()
        pkg_success = package_addon()
        
        # Clean up temporary manifest.ini after build
        manifest_out_path = os.path.join(SRC_DIR, "manifest.ini")
        if os.path.exists(manifest_out_path):
            try:
                os.remove(manifest_out_path)
                print("Cleaned up temporary manifest.ini")
            except Exception:
                pass
                
        if copy_success and pkg_success:
            print("Deployment and packaging completed successfully!")
        else:
            print("Process completed with errors.")
    else:
        print("Build aborted due to manifest generation errors.")
