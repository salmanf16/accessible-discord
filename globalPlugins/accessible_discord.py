import os
import shutil
import threading
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import wx
import config
import speech
import api
import globalPluginHandler
from gui import settingsDialogs
import gui.guiHelper
import addonHandler
import logHandler

logHandler.log.info("Accessible Discord global plugin loading")
addonHandler.initTranslation()

confspec = {
    "speak_join": "boolean(default=True)",
    "speak_leave": "boolean(default=True)",
    "speak_mute": "boolean(default=True)",
    "speak_deafen": "boolean(default=True)",
    "speak_message": "boolean(default=True)",
}
config.conf.spec["accessibleDiscord"] = confspec


class AccessibleDiscordSettingsPanel(settingsDialogs.SettingsPanel):
    title = _("Accessible Discord")
    
    def is_bd_installed(self):
        appdata = os.environ.get("APPDATA")
        if appdata:
            return os.path.exists(os.path.join(appdata, "BetterDiscord", "plugins"))
        return False
        
    def makeSettings(self, settingsSizer):
        helper = gui.guiHelper.BoxSizerHelper(self, sizer=settingsSizer)
        
        if NVDAEventRequestHandler.plugin_instance:
            NVDAEventRequestHandler.plugin_instance.deploy_bd_plugin()
        
        if not self.is_bd_installed():
            label = _("Install BetterDiscord (automatic)")
            self.install_bd_btn = wx.Button(self, label=label)
            self.install_bd_btn.Bind(wx.EVT_BUTTON, self.on_install_bd)
            settingsSizer.Add(self.install_bd_btn, 0, wx.ALL | wx.EXPAND | wx.BOTTOM, 15)
            
        self.speak_join_cb = helper.addItem(wx.CheckBox(self, label=_("Announce when members join a voice channel")))
        self.speak_join_cb.SetValue(config.conf["accessibleDiscord"]["speak_join"])
        
        self.speak_leave_cb = helper.addItem(wx.CheckBox(self, label=_("Announce when members leave a voice channel")))
        self.speak_leave_cb.SetValue(config.conf["accessibleDiscord"]["speak_leave"])
        
        self.speak_mute_cb = helper.addItem(wx.CheckBox(self, label=_("Announce microphone mute/unmute status changes")))
        self.speak_mute_cb.SetValue(config.conf["accessibleDiscord"]["speak_mute"])
        
        self.speak_deafen_cb = helper.addItem(wx.CheckBox(self, label=_("Announce headset deafen/undeafen status changes")))
        self.speak_deafen_cb.SetValue(config.conf["accessibleDiscord"]["speak_deafen"])
        
        self.speak_message_cb = helper.addItem(wx.CheckBox(self, label=_("Announce incoming text messages in the active channel")))
        self.speak_message_cb.SetValue(config.conf["accessibleDiscord"]["speak_message"])

    def on_install_bd(self, event):
        self.install_bd_btn.Disable()
        self.install_bd_btn.SetLabel(_("Downloading..."))
        
        dialog = wx.ProgressDialog(
            title=_("Downloading BetterDiscord"),
            message=_("Connecting to server..."),
            maximum=100,
            parent=self,
            style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE | wx.PD_REMAINING_TIME | wx.PD_ELAPSED_TIME
        )
        
        threading.Thread(target=self._download_and_run_bd, args=(dialog,), daemon=True).start()

    def _download_and_run_bd(self, dialog):
        import urllib.request
        import tempfile
        import time
        
        speech.speakText(_("Downloading BetterDiscord installer, please wait..."))
            
        url = "https://github.com/BetterDiscord/Installer/releases/latest/download/BetterDiscord-Windows.exe"
        temp_dir = tempfile.gettempdir()
        installer_path = os.path.join(temp_dir, "BetterDiscord-Windows.exe")
        
        try:
            req = urllib.request.Request(
                url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            start_time = time.time()
            with urllib.request.urlopen(req) as response:
                total_size = int(response.headers.get('Content-Length', 0))
                bytes_downloaded = 0
                chunk_size = 65536
                
                with open(installer_path, 'wb') as out_file:
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break
                        out_file.write(chunk)
                        bytes_downloaded += len(chunk)
                        
                        elapsed = time.time() - start_time
                        if total_size > 0:
                            percent = int((bytes_downloaded / total_size) * 100)
                            if elapsed > 0.1:
                                speed = bytes_downloaded / elapsed
                                remaining_bytes = total_size - bytes_downloaded
                                remaining_seconds = int(remaining_bytes / speed) if speed > 0 else 0
                                
                                rem_min = remaining_seconds // 60
                                rem_sec = remaining_seconds % 60
                                if rem_min > 0:
                                    time_str = _("{minutes} min and {seconds} sec").format(minutes=rem_min, seconds=rem_sec)
                                else:
                                    time_str = _("{seconds} sec").format(seconds=remaining_seconds)
                            else:
                                time_str = _("Calculating...")
                                
                            msg = _("Downloaded {downloaded} KB of {total} KB ({percent}%)\nTime remaining: {remaining}").format(
                                downloaded=bytes_downloaded // 1024,
                                total=total_size // 1024,
                                percent=percent,
                                remaining=time_str
                            )
                            wx.CallAfter(dialog.Update, percent, msg)
                        else:
                            msg = _("Downloaded {downloaded} KB").format(downloaded=bytes_downloaded // 1024)
                            wx.CallAfter(dialog.Update, 0, msg)
            
            wx.CallAfter(dialog.Destroy)
            os.startfile(installer_path)
            speech.speakText(_("BetterDiscord installer downloaded and opened successfully. Please complete the installation in the opened window."))
            
            def reset_btn():
                if hasattr(self, 'install_bd_btn') and self.install_bd_btn:
                    self.install_bd_btn.Enable()
                    self.install_bd_btn.SetLabel(_("Install BetterDiscord (automatic)"))
            wx.CallAfter(reset_btn)
            
        except Exception as e:
            try:
                wx.CallAfter(dialog.Destroy)
            except Exception:
                pass
                
            speech.speakText(_("Failed to download BetterDiscord: {error}").format(error=str(e)))
            
            def enable_btn():
                if hasattr(self, 'install_bd_btn') and self.install_bd_btn:
                    self.install_bd_btn.Enable()
                    self.install_bd_btn.SetLabel(_("Download failed, retry"))
            wx.CallAfter(enable_btn)

    def onSave(self):
        config.conf["accessibleDiscord"]["speak_join"] = self.speak_join_cb.GetValue()
        config.conf["accessibleDiscord"]["speak_leave"] = self.speak_leave_cb.GetValue()
        config.conf["accessibleDiscord"]["speak_mute"] = self.speak_mute_cb.GetValue()
        config.conf["accessibleDiscord"]["speak_deafen"] = self.speak_deafen_cb.GetValue()
        config.conf["accessibleDiscord"]["speak_message"] = self.speak_message_cb.GetValue()


class NVDAEventRequestHandler(BaseHTTPRequestHandler):
    plugin_instance = None

    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_POST(self):
        if self.path == "/event":
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                event = json.loads(post_data.decode('utf-8'))
                
                self.send_response(200, "ok")
                self.end_headers()
                
                if NVDAEventRequestHandler.plugin_instance:
                    wx.CallAfter(NVDAEventRequestHandler.plugin_instance.handle_event, event)
            except Exception as e:
                self.send_response(500, str(e))
                self.end_headers()
        else:
            self.send_response(404, "Not Found")
            self.end_headers()


class GlobalPlugin(globalPluginHandler.GlobalPlugin):
    server_thread = None
    server = None

    def __init__(self):
        super(GlobalPlugin, self).__init__()
        gui.settingsDialogs.NVDASettingsDialog.categoryClasses.append(AccessibleDiscordSettingsPanel)
        NVDAEventRequestHandler.plugin_instance = self
        self.start_server()
        self.deploy_bd_plugin()
        threading.Thread(target=self.monitor_and_deploy_bd, daemon=True).start()

    def terminate(self):
        try:
            gui.settingsDialogs.NVDASettingsDialog.categoryClasses.remove(AccessibleDiscordSettingsPanel)
        except Exception:
            pass
        self.stop_server()
        super(GlobalPlugin, self).terminate()

    def start_server(self):
        def run_server():
            try:
                self.server = HTTPServer(('127.0.0.1', 48321), NVDAEventRequestHandler)
                self.server.serve_forever()
            except Exception:
                pass

        self.server_thread = threading.Thread(target=run_server)
        self.server_thread.daemon = True
        self.server_thread.start()

    def stop_server(self):
        if self.server:
            try:
                self.server.shutdown()
                self.server.server_close()
            except Exception:
                pass
            self.server = None
            
        if self.server_thread:
            self.server_thread.join(timeout=1.0)
            self.server_thread = None

    def deploy_bd_plugin(self):
        appdata = os.environ.get("APPDATA")
        if not appdata:
            return False
            
        bd_plugins_dir = os.path.join(appdata, "BetterDiscord", "plugins")
        if not os.path.exists(bd_plugins_dir):
            return False
            
        plugin_dir = os.path.dirname(__file__)
        src_file = os.path.join(plugin_dir, "AccessibleDiscord.plugin.js")
        dest_file = os.path.join(bd_plugins_dir, "AccessibleDiscord.plugin.js")
        
        if os.path.exists(src_file):
            try:
                shutil.copy2(src_file, dest_file)
                return True
            except Exception:
                pass
        return False

    def monitor_and_deploy_bd(self):
        import time
        appdata = os.environ.get("APPDATA")
        if not appdata:
            return
        bd_plugins_dir = os.path.join(appdata, "BetterDiscord", "plugins")
        dest_file = os.path.join(bd_plugins_dir, "AccessibleDiscord.plugin.js")
        
        if os.path.exists(dest_file):
            return
            
        for _ in range(200):
            if os.path.exists(bd_plugins_dir):
                plugin_dir = os.path.dirname(__file__)
                src_file = os.path.join(plugin_dir, "AccessibleDiscord.plugin.js")
                
                if os.path.exists(src_file):
                    try:
                        shutil.copy2(src_file, dest_file)
                        
                        import languageHandler
                        nvda_lang = languageHandler.getLanguage()
                        lang = nvda_lang[:2] if nvda_lang else "en"
                        if lang == "ar":
                            wx.CallAfter(speech.speakText, "تم تثبيت ملحق ديسكورد المساعد تلقائياً بنجاح. يرجى تفعيله من إعدادات ديسكورد.")
                        else:
                            wx.CallAfter(speech.speakText, "BetterDiscord companion plugin copied automatically. Please enable it in Discord settings.")
                        break
                    except Exception:
                        pass
            time.sleep(3)

    def handle_event(self, event):
        logHandler.log.info(f"Accessible Discord received event: {event}")
        event_type = event.get("type")
        user = event.get("user", "")
        channel = event.get("channel", "")
        content = event.get("content", "")
        
        conf = config.conf["accessibleDiscord"]
        
        import languageHandler
        nvda_lang = languageHandler.getLanguage()
        nvda_lang_code = nvda_lang[:2] if nvda_lang else "en"
        
        event_lang = event.get("lang")
        lang = event_lang if event_lang in ("ar", "en") else nvda_lang_code
        
        use_gettext = (lang == nvda_lang_code)
        msg = ""
        
        if lang == "ar":
            if event_type == "join":
                if not conf["speak_join"]:
                    return
                msg = f"{user} انضم إلى القناة الصوتية {channel}" if channel else f"{user} انضم للقناة"
            elif event_type == "leave":
                if not conf["speak_leave"]:
                    return
                msg = f"{user} غادر القناة الصوتية {channel}" if channel else f"{user} غادر القناة"
            elif event_type == "mute":
                if not conf["speak_mute"]:
                    return
                state_str = "كتم الصوت" if event.get("state") == "muted" else "ألغى كتم الصوت"
                msg = f"{user} {state_str}"
            elif event_type == "deafen":
                if not conf["speak_deafen"]:
                    return
                state_str = "عطل السمع" if event.get("state") == "deafened" else "فعل السمع"
                msg = f"{user} {state_str}"
            elif event_type == "message":
                if not conf["speak_message"]:
                    return
                if len(content) > 100:
                    content = content[:97] + "..."
                msg = f"رسالة جديدة من {user}: {content}"
        else:
            if event_type == "join":
                if not conf["speak_join"]:
                    return
                if channel:
                    msg = _("{user} joined voice channel {channel}").format(user=user, channel=channel) if use_gettext else f"{user} joined voice channel {channel}"
                else:
                    msg = _("{user} joined").format(user=user) if use_gettext else f"{user} joined"
            elif event_type == "leave":
                if not conf["speak_leave"]:
                    return
                if channel:
                    msg = _("{user} left voice channel {channel}").format(user=user, channel=channel) if use_gettext else f"{user} left voice channel {channel}"
                else:
                    msg = _("{user} left").format(user=user) if use_gettext else f"{user} left"
            elif event_type == "mute":
                if not conf["speak_mute"]:
                    return
                state = event.get("state")
                if use_gettext:
                    state_str = _("muted") if state == "muted" else _("unmuted")
                    msg = _("{user} {state}").format(user=user, state=state_str)
                else:
                    msg = f"{user} {state}"
            elif event_type == "deafen":
                if not conf["speak_deafen"]:
                    return
                state = event.get("state")
                if use_gettext:
                    state_str = _("deafened") if state == "deafened" else _("undeafened")
                    msg = _("{user} {state}").format(user=user, state=state_str)
                else:
                    msg = f"{user} {state}"
            elif event_type == "message":
                if not conf["speak_message"]:
                    return
                if len(content) > 100:
                    content = content[:97] + "..."
                msg = _("New message from {user}: {content}").format(user=user, content=content) if use_gettext else f"New message from {user}: {content}"

        if msg:
            speech.speakText(msg)
