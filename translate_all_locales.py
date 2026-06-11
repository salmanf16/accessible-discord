# -*- coding: utf-8 -*-
import os
import sys
import re
import time
import struct
import socket
import urllib.parse
import http.client
import json

# Set default socket timeout to prevent network requests from hanging
socket.setdefaulttimeout(5.0)

cur_dir = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(cur_dir, "globalPlugins")
LOCALE_DIR = os.path.join(cur_dir, "locale")

def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        try:
            encoding = sys.stdout.encoding or 'utf-8'
            print(msg.encode(encoding, errors='replace').decode(encoding))
        except Exception:
            pass

# Verified Translations Dictionaries for 100% Quality
AR_DICT = {
    "Accessible Discord": "Accessible Discord",
    "Install BetterDiscord": "تثبيت BetterDiscord",
    "Announce when members join a voice channel": "نطق انضمام الأعضاء للقناة الصوتية",
    "Announce when members leave a voice channel": "نطق مغادرة الأعضاء للقناة الصوتية",
    "Announce microphone mute/unmute status changes": "نطق كتم وإلغاء كتم ميكروفون الأعضاء",
    "Announce headset deafen/undeafen status changes": "نطق تعطيل وتفعيل سمع الأعضاء",
    "Announce when members start or stop streaming": "نطق بدء وإيقاف بث الأعضاء",
    "Announce when members join or leave your stream": "نطق انضمام ومغادرة الأعضاء لبثك",
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

    "BetterDiscord companion plugin copied automatically. Please enable it in Discord settings.": "تم تثبيت ملحق ديسكورد المساعد تلقائياً بنجاح. يرجى تفعيله من إعدادات ديسكورد."
}

FR_DICT = {
    "Accessible Discord": "Accessible Discord",
    "Install BetterDiscord": "Installer BetterDiscord",
    "Announce when members join a voice channel": "Annoncer quand les membres rejoignent un salon vocal",
    "Announce when members leave a voice channel": "Annoncer quand les membres quittent un salon vocal",
    "Announce microphone mute/unmute status changes": "Annoncer les changements d'état du muet/non muet du microphone",
    "Announce headset deafen/undeafen status changes": "Annoncer les changements d'état de sourdine du casque",
    "Announce when members start or stop streaming": "Annoncer quand les membres commencent ou arrêtent de diffuser",
    "Announce when members join or leave your stream": "Annoncer quand les membres rejoignent ou quittent votre diffusion",
    "Announce incoming text messages in the active channel": "Annoncer les messages texte entrants dans le salon actif",
    "Downloading...": "Téléchargement...",
    "Downloading BetterDiscord": "Téléchargement de BetterDiscord",
    "Connecting to server...": "Connexion au serveur...",
    "Downloading BetterDiscord installer, please wait...": "Téléchargement de l'installateur BetterDiscord, veuillez patienter...",
    "{minutes} min and {seconds} sec": "{minutes} min et {seconds} sec",
    "{seconds} sec": "{seconds} sec",
    "Calculating...": "Calcul en cours...",
    "Downloaded {downloaded} KB of {total} KB ({percent}%)\nTime remaining: {remaining}": "Téléchargé {downloaded} Ko sur {total} Ko ({percent}%)\nTemps restant : {remaining}",
    "Downloaded {downloaded} KB": "Téléchargé {downloaded} Ko",
    "BetterDiscord installer downloaded and opened successfully. Please complete the installation in the opened window.": "L'installateur BetterDiscord a été téléchargé et ouvert avec succès. Veuillez terminer l'installation dans la fenêtre ouverte.",
    "Failed to download BetterDiscord: {error}": "Échec du téléchargement de BetterDiscord : {error}",
    "Download failed, retry": "Le téléchargement a échoué, réessayez",

    "BetterDiscord companion plugin copied automatically. Please enable it in Discord settings.": "L'extension compagnon BetterDiscord a été copiée automatiquement. Veuillez l'activer dans les paramètres de Discord."
}

LOCAL_DICTS = {
    "ar": AR_DICT,
    "fr": FR_DICT
}

# Google Translate Connection Manager
class PersistentConnectionManager:
    def __init__(self):
        self.conn = None

    def get_conn(self):
        if self.conn is None:
            self.conn = http.client.HTTPSConnection("translate.googleapis.com", timeout=3)
        return self.conn

    def request_translate(self, to_translate, to_language="auto", from_language="auto"):
        to_translate_quoted = urllib.parse.quote(to_translate)
        path = "/translate_a/single?client=gtx&sl=%s&tl=%s&dt=t&q=%s" % (from_language, to_language, to_translate_quoted)
        
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Connection": "keep-alive"
        }
        
        for attempt in range(2):
            try:
                connection = self.get_conn()
                connection.request("GET", path, headers=headers)
                resp = connection.getresponse()
                if resp.status == 200:
                    data_bytes = resp.read()
                    data = json.loads(data_bytes.decode("utf-8"))
                    parts = []
                    if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                        for chunk in data[0]:
                            if chunk and isinstance(chunk, list) and len(chunk) > 0 and chunk[0]:
                                parts.append(chunk[0])
                    return "".join(parts)
                else:
                    resp.read()
            except Exception:
                if self.conn:
                    try:
                        self.conn.close()
                    except Exception:
                        pass
                self.conn = None
        return ""

_translator = PersistentConnectionManager()

def translate(to_translate, to_language="auto", from_language="auto"):
    lines = to_translate.splitlines()
    translated_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            translated_lines.append(line)
            continue
        line_result = _translator.request_translate(stripped, to_language, from_language)
        translated_lines.append(line_result if line_result else stripped)
        
    if "\r\n" in to_translate:
        return "\r\n".join(translated_lines)
    return "\n".join(translated_lines)


# 1. Scan for all translatable strings in Python files
def extract_translatable_strings(directory):
    found_strings = set()
    double_quote_re = re.compile(r'_\(\s*"((?:[^"\\]|\\.)*)"\s*\)')
    single_quote_re = re.compile(r"_\(\s*'((?:[^'\\]|\\.)*)'\s*\)")
    
    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith(".py"):
                continue
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Find all double quote matches
                for match in double_quote_re.finditer(content):
                    s = match.group(1)
                    s = s.replace(r'\"', '"').replace(r'\n', '\n').replace(r'\t', '\t')
                    found_strings.add(s)
                
                # Find all single quote matches
                for match in single_quote_re.finditer(content):
                    s = match.group(1)
                    s = s.replace(r"\'", "'").replace(r'\n', '\n').replace(r'\t', '\t')
                    found_strings.add(s)
            except Exception as e:
                safe_print(f"Error reading {path}: {e}")
                
    return found_strings

# 2. Parse PO file
def parse_po_file(po_path):
    translations = {}
    if not os.path.exists(po_path):
        return translations
        
    with open(po_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    entries = re.split(r'\n\n+', content)
    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue
            
        msgid_match = re.search(r'msgid\s+(".*?(?<!\\)"(?:\s*".*?(?<!\\)")*)', entry, re.DOTALL)
        msgstr_match = re.search(r'msgstr\s+(".*?(?<!\\)"(?:\s*".*?(?<!\\)")*)', entry, re.DOTALL)
        
        if msgid_match and msgstr_match:
            def parse_quoted_block(block):
                lines = re.findall(r'"((?:[^"\\]|\\.)*)"', block)
                s = "".join(lines)
                s = s.replace(r'\"', '"').replace(r'\n', '\n').replace(r'\t', '\t').replace(r'\\', '\\')
                return s
                
            msgid = parse_quoted_block(msgid_match.group(1))
            msgstr = parse_quoted_block(msgstr_match.group(1))
            translations[msgid] = msgstr
                
    return translations

# 3. Write PO file
def write_po_file(po_path, translations, lang):
    header_val = translations.get("", (
        f"Project-Id-Version: accessibleDiscord 1.0.1\n"
        "Report-Msgid-Bugs-To: \n"
        "POT-Creation-Date: 2026-06-11 00:00+0000\n"
        "PO-Revision-Date: 2026-06-11 00:00+0000\n"
        "Last-Translator: Accessible Discord Translation Pipeline\n"
        "Language-Team: \n"
        f"Language: {lang}\n"
        "MIME-Version: 1.0\n"
        "Content-Type: text/plain; charset=UTF-8\n"
        "Content-Transfer-Encoding: 8bit\n"
    ))
    
    def escape_string(s):
        return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\t', '\\t')

    with open(po_path, "w", encoding="utf-8") as f:
        f.write(f'# NVDA Accessible Discord Addon - {lang}\n')
        f.write('# This file is distributed under the same license as the accessibleDiscord package.\n#\n')
        
        # Write header (msgid "")
        f.write('msgid ""\n')
        f.write('msgstr ""\n')
        for line in header_val.splitlines(keepends=True):
            f.write(f'"{escape_string(line)}"\n')
        f.write('\n')
        
        # Write other translations
        for msgid, msgstr in sorted(translations.items()):
            if msgid == "":
                continue
            f.write(f'msgid "{escape_string(msgid)}"\n')
            f.write(f'msgstr "{escape_string(msgstr)}"\n\n')

# 4. Compile PO to MO (binary format)
def compile_po_to_mo(po_path, mo_path, lang):
    translations = parse_po_file(po_path)
    if not translations:
        return False
        
    if "" not in translations:
        translations[""] = (
            f"Project-Id-Version: accessibleDiscord 1.0.1\n"
            "Report-Msgid-Bugs-To: \n"
            "POT-Creation-Date: 2026-06-11 00:00+0000\n"
            "PO-Revision-Date: 2026-06-11 00:00+0000\n"
            "Last-Translator: Accessible Discord Translation Pipeline\n"
            "Language-Team: \n"
            f"Language: {lang}\n"
            "MIME-Version: 1.0\n"
            "Content-Type: text/plain; charset=UTF-8\n"
            "Content-Transfer-Encoding: 8bit\n"
        )
        
    sorted_keys = sorted([k for k in translations.keys() if k != ""])
    all_keys = [""] + sorted_keys
    
    key_data = []
    val_data = []
    
    for k in all_keys:
        k_bytes = k.encode("utf-8")
        v_bytes = translations[k].encode("utf-8")
        key_data.append(k_bytes)
        val_data.append(v_bytes)
        
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
            
    return True

def clean_and_translate_locales():
    safe_print("--- Starting Full Localization Pipeline ---")
    code_strings = extract_translatable_strings(SRC_DIR)
    safe_print(f"Extracted {len(code_strings)} translatable strings from code.")
    
    os.makedirs(LOCALE_DIR, exist_ok=True)
    langs = ["ar", "fr"]
    safe_print(f"Target language locales: {langs}")
    
    for idx, lang in enumerate(langs):
        po_dir = os.path.join(LOCALE_DIR, lang, "LC_MESSAGES")
        os.makedirs(po_dir, exist_ok=True)
        po_path = os.path.join(po_dir, "nvda.po")
        mo_path = os.path.join(po_dir, "nvda.mo")
        
        safe_print(f"[{idx+1}/{len(langs)}] Processing locale '{lang}'...")
        
        # Load existing translations
        existing = parse_po_file(po_path)
        
        # Keep only code strings or header
        cleaned = {}
        for k, v in existing.items():
            if k in code_strings or k == "":
                cleaned[k] = v
                
        # Find missing strings
        missing = sorted(list(code_strings - set(cleaned.keys())))
        
        # Translate missing strings
        if missing:
            safe_print(f"  -> Found {len(missing)} missing translations for '{lang}'.")
            local_dict = LOCAL_DICTS.get(lang, {})
            for s in missing:
                if s in local_dict:
                    cleaned[s] = local_dict[s]
                    safe_print(f"     * '{s[:30]}...' -> '{local_dict[s][:30]}...' (Local Dict)")
                    continue
                try:
                    translated = translate(s, lang, "en")
                    if translated and translated.strip() != s.strip():
                        translated = translated.replace("{ ", "{").replace(" }", "}")
                        cleaned[s] = translated
                        safe_print(f"     * '{s[:30]}...' -> '{translated[:30]}...' (Google Translate)")
                    else:
                        cleaned[s] = s
                except Exception as e:
                    safe_print(f"     ! Error translating '{s[:20]}': {e}")
                    cleaned[s] = s
                time.sleep(0.05)
                
        # Write PO file
        write_po_file(po_path, cleaned, lang)
        
        # Compile MO file
        compile_po_to_mo(po_path, mo_path, lang)
        safe_print(f"  -> Compiled locale '{lang}' successfully.")
        
    safe_print("--- Localization Pipeline Completed Successfully! ---")

if __name__ == "__main__":
    clean_and_translate_locales()
