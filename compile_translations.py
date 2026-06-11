# -*- coding: utf-8 -*-
import os
import struct

AR_TRANSLATIONS = {
    "": (
        "Project-Id-Version: accessibleDiscord 1.0.0\n"
        "Report-Msgid-Bugs-To: \n"
        "POT-Creation-Date: 2026-06-11 00:00+0000\n"
        "PO-Revision-Date: 2026-06-11 00:00+0000\n"
        "Last-Translator: salmanf16\n"
        "Language-Team: \n"
        "Language: ar\n"
        "MIME-Version: 1.0\n"
        "Content-Type: text/plain; charset=UTF-8\n"
        "Content-Transfer-Encoding: 8bit\n"
    ),
    "Accessible Discord": "Accessible Discord",
    "Install BetterDiscord (automatic)": "تثبيت BetterDiscord (تلقائي)",
    "Announce when members join a voice channel": "نطق انضمام الأعضاء للقناة الصوتية",
    "Announce when members leave a voice channel": "نطق مغادرة الأعضاء للقناة الصوتية",
    "Announce microphone mute/unmute status changes": "نطق كتم وإلغاء كتم ميكروفون الأعضاء",
    "Announce headset deafen/undeafen status changes": "نطق تعطيل وتفعيل سمع الأعضاء",
    "Announce incoming text messages in the active channel": "نطق الرسائل النصية الواردة بالقناة النشطة",
    "Downloading...": "جاري التحميل...",
    "Downloading BetterDiscord": "تحميل BetterDiscord",
    "Connecting to server...": "جاري الاتصال بالخادم...",
    "Downloading BetterDiscord installer, please wait...": "جاري تحميل مثبت BetterDiscord المساعد، يرجى الانتظار...",
    "{minutes} min and {seconds} sec": "{minutes} دقيقة و {seconds} ثانية",
    "{seconds} sec": "{seconds} ثانية",
    "Calculating...": "جاري الحساب...",
    "Downloaded {downloaded} KB of {total} KB ({percent}%)\nTime remaining: {remaining}": "تم تحميل {downloaded} ك.ب من أصل {total} ك.ب ({percent}%)\nالوقت المتبقي: {remaining}",
    "Downloaded {downloaded} KB": "تم تحميل {downloaded} ك.ب",
    "BetterDiscord installer downloaded and opened successfully. Please complete the installation in the opened window.": "تم تحميل مثبت BetterDiscord بنجاح وفتحه. يرجى إكمال التثبيت من النافذة المفتوحة.",
    "Failed to download BetterDiscord: {error}": "فشل تحميل BetterDiscord: {error}",
    "Download failed, retry": "فشل التحميل، اضغط لإعادة المحاولة",
    "{user} joined voice channel {channel}": "{user} انضم إلى القناة الصوتية {channel}",
    "{user} joined": "{user} انضم للقناة",
    "{user} left voice channel {channel}": "{user} غادر القناة الصوتية {channel}",
    "{user} left": "{user} غادر القناة",
    "muted": "كتم الصوت",
    "unmuted": "ألغى كتم الصوت",
    "{user} {state}": "{user} {state}",
    "deafened": "عطل السمع",
    "undeafened": "فعل السمع",
    "New message from {user}: {content}": "رسالة جديدة من {user}: {content}"
}

def escape_string(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\t', '\\t')

def write_po_file(po_path, translations):
    with open(po_path, "w", encoding="utf-8") as f:
        f.write('# NVDA Accessible Discord Addon - ar\n')
        f.write('# This file is distributed under the same license as the accessibleDiscord package.\n#\n')
        
        # Write header
        f.write('msgid ""\n')
        f.write('msgstr ""\n')
        header_val = translations[""]
        for line in header_val.splitlines(keepends=True):
            f.write(f'"{escape_string(line)}"\n')
        f.write('\n')
        
        # Write other translations
        for msgid, msgstr in sorted(translations.items()):
            if msgid == "":
                continue
            f.write(f'msgid "{escape_string(msgid)}"\n')
            f.write(f'msgstr "{escape_string(msgstr)}"\n\n')

def compile_po_to_mo(po_path, mo_path, translations):
    sorted_keys = sorted([k for k in translations.keys() if k != ""])
    all_keys = [""] + sorted_keys
    
    key_data = []
    val_data = []
    
    for k in all_keys:
        key_data.append(k.encode("utf-8"))
        val_data.append(translations[k].encode("utf-8"))
        
    num_strings = len(all_keys)
    
    orig_table_offset = 28
    trans_table_offset = orig_table_offset + 8 * num_strings
    strings_start_offset = trans_table_offset + 8 * num_strings
    
    current_offset = strings_start_offset
    orig_table = []
    for k_bytes in key_data:
        orig_table.append((len(k_bytes), current_offset))
        current_offset += len(k_bytes) + 1
        
    trans_table = []
    for v_bytes in val_data:
        trans_table.append((len(v_bytes), current_offset))
        current_offset += len(v_bytes) + 1
        
    with open(mo_path, "wb") as f:
        f.write(struct.pack("<Iiiiiii", 
            0x950412de,
            0,
            num_strings,
            orig_table_offset,
            trans_table_offset,
            0, 0
        ))
        
        for length, offset in orig_table:
            f.write(struct.pack("<ii", length, offset))
            
        for length, offset in trans_table:
            f.write(struct.pack("<ii", length, offset))
            
        for k_bytes in key_data:
            f.write(k_bytes + b"\x00")
            
        for v_bytes in val_data:
            f.write(v_bytes + b"\x00")

if __name__ == "__main__":
    locale_dir = r"locale\ar\LC_MESSAGES"
    os.makedirs(locale_dir, exist_ok=True)
    
    po_path = os.path.join(locale_dir, "nvda.po")
    mo_path = os.path.join(locale_dir, "nvda.mo")
    
    print("Writing PO file...")
    write_po_file(po_path, AR_TRANSLATIONS)
    print("Compiling PO to MO...")
    compile_po_to_mo(po_path, mo_path, AR_TRANSLATIONS)
    print("Localization compiled successfully!")
